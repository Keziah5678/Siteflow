import * as THREE from 'three';
import { Ctx, GARDEN, JACUZZI, ROOM, SLIDER, BATH, T } from './layout';
import { ledMaterial } from './Builder';
import { LightGroup } from './LightGroup';
import { makeInteractable, Toggle } from '../interaction/Interactions';
import { rng } from '../core/utils';

const WALL_H = 2.55;

export function buildGarden(ctx: Ctx) {
  const { b } = ctx;
  const g = b.group(ctx.root, 0, 0, 0, 0, 'jardin');
  const m = b.m;
  [m.grass, m.ivy, m.rattan, m.awning, m.plaster, m.water, m.jacuzziShell, m.whiteGloss, m.cushionBeige, m.ground,
    m.leafBanana, m.leafFern, m.leafPalm, m.trunk].forEach((x) => ctx.outdoorMaterials.add(x));

  // Gazon synthétique (1 cm sous le niveau intérieur)
  b.slab(GARDEN.x0, GARDEN.x1, -0.15, -0.008, GARDEN.z0, GARDEN.z1, m.grass, g, { name: 'gazon', cast: false });
  // Sol environnant (hors jardin, non accessible)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), m.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(5, -0.05, 2);
  ground.receiveShadow = true;
  ground.userData.noRaycast = true;
  g.add(ground);

  buildGreenWalls(ctx, g);
  buildAwning(ctx, g);
  buildLounge(ctx, g);
  buildJacuzzi(ctx, g);
  buildFacadeDetails(ctx, g);
  buildPlants(ctx, g);
  buildSurroundings(ctx, g);
  buildGardenLights(ctx, g);
}

/* ------------------------------------------------------------------ */
/* Murs végétaux avec soubassement blanc et LED verticales (photo 6)   */
/* ------------------------------------------------------------------ */

const ledMats: THREE.MeshStandardMaterial[] = [];

function buildGreenWalls(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const t = 0.2, base = 0.42;
  const wallX = GARDEN.x1, wallZn = GARDEN.z0, wallZs = GARDEN.z1;
  // Murs porteurs (structure + collision)
  const walls: Array<[number, number, number, number]> = [
    [GARDEN.x0 - T, wallX + t, wallZn - t, wallZn], // nord
    [wallX, wallX + t, wallZn - t, wallZs + t], // est
    [BATH.x1 + T, wallX + t, wallZs, wallZs + t], // sud
  ];
  const top = new THREE.MeshStandardMaterial({ color: 0xe9e5dd, roughness: 0.9 });
  for (const [x0, x1, z0, z1] of walls) {
    b.slab(x0, x1, 0, base, z0, z1, m.plaster, g);
    b.slab(x0, x1, base, WALL_H, z0, z1, m.ivy, g);
    b.slab(x0, x1, WALL_H, WALL_H + 0.04, z0, z1, top, g, { collide: false });
  }
  // Jardinière / soubassement blanc légèrement en saillie
  const sill = 0.05;
  b.slab(GARDEN.x0, wallX, 0, base, wallZn, wallZn + sill, m.plaster, g, { collide: false });
  b.slab(wallX - sill, wallX, 0, base, wallZn, wallZs, m.plaster, g, { collide: false });
  b.slab(BATH.x1 + T, wallX, 0, base, wallZs - sill, wallZs, m.plaster, g, { collide: false });
  // Rubans LED verticaux encastrés dans la végétation
  const led = ledMaterial(0xffc27a, 7);
  ledMats.push(led);
  const strip = (x: number, z: number, alongX: boolean) =>
    b.strip(alongX ? 0.025 : 0.02, WALL_H - base - 0.1, alongX ? 0.02 : 0.025, x, (WALL_H + base) / 2, z, g, led);
  for (let x = 5.2; x < wallX - 0.5; x += 1.6) strip(x, wallZn + 0.01, true);
  for (let z = -0.6; z < wallZs - 0.5; z += 1.6) strip(wallX - 0.01, z, false);
  for (let x = 6.0; x < wallX - 0.5; x += 1.6) strip(x, wallZs - 0.01, true);
  // Petits spots au pied des murs
  const spot = ledMaterial(0xffd29a, 5);
  ledMats.push(spot);
  for (let x = 5.2; x < wallX - 0.5; x += 1.6) b.box(0.06, 0.04, 0.06, spot, x, base + 0.02, wallZn + 0.08, g);
  for (let z = -0.6; z < wallZs - 0.5; z += 1.6) b.box(0.06, 0.04, 0.06, spot, wallX - 0.08, base + 0.02, z, g);
}

/* ------------------------------------------------------------------ */
/* Store banne orange motorisé (photo 8)                               */
/* ------------------------------------------------------------------ */

function buildAwning(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const x0 = ROOM.x1 + T, z0 = -0.9, z1 = 4.15, yTop = 2.85, proj = 3.1, drop = 0.42;
  const width = z1 - z0;
  const grp = b.group(g, 0, 0, 0, 0, 'store banne');
  // Coffre
  b.slab(x0, x0 + 0.2, yTop - 0.08, yTop + 0.14, z0 - 0.1, z1 + 0.1, m.whitePlastic, grp, { collide: false });
  // Toile (géométrie recalculée selon l'ouverture)
  const seg = 20;
  const geo = new THREE.PlaneGeometry(1, 1, 1, seg);
  const fabric = new THREE.Mesh(geo, m.awning);
  fabric.castShadow = fabric.receiveShadow = true;
  grp.add(fabric);
  // Barre de charge + bras
  const bar = b.box(0.08, 0.1, width + 0.1, m.whitePlastic, 0, 0, 0, grp);
  const armMat = m.whitePlastic;
  const arms = [z0 + 0.3, z1 - 0.3].map((z) => {
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 0.05), armMat);
    a.castShadow = true;
    a.position.z = z;
    grp.add(a);
    return a;
  });
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(width, 0.18), m.awning);
  valance.rotation.y = Math.PI / 2;
  valance.castShadow = true;
  grp.add(valance);
  // LED sous le coffre (photo 8)
  const led = ledMaterial(0xffc27a, 9);
  ledMats.push(led);
  b.strip(0.015, 0.015, width, x0 + 0.05, yTop - 0.1, (z0 + z1) / 2, grp, led);

  const apply = (k: number) => {
    const L = 0.12 + proj * k;
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5; // 0 → 1 en largeur
      const v = 0.5 - p.getY(i); // 0 (mur) → 1 (barre)
      const sag = Math.sin(v * Math.PI) * 0.06 * k;
      p.setXYZ(i, x0 + 0.1 + v * L, yTop - v * drop * k - sag, z0 + u * width);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const ex = x0 + 0.1 + L, ey = yTop - drop * k;
    bar.position.set(ex, ey - 0.03, (z0 + z1) / 2);
    valance.position.set(ex + 0.04, ey - 0.12, (z0 + z1) / 2);
    valance.visible = k > 0.05;
    for (const a of arms) {
      const sx = x0 + 0.12, sy = yTop - 0.35;
      const dx = ex - sx, dy = ey - 0.05 - sy;
      const len = Math.hypot(dx, dy);
      a.scale.x = Math.max(0.05, len);
      a.position.set((sx + ex) / 2, (sy + ey - 0.05) / 2, a.position.z);
      a.rotation.z = Math.atan2(dy, dx);
      a.visible = k > 0.03;
    }
  };
  const anim = new Toggle(3.5, apply, 0); // replié le jour : le soleil entre par la baie (photo 2)
  b.updaters.push((dt) => { if (anim.update(dt)) ctx.dirtyEnv(); });
  const it = {
    label: () => (anim.on ? 'Replier le store banne' : 'Déployer le store banne'),
    action: () => { anim.toggle(); ctx.sound.slide(); ctx.notify(anim.on ? 'Le store se déploie…' : 'Le store se replie…'); },
    range: 3.5,
  };
  // Commande murale du store (interrupteur extérieur à côté de la baie)
  const sw = b.group(grp, x0 + 0.001, 1.15, SLIDER.z1 + 0.32, Math.PI / 2, 'commande store');
  b.box(0.08, 0.14, 0.02, m.whitePlastic, 0, 0, 0.01, sw);
  b.box(0.05, 0.04, 0.01, m.anthracite, 0, 0.035, 0.022, sw);
  b.box(0.05, 0.04, 0.01, m.anthracite, 0, -0.035, 0.022, sw);
  makeInteractable(sw, it);
  makeInteractable(fabric, it);
}

/* ------------------------------------------------------------------ */
/* Salon de jardin blanc laqué + table, lanterne (photo 8)             */
/* ------------------------------------------------------------------ */

function buildLounge(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const x0 = ROOM.x1 + T;
  const grp = b.group(g, 0, 0, 0, 0, 'salon de jardin');
  // Banquette le long de la façade, retour le long du mur sud
  b.rbox(0.75, 0.38, 1.6, 0.03, m.whiteGloss, x0 + 0.42, 0.19, 3.55, grp);
  b.rbox(0.66, 0.12, 1.5, 0.05, m.cushionBeige, x0 + 0.44, 0.44, 3.55, grp);
  b.rbox(0.18, 0.45, 1.5, 0.06, m.cushionBeige, x0 + 0.12, 0.66, 3.55, grp).rotation.z = -0.12;
  b.rbox(0.4, 0.4, 0.14, 0.05, m.cushionBeige, x0 + 0.3, 0.66, 2.95, grp).rotation.y = 0.3;
  b.rbox(1.6, 0.38, 0.75, 0.03, m.whiteGloss, x0 + 1.55, 0.19, 4.0, grp);
  b.rbox(1.5, 0.12, 0.66, 0.05, m.cushionBeige, x0 + 1.55, 0.44, 4.0, grp);
  b.rbox(1.5, 0.45, 0.18, 0.06, m.cushionBeige, x0 + 1.55, 0.66, 4.3, grp).rotation.x = 0.12;
  b.col.addBox(x0, x0 + 0.8, 0, 0.9, 2.74, 4.4, 'banquette');
  b.col.addBox(x0 + 0.75, x0 + 2.36, 0, 0.9, 3.6, 4.4, 'banquette');
  // Table basse laquée avec plateau de verre
  const tx = x0 + 1.45, tz = 2.95;
  b.rbox(0.85, 0.4, 0.85, 0.02, m.whiteGloss, tx, 0.2, tz, grp);
  const gl = b.box(0.87, 0.012, 0.87, m.glass, tx, 0.406, tz, grp);
  gl.castShadow = false;
  b.col.addBox(tx - 0.44, tx + 0.44, 0, 0.42, tz - 0.44, tz + 0.44, 'table jardin');
  // Cendrier en verre
  b.cyl(0.07, 0.06, 0.035, m.glass, tx + 0.15, 0.43, tz - 0.1, grp, 20).castShadow = false;
  // Lanterne noire avec bougie LED
  const lan = b.group(grp, tx - 0.25, 0.412, tz + 0.2, 0, 'lanterne');
  b.cyl(0.07, 0.08, 0.03, m.blackMetal, 0, 0.015, 0, lan, 16);
  b.cyl(0.06, 0.06, 0.2, m.glass, 0, 0.13, 0, lan, 16, true).castShadow = false;
  b.cyl(0.04, 0.08, 0.06, m.blackMetal, 0, 0.26, 0, lan, 16);
  b.cyl(0.015, 0.015, 0.03, m.blackMetal, 0, 0.3, 0, lan, 8);
  const flame = ledMaterial(0xffa040, 9);
  ledMats.push(flame);
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), flame);
  f.scale.y = 2;
  f.position.y = 0.11;
  lan.add(f);
  const ll = new THREE.PointLight(0xff9a40, 0.6, 3, 2);
  ll.position.set(0, 0.15, 0);
  lan.add(ll);
  lanternLight = ll;
}
let lanternLight: THREE.PointLight | undefined;

/* ------------------------------------------------------------------ */
/* Spa gonflable octogonal + entourage en résine tressée (photo 6)     */
/* ------------------------------------------------------------------ */

function buildJacuzzi(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const { x, z, r } = JACUZZI;
  const grp = b.group(g, x, 0, z, Math.PI / 8, 'spa');
  const body = b.cyl(r, r, 0.62, m.jacuzziShell, 0, 0.31, 0, grp, 8);
  body.rotation.y = 0;
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.1, r - 0.1, 0.6, 8, 1, true), m.jacuzziLiner);
  liner.position.y = 0.36;
  grp.add(liner);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.06, 0.09, 12, 8), m.jacuzziShell);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = Math.PI / 8;
  rim.position.y = 0.66;
  rim.castShadow = true;
  grp.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 8), m.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.56;
  grp.add(water);
  // Éclairage subaquatique
  const wl = new THREE.PointLight(0x5fd8ff, 0.8, 2.5, 2);
  wl.position.set(0, 0.45, 0);
  grp.add(wl);
  // Bulles (jets) — particules animées
  const N = 140;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const bubbles = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.8, depthWrite: false }));
  bubbles.visible = false;
  bubbles.frustumCulled = false;
  bubbles.userData.noRaycast = true;
  grp.add(bubbles);
  const seeds = Array.from({ length: N }, () => [Math.random(), Math.sqrt(Math.random()), Math.random()]);
  const wn = m.waterNormal;
  let jets = false;
  b.updaters.push((dt, time) => {
    wn.offset.x += dt * (jets ? 0.25 : 0.02);
    wn.offset.y += dt * (jets ? 0.18 : 0.015);
    m.water.normalScale.setScalar(jets ? 1.1 : 0.35);
    if (!jets) return;
    for (let i = 0; i < N; i++) {
      const [a, rr, ph] = seeds[i];
      const ang = a * Math.PI * 2 + time * 0.3;
      const rad = rr * (r - 0.18);
      pos[i * 3] = Math.cos(ang) * rad + Math.sin(time * 9 + i) * 0.01;
      pos[i * 3 + 1] = 0.565 + ((time * 0.7 + ph) % 1) * 0.02;
      pos[i * 3 + 2] = Math.sin(ang) * rad;
    }
    geo.attributes.position.needsUpdate = true;
  });
  b.col.addCylinder(x, z, r + 0.02, 0, 0.75, 'spa');
  makeInteractable(grp, {
    label: () => (jets ? 'Arrêter les bulles du spa' : 'Activer les bulles du spa'),
    action: () => {
      jets = !jets;
      bubbles.visible = jets;
      ctx.sound.slide();
      ctx.notify(jets ? 'Spa : jets de massage activés — eau à 37 °C' : 'Spa : jets arrêtés');
    },
    range: 3,
  });
  spaLight = wl;

  // Entourage en résine tressée : étagère, banquette, marche (orientés vers la terrasse)
  const sur = b.group(g, x, 0, z, 0, 'entourage spa');
  const deg = Math.PI / 180;
  const r0 = r + 0.04, r1 = r + 0.62;
  b.arc(r0, r1, 196 * deg, 222 * deg, 0.82, m.rattan, sur, 0);
  b.arc(r0 + 0.04, r1 - 0.04, 199 * deg, 219 * deg, 0.02, m.blackMatte, sur, 0.4);
  // serviettes bleues dans l'étagère
  b.arc(r0 + 0.12, r1 - 0.12, 202 * deg, 216 * deg, 0.1, new THREE.MeshStandardMaterial({ color: 0x1d6fb8, roughness: 1 }), sur, 0.42);
  b.arc(r0, r1, 138 * deg, 194 * deg, 0.4, m.rattan, sur, 0);
  b.arc(r0 + 0.03, r1 - 0.03, 139 * deg, 193 * deg, 0.12, m.cushionBeige, sur, 0.4, 0.03);
  b.arc(r1 - 0.12, r1 - 0.03, 139 * deg, 193 * deg, 0.42, m.cushionBeige, sur, 0.5, 0.03);
  b.arc(r0, r1 - 0.08, 104 * deg, 136 * deg, 0.42, m.rattan, sur, 0);
  b.arc(r0 + 0.03, r1 - 0.11, 106 * deg, 134 * deg, 0.012, m.blackMatte, sur, 0.42);
  b.col.addCylinder(x, z, r1, 0, 0.85, 'entourage spa');
}
let spaLight: THREE.PointLight | undefined;

/* ------------------------------------------------------------------ */
/* Façade : chauffe-eau, groupe de clim, appliques (photo 8)           */
/* ------------------------------------------------------------------ */

function buildFacadeDetails(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const x0 = ROOM.x1 + T;
  // Chauffe-eau
  b.cyl(0.22, 0.22, 0.8, m.whitePlastic, x0 + 0.24, 2.1, -0.45, g, 32);
  b.box(0.04, 0.3, 0.04, m.whitePlastic, x0 + 0.1, 1.6, -0.45, g);
  b.col.addBox(x0, x0 + 0.48, 1.65, 2.55, -0.7, -0.2);
  // Unité extérieure de climatisation sur consoles
  const ac = b.group(g, x0 + 0.2, 2.25, 4.0, 0);
  b.box(0.3, 0.55, 0.75, m.whitePlastic, 0, 0, 0, ac);
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 32), m.blackMatte);
  fan.rotation.z = Math.PI / 2;
  fan.position.set(0.153, 0, 0.1);
  ac.add(fan);
  b.box(0.35, 0.03, 0.03, m.steel, 0, -0.29, -0.3, ac);
  b.box(0.35, 0.03, 0.03, m.steel, 0, -0.29, 0.3, ac);
  b.col.addBox(x0, x0 + 0.4, 1.9, 2.6, 3.6, 4.4);
  // Appliques murales
  const wallLed = ledMaterial(0xffd29a, 6);
  ledMats.push(wallLed);
  for (const z of [0.1, 3.0]) {
    b.box(0.08, 0.12, 0.08, m.anthracite, x0 + 0.04, 2.05, z, g);
    b.box(0.06, 0.005, 0.06, wallLed, x0 + 0.04, 1.988, z, g);
  }
}

/* ------------------------------------------------------------------ */
/* Végétation : bananiers, fougères, palmiers (photo 6)                */
/* ------------------------------------------------------------------ */

function plant(ctx: Ctx, parent: THREE.Object3D, x: number, y: number, z: number, kind: 'banana' | 'fern' | 'palm', scale: number, seed: number, facing: number, spread = Math.PI) {
  const m = ctx.b.m;
  const mat = kind === 'banana' ? m.leafBanana : kind === 'fern' ? m.leafFern : m.leafPalm;
  const r = rng(seed);
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  parent.add(grp);
  const n = kind === 'fern' ? 9 : 7;
  const len = (kind === 'banana' ? 0.9 : kind === 'fern' ? 0.6 : 1.1) * scale;
  const geo = new THREE.PlaneGeometry(len * 0.5, len, 1, 4);
  geo.translate(0, len / 2, 0);
  // Courbure de la feuille
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yy = p.getY(i) / len;
    p.setZ(i, yy * yy * 0.35 * len);
  }
  geo.computeVertexNormals();
  for (let i = 0; i < n; i++) {
    const leaf = new THREE.Mesh(geo, mat);
    const a = facing + (r() - 0.5) * spread;
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = a;
    leaf.rotation.x = kind === 'fern' ? 0.9 + r() * 1.2 : 0.25 + r() * 0.8;
    leaf.rotation.z = (r() - 0.5) * 0.6;
    leaf.castShadow = true;
    leaf.userData.noRaycast = true;
    grp.add(leaf);
  }
  return grp;
}

function buildPlants(ctx: Ctx, g: THREE.Object3D) {
  const zN = GARDEN.z0 + 0.03, xE = GARDEN.x1 - 0.03, zS = GARDEN.z1 - 0.03;
  // Bouquets accrochés au mur végétal (face à l'intérieur du jardin)
  const spots: Array<[number, number, number, 'banana' | 'fern', number]> = [
    [4.4, 1.7, zN, 'banana', 0], [5.9, 2.1, zN, 'fern', 0], [6.6, 1.3, zN, 'banana', 0], [7.9, 1.9, zN, 'fern', 0],
    [8.6, 1.45, zN, 'banana', 0], [9.7, 2.2, zN, 'fern', 0],
    [xE, 1.8, 0.3, 'banana', -Math.PI / 2], [xE, 2.15, 1.4, 'fern', -Math.PI / 2], [xE, 1.3, 2.4, 'banana', -Math.PI / 2], [xE, 2.0, 3.5, 'fern', -Math.PI / 2],
    [6.4, 1.6, zS, 'banana', Math.PI], [7.6, 2.2, zS, 'fern', Math.PI], [8.8, 1.4, zS, 'banana', Math.PI],
  ];
  // facing = direction de la normale du mur (vers le jardin)
  spots.forEach(([x, y, z, k, rot], i) => {
    const facing = rot === 0 ? 0 : rot === Math.PI ? Math.PI : -Math.PI / 2;
    plant(ctx, g, x, k === 'fern' ? y : y - 0.4, z, k, k === 'banana' ? 0.9 : 0.8, 100 + i, facing, k === 'fern' ? 2.2 : 1.6);
  });
}

/* ------------------------------------------------------------------ */
/* Arrière-plan : immeubles blancs et palmiers au-delà des murs        */
/* ------------------------------------------------------------------ */

function buildSurroundings(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const grp = b.group(g, 0, 0, 0, 0, 'environs');
  // Immeubles lointains et bas : le ciel reste dégagé au-dessus des murs (photo 6)
  const blocks: Array<[number, number, number, number, number]> = [
    [24, 32, -14, -4, 7], [26, 34, 8, 18, 9], [-6, 2, -22, -12, 8],
  ];
  const win = new THREE.MeshStandardMaterial({ color: 0x3a4652, roughness: 0.15, metalness: 0.4 });
  for (const [x0, x1, z0, z1, h] of blocks) {
    b.slab(x0, x1, 0, h, z0, z1, m.plaster, grp, { collide: false, cast: true });
    // Fenêtres sur la face tournée vers le jardin
    const faceX = x0 > 20 ? x0 - 0.01 : null;
    for (let y = 1.2; y < h - 1; y += 2.8) {
      if (faceX !== null) for (let z = z0 + 1; z < z1 - 1; z += 2.4) b.box(0.02, 1.3, 1.1, win, faceX, y + 0.6, z + 0.6, grp).castShadow = false;
      else for (let x = x0 + 1; x < x1 - 1; x += 2.4) b.box(1.1, 1.3, 0.02, win, x + 0.6, y + 0.6, z1 + 0.01, grp).castShadow = false;
    }
  }
  // Palmiers
  const palms: Array<[number, number, number]> = [[13.5, 1.0, 6.5], [12.8, -4.2, 7.2], [7.5, -4.6, 6.0], [15, 5.5, 8]];
  palms.forEach(([x, z, h], i) => {
    const trunk = b.cyl(0.11, 0.18, h, m.trunk, x, h / 2, z, grp, 10);
    trunk.rotation.z = (i % 2 ? 1 : -1) * 0.06;
    const crown = plant(ctx, grp, x + (i % 2 ? -1 : 1) * h * 0.06, h - 0.1, z, 'palm', 2.4, 300 + i, 0, Math.PI * 2);
    crown.children.forEach((c) => { c.rotation.x = 1.0 + Math.random() * 0.6; });
  });
}

/* ------------------------------------------------------------------ */
/* Groupe « éclairage du jardin »                                      */
/* ------------------------------------------------------------------ */

function buildGardenLights(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const grp = new LightGroup('Éclairage du jardin', true);
  ledMats.forEach((mm) => grp.addEmissive(mm));
  const awningLight = new THREE.PointLight(0xffc27a, 2.2, 7, 2);
  awningLight.position.set(ROOM.x1 + 0.6, 2.5, 1.6);
  const wallWash = new THREE.PointLight(0xffc27a, 1.6, 6, 2);
  wallWash.position.set(8.4, 1.6, 2.4);
  g.add(awningLight, wallWash);
  grp.addLight(awningLight).addLight(wallWash);
  if (lanternLight) grp.addLight(lanternLight);
  if (spaLight) grp.addLight(spaLight);
  ctx.lights.garden = grp;
  // Interrupteur intérieur (à côté de la baie) et extérieur
  const mk = (x: number, z: number, ry: number) => {
    const sw = b.group(g, x, 1.1, z, ry, 'interrupteur jardin');
    b.box(0.085, 0.085, 0.01, b.m.whitePlastic, 0, 0, 0.005, sw);
    const rocker = b.box(0.055, 0.055, 0.008, b.m.whitePlastic, 0, 0, 0.012, sw);
    const sync = () => { rocker.rotation.x = grp.on ? -0.12 : 0.12; };
    sync();
    makeInteractable(sw, {
      label: () => `${grp.on ? 'Éteindre' : 'Allumer'} : éclairage du jardin`,
      action: () => { grp.toggle(); ctx.sound.click(); ctx.dirtyEnv(); },
      range: 2.6,
    });
    return sync;
  };
  const s1 = mk(ROOM.x1 - 0.001, SLIDER.z1 + 0.45, -Math.PI / 2);
  const s2 = mk(ROOM.x1 + T + 0.001, SLIDER.z1 + 0.18, Math.PI / 2);
  grp.onChange = () => { s1(); s2(); };
}
