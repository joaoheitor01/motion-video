// Fontes locais (@fontsource), sem depender de internet no render.
import "@fontsource/anton/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import { cancelRender, continueRender, delayRender } from "remotion";

const SAMPLE = "ÁÉÍÓÚÂÊÔÃÕÇ áéíóúâêôãõç ABC abc 0123";
const REQUIRED = [
  '400 40px "Anton"',
  '400 40px "Inter"',
  '500 40px "Inter"',
  '600 40px "Inter"',
  '700 40px "Inter"',
  '500 40px "JetBrains Mono"',
  '700 40px "JetBrains Mono"',
];

// Segura o render até as fontes estarem carregadas; falha em vez de cair em fallback.
if (typeof document !== "undefined") {
  const handle = delayRender("Carregando fontes locais");
  Promise.all(REQUIRED.map((f) => document.fonts.load(f, SAMPLE)))
    .then(() => {
      const missing = REQUIRED.filter((f) => !document.fonts.check(f, SAMPLE));
      if (missing.length) {
        throw new Error(`Fontes não carregadas: ${missing.join(", ")}`);
      }
      continueRender(handle);
    })
    .catch((err) => cancelRender(err));
}
