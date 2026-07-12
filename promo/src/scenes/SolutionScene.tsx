import { AbsoluteFill } from "remotion";
import { brand, fonts, type Layout } from "../theme";
import { useEntry } from "../util";

// Scene 3 — SOLUTION intro (14-21s)
// "Baari runs your front desk on one screen." Simple headline + product
// screenshot mockup as a phone/tablet-ish frame.
export const SolutionScene: React.FC<{ layout: Layout }> = ({ layout }) => {
  const enter = useEntry(2);
  const isReel = layout === "reel";
  const titleSize = isReel ? 64 : layout === "square" ? 72 : 96;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        backgroundColor: brand.white,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: titleSize,
          fontWeight: 800,
          color: brand.navy,
          letterSpacing: -1,
          textAlign: "center",
          lineHeight: 1.05,
          transform: `translateY(${(1 - enter) * 30}px)`,
          opacity: enter,
        }}
      >
        Baari runs your front desk
        <br />
        <span style={{ color: brand.indigo }}>on one screen.</span>
      </div>
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: titleSize * 0.32,
          color: brand.muted,
          marginTop: 40,
          textAlign: "center",
          maxWidth: 900,
          fontWeight: 500,
          opacity: enter,
        }}
      >
        Walk-ins, bookings, family visits, no-shows — all handled from
        the same view. No paper. No phone tag.
      </div>
    </AbsoluteFill>
  );
};
