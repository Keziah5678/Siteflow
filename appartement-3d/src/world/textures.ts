import * as THREE from 'three';
import { rng } from '../core/utils';

/**
 * Textures procédurales générées au chargement (aucun fichier externe).
 * Toutes les textures sont « tileables » : le bruit est périodique,
 * ce qui évite toute couture visible lors de la répétition.
 */

class PeriodicNoise {
  private p = new Uint16Array(512);
  constructor(seed: number) {
    const r = rng(seed);
    const a = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    for (let i = 0; i < 512; i++) this.p[i] = a[i & 255];
  }
  private h(ix: number, iy: number) {
    return this.p[this.p[ix & 255] + (iy & 255)] / 255;
  }
  /** Bruit de valeur lissé, périodique de période (px, py). */
  noise(x: number, y: number, px: number, py: number): number {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const ix0 = ((x0 % px) + px) % px, iy0 = ((y0 % py) + py) % py;
    const ix1 = (ix0 + 1) % px, iy1 = (iy0 + 1) % py;
    const a = this.h(ix0, iy0), b = this.h(ix1, iy0), c = this.h(ix0, iy1), d = this.h(ix1, iy1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  /** fBm sur des coordonnées normalisées u, v ∈ [0,1). */
  fbm(u: number, v: number, fx: number, fy: number, oct = 4): number {
    let sum = 0, amp = 0.5, norm = 0, f = 1;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.noise(u * fx * f, v * fy * f, fx * f, fy * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
}

type RGB = [number, number, number];
type PixelFn = (u: number, v: number, x: number, y: number) => { c: RGB; b?: number; r?: number };

interface Painted {
  color: HTMLCanvasElement;
  bump?: HTMLCanvasElement;
  rough?: HTMLCanvasElement;
}

function canvas(w: number, h = w): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Peint une texture pixel par pixel ; produit en option une carte de relief et de rugosité. */
function paint(size: number, fn: PixelFn, withBump = false, withRough = false): Painted {
  const color = canvas(size);
  const cctx = color.getContext('2d')!;
  const cimg = cctx.createImageData(size, size);
  let bimg: ImageData | undefined, rimg: ImageData | undefined, bump: HTMLCanvasElement | undefined, rough: HTMLCanvasElement | undefined;
  if (withBump) { bump = canvas(size); bimg = bump.getContext('2d')!.createImageData(size, size); }
  if (withRough) { rough = canvas(size); rimg = rough.getContext('2d')!.createImageData(size, size); }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      const p = fn(x / size, y / size, x, y);
      cimg.data[o] = p.c[0]; cimg.data[o + 1] = p.c[1]; cimg.data[o + 2] = p.c[2]; cimg.data[o + 3] = 255;
      if (bimg) { const b = Math.max(0, Math.min(255, (p.b ?? 0.5) * 255)); bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = b; bimg.data[o + 3] = 255; }
      if (rimg) { const r = Math.max(0, Math.min(255, (p.r ?? 0.5) * 255)); rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = r; rimg.data[o + 3] = 255; }
    }
  }
  cctx.putImageData(cimg, 0, 0);
  if (bump && bimg) bump.getContext('2d')!.putImageData(bimg, 0, 0);
  if (rough && rimg) rough.getContext('2d')!.putImageData(rimg, 0, 0);
  return { color, bump, rough };
}

export function toTexture(c: HTMLCanvasElement, meters: number | [number, number], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  const [mx, my] = Array.isArray(meters) ? meters : [meters, meters];
  t.repeat.set(1 / mx, 1 / my);
  return t;
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export interface TextureSet { map: THREE.Texture; bumpMap?: THREE.Texture; roughnessMap?: THREE.Texture }

const set = (p: Painted, meters: number | [number, number]): TextureSet => {
  const s: TextureSet = { map: toTexture(p.color, meters) };
  if (p.bump) s.bumpMap = toTexture(p.bump, meters, false);
  if (p.rough) s.roughnessMap = toTexture(p.rough, meters, false);
  return s;
};

/* ------------------------------------------------------------------ */
/* Bois                                                                */
/* ------------------------------------------------------------------ */

/** Parquet stratifié chêne clair, lames de 20 cm × 120 cm (texture = 2,4 m). */
export function woodFloor(size = 1024): TextureSet {
  const n = new PeriodicNoise(11);
  const r = rng(5);
  const cols = 12, perCol = 2;
  const offsets = Array.from({ length: cols }, () => r());
  const tints = Array.from({ length: cols * perCol }, () => r());
  const light: RGB = [212, 178, 138], dark: RGB = [176, 136, 96];
  const p = paint(size, (u, v) => {
    const cu = u * cols;
    const col = Math.floor(cu);
    const fu = cu - col;
    const vv = (v + offsets[col]) % 1;
    const pv = vv * perCol;
    const idx = col * perCol + Math.floor(pv);
    const fv = pv - Math.floor(pv);
    const t = tints[idx];
    let c = mix(dark, light, 0.45 + t * 0.4);
    const grain = n.fbm(u + idx * 0.37, v, 96, 6, 4);
    const fine = n.noise(u * 512 + idx * 3.1, v * 8, 512, 8);
    const knot = n.fbm(u, v + idx * 0.21, 24, 3, 3);
    c = shade(c, 0.86 + grain * 0.26 + (fine - 0.5) * 0.08 - Math.max(0, knot - 0.68) * 0.6);
    let b = 0.6 + (grain - 0.5) * 0.15;
    let rough = 0.42 + (grain - 0.5) * 0.15;
    const seamU = Math.min(fu, 1 - fu) * size / cols;
    const seamV = Math.min(fv, 1 - fv) * size / perCol;
    if (seamU < 1.2 || seamV < 1.0) { c = shade(c, 0.8); b = 0.2; rough = 0.7; }
    return { c, b, r: rough };
  }, true, true);
  return set(p, 2.4);
}

/** Chêne clair à fil vertical (armoire, portes, plateau de table). */
export function oak(seed: number, base: RGB, size = 512): TextureSet {
  const n = new PeriodicNoise(seed);
  const p = paint(size, (u, v) => {
    const g = n.fbm(u, v, 48, 3, 4);
    const ring = Math.sin((u * 36 + g * 5) * Math.PI * 2) * 0.5 + 0.5;
    const fine = n.noise(u * 256, v * 6, 256, 6);
    const c = shade(base, 0.86 + g * 0.18 + ring * 0.07 + (fine - 0.5) * 0.06);
    return { c, b: 0.5 + ring * 0.15, r: 0.55 + (g - 0.5) * 0.2 };
  }, true, true);
  return set(p, 1.2);
}

/** Lattes de bois foncé (habillage de la tête de lit). */
export function slats(size = 512): TextureSet {
  const n = new PeriodicNoise(77);
  const p = paint(size, (u, v) => {
    const k = (u * 8) % 1;
    const g = n.fbm(u, v, 64, 3, 4);
    let c: RGB = shade([150, 96, 52], 0.82 + g * 0.3);
    let b = 0.7;
    if (k > 0.78) { c = [28, 20, 14]; b = 0.0; }
    return { c, b };
  }, true);
  return set(p, 0.4);
}

/* ------------------------------------------------------------------ */
/* Pierre / marbre                                                      */
/* ------------------------------------------------------------------ */

/** Grès cérame effet marbre blanc (Carrare) avec joints de carrelage. */
export function marbleWhite(size = 1024, tileMeters = 1.2, grout = true): TextureSet {
  const n = new PeriodicNoise(23);
  const base: RGB = [236, 236, 238];
  const p = paint(size, (u, v, x, y) => {
    const t = n.fbm(u, v, 6, 6, 6);
    const t2 = n.fbm(u + 0.3, v + 0.7, 10, 10, 5);
    const a = Math.abs(Math.sin(Math.PI * 2 * (u * 1 + v * 2) + t * 9));
    const b2 = Math.abs(Math.sin(Math.PI * 2 * (u * 3 - v * 1) + t2 * 12));
    const vein = Math.pow(1 - a, 28) * 0.75 + Math.pow(1 - b2, 60) * 0.5;
    const cloud = n.fbm(u, v, 4, 4, 4);
    let c = shade(base, 0.97 + (cloud - 0.5) * 0.06);
    c = mix(c, [110, 112, 118], Math.min(1, vein));
    let bb = 0.7;
    let rr = 0.12 + vein * 0.1;
    if (grout && (x < 2 || y < 2)) { c = [200, 200, 200]; bb = 0.2; rr = 0.7; }
    return { c, b: bb, r: rr };
  }, true, true);
  return set(p, tileMeters);
}

/** Marbre noir veiné de blanc (crédence et plan de travail de la cuisine). */
export function marbleBlack(size = 1024): TextureSet {
  const n = new PeriodicNoise(31);
  const p = paint(size, (u, v) => {
    const t = n.fbm(u, v, 5, 5, 6);
    const t2 = n.fbm(u + 0.5, v, 9, 9, 5);
    const a = Math.abs(Math.sin(Math.PI * 2 * (u * 2 + v * 1) + t * 10));
    const b2 = Math.abs(Math.sin(Math.PI * 2 * (u * 1 - v * 3) + t2 * 14));
    const vein = Math.pow(1 - a, 40) * 1.0 + Math.pow(1 - b2, 90) * 0.7 + Math.pow(1 - a, 8) * 0.06;
    const c = mix([14, 14, 16], [225, 225, 228], Math.min(1, vein));
    return { c, r: 0.08 + vein * 0.05 };
  }, false, true);
  return set(p, 1.0);
}

/* ------------------------------------------------------------------ */
/* Murs et textiles                                                     */
/* ------------------------------------------------------------------ */

export function paintWall(size = 256): TextureSet {
  const n = new PeriodicNoise(3);
  const p = paint(size, (u, v) => {
    const g = n.fbm(u, v, 16, 16, 4);
    return { c: shade([243, 242, 239], 0.975 + g * 0.04), b: 0.5 + (g - 0.5) * 0.4 };
  }, true);
  return set(p, 1.0);
}

export function plaster(size = 512): TextureSet {
  const n = new PeriodicNoise(4);
  const p = paint(size, (u, v) => {
    const g = n.fbm(u, v, 12, 12, 6);
    const s = n.noise(u * 96, v * 96, 96, 96);
    return { c: shade([236, 232, 224], 0.92 + g * 0.1 + (s - 0.5) * 0.04), b: g * 0.8 + s * 0.2, r: 0.9 };
  }, true, true);
  return set(p, 1.2);
}

/** Tissu bouclé (sommier capitonné). */
export function boucle(size = 512): TextureSet {
  const n = new PeriodicNoise(8);
  const p = paint(size, (u, v) => {
    const a = n.noise(u * 128, v * 128, 128, 128);
    const b = n.noise(u * 64 + 7, v * 64, 64, 64);
    const loops = Math.pow(Math.abs(Math.sin(a * 9 + b * 6)), 0.6);
    const c = shade([212, 202, 188], 0.78 + loops * 0.28);
    return { c, b: loops };
  }, true);
  return set(p, 0.18);
}

/** Feutrine / velours gris-taupe (panneaux de tête de lit). */
export function felt(size = 512): TextureSet {
  const n = new PeriodicNoise(9);
  const p = paint(size, (u, v) => {
    const g = n.fbm(u, v, 64, 64, 4);
    const f = n.noise(u * 256, v * 256, 256, 256);
    return { c: shade([118, 110, 101], 0.9 + g * 0.16 + (f - 0.5) * 0.08), b: f };
  }, true);
  return set(p, 0.5);
}

export function linen(base: RGB, seed = 12, size = 256, meters = 0.25): TextureSet {
  const n = new PeriodicNoise(seed);
  const p = paint(size, (u, v, x, y) => {
    const w = ((x % 4) < 2 ? 1 : 0) ^ ((y % 4) < 2 ? 1 : 0);
    const g = n.fbm(u, v, 16, 16, 3);
    return { c: shade(base, 0.94 + w * 0.04 + g * 0.06), b: w * 0.5 + g * 0.5 };
  }, true);
  return set(p, meters);
}

/** Toile de store banne orangée. */
export function awning(size = 512): TextureSet {
  const n = new PeriodicNoise(13);
  const p = paint(size, (u, v, x) => {
    const g = n.fbm(u, v, 8, 8, 4);
    const weave = (x % 3 === 0 ? 0.95 : 1);
    return { c: shade([214, 128, 62], (0.9 + g * 0.15) * weave), b: g };
  }, true);
  return set(p, 1.0);
}

/** Voilage gris semi-transparent (rideaux). Alpha encodé dans la carte. */
export function sheer(size = 256): { map: THREE.Texture; alphaMap: THREE.Texture } {
  const n = new PeriodicNoise(14);
  const p = paint(size, (u, v) => {
    const g = n.noise(u * 64, v * 2, 64, 2);
    const k = 0.8 + g * 0.2;
    return { c: [196 * k, 196 * k, 200 * k], b: 0.55 + g * 0.35 };
  }, true);
  return { map: toTexture(p.color, 0.5), alphaMap: toTexture(p.bump!, 0.5, false) };
}

/* ------------------------------------------------------------------ */
/* Extérieur                                                           */
/* ------------------------------------------------------------------ */

/** Gazon synthétique : milliers de brins dessinés. */
export function grass(size = 512): TextureSet {
  const c = canvas(size), b = canvas(size);
  const ctx = c.getContext('2d')!, bctx = b.getContext('2d')!;
  ctx.fillStyle = '#3f7a25';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, size, size);
  const r = rng(99);
  for (let i = 0; i < 26000; i++) {
    const x = r() * size, y = r() * size;
    const len = 3 + r() * 7;
    const ang = -Math.PI / 2 + (r() - 0.5) * 1.4;
    const g = 110 + r() * 100;
    const col = `rgb(${(g * 0.48) | 0},${g | 0},${(g * 0.22) | 0})`;
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(ex + dx, ey + dy); ctx.stroke();
      const lb = 120 + r() * 135;
      bctx.strokeStyle = `rgb(${lb | 0},${lb | 0},${lb | 0})`;
      bctx.beginPath(); bctx.moveTo(x + dx, y + dy); bctx.lineTo(ex + dx, ey + dy); bctx.stroke();
    }
  }
  return { map: toTexture(c, 0.6), bumpMap: toTexture(b, 0.6, false) };
}

/** Mur végétal (lierre artificiel) : feuilles superposées. */
export function ivy(size = 1024): TextureSet {
  const c = canvas(size), b = canvas(size);
  const ctx = c.getContext('2d')!, bctx = b.getContext('2d')!;
  ctx.fillStyle = '#132412';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, size, size);
  const r = rng(42);
  const leaf = (g: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, fill: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = fill;
    g.beginPath();
    // feuille de lierre stylisée à 3 lobes
    g.moveTo(0, s);
    g.quadraticCurveTo(-s * 1.1, s * 0.2, -s * 0.8, -s * 0.4);
    g.quadraticCurveTo(-s * 0.3, -s * 0.3, 0, -s);
    g.quadraticCurveTo(s * 0.3, -s * 0.3, s * 0.8, -s * 0.4);
    g.quadraticCurveTo(s * 1.1, s * 0.2, 0, s);
    g.fill();
    g.restore();
  };
  for (let i = 0; i < 9000; i++) {
    const x = r() * size, y = r() * size;
    const s = 6 + r() * 9;
    const a = r() * Math.PI * 2;
    const depth = i / 9000;
    const gch = 60 + depth * 110 + r() * 40;
    const fill = `rgb(${(gch * (0.35 + r() * 0.25)) | 0},${gch | 0},${(gch * (0.2 + r() * 0.2)) | 0})`;
    const lb = (40 + depth * 200) | 0;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      if (x + dx < -20 || x + dx > size + 20 || y + dy < -20 || y + dy > size + 20) continue;
      leaf(ctx, x + dx, y + dy, s, a, fill);
      leaf(bctx, x + dx, y + dy, s, a, `rgb(${lb},${lb},${lb})`);
    }
  }
  return { map: toTexture(c, 1.4), bumpMap: toTexture(b, 1.4, false) };
}

/** Résine tressée façon rotin. */
export function rattan(size = 256): TextureSet {
  const n = new PeriodicNoise(17);
  const cell = 16;
  const p = paint(size, (u, v, x, y) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const horiz = (cx + cy) % 2 === 0;
    const lx = (x % cell) / cell, ly = (y % cell) / cell;
    const across = horiz ? ly : lx;
    const strand = Math.sin(across * Math.PI * 3);
    const h = Math.abs(strand);
    const g = n.noise(u * 64, v * 64, 64, 64);
    const c = shade([150, 122, 90], 0.6 + h * 0.5 + (g - 0.5) * 0.12);
    return { c, b: h, r: 0.7 };
  }, true, true);
  return set(p, 0.16);
}

/** Carte de normales d'eau (bruit périodique dérivé). */
export function waterNormals(size = 256): THREE.Texture {
  const n = new PeriodicNoise(51);
  const h = (u: number, v: number) => n.fbm(u, v, 8, 8, 4);
  const p = paint(size, (u, v) => {
    const e = 1 / size;
    const dx = (h(u + e, v) - h(u - e, v)) * 6;
    const dy = (h(u, v + e) - h(u, v - e)) * 6;
    const len = Math.hypot(dx, dy, 1);
    return { c: [((-dx / len) * 0.5 + 0.5) * 255, ((-dy / len) * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255] };
  });
  return toTexture(p.color, 1.2, false);
}

/** Feuille tropicale (bananier / philodendron) avec alpha. */
export function tropicalLeaf(kind: 'banana' | 'palm' | 'fern'): THREE.Texture {
  const W = 256, H = 512;
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  const r = rng(kind.length * 31);
  g.translate(W / 2, H);
  if (kind === 'banana') {
    const grad = g.createLinearGradient(-100, 0, 100, 0);
    grad.addColorStop(0, '#2f6b22'); grad.addColorStop(0.5, '#5aa33a'); grad.addColorStop(1, '#2c6420');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-120, -120, -110, -400, 0, -500);
    g.bezierCurveTo(110, -400, 120, -120, 0, 0);
    g.fill();
    g.strokeStyle = 'rgba(20,50,15,0.6)';
    for (let i = 0; i < 40; i++) {
      const y = -20 - i * 12;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y); g.lineTo(-110 * Math.sin((i / 40) * Math.PI), y - 25); g.stroke();
      g.beginPath(); g.moveTo(0, y); g.lineTo(110 * Math.sin((i / 40) * Math.PI), y - 25); g.stroke();
    }
    g.strokeStyle = '#b9d98a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -495); g.stroke();
  } else {
    // palme / fougère : folioles fines le long d'une nervure
    g.strokeStyle = '#6f8f3a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -250, 0, -500); g.stroke();
    const n = kind === 'palm' ? 34 : 46;
    for (let i = 2; i < n; i++) {
      const t = i / n;
      const y = -t * 495;
      const len = (kind === 'palm' ? 120 : 80) * Math.sin(t * Math.PI) * (0.8 + r() * 0.2);
      const gr = 90 + r() * 70;
      g.strokeStyle = `rgb(${(gr * 0.4) | 0},${gr | 0},${(gr * 0.3) | 0})`;
      g.lineWidth = kind === 'palm' ? 7 : 5;
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(s * len * 0.6, y - 10, s * len, y + 18); g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Écran de télévision allumé (interface de streaming générique). */
export function tvScreen(): THREE.CanvasTexture {
  const W = 1024, H = 576;
  const c = canvas(W, H);
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#16161a'); bg.addColorStop(1, '#060607');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // bannière héros
  const hero = g.createLinearGradient(0, 0, W, 300);
  hero.addColorStop(0, '#3a1010'); hero.addColorStop(0.6, '#1d2a44'); hero.addColorStop(1, '#0c0c10');
  g.fillStyle = hero; g.fillRect(0, 0, W, 300);
  g.fillStyle = '#e50914';
  g.font = 'bold 64px "Arial Narrow", Arial, sans-serif';
  g.fillText('CINÉ STUDIO', 48, 120);
  g.fillStyle = '#f2f2f2';
  g.font = '28px Arial, sans-serif';
  g.fillText('Ce soir : film en avant-première', 52, 170);
  g.fillStyle = '#ffffff'; g.fillRect(52, 205, 140, 46);
  g.fillStyle = '#111'; g.font = 'bold 24px Arial'; g.fillText('▶  Lecture', 66, 236);
  g.fillStyle = 'rgba(120,120,120,0.6)'; g.fillRect(206, 205, 170, 46);
  g.fillStyle = '#fff'; g.fillText('Plus d\'infos', 222, 236);
  g.font = 'bold 24px Arial';
  g.fillStyle = '#ddd';
  g.fillText('Tendances actuelles', 48, 340);
  const r = rng(7);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) {
      const x = 48 + i * 158, y = 356 + row * 112;
      const gr = g.createLinearGradient(x, y, x + 150, y + 100);
      const h = Math.floor(r() * 360);
      gr.addColorStop(0, `hsl(${h},55%,42%)`); gr.addColorStop(1, `hsl(${(h + 60) % 360},60%,18%)`);
      g.fillStyle = gr;
      g.fillRect(x, y, 148, 100);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Diffuseur ondulé du plafonnier. */
export function waves(size = 256): THREE.Texture {
  const p = paint(size, (u, v) => {
    const w = Math.sin((v * 6 + Math.sin(u * Math.PI * 4) * 0.35) * Math.PI * 2) * 0.5 + 0.5;
    return { c: [w * 255, w * 255, w * 255] };
  });
  return toTexture(p.color, 0.5, false);
}
