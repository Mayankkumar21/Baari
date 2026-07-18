import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/queue";
  const justReset = sp.reset === "1";
  return (
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      {/* Same atmospheric backdrop as the landing hero — indigo orbs,
          subtle grid, dark ground. The login page used to look like a
          generic form; this matches the branded rest of the site. */}
      <div className="orb pointer-events-none -top-40 -left-40 h-[520px] w-[520px] bg-primary/25" />
      <div className="orb pointer-events-none -bottom-40 -right-40 h-[440px] w-[440px] bg-primary/20" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.04] dark:opacity-[0.06] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Wordmark up top, outside the card — brands the moment
            without competing with the form. */}
        <div className="mb-6 flex justify-center">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-[hsl(255_80%_60%)] text-white text-sm font-extrabold shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_10px_28px_-8px_hsl(var(--primary)/0.6)] transition-transform group-hover:scale-105">
              b
            </span>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-b from-foreground from-30% to-primary/80 bg-clip-text text-transparent">
              Baari
            </span>
          </Link>
        </div>

        {/* Card with a soft indigo edge glow (via ring + shadow) so it
            reads as a distinct panel rather than a generic <Card>. */}
        <div className="relative rounded-2xl border border-border/60 bg-card/70 p-8 shadow-2xl shadow-primary/10 ring-1 ring-white/5 backdrop-blur-xl sm:p-10">
          {/* Top-edge highlight, matches the Insights cards. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          <div className="mb-7 text-center">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="text-gradient">Welcome back</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to your workspace.
            </p>
          </div>

          {justReset ? (
            <div className="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              Password updated. Sign in with your new password.
            </div>
          ) : null}

          <LoginForm next={next} />

          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <Link
              href="/forgot"
              className="font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
            <Link
              href="/signup"
              className="font-medium text-primary hover:underline"
            >
              Start free →
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-[11px] text-muted-foreground">
          New to Baari? Every new signup gets 60 days of Pro on us.
          <br />
          No card required.
        </div>
      </div>
    </div>
  );
}
