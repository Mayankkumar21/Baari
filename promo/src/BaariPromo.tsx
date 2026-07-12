import { AbsoluteFill, Series } from "remotion";
import { brand, fonts, type Layout } from "./theme";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionScene } from "./scenes/SolutionScene";
import { WalkinScene } from "./scenes/WalkinScene";
import { AnalyticsScene } from "./scenes/AnalyticsScene";
import { CtaScene } from "./scenes/CtaScene";

// Scene lengths in seconds. Adjust here to retime; Root.tsx picks up
// the total by summing (via the FPS × TOTAL_SECONDS constant).
const FPS = 30;

const scenes: { seconds: number; render: (l: Layout) => JSX.Element }[] = [
  { seconds: 5, render: (l) => <HookScene layout={l} /> },
  { seconds: 9, render: (l) => <ProblemScene layout={l} /> },
  { seconds: 7, render: (l) => <SolutionScene layout={l} /> },
  { seconds: 7, render: (l) => <WalkinScene layout={l} /> },
  { seconds: 9, render: (l) => <AnalyticsScene layout={l} /> },
  { seconds: 5, render: (l) => <CtaScene layout={l} /> },
];

export const BaariPromo: React.FC<{ layout?: Layout }> = ({
  layout = "landscape",
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.bg,
        fontFamily: fonts.body,
      }}
    >
      <Series>
        {scenes.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.seconds * FPS}>
            {s.render(layout)}
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
};
