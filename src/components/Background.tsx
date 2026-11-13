import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { AUDIO } from "../config";
import { theme } from "../theme";

/** Energia de graves da trilha (0–1) no frame atual, para o brilho reagir à batida. */
export const useBass = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = useAudioData(staticFile(AUDIO.music.file));
  if (!data) return 0;
  const bins = visualizeAudio({ fps, frame: frame + AUDIO.music.startFrom, audioData: data, numberOfSamples: 32 });
  return Math.min(1, (bins[0] + bins[1]) * 1.6);
};

/** Fundo de todas as cenas: bg + vinheta radial vermelha no canto inferior. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const breathe = 0.5 + 0.5 * Math.sin(frame / 38);
  return (
    <AbsoluteFill style={{ background: theme.color.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 48% at 88% 104%, rgba(227,30,36,${0.3 + breathe * 0.06}) 0%, rgba(227,30,36,.08) 46%, rgba(227,30,36,0) 72%)`,
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)" }}
      />
    </AbsoluteFill>
  );
};

/** Grão de filme (SVG feTurbulence) por cima de tudo. */
export const Grain: React.FC = () => (
  <AbsoluteFill style={{ opacity: theme.grainOpacity, mixBlendMode: "screen", pointerEvents: "none" }}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

/** Brilho vermelho suave que pulsa devagar atrás dos mockups (e acompanha o kick). */
export const Glow: React.FC<{ size?: number }> = ({ size = 900 }) => {
  const frame = useCurrentFrame();
  const bass = useBass();
  const slow = 0.5 + 0.5 * Math.sin(frame / 22);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.color.redGlow} 0%, rgba(227,30,36,.14) 42%, rgba(227,30,36,0) 68%)`,
        opacity: 0.42 + slow * 0.2 + bass * 0.16,
        transform: `scale(${0.94 + slow * 0.08 + bass * 0.03})`,
        filter: "blur(18px)",
      }}
    />
  );
};
