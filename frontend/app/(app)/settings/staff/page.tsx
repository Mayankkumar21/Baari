import { UserPlus, Crown } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireDoctor } from "@/lib/session";
import { db, schema } from "@/lib/db/client";
import { vocabFor } from "@/lib/vocab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function fmtRelative(iso: Date | null): string {
  if (!iso) return "never";
  const ms = Date.now() - iso.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  const mo = Math.round(days / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.round(mo / 12)}y ago`;
}

export default async function StaffSettingsPage() {
  const sess = await requireDoctor();
  const vocab = vocabFor(sess.clinic.tenantType);
  const staff = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      role: schema.users.role,
      mobile: schema.users.mobile,
      active: schema.users.active,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.clinicId, sess.clinic.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-3">
        <div>
          <CardTitle>Staff</CardTitle>
          <p className="pt-1 text-xs text-muted-foreground">
            People who can sign in and run the dashboard.
          </p>
        </div>
        <Button variant="outline" disabled title="Multi-user workspaces — v2">
          <UserPlus className="size-4" /> Invite teammate
        </Button>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <ul className="space-y-2">
          {staff.map((u) => {
            const isOwner = u.role === "doctor";
            return (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-md border border-border bg-card/60 p-3 backdrop-blur"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{u.name}</span>
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <Crown className="size-2.5" /> Owner
                      </span>
                    ) : null}
                    {u.id === sess.user.id ? (
                      <span className="rounded-full bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        you
                      </span>
                    ) : null}
                    {!u.active ? (
                      <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        disabled
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span className="capitalize">
                      {isOwner ? vocab.providerTitled : vocab.staffTitled}
                    </span>
                    {" · "}
                    <span className="tabular-nums">{u.mobile}</span>
                    {" · "}
                    last login {fmtRelative(u.lastLoginAt)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Multi-user workspaces with role-based access — coming in v2.
        </p>
      </CardContent>
    </Card>
  );
}
