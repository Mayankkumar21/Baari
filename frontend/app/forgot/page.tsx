import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotForm } from "./forgot-form";

export default function ForgotPage() {
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
              Forgot password
            </h1>
            <p className="text-sm text-muted-foreground">
              We'll email you a link to set a new one.
            </p>
          </div>
          <ForgotForm />
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline font-medium">
              ← Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
