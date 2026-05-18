from typing import Annotated

from fastapi import APIRouter, Form, Request, Response
from fastapi.responses import RedirectResponse
from sqlmodel import select

from app.config import get_settings
from app.deps import DbSession
from app.models import Clinic, User, UserRole
from app.services.auth import (
    COOKIE_NAME,
    issue_session_token,
    normalize_mobile,
    verify_password,
)
from app.templating import templates
from app.time_utils import now_utc

router = APIRouter()


@router.get("/login")
def login_page(request: Request, next: str = "/queue"):
    return templates.TemplateResponse(
        request, "pages/login.html", {"next": next, "error": None}
    )


@router.post("/login")
def login_submit(
    request: Request,
    db: DbSession,
    mobile: Annotated[str, Form()],
    password: Annotated[str, Form()],
    next: Annotated[str, Form()] = "/queue",
):
    normalized = normalize_mobile(mobile)
    err_ctx = {"next": next, "error": "Invalid mobile number or password.", "mobile": mobile}

    if not normalized:
        return templates.TemplateResponse(request, "pages/login.html", err_ctx, status_code=400)

    user = db.exec(select(User).where(User.mobile == normalized, User.active)).first()
    if not user or not verify_password(password, user.password_hash):
        return templates.TemplateResponse(request, "pages/login.html", err_ctx, status_code=401)

    token, max_age = issue_session_token(user.id, user.role)
    user.last_login_at = now_utc()
    db.add(user)
    db.commit()

    safe_next = next if next.startswith("/") else "/queue"
    if user.role == UserRole.doctor:
        clinic = db.get(Clinic, user.clinic_id)
        if clinic and not clinic.setup_complete:
            safe_next = "/setup"
    resp = RedirectResponse(url=safe_next, status_code=303)
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=get_settings().app_env != "dev",
        samesite="lax",
        path="/",
    )
    return resp


@router.post("/logout")
def logout() -> RedirectResponse:
    resp = RedirectResponse(url="/login", status_code=303)
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp


@router.post("/lang")
def set_lang(
    request: Request,
    lang: Annotated[str, Form()],
    next: Annotated[str, Form()] = "/queue",
):
    from app.i18n import COOKIE_NAME as LANG_COOKIE, normalize_lang
    safe_next = next if next.startswith("/") else "/queue"
    resp = RedirectResponse(url=safe_next, status_code=303)
    resp.set_cookie(
        key=LANG_COOKIE,
        value=normalize_lang(lang),
        max_age=60 * 60 * 24 * 365,
        httponly=False,
        secure=get_settings().app_env != "dev",
        samesite="lax",
        path="/",
    )
    return resp
