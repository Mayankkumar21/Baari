from dataclasses import dataclass
from datetime import date, timedelta

from sqlmodel import Session, select

from app.models import Booking, Patient
from app.time_utils import clinic_today


@dataclass
class SearchHit:
    booking: Booking
    patient: Patient
    is_today: bool


PAST_WINDOW_DAYS = 60
MAX_RESULTS = 20


def _is_token_query(q: str) -> int | None:
    """Accepts 'T5', 't5', or '5' as a token query (parent token only — sub-token search would need
    a richer parser; defer until needed)."""
    cleaned = q.strip().lstrip("Tt").lstrip("#")
    if cleaned.isdigit():
        return int(cleaned)
    return None


def search_bookings(db: Session, clinic_id: int, q: str) -> list[SearchHit]:
    q = (q or "").strip()
    if len(q) < 2:
        return []

    today = clinic_today()
    cutoff = today - timedelta(days=PAST_WINDOW_DAYS)

    token = _is_token_query(q)
    digits = "".join(ch for ch in q if ch.isdigit())
    last4 = digits[-4:] if len(digits) >= 4 else None

    name_like = f"%{q}%"

    # Build candidate patient ids matching name / mobile fuzzy
    patient_stmt = select(Patient).where(
        Patient.clinic_id == clinic_id,
        Patient.anonymized_at.is_(None),
    )
    if digits and len(digits) >= 4:
        patient_stmt = patient_stmt.where(Patient.mobile.like(f"%{digits}%"))
    else:
        patient_stmt = patient_stmt.where(Patient.name.ilike(name_like))

    patients = db.exec(patient_stmt.limit(MAX_RESULTS * 2)).all()
    patient_ids = [p.id for p in patients]
    patients_by_id = {p.id: p for p in patients}

    booking_stmt = (
        select(Booking)
        .where(Booking.clinic_id == clinic_id, Booking.date >= cutoff)
        .order_by(Booking.date.desc(), Booking.token)
        .limit(MAX_RESULTS * 2)
    )
    if token is not None and not last4:
        booking_stmt = booking_stmt.where(Booking.token == token)
    elif patient_ids:
        booking_stmt = booking_stmt.where(Booking.patient_id.in_(patient_ids))
    else:
        return []

    bookings = db.exec(booking_stmt).all()

    # Fetch any patients we didn't already load (token-only search path)
    missing = {b.patient_id for b in bookings if b.patient_id not in patients_by_id}
    if missing:
        more = db.exec(select(Patient).where(Patient.id.in_(missing))).all()
        patients_by_id.update({p.id: p for p in more})

    hits: list[SearchHit] = []
    for b in bookings:
        p = patients_by_id.get(b.patient_id)
        if not p:
            continue
        hits.append(SearchHit(booking=b, patient=p, is_today=(b.date == today)))

    hits.sort(key=lambda h: (not h.is_today, -h.booking.date.toordinal(), h.booking.token))
    return hits[:MAX_RESULTS]
