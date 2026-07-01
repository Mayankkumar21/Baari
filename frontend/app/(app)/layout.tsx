import Link from "next/link";
import { requireSession } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/app/logout-button";
import { AppNav } from "@/components/app/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sess = await requireSession();
  const vocab = vocabFor(sess.clinic.tenantType);
  const isDoctor = sess.user.role === "doctor";

  return (
    <div className="relative min-h-screen">
      {/* Atmospheric backdrop — same indigo wash as the landing hero. */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="orb -top-32 -left-32 size-[520px] bg-primary/15" />
        <div className="orb -bottom-40 -right-32 size-[460px] bg-primary/10" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link href="/queue" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Baari"
              className="size-7 rounded-md shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_8px_24px_-8px_hsl(var(--primary)/0.6)] transition-transform group-hover:scale-105"
            />
            <span className="text-sm font-bold tracking-tight bg-gradient-to-b from-foreground from-30% to-primary/80 bg-clip-text text-transparent">
              {sess.clinic.name}
            </span>
          </Link>
          <AppNav isDoctor={isDoctor} vocab={vocab} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{sess.user.name}</span>
              <span>· {vocab[isDoctor ? "providerTitled" : "staffTitled"]}</span>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container py-6 animate-page-in">{children}</main>
    </div>
  );
}
