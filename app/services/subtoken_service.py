from sqlalchemy import func
from sqlmodel import Session, select

from app.models import Booking, BookingStatus, SubToken, SubTokenStatus
from app.time_utils import now_utc

MAX_SUB_TOKENS = 5


class SubTokenError(ValueError):
    """Invalid sub-token operation."""


def _load_booking(db: Session, booking_id: int, clinic_id: int) -> Booking:
    booking = db.get(Booking, booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise SubTokenError("Parent booking not found.")
    if booking.status in (BookingStatus.cancelled, BookingStatus.no_show):
        raise SubTokenError("Cannot add sub-tokens to a cancelled or no-show booking.")
    return booking


def _next_suffix(db: Session, booking_id: int) -> int:
    max_suffix = db.exec(
        select(func.max(SubToken.suffix)).where(SubToken.booking_id == booking_id)
    ).one()
    return (max_suffix or 0) + 1


def add_sub_token(
    db: Session, *, clinic_id: int, booking_id: int, name: str, reason: str | None
) -> SubToken:
    name = (name or "").strip()
    if not name or len(name) > 80:
        raise SubTokenError("Name is required (max 80 characters).")
    if reason and len(reason) > 200:
        raise SubTokenError("Reason must be 200 characters or fewer.")

    booking = _load_booking(db, booking_id, clinic_id)
    if booking.status == BookingStatus.done:
        # PRD allows adding sub-tokens mid-consult only — once parent is done and
        # there are no more pending sub-tokens, the group has closed.
        pending = db.exec(
            select(SubToken).where(
                SubToken.booking_id == booking.id,
                SubToken.status.in_([SubTokenStatus.booked, SubTokenStatus.in_consult]),
            )
        ).first()
        if not pending:
            raise SubTokenError("This booking is finished — start a new booking instead.")

    suffix = _next_suffix(db, booking.id)
    if suffix > MAX_SUB_TOKENS:
        raise SubTokenError(f"A booking can have at most {MAX_SUB_TOKENS} sub-tokens.")

    sub = SubToken(
        booking_id=booking.id,
        suffix=suffix,
        name=name,
        reason=reason or None,
        status=SubTokenStatus.booked,
        created_at=now_utc(),
    )
    db.add(sub)
    db.flush()
    return sub


def cancel_sub_token(db: Session, *, clinic_id: int, sub_token_id: int) -> SubToken:
    sub = db.get(SubToken, sub_token_id)
    if not sub:
        raise SubTokenError("Sub-token not found.")
    booking = db.get(Booking, sub.booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise SubTokenError("Sub-token not found.")
    if sub.status in (SubTokenStatus.done, SubTokenStatus.cancelled, SubTokenStatus.no_show):
        raise SubTokenError("This sub-token is already closed.")
    sub.status = SubTokenStatus.cancelled
    sub.cancelled_at = now_utc()
    db.add(sub)
    return sub


def mark_sub_token_done(
    db: Session, *, clinic_id: int, sub_token_id: int
) -> tuple[SubToken, Booking]:
    sub = db.get(SubToken, sub_token_id)
    if not sub:
        raise SubTokenError("Sub-token not found.")
    booking = db.get(Booking, sub.booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise SubTokenError("Sub-token not found.")
    if sub.status != SubTokenStatus.in_consult:
        raise SubTokenError("Only the currently-consulting sub-token can be marked done.")
    sub.status = SubTokenStatus.done
    sub.completed_at = now_utc()
    db.add(sub)
    return sub, booking


def next_pending_sub_token(db: Session, booking_id: int) -> SubToken | None:
    """Lowest-suffix sub-token still booked, in token order."""
    return db.exec(
        select(SubToken)
        .where(SubToken.booking_id == booking_id, SubToken.status == SubTokenStatus.booked)
        .order_by(SubToken.suffix)
    ).first()


def current_in_consult_sub_token(db: Session, clinic_id: int) -> SubToken | None:
    """Find the sub-token currently in-consult across all bookings in the clinic today."""
    row = db.exec(
        select(SubToken)
        .join(Booking, Booking.id == SubToken.booking_id)
        .where(
            Booking.clinic_id == clinic_id,
            SubToken.status == SubTokenStatus.in_consult,
        )
    ).first()
    return row
