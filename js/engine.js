// De motor: één canvas over het hele scherm, een lus, scènes (met overgangen) en invoer.
// Logische eenheden: het spel is minstens 720 breed en 540 hoog; de kortste kant past precies.
import { ui } from './ui.js';
import { C } from './draw.js';

export const MIN_W = 720, BASE_H = 540;

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.stack = []; // scènes; de bovenste krijgt de invoer
    this.fade = null; // {t, dir, next}
    this.t = 0;
    this.last = 0;
    this.keyHandlers = [];
    this.resize();
    addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    // Scherpte: hoogstens 2x, en nooit meer dan ~3 miljoen pixels (anders wordt elke frame te duur op grote schermen).
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1, Math.sqrt(3.2e6 / (w * h))));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.min(h / BASE_H, w / MIN_W);
    this.VW = w / this.scale;
    this.VH = h / this.scale;
    this.dpr = dpr;
    for (const s of this.stack) s.resize?.(this.VW, this.VH);
  }

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / this.scale, (e.clientY - r.top) / this.scale];
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => ui.pointerMove(...this.toLogical(e)));
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      c.setPointerCapture?.(e.pointerId);
      const [x, y] = this.toLogical(e);
      this.top()?.pointer?.('down', x, y);
      ui.pointerDown(x, y);
    });
    c.addEventListener('pointerup', (e) => {
      const [x, y] = this.toLogical(e);
      this.top()?.pointer?.('up', x, y);
      ui.pointerUp(x, y);
    });
    c.addEventListener('pointercancel', () => { ui.down = false; ui.pressId = null; ui.dragId = null; });
    c.addEventListener('pointerleave', () => ui.pointerLeave());
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = this.toLogical(e);
      ui.wheel(x, y, e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY);
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) { this.top()?.key?.(e); return; }
      if (this.fade) return;
      const s = this.top();
      if (s?.key?.(e)) { e.preventDefault(); return; }
      if (ui.key(e)) { e.preventDefault(); return; }
      if (e.code === 'Escape' && s?.back) { e.preventDefault(); ui.sound('back'); s.back(); return; }
      for (const h of this.keyHandlers) if (h(e)) { e.preventDefault(); return; }
    });
    addEventListener('keyup', (e) => this.top()?.keyUp?.(e));
  }

  top() { return this.stack[this.stack.length - 1]; }

  // Naar een andere scène, met een korte overgang (zwart in en uit).
  go(scene) {
    if (this.fade) { this.fade.next = scene; return; }
    if (!this.stack.length) { this.stack = [scene]; this.enter(scene); return; }
    this.fade = { t: 0, dir: 1, next: scene };
  }
  push(scene) { this.stack.push(scene); this.enter(scene); }
  pop(scene) {
    const s = scene || this.top();
    const i = this.stack.indexOf(s);
    if (i < 0) return;
    this.stack.splice(i, 1);
    s.leave?.();
    this.top()?.resumeFocus?.();
  }
  enter(s) {
    s.t = 0;
    s.engine = this;
    s.resize?.(this.VW, this.VH);
    s.enter?.();
    ui.focusId = null;
  }

  start() {
    const loop = (ms) => {
      requestAnimationFrame(loop);
      const t = ms / 1000;
      const dt = Math.min(0.05, this.last ? t - this.last : 0);
      this.last = t;
      this.t += dt;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    const g = this.g, k = this.dpr * this.scale;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.imageSmoothingEnabled = true;
    ui.beginFrame(g, this.VW, this.VH, this.t, dt);

    if (this.fade) {
      const f = this.fade;
      f.t += dt / 0.22;
      if (f.dir === 1 && f.t >= 1) {
        for (const s of this.stack) s.leave?.();
        this.stack = [f.next];
        this.enter(f.next);
        f.dir = -1; f.t = 0;
      } else if (f.dir === -1 && f.t >= 1) this.fade = null;
    }

    // onderste scène die alles bedekt, en alles erboven
    let from = this.stack.length - 1;
    while (from > 0 && this.stack[from].overlay) from--;
    for (let i = from; i < this.stack.length; i++) {
      const s = this.stack[i], isTop = i === this.stack.length - 1;
      s.t += dt;
      s.update?.(dt, isTop);
      ui.enabled = isTop && !this.fade;
      g.save();
      s.draw(g, this.VW, this.VH, isTop);
      g.restore();
    }
    ui.enabled = true;

    if (this.fade) {
      const a = this.fade.dir === 1 ? this.fade.t : 1 - this.fade.t;
      g.fillStyle = C.night;
      g.globalAlpha = Math.max(0, Math.min(1, a));
      g.fillRect(0, 0, this.VW, this.VH);
      g.globalAlpha = 1;
    }
    ui.endFrame();
    const cur = ui.cursor;
    if (this.canvas.style.cursor !== cur) this.canvas.style.cursor = cur;
  }
}

// ---------- volledig scherm ----------
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export const canFullscreen = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
export function toggleFullscreen() {
  if (isFullscreen()) return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try { req?.call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch {}
}
