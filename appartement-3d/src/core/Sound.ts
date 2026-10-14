/** Petits effets sonores synthétisés (aucun fichier audio). */
export class Sound {
  private ctx?: AudioContext;
  enabled = true;

  private ac(): AudioContext | undefined {
    if (!this.enabled) return undefined;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return undefined;
    }
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
    const ac = this.ac();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
  }

  click() { this.noise(0.04, 2500, 2, 0.5); }
  door() { this.noise(0.5, 400, 0.8, 0.25, 'lowpass'); }
  slide() { this.noise(0.7, 900, 0.6, 0.12); }
  step() { this.noise(0.07, 180 + Math.random() * 60, 1.2, 0.18, 'lowpass'); }
  beep() {
    const ac = this.ac();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 1760;
    g.gain.setValueAtTime(0.06, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.16);
  }
}
