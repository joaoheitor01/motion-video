import React from "react";
import { ScreenSpec } from "../config";
import { theme } from "../theme";
import { ScreenContent } from "./ScreenContent";

export const PHONE = { w: 440, h: 900, border: 10, statusZone: 44 };
const SCREEN_W = PHONE.w - PHONE.border * 2;
const SCREEN_H = PHONE.h - PHONE.border * 2 - PHONE.statusZone;

/**
 * Celular em CSS puro (440x900, escalável). O topo da tela é uma faixa preta só
 * com a ilha dinâmica — a barra de status do print (hora, bateria) é cortada
 * via `screen.crop` e nunca aparece.
 */
export const PhoneMockup: React.FC<{
  screen?: ScreenSpec;
  duration: number;
  scale?: number;
  children?: React.ReactNode;
}> = ({ screen, duration, scale = 1, children }) => {
  const c = theme.color;
  const button = (side: "left" | "right", top: number, h: number): React.CSSProperties => ({
    position: "absolute",
    [side]: -5,
    top,
    width: 5,
    height: h,
    borderRadius: 3,
    background: "#2A2A30",
  });
  return (
    <div style={{ width: PHONE.w * scale, height: PHONE.h * scale }}>
      <div
        style={{
          width: PHONE.w,
          height: PHONE.h,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "relative",
        }}
      >
        <div style={button("left", 170, 34)} />
        <div style={button("left", 230, 64)} />
        <div style={button("left", 306, 64)} />
        <div style={button("right", 250, 96)} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 64,
            border: `${PHONE.border}px solid ${c.graphite}`,
            background: "#000",
            boxSizing: "border-box",
            boxShadow: `0 0 0 1.5px ${c.red}, 0 0 46px ${c.redGlow}, 0 40px 80px rgba(0,0,0,.6), inset 0 0 0 1.5px #34343b`,
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: PHONE.statusZone, width: SCREEN_W, height: SCREEN_H, overflow: "hidden" }}>
            {screen ? <ScreenContent spec={screen} width={SCREEN_W} height={SCREEN_H} duration={duration} /> : children}
          </div>
          {/* ilha dinâmica */}
          <div
            style={{
              position: "absolute",
              left: SCREEN_W / 2 - 58,
              top: 9,
              width: 116,
              height: 27,
              borderRadius: 14,
              background: "#0c0c0e",
              boxShadow: "inset 0 0 0 1px #1d1d22",
            }}
          >
            <div style={{ position: "absolute", right: 12, top: 8, width: 11, height: 11, borderRadius: "50%", background: "#15151c", boxShadow: "inset 0 0 0 2px #0a0a12" }} />
          </div>
          {/* reflexo */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(118deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 28%)", pointerEvents: "none" }} />
        </div>
      </div>
    </div>
  );
};
