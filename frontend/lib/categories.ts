// Suggested revenue categories per tenant type. Used by the Mark Done
// popover on /queue and the category-revenue chart on /reports. Kept
// as suggestions — the DB column is a free-text varchar(40), so an
// owner who types a custom category (e.g. "Botox", "Root canal") sees
// that same string aggregated on the report. No enum, no migration
// cost when we add or drop a suggestion.

export type TenantType = string;

const CATEGORIES: Record<string, string[]> = {
  clinic:  ["Consultation", "Pharmacy", "Procedure", "Diagnostics"],
  dental:  ["Consultation", "Cleaning", "Procedure", "Products"],
  salon:   ["Haircut", "Color", "Treatment", "Products"],
  spa:     ["Massage", "Facial", "Treatment", "Products"],
  vet:     ["Consultation", "Vaccination", "Grooming", "Products"],
};

export function categoriesFor(tenantType: string): string[] {
  return CATEGORIES[tenantType] ?? ["Service", "Product"];
}
