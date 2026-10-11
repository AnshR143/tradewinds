const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [scene, seconds, out, alpha, times] = process.argv.slice(2);
  const fps = 24;
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  await page.goto(`file://${path.resolve(__dirname, 'index.html')}#${scene}`);
  await page.waitForFunction('window.ready === true || window.failed', null, { timeout: 90000 });
  const failed = await page.evaluate('window.failed || ""');
  if (failed) { console.log('SCENE FAILED', failed); process.exit(1); }

  const see = alpha === 'alpha';
  const shot = async (t, file) => {
    await page.evaluate((time) => window.seek(time), t);
    await page.screenshot(see ? { path: file, type: 'png', omitBackground: true } : { path: file, type: 'jpeg', quality: 96 });
  };
  if (times) {
    for (const t of times.split(',').map(Number)) await shot(t, path.join(out, `${scene.replace(/[^a-z0-9]/gi, '-')}-${String(t).replace('.', '_')}.${see ? 'png' : 'jpg'}`));
  } else {
    const total = Math.round(Number(seconds) * fps);
    for (let f = 0; f < total; f++) await shot(f / fps, path.join(out, `${String(f).padStart(4, '0')}.${see ? 'png' : 'jpg'}`));
    console.log('rendered', scene, total, 'frames');
  }
  await browser.close();
})().catch((e) => { console.log('RENDER FAILED', e.message); process.exit(1); });
