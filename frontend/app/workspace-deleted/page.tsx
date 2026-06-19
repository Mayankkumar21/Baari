import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const dynamic = "force-static";

export default function WorkspaceDeletedPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <section className="container relative isolate flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
        <div className="orb left-1/2 top-[10%] h-[420px] w-[520px] -translate-x-1/2 bg-primary/25" />

        <div className="relative">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="size-7" />
          </div>

          <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Workspace deleted.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-balance text-sm text-muted-foreground sm:text-base">
            Your workspace and all of its data have been removed permanently.
            Thanks for trying Baari.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button variant="glow" size="lg" asChild>
              <Link href="/signup">
                Start a new workspace <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
