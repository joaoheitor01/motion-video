// As 10 cenas. Todo o conteúdo vem de config.ts (SCENES).
import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SCENES, has } from "../config";
import { theme } from "../theme";
import { AIClip } from "../components/AIClip";
import { Glow } from "../components/Background";
import { LaptopMockup, laptopSize } from "../components/LaptopMockup";
import { Logo } from "../components/Logo";
import { PHONE, PhoneMockup } from "../components/PhoneMockup";
import { ProofMotion, SceneShell } from "../components/SceneShell";
import { ScreenContent } from "../components/ScreenContent";
import { Seal } from "../components/Seal";
import { STAGE_SIZE, TypedStage, stageTimes } from "../components/TypedStage";

type P = { duration: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const CONTENT_W = 1080 - theme.safe.side * 2;

// 1 — SEU TREINO. DO SEU JEITO.
export const Scene1: React.FC<P> = ({ duration }) => (
  <SceneShell text={SCENES.s1} duration={duration} backdrop={<AIClip n={1} />} />
);

// 2 — ÁREA DO ALUNO. (o flash vermelho do corte fica em Video.tsx)
export const Scene2: React.FC<P> = ({ duration }) => (
  <SceneShell text={SCENES.s2} duration={duration} backdrop={<AIClip n={2} />} />
);

// 3 — NO COMPUTADOR E NO CELULAR.
export const Scene3: React.FC<P> = ({ duration }) => {
  const s = SCENES.s3;
  const laptopW = 800;
  const phoneScale = 0.8;
  return (
    <SceneShell text={s} duration={duration} chips={s.chips} chipsAt={s.chipsAt} chipSize={32}>
      <div style={{ position: "relative", width: CONTENT_W, height: PHONE.h * phoneScale + 40 }}>
        <ProofMotion duration={duration} delay={3} fromX={-420} style={{ position: "absolute", left: -20, top: 110 }}>
          <LaptopMockup width={laptopW} duration={duration} screen={s.laptop} tilt={{ x: 5, y: 9 }} />
        </ProofMotion>
        <ProofMotion duration={duration} delay={8} fromX={420} style={{ position: "absolute", right: 0, top: 0 }}>
          <PhoneMockup duration={duration} screen={s.phone} scale={phoneScale} />
        </ProofMotion>
      </div>
    </SceneShell>
  );
};

/** Lupa: recorte ampliado da tela do notebook, para a interface ficar legível no vertical. */
const Lens: React.FC<{ spec: typeof SCENES.s4.screen; duration: number; height: number }> = ({ spec, duration, height }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 12, fps, config: { damping: 18, stiffness: 120 } });
  return (
    <div
      style={{
        width: CONTENT_W,
        height,
        position: "relative",
        borderRadius: 28,
        overflow: "hidden",
        border: `2px solid ${theme.color.red}`,
        boxShadow: `0 0 40px ${theme.color.redGlow}, 0 30px 60px rgba(0,0,0,.55)`,
        opacity: Math.min(1, s * 1.5),
        transform: `translateY(${(1 - s) * 50}px) scale(${0.94 + 0.06 * s})`,
        boxSizing: "border-box",
      }}
    >
      <ScreenContent spec={spec} width={CONTENT_W - 4} height={height - 4} duration={duration} lens />
    </div>
  );
};

const LaptopWithLens: React.FC<P & { text: typeof SCENES.s4; lensHeight: number }> = ({ duration, text, lensHeight }) => (
  <SceneShell text={text} duration={duration}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
      <ProofMotion duration={duration}>
        <LaptopMockup width={CONTENT_W - 40} duration={duration} screen={text.screen} />
      </ProofMotion>
      {text.screen.lens ? <Lens spec={text.screen} duration={duration} height={lensHeight} /> : null}
    </div>
  </SceneShell>
);

// 4 — ESCOLHA SEU OBJETIVO.
export const Scene4: React.FC<P> = ({ duration }) => <LaptopWithLens duration={duration} text={SCENES.s4} lensHeight={320} />;

// 5 — SEUS DIAS. SEU TEMPO.
export const Scene5: React.FC<P> = ({ duration }) => <LaptopWithLens duration={duration} text={SCENES.s5} lensHeight={300} />;

// 6 — MONTANDO SEU TREINO...
export const Scene6: React.FC<P> = ({ duration }) => {
  const s = SCENES.s6;
  const total = Math.min(s.stageFrames, duration);
  const laptopW = CONTENT_W;
  const size = laptopSize(laptopW);
  const times = stageTimes(total, s.stages.length);
  return (
    <SceneShell
      text={s}
      duration={duration}
      chips={s.stages.map((text, i) => ({ text, at: times[i] }))}
      chipSize={27}
    >
      <ProofMotion duration={duration}>
        <LaptopMockup width={laptopW} duration={duration}>
          {has(s.video) ? (
            <OffthreadVideo muted src={staticFile(s.video)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ transform: `scale(${size.screenW / STAGE_SIZE.w})`, transformOrigin: "0 0" }}>
              <TypedStage title={s.stageTitle} stages={s.stages} total={total} />
            </div>
          )}
        </LaptopMockup>
      </ProofMotion>
    </SceneShell>
  );
};

// 7 — PLANO PRONTO.
export const Scene7: React.FC<P> = ({ duration }) => {
  const s = SCENES.s7;
  return (
    <SceneShell text={s} duration={duration} chips={s.chips} chipsAt={s.chipsAt} chipSize={30}>
      <ProofMotion duration={duration}>
        <PhoneMockup duration={duration} screen={s.screen} scale={s.phoneScale} />
      </ProofMotion>
    </SceneShell>
  );
};

// 8 — TREINOU? CONCLUÍDO.
export const Scene8: React.FC<P> = ({ duration }) => {
  const s = SCENES.s8;
  return (
    <SceneShell
      text={s}
      duration={duration}
      backdrop={
        <>
          <AIClip
            n={8}
            style={{
              height: 1060,
              bottom: "auto",
              WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0) 100%)",
              maskImage: "linear-gradient(180deg, #000 0%, #000 72%, rgba(0,0,0,0) 100%)",
            }}
          />
          <div style={{ position: "absolute", left: 0, top: s.sealY - 100, width: "100%", height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Seal text={s.sealText} at={s.sealAt} />
          </div>
        </>
      }
    />
  );
};

// 9 — VEJA SUA EVOLUÇÃO.
export const Scene9: React.FC<P> = ({ duration }) => {
  const s = SCENES.s9;
  return (
    <SceneShell text={s} duration={duration} chips={s.chips} chipsAt={s.chipsAt} chipSize={28}>
      <ProofMotion duration={duration}>
        <PhoneMockup duration={duration} screen={s.screen} scale={s.phoneScale} />
      </ProofMotion>
    </SceneShell>
  );
};

// 10 — ACESSE A ÁREA DO ALUNO.
export const Scene10: React.FC<P> = ({ duration }) => {
  const s = SCENES.s10;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 10, fps, config: { damping: 16, stiffness: 110 } });
  const cta = spring({ frame: frame - s.ctaAt, fps, config: { damping: 13, stiffness: 150 } });
  const ctaPulse = 0.5 + 0.5 * Math.sin((frame - s.ctaAt) / 7);
  return (
    <AbsoluteFill>
      <AIClip n={10} />
      <div style={{ position: "absolute", left: 0, top: s.logoY - 80, width: "100%", height: 420 }}>
        <Glow size={760} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: s.logoY,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(logo, [0, 0.6], [0, 1], clamp),
          transform: `translateY(${(1 - logo) * -40}px) scale(${0.9 + 0.1 * logo})`,
        }}
      >
        <Logo file={s.logo} text={s.logoText} />
      </div>
      <SceneShell text={{ ...s, title: s.title }} duration={duration + 999} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: s.top + s.title.length * s.titleSize * 1.01 + 70,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          opacity: Math.min(1, cta * 1.4),
          transform: `translateY(${(1 - cta) * 30}px) scale(${0.92 + 0.08 * cta})`,
        }}
      >
        <div
          style={{
            padding: "26px 44px 26px 48px",
            borderRadius: 999,
            background: theme.color.red,
            color: theme.color.white,
            fontFamily: theme.font.mono,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: "0.12em",
            whiteSpace: "nowrap",
            boxShadow: `0 0 ${40 + ctaPulse * 30}px ${theme.color.redGlow}, 0 20px 50px rgba(0,0,0,.5)`,
          }}
        >
          {s.cta}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SCENE_COMPONENTS: React.FC<P>[] = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8, Scene9, Scene10];
