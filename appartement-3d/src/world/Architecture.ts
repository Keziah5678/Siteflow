import * as THREE from 'three';
import { Ctx, H, T, ROOM, SLIDER, KITCHEN, HALL, BATH, BATH_DOOR, GARDEN } from './layout';
import { ledMaterial } from './Builder';
import { LightGroup } from './LightGroup';
import { makeInteractable, Toggle } from '../interaction/Interactions';
import { BoxCollider } from '../physics/Colliders';

const EXT_TOP = 3.05; // hauteur du bâti vu de l'extérieur

/** Ordre des faces d'une BoxGeometry : +x, -x, +y, -y, +z, -z. */
function faces(px: THREE.Material, nx: THREE.Material, py: THREE.Material, ny: THREE.Material, pz: THREE.Material, nz: THREE.Material) {
  return [px, nx, py, ny, pz, nz];
}

export function buildArchitecture(ctx: Ctx) {
  const { b, root } = ctx;
  const m = b.m;
  const arch = b.group(root, 0, 0, 0, 0, 'architecture');

  /* ---------------------------- Sols ---------------------------- */
  b.slab(ROOM.x0, ROOM.x1, -0.1, 0, ROOM.z0, ROOM.z1, m.floorWood, arch, { name: 'sol séjour', cast: false });
  b.slab(HALL.x0, HALL.x1 + T, -0.1, 0, HALL.z0, HALL.z1, m.floorWood, arch, { name: 'sol entrée', cast: false });
  b.slab(KITCHEN.x0, KITCHEN.x1, -0.1, 0, KITCHEN.z0, KITCHEN.z1, m.marbleFloor, arch, { cast: false });
  // Estrade en marbre de la kitchenette (petite marche de 2,5 cm, comme sur les photos)
  b.slab(KITCHEN.x0, KITCHEN.x1, 0, 0.025, 3.85, KITCHEN.z1, m.marbleFloor, arch, { name: 'estrade cuisine', cast: false });
  b.slab(BATH_DOOR.x0, BATH_DOOR.x1, -0.1, 0.012, 4.4, BATH.z0, m.marbleFloor, arch, { cast: false });
  b.slab(BATH.x0, BATH.x1, -0.1, 0.012, BATH.z0, BATH.z1, m.marbleFloor, arch, { name: 'sol sdb', cast: false });
  // Seuil de la baie vitrée
  b.slab(ROOM.x1, ROOM.x1 + T, -0.1, 0.018, SLIDER.z0, SLIDER.z1, m.blackMetal, arch, { cast: false });

  /* ---------------------------- Murs ---------------------------- */
  const paint = m.wall, ext = m.plaster, marble = m.marbleWall;
  // Mur nord (tête de lit)
  b.slab(-T, ROOM.x1, 0, H, -T, 0, paint, arch, { name: 'mur nord' });
  // Mur ouest (séjour + entrée)
  b.slab(-T, 0, 0, H, -T, HALL.z1 + T, paint, arch, { name: 'mur ouest' });
  // Mur est (façade jardin) avec la baie vitrée
  const eastMat = faces(ext, paint, ext, paint, ext, ext);
  b.slab(ROOM.x1, ROOM.x1 + T, 0, EXT_TOP, GARDEN.z0 - 0.2, SLIDER.z0, eastMat, arch, { name: 'façade' });
  b.slab(ROOM.x1, ROOM.x1 + T, 0, EXT_TOP, SLIDER.z1, ROOM.z1 + T, eastMat, arch, { name: 'façade' });
  b.slab(ROOM.x1, ROOM.x1 + T, SLIDER.h, EXT_TOP, SLIDER.z0, SLIDER.z1, eastMat, arch, { name: 'linteau baie' });
  // Mur nord de la salle de bain (séjour côté nord, marbre côté sdb)
  const bathN = faces(paint, paint, paint, paint, marble, paint);
  const bathNExt = faces(ext, ext, ext, ext, marble, ext);
  b.slab(KITCHEN.x1, BATH_DOOR.x0, 0, H, 4.4, BATH.z0, bathN, arch);
  b.slab(BATH_DOOR.x1, ROOM.x1 + T, 0, H, 4.4, BATH.z0, bathN, arch);
  b.slab(BATH_DOOR.x0, BATH_DOOR.x1, BATH_DOOR.h, H, 4.4, BATH.z0, bathN, arch);
  b.slab(ROOM.x1 + T, BATH.x1 + T, 0, EXT_TOP, 4.4, BATH.z0, bathNExt, arch);
  // Autres murs de la salle de bain
  b.slab(KITCHEN.x1, BATH.x0, 0, H, BATH.z0, BATH.z1 + T, faces(marble, paint, paint, paint, paint, paint), arch);
  b.slab(BATH.x1, BATH.x1 + T, 0, EXT_TOP, 4.4, BATH.z1 + T, faces(ext, marble, ext, ext, ext, ext), arch);
  b.slab(KITCHEN.x1, BATH.x1, 0, H, BATH.z1, BATH.z1 + T, faces(paint, paint, paint, paint, paint, marble), arch);
  // Fond de la kitchenette
  b.slab(KITCHEN.x0, KITCHEN.x1, 0, H, KITCHEN.z1, KITCHEN.z1 + T, paint, arch);
  // Cloison entrée / cuisine
  b.slab(HALL.x1, HALL.x1 + T, 0, H, HALL.z0, HALL.z1, paint, arch, { name: 'cloison entrée' });
  // Volume technique derrière la cuisine (placard non visible)
  b.slab(HALL.x1 + T, KITCHEN.x1, 0, H, KITCHEN.z1 + T, BATH.z1 + T, paint, arch);
  // Mur de la porte d'entrée
  b.slab(-T, 0.1, 0, H, HALL.z1, HALL.z1 + T, paint, arch);
  b.slab(0.95, HALL.x1 + T, 0, H, HALL.z1, HALL.z1 + T, paint, arch);
  b.slab(0.1, 0.95, 2.1, H, HALL.z1, HALL.z1 + T, paint, arch);

  /* ------------------------- Plafonds -------------------------- */
  const roof = faces(ext, ext, ext, m.ceiling, ext, ext);
  b.slab(-T, ROOM.x1 + T, H, EXT_TOP, -T, BATH.z1 + T, roof, arch, { collide: false, name: 'plafond' });
  b.slab(ROOM.x1 + T, BATH.x1 + T, H, EXT_TOP, 4.4, BATH.z1 + T, roof, arch, { collide: false, name: 'plafond sdb' });
  // Plafond à caisson du séjour avec gorge lumineuse (photos 1 et 2)
  const band = 0.4, by = 2.5;
  const ceil = m.ceiling;
  b.slab(ROOM.x0, ROOM.x1, by, H, ROOM.z0, ROOM.z0 + band, ceil, arch, { collide: false });
  b.slab(ROOM.x0, ROOM.x1, by, H, ROOM.z1 - band, ROOM.z1, ceil, arch, { collide: false });
  b.slab(ROOM.x0, ROOM.x0 + band, by, H, ROOM.z0 + band, ROOM.z1 - band, ceil, arch, { collide: false });
  b.slab(ROOM.x1 - band, ROOM.x1, by, H, ROOM.z0 + band, ROOM.z1 - band, ceil, arch, { collide: false });
  // Rubans LED de la gorge
  const cove = ledMaterial(0xffc58a, 6);
  const ix0 = ROOM.x0 + band, ix1 = ROOM.x1 - band, iz0 = ROOM.z0 + band, iz1 = ROOM.z1 - band;
  const ly = H - 0.035;
  b.strip(ix1 - ix0, 0.02, 0.012, (ix0 + ix1) / 2, ly, iz0 + 0.01, arch, cove);
  b.strip(ix1 - ix0, 0.02, 0.012, (ix0 + ix1) / 2, ly, iz1 - 0.01, arch, cove);
  b.strip(0.012, 0.02, iz1 - iz0, ix0 + 0.01, ly, (iz0 + iz1) / 2, arch, cove);
  b.strip(0.012, 0.02, iz1 - iz0, ix1 - 0.01, ly, (iz0 + iz1) / 2, arch, cove);
  // Halo doux projeté sur le plafond par la gorge
  const halo = new THREE.MeshBasicMaterial({ color: 0xffa95c, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, map: haloTexture() });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(ix1 - ix0, iz1 - iz0), halo);
  haloMesh.rotation.x = Math.PI / 2;
  haloMesh.position.set((ix0 + ix1) / 2, H - 0.002, (iz0 + iz1) / 2);
  haloMesh.userData.noRaycast = true;
  arch.add(haloMesh);
  const led = new LightGroup('Rubans LED du plafond', true).addEmissive(cove);
  ctx.lights.led = led;
  const haloBase = halo.opacity;
  const ledLights = [
    new THREE.PointLight(0xffc888, 0.45, 4.5, 1.5),
    new THREE.PointLight(0xffc888, 0.45, 4.5, 1.5),
  ];
  ledLights[0].position.set(1.8, 2.0, 1.1);
  ledLights[1].position.set(1.8, 2.0, 3.3);
  ledLights.forEach((l) => { arch.add(l); led.addLight(l); });
  b.updaters.push(() => { halo.opacity = haloBase * led.level; });

  // Faux plafond de la kitchenette
  b.slab(KITCHEN.x0, KITCHEN.x1, 2.4, H, 4.2, KITCHEN.z1, ceil, arch, { collide: false });

  /* ------------------------- Plinthes -------------------------- */
  const bb = m.baseboard, bh = 0.07, bd = 0.012;
  const plinth = (x0: number, x1: number, z0: number, z1: number) => b.slab(x0, x1, 0, bh, z0, z1, bb, arch, { collide: false, cast: false });
  plinth(0, 0.55, 0, bd); plinth(2.85, ROOM.x1, 0, bd);
  plinth(0, bd, 0, 2.55); plinth(0, bd, 3.95, HALL.z1);
  plinth(ROOM.x1 - bd, ROOM.x1, 0, SLIDER.z0); plinth(ROOM.x1 - bd, ROOM.x1, SLIDER.z1, ROOM.z1);
  plinth(BATH_DOOR.x1, ROOM.x1, ROOM.z1 - bd, ROOM.z1); plinth(KITCHEN.x1, BATH_DOOR.x0, ROOM.z1 - bd, ROOM.z1);
  plinth(HALL.x1 - bd, HALL.x1, HALL.z0, HALL.z1);

  buildBathDoor(ctx, arch);
  buildFrontDoor(ctx, arch);
  buildSlidingDoor(ctx, arch);
}

function haloTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = Math.min(x, 127 - x) / 127, dy = Math.min(y, 127 - y) / 127;
      const d = Math.min(dx, dy);
      const v = Math.exp(-d * 14) * 255;
      const o = (y * 128 + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Huisserie (chambranle) d'une porte : trois tasseaux autour de l'ouverture. */
function casing(ctx: Ctx, parent: THREE.Object3D, x0: number, x1: number, h: number, zFace: number, dir: number, axis: 'x' | 'z' = 'x') {
  const { b } = ctx;
  const w = 0.06, d = 0.015;
  const mat = b.m.oakDoor;
  if (axis === 'x') {
    const z = zFace + (dir * d) / 2;
    b.box(w, h + w, d, mat, x0 - w / 2, (h + w) / 2, z, parent);
    b.box(w, h + w, d, mat, x1 + w / 2, (h + w) / 2, z, parent);
    b.box(x1 - x0 + 2 * w, w, d, mat, (x0 + x1) / 2, h + w / 2, z, parent);
  }
}

function lever(ctx: Ctx, parent: THREE.Object3D, x: number, y: number, z: number, side: number) {
  const { b } = ctx;
  const g = b.group(parent, x, y, z);
  b.box(0.05, 0.05, 0.012, b.m.blackMetal, 0, 0, side * 0.006, g);
  b.box(0.13, 0.018, 0.018, b.m.blackMetal, -0.05, 0, side * 0.04, g);
  b.box(0.018, 0.018, 0.04, b.m.blackMetal, 0, 0, side * 0.025, g);
  return g;
}

/** Porte battante de la salle de bain (chêne clair, poignée noire). */
function buildBathDoor(ctx: Ctx, parent: THREE.Object3D) {
  const { b } = ctx;
  const w = BATH_DOOR.x1 - BATH_DOOR.x0 - 0.01, h = BATH_DOOR.h - 0.01, th = 0.04;
  casing(ctx, parent, BATH_DOOR.x0, BATH_DOOR.x1, BATH_DOOR.h, 4.4, -1);
  casing(ctx, parent, BATH_DOOR.x0, BATH_DOOR.x1, BATH_DOOR.h, BATH.z0, 1);
  const pivot = b.group(parent, BATH_DOOR.x0 + 0.005, 0, 4.46, 0, 'porte sdb');
  b.box(w, h, th, b.m.oakDoor, w / 2, h / 2 + 0.005, 0, pivot);
  lever(ctx, pivot, w - 0.07, 1.0, -th / 2, -1);
  lever(ctx, pivot, w - 0.07, 1.0, th / 2, 1);
  const collider = ctx.b.col.addBox(0, 0, 0, 0, 0, 0, 'porte sdb');
  const sync = () => updateCollider(collider, pivot);
  const anim = new Toggle(0.9, (k) => { pivot.rotation.y = -k * Math.PI * 0.52; sync(); });
  sync();
  b.updaters.push((dt) => anim.update(dt));
  makeInteractable(pivot, {
    label: () => (anim.on ? 'Fermer la porte de la salle de bain' : 'Ouvrir la porte de la salle de bain'),
    action: () => { anim.toggle(); ctx.sound.door(); },
  });
}

/** Porte palière (verrouillée : l'extérieur de l'immeuble n'est pas modélisé). */
function buildFrontDoor(ctx: Ctx, parent: THREE.Object3D) {
  const { b } = ctx;
  const z = HALL.z1 + 0.05;
  casing(ctx, parent, 0.1, 0.95, 2.1, HALL.z1, -1);
  const door = b.group(parent, 0, 0, 0, 0, "porte d'entrée");
  b.box(0.84, 2.09, 0.05, b.m.oakDoor, 0.525, 1.045, z, door);
  b.box(0.7, 0.012, 0.01, b.m.blackMatte, 0.525, 1.6, z - 0.03, door);
  b.box(0.7, 0.012, 0.01, b.m.blackMatte, 0.525, 0.5, z - 0.03, door);
  lever(ctx, door, 0.88, 1.02, z - 0.025, -1);
  b.cyl(0.012, 0.012, 0.02, b.m.chrome, 0.525, 1.55, z - 0.03, door, 12).rotation.x = Math.PI / 2;
  b.col.addBox(0.1, 0.95, 0, 2.1, HALL.z1, HALL.z1 + T, "porte d'entrée");
  makeInteractable(door, {
    label: () => "Porte d'entrée",
    action: () => { ctx.sound.click(); ctx.notify("La porte d'entrée est verrouillée — la visite se poursuit dans l'appartement et le jardin."); },
  });
}

/** Baie vitrée coulissante à galandage, menuiserie aluminium noir (photos 1 et 3). */
function buildSlidingDoor(ctx: Ctx, parent: THREE.Object3D) {
  const { b } = ctx;
  const g = b.group(parent, 0, 0, 0, 0, 'baie vitrée');
  const x = ROOM.x1, f = 0.05;
  const len = SLIDER.z1 - SLIDER.z0;
  // Dormant
  b.slab(x, x + T, SLIDER.h - f, SLIDER.h, SLIDER.z0, SLIDER.z1, b.m.blackMetal, g, { collide: false });
  b.slab(x, x + T, 0, SLIDER.h, SLIDER.z0, SLIDER.z0 + f, b.m.blackMetal, g, { collide: false });
  b.slab(x, x + T, 0, SLIDER.h, SLIDER.z1 - f, SLIDER.z1, b.m.blackMetal, g, { collide: false });
  const panelW = len / 2 + 0.03, ph = SLIDER.h - f - 0.02;
  const makePanel = (px: number, z0: number) => {
    const p = b.group(g, px, 0.02, z0, 0, 'vantail');
    const pf = 0.055;
    b.box(0.04, pf, panelW, b.m.blackMetal, 0, pf / 2, panelW / 2, p);
    b.box(0.04, pf, panelW, b.m.blackMetal, 0, ph - pf / 2, panelW / 2, p);
    b.box(0.04, ph, pf, b.m.blackMetal, 0, ph / 2, pf / 2, p);
    b.box(0.04, ph, pf, b.m.blackMetal, 0, ph / 2, panelW - pf / 2, p);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 2 * pf, ph - 2 * pf), b.m.glass);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(0, ph / 2, panelW / 2);
    glass.castShadow = false;
    p.add(glass);
    return p;
  };
  const fixed = makePanel(x + 0.085, SLIDER.z1 - f - panelW);
  const moving = makePanel(x + 0.035, SLIDER.z0 + f);
  b.box(0.012, 0.012, 0.16, b.m.blackMetal, 0, 1.05, 0.08, moving).position.x = -0.03;
  b.col.addObject(fixed, 'vantail fixe');
  const mc = b.col.addBox(0, 0, 0, 0, 0, 0, 'vantail mobile');
  const z0 = moving.position.z;
  const travel = panelW - 0.09;
  const sync = () => updateCollider(mc, moving);
  const anim = new Toggle(1.1, (k) => { moving.position.z = z0 + k * travel; sync(); });
  sync();
  b.updaters.push((dt) => anim.update(dt));
  const it = {
    label: () => (anim.on ? 'Fermer la baie vitrée' : 'Ouvrir la baie vitrée (accès au jardin)'),
    action: () => { anim.toggle(); ctx.sound.slide(); },
  };
  makeInteractable(moving, it);
  makeInteractable(fixed, it);
  // Coffre de volet roulant côté extérieur
  b.slab(x + T, x + T + 0.2, SLIDER.h, SLIDER.h + 0.3, SLIDER.z0 - 0.1, SLIDER.z1 + 0.1, b.m.anthracite, g, { collide: false });
  // Rails du volet
  b.slab(x + T, x + T + 0.04, 0, SLIDER.h, SLIDER.z0 - 0.06, SLIDER.z0 - 0.02, b.m.anthracite, g, { collide: false });
  b.slab(x + T, x + T + 0.04, 0, SLIDER.h, SLIDER.z1 + 0.02, SLIDER.z1 + 0.06, b.m.anthracite, g, { collide: false });
}

export function updateCollider(c: BoxCollider, o: THREE.Object3D) {
  o.updateWorldMatrix(true, true);
  c.box.setFromObject(o);
  // Les vantaux/portes vont du sol au linteau : on garde un volume vertical complet.
  c.box.min.y = Math.min(c.box.min.y, 0.05);
}
