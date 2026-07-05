// .ics download for "Add to calendar." Generates an RFC 5545 calendar
// entry for the booking. UTC throughout (avoids VTIMEZONE complexity).
export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import {
  getBookingRequestByToken,
  requestStatus,
} from "@/lib/services/booking-request";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const found = await getBookingRequestByToken(token);
  if (!found) return new Response("Not found", { status: 404 });
  const status = requestStatus(found.request);
  if (status.kind !== "confirmed") return new Response("Not found", { status: 404 });

  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, status.bookingId))
    .limit(1);
  if (!booking) return new Response("Not found", { status: 404 });

  const start = new Date(booking.slotTime);
  const end = new Date(start.getTime() + (found.clinic.slotLengthMin ?? 20) * 60_000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Baari//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Per RFC 5545, UID must be globally unique across all calendars.
    // The domain is a namespace, not a URL — doesn't need to resolve.
    `UID:baari-${booking.id}@getbaari.in`,
    `DTSTAMP:${fmtIcsDate(new Date())}`,
    `DTSTART:${fmtIcsDate(start)}`,
    `DTEND:${fmtIcsDate(end)}`,
    `SUMMARY:${esc(found.clinic.name)} — T-${booking.token}`,
    `LOCATION:${esc(found.clinic.address ?? found.clinic.name)}`,
    `DESCRIPTION:${esc(`Your booking at ${found.clinic.name}. Token T-${booking.token}.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="baari-T${booking.token}.ics"`,
      "cache-control": "no-store",
    },
  });
}

// RFC 5545 UTC: YYYYMMDDTHHMMSSZ
function fmtIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, "\\n");
}
