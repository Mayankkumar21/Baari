import Link from "next/link";
import { t, type Lang } from "@/lib/i18n-mini";
import { headers } from "next/headers";

// Mobile-first single-column shell for the public booking flow.
// Force dynamic everywhere — these screens MUST reflect live DB state, not
// the edge cache. (Race-safety happens inside server actions; the read
// side just needs to be uncached.)
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function PublicBookingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  await headers(); // pulls request into dynamic scope
  const { token } = await params;
  const lang: Lang = "en"; // resolved per-page via search params

  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
        <div className="flex-1 px-5 pb-32 pt-6">{children}</div>

        {/* Footer pinned bottom */}
        <footer className="px-5 pb-6 pt-3 text-center text-[10px] text-muted-foreground">
          {t("powered_by", lang)}{" "}
          <Link href="/" className="font-semibold text-primary hover:underline">
            Baari
          </Link>{" "}
          <LangSwitch token={token} />
        </footer>
      </div>
    </main>
  );
}

function LangSwitch({ token }: { token: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground/80">
      <Link
        href={`/b/${token}?lang=en`}
        className="hover:text-primary"
        aria-label="English"
      >
        EN
      </Link>
      <span aria-hidden>·</span>
      <Link
        href={`/b/${token}?lang=hi`}
        className="hover:text-primary"
        aria-label="हिन्दी"
      >
        हिं
      </Link>
    </span>
  );
}
