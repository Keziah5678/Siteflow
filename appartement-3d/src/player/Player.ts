import * as THREE from 'three';
import { ColliderWorld } from '../physics/Colliders';
import { Input } from './Input';
import { clamp, damp } from '../core/utils';

export interface Spawn {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
}

/**
 * Contrôleur à la première personne : accélération/décélération douces,
 * collisions capsule, marches basses, gravité, balancement de tête.
 */
export class Player {
  readonly position = new THREE.Vector3(); // position des pieds
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;

  eyeHeight = 1.62;
  radius = 0.24;
  height = 1.78;
  stepHeight = 0.2;
  walkSpeed = 1.55; // m/s (réglable dans le menu)
  runMultiplier = 1.9;
  sensitivity = 1; // multiplicateur (réglable)
  invertY = false;
  gravity = 9.81;
  grounded = true;

  private bobPhase = 0;
  private bobAmount = 0;
  private eyeY = 0;
  private stepTimer = 0;
  onFootstep?: () => void;
  onFellOut?: () => void;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private world: ColliderWorld,
    private input: Input,
    private spawn: Spawn,
  ) {
    camera.rotation.order = 'YXZ';
    this.reset();
  }

  reset() {
    this.position.copy(this.spawn.position);
    this.velocity.set(0, 0, 0);
    this.yaw = this.spawn.yaw;
    this.pitch = this.spawn.pitch;
    this.eyeY = this.position.y + this.eyeHeight;
    this.applyCamera(0);
  }

  update(dt: number) {
    // --- Regard ---------------------------------------------------------
    const look = this.input.consumeLook();
    const k = 0.0022 * this.sensitivity;
    this.yaw -= look.dx * k;
    this.pitch -= look.dy * k * (this.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.5, 1.5);

    // --- Déplacement horizontal ----------------------------------------
    const { fwd, side } = this.input.axes();
    const running = this.input.isDown('run') || this.input.touchRun;
    const speed = this.walkSpeed * (running ? this.runMultiplier : 1);
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // avant = -Z local tourné de yaw ; droite = +X local
    let wx = -sin * fwd + cos * side;
    let wz = -cos * fwd - sin * side;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    wx *= speed; wz *= speed;
    const accel = len > 0.01 ? (this.grounded ? 9 : 2.5) : (this.grounded ? 11 : 1.5);
    this.velocity.x = damp(this.velocity.x, wx, accel, dt);
    this.velocity.z = damp(this.velocity.z, wz, accel, dt);

    // Sous-pas pour ne jamais traverser un mur fin, même à bas framerate.
    const travel = Math.hypot(this.velocity.x, this.velocity.z) * dt;
    const steps = Math.max(1, Math.ceil(travel / 0.06));
    const before = this.position.clone();
    for (let i = 0; i < steps; i++) {
      this.position.x += (this.velocity.x * dt) / steps;
      this.position.z += (this.velocity.z * dt) / steps;
      this.world.resolve(this.position, this.radius, this.height, this.stepHeight);
    }
    // La vitesse réelle tient compte des collisions (glissement le long des murs).
    if (dt > 0) {
      const realX = (this.position.x - before.x) / dt;
      const realZ = (this.position.z - before.z) / dt;
      if (Math.abs(realX) < Math.abs(this.velocity.x)) this.velocity.x = realX;
      if (Math.abs(realZ) < Math.abs(this.velocity.z)) this.velocity.z = realZ;
    }

    // --- Gravité, sol et saut --------------------------------------------
    const ground = this.world.groundHeight(this.position.x, this.position.z, this.position.y, this.stepHeight);
    if (this.grounded && this.input.isDown('jump')) {
      this.velocity.y = 3.1;
      this.grounded = false;
    }
    if (!this.grounded || this.position.y > ground + 0.001) {
      this.velocity.y -= this.gravity * dt;
      this.position.y += this.velocity.y * dt;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velocity.y = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    } else {
      // Montée d'une petite marche
      this.position.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
    }
    // Sécurité : jamais sous le sol ni hors de la scène.
    if (!Number.isFinite(ground) && this.position.y < -1) {
      this.onFellOut?.();
      this.reset();
      return;
    }

    // --- Balancement de la tête et pas -----------------------------------
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    const moving = this.grounded && hs > 0.2;
    this.bobAmount = damp(this.bobAmount, moving ? Math.min(1, hs / 2.2) : 0, 8, dt);
    if (moving) {
      this.bobPhase += dt * (5.5 + hs * 2.2);
      this.stepTimer += dt * hs;
      if (this.stepTimer > 0.72) { this.stepTimer = 0; this.onFootstep?.(); }
    }
    this.applyCamera(dt);
  }

  private applyCamera(dt: number) {
    const target = this.position.y + this.eyeHeight;
    // Lissage vertical (marches) sans retard horizontal
    this.eyeY = dt > 0 ? damp(this.eyeY, target, 18, dt) : target;
    const bob = Math.sin(this.bobPhase * 2) * 0.022 * this.bobAmount;
    const sway = Math.cos(this.bobPhase) * 0.012 * this.bobAmount;
    const c = this.camera;
    c.position.set(
      this.position.x + Math.cos(this.yaw) * sway,
      this.eyeY + bob,
      this.position.z - Math.sin(this.yaw) * sway,
    );
    c.rotation.set(this.pitch, this.yaw, 0);
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }
}
