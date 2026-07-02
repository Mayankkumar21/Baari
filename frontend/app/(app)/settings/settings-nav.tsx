"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Clock, Lock, Smartphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings/workspace", label: "Workspace", icon: Building2 },
  { href: "/settings/hours", label: "Opening hours", icon: Clock },
  { href: "/settings/bookings", label: "App bookings", icon: Smartphone },
  { href: "/settings/staff", label: "Staff", icon: Users },
  { href: "/settings/account", label: "Account", icon: Lock },
];

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
              active
                ? "bg-primary/10 text-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.5)]"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
