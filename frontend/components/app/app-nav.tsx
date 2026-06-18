"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListOrdered, Search, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vocab } from "@/lib/vocab";

export function AppNav({ isDoctor, vocab }: { isDoctor: boolean; vocab: Vocab }) {
  const path = usePathname();
  const items = [
    { href: "/queue", label: "Queue", icon: ListOrdered, show: true },
    { href: "/search", label: "Search", icon: Search, show: true },
    { href: "/reports", label: "Reports", icon: BarChart3, show: isDoctor },
    { href: "/settings", label: "Settings", icon: Settings, show: isDoctor },
  ];
  return (
    <nav className="hidden md:flex items-center gap-1">
      {items
        .filter((i) => i.show)
        .map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          );
        })}
    </nav>
  );
}
