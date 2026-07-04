// /reset?token=xxx — set a new password after clicking the Resend
// link. Server-validates the token so we render the correct card
// (form vs. expired) without a wasted client round-trip.

import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { hashResetToken } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

async function loadReset(rawToken: string) {
  const hash = hashResetToken(rawToken);
  const [row] = await db
    .select({ user: schema.users })
    .from(schema.passwordResets)
    .innerJoin(schema.users, eq(schema.users.id, schema.passwordResets.userId))
    .where(
      and(
        eq(schema.passwordResets.tokenHash, hash),
        isNull(schema.passwordResets.usedAt),
        gt(schema.passwordResets.expiresAt, new Date()),
        eq(schema.users.active, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";
  const row = token ? await loadReset(token) : null;

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
            {row ? (
              <>
                <h1 className="pt-2 text-2xl font-bold tracking-tight text-gradient">
                  Set a new password
                </h1>
                <p className="text-sm text-muted-foreground">
                  Hi {row.user.name}, pick something you'll remember this time.
                </p>
              </>
            ) : (
              <>
                <h1 className="pt-2 text-2xl font-bold tracking-tight text-gradient">
                  Link expired
                </h1>
                <p className="text-sm text-muted-foreground">
                  This reset link has expired or was already used.
                </p>
              </>
            )}
          </div>
          {row ? (
            <ResetForm token={token} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Password reset links are single-use and expire after 30 minutes. Start a new reset from the app.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                Back to sign in →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
