# Baari promo

React + Remotion source for the Baari product video. Same source renders
three aspect ratios for different channels — landing page hero, feed post,
Reel / WhatsApp Status.

## Quick start

```bash
cd promo
npm install         # first time only
npm start           # live preview at http://localhost:3000
```

## Render

```bash
npm run build           # 1920×1080 landscape → out/baari-promo.mp4
npm run build:square    # 1080×1080 square    → out/baari-promo-square.mp4
npm run build:reel      # 1080×1920 vertical  → out/baari-promo-reel.mp4
```

Renders take ~30-60 seconds each depending on your machine.

## Where the scenes live

```
src/BaariPromo.tsx      → scene list + total duration
src/scenes/
  HookScene.tsx         → 0-5s   "Saturday. 4 PM. Your salon is packed."
  ProblemScene.tsx      → 5-14s  Cascading pain points
  SolutionScene.tsx     → 14-21s "Baari runs your front desk on one screen"
  WalkinScene.tsx       → 21-28s Phone mockup — walk-in flow demo
  AnalyticsScene.tsx    → 28-37s Stat tiles with counting numbers
  CtaScene.tsx          → 37-42s Logo lockup + CTA
```

Scene durations live in `BaariPromo.tsx` — change `seconds` and everything
downstream (Root.tsx total) updates.

## Design tokens

Colors, fonts, and layout tokens are centralized in `src/theme.ts`. Change
brand.indigo (or any other) and every scene picks it up.

## Notes

- **No real screenshots** — every "screen" is composed in Remotion so the
  video never goes stale when the app UI evolves.
- **Layout-aware** — each scene reads a `layout` prop (`landscape` /
  `square` / `reel`) and adapts font sizes + column layout for each.
- **Sound**: no audio bed yet. Add a `<Audio src="..." />` inside the
  Composition when you have a music track. The narration approach is
  captions-only for now (fits WhatsApp autoplay-muted context).
