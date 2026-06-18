"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireDoctor } from "@/lib/session";

export type SettingsState = { ok?: boolean; error?: string };

const TENANT_TYPES = ["clinic", "salon", "spa", "dental", "vet", "other"] as const;

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const sess = await requireDoctor();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const tenantType = String(formData.get("tenant_type") ?? sess.clinic.tenantType);
  const slot = Number(formData.get("slot_length_min") ?? "20");
  const noShow = Number(formData.get("no_show_threshold_min") ?? "45");

  if (!name) return { error: "Workspace name is required." };
  if (!(TENANT_TYPES as readonly string[]).includes(tenantType)) {
    return { error: "Invalid business type." };
  }
  if (!Number.isFinite(slot) || slot < 5 || slot > 240)
    return { error: "Slot length must be 5–240 minutes." };

  await db
    .update(schema.clinics)
    .set({
      name,
      tenantType,
      slotLengthMin: Math.round(slot),
      noShowThresholdMin: Math.round(noShow),
    })
    .where(eq(schema.clinics.id, sess.clinic.id));
  revalidatePath("/settings");
  return { ok: true };
}
