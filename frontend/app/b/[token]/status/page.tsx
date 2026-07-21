import { redirect } from "next/navigation";
import {
  getBookingRequestByToken,
  requestStatus,
} from "@/lib/services/booking-request";
import { getStatusFeed } from "@/lib/services/status-feed";
import { readLang } from "@/lib/i18n-mini";
import { ExpiredScreen } from "../screens";
import { LiveStatus } from "./live-status";

export default async function StatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = readLang(sp);

  const found = await getBookingRequestByToken(token);
  if (!found) return <ExpiredScreen lang={lang} />;
  const status = requestStatus(found.request);
  if (status.kind === "cancelled") {
    redirect(`/b/${token}/cancel?done=1${lang === "hi" ? "&lang=hi" : ""}`);
  }
  if (status.kind !== "confirmed") {
    redirect(`/b/${token}${lang === "hi" ? "?lang=hi" : ""}`);
  }

  const initial = await getStatusFeed(token);
  if (!initial) return <ExpiredScreen lang={lang} clinic={found.clinic} />;

  return <LiveStatus token={token} lang={lang} initial={initial} tz={found.clinic.timezone} />;
}
