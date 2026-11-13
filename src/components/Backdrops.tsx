// Fundos procedurais em SVG/CSS. Último fallback das cenas IA, usado quando não
// há nem o clipe (public/clips) nem a foto de referência (public/refs).
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BackdropKind } from "../config";
import { theme } from "../theme";

const red = theme.color.red;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Plate: React.FC<{ cx: number; cy: number; r: number; rot: number; blur?: number }> = ({ cx, cy, r, rot, blur = 0 }) => (
  <svg
    width={r * 2}
    height={r * 2}
    viewBox="-100 -100 200 200"
    style={{ position: "absolute", left: cx - r, top: cy - r, transform: `rotate(${rot}deg)`, filter: blur ? `blur(${blur}px)` : undefined }}
  >
    <defs>
      <radialGradient id="plateBody" cx="35%" cy="30%" r="90%">
        <stop offset="0%" stopColor="#3a3a42" />
        <stop offset="55%" stopColor="#1b1b20" />
        <stop offset="100%" stopColor="#0c0c0f" />
      </radialGradient>
      <linearGradient id="plateRim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff5a5f" />
        <stop offset="45%" stopColor={red} />
        <stop offset="100%" stopColor="#5c0b0e" />
      </linearGradient>
    </defs>
    <circle r="99" fill="url(#plateRim)" />
    <circle r="95" fill="url(#plateBody)" />
    <circle r="78" fill="none" stroke="#000" strokeOpacity=".55" strokeWidth="1.2" />
    <circle r="76" fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth=".8" />
    <circle r="62" fill="none" stroke={red} strokeWidth="5" strokeOpacity=".9" />
    <circle r="44" fill="#141418" stroke="#000" strokeOpacity=".6" strokeWidth="1.2" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <rect key={a} x="-7" y="-92" width="14" height="10" rx="3" fill="#000" fillOpacity=".45" transform={`rotate(${a})`} />
    ))}
    {[30, 150, 270].map((a) => (
      <rect key={a} x="-9" y="-40" width="18" height="24" rx="8" fill="#060607" transform={`rotate(${a})`} />
    ))}
    <circle r="15" fill="#2d2d33" />
    <circle r="10" fill="#050506" />
  </svg>
);

const Plates: React.FC = () => {
  const frame = useCurrentFrame();
  const z = 1 + frame * 0.0009;
  return (
    <AbsoluteFill style={{ transform: `scale(${z})` }}>
      <div style={{ position: "absolute", left: 300, top: 1000, width: 1100, height: 1100, borderRadius: "50%", background: `radial-gradient(circle, ${theme.color.redGlow} 0%, rgba(227,30,36,0) 65%)`, filter: "blur(30px)" }} />
      <Plate cx={110} cy={250} r={400} rot={-frame * 0.25} blur={7} />
      <Plate cx={860} cy={1480} r={640} rot={frame * 0.4} />
    </AbsoluteFill>
  );
};

const Beams: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const x = -500 + i * 330 + frame * (1.6 + i * 0.5);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: -500,
              width: 130 + i * 28,
              height: 3000,
              transform: "rotate(24deg)",
              background: `linear-gradient(90deg, rgba(227,30,36,0) 0%, rgba(227,30,36,${0.42 + (i % 2) * 0.2}) 50%, rgba(227,30,36,0) 100%)`,
              filter: "blur(10px)",
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 540 - 640,
          top: 880 - 640,
          width: 1280,
          height: 1280,
          borderRadius: "50%",
          border: "3px solid rgba(227,30,36,.6)",
          transform: `scale(${0.82 + frame * 0.0022})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 540 - 440,
          top: 880 - 440,
          width: 880,
          height: 880,
          borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,.1)",
          transform: `scale(${0.9 + frame * 0.003})`,
        }}
      />
    </AbsoluteFill>
  );
};

const BigHalter: React.FC = () => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 16);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 140, top: 130, width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, ${theme.color.redGlow} 0%, rgba(227,30,36,0) 66%)`, filter: "blur(24px)" }} />
      <svg
        width={900}
        height={520}
        viewBox="0 0 900 520"
        style={{ position: "absolute", left: 90, top: 260, transform: `rotate(${-14 + bob * 2}deg) translateY(${bob * 10}px) scale(${1 + frame * 0.0012})` }}
      >
        <defs>
          <linearGradient id="hSteel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8c8c96" />
            <stop offset="45%" stopColor="#3b3b43" />
            <stop offset="100%" stopColor="#141418" />
          </linearGradient>
          <linearGradient id="hPlate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#44444c" />
            <stop offset="40%" stopColor="#1c1c21" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
        </defs>
        <rect x="250" y="232" width="400" height="56" rx="14" fill="url(#hSteel)" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <rect key={i} x={330 + i * 28} y="232" width="6" height="56" fill="#000" fillOpacity=".3" />
        ))}
        {[
          [150, 70, 110, 380],
          [640, 70, 110, 380],
          [70, 120, 84, 280],
          [746, 120, 84, 280],
        ].map(([x, y, w, h], i) => (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx="30" fill="url(#hPlate)" />
            <rect x={x} y={y} width={w} height={h} rx="30" fill="none" stroke={red} strokeWidth="5" strokeOpacity=".85" />
            <rect x={x + 12} y={y + 10} width={10} height={h - 20} rx="5" fill="#fff" fillOpacity=".08" />
          </g>
        ))}
        <rect x="30" y="226" width="44" height="68" rx="10" fill="url(#hSteel)" />
        <rect x="826" y="226" width="44" height="68" rx="10" fill="url(#hSteel)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Fachada estilizada com movimento de "crane up": a câmera sobe e revela a parede lisa. */
const Facade: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames * 0.75], [0, 1], clamp);
  const e = 1 - Math.pow(1 - t, 3);
  const y = -520 + 520 * e;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "linear-gradient(180deg, #050507 0%, #101016 60%, #1a0b0d 100%)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 2600, transform: `translateY(${y}px) scale(${1.06 - 0.06 * e})`, transformOrigin: "50% 40%" }}>
        {/* parede */}
        <div
          style={{
            position: "absolute",
            left: 40,
            top: 250,
            width: 1000,
            height: 2400,
            background: "linear-gradient(180deg, #17171b 0%, #121215 45%, #0d0d10 100%)",
            boxShadow: "0 0 120px rgba(0,0,0,.8)",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0px, rgba(255,255,255,.035) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 62px)" }} />
          {/* luz rasante sobre a parede lisa (espaço do logo) */}
          <div style={{ position: "absolute", left: 100, top: 40, width: 800, height: 760, background: "radial-gradient(ellipse at 50% 0%, rgba(227,30,36,.26) 0%, rgba(227,30,36,0) 70%)" }} />
        </div>
        {/* filete de LED no topo da fachada */}
        <div style={{ position: "absolute", left: 40, top: 244, width: 1000, height: 8, background: red, boxShadow: `0 0 40px 8px ${theme.color.redGlow}` }} />
        {/* marquise */}
        <div style={{ position: "absolute", left: 0, top: 1590, width: 1080, height: 46, background: "#060607", boxShadow: `0 14px 50px ${theme.color.redGlow}` }} />
        <div style={{ position: "absolute", left: 0, top: 1632, width: 1080, height: 5, background: red }} />
        {/* entrada envidraçada */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 130 + i * 208,
              top: 1660,
              width: 196,
              height: 800,
              background: "linear-gradient(180deg, rgba(255,214,170,.5) 0%, rgba(227,30,36,.28) 60%, rgba(20,10,10,.9) 100%)",
              border: "4px solid #050506",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const BACKDROPS: Record<BackdropKind, React.FC> = {
  plates: Plates,
  beams: Beams,
  halter: BigHalter,
  facade: Facade,
};
