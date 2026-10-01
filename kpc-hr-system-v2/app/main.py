"""KPC HR SYSTEM — FastAPI 진입점: 페이지 라우팅(역할별 분리), 인증, 공통 API."""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app import core, seed
from app.db import PHASES, init_db, js, pj, row, rows, run
from app.routes_admin import router as admin_router
from app.routes_me import router as me_router
from app.routes_review import router as review_router

WEB = Path(__file__).resolve().parent.parent / "web"
PAGES = {"me": "me.html", "review": "review.html", "admin": "admin.html"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    if init_db():
        seed.seed()
    yield


app = FastAPI(title="KPC HR SYSTEM", version="2.0", lifespan=lifespan,
              docs_url="/api/docs" if os.environ.get("KPC_DOCS", "1") == "1" else None, redoc_url=None)
app.mount("/static", StaticFiles(directory=WEB), name="static")
for r in (me_router, review_router, admin_router):
    app.include_router(r)

CSP = ("default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; "
       "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp: Response = await call_next(request)
    resp.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
                         "Referrer-Policy": "same-origin", "Content-Security-Policy": CSP})
    if request.url.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    return resp


def home_of(user: dict[str, Any]) -> str:
    pages = core.evaluator_pages(user)
    return "/app/" + ("admin" if "admin" in pages else "review" if "review" in pages else "me")


# ── 페이지 ────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def index(request: Request):
    user = core.session_user(request)
    return RedirectResponse(home_of(user) if user else "/login")


@app.get("/login", include_in_schema=False)
def login_page():
    return FileResponse(WEB / "login.html")


@app.get("/manual", include_in_schema=False)
def manual_page():
    return FileResponse(WEB / "manual.html")


@app.get("/app/{page}", include_in_schema=False)
def app_page(page: str, request: Request):
    user = core.session_user(request)
    if not user:
        return RedirectResponse(f"/login?next=/app/{page}")
    if page not in PAGES or page not in core.evaluator_pages(user):
        return RedirectResponse(home_of(user))
    return FileResponse(WEB / PAGES[page])


# ── 인증 ──────────────────────────────────────────────────
class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=200)


_fails: dict[str, tuple[int, float]] = {}  # ponytail: 프로세스 메모리 잠금, 다중 인스턴스면 Redis로 이동


@app.post("/api/auth/login")
def login(body: LoginIn):
    key = body.login.strip().lower()
    count, until = _fails.get(key, (0, 0.0))
    if until > time.time():
        raise HTTPException(429, f"로그인 5회 실패로 {int(until - time.time()) // 60 + 1}분간 잠겼습니다.")
    user = row("SELECT * FROM users WHERE (lower(email)=? OR lower(emp_no)=?) AND status='active'", key, key)
    if not user or not core.verify_pw(body.password, user["pw_hash"]):
        count += 1
        _fails[key] = (count, time.time() + 300 if count >= 5 else 0.0)
        raise HTTPException(401, "사번/이메일 또는 비밀번호가 올바르지 않습니다.")
    _fails.pop(key, None)
    core.audit(user, "auth.login")
    resp = JSONResponse({"home": home_of(user), "must_change": bool(user["must_change"])})
    resp.set_cookie(core.COOKIE, core.make_token(user), max_age=core.TOKEN_TTL, httponly=True,
                    samesite="lax", secure=core.SECURE_COOKIE)
    return resp


@app.post("/api/auth/logout")
def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(core.COOKIE)
    return resp


@app.get("/api/brand")
def brand():
    return pj((row("SELECT value FROM settings WHERE key='brand'") or {}).get("value"), {})


class PwIn(BaseModel):
    current: str = Field(max_length=200)
    new: str = Field(min_length=8, max_length=200)


@app.put("/api/me/password")
def change_password(body: PwIn, user=Depends(core.current_user)):
    if not core.verify_pw(body.current, user["pw_hash"]):
        raise HTTPException(400, "현재 비밀번호가 올바르지 않습니다.")
    run("UPDATE users SET pw_hash=?, must_change=0 WHERE id=?", core.hash_pw(body.new), user["id"])
    fresh = row("SELECT * FROM users WHERE id=?", user["id"])
    resp = JSONResponse({"ok": True})
    resp.set_cookie(core.COOKIE, core.make_token(fresh), max_age=core.TOKEN_TTL, httponly=True, samesite="lax", secure=core.SECURE_COOKIE)
    return resp


# ── 부트스트랩 · 레이아웃 · 알림 · 칭찬 ───────────────────────
@app.get("/api/boot")
def boot(page: str, user=Depends(core.current_user)):
    c = core.load_cycle()
    cycle = {k: c[k] for k in ("id", "name", "phase", "phase_label", "start_date", "end_date")} if c else None
    return {
        "me": core.public_user(user), "pages": core.evaluator_pages(user), "cycle": cycle,
        "phases": [{"key": k, "label": v} for k, v in PHASES], "brand": brand(),
        "layout": pj((row("SELECT data FROM layouts WHERE scope=?", f"role:{page}") or {}).get("data")),
        "mylayout": pj((row("SELECT data FROM layouts WHERE scope=?", f"user:{user['id']}:{page}") or {}).get("data")),
        "unread": row("SELECT COUNT(*) n FROM notifications WHERE user_id=? AND read=0", user["id"])["n"],
    }


class LayoutIn(BaseModel):
    widgets: list[dict[str, Any]] = Field(max_length=40)


@app.put("/api/me/layout/{page}")
def save_my_layout(page: str, body: LayoutIn, user=Depends(core.current_user)):
    role = pj((row("SELECT data FROM layouts WHERE scope=?", f"role:{page}") or {}).get("data"), {})
    if role.get("personalize") is False:
        raise HTTPException(403, "관리자가 대시보드 개인화를 잠갔습니다.")
    run("INSERT OR REPLACE INTO layouts(scope,data) VALUES(?,?)", f"user:{user['id']}:{page}", js({"widgets": body.widgets}))
    return {"ok": True}


@app.delete("/api/me/layout/{page}")
def reset_my_layout(page: str, user=Depends(core.current_user)):
    run("DELETE FROM layouts WHERE scope=?", f"user:{user['id']}:{page}")
    return {"ok": True}


@app.get("/api/notifications")
def notifications(user=Depends(core.current_user)):
    return rows("SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30", user["id"])


@app.post("/api/notifications/read")
def read_notifications(user=Depends(core.current_user)):
    run("UPDATE notifications SET read=1 WHERE user_id=?", user["id"])
    return {"ok": True}


@app.get("/api/people")
def people(q: str = "", user=Depends(core.current_user)):
    like = f"%{q.strip()}%"
    return rows("SELECT u.id, u.name, u.position, u.duty, u.hue, o.name org_name FROM users u LEFT JOIN orgs o ON o.id=u.org_id "
                "WHERE u.status='active' AND (u.name LIKE ? OR o.name LIKE ?) ORDER BY u.name LIMIT 30", like, like)


@app.get("/api/notices")
def notices(user=Depends(core.current_user)):
    return rows("SELECT * FROM notices ORDER BY pinned DESC, id DESC LIMIT 20")


class KudosIn(BaseModel):
    to_id: int
    tag: str = Field(max_length=30)
    message: str = Field(min_length=5, max_length=500)


KUDOS_SQL = ("SELECT k.*, f.name from_name, f.hue from_hue, t.name to_name, t.hue to_hue FROM kudos k "
             "JOIN users f ON f.id=k.from_id JOIN users t ON t.id=k.to_id")


@app.get("/api/kudos")
def kudos(scope: str = "all", user=Depends(core.current_user)):
    if scope == "me":
        return rows(KUDOS_SQL + " WHERE k.to_id=? OR k.from_id=? ORDER BY k.id DESC LIMIT 60", user["id"], user["id"])
    return rows(KUDOS_SQL + " ORDER BY k.id DESC LIMIT 60")


@app.post("/api/kudos")
def send_kudos(body: KudosIn, user=Depends(core.current_user)):
    if body.to_id == user["id"]:
        raise HTTPException(400, "본인에게는 보낼 수 없습니다.")
    if not row("SELECT 1 FROM users WHERE id=? AND status='active'", body.to_id):
        raise HTTPException(404, "대상을 찾을 수 없습니다.")
    run("INSERT INTO kudos(from_id,to_id,tag,message) VALUES(?,?,?,?)", user["id"], body.to_id, body.tag, body.message)
    core.notify(body.to_id, f"{user['name']}님이 칭찬을 보냈습니다 🎉", "/app/me#/kudos")
    return {"ok": True}
