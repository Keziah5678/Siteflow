/**
 * Gestion des entrées clavier / souris / tactile.
 * Les touches sont reconnues à la fois par position physique (event.code)
 * et par caractère (event.key) : ZQSD (AZERTY) et WASD (QWERTY) fonctionnent
 * tous les deux, quel que soit le clavier.
 */

export type Action = 'forward' | 'back' | 'left' | 'right' | 'run' | 'jump';

const BY_CODE: Record<string, Action> = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
};
const BY_KEY: Record<string, Action> = { z: 'forward', w: 'forward', s: 'back', q: 'left', a: 'left', d: 'right' };

export class Input {
  private held = new Map<string, Action>();
  private lookDX = 0;
  private lookDY = 0;
  /** Vecteur du joystick tactile (x : droite, y : avant), dans [-1, 1]. */
  touchMove = { x: 0, y: 0 };
  touchRun = false;
  enabled = false;
  private listeners: Record<string, Array<() => void>> = {};

  constructor(private canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.held.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && this.enabled) {
        // Filtre les sauts aberrants que certains navigateurs envoient au verrouillage.
        if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
    });
  }

  on(name: string, fn: () => void) {
    (this.listeners[name] ??= []).push(fn);
  }
  private emit(name: string) {
    this.listeners[name]?.forEach((f) => f());
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const action = BY_CODE[e.code] ?? BY_KEY[key];
    if (down) {
      if (action && this.enabled) {
        this.held.set(e.code, action);
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      }
      if (e.repeat) return;
      // Actions ponctuelles
      if (key === 'e') this.emit('interact');
      else if (key === 'r') this.emit('reset');
      else if (key === 'f') this.emit('fullscreen');
      else if (key === 'h') this.emit('help');
      else if (key === 'n') this.emit('daynight');
      else if (key === 'l') this.emit('flashlight');
    } else {
      this.held.delete(e.code);
    }
  }

  isDown(a: Action): boolean {
    for (const v of this.held.values()) if (v === a) return true;
    return false;
  }

  /** Axe avant/arrière et latéral combinant clavier et joystick. */
  axes(): { fwd: number; side: number } {
    let fwd = (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0);
    let side = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    fwd += this.touchMove.y;
    side += this.touchMove.x;
    return { fwd: Math.max(-1, Math.min(1, fwd)), side: Math.max(-1, Math.min(1, side)) };
  }

  addLook(dx: number, dy: number) {
    this.lookDX += dx;
    this.lookDY += dy;
  }

  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = this.lookDY = 0;
    return r;
  }

  clear() {
    this.held.clear();
    this.lookDX = this.lookDY = 0;
    this.touchMove.x = this.touchMove.y = 0;
  }
}
