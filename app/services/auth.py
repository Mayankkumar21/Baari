import re
from datetime import timedelta

import jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.models import UserRole
from app.time_utils import now_utc

COOKIE_NAME = "baari_session"
_settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

_SESSION_DAYS = {UserRole.doctor: 7, UserRole.receptionist: 30}

# Indian mobile: 10 digits, optionally +91 or 0 prefixed. Stored as 10 digits.
_MOBILE_RE = re.compile(r"^(?:\+?91|0)?(\d{10})$")


def normalize_mobile(raw: str) -> str | None:
    if not raw:
        return None
    cleaned = re.sub(r"[\s-]", "", raw.strip())
    m = _MOBILE_RE.match(cleaned)
    return m.group(1) if m else None


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plain, hashed)
    except ValueError:
        return False


def issue_session_token(user_id: int, role: UserRole) -> tuple[str, int]:
    days = _SESSION_DAYS[role]
    exp = now_utc() + timedelta(days=days)
    payload = {"uid": user_id, "role": role.value, "exp": int(exp.timestamp())}
    token = jwt.encode(payload, _settings.jwt_secret, algorithm="HS256")
    return token, days * 24 * 60 * 60


def decode_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, _settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
