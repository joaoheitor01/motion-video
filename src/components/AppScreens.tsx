// Telas de FALLBACK em CSS, usadas enquanto os prints reais não estão em public/prints.
// Reproduzem apenas a navegação do app (textos em config.APP); nenhum dado de aluno.
import React from "react";
import { APP, FallbackKind } from "../config";
import { theme } from "../theme";
import { Halter } from "./icons";

const a = theme.app;
const red = theme.color.red;
const body = theme.font.body;

const abs = (x: number, y: number, w?: number, h?: number): React.CSSProperties => ({
  position: "absolute",
  left: x,
  top: y,
  width: w,
  height: h,
  boxSizing: "border-box",
});

const card: React.CSSProperties = {
  background: a.card,
  border: `1.5px solid ${a.line}`,
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(20,20,30,.05)",
};

const IconBox: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: "rgba(227,30,36,.1)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Halter size={size * 0.62} />
  </div>
);

// ---------------- DESKTOP (1000 x 625) ----------------
const DW = 1000;
const DH = 625;

const DesktopFrame: React.FC<{ active: number; children: React.ReactNode }> = ({ active, children }) => (
  <div style={{ width: DW, height: DH, background: a.bg, position: "relative", fontFamily: body, color: a.ink }}>
    <div style={{ ...abs(0, 0, 190, DH), background: a.sidebar }}>
      <div style={{ ...abs(20, 24), color: red, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em" }}>{APP.brand}</div>
      <div style={{ ...abs(20, 56), color: "#70707A", fontSize: 9, fontWeight: 600, letterSpacing: "0.14em" }}>
        {APP.menuLabel}
      </div>
      {APP.menu.map((m, i) => (
        <div
          key={m}
          style={{
            ...abs(10, 80 + i * 40, 170, 34),
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingLeft: 12,
            fontSize: 13,
            fontWeight: 600,
            color: i === active ? "#fff" : "#C9C9D1",
            background: i === active ? "rgba(227,30,36,.22)" : "transparent",
            borderLeft: i === active ? `3px solid ${red}` : "3px solid transparent",
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${i === active ? red : "#8A8A94"}` }} />
          {m}
        </div>
      ))}
    </div>
    {children}
  </div>
);

const DesktopHeader: React.FC<{ eyebrow: string; title: string }> = ({ eyebrow, title }) => (
  <>
    <div style={{ ...abs(220, 40), color: red, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em" }}>{eyebrow}</div>
    <div style={{ ...abs(220, 62), fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em" }}>{title}</div>
  </>
);

const DesktopHome: React.FC = () => (
  <DesktopFrame active={0}>
    <DesktopHeader eyebrow={APP.home.eyebrow} title={APP.home.title} />
    {APP.home.tiles.map((t, i) => (
      <div
        key={t}
        style={{
          ...abs(220 + (i % 2) * 387, 160 + Math.floor(i / 2) * 204, 363, 180),
          ...card,
          padding: 26,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <IconBox size={56} />
        <div style={{ fontSize: 26, fontWeight: 700 }}>{t}</div>
      </div>
    ))}
  </DesktopFrame>
);

const DesktopObjetivo: React.FC = () => (
  <DesktopFrame active={3}>
    <DesktopHeader eyebrow={APP.objetivo.eyebrow} title={APP.objetivo.title} />
    {APP.objetivo.options.map((o, i) => (
      <div
        key={o}
        style={{
          ...abs(220 + (i % 2) * 387, 160 + Math.floor(i / 2) * 204, 363, 180),
          ...card,
          padding: 26,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <IconBox size={56} />
        <div style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.15 }}>{o}</div>
      </div>
    ))}
  </DesktopFrame>
);

const OptionButton: React.FC<{ x: number; y: number; w: number; text: string; big?: boolean }> = ({ x, y, w, text, big }) => (
  <div
    style={{
      ...abs(x, y, w, 90),
      ...card,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: big ? 38 : 22,
      fontWeight: 700,
    }}
  >
    {text}
  </div>
);

const DesktopRotina: React.FC = () => (
  <DesktopFrame active={3}>
    <DesktopHeader eyebrow={APP.rotina.eyebrow} title={APP.rotina.title} />
    <div style={{ ...abs(220, 148), fontSize: 20, fontWeight: 600, color: a.muted }}>{APP.rotina.daysLabel}</div>
    {APP.rotina.days.map((d, i) => (
      <OptionButton key={d} x={220 + i * 140} y={190} w={120} text={d} big />
    ))}
    <div style={{ ...abs(220, 328), fontSize: 20, fontWeight: 600, color: a.muted }}>{APP.rotina.minutesLabel}</div>
    {APP.rotina.minutes.map((m, i) => (
      <OptionButton key={m} x={220 + i * 190} y={370} w={170} text={m} />
    ))}
  </DesktopFrame>
);

// ---------------- MOBILE (390 de largura) ----------------
const MW = 390;

const MobileFrame: React.FC<{ height: number; children: React.ReactNode }> = ({ height, children }) => (
  <div style={{ width: MW, height, background: a.bg, position: "relative", fontFamily: body, color: a.ink }}>
    <div style={{ ...abs(0, 0, MW, 56), background: a.sidebar }}>
      <div style={{ ...abs(20, 21), color: red, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em" }}>{APP.brand}</div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...abs(348, 20 + i * 7, 22, 2.5), background: "#D5D5DC", borderRadius: 2 }} />
      ))}
    </div>
    {children}
  </div>
);

const MobileHome: React.FC = () => (
  <MobileFrame height={800}>
    <div style={{ ...abs(20, 80), color: red, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em" }}>{APP.home.eyebrow}</div>
    <div style={{ ...abs(20, 98), fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{APP.home.title}</div>
    {APP.home.tiles.map((t, i) => (
      <div
        key={t}
        style={{
          ...abs(20 + (i % 2) * 181, 160 + Math.floor(i / 2) * 176, 169, 160),
          ...card,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <IconBox size={46} />
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15 }}>{t}</div>
      </div>
    ))}
    {[0, 1].map((i) => (
      <div key={i} style={{ ...abs(20, 520 + i * 96, 350, 80), ...card, padding: 18 }}>
        <div style={{ width: 150, height: 12, borderRadius: 6, background: a.line }} />
        <div style={{ width: 240, height: 10, borderRadius: 5, background: a.bg, marginTop: 14 }} />
      </div>
    ))}
  </MobileFrame>
);

const ROW_H = 78;
const CARD_HEAD = 66;
const CARD_H = CARD_HEAD + 4 * ROW_H + 14;
const PLANO_TOP = 216;
const PLANO_H = PLANO_TOP + APP.plano.workouts.length * (CARD_H + 18) + 10;

const Bar: React.FC<{ w: number; h?: number; dark?: boolean }> = ({ w, h = 11, dark }) => (
  <div style={{ width: w, height: h, borderRadius: h / 2, background: dark ? "#D9DAE0" : a.line }} />
);

const MobilePlano: React.FC = () => (
  <MobileFrame height={PLANO_H}>
    <div style={{ ...abs(20, 78), fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em" }}>{APP.plano.title}</div>
    <div style={{ ...abs(20, 114), fontSize: 13.5, fontWeight: 500, color: a.muted }}>{APP.plano.subtitle}</div>
    {APP.plano.tabs.map((t, i) => {
      const on = i === APP.plano.activeTab;
      return (
        <div
          key={t}
          style={{
            ...abs(20 + i * 89, 152, 82, 40),
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            background: on ? red : a.card,
            color: on ? "#fff" : red,
            border: `1.5px solid ${on ? red : "rgba(227,30,36,.45)"}`,
          }}
        >
          {t}
        </div>
      );
    })}
    {APP.plano.workouts.map((w, wi) => (
      <div key={w.name} style={{ ...abs(20, PLANO_TOP + wi * (CARD_H + 18), 350, CARD_H), ...card, overflow: "hidden" }}>
        <div
          style={{
            height: CARD_HEAD,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            fontSize: 15.5,
            fontWeight: 700,
            lineHeight: 1.2,
            borderBottom: `1.5px solid ${a.line}`,
          }}
        >
          {w.name}
        </div>
        {[0, 1, 2, 3].map((ri) => {
          const row = w.rows[ri];
          return (
            <div
              key={ri}
              style={{
                height: ROW_H,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderBottom: ri < 3 ? `1px solid ${a.bg}` : undefined,
              }}
            >
              <IconBox size={42} />
              <div style={{ flex: 1 }}>
                {row ? (
                  <>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{row[0]}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: a.muted, marginTop: 5, display: "flex", gap: 10 }}>
                      {APP.plano.columns.map((c, ci) => (
                        <span key={c}>
                          {c}: <b style={{ color: a.ink }}>{row[ci + 1]}</b>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Bar w={150 - ri * 14} dark />
                    <div style={{ height: 10 }} />
                    <Bar w={220} h={9} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ))}
  </MobileFrame>
);

/** Silhueta frontal estilizada (formas simples), com grupos em 3 estados. */
const BodyMap: React.FC = () => {
  const r = red;
  const o = a.orange;
  const g = a.green;
  const skin = "#E7E8EC";
  return (
    <svg width={220} height={380} viewBox="0 0 220 380">
      {/* cabeça e pescoço */}
      <circle cx="110" cy="30" r="24" fill={skin} />
      <rect x="100" y="50" width="20" height="18" rx="6" fill={skin} />
      {/* ombros */}
      <ellipse cx="62" cy="86" rx="22" ry="17" fill={o} />
      <ellipse cx="158" cy="86" rx="22" ry="17" fill={o} />
      {/* peitoral */}
      <rect x="72" y="72" width="36" height="40" rx="12" fill={g} />
      <rect x="112" y="72" width="36" height="40" rx="12" fill={g} />
      {/* abdômen */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="88" y={118 + i * 24} width="20" height="20" rx="6" fill={g} />
          <rect x="112" y={118 + i * 24} width="20" height="20" rx="6" fill={g} />
        </g>
      ))}
      <path d="M72 116h12v70l-8-6z" fill={skin} />
      <path d="M148 116h-12v70l8-6z" fill={skin} />
      {/* braços */}
      <rect x="36" y="100" width="24" height="62" rx="12" fill={o} />
      <rect x="160" y="100" width="24" height="62" rx="12" fill={o} />
      <rect x="30" y="166" width="22" height="64" rx="11" fill={skin} />
      <rect x="168" y="166" width="22" height="64" rx="11" fill={skin} />
      {/* quadril */}
      <path d="M80 192h60l6 16H74z" fill={skin} />
      {/* coxas */}
      <rect x="72" y="208" width="34" height="86" rx="16" fill={r} />
      <rect x="114" y="208" width="34" height="86" rx="16" fill={r} />
      {/* joelhos e pernas */}
      <rect x="78" y="296" width="24" height="14" rx="7" fill={skin} />
      <rect x="118" y="296" width="24" height="14" rx="7" fill={skin} />
      <rect x="76" y="312" width="28" height="62" rx="13" fill={r} />
      <rect x="116" y="312" width="28" height="62" rx="13" fill={r} />
    </svg>
  );
};

const MobileEvolucao: React.FC = () => (
  <MobileFrame height={860}>
    <div style={{ ...abs(20, 78), fontSize: 25, fontWeight: 700, letterSpacing: "-0.02em" }}>{APP.evolucao.title}</div>
    <div
      style={{
        ...abs(20, 126, 350, 460),
        ...card,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <BodyMap />
      <div style={{ fontSize: 11.5, color: a.muted, fontWeight: 500 }}>{APP.evolucao.mapCaption}</div>
    </div>
    {APP.evolucao.legend.map((l, i) => (
      <div
        key={l}
        style={{ ...abs(20, 604 + i * 78, 350, 66), ...card, display: "flex", alignItems: "center", gap: 14, padding: "0 20px" }}
      >
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: [red, a.orange, a.green][i] }} />
        <div style={{ fontSize: 16.5, fontWeight: 700 }}>{l}</div>
      </div>
    ))}
  </MobileFrame>
);

export const FALLBACK_SCREENS: Record<FallbackKind, { w: number; h: number; Component: React.FC }> = {
  desktopHome: { w: DW, h: DH, Component: DesktopHome },
  desktopObjetivo: { w: DW, h: DH, Component: DesktopObjetivo },
  desktopRotina: { w: DW, h: DH, Component: DesktopRotina },
  mobileHome: { w: MW, h: 800, Component: MobileHome },
  mobilePlano: { w: MW, h: PLANO_H, Component: MobilePlano },
  mobileEvolucao: { w: MW, h: 860, Component: MobileEvolucao },
};
