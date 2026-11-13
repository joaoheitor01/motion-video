import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Check } from "./icons";

/** Selo "✓ Concluído" no estilo do app, com animação de carimbo. */
export const Seal: React.FC<{ text: string; at: number; size?: number }> = ({ text, at, size = 84 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  const s = spring({ frame: t, fps, config: { damping: 9, stiffness: 190, mass: 0.7 } });
  const ring = interpolate(t, [0, 16], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          width: size * 7.2,
          height: size * 2.3,
          borderRadius: 999,
          border: `4px solid ${theme.color.sealBg}`,
          opacity: (1 - ring) * 0.8,
          transform: `scale(${1 + ring * 0.5})`,
        }}
      />
      <div
        style={{
          opacity: interpolate(t, [0, 3], [0, 1], { extrapolateRight: "clamp" }),
          transform: `scale(${1.6 - 0.6 * s}) rotate(${-9 + 5 * s}deg)`,
          display: "flex",
          alignItems: "center",
          gap: size * 0.26,
          padding: `${size * 0.36}px ${size * 0.8}px ${size * 0.36}px ${size * 0.6}px`,
          borderRadius: 999,
          background: theme.color.sealBg,
          border: `4px solid ${theme.color.sealText}`,
          boxShadow: "0 24px 70px rgba(0,0,0,.6), 0 0 60px rgba(30,142,78,.35)",
          fontFamily: theme.font.body,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1,
          color: theme.color.sealText,
          whiteSpace: "nowrap",
        }}
      >
        <Check size={size * 1.05} color={theme.color.sealText} stroke={3.6} />
        {text}
      </div>
    </div>
  );
};
