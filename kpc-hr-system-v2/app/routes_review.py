"""평가자 API — 목표 승인, 1차 평가, 2차 검토·조정, 재작성 요청, 팀 대시보드."""
from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import core, scoring
from app.db import js, pj, row, rows, run, tx
from app.routes_me import _goals, peer_summary

router = APIRouter(prefix="/api/rv", tags=["평가자"])


def _team(c: dict[str, Any], viewer: dict[str, Any], everyone: bool = False) -> list[dict[str, Any]]:
    cid = c["id"]
    where, args = ("", [cid]) if everyone else ("AND (r.first_id=? OR r.second_id=?)", [cid, viewer["id"], viewer["id"]])
    people = rows("SELECT u.id, u.name, u.position, u.duty, u.hue, u.emp_no, o.name org_name, r.first_id, r.second_id, r.scheme, "
                  "f.name first_name, s.name second_name FROM relations r JOIN users u ON u.id=r.user_id LEFT JOIN orgs o ON o.id=u.org_id "
                  f"LEFT JOIN users f ON f.id=r.first_id LEFT JOIN users s ON s.id=r.second_id WHERE r.cycle_id=? {where} ORDER BY o.sort, u.name", *args)
    ids = [p["id"] for p in people]
    scores = core.cycle_scores(c, ids)
    st: dict[tuple[int, str], str] = {(r["user_id"], r["stage"]): r["status"] for r in rows("SELECT user_id, stage, status FROM reviews WHERE cycle_id=?", cid)}
    gstat: dict[int, dict[str, int]] = {}
    for g in rows("SELECT user_id, status, weight FROM goals WHERE cycle_id=?", cid):
        d = gstat.setdefault(g["user_id"], {"count": 0, "wsum": 0, "submitted": 0, "approved": 0, "redo": 0})
        d["count"] += 1
        d["wsum"] += g["weight"]
        key = {"submitted": "submitted", "approved": "approved", "rejected": "redo", "revise": "redo"}.get(g["status"])
        if key:
            d[key] += 1
    confirmed = {r["user_id"] for r in rows("SELECT user_id FROM results WHERE cycle_id=?", cid)}
    for p in people:
        p["role"] = "first" if p["first_id"] == viewer["id"] else "second" if p["second_id"] == viewer["id"] else "admin"
        p["goals"] = gstat.get(p["id"], {"count": 0, "wsum": 0, "submitted": 0, "approved": 0, "redo": 0})
        p.update({k: st.get((p["id"], k), "none") for k in ("self", "first", "second")})
        s = scores.get(p["id"], {})
        p.update({"final": s.get("final"), "grade": s.get("grade"), "complete": s.get("complete"), "missing": s.get("missing", []),
                  "adj": s.get("adj"), "goal_score": s.get("goal"), "comp_score": s.get("comp"), "extra_score": s.get("extra"),
                  "confirmed": p["id"] in confirmed})
    return people


@router.get("/dash")
def dash(user=Depends(core.current_user)):
    c = core.active_cycle()
    team = _team(c, user)
    firsts = [p for p in team if p["role"] == "first"]
    seconds = [p for p in team if p["role"] == "second"]
    todo = []
    pend = sum(p["goals"]["submitted"] for p in firsts)
    if pend:
        todo.append({"icon": "check-check", "text": f"승인 대기 목표 {pend}건", "link": "#/approvals", "level": "warn"})
    if c["phase"] == "review":
        left = [p for p in firsts if p["first"] != "submitted"]
        if left:
            todo.append({"icon": "clipboard-pen", "text": f"1차 평가 미제출 {len(left)}명", "link": "#/evaluate", "level": "warn"})
        sec = [p for p in seconds if p["first"] == "submitted" and p["second"] != "submitted"]
        if sec:
            todo.append({"icon": "scale", "text": f"2차 검토 대기 {len(sec)}명", "link": "#/evaluate", "level": "info"})
    peer = row("SELECT COUNT(*) n FROM peer_reviews WHERE cycle_id=? AND reviewer_id=? AND status='assigned'", c["id"], user["id"])["n"]
    if peer:
        todo.append({"icon": "users", "text": f"다면평가 작성 {peer}건", "link": "/app/me#/peer", "level": "info"})
    dist = {g: 0 for g, _ in c["config"]["grades"]}
    for p in firsts:
        if p["grade"]:
            dist[p["grade"]] += 1
    sched = c["config"].get("schedule", {})
    return {"todo": todo, "team": team, "dist": dist, "guide": c["config"]["guide"], "due": sched.get(c["phase"]),
            "notices": rows("SELECT * FROM notices ORDER BY pinned DESC, id DESC LIMIT 4"),
            "counts": {"first": len(firsts), "second": len(seconds), "goals_ok": sum(1 for p in firsts if p["goals"]["approved"] and p["goals"]["wsum"] == 100 and not p["goals"]["submitted"]),
                       "self_done": sum(1 for p in firsts if p["self"] == "submitted"),
                       "first_done": sum(1 for p in firsts if p["first"] == "submitted"),
                       "second_done": sum(1 for p in seconds if p["second"] == "submitted"), "pending_goals": pend}}


@router.get("/team")
def team(user=Depends(core.current_user)):
    c = core.active_cycle()
    return {"team": _team(c, user), "phase": c["phase"], "guide": c["config"]["guide"], "grades": c["config"]["grades"]}


# ── 목표 승인 ─────────────────────────────────────────────
@router.get("/goals")
def approvals(user=Depends(core.current_user)):
    c = core.active_cycle()
    people = rows("SELECT u.id, u.name, u.position, u.hue, o.name org_name FROM relations r JOIN users u ON u.id=r.user_id "
                  "LEFT JOIN orgs o ON o.id=u.org_id WHERE r.cycle_id=? AND r.first_id=? ORDER BY u.name", c["id"], user["id"])
    for p in people:
        p["goals"] = _goals(c["id"], p["id"])
        p["pending"] = sum(1 for g in p["goals"] if g["status"] == "submitted")
    return {"people": sorted(people, key=lambda p: -p["pending"]), "phase": c["phase"]}


class GoalAction(BaseModel):
    action: Literal["approve", "reject", "revise"]
    note: str = Field(default="", max_length=500)


def _first_of(c: dict[str, Any], uid: int, user: dict[str, Any]) -> None:
    rel = core.relation(c["id"], uid)
    if not rel or rel["first_id"] != user["id"]:
        raise HTTPException(403, "1차 평가자만 처리할 수 있습니다.")


@router.post("/goals/{gid}")
def act_goal(gid: int, body: GoalAction, user=Depends(core.current_user)):
    c = core.active_cycle()
    core.need_phase(c, "goal", "self", "review")
    g = row("SELECT * FROM goals WHERE id=? AND cycle_id=?", gid, c["id"])
    if not g:
        raise HTTPException(404, "목표를 찾을 수 없습니다.")
    _first_of(c, g["user_id"], user)
    if g["status"] != "submitted":
        raise HTTPException(409, "제출 상태의 목표만 처리할 수 있습니다.")
    if body.action != "approve" and len(body.note.strip()) < 5:
        raise HTTPException(400, "반려·수정 요청 사유는 5자 이상 입력해 주세요.")
    status = {"approve": "approved", "reject": "rejected", "revise": "revise"}[body.action]
    run("UPDATE goals SET status=?, review_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", status, body.note, gid)
    label = {"approve": "승인", "reject": "반려", "revise": "수정 요청"}[body.action]
    core.notify(g["user_id"], f"목표 '{g['title']}'이(가) {label}되었습니다.", "/app/me#/goals")
    core.audit(user, f"goal.{body.action}", {"goal": gid, "note": body.note})
    return {"ok": True}


@router.post("/goals-approve-all/{uid}")
def approve_all(uid: int, user=Depends(core.current_user)):
    c = core.active_cycle()
    core.need_phase(c, "goal", "self", "review")
    _first_of(c, uid, user)
    with tx() as con:
        n = con.execute("UPDATE goals SET status='approved', updated_at=CURRENT_TIMESTAMP WHERE cycle_id=? AND user_id=? AND status='submitted'",
                        (c["id"], uid)).rowcount
    core.notify(uid, f"목표 {n}건이 승인되었습니다.", "/app/me#/goals")
    return {"approved": n}


# ── 평가 워크스페이스 ──────────────────────────────────────
def _review(cid: int, uid: int, stage: str) -> dict[str, Any] | None:
    r = row("SELECT r.*, u.name reviewer_name FROM reviews r LEFT JOIN users u ON u.id=r.reviewer_id WHERE r.cycle_id=? AND r.user_id=? AND r.stage=?", cid, uid, stage)
    if r:
        r["goal_scores"], r["item_scores"] = pj(r["goal_scores"], {}), pj(r["item_scores"], {})
    return r


@router.get("/eval/{uid}")
def workspace(uid: int, user=Depends(core.current_user)):
    c = core.active_cycle()
    role = core.can_view_eval(c, user, uid)
    rel = core.relation(c["id"], uid)
    target = core.public_user(row("SELECT * FROM users WHERE id=?", uid))
    area = "mgmt" if rel["scheme"] == "leader" else "dev"
    first, second = _review(c["id"], uid, "first"), _review(c["id"], uid, "second")
    confirmed = bool(row("SELECT 1 FROM results WHERE cycle_id=? AND user_id=?", c["id"], uid))
    goals = [g for g in _goals(c["id"], uid) if g["status"] == "approved"]
    for g in goals:
        g["auto"] = scoring.convert(g["rate"], c["config"]["conv"]) if g["rate"] is not None else None
    first_open = role == "first" and c["phase"] == "review" and not (first and first["status"] == "submitted")
    return {
        "user": target, "role": role, "scheme": rel["scheme"], "weights": c["config"]["weights"][rel["scheme"]],
        "conv": c["config"]["conv"], "grades": c["config"]["grades"], "phase": c["phase"], "goals": goals,
        "items": rows("SELECT * FROM items WHERE cycle_id=? AND area IN ('comp',?) ORDER BY sort", c["id"], area),
        "self": _review(c["id"], uid, "self"), "first": first, "second": second,
        "first_name": (row("SELECT name FROM users WHERE id=?", rel["first_id"]) or {}).get("name"),
        "second_name": (row("SELECT name FROM users WHERE id=?", rel["second_id"]) or {}).get("name"),
        "adjustments": rows("SELECT a.*, u.name by_name FROM adjustments a LEFT JOIN users u ON u.id=a.by_id WHERE a.cycle_id=? AND a.user_id=? ORDER BY a.id", c["id"], uid),
        "peer": peer_summary(c["id"], uid), "score": core.cycle_scores(c, [uid]).get(uid), "confirmed": confirmed,
        "first_open": first_open,
        "second_open": role == "second" and c["phase"] in ("review", "calib") and bool(first and first["status"] == "submitted")
                       and not (second and second["status"] == "submitted") and not confirmed,
        "adjust_open": role in ("second", "admin") and c["phase"] in ("review", "calib") and not confirmed,
        "rewrite_open": role in ("first", "second") and bool(row("SELECT 1 FROM reviews WHERE cycle_id=? AND user_id=? AND reviewer_id=? AND status='submitted'", c["id"], uid, user["id"])),
        "history": [{"cycle": h["name"], **{k: pj(h["snapshot"], {}).get(k) for k in ("final", "grade")}} for h in rows(
            "SELECT c.name, r.snapshot FROM results r JOIN cycles c ON c.id=r.cycle_id WHERE r.user_id=? AND c.id!=? ORDER BY c.start_date", uid, c["id"])],
    }


class FirstIn(BaseModel):
    goal_scores: dict[str, float | None] = Field(default_factory=dict)
    item_scores: dict[str, int] = Field(default_factory=dict)
    comment: str = Field(default="", max_length=3000)
    submit: bool = False


@router.put("/eval/{uid}")
def save_first(uid: int, body: FirstIn, user=Depends(core.current_user)):
    ws = workspace(uid, user)
    if not ws["first_open"]:
        raise HTTPException(409, "1차 평가를 작성할 수 없는 상태입니다 (평가 진행 단계의 1차 평가자, 미제출 상태만 가능).")
    if any(v is not None and not 0 <= v <= 100 for v in body.goal_scores.values()):
        raise HTTPException(400, "목표 점수는 0~100점입니다.")
    if any(not 1 <= v <= 5 for v in body.item_scores.values()):
        raise HTTPException(400, "역량 점수는 1~5점입니다.")
    c = core.active_cycle()
    gs = {k: v for k, v in body.goal_scores.items() if v is not None}
    if body.submit:
        preview = scoring.compute(c["config"], ws["scheme"], ws["goals"], ws["items"], {"goal_scores": gs, "item_scores": body.item_scores},
                                  [a["delta"] for a in ws["adjustments"]])
        if not preview["complete"]:
            raise HTTPException(400, "산정 미완: " + " · ".join(preview["missing"]))
        if len(body.comment.strip()) < 10:
            raise HTTPException(400, "종합 의견은 10자 이상이어야 제출할 수 있습니다.")
    status = "submitted" if body.submit else "draft"
    run("INSERT INTO reviews(cycle_id,user_id,reviewer_id,stage,status,goal_scores,item_scores,comment,submitted_at) VALUES(?,?,?,?,?,?,?,?,"
        "CASE WHEN ?='submitted' THEN CURRENT_TIMESTAMP END) ON CONFLICT(cycle_id,user_id,stage) DO UPDATE SET status=excluded.status, "
        "goal_scores=excluded.goal_scores, item_scores=excluded.item_scores, comment=excluded.comment, submitted_at=excluded.submitted_at, updated_at=CURRENT_TIMESTAMP",
        c["id"], uid, user["id"], "first", status, js(gs), js(body.item_scores), body.comment, status)
    if body.submit:
        rel = core.relation(c["id"], uid)
        core.notify(rel["second_id"], f"{ws['user']['name']}님의 1차 평가가 제출되었습니다. 2차 검토를 진행해 주세요.", f"/app/review#/evaluate/{uid}")
        core.audit(user, "review.first.submit", {"user": uid})
    return {"ok": True, "status": status}


class SecondIn(BaseModel):
    comment: str = Field(default="", max_length=3000)
    submit: bool = False


@router.put("/second/{uid}")
def save_second(uid: int, body: SecondIn, user=Depends(core.current_user)):
    ws = workspace(uid, user)
    if not ws["second_open"]:
        raise HTTPException(409, "2차 검토를 작성할 수 없는 상태입니다.")
    c = core.active_cycle()
    status = "submitted" if body.submit else "draft"
    run("INSERT INTO reviews(cycle_id,user_id,reviewer_id,stage,status,comment,submitted_at) VALUES(?,?,?,?,?,?,CASE WHEN ?='submitted' THEN CURRENT_TIMESTAMP END) "
        "ON CONFLICT(cycle_id,user_id,stage) DO UPDATE SET status=excluded.status, comment=excluded.comment, submitted_at=excluded.submitted_at, updated_at=CURRENT_TIMESTAMP",
        c["id"], uid, user["id"], "second", status, body.comment, status)
    return {"ok": True, "status": status}


class AdjustIn(BaseModel):
    delta: float = Field(ge=-10, le=10)
    reason: str = Field(min_length=5, max_length=500)


@router.post("/adjust/{uid}")
def adjust(uid: int, body: AdjustIn, user=Depends(core.current_user)):
    """2차 평가자·HR 조정: 1회 ±10점, 사유 5자 이상, 확정 전까지 누적 가능 (매뉴얼 04장)."""
    ws = workspace(uid, user)
    if not ws["adjust_open"]:
        raise HTTPException(409, "조정할 수 없는 상태입니다 (평가 진행·조정 단계, 확정 전, 2차 평가자/HR).")
    if body.delta == 0:
        raise HTTPException(400, "0점 조정은 등록할 수 없습니다.")
    c = core.active_cycle()
    run("INSERT INTO adjustments(cycle_id,user_id,by_id,by_role,delta,reason) VALUES(?,?,?,?,?,?)",
        c["id"], uid, user["id"], "hr" if ws["role"] == "admin" else "second", body.delta, body.reason.strip())
    core.audit(user, "score.adjust", {"user": uid, "delta": body.delta, "reason": body.reason})
    return {"ok": True, "score": core.cycle_scores(c, [uid]).get(uid)}


class RewriteIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


@router.post("/rewrite/{uid}")
def request_rewrite(uid: int, body: RewriteIn, user=Depends(core.current_user)):
    c = core.active_cycle()
    role = core.can_view_eval(c, user, uid)
    if role not in ("first", "second"):
        raise HTTPException(403, "담당 평가자만 요청할 수 있습니다.")
    if row("SELECT 1 FROM rewrites WHERE cycle_id=? AND user_id=? AND stage=? AND status='open'", c["id"], uid, role):
        raise HTTPException(409, "이미 처리 대기 중인 재작성 요청이 있습니다.")
    run("INSERT INTO rewrites(cycle_id,user_id,stage,requester_id,reason) VALUES(?,?,?,?,?)", c["id"], uid, role, user["id"], body.reason)
    for a in rows("SELECT id FROM users WHERE is_admin=1 AND status='active'"):
        core.notify(a["id"], f"{user['name']}님의 재작성 요청이 접수되었습니다.", "/app/admin#/rewrites")
    return {"ok": True}
