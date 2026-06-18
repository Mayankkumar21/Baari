// Per-tenant-type label vocabulary — port of app/vocab.py.
export type TenantTypeKey =
  | "clinic"
  | "salon"
  | "spa"
  | "dental"
  | "vet"
  | "other";

export type Vocab = {
  workspace: string;
  workspaceTitled: string;
  entitySingular: string;
  entityPlural: string;
  entityTitled: string;
  provider: string;
  providerTitled: string;
  session: string;
  sessionTitled: string;
  sessionProgress: string;
  staff: string;
  staffTitled: string;
  reasonLabel: string;
};

const DEFAULT: Vocab = {
  workspace: "clinic",
  workspaceTitled: "Clinic",
  entitySingular: "patient",
  entityPlural: "patients",
  entityTitled: "Patient",
  provider: "doctor",
  providerTitled: "Doctor",
  session: "consult",
  sessionTitled: "Consult",
  sessionProgress: "in consult",
  staff: "receptionist",
  staffTitled: "Receptionist",
  reasonLabel: "Reason for visit",
};

export const VOCABS: Record<TenantTypeKey, Vocab> = {
  clinic: { ...DEFAULT },
  dental: {
    ...DEFAULT,
    workspace: "practice",
    workspaceTitled: "Practice",
    provider: "dentist",
    providerTitled: "Dentist",
    session: "appointment",
    sessionTitled: "Appointment",
    sessionProgress: "in chair",
    reasonLabel: "Procedure",
  },
  salon: {
    ...DEFAULT,
    workspace: "salon",
    workspaceTitled: "Salon",
    entitySingular: "customer",
    entityPlural: "customers",
    entityTitled: "Customer",
    provider: "stylist",
    providerTitled: "Stylist",
    session: "service",
    sessionTitled: "Service",
    sessionProgress: "in chair",
    staff: "front desk",
    staffTitled: "Front desk",
    reasonLabel: "Service requested",
  },
  spa: {
    ...DEFAULT,
    workspace: "spa",
    workspaceTitled: "Spa",
    entitySingular: "guest",
    entityPlural: "guests",
    entityTitled: "Guest",
    provider: "therapist",
    providerTitled: "Therapist",
    session: "session",
    sessionTitled: "Session",
    sessionProgress: "in session",
    staff: "front desk",
    staffTitled: "Front desk",
    reasonLabel: "Service requested",
  },
  vet: {
    ...DEFAULT,
    entitySingular: "pet",
    entityPlural: "pets",
    entityTitled: "Pet",
    provider: "vet",
    providerTitled: "Vet",
    session: "visit",
    sessionTitled: "Visit",
    sessionProgress: "in exam",
  },
  other: {
    ...DEFAULT,
    workspace: "business",
    workspaceTitled: "Business",
    entitySingular: "customer",
    entityPlural: "customers",
    entityTitled: "Customer",
    provider: "owner",
    providerTitled: "Owner",
    session: "appointment",
    sessionTitled: "Appointment",
    sessionProgress: "with provider",
    staff: "staff",
    staffTitled: "Staff",
    reasonLabel: "Notes",
  },
};

export function vocabFor(tenantType: string | null | undefined): Vocab {
  if (!tenantType) return VOCABS.clinic;
  if (tenantType in VOCABS) return VOCABS[tenantType as TenantTypeKey];
  return VOCABS.clinic;
}
