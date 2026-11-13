import React from "react";
import { Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Rect, ScreenSpec, dims, has } from "../config";
import { theme } from "../theme";
import { Cursor } from "./Cursor";
import { Highlight } from "./Highlight";
import { FALLBACK_SCREENS } from "./AppScreens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Interpola entre recortes da lupa conforme o `at` de cada um. */
const lensRect = (rects: (Rect & { at: number })[], frame: number): Rect => {
  let r: Rect = rects[0];
  for (let i = 1; i < rects.length; i++) {
    const t = interpolate(frame, [rects[i].at - 6, rects[i].at + 6], [0, 1], clamp);
    const e = t * t * (3 - 2 * t);
    r = {
      x: r.x + (rects[i].x - r.x) * e,
      y: r.y + (rects[i].y - r.y) * e,
      w: r.w + (rects[i].w - r.w) * e,
      h: r.h + (rects[i].h - r.h) * e,
    };
  }
  return r;
};

/**
 * Conteúdo de uma tela (print, vídeo ou fallback em CSS) dentro de um mockup.
 * Cuida de corte (barra de status), zoom, rolagem, molduras, desfoques e cursor.
 * `lens` = modo lupa: enquadra o recorte indicado em vez da tela toda.
 */
export const ScreenContent: React.FC<{
  spec: ScreenSpec;
  width: number;
  height: number;
  duration: number;
  lens?: boolean;
}> = ({ spec, width: W, height: H, duration, lens }) => {
  const frame = useCurrentFrame();
  const useVideo = has(spec.video);
  const useImg = !useVideo && has(spec.src);
  const fb = FALLBACK_SCREENS[spec.fallback];

  // Tamanho natural da "página".
  let natW = fb.w;
  let natH = fb.h;
  let crop = { top: 0, bottom: 0 };
  if (useImg) {
    const d = dims(spec.src as string);
    natW = d.width ?? W;
    natH = d.height ?? H;
    crop = spec.crop ?? crop;
  } else if (useVideo) {
    natW = W;
    natH = H;
  }
  const aspect = natH / natW;

  let pageW: number;
  let offX: number;
  let offY: number;
  let zoom = 1;

  if (lens && spec.lens?.length) {
    const r = lensRect(spec.lens, frame);
    pageW = Math.min(W / (r.w / 100), H / ((r.h / 100) * aspect));
    offX = ((r.x + r.w / 2) / 100) * pageW - W / 2;
    offY = ((r.y + r.h / 2) / 100) * pageW * aspect - H / 2;
  } else {
    const usable = 1 - (crop.top + crop.bottom) / 100;
    // Cobre o visor só com a parte útil do print (nunca mostra a área cortada).
    const k = Math.max(1, H / (W * aspect * usable));
    pageW = W * k;
    const pageH = pageW * aspect;
    const pan = interpolate(frame, [0, duration], spec.pan, clamp);
    offX = (pageW - W) / 2;
    offY = (crop.top / 100) * pageH + pan * Math.max(0, pageH * usable - H);
    zoom = interpolate(frame, [0, duration], spec.zoom, clamp);
  }
  const pageH = pageW * aspect;
  // Espessura de traço/cursor: constante na tela; maior na lupa.
  const unit = lens ? Math.sqrt(pageW / W) * 1.15 : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: useImg || useVideo ? "#000" : theme.app.bg,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -offX,
          top: -offY,
          width: pageW,
          height: pageH,
          transform: `scale(${zoom})`,
          transformOrigin: `${spec.focus.x}% ${spec.focus.y}%`,
        }}
      >
        {useVideo ? (
          <OffthreadVideo
            muted
            src={staticFile(spec.video as string)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : useImg ? (
          <Img src={staticFile(spec.src as string)} style={{ width: "100%", height: "100%", display: "block" }} />
        ) : (
          <div
            style={{
              width: fb.w,
              height: fb.h,
              transform: `scale(${pageW / fb.w})`,
              transformOrigin: "0 0",
            }}
          >
            <fb.Component />
          </div>
        )}
        {(spec.blur ?? []).map((b, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.w}%`,
              height: `${b.h}%`,
              backdropFilter: "blur(10px)",
              background: "rgba(255,255,255,.25)",
              borderRadius: 8,
            }}
          />
        ))}
        {(spec.highlights ?? []).map((h, i) => (
          <Highlight key={i} rect={h} at={h.at} unit={unit} />
        ))}
        {spec.cursor ? <Cursor path={spec.cursor} unit={unit} /> : null}
      </div>
    </div>
  );
};
