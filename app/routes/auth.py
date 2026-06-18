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
from app.services.rate_limit import allow_login
from app.services.turnstile import is_enabled as turnstile_enabled
from app.services.turnstile import site_key as turnstile_site_key
from app.services.turnstile import verify as verify_turnstile
from app.templating import templates
from app.time_utils import now_utc

router = APIRouter()


def _turnstile_ctx() -> dict:
    return {
        "turnstile_enabled": turnstile_enabled(),
        "turnstile_site_key": turnstile_site_key(),
    }


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


@router.get("/login")
def login_page(request: Request, next: str = "/queue"):
    return templates.TemplateResponse(
        request, "pages/login.html", {"next": next, "error": None, **_turnstile_ctx()}
    )


@router.post("/login")
def login_submit(
    request: Request,
    db: DbSession,
    mobile: Annotated[str, Form()],
    password: Annotated[str, Form()],
    next: Annotated[str, Form()] = "/queue",
    cf_turnstile_response: Annotated[str, Form(alias="cf-turnstile-response")] = "",
):
    normalized = normalize_mobile(mobile)
    err_ctx = {
        "next": next,
        "error": "Invalid mobile number or password.",
        "mobile": mobile,
        **_turnstile_ctx(),
    }

    if not normalized:
        return templates.TemplateResponse(request, "pages/login.html", err_ctx, status_code=400)

    # Rate limit per mobile — slows credential stuffing without leaking which
    # mobiles are real (we always show the same generic error).
    if not allow_login(db, mobile=normalized):
        err_ctx["error"] = "Too many attempts. Please try again in 15 minutes."
        return templates.TemplateResponse(request, "pages/login.html", err_ctx, status_code=429)

    # Turnstile bot challenge (skipped when not configured).
    if not verify_turnstile(cf_turnstile_response, remote_ip=_client_ip(request)):
        err_ctx["error"] = "Please complete the verification."
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


@router.post("/theme")
def set_theme(
    request: Request,
    theme: Annotated[str, Form()],
    next: Annotated[str, Form()] = "/queue",
):
    from app.templating import THEME_COOKIE, normalize_theme
    safe_next = next if next.startswith("/") else "/queue"
    resp = RedirectResponse(url=safe_next, status_code=303)
    normalized = normalize_theme(theme)
    if normalized:
        resp.set_cookie(
            key=THEME_COOKIE,
            value=normalized,
            max_age=60 * 60 * 24 * 365,
            httponly=False,
            secure=get_settings().app_env != "dev",
            samesite="lax",
            path="/",
        )
    else:
        # Empty/auto: clear the cookie, fall back to OS preference
        resp.delete_cookie(THEME_COOKIE, path="/")
    return resp
