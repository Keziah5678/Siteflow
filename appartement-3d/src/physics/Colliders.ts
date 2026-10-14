import * as THREE from 'three';

/**
 * Monde de collision simplifié et robuste :
 *  - boîtes alignées sur les axes (murs, meubles, portes) ;
 *  - cylindres verticaux (spa, tables rondes).
 * Le joueur est une capsule verticale (cercle en XZ + hauteur).
 * Les surfaces dont le sommet est sous « feet + stepHeight » sont franchissables
 * (seuils, estrade de la cuisine) et servent de sol.
 */

export interface BoxCollider {
  kind: 'box';
  box: THREE.Box3;
  enabled: boolean;
  name?: string;
}

export interface CylinderCollider {
  kind: 'cyl';
  x: number;
  z: number;
  r: number;
  minY: number;
  maxY: number;
  enabled: boolean;
  name?: string;
}

export type Collider = BoxCollider | CylinderCollider;

const EPS = 1e-4;

export class ColliderWorld {
  readonly items: Collider[] = [];

  addBox(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number, name?: string): BoxCollider {
    const c: BoxCollider = {
      kind: 'box',
      box: new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ)),
      enabled: true,
      name,
    };
    this.items.push(c);
    return c;
  }

  /** Ajoute la boîte englobante monde d'un objet (après placement). */
  addObject(o: THREE.Object3D, name?: string, shrink = 0): BoxCollider {
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(o);
    b.min.x += shrink; b.min.z += shrink; b.max.x -= shrink; b.max.z -= shrink;
    const c: BoxCollider = { kind: 'box', box: b, enabled: true, name };
    this.items.push(c);
    return c;
  }

  addCylinder(x: number, z: number, r: number, minY: number, maxY: number, name?: string): CylinderCollider {
    const c: CylinderCollider = { kind: 'cyl', x, z, r, minY, maxY, enabled: true, name };
    this.items.push(c);
    return c;
  }

  /**
   * Hauteur du sol sous le point (x, z) : sommet le plus haut atteignable
   * (≤ feetY + step). Renvoie -Infinity s'il n'y a aucun sol (hors du monde).
   */
  groundHeight(x: number, z: number, feetY: number, step: number): number {
    let best = -Infinity;
    for (const c of this.items) {
      if (!c.enabled) continue;
      let top: number;
      if (c.kind === 'box') {
        const b = c.box;
        if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z) continue;
        top = b.max.y;
      } else {
        if ((x - c.x) ** 2 + (z - c.z) ** 2 > c.r * c.r) continue;
        top = c.maxY;
      }
      if (top <= feetY + step + EPS && top > best) best = top;
    }
    return best;
  }

  /**
   * Repousse horizontalement une capsule hors des obstacles.
   * Modifie `p` (position des pieds). Renvoie true en cas de contact.
   */
  resolve(p: THREE.Vector3, radius: number, height: number, step: number): boolean {
    let hit = false;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const c of this.items) {
        if (!c.enabled) continue;
        const minY = c.kind === 'box' ? c.box.min.y : c.minY;
        const maxY = c.kind === 'box' ? c.box.max.y : c.maxY;
        // Ignore ce qui est franchissable ou au-dessus de la tête.
        if (maxY <= p.y + step + EPS || minY >= p.y + height) continue;
        if (c.kind === 'box') {
          const b = c.box;
          const cx = Math.max(b.min.x, Math.min(p.x, b.max.x));
          const cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
          const dx = p.x - cx, dz = p.z - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            const push = radius - d + EPS;
            p.x += (dx / d) * push;
            p.z += (dz / d) * push;
          } else {
            // Centre à l'intérieur de la boîte : sortie par la face la plus proche.
            const l = p.x - b.min.x, r = b.max.x - p.x, n = p.z - b.min.z, s = b.max.z - p.z;
            const m = Math.min(l, r, n, s);
            if (m === l) p.x = b.min.x - radius - EPS;
            else if (m === r) p.x = b.max.x + radius + EPS;
            else if (m === n) p.z = b.min.z - radius - EPS;
            else p.z = b.max.z + radius + EPS;
          }
          moved = hit = true;
        } else {
          const dx = p.x - c.x, dz = p.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = radius + c.r;
          if (d >= min) continue;
          if (d < 1e-6) { p.x += min; continue; }
          p.x = c.x + (dx / d) * (min + EPS);
          p.z = c.z + (dz / d) * (min + EPS);
          moved = hit = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }
}
