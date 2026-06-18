"use client";

import { useActionState, useState } from "react";
import { Stethoscope, Scissors, Flower, PawPrint, Store } from "lucide-react";
import { Tooth } from "@/components/icons/tooth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction, type SignupState } from "./actions";
import { cn } from "@/lib/utils";

type TenantOption = {
  key: "clinic" | "dental" | "salon" | "spa" | "vet" | "other";
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const OPTIONS: TenantOption[] = [
  { key: "clinic", label: "Clinic", icon: Stethoscope },
  { key: "dental", label: "Dental", icon: Tooth },
  { key: "salon", label: "Salon", icon: Scissors },
  { key: "spa", label: "Spa", icon: Flower },
  { key: "vet", label: "Vet", icon: PawPrint },
  { key: "other", label: "Other", icon: Store },
];

export function SignupForm({ initialType }: { initialType?: string }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});
  const [tenantType, setTenantType] = useState<TenantOption["key"]>(
    OPTIONS.find((o) => o.key === initialType)?.key ?? "clinic",
  );

  return (
    <form action={action} className="space-y-5">
      {/* Honeypots */}
      <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" />
      <input type="text" name="company_name" autoComplete="off" tabIndex={-1} className="hidden" />

      <div>
        <Label className="mb-2 block">What kind of business?</Label>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTenantType(key)}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs font-medium transition-all backdrop-blur",
                tenantType === key
                  ? "border-primary bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="size-5 text-primary" />
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="tenant_type" value={tenantType} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business_name">Business name</Label>
        <Input id="business_name" name="business_name" required maxLength={120} placeholder="Sharma Clinic" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="owner_name">Your name</Label>
          <Input id="owner_name" name="owner_name" required maxLength={80} autoComplete="name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mobile">Mobile</Label>
          <Input id="mobile" name="mobile" inputMode="numeric" required placeholder="10 digits" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="8+ chars, letters and numbers"
        />
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {state.error}
        </div>
      ) : null}

      <Button type="submit" variant="glow" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
