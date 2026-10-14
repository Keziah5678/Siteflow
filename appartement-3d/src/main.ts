import * as THREE from 'three';
import './ui/styles.css';
import { Renderer, Quality } from './core/Renderer';
import { Sound } from './core/Sound';
import { createMaterials } from './world/materials';
import { buildWorld } from './world/World';
import { Environment } from './world/Environment';
import { Input } from './player/Input';
import { Player } from './player/Player';
import { InteractionSystem } from './interaction/Interactions';
import { UI } from './ui/UI';
import { damp, nextFrame } from './core/utils';

type State = 'loading' | 'start' | 'playing' | 'paused';

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
document.body.classList.toggle('touch', isTouch);

function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('appart3d.' + key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem('appart3d.' + key, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

function pickQuality(): Quality {
  const q = params.get('q') ?? store<string | null>('quality', null);
  if (q === 'haute' || q === 'moyenne' || q === 'basse') return q;
  return isTouch ? 'moyenne' : 'haute';
}

async function main() {
  const ui = new UI(isTouch);
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const quality = pickQuality();
  ui.setQuality(quality);

  const testGl = document.createElement('canvas').getContext('webgl2');
  if (!testGl) {
    ui.fatal("Votre navigateur ne prend pas en charge WebGL 2. Essayez une version récente de Chrome, Firefox, Edge ou Safari.");
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.04, 220);
  const renderer = new Renderer(canvas, scene, camera, quality);
  const sound = new Sound();
  sound.enabled = store('sound', true);

  ui.progress(0.02, 'Génération des textures…');
  const materials = await createMaterials((p, label) => ui.progress(0.05 + p * 0.65, label));

  ui.progress(0.72, "Construction de l'appartement…");
  await nextFrame();
  let envDirty = 0;
  const world = buildWorld(materials, sound, quality, (s) => ui.toast(s), () => { envDirty = 0.35; });
  scene.add(world.root);

  ui.progress(0.8, 'Éclairage et reflets…');
  await nextFrame();
  const env = new Environment(scene, renderer.renderer, world.ctx);
  world.update(1, 0);
  env.update(1);
  env.captureEnvironment();
  env.captureEnvironment(); // second passage = second rebond lumineux

  // Lampe torche (touche L), toujours présente pour éviter les recompilations
  const flashlight = new THREE.SpotLight(0xfff4e0, 0, 12, 0.45, 0.6, 1.5);
  flashlight.position.set(0.15, -0.15, 0);
  flashlight.target.position.set(0, 0, -1);
  camera.add(flashlight, flashlight.target);
  scene.add(camera);

  const input = new Input(canvas);
  const spawn = { position: new THREE.Vector3(1.9, 0, 3.75), yaw: 0, pitch: -0.06 };
  const player = new Player(camera, world.colliders, input, spawn);
  player.sensitivity = store('sens', 1);
  player.walkSpeed = store('speed', 1.55);
  player.invertY = store('invert', false);
  player.onFootstep = () => sound.step();
  const interactions = new InteractionSystem(camera, world.root);

  ui.progress(0.92, 'Compilation des shaders…');
  await nextFrame();
  renderer.renderer.compile(scene, camera);
  renderer.render();
  ui.progress(1, 'Prêt');

  /* ------------------------------ État ------------------------------ */
  let state: State = 'start';
  let pointerLockOK = !isTouch && 'requestPointerLock' in canvas;
  let locked = false;
  let currentZone = '';
  let exposure = 1;

  const setPlaying = () => {
    state = 'playing';
    input.enabled = true;
    ui.showPlaying();
    if (pointerLockOK && !locked) requestLock();
  };
  const setPaused = () => {
    if (state !== 'playing') return;
    state = 'paused';
    input.enabled = false;
    input.clear();
    ui.showPause();
  };
  const requestLock = () => {
    try {
      const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      r?.catch?.(() => onLockError());
    } catch {
      onLockError();
    }
  };
  const onLockError = () => {
    if (!pointerLockOK) return;
    pointerLockOK = false;
    ui.toast('Capture de la souris indisponible ici : maintenez le clic gauche et glissez pour regarder.');
  };
  document.addEventListener('pointerlockerror', onLockError);
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && state === 'playing') setPaused();
  });

  const reset = () => {
    player.reset();
    ui.toast('Retour au point de départ');
  };
  const toggleNight = () => {
    env.setNight(!env.night);
    ui.setNight(env.night);
    ui.toast(env.night ? 'Mode nuit' : 'Mode jour');
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      if (state === 'playing' && pointerLockOK && !locked) requestLock();
    } catch {
      ui.toast("Le plein écran n'est pas disponible sur cet appareil.");
    }
  };
  const interact = () => {
    if (state !== 'playing') return;
    interactions.update();
    interactions.trigger();
  };
  let flashOn = false;
  const toggleFlash = () => {
    if (state !== 'playing') return;
    flashOn = !flashOn;
    flashlight.intensity = flashOn ? 9 : 0;
    sound.click();
  };

  input.on('interact', interact);
  input.on('reset', () => state === 'playing' && reset());
  input.on('fullscreen', () => void fullscreen());
  input.on('help', () => ui.toggleHelp());
  input.on('daynight', () => state === 'playing' && toggleNight());
  input.on('flashlight', toggleFlash);
  window.addEventListener('keydown', (e) => {
    // Sans verrouillage de la souris, Échap ouvre/ferme le menu manuellement.
    if (e.key === 'Escape' && !locked) {
      if (state === 'playing') setPaused();
      else if (state === 'paused') setPlaying();
    }
  });

  // Souris : clic = interagir (si verrouillée) ; sinon glisser pour regarder.
  let dragging = false;
  canvas.addEventListener('mousedown', (e) => {
    if (state !== 'playing') return;
    if (locked) { if (e.button === 0) interact(); return; }
    if (pointerLockOK) { requestLock(); return; }
    dragging = true;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (dragging && !locked && state === 'playing') input.addLook(e.movementX, e.movementY);
  });

  // Tactile : glisser sur l'écran pour regarder
  let lookId = -1, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || state !== 'playing' || lookId !== -1) return;
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    input.addLook((e.clientX - lx) * 1.7, (e.clientY - ly) * 1.7);
    lx = e.clientX; ly = e.clientY;
  });
  const endLook = (e: PointerEvent) => { if (e.pointerId === lookId) lookId = -1; };
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  ui.bind({
    start: () => { sound.click(); setPlaying(); },
    resume: () => setPlaying(),
    menu: () => (state === 'playing' ? (locked ? document.exitPointerLock() : setPaused()) : undefined),
    reset: () => { reset(); if (state === 'paused') setPlaying(); },
    fullscreen: () => void fullscreen(),
    daynight: toggleNight,
    use: interact,
    run: (on) => { input.touchRun = on; },
    joystick: (x, y) => { input.touchMove.x = x; input.touchMove.y = y; },
    sensitivity: (v) => { player.sensitivity = v; save('sens', v); },
    speed: (v) => { player.walkSpeed = v; save('speed', v); },
    sound: (v) => { sound.enabled = v; save('sound', v); },
    invert: (v) => { player.invertY = v; save('invert', v); },
    help: (v) => save('help', v),
    quality: (q) => { save('quality', q); const u = new URL(location.href); u.searchParams.set('q', q); location.href = u.toString(); },
  }, {
    sensitivity: player.sensitivity,
    speed: player.walkSpeed,
    sound: sound.enabled,
    invert: player.invertY,
    help: store('help', true),
  });
  ui.showStart();

  /* ----------------------------- Boucle ----------------------------- */
  const clock = new THREE.Clock();
  let time = 0, frames = 0, fpsTime = 0, fps = 0;
  const showFps = params.has('fps') || params.has('debug');

  const frame = () => {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    if (state === 'playing') player.update(dt);
    world.update(dt, time);
    const transitioning = env.update(dt);
    if (transitioning) envDirty = Math.max(envDirty, 0.05);

    // Pièce courante + adaptation de l'œil (exposition)
    const zone = world.zoneAt(player.position.x, player.position.z);
    if (zone && zone.name !== currentZone) {
      currentZone = zone.name;
      if (state === 'playing') ui.room(zone.name);
    }
    const outdoor = zone?.outdoor ?? false;
    const nk = env.nightFactor;
    const target = outdoor ? 0.62 * (1 - nk) + 1.25 * nk : 1.15 * (1 - nk) + 1.1 * nk;
    exposure = damp(exposure, target, 2.2, dt);
    renderer.exposure = exposure;

    if (state === 'playing') {
      const it = interactions.update();
      ui.prompt(it ? it.label() : null);
    } else {
      ui.prompt(null);
    }

    // Recalcul différé des reflets après un changement d'éclairage
    if (envDirty > 0) {
      envDirty -= dt;
      if (envDirty <= 0 && !transitioning) { env.captureEnvironment(); envDirty = 0; }
      else if (envDirty <= 0) envDirty = 0.05;
    }

    renderer.render();

    frames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      fps = frames / fpsTime;
      frames = 0; fpsTime = 0;
      if (showFps) ui.fps(fps, renderer.renderer.info.render.calls, renderer.renderer.info.render.triangles);
    }
  };
  requestAnimationFrame(frame);

  // Points d'accès pour les tests automatisés et le débogage
  (window as unknown as Record<string, unknown>).__app = {
    THREE, scene, camera, player, world, env, input, interactions, renderer,
    get state() { return state; },
    get fps() { return fps; },
    get zone() { return currentZone; },
    start: setPlaying,
    interact,
  };
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('error');
  const txt = document.getElementById('error-text');
  if (el && txt) { txt.textContent = String(err?.message ?? err); el.classList.remove('hidden'); }
});
