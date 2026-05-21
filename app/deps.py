from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request
from sqlmodel import Session

from app.config import get_settings
from app.db import get_session
from app.models import Clinic, User, UserRole
from app.services.auth import COOKIE_NAME, decode_session_token

DbSession = Annotated[Session, Depends(get_session)]


class AuthRequired(Exception):
    """Raised when an unauthenticated user hits a protected route.

    Converted to a 303 redirect to /login by an exception handler in api/index.py."""


def current_user(
    request: Request,
    db: DbSession,
    session_token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
) -> User:
    if not session_token:
        raise AuthRequired()
    payload = decode_session_token(session_token)
    if not payload:
        raise AuthRequired()
    user = db.get(User, payload["uid"])
    if not user or not user.active:
        raise AuthRequired()
    # Stash tenant_type on the request scope so the template vocab processor can read it.
    clinic = db.get(Clinic, user.clinic_id)
    if clinic:
        request.scope["tenant_type"] = clinic.tenant_type
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def require_doctor(user: CurrentUser) -> User:
    if user.role != UserRole.doctor:
        raise HTTPException(status_code=403, detail="Doctor only")
    return user


DoctorUser = Annotated[User, Depends(require_doctor)]


def is_doctor(user: User) -> bool:
    return user.role == UserRole.doctor


def require_cron_secret(request: Request) -> None:
    auth = request.headers.get("authorization", "")
    expected = f"Bearer {get_settings().cron_secret}"
    if auth != expected:
        raise HTTPException(status_code=401)
