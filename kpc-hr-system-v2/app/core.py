"""인증·권한·평가 관계·점수 집계 등 라우터들이 공유하는 도메인 서비스."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import HTTPException, Request

from app import scoring
from app.db import DATA_DIR, DEFAULT_CFG, PHASES, pj, row, rows, run, tx

COOKIE = "kpc_session"
TOKEN_TTL = 60 * 60 * 12
SECURE_COOKIE = os.environ.get("KPC_SECURE_COOKIE") == "1"


def _secret() -> bytes:
    env = os.environ.get("KPC_SECRET")
    if env:
        return env.encode()
    path = DATA_DIR / ".secret"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(secrets.token_hex(32))
    return path.read_text().strip().encode()


SECRET = _secret()


# ── 비밀번호 · 토큰 ─────────────────────────────────────────
def hash_pw(pw: str, iterations: int = 200_000) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), iterations).hex()
    return f"pbkdf2${iterations}${salt}${digest}"


def verify_pw(pw: str, stored: str | None) -> bool:
    try:
        _, it, salt, digest = (stored or "").split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), int(it)).hex()
        return hmac.compare_digest(calc, digest)
    except ValueError:
        return False


def make_token(user: dict[str, Any]) -> str:
    # v = 비밀번호 해시 지문 → 비밀번호 변경 시 기존 세션 자동 무효화
    body = base64.urlsafe_b64encode(json.dumps({"u": user["id"], "e": int(time.time()) + TOKEN_TTL,
                                                "v": (user["pw_hash"] or "")[-10:]}).encode()).decode()
    return f"{body}.{hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()}"


def read_token(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None
    body, sig = token.rsplit(".", 1)
    if not hmac.compare_digest(sig, hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()):
        return None
    data = pj(base64.urlsafe_b64decode(body.encode()).decode(), {})
    if data.get("e", 0) < time.time():
        return None
    user = row("SELECT * FROM users WHERE id=? AND status='active'", data.get("u"))
    if not user or (user["pw_hash"] or "")[-10:] != data.get("v"):
        return None
    return user


def session_user(request: Request) -> dict[str, Any] | None:
    return read_token(request.cookies.get(COOKIE))


def current_user(request: Request) -> dict[str, Any]:
    user = session_user(request)
    if not user:
        raise HTTPException(401, "로그인이 필요합니다.")
    return user


def require_admin(user: dict[str, Any]) -> None:
    if not user["is_admin"]:
        raise HTTPException(403, "관리자 권한이 필요합니다.")


def public_user(u: dict[str, Any] | None) -> dict[str, Any] | None:
    if not u:
        return None
    keep = ("id", "emp_no", "name", "email", "org_id", "position", "duty", "hire_date", "status", "is_admin", "hue", "must_change")
    out = {k: u.get(k) for k in keep}
    out["org_name"] = (row("SELECT name FROM orgs WHERE id=?", u.get("org_id")) or {}).get("name")
    out["has_account"] = bool(u.get("pw_hash"))
    return out


# ── 주기 · 단계 ─────────────────────────────────────────────
def load_cycle(cycle_id: int | None = None) -> dict[str, Any] | None:
    c = row("SELECT * FROM cycles WHERE id=?", cycle_id) if cycle_id else row("SELECT * FROM cycles WHERE active=1")
    if c:
        c["config"] = {**DEFAULT_CFG, **pj(c["config"], {})}
        c["phase_label"] = dict(PHASES).get(c["phase"], c["phase"])
    return c


def active_cycle() -> dict[str, Any]:
    c = load_cycle()
    if not c:
        raise HTTPException(409, "진행 중인 평가 주기가 없습니다.")
    return c


def need_phase(cycle: dict[str, Any], *phases: str) -> None:
    if cycle["phase"] not in phases:
        labels = ", ".join(dict(PHASES)[p] for p in phases)
        raise HTTPException(409, f"현재 단계({cycle['phase_label']})에서는 할 수 없습니다. 가능 단계: {labels}")


# ── 평가 관계 (매뉴얼 02장: 소속 조직장=1차, 상위 조직장=2차) ─────────
def org_chain(org_id: int | None, orgs: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    chain, seen = [], set()
    while org_id and org_id in orgs and org_id not in seen:
        seen.add(org_id)
        chain.append(orgs[org_id])
        org_id = orgs[org_id]["parent_id"]
    return chain


def auto_evaluators(user: dict[str, Any], orgs: dict[int, dict[str, Any]], active_ids: set[int]) -> tuple[int | None, int | None]:
    heads: list[int] = []
    for o in org_chain(user["org_id"], orgs):
        h = o["head_id"]
        if h and h != user["id"] and h in active_ids and h not in heads:
            heads.append(h)
    return (heads[0] if heads else None, heads[1] if len(heads) > 1 else None)


def is_leader(user: dict[str, Any], cfg: dict[str, Any]) -> bool:
    return (user.get("duty") or "") in cfg["leader_duties"]


def assign_relations(cycle: dict[str, Any], only: list[int] | None = None, force: bool = False) -> int:
    """조직도 기준 자동 배정. 수동 지정(manual)은 force가 아니면 유지. 1차 제출 후 인원은 건드리지 않는다."""
    orgs = {o["id"]: o for o in rows("SELECT * FROM orgs")}
    users = rows("SELECT * FROM users WHERE status='active'")
    active_ids = {u["id"] for u in users}
    existing = {r["user_id"]: r for r in rows("SELECT * FROM relations WHERE cycle_id=?", cycle["id"])}
    locked = {r["user_id"] for r in rows("SELECT user_id FROM reviews WHERE cycle_id=? AND stage='first' AND status='submitted'", cycle["id"])}
    n = 0
    with tx() as con:
        for u in users:
            if (only and u["id"] not in only) or u["id"] in locked:
                continue
            ex = existing.get(u["id"])
            first, second = auto_evaluators(u, orgs, active_ids)
            scheme = "leader" if is_leader(u, cycle["config"]) else "member"
            if ex and ex["manual"] and not force:
                first, second = ex["first_id"], ex["second_id"]
            if ex and ex["scheme_manual"] and not force:
                scheme = ex["scheme"]
            if not first:
                continue  # 대표이사 등 평가자 없는 인원은 대상 제외
            con.execute("INSERT INTO relations(cycle_id,user_id,first_id,second_id,scheme,manual,scheme_manual) VALUES(?,?,?,?,?,?,?) "
                        "ON CONFLICT(cycle_id,user_id) DO UPDATE SET first_id=excluded.first_id, second_id=excluded.second_id, scheme=excluded.scheme",
                        (cycle["id"], u["id"], first, second, scheme, ex["manual"] if ex else 0, ex["scheme_manual"] if ex else 0))
            n += 1
    return n


def assign_peers(cycle: dict[str, Any], per: int = 3) -> int:
    """다면평가 자동 배정 (매뉴얼 07장): 동료(같은 조직) 최대 3명 + 하급자(본인이 조직장인 조직) 최대 3명. 기존 지정은 유지."""
    import random
    users = rows("SELECT u.id, u.org_id FROM users u JOIN relations r ON r.user_id=u.id AND r.cycle_id=? WHERE u.status='active'", cycle["id"])
    by_org: dict[int, list[int]] = {}
    for u in rows("SELECT id, org_id FROM users WHERE status='active'"):
        by_org.setdefault(u["org_id"], []).append(u["id"])
    headed: dict[int, list[int]] = {}
    for o in rows("SELECT id, head_id FROM orgs WHERE head_id IS NOT NULL"):
        headed.setdefault(o["head_id"], []).append(o["id"])
    have: dict[int, dict[int, str]] = {}
    for p in rows("SELECT target_id, reviewer_id, kind FROM peer_reviews WHERE cycle_id=?", cycle["id"]):
        have.setdefault(p["target_id"], {})[p["reviewer_id"]] = p["kind"]
    n = 0
    with tx() as con:
        for u in users:
            rnd = random.Random(cycle["id"] * 100_000 + u["id"])
            cur = have.get(u["id"], {})
            subs = [m for oid in headed.get(u["id"], []) for m in by_org.get(oid, []) if m != u["id"]]
            pools = {"peer": [m for m in by_org.get(u["org_id"], []) if m != u["id"] and m not in subs], "sub": subs}
            for kind, pool in pools.items():
                pool = [m for m in pool if m not in cur]
                need = per - sum(1 for k in cur.values() if k == kind)
                for rid in rnd.sample(pool, min(max(need, 0), len(pool))):
                    con.execute("INSERT OR IGNORE INTO peer_reviews(cycle_id,target_id,reviewer_id,kind) VALUES(?,?,?,?)",
                                (cycle["id"], u["id"], rid, kind))
                    cur[rid] = kind
                    n += 1
    return n


def check_relation(cycle_id: int, uid: int, first_id: int | None, second_id: int | None) -> None:
    """본인 지정 · 1차=2차 · 순환(A→B→A) 거부 (매뉴얼 FAQ)."""
    if uid in (first_id, second_id):
        raise HTTPException(400, "본인을 본인의 평가자로 지정할 수 없습니다.")
    if first_id and first_id == second_id:
        raise HTTPException(400, "1차와 2차 평가자가 같을 수 없습니다.")
    firsts = {r["user_id"]: r["first_id"] for r in rows("SELECT user_id, first_id FROM relations WHERE cycle_id=?", cycle_id)}
    cur, seen = first_id, set()
    while cur and cur not in seen:
        if cur == uid:
            raise HTTPException(400, "평가 관계가 순환합니다 (예: A→B→A).")
        seen.add(cur)
        cur = firsts.get(cur)


def relation(cycle_id: int, uid: int) -> dict[str, Any] | None:
    return row("SELECT * FROM relations WHERE cycle_id=? AND user_id=?", cycle_id, uid)


def evaluator_pages(user: dict[str, Any]) -> list[str]:
    pages = ["me"]
    c = row("SELECT id FROM cycles WHERE active=1")
    is_eval = row("SELECT 1 FROM orgs WHERE head_id=?", user["id"]) or (
        c and row("SELECT 1 FROM relations WHERE cycle_id=? AND (first_id=? OR second_id=?)", c["id"], user["id"], user["id"]))
    if is_eval or user["is_admin"]:
        pages.append("review")
    if user["is_admin"]:
        pages.append("admin")
    return pages


def can_view_eval(cycle: dict[str, Any], viewer: dict[str, Any], uid: int) -> str:
    """평가 화면 접근 권한 — 'first' | 'second' | 'admin'."""
    rel = relation(cycle["id"], uid)
    if rel and rel["first_id"] == viewer["id"]:
        return "first"
    if rel and rel["second_id"] == viewer["id"]:
        return "second"
    if viewer["is_admin"]:
        return "admin"
    raise HTTPException(403, "담당 피평가자가 아닙니다.")


# ── 점수 집계 ──────────────────────────────────────────────
def cycle_scores(cycle: dict[str, Any], uids: list[int] | None = None) -> dict[int, dict[str, Any]]:
    """주기 내 전원의 점수를 한 번의 조회 묶음으로 계산 (N+1 회피)."""
    cid, cfg = cycle["id"], cycle["config"]
    rels = {r["user_id"]: r for r in rows("SELECT * FROM relations WHERE cycle_id=?", cid)}
    items = rows("SELECT * FROM items WHERE cycle_id=? ORDER BY sort, id", cid)
    goals: dict[int, list] = {}
    for g in rows("SELECT * FROM goals WHERE cycle_id=? ORDER BY sort, id", cid):
        goals.setdefault(g["user_id"], []).append(g)
    firsts = {r["user_id"]: {**r, "goal_scores": pj(r["goal_scores"], {}), "item_scores": pj(r["item_scores"], {})}
              for r in rows("SELECT * FROM reviews WHERE cycle_id=? AND stage='first'", cid)}
    deltas: dict[int, list] = {}
    for a in rows("SELECT user_id, delta FROM adjustments WHERE cycle_id=?", cid):
        deltas.setdefault(a["user_id"], []).append(a["delta"])
    out = {}
    for uid, rel in rels.items():
        if uids is not None and uid not in uids:
            continue
        out[uid] = scoring.compute(cfg, rel["scheme"], goals.get(uid, []), items, firsts.get(uid), deltas.get(uid, []))
    return out


def snapshot(cycle: dict[str, Any], uid: int) -> dict[str, Any]:
    """확정 시점 규칙 스냅샷 (매뉴얼 08장)."""
    res = cycle_scores(cycle, [uid]).get(uid)
    if not res or not res["complete"]:
        raise HTTPException(409, "산정 미완 상태라 확정할 수 없습니다.")
    cfg = cycle["config"]
    return {**res, "grades": cfg["grades"], "conv": cfg["conv"], "cycle": cycle["name"]}


# ── 알림 · 감사 ────────────────────────────────────────────
def notify(uid: int | None, text: str, link: str = "") -> None:
    if uid:
        run("INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)", uid, text, link)


def audit(user: dict[str, Any] | None, action: str, detail: Any = "") -> None:
    run("INSERT INTO audit(user_id,action,detail) VALUES(?,?,?)", user["id"] if user else None, action,
        detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False))
