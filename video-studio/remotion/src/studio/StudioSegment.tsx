import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Contrato gerado por scripts/produce.mjs a partir de timeline.json
export type StudioScene = {
  id: string;
  template: "title" | "bullets" | "outro";
  heading: string;
  sub?: string;
  bullets?: string[];
  frames: number;
};

export type SegmentProps = {
  fps: number;
  theme?: { bg: string; ink: string; accent: string };
  scenes: StudioScene[];
};

const DEFAULT_THEME = { bg: "#0b1020", ink: "#f5f7ff", accent: "#4cc9f0" };

export const calculateSegmentMetadata: CalculateMetadataFunction<SegmentProps> = ({ props }) => ({
  fps: props.fps,
  durationInFrames: Math.max(1, props.scenes.reduce((a, s) => a + s.frames, 0)),
});

const Background: React.FC<{ theme: typeof DEFAULT_THEME }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const x = 50 + Math.sin(frame / 90) * 20;
  const y = 50 + Math.cos(frame / 120) * 20;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${x}% ${y}%, ${theme.accent}33 0%, ${theme.bg} 55%)`,
        backgroundColor: theme.bg,
      }}
    />
  );
};

const Scene: React.FC<{ scene: StudioScene; theme: typeof DEFAULT_THEME }> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const exit = interpolate(frame, [scene.frames - 12, scene.frames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineW = interpolate(frame, [8, 30], [0, 240], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        padding: "0 180px",
        fontFamily: "Segoe UI, Arial, sans-serif",
        color: theme.ink,
        opacity: exit,
        alignItems: scene.template === "bullets" ? "flex-start" : "center",
        textAlign: scene.template === "bullets" ? "left" : "center",
      }}
    >
      <div
        style={{
          fontSize: scene.template === "title" ? 110 : 84,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          transform: `translateY(${(1 - enter) * 60}px)`,
          opacity: enter,
        }}
      >
        {scene.heading}
      </div>
      <div style={{ height: 8, width: lineW, background: theme.accent, borderRadius: 4, margin: "28px 0" }} />
      {scene.sub ? (
        <div
          style={{
            fontSize: 44,
            opacity: interpolate(frame, [15, 35], [0, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {scene.sub}
        </div>
      ) : null}
      {(scene.bullets ?? []).map((b, i) => {
        const s = spring({ frame: frame - 20 - i * 12, fps, config: { damping: 200 } });
        return (
          <div
            key={b}
            style={{ fontSize: 52, margin: "14px 0", opacity: s, transform: `translateX(${(1 - s) * -80}px)` }}
          >
            <span style={{ color: theme.accent, marginRight: 24 }}>●</span>
            {b}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const StudioSegment: React.FC<SegmentProps> = ({ scenes, theme }) => {
  const t = theme ?? DEFAULT_THEME;
  let from = 0;
  return (
    <AbsoluteFill>
      <Background theme={t} />
      {scenes.map((s) => {
        const seq = (
          <Sequence key={s.id} from={from} durationInFrames={s.frames}>
            <Scene scene={s} theme={t} />
          </Sequence>
        );
        from += s.frames;
        return seq;
      })}
    </AbsoluteFill>
  );
};
