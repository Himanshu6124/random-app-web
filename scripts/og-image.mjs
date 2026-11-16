// Renders public/og-image.png (1200x630), the preview image shown when the site link is
// shared on WhatsApp, X, Facebook, etc. Re-run after a name or tagline change:
//   node scripts/og-image.mjs
// Needs Google Chrome installed; set CHROME_PATH if it is not in the default macOS location.
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const NAME = 'RandomChatly';
const TAGLINE = 'Random chat with strangers who could become friends.';
const POINTS = ['Free', 'Anonymous', 'No signup'];

const out = fileURLToPath(new URL('../public/og-image.png', import.meta.url));
const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: radial-gradient(ellipse 70% 90% at 85% 15%, #43293d 0%, #21141f 45%, #140c14 100%);
    color: #f5ecef; font-family: Outfit, sans-serif;
    display: flex; flex-direction: column; justify-content: center; padding: 0 96px;
  }
  .brand { font-size: 44px; font-weight: 800; color: #f07289; letter-spacing: -0.02em; }
  h1 { margin-top: 28px; max-width: 900px; font-size: 76px; font-weight: 700; line-height: 1.08; letter-spacing: -0.025em; }
  .points { margin-top: 44px; display: flex; gap: 14px; }
  .points span {
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 26px; font-weight: 500; color: #c9b6bf;
    border: 1.5px solid rgba(240, 114, 137, 0.45); border-radius: 999px; padding: 10px 24px;
  }
</style></head>
<body>
  <div class="brand">${NAME}</div>
  <h1>${TAGLINE}</h1>
  <div class="points">${POINTS.map((p) => `<span>${p}</span>`).join('')}</div>
</body></html>`;

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, type: 'png' });
  console.log(`Wrote ${out}`);
} finally {
  await browser.close();
}
