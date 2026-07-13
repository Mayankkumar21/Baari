"use client";

import { motion } from "motion/react";
import { Smartphone, Sparkles, MapPin, Bell } from "lucide-react";

const BULLETS = [
  {
    icon: MapPin,
    title: "They find you",
    body: "Your workspace shows up in the app's Near You list — no marketing budget required.",
  },
  {
    icon: Smartphone,
    title: "They book themselves",
    body: "Pick a service, pick a slot, done. The token lands in your front-desk queue instantly.",
  },
  {
    icon: Bell,
    title: "You stay in control",
    body: "Toggle off app bookings anytime from Settings. Restrict which services are bookable. The front desk always wins.",
  },
];

export function CustomerApp() {
  return (
    <section className="container pb-20 sm:pb-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="grid gap-10 rounded-2xl border border-border/40 bg-card/40 p-8 backdrop-blur sm:p-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16"
      >
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3" /> Customer app · coming soon
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Your customers can book themselves.
          </h2>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Baari isn&apos;t only for the front desk. The customer app lets
            people find your workspace, see today&apos;s wait, and book a
            slot without a phone call.
          </p>

          <ul className="mt-6 space-y-4">
            {BULLETS.map((b) => (
              <li key={b.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <b.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{b.title}</div>
                  <div className="text-sm text-muted-foreground">{b.body}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-border bg-secondary/60 px-4 py-2 text-sm font-medium text-muted-foreground"
              title="Play Store link goes live at launch"
            >
              <Smartphone className="size-4" /> Get the app · coming soon
            </span>
            <span className="text-xs text-muted-foreground">
              Android first. iOS follows.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <AppMockup />
        </div>
      </motion.div>
    </section>
  );
}

// Lightweight SVG-ish mockup — one indigo phone frame with a
// mini-Discover card inside. Zero image assets so the section stays
// snappy and dark-mode friendly.
function AppMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 -z-10 rounded-[42px] bg-primary/10 blur-3xl" />
      <div className="rounded-[36px] border border-border/70 bg-background/80 p-3 shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.35)] backdrop-blur">
        <div className="relative h-[440px] w-[220px] overflow-hidden rounded-[28px] bg-gradient-to-b from-primary/15 to-background">
          <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-foreground/10" />
          <div className="p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Discover
            </div>
            <div className="mt-1 text-lg font-bold">Near you</div>
            <div className="mt-4 space-y-2">
              <MiniClinicRow kind="Clinic" name="Wellspring Family" status="Open · Next slot 11:15" />
              <MiniClinicRow kind="Salon" name="Bloom Studio" status="Open · Next slot 12:00" />
              <MiniClinicRow kind="Spa" name="Serenity Spa" status="Closed · Opens 15:00" muted />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniClinicRow({
  kind,
  name,
  status,
  muted,
}: {
  kind: string;
  name: string;
  status: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/70 p-2.5">
      <div className="text-[11px] font-semibold">{name}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{kind} · Indore</div>
      <div
        className={
          "mt-1 flex items-center gap-1 text-[10px] " +
          (muted ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400")
        }
      >
        <span
          className={
            "size-1.5 rounded-full " +
            (muted ? "bg-muted-foreground" : "bg-emerald-500")
          }
        />
        <span>{status}</span>
      </div>
    </div>
  );
}
