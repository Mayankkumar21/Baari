"""Self-serve tenant signup.

Creates a Clinic (tenant) and its first admin user (role=doctor) atomically.
Mirrors the data into `data/signups.jsonl` as a human-readable audit ledger.

NOTE on the JSONL ledger:
- On a typical dev box this file persists across restarts in the project root.
- On Vercel serverless the runtime filesystem is read-only; only /tmp is writable,
  and it's per-instance and ephemeral. Source of truth is always Postgres.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from sqlmodel import Session, select

from app.models import Clinic, TenantType, User, UserRole
from app.services.auth import hash_password, normalize_mobile
from app.services.cred_ledger import record_credential
from app.time_utils import now_utc


class SignupError(ValueError):
    """Validation failure during self-serve signup."""


def _ledger_path() -> Path:
    # Vercel sets VERCEL=1 in the function environment.
    if os.environ.get("VERCEL"):
        return Path("/tmp/signups.jsonl")
    return Path(__file__).resolve().parent.parent.parent / "data" / "signups.jsonl"


def _append_ledger(record: dict) -> None:
    path = _ledger_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(record, separators=(",", ":")) + "\n")


def signup_tenant(
    db: Session,
    *,
    business_name: str,
    tenant_type: str,
    admin_name: str,
    admin_mobile: str,
    password: str,
) -> tuple[Clinic, User]:
    business_name = (business_name or "").strip()
    admin_name = (admin_name or "").strip()
    if not business_name:
        raise SignupError("Business name is required.")
    if len(business_name) > 120:
        raise SignupError("Business name is too long (max 120 characters).")
    if not admin_name:
        raise SignupError("Your name is required.")
    if len(admin_name) > 80:
        raise SignupError("Name is too long (max 80 characters).")

    try:
        ttype = TenantType(tenant_type)
    except ValueError:
        raise SignupError("Pick a valid business type.")

    normalized = normalize_mobile(admin_mobile)
    if not normalized:
        raise SignupError("Enter a valid 10-digit Indian mobile number.")

    if not password or len(password) < 8:
        raise SignupError("Password must be at least 8 characters.")
    if len(password) > 128:
        raise SignupError("Password is too long (max 128 characters).")

    # Mobiles are unique per clinic, but for the admin we also block re-using a
    # mobile that's already an admin somewhere — otherwise multiple signups
    # from the same number become indistinguishable at login.
    existing = db.exec(
        select(User).where(User.mobile == normalized, User.role == UserRole.doctor)
    ).first()
    if existing:
        raise SignupError(
            "This mobile is already registered as an owner. Sign in instead, or use a different number."
        )

    clinic = Clinic(name=business_name, tenant_type=ttype.value)
    db.add(clinic)
    db.flush()  # populate clinic.id

    user = User(
        clinic_id=clinic.id,
        role=UserRole.doctor,
        mobile=normalized,
        password_hash=hash_password(password),
        name=admin_name,
    )
    db.add(user)
    db.flush()  # populate user.id

    _append_ledger({
        "ts": now_utc().isoformat(),
        "clinic_id": clinic.id,
        "tenant_type": ttype.value,
        "business_name": business_name,
        "admin_user_id": user.id,
        "admin_name": admin_name,
        "admin_mobile": normalized,
    })
    record_credential(
        clinic_id=clinic.id, user_id=user.id, name=admin_name,
        mobile=normalized, role=user.role.value, password=password, event="signup",
    )

    return clinic, user
