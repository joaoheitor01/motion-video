# Academia RAGE — anúncio "Área do Aluno" (Remotion)

Anúncio vertical 9:16 (1080x1920, 30 fps, 30 s / 900 frames) feito em Remotion 4 + React + TypeScript.

Vídeo final: **`out/rage_area_aluno.mp4`** · revisão rápida: `out/contact_sheet.jpg`

## Como rodar

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run render
```

```bash
npm run check
```

- `dev` abre o Remotion Studio; `render` gera `out/rage_area_aluno.mp4` (H.264, yuv420p, ~8 Mbps, AAC).
- `check` confere o MP4 (ffprobe, pico de áudio, cortes x batidas), extrai um quadro a cada 1,5 s em `out/frames/` e gera `out/contact_sheet.jpg`.
- Antes de `dev` e `render` roda sozinho o `scripts/prepare.mjs`, que varre `public/` (para decidir entre arquivo real e fallback) e gera o áudio provisório se faltar. Requer `ffmpeg` no PATH.
- O Chromium é detectado em `remotion.config.ts` (Playwright em `/opt/pw-browsers` ou a variável `REMOTION_BROWSER`); fora disso o Remotion baixa o dele.
- Fontes (Anton, Inter, JetBrains Mono) vêm de `@fontsource/*`, locais. O render falha se alguma não carregar, em vez de cair em fallback.

## Onde editar

Tudo em **`src/config.ts`**: textos, tempos, caminhos de arquivos, coordenadas de zoom/moldura/cursor/desfoque. Cores em `src/theme.ts`.

## Como trocar arquivos

Basta colocar o arquivo no caminho abaixo e renderizar de novo; o fallback sai sozinho.

| O quê | Caminho em `public/` | Enquanto não existir |
|---|---|---|
| Clipes IA (cenas 1, 2, 8, 10) | `clips/cena1.mp4`, `cena2.mp4`, `cena8.mp4`, `cena10.mp4` | foto `refs/ref_*.jpg` com Ken Burns; sem a foto, fundo procedural em SVG |
| Prints do computador | `prints/app_computador/01_inicio.png`, `02_monte_treino_objetivo.png`, `03_monte_treino_rotina.png` | tela recriada em CSS |
| Prints do celular | `prints/app_celular/01_inicio.png`, `09_treinos_B_C_D.png`, `10_minha_evolucao.png` | tela recriada em CSS |
| Vídeo "Montando" | `prints/app_computador/montando_ok.mp4` | recriação em CSS (`TypedStage`) |
| Logo | `logo/logo_rage.png` | texto "ACADEMIA RAGE" em Anton |
| Trilha | `audio/trilha.mp3` | `audio/provisoria.wav` gerada por ffmpeg |

Ao trocar um print:

- **Celular:** ajuste `PHONE_CROP` (ou o `crop` da cena) até sumirem a barra de status e a barra do navegador.
- **Moldura, cursor e lupa** (`highlights`, `cursor`, `lens`) estão em % do print e foram calibrados para as telas de fallback; reposicione para o print real.
- **Dados sensíveis:** preencha `blur` (em % do print) para cobrir nome, IMC, peso, gordura ou números de teste.
- Trilha: `AUDIO.music.startFrom` escolhe o ponto de início; os cortes assumem 128 BPM (`BPM` em config).

## Cenas

Os cortes caem na batida mais próxima do tempo do roteiro (128 BPM, 1 batida = 14,06 frames).

| # | Roteiro (s) | Frames | Batida | Etiqueta | Título | Visual |
|---|---|---|---|---|---|---|
| 1 | 0–3 | 0–84 | 0 | ACADEMIA RAGE | SEU TREINO. DO SEU JEITO. | clipe IA 1 |
| 2 | 3–6 | 84–183 | 6 | NOVIDADE | ÁREA DO ALUNO. | clipe IA 2 + flash vermelho no corte |
| 3 | 6–8 | 183–239 | 13 | PLATAFORMA | NO COMPUTADOR E NO CELULAR. | notebook + celular |
| 4 | 8–10,5 | 239–309 | 17 | MONTE SEU TREINO | ESCOLHA SEU OBJETIVO. | notebook + lupa, cursor clica no objetivo |
| 5 | 10,5–13 | 309–394 | 22 | MONTE SEU TREINO | SEUS DIAS. SEU TEMPO. | notebook + lupa, cursor clica em dias e minutos |
| 6 | 13–15,5 | 394–464 | 28 | MONTE SEU TREINO | MONTANDO SEU TREINO... | "Montando o seu treino..." no notebook |
| 7 | 15,5–18 | 464–534 | 33 | SEU PLANO | PLANO PRONTO. | celular rolando a lista de treinos |
| 8 | 18–21 | 534–633 | 38 | REGISTRO | TREINOU? CONCLUÍDO. | clipe IA 8 em cima + selo carimbando |
| 9 | 21–24,5 | 633–731 | 45 | EVOLUÇÃO | VEJA SUA EVOLUÇÃO. | celular com mapa muscular |
| 10 | 24,5–30 | 731–900 | 52 | — | ACESSE A ÁREA DO ALUNO. | clipe IA 10 + logo + chamada final |

A cena 6 fica com 70 frames por causa do alinhamento à batida; a animação das etapas (75 frames no roteiro) é ajustada à duração da cena.

## O que está provisório

O repositório não tinha a pasta `public/` com clipes, prints, logo e trilha, então **todas** as mídias abaixo estão em fallback:

- **Clipes IA (cenas 1, 2, 8, 10):** fundos procedurais em SVG (anilhas, feixes de luz, halter, fachada).
- **Prints (cenas 3, 4, 5, 7, 9):** telas recriadas em CSS. Reproduzem só a navegação; os rótulos de opções (ex.: "Hipertrofia", "Condicionamento", "30/60/90 minutos") são suposições e devem ser conferidos com o app. A lista do Treino B vem de um print enviado na conversa; Treinos C e D aparecem como esqueleto, sem exercícios.
- **Cena "Montando":** recriação em CSS.
- **Logo:** texto em Anton.
- **Trilha:** `public/audio/provisoria.wav` é sintetizada por ffmpeg (kick 4x4, baixo em lá menor, hi-hat). **Troque por uma trilha licenciada** em `public/audio/trilha.mp3`.
- **Efeitos sonoros** (`public/audio/sfx/`): sintetizados por ffmpeg; podem ficar ou ser trocados.

## Regras de conteúdo aplicadas

Nada de suplementos, números de teste, "Aluno Teste", IMC/peso/gordura, depoimentos ou promessa de resultado. A barra de status do celular nunca aparece: o topo do mockup é uma faixa preta só com a ilha, e os prints são cortados por `crop`.
