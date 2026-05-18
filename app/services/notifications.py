"""WhatsApp dispatch via MSG91.

Each trigger maps to a pre-approved bilingual template (configured server-side on MSG91).
In dev (MSG91_AUTH_KEY empty), sends are recorded as `failed` with reason="dev-mode-skip" so
they show up in the audit/UI without an actual send.

Templates assumed (one-time setup with MSG91 BSP — names are illustrative):
    booking_confirmed   {{1}}=token  {{2}}=slot  {{3}}=clinic
    youre_next          {{1}}=token  {{2}}=clinic
    slot_changed        {{1}}=token  {{2}}=old  {{3}}=new  {{4}}=clinic
    cancelled           {{1}}=token  {{2}}=clinic
    no_show             {{1}}=token  {{2}}=clinic
    restored            {{1}}=token  {{2}}=clinic
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from sqlmodel import Session

from app.config import get_settings
from app.models import (
    Booking,
    Clinic,
    Notification,
    NotificationStatus,
    NotificationTrigger,
    Patient,
)
from app.time_utils import fmt_time, now_utc

logger = logging.getLogger(__name__)

MSG91_ENDPOINT = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/"
TIMEOUT_SECONDS = 8.0


TEMPLATE_FOR_TRIGGER: dict[NotificationTrigger, str] = {
    NotificationTrigger.booking_confirmed: "booking_confirmed",
    NotificationTrigger.youre_next: "youre_next",
    NotificationTrigger.slot_changed: "slot_changed",
    NotificationTrigger.cancelled: "cancelled",
    NotificationTrigger.no_show: "no_show",
    NotificationTrigger.restored: "restored",
    NotificationTrigger.wait_changed: "wait_changed",
}


def _payload(template: str, mobile: str, params: list[str]) -> dict[str, Any]:
    settings = get_settings()
    return {
        "integrated_number": settings.msg91_whatsapp_integrated_number,
        "content_type": "template",
        "payload": {
            "to": [{"mobiles": f"91{mobile}"}],
            "type": "template",
            "template": {
                "name": template,
                "language": {"code": "en", "policy": "deterministic"},
                "namespace": settings.msg91_whatsapp_namespace,
                "to_and_components": [
                    {
                        "to": [f"91{mobile}"],
                        "components": {
                            "body_1": {"type": "text", "value": v} for i, v in enumerate(params, start=1)
                        },
                    }
                ],
            },
        },
    }


def _send_via_msg91(template: str, mobile: str, params: list[str]) -> tuple[bool, str | None, str | None]:
    """Returns (success, provider_message_id, failure_reason)."""
    settings = get_settings()
    if not settings.msg91_auth_key:
        return False, None, "dev-mode-skip"
    try:
        body = _payload(template, mobile, params)
        with httpx.Client(timeout=TIMEOUT_SECONDS) as client:
            resp = client.post(
                MSG91_ENDPOINT,
                json=body,
                headers={"authkey": settings.msg91_auth_key, "Content-Type": "application/json"},
            )
        if resp.status_code >= 400:
            return False, None, f"http_{resp.status_code}: {resp.text[:200]}"
        data = resp.json()
        # MSG91 returns a request_id; treat as success if HTTP ok
        return True, data.get("request_id"), None
    except httpx.RequestError as e:
        return False, None, f"transport: {e}"


def _record(
    db: Session,
    *,
    clinic_id: int,
    booking: Booking,
    patient: Patient,
    trigger: NotificationTrigger,
    template: str,
    params: list[str],
    status: NotificationStatus,
    provider_id: str | None,
    failure: str | None,
) -> Notification:
    n = Notification(
        clinic_id=clinic_id,
        booking_id=booking.id,
        patient_id=patient.id,
        trigger=trigger,
        channel="whatsapp",
        status=status,
        provider_message_id=provider_id,
        template_name=template,
        payload={"params": params, "mobile": patient.mobile},
        failure_reason=failure,
        sent_at=now_utc() if status == NotificationStatus.sent else None,
    )
    db.add(n)
    return n


def dispatch(
    db: Session,
    *,
    clinic: Clinic,
    booking: Booking,
    patient: Patient,
    trigger: NotificationTrigger,
    params: list[str],
) -> Notification:
    """Send a WhatsApp notification and record the attempt. Idempotency is the caller's job
    (e.g. don't call twice for the same trigger+booking unless retrying)."""
    template = TEMPLATE_FOR_TRIGGER[trigger]

    # Honor patient opt-out — record as failed so the receptionist sees it skipped
    if patient.whatsapp_opt_out:
        return _record(
            db,
            clinic_id=clinic.id, booking=booking, patient=patient,
            trigger=trigger, template=template, params=params,
            status=NotificationStatus.failed, provider_id=None,
            failure="patient_opt_out",
        )

    ok, msg_id, reason = _send_via_msg91(template, patient.mobile, params)
    status = NotificationStatus.sent if ok else NotificationStatus.failed
    return _record(
        db,
        clinic_id=clinic.id, booking=booking, patient=patient,
        trigger=trigger, template=template, params=params,
        status=status, provider_id=msg_id, failure=reason,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Convenience builders for each trigger
# ─────────────────────────────────────────────────────────────────────────────


def notify_booking_confirmed(db, *, clinic, booking, patient):
    return dispatch(
        db, clinic=clinic, booking=booking, patient=patient,
        trigger=NotificationTrigger.booking_confirmed,
        params=[f"T{booking.token}", fmt_time(booking.slot_time), clinic.name],
    )


def notify_youre_next(db, *, clinic, booking, patient):
    return dispatch(
        db, clinic=clinic, booking=booking, patient=patient,
        trigger=NotificationTrigger.youre_next,
        params=[f"T{booking.token}", clinic.name],
    )


def notify_slot_changed(db, *, clinic, booking, patient, old_slot):
    return dispatch(
        db, clinic=clinic, booking=booking, patient=patient,
        trigger=NotificationTrigger.slot_changed,
        params=[f"T{booking.token}", fmt_time(old_slot), fmt_time(booking.slot_time), clinic.name],
    )


def notify_cancelled(db, *, clinic, booking, patient):
    return dispatch(
        db, clinic=clinic, booking=booking, patient=patient,
        trigger=NotificationTrigger.cancelled,
        params=[f"T{booking.token}", clinic.name],
    )


def notify_no_show(db, *, clinic, booking, patient):
    return dispatch(
        db, clinic=clinic, booking=booking, patient=patient,
        trigger=NotificationTrigger.no_show,
        params=[f"T{booking.token}", clinic.name],
    )


def notify_restored(db, *, clinic, booking, patient):
    return dispatch(
        db, clinic=clinic, booking=booking, patient=patient,
        trigger=NotificationTrigger.restored,
        params=[f"T{booking.token}", clinic.name],
    )
