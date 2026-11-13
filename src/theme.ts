// Design tokens. Cores e medidas globais do anúncio.
export const theme = {
  color: {
    bg: "#0B0B0D",
    bgSoft: "#141417",
    graphite: "#1C1C20",
    red: "#E31E24",
    redGlow: "rgba(227,30,36,.55)",
    white: "#FFFFFF",
    gray: "#9A9AA2",
    gold: "#C9A24A",
    sealBg: "#E8F7EE",
    sealText: "#1E8E4E",
  },
  // Cores da interface do app (usadas só nas telas de fallback em CSS).
  app: {
    bg: "#F1F2F5",
    card: "#FFFFFF",
    ink: "#15151A",
    muted: "#6B6B76",
    line: "#E4E5EA",
    sidebar: "#131316",
    orange: "#F0932B",
    green: "#2EB872",
  },
  font: {
    title: '"Anton", sans-serif',
    body: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  // Área segura do Reels (1080x1920).
  safe: { top: 192, bottom: 288, side: 72 },
  grainOpacity: 0.05,
} as const;
