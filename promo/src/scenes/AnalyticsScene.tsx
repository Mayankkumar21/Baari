import { AbsoluteFill, useCurrentFrame } from "remotion";
import { brand, fonts, type Layout } from "../theme";
import { progress } from "../util";

// Scene 5 — ANALYTICS (28-37s)
// Show the "dashboard" stat tiles with numbers counting up. Not a real
// screenshot — a stylized composition that reads as data-rich.
const stats: {
  label: string;
  target: number;
  suffix?: string;
  prefix?: string;
  tone: "brand" | "success" | "warning";
}[] = [
  { label: "Today's revenue", target: 18400, prefix: "₹", tone: "brand" },
  { label: "Customers", target: 47, tone: "brand" },
  { label: "Repeat %", target: 64, suffix: "%", tone: "success" },
  { label: "Missed walk-ins", target: 3, tone: "warning" },
];

export const AnalyticsScene: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const isReel = layout === "reel";
  const titleSize = isReel ? 52 : layout === "square" ? 60 : 76;
  const numberSize = isReel ? 56 : layout === "square" ? 64 : 84;

  const cols = isReel ? "1fr 1fr" : "1fr 1fr 1fr 1fr";
  const titleOp = progress(frame, 4, 24);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: isReel ? 60 : 120,
        backgroundColor: brand.bg,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: titleSize,
          fontWeight: 800,
          color: brand.navy,
          letterSpacing: -1,
          marginBottom: 40,
          opacity: titleOp,
          transform: `translateY(${(1 - titleOp) * 20}px)`,
          lineHeight: 1.05,
        }}
      >
        Numbers your owner
        <br />
        <span style={{ color: brand.indigo }}>actually checks.</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          gap: 24,
        }}
      >
        {stats.map((s, i) => {
          const start = 26 + i * 14;
          const op = progress(frame, start, start + 20);
          const count = progress(frame, start + 5, start + 55);
          const value = Math.round(s.target * count);
          const toneColor =
            s.tone === "success"
              ? brand.success
              : s.tone === "warning"
                ? brand.warning
                : brand.indigo;
          const toneSoft =
            s.tone === "success"
              ? brand.successSoft
              : s.tone === "warning"
                ? brand.warningSoft
                : brand.indigoSoft;
          return (
            <div
              key={s.label}
              style={{
                backgroundColor: brand.white,
                borderRadius: 24,
                padding: 32,
                boxShadow: "0 4px 20px rgba(30,38,87,0.06)",
                border: `1px solid ${brand.border}`,
                opacity: op,
                transform: `translateY(${(1 - op) * 24}px)`,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 999,
                  backgroundColor: toneSoft,
                  color: toneColor,
                  fontFamily: fonts.body,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontSize: numberSize,
                  fontWeight: 800,
                  color: brand.navy,
                  marginTop: 20,
                  letterSpacing: -1.5,
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.prefix ?? ""}
                {value.toLocaleString("en-IN")}
                {s.suffix ?? ""}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 32,
          fontFamily: fonts.body,
          fontSize: 24,
          color: brand.muted,
          fontWeight: 500,
          opacity: progress(frame, 210, 240),
        }}
      >
        Peak hours, repeat customers, silent-churn list — all in one place.
      </div>
    </AbsoluteFill>
  );
};
