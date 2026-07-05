"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarX, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addClosedDay, removeClosedDay, type AddClosedDayState } from "./closed-days-actions";

type Row = { id: number; date: string; reason: string | null };

// Format YYYY-MM-DD → "Mon, 15 Aug 2026" for the list display.
function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ClosedDaysCard({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [addState, addAction, addPending] = useActionState<AddClosedDayState, FormData>(
    async (prev, fd) => {
      const result = await addClosedDay(prev, fd);
      // On success, optimistically add to the local list so the row
      // appears immediately without a full page refresh. The
      // revalidatePath in the action still triggers an RSC refetch
      // that'll reconcile any drift.
      if (result.ok) {
        const iso = String(fd.get("date") ?? "");
        const reason = String(fd.get("reason") ?? "").trim() || null;
        if (iso && !rows.some((r) => r.date === iso)) {
          setRows((cur) =>
            [...cur, { id: -Date.now(), date: iso, reason }].sort((a, b) =>
              a.date.localeCompare(b.date),
            ),
          );
        }
      }
      return result;
    },
    {},
  );
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [_removePending, startRemove] = useTransition();

  const onRemove = (id: number) => {
    setRemovingId(id);
    startRemove(async () => {
      const result = await removeClosedDay(id);
      if (result.ok) setRows((cur) => cur.filter((r) => r.id !== id));
      setRemovingId(null);
    });
  };

  // Minimum allowable value for the date picker — today in local
  // Chennai/Bangalore/etc. Prevents backdating clicks.
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader className="p-6 pb-3">
        <CardTitle>Closed days</CardTitle>
        <p className="pt-1 text-xs text-muted-foreground">
          One-off dates you&apos;re closed on top of the weekly schedule —
          holidays, staff leave, renovation. Customers can&apos;t book these
          days from the app.
        </p>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-5">
        <form action={addAction} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="closed-date">Date</Label>
            <Input
              id="closed-date"
              name="date"
              type="date"
              required
              min={todayIso}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="closed-reason">Reason (optional)</Label>
            <Input
              id="closed-reason"
              name="reason"
              type="text"
              maxLength={120}
              placeholder="e.g. Diwali, Dr. Sharma on leave"
            />
          </div>
          <Button type="submit" variant="glow" disabled={addPending}>
            <Plus className="size-4" />
            {addPending ? "Saving…" : "Add closed day"}
          </Button>
        </form>

        {addState.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {addState.error}
          </div>
        ) : null}
        {addState.ok ? (
          <div className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-300">
            Closed day saved.
          </div>
        ) : null}

        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            Upcoming
          </div>
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
              <CalendarX className="size-4 inline-block mr-1.5 -mt-0.5" />
              No closed days set.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{fmtDate(r.date)}</div>
                    {r.reason ? (
                      <div className="text-xs text-muted-foreground truncate">{r.reason}</div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(r.id)}
                    disabled={removingId === r.id}
                  >
                    <Trash2 className="size-4" />
                    {removingId === r.id ? "Removing…" : "Remove"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
