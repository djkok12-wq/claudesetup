"""SQLite 접근 계층 — 요청마다 짧은 커넥션을 열고, JSON 컬럼은 TEXT로 저장한다."""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

DATA_DIR = Path(os.environ.get("KPC_DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
DB_PATH = DATA_DIR / "kpc_hr.db"

PHASES: list[tuple[str, str]] = [
    ("prep", "준비"), ("goal", "목표 설정"), ("self", "실적·자기평가"), ("review", "평가 진행"),
    ("calib", "조정·확정"), ("publish", "결과 공개"), ("closed", "종료"),
]
PHASE_KEYS = [k for k, _ in PHASES]

DEFAULT_CFG: dict[str, Any] = {
    "weights": {"member": {"goal": 40, "comp": 40, "extra": 20}, "leader": {"goal": 50, "comp": 30, "extra": 20}},
    "grades": [["S", 95], ["A", 85], ["B", 75], ["C", 65], ["D", 0]],
    "guide": {"S": 10, "A": 20, "B": 40, "C": 20, "D": 10},
    "conv": [[110, 100], [100, 90], [90, 80], [80, 70], [0, 60]],
    "leader_duties": ["대표이사", "본부장", "그룹장", "부서장", "팀장", "섹션장"],
}
DEFAULT_ITEMS: list[tuple[str, str, str]] = [
    ("comp", "전문성", "직무 지식과 기술로 문제를 해결한다"),
    ("comp", "협업·소통", "정보를 나누고 함께 성과를 만든다"),
    ("comp", "책임감", "맡은 일을 끝까지 가져간다"),
    ("comp", "도전·혁신", "더 나은 방법을 찾는다"),
    ("comp", "고객지향", "내·외부 고객 관점에서 가치를 판단한다"),
    ("dev", "학습·성장", "스스로 목표를 세워 역량을 키운다"),
    ("dev", "지식 공유", "배운 것을 동료와 나눈다"),
    ("dev", "업무 개선", "일하는 방식을 스스로 개선한다"),
    ("mgmt", "목표 관리", "조직 목표를 수립·전파하고 실행을 관리한다"),
    ("mgmt", "인재 육성", "구성원의 성장을 코칭하고 피드백한다"),
    ("mgmt", "조직 운영", "공정하고 효율적으로 조직을 운영한다"),
]
PEER_ITEMS = ["전문성", "협업", "책임감", "성장", "신뢰"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS orgs(id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER, level TEXT, head_id INTEGER, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, emp_no TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT UNIQUE,
  org_id INTEGER, position TEXT, duty TEXT, hire_date TEXT, status TEXT DEFAULT 'active', is_admin INTEGER DEFAULT 0,
  pw_hash TEXT, must_change INTEGER DEFAULT 0, hue INTEGER DEFAULT 220);
CREATE TABLE IF NOT EXISTS cycles(id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT, end_date TEXT,
  phase TEXT DEFAULT 'prep', active INTEGER DEFAULT 0, config TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, cycle_id INTEGER NOT NULL, area TEXT NOT NULL, name TEXT NOT NULL, description TEXT, sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS relations(cycle_id INTEGER, user_id INTEGER, first_id INTEGER, second_id INTEGER,
  scheme TEXT DEFAULT 'member', manual INTEGER DEFAULT 0, scheme_manual INTEGER DEFAULT 0, PRIMARY KEY(cycle_id, user_id));
CREATE TABLE IF NOT EXISTS kpis(id INTEGER PRIMARY KEY, cycle_id INTEGER, org_id INTEGER, parent_id INTEGER, title TEXT NOT NULL,
  weight INTEGER DEFAULT 0, target TEXT, achievement REAL);
CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY, cycle_id INTEGER, user_id INTEGER, kpi_id INTEGER, title TEXT NOT NULL,
  description TEXT DEFAULT '', type TEXT DEFAULT 'quant', weight INTEGER DEFAULT 0, target REAL, unit TEXT DEFAULT '', due TEXT,
  actual REAL, actual_note TEXT DEFAULT '', status TEXT DEFAULT 'draft', review_note TEXT DEFAULT '', sort INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, cycle_id INTEGER, user_id INTEGER, reviewer_id INTEGER, stage TEXT,
  status TEXT DEFAULT 'draft', goal_scores TEXT DEFAULT '{}', item_scores TEXT DEFAULT '{}', comment TEXT DEFAULT '',
  submitted_at TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(cycle_id, user_id, stage));
CREATE TABLE IF NOT EXISTS adjustments(id INTEGER PRIMARY KEY, cycle_id INTEGER, user_id INTEGER, by_id INTEGER, by_role TEXT,
  delta REAL NOT NULL, reason TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS results(cycle_id INTEGER, user_id INTEGER, snapshot TEXT NOT NULL, confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  confirmed_by INTEGER, PRIMARY KEY(cycle_id, user_id));
CREATE TABLE IF NOT EXISTS peer_reviews(id INTEGER PRIMARY KEY, cycle_id INTEGER, target_id INTEGER, reviewer_id INTEGER, kind TEXT,
  scores TEXT DEFAULT '{}', comment TEXT DEFAULT '', status TEXT DEFAULT 'assigned', submitted_at TEXT, UNIQUE(cycle_id, target_id, reviewer_id));
CREATE TABLE IF NOT EXISTS rewrites(id INTEGER PRIMARY KEY, cycle_id INTEGER, user_id INTEGER, stage TEXT, requester_id INTEGER,
  reason TEXT, status TEXT DEFAULT 'open', handled_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS kudos(id INTEGER PRIMARY KEY, from_id INTEGER, to_id INTEGER, tag TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY, title TEXT, body TEXT, pinned INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER, text TEXT, link TEXT, read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS layouts(scope TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS ix_goals_cu ON goals(cycle_id, user_id);
CREATE INDEX IF NOT EXISTS ix_reviews_c ON reviews(cycle_id);
CREATE INDEX IF NOT EXISTS ix_notif_u ON notifications(user_id, read);
"""


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    return con


@contextmanager
def tx() -> Iterator[sqlite3.Connection]:
    """쓰기 트랜잭션: 성공 시 commit, 예외 시 rollback."""
    con = connect()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def rows(sql: str, *args: Any) -> list[dict[str, Any]]:
    con = connect()
    try:
        return [dict(r) for r in con.execute(sql, args).fetchall()]
    finally:
        con.close()


def row(sql: str, *args: Any) -> dict[str, Any] | None:
    found = rows(sql, *args)
    return found[0] if found else None


def val(sql: str, *args: Any) -> Any:
    r = row(sql, *args)
    return next(iter(r.values())) if r else None


def run(sql: str, *args: Any) -> int:
    """단일 쓰기 실행 후 lastrowid 반환."""
    with tx() as con:
        return con.execute(sql, args).lastrowid or 0


def js(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def pj(text: str | None, default: Any = None) -> Any:
    try:
        return json.loads(text) if text else default
    except (TypeError, ValueError):
        return default


def init_db() -> bool:
    """스키마를 만들고, 비어 있으면 True를 반환(시드 필요)."""
    con = connect()
    try:
        con.executescript("PRAGMA journal_mode=WAL;" + SCHEMA)
        return con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
    finally:
        con.close()
