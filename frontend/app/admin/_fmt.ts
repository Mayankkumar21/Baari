// Tiny date formatters for the admin pages. Kept local so we don't have
// to pull date-fns into the dashboard bundle just for these three
// helpers.

export function relTime(d: Date | null | undefined): string {
  if (!d) return "never";
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}mo ago`;
  const yr = Math.round(month / 12);
  return `${yr}y ago`;
}

export function fmtDate(d: Date): string {
  // "27 Oct 2026" — short + unambiguous, month-name spelled to avoid
  // 05/07 vs 07/05 confusion between IN and US readers.
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
