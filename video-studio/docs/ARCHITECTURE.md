# Video Studio Local — Arquitetura Técnica

> Versão 0.2 · 2026-11-13 · Status: **instalado e validado ponta a ponta** (ver §0)

## 0. Estado real da instalação (v0.2)

| Componente | Versão instalada | Local | Status |
|------------|------------------|-------|--------|
| Remotion | 4.0.543 (inalterado) | `remotion/`; o estúdio usa um **entry separado** `src/studio/index.ts` (composição `StudioSegment`) | ✅ Studio original preservado (`Root.tsx`/`index.ts` intactos) |
| HyperFrames | 0.9.41 (npm `hyperframes`, Apache-2.0) | `hyperframes/` (+ `starter/` de exemplo) | ✅ render 1080p30 com Chrome headless. Telemetria **desativada** (`hyperframes telemetry disable`) |
| GSAP | 3.15.1 | `hyperframes/node_modules`, cópia local em `hyperframes/vendor/gsap.min.js` (sem CDN no render) | ✅ |
| Kokoro | modelo v1.0 ONNX (`kokoro-v1.0.onnx` + `voices-v1.0.bin`), runtime **`kokoro-onnx` 0.6.1 (MIT)** | `audio-engine/models/kokoro/` | ✅ pt-BR funciona (`lang="pt-br"`, espeak-ng embutido via `espeakng-loader`; não foi preciso instalar o espeak-ng no sistema). Vozes `pf_dora`, `pm_alex`, `pm_santa`. 24 kHz, aproximadamente 3× tempo real em CPU |
| Piper | `piper-tts` 1.8.0 (piper1-gpl, GPL-3.0) | `audio-engine/.venv` | ✅ voz `pt_BR-faber-medium` (22.050 Hz) em `audio-engine/models/piper/` |
| Python | 3.12.10, venv `audio-engine/.venv` | `audio-engine/requirements.lock.txt` | ✅ |
| FFmpeg | 9.0.1 (build gyan.dev essentials) | sistema | ✅ mix, loudnorm em 2 passes, export, QA |
| Remotion Superpowers | **não instalado** | — | ⏳ triagem pendente (§10) |
| Skill `video-production` | criada | `.claude/skills/video-production/SKILL.md` | ✅ |

**Decisão (Kokoro):** usamos `kokoro-onnx` em vez do pacote `kokoro` (PyTorch). Ele roda com o mesmo modelo v1.0, sem PyTorch (cerca de 2 GB a menos), reaproveita o `onnxruntime` do Piper e traz o espeak-ng embutido no Windows.

**Arquivos operacionais criados:**

| Arquivo | Função |
|---------|--------|
| `audio-engine/tts.py` | Adaptador comum `synthesize()`, com fallback Kokoro → Piper |
| `config/voices.json` | Apelidos de voz: `narradora` (pf_dora), `narrador` (pm_alex), `narrador-2` (pm_santa), `piper-faber` |
| `config/export-presets.json` | Presets `fullhd-web` (-14 LUFS) e `fullhd-broadcast` (-23 LUFS) |
| `scripts/produce.mjs` | Orquestrador das etapas `narrate`, `timeline`, `render`, `mix`, `export` e `qa` |
| `scripts/gen-assets.sh` | Gera a trilha e os SFX de demonstração (obra própria) |
| `remotion/src/studio/*` | Templates Remotion `title`, `bullets` e `outro`, com duração vinda das props via `calculateMetadata` |
| `projects/demo-estudio/` | Projeto de validação |
| `output/demo-estudio.mp4` | Vídeo de validação: 34,3 s, H.264 1920×1080 30 fps, AAC 48 kHz, -14,2 LUFS, TP -1,4 dBTP, QA aprovado |

**Diferenças em relação ao plano v0.1:**

- O `storyboard.json` também carrega o texto da narração por cena e o campo `"approved": true`. O orquestrador se recusa a rodar sem esse campo, o que implementa o checkpoint 2.
- Os templates HyperFrames são gerados pelo `produce.mjs` (função `hyperframesHtml`) em `projects/<slug>/hyperframes/<seg>/`.
- Transições entre motores são cortes secos (o `xfade` ainda não foi implementado).
- A licença da voz `pt_BR-faber-medium` **ainda não foi confirmada**. Verifique o MODEL_CARD em https://huggingface.co/rhasspy/piper-voices antes de uso comercial.
- O HyperFrames baixa e armazena em cache fontes do Google Fonts (`~/.cache/hyperframes`) e, na primeira execução, um Chrome headless. Remotion também baixa o seu Chrome headless na primeira renderização. Tudo gratuito.

### Como iniciar

```powershell
# Pré-visualizar os templates Remotion do estúdio
cd remotion; npx remotion studio src/studio/index.ts
# O Studio original continua igual: cd remotion; npm run dev

# Produzir um vídeo (storyboard aprovado em projects/<slug>/)
node scripts/produce.mjs <slug>                    # todas as etapas
node scripts/produce.mjs <slug> render export qa   # apenas algumas etapas

# Testar uma voz
audio-engine\.venv\Scripts\python audio-engine\tts.py --text "Olá" --voice narrador --out output\teste.wav

# No Claude Code: peça um vídeo; a skill video-production coordena o fluxo
```

## 1. Visão geral

O Video Studio é um ambiente **local e gratuito** para produzir vídeos narrados em **português brasileiro**, exportados em **MP4 Full HD (1920×1080)**. O Claude Code coordena o trabalho através de uma skill própria, a `video-production`.

### 1.1 Princípios

| # | Princípio | Consequência prática |
|---|-----------|----------------------|
| P1 | Execução local e gratuita | Nenhuma API paga é obrigatória. Integrações pagas, se um dia forem usadas, serão opcionais e desligadas por padrão. |
| P2 | Motores independentes | Remotion e HyperFrames não importam código um do outro. Eles compartilham apenas **arquivos**: assets, áudio, vídeo, JSON e metadados. |
| P3 | Áudio manda no tempo | A timeline usa a **duração real medida** dos áudios gerados. A estimativa do roteiro serve só para planejamento. |
| P4 | Humano no circuito | Há checkpoints obrigatórios de aprovação após o **roteiro** e após o **storyboard**. |
| P5 | Reprodutibilidade | Cada projeto guarda em JSON as entradas, as versões das ferramentas e os parâmetros usados. Renderizar de novo produz o mesmo resultado. |
| P6 | Licença rastreável | Todo asset de terceiros (voz, trilha, efeito sonoro, imagem) entra com a licença registrada. |

### 1.2 Ambiente de referência

| Item | Versão |
|------|--------|
| SO | Windows 11 Pro |
| Claude Code | 2.1.318 (modelo Claude Opus 5.5) |
| Node.js | 26.13.1 |
| Python | 3.12.10 |
| FFmpeg | 9.0.1 |
| Remotion | 4.0.543 (`./remotion`, Studio em `localhost:3000`) |

---

## 2. Ferramentas e papéis

| Ferramenta | Papel no estúdio | Licença | Fonte oficial |
|------------|------------------|---------|---------------|
| **Remotion** | Motor de vídeo A: composições em React/TypeScript, cenas orientadas a dados e templates reutilizáveis | Remotion License, gratuita com condições (ver §9) | https://www.remotion.dev · https://www.remotion.dev/docs/license/pricing |
| **HyperFrames** | Motor de vídeo B: renderização determinística de HTML em vídeo, com GSAP, CSS e Lottie sincronizados por frame | Apache-2.0 | https://hyperframes.app/docs/1-startup/1-introduction |
| **GSAP** | Biblioteca de animação usada principalmente nas composições HyperFrames | Licença GSAP padrão, gratuita inclusive com os plugins | https://github.com/greensock/gsap |
| **Kokoro TTS** (82M v1.0) | TTS neural local; candidato a voz principal em pt-BR **após validação** | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| **Piper TTS** | TTS local leve; **fallback garantido** em pt-BR | Motor GPL-3.0; cada voz tem licença própria | https://github.com/OHF-Voice/piper1-gpl |
| **FFmpeg** | Medição, concatenação, mixagem, loudnorm e encode final | LGPL/GPL, conforme a compilação | https://ffmpeg.org/legal.html |
| **Remotion Superpowers** | Coleção de skills e MCPs para Remotion; uso **seletivo** | MIT | https://github.com/DojoCodingLabs/remotion-superpowers |
| **Claude Code** | Orquestração, roteiro, storyboard e geração de código das cenas | — | https://docs.claude.com/claude-code |

---

## 3. Estrutura de diretórios

A estrutura de pastas já existe. Este documento define a função de cada uma.

```
video-studio/
├── assets/            # Biblioteca compartilhada (somente leitura durante o render)
│   ├── music/         #   trilhas + <arquivo>.license.json
│   ├── sfx/           #   efeitos sonoros + licença
│   ├── fonts/
│   ├── images/
│   └── lottie/
├── audio-engine/      # Camada de TTS (Python): adaptadores Kokoro/Piper, modelos baixados
├── config/            # Configurações globais: studio.json, voices.json, export-presets.json
├── docs/              # Documentação (este arquivo)
├── hyperframes/       # Motor B: projeto HyperFrames independente (HTML + GSAP)
├── output/            # Entregas finais (MP4) — nunca editado à mão
├── projects/          # Um diretório por vídeo (ver §3.1)
├── remotion/          # Motor A: projeto Remotion existente — NÃO alterar sem decisão explícita
└── scripts/           # Orquestração CLI (Node/Python): medir áudio, montar timeline, mixar, exportar
```

### 3.1 Estrutura de um projeto (`projects/<slug>/`)

```
projects/<slug>/
├── brief.md              # Pedido original: objetivo, público, duração, tom
├── script.md             # Roteiro aprovado              ✅ checkpoint 1
├── storyboard.json       # Cenas, motor, visual, áudio   ✅ checkpoint 2
├── narration/
│   ├── <scene-id>.txt    # Texto normalizado para TTS
│   ├── <scene-id>.wav    # Áudio gerado
│   └── narration.json    # Motor/voz usados + duração real medida
├── timeline.json         # Fonte de verdade temporal (derivada dos áudios)
├── renders/              # Renders intermediários de cada motor (vídeo sem áudio final)
├── mix/                  # Stems, medições loudnorm, mix final
├── manifest.json         # Versões, parâmetros, licenças de todos os assets usados
└── logs/
```

---

## 4. Pipeline de produção

```
 brief ─► [1] Roteiro ─► ✅ aprovação ─► [2] Storyboard ─► ✅ aprovação
                                                     │
                       ┌─────────────────────────────┘
                       ▼
              [3] Narração pt-BR (Kokoro | Piper)
                       │  medir duração real (ffprobe)
                       ▼
              [4] Timeline (timeline.json)
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
 [5a] Render Remotion      [5b] Render HyperFrames
          │                         │
          └────────────┬────────────┘
                       ▼
              [6] Trilha + SFX + mixagem (loudnorm 2 passes)
                       ▼
              [7] Montagem + export FFmpeg → output/<slug>.mp4
                       ▼
              [8] QA técnico + aprovação final
```

### 4.1 Etapas em detalhe

| # | Etapa | Entrada | Saída | Ferramenta |
|---|-------|---------|-------|------------|
| 1 | **Roteiro** | `brief.md` | `script.md`, com texto de narração dividido por cena e duração **estimada** (~150 palavras/min em pt-BR) | Claude |
| ✅ | **Checkpoint 1** | `script.md` | Aprovado / revisões | Humano |
| 2 | **Storyboard** | `script.md` | `storyboard.json`: por cena, o motor (`remotion`/`hyperframes`), o template, a descrição visual, os assets, os SFX e as transições | Claude |
| ✅ | **Checkpoint 2** | `storyboard.json` | Aprovado / revisões | Humano |
| 3 | **Narração** | Textos por cena | WAVs e `narration.json` | `audio-engine` (Kokoro ou Piper) |
| 4 | **Timeline** | `storyboard.json` + durações reais | `timeline.json` | `scripts/` + ffprobe |
| 5 | **Animação/render** | `timeline.json` | Vídeos intermediários em `renders/` | Remotion e/ou HyperFrames |
| 6 | **Áudio** | Narração, trilha, SFX | `mix/final.wav`, normalizado | FFmpeg |
| 7 | **Export** | Renders + mix | `output/<slug>.mp4` | FFmpeg |
| 8 | **QA** | MP4 | Relatório: duração, loudness, resolução, sincronia | ffprobe + revisão humana |

### 4.2 Normalização do texto para TTS (pt-BR)

Antes de sintetizar, o texto passa por uma normalização:

- números, datas, moedas e porcentagens são escritos por extenso;
- siglas são expandidas ou soletradas conforme um dicionário (`config/pronunciations.json`);
- estrangeirismos ganham grafia fonética quando necessário;
- frases longas são quebradas para controlar a prosódia.

---

## 5. Motores de vídeo

### 5.1 Separação

```
          ┌──────────── Contrato compartilhado (arquivos) ────────────┐
          │ timeline.json · storyboard.json · assets/ · narration/*.wav│
          └───────────────┬───────────────────────────┬───────────────┘
                          ▼                           ▼
                ┌──────────────────┐        ┌───────────────────┐
                │  remotion/       │        │  hyperframes/     │
                │  React + TS      │        │  HTML + CSS + GSAP│
                │  npm próprio     │        │  npm próprio      │
                └────────┬─────────┘        └─────────┬─────────┘
                         ▼                            ▼
                renders/remotion-*.mp4      renders/hyperframes-*.mp4
                         └──────────────┬─────────────┘
                                        ▼
                                FFmpeg (concat + mix)
```

Regras:

1. **Nenhuma dependência de código cruzada.** Cada motor tem seu próprio `package.json` e `node_modules`.
2. **Compartilham apenas dados e mídia:** assets, áudios, vídeos, JSON e metadados.
3. **Granularidade livre de render.** Não é obrigatório renderizar cada cena em um arquivo separado. Um motor pode compor **várias cenas consecutivas** num único render (por exemplo, uma `<Series>` no Remotion ou uma timeline GSAP no HyperFrames). O `timeline.json` agrupa as cenas em **segmentos**: sequências contíguas do mesmo motor, e cada segmento gera um render.
4. **Parâmetros de saída idênticos** em todos os segmentos: 1920×1080, mesmo fps (padrão **30**), pixel format `yuv420p` e o mesmo codec intermediário. Assim, o FFmpeg consegue concatenar sem reencodar, ou reencodar só uma vez no final.
5. Transições **entre motores** são cortes secos ou crossfades aplicados pelo FFmpeg (`xfade`). Transições **dentro do mesmo motor** são feitas pelo próprio motor.

### 5.2 Quando usar cada motor

| Critério | Remotion | HyperFrames |
|----------|----------|-------------|
| Cenas orientadas a dados, templates parametrizados | ✅ preferido | possível |
| Animação de texto/tipografia rica com GSAP (SplitText, MorphSVG etc.) | possível | ✅ preferido |
| Lottie, CSS animations, layouts HTML prontos | possível | ✅ preferido |
| Componentização React, tipagem, preview no Studio | ✅ | — |
| Legendas sincronizadas a partir de timestamps | ✅ | ✅ |

O campo `engine` do `storyboard.json` registra a decisão de cada cena.

### 5.3 Remotion (`remotion/`)

- O projeto atual (Remotion 4.0.543, React 19) **não será alterado** nesta fase.
- Integração futura: composições que recebem `timeline.json` via `inputProps` (ou `calculateMetadata`), com o áudio de `public/` ou um caminho estático. A duração (`durationInFrames`) virá do áudio medido.
- Render via `npx remotion render` (CLI) ou `@remotion/renderer`, a ser chamado por `scripts/`.

### 5.4 HyperFrames (`hyperframes/`)

- Framework open source (Apache-2.0) que transforma HTML em vídeo de forma determinística. Suporta GSAP, CSS, Lottie e outras animações sincronizadas por frame.
- Documentação: https://hyperframes.app/docs/1-startup/1-introduction
- Será instalado futuramente como projeto independente em `hyperframes/`. Os comandos e a configuração serão documentados a partir da documentação oficial no momento da instalação.

### 5.5 GSAP

- Usado principalmente dentro das composições HyperFrames. No Remotion, o uso é opcional e precisa ser controlado pelo frame atual, nunca pelo relógio real (timeline pausada + `seek`).
- Licença: gratuito, inclusive com os plugins, conforme a licença atual. Fonte: https://github.com/greensock/gsap

---

## 6. Motor de áudio (`audio-engine/`)

### 6.1 Interface comum

Os dois motores ficam atrás de um mesmo contrato (adaptador Python):

```
synthesize(text, voice_id, out_path, speed=1.0) -> { path, sample_rate, duration_s, engine, voice, model_version }
```

`config/voices.json` mapeia os apelidos de voz para o motor e o modelo correspondentes, por exemplo:

```json
{
  "narrador-masculino": { "engine": "kokoro", "voice": "pm_alex", "fallback": "piper:pt_BR-faber-medium" },
  "narradora":          { "engine": "kokoro", "voice": "pf_dora", "fallback": "piper:pt_BR-faber-medium" }
}
```

O fallback é automático: se o Kokoro falhar ou não estiver instalado, a síntese usa o Piper.

### 6.2 Kokoro TTS

- Modelo: **Kokoro-82M v1.0 multilíngue**, Apache-2.0. https://huggingface.co/hexgrad/Kokoro-82M
- Português brasileiro suportado, com as vozes **`pf_dora`** (feminina), **`pm_alex`** e **`pm_santa`** (masculinas).
- ⚠ **Adoção condicionada a testes locais.** Antes de virar o motor padrão, é preciso validar:
  - [ ] instalação e execução no Windows 11 + Python 3.12 (CPU; GPU opcional);
  - [ ] dependência de fonetização (G2P) para pt-BR, como espeak-ng, e se ela funciona no Windows;
  - [ ] qualidade da pronúncia: nasais, "lh/nh", "r" e "s" regionais, números e siglas;
  - [ ] prosódia em frases longas e perguntas;
  - [ ] estabilidade de duração e ausência de artefatos;
  - [ ] desempenho (fator de tempo real).
- O resultado dos testes será registrado em `docs/` (por exemplo, `docs/tts-evaluation.md`).

### 6.3 Piper TTS

- Referência: projeto mantido pela Open Home Foundation, https://github.com/OHF-Voice/piper1-gpl
- Motor sob **GPL-3.0**. Como é usado como ferramenta externa (processo separado ou CLI), o código do estúdio não fica sujeito à GPL. Se no futuro ele for embutido ou redistribuído, isso deve ser reavaliado.
- Voz de referência: **`pt_BR-faber-medium`**, com 22.050 Hz e qualidade média.
- ⚠ A **licença de cada modelo de voz deve ser verificada individualmente** (model card / `MODEL_CARD` da voz) e registrada no `manifest.json`.
- Papel: fallback garantido, rascunhos rápidos ("animatic" com narração provisória) e alternativa caso o Kokoro não passe na validação.

### 6.4 Pós-processamento da narração

- Reamostragem para **48 kHz** (padrão de vídeo) no momento da mixagem.
- Remoção de silêncio excessivo nas bordas (`silenceremove`), com margem configurável.
- Medição da duração real via `ffprobe`, gravada em `narration.json`.

---

## 7. Sincronização (`timeline.json`)

### 7.1 Regra central

> **A duração de cada cena = duração real do áudio de narração + padding definido no storyboard.**
> As estimativas do roteiro **nunca** definem o tempo final.

### 7.2 Algoritmo

1. Para cada cena, ler `duration_s` do WAV gerado (`ffprobe -show_entries format=duration`).
2. `scene_duration = pre_pad + narration + post_pad` (ou `min_duration`, se a cena não tiver fala).
3. Converter para frames: `frames = ceil(scene_duration × fps)`.
4. Calcular `start_frame` cumulativo, considerando sobreposições de transição.
5. Agrupar cenas contíguas do mesmo motor em **segmentos** de render.
6. Posicionar trilha e SFX com tempo absoluto ou relativo à cena.

### 7.3 Esquema resumido

```json
{
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "total_frames": 2700,
  "segments": [
    { "id": "seg-01", "engine": "remotion", "scenes": ["s01", "s02"], "start_frame": 0, "frames": 900 }
  ],
  "scenes": [
    {
      "id": "s01", "engine": "remotion", "template": "TitleCard",
      "start_frame": 0, "frames": 420,
      "narration": { "file": "narration/s01.wav", "offset_frames": 15, "duration_s": 12.84 },
      "sfx": [{ "file": "assets/sfx/whoosh.wav", "at_frame": 0, "gain_db": -6 }],
      "props": {}
    }
  ],
  "music": [{ "file": "assets/music/bed.mp3", "from_frame": 0, "to_frame": 2700, "gain_db": -18, "duck_under_voice": true }]
}
```

### 7.4 Legendas (opcional)

As legendas são geradas a partir do texto do roteiro e dos tempos da cena, em SRT ou como componente no vídeo. Alinhamento por palavra exigirá um alinhador local (ex.: Whisper local / forced alignment), a ser avaliado depois e **sem API paga**.

---

## 8. Áudio: trilha, SFX, mixagem e exportação

### 8.1 Trilhas e efeitos sonoros

- Fontes permitidas: material próprio, domínio público (CC0) ou licenças que permitam uso comercial e/ou com atribuição, desde que registradas.
- Cada arquivo em `assets/music` e `assets/sfx` vem acompanhado de `<nome>.license.json` com: `source_url`, `author`, `license`, `attribution_required`, `downloaded_at`.
- Nenhum asset sem licença registrada entra num render final.

### 8.2 Mixagem

1. **Stems:** a narração vira uma faixa contínua, com `adelay` por cena e `amix`. Trilha e SFX são posicionados pela timeline.
2. **Ducking** da trilha sob a voz com `sidechaincompress` (a narração como sidechain).
3. **Loudnorm em dois passes** (EBU R128) sobre o mix final:
   - **Passo 1, medição:**
     `ffmpeg -i mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -`
   - **Passo 2, aplicação** com os valores medidos (`measured_I`, `measured_TP`, `measured_LRA`, `measured_thresh`, `offset`) e `linear=true`.
   - As medições são salvas em `mix/loudnorm.json` para auditoria.
   - Alvos configuráveis em `config/export-presets.json`: **-14 LUFS** para plataformas web/sociais e **-23 LUFS** para broadcast. True peak ≤ **-1.5 dBTP**.

### 8.3 Exportação final (preset `fullhd-web`)

| Parâmetro | Valor |
|-----------|-------|
| Contêiner | MP4 (`+faststart`) |
| Vídeo | H.264 (`libx264`), `yuv420p`, 1920×1080, 30 fps (CFR), CRF 18–20, preset `slow` |
| Áudio | AAC-LC 48 kHz estéreo, 192–320 kbps |
| Loudness | Conforme preset (§8.2) |

Montagem: os segmentos de `renders/` são concatenados com o concat demuxer (ou `xfade` quando houver transição entre motores), e o mix final é sobreposto com `-map` explícito e `-shortest` desligado. A sincronia é validada comparando as durações do vídeo e do áudio (tolerância de 1 frame).

### 8.4 QA automatizado

Verificações com `ffprobe`:

- resolução;
- fps;
- codec;
- duração do vídeo comparada à do áudio;
- loudness final medido (`ebur128`);
- ausência de frames pretos inesperados (`blackdetect`) e de silêncio longo (`silencedetect`).

---

## 9. Licenças

| Componente | Licença | Observações | Fonte |
|------------|---------|-------------|-------|
| Remotion | Remotion License | **Gratuita para indivíduos e para empresas elegíveis com até 3 pessoas.** Empresas maiores precisam de licença paga (Company License). Revisar a elegibilidade sempre que o contexto mudar (contratação, uso por empresa, cliente). | https://www.remotion.dev/docs/license/pricing |
| HyperFrames | Apache-2.0 | Permissiva; preservar avisos de licença/NOTICE se redistribuir. | https://hyperframes.app/docs/1-startup/1-introduction |
| GSAP | Licença GSAP padrão | Gratuita, inclusive com os plugins, conforme a licença atual. Reler os termos a cada atualização de versão. | https://github.com/greensock/gsap |
| Kokoro-82M | Apache-2.0 | Pesos e código. | https://huggingface.co/hexgrad/Kokoro-82M |
| Piper (piper1-gpl) | GPL-3.0 (motor) | Usado como ferramenta externa. **Licença de cada voz a verificar individualmente.** | https://github.com/OHF-Voice/piper1-gpl |
| Vozes Piper (ex.: `pt_BR-faber-medium`) | Por modelo | Consultar o model card de cada voz antes do uso comercial. | Model card da voz |
| FFmpeg | LGPL-2.1+ / GPL-2+ | Depende da compilação (ex.: `libx264` torna a build GPL). Uso via CLI, sem redistribuição. | https://ffmpeg.org/legal.html |
| Remotion Superpowers | MIT | Uso seletivo (§10). | https://github.com/DojoCodingLabs/remotion-superpowers |
| Trilhas/SFX/imagens | Por arquivo | Registradas em `*.license.json`. | — |

> Este documento não é aconselhamento jurídico. As licenças devem ser revalidadas na fonte oficial antes de uso comercial.

---

## 10. Remotion Superpowers — uso seletivo

- Projeto: https://github.com/DojoCodingLabs/remotion-superpowers (MIT).
- Oferece skills e MCPs para produção com Remotion. A configuração completa integra provedores externos: **ElevenLabs, KIE, TwelveLabs, Pexels e Replicate**.
- **Decisão: não instalar o pacote completo.**
- Plano:
  1. Revisar o repositório e classificar cada skill e MCP em: (a) 100% local, (b) depende de API gratuita opcional, (c) depende de API paga.
  2. Aproveitar apenas o grupo (a), copiando ou adaptando para o projeto com a atribuição MIT preservada.
  3. Substituir as dependências de TTS externas (ex.: ElevenLabs) pelo `audio-engine` local (Kokoro/Piper).
  4. O grupo (b) entra apenas como opcional, desligado por padrão e sem chaves no repositório. O grupo (c) fica fora do escopo.
- O resultado da triagem será registrado em `docs/remotion-superpowers-triage.md` (futuro).

---

## 11. Skill `video-production` (planejada, ainda não criada)

**Local previsto:** `.claude/skills/video-production/SKILL.md`, com referências auxiliares.

**Responsabilidade:** coordenar o pipeline da §4, decidir o motor de cada cena, garantir os checkpoints e manter `manifest.json`.

| Comando/fase | Ação | Para em checkpoint? |
|--------------|------|---------------------|
| `novo <slug>` | Cria `projects/<slug>/` e `brief.md` | — |
| `roteiro` | Gera `script.md` | ✅ aguarda aprovação |
| `storyboard` | Gera `storyboard.json` | ✅ aguarda aprovação |
| `narrar` | Gera os WAVs e mede as durações | — |
| `timeline` | Gera `timeline.json` | — |
| `render` | Renderiza os segmentos em cada motor | — |
| `mixar` | Monta stems, ducking e loudnorm (2 passes) | — |
| `exportar` | Gera o MP4 final em `output/` | — |
| `qa` | Gera o relatório técnico | ✅ aprovação final |

Regras da skill:

- nunca avançar além de um checkpoint sem aprovação explícita;
- nunca usar API paga;
- nunca alterar `remotion/` ou `hyperframes/` fora de tarefas aprovadas;
- registrar as licenças de todo asset usado.

---

## 12. Limitações e riscos conhecidos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Qualidade da fonetização e prosódia do Kokoro em pt-BR ainda não validada localmente | Narração artificial ou com erros | Testes da §6.2; fallback Piper; dicionário de pronúncias |
| Piper `faber-medium` com 22.050 Hz e qualidade média | Timbre menos natural | Reamostrar para 48 kHz (sem ganho real de banda); aceitar para rascunho |
| Dependências de G2P (ex.: espeak-ng) no Windows | Falha de instalação | Validar antes; documentar caminho alternativo |
| Render em CPU (sem GPU dedicada) | Renders lentos | Render por segmentos, concorrência ajustada, preview em baixa resolução |
| Divergência de fps/timebase entre motores | Dessincronia na concatenação | Preset único de saída; validação via ffprobe |
| Caminhos Windows com espaços e acentos | Erros em CLI | Sempre citar caminhos; slugs ASCII em `projects/` |
| Mudança de licença de ferramentas (Remotion, GSAP) | Risco legal | Revalidar a licença a cada atualização; registrar a versão no manifest |
| Node 26 é mais novo que as versões testadas por algumas dependências | Incompatibilidades | Fixar versões; testar antes de atualizar |

---

## 13. Dependências futuras (não instaladas)

| Componente | Requisito previsto | Fase |
|------------|-------------------|------|
| HyperFrames | Pacote npm próprio em `hyperframes/` + navegador headless | 2 |
| GSAP | npm `gsap` em `hyperframes/` (e opcionalmente em `remotion/`) | 2 |
| Kokoro | venv Python 3.12 em `audio-engine/`, pacote `kokoro`, possivelmente espeak-ng | 1 |
| Piper | venv Python, pacote `piper-tts` (piper1-gpl) + voz `pt_BR-faber-medium` | 1 |
| Scripts de orquestração | Node (já disponível) ou Python; sem dependências pesadas | 1 |

---

## 14. Roadmap

| Fase | Entrega | Aprovação |
|------|---------|-----------|
| 0 | Este documento | ✅ |
| 1–3 | audio-engine, HyperFrames+GSAP, scripts (mix, loudnorm, export, QA) | ✅ 2026-11-13 |
| 4 | Integração Remotion via entry separado `src/studio` | ✅ |
| 6–7 | Skill `video-production` + piloto `demo-estudio` | ✅ |
| 1 | `audio-engine` com Piper funcionando e avaliação do Kokoro pt-BR (`docs/tts-evaluation.md`) | Pendente |
| 2 | Projeto `hyperframes/` com GSAP e uma cena de teste | Pendente |
| 3 | Scripts: medição, `timeline.json`, mixagem com loudnorm em 2 passes, export | Pendente |
| 4 | Integração Remotion via `inputProps` (alterações em `remotion/` só com aprovação) | Pendente |
| 5 | Triagem do Remotion Superpowers | Pendente |
| 6 | Skill `video-production` | Pendente |
| 7 | Primeiro vídeo piloto ponta a ponta | Pendente |

---

## 15. Referências

- Remotion: https://www.remotion.dev · Licença: https://www.remotion.dev/docs/license/pricing
- HyperFrames: https://hyperframes.app/docs/1-startup/1-introduction
- GSAP: https://github.com/greensock/gsap
- Kokoro-82M: https://huggingface.co/hexgrad/Kokoro-82M
- Piper (Open Home Foundation): https://github.com/OHF-Voice/piper1-gpl
- FFmpeg: https://ffmpeg.org · Filtro loudnorm: https://ffmpeg.org/ffmpeg-filters.html#loudnorm · Licença: https://ffmpeg.org/legal.html
- Remotion Superpowers: https://github.com/DojoCodingLabs/remotion-superpowers
- EBU R128: https://tech.ebu.ch/publications/r128
