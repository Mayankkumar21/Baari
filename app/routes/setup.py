from typing import Annotated

from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse

from app.deps import DbSession, DoctorUser
from app.models import Clinic
from app.services.settings_service import SettingsError, update_clinic_config
from app.templating import templates

router = APIRouter()


@router.get("/setup")
def setup_page(request: Request, db: DbSession, user: DoctorUser):
    clinic = db.get(Clinic, user.clinic_id)
    if clinic.setup_complete:
        return RedirectResponse(url="/queue", status_code=303)
    hours = clinic.opening_hours or {
        "morning": {"start": "10:00", "end": "13:00"},
        "evening": {"start": "17:00", "end": "21:00"},
    }
    return templates.TemplateResponse(
        request,
        "pages/setup.html",
        {"current_user": user, "clinic": clinic, "hours": hours, "error": None},
    )


@router.post("/setup")
def post_setup(
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
        clinic.setup_complete = True
        db.add(clinic)
        db.commit()
    except SettingsError as e:
        db.rollback()
        hours = {
            "morning": {"start": morning_start, "end": morning_end},
            "evening": {"start": evening_start, "end": evening_end},
        }
        return templates.TemplateResponse(
            request,
            "pages/setup.html",
            {"current_user": user, "clinic": clinic, "hours": hours, "error": str(e)},
            status_code=400,
        )
    return RedirectResponse(url="/queue", status_code=303)
