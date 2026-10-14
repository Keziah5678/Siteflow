import * as THREE from 'three';
import * as T from './textures';
import { nextFrame } from '../core/utils';

/** Bibliothèque de matériaux PBR de l'appartement. */
export interface Materials {
  floorWood: THREE.MeshStandardMaterial;
  wall: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  marbleFloor: THREE.MeshStandardMaterial;
  marbleWall: THREE.MeshStandardMaterial;
  marbleBlack: THREE.MeshStandardMaterial;
  oakLight: THREE.MeshStandardMaterial;
  oakTable: THREE.MeshStandardMaterial;
  oakDoor: THREE.MeshStandardMaterial;
  slats: THREE.MeshStandardMaterial;
  boucle: THREE.MeshStandardMaterial;
  felt: THREE.MeshStandardMaterial;
  sheet: THREE.MeshStandardMaterial;
  pillow: THREE.MeshStandardMaterial;
  towelBlack: THREE.MeshStandardMaterial;
  cushionBeige: THREE.MeshStandardMaterial;
  greyFurniture: THREE.MeshStandardMaterial;
  anthracite: THREE.MeshStandardMaterial;
  blackMatte: THREE.MeshStandardMaterial;
  blackMetal: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  whitePlastic: THREE.MeshStandardMaterial;
  whiteGloss: THREE.MeshPhysicalMaterial;
  ceramic: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
  glassShower: THREE.MeshPhysicalMaterial;
  curtain: THREE.MeshStandardMaterial;
  baseboard: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  ivy: THREE.MeshStandardMaterial;
  rattan: THREE.MeshStandardMaterial;
  awning: THREE.MeshStandardMaterial;
  water: THREE.MeshPhysicalMaterial;
  jacuzziShell: THREE.MeshStandardMaterial;
  jacuzziLiner: THREE.MeshStandardMaterial;
  mat: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  leafBanana: THREE.MeshStandardMaterial;
  leafPalm: THREE.MeshStandardMaterial;
  leafFern: THREE.MeshStandardMaterial;
  trunk: THREE.MeshStandardMaterial;
  wavesLamp: THREE.MeshStandardMaterial;
  screenOff: THREE.MeshStandardMaterial;
  screenOn: THREE.MeshStandardMaterial;
  waterNormal: THREE.Texture;
}

export async function createMaterials(onProgress: (p: number, label: string) => void): Promise<Materials> {
  const steps: Array<[string, () => void]> = [];
  const out: Partial<Materials> = {};
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

  steps.push(['Parquet chêne', () => {
    const t = T.woodFloor();
    out.floorWood = std({ ...t, bumpScale: 1.2, color: 0xffffff, roughness: 1, metalness: 0 });
  }]);
  steps.push(['Peinture et plâtre', () => {
    const p = T.paintWall();
    out.wall = std({ ...p, bumpScale: 0.3, roughness: 0.92 });
    out.ceiling = std({ map: p.map, color: 0xfbfaf8, roughness: 0.95 });
    const pl = T.plaster();
    out.plaster = std({ ...pl, bumpScale: 3, roughness: 1 });
    out.baseboard = std({ color: 0xece8e0, roughness: 0.6 });
  }]);
  steps.push(['Marbre blanc', () => {
    const f = T.marbleWhite(1024, 1.2, true);
    out.marbleFloor = std({ ...f, bumpScale: 0.5, roughness: 1, metalness: 0 });
    const w = T.marbleWhite(1024, 1.2, true);
    w.map.repeat.set(1 / 0.6, 1 / 1.2);
    w.bumpMap!.repeat.copy(w.map.repeat);
    w.roughnessMap!.repeat.copy(w.map.repeat);
    out.marbleWall = std({ ...w, bumpScale: 0.4, roughness: 1 });
  }]);
  steps.push(['Marbre noir', () => {
    const b = T.marbleBlack();
    out.marbleBlack = std({ ...b, roughness: 1, metalness: 0 });
  }]);
  steps.push(['Bois', () => {
    const o = T.oak(61, [206, 180, 146]);
    out.oakLight = std({ ...o, bumpScale: 0.4, roughness: 1 });
    const t = T.oak(62, [186, 146, 104]);
    out.oakTable = std({ ...t, bumpScale: 0.4, roughness: 1 });
    const d = T.oak(63, [204, 186, 160]);
    out.oakDoor = std({ ...d, bumpScale: 0.3, roughness: 1 });
    const s = T.slats();
    out.slats = std({ ...s, bumpScale: 2, roughness: 0.6 });
  }]);
  steps.push(['Textiles', () => {
    const b = T.boucle();
    out.boucle = std({ ...b, bumpScale: 3, roughness: 0.98 });
    const f = T.felt();
    out.felt = std({ ...f, bumpScale: 1.5, roughness: 0.95 });
    const lin = T.linen([246, 245, 242], 12);
    out.sheet = std({ ...lin, bumpScale: 0.8, roughness: 0.9, side: THREE.DoubleSide });
    out.pillow = std({ ...T.linen([248, 248, 246], 13), bumpScale: 0.8, roughness: 0.9 });
    out.towelBlack = std({ ...T.linen([30, 32, 40], 14, 256, 0.08), bumpScale: 2, roughness: 1 });
    out.cushionBeige = std({ ...T.linen([200, 184, 160], 15, 256, 0.2), bumpScale: 1, roughness: 0.95 });
    out.mat = std({ ...T.linen([22, 22, 24], 16, 256, 0.05), bumpScale: 3, roughness: 1 });
    const sh = T.sheer();
    out.curtain = std({ map: sh.map, alphaMap: sh.alphaMap, transparent: true, opacity: 0.92, side: THREE.DoubleSide, roughness: 0.95, depthWrite: false });
    const aw = T.awning();
    out.awning = std({ ...aw, bumpScale: 0.6, roughness: 0.9, side: THREE.DoubleSide });
  }]);
  steps.push(['Gazon et mur végétal', () => {
    const g = T.grass();
    out.grass = std({ ...g, bumpScale: 4, roughness: 0.95 });
    const iv = T.ivy();
    out.ivy = std({ ...iv, bumpScale: 6, roughness: 0.85 });
    const r = T.rattan();
    out.rattan = std({ ...r, bumpScale: 3, roughness: 1 });
    out.ground = std({ color: 0x9a968e, roughness: 1 });
  }]);
  steps.push(['Végétation', () => {
    const leaf = (k: 'banana' | 'palm' | 'fern') =>
      std({ map: T.tropicalLeaf(k), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
    out.leafBanana = leaf('banana');
    out.leafPalm = leaf('palm');
    out.leafFern = leaf('fern');
    out.trunk = std({ color: 0x6b5641, roughness: 1 });
  }]);
  steps.push(['Eau et matériaux spéciaux', () => {
    const wn = T.waterNormals();
    out.waterNormal = wn;
    out.water = new THREE.MeshPhysicalMaterial({
      color: 0x7fd4e6, roughness: 0.05, metalness: 0, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true, opacity: 0.85, ior: 1.33, emissive: 0x0b4a5a, emissiveIntensity: 0.25,
    });
    out.jacuzziShell = std({ color: 0x1b1c1f, roughness: 0.45 });
    out.jacuzziLiner = std({ color: 0xd8e4e8, roughness: 0.5, side: THREE.BackSide });
    out.wavesLamp = std({ color: 0xffffff, bumpMap: T.waves(), bumpScale: 4, roughness: 0.6, emissive: 0xfff2dc, emissiveIntensity: 0 });
    out.screenOff = std({ color: 0x050506, roughness: 0.08, metalness: 0.2 });
    out.screenOn = std({ color: 0x000000, emissive: 0xffffff, emissiveMap: T.tvScreen(), emissiveIntensity: 1.4, roughness: 0.1 });
  }]);
  steps.push(['Métaux, verre et céramique', () => {
    out.greyFurniture = std({ color: 0x6d6862, roughness: 0.55 });
    out.anthracite = std({ color: 0x4a4d52, roughness: 0.62, metalness: 0.05 });
    out.blackMatte = std({ color: 0x141416, roughness: 0.5 });
    out.blackMetal = std({ color: 0x18181a, roughness: 0.35, metalness: 0.8 });
    out.steel = std({ color: 0xc9cbcf, roughness: 0.4, metalness: 1 });
    out.chrome = std({ color: 0xf2f2f2, roughness: 0.06, metalness: 1 });
    out.whitePlastic = std({ color: 0xf3f3f1, roughness: 0.35 });
    out.whiteGloss = new THREE.MeshPhysicalMaterial({ color: 0xf1eee8, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
    out.ceramic = new THREE.MeshPhysicalMaterial({ color: 0xfbfbfb, roughness: 0.12, clearcoat: 0.8, clearcoatRoughness: 0.08 });
    out.glass = new THREE.MeshPhysicalMaterial({
      color: 0xdfe9ec, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12,
      envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false,
    });
    out.glassShower = new THREE.MeshPhysicalMaterial({
      color: 0xeef6f6, roughness: 0.03, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false,
    });
  }]);

  for (let i = 0; i < steps.length; i++) {
    const [label, fn] = steps[i];
    onProgress(i / steps.length, label);
    await nextFrame();
    fn();
  }
  onProgress(1, 'Matériaux prêts');
  return out as Materials;
}
