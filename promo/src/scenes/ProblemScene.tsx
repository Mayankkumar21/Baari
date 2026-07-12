import { AbsoluteFill, useCurrentFrame } from "remotion";
import { brand, fonts, type Layout } from "../theme";
import { progress } from "../util";

// Scene 2 — PROBLEM (5-14s)
// Cascade the pain points as a stacked list. Each line pops in with a
// half-second offset so viewers can read.
const problems = [
  "Three phones ringing at once",
  "Family of 4 = 4 confused tokens",
  "\"Rakesh who?\" — last visit 3 months ago, forgotten",
  "Walk-ins turned away, gone forever",
  "End of day: no idea how much cash came in",
];

export const ProblemScene: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const isReel = layout === "reel";
  const titleSize = isReel ? 56 : layout === "square" ? 64 : 80;
  const itemSize = isReel ? 40 : layout === "square" ? 46 : 56;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "flex-start",
        padding: isReel ? 60 : 120,
        backgroundColor: brand.bg,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: titleSize,
          fontWeight: 700,
          color: brand.muted,
          marginBottom: 40,
          opacity: progress(frame, 4, 22),
          letterSpacing: -0.5,
        }}
      >
        Every busy day, the same thing:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {problems.map((p, i) => {
          const start = 22 + i * 18;
          const op = progress(frame, start, start + 12);
          const slide = (1 - op) * 20;
          return (
            <div
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                transform: `translateX(-${slide}px)`,
                opacity: op,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: brand.coral,
                }}
              />
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: itemSize,
                  color: brand.navy,
                  fontWeight: 500,
                }}
              >
                {p}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
