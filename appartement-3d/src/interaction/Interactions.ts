import * as THREE from 'three';
import { smooth } from '../core/utils';

export interface Interactable {
  /** Texte affiché sous le réticule (ex. « Ouvrir la porte »). */
  label: () => string;
  action: () => void;
  /** Distance maximale d'interaction (m). */
  range?: number;
}

/** Associe un interactable à un objet et à tous ses maillages enfants. */
export function makeInteractable(o: THREE.Object3D, it: Interactable): THREE.Object3D {
  o.traverse((c) => { c.userData.interactable = it; });
  return o;
}

/**
 * Animation réversible 0 ↔ 1 (portes, tiroirs, store…), avec easing.
 * `apply` reçoit la valeur lissée à chaque image.
 */
export class Toggle {
  t = 0;
  target = 0;
  constructor(public duration: number, public apply: (k: number, raw: number) => void, initial = 0) {
    this.t = this.target = initial;
    apply(smooth(initial), initial);
  }
  get on() { return this.target === 1; }
  toggle() { this.target = this.target === 1 ? 0 : 1; }
  set(v: boolean) { this.target = v ? 1 : 0; }
  update(dt: number): boolean {
    if (this.t === this.target) return false;
    const d = dt / this.duration;
    this.t = this.target > this.t ? Math.min(this.target, this.t + d) : Math.max(this.target, this.t - d);
    this.apply(smooth(this.t), this.t);
    return true;
  }
}

/**
 * Lance un rayon depuis le centre de l'écran à chaque image et retrouve
 * l'objet interactif visé. Les murs occultent les objets situés derrière.
 */
export class InteractionSystem {
  private ray = new THREE.Raycaster();
  private center = new THREE.Vector2(0, 0);
  current: Interactable | null = null;
  private targets: THREE.Object3D[] = [];

  constructor(private camera: THREE.Camera, root: THREE.Object3D) {
    this.ray.far = 3;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.noRaycast) this.targets.push(o);
    });
  }

  update(): Interactable | null {
    this.ray.setFromCamera(this.center, this.camera);
    const hits = this.ray.intersectObjects(this.targets, false);
    let found: Interactable | null = null;
    for (const h of hits) {
      if (!h.object.visible) continue;
      const it = h.object.userData.interactable as Interactable | undefined;
      if (it && h.distance <= (it.range ?? 2.4)) found = it;
      break; // le premier objet touché masque ce qu'il y a derrière
    }
    this.current = found;
    return found;
  }

  trigger(): boolean {
    if (!this.current) return false;
    this.current.action();
    return true;
  }
}
