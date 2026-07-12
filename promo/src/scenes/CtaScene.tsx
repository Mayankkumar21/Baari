import { AbsoluteFill, useCurrentFrame } from "remotion";
import { brand, fonts, type Layout } from "../theme";
import { progress, useEntry } from "../util";

// Scene 6 — CTA (37-42s)
// Big logo lockup, "free during early access," WhatsApp number. Ends
// on the brand mark so it lingers in the viewer's memory.
export const CtaScene: React.FC<{ layout: Layout }> = ({ layout }) => {
  const enter = useEntry(2);
  const frame = useCurrentFrame();
  const details = progress(frame, 45, 75);
  const isReel = layout === "reel";
  const badgeSize = isReel ? 260 : layout === "square" ? 220 : 300;
  const nameSize = isReel ? 96 : layout === "square" ? 108 : 148;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
        backgroundColor: brand.white,
      }}
    >
      {/* Badge — mirrors the app icon */}
      <div
        style={{
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize * 0.24,
          backgroundColor: brand.indigo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${0.7 + 0.3 * enter})`,
          opacity: enter,
          boxShadow: `0 24px 60px ${brand.indigo}30`,
        }}
      >
        <BMark size={badgeSize} />
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontSize: nameSize,
          fontWeight: 800,
          color: brand.navy,
          marginTop: 32,
          letterSpacing: -3,
          lineHeight: 1,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 20}px)`,
        }}
      >
        baari
      </div>
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: nameSize * 0.22,
          color: brand.muted,
          marginTop: 12,
          fontWeight: 500,
          opacity: enter,
        }}
      >
        Your turn, simplified.
      </div>
      <div
        style={{
          marginTop: 40,
          opacity: details,
          transform: `translateY(${(1 - details) * 20}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 28,
            color: brand.indigo,
            fontWeight: 700,
          }}
        >
          Free during early access.
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 24,
            color: brand.navy,
            marginTop: 12,
            fontWeight: 600,
          }}
        >
          getbaari.in &nbsp;·&nbsp; +91 98931 27527
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Vector "b" mark — drawn to match the icon.png design. Same shape at
// every resolution because it's SVG geometry, not a raster.
const BMark: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg
      width={size * 0.62}
      height={size * 0.62}
      viewBox="0 0 100 100"
      fill="none"
    >
      {/* Vertical stem of the b */}
      <rect x="18" y="10" width="14" height="80" rx="3" fill={brand.white} />
      {/* Circular counter (loop) */}
      <circle cx="55" cy="62" r="27" fill={brand.white} />
      {/* Coral inner dot */}
      <circle cx="55" cy="62" r="10" fill={brand.coral} />
    </svg>
  );
};
