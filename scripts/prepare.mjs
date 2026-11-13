// Roda antes de `npm run dev` e `npm run render`.
// 1) Varre public/ e grava src/generated/assets.json (existência + dimensões),
//    para que as cenas escolham clipe/print real ou o fallback em tempo de build.
// 2) Gera a trilha provisória e os efeitos sonoros com ffmpeg, se não existirem.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");

const ffmpeg = (args) => {
  const base = ["-hide_banner", "-loglevel", "error", "-y", ...args];
  try {
    execFileSync("ffmpeg", base, { stdio: "inherit" });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    // Sem ffmpeg no sistema: usa o que vem embutido no Remotion.
    execFileSync("npx", ["remotion", "ffmpeg", ...base], { stdio: "inherit", cwd: root });
  }
};

// ---------- ÁUDIO ----------
const BPM = 128;
const B = 60 / BPM; // 0,46875 s por batida
const DUR = 30;
const audioDir = path.join(pub, "audio");
const sfxDir = path.join(audioDir, "sfx");
fs.mkdirSync(sfxDir, { recursive: true });

const src = (expr, d) => ["-f", "lavfi", "-i", `aevalsrc=exprs='${expr}':s=48000:d=${d}`];

const hasLicensed = fs.existsSync(path.join(audioDir, "trilha.mp3"));
const provisoria = path.join(audioDir, "provisoria.wav");
if (!hasLicensed && !fs.existsSync(provisoria)) {
  console.log("[prepare] gerando trilha provisória (128 BPM, lá menor)...");
  const bar = B * 4;
  // Kick 4x4: seno com queda de afinação.
  const kick = `0.95*sin(2*PI*(46*mod(t,${B})+3.6*(1-exp(-32*mod(t,${B})))))*exp(-7*mod(t,${B}))`;
  // Baixo no contratempo. Progressão: Lá – Lá – Fá – Sol.
  const f = `(55*lt(mod(floor(t/${bar}),4),2)+43.65*eq(mod(floor(t/${bar}),4),2)+49*eq(mod(floor(t/${bar}),4),3))`;
  const tb = `mod(t+${B / 2},${B})`;
  const bass = `(sin(2*PI*${f}*t)+0.5*sin(4*PI*${f}*t)+0.33*sin(6*PI*${f}*t)+0.2*sin(8*PI*${f}*t))*exp(-5*${tb})*(1-exp(-300*${tb}))*0.5`;
  // Hi-hat em colcheias de contratempo (entra aos 6 s) + semicolcheias a partir de 24,4 s.
  const hat = `(random(0)*2-1)*(exp(-70*mod(t+${B / 2},${B}))*gte(t,${B * 13})+0.5*exp(-90*mod(t,${B / 4}))*gte(t,${B * 52}))`;
  // Clap nos tempos 2 e 4 (a partir de 6 s).
  const clap = `(random(1)*2-1)*exp(-28*mod(t+${B},${B * 2}))*gte(t,${B * 13})`;
  // Pad de lá menor (A2, C3, E3) com tremolo lento.
  const pad = `(sin(2*PI*110*t)+sin(2*PI*130.81*t)+sin(2*PI*164.81*t)+0.5*sin(2*PI*220*t))*(0.6+0.4*sin(2*PI*t/${bar}))*0.12`;
  ffmpeg([
    ...src(kick, DUR),
    ...src(bass, DUR),
    ...src(hat, DUR),
    ...src(clap, DUR),
    ...src(pad, DUR),
    "-filter_complex",
    [
      "[0:a]lowpass=f=900,volume=0.85[k]",
      "[1:a]lowpass=f=500,volume=0.75[b]",
      "[2:a]highpass=f=7500,volume=0.16[h]",
      "[3:a]bandpass=f=1700:w=1400,volume=0.5[c]",
      "[4:a]lowpass=f=1500,volume=0.9[p]",
      "[k][b][h][c][p]amix=inputs=5:normalize=0,alimiter=limit=0.89:level=disabled,aformat=channel_layouts=stereo[out]",
    ].join(";"),
    "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", provisoria,
  ]);
}

// SFX: todos com pico em ~-6 dBFS para a soma com a trilha nunca clipar.
const sfx = {
  "whoosh.wav": {
    d: 0.25,
    expr: `(random(0)*2-1)*pow(sin(PI*t/0.25),2)`,
    af: "highpass=f=700,lowpass=f=5000,volume=1.6",
  },
  "tick.wav": {
    d: 0.06,
    expr: `sin(2*PI*2400*t)*exp(-90*t)`,
    af: "volume=0.9",
  },
  "thud.wav": {
    d: 0.45,
    expr: `sin(2*PI*(38*t+2.2*(1-exp(-25*t))))*exp(-7*t)+0.25*(random(0)*2-1)*exp(-120*t)`,
    af: "lowpass=f=1800,volume=0.9",
  },
  "riser.wav": {
    d: 1,
    expr: `((random(0)*2-1)*0.6+0.5*sin(2*PI*(220*t+700*t*t)))*pow(t,2.2)`,
    af: "highpass=f=400,volume=1.2",
  },
};
for (const [name, s] of Object.entries(sfx)) {
  const out = path.join(sfxDir, name);
  if (fs.existsSync(out)) continue;
  console.log(`[prepare] gerando sfx ${name}`);
  ffmpeg([
    ...src(s.expr, s.d),
    "-af", `${s.af},alimiter=limit=0.5:level=disabled,aformat=channel_layouts=stereo`,
    "-ar", "48000", "-c:a", "pcm_s16le", out,
  ]);
}

// ---------- MANIFESTO DE ARQUIVOS ----------
const imageSize = (file) => {
  const buf = fs.readFileSync(file);
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return {};
};

const manifest = {};
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (!entry.name.startsWith(".")) {
      const rel = path.relative(pub, full).split(path.sep).join("/");
      manifest[rel] = /\.(png|jpe?g)$/i.test(entry.name) ? imageSize(full) : {};
    }
  }
};
walk(pub);
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.mkdirSync(path.join(root, "src/generated"), { recursive: true });
fs.writeFileSync(path.join(root, "src/generated/assets.json"), JSON.stringify(sorted, null, 2) + "\n");
console.log(`[prepare] ${Object.keys(sorted).length} arquivo(s) em public/ registrados em src/generated/assets.json`);
