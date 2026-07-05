"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListOrdered, Search, BarChart3, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vocab } from "@/lib/vocab";

export function AppNav({ isDoctor, vocab: _vocab }: { isDoctor: boolean; vocab: Vocab }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const items = [
    { href: "/queue", label: "Queue", icon: ListOrdered, show: true },
    { href: "/search", label: "Search", icon: Search, show: true },
    { href: "/reports", label: "Reports", icon: BarChart3, show: isDoctor },
    { href: "/settings", label: "Settings", icon: Settings, show: isDoctor },
  ].filter((i) => i.show);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <nav className="hidden md:flex items-center gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              // data-tour-id lets the first-signup coach-mark tour
              // anchor a step to the Settings nav item without the
              // tour needing to know CSS internals of the header.
              data-tour-id={href === "/settings" ? "settings-link" : undefined}
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        className="md:hidden inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-x-0 bottom-0 top-14 z-40 bg-background/60 backdrop-blur-sm"
          />
          <div
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="md:hidden fixed inset-x-0 top-14 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200"
          >
            <nav className="container flex flex-col gap-1 py-3">
              {items.map(({ href, label, icon: Icon }) => {
                const active = path === href || path.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition-colors",
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" /> {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
