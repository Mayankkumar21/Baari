"use server";

import { revalidatePath } from "next/cache";
import { requireSetup } from "@/lib/session";
import { addGuest, PatientError } from "@/lib/services/patients";

export type AddGuestState = { ok?: boolean; error?: string };

export async function addGuestAction(
  _prev: AddGuestState,
  formData: FormData,
): Promise<AddGuestState> {
  const sess = await requireSetup();
  try {
    await addGuest({
      clinicId: sess.clinic.id,
      name: String(formData.get("name") ?? ""),
      mobile: String(formData.get("mobile") ?? ""),
      whatsappOptOut: formData.get("whatsapp_opt_out") === "on",
    });
    revalidatePath("/search");
    return { ok: true };
  } catch (err) {
    if (err instanceof PatientError) return { error: err.message };
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
