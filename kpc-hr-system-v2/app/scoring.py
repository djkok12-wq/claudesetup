"""점수 산정 규칙 (매뉴얼 04·05·08장) — DB와 무관한 순수 함수."""
from __future__ import annotations

from typing import Any

RATE_CAP = 150.0


def achievement(goal: dict[str, Any]) -> float | None:
    """정량 목표 달성률(%) — 실적 ÷ 목표값, 상한 150%."""
    target, actual = goal.get("target"), goal.get("actual")
    if goal.get("type") != "quant" or not target or actual is None:
        return None
    return round(min(float(actual) / float(target) * 100, RATE_CAP), 1)


def convert(rate: float, table: list[list[float]]) -> float:
    """달성률 → 환산 점수 (110%↑ 100 · 100%↑ 90 · 90%↑ 80 · 80%↑ 70 · 그 외 60)."""
    for threshold, score in table:
        if rate >= threshold:
            return float(score)
    return float(table[-1][1])


def goal_score(goal: dict[str, Any], manual: dict[str, Any], table: list[list[float]]) -> float | None:
    """평가자 수기 점수가 자동 환산보다 우선한다. 정성 목표는 수기 점수만 인정."""
    m = manual.get(str(goal["id"]))
    if m not in (None, ""):
        return max(0.0, min(100.0, float(m)))
    rate = achievement(goal)
    return convert(rate, table) if rate is not None else None


def item_area(item_ids: list[int], scores: dict[str, Any]) -> float | None:
    """5점 척도 평균 × 20. 한 항목이라도 비면 미완(None)."""
    vals = [scores.get(str(i)) for i in item_ids]
    if not vals or any(v in (None, "") for v in vals):
        return None
    return round(sum(float(v) for v in vals) / len(vals) * 20, 1)


def grade_of(score: float | None, grades: list[list[Any]]) -> str | None:
    if score is None:
        return None
    for g, cut in grades:
        if score >= cut:
            return g
    return grades[-1][0]


def compute(cfg: dict[str, Any], scheme: str, goals: list[dict[str, Any]], items: list[dict[str, Any]],
            first: dict[str, Any] | None, deltas: list[float]) -> dict[str, Any]:
    """3영역 가중합 + 조정(±) → 0~100 클립 → 등급. 미완 사유를 missing에 담는다."""
    gs = (first or {}).get("goal_scores") or {}
    isc = (first or {}).get("item_scores") or {}
    approved = [g for g in goals if g.get("status") == "approved"]
    missing: list[str] = []
    wsum = sum(int(g.get("weight") or 0) for g in approved)
    if wsum != 100:
        missing.append(f"승인 목표 가중치 합계 {wsum}% (100% 필요)")
    detail = []
    for g in approved:
        s = goal_score(g, gs, cfg["conv"])
        detail.append({"id": g["id"], "title": g["title"], "weight": g["weight"], "type": g["type"],
                       "rate": achievement(g), "score": s, "manual": str(g["id"]) in gs and gs[str(g["id"])] not in (None, "")})
        if s is None:
            missing.append(f"목표 '{g['title']}' 점수 없음" + (" (실적 미입력)" if g["type"] == "quant" else " (정성 평가 필요)"))
    goal_area = round(sum(d["score"] * d["weight"] for d in detail) / wsum, 1) if wsum == 100 and all(d["score"] is not None for d in detail) else None
    extra_area_key = "mgmt" if scheme == "leader" else "dev"
    comp = item_area([i["id"] for i in items if i["area"] == "comp"], isc)
    extra = item_area([i["id"] for i in items if i["area"] == extra_area_key], isc)
    if comp is None:
        missing.append("개인역량 미평가")
    if extra is None:
        missing.append(("조직관리" if scheme == "leader" else "자기개발") + " 미평가")
    w = cfg["weights"][scheme]
    base = None
    if None not in (goal_area, comp, extra):
        base = round((goal_area * w["goal"] + comp * w["comp"] + extra * w["extra"]) / 100, 1)
    adj = round(sum(deltas), 1)
    final = round(max(0.0, min(100.0, base + adj)), 1) if base is not None else None
    return {"goal": goal_area, "comp": comp, "extra": extra, "extra_label": "조직관리" if scheme == "leader" else "자기개발",
            "weights": w, "scheme": scheme, "base": base, "adj": adj, "final": final, "grade": grade_of(final, cfg["grades"]),
            "complete": not missing, "missing": missing, "goals": detail}


if __name__ == "__main__":  # 자체 점검: python -m app.scoring
    from app.db import DEFAULT_CFG as C
    assert convert(150, C["conv"]) == 100 and convert(100, C["conv"]) == 90 and convert(79.9, C["conv"]) == 60
    assert achievement({"type": "quant", "target": 100, "actual": 300}) == 150
    its = [{"id": 1, "area": "comp"}, {"id": 2, "area": "dev"}]
    gl = [{"id": 7, "title": "A", "weight": 60, "type": "quant", "target": 10, "actual": 10, "status": "approved"},
          {"id": 8, "title": "B", "weight": 40, "type": "qual", "status": "approved"}]
    r = compute(C, "member", gl, its, {"goal_scores": {"8": 80}, "item_scores": {"1": 4, "2": 5}}, [5])
    # 목표 (90*60+80*40)/100=86, 역량 80, 자기개발 100 → 86*.4+80*.4+100*.2 = 86.4, +5 = 91.4 → A
    assert (r["goal"], r["comp"], r["extra"], r["base"], r["final"], r["grade"]) == (86.0, 80.0, 100.0, 86.4, 91.4, "A"), r
    assert compute(C, "member", gl, its, None, [])["complete"] is False
    assert compute(C, "member", gl, its, {"goal_scores": {"8": 100}, "item_scores": {"1": 5, "2": 5}}, [10, 10])["final"] == 100
    print("scoring OK")
