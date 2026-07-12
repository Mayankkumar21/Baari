// Design tokens — match the mobile app + landing page exactly.
// Change one place, every scene follows.

export const brand = {
  indigo: "#4F46E5",
  indigoDeep: "#3730A3",
  indigoSoft: "#EEF2FF",
  navy: "#1E2657",
  coral: "#F87171",
  bg: "#F8FAFC",
  white: "#FFFFFF",
  muted: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  successSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
} as const;

export const fonts = {
  display:
    "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  body: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
} as const;

export type Layout = "landscape" | "square" | "reel";
