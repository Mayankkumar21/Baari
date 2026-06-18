import re
from typing import Annotated

from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.deps import DbSession
from app.services.auth import COOKIE_NAME, issue_session_token
from app.services.rate_limit import allow_signup
from app.services.signup_service import SignupError, signup_tenant
from app.services.turnstile import is_enabled as turnstile_enabled
from app.services.turnstile import site_key as turnstile_site_key
from app.services.turnstile import verify as verify_turnstile
from app.templating import templates
from app.time_utils import now_utc
from app.vocab import TENANT_TYPE_DISPLAY

router = APIRouter()


# Must include at least one letter and one digit; min length already enforced
# at the form input level. We're not requiring symbols — too much friction for
# small-business owners who'll be entering this on mobile.
_PASSWORD_RX = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,128}$")


def _client_ip(request: Request) -> str:
    # Vercel sets x-forwarded-for; first hop is the user.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


def _turnstile_ctx() -> dict:
    return {
        "turnstile_enabled": turnstile_enabled(),
        "turnstile_site_key": turnstile_site_key(),
    }


@router.get("/")
def landing(request: Request):
    return templates.TemplateResponse(
        request,
        "pages/landing.html",
        {"tenant_types": TENANT_TYPE_DISPLAY, **_turnstile_ctx()},
    )


@router.get("/signup")
def signup_page(request: Request, type: str | None = None):
    return templates.TemplateResponse(
        request,
        "pages/signup.html",
        {
            "tenant_types": TENANT_TYPE_DISPLAY,
            "form": {"tenant_type": type or "clinic"},
            "error": None,
            **_turnstile_ctx(),
        },
    )


def _render_error(request, form_values, error: str, status_code: int = 400):
    return templates.TemplateResponse(
        request,
        "pages/signup.html",
        {
            "tenant_types": TENANT_TYPE_DISPLAY,
            "form": form_values,
            "error": error,
            **_turnstile_ctx(),
        },
        status_code=status_code,
    )


@router.post("/signup")
def signup_submit(
    request: Request,
    db: DbSession,
    business_name: Annotated[str, Form()],
    tenant_type: Annotated[str, Form()],
    admin_name: Annotated[str, Form()],
    admin_mobile: Annotated[str, Form()],
    password: Annotated[str, Form()],
    password_confirm: Annotated[str, Form()],
    # Honeypot — a hidden field humans never see. Bots that auto-fill every
    # input will trip it. We silently 200 back to "/" so they don't realize.
    company: Annotated[str, Form()] = "",
    # Cloudflare Turnstile token (only present when enabled).
    cf_turnstile_response: Annotated[str, Form(alias="cf-turnstile-response")] = "",
):
    form_values = {
        "business_name": business_name,
        "tenant_type": tenant_type,
        "admin_name": admin_name,
        "admin_mobile": admin_mobile,
    }

    # 1) Honeypot trip — silently pretend success without doing anything.
    if company.strip():
        return RedirectResponse(url="/", status_code=303)

    # 2) Per-IP rate limit (fails open if DB is unhappy).
    ip = _client_ip(request)
    if not allow_signup(db, ip=ip):
        return _render_error(
            request,
            form_values,
            "Too many signups from your network. Please try again in an hour.",
            status_code=429,
        )

    # 3) Turnstile bot challenge (skipped if not configured).
    if not verify_turnstile(cf_turnstile_response, remote_ip=ip):
        return _render_error(request, form_values, "Please complete the verification.")

    # 4) Password match + strength.
    if password != password_confirm:
        return _render_error(request, form_values, "Passwords don't match.")
    if not _PASSWORD_RX.match(password):
        return _render_error(
            request,
            form_values,
            "Password must be at least 8 characters and contain both letters and numbers.",
        )

    # 5) Now the actual signup.
    try:
        clinic, user = signup_tenant(
            db,
            business_name=business_name,
            tenant_type=tenant_type,
            admin_name=admin_name,
            admin_mobile=admin_mobile,
            password=password,
        )
        user.last_login_at = now_utc()
        db.add(user)
        db.commit()
    except SignupError as e:
        db.rollback()
        return _render_error(request, form_values, str(e))

    # Auto-login: issue the session cookie and drop the new doctor on the setup wizard.
    token, max_age = issue_session_token(user.id, user.role)
    resp = RedirectResponse(url="/setup", status_code=303)
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
