import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Ctx } from './layout';
import { damp } from '../core/utils';

/**
 * Lumière naturelle : soleil (ombres douces), ciel physique, lumière d'ambiance,
 * mode nuit (étoiles, lune) et reflets calculés depuis la scène elle-même.
 */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly sky: Sky;
  readonly stars: THREE.Points;
  night = false;
  private nightK = 0;
  private cube: THREE.CubeCamera;
  private cubeRT: THREE.WebGLCubeRenderTarget;
  private pmrem: THREE.PMREMGenerator;
  private envIn?: THREE.WebGLRenderTarget;
  private envOut?: THREE.WebGLRenderTarget;
  private sunDir = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer, private ctx: Ctx) {
    // Soleil du matin venant de l'est (entre par la baie vitrée comme sur la photo 2)
    this.sun = new THREE.DirectionalLight(0xfff1de, 3.4);
    const elev = THREE.MathUtils.degToRad(30), azim = THREE.MathUtils.degToRad(18);
    this.sunDir.set(Math.cos(elev) * Math.cos(azim), Math.sin(elev), Math.cos(elev) * Math.sin(azim)).normalize();
    const center = new THREE.Vector3(4.6, 0, 2.2);
    this.sun.position.copy(center).addScaledVector(this.sunDir, 25);
    this.sun.target.position.copy(center);
    this.sun.castShadow = true;
    const q = ctx.quality;
    const sm = q === 'haute' ? 4096 : q === 'moyenne' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    const cam = this.sun.shadow.camera;
    cam.left = -9; cam.right = 9; cam.top = 9; cam.bottom = -9; cam.near = 5; cam.far = 50;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xeef3ff, 0xa49a8c, 0.75);
    scene.add(this.hemi);

    this.sky = new Sky();
    this.sky.scale.setScalar(180);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.5;
    u.rayleigh.value = 1.1;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(100);
    this.sky.userData.noRaycast = true;
    scene.add(this.sky);

    // Étoiles (mode nuit)
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      pos.set([Math.sin(ph) * Math.cos(th) * 85, Math.cos(ph) * 85, Math.sin(ph) * Math.sin(th) * 85], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.userData.noRaycast = true;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.cubeRT = new THREE.WebGLCubeRenderTarget(q === 'basse' ? 64 : 128, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cube = new THREE.CubeCamera(0.05, 120, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    scene.environmentIntensity = 0.9;
  }

  setNight(night: boolean) {
    this.night = night;
  }

  /** Avance la transition jour/nuit. Renvoie true tant qu'elle est en cours. */
  update(dt: number): boolean {
    const target = this.night ? 1 : 0;
    const prev = this.nightK;
    this.nightK = damp(this.nightK, target, 3, dt);
    if (Math.abs(this.nightK - target) < 0.003) this.nightK = target;
    const k = this.nightK;
    this.sun.intensity = 3.4 * (1 - k);
    this.sun.castShadow = k < 0.98;
    this.hemi.intensity = 0.75 * (1 - k) + 0.05 * k;
    this.hemi.color.setRGB(0.93 * (1 - k) + 0.25 * k, 0.95 * (1 - k) + 0.32 * k, 1.0 * (1 - k) + 0.55 * k);
    (this.stars.material as THREE.PointsMaterial).opacity = k;
    this.sky.visible = k < 0.999;
    const u = this.sky.material.uniforms;
    // Le ciel s'assombrit en faisant descendre le soleil sous l'horizon
    const d = this.sunDir.clone();
    d.y = THREE.MathUtils.lerp(this.sunDir.y, -0.25, k);
    u.sunPosition.value.copy(d.normalize()).multiplyScalar(100);
    u.rayleigh.value = 1.1 + k * 2;
    const bg = this.scene.background as THREE.Color | null;
    if (k > 0.98) {
      if (!bg) this.scene.background = new THREE.Color(0x070b16);
    } else if (bg) {
      this.scene.background = null;
    }
    // LED du jardin plus présentes la nuit
    const garden = this.ctx.lights.garden;
    if (garden) garden.boost = 0.18 + 0.82 * k;
    return prev !== this.nightK;
  }

  get nightFactor() {
    return this.nightK;
  }

  /**
   * Recalcule les reflets (IBL) à partir de la scène réelle : une capture
   * à l'intérieur pour l'appartement, une à l'extérieur pour le jardin.
   * Cela fournit aussi un rebond de lumière diffuse crédible.
   */
  captureEnvironment() {
    const scene = this.scene;
    const prevBg = scene.background;
    const capture = (x: number, y: number, z: number) => {
      this.cube.position.set(x, y, z);
      this.cube.update(this.renderer, scene);
      return this.pmrem.fromCubemap(this.cubeRT.texture);
    };
    const oldIn = this.envIn, oldOut = this.envOut;
    this.envOut = capture(6.6, 1.5, 1.6);
    for (const m of this.ctx.outdoorMaterials) {
      const sm = m as THREE.MeshStandardMaterial;
      if (!sm.envMap) sm.needsUpdate = true;
      sm.envMap = this.envOut.texture;
    }
    this.envIn = capture(1.8, 1.45, 2.4);
    scene.environment = this.envIn.texture;
    scene.background = prevBg;
    oldIn?.dispose();
    oldOut?.dispose();
  }

  dispose() {
    this.envIn?.dispose();
    this.envOut?.dispose();
    this.cubeRT.dispose();
    this.pmrem.dispose();
  }
}
