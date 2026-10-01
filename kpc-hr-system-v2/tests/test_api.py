"""엔드투엔드 스모크 테스트 — 실행: python tests/test_api.py (임시 DB 사용)."""
import os
import sys
import tempfile
from pathlib import Path

os.environ["KPC_DATA_DIR"] = tempfile.mkdtemp()
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PW = "demo1234!"


def login(c: TestClient, who: str) -> TestClient:
    r = c.post("/api/auth/login", json={"login": f"{who}@kpc.demo", "password": PW})
    assert r.status_code == 200, r.text
    return c


def main() -> None:
    with TestClient(app) as anon:
        assert anon.get("/app/admin", follow_redirects=False).headers["location"].startswith("/login")
        assert anon.post("/api/auth/login", json={"login": "member@kpc.demo", "password": "x"}).status_code == 401
        assert anon.get("/api/boot?page=me").status_code == 401

    with TestClient(app) as m:
        login(m, "member")
        boot = m.get("/api/boot?page=me").json()
        assert boot["pages"] == ["me"] and boot["cycle"]["phase"] == "review"
        assert m.get("/api/ad/dash").status_code == 403 and m.get("/api/rv/eval/1").status_code == 403
        s = m.get("/api/me/self").json()
        assert s["self_open"] and s["actual_open"]
        assert m.put("/api/me/self", json={"comment": "짧음", "submit": True}).status_code == 400  # 20자 미만
        acts = [{"id": g["id"], "actual": g["target"]} for g in s["goals"] if g["type"] == "quant"]
        r = m.put("/api/me/self", json={"actuals": acts, "comment": "이번 주기 핵심 과제를 모두 일정 내에 마쳤고 협업 리스크도 선제 공유했습니다.", "submit": True})
        assert r.status_code == 200, r.text
        assert m.put("/api/me/self", json={"comment": "x" * 30}).status_code == 409  # 제출 후 수정 불가
        peer = m.get("/api/me/peer").json()["reviews"]
        pend = [p for p in peer if p["status"] == "assigned"]
        if pend:
            sc = {k: 4 for k in m.get("/api/me/peer").json()["items"]}
            assert m.put(f"/api/me/peer/{pend[0]['id']}", json={"scores": sc, "comment": "좋아요"}).status_code == 200
            assert m.put(f"/api/me/peer/{pend[0]['id']}", json={"scores": sc}).status_code == 409
        assert len(m.get("/api/me/results").json()) == 2
        me_id = boot["me"]["id"]

    with TestClient(app) as lead:
        login(lead, "leader")
        assert "review" in lead.get("/api/boot?page=review").json()["pages"]
        ws = lead.get(f"/api/rv/eval/{me_id}").json()
        assert ws["role"] == "first" and ws["first_open"]
        items = {str(i["id"]): 4 for i in ws["items"]}
        gs = {str(g["id"]): 85 for g in ws["goals"] if g["type"] == "qual"}
        bad = lead.put(f"/api/rv/eval/{me_id}", json={"goal_scores": gs, "item_scores": items, "comment": "짧다", "submit": True})
        assert bad.status_code == 400
        ok = lead.put(f"/api/rv/eval/{me_id}", json={"goal_scores": gs, "item_scores": items, "comment": "목표 달성과 협업 모두 우수했습니다.", "submit": True})
        assert ok.status_code == 200, ok.text
        assert lead.post(f"/api/rv/adjust/{me_id}", json={"delta": 3, "reason": "사유입니다"}).status_code == 409  # 1차는 조정 불가

    with TestClient(app) as d:
        login(d, "director")
        r = d.post(f"/api/rv/adjust/{me_id}", json={"delta": 11, "reason": "범위 초과"})
        assert r.status_code == 422  # ±10 초과
        r = d.post(f"/api/rv/adjust/{me_id}", json={"delta": -2, "reason": "부서 간 형평성"})
        assert r.status_code == 200 and r.json()["score"]["adj"] == -2

    with TestClient(app) as a:
        login(a, "admin")
        dash = a.get("/api/ad/dash").json()
        assert dash["kpis"]["people"] > 40 and any(x["title"] == "계정 미발급" for x in dash["actions"])
        cid = boot["cycle"]["id"]
        assert a.post("/api/ad/confirm", json={"user_ids": [me_id]}).status_code == 409  # 조정·확정 단계 아님
        assert a.post(f"/api/ad/cycles/{cid}/phase", json={"phase": "calib"}).status_code == 200
        r = a.post("/api/ad/confirm", json={"user_ids": [me_id]}).json()
        assert r["confirmed"] == 1, r
        rel = a.get("/api/ad/relations").json()["people"]
        free = next(p for p in rel if p["first_id"] and p["first_status"] != "submitted")
        assert a.put(f"/api/ad/relations/{free['id']}", json={"first_id": free["id"]}).status_code == 400  # 본인 지정
        boss = next(p for p in rel if p["id"] == free["first_id"])
        if boss["first_status"] != "submitted":  # 순환 A→B→A 거부
            assert a.put(f"/api/ad/relations/{boss['id']}", json={"first_id": free["id"]}).status_code == 400
        no_acc = [u["id"] for u in a.get("/api/ad/users").json() if not u["has_account"] and u["status"] == "active"]
        csv_text = a.post("/api/ad/accounts/issue", json={"user_ids": no_acc}).text
        assert csv_text.count("Kpc!") == len(no_acc) > 0
        assert a.post(f"/api/ad/cycles/{cid}/phase", json={"phase": "publish"}).status_code == 200
        assert a.put("/api/ad/layout/me", json={"widgets": [{"id": "hero", "x": 0, "y": 0, "w": 12, "h": 2}], "menu": []}).status_code == 200

    with TestClient(app) as m:
        login(m, "member")
        res = m.get("/api/me/results").json()
        assert len(res) == 3 and res[0]["snapshot"]["adj"] == -2 and res[0]["snapshot"]["grade"]
        assert "reviewer" not in str(res[0]["peer"])  # 익명 요약
        assert m.get("/api/boot?page=me").json()["layout"]["widgets"][0]["id"] == "hero"
    print("api smoke OK")


if __name__ == "__main__":
    main()
