---
name: video-production
description: Coordena a produção de vídeos no Video Studio Local (roteiro → storyboard → narração pt-BR → Remotion/HyperFrames → mix → MP4 1080p). Use quando o usuário pedir para criar, editar, narrar ou renderizar um vídeo neste estúdio.
---

# video-production

Leia `docs/ARCHITECTURE.md` antes de começar. Todo o fluxo é local e gratuito.

## Regras
- **Nunca** use APIs pagas nem `hyperframes publish/share/billing/templates`.
- **Checkpoints obrigatórios:** pare e peça aprovação após `script.md` e após `storyboard.json`. Só marque `"approved": true` no storyboard com aprovação explícita do usuário.
- Não altere `remotion/src/Root.tsx`, `Composition.tsx` ou `index.ts` (Studio original). O estúdio usa `remotion/src/studio/`.
- Todo asset de terceiros precisa de `<arquivo>.license.json` ao lado.
- Durações vêm do áudio real (etapa `timeline`), nunca da estimativa do roteiro.

## Fluxo
1. `projects/<slug>/brief.md` com objetivo, público, duração e tom.
2. `script.md`: narração por cena (~150 palavras/min). → **checkpoint 1**
3. `storyboard.json` (modelo: `projects/demo-estudio/storyboard.json`). Para cada cena: `id`, `engine` (`remotion` | `hyperframes`), `template` (`title` | `bullets` | `outro`), `heading`, `sub`, `bullets`, `narration`, `sfx`, `pre_pad`/`post_pad`. Na raiz: `voice` (apelidos em `config/voices.json`), `music`, `theme`, `preset`. → **checkpoint 2**
4. Produção: `node scripts/produce.mjs <slug>`, com as etapas `narrate timeline render mix export qa`. Elas podem rodar isoladas, por exemplo `node scripts/produce.mjs <slug> render export qa`.
5. Confira `projects/<slug>/qa.json` (`pass: true`) e extraia frames com ffmpeg para revisão visual. → **aprovação final**

## Texto para TTS (pt-BR)
Escreva números, siglas e símbolos por extenso. Use frases curtas. Se a pronúncia do Kokoro falhar, troque a voz da cena para `piper-faber` (`"voice"` na cena).

## Estender
- Novo template Remotion: `remotion/src/studio/StudioSegment.tsx`.
- Novo visual HyperFrames: função `hyperframesHtml` em `scripts/produce.mjs`. Rode `npx hyperframes docs gsap` em `hyperframes/` para consultar a referência.
- Para pré-visualizar: `cd remotion && npx remotion studio src/studio/index.ts`.
