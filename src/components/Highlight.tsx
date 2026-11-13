import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Rect } from "../config";
import { theme } from "../theme";

/** Moldura vermelha com glow: entra com scale .9→1 e pulsa 2 vezes. `unit` = escala do traço. */
export const Highlight: React.FC<{ rect: Rect; at: number; unit?: number }> = ({ rect, at, unit = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  const enter = spring({ frame: t, fps, config: { damping: 14, stiffness: 180 } });
  // dois pulsos de 14 frames logo após a entrada
  const pulse = t > 6 && t < 34 ? Math.sin(((t - 6) / 14) * Math.PI) ** 2 : 0;
  const glow = 18 + pulse * 26;
  return (
    <div
      style={{
        position: "absolute",
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.w}%`,
        height: `${rect.h}%`,
        border: `${3 * unit}px solid ${theme.color.red}`,
        borderRadius: 14 * unit,
        boxSizing: "border-box",
        opacity: interpolate(t, [0, 4], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${0.9 + 0.1 * enter + pulse * 0.025})`,
        boxShadow: `0 0 ${glow * unit}px ${theme.color.redGlow}, inset 0 0 ${glow * 0.6 * unit}px rgba(227,30,36,.22)`,
        background: `rgba(227,30,36,${0.05 + pulse * 0.05})`,
      }}
    />
  );
};
