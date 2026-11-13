import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** Foto com zoom 1.05→1.18 e pan lento + degradê preto + tint vermelho 12%. */
export const KenBurns: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1.05 + 0.13 * t}) translate(${-2 + 4 * t}%, ${1.5 - 3 * t}%)`,
        }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 40%, rgba(0,0,0,.8) 100%)" }} />
      <AbsoluteFill style={{ background: "rgba(227,30,36,.12)", mixBlendMode: "multiply" }} />
      <AbsoluteFill style={{ background: "rgba(227,30,36,.12)", mixBlendMode: "screen", opacity: 0.5 }} />
    </AbsoluteFill>
  );
};
