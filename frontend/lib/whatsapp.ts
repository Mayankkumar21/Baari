// MSG91 WhatsApp dispatch — port of app/services/notifications.py + whatsapp client.
// Env-gated: leave MSG91_AUTHKEY blank in dev → no-op + console log.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import type { Patient, Booking, NewClinic } from "@/lib/db/schema";

type Trigger =
  | "booking_confirmed"
  | "youre_next"
  | "slot_changed"
  | "wait_changed"
  | "cancelled"
  | "no_show"
  | "restored";

const AUTHKEY = process.env.MSG91_AUTH_KEY ?? process.env.MSG91_AUTHKEY ?? "";
const NAMESPACE =
  process.env.MSG91_WHATSAPP_NAMESPACE ?? process.env.MSG91_TEMPLATE_NAMESPACE ?? "";
const INTEGRATED_NUMBER =
  process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER ?? process.env.MSG91_INTEGRATED_NUMBER ?? "";

const TEMPLATE_BY_TRIGGER: Record<Trigger, string> = {
  booking_confirmed: "booking_confirmed_v1",
  youre_next: "youre_next_v1",
  slot_changed: "slot_changed_v1",
  wait_changed: "wait_changed_v1",
  cancelled: "cancelled_v1",
  no_show: "no_show_v1",
  restored: "restored_v1",
};

export async function dispatchWhatsapp(args: {
  clinicId: number;
  patient: Patient;
  booking?: Booking;
  trigger: Trigger;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { clinicId, patient, booking, trigger, payload } = args;
  if (patient.whatsappOptOut) return;

  // Log a queued notification regardless of provider availability — audit trail.
  const [row] = await db
    .insert(schema.notifications)
    .values({
      clinicId,
      bookingId: booking?.id ?? null,
      patientId: patient.id,
      trigger,
      status: "queued",
      templateName: TEMPLATE_BY_TRIGGER[trigger],
      payload,
    })
    .returning();

  if (!AUTHKEY || !NAMESPACE || !INTEGRATED_NUMBER) {
    console.log(
      `[whatsapp:dev-skip] would send ${trigger} to ${patient.mobile} (payload:`,
      payload,
      ")",
    );
    await db
      .update(schema.notifications)
      .set({ status: "sent", sentAt: new Date(), failureReason: "dev-mode skip" })
      .where(eq(schema.notifications.id, row.id));
    return;
  }

  try {
    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
      method: "POST",
      headers: { "Content-Type": "application/json", authkey: AUTHKEY },
      body: JSON.stringify({
        integrated_number: INTEGRATED_NUMBER,
        content_type: "template",
        payload: {
          to: `91${patient.mobile}`,
          type: "template",
          template: {
            name: TEMPLATE_BY_TRIGGER[trigger],
            language: { code: "en", policy: "deterministic" },
            namespace: NAMESPACE,
            components: [],
          },
        },
      }),
    });
    const ok = res.ok;
    const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
    await db
      .update(schema.notifications)
      .set({
        status: ok ? "sent" : "failed",
        sentAt: ok ? new Date() : null,
        providerMessageId: json.messages?.[0]?.id ?? null,
        failureReason: ok ? null : `MSG91 ${res.status}`,
      })
      .where(eq(schema.notifications.id, row.id));
  } catch (err) {
    await db
      .update(schema.notifications)
      .set({ status: "failed", failureReason: String(err).slice(0, 280) })
      .where(eq(schema.notifications.id, row.id));
  }
}
