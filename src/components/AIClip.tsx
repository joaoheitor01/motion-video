import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { CLIPS, has } from "../config";
import { BACKDROPS } from "./Backdrops";
import { KenBurns } from "./KenBurns";

/**
 * Clipe das cenas IA. Ordem: public/clips/cena{n}.mp4 (mudo) → foto de
 * referência com Ken Burns → fundo procedural. A existência dos arquivos é
 * resolvida em tempo de build (config.has).
 */
export const AIClip: React.FC<{ n: number; style?: React.CSSProperties }> = ({ n, style }) => {
  const clip = CLIPS[n];
  const Procedural = BACKDROPS[clip.backdrop];
  const real = has(clip.video) || has(clip.ref);
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      {has(clip.video) ? (
        <OffthreadVideo muted src={staticFile(clip.video)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : has(clip.ref) ? (
        <KenBurns src={clip.ref} />
      ) : (
        <Procedural />
      )}
      {/* overlay para garantir contraste do título */}
      <AbsoluteFill style={{ background: `rgba(11,11,13,${real ? clip.overlay : clip.overlay * 0.35})` }} />
    </AbsoluteFill>
  );
};
