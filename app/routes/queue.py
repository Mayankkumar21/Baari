from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, Request

from app.deps import CurrentUser, DbSession, DoctorUser
from app.models import Booking, Clinic, Patient
from app.services.day_close import close_day
from app.services.notifications import notify_restored, notify_youre_next
from app.services.queue_service import (
    QueueActionError,
    build_board,
    check_in,
    mark_done,
    mark_sub_done,
    restore_no_show,
    undo_done,
)
from app.services.subtoken_service import (
    SubTokenError,
    add_sub_token,
    cancel_sub_token,
)
from app.templating import templates


def _notify_promoted(db, clinic_id: int, promoted: Booking | None) -> None:
    if not promoted:
        return
    clinic = db.get(Clinic, clinic_id)
    patient = db.get(Patient, promoted.patient_id)
    if clinic and patient:
        notify_youre_next(db, clinic=clinic, booking=promoted, patient=patient)

router = APIRouter()


def _render_board(request, db, user, status: int = 200):
    board = build_board(db, user.clinic_id)
    return templates.TemplateResponse(
        request,
        "partials/queue_board.html",
        {"current_user": user, "board": board},
        status_code=status,
    )


@router.get("/queue")
def queue_page(request: Request, db: DbSession, user: CurrentUser):
    board = build_board(db, user.clinic_id)
    return templates.TemplateResponse(
        request,
        "pages/queue.html",
        {"active": "queue", "current_user": user, "board": board},
    )


@router.get("/queue/board")
def queue_board_partial(request: Request, db: DbSession, user: CurrentUser):
    return _render_board(request, db, user)


@router.post("/queue/{booking_id}/check-in")
def post_check_in(request: Request, db: DbSession, user: CurrentUser, booking_id: int):
    try:
        _, promoted = check_in(db, user.clinic_id, booking_id)
        _notify_promoted(db, user.clinic_id, promoted)
        db.commit()
    except QueueActionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)


@router.post("/queue/{booking_id}/done")
def post_done(request: Request, db: DbSession, user: CurrentUser, booking_id: int):
    try:
        _, promoted = mark_done(db, user.clinic_id, booking_id)
        _notify_promoted(db, user.clinic_id, promoted)
        db.commit()
    except QueueActionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)


@router.post("/queue/{booking_id}/restore")
def post_restore(request: Request, db: DbSession, user: CurrentUser, booking_id: int):
    try:
        restored, promoted = restore_no_show(db, user.clinic_id, booking_id)
        clinic = db.get(Clinic, user.clinic_id)
        patient = db.get(Patient, restored.patient_id)
        if clinic and patient:
            notify_restored(db, clinic=clinic, booking=restored, patient=patient)
        _notify_promoted(db, user.clinic_id, promoted)
        db.commit()
    except QueueActionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)


@router.post("/queue/{booking_id}/undo-done")
def post_undo_done(request: Request, db: DbSession, user: CurrentUser, booking_id: int):
    try:
        undo_done(db, user.clinic_id, booking_id)
        db.commit()
    except QueueActionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)


@router.post("/queue/{booking_id}/sub-tokens")
def post_add_sub_token(
    request: Request,
    db: DbSession,
    user: CurrentUser,
    booking_id: int,
    name: Annotated[str, Form()],
    reason: Annotated[str, Form()] = "",
):
    try:
        add_sub_token(
            db,
            clinic_id=user.clinic_id,
            booking_id=booking_id,
            name=name,
            reason=reason or None,
        )
        db.commit()
    except SubTokenError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)


@router.post("/queue/sub-tokens/{sub_token_id}/cancel")
def post_cancel_sub_token(
    request: Request, db: DbSession, user: CurrentUser, sub_token_id: int
):
    try:
        cancel_sub_token(db, clinic_id=user.clinic_id, sub_token_id=sub_token_id)
        db.commit()
    except SubTokenError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)


@router.post("/queue/close-day")
def post_close_day(request: Request, db: DbSession, user: DoctorUser):
    close_day(db, user.clinic_id)
    db.commit()
    return _render_board(request, db, user)


@router.post("/queue/sub-tokens/{sub_token_id}/done")
def post_sub_token_done(
    request: Request, db: DbSession, user: CurrentUser, sub_token_id: int
):
    try:
        _, promoted = mark_sub_done(db, user.clinic_id, sub_token_id)
        _notify_promoted(db, user.clinic_id, promoted)
        db.commit()
    except QueueActionError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return _render_board(request, db, user)
