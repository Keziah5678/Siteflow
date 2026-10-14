import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boxProjectUV } from '../core/utils';
import { ColliderWorld } from '../physics/Colliders';
import { Materials } from './materials';

type Mat = THREE.Material | THREE.Material[];

export interface SlabOpts {
  collide?: boolean;
  cast?: boolean;
  receive?: boolean;
  name?: string;
}

/**
 * Outils de modélisation. Toutes les cotes sont en mètres.
 * Repère : X = est, Y = haut, Z = sud. Le mur de la tête de lit est au nord (z = 0).
 */
export class Builder {
  constructor(
    readonly m: Materials,
    readonly col: ColliderWorld,
    readonly updaters: Array<(dt: number, time: number) => void>,
  ) {}

  /** Boîte définie par ses bornes monde, avec UV métriques et collision optionnelle. */
  slab(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mat: Mat, parent: THREE.Object3D, o: SlabOpts = {}): THREE.Mesh {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    boxProjectUV(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = o.cast ?? true;
    mesh.receiveShadow = o.receive ?? true;
    if (o.name) mesh.name = o.name;
    parent.add(mesh);
    if (o.collide ?? true) this.col.addBox(x0, x1, y0, y1, z0, z1, o.name);
    return mesh;
  }

  /** Boîte centrée en (x, y, z) dans le repère local du parent. */
  box(w: number, h: number, d: number, mat: Mat, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    boxProjectUV(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Boîte aux arêtes arrondies (coussins, matelas, électroménager). */
  rbox(w: number, h: number, d: number, r: number, mat: Mat, x: number, y: number, z: number, parent: THREE.Object3D, seg = 3): THREE.Mesh {
    const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    boxProjectUV(g, new THREE.Vector3(x, y, z));
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  cyl(rt: number, rb: number, h: number, mat: Mat, x: number, y: number, z: number, parent: THREE.Object3D, seg = 24, open = false): THREE.Mesh {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
    boxProjectUV(g, new THREE.Vector3(x, y, z));
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Bloc en arc de couronne (mobilier circulaire du spa). Angles en radians dans le plan XZ. */
  arc(r0: number, r1: number, a0: number, a1: number, h: number, mat: Mat, parent: THREE.Object3D, y = 0, bevel = 0): THREE.Mesh {
    const s = new THREE.Shape();
    // Un angle b de la forme devient -b dans le plan XZ après rotation.
    s.absarc(0, 0, r1, -a1, -a0, false);
    s.absarc(0, 0, r0, -a0, -a1, true);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: h - bevel * 2, curveSegments: 28, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3,
    });
    // Extrusion le long de +Z → on la couche : Z devient Y.
    g.rotateX(-Math.PI / 2);
    g.translate(0, y + bevel, 0);
    boxProjectUV(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Bande lumineuse émissive (rubans LED). */
  strip(w: number, h: number, d: number, x: number, y: number, z: number, parent: THREE.Object3D, mat: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.userData.noRaycast = true;
    parent.add(mesh);
    return mesh;
  }

  group(parent: THREE.Object3D, x = 0, y = 0, z = 0, ry = 0, name = ''): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.name = name;
    parent.add(g);
    return g;
  }
}

/** Matériau émissif pour LED (intensité pilotée par les groupes de lumières). */
export function ledMaterial(color: THREE.ColorRepresentation, intensity = 6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.5 });
}
