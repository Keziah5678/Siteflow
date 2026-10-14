// Captures d'écran de points de vue clés (développement / vérification visuelle).
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5173/?q=moyenne';
const out = process.argv[3] ?? 'test-output';
const only = process.argv[4];
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__app, null, { timeout: 180000 });
await page.evaluate(() => window.__app.start());
if (process.env.SETUP) await page.evaluate(process.env.SETUP);
console.log('fps', await page.evaluate(() => window.__app.fps));
const views = {
  photo1_tete_de_lit: [1.9, 3.9, 0, -0.08],
  photo2_vers_cuisine: [2.3, 0.6, Math.PI + 0.25, -0.2],
  photo4_cuisine: [1.8, 3.3, Math.PI, -0.1],
  photo5_sdb: [3.1, 4.3, Math.PI - 0.5, -0.25],
  sdb_miroir: [3.45, 5.15, -Math.PI / 2 - 0.15, -0.05],
  armoire: [1.6, 3.2, Math.PI / 2 + 0.2, -0.1],
  jardin_spa: [5.0, 2.6, -Math.PI / 2 + 0.35, -0.05],
  terrasse_facade: [8.2, 1.2, Math.PI / 2 - 0.25, 0.05],
};
for (const [name, [x, z, yaw, pitch]] of Object.entries(views)) {
  if (only && !name.includes(only)) continue;
  await page.evaluate(([x, z, yaw, pitch]) => {
    const p = window.__app.player;
    p.position.set(x, 0, z); p.velocity.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch;
  }, [x, z, yaw, pitch]);
  await page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n >= 4 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  await page.screenshot({ path: `${out}/${name}.png` });
}
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 30).join('\n'));
await browser.close();
