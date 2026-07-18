import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="relative grid min-h-screen place-items-center px-4">
      <div className="orb -top-32 -left-32 size-[480px] bg-primary/30" />
      <div className="orb -bottom-32 -right-32 size-[380px] bg-primary/20" />
      <Card className="relative z-10 w-full max-w-sm">
        <CardContent className="space-y-6 p-7">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-extrabold transition-transform group-hover:scale-105">
                B
              </span>
              <span className="text-sm font-semibold tracking-tight">Baari</span>
            </Link>
            <h1 className="pt-2 text-2xl font-bold tracking-tight text-gradient">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground">
              Sign in to your workspace dashboard.
            </p>
          </div>
          {justReset ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
              Password updated. Sign in with your new password.
            </div>
          ) : null}
          <LoginForm next={next} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Link href="/forgot" className="text-primary hover:underline font-medium">
              Forgot password?
            </Link>
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Start free →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
