"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireDoctor } from "@/lib/session";

export type SettingsState = { ok?: boolean; error?: string };

const TENANT_TYPES = ["clinic", "salon", "spa", "dental", "vet", "other"] as const;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

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

  // Opening-hours editor. Saved iff the form opted in via hours_present=1, so
  // a settings update that only changes the workspace name doesn't overwrite
  // hours with empty defaults.
  let openingHours: Record<string, { open?: string; close?: string; closed?: boolean }> | null = null;
  if (formData.get("hours_present") === "1") {
    openingHours = {};
    for (const d of DAYS) {
      const open = String(formData.get(`${d}_open`) ?? "").trim();
      const close = String(formData.get(`${d}_close`) ?? "").trim();
      openingHours[d] = open && close ? { open, close } : { closed: true };
    }
  }

  await db
    .update(schema.clinics)
    .set({
      name,
      tenantType,
      slotLengthMin: Math.round(slot),
      noShowThresholdMin: Math.round(noShow),
      ...(openingHours ? { openingHours } : {}),
    })
    .where(eq(schema.clinics.id, sess.clinic.id));

  revalidatePath("/settings");
  revalidatePath("/queue");
  return { ok: true };
}
