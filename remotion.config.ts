import { Config } from "@remotion/cli/config";
import fs from "fs";
import path from "path";

Config.setVideoImageFormat("png"); // PNG → saída yuv420p (JPEG geraria yuvj420p)
Config.setOverwriteOutput(true);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");

// Rede restrita (nuvem): usa um Chromium já instalado em vez de baixar outro.
// Ordem: variável de ambiente > headless shell do Playwright > Chromium do Playwright.
const findBrowser = (): string | null => {
  if (process.env.REMOTION_BROWSER && fs.existsSync(process.env.REMOTION_BROWSER)) {
    return process.env.REMOTION_BROWSER;
  }
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers"].filter(
    Boolean,
  ) as string[];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).sort().reverse();
    const candidates = [
      ...dirs
        .filter((d) => d.startsWith("chromium_headless_shell-"))
        .flatMap((d) => [
          path.join(root, d, "chrome-headless-shell-linux64", "chrome-headless-shell"),
          path.join(root, d, "chrome-linux", "headless_shell"),
        ]),
      ...dirs
        .filter((d) => d.startsWith("chromium-"))
        .flatMap((d) => [
          path.join(root, d, "chrome-linux64", "chrome"),
          path.join(root, d, "chrome-linux", "chrome"),
        ]),
    ];
    const hit = candidates.find((c) => fs.existsSync(c));
    if (hit) return hit;
  }
  return null;
};

const browser = findBrowser();
if (browser) {
  Config.setBrowserExecutable(browser);
  if (!/headless[-_]shell/.test(browser)) {
    Config.setChromeMode("chrome-for-testing");
  }
}
