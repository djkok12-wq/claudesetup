"""관리자(HR) API — 주기·단계, 평가 관계, 조직·KPI, 다면평가, 조정·확정, 집계, 사용자·계정, UI 스튜디오."""
from __future__ import annotations

import csv
import io
import secrets
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app import core, seed
from app.db import DEFAULT_CFG, DEFAULT_ITEMS, PHASE_KEYS, js, pj, row, rows, run, tx
from app.routes_me import peer_summary
from app.routes_review import _team

router = APIRouter(prefix="/api/ad", tags=["관리자"])


def admin(user=Depends(core.current_user)) -> dict[str, Any]:
    core.require_admin(user)
    return user


def _csv(header: list[str], data: list[list[Any]], filename: str) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    safe = lambda v: "'" + v if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v  # CSV 수식 주입 방지
    w.writerow(header)
    w.writerows([[safe(v) for v in r] for r in data])
    return Response("﻿" + buf.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ── 성과 홈 (대시보드) ─────────────────────────────────────
@router.get("/dash")
def dash(user=Depends(admin)):
    c = core.active_cycle()
    team = _team(c, user, everyone=True)
    n = len(team) or 1
    cid = c["id"]
    unassigned = rows("SELECT u.id, u.name FROM users u WHERE u.status='active' AND COALESCE(u.duty,'')!='대표이사' "
                      "AND u.id NOT IN (SELECT user_id FROM relations WHERE cycle_id=?)", cid)
    no_goal = [p for p in team if p["goals"]["count"] == 0]
    ready = [p for p in team if p["first"] == "submitted" and p["complete"] and not p["confirmed"]]
    rewrites = row("SELECT COUNT(*) n FROM rewrites WHERE status='open' AND cycle_id=?", cid)["n"]
    no_account = row("SELECT COUNT(*) n FROM users WHERE status='active' AND pw_hash IS NULL")["n"]
    pending_goals = sum(p["goals"]["submitted"] for p in team)
    actions = [a for a in [
        {"icon": "user-x", "title": "1차 평가자 미지정", "count": len(unassigned), "link": "#/relations", "level": "bad",
         "hint": ", ".join(u["name"] for u in unassigned[:4])},
        {"icon": "target", "title": "목표 미작성", "count": len(no_goal), "link": "#/stats", "level": "warn", "hint": ", ".join(p["name"] for p in no_goal[:4])},
        {"icon": "hourglass", "title": "승인 대기 목표", "count": pending_goals, "link": "#/stats", "level": "warn", "hint": "1차 평가자 승인 필요"},
        {"icon": "badge-check", "title": "확정 대기", "count": len(ready), "link": "#/calib", "level": "info", "hint": "산정 완료 · 미확정"},
        {"icon": "rotate-ccw", "title": "재작성 요청", "count": rewrites, "link": "#/rewrites", "level": "bad", "hint": "평가자 요청 처리"},
        {"icon": "key-round", "title": "계정 미발급", "count": no_account, "link": "#/users", "level": "info", "hint": "일괄 발급 가능"},
    ] if a["count"]]
    goals = rows("SELECT g.status, g.kpi_id, u.org_id FROM goals g JOIN users u ON u.id=g.user_id WHERE g.cycle_id=? AND g.status!='rejected'", cid)
    peer = row("SELECT COUNT(*) n, SUM(status='submitted') s FROM peer_reviews WHERE cycle_id=?", cid)
    dist = {g: 0 for g, _ in c["config"]["grades"]}
    for p in team:
        if p["grade"]:
            dist[p["grade"]] += 1
    orgs = {}
    for p in team:
        o = orgs.setdefault(p["org_name"], {"org": p["org_name"], "n": 0, "first": 0, "self": 0})
        o["n"] += 1
        o["first"] += p["first"] == "submitted"
        o["self"] += p["self"] == "submitted"
    pct = lambda k: round(sum(1 for p in team if p[k] == "submitted") / n * 100)
    return {
        "cycle": {"name": c["name"], "phase": c["phase"], "phase_label": c["phase_label"], "due": c["config"].get("schedule", {}).get(c["phase"])},
        "kpis": {"people": len(team), "self": pct("self"), "first": pct("first"), "second": pct("second"),
                 "confirmed": round(sum(p["confirmed"] for p in team) / n * 100),
                 "align": round(sum(1 for g in goals if g["kpi_id"]) / (len(goals) or 1) * 100),
                 "peer": round((peer["s"] or 0) / (peer["n"] or 1) * 100), "avg": round(sum(p["final"] for p in team if p["final"]) / (sum(1 for p in team if p["final"]) or 1), 1)},
        "actions": actions, "dist": dist, "guide": c["config"]["guide"],
        "funnel": [{"label": "목표 승인", "n": sum(1 for p in team if p["goals"]["approved"] and p["goals"]["wsum"] == 100 and not p["goals"]["submitted"])},
                   {"label": "자기평가", "n": sum(1 for p in team if p["self"] == "submitted")},
                   {"label": "1차 평가", "n": sum(1 for p in team if p["first"] == "submitted")},
                   {"label": "2차 검토", "n": sum(1 for p in team if p["second"] == "submitted")},
                   {"label": "확정", "n": sum(1 for p in team if p["confirmed"])}],
        "orgs": sorted(orgs.values(), key=lambda o: -o["first"] / o["n"]),
        "audit": rows("SELECT a.*, u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 8"),
        "notices": rows("SELECT * FROM notices ORDER BY pinned DESC, id DESC LIMIT 4"),
    }


# ── 평가 주기 · 단계 ──────────────────────────────────────
@router.get("/cycles")
def cycles(user=Depends(admin)):
    out = rows("SELECT id, name, start_date, end_date, phase, active, created_at FROM cycles ORDER BY start_date DESC")
    for c in out:
        full = core.load_cycle(c["id"])
        c["config"] = full["config"]
        c["phase_label"] = full["phase_label"]
        c["items"] = rows("SELECT * FROM items WHERE cycle_id=? ORDER BY sort, id", c["id"])
        c["people"] = row("SELECT COUNT(*) n FROM relations WHERE cycle_id=?", c["id"])["n"]
        c["confirmed"] = row("SELECT COUNT(*) n FROM results WHERE cycle_id=?", c["id"])["n"]
    return out


class CycleIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    start_date: str = Field(max_length=10)
    end_date: str = Field(max_length=10)
    copy_from: int | None = None


@router.post("/cycles")
def create_cycle(body: CycleIn, user=Depends(admin)):
    src = core.load_cycle(body.copy_from) if body.copy_from else None
    cfg = {k: v for k, v in (src["config"] if src else DEFAULT_CFG).items() if k != "schedule"}
    with tx() as con:
        cid = con.execute("INSERT INTO cycles(name,start_date,end_date,phase,active,config) VALUES(?,?,?,'prep',0,?)",
                          (body.name, body.start_date, body.end_date, js(cfg))).lastrowid
        items = [(i["area"], i["name"], i["description"]) for i in rows("SELECT * FROM items WHERE cycle_id=? ORDER BY sort", src["id"])] if src else DEFAULT_ITEMS
        for k, (area, name, desc) in enumerate(items):
            con.execute("INSERT INTO items(cycle_id,area,name,description,sort) VALUES(?,?,?,?,?)", (cid, area, name, desc, k))
        if src:  # 이전 주기 평가 관계 복사
            con.execute("INSERT INTO relations(cycle_id,user_id,first_id,second_id,scheme,manual,scheme_manual) "
                        "SELECT ?,user_id,first_id,second_id,scheme,manual,scheme_manual FROM relations WHERE cycle_id=? "
                        "AND user_id IN (SELECT id FROM users WHERE status='active')", (cid, src["id"]))
    if not src:
        core.assign_relations(core.load_cycle(cid))
    core.audit(user, "cycle.create", body.name)
    return {"id": cid}


class CycleUpd(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    start_date: str = Field(max_length=10)
    end_date: str = Field(max_length=10)
    config: dict[str, Any]


def _validate_cfg(cfg: dict[str, Any]) -> dict[str, Any]:
    for scheme in ("member", "leader"):
        w = cfg["weights"][scheme]
        if sum(int(w[k]) for k in ("goal", "comp", "extra")) != 100:
            raise HTTPException(400, f"{'팀원' if scheme == 'member' else '직책자'} 비중 합계가 100%가 아닙니다.")
    if sum(int(v) for v in cfg["guide"].values()) != 100:
        raise HTTPException(400, "배분 가이드 합계가 100%가 아닙니다.")
    cuts = [float(c) for _, c in cfg["grades"]]
    if cuts != sorted(cuts, reverse=True):
        raise HTTPException(400, "등급 기준 점수는 높은 등급부터 내림차순이어야 합니다.")
    return cfg


@router.put("/cycles/{cid}")
def update_cycle(cid: int, body: CycleUpd, user=Depends(admin)):
    c = core.load_cycle(cid)
    if not c:
        raise HTTPException(404, "주기를 찾을 수 없습니다.")
    cfg = _validate_cfg({**c["config"], **body.config})
    run("UPDATE cycles SET name=?, start_date=?, end_date=?, config=? WHERE id=?", body.name, body.start_date, body.end_date, js(cfg), cid)
    core.audit(user, "cycle.update", body.name)
    return {"ok": True}


class ItemsIn(BaseModel):
    items: list[dict[str, Any]] = Field(max_length=40)


@router.put("/cycles/{cid}/items")
def save_items(cid: int, body: ItemsIn, user=Depends(admin)):
    c = core.load_cycle(cid)
    if c and c["phase"] not in ("prep", "goal", "self"):
        raise HTTPException(409, "평가 진행 이후에는 평가 항목을 바꿀 수 없습니다.")
    keep = []
    with tx() as con:
        for k, it in enumerate(body.items):
            if it.get("area") not in ("comp", "dev", "mgmt") or not str(it.get("name", "")).strip():
                raise HTTPException(400, "항목 영역/이름을 확인해 주세요.")
            vals = (it["area"], str(it["name"])[:40], str(it.get("description", ""))[:200], k)
            if it.get("id"):
                con.execute("UPDATE items SET area=?, name=?, description=?, sort=? WHERE id=? AND cycle_id=?", (*vals, it["id"], cid))
                keep.append(int(it["id"]))
            else:
                keep.append(con.execute("INSERT INTO items(cycle_id,area,name,description,sort) VALUES(?,?,?,?,?)", (cid, *vals)).lastrowid)
        con.execute(f"DELETE FROM items WHERE cycle_id=? AND id NOT IN ({','.join('?' * len(keep)) or 'NULL'})", (cid, *keep))
    return {"ok": True}


class PhaseIn(BaseModel):
    phase: str


@router.post("/cycles/{cid}/phase")
def set_phase(cid: int, body: PhaseIn, user=Depends(admin)):
    if body.phase not in PHASE_KEYS:
        raise HTTPException(400, "알 수 없는 단계입니다.")
    c = core.load_cycle(cid)
    run("UPDATE cycles SET phase=? WHERE id=?", body.phase, cid)
    label = dict(core.PHASES)[body.phase]
    with tx() as con:
        con.executemany("INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)",
                        [(r["user_id"], f"[{c['name']}] '{label}' 단계로 전환되었습니다.", "/app/me#/home")
                         for r in rows("SELECT user_id FROM relations WHERE cycle_id=?", cid)])
    core.audit(user, "cycle.phase", f"{c['name']} → {label}")
    return {"ok": True}


@router.post("/cycles/{cid}/activate")
def activate(cid: int, user=Depends(admin)):
    with tx() as con:
        con.execute("UPDATE cycles SET active=0")
        con.execute("UPDATE cycles SET active=1 WHERE id=?", (cid,))
    core.audit(user, "cycle.activate", cid)
    return {"ok": True}


# ── 평가 관계 ────────────────────────────────────────────
@router.get("/relations")
def relations(user=Depends(admin)):
    c = core.active_cycle()
    people = rows("SELECT u.id, u.name, u.position, u.duty, u.hue, u.org_id, o.name org_name, r.first_id, r.second_id, r.scheme, r.manual, r.scheme_manual, "
                  "(SELECT status FROM reviews WHERE cycle_id=? AND user_id=u.id AND stage='first') first_status "
                  "FROM users u LEFT JOIN relations r ON r.user_id=u.id AND r.cycle_id=? LEFT JOIN orgs o ON o.id=u.org_id "
                  "WHERE u.status='active' ORDER BY o.sort, u.name", c["id"], c["id"])
    return {"people": people, "leader_duties": c["config"]["leader_duties"]}


class RelIn(BaseModel):
    first_id: int | None = None
    second_id: int | None = None
    scheme: Literal["member", "leader"] = "member"
    scheme_manual: bool = False


@router.put("/relations/{uid}")
def set_relation(uid: int, body: RelIn, user=Depends(admin)):
    c = core.active_cycle()
    if row("SELECT 1 FROM reviews WHERE cycle_id=? AND user_id=? AND stage='first' AND status='submitted'", c["id"], uid):
        raise HTTPException(409, "1차 평가가 제출된 인원은 평가자를 바꿀 수 없습니다. 재작성 요청을 먼저 처리하세요.")
    if not body.first_id:
        raise HTTPException(400, "1차 평가자는 필수입니다.")
    core.check_relation(c["id"], uid, body.first_id, body.second_id)
    run("INSERT INTO relations(cycle_id,user_id,first_id,second_id,scheme,manual,scheme_manual) VALUES(?,?,?,?,?,1,?) "
        "ON CONFLICT(cycle_id,user_id) DO UPDATE SET first_id=excluded.first_id, second_id=excluded.second_id, scheme=excluded.scheme, manual=1, scheme_manual=excluded.scheme_manual",
        c["id"], uid, body.first_id, body.second_id, body.scheme, int(body.scheme_manual))
    core.audit(user, "relation.set", {"user": uid, "first": body.first_id, "second": body.second_id, "scheme": body.scheme})
    return {"ok": True}


@router.post("/relations/auto")
def auto_relations(force: bool = False, user=Depends(admin)):
    n = core.assign_relations(core.active_cycle(), force=force)
    core.audit(user, "relation.auto", f"{n}명")
    return {"assigned": n}


# ── 조직 · KPI ───────────────────────────────────────────
@router.get("/orgs")
def orgs(user=Depends(admin)):
    return rows("SELECT o.*, u.name head_name, (SELECT COUNT(*) FROM users WHERE org_id=o.id AND status='active') members "
                "FROM orgs o LEFT JOIN users u ON u.id=o.head_id ORDER BY o.sort, o.id")


class OrgIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    parent_id: int | None = None
    level: str = Field(default="팀", max_length=10)
    head_id: int | None = None


@router.post("/orgs")
def add_org(body: OrgIn, user=Depends(admin)):
    oid = run("INSERT INTO orgs(name,parent_id,level,head_id,sort) VALUES(?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM orgs))",
              body.name, body.parent_id, body.level, body.head_id)
    return {"id": oid}


@router.put("/orgs/{oid}")
def edit_org(oid: int, body: OrgIn, user=Depends(admin)):
    if body.parent_id == oid:
        raise HTTPException(400, "자기 자신을 상위 조직으로 지정할 수 없습니다.")
    run("UPDATE orgs SET name=?, parent_id=?, level=?, head_id=? WHERE id=?", body.name, body.parent_id, body.level, body.head_id, oid)
    c = core.load_cycle()
    if c:
        core.assign_relations(c)  # 조직장 변경 → 미제출 인원 평가자 재계산
    core.audit(user, "org.update", body.name)
    return {"ok": True}


@router.delete("/orgs/{oid}")
def del_org(oid: int, user=Depends(admin)):
    if row("SELECT 1 FROM users WHERE org_id=? AND status='active'", oid) or row("SELECT 1 FROM orgs WHERE parent_id=?", oid):
        raise HTTPException(409, "구성원이나 하위 조직이 있는 조직은 삭제할 수 없습니다.")
    run("DELETE FROM orgs WHERE id=?", oid)
    return {"ok": True}


@router.get("/kpis")
def kpis(user=Depends(admin)):
    c = core.active_cycle()
    out = rows("SELECT k.*, o.name org_name, o.level FROM kpis k JOIN orgs o ON o.id=k.org_id WHERE k.cycle_id=? ORDER BY o.sort, k.id", c["id"])
    links = {r["kpi_id"]: r["n"] for r in rows("SELECT kpi_id, COUNT(*) n FROM goals WHERE cycle_id=? AND kpi_id IS NOT NULL GROUP BY kpi_id", c["id"])}
    for k in out:
        k["linked"] = links.get(k["id"], 0)
    return out


class KpiIn(BaseModel):
    org_id: int
    parent_id: int | None = None
    title: str = Field(min_length=2, max_length=100)
    weight: int = Field(default=0, ge=0, le=100)
    target: str = Field(default="", max_length=100)
    achievement: float | None = Field(default=None, ge=0, le=300)


@router.post("/kpis")
def add_kpi(body: KpiIn, user=Depends(admin)):
    c = core.active_cycle()
    return {"id": run("INSERT INTO kpis(cycle_id,org_id,parent_id,title,weight,target,achievement) VALUES(?,?,?,?,?,?,?)",
                      c["id"], body.org_id, body.parent_id, body.title, body.weight, body.target, body.achievement)}


@router.put("/kpis/{kid}")
def edit_kpi(kid: int, body: KpiIn, user=Depends(admin)):
    if body.parent_id == kid:
        raise HTTPException(400, "자기 자신을 상위 KPI로 지정할 수 없습니다.")
    run("UPDATE kpis SET org_id=?, parent_id=?, title=?, weight=?, target=?, achievement=? WHERE id=?",
        body.org_id, body.parent_id, body.title, body.weight, body.target, body.achievement, kid)
    return {"ok": True}


@router.delete("/kpis/{kid}")
def del_kpi(kid: int, user=Depends(admin)):
    with tx() as con:
        con.execute("UPDATE goals SET kpi_id=NULL WHERE kpi_id=?", (kid,))
        con.execute("UPDATE kpis SET parent_id=NULL WHERE parent_id=?", (kid,))
        con.execute("DELETE FROM kpis WHERE id=?", (kid,))
    return {"ok": True}


# ── 다면평가 관리 ─────────────────────────────────────────
@router.get("/peer")
def peer(user=Depends(admin)):
    c = core.active_cycle()
    data = rows("SELECT p.id, p.target_id, p.reviewer_id, p.kind, p.status, r.name reviewer_name FROM peer_reviews p JOIN users r ON r.id=p.reviewer_id WHERE p.cycle_id=?", c["id"])
    by: dict[int, list] = {}
    for d in data:
        by.setdefault(d["target_id"], []).append(d)
    people = rows("SELECT u.id, u.name, u.position, u.hue, o.name org_name FROM relations r JOIN users u ON u.id=r.user_id LEFT JOIN orgs o ON o.id=u.org_id "
                  "WHERE r.cycle_id=? ORDER BY o.sort, u.name", c["id"])
    for p in people:
        p["reviewers"] = by.get(p["id"], [])
        p["summary"] = peer_summary(c["id"], p["id"])["avg"]
    return {"people": people, "total": len(data), "submitted": sum(1 for d in data if d["status"] == "submitted")}


@router.post("/peer/auto")
def peer_auto(user=Depends(admin)):
    n = core.assign_peers(core.active_cycle())
    core.audit(user, "peer.auto", f"{n}건")
    return {"assigned": n}


class PeerAdd(BaseModel):
    target_id: int
    reviewer_id: int
    kind: Literal["peer", "sub"] = "peer"


@router.post("/peer")
def peer_add(body: PeerAdd, user=Depends(admin)):
    if body.target_id == body.reviewer_id:
        raise HTTPException(400, "본인을 리뷰어로 지정할 수 없습니다.")
    c = core.active_cycle()
    run("INSERT OR IGNORE INTO peer_reviews(cycle_id,target_id,reviewer_id,kind) VALUES(?,?,?,?)", c["id"], body.target_id, body.reviewer_id, body.kind)
    core.notify(body.reviewer_id, "다면평가 리뷰어로 지정되었습니다.", "/app/me#/peer")
    return {"ok": True}


@router.delete("/peer/{pid}")
def peer_del(pid: int, user=Depends(admin)):
    if row("SELECT 1 FROM peer_reviews WHERE id=? AND status='submitted'", pid):
        raise HTTPException(409, "제출된 리뷰는 삭제할 수 없습니다.")
    run("DELETE FROM peer_reviews WHERE id=?", pid)
    return {"ok": True}


# ── 조정 · 확정 ──────────────────────────────────────────
@router.get("/calib")
def calib(user=Depends(admin)):
    c = core.active_cycle()
    team = _team(c, user, everyone=True)
    peers = {r["target_id"]: r["a"] for r in rows("SELECT target_id, AVG((json_extract(scores,'$.전문성')+json_extract(scores,'$.협업')+json_extract(scores,'$.책임감')"
                                                  "+json_extract(scores,'$.성장')+json_extract(scores,'$.신뢰'))/5.0) a FROM peer_reviews WHERE cycle_id=? AND status='submitted' GROUP BY target_id", c["id"])}
    for p in team:
        p["peer_avg"] = round(peers[p["id"]], 2) if p["id"] in peers else None
    return {"team": team, "grades": c["config"]["grades"], "guide": c["config"]["guide"], "phase": c["phase"]}


class ConfirmIn(BaseModel):
    user_ids: list[int] = Field(max_length=2000)


@router.post("/confirm")
def confirm(body: ConfirmIn, user=Depends(admin)):
    c = core.active_cycle()
    core.need_phase(c, "calib")
    done, skipped = 0, []
    for uid in body.user_ids:
        if row("SELECT 1 FROM results WHERE cycle_id=? AND user_id=?", c["id"], uid):
            continue
        try:
            snap = core.snapshot(c, uid)
        except HTTPException:
            skipped.append((row("SELECT name FROM users WHERE id=?", uid) or {}).get("name"))
            continue
        run("INSERT INTO results(cycle_id,user_id,snapshot,confirmed_by) VALUES(?,?,?,?)", c["id"], uid, js(snap), user["id"])
        done += 1
    core.audit(user, "result.confirm", f"{done}명 확정, {len(skipped)}명 제외")
    return {"confirmed": done, "skipped": skipped}


class ReopenIn(BaseModel):
    stage: Literal["self", "first", "second", "result"]
    reason: str = Field(min_length=5, max_length=500)


def _reopen(c: dict[str, Any], uid: int, stage: str) -> None:
    with tx() as con:
        con.execute("DELETE FROM results WHERE cycle_id=? AND user_id=?", (c["id"], uid))
        if stage != "result":
            con.execute("UPDATE reviews SET status='draft', submitted_at=NULL WHERE cycle_id=? AND user_id=? AND stage=?", (c["id"], uid, stage))


@router.post("/reopen/{uid}")
def reopen(uid: int, body: ReopenIn, user=Depends(admin)):
    """재작성 요청(관리자 직접): 제출·확정된 평가를 '작성중'으로 되돌린다. 사유 필수."""
    c = core.active_cycle()
    _reopen(c, uid, body.stage)
    core.audit(user, "review.reopen", {"user": uid, "stage": body.stage, "reason": body.reason})
    return {"ok": True}


@router.get("/rewrites")
def rewrites(user=Depends(admin)):
    return rows("SELECT w.*, u.name user_name, q.name requester_name, c.name cycle_name FROM rewrites w JOIN users u ON u.id=w.user_id "
                "JOIN users q ON q.id=w.requester_id JOIN cycles c ON c.id=w.cycle_id ORDER BY w.status='open' DESC, w.id DESC")


class RewriteAct(BaseModel):
    action: Literal["approve", "reject"]


@router.post("/rewrites/{wid}")
def handle_rewrite(wid: int, body: RewriteAct, user=Depends(admin)):
    w = row("SELECT * FROM rewrites WHERE id=? AND status='open'", wid)
    if not w:
        raise HTTPException(404, "처리할 요청이 없습니다.")
    if body.action == "approve":
        _reopen(core.load_cycle(w["cycle_id"]), w["user_id"], w["stage"])
    run("UPDATE rewrites SET status=?, handled_by=? WHERE id=?", "done" if body.action == "approve" else "rejected", user["id"], wid)
    core.notify(w["requester_id"], f"재작성 요청이 {'승인되어 작성중 상태로 전환' if body.action == 'approve' else '반려'}되었습니다.", "/app/review#/evaluate")
    core.audit(user, f"rewrite.{body.action}", wid)
    return {"ok": True}


# ── 집계현황 ─────────────────────────────────────────────
@router.get("/stats")
def stats(user=Depends(admin)):
    c = core.active_cycle()
    team = _team(c, user, everyone=True)
    align = {r["org_name"]: r for r in rows("SELECT o.name org_name, COUNT(*) n, SUM(g.kpi_id IS NOT NULL) linked FROM goals g JOIN users u ON u.id=g.user_id "
                                            "JOIN orgs o ON o.id=u.org_id WHERE g.cycle_id=? AND g.status!='rejected' GROUP BY o.id", c["id"])}
    out: dict[str, dict[str, Any]] = {}
    for p in team:
        o = out.setdefault(p["org_name"], {"org": p["org_name"], "n": 0, "goal": 0, "self": 0, "first": 0, "second": 0, "confirmed": 0, "scores": [], "people": []})
        o["n"] += 1
        o["goal"] += p["goals"]["wsum"] == 100 and p["goals"]["approved"] > 0 and not p["goals"]["submitted"]
        o["self"] += p["self"] == "submitted"
        o["first"] += p["first"] == "submitted"
        o["second"] += p["second"] == "submitted"
        o["confirmed"] += p["confirmed"]
        if p["final"] is not None:
            o["scores"].append(p["final"])
        o["people"].append({k: p[k] for k in ("id", "name", "position", "self", "first", "second", "final", "grade", "confirmed", "goals")})
    for o in out.values():
        a = align.get(o["org"], {"n": 0, "linked": 0})
        o["align"] = round((a["linked"] or 0) / (a["n"] or 1) * 100)
        o["avg"] = round(sum(o["scores"]) / len(o["scores"]), 1) if o["scores"] else None
        del o["scores"]
    return list(out.values())


@router.get("/export.csv")
def export(user=Depends(admin)):
    c = core.active_cycle()
    team = _team(c, user, everyone=True)
    data = [[p["emp_no"], p["name"], p["org_name"], p["position"], p["duty"], "직책자" if p["scheme"] == "leader" else "팀원", p["first_name"], p["second_name"],
             p["goal_score"], p["comp_score"], p["extra_score"], p["adj"], p["final"], p["grade"], "확정" if p["confirmed"] else "미확정"] for p in team]
    return _csv(["사번", "이름", "조직", "직급", "직책", "스킴", "1차", "2차", "공통목표", "개인역량", "자기개발/조직관리", "조정", "최종", "등급", "확정"],
                data, f"kpc_results_{c['id']}.csv")


# ── 사용자 · 계정 ─────────────────────────────────────────
@router.get("/users")
def users(user=Depends(admin)):
    return rows("SELECT u.id, u.emp_no, u.name, u.email, u.org_id, u.position, u.duty, u.hire_date, u.status, u.is_admin, u.hue, "
                "u.pw_hash IS NOT NULL has_account, o.name org_name FROM users u LEFT JOIN orgs o ON o.id=u.org_id ORDER BY u.status, o.sort, u.name")


class UserIn(BaseModel):
    emp_no: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=30)
    email: str = Field(default="", max_length=120)
    org_id: int | None = None
    position: str = Field(default="", max_length=20)
    duty: str = Field(default="", max_length=20)
    hire_date: str = Field(default="", max_length=10)
    status: Literal["active", "retired"] = "active"
    is_admin: bool = False


@router.post("/users")
def add_user(body: UserIn, user=Depends(admin)):
    if row("SELECT 1 FROM users WHERE emp_no=? OR (email!='' AND email=?)", body.emp_no, body.email):
        raise HTTPException(409, "이미 존재하는 사번 또는 이메일입니다.")
    uid = run("INSERT INTO users(emp_no,name,email,org_id,position,duty,hire_date,status,is_admin,hue) VALUES(?,?,?,?,?,?,?,?,?,?)",
              body.emp_no, body.name, body.email or None, body.org_id, body.position, body.duty, body.hire_date, body.status,
              int(body.is_admin), secrets.randbelow(360))
    c = core.load_cycle()
    if c:
        core.assign_relations(c, only=[uid])
    core.audit(user, "user.create", body.name)
    return {"id": uid}


@router.put("/users/{uid}")
def edit_user(uid: int, body: UserIn, user=Depends(admin)):
    before = row("SELECT * FROM users WHERE id=?", uid)
    if not before:
        raise HTTPException(404, "사용자를 찾을 수 없습니다.")
    if uid == user["id"] and not body.is_admin:
        raise HTTPException(400, "본인의 관리자 권한은 해제할 수 없습니다.")
    run("UPDATE users SET emp_no=?, name=?, email=?, org_id=?, position=?, duty=?, hire_date=?, status=?, is_admin=? WHERE id=?",
        body.emp_no, body.name, body.email or None, body.org_id, body.position, body.duty, body.hire_date, body.status, int(body.is_admin), uid)
    c = core.load_cycle()
    if c and (before["org_id"] != body.org_id or before["duty"] != body.duty):
        core.assign_relations(c, only=[uid])  # 소속 변경 → 1차 제출 전이면 평가자 자동 재계산 (매뉴얼 10장)
    core.audit(user, "user.update", body.name)
    return {"ok": True}


class IssueIn(BaseModel):
    user_ids: list[int] = Field(max_length=2000)


@router.post("/accounts/issue")
def issue_accounts(body: IssueIn, user=Depends(admin)):
    """계정 일괄 발급 — 기존 계정 보유자·퇴직자 자동 제외, 임시 비밀번호 CSV 반환 (매뉴얼 10장)."""
    out = []
    with tx() as con:
        for uid in body.user_ids:
            u = con.execute("SELECT * FROM users WHERE id=? AND status='active' AND pw_hash IS NULL", (uid,)).fetchone()
            if not u:
                continue
            temp = "Kpc!" + secrets.token_urlsafe(6)
            con.execute("UPDATE users SET pw_hash=?, must_change=1 WHERE id=?", (core.hash_pw(temp), uid))
            out.append([u["emp_no"], u["name"], u["email"] or "", temp])
    core.audit(user, "account.issue", f"{len(out)}명")
    return _csv(["사번", "이름", "이메일", "임시 비밀번호"], out, "kpc_accounts.csv")


@router.post("/users/{uid}/reset")
def reset_pw(uid: int, user=Depends(admin)):
    temp = "Kpc!" + secrets.token_urlsafe(6)
    run("UPDATE users SET pw_hash=?, must_change=1 WHERE id=?", core.hash_pw(temp), uid)
    core.audit(user, "account.reset", uid)
    return {"temp": temp}


# ── UI 스튜디오 · 브랜드 · 공지 · 감사 ──────────────────────
class StudioIn(BaseModel):
    widgets: list[dict[str, Any]] = Field(max_length=40)
    menu: list[dict[str, Any]] = Field(default_factory=list, max_length=40)
    personalize: bool = True


@router.get("/layout/{page}")
def get_layout(page: str, user=Depends(admin)):
    return pj((row("SELECT data FROM layouts WHERE scope=?", f"role:{page}") or {}).get("data"))


@router.put("/layout/{page}")
def put_layout(page: str, body: StudioIn, user=Depends(admin)):
    if page not in ("me", "review", "admin"):
        raise HTTPException(400, "알 수 없는 페이지입니다.")
    run("INSERT OR REPLACE INTO layouts(scope,data,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)", f"role:{page}", js(body.model_dump()))
    core.audit(user, "studio.save", page)
    return {"ok": True}


@router.delete("/layout/{page}")
def reset_layout(page: str, user=Depends(admin)):
    run("DELETE FROM layouts WHERE scope=?", f"role:{page}")
    return {"ok": True}


@router.put("/brand")
def put_brand(body: dict[str, Any], user=Depends(admin)):
    allowed = {"company", "product", "color", "motion", "demo", "loginTitle", "loginSub"}
    cur = pj((row("SELECT value FROM settings WHERE key='brand'") or {}).get("value"), {})
    cur.update({k: (v[:200] if isinstance(v, str) else v) for k, v in body.items() if k in allowed})
    run("INSERT OR REPLACE INTO settings(key,value) VALUES('brand',?)", js(cur))
    core.audit(user, "brand.update")
    return cur


class NoticeIn(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    body: str = Field(default="", max_length=2000)
    pinned: bool = False


@router.post("/notices")
def add_notice(body: NoticeIn, user=Depends(admin)):
    return {"id": run("INSERT INTO notices(title,body,pinned) VALUES(?,?,?)", body.title, body.body, int(body.pinned))}


@router.delete("/notices/{nid}")
def del_notice(nid: int, user=Depends(admin)):
    run("DELETE FROM notices WHERE id=?", nid)
    return {"ok": True}


@router.get("/audit")
def audit_log(user=Depends(admin)):
    return rows("SELECT a.*, u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 300")


@router.post("/demo-reset")
def demo_reset(user=Depends(admin)):
    brand = pj((row("SELECT value FROM settings WHERE key='brand'") or {}).get("value"), {})
    if not brand.get("demo"):
        raise HTTPException(403, "데모 모드에서만 초기화할 수 있습니다.")
    seed.reset()
    return {"ok": True}
