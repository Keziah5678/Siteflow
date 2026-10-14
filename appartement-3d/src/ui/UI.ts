import type { Quality } from '../core/Renderer';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface UIHandlers {
  start: () => void;
  resume: () => void;
  menu: () => void;
  reset: () => void;
  fullscreen: () => void;
  daynight: () => void;
  use: () => void;
  run: (on: boolean) => void;
  joystick: (x: number, y: number) => void;
  sensitivity: (v: number) => void;
  speed: (v: number) => void;
  sound: (v: boolean) => void;
  invert: (v: boolean) => void;
  help: (v: boolean) => void;
  quality: (q: Quality) => void;
}

/** Interface discrète : accueil, HUD (réticule, invites, pièces), menu pause, commandes tactiles. */
export class UI {
  private toastTimer = 0;
  private roomTimer = 0;
  private lastPrompt: string | null = '';
  private helpVisible = true;
  private onHelp?: (v: boolean) => void;

  constructor(private touch: boolean) {}

  progress(p: number, label: string) {
    $('load-fill').style.width = `${Math.round(p * 100)}%`;
    $('load-label').textContent = label;
  }

  fatal(msg: string) {
    $('loading').classList.add('hidden');
    $('error-text').textContent = msg;
    $('error').classList.remove('hidden');
  }

  setQuality(q: Quality) {
    ($('sel-quality') as HTMLSelectElement).value = q;
    ($('sel-quality2') as HTMLSelectElement).value = q;
  }

  showStart() {
    $('loading').classList.add('hidden');
    $('start').classList.remove('hidden');
  }

  showPlaying() {
    $('start').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
  }

  showPause() {
    $('pause').classList.remove('hidden');
  }

  setNight(night: boolean) {
    $('btn-daynight').textContent = night ? 'Passer en mode jour' : 'Passer en mode nuit';
  }

  toggleHelp(v = !this.helpVisible) {
    this.helpVisible = v;
    $('help').classList.toggle('hidden', !v);
    ($('chk-help') as HTMLInputElement).checked = v;
    this.onHelp?.(v);
  }

  prompt(text: string | null) {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    $('prompt').classList.toggle('hidden', !text);
    $('crosshair').classList.toggle('active', !!text);
    if (text) $('prompt-text').textContent = this.touch ? ` ${text}` : text;
    $('btn-use').style.opacity = text ? '1' : '0.5';
  }

  room(name: string) {
    const el = $('room');
    el.textContent = name;
    el.classList.add('show');
    clearTimeout(this.roomTimer);
    this.roomTimer = window.setTimeout(() => el.classList.remove('show'), 2200);
  }

  toast(msg: string) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 3200);
  }

  fps(fps: number, calls: number, tris: number) {
    $('fps').textContent = `${fps.toFixed(0)} i/s · ${calls} appels · ${(tris / 1000).toFixed(0)}k tri`;
  }

  bind(h: UIHandlers, init: { sensitivity: number; speed: number; sound: boolean; invert: boolean; help: boolean }) {
    const click = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    click('btn-start', h.start);
    click('btn-resume', h.resume);
    click('btn-menu', h.menu);
    click('btn-reset', h.reset);
    click('btn-reset2', h.reset);
    click('btn-fullscreen', h.fullscreen);
    click('btn-fullscreen2', h.fullscreen);
    click('btn-daynight', h.daynight);
    click('btn-help', () => this.toggleHelp());

    const range = (id: string, out: string, v: number, fmt: (v: number) => string, fn: (v: number) => void) => {
      const el = $(id) as HTMLInputElement;
      el.value = String(v);
      $(out).textContent = fmt(v);
      el.addEventListener('input', () => { const x = parseFloat(el.value); $(out).textContent = fmt(x); fn(x); });
    };
    range('in-sens', 'out-sens', init.sensitivity, (v) => `${v.toFixed(2)}×`, h.sensitivity);
    range('in-speed', 'out-speed', init.speed, (v) => `${(v * 3.6).toFixed(1)} km/h`, h.speed);

    const check = (id: string, v: boolean, fn: (v: boolean) => void) => {
      const el = $(id) as HTMLInputElement;
      el.checked = v;
      el.addEventListener('change', () => fn(el.checked));
    };
    check('chk-sound', init.sound, h.sound);
    check('chk-invert', init.invert, h.invert);
    this.onHelp = h.help;
    check('chk-help', init.help, (v) => this.toggleHelp(v));
    this.toggleHelp(init.help);

    const q1 = $('sel-quality') as HTMLSelectElement, q2 = $('sel-quality2') as HTMLSelectElement;
    const onQ = (el: HTMLSelectElement) => el.addEventListener('change', () => h.quality(el.value as Quality));
    onQ(q1); onQ(q2);

    // Joystick tactile
    const joy = $('joystick'), knob = $('knob');
    let id = -1;
    const R = 46;
    const move = (e: PointerEvent) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      h.joystick(dx / R, -dy / R);
    };
    joy.addEventListener('pointerdown', (e) => { id = e.pointerId; joy.setPointerCapture(id); move(e); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      knob.style.transform = '';
      h.joystick(0, 0);
    };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    const run = $('btn-run');
    let running = false;
    run.addEventListener('click', () => { running = !running; run.classList.toggle('on', running); h.run(running); });
    $('btn-use').addEventListener('click', h.use);
  }
}
