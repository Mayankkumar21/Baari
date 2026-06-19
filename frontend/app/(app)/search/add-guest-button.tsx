"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addGuestAction, type AddGuestState } from "./actions";

export function AddGuestButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddGuestState, FormData>(
    addGuestAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setJustAdded(true);
      const t = setTimeout(() => {
        setJustAdded(false);
        setOpen(false);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((v) => !v)}>
        <UserPlus className="size-4" /> Add guest
      </Button>
      {open ? (
        <form
          ref={formRef}
          action={action}
          className="absolute right-0 top-full z-30 mt-2 w-80 rounded-lg border border-border bg-card/95 p-4 shadow-xl backdrop-blur"
        >
          <div className="mb-3 text-sm font-semibold">Add guest</div>
          <p className="mb-3 text-xs text-muted-foreground">
            Add a contact without booking yet — useful for enquiries.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="guest_name" className="mb-1 block">
                Name
              </Label>
              <Input id="guest_name" name="name" required maxLength={80} autoFocus />
            </div>
            <div>
              <Label htmlFor="guest_mobile" className="mb-1 block">
                Mobile
              </Label>
              <Input
                id="guest_mobile"
                name="mobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                placeholder="10 digits"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="whatsapp_opt_out"
                className="accent-primary"
              />{" "}
              Don't send WhatsApp
            </label>
            {state.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                {state.error}
              </div>
            ) : null}
            {justAdded ? (
              <div className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Guest added.
              </div>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button type="submit" size="sm" variant="glow" disabled={pending}>
                Add guest
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
