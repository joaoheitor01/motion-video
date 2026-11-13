import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Chip, SceneText } from "../config";
import { theme } from "../theme";
import { Glow } from "./Background";
import { Check } from "./icons";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const { safe, color, font } = theme;

/** Etiqueta: pílula com borda vermelha + filete dourado embaixo. */
export const Label: React.FC<{ text: string; align?: "left" | "center" }> = ({ text, align = "left" }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 8], [0, 1], clamp);
  return (
    <div
      style={{
        opacity: o,
        transform: `translateY(${(1 - o) * 12}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        marginBottom: 26,
      }}
    >
      <div
        style={{
          border: `2px solid ${color.red}`,
          borderRadius: 999,
          padding: "11px 26px 11px 30px",
          fontFamily: font.mono,
          fontWeight: 700,
          fontSize: 26,
          lineHeight: 1.1,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: color.red,
          background: "rgba(11,11,13,.6)",
        }}
      >
        {text}
      </div>
      <div style={{ width: 72, height: 2, background: color.gold, marginTop: 14, marginLeft: align === "center" ? 0 : 30 }} />
    </div>
  );
};

/** Título em Anton: entra linha a linha; última palavra em vermelho com glow. */
export const Title: React.FC<{ lines: string[]; size: number; align?: "left" | "center"; delay?: number }> = ({
  lines,
  size,
  align = "left",
  delay = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        fontFamily: font.title,
        fontSize: size,
        lineHeight: 0.95,
        textTransform: "uppercase",
        color: color.white,
        textAlign: align,
        letterSpacing: "0.005em",
      }}
    >
      {lines.map((line, i) => {
        const s = spring({ frame: frame - delay - i * 9, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
        const isLast = i === lines.length - 1;
        const words = line.split(" ");
        const head = isLast ? words.slice(0, -1).join(" ") : line;
        const tail = isLast ? words[words.length - 1] : "";
        return (
          <div
            key={i}
            style={{
              opacity: interpolate(s, [0, 0.6], [0, 1], clamp),
              transform: `translateY(${(1 - s) * 40}px)`,
              whiteSpace: "nowrap",
              textShadow: "0 4px 30px rgba(0,0,0,.7)",
              paddingTop: size * 0.06,
            }}
          >
            {head}
            {head && tail ? " " : ""}
            {tail ? (
              <span style={{ color: color.red, textShadow: `0 0 34px ${color.redGlow}, 0 0 80px rgba(227,30,36,.35), 0 4px 30px rgba(0,0,0,.6)` }}>
                {tail}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** Chips de reforço: pílulas com ✓ que entram uma a uma (6 frames de defasagem). */
export const Chips: React.FC<{ chips: Chip[]; at: number; size?: number }> = ({ chips, at, size = 28 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
      {chips.map((c, i) => {
        const s = spring({ frame: frame - (c.at ?? at + i * 6), fps, config: { damping: 14, stiffness: 170 } });
        return (
          <div
            key={c.text}
            style={{
              opacity: Math.min(1, s * 1.4),
              transform: `translateY(${(1 - s) * 18}px) scale(${0.9 + 0.1 * s})`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: `${size * 0.42}px ${size * 0.8}px ${size * 0.42}px ${size * 0.6}px`,
              borderRadius: 999,
              background: color.graphite,
              border: "1.5px solid rgba(255,255,255,.14)",
              fontFamily: font.body,
              fontWeight: 600,
              fontSize: size,
              lineHeight: 1.1,
              color: color.white,
              whiteSpace: "nowrap",
            }}
          >
            <Check size={size} />
            {c.text}
          </div>
        );
      })}
    </div>
  );
};

/** Entrada da prova visual (scale .92→1 + translateY) e deriva lenta contínua. */
export const ProofMotion: React.FC<{
  duration: number;
  delay?: number;
  fromX?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ duration, delay = 4, fromX = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 110 } });
  const drift = interpolate(frame, [0, duration], [1, 1.05], clamp);
  return (
    <div
      style={{
        opacity: interpolate(s, [0, 0.5], [0, 1], clamp),
        transform: `translate(${(1 - s) * fromX}px, ${(1 - s) * (fromX ? 0 : 70)}px) scale(${(0.92 + 0.08 * s) * drift})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Padrão de cena: etiqueta → título → prova visual → chips, dentro da área
 * segura do Reels. `backdrop` fica atrás de tudo (cenas com clipe IA).
 */
export const SceneShell: React.FC<{
  text: SceneText;
  duration: number;
  backdrop?: React.ReactNode;
  chips?: Chip[];
  chipsAt?: number;
  chipSize?: number;
  glow?: boolean;
  children?: React.ReactNode;
}> = ({ text, duration, backdrop, chips, chipsAt = 20, chipSize, glow = true, children }) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [duration - 6, duration], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {backdrop}
      <AbsoluteFill
        style={{
          paddingTop: text.top,
          paddingBottom: safe.bottom,
          paddingLeft: safe.side,
          paddingRight: safe.side,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ opacity: 1 - exit, filter: exit > 0 ? `blur(${exit * 12}px)` : undefined }}>
          {text.label ? <Label text={text.label} align={text.align} /> : null}
          <Title lines={text.title} size={text.titleSize} align={text.align} />
        </div>
        {children ? (
          <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 34, minHeight: 0 }}>
            {glow ? <Glow /> : null}
            {children}
          </div>
        ) : null}
        {chips ? (
          <div style={{ marginTop: 26 }}>
            <Chips chips={chips} at={chipsAt} size={chipSize} />
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
