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
    // Vet patients are examined like clinic patients — "in consult" reads
    // naturally for both. "in exam" was overly clinical and didn't match
    // how clinics talk about a doctor seeing a pet.
    sessionProgress: "in consult",
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
    // "with provider" was a placeholder. "in session" is generic and
    // recognisable across coaching, legal, notary, and services at large.
    sessionProgress: "in session",
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

// The subset the mobile app needs — derived from the same map so it
// can't drift. Served alongside each clinic detail response.
export type MobileVocab = {
  sessionLabel: string; // upper-case pill under clinic name in cards
  bookCta: string;      // button text on the clinic detail screen
  tenantLabel: string;  // "Clinic" / "Salon" / "Dental" row on cards
};

const MOBILE_BOOK_CTA: Record<TenantTypeKey, string> = {
  clinic: "Book a consult",
  dental: "Book a checkup",
  salon: "Book a chair",
  spa: "Book a session",
  vet: "Book a visit",
  other: "Book a slot",
};

const MOBILE_TENANT_LABEL: Record<TenantTypeKey, string> = {
  clinic: "Clinic",
  dental: "Dental",
  salon: "Salon",
  spa: "Spa",
  vet: "Vet",
  other: "Business",
};

export function mobileVocabFor(tenantType: string | null | undefined): MobileVocab {
  const key: TenantTypeKey =
    tenantType && tenantType in VOCABS ? (tenantType as TenantTypeKey) : "clinic";
  const v = VOCABS[key];
  return {
    // v.session is lower-case ("consult", "session", …); mobile card
    // renders it uppercased.
    sessionLabel: v.session.toUpperCase(),
    bookCta: MOBILE_BOOK_CTA[key],
    tenantLabel: MOBILE_TENANT_LABEL[key],
  };
}
