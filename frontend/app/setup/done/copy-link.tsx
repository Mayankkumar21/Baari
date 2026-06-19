"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  if (typeof window !== "undefined" && !hydrated) setHydrated(true);

  const fullUrl = hydrated ? `${window.location.origin}${path}` : path;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 p-2 backdrop-blur">
      <code className="flex-1 truncate px-2 text-xs text-foreground">{fullUrl}</code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            // older browser — fall back to a quick range-select
            const tmp = document.createElement("input");
            tmp.value = fullUrl;
            document.body.appendChild(tmp);
            tmp.select();
            try {
              document.execCommand("copy");
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } finally {
              tmp.remove();
            }
          }
        }}
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-emerald-500" /> Copied
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> Copy
          </>
        )}
      </Button>
    </div>
  );
}
