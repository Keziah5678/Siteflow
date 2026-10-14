// Tests de bout en bout : lance l'application dans Chromium et vérifie
// rendu, déplacements, regard, collisions, accès aux pièces, sol, interactions.
// Usage : npm run dev (dans un autre terminal), puis npm run test:e2e [url]
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/?q=basse';
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });

let pass = 0, fail = 0;
const check = (name, ok, info = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✔' : '✘'} ${name}${info ? ' — ' + info : ''}`);
};
const frames = (n = 3) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const place = (x, z, yaw, pitch = 0) => page.evaluate(([x, z, yaw, pitch]) => {
  const p = window.__app.player; p.position.set(x, 0, z); p.velocity.set(0, 0, 0); p.yaw = yaw; p.pitch = pitch;
}, [x, z, yaw, pitch]);
const pos = () => page.evaluate(() => { const p = window.__app.player.position; return { x: p.x, y: p.y, z: p.z }; });
/** Maintient une touche pendant un nombre d'images simulées (indépendant du framerate). */
const hold = async (key, simSeconds) => {
  await page.keyboard.down(key);
  // On fait avancer la simulation à pas fixes pour des tests déterministes.
  await page.evaluate((secs) => { const a = window.__app; for (let t = 0; t < secs; t += 1 / 60) { a.player.update(1 / 60); a.world.update(1 / 60, t); } }, simSeconds);
  await page.keyboard.up(key);
};
const sim = (secs) => page.evaluate((secs) => { const a = window.__app; for (let t = 0; t < secs; t += 1 / 60) { a.player.update(1 / 60); a.world.update(1 / 60, t); } }, secs);
const interact = async () => {
  await frames(2);
  return page.evaluate(() => { const a = window.__app; a.camera.updateMatrixWorld(); const it = a.interactions.update(); const label = it?.label() ?? null; a.interactions.trigger(); return label; });
};

const t0 = Date.now();
await page.goto(url);
await page.waitForFunction(() => window.__app, null, { timeout: 240000 });
check('Chargement de la scène', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
await page.click('#btn-start');
await frames(3);
check("Écran d'accueil → exploration", await page.evaluate(() => window.__app.state === 'playing'));

// 1. Rendu non vide
const shot = await page.screenshot();
check('La scène est rendue (image non vide)', shot.length > 30000, `${shot.length} octets`);
const meshes = await page.evaluate(() => { let n = 0; window.__app.scene.traverse((o) => { if (o.isMesh) n++; }); return n; });
check('Nombre de maillages', meshes > 300, String(meshes));

// 2. Déplacement avant (Z/W) et latéral (Q/A, D)
// (allée libre entre le lit et le mur est)
await place(3.1, 3.5, 0);
let a = await pos();
await hold('w', 0.6);
let b = await pos();
check('Avancer (W)', b.z < a.z - 0.4, `Δz=${(b.z - a.z).toFixed(2)}`);
await place(3.1, 3.5, 0);
await hold('z', 0.6);
b = await pos();
check('Avancer (Z, AZERTY)', b.z < 3.5 - 0.4, `Δz=${(b.z - 3.5).toFixed(2)}`);
await place(1.9, 3.6, 0);
await hold('d', 0.5);
b = await pos();
check('Droite (D)', b.x > 1.9 + 0.3, `Δx=${(b.x - 1.9).toFixed(2)}`);
await place(1.9, 3.6, 0);
await hold('q', 0.5);
b = await pos();
check('Gauche (Q)', b.x < 1.9 - 0.3, `Δx=${(b.x - 1.9).toFixed(2)}`);
await place(1.9, 3.6, 0);
await hold('s', 0.4);
b = await pos();
check('Reculer (S)', b.z > 3.6 + 0.2, `Δz=${(b.z - 3.6).toFixed(2)}`);
// Course
await place(1.9, 3.6, Math.PI / 2);
await page.keyboard.down('Shift');
await hold('w', 0.4);
await page.keyboard.up('Shift');
b = await pos();
const runDist = 1.9 - b.x;
await place(1.9, 3.6, Math.PI / 2);
await hold('w', 0.4);
b = await pos();
check('Courir (Maj) est plus rapide que marcher', runDist > (1.9 - b.x) * 1.3, `${runDist.toFixed(2)} m vs ${(1.9 - b.x).toFixed(2)} m`);

// 3. Regard à la souris (glisser, verrouillage indisponible en headless) + limite verticale
await place(1.9, 3.6, 0, 0);
await page.mouse.move(480, 270);
await page.mouse.down();
await page.mouse.move(680, 170, { steps: 8 });
await page.mouse.up();
await sim(0.02);
const look = await page.evaluate(() => ({ yaw: window.__app.player.yaw, pitch: window.__app.player.pitch }));
check('Regarder à la souris (horizontal)', look.yaw < -0.2, `yaw=${look.yaw.toFixed(2)}`);
check('Regarder à la souris (vertical)', look.pitch > 0.1, `pitch=${look.pitch.toFixed(2)}`);
await page.evaluate(() => { window.__app.input.addLook(0, -100000); window.__app.player.update(0.016); });
const p2 = await page.evaluate(() => window.__app.player.pitch);
check('Regard vertical borné (pas de retournement)', Math.abs(p2) <= 1.5 + 1e-6, p2.toFixed(2));
await page.evaluate(() => { window.__app.input.addLook(1e5, 0); window.__app.player.update(0.016); });
check('Rotation 360° libre', true);

// 4. Les murs bloquent
await place(0.7, 4.0, Math.PI); // vers le sud, dans l'entrée jusqu'à la porte palière
await hold('w', 4);
b = await pos();
check("Porte d'entrée (verrouillée) bloque", b.z < 6.2 - 0.2 && b.z > 5.5, `z=${b.z.toFixed(2)}`);
check("L'entrée est accessible", b.z > 4.6);
await place(3.2, 1.5, Math.PI / 2); // vers l'ouest : le lit bloque
await hold('w', 3);
b = await pos();
check('Le lit bloque', b.x > 2.6, `x=${b.x.toFixed(2)}`);
await place(3.2, 1.5, -Math.PI / 2); // vers l'est : baie vitrée fermée
await hold('w', 3);
b = await pos();
check('Baie vitrée fermée bloque', b.x < 3.6, `x=${b.x.toFixed(2)}`);
// Course prolongée contre un mur : aucune traversée
await place(1.9, 3.3, 0);
await page.keyboard.down('Shift');
await place(3.0, 3.3, 0);
await hold('w', 6);
await page.keyboard.up('Shift');
b = await pos();
check('Pas de traversée du mur nord en courant', b.z > 0.05, `z=${b.z.toFixed(2)}`);

// 5. Interactions + accès aux pièces
await place(3.25, 1.05, -Math.PI / 2, -0.1);
let label = await interact();
check('Interaction baie vitrée', !!label && label.includes('baie'), label ?? 'rien visé');
await sim(1.5);
await place(3.25, 1.05, -Math.PI / 2, 0);
await hold('w', 3);
b = await pos();
check('Accès au jardin par la baie ouverte', b.x > 4.0, `x=${b.x.toFixed(2)}`);
const gz = await page.evaluate(() => window.__app.world.zoneAt(window.__app.player.position.x, window.__app.player.position.z));
check('Zone extérieure détectée', !!gz?.outdoor, gz?.name);
// Mur végétal en limite de jardin
await place(8.0, 2.5, -Math.PI / 2);
await hold('w', 4);
b = await pos();
check('Mur végétal du jardin bloque', b.x < 10.2, `x=${b.x.toFixed(2)}`);
// Spa (collision cylindrique)
await place(6.8, -0.2, -Math.PI / 2);
await hold('w', 4);
b = await pos();
check('Le spa bloque', b.x < 9.05 - 0.9, `x=${b.x.toFixed(2)}`);

// Salle de bain : porte fermée bloque, puis ouverture
await place(3.1, 3.9, Math.PI, 0);
await hold('w', 2);
b = await pos();
check('Porte de salle de bain fermée bloque', b.z < 4.4, `z=${b.z.toFixed(2)}`);
await place(3.1, 3.9, Math.PI, -0.15);
label = await interact();
check('Ouvrir la porte de salle de bain', !!label && label.includes('salle de bain'), label ?? 'rien visé');
await sim(1.2);
await place(3.1, 3.9, Math.PI, 0);
await hold('w', 1.6);
b = await pos();
const zone = await page.evaluate(() => window.__app.world.zoneAt(window.__app.player.position.x, window.__app.player.position.z)?.name);
check('Entrée dans la salle de bain', b.z > 4.8 && zone === 'Salle de bain', `z=${b.z.toFixed(2)} zone=${zone}`);
// Kitchenette (marche de 2,5 cm franchissable)
await place(1.8, 3.4, Math.PI);
await hold('w', 2);
b = await pos();
check('Marche de la kitchenette franchie', b.y > 0.02 && b.y < 0.03, `y=${b.y.toFixed(3)}`);

// 6. Sol, gravité, saut, sortie de scène
await place(1.9, 3.5, 0);
await page.keyboard.down('Space');
await page.evaluate(() => { const a = window.__app; a.player.update(1 / 60); });
await page.keyboard.up('Space');
const ys = await page.evaluate(() => { const a = window.__app; const out = []; for (let i = 0; i < 80; i++) { a.player.update(1 / 60); out.push(a.player.position.y); } return out; });
check('Saut puis retour au sol', Math.max(...ys) > 0.3 && Math.abs(ys[ys.length - 1]) < 1e-3, `max=${Math.max(...ys).toFixed(2)}`);
check('Jamais sous le sol', Math.min(...ys) >= -1e-6);
await page.evaluate(() => { const p = window.__app.player; p.position.set(40, 0, 40); for (let i = 0; i < 120; i++) p.update(1 / 60); });
b = await pos();
check('Hors de la scène → retour au départ', Math.abs(b.x - 1.9) < 0.01 && Math.abs(b.z - 3.75) < 0.01, `(${b.x.toFixed(2)}, ${b.z.toFixed(2)})`);

// 7. Interrupteurs, objets
const lightOn = () => page.evaluate(() => window.__app.world.lights.ceiling.on);
const before = await lightOn();
await place(0.9, 4.08, Math.PI / 2, -0.52);
label = await interact();
check('Interrupteur du plafonnier', (await lightOn()) !== before, label ?? 'rien visé');
await place(1.75, 3.6, 0, -0.95);
label = await interact();
check('Table basse relevable', !!label && label.includes('plateau'), label ?? 'rien visé');
await place(2.3, 3.65, -Math.PI / 2, -0.05);
label = await interact();
check('Allumer la télévision', await page.evaluate(() => window.__app.world.lights.tv.on), label ?? 'rien visé');
await place(1.4, 3.2, Math.PI / 2, -0.1);
label = await interact();
check("Ouvrir l'armoire", !!label && label.includes('armoire'), label ?? 'rien visé');
await page.keyboard.press('r');
b = await pos();
check('Touche R : retour au départ', Math.abs(b.x - 1.9) < 0.01 && Math.abs(b.z - 3.75) < 0.01);
await page.keyboard.press('n');
await frames(2);
check('Touche N : mode nuit', await page.evaluate(() => window.__app.env.night));

// 8. Performances (rendu logiciel SwiftShader en CI : valeur indicative)
await page.evaluate(() => window.__app.player.reset());
await page.waitForTimeout(3000);
const perf = await page.evaluate(() => ({ fps: window.__app.fps, calls: window.__app.renderer.renderer.info.render.calls, tris: window.__app.renderer.renderer.info.render.triangles }));
check('Images rendues en continu', perf.fps > 0, `${perf.fps.toFixed(1)} i/s (logiciel), ${perf.calls} appels, ${perf.tris} triangles`);

check('Aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${pass} réussis, ${fail} échoués`);
await browser.close();
process.exit(fail ? 1 : 0);
