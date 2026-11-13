import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { Check, Halter } from "./icons";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const STAGE_SIZE = { w: 1000, h: 625 };

/** Frame em que cada etapa acende, para uma animação de `total` frames. */
export const stageTimes = (total: number, count: number) =>
  Array.from({ length: count }, (_, i) => Math.round(total * (0.24 + (i * 0.56) / Math.max(1, count - 1))));

/**
 * Recriação em CSS/SVG da tela "Montando o seu treino...": anel duplo pulsando,
 * halter vermelho e etapas que acendem em sequência com linha de progresso.
 * Desenhada em 1000x625 (tela do notebook).
 */
export const TypedStage: React.FC<{ title: string; stages: string[]; total: number }> = ({ title, stages, total }) => {
  const frame = useCurrentFrame();
  const a = theme.app;
  const red = theme.color.red;
  const times = stageTimes(total, stages.length);
  const pulse = (frame % 30) / 30;
  const pulse2 = ((frame + 15) % 30) / 30;
  const colW = 270;
  const x0 = (STAGE_SIZE.w - colW * stages.length) / 2;
  const lineFrom = x0 + colW / 2;
  const lineTo = x0 + colW * (stages.length - 0.5);
  const progress = interpolate(frame, [times[0], times[times.length - 1]], [0, 1], clamp);

  return (
    <div style={{ width: STAGE_SIZE.w, height: STAGE_SIZE.h, background: a.bg, position: "relative", fontFamily: theme.font.body, color: a.ink }}>
      {/* anel duplo */}
      {[pulse, pulse2].map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 500 - 80,
            top: 150 - 80,
            width: 160,
            height: 160,
            borderRadius: "50%",
            border: `3px solid ${red}`,
            opacity: (1 - p) * 0.55,
            transform: `scale(${1 + p * 0.55})`,
            boxSizing: "border-box",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: 500 - 68,
          top: 150 - 68,
          width: 136,
          height: 136,
          borderRadius: "50%",
          background: "#fff",
          border: `4px solid ${red}`,
          boxSizing: "border-box",
          boxShadow: "0 10px 40px rgba(227,30,36,.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `rotate(${Math.sin(frame / 7) * 7}deg)`,
        }}
      >
        <Halter size={78} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 262, width: "100%", textAlign: "center", fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {title}
      </div>
      {/* linha de progresso */}
      <div style={{ position: "absolute", left: lineFrom, top: 421, width: lineTo - lineFrom, height: 6, borderRadius: 3, background: a.line }} />
      <div style={{ position: "absolute", left: lineFrom, top: 421, width: (lineTo - lineFrom) * progress, height: 6, borderRadius: 3, background: red }} />
      {stages.map((s, i) => {
        const on = interpolate(frame, [times[i], times[i] + 5], [0, 1], clamp);
        return (
          <div key={s} style={{ position: "absolute", left: x0 + i * colW, top: 394, width: colW, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "#fff",
                border: `4px solid ${on > 0.5 ? red : a.line}`,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${1 + Math.sin(on * Math.PI) * 0.22})`,
                boxShadow: on > 0.5 ? "0 0 26px rgba(227,30,36,.4)" : "none",
              }}
            >
              <div style={{ opacity: on, display: "flex" }}>
                <Check size={34} stroke={4} />
              </div>
            </div>
            <div style={{ marginTop: 18, fontSize: 25, fontWeight: on > 0.5 ? 700 : 500, color: on > 0.5 ? a.ink : a.muted, textAlign: "center" }}>{s}</div>
          </div>
        );
      })}
    </div>
  );
};
