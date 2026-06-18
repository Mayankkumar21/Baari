import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const BACKEND_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://baariprod.vercel.app";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground font-extrabold transition-transform group-hover:scale-105">
            B
          </span>
          <span className="text-lg font-bold tracking-tight">Baari</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href={`${BACKEND_URL}/login`}>Sign in</Link>
          </Button>
          <Button variant="glow" asChild>
            <Link href={`${BACKEND_URL}/signup`}>
              Start free <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
