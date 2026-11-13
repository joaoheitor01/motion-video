// =============================================================================
// ÚNICO arquivo de conteúdo: textos, tempos, caminhos de arquivos e coordenadas.
// As cenas não têm texto hardcoded — tudo sai daqui. Cores ficam em theme.ts.
// =============================================================================
import assets from "./generated/assets.json";

// ---------- FORMATO ----------
export const VIDEO = {
  id: "RageAreaAluno",
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 900,
} as const;

// ---------- ARQUIVOS (detecção em tempo de build; ver scripts/prepare.mjs) ----------
const manifest = assets as Record<string, { width?: number; height?: number }>;
export const has = (file?: string): file is string => Boolean(file && manifest[file]);
export const dims = (file: string) => manifest[file] ?? {};

// ---------- BATIDA ----------
export const BPM = 128;
export const BEAT = (VIDEO.fps * 60) / BPM; // 14,0625 frames
/** Frame da batida mais próxima de um tempo em segundos. */
export const snapToBeat = (seconds: number) =>
  Math.round(Math.round((seconds * VIDEO.fps) / BEAT) * BEAT);

// Início de cada cena em segundos (roteiro). O corte real vai para a batida mais próxima.
const SCENE_STARTS_S = [0, 3, 6, 8, 10.5, 13, 15.5, 18, 21, 24.5];
export const CUTS = [...SCENE_STARTS_S.map(snapToBeat), VIDEO.durationInFrames];
export const sceneTiming = (n: number) => ({
  from: CUTS[n - 1],
  duration: CUTS[n] - CUTS[n - 1],
});

// Transição de ENTRADA de cada cena. "cut" = corte seco. As demais usam
// @remotion/transitions com TRANSITION_FRAMES de duração.
export type TransitionKind = "cut" | "fade" | "slide";
export const TRANSITION_FRAMES = 6;
export const TRANSITIONS: Record<number, TransitionKind> = {
  10: "fade",
};

// ---------- TIPOS ----------
export type Rect = { x: number; y: number; w: number; h: number }; // em % do print
export type FallbackKind =
  | "desktopHome"
  | "desktopObjetivo"
  | "desktopRotina"
  | "mobileHome"
  | "mobilePlano"
  | "mobileEvolucao";

export type ScreenSpec = {
  /** Print em public/. Se não existir, usa a tela `fallback` recriada em CSS. */
  src?: string;
  /** Vídeo de tela em public/ (tem prioridade sobre src). */
  video?: string;
  fallback: FallbackKind;
  /** % da altura do print a cortar (barra de status / barra do navegador). */
  crop?: { top: number; bottom: number };
  /** Zoom inicial → final ao longo da cena. */
  zoom: [number, number];
  /** Ponto de origem do zoom, em % do print. */
  focus: { x: number; y: number };
  /** Rolagem vertical inicial → final (0 = topo, 1 = fim). */
  pan: [number, number];
  /** Molduras vermelhas; `at` = frame (relativo à cena) em que aparecem. */
  highlights?: (Rect & { at: number })[];
  /** Máscaras de desfoque para dados sensíveis, em % do print. */
  blur?: Rect[];
  /** Percurso do cursor, em % do print. `click` dispara o ripple e o "tick". */
  cursor?: { x: number; y: number; at: number; click?: boolean }[];
  /** Lupa: recortes ampliados (em % do print) mostrados abaixo do notebook. */
  lens?: (Rect & { at: number })[];
};

export type SceneText = {
  label?: string;
  /** Uma string por linha. A última palavra da última linha fica vermelha. */
  title: string[];
  titleSize: number;
  /** Topo do bloco etiqueta+título (px). */
  top: number;
  align?: "left" | "center";
};

export type Chip = { text: string; at?: number };

// Corte padrão dos prints de celular (barra de status em cima, barra do navegador embaixo).
const PHONE_CROP = { top: 7, bottom: 8 };

// ---------- CLIPES IA (cenas 1, 2, 8, 10) ----------
// Ordem de uso: vídeo → foto de referência (Ken Burns) → fundo procedural em SVG.
export type BackdropKind = "plates" | "beams" | "halter" | "facade";
export const CLIPS: Record<number, { video: string; ref: string; backdrop: BackdropKind; overlay: number }> = {
  1: { video: "clips/cena1.mp4", ref: "refs/ref_anilhas.jpg", backdrop: "plates", overlay: 0.55 },
  2: { video: "clips/cena2.mp4", ref: "refs/ref_area_aluno.jpg", backdrop: "beams", overlay: 0.5 },
  8: { video: "clips/cena8.mp4", ref: "refs/ref_treino.jpg", backdrop: "halter", overlay: 0.35 },
  10: { video: "clips/cena10.mp4", ref: "refs/ref_fachada.jpg", backdrop: "facade", overlay: 0.5 },
};

// ---------- CENAS ----------
export const SCENES = {
  s1: {
    label: "ACADEMIA RAGE",
    title: ["SEU TREINO.", "DO SEU", "JEITO."],
    titleSize: 150,
    top: 640,
  },
  s2: {
    label: "NOVIDADE",
    title: ["ÁREA DO", "ALUNO."],
    titleSize: 150,
    top: 700,
    flashFrames: 4,
  },
  s3: {
    label: "PLATAFORMA",
    title: ["NO COMPUTADOR", "E NO", "CELULAR."],
    titleSize: 124,
    top: 200,
    chips: [{ text: "Computador" }, { text: "Celular" }] as Chip[],
    chipsAt: 26,
    laptop: {
      src: "prints/app_computador/01_inicio.png",
      fallback: "desktopHome",
      zoom: [1, 1.05],
      focus: { x: 50, y: 40 },
      pan: [0, 0],
    } as ScreenSpec,
    phone: {
      src: "prints/app_celular/01_inicio.png",
      fallback: "mobileHome",
      crop: PHONE_CROP,
      zoom: [1, 1.05],
      focus: { x: 50, y: 30 },
      pan: [0, 0],
    } as ScreenSpec,
  },
  s4: {
    label: "MONTE SEU TREINO",
    title: ["ESCOLHA SEU", "OBJETIVO."],
    titleSize: 140,
    top: 200,
    screen: {
      src: "prints/app_computador/02_monte_treino_objetivo.png",
      fallback: "desktopObjetivo",
      zoom: [1, 1.06],
      focus: { x: 40, y: 40 },
      pan: [0, 0],
      cursor: [
        { x: 86, y: 90, at: 8 },
        { x: 44, y: 44, at: 34, click: true },
      ],
      highlights: [{ x: 22, y: 25.6, w: 36.3, h: 28.8, at: 36 }],
      lens: [{ x: 20, y: 22, w: 42, h: 36, at: 0 }],
    } as ScreenSpec,
  },
  s5: {
    label: "MONTE SEU TREINO",
    title: ["SEUS DIAS.", "SEU TEMPO."],
    titleSize: 140,
    top: 200,
    screen: {
      src: "prints/app_computador/03_monte_treino_rotina.png",
      fallback: "desktopRotina",
      zoom: [1, 1.06],
      focus: { x: 50, y: 50 },
      pan: [0, 0],
      cursor: [
        { x: 88, y: 88, at: 4 },
        { x: 57, y: 40, at: 22, click: true },
        { x: 57, y: 40, at: 32 },
        { x: 51, y: 68, at: 52, click: true },
      ],
      highlights: [
        { x: 50, y: 30.4, w: 12, h: 14.4, at: 24 },
        { x: 41, y: 59.2, w: 17, h: 14.4, at: 54 },
      ],
      lens: [
        { x: 20, y: 21, w: 78, h: 26, at: 0 },
        { x: 20, y: 50, w: 78, h: 26, at: 40 },
      ],
    } as ScreenSpec,
  },
  s6: {
    label: "MONTE SEU TREINO",
    title: ["MONTANDO", "SEU TREINO..."],
    titleSize: 140,
    top: 200,
    /** Se este vídeo existir, substitui a recriação em CSS. */
    video: "prints/app_computador/montando_ok.mp4",
    stageFrames: 75,
    stageTitle: "Montando o seu treino...",
    stages: ["Analisando seu perfil", "Definindo exercícios", "Organizando o plano"],
  },
  s7: {
    label: "SEU PLANO",
    title: ["PLANO", "PRONTO."],
    titleSize: 150,
    top: 200,
    chips: [
      { text: "Treino A" },
      { text: "Treino B" },
      { text: "Treino C" },
      { text: "Treino D" },
    ] as Chip[],
    chipsAt: 22,
    phoneScale: 0.94,
    screen: {
      src: "prints/app_celular/09_treinos_B_C_D.png",
      fallback: "mobilePlano",
      crop: PHONE_CROP,
      zoom: [1, 1],
      focus: { x: 50, y: 50 },
      pan: [0, 0.85],
    } as ScreenSpec,
  },
  s8: {
    label: "REGISTRO",
    title: ["TREINOU?", "CONCLUÍDO."],
    titleSize: 150,
    top: 1110,
    align: "center" as const,
    sealText: "Concluído",
    /** Frame (relativo à cena) do "toque" do clipe: carimbo + thud. */
    sealAt: Math.round(BEAT * 2),
    /** Centro vertical do selo (px). */
    sealY: 960,
  },
  s9: {
    label: "EVOLUÇÃO",
    title: ["VEJA SUA", "EVOLUÇÃO."],
    titleSize: 140,
    top: 200,
    chips: [
      { text: "Treinado recentemente" },
      { text: "Em recuperação" },
      { text: "Pronto para treinar" },
    ] as Chip[],
    chipsAt: 40,
    phoneScale: 0.84,
    screen: {
      src: "prints/app_celular/10_minha_evolucao.png",
      fallback: "mobileEvolucao",
      crop: PHONE_CROP,
      zoom: [1, 1.1],
      focus: { x: 50, y: 45 },
      pan: [0, 0],
      highlights: [{ x: 8, y: 14.6, w: 84, h: 53.6, at: 24 }],
      // Se o print real mostrar IMC, peso ou gordura, cubra aqui (em % do print):
      blur: [],
    } as ScreenSpec,
  },
  s10: {
    title: ["ACESSE A", "ÁREA DO", "ALUNO."],
    titleSize: 150,
    top: 800,
    align: "center" as const,
    logo: "logo/logo_rage.png",
    logoText: ["ACADEMIA", "RAGE"],
    logoY: 420,
    cta: "PEÇA SEU ACESSO NA RECEPÇÃO",
    ctaAt: 46,
  },
};

// ---------- TEXTOS DAS TELAS DE FALLBACK (usadas enquanto os prints não existem) ----------
// Reproduzem só a navegação do app; não há dados de aluno.
export const APP = {
  brand: "ACADEMIA RAGE",
  menuLabel: "MENU",
  menu: ["Início", "Mural", "Minha ficha", "Treinos", "Minha evolução", "Contato e avaliações", "Sugestões"],
  home: {
    eyebrow: "ÁREA DO ALUNO",
    title: "Início",
    tiles: ["Minha ficha", "Treinos", "Minha evolução", "Mural"],
  },
  objetivo: {
    eyebrow: "MONTE SEU TREINO",
    title: "Qual é o seu objetivo?",
    options: ["Emagrecimento e definição", "Hipertrofia", "Força", "Condicionamento"],
  },
  rotina: {
    eyebrow: "MONTE SEU TREINO",
    title: "Sua rotina",
    daysLabel: "Quantos dias por semana?",
    days: ["2", "3", "4", "5", "6"],
    minutesLabel: "Quanto tempo por sessão?",
    minutes: ["30 minutos", "45 minutos", "60 minutos", "90 minutos"],
  },
  plano: {
    title: "Seu plano está pronto!",
    subtitle: "4 dias por semana · 45 minutos por sessão",
    tabs: ["Treino A", "Treino B", "Treino C", "Treino D"],
    activeTab: 1,
    columns: ["Séries", "Repetições", "Intervalo"],
    workouts: [
      {
        name: "Treino B - Membros Inferiores Foco Anterior",
        rows: [
          ["Leg Press 45", "4", "8 a 10", "120s"],
          ["Cadeira Extensora", "3", "10 a 12", "60s"],
          ["Cadeira Abdutora", "3", "12 a 15", "60s"],
          ["Panturrilhas Sentado na Máquina", "4", "15", "45s"],
        ],
      },
      // Sem print: linhas vazias (esqueleto), para não inventar exercícios.
      { name: "Treino C", rows: [] },
      { name: "Treino D", rows: [] },
    ],
  },
  evolucao: {
    title: "Minha evolução",
    mapCaption: "Ilustração anatômica orientativa",
    legend: ["Treinado recentemente", "Em recuperação", "Pronto para treinar"],
  },
};

// ---------- ÁUDIO ----------
const TRILHA = "audio/trilha.mp3";
const PROVISORIA = "audio/provisoria.wav";
const lastClick = (spec: ScreenSpec) => (spec.cursor ?? []).filter((p) => p.click).map((p) => p.at);

export const AUDIO = {
  music: {
    file: has(TRILHA) ? TRILHA : PROVISORIA,
    isProvisional: !has(TRILHA),
    /** Frame da trilha em que o anúncio começa (startFrom). */
    startFrom: 0,
    volume: 0.5, // -6 dB na mixagem final
    fadeInFrames: 15, // 0,5 s
    fadeOutFrames: 30, // 1 s
  },
  sfxVolume: 0.708, // -3 dB
  sfx: [
    // whoosh centrado em cada corte
    ...CUTS.slice(1, -1).map((c) => ({ file: "audio/sfx/whoosh.wav", at: c - 4 })),
    // tick em cada clique do cursor
    ...lastClick(SCENES.s4.screen).map((f) => ({ file: "audio/sfx/tick.wav", at: CUTS[3] + f })),
    ...lastClick(SCENES.s5.screen).map((f) => ({ file: "audio/sfx/tick.wav", at: CUTS[4] + f })),
    // thud no carimbo
    { file: "audio/sfx/thud.wav", at: CUTS[7] + SCENES.s8.sealAt },
    // riser de 1 s antes do corte 9→10
    { file: "audio/sfx/riser.wav", at: CUTS[9] - 30 },
  ],
};
