from typing import Annotated

from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.deps import DbSession
from app.services.auth import COOKIE_NAME, issue_session_token
from app.services.signup_service import SignupError, signup_tenant
from app.templating import templates
from app.time_utils import now_utc
from app.vocab import TENANT_TYPE_DISPLAY

router = APIRouter()


@router.get("/")
def landing(request: Request):
    return templates.TemplateResponse(
        request,
        "pages/landing.html",
        {"tenant_types": TENANT_TYPE_DISPLAY},
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
        },
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
):
    form_values = {
        "business_name": business_name,
        "tenant_type": tenant_type,
        "admin_name": admin_name,
        "admin_mobile": admin_mobile,
    }

    if password != password_confirm:
        return templates.TemplateResponse(
            request,
            "pages/signup.html",
            {
                "tenant_types": TENANT_TYPE_DISPLAY,
                "form": form_values,
                "error": "Passwords don't match.",
            },
            status_code=400,
        )

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
        return templates.TemplateResponse(
            request,
            "pages/signup.html",
            {
                "tenant_types": TENANT_TYPE_DISPLAY,
                "form": form_values,
                "error": str(e),
            },
            status_code=400,
        )

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
