import { Composition } from "remotion";
import { BaariPromo } from "./BaariPromo";

// Total duration derived from the scene list in ./scenes.
// If you change a scene's duration, update FRAMES here too.
const FPS = 30;
const DURATION_FRAMES = FPS * 42; // 42 seconds — matches the scene list

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Landscape 1080p — for landing hero, YouTube, presentations. */}
      <Composition
        id="BaariPromo"
        component={BaariPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* Square — for Instagram feed, LinkedIn, WhatsApp forwards. */}
      <Composition
        id="BaariPromoSquare"
        component={BaariPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={{ layout: "square" as const }}
      />
      {/* Vertical 9:16 — for Reels, Shorts, WhatsApp Status. */}
      <Composition
        id="BaariPromoReel"
        component={BaariPromo}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ layout: "reel" as const }}
      />
    </>
  );
};
