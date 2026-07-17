import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/session";


// Server component so we can peek at the session cookie and swap the
// right-hand CTA. Logged-in visitors get a "Dashboard" link instead of
// a "Sign in" button — the old header nagged them to sign in even
// though they already were.
export async function SiteHeader() {
  const sess = await getSession();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="group flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Baari"
            className="size-8 rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="text-lg font-bold tracking-tight">Baari</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          {sess ? (
            <Button asChild>
              <Link href="/queue">
                Dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
