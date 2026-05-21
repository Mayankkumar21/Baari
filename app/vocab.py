"""Per-tenant-type label vocabulary.

The underlying model is identical across vendor types — there's always a token,
a slot, a queue, an "in-consult" person, a "done" state. Only the user-facing
labels differ between a clinic and a salon. This module is the single source of
truth for that.

Templates pull labels via the `vocab` global (a dict keyed by `tenant_type` or
an explicit override). Falls back to the `clinic` mapping when a key is missing
or the tenant_type is unknown.
"""
from __future__ import annotations

from app.models import TenantType

# Vocab keys consumed by templates. Add a new key here when you need it.
_DEFAULT = {
    "workspace":         "clinic",          # what is the business called?
    "workspace_titled":  "Clinic",
    "entity_singular":   "patient",         # who comes in for service?
    "entity_plural":     "patients",
    "entity_titled":     "Patient",
    "provider":          "doctor",          # who provides the service?
    "provider_titled":   "Doctor",
    "session":           "consult",         # what's a single encounter called?
    "session_titled":    "Consult",
    "session_progress":  "in consult",
    "staff":             "receptionist",
    "staff_titled":      "Receptionist",
    "reason_label":      "Reason for visit",
}


VOCABS: dict[TenantType, dict[str, str]] = {
    TenantType.clinic: {
        **_DEFAULT,
    },
    TenantType.dental: {
        **_DEFAULT,
        "workspace": "practice", "workspace_titled": "Practice",
        "provider": "dentist", "provider_titled": "Dentist",
        "session": "appointment", "session_titled": "Appointment",
        "session_progress": "in chair",
        "reason_label": "Procedure",
    },
    TenantType.salon: {
        **_DEFAULT,
        "workspace": "salon", "workspace_titled": "Salon",
        "entity_singular": "customer", "entity_plural": "customers", "entity_titled": "Customer",
        "provider": "stylist", "provider_titled": "Stylist",
        "session": "service", "session_titled": "Service",
        "session_progress": "in chair",
        "staff": "front desk", "staff_titled": "Front desk",
        "reason_label": "Service requested",
    },
    TenantType.spa: {
        **_DEFAULT,
        "workspace": "spa", "workspace_titled": "Spa",
        "entity_singular": "guest", "entity_plural": "guests", "entity_titled": "Guest",
        "provider": "therapist", "provider_titled": "Therapist",
        "session": "session", "session_titled": "Session",
        "session_progress": "in session",
        "staff": "front desk", "staff_titled": "Front desk",
        "reason_label": "Service requested",
    },
    TenantType.vet: {
        **_DEFAULT,
        "workspace": "clinic", "workspace_titled": "Clinic",
        "entity_singular": "pet", "entity_plural": "pets", "entity_titled": "Pet",
        "provider": "vet", "provider_titled": "Vet",
        "session": "visit", "session_titled": "Visit",
        "session_progress": "in exam",
        "reason_label": "Reason for visit",
    },
    TenantType.other: {
        **_DEFAULT,
        "workspace": "business", "workspace_titled": "Business",
        "entity_singular": "customer", "entity_plural": "customers", "entity_titled": "Customer",
        "provider": "owner", "provider_titled": "Owner",
        "session": "appointment", "session_titled": "Appointment",
        "session_progress": "with provider",
        "staff": "staff", "staff_titled": "Staff",
        "reason_label": "Notes",
    },
}


def vocab_for(tenant_type: TenantType | str | None) -> dict[str, str]:
    if tenant_type is None:
        return VOCABS[TenantType.clinic]
    if isinstance(tenant_type, str):
        try:
            tenant_type = TenantType(tenant_type)
        except ValueError:
            return VOCABS[TenantType.clinic]
    return VOCABS.get(tenant_type, VOCABS[TenantType.clinic])


# Labels shown on the public signup page when picking a vendor type
TENANT_TYPE_DISPLAY: list[tuple[TenantType, str, str]] = [
    (TenantType.clinic,  "Clinic",      "Homeopathy, GP, paediatrics, physiotherapy, etc."),
    (TenantType.dental,  "Dental",      "Dentist, orthodontist."),
    (TenantType.salon,   "Salon",       "Hair, beauty, nails, barbershop."),
    (TenantType.spa,     "Spa",         "Massage, wellness, day spa."),
    (TenantType.vet,     "Vet",         "Veterinary clinic."),
    (TenantType.other,   "Other",       "Any appointment-based service business."),
]
