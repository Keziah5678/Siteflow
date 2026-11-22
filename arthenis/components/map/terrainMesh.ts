import * as THREE from "three";
import type { WorldVisualIdentity } from "@/lib/world/identity";
import { sampleTerrain } from "@/lib/world/terrain";

/**
 * Terrain geometry for the 3D map, built from the same deterministic terrain
 * functions as the beta 2D map: same world → same relief, on every device.
 *
 * The world (0–100 on both axes) is cut into CHUNKS×CHUNKS tiles. Each tile is
 * built at the resolution its distance to the camera deserves (level of
 * detail), with skirts hiding the seams between tiles of different detail.
 * Geometry is cached per (world, tile, resolution).
 */

export const SIZE = 100;
export const CHUNKS = 8;
export const CHUNK = SIZE / CHUNKS;
export const HEIGHT = 12;
export const SEA = 0.31;
export const RESOLUTIONS = [16, 32, 64] as const;

const OCTAVES: Record<number, number> = { 8: 4, 16: 5, 32: 6, 64: 7 };

/** Display height (scene units) from a normalised terrain height. Sea level is y = 0. */
export function displayHeight(h: number): number {
  return h >= SEA ? (h - SEA) * HEIGHT * 1.6 : (h - SEA) * HEIGHT * 0.7;
}

export function heightAt(id: WorldVisualIdentity, x: number, y: number): number {
  const h = sampleTerrain(id, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)), 5).height;
  return Math.max(0, displayHeight(h));
}

const colorCache = new Map<string, THREE.Color>();
function col(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

export function chunkGeometry(id: WorldVisualIdentity, cx: number, cy: number, res: number): THREE.BufferGeometry {
  const key = `${id.seed}:${id.version}:${id.climate}:${id.landmass.toFixed(3)}:${cx}:${cy}:${res}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const oct = OCTAVES[res] ?? 5;
  const n = res + 1;
  const ring = 4 * res; // skirt vertices
  const total = n * n + ring;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const x0 = cx * CHUNK, y0 = cy * CHUNK, step = CHUNK / res;
  const pal = id.palette as unknown as Record<string, string>;
  const tmp = new THREE.Color();
  // Heights on a grid padded by one sample, so normals are continuous across tiles.
  const p = n + 2;
  const hgrid = new Float32Array(p * p);
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
    const x = x0 + i * step, y = y0 + j * step;
    const inside = i >= 0 && j >= 0 && i < n && j < n;
    const s = sampleTerrain(id, x, y, inside ? oct : Math.min(oct, 5));
    const hy = displayHeight(s.height);
    hgrid[(j + 1) * p + (i + 1)] = hy;
    if (!inside) continue;
    const k = (j * n + i) * 3;
    positions[k] = x; positions[k + 1] = hy; positions[k + 2] = y;
    tmp.copy(col(s.river ? pal.river : pal[s.biome] ?? pal.plain));
    const shade = 0.8 + Math.min(1, s.height) * 0.32;
    colors[k] = tmp.r * shade; colors[k + 1] = tmp.g * shade; colors[k + 2] = tmp.b * shade;
  }
  const nv = new THREE.Vector3();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const hl = hgrid[(j + 1) * p + i], hr = hgrid[(j + 1) * p + i + 2];
    const hd = hgrid[j * p + i + 1], hu = hgrid[(j + 2) * p + i + 1];
    nv.set(hl - hr, 2 * step, hd - hu).normalize();
    const k = (j * n + i) * 3;
    normals[k] = nv.x; normals[k + 1] = nv.y; normals[k + 2] = nv.z;
  }
  // Skirts: a copy of the border pushed down, so LOD seams never show the void.
  const border: number[] = [];
  for (let i = 0; i < res; i++) border.push(i);                       // top
  for (let j = 0; j < res; j++) border.push(j * n + res);             // right
  for (let i = res; i > 0; i--) border.push(res * n + i);             // bottom
  for (let j = res; j > 0; j--) border.push(j * n);                   // left
  border.forEach((src, b) => {
    const k = (n * n + b) * 3, s = src * 3;
    positions[k] = positions[s]; positions[k + 1] = positions[s + 1] - 1.2; positions[k + 2] = positions[s + 2];
    colors[k] = colors[s]; colors[k + 1] = colors[s + 1]; colors[k + 2] = colors[s + 2];
    normals[k] = normals[s]; normals[k + 1] = normals[s + 1]; normals[k + 2] = normals[s + 2];
  });
  const index: number[] = [];
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  for (let b = 0; b < ring; b++) {
    const top0 = border[b], top1 = border[(b + 1) % ring];
    const bot0 = n * n + b, bot1 = n * n + ((b + 1) % ring);
    index.push(top0, top1, bot0, top1, bot1, bot0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  if (geoCache.size > 600) { const first = geoCache.keys().next().value; if (first) { geoCache.get(first)?.dispose(); geoCache.delete(first); } }
  geoCache.set(key, g);
  return g;
}

export function resolutionFor(distance: number): number {
  if (distance < 24) return 64;
  if (distance < 70) return 32;
  return 16;
}

/* ------------------------------------------------------------- reveal */

export const MAX_REVEAL = 64;

export type RevealUniforms = {
  uPts: { value: THREE.Vector3[] };
  uCount: { value: number };
  uFull: { value: number };
};

export function makeRevealUniforms(): RevealUniforms {
  return { uPts: { value: Array.from({ length: MAX_REVEAL }, () => new THREE.Vector3()) }, uCount: { value: 0 }, uFull: { value: 1 } };
}

/**
 * Patches a standard material so that, in a blank world, only the ground
 * around what the creator has written is revealed: elsewhere the relief is
 * flattened and painted as white parchment with a faint survey grid.
 */
export function applyReveal(material: THREE.MeshStandardMaterial, uniforms: RevealUniforms, flatten: boolean) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const decl = `uniform vec3 uPts[${MAX_REVEAL}];\nuniform int uCount;\nuniform float uFull;\nvarying float vReveal;\nvarying vec2 vWXZ;\n`;
    const fn = `
float revealAt(vec2 p) {
  if (uFull > 0.5) return 1.0;
  if (p.x < -0.5 || p.y < -0.5 || p.x > 100.5 || p.y > 100.5) return 1.0; // open sea beyond the map
  float r = 0.0;
  for (int i = 0; i < ${MAX_REVEAL}; i++) {
    if (i >= uCount) break;
    vec3 q = uPts[i];
    r = max(r, 1.0 - smoothstep(q.z * 0.55, q.z, distance(p, q.xy)));
  }
  return r;
}
`;
    shader.vertexShader = decl + fn + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
  vWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
  vReveal = revealAt(vWXZ);
  #if REVEAL_FLATTEN == 1
  transformed.y *= vReveal;
  #endif`);
    shader.fragmentShader = decl + fn + shader.fragmentShader
      .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  #if REVEAL_FLATTEN == 0
  // Water never paints parchment itself: where the world is unrevealed it steps aside for the flattened ground.
  if (revealAt(vWXZ) < 0.5) discard;
  #endif`)
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>
  #if REVEAL_FLATTEN == 1
  float gx = step(0.965, fract(vWXZ.x / 6.25)) + step(0.965, fract(vWXZ.y / 6.25));
  vec3 parchment = mix(vec3(0.94, 0.93, 0.97), vec3(0.78, 0.73, 0.88), clamp(gx, 0.0, 1.0) * 0.6);
  gl_FragColor.rgb = mix(parchment, gl_FragColor.rgb, revealAt(vWXZ));
  #endif`);
  };
  // Distinct cache keys: the terrain (flattened) and the water (not) must not share a program.
  material.defines = { ...(material.defines ?? {}), REVEAL_FLATTEN: flatten ? 1 : 0 };
  material.customProgramCacheKey = () => `arthenis-reveal-${flatten ? "flat" : "keep"}`;
  material.needsUpdate = true;
}

export const REVEAL_RADIUS: Record<string, number> = {
  planet: 60, continent: 30, country: 18, region: 12, city: 7, village: 5, place: 3.5,
  civilization: 10, resource: 3, character: 2.5, npc: 2, animal: 2, creature: 2.5, quest: 2.5, item: 1.5, deity: 3
};
