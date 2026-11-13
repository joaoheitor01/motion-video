import React from "react";
import { ScreenSpec } from "../config";
import { theme } from "../theme";
import { ScreenContent } from "./ScreenContent";

const BEZEL = 12;
/** Medidas do notebook para uma largura total W (tela 16:10). */
export const laptopSize = (W: number) => {
  const lidW = Math.round(W * 0.94);
  const screenW = lidW - BEZEL * 2;
  const screenH = Math.round((screenW * 10) / 16);
  const lidH = screenH + BEZEL * 2 + 4;
  const baseH = Math.round(W * 0.026);
  return { lidW, lidH, screenW, screenH, baseH, height: lidH + baseH };
};

/**
 * Notebook em CSS: moldura preta fina, base de alumínio escuro, leve
 * rotateX/rotateY com perspective e reflexo diagonal. Telas horizontais do
 * computador só aparecem aqui dentro.
 */
export const LaptopMockup: React.FC<{
  width: number;
  duration: number;
  screen?: ScreenSpec;
  tilt?: { x: number; y: number };
  children?: React.ReactNode;
}> = ({ width, duration, screen, tilt = { x: 6, y: -6 }, children }) => {
  const s = laptopSize(width);
  return (
    <div style={{ width, height: s.height, perspective: 2400 }}>
      <div
        style={{
          width,
          height: s.height,
          position: "relative",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* sombra no chão */}
        <div
          style={{
            position: "absolute",
            left: "4%",
            right: "4%",
            bottom: -34,
            height: 50,
            background: "radial-gradient(ellipse at center, rgba(0,0,0,.75) 0%, rgba(0,0,0,0) 70%)",
          }}
        />
        {/* tampa */}
        <div
          style={{
            position: "absolute",
            left: (width - s.lidW) / 2,
            top: 0,
            width: s.lidW,
            height: s.lidH,
            borderRadius: "18px 18px 4px 4px",
            background: "#060607",
            boxShadow: `inset 0 0 0 1.5px #2b2b31, 0 0 60px ${theme.color.redGlow.replace(".55", ".28")}`,
          }}
        >
          <div style={{ position: "absolute", left: s.lidW / 2 - 3, top: 4, width: 6, height: 6, borderRadius: "50%", background: "#1b1b22" }} />
          <div
            style={{
              position: "absolute",
              left: BEZEL,
              top: BEZEL,
              width: s.screenW,
              height: s.screenH,
              overflow: "hidden",
              borderRadius: 6,
              background: "#000",
            }}
          >
            {screen ? <ScreenContent spec={screen} width={s.screenW} height={s.screenH} duration={duration} /> : children}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(112deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,0) 30%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
        {/* base de alumínio escuro */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: s.lidH,
            width,
            height: s.baseH,
            borderRadius: `3px 3px ${s.baseH}px ${s.baseH}px`,
            background: "linear-gradient(180deg, #4a4a52 0%, #2a2a30 30%, #17171b 100%)",
            boxShadow: "0 18px 30px rgba(0,0,0,.6)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: width / 2 - width * 0.07,
              top: 0,
              width: width * 0.14,
              height: s.baseH * 0.36,
              borderRadius: "0 0 10px 10px",
              background: "#121215",
            }}
          />
        </div>
      </div>
    </div>
  );
};
