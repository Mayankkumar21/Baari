from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import select

from app.deps import CurrentUser, DbSession
from app.models import Booking, BookingStatus, Clinic, Patient
from app.services.booking_service import (
    BookingError,
    available_slots,
    create_booking,
    get_taken_slots,
)
from app.services.notifications import notify_booking_confirmed
from app.services.queue_service import build_board
from app.templating import templates
from app.time_utils import clinic_today, now_utc

router = APIRouter()


def _load_clinic(db, clinic_id: int) -> Clinic:
    clinic = db.get(Clinic, clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.get("/bookings/new")
def new_booking_page(request: Request, db: DbSession, user: CurrentUser):
    clinic = _load_clinic(db, user.clinic_id)
    today = clinic_today()
    taken = get_taken_slots(db, clinic.id, today)
    slots = available_slots(clinic, today, taken)
    return templates.TemplateResponse(
        request,
        "pages/new_booking.html",
        {
            "active": "queue",
            "current_user": user,
            "slots": slots,
            "form": {},
            "error": None,
        },
    )


@router.post("/bookings")
def submit_booking(
    request: Request,
    db: DbSession,
    user: CurrentUser,
    name: Annotated[str, Form()],
    mobile: Annotated[str, Form()],
    slot_time: Annotated[str, Form()],
    is_new: Annotated[str, Form()] = "new",
    party_size: Annotated[int, Form()] = 1,
    reason: Annotated[str, Form()] = "",
    whatsapp_opt_out: Annotated[str, Form()] = "",
):
    clinic = _load_clinic(db, user.clinic_id)
    form_values = {
        "name": name, "mobile": mobile, "slot_time": slot_time,
        "is_new": is_new, "party_size": party_size, "reason": reason,
        "whatsapp_opt_out": bool(whatsapp_opt_out),
    }

    try:
        parsed_slot = datetime.fromisoformat(slot_time)
    except ValueError:
        parsed_slot = None

    if not parsed_slot:
        return _render_form(request, db, user, clinic, form_values, "Pick a valid slot time.")

    # Form sends aware-IST slot. Normalize to naive UTC for storage so it lines
    # up with every other datetime column (now_utc() also writes naive UTC once
    # the DB strips tzinfo on a TIMESTAMP-without-tz column).
    if parsed_slot.tzinfo is not None:
        parsed_slot = parsed_slot.astimezone(UTC).replace(tzinfo=None)

    try:
        booking = create_booking(
            db,
            clinic=clinic,
            created_by_user_id=user.id,
            name=name,
            mobile=mobile,
            slot_time=parsed_slot,
            reason=reason or None,
            is_new=(is_new == "new"),
            party_size=int(party_size),
            whatsapp_opt_out=bool(whatsapp_opt_out),
        )
        patient = db.get(Patient, booking.patient_id)
        if patient:
            notify_booking_confirmed(db, clinic=clinic, booking=booking, patient=patient)
        db.commit()
    except BookingError as e:
        db.rollback()
        return _render_form(request, db, user, clinic, form_values, str(e))

    return RedirectResponse(url="/queue", status_code=303)


def _render_form(request, db, user, clinic, form_values, error):
    today = clinic_today()
    taken = get_taken_slots(db, clinic.id, today)
    slots = available_slots(clinic, today, taken)
    return templates.TemplateResponse(
        request,
        "pages/new_booking.html",
        {
            "active": "queue",
            "current_user": user,
            "slots": slots,
            "form": form_values,
            "error": error,
        },
        status_code=400,
    )
