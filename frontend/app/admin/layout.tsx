// Admin surface — /admin/* — internal ops dashboard.
//
// Gated by lib/admin.ts (mobile-allowlist check via ADMIN_MOBILES env
// var). A non-admin who guesses the URL sees the standard 404, never a
// forbidden banner that leaks the route's existence.

import Link from "next/link";
import { ShieldCheck, LayoutDashboard, Building2, Users, Mail } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/app/logout-button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sess = await requireAdmin();
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="orb -top-32 -left-32 size-[520px] bg-primary/10" />
        <div className="orb -bottom-40 -right-32 size-[460px] bg-primary/10" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-2 sm:gap-4">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5 group">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_8px_24px_-8px_hsl(var(--primary)/0.6)]">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">Baari Admin</div>
              <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">Internal</div>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <Link href="/admin" className="rounded-md px-3 py-1.5 hover:bg-muted/60 flex items-center gap-1.5">
              <LayoutDashboard className="size-4" /> Overview
            </Link>
            <Link href="/admin/workspaces" className="rounded-md px-3 py-1.5 hover:bg-muted/60 flex items-center gap-1.5">
              <Building2 className="size-4" /> Workspaces
            </Link>
            <Link href="/admin/interest" className="rounded-md px-3 py-1.5 hover:bg-muted/60 flex items-center gap-1.5">
              <Mail className="size-4" /> Interest
            </Link>
            <Link href="/queue" className="rounded-md px-3 py-1.5 hover:bg-muted/60 flex items-center gap-1.5">
              <Users className="size-4" /> Owner view →
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {sess.user.name}
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container py-6 sm:py-8 space-y-6">{children}</main>
    </div>
  );
}
