import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { CUTS, SCENES, TRANSITIONS, TRANSITION_FRAMES, sceneTiming } from "./config";
import { theme } from "./theme";
import { AudioTrack } from "./audio/AudioTrack";
import { Background, Grain } from "./components/Background";
import { SCENE_COMPONENTS } from "./scenes";

/** Flash vermelho rápido cobrindo o corte 2→3. */
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const cut = CUTS[2];
  const n = SCENES.s2.flashFrames;
  const o = interpolate(frame, [cut - n, cut - 1, cut + 1, cut + n], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: theme.color.red, opacity: o }} />;
};

export const RageAreaAluno: React.FC = () => {
  const items: React.ReactNode[] = [];
  SCENE_COMPONENTS.forEach((Scene, i) => {
    const n = i + 1;
    const { duration } = sceneTiming(n);
    const kind = TRANSITIONS[n] ?? "cut";
    const nextKind = TRANSITIONS[n + 1] ?? "cut";
    if (i > 0 && kind !== "cut") {
      items.push(
        <TransitionSeries.Transition
          key={`t${n}`}
          presentation={kind === "slide" ? slide({ direction: "from-bottom" }) : fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />,
      );
    }
    // A cena anterior a uma transição ganha os frames da sobreposição, para o
    // início da próxima continuar exatamente na batida.
    const extra = nextKind !== "cut" && n < SCENE_COMPONENTS.length ? TRANSITION_FRAMES : 0;
    items.push(
      <TransitionSeries.Sequence key={`s${n}`} durationInFrames={duration + extra}>
        <Scene duration={duration} />
      </TransitionSeries.Sequence>,
    );
  });

  return (
    <AbsoluteFill style={{ background: theme.color.bg }}>
      <Background />
      <TransitionSeries>{items}</TransitionSeries>
      <Flash />
      <Grain />
      <AudioTrack />
    </AbsoluteFill>
  );
};
