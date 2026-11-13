// Conferência do MP4 final: formato (ffprobe), pico de áudio, cortes x batidas,
// quadros a cada 1,5 s (out/frames) e contact sheet de 10 quadros (um por cena).
import fs from "fs";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mp4 = path.join(root, "out/rage_area_aluno.mp4");
const framesDir = path.join(root, "out/frames");
const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let ok = true;
const expect = (label, got, want) => {
  const pass = String(got) === String(want);
  ok &&= pass;
  console.log(`${pass ? "OK  " : "ERRO"} ${label}: ${got}${pass ? "" : ` (esperado ${want})`}`);
};

// 1) formato
const probe = JSON.parse(run("ffprobe", ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", mp4]));
const v = probe.streams.find((s) => s.codec_type === "video");
const a = probe.streams.find((s) => s.codec_type === "audio");
expect("codec de vídeo", v.codec_name, "h264");
expect("largura", v.width, 1080);
expect("altura", v.height, 1920);
expect("pixel format", v.pix_fmt, "yuv420p");
expect("fps", v.r_frame_rate, "30/1");
expect("frames", v.nb_read_frames, 900);
expect("codec de áudio", a?.codec_name, "aac");
const sizeMb = fs.statSync(mp4).size / 1e6;
console.log(`${sizeMb < 80 ? "OK  " : "ERRO"} tamanho: ${sizeMb.toFixed(1)} MB · duração ${Number(probe.format.duration).toFixed(2)} s`);
ok &&= sizeMb < 80;

// 2) áudio sem clipping
const volErr = spawnSync("ffmpeg", ["-hide_banner", "-i", mp4, "-af", "volumedetect", "-vn", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const peak = Number(/max_volume: ([-\d.]+) dB/.exec(volErr)?.[1]);
console.log(`${peak < -0.1 ? "OK  " : "ERRO"} pico de áudio: ${peak} dB`);
ok &&= peak < -0.1;

// 3) cortes x batidas (128 BPM)
const BEAT = (30 * 60) / 128;
const starts = [0, 3, 6, 8, 10.5, 13, 15.5, 18, 21, 24.5];
const cuts = starts.map((s) => Math.round(Math.round((s * 30) / BEAT) * BEAT));
console.log("\nCena | roteiro (s) | corte (frame) | batida | desvio da batida (frames)");
cuts.forEach((c, i) => {
  const beat = Math.round(c / BEAT);
  console.log(`${String(i + 1).padStart(4)} | ${String(starts[i]).padStart(11)} | ${String(c).padStart(13)} | ${String(beat).padStart(6)} | ${(c - beat * BEAT).toFixed(2)}`);
});

// 4) quadros a cada 1,5 s
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vf", "fps=1/1.5,scale=540:-1", "-q:v", "3", path.join(framesDir, "t_%02d.jpg")]);

// 5) contact sheet: 1 quadro por cena (a ~70% de cada cena)
const all = [...cuts, 900];
const picks = cuts.map((c, i) => Math.round(c + (all[i + 1] - c) * 0.7));
const select = picks.map((f) => `eq(n\\,${f})`).join("+");
run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", mp4, "-vf", `select='${select}',scale=432:768,tile=5x2:padding=8:margin=8:color=0x0B0B0D`, "-frames:v", "1", "-q:v", "3", path.join(root, "out/contact_sheet.jpg")]);
console.log(`\nQuadros em out/frames/ · contact sheet em out/contact_sheet.jpg (frames ${picks.join(", ")})`);
process.exit(ok ? 0 : 1);
