import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export type Quality = 'haute' | 'moyenne' | 'basse';

/**
 * Rendu WebGL2 : HDR (HalfFloat), MSAA, ombres douces, tone mapping « Khronos PBR Neutral » (couleurs fidèles),
 * halo (bloom) sur les sources lumineuses.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  private composer?: EffectComposer;
  private bloom?: UnrealBloomPass;

  constructor(readonly canvas: HTMLCanvasElement, readonly scene: THREE.Scene, readonly camera: THREE.PerspectiveCamera, readonly quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'basse', powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = quality === 'basse' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.applyPixelRatio();

    if (quality !== 'basse') {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(scene, camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 2.2);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private applyPixelRatio() {
    const max = this.quality === 'haute' ? 2 : this.quality === 'moyenne' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, max));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
  }

  set exposure(v: number) {
    this.renderer.toneMappingExposure = v;
  }
  get exposure() {
    return this.renderer.toneMappingExposure;
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
