from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, Request

from app.deps import DbSession, DoctorUser
from app.models import Clinic
from app.services.settings_service import (
    SettingsError,
    add_receptionist,
    deactivate_user,
    list_clinic_users,
    reset_user_password,
    update_clinic_config,
)
from app.templating import templates

router = APIRouter()

_DEFAULT_HOURS = {"morning": {"start": "10:00", "end": "13:00"}, "evening": {"start": "17:00", "end": "21:00"}}


def _render(request, db, user, clinic, *, success=None, error=None, flash_password=None):
    users = list_clinic_users(db, clinic.id)
    hours = clinic.opening_hours or _DEFAULT_HOURS
    return templates.TemplateResponse(
        request,
        "pages/settings.html",
        {
            "active": "settings",
            "current_user": user,
            "clinic": clinic,
            "hours": hours,
            "users": users,
            "success": success,
            "error": error,
            "flash_password": flash_password,
        },
    )


@router.get("/settings")
def settings_page(request: Request, db: DbSession, user: DoctorUser):
    clinic = db.get(Clinic, user.clinic_id)
    return _render(request, db, user, clinic)


@router.post("/settings/clinic")
def post_update_clinic(
    request: Request,
    db: DbSession,
    user: DoctorUser,
    name: Annotated[str, Form()],
    slot_length_min: Annotated[int, Form()],
    no_show_threshold_min: Annotated[int, Form()],
    morning_start: Annotated[str, Form()] = "",
    morning_end: Annotated[str, Form()] = "",
    evening_start: Annotated[str, Form()] = "",
    evening_end: Annotated[str, Form()] = "",
):
    clinic = db.get(Clinic, user.clinic_id)
    try:
        update_clinic_config(
            db,
            clinic_id=user.clinic_id,
            name=name,
            slot_length_min=slot_length_min,
            no_show_threshold_min=no_show_threshold_min,
            morning_start=morning_start,
            morning_end=morning_end,
            evening_start=evening_start,
            evening_end=evening_end,
        )
        db.commit()
    except SettingsError as e:
        db.rollback()
        return _render(request, db, user, clinic, error=str(e))
    db.refresh(clinic)
    return _render(request, db, user, clinic, success="Clinic settings saved.")


@router.post("/settings/users")
def post_add_receptionist(
    request: Request,
    db: DbSession,
    user: DoctorUser,
    name: Annotated[str, Form()],
    mobile: Annotated[str, Form()],
):
    clinic = db.get(Clinic, user.clinic_id)
    try:
        new_user, password = add_receptionist(db, clinic_id=user.clinic_id, name=name, mobile=mobile)
        db.commit()
    except SettingsError as e:
        db.rollback()
        return _render(request, db, user, clinic, error=str(e))
    return _render(
        request, db, user, clinic,
        success=f"Receptionist {new_user.name} added (mobile {new_user.mobile}).",
        flash_password=password,
    )


@router.post("/settings/users/{user_id}/reset")
def post_reset_password(
    request: Request, db: DbSession, user: DoctorUser, user_id: int
):
    clinic = db.get(Clinic, user.clinic_id)
    try:
        target, password = reset_user_password(db, clinic_id=user.clinic_id, user_id=user_id)
        db.commit()
    except SettingsError as e:
        db.rollback()
        return _render(request, db, user, clinic, error=str(e))
    return _render(
        request, db, user, clinic,
        success=f"Password reset for {target.name}.",
        flash_password=password,
    )


@router.post("/settings/users/{user_id}/deactivate")
def post_deactivate_user(
    request: Request, db: DbSession, user: DoctorUser, user_id: int
):
    clinic = db.get(Clinic, user.clinic_id)
    try:
        deactivate_user(db, clinic_id=user.clinic_id, user_id=user_id)
        db.commit()
    except SettingsError as e:
        db.rollback()
        return _render(request, db, user, clinic, error=str(e))
    return _render(request, db, user, clinic, success="User deactivated.")
