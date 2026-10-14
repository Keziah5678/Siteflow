import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Ctx, H, ROOM, KITCHEN, HALL, BATH, SLIDER } from './layout';
import { ledMaterial } from './Builder';
import { LightGroup } from './LightGroup';
import { makeInteractable, Toggle, Interactable } from '../interaction/Interactions';
import { boxProjectUV, rng } from '../core/utils';
import { updateCollider } from './Architecture';

export function buildInterior(ctx: Ctx) {
  const root = ctx.b.group(ctx.root, 0, 0, 0, 0, 'intérieur');
  buildCeilingLights(ctx, root);
  buildHeadboard(ctx, root);
  buildBed(ctx, root);
  buildNightstands(ctx, root);
  buildAC(ctx, root);
  buildCoffeeTable(ctx, root);
  buildWardrobe(ctx, root);
  buildTV(ctx, root);
  buildCurtains(ctx, root);
  buildKitchen(ctx, root);
  buildBathroom(ctx, root);
  buildHall(ctx, root);
  buildSwitches(ctx, root);
}

/* ================================================================== */
/* Éclairage intérieur principal                                      */
/* ================================================================== */

function buildCeilingLights(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const group = new LightGroup('Plafonnier', false);
  ctx.lights.ceiling = group;
  // Plafonnier rond au diffuseur ondulé (photos 1 et 2)
  const lamp = b.cyl(0.25, 0.25, 0.07, b.m.wavesLamp, 1.8, H - 0.04, 2.2, root, 48);
  lamp.castShadow = false;
  b.cyl(0.2, 0.2, 0.012, b.m.whitePlastic, 1.8, H - 0.003, 2.2, root, 32).castShadow = false;
  group.addEmissive(b.m.wavesLamp, 2.2);
  const spot = new THREE.SpotLight(0xfff0dc, 26, 0, 1.3, 0.85, 2);
  spot.position.set(1.8, H - 0.09, 2.2);
  spot.target.position.set(1.8, 0, 2.2);
  spot.castShadow = ctx.quality !== 'basse';
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.1;
  spot.shadow.camera.far = 6;
  root.add(spot, spot.target);
  group.addLight(spot);
  // Spot de l'entrée, commandé par le même interrupteur
  const hallSpotMat = ledMaterial(0xfff1dd, 3);
  b.cyl(0.04, 0.04, 0.01, hallSpotMat, 0.5, H - 0.004, 5.3, root, 16).castShadow = false;
  const hall = new THREE.PointLight(0xfff0dc, 2.2, 5, 2);
  hall.position.set(0.5, H - 0.15, 5.3);
  root.add(hall);
  group.addLight(hall).addEmissive(hallSpotMat);
}

/* ================================================================== */
/* Tête de lit capitonnée, lattes bois et LED (photo 1)               */
/* ================================================================== */

function buildHeadboard(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(root, 0, 0, 0, 0, 'tête de lit');
  for (let i = 0; i < 4; i++) {
    b.rbox(0.445, 1.96, 0.075, 0.03, b.m.felt, 0.8 + 0.225 + i * 0.45, 0.38 + 0.98, 0.04, g, 3);
  }
  b.box(1.8, 0.38, 0.06, b.m.felt, 1.7, 0.19, 0.03, g);
  b.box(0.25, 2.48, 0.03, b.m.slats, 0.675, 1.24, 0.015, g);
  b.box(0.25, 2.48, 0.03, b.m.slats, 2.725, 1.24, 0.015, g);
  const led = ledMaterial(0xffc488, 7);
  b.strip(0.012, 2.4, 0.012, 0.795, 1.24, 0.04, g, led);
  b.strip(0.012, 2.4, 0.012, 2.605, 1.24, 0.04, g, led);
  const grp = new LightGroup('LED de la tête de lit', true).addEmissive(led);
  const l1 = new THREE.PointLight(0xffc488, 0.4, 2.6, 2);
  l1.position.set(0.8, 1.3, 0.25);
  const l2 = l1.clone();
  l2.position.x = 2.6;
  g.add(l1, l2);
  grp.addLight(l1).addLight(l2);
  ctx.lights.headboard = grp;
  b.col.addBox(0.55, 2.85, 0, 2.48, 0, 0.08, 'tête de lit');
}

/* ================================================================== */
/* Lit : sommier bouclé « bubble », couette drapée, oreillers         */
/* ================================================================== */

function buildBed(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(root, 1.7, 0, 0.08, 0, 'lit');
  const W = 1.84, L = 2.14;
  b.rbox(W - 0.1, 0.36, L - 0.1, 0.08, b.m.boucle, 0, 0.22, L / 2, g);
  // Boudins capitonnés tout autour (sommier en tissu bouclé)
  const puff = new RoundedBoxGeometry(0.205, 0.38, 0.15, 4, 0.07);
  boxProjectUV(puff);
  const placements: Array<[number, number, number]> = [];
  for (let z = 0.16; z < L - 0.1; z += 0.205) { placements.push([-W / 2 + 0.06, z, Math.PI / 2]); placements.push([W / 2 - 0.06, z, Math.PI / 2]); }
  for (let x = -W / 2 + 0.16; x < W / 2 - 0.1; x += 0.205) placements.push([x, L - 0.06, 0]);
  const inst = new THREE.InstancedMesh(puff, b.m.boucle, placements.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  const r = rng(3);
  placements.forEach(([x, z, ry], i) => {
    q.setFromEuler(new THREE.Euler(0, ry + (r() - 0.5) * 0.06, 0));
    s.set(1, 1 + (r() - 0.5) * 0.04, 1);
    mtx.compose(new THREE.Vector3(x, 0.2, z), q, s);
    inst.setMatrixAt(i, mtx);
  });
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);
  // Matelas
  b.rbox(1.62, 0.24, 2.0, 0.06, b.m.sheet, 0, 0.5, 1.04, g);
  // Couette drapée sur les côtés et le pied du lit
  const duvet = new THREE.Mesh(drapeGeometry(0.82, 0.04, 2.08, 0.3, 0.68), b.m.sheet);
  duvet.castShadow = duvet.receiveShadow = true;
  g.add(duvet);
  // Oreillers inclinés contre la tête de lit
  for (const x of [-0.42, 0.42]) {
    const p = b.rbox(0.68, 0.15, 0.46, 0.07, b.m.pillow, x, 0.8, 0.3, g, 4);
    p.rotation.x = -0.42;
  }
  // Serviette noire roulée posée sur le lit (photos 1 et 2)
  const t = b.group(g, 0.12, 0.72, 1.3, 0.5);
  for (const dz of [-0.07, 0.07]) {
    const c = b.cyl(0.075, 0.075, 0.34, b.m.towelBlack, 0, 0.0, dz, t, 20);
    c.rotation.z = Math.PI / 2;
  }
  b.box(0.08, 0.02, 0.3, new THREE.MeshStandardMaterial({ color: 0x9b1d22, roughness: 0.9 }), 0, 0.075, 0, t);
  b.col.addBox(0.78, 2.62, 0, 0.7, 0.08, 0.08 + L, 'lit');
}

/** Drap/couette : grille déformée (plat sur le matelas, retombe sur les bords). */
function drapeGeometry(halfW: number, z0: number, zFoot: number, overhang: number, top: number): THREE.BufferGeometry {
  const nx = 64, nz = 64;
  const sMin = -halfW - overhang, sMax = halfW + overhang;
  const tMax = zFoot + overhang;
  const g = new THREE.PlaneGeometry(1, 1, nx, nz);
  const pos = g.attributes.position;
  const rr = 0.07;
  const fold = (e: number): [number, number] => {
    if (e <= 0) return [e, 0];
    const arc = (Math.PI / 2) * rr;
    if (e < arc) { const th = e / rr; return [rr * Math.sin(th), rr * (1 - Math.cos(th))]; }
    return [rr, rr + (e - arc)];
  };
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5, v = 0.5 - pos.getY(i);
    const s = sMin + u * (sMax - sMin);
    const t = z0 + v * (tMax - z0);
    const [ox, dx] = fold(Math.abs(s) - halfW);
    const [oz, dz] = fold(t - zFoot);
    const x = Math.abs(s) > halfW ? Math.sign(s) * (halfW + ox) : s;
    const z = t > zFoot ? zFoot + oz : t;
    const drop = Math.max(dx, dz);
    const wr = 0.006 * Math.sin(s * 11 + t * 4) * Math.sin(t * 7.3) + 0.004 * Math.sin(s * 23 - t * 13);
    const wave = drop > 0.02 ? 0.012 * Math.sin((Math.abs(s) > halfW ? t : s) * 18) * Math.min(1, drop * 6) : 0;
    const px = x + (Math.abs(s) > halfW ? Math.sign(s) * wave : 0);
    const pz = z + (t > zFoot ? wave : 0);
    pos.setXYZ(i, px, top - drop + wr, pz);
  }
  g.computeVertexNormals();
  boxProjectUV(g);
  return g;
}

/* ================================================================== */
/* Tables de chevet + bougie                                          */
/* ================================================================== */

function buildNightstands(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  for (const x of [0.52, 2.88]) {
    const g = b.group(root, x, 0, 0.27, 0, 'chevet');
    b.rbox(0.45, 0.5, 0.4, 0.015, b.m.greyFurniture, 0, 0.27, 0, g);
    b.box(0.43, 0.006, 0.005, b.m.blackMatte, 0, 0.3, 0.2, g);
    for (const y of [0.17, 0.41]) b.box(0.12, 0.012, 0.02, b.m.blackMetal, 0, y, 0.21, g);
    b.box(0.41, 0.02, 0.36, b.m.blackMatte, 0, 0.01, 0, g);
    b.col.addObject(g, 'chevet');
  }
  // Bougie dans un photophore (photo 1, chevet gauche)
  const cg = b.group(root, 0.45, 0.52, 0.3, 0, 'bougie');
  const glass = b.cyl(0.035, 0.03, 0.07, b.m.glass, 0, 0.035, 0, cg, 20, true);
  glass.castShadow = false;
  b.cyl(0.028, 0.028, 0.04, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.7 }), 0, 0.02, 0, cg, 16);
  const flameMat = ledMaterial(0xffa040, 8);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), flameMat);
  flame.scale.set(1, 2.2, 1);
  flame.position.y = 0.055;
  cg.add(flame);
  const light = new THREE.PointLight(0xff9a40, 0.35, 2.2, 2);
  light.position.set(0, 0.12, 0.05);
  cg.add(light);
  const grp = new LightGroup('Bougie', true).addLight(light).addEmissive(flameMat);
  grp.flicker = (t) => 0.85 + 0.1 * Math.sin(t * 13) + 0.05 * Math.sin(t * 31.7);
  ctx.lights.candle = grp;
  makeInteractable(cg, {
    label: () => (grp.on ? 'Souffler la bougie' : 'Allumer la bougie'),
    action: () => { grp.toggle(); ctx.sound.click(); },
  });
}

/* ================================================================== */
/* Climatiseur mural                                                  */
/* ================================================================== */

function buildAC(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(root, 3.22, 2.2, 0.11, 0, 'climatiseur');
  b.rbox(0.7, 0.27, 0.2, 0.05, b.m.whitePlastic, 0, 0, 0, g);
  b.box(0.6, 0.02, 0.1, b.m.blackMatte, 0, -0.13, 0.02, g);
  const flap = b.group(g, 0, -0.125, 0.1);
  b.box(0.62, 0.006, 0.07, b.m.whitePlastic, 0, 0, -0.035, flap);
  const ledMat = ledMaterial(0x40c0ff, 0);
  b.strip(0.012, 0.006, 0.004, 0.27, -0.06, 0.1, g, ledMat);
  const anim = new Toggle(1.2, (k) => { flap.rotation.x = k * 0.9; ledMat.emissiveIntensity = k * 4; });
  b.updaters.push((dt) => anim.update(dt));
  makeInteractable(g, {
    label: () => (anim.on ? 'Éteindre la climatisation' : 'Allumer la climatisation'),
    action: () => {
      anim.toggle();
      ctx.sound.beep();
      ctx.notify(anim.on ? 'Climatisation en marche — consigne 22 °C' : 'Climatisation arrêtée');
    },
    range: 3,
  });
}

/* ================================================================== */
/* Table basse à plateau relevable (photo 1)                          */
/* ================================================================== */

function buildCoffeeTable(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(root, 1.75, 0, 2.72, 0, 'table basse');
  const w = 1.0, d = 0.52, h = 0.42;
  const k = b.m.blackMatte;
  b.box(w, 0.03, d, k, 0, 0.05, 0, g);
  b.box(0.03, h - 0.06, d, k, -w / 2 + 0.015, 0.06 + (h - 0.06) / 2, 0, g);
  b.box(0.03, h - 0.06, d, k, w / 2 - 0.015, 0.06 + (h - 0.06) / 2, 0, g);
  b.box(w, h - 0.06, 0.03, k, 0, 0.06 + (h - 0.06) / 2, -d / 2 + 0.015, g);
  b.box(w, h - 0.06, 0.03, k, 0, 0.06 + (h - 0.06) / 2, d / 2 - 0.015, g);
  b.box(w - 0.06, 0.02, d - 0.06, k, 0, 0.24, 0, g);
  b.box(0.02, 0.18, d - 0.06, k, 0, 0.33, 0, g);
  b.box(w - 0.04, 0.04, d - 0.04, k, 0, 0.02, 0, g);
  // Plateau chêne relevable
  const top = b.group(g, 0, h, 0);
  b.box(w + 0.02, 0.035, d + 0.02, b.m.oakTable, 0, 0.0175, 0, top);
  // Télécommande
  const rem = b.group(top, 0.05, 0.04, 0.05, 0.4);
  b.rbox(0.045, 0.018, 0.17, 0.008, b.m.blackMatte, 0, 0, 0, rem);
  // Mécanisme (bras chromés)
  const arms: THREE.Mesh[] = [];
  for (const x of [-0.35, 0.35]) {
    const arm = b.box(0.015, 0.2, 0.02, b.m.steel, x, 0, 0, g);
    arm.geometry.translate(-x, 0, 0);
    arm.position.set(x, h - 0.1, 0);
    arms.push(arm);
  }
  const anim = new Toggle(1.0, (t) => {
    top.position.y = h + t * 0.17;
    top.position.z = -t * 0.12;
    top.rotation.x = -t * 0.04;
    for (const a of arms) { a.position.y = h - 0.1 + t * 0.1; a.position.z = -t * 0.06; a.rotation.x = -t * 0.5; }
  });
  b.updaters.push((dt) => anim.update(dt));
  makeInteractable(g, {
    label: () => (anim.on ? 'Abaisser le plateau de la table' : 'Relever le plateau de la table'),
    action: () => { anim.toggle(); ctx.sound.slide(); },
  });
  b.col.addBox(1.75 - w / 2, 1.75 + w / 2, 0, 0.65, 2.72 - d / 2 - 0.12, 2.72 + d / 2, 'table basse');
}

/* ================================================================== */
/* Armoire deux portes en chêne clair (photo 2)                       */
/* ================================================================== */

function buildWardrobe(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const z0 = 2.55, z1 = 3.95, dpt = 0.6, hh = 2.42, th = 0.02;
  const g = b.group(root, 0, 0, 0, 0, 'armoire');
  const o = b.m.oakLight;
  b.box(dpt, hh, th, o, dpt / 2, hh / 2, z0 + th / 2, g);
  b.box(dpt, hh, th, o, dpt / 2, hh / 2, z1 - th / 2, g);
  b.box(dpt, th, z1 - z0, o, dpt / 2, hh - th / 2, (z0 + z1) / 2, g);
  b.box(dpt, 0.08, z1 - z0, o, dpt / 2, 0.04, (z0 + z1) / 2, g);
  b.box(th, hh, z1 - z0, o, th / 2, hh / 2, (z0 + z1) / 2, g);
  b.box(dpt - 0.02, th, z1 - z0 - 0.04, o, dpt / 2, 1.95, (z0 + z1) / 2, g);
  // Séparation penderie / étagères
  b.box(dpt - 0.04, 1.87, th, o, dpt / 2, 1.015, 3.25, g);
  const rod = b.cyl(0.012, 0.012, 0.66, b.m.steel, dpt / 2, 1.82, 2.9, g, 12);
  rod.rotation.x = Math.PI / 2;
  const r = rng(8);
  const cloth = [0x2d3a4a, 0xd9d4c8, 0x7a2f2f, 0x1f1f22, 0x8b9a7b];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.MeshStandardMaterial({ color: cloth[i % cloth.length], roughness: 0.95 });
    b.box(0.42, 0.85 + r() * 0.2, 0.025, c, dpt / 2, 1.33 - r() * 0.1, 2.65 + i * 0.09, g);
  }
  for (const y of [0.5, 0.95, 1.4]) {
    b.box(dpt - 0.04, th, 0.62, o, dpt / 2, y, 3.6, g);
    b.box(0.3, 0.12, 0.3, b.m.pillow, dpt / 2 - 0.05, y + 0.07, 3.6, g);
  }
  b.col.addBox(0, dpt + 0.03, 0, hh, z0, z1, 'armoire');
  // Portes battantes
  const dw = (z1 - z0) / 2 - 0.004;
  const door = (hingeZ: number, dir: 1 | -1) => {
    const pivot = b.group(g, dpt + 0.012, 0.085, hingeZ);
    b.box(0.022, hh - 0.09, dw, o, 0, (hh - 0.09) / 2, (dir * dw) / 2, pivot);
    const handle = b.box(0.02, 0.6, 0.02, b.m.steel, 0.035, 1.05, dir * (dw - 0.05), pivot);
    handle.castShadow = false;
    b.box(0.03, 0.02, 0.015, b.m.steel, 0.02, 1.33, dir * (dw - 0.05), pivot);
    b.box(0.03, 0.02, 0.015, b.m.steel, 0.02, 0.77, dir * (dw - 0.05), pivot);
    const col = b.col.addBox(0, 0, 0, 0, 0, 0, 'porte armoire');
    const anim = new Toggle(0.8, (k) => { pivot.rotation.y = dir * k * Math.PI * 0.5; updateCollider(col, pivot); });
    updateCollider(col, pivot);
    b.updaters.push((dt) => anim.update(dt));
    makeInteractable(pivot, {
      label: () => (anim.on ? "Fermer la porte de l'armoire" : "Ouvrir l'armoire"),
      action: () => { anim.toggle(); ctx.sound.door(); },
    });
  };
  door(z0 + 0.003, 1);
  door(z1 - 0.003, -1);
}

/* ================================================================== */
/* Télévision murale sur bras articulé (photos 2 et 3)                */
/* ================================================================== */

function buildTV(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const x = ROOM.x1, z = 3.65, y = 1.38;
  const g = b.group(root, x, 0, z, 0, 'télévision');
  b.box(0.02, 0.2, 0.3, b.m.blackMatte, -0.01, y, 0, g);
  b.box(0.12, 0.04, 0.05, b.m.blackMetal, -0.07, y, 0, g);
  const tv = b.group(g, -0.14, y, 0, -0.12);
  b.box(0.045, 0.66, 1.14, b.m.blackMatte, 0, 0, 0, tv);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.11, 0.625), b.m.screenOn);
  screen.rotation.y = -Math.PI / 2;
  screen.position.x = -0.0235;
  tv.add(screen);
  const grp = new LightGroup('Télévision', false).addEmissive(b.m.screenOn, 1.4);
  const glow = new THREE.PointLight(0x9fb4ff, 0.5, 3, 2);
  glow.position.set(-0.6, y, 0);
  g.add(glow);
  grp.addLight(glow);
  ctx.lights.tv = grp;
  b.col.addBox(x - 0.25, x, 0.95, 1.75, z - 0.6, z + 0.6, 'tv');
  makeInteractable(tv, {
    label: () => (grp.on ? 'Éteindre la télévision' : 'Allumer la télévision'),
    action: () => { grp.toggle(); ctx.sound.beep(); },
    range: 3.2,
  });
}

/* ================================================================== */
/* Voilages gris de la baie vitrée                                    */
/* ================================================================== */

function buildCurtains(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const x = ROOM.x1 - 0.1, top = 2.49, za = SLIDER.z0 - 0.35, zb = SLIDER.z1 + 0.35;
  const rod = b.cyl(0.012, 0.012, zb - za + 0.1, b.m.blackMetal, x, top + 0.005, (za + zb) / 2, root, 8);
  rod.rotation.x = Math.PI / 2;
  const segs = 48;
  const make = (anchor: number, dir: 1 | -1) => {
    const geo = new THREE.PlaneGeometry(1, top - 0.02, segs, 1);
    boxProjectUV(geo);
    const mesh = new THREE.Mesh(geo, b.m.curtain);
    mesh.position.set(0, (top - 0.02) / 2 + 0.01, 0);
    mesh.castShadow = true;
    root.add(mesh);
    const base = geo.attributes.position.array.slice() as Float32Array;
    const shape = (open: number) => {
      const width = THREE.MathUtils.lerp(0.36, (zb - za) / 2 + 0.04, 1 - open);
      const amp = THREE.MathUtils.lerp(0.025, 0.07, open);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = base[i * 3] + 0.5;
        const yy = base[i * 3 + 1];
        const zz = anchor + dir * u * width;
        const xx = x + Math.sin(u * Math.PI * 2 * 9) * amp * (0.6 + 0.4 * Math.sin(yy * 1.3 + 1));
        pos.setXYZ(i, xx, yy, zz);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
    };
    return { mesh, shape };
  };
  const a = make(za, 1), c = make(zb, -1);
  const anim = new Toggle(1.6, (k) => { a.shape(k); c.shape(k); }, 1);
  b.updaters.push((dt) => anim.update(dt));
  const it: Interactable = {
    label: () => (anim.on ? 'Fermer les voilages' : 'Ouvrir les voilages'),
    action: () => { anim.toggle(); ctx.sound.slide(); },
  };
  makeInteractable(a.mesh, it);
  makeInteractable(c.mesh, it);
}

/* ================================================================== */
/* Kitchenette anthracite, crédence marbre noir (photos 2, 3, 4)      */
/* ================================================================== */

function buildKitchen(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(root, 0, 0, 0, 0, 'kitchenette');
  const m = b.m;
  const x0 = KITCHEN.x0, x1 = KITCHEN.x1, zb = KITCHEN.z1;
  const front = 4.5;
  // Meuble bas évier
  // Disposition photo 4 : réfrigérateur + micro-ondes à droite (ouest), évier au centre, plaque à gauche
  const cab0 = x1 - 0.86;
  b.box(0.86, 0.1, 0.55, m.blackMatte, cab0 + 0.43, 0.05, zb - 0.3, g);
  b.box(0.86, 0.76, 0.58, m.anthracite, cab0 + 0.43, 0.48, zb - 0.29, g);
  for (let i = 0; i < 2; i++) {
    const cx = cab0 + 0.215 + i * 0.43;
    b.box(0.424, 0.74, 0.018, m.anthracite, cx, 0.48, front - 0.01, g);
    const hx = cx + (i === 0 ? 0.17 : -0.17);
    b.box(0.012, 0.28, 0.012, m.steel, hx, 0.66, front - 0.035, g);
    b.box(0.012, 0.012, 0.03, m.steel, hx, 0.53, front - 0.025, g);
    b.box(0.012, 0.012, 0.03, m.steel, hx, 0.79, front - 0.025, g);
  }
  // Plan de travail et crédence en marbre noir
  b.box(x1 - x0, 0.04, zb - front + 0.03, m.marbleBlack, (x0 + x1) / 2, 0.88, (front - 0.03 + zb) / 2, g);
  b.box(x1 - x0, 0.6, 0.015, m.marbleBlack, (x0 + x1) / 2, 1.2, zb - 0.0075, g);
  // Évier noir encastré + robinet noir
  b.box(0.4, 0.005, 0.34, m.blackMatte, 2.02, 0.901, 4.78, g);
  b.box(0.36, 0.004, 0.3, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3 }), 2.02, 0.904, 4.78, g);
  b.cyl(0.018, 0.022, 0.32, m.blackMatte, 2.02, 1.06, 5.02, g, 16);
  const spout = b.cyl(0.013, 0.013, 0.18, m.blackMatte, 2.02, 1.21, 4.94, g, 12);
  spout.rotation.x = Math.PI / 2;
  // Plaque de cuisson simple
  b.rbox(0.29, 0.035, 0.36, 0.01, m.blackMetal, 2.33, 0.917, 4.76, g);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.085, 32), new THREE.MeshBasicMaterial({ color: 0x555555 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(2.33, 0.936, 4.76);
  g.add(ring);
  // Bouilloire
  b.cyl(0.065, 0.075, 0.2, m.steel, 1.72, 1.0, 4.98, g, 20);
  b.cyl(0.03, 0.03, 0.03, m.blackMatte, 1.72, 1.115, 4.98, g, 12);
  // Réfrigérateur top sous plan (porte ouvrable)
  buildFridge(ctx, g);
  // Micro-ondes noir
  buildMicrowave(ctx, g);
  // Machine à café capsules
  const cm = b.group(g, 1.45, 1.165, 4.98, 0.4);
  b.rbox(0.16, 0.28, 0.22, 0.06, m.blackMatte, 0, 0.14, 0, cm);
  b.cyl(0.07, 0.07, 0.03, m.anthracite, 0, 0.29, 0, cm, 20);
  b.box(0.1, 0.012, 0.08, m.steel, 0, 0.06, 0.1, cm);
  makeInteractable(cm, {
    label: () => 'Préparer un café',
    action: () => { ctx.sound.beep(); ctx.notify('☕ Café serré en préparation… bonne dégustation !'); },
  });
  // Meubles hauts
  b.box(x1 - x0, 0.7, 0.34, m.anthracite, (x0 + x1) / 2, 1.85, zb - 0.17, g);
  const dw = (x1 - x0) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = x0 + dw / 2 + i * dw;
    b.box(dw - 0.006, 0.69, 0.018, m.anthracite, cx, 1.85, zb - 0.349, g);
    const hx = cx + (i === 2 ? -dw / 2 + 0.06 : dw / 2 - 0.06);
    b.box(0.012, 0.26, 0.012, m.steel, hx, 1.66, zb - 0.375, g);
  }
  // Réglette LED sous les meubles hauts + spots du faux plafond
  const under = ledMaterial(0xfff0d8, 5);
  b.strip(x1 - x0 - 0.1, 0.008, 0.02, (x0 + x1) / 2, 1.495, zb - 0.28, g, under);
  const spotMat = ledMaterial(0xfff4e6, 6);
  for (const sx of [1.5, 2.15]) b.cyl(0.035, 0.035, 0.01, spotMat, sx, 2.396, 4.55, g, 16).castShadow = false;
  const grp = new LightGroup('Éclairage cuisine', false).addEmissive(under).addEmissive(spotMat);
  const pl = new THREE.PointLight(0xfff0dc, 2.2, 4, 2);
  pl.position.set(1.8, 2.3, 4.15);
  const pl2 = new THREE.PointLight(0xfff0dc, 0.9, 1.6, 2);
  pl2.position.set(1.8, 1.4, 4.85);
  g.add(pl, pl2);
  grp.addLight(pl).addLight(pl2);
  ctx.lights.kitchen = grp;
  b.col.addBox(x0, x1, 0, 0.92, front - 0.04, zb, 'cuisine');
}

function buildFridge(ctx: Ctx, parent: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const cx = KITCHEN.x0 + 0.255, w = 0.49, h = 0.84, d = 0.55, z1 = KITCHEN.z1, z0 = z1 - d;
  const t = 0.025;
  const g = b.group(parent, 0, 0, 0, 0, 'réfrigérateur');
  b.box(t, h, d, m.whitePlastic, cx - w / 2 + t / 2, h / 2, (z0 + z1) / 2, g);
  b.box(t, h, d, m.whitePlastic, cx + w / 2 - t / 2, h / 2, (z0 + z1) / 2, g);
  b.box(w, t, d, m.whitePlastic, cx, h - t / 2, (z0 + z1) / 2, g);
  b.box(w, 0.06, d, m.whitePlastic, cx, 0.03, (z0 + z1) / 2, g);
  b.box(w, h, t, m.whitePlastic, cx, h / 2, z1 - t / 2, g);
  const inner = new THREE.MeshStandardMaterial({ color: 0xf6f8fa, roughness: 0.4, emissive: 0xdde8ff, emissiveIntensity: 0 });
  b.box(w - 0.06, 0.008, d - 0.06, m.glass, cx, 0.4, z0 + d / 2 + 0.02, g).castShadow = false;
  b.box(w - 2 * t, h - 0.09, 0.005, inner, cx, h / 2, z1 - t - 0.003, g);
  // quelques produits
  const r = rng(12);
  const cols = [0xd23b2b, 0xf2e6c4, 0x3b7a3a, 0xffffff];
  for (let i = 0; i < 4; i++) {
    b.cyl(0.03, 0.03, 0.18 + r() * 0.05, new THREE.MeshStandardMaterial({ color: cols[i], roughness: 0.3 }), cx - 0.15 + i * 0.1, 0.17, z0 + 0.3, g, 12);
  }
  b.box(0.18, 0.1, 0.12, new THREE.MeshStandardMaterial({ color: 0xf0d36b, roughness: 0.6 }), cx, 0.46, z0 + 0.25, g);
  // Porte (charnière côté mur, à l'ouest)
  const pivot = b.group(g, cx - w / 2, 0.06, z0 - 0.005);
  b.box(w, h - 0.07, 0.04, m.whitePlastic, w / 2, (h - 0.07) / 2, -0.02, pivot);
  b.box(0.1, 0.12, 0.002, new THREE.MeshStandardMaterial({ color: 0x2f74b5, roughness: 0.5 }), 0.15, 0.6, -0.041, pivot);
  b.box(0.012, 0.25, 0.015, m.steel, w - 0.04, 0.45, -0.05, pivot);
  const light = new THREE.PointLight(0xe8f0ff, 0.6, 1.2, 2);
  light.position.set(cx, h - 0.1, z0 + 0.2);
  g.add(light);
  const lightBase = light.intensity;
  light.intensity = 0;
  const col = b.col.addBox(0, 0, 0, 0, 0, 0, 'porte frigo');
  const anim = new Toggle(0.7, (k) => {
    pivot.rotation.y = k * Math.PI * 0.55;
    updateCollider(col, pivot);
    col.box.max.y = Math.min(col.box.max.y, 0.85);
    inner.emissiveIntensity = k * 0.8;
    light.intensity = k * lightBase;
  });
  updateCollider(col, pivot);
  b.updaters.push((dt) => anim.update(dt));
  makeInteractable(g, {
    label: () => (anim.on ? 'Fermer le réfrigérateur' : 'Ouvrir le réfrigérateur'),
    action: () => { anim.toggle(); ctx.sound.door(); },
  });
}

function buildMicrowave(ctx: Ctx, parent: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const g = b.group(parent, 1.39, 0.9, 4.93, 0, 'micro-ondes');
  b.rbox(0.45, 0.26, 0.34, 0.012, m.blackMatte, 0, 0.13, 0, g);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.05, metalness: 0.3, emissive: 0xffb040, emissiveIntensity: 0 });
  b.box(0.3, 0.18, 0.005, glass, -0.06, 0.13, -0.171, g);
  b.box(0.1, 0.22, 0.004, m.blackMetal, 0.17, 0.13, -0.171, g);
  const disp = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x6effa0, emissiveIntensity: 0.6 });
  b.box(0.05, 0.015, 0.003, disp, 0.17, 0.2, -0.174, g);
  let timer = 0;
  b.updaters.push((dt) => {
    if (timer > 0) {
      timer -= dt;
      glass.emissiveIntensity = 0.5 + Math.sin(timer * 8) * 0.05;
      if (timer <= 0) { glass.emissiveIntensity = 0; ctx.sound.beep(); ctx.notify('Micro-ondes : ding ! C\'est chaud.'); }
    }
  });
  makeInteractable(g, {
    label: () => (timer > 0 ? 'Arrêter le micro-ondes' : 'Lancer le micro-ondes (5 s)'),
    action: () => {
      ctx.sound.beep();
      if (timer > 0) { timer = 0; glass.emissiveIntensity = 0; } else timer = 5;
    },
  });
}

/* ================================================================== */
/* Salle de bain marbre blanc (photo 5)                               */
/* ================================================================== */

function buildBathroom(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const g = b.group(root, 0, 0, 0, 0, 'salle de bain');
  const ex = BATH.x1;
  // Meuble vasque suspendu + vasque céramique
  b.box(0.42, 0.36, 0.5, m.anthracite, ex - 0.21, 0.62, 5.0, g);
  b.box(0.008, 0.3, 0.46, m.anthracite, ex - 0.425, 0.62, 5.0, g);
  b.box(0.012, 0.012, 0.08, m.chrome, ex - 0.44, 0.74, 4.82, g);
  // Vasque en céramique (profil de révolution : cuvette, rebord, paroi extérieure)
  const profile = [
    [0, -0.1], [0.12, -0.095], [0.18, -0.055], [0.2, -0.005], [0.215, 0.006], [0.232, 0.004],
    [0.235, -0.01], [0.22, -0.08], [0.15, -0.14], [0, -0.145],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), Object.assign(m.ceramic.clone(), { side: THREE.DoubleSide }));
  bowl.scale.set(0.95, 1, 1.15);
  bowl.position.set(ex - 0.25, 0.94, 5.0);
  bowl.castShadow = bowl.receiveShadow = true;
  g.add(bowl);
  b.cyl(0.015, 0.02, 0.14, m.chrome, ex - 0.07, 1.01, 5.0, g, 16);
  const sp = b.cyl(0.01, 0.01, 0.12, m.chrome, ex - 0.12, 1.07, 5.0, g, 12);
  sp.rotation.z = Math.PI / 2;
  // Distributeur de savon noir
  b.cyl(0.03, 0.032, 0.14, m.blackMatte, ex - 0.1, 1.02, 4.8, g, 16);
  // Miroir festonné rétroéclairé (12 lobes)
  const mirrorShape = (R: number) => {
    const s = new THREE.Shape();
    const n = 240;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = R * (1 + 0.055 * Math.cos(a * 12));
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
    }
    return s;
  };
  const my = 1.62, mz = 5.0;
  const ledMat = ledMaterial(0xf2f6ff, 7);
  const glow = new THREE.Mesh(new THREE.ShapeGeometry(mirrorShape(0.4)), ledMat);
  glow.rotation.y = -Math.PI / 2;
  glow.position.set(ex - 0.004, my, mz);
  glow.userData.noRaycast = true;
  g.add(glow);
  const mirrorGeo = new THREE.ShapeGeometry(mirrorShape(0.36));
  let mirror: THREE.Mesh;
  if (ctx.quality === 'haute') {
    const rf = new Reflector(mirrorGeo, { textureWidth: 768, textureHeight: 768, color: 0xc8ccd0, clipBias: 0.003 });
    mirror = rf;
  } else {
    mirror = new THREE.Mesh(mirrorGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }));
  }
  mirror.rotation.y = -Math.PI / 2;
  mirror.position.set(ex - 0.03, my, mz);
  g.add(mirror);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 48), m.blackMatte);
  back.rotation.z = Math.PI / 2;
  back.position.set(ex - 0.015, my, mz);
  g.add(back);
  // WC
  const wc = b.group(g, 4.3, 0, BATH.z1, Math.PI, 'wc');
  b.rbox(0.38, 0.4, 0.17, 0.03, m.ceramic, 0, 0.62, 0.1, wc);
  b.box(0.1, 0.02, 0.05, m.chrome, 0, 0.83, 0.1, wc);
  b.cyl(0.13, 0.15, 0.36, m.ceramic, 0, 0.18, 0.4, wc, 24);
  const bowlWC = b.cyl(0.19, 0.15, 0.06, m.ceramic, 0, 0.39, 0.42, wc, 32);
  bowlWC.scale.set(1, 1, 1.25);
  const seat = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 32), m.ceramic);
  seat.rotation.x = Math.PI / 2;
  seat.scale.set(1, 1.25, 1);
  seat.position.set(0, 0.43, 0.42);
  wc.add(seat);
  const lid = b.rbox(0.36, 0.43, 0.025, 0.01, m.ceramic, 0, 0.62, 0.21, wc);
  lid.rotation.x = -0.12;
  b.col.addObject(wc, 'wc');
  makeInteractable(wc, {
    label: () => 'Tirer la chasse',
    action: () => { ctx.sound.door(); ctx.notify('Chasse d\'eau tirée.'); },
  });
  // Petite poubelle
  b.cyl(0.11, 0.1, 0.27, m.anthracite, 4.75, 0.135, 6.35, g, 20);
  // Tapis noir
  b.box(0.75, 0.012, 0.45, m.mat, 3.4, 0.018, 5.2, g).castShadow = false;
  buildShower(ctx, g);
  // Éclairage
  const spots = ledMaterial(0xf4f8ff, 6);
  for (const [sx, sz] of [[3.4, 5.1], [4.3, 5.6], [3.3, 6.1]]) b.cyl(0.04, 0.04, 0.01, spots, sx, H - 0.004, sz, g, 16).castShadow = false;
  const grp = new LightGroup('Salle de bain', false).addEmissive(spots).addEmissive(ledMat);
  const l = new THREE.PointLight(0xf6f8ff, 4.2, 5, 2);
  l.position.set(3.75, 2.4, 5.55);
  const lm = new THREE.PointLight(0xf6f8ff, 0.8, 1.6, 2);
  lm.position.set(ex - 0.4, my, mz);
  g.add(l, lm);
  grp.addLight(l).addLight(lm);
  ctx.lights.bath = grp;
  b.col.addBox(ex - 0.45, ex, 0.4, 1.0, 4.7, 5.3, 'vasque');
}

function buildShower(ctx: Ctx, g: THREE.Object3D) {
  const { b } = ctx;
  const m = b.m;
  const x0 = BATH.x0, x1 = 3.95, z0 = 5.56, z1 = BATH.z1, hh = 1.98;
  b.slab(x0, x1, 0.012, 0.04, z0, z1, m.ceramic, g, { name: 'receveur' });
  // Paroi fixe avant + paroi latérale
  const glassPanel = (w: number, x: number, z: number, ry: number) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, hh - 0.06), m.glassShower);
    p.position.set(x, 0.04 + (hh - 0.06) / 2, z);
    p.rotation.y = ry;
    g.add(p);
    return p;
  };
  glassPanel(0.68, x0 + 0.34, z0, 0);
  glassPanel(z1 - z0, x1, (z0 + z1) / 2, Math.PI / 2);
  b.box(x1 - x0, 0.025, 0.025, m.blackMetal, (x0 + x1) / 2, hh, z0, g);
  b.box(0.025, 0.025, z1 - z0, m.blackMetal, x1, hh, (z0 + z1) / 2, g);
  b.box(0.025, hh, 0.025, m.blackMetal, x1, hh / 2, z0, g);
  b.box(0.02, hh, 0.02, m.blackMetal, x0 + 0.68, hh / 2, z0, g);
  b.col.addBox(x0, x0 + 0.7, 0, hh, z0 - 0.02, z0 + 0.02, 'paroi douche');
  b.col.addBox(x1 - 0.02, x1 + 0.02, 0, hh, z0, z1, 'paroi douche');
  // Porte coulissante
  const door = b.group(g, x0 + 0.66, 0, z0 + 0.04, 0, 'porte douche');
  const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.66, hh - 0.08), m.glassShower);
  dp.position.set(0.33, 0.04 + (hh - 0.08) / 2, 0);
  door.add(dp);
  b.box(0.02, hh - 0.08, 0.02, m.blackMetal, 0.65, 0.04 + (hh - 0.08) / 2, 0, door);
  b.cyl(0.025, 0.025, 0.02, m.blackMetal, 0.55, 1.05, 0.015, door, 16).rotation.x = Math.PI / 2;
  const dcol = b.col.addBox(0, 0, 0, 0, 0, 0, 'porte douche');
  const anim = new Toggle(0.9, (k) => { door.position.x = x0 + 0.66 - k * 0.58; updateCollider(dcol, door); });
  updateCollider(dcol, door);
  b.updaters.push((dt) => anim.update(dt));
  makeInteractable(door, {
    label: () => (anim.on ? 'Fermer la porte de douche' : 'Ouvrir la porte de douche'),
    action: () => { anim.toggle(); ctx.sound.slide(); },
  });
  // Colonne de douche noire : pommeau carré + douchette
  const sx = 3.35, sz = z1 - 0.03;
  b.box(0.022, 1.15, 0.022, m.blackMatte, sx, 1.45, sz, g);
  b.box(0.022, 0.022, 0.3, m.blackMatte, sx, 2.02, sz - 0.15, g);
  b.box(0.25, 0.012, 0.25, m.blackMatte, sx, 2.0, sz - 0.3, g);
  b.box(0.14, 0.06, 0.05, m.blackMatte, sx, 1.1, sz - 0.02, g);
  b.cyl(0.02, 0.025, 0.22, m.blackMatte, sx + 0.1, 1.25, sz - 0.04, g, 12);
  // Flacons
  const bottles = [0x1a4f9c, 0x2a8bd0, 0xdcdcdc, 0x0f3a2c];
  bottles.forEach((c, i) => b.cyl(0.03, 0.03, 0.2 + (i % 2) * 0.04, new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 }), x1 - 0.12 - i * 0.07, 0.15, z1 - 0.06, g, 12));
  // Eau de la douche (particules)
  const N = 260;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const drops = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.55 }));
  drops.visible = false;
  drops.frustumCulled = false;
  drops.userData.noRaycast = true;
  g.add(drops);
  const seeds = Array.from({ length: N }, () => [Math.random(), Math.random(), Math.random()]);
  let on = false;
  b.updaters.push((_dt, time) => {
    if (!on) return;
    for (let i = 0; i < N; i++) {
      const [a, r2, ph] = seeds[i];
      const t = (time * 1.6 + ph) % 1;
      const ang = a * Math.PI * 2, rad = Math.sqrt(r2) * 0.12;
      const x = sx + Math.cos(ang) * rad * (1 + t * 0.6), z = sz - 0.3 + Math.sin(ang) * rad * (1 + t * 0.6);
      const y = 1.98 - t * t * 1.94;
      pos.set([x, y, z, x, y - 0.07, z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  });
  const head = b.group(g, 0, 0, 0);
  b.box(0.3, 0.4, 0.3, new THREE.MeshBasicMaterial({ visible: false }), sx, 1.6, sz - 0.2, head);
  makeInteractable(head, {
    label: () => (on ? 'Couper la douche' : "Ouvrir l'eau de la douche"),
    action: () => { on = !on; drops.visible = on; ctx.sound.slide(); },
  });
}

/* ================================================================== */
/* Entrée                                                             */
/* ================================================================== */

function buildHall(ctx: Ctx, root: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(root, 0, 0, 0, 0, 'entrée');
  // Porte-manteau et étagère à chaussures
  b.box(0.02, 0.06, 0.6, b.m.oakDoor, 0.01, 1.7, 5.5, g);
  for (let i = 0; i < 4; i++) b.cyl(0.008, 0.008, 0.06, b.m.blackMetal, 0.04, 1.68, 5.27 + i * 0.15, g, 8).rotation.z = Math.PI / 2;
  b.box(0.3, 0.4, 0.7, b.m.oakLight, 0.15, 0.2, 5.6, g);
  b.col.addBox(0, 0.32, 0, 0.42, 5.25, 5.95, 'meuble entrée');
  // Paillasson
  b.box(0.7, 0.012, 0.45, b.m.mat, 0.52, 0.006, HALL.z1 - 0.3, g).castShadow = false;
}

/* ================================================================== */
/* Interrupteurs muraux                                               */
/* ================================================================== */

function switchPlate(ctx: Ctx, root: THREE.Object3D, x: number, y: number, z: number, ry: number, group: LightGroup, label: string) {
  const { b } = ctx;
  const g = b.group(root, x, y, z, ry, 'interrupteur');
  b.box(0.085, 0.085, 0.01, b.m.whitePlastic, 0, 0, 0.005, g);
  const rocker = b.box(0.055, 0.055, 0.008, b.m.whitePlastic, 0, 0, 0.012, g);
  const dot = ledMaterial(0x7fd4ff, 1.5);
  b.strip(0.006, 0.006, 0.002, 0, -0.018, 0.017, g, dot);
  const sync = () => { rocker.rotation.x = group.on ? -0.12 : 0.12; dot.emissiveIntensity = group.on ? 0 : 1.5; };
  sync();
  makeInteractable(g, {
    label: () => `${group.on ? 'Éteindre' : 'Allumer'} : ${label}`,
    action: () => { group.toggle(); sync(); ctx.sound.click(); ctx.dirtyEnv(); },
    range: 2.6,
  });
  const prev = group.onChange;
  group.onChange = (on) => { prev?.(on); sync(); };
  return g;
}

function buildSwitches(ctx: Ctx, root: THREE.Object3D) {
  const L = ctx.lights;
  switchPlate(ctx, root, 0.001, 1.1, 4.08, Math.PI / 2, L.ceiling, 'plafonnier');
  switchPlate(ctx, root, 0.001, 1.1, 4.2, Math.PI / 2, L.led, 'rubans LED du plafond');
  switchPlate(ctx, root, 0.62, 0.86, 0.031, 0, L.headboard, 'LED de la tête de lit');
  switchPlate(ctx, root, 2.78, 0.86, 0.031, 0, L.headboard, 'LED de la tête de lit');
  switchPlate(ctx, root, 1.06, 1.2, HALL.z0 - 0.001, Math.PI, L.kitchen, 'éclairage de la cuisine');
  switchPlate(ctx, root, 3.535, 1.1, 4.399, Math.PI, L.bath, 'salle de bain');
}
