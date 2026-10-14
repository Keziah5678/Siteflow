import * as THREE from 'three';
import { damp } from '../core/utils';

/**
 * Groupe de lumières commandé par un interrupteur : lumières réelles + matériaux émissifs.
 * Les lumières ne sont jamais retirées de la scène (intensité à 0) afin d'éviter
 * la recompilation des shaders lors des changements d'état.
 */
export class LightGroup {
  private lights: Array<{ light: THREE.Light; base: number }> = [];
  private emissive: Array<{ mat: THREE.MeshStandardMaterial; base: number }> = [];
  level: number;
  /** Facteur externe (ex. LED de jardin plus fortes la nuit). */
  boost = 1;
  /** Variation de l'intensité (scintillement de bougie). */
  flicker?: (t: number) => number;
  onChange?: (on: boolean) => void;

  constructor(readonly name: string, public on = true) {
    this.level = on ? 1 : 0;
  }

  addLight(light: THREE.Light): this {
    this.lights.push({ light, base: light.intensity });
    light.intensity = light.intensity * this.level;
    return this;
  }

  addEmissive(mat: THREE.MeshStandardMaterial, base = mat.emissiveIntensity): this {
    this.emissive.push({ mat, base });
    mat.emissiveIntensity = base * this.level;
    return this;
  }

  toggle(): boolean {
    this.set(!this.on);
    return this.on;
  }

  set(on: boolean) {
    if (this.on === on) return;
    this.on = on;
    this.onChange?.(on);
  }

  update(dt: number, time: number) {
    this.level = damp(this.level, this.on ? 1 : 0, 14, dt);
    if (Math.abs(this.level - (this.on ? 1 : 0)) < 0.002) this.level = this.on ? 1 : 0;
    const f = (this.flicker ? this.flicker(time) : 1) * this.boost * this.level;
    for (const l of this.lights) l.light.intensity = l.base * f;
    for (const e of this.emissive) e.mat.emissiveIntensity = e.base * f;
  }
}
