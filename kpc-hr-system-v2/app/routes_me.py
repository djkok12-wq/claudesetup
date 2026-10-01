"""피평가자 API — 목표 설정, 실적·자기평가, 다면평가 작성, 결과 조회, 대시보드."""
from __future__ import annotations

import random
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import core, scoring
from app.db import PEER_ITEMS, js, pj, row, rows, run, tx

router = APIRouter(prefix="/api/me", tags=["피평가자"])
EDITABLE = ("draft", "rejected", "revise")


def _goals(cid: int, uid: int) -> list[dict[str, Any]]:
    out = rows("SELECT g.*, k.title kpi_title, k.achievement kpi_ach, o.name kpi_org FROM goals g LEFT JOIN kpis k ON k.id=g.kpi_id "
               "LEFT JOIN orgs o ON o.id=k.org_id WHERE g.cycle_id=? AND g.user_id=? ORDER BY g.sort, g.id", cid, uid)
    for g in out:
        g["rate"] = scoring.achievement(g)
    return out


def _can_edit_goal(cycle: dict[str, Any], status: str) -> bool:
    return (cycle["phase"] in ("prep", "goal") and status in EDITABLE) or (
        cycle["phase"] in ("self", "review") and status in ("rejected", "revise"))


def _rel_info(cid: int, uid: int) -> dict[str, Any]:
    rel = core.relation(cid, uid) or {}
    name = lambda i: (row("SELECT name, position FROM users WHERE id=?", i) or {}) if i else {}
    return {"scheme": rel.get("scheme", "member"), "first": name(rel.get("first_id")), "second": name(rel.get("second_id"))}


@router.get("/dash")
def dash(user=Depends(core.current_user)):
    c = core.load_cycle()
    uid, todo = user["id"], []
    goals, selfr, peer_pending = [], None, 0
    if c:
        goals = _goals(c["id"], uid)
        selfr = row("SELECT status FROM reviews WHERE cycle_id=? AND user_id=? AND stage='self'", c["id"], uid)
        peer_pending = row("SELECT COUNT(*) n FROM peer_reviews WHERE cycle_id=? AND reviewer_id=? AND status='assigned'", c["id"], uid)["n"]
        wsum = sum(g["weight"] for g in goals)
        if c["phase"] in ("prep", "goal") and (not goals or any(g["status"] in EDITABLE for g in goals)):
            todo.append({"icon": "target", "text": f"목표를 작성·제출하세요 (가중치 {wsum}%/100%)", "link": "#/goals", "level": "warn"})
        redo = [g for g in goals if g["status"] in ("rejected", "revise")]
        if redo:
            todo.append({"icon": "rotate-ccw", "text": f"수정 요청된 목표 {len(redo)}건이 있습니다", "link": "#/goals", "level": "bad"})
        if c["phase"] in ("self", "review") and (not selfr or selfr["status"] != "submitted"):
            miss = sum(1 for g in goals if g["status"] == "approved" and g["type"] == "quant" and g["actual"] is None)
            todo.append({"icon": "pen-line", "text": "실적 입력·자기평가를 제출하세요" + (f" (실적 미입력 {miss}건)" if miss else ""), "link": "#/self", "level": "warn"})
        if peer_pending:
            todo.append({"icon": "users", "text": f"다면평가 {peer_pending}건을 작성해 주세요", "link": "#/peer", "level": "info"})
        if c["phase"] in ("publish", "closed") and row("SELECT 1 FROM results WHERE cycle_id=? AND user_id=?", c["id"], uid):
            todo.append({"icon": "award", "text": "이번 주기 평가 결과가 공개되었습니다", "link": "#/results", "level": "ok"})
    sched = (c or {}).get("config", {}).get("schedule", {}) if c else {}
    due = sched.get(c["phase"]) if c else None
    history = [{"cycle": r["name"], **{k: pj(r["snapshot"], {}).get(k) for k in ("final", "grade", "goal", "comp", "extra")}}
               for r in rows("SELECT c.name, r.snapshot FROM results r JOIN cycles c ON c.id=r.cycle_id "
                             "WHERE r.user_id=? AND c.phase IN ('publish','closed') ORDER BY c.start_date", uid)]
    return {
        "todo": todo, "goals": goals, "self": selfr, "peer_pending": peer_pending, "history": history,
        "due": due, "dday": (date.fromisoformat(due) - date.today()).days if due else None,
        "rel": _rel_info(c["id"], uid) if c else None,
        "kudos": rows("SELECT k.*, f.name from_name, f.hue from_hue FROM kudos k JOIN users f ON f.id=k.from_id WHERE k.to_id=? ORDER BY k.id DESC LIMIT 6", uid),
        "kudos_count": row("SELECT COUNT(*) n FROM kudos WHERE to_id=?", uid)["n"],
        "notices": rows("SELECT * FROM notices ORDER BY pinned DESC, id DESC LIMIT 4"),
    }


# ── 목표 설정 ─────────────────────────────────────────────
class GoalIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)
    type: Literal["quant", "qual"] = "quant"
    weight: int = Field(ge=0, le=100)
    target: float | None = Field(default=None, ge=0)
    unit: str = Field(default="", max_length=10)
    due: str | None = Field(default=None, max_length=10)
    kpi_id: int | None = None


@router.get("/goals")
def my_goals(user=Depends(core.current_user)):
    c = core.active_cycle()
    chain = [o["id"] for o in core.org_chain(user["org_id"], {o["id"]: o for o in rows("SELECT * FROM orgs")})]
    kpis = rows(f"SELECT k.id, k.title, k.achievement, o.name org_name, o.level FROM kpis k JOIN orgs o ON o.id=k.org_id "
                f"WHERE k.cycle_id=? AND k.org_id IN ({','.join('?' * len(chain)) or 'NULL'})", c["id"], *chain)
    goals = _goals(c["id"], user["id"])
    for g in goals:
        g["editable"] = _can_edit_goal(c, g["status"])
    can_add = c["phase"] in ("prep", "goal") or any(g["status"] in ("rejected", "revise") for g in goals)
    return {"goals": goals, "kpis": kpis, "rel": _rel_info(c["id"], user["id"]), "phase": c["phase"], "can_add": can_add}


def _own_goal(gid: int, user: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    c = core.active_cycle()
    g = row("SELECT * FROM goals WHERE id=? AND user_id=? AND cycle_id=?", gid, user["id"], c["id"])
    if not g:
        raise HTTPException(404, "목표를 찾을 수 없습니다.")
    if not _can_edit_goal(c, g["status"]):
        raise HTTPException(409, "제출·승인된 목표는 수정할 수 없습니다. 평가자에게 반려/수정 요청을 받으세요.")
    return c, g


@router.post("/goals")
def add_goal(body: GoalIn, user=Depends(core.current_user)):
    c = core.active_cycle()
    goals = _goals(c["id"], user["id"])
    if not (c["phase"] in ("prep", "goal") or any(g["status"] in ("rejected", "revise") for g in goals)):
        core.need_phase(c, "prep", "goal")
    if len(goals) >= 7:
        raise HTTPException(400, "목표는 최대 7개까지 등록할 수 있습니다.")
    gid = run("INSERT INTO goals(cycle_id,user_id,kpi_id,title,description,type,weight,target,unit,due,sort) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
              c["id"], user["id"], body.kpi_id, body.title, body.description, body.type, body.weight,
              body.target if body.type == "quant" else None, body.unit, body.due, len(goals))
    return {"id": gid}


@router.put("/goals/{gid}")
def edit_goal(gid: int, body: GoalIn, user=Depends(core.current_user)):
    _own_goal(gid, user)
    run("UPDATE goals SET kpi_id=?,title=?,description=?,type=?,weight=?,target=?,unit=?,due=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        body.kpi_id, body.title, body.description, body.type, body.weight, body.target if body.type == "quant" else None,
        body.unit, body.due, gid)
    return {"ok": True}


@router.delete("/goals/{gid}")
def delete_goal(gid: int, user=Depends(core.current_user)):
    _own_goal(gid, user)
    run("DELETE FROM goals WHERE id=?", gid)
    return {"ok": True}


class OrderIn(BaseModel):
    ids: list[int] = Field(max_length=20)


@router.put("/goals-order")
def order_goals(body: OrderIn, user=Depends(core.current_user)):
    with tx() as con:
        for i, gid in enumerate(body.ids):
            con.execute("UPDATE goals SET sort=? WHERE id=? AND user_id=?", (i, gid, user["id"]))
    return {"ok": True}


@router.post("/goals/submit")
def submit_goals(user=Depends(core.current_user)):
    c = core.active_cycle()
    goals = [g for g in _goals(c["id"], user["id"]) if g["status"] != "rejected"]
    total = sum(g["weight"] for g in goals)
    if not goals:
        raise HTTPException(400, "제출할 목표가 없습니다.")
    if total != 100:
        raise HTTPException(400, f"가중치 합계가 {total}%입니다. 정확히 100%여야 제출할 수 있습니다.")
    pending = [g for g in goals if _can_edit_goal(c, g["status"])]
    if not pending:
        raise HTTPException(400, "새로 제출할 목표가 없습니다.")
    with tx() as con:
        con.executemany("UPDATE goals SET status='submitted', updated_at=CURRENT_TIMESTAMP WHERE id=?", [(g["id"],) for g in pending])
    rel = core.relation(c["id"], user["id"])
    core.notify(rel and rel["first_id"], f"{user['name']}님이 목표 {len(pending)}건을 제출했습니다.", "/app/review#/approvals")
    core.audit(user, "goal.submit", f"{len(pending)}건")
    return {"submitted": len(pending)}


# ── 실적 · 자기평가 ──────────────────────────────────────────
@router.get("/self")
def my_self(user=Depends(core.current_user)):
    c = core.active_cycle()
    rel = _rel_info(c["id"], user["id"])
    area = "mgmt" if rel["scheme"] == "leader" else "dev"
    items = rows("SELECT * FROM items WHERE cycle_id=? AND area IN ('comp',?) ORDER BY sort", c["id"], area)
    rv = row("SELECT * FROM reviews WHERE cycle_id=? AND user_id=? AND stage='self'", c["id"], user["id"])
    if rv:
        rv["item_scores"] = pj(rv["item_scores"], {})
    first_done = row("SELECT 1 FROM reviews WHERE cycle_id=? AND user_id=? AND stage='first' AND status='submitted'", c["id"], user["id"])
    return {"goals": [g for g in _goals(c["id"], user["id"]) if g["status"] == "approved"], "items": items, "review": rv,
            "phase": c["phase"], "rel": rel, "weights": c["config"]["weights"][rel["scheme"]], "conv": c["config"]["conv"],
            "actual_open": c["phase"] in ("self", "review") and not first_done,
            "self_open": c["phase"] in ("self", "review") and not (rv and rv["status"] == "submitted")}


class SelfIn(BaseModel):
    actuals: list[dict[str, Any]] = Field(default_factory=list, max_length=10)
    item_scores: dict[str, int] = Field(default_factory=dict)
    comment: str = Field(default="", max_length=3000)
    submit: bool = False


@router.put("/self")
def save_self(body: SelfIn, user=Depends(core.current_user)):
    c = core.active_cycle()
    core.need_phase(c, "self", "review")
    state = my_self(user)
    if body.actuals:
        if not state["actual_open"]:
            raise HTTPException(409, "1차 평가가 제출되어 실적을 수정할 수 없습니다.")
        mine = {g["id"] for g in state["goals"]}
        with tx() as con:
            for a in body.actuals:
                if a.get("id") in mine:
                    v = a.get("actual")
                    con.execute("UPDATE goals SET actual=?, actual_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                                (None if v in (None, "") else float(v), str(a.get("actual_note") or "")[:500], a["id"]))
    rv = state["review"]
    if rv and rv["status"] == "submitted":
        if body.item_scores or body.comment or body.submit:
            raise HTTPException(409, "제출한 자기평가는 수정할 수 없습니다.")
        return {"ok": True}
    if any(not 1 <= v <= 5 for v in body.item_scores.values()):
        raise HTTPException(400, "역량 점수는 1~5점입니다.")
    if body.submit and len(body.comment.strip()) < 20:
        raise HTTPException(400, "자기평가 코멘트는 20자 이상이어야 제출할 수 있습니다.")
    status = "submitted" if body.submit else "draft"
    run("INSERT INTO reviews(cycle_id,user_id,reviewer_id,stage,status,item_scores,comment,submitted_at) VALUES(?,?,?,?,?,?,?,"
        "CASE WHEN ?='submitted' THEN CURRENT_TIMESTAMP END) ON CONFLICT(cycle_id,user_id,stage) DO UPDATE SET "
        "status=excluded.status, item_scores=excluded.item_scores, comment=excluded.comment, submitted_at=excluded.submitted_at, updated_at=CURRENT_TIMESTAMP",
        c["id"], user["id"], user["id"], "self", status, js(body.item_scores), body.comment, status)
    if body.submit:
        rel = core.relation(c["id"], user["id"])
        core.notify(rel and rel["first_id"], f"{user['name']}님이 자기평가를 제출했습니다.", f"/app/review#/evaluate/{user['id']}")
        core.audit(user, "self.submit")
    return {"ok": True, "status": status}


# ── 다면평가 (리뷰어로서) ───────────────────────────────────
@router.get("/peer")
def my_peer(user=Depends(core.current_user)):
    c = core.active_cycle()
    out = rows("SELECT p.*, u.name target_name, u.position, u.hue, o.name org_name FROM peer_reviews p JOIN users u ON u.id=p.target_id "
               "LEFT JOIN orgs o ON o.id=u.org_id WHERE p.cycle_id=? AND p.reviewer_id=? ORDER BY p.status, u.name", c["id"], user["id"])
    for p in out:
        p["scores"] = pj(p["scores"], {})
    return {"items": PEER_ITEMS, "reviews": out, "open": c["phase"] not in ("publish", "closed")}


class PeerIn(BaseModel):
    scores: dict[str, int]
    comment: str = Field(default="", max_length=1000)


@router.put("/peer/{pid}")
def submit_peer(pid: int, body: PeerIn, user=Depends(core.current_user)):
    c = core.active_cycle()
    core.need_phase(c, "goal", "self", "review", "calib")
    p = row("SELECT * FROM peer_reviews WHERE id=? AND reviewer_id=? AND cycle_id=?", pid, user["id"], c["id"])
    if not p:
        raise HTTPException(404, "리뷰를 찾을 수 없습니다.")
    if p["status"] == "submitted":
        raise HTTPException(409, "제출된 다면평가는 수정할 수 없습니다.")
    if set(body.scores) != set(PEER_ITEMS) or any(not 1 <= v <= 5 for v in body.scores.values()):
        raise HTTPException(400, "다섯 항목 모두 1~5점으로 평가해 주세요.")
    run("UPDATE peer_reviews SET scores=?, comment=?, status='submitted', submitted_at=CURRENT_TIMESTAMP WHERE id=?",
        js(body.scores), body.comment, pid)
    return {"ok": True}


def peer_summary(cid: int, uid: int) -> dict[str, Any]:
    """익명 요약 — 리뷰어 이름 없이 평균과 코멘트만, 순서 섞음."""
    subs = rows("SELECT scores, comment FROM peer_reviews WHERE cycle_id=? AND target_id=? AND status='submitted'", cid, uid)
    avg = {k: round(sum(pj(s["scores"], {}).get(k, 0) for s in subs) / len(subs), 2) if subs else None for k in PEER_ITEMS}
    comments = [s["comment"] for s in subs if s["comment"]]
    random.Random(cid * 7 + uid).shuffle(comments)
    total = row("SELECT COUNT(*) n FROM peer_reviews WHERE cycle_id=? AND target_id=?", cid, uid)["n"]
    return {"count": len(subs), "assigned": total, "avg": avg, "comments": comments}


# ── 결과 ─────────────────────────────────────────────────
@router.get("/results")
def my_results(user=Depends(core.current_user)):
    out = []
    for r in rows("SELECT r.*, c.name, c.start_date, c.end_date, c.phase FROM results r JOIN cycles c ON c.id=r.cycle_id "
                  "WHERE r.user_id=? AND c.phase IN ('publish','closed') ORDER BY c.start_date DESC", user["id"]):
        cid = r["cycle_id"]
        out.append({"cycle_id": cid, "cycle": r["name"], "period": f"{r['start_date']} ~ {r['end_date']}", "confirmed_at": r["confirmed_at"],
                    "snapshot": pj(r["snapshot"], {}),
                    "first_comment": (row("SELECT comment FROM reviews WHERE cycle_id=? AND user_id=? AND stage='first'", cid, user["id"]) or {}).get("comment"),
                    "second_comment": (row("SELECT comment FROM reviews WHERE cycle_id=? AND user_id=? AND stage='second'", cid, user["id"]) or {}).get("comment"),
                    "adjustments": rows("SELECT delta, reason, created_at FROM adjustments WHERE cycle_id=? AND user_id=?", cid, user["id"]),
                    "peer": peer_summary(cid, user["id"])})
    return out
