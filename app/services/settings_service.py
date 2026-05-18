import secrets
import string

from sqlmodel import Session, select

from app.models import Clinic, User, UserRole
from app.services.auth import hash_password, normalize_mobile


class SettingsError(ValueError):
    """Validation failure during settings changes."""


def update_clinic_config(
    db: Session,
    *,
    clinic_id: int,
    name: str,
    slot_length_min: int,
    no_show_threshold_min: int,
    morning_start: str,
    morning_end: str,
    evening_start: str,
    evening_end: str,
) -> Clinic:
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise SettingsError("Clinic not found.")

    if not (10 <= slot_length_min <= 60):
        raise SettingsError("Slot length must be between 10 and 60 minutes.")
    if not (10 <= no_show_threshold_min <= 180):
        raise SettingsError("No-show threshold must be between 10 and 180 minutes.")
    if not name.strip():
        raise SettingsError("Clinic name is required.")

    def _valid_time(s: str) -> bool:
        try:
            h, m = s.split(":")
            return 0 <= int(h) <= 23 and 0 <= int(m) <= 59
        except (ValueError, AttributeError):
            return False

    for label, value in [
        ("morning start", morning_start),
        ("morning end", morning_end),
        ("evening start", evening_start),
        ("evening end", evening_end),
    ]:
        if value and not _valid_time(value):
            raise SettingsError(f"Invalid {label}: use HH:MM (24h).")

    hours = {}
    if morning_start and morning_end:
        hours["morning"] = {"start": morning_start, "end": morning_end}
    if evening_start and evening_end:
        hours["evening"] = {"start": evening_start, "end": evening_end}
    if not hours:
        raise SettingsError("Set at least one shift (morning or evening).")

    clinic.name = name.strip()
    clinic.slot_length_min = slot_length_min
    clinic.no_show_threshold_min = no_show_threshold_min
    clinic.opening_hours = hours
    db.add(clinic)
    return clinic


def list_clinic_users(db: Session, clinic_id: int) -> list[User]:
    return db.exec(
        select(User).where(User.clinic_id == clinic_id).order_by(User.role, User.name)
    ).all()


def _gen_password(n: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def add_receptionist(
    db: Session, *, clinic_id: int, name: str, mobile: str
) -> tuple[User, str]:
    name = name.strip()
    if not name:
        raise SettingsError("Name is required.")
    norm = normalize_mobile(mobile)
    if not norm:
        raise SettingsError("Enter a valid 10-digit mobile.")
    existing = db.exec(
        select(User).where(User.clinic_id == clinic_id, User.mobile == norm)
    ).first()
    if existing:
        raise SettingsError(f"A user with mobile {norm} already exists in this clinic.")

    password = _gen_password()
    user = User(
        clinic_id=clinic_id,
        role=UserRole.receptionist,
        mobile=norm,
        password_hash=hash_password(password),
        name=name,
    )
    db.add(user)
    db.flush()
    return user, password


def reset_user_password(db: Session, *, clinic_id: int, user_id: int) -> tuple[User, str]:
    user = db.get(User, user_id)
    if not user or user.clinic_id != clinic_id:
        raise SettingsError("User not found.")
    password = _gen_password()
    user.password_hash = hash_password(password)
    user.active = True
    db.add(user)
    return user, password


def deactivate_user(db: Session, *, clinic_id: int, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user or user.clinic_id != clinic_id:
        raise SettingsError("User not found.")
    if user.role == UserRole.doctor:
        raise SettingsError("Cannot deactivate the doctor account from this UI.")
    user.active = False
    db.add(user)
    return user
