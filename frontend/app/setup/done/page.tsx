import Link from "next/link";
import { ArrowRight, CalendarPlus, Settings, UserPlus } from "lucide-react";
import { requireSession } from "@/lib/session";
import { vocabFor } from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyLink } from "./copy-link";

export const dynamic = "force-dynamic";

export default async function SetupDonePage() {
  const sess = await requireSession();
  const vocab = vocabFor(sess.clinic.tenantType);

  const nextSteps = [
    {
      icon: CalendarPlus,
      title: `Make your first ${vocab.sessionTitled.toLowerCase()}`,
      body: `Head into Queue → New booking. Today's slots will be ready as soon as you land.`,
    },
    {
      icon: Settings,
      title: "Tweak settings any time",
      body: `Slot length, hours, no-show threshold — all editable from Settings.`,
    },
    {
      icon: UserPlus,
      title: "Invite a teammate",
      body: `Coming soon — multi-user workspaces with role-based access.`,
    },
  ];

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="orb -top-32 -left-32 size-[520px] bg-primary/30" />
      <div className="orb -bottom-32 -right-32 size-[420px] bg-primary/20" />
      <Card className="relative z-10 w-full max-w-xl">
        <CardContent className="space-y-7 p-8">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_hsl(140_70%_50%/0.5)]" />
              Live
            </span>
            <h1 className="pt-1 text-3xl font-bold tracking-tight text-gradient">
              Your workspace is live.
            </h1>
            <p className="text-sm text-muted-foreground">
              {sess.clinic.name} is set up and ready to take {vocab.entityPlural}.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              Your dashboard link
            </div>
            <CopyLink path="/queue" />
            <p className="text-[11px] text-muted-foreground">
              Bookmark this on every device you'll run Baari from.
            </p>
          </div>

          <Button variant="glow" size="lg" className="w-full" asChild>
            <Link href="/queue">
              Open dashboard <ArrowRight className="size-4" />
            </Link>
          </Button>

          <div className="space-y-3 border-t border-border pt-5">
            <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              What's next
            </div>
            <ul className="space-y-3">
              {nextSteps.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/8">
                    <Icon className="size-4 text-primary" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <p className="text-xs text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
