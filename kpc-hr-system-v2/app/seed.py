"""데모 데이터 — 조직 15개, 구성원 60여 명, 평가 주기 3개(종료 2 + 진행 1). 결정적(random seed 고정)."""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from app import core
from app.db import DEFAULT_CFG, DEFAULT_ITEMS, PEER_ITEMS, connect, init_db, js, rows, tx

DEMO_PW = "demo1234!"
ORGS = [  # key, name, parent, level
    ("ceo", "KPC", None, "전사"),
    ("ms", "경영지원본부", "ceo", "본부"), ("hr", "인사팀", "ms", "팀"), ("fin", "재무팀", "ms", "팀"), ("it", "전산팀", "ms", "팀"),
    ("rd", "연구개발본부", "ceo", "본부"), ("rd1", "R&D1팀", "rd", "팀"), ("rd2", "R&D2팀", "rd", "팀"),
    ("mf", "생산본부", "ceo", "본부"), ("mf1", "생산1팀", "mf", "팀"), ("mf2", "생산2팀", "mf", "팀"), ("qa", "품질경영팀", "mf", "팀"),
    ("sl", "영업본부", "ceo", "본부"), ("sl1", "국내영업팀", "sl", "팀"), ("sl2", "해외영업팀", "sl", "팀"),
]
KPI_TITLES = {
    "ceo": ["매출 1,200억 달성", "영업이익률 8% 확보", "고객만족도 90점"],
    "ms": ["경영 프로세스 디지털 전환", "관리 비용 5% 절감"], "rd": ["신제품 3종 개발 완료", "특허 출원 10건"],
    "mf": ["생산성 12% 향상", "불량률 0.5% 이하"], "sl": ["신규 고객 40개사 확보", "수출 비중 35%"],
    "hr": ["평가제도 개편 완료", "핵심인재 유지율 95%"], "fin": ["월 결산 D+3 단축", "예산 집행 정확도 98%"],
    "it": ["ERP 고도화 오픈", "보안 사고 0건"], "rd1": ["차세대 플랫폼 개발", "기술 문서화 100%"],
    "rd2": ["원가 절감 설계 적용", "시제품 검증 6건"], "mf1": ["라인 가동률 92%", "설비 고장 30% 감소"],
    "mf2": ["리드타임 15% 단축", "작업 표준화 20건"], "qa": ["고객 클레임 50% 감소", "품질 인증 갱신"],
    "sl1": ["국내 매출 600억", "핵심 거래처 유지율 97%"], "sl2": ["해외 매출 400억", "신규 국가 3곳 진출"],
}
SURNAMES = "김이박최정강조윤장임한오서신권황안송류홍"
GIVEN = ("민준 서연 도윤 하은 지호 수아 예준 지유 시우 서윤 주원 하린 지훈 채원 건우 지민 현우 다은 우진 소율 선우 예린 "
         "연우 수빈 유준 나연 정우 가은 승현 윤서 준혁 민서 태윤 아린 동현 시은 재원 유나 성민 하윤").split()
SPECIAL = {  # 데모 로그인 계정
    "admin": ("김하늘", "hr", "과장", "", 1), "leader": ("박서준", "rd1", "부장", "팀장", 0),
    "director": ("이도현", "rd", "상무", "본부장", 0), "member": ("최유나", "rd1", "대리", "", 0),
}
SELF_C = ["상반기 대비 주요 과제를 일정 내 완료했고, 협업 과정에서 일정 지연 리스크를 사전에 공유해 해소했습니다.",
          "목표 대비 실적은 대부분 달성했으나 일부 과제는 외부 요인으로 지연되어 다음 주기에 보완 계획을 세웠습니다.",
          "신규 업무를 맡아 빠르게 적응했고, 반복 업무 자동화로 팀 전체 처리 시간을 줄이는 데 기여했습니다."]
FIRST_C = ["목표 달성도가 높고 협업 태도가 우수함. 다음 주기에는 리딩 역할 확대를 기대함.",
           "성실하게 과제를 수행했으나 일정 관리에서 개선 여지가 있음. 우선순위 설정 코칭 예정.",
           "도전적인 목표를 설정하고 성과로 연결함. 지식 공유 활동이 팀에 긍정적 영향을 줌."]
PEER_C = ["필요한 정보를 먼저 공유해 주셔서 함께 일하기 편합니다.", "마감 직전까지 책임감 있게 챙기는 모습이 인상적입니다.",
          "회의에서 의견을 조금 더 적극적으로 내주시면 좋겠습니다.", "새로운 방법을 시도하는 데 거리낌이 없어 배울 점이 많습니다."]
KUDOS = ["신규 고객 미팅 자료를 같이 준비해 주셔서 큰 힘이 됐어요!", "품질 이슈 원인을 빠르게 분석해 주셔서 납기를 지켰습니다.",
         "꼼꼼한 리뷰 덕분에 장애를 미리 막았어요.", "신입 온보딩을 친절하게 도와주셔서 감사합니다.",
         "어려운 협상을 끝까지 책임지고 마무리해 주셨어요.", "자동화 아이디어로 반복 업무가 절반으로 줄었어요.",
         "고객 불만을 직접 찾아가 해결해 주셔서 감동이었습니다.", "회의 내용을 깔끔하게 정리해 공유해 주셔서 모두 같은 방향을 봤어요."]
CYCLES = [("2025 하반기 성과평가", "2025-07-01", "2025-12-31", "closed"),
          ("2026 상반기 성과평가", "2026-01-01", "2026-06-30", "closed"),
          ("2026 하반기 성과평가", "2026-07-01", "2026-12-31", "review")]
SCHEDULE = {"prep": "2026-06-30", "goal": "2026-07-20", "self": "2026-09-26", "review": "2026-10-16",
            "calib": "2026-10-31", "publish": "2026-11-14", "closed": "2026-12-31"}


def _clip(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def wipe() -> None:
    con = connect()
    try:
        for (name,) in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
            con.execute(f'DROP TABLE IF EXISTS "{name}"')
        con.commit()
    finally:
        con.close()


def seed() -> None:
    rnd = random.Random(2026)
    pw = core.hash_pw(DEMO_PW)
    org_id: dict[str, int] = {}
    with tx() as con:
        for i, (key, name, parent, level) in enumerate(ORGS):
            org_id[key] = con.execute("INSERT INTO orgs(name,parent_id,level,sort) VALUES(?,?,?,?)",
                                      (name, org_id.get(parent), level, i)).lastrowid
        names = {f"{s}{g}" for s in SURNAMES for g in GIVEN} - {v[0] for v in SPECIAL.values()}
        pool = sorted(names)
        rnd.shuffle(pool)
        seq = iter(range(1, 999))

        def add(name: str, org: str, pos: str, duty: str, email: str | None = None, admin: int = 0,
                hire: str | None = None, account: bool = True, status: str = "active") -> int:
            n = next(seq)
            hire = hire or f"{rnd.randint(2008, 2024)}-{rnd.randint(1, 12):02d}-01"
            return con.execute(
                "INSERT INTO users(emp_no,name,email,org_id,position,duty,hire_date,status,is_admin,pw_hash,hue) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (f"KPC{n:04d}", name, email or f"kpc{n:04d}@kpc.demo", org_id[org], pos, duty, hire, status, admin,
                 pw if account else None, rnd.randint(0, 359))).lastrowid

        uid = {k: add(n, o, p, d, f"{k}@kpc.demo", a) for k, (n, o, p, d, a) in SPECIAL.items()}
        heads = {"ceo": add(pool.pop(), "ceo", "대표", "대표이사"), "rd": uid["director"], "rd1": uid["leader"]}
        for key, _, parent, level in ORGS:
            if key not in heads:
                heads[key] = add(pool.pop(), key, rnd.choice(["상무", "전무"]) if level == "본부" else rnd.choice(["부장", "차장"]),
                                 "본부장" if level == "본부" else "팀장")
            if level == "팀":
                for _ in range(rnd.randint(3, 5) - (1 if key in ("rd1", "hr") else 0)):
                    add(pool.pop(), key, rnd.choice(["사원", "주임", "대리", "과장", "차장"]), "")
        for key in ("it", "mf1", "sl2"):  # 계정 미발급 신규 입사자 (일괄 발급 데모)
            add(pool.pop(), key, "사원", "", hire="2026-09-01", account=False)
        add(pool.pop(), "fin", "대리", "", status="retired")
        for key, hid in heads.items():
            con.execute("UPDATE orgs SET head_id=? WHERE id=?", (hid, org_id[key]))
        con.execute("INSERT INTO settings(key,value) VALUES('brand',?)", (js({
            "company": "KPC", "product": "HR SYSTEM", "color": "#3b5bfd", "motion": True, "demo": True,
            "loginTitle": "성과가 연결되는 순간,", "loginSub": "목표·평가·성장을 하나의 흐름으로 관리하는 KPC 성과평가 플랫폼"}),))

    talent = {u["id"]: rnd.uniform(-1, 1) for u in rows("SELECT id FROM users")}
    talent[uid["member"]], talent[uid["leader"]] = 0.45, 0.6
    for ci, (name, start, end, phase) in enumerate(CYCLES):
        _seed_cycle(rnd, ci, name, start, end, phase, org_id, uid, talent)
    _seed_social(rnd, uid)


def _seed_cycle(rnd: random.Random, ci: int, name: str, start: str, end: str, phase: str,
                org_id: dict[str, int], uid: dict[str, int], talent: dict[int, float]) -> None:
    active = phase != "closed"
    with tx() as con:
        cid = con.execute("INSERT INTO cycles(name,start_date,end_date,phase,active,config) VALUES(?,?,?,?,?,?)",
                          (name, start, end, phase, int(active), js({**DEFAULT_CFG, "schedule": SCHEDULE} if active else DEFAULT_CFG))).lastrowid
        for i, (area, iname, desc) in enumerate(DEFAULT_ITEMS):
            con.execute("INSERT INTO items(cycle_id,area,name,description,sort) VALUES(?,?,?,?,?)", (cid, area, iname, desc, i))
        kpi: dict[str, list[int]] = {}
        for key, _, parent, _ in ORGS:
            for j, title in enumerate(KPI_TITLES[key]):
                par = kpi[parent][j % len(kpi[parent])] if parent else None
                kpi.setdefault(key, []).append(con.execute(
                    "INSERT INTO kpis(cycle_id,org_id,parent_id,title,weight,target,achievement) VALUES(?,?,?,?,?,?,?)",
                    (cid, org_id[key], par, title, 100 // len(KPI_TITLES[key]), "연간 목표",
                     round(rnd.uniform(78, 118), 1) if not active else round(rnd.uniform(40, 85), 1))).lastrowid)
    cycle = core.load_cycle(cid)
    core.assign_relations(cycle)
    with tx() as con:
        con.execute("DELETE FROM relations WHERE cycle_id=? AND user_id IN (SELECT id FROM users WHERE hire_date>? OR status!='active')", (cid, end))
    rels = rows("SELECT r.*, u.org_id FROM relations r JOIN users u ON u.id=r.user_id WHERE r.cycle_id=?", cid)
    key_of = {v: k for k, v in org_id.items()}
    items = rows("SELECT * FROM items WHERE cycle_id=?", cid)
    now = datetime(2026, 9, 30, 9, 0)
    with tx() as con:
        for r in rels:
            u, t = r["user_id"], talent[r["user_id"]]
            new_hire = (rows("SELECT hire_date FROM users WHERE id=?", u)[0]["hire_date"] or "") >= "2026-07-01"
            if new_hire:
                continue  # 목표 미작성 상태로 남겨 '조치 필요' 데모
            # 진행 주기 상태 결정 (데모 계정은 고정)
            roll = rnd.random()
            if not active:
                state = "done"
            elif u == uid["member"]:
                state = "self_draft"
            else:
                state = ("goal_submitted" if roll < .05 else "goal_revise" if roll < .09 else "self_none" if roll < .16
                         else "self_draft" if roll < .30 else "self_done" if roll < .58 else "first_draft" if roll < .72 else "first_done")
            kp = kpi[key_of[r["org_id"]]]
            weights = rnd.choice([[40, 30, 30], [30, 30, 20, 20], [30, 25, 20, 15, 10]])
            specs = [(f"{_kpi_title(kp[0])} — 담당 과제 완수", "quant", 100, "%", kp[0]),
                     (f"{_kpi_title(kp[1])} 개선안 실행", "quant", rnd.randint(5, 12), "건", kp[1]),
                     ("업무 프로세스 개선 제안·적용", "quant", rnd.randint(3, 6), "건", kp[0] if rnd.random() < .5 else None),
                     ("직무 전문성 향상 (자격·교육 이수)", "qual", None, "", None),
                     ("부서 간 협업 프로젝트 리딩", "qual", None, "", kp[1])]
            gids = []
            for k, w in enumerate(weights):
                title, typ, target, unit, kid = specs[k]
                status = "approved"
                if state == "goal_submitted":
                    status = "submitted"
                elif state == "goal_revise" and k == 0:
                    status = "revise"
                has_actual = typ == "quant" and (state in ("done", "self_done", "first_draft", "first_done") or (state == "self_draft" and k < 2))
                actual = round(target * _clip(1.0 + t * .12 + rnd.gauss(0, .06), .55, 1.4), 1) if has_actual else None
                gids.append((con.execute(
                    "INSERT INTO goals(cycle_id,user_id,kpi_id,title,description,type,weight,target,unit,due,actual,actual_note,status,review_note,sort) "
                    "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (cid, u, kid, title, f"{title}을(를) {end[:7]}까지 측정 가능한 산출물로 완료한다.", typ, w, target, unit, end,
                     actual, "분기별 실적 집계 기준" if actual is not None else "", status,
                     "측정 지표를 더 구체적으로 적어 주세요." if status == "revise" else "", k)).lastrowid, typ))
            if state in ("goal_submitted", "goal_revise", "self_none"):
                continue
            stamp = (now - timedelta(days=rnd.randint(1, 9))).strftime("%Y-%m-%d %H:%M:%S")
            self_done = state != "self_draft"
            self_scores = {str(i["id"]): int(_clip(round(3.8 + t + rnd.gauss(0, .5)), 1, 5)) for i in items}
            con.execute("INSERT INTO reviews(cycle_id,user_id,reviewer_id,stage,status,item_scores,comment,submitted_at) VALUES(?,?,?,?,?,?,?,?)",
                        (cid, u, u, "self", "submitted" if self_done else "draft", js(self_scores),
                         rnd.choice(SELF_C) if self_done else "이번 주기에는 플랫폼 개발 일정", stamp if self_done else None))
            if state in ("self_draft", "self_done"):
                continue
            first_done = state in ("done", "first_done")
            isc = {str(i["id"]): int(_clip(round(3.8 + t * 1.0 + rnd.gauss(0, .45)), 1, 5)) for i in items}
            if not first_done:
                isc = dict(list(isc.items())[:4])
            gsc = {str(g): int(_clip(82 + t * 14 + rnd.gauss(0, 5), 50, 100)) for g, typ in gids if typ == "qual"}
            con.execute("INSERT INTO reviews(cycle_id,user_id,reviewer_id,stage,status,goal_scores,item_scores,comment,submitted_at) VALUES(?,?,?,?,?,?,?,?,?)",
                        (cid, u, r["first_id"], "first", "submitted" if first_done else "draft", js(gsc), js(isc),
                         rnd.choice(FIRST_C) if first_done else "", stamp if first_done else None))
            if first_done and r["second_id"] and (not active or rnd.random() < .5):
                con.execute("INSERT INTO reviews(cycle_id,user_id,reviewer_id,stage,status,comment,submitted_at) VALUES(?,?,?,?,?,?,?)",
                            (cid, u, r["second_id"], "second", "submitted", "1차 평가 의견에 동의합니다.", stamp))
                if rnd.random() < .18:
                    d = rnd.choice([-5, -3, 2, 3, 5])
                    con.execute("INSERT INTO adjustments(cycle_id,user_id,by_id,by_role,delta,reason) VALUES(?,?,?,?,?,?)",
                                (cid, u, r["second_id"], "second", d, "부서 간 형평성 검토 결과 반영" if d < 0 else "전사 핵심 과제 기여도 반영"))
    if not active:
        for r in rels:
            try:
                snap = core.snapshot(cycle, r["user_id"])
            except Exception:
                continue
            with tx() as con:
                con.execute("INSERT INTO results(cycle_id,user_id,snapshot,confirmed_by,confirmed_at) VALUES(?,?,?,?,?)",
                            (cid, r["user_id"], js(snap), uid["admin"], end + " 18:00:00"))
    core.assign_peers(cycle)
    with tx() as con:
        for p in con.execute("SELECT id, target_id, reviewer_id FROM peer_reviews WHERE cycle_id=?", (cid,)).fetchall():
            if (not active or rnd.random() < .55) and p[2] != uid["member"]:
                t = talent.get(p[1], 0)
                sc = {k: int(_clip(round(3.7 + t + rnd.gauss(0, .6)), 1, 5)) for k in PEER_ITEMS}
                con.execute("UPDATE peer_reviews SET scores=?, comment=?, status='submitted', submitted_at=? WHERE id=?",
                            (js(sc), rnd.choice(PEER_C), end if not active else "2026-09-25 10:00:00", p[0]))
        if active:
            sub = con.execute("SELECT user_id FROM reviews WHERE cycle_id=? AND stage='first' AND status='submitted' AND reviewer_id=? LIMIT 1",
                              (cid, uid["leader"])).fetchone()
            if sub:
                con.execute("INSERT INTO rewrites(cycle_id,user_id,stage,requester_id,reason) VALUES(?,?,?,?,?)",
                            (cid, sub[0], "first", uid["leader"], "정성 목표 점수를 잘못 입력해 재작성이 필요합니다."))


def _kpi_title(kid: int) -> str:
    return rows("SELECT title FROM kpis WHERE id=?", kid)[0]["title"]


def _seed_social(rnd: random.Random, uid: dict[str, int]) -> None:
    people = [u["id"] for u in rows("SELECT id FROM users WHERE status='active'")]
    tags = [n for a, n, _ in DEFAULT_ITEMS if a == "comp"]
    with tx() as con:
        for k in range(48):
            a, b = rnd.sample(people, 2)
            if k < 6:
                b = uid["member"] if k % 2 == 0 else uid["leader"]
                a = a if a != b else people[0]
            con.execute("INSERT INTO kudos(from_id,to_id,tag,message,created_at) VALUES(?,?,?,?,?)",
                        (a, b, rnd.choice(tags), rnd.choice(KUDOS), (datetime(2026, 9, 30) - timedelta(hours=k * 7)).strftime("%Y-%m-%d %H:%M:%S")))
        for title, body, pin in [
            ("2026 하반기 1차 평가 진행 안내", "10/24(금)까지 1차 평가를 제출해 주세요. 산정 미완(가중치·실적 누락) 인원은 피평가자에게 보완을 요청해 주세요.", 1),
            ("다면평가(360°) 작성 기간", "지정된 리뷰어는 10/17까지 다면평가를 작성해 주세요. 모든 코멘트는 익명 요약으로만 전달됩니다.", 0),
            ("목표 설정 SMART 점검 기능 오픈", "목표 작성 시 SMART 5개 기준을 자동 점검해 드립니다.", 0)]:
            con.execute("INSERT INTO notices(title,body,pinned) VALUES(?,?,?)", (title, body, pin))
        for who, text, link in [
            ("member", "자기평가 작성이 아직 완료되지 않았습니다.", "/app/me#/self"),
            ("member", "다면평가 리뷰 요청이 도착했습니다.", "/app/me#/peer"),
            ("member", "새 칭찬을 받았습니다 🎉", "/app/me#/kudos"),
            ("leader", "1차 평가 대기 인원이 있습니다.", "/app/review#/evaluate"),
            ("admin", "재작성 요청 1건이 접수되었습니다.", "/app/admin#/rewrites")]:
            con.execute("INSERT INTO notifications(user_id,text,link) VALUES(?,?,?)", (uid[who], text, link))
        con.execute("INSERT INTO audit(user_id,action,detail) VALUES(?,?,?)", (uid["admin"], "cycle.phase", "2026 하반기 성과평가 → 평가 진행"))


def reset() -> None:
    wipe()
    init_db()
    seed()


if __name__ == "__main__":
    reset()
    print("demo data ready:", rows("SELECT COUNT(*) n FROM users")[0]["n"], "users")
