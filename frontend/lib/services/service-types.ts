// Service presets per tenant type. The booking form renders these as a
// dropdown so the receptionist doesn't free-type "massa" → "massage" →
// "Massage" and end up with three separate report buckets for the same
// thing. "+ Add custom" lets her go off-list when she needs to.
//
// Keep the labels short — they show on the queue row as the booking
// reason. If you need a longer description, it goes into the row's
// secondary line.
export const SERVICE_PRESETS: Record<string, string[]> = {
  clinic: ["Consultation", "Follow-up", "Check-up", "Vaccination"],
  dental: ["Cleaning", "Filling", "Root canal", "Extraction", "Consultation"],
  salon: ["Haircut", "Colour", "Styling", "Beard trim", "Treatment"],
  spa: ["Massage", "Facial", "Body scrub", "Manicure", "Pedicure"],
  vet: ["Consultation", "Vaccination", "Grooming", "Check-up"],
  other: ["Appointment"],
};

export function servicesFor(tenantType: string | null | undefined): string[] {
  if (!tenantType) return SERVICE_PRESETS.clinic;
  return SERVICE_PRESETS[tenantType] ?? SERVICE_PRESETS.other;
}
