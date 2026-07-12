import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { brand, fonts, type Layout } from "../theme";
import { useEntry } from "../util";

// Scene 1 — HOOK (0-5s)
// The big "your front desk is bleeding" line. Set the tone: honest,
// not corporate.
export const HookScene: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const line1 = useEntry(6);
  const line2 = useEntry(24);
  const line3 = useEntry(48);
  const opacity = interpolate(frame, [130, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isReel = layout === "reel";
  const fontSize = isReel ? 88 : layout === "square" ? 96 : 128;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        backgroundColor: brand.white,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontSize,
          fontWeight: 800,
          color: brand.navy,
          textAlign: "center",
          lineHeight: 1.05,
          letterSpacing: -1.5,
        }}
      >
        <div
          style={{
            transform: `translateY(${(1 - line1) * 40}px)`,
            opacity: line1,
          }}
        >
          Saturday. 4 PM.
        </div>
        <div
          style={{
            transform: `translateY(${(1 - line2) * 40}px)`,
            opacity: line2,
            color: brand.indigo,
            marginTop: 8,
          }}
        >
          Your salon is packed.
        </div>
        <div
          style={{
            transform: `translateY(${(1 - line3) * 40}px)`,
            opacity: line3,
            fontSize: fontSize * 0.4,
            fontWeight: 500,
            color: brand.muted,
            marginTop: 40,
            letterSpacing: 0,
          }}
        >
          And the paper token book is losing.
        </div>
      </div>
    </AbsoluteFill>
  );
};
