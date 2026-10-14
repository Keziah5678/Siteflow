import * as THREE from 'three';
import { Builder } from './Builder';
import { ColliderWorld } from '../physics/Colliders';
import { Materials } from './materials';
import { Ctx, ZONES, Zone, GARDEN, BATH, HALL } from './layout';
import { LightGroup } from './LightGroup';
import { buildArchitecture } from './Architecture';
import { buildInterior } from './Interior';
import { buildGarden } from './Garden';
import { Sound } from '../core/Sound';

export interface World {
  root: THREE.Group;
  colliders: ColliderWorld;
  lights: Record<string, LightGroup>;
  ctx: Ctx;
  update: (dt: number, time: number) => void;
  zoneAt: (x: number, z: number) => Zone | null;
}

/** Assemble l'appartement complet : architecture, mobilier, jardin, éclairages. */
export function buildWorld(m: Materials, sound: Sound, quality: Ctx['quality'], notify: (s: string) => void, dirtyEnv: () => void): World {
  const root = new THREE.Group();
  root.name = 'appartement';
  const colliders = new ColliderWorld();
  const updaters: Array<(dt: number, time: number) => void> = [];
  const b = new Builder(m, colliders, updaters);
  const lights: Record<string, LightGroup> = {};
  const ctx: Ctx = { b, root, lights, sound, notify, outdoorMaterials: new Set(), dirtyEnv, quality };

  buildArchitecture(ctx);
  buildInterior(ctx);
  buildGarden(ctx);

  // Limites de sécurité invisibles autour de toute la zone praticable
  const pad = 0.5;
  const minX = -0.12 - pad, maxX = GARDEN.x1 + 0.2 + pad, minZ = GARDEN.z0 - 0.2 - pad, maxZ = Math.max(BATH.z1, HALL.z1) + 0.12 + pad;
  colliders.addBox(minX - 1, minX, -5, 10, minZ - 1, maxZ + 1, 'limite');
  colliders.addBox(maxX, maxX + 1, -5, 10, minZ - 1, maxZ + 1, 'limite');
  colliders.addBox(minX, maxX, -5, 10, minZ - 1, minZ, 'limite');
  colliders.addBox(minX, maxX, -5, 10, maxZ, maxZ + 1, 'limite');

  // Les objets statiques n'ont pas besoin de recalculer leur matrice à chaque image
  root.updateMatrixWorld(true);

  return {
    root,
    colliders,
    lights,
    ctx,
    update(dt, time) {
      for (const u of updaters) u(dt, time);
      for (const l of Object.values(lights)) l.update(dt, time);
    },
    zoneAt(x, z) {
      for (const zn of ZONES) if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn;
      return null;
    },
  };
}
