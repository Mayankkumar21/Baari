from datetime import date as _Date
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import INET
from sqlmodel import Field, SQLModel

from app.time_utils import now_utc


class UserRole(str, Enum):
    doctor = "doctor"          # vendor-agnostic: tenant admin (vocab varies per type)
    receptionist = "receptionist"  # vendor-agnostic: staff


class TenantType(str, Enum):
    clinic = "clinic"
    salon = "salon"
    spa = "spa"
    dental = "dental"
    vet = "vet"
    other = "other"


class BookingStatus(str, Enum):
    booked = "booked"
    checked_in = "checked_in"
    in_consult = "in_consult"
    done = "done"
    no_show = "no_show"
    cancelled = "cancelled"


class SubTokenStatus(str, Enum):
    booked = "booked"
    checked_in = "checked_in"
    in_consult = "in_consult"
    done = "done"
    cancelled = "cancelled"
    no_show = "no_show"


class NotificationTrigger(str, Enum):
    booking_confirmed = "booking_confirmed"
    youre_next = "youre_next"
    slot_changed = "slot_changed"
    wait_changed = "wait_changed"
    cancelled = "cancelled"
    no_show = "no_show"
    restored = "restored"


class NotificationStatus(str, Enum):
    queued = "queued"
    sent = "sent"
    failed = "failed"


class Clinic(SQLModel, table=True):
    """Tenant workspace. Named `clinics` for historical reasons — represents any vendor
    (clinic, salon, spa, …) routed via `tenant_type`."""
    __tablename__ = "clinics"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=120)
    # Stored as the enum's string value so existing rows backfill cleanly via server_default
    tenant_type: str = Field(
        default=TenantType.clinic.value,
        sa_column=Column(String(20), nullable=False, server_default=TenantType.clinic.value),
    )
    mobile: Optional[str] = Field(default=None, max_length=15)
    address: Optional[str] = Field(default=None, max_length=300)
    slot_length_min: int = Field(default=20)
    opening_hours: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    closed_days: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    no_show_threshold_min: int = Field(default=45)
    retention_days: int = Field(default=730)
    setup_complete: bool = Field(default=False)
    created_at: datetime = Field(default_factory=now_utc, nullable=False)


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("clinic_id", "mobile", name="uq_users_clinic_mobile"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True, nullable=False)
    role: UserRole
    mobile: str = Field(max_length=15)
    password_hash: str = Field(max_length=255)
    name: str = Field(max_length=80)
    active: bool = Field(default=True)
    last_login_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc, nullable=False)


class Patient(SQLModel, table=True):
    __tablename__ = "patients"
    __table_args__ = (UniqueConstraint("clinic_id", "mobile", name="uq_patients_clinic_mobile"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True, nullable=False)
    name: str = Field(max_length=80)
    mobile: str = Field(max_length=15)
    is_new: bool = Field(default=True)
    whatsapp_opt_out: bool = Field(default=False)
    no_show_count: int = Field(default=0)
    consent_given: bool = Field(default=False)
    anonymized_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc, nullable=False)


class Booking(SQLModel, table=True):
    __tablename__ = "bookings"
    __table_args__ = (UniqueConstraint("clinic_id", "date", "token", name="uq_bookings_clinic_date_token"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True, nullable=False)
    patient_id: int = Field(foreign_key="patients.id", nullable=False)
    date: _Date = Field(index=True, nullable=False)
    token: int = Field(nullable=False)
    slot_time: datetime = Field(nullable=False, index=True)
    reason: Optional[str] = Field(default=None, max_length=200)
    party_size: int = Field(default=1)
    status: BookingStatus = Field(default=BookingStatus.booked, index=True)
    checked_in_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    no_show_at: Optional[datetime] = None
    restored_at: Optional[datetime] = None
    wait_estimate_min: Optional[int] = None
    last_wait_notified_at: Optional[datetime] = None
    created_by_user_id: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=now_utc, nullable=False)
    updated_at: datetime = Field(default_factory=now_utc, nullable=False)


class SubToken(SQLModel, table=True):
    __tablename__ = "sub_tokens"
    __table_args__ = (UniqueConstraint("booking_id", "suffix", name="uq_subtokens_booking_suffix"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="bookings.id", index=True, nullable=False)
    suffix: int = Field(nullable=False)
    name: str = Field(max_length=80)
    reason: Optional[str] = Field(default=None, max_length=200)
    status: SubTokenStatus = Field(default=SubTokenStatus.booked)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc, nullable=False)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True, nullable=False)
    booking_id: Optional[int] = Field(default=None, foreign_key="bookings.id", index=True)
    sub_token_id: Optional[int] = Field(default=None, foreign_key="sub_tokens.id")
    patient_id: int = Field(foreign_key="patients.id", nullable=False)
    trigger: NotificationTrigger
    channel: str = Field(default="whatsapp", max_length=20)
    status: NotificationStatus = Field(default=NotificationStatus.queued, index=True)
    provider_message_id: Optional[str] = Field(default=None, max_length=120)
    template_name: Optional[str] = Field(default=None, max_length=80)
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    failure_reason: Optional[str] = Field(default=None, max_length=300)
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now_utc, nullable=False)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True, nullable=False)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id")
    event_type: str = Field(max_length=60, index=True)
    entity_type: Optional[str] = Field(default=None, max_length=40)
    entity_id: Optional[int] = None
    changes: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    ip: Optional[str] = Field(default=None, sa_column=Column(INET))
    created_at: datetime = Field(default_factory=now_utc, nullable=False, index=True)


class DailySummary(SQLModel, table=True):
    __tablename__ = "daily_summaries"
    __table_args__ = (UniqueConstraint("clinic_id", "date", name="uq_summary_clinic_date"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    clinic_id: int = Field(foreign_key="clinics.id", index=True, nullable=False)
    date: _Date = Field(nullable=False, index=True)
    total_bookings: int = 0
    completed: int = 0
    no_shows: int = 0
    cancellations: int = 0
    avg_wait_seconds: Optional[int] = None
    avg_consult_seconds: Optional[int] = None
    peak_hour: Optional[int] = None
    first_consult_at: Optional[datetime] = None
    last_consult_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    generated_at: datetime = Field(default_factory=now_utc, nullable=False)
