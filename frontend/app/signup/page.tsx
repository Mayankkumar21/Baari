import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="orb -top-32 -left-32 size-[520px] bg-primary/30" />
      <div className="orb -bottom-32 -right-32 size-[420px] bg-primary/20" />
      <Card className="relative z-10 w-full max-w-md">
        <CardContent className="space-y-6 p-7">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-extrabold transition-transform group-hover:scale-105">
                B
              </span>
              <span className="text-sm font-semibold tracking-tight">Baari</span>
            </Link>
            <h1 className="pt-2 text-2xl font-bold tracking-tight text-gradient">
              Start for free
            </h1>
            <p className="text-sm text-muted-foreground">
              Set up your workspace in under a minute. No card needed.
            </p>
          </div>
          <SignupForm initialType={sp.type} />
          <p className="text-center text-xs text-muted-foreground">
            Already on Baari?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
