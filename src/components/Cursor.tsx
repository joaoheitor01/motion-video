import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

type Point = { x: number; y: number; at: number; click?: boolean };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Cursor branco com sombra. Move em curva (bezier quadrática) entre os pontos
 * (em % do print) e faz um ripple vermelho nos pontos com `click`.
 * Uso simples: <Cursor from={{x,y}} to={{x,y}} startAt={0} clickAt={30} />
 */
export const Cursor: React.FC<
  | { path: Point[]; unit?: number }
  | { from: { x: number; y: number }; to: { x: number; y: number }; startAt?: number; clickAt: number; unit?: number }
> = (props) => {
  const frame = useCurrentFrame();
  const unit = props.unit ?? 1;
  const path: Point[] =
    "path" in props
      ? props.path
      : [
          { ...props.from, at: props.startAt ?? 0 },
          { ...props.to, at: props.clickAt, click: true },
        ];
  if (!path.length) return null;

  // segmento atual
  let i = 0;
  while (i < path.length - 2 && frame >= path[i + 1].at) i++;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  const span = Math.max(1, b.at - a.at);
  const t = ease(Math.min(1, Math.max(0, (frame - a.at) / span)));
  // ponto de controle deslocado na perpendicular → trajetória curva
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * 0.22;
  const my = (a.y + b.y) / 2 + (b.x - a.x) * 0.22;
  const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * mx + t ** 2 * b.x;
  const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * my + t ** 2 * b.y;

  const clicks = path.filter((p) => p.click);
  const press = clicks.reduce((acc, c) => {
    const d = frame - c.at;
    return d >= -2 && d <= 5 ? Math.max(acc, 1 - Math.abs(d - 1) / 4) : acc;
  }, 0);
  const size = 46 * unit;

  return (
    <>
      {clicks.map((c, k) => {
        const d = frame - c.at;
        if (d < 0 || d > 16) return null;
        const r = interpolate(d, [0, 16], [10, 90]) * unit;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: r * 2,
              height: r * 2,
              marginLeft: -r,
              marginTop: -r,
              borderRadius: "50%",
              border: `${4 * unit}px solid ${theme.color.red}`,
              background: "rgba(227,30,36,.18)",
              boxSizing: "border-box",
              opacity: interpolate(d, [0, 16], [0.95, 0]),
            }}
          />
        );
      })}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          overflow: "visible",
          opacity: interpolate(frame, [path[0].at - 4, path[0].at], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `scale(${1 - press * 0.16})`,
          transformOrigin: "0 0",
          filter: `drop-shadow(0 ${3 * unit}px ${5 * unit}px rgba(0,0,0,.55))`,
        }}
      >
        <path
          d="M3 2l7.2 18 2.5-7.3 7.3-2.5L3 2z"
          fill={theme.color.white}
          stroke="#111"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
