#!/usr/bin/env node
// Orquestrador do Video Studio Local.
// Uso: node scripts/produce.mjs <slug> [etapa ...]
// Etapas: narrate timeline render mix export qa  (padrão: todas, em ordem)
// Requer storyboard.json aprovado em projects/<slug>/.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PY = path.join(STUDIO, "audio-engine", ".venv", "Scripts", "python.exe");
const PRESETS = JSON.parse(fs.readFileSync(path.join(STUDIO, "config", "export-presets.json"), "utf8"));

const [slug, ...stagesArg] = process.argv.slice(2);
if (!slug) {
  console.error("Uso: node scripts/produce.mjs <slug> [narrate timeline render mix export qa]");
  process.exit(1);
}
const STAGES = ["narrate", "timeline", "render", "mix", "export", "qa"];
const stages = stagesArg.length ? stagesArg : STAGES;
const P = path.join(STUDIO, "projects", slug);
const p = (...a) => path.join(P, ...a);
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, d) => (fs.mkdirSync(path.dirname(f), { recursive: true }), fs.writeFileSync(f, JSON.stringify(d, null, 2)));
const log = (...a) => console.log("[studio]", ...a);
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26, shell: false, ...opts });
const CLIS = {
  remotion: path.join(STUDIO, "remotion", "node_modules", "@remotion", "cli", "remotion-cli.js"),
  hyperframes: path.join(STUDIO, "hyperframes", "node_modules", "hyperframes", "bin", "hyperframes.mjs"),
};
const npx = ([tool, ...args], cwd) => run(process.execPath, [CLIS[tool], ...args], { cwd });
const probeDuration = (f) => parseFloat(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]));

const sb = readJson(p("storyboard.json"));
if (sb.approved !== true) {
  console.error("storyboard.json não aprovado (\"approved\": true). Checkpoint humano pendente.");
  process.exit(2);
}
const preset = PRESETS[sb.preset ?? "fullhd-web"];
const FPS = preset.fps;

// ---------- 1. Narração ----------
function narrate() {
  const jobs = sb.scenes
    .filter((s) => s.narration)
    .map((s) => ({
      text: s.narration, voice: s.voice ?? sb.voice, out: p("narration", `${s.id}.wav`),
      perfil: s.profile ?? sb.profile, // perfil de fala (config/speech-profiles.json)
      prep: s.prep ?? sb.prep ?? true, // false = texto cru, sem pré-processamento
      lexico: fs.existsSync(p("pronunciations.json")) ? p("pronunciations.json") : undefined,
    }));
  writeJson(p("narration", "_jobs.json"), jobs);
  const res = JSON.parse(run(PY, [path.join(STUDIO, "audio-engine", "tts.py"), "--batch", p("narration", "_jobs.json")]));
  const map = {};
  sb.scenes.filter((s) => s.narration).forEach((s, i) => {
    // duração real medida pelo ffprobe (fonte de verdade)
    map[s.id] = { ...res[i], duration_s: probeDuration(res[i].path) };
  });
  writeJson(p("narration", "narration.json"), map);
  log("narração:", Object.entries(map).map(([k, v]) => `${k}=${v.duration_s.toFixed(2)}s(${v.engine})`).join(" "));
}

// ---------- 2. Timeline ----------
function timeline() {
  const nar = readJson(p("narration", "narration.json"));
  let cursor = 0;
  const scenes = sb.scenes.map((s) => {
    const pre = s.pre_pad ?? 0.4, post = s.post_pad ?? 0.7;
    const n = nar[s.id];
    const dur = n ? pre + n.duration_s + post : s.min_duration ?? 3;
    const frames = Math.ceil(dur * FPS);
    const sc = {
      ...s, start_frame: cursor, frames,
      narration: n ? { file: path.relative(P, n.path), offset_frames: Math.round(pre * FPS), duration_s: n.duration_s } : null,
    };
    cursor += frames;
    return sc;
  });
  const segments = [];
  for (const s of scenes) {
    const last = segments.at(-1);
    if (last && last.engine === s.engine) { last.scenes.push(s.id); last.frames += s.frames; }
    else segments.push({ id: `seg-${String(segments.length + 1).padStart(2, "0")}`, engine: s.engine, scenes: [s.id], start_frame: s.start_frame, frames: s.frames });
  }
  writeJson(p("timeline.json"), { fps: FPS, width: preset.width, height: preset.height, total_frames: cursor, segments, scenes, music: sb.music, theme: sb.theme });
  log(`timeline: ${scenes.length} cenas, ${segments.length} segmentos, ${(cursor / FPS).toFixed(2)}s`);
}

// ---------- 3. Render ----------
function hyperframesHtml(seg, scenes, tl) {
  const th = tl.theme ?? { bg: "#0b1020", ink: "#f5f7ff", accent: "#4cc9f0" };
  const total = seg.frames / FPS;
  let t = 0, html = "", js = "";
  for (const s of scenes) {
    const st = t, d = s.frames / FPS, id = `s_${s.id}`;
    const bullets = (s.bullets ?? []).map((b, i) => `<li class="b b${i}">${b}</li>`).join("");
    html += `<section id="${id}" class="clip scene" data-start="${st.toFixed(3)}" data-duration="${d.toFixed(3)}">
  <div class="kicker">${s.sub ?? ""}</div><h1>${s.heading.split(" ").map((w) => `<span class="w">${w}</span>`).join(" ")}</h1>
  <div class="bar"></div><ul>${bullets}</ul></section>\n`;
    js += `tl.from("#${id} .w",{y:80,opacity:0,rotate:4,stagger:0.08,duration:0.7,ease:"back.out(1.7)"},${st.toFixed(3)});
tl.from("#${id} .bar",{scaleX:0,transformOrigin:"left",duration:0.6,ease:"power3.out"},${(st + 0.3).toFixed(3)});
tl.from("#${id} .kicker",{opacity:0,y:-20,duration:0.5},${(st + 0.2).toFixed(3)});
tl.from("#${id} .b",{x:-60,opacity:0,stagger:0.25,duration:0.5,ease:"power2.out"},${(st + 0.6).toFixed(3)});
tl.to("#${id}",{opacity:0,duration:0.35},${(st + d - 0.4).toFixed(3)});\n`;
    t += d;
  }
  return `<!doctype html><html lang="pt-BR" data-resolution="landscape"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=1920, height=1080"/><script src="gsap.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:${th.bg}}
#root{width:100%;height:100%;font-family:"Segoe UI",Arial,sans-serif;color:${th.ink};
background:radial-gradient(circle at 70% 30%,${th.accent}40,${th.bg} 60%)}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 180px}
h1{font-size:96px;font-weight:800;letter-spacing:-.02em}.w{display:inline-block}
.kicker{font-size:36px;color:${th.accent};text-transform:uppercase;letter-spacing:.2em;margin-bottom:24px}
.bar{height:8px;width:260px;background:${th.accent};border-radius:4px;margin:32px 0}
ul{list-style:none}li{font-size:50px;margin:14px 0}li::before{content:"▸ ";color:${th.accent}}
#orb{position:absolute;width:520px;height:520px;border-radius:50%;right:-120px;bottom:-160px;background:${th.accent};opacity:.18;filter:blur(20px)}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${total.toFixed(3)}" data-width="1920" data-height="1080" data-fps="${FPS}">
<div id="orb" class="clip" data-start="0" data-duration="${total.toFixed(3)}"></div>
${html}</div><script>const tl=gsap.timeline({paused:true});
tl.to("#orb",{x:-300,y:-200,scale:1.4,duration:${total.toFixed(3)},ease:"none"},0);
${js}window.__timelines["main"]=tl;tl.seek(0);</script></body></html>`;
}

function render() {
  const tl = readJson(p("timeline.json"));
  fs.mkdirSync(p("renders"), { recursive: true });
  for (const seg of tl.segments) {
    const scenes = seg.scenes.map((id) => tl.scenes.find((s) => s.id === id));
    const out = p("renders", `${seg.id}.mp4`);
    log(`render ${seg.id} (${seg.engine}, ${seg.frames} frames)`);
    if (seg.engine === "remotion") {
      const props = p("renders", `${seg.id}.props.json`);
      writeJson(props, { fps: FPS, theme: tl.theme, scenes: scenes.map(({ id, template, heading, sub, bullets, frames }) => ({ id, template, heading, sub, bullets, frames })) });
      npx(["remotion", "render", "src/studio/index.ts", "StudioSegment", out, `--props=${props}`, "--log=error"], path.join(STUDIO, "remotion"));
    } else if (seg.engine === "hyperframes") {
      const dir = p("hyperframes", seg.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(STUDIO, "hyperframes", "vendor", "gsap.min.js"), path.join(dir, "gsap.min.js"));
      fs.writeFileSync(path.join(dir, "index.html"), hyperframesHtml(seg, scenes, tl));
      npx(["hyperframes", "render", dir, "-o", out, "--fps", String(FPS), "--quiet"], path.join(STUDIO, "hyperframes"));
    } else throw new Error(`motor desconhecido: ${seg.engine}`);
    const got = Math.round(probeDuration(out) * FPS);
    if (Math.abs(got - seg.frames) > 1) log(`AVISO ${seg.id}: esperado ${seg.frames} frames, obtido ${got}`);
  }
}

// ---------- 4. Mix (trilha + SFX + narração + ducking + loudnorm 2 passes) ----------
function mix() {
  const tl = readJson(p("timeline.json"));
  const total = tl.total_frames / FPS;
  const M = (...a) => p("mix", ...a);
  fs.mkdirSync(M(), { recursive: true });
  const resolveAsset = (f) => path.isAbsolute(f) ? f : fs.existsSync(p(f)) ? p(f) : path.join(STUDIO, f);

  // narração: uma faixa contínua
  const nar = tl.scenes.filter((s) => s.narration);
  const nIn = nar.flatMap((s) => ["-i", p(s.narration.file)]);
  const nF = nar.map((s, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round(((s.start_frame + s.narration.offset_frames) / FPS) * 1000)}:all=1[n${i}]`).join(";");
  run("ffmpeg", ["-y", "-v", "error", ...nIn, "-filter_complex", `${nF};${nar.map((_, i) => `[n${i}]`).join("")}amix=inputs=${nar.length}:normalize=0,apad=whole_dur=${total}[o]`, "-map", "[o]", "-t", String(total), M("voice.wav")]);

  // SFX
  const sfx = tl.scenes.filter((s) => s.sfx).map((s) => ({ file: resolveAsset(s.sfx.file), at: s.start_frame / FPS + (s.sfx.offset ?? 0), gain: s.sfx.gain_db ?? -8 }));
  const music = tl.music ? resolveAsset(tl.music.file) : null;
  const inputs = ["-i", M("voice.wav")];
  let fc = "[0:a]asplit=2[v1][vsc];";
  let bus = ["[v1]"], idx = 1;
  if (music) {
    inputs.push("-stream_loop", "-1", "-i", music);
    fc += `[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${total},volume=${tl.music.gain_db ?? -16}dB,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, total - 2.5)}:d=2.5[mus];[mus][vsc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];`;
    bus.push("[duck]"); idx++;
  }
  sfx.forEach((s, i) => {
    inputs.push("-i", s.file);
    fc += `[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${s.gain}dB,adelay=${Math.round(s.at * 1000)}:all=1[fx${i}];`;
    bus.push(`[fx${i}]`); idx++;
  });
  fc += `${bus.join("")}amix=inputs=${bus.length}:normalize=0:duration=first[mix]`;
  run("ffmpeg", ["-y", "-v", "error", ...inputs, "-filter_complex", fc, "-map", "[mix]", "-t", String(total), "-c:a", "pcm_s24le", M("premix.wav")]);

  // loudnorm passo 1 (medição)
  const L = preset.loudness;
  const ln = `loudnorm=I=${L.I}:TP=${L.TP}:LRA=${L.LRA}`;
  const err = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", M("premix.wav"), "-af", `${ln}:print_format=json`, "-f", "null", "-"]);
  const measured = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/.exec(err)[0]);
  writeJson(M("loudnorm.json"), { target: L, measured });
  // loudnorm passo 2 (aplicação)
  const pass2 = `${ln}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=summary`;
  run("ffmpeg", ["-y", "-v", "error", "-i", M("premix.wav"), "-af", `${pass2},aresample=48000`, "-c:a", "pcm_s24le", M("final.wav")]);
  log(`mix: medido ${measured.input_i} LUFS → alvo ${L.I} LUFS`);
}

// ---------- 5. Export ----------
function exportMp4() {
  const tl = readJson(p("timeline.json"));
  const v = preset.video, a = preset.audio;
  const segs = tl.segments.map((s) => p("renders", `${s.id}.mp4`));
  const inputs = segs.flatMap((f) => ["-i", f]);
  const norm = segs.map((_, i) => `[${i}:v]scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2,scale=out_range=tv,fps=${FPS},format=yuv420p,setsar=1[v${i}]`).join(";");
  const fc = `${norm};${segs.map((_, i) => `[v${i}]`).join("")}concat=n=${segs.length}:v=1:a=0[v]`;
  fs.mkdirSync(path.join(STUDIO, "output"), { recursive: true });
  const out = path.join(STUDIO, "output", `${slug}.mp4`);
  run("ffmpeg", ["-y", "-v", "error", ...inputs, "-i", p("mix", "final.wav"), "-filter_complex", fc,
    "-map", "[v]", "-map", `${segs.length}:a`, "-c:v", v.codec, "-preset", v.preset, "-crf", String(v.crf), "-pix_fmt", "yuv420p", "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-r", String(FPS), "-c:a", a.codec, "-b:a", a.bitrate, "-ar", String(a.sample_rate), "-ac", "2", "-movflags", "+faststart",
    "-t", String(tl.total_frames / FPS), out]);
  log("export:", out);
}

// ---------- 6. QA ----------
function qa() {
  const out = path.join(STUDIO, "output", `${slug}.mp4`);
  const tl = readJson(p("timeline.json"));
  const info = JSON.parse(run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", out]));
  const vs = info.streams.find((s) => s.codec_type === "video"), as = info.streams.find((s) => s.codec_type === "audio");
  const r = spawn("ffmpeg", ["-hide_banner", "-nostats", "-i", out, "-af", "ebur128=peak=true", "-vf", "blackdetect=d=0.5:pix_th=0.05", "-f", "null", "-"]);
  const I = parseFloat(/I:\s+(-?[\d.]+) LUFS\s+Threshold[\s\S]*?LRA:/.exec(r.split("Summary:").pop())?.[1]);
  const TP = parseFloat(/Peak:\s+(-?[\d.]+) dBFS/.exec(r.split("Summary:").pop())?.[1]);
  const blacks = (r.match(/black_start/g) || []).length;
  const expected = tl.total_frames / FPS;
  const checks = {
    resolucao: `${vs.width}x${vs.height}` === `${preset.width}x${preset.height}`,
    fps: vs.r_frame_rate === `${FPS}/1`,
    codec_video: vs.codec_name === "h264" && vs.pix_fmt === "yuv420p",
    audio: as?.codec_name === "aac" && +as.sample_rate === preset.audio.sample_rate,
    duracao: Math.abs(parseFloat(info.format.duration) - expected) <= 2 / FPS + 0.05,
    loudness: Math.abs(I - preset.loudness.I) <= 1.0,
    true_peak: TP <= preset.loudness.TP + 0.5,
    sem_tela_preta: blacks === 0,
  };
  const report = { file: out, duration_s: +info.format.duration, expected_s: expected, video: `${vs.codec_name} ${vs.width}x${vs.height} ${vs.r_frame_rate} ${vs.pix_fmt}`, audio: `${as?.codec_name} ${as?.sample_rate}Hz`, integrated_lufs: I, true_peak_dbfs: TP, black_segments: blacks, checks, pass: Object.values(checks).every(Boolean) };
  writeJson(p("qa.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 3;
}

function spawn(cmd, args) { return spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 }).stderr; }

const fns = { narrate, timeline, render, mix, export: exportMp4, qa };
for (const s of stages) {
  if (!fns[s]) { console.error(`etapa desconhecida: ${s}`); process.exit(1); }
  const t0 = Date.now();
  fns[s]();
  log(`✔ ${s} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
