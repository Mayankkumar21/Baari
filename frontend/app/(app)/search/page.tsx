import Link from "next/link";
import { Search } from "lucide-react";
import { and, eq, ilike, or } from "drizzle-orm";
import { requireSetup } from "@/lib/session";
import { db, schema } from "@/lib/db/client";
import { vocabFor } from "@/lib/vocab";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

async function search(clinicId: number, q: string) {
  if (!q || q.length < 2) return [];
  const like = `%${q}%`;
  return db
    .select({
      id: schema.bookings.id,
      token: schema.bookings.token,
      slotTime: schema.bookings.slotTime,
      reason: schema.bookings.reason,
      status: schema.bookings.status,
      patientName: schema.patients.name,
      patientMobile: schema.patients.mobile,
    })
    .from(schema.bookings)
    .innerJoin(schema.patients, eq(schema.bookings.patientId, schema.patients.id))
    .where(
      and(
        eq(schema.bookings.clinicId, clinicId),
        or(ilike(schema.patients.name, like), ilike(schema.patients.mobile, like)),
      ),
    )
    .orderBy(schema.bookings.slotTime)
    .limit(30);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sess = await requireSetup();
  const vocab = vocabFor(sess.clinic.tenantType);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const results = await search(sess.clinic.id, q);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Find a {vocab.entitySingular} by name or mobile.
        </p>
      </div>

      <form className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Name or 10-digit mobile…"
          className="h-12 pl-10 text-base"
        />
      </form>

      <Card>
        <CardContent className="p-4">
          {q.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Type at least two characters to search.
            </p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No matches.</p>
          ) : (
            <ul className="space-y-1.5">
              {results.map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between rounded-md border border-border bg-card/60 p-3 backdrop-blur transition-all hover:border-primary/40 hover:translate-x-0.5">
                    <div>
                      <div className="font-semibold">
                        T{r.token} · {r.patientName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.patientMobile} · {fmtDateTime(r.slotTime)} ·{" "}
                        <span className="capitalize">{r.status.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
