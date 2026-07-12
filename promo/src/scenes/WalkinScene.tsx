import { AbsoluteFill, useCurrentFrame } from "remotion";
import { brand, fonts, type Layout } from "../theme";
import { progress } from "../util";

// Scene 4 — WALK-IN demo (21-28s)
// A stylized phone showing the walk-in flow. Two taps → customer in
// queue. No real screenshots (would go stale) — hand-composed mock.
export const WalkinScene: React.FC<{ layout: Layout }> = ({ layout }) => {
  const frame = useCurrentFrame();
  const isReel = layout === "reel";
  const phoneW = isReel ? 380 : layout === "square" ? 340 : 420;
  const phoneH = phoneW * 2.05;

  // Timing: entry → type name → type mobile → submit → success card
  const enter = progress(frame, 2, 20);
  const nameFilled = progress(frame, 40, 60);
  const mobileFilled = progress(frame, 65, 90);
  const submitted = progress(frame, 100, 115);
  const successOpacity = progress(frame, 118, 138);

  const headline = isReel ? 46 : layout === "square" ? 52 : 64;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 40,
        backgroundColor: brand.indigoSoft,
        flexDirection: isReel ? "column" : "row",
        gap: 60,
      }}
    >
      {/* Left / top: message */}
      <div
        style={{
          maxWidth: 600,
          fontFamily: fonts.display,
          color: brand.navy,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 20}px)`,
          textAlign: isReel ? "center" : "left",
        }}
      >
        <div
          style={{
            fontSize: headline,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -1,
          }}
        >
          Add a walk-in
          <br />
          <span style={{ color: brand.indigo }}>in two taps.</span>
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: headline * 0.42,
            color: brand.muted,
            marginTop: 20,
            fontWeight: 500,
          }}
        >
          Name. Mobile. Done. They're in the queue.
        </div>
      </div>

      {/* Right / bottom: phone mock */}
      <div
        style={{
          width: phoneW,
          height: phoneH,
          borderRadius: 48,
          backgroundColor: "#0F172A",
          padding: 12,
          boxShadow: "0 30px 80px rgba(30,38,87,0.25)",
          transform: `translateY(${(1 - enter) * 40}px) scale(${
            0.9 + 0.1 * enter
          })`,
          opacity: enter,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 40,
            backgroundColor: brand.white,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            padding: 24,
            gap: 16,
            position: "relative",
          }}
        >
          {/* Sheet grab */}
          <div
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: brand.border,
            }}
          />
          <div
            style={{
              fontFamily: fonts.display,
              fontSize: 28,
              fontWeight: 700,
              color: brand.navy,
            }}
          >
            Walk-in
          </div>
          <div style={{ fontSize: 14, color: brand.muted }}>
            Someone who just showed up at the counter.
          </div>

          {/* Name field */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: brand.muted,
              marginTop: 12,
              fontWeight: 600,
            }}
          >
            NAME
          </div>
          <TextField
            filled={nameFilled}
            text="Rakesh Singh"
            placeholder="Full name"
          />

          {/* Mobile field */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: brand.muted,
              fontWeight: 600,
            }}
          >
            MOBILE
          </div>
          <TextField
            filled={mobileFilled}
            text="98931 27527"
            placeholder="10 digits"
          />

          {/* Submit button */}
          <div
            style={{
              marginTop: 16,
              padding: "16px 20px",
              borderRadius: 14,
              backgroundColor: brand.indigo,
              color: brand.white,
              textAlign: "center",
              fontFamily: fonts.body,
              fontWeight: 700,
              fontSize: 16,
              transform: `scale(${1 - 0.05 * submitted})`,
              opacity: 1 - 0.35 * submitted,
            }}
          >
            Add walk-in
          </div>

          {/* Success overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(255,255,255,0.98)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 24,
              opacity: successOpacity,
              transform: `scale(${0.9 + 0.1 * successOpacity})`,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: brand.success,
                color: brand.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 800,
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontFamily: fonts.display,
                fontSize: 22,
                fontWeight: 700,
                color: brand.navy,
              }}
            >
              T-4 · Rakesh Singh
            </div>
            <div style={{ fontSize: 14, color: brand.muted }}>
              In the queue · Position 4
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TextField: React.FC<{
  filled: number;
  text: string;
  placeholder: string;
}> = ({ filled, text, placeholder }) => {
  // As `filled` progresses 0→1, reveal characters left-to-right.
  const chars = Math.floor(text.length * filled);
  const shown = text.slice(0, chars);
  return (
    <div
      style={{
        height: 48,
        borderRadius: 12,
        border: `1px solid ${brand.border}`,
        backgroundColor: brand.bg,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        fontFamily: fonts.body,
        fontSize: 18,
        color: filled > 0.05 ? brand.navy : brand.muted,
        fontWeight: filled > 0.05 ? 600 : 400,
      }}
    >
      {filled > 0.05 ? shown : placeholder}
      {filled > 0.05 && filled < 0.98 ? (
        <span style={{ color: brand.indigo, marginLeft: 2 }}>|</span>
      ) : null}
    </div>
  );
};
