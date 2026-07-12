import { spring, useCurrentFrame, useVideoConfig } from "remotion";

// Buttery entry animation — one hook, use everywhere.
// Returns 0 → 1 over `springFrom` frames. Damping is set softish so
// text doesn't jitter mid-scene.
export function useEntry(springFrom = 0, config = { damping: 20, mass: 0.6 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - springFrom,
    fps,
    config,
    durationInFrames: 24,
  });
}

// Linear progress between two absolute frames. Clamps to [0,1].
export function progress(frame: number, start: number, end: number): number {
  if (frame <= start) return 0;
  if (frame >= end) return 1;
  return (frame - start) / (end - start);
}
