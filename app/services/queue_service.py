from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import case
from sqlmodel import Session, select

from app.models import Booking, BookingStatus, DailySummary, Patient, SubToken, SubTokenStatus
from app.services.subtoken_service import (
    current_in_consult_sub_token,
    next_pending_sub_token,
)
from app.time_utils import clinic_today, now_utc


# Undo window for "Mark Done" — matches PRD §3.6 (30s amber undo strip)
UNDO_WINDOW = timedelta(seconds=30)


class QueueActionError(ValueError):
    """Invalid queue state transition."""


@dataclass
class SubTokenVM:
    sub_token: SubToken
    label: str  # e.g. "T5.1"


@dataclass
class QueueRowVM:
    booking: Booking
    patient: Patient
    sub_tokens: list[SubToken]
    label: str  # "T5"
    is_late: bool
    is_undoable: bool = False
    pending_sub_count: int = 0


@dataclass
class NowConsultingVM:
    label: str            # "T5" or "T5.1"
    patient_name: str
    reason: str | None
    booking: Booking
    sub_token: SubToken | None  # None when the parent is being consulted
    pending_subs: list[SubTokenVM] = field(default_factory=list)


@dataclass
class QueueBoardVM:
    now_consulting: NowConsultingVM | None
    waiting: list[QueueRowVM]
    done: list[QueueRowVM]
    counters: dict[str, int]
    generated_at: datetime
    is_closed: bool = False
    summary: DailySummary | None = None


def _label(token: int, suffix: int | None = None) -> str:
    base = f"T{token}"
    return f"{base}.{suffix}" if suffix else base


# ─────────────────────────────────────────────────────────────────────────────
# Lookups
# ─────────────────────────────────────────────────────────────────────────────


def _load_booking(db: Session, booking_id: int, clinic_id: int) -> Booking:
    booking = db.get(Booking, booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise QueueActionError("Booking not found.")
    return booking


def _current_in_consult_booking(db: Session, clinic_id: int) -> Booking | None:
    today = clinic_today()
    return db.exec(
        select(Booking).where(
            Booking.clinic_id == clinic_id,
            Booking.date == today,
            Booking.status == BookingStatus.in_consult,
        )
    ).first()


def _anyone_in_consult(db: Session, clinic_id: int) -> bool:
    if _current_in_consult_booking(db, clinic_id):
        return True
    return current_in_consult_sub_token(db, clinic_id) is not None


def _next_checked_in(db: Session, clinic_id: int) -> Booking | None:
    today = clinic_today()
    return db.exec(
        select(Booking)
        .where(
            Booking.clinic_id == clinic_id,
            Booking.date == today,
            Booking.status == BookingStatus.checked_in,
        )
        .order_by(
            case((Booking.restored_at.is_(None), 0), else_=1),
            Booking.restored_at,
            Booking.token,
        )
    ).first()


# ─────────────────────────────────────────────────────────────────────────────
# Auto-promotion
# ─────────────────────────────────────────────────────────────────────────────


def _try_promote_within_group(db: Session, booking_id: int) -> SubToken | None:
    sub = next_pending_sub_token(db, booking_id)
    if not sub:
        return None
    sub.status = SubTokenStatus.in_consult
    sub.started_at = now_utc()
    db.add(sub)
    return sub


def _try_promote_next_booking(db: Session, clinic_id: int) -> Booking | None:
    if _anyone_in_consult(db, clinic_id):
        return None
    nxt = _next_checked_in(db, clinic_id)
    if not nxt:
        return None
    nxt.status = BookingStatus.in_consult
    nxt.started_at = now_utc()
    nxt.updated_at = now_utc()
    db.add(nxt)
    return nxt


# ─────────────────────────────────────────────────────────────────────────────
# Actions
# ─────────────────────────────────────────────────────────────────────────────


def check_in(db: Session, clinic_id: int, booking_id: int) -> tuple[Booking, Booking | None]:
    booking = _load_booking(db, booking_id, clinic_id)
    if booking.status != BookingStatus.booked:
        raise QueueActionError(f"Cannot check in — booking is {booking.status.value}.")
    booking.status = BookingStatus.checked_in
    booking.checked_in_at = now_utc()
    booking.updated_at = now_utc()
    db.add(booking)
    promoted = _try_promote_next_booking(db, clinic_id)
    return booking, promoted


def mark_done(db: Session, clinic_id: int, booking_id: int) -> tuple[Booking, Booking | None]:
    """Mark the parent booking done. Auto-advances to a sub-token if any pending,
    else to the next checked-in booking. Returns (booking, promoted_booking_or_None)."""
    booking = _load_booking(db, booking_id, clinic_id)
    if booking.status != BookingStatus.in_consult:
        raise QueueActionError("Only the current in-consult booking can be marked done.")
    booking.status = BookingStatus.done
    booking.completed_at = now_utc()
    booking.updated_at = now_utc()
    db.add(booking)

    sub_promoted = _try_promote_within_group(db, booking.id)
    promoted_booking = None if sub_promoted else _try_promote_next_booking(db, clinic_id)
    return booking, promoted_booking


def mark_sub_done(db: Session, clinic_id: int, sub_token_id: int) -> tuple[SubToken, Booking | None]:
    sub = db.get(SubToken, sub_token_id)
    if not sub:
        raise QueueActionError("Sub-token not found.")
    booking = db.get(Booking, sub.booking_id)
    if not booking or booking.clinic_id != clinic_id:
        raise QueueActionError("Sub-token not found.")
    if sub.status != SubTokenStatus.in_consult:
        raise QueueActionError("Only the currently-consulting sub-token can be marked done.")
    sub.status = SubTokenStatus.done
    sub.completed_at = now_utc()
    db.add(sub)

    sub_promoted = _try_promote_within_group(db, booking.id)
    promoted_booking = None if sub_promoted else _try_promote_next_booking(db, clinic_id)
    return sub, promoted_booking


def restore_no_show(db: Session, clinic_id: int, booking_id: int) -> tuple[Booking, Booking | None]:
    """Bring a no-show booking back into the queue at the END (PRD §10.5).

    Original token is retained. The patient is placed in checked_in state so the
    receptionist doesn't need to re-check them in."""
    booking = _load_booking(db, booking_id, clinic_id)
    if booking.status != BookingStatus.no_show:
        raise QueueActionError("Only a no-show booking can be restored.")
    booking.status = BookingStatus.checked_in
    booking.no_show_at = None
    booking.restored_at = now_utc()
    booking.checked_in_at = booking.checked_in_at or now_utc()
    booking.updated_at = now_utc()
    db.add(booking)
    promoted = _try_promote_next_booking(db, clinic_id)
    return booking, promoted


def undo_done(db: Session, clinic_id: int, booking_id: int) -> Booking:
    booking = _load_booking(db, booking_id, clinic_id)
    if booking.status != BookingStatus.done:
        raise QueueActionError("This booking isn't in a done state.")
    now_naive = now_utc().replace(tzinfo=None)
    if not booking.completed_at or now_naive - booking.completed_at > UNDO_WINDOW:
        raise QueueActionError("Undo window has expired.")
    # Reverse any auto-promotions that happened after this completion
    current_booking = _current_in_consult_booking(db, clinic_id)
    if current_booking and current_booking.id != booking.id:
        current_booking.status = BookingStatus.checked_in
        current_booking.started_at = None
        current_booking.updated_at = now_utc()
        db.add(current_booking)
    current_sub = current_in_consult_sub_token(db, clinic_id)
    if current_sub:
        current_sub.status = SubTokenStatus.booked
        current_sub.started_at = None
        db.add(current_sub)

    booking.status = BookingStatus.in_consult
    booking.completed_at = None
    booking.updated_at = now_utc()
    db.add(booking)
    return booking


# ─────────────────────────────────────────────────────────────────────────────
# Board view-model
# ─────────────────────────────────────────────────────────────────────────────


def build_board(db: Session, clinic_id: int) -> QueueBoardVM:
    today = clinic_today()
    # DB columns are naive TIMESTAMP today; strip tz from `now` so comparisons match.
    # TODO: migrate datetime columns to TIMESTAMPTZ and use aware throughout.
    now = now_utc().replace(tzinfo=None)

    bookings = db.exec(
        select(Booking)
        .where(Booking.clinic_id == clinic_id, Booking.date == today)
        .order_by(Booking.token)
    ).all()

    patient_ids = {b.patient_id for b in bookings}
    patients_by_id: dict[int, Patient] = {}
    if patient_ids:
        rows = db.exec(select(Patient).where(Patient.id.in_(patient_ids))).all()
        patients_by_id = {p.id: p for p in rows}

    booking_ids = [b.id for b in bookings]
    subs_by_booking: dict[int, list[SubToken]] = {bid: [] for bid in booking_ids}
    if booking_ids:
        rows = db.exec(
            select(SubToken)
            .where(SubToken.booking_id.in_(booking_ids))
            .order_by(SubToken.suffix)
        ).all()
        for s in rows:
            subs_by_booking.setdefault(s.booking_id, []).append(s)

    now_consulting: NowConsultingVM | None = None
    waiting: list[QueueRowVM] = []
    done: list[QueueRowVM] = []

    counters = {"booked": 0, "waiting": 0, "done": 0, "no_show": 0}

    for b in bookings:
        p = patients_by_id.get(b.patient_id)
        if not p:
            continue
        subs = subs_by_booking.get(b.id, [])

        is_late = (
            b.status in (BookingStatus.booked, BookingStatus.checked_in)
            and (now - b.slot_time).total_seconds() >= 15 * 60
        )
        is_undoable = (
            b.status == BookingStatus.done
            and b.completed_at is not None
            and (now - b.completed_at) <= UNDO_WINDOW
        )
        pending_sub_count = sum(1 for s in subs if s.status == SubTokenStatus.booked)

        vm = QueueRowVM(
            booking=b,
            patient=p,
            sub_tokens=subs,
            label=_label(b.token),
            is_late=is_late,
            is_undoable=is_undoable,
            pending_sub_count=pending_sub_count,
        )

        # Parent currently in consult
        if b.status == BookingStatus.in_consult:
            now_consulting = NowConsultingVM(
                label=_label(b.token),
                patient_name=p.name,
                reason=b.reason,
                booking=b,
                sub_token=None,
                pending_subs=[
                    SubTokenVM(sub_token=s, label=_label(b.token, s.suffix))
                    for s in subs if s.status == SubTokenStatus.booked
                ],
            )
        else:
            # Sub-token currently in consult under this parent (parent is done)?
            active_sub = next((s for s in subs if s.status == SubTokenStatus.in_consult), None)
            if active_sub:
                now_consulting = NowConsultingVM(
                    label=_label(b.token, active_sub.suffix),
                    patient_name=active_sub.name,
                    reason=active_sub.reason,
                    booking=b,
                    sub_token=active_sub,
                    pending_subs=[
                        SubTokenVM(sub_token=s, label=_label(b.token, s.suffix))
                        for s in subs if s.status == SubTokenStatus.booked
                    ],
                )

        # Buckets for waiting and done lists
        if b.status in (BookingStatus.booked, BookingStatus.checked_in):
            waiting.append(vm)
            counters["waiting"] += 1
        elif b.status == BookingStatus.done and not any(
            s.status in (SubTokenStatus.in_consult, SubTokenStatus.booked) for s in subs
        ):
            done.append(vm)
            counters["done"] += 1
        elif b.status == BookingStatus.no_show:
            counters["no_show"] += 1
            done.append(vm)
        elif b.status == BookingStatus.done:
            # Parent done but sub-tokens still progressing — show as the active group
            # but don't double-count.
            pass

        if b.status != BookingStatus.cancelled:
            counters["booked"] += 1

    # Restored patients sort to the end of the waiting list (PRD §10.5)
    waiting.sort(
        key=lambda r: (
            r.booking.restored_at is not None,
            r.booking.restored_at or datetime.min.replace(tzinfo=now.tzinfo),
            r.booking.token,
        )
    )

    # Day-closed check (read-only banner if a DailySummary exists with closed_at)
    from app.services.day_close import get_summary
    summary = get_summary(db, clinic_id, today)
    is_closed = bool(summary and summary.closed_at)

    return QueueBoardVM(
        now_consulting=now_consulting,
        waiting=waiting,
        done=done,
        counters=counters,
        generated_at=now,
        is_closed=is_closed,
        summary=summary,
    )
