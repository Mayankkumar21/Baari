"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { requireSession } from "@/lib/session";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type SetupState = { error?: string };

export async function setupAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const sess = await requireSession();
  if (sess.user.role !== "doctor") return { error: "Only the owner can finish setup." };

  const slotLength = Number(formData.get("slot_length_min") ?? "20");
  if (!Number.isFinite(slotLength) || slotLength < 5 || slotLength > 240) {
    return { error: "Slot length must be 5–240 minutes." };
  }
  const noShowThreshold = Number(formData.get("no_show_threshold_min") ?? "45");
  if (!Number.isFinite(noShowThreshold) || noShowThreshold < 0) {
    return { error: "Invalid no-show threshold." };
  }
  const address = String(formData.get("address") ?? "").trim().slice(0, 300);

  const openingHours: Record<string, { open?: string; close?: string; closed?: boolean }> = {};
  for (const d of DAYS) {
    const open = String(formData.get(`${d}_open`) ?? "").trim();
    const close = String(formData.get(`${d}_close`) ?? "").trim();
    if (!open || !close) {
      openingHours[d] = { closed: true };
    } else {
      openingHours[d] = { open, close };
    }
  }

  await db
    .update(schema.clinics)
    .set({
      slotLengthMin: Math.round(slotLength),
      noShowThresholdMin: Math.round(noShowThreshold),
      address,
      openingHours,
      setupComplete: true,
    })
    .where(eq(schema.clinics.id, sess.clinic.id));

  redirect("/setup/done");
}
