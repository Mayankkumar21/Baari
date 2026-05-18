from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.deps import CurrentUser, DbSession
from app.models import Booking, Clinic, Patient
from app.services.booking_service import (
    BookingError,
    available_slots,
    cancel_booking,
    get_taken_slots,
    reschedule_booking,
)
from app.services.notifications import notify_cancelled, notify_slot_changed
from app.services.search_service import search_bookings
from app.templating import templates
from app.time_utils import clinic_today

router = APIRouter()


@router.get("/search")
def search_page(request: Request, db: DbSession, user: CurrentUser, q: str = ""):
    hits = search_bookings(db, user.clinic_id, q) if q else []
    return templates.TemplateResponse(
        request,
        "pages/search.html",
        {"active": "search", "current_user": user, "q": q, "hits": hits},
    )


@router.get("/search/results")
def search_results_partial(request: Request, db: DbSession, user: CurrentUser, q: str = ""):
    hits = search_bookings(db, user.clinic_id, q)
    return templates.TemplateResponse(
        request,
        "partials/search_results.html",
        {"current_user": user, "q": q, "hits": hits},
    )


def _load_booking_and_patient(db, clinic_id, booking_id) -> tuple[Booking, Patient]:
    booking = db.get(Booking, booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    patient = db.get(Patient, booking.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return booking, patient


@router.get("/bookings/{booking_id}")
def booking_detail(request: Request, db: DbSession, user: CurrentUser, booking_id: int):
    booking, patient = _load_booking_and_patient(db, user.clinic_id, booking_id)
    clinic = db.get(Clinic, user.clinic_id)
    slots: list[datetime] = []
    if booking.date == clinic_today() and booking.status.value in ("booked", "checked_in"):
        taken = get_taken_slots(db, user.clinic_id, booking.date)
        taken.discard(booking.slot_time)
        slots = available_slots(clinic, booking.date, taken)
    return templates.TemplateResponse(
        request,
        "pages/booking_detail.html",
        {
            "active": "search",
            "current_user": user,
            "booking": booking,
            "patient": patient,
            "slots": slots,
            "error": None,
        },
    )


@router.post("/bookings/{booking_id}/reschedule")
def post_reschedule(
    request: Request,
    db: DbSession,
    user: CurrentUser,
    booking_id: int,
    new_slot_time: Annotated[str, Form()],
):
    try:
        parsed = datetime.fromisoformat(new_slot_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid slot time")
    booking = db.get(Booking, booking_id)
    if not booking or booking.clinic_id != user.clinic_id:
        raise HTTPException(status_code=404, detail="Booking not found")
    old_slot = booking.slot_time
    try:
        reschedule_booking(
            db, clinic_id=user.clinic_id, booking_id=booking_id, new_slot_time=parsed
        )
        clinic = db.get(Clinic, user.clinic_id)
        patient = db.get(Patient, booking.patient_id)
        if clinic and patient:
            notify_slot_changed(db, clinic=clinic, booking=booking, patient=patient, old_slot=old_slot)
        db.commit()
    except BookingError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return RedirectResponse(url=f"/bookings/{booking_id}", status_code=303)


@router.post("/bookings/{booking_id}/cancel")
def post_cancel(
    request: Request, db: DbSession, user: CurrentUser, booking_id: int
):
    try:
        booking = cancel_booking(db, clinic_id=user.clinic_id, booking_id=booking_id)
        clinic = db.get(Clinic, user.clinic_id)
        patient = db.get(Patient, booking.patient_id)
        if clinic and patient:
            notify_cancelled(db, clinic=clinic, booking=booking, patient=patient)
        db.commit()
    except BookingError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return RedirectResponse(url=f"/bookings/{booking_id}", status_code=303)
