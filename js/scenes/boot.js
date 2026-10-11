// Laadscherm: alles laden, en dan "klik om te beginnen" (dat zet ook het geluid aan).
import { ui } from '../ui.js';
import { C, text, bar, clamp } from '../draw.js';
import { app } from '../app.js';
import { drawLogo } from './logo.js';
import { unlock, sfx } from '../audio.js';
import { canFullscreen, toggleFullscreen, isFullscreen } from '../engine.js';

export class BootScene {
  constructor(load) {
    this.progress = 0;
    this.ready = false;
    this.error = null;
    this.stars = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random() * 0.8, r: 0.6 + Math.random() * 1.6, p: Math.random() * 6 }));
    load((p) => { this.progress = p; }).then(() => { this.ready = true; this.readyT = this.t; }).catch((e) => { this.error = e.message; });
  }

  go(full) {
    if (!this.ready || this.leaving) return;
    this.leaving = true;
    unlock();
    if (full && canFullscreen() && !isFullscreen()) toggleFullscreen();
    setTimeout(() => sfx('start'), 60);
    app.engine.go(app.scenes.title());
  }

  pointer(type) { if (type === 'up' && this.ready && !ui.hit(ui.px, ui.py)) this.go(true); }
  key(e) {
    if (!this.ready) return false;
    if (e.code === 'Enter' || e.code === 'Space') { this.go(true); return true; }
    return false;
  }

  draw(g, VW, VH) {
    const t = this.t;
    const gr = g.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, '#1d1630'); gr.addColorStop(0.6, '#3b2a63'); gr.addColorStop(1, '#6b4a8a');
    g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
    for (const s of this.stars) {
      g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.p));
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(s.x * VW, s.y * VH, s.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    // heuvels
    g.fillStyle = '#2a1f45';
    g.beginPath(); g.moveTo(0, VH);
    for (let x = 0; x <= VW; x += 20) g.lineTo(x, VH - 90 - Math.sin(x / 140) * 30 - Math.sin(x / 57) * 10);
    g.lineTo(VW, VH); g.fill();
    drawLogo(g, VW / 2, VH * 0.36, 1, t);

    const bw = 360, bx = (VW - bw) / 2, by = VH * 0.66;
    if (this.error) {
      text(g, 'Er ging iets mis bij het laden', VW / 2, by, { size: 24, color: C.pink, stroke: C.ink });
      text(g, this.error, VW / 2, by + 34, { size: 16, color: '#fff' });
      text(g, 'Start het spel via start.command (een lokale server), niet door index.html te openen.', VW / 2, by + 60, { size: 15, weight: 700, color: '#cbbfe0' });
      return;
    }
    if (!this.ready) {
      bar(g, bx, by, bw, 22, this.progress, { color: C.orange, back: 'rgba(255,255,255,.15)' });
      text(g, 'Laden…', VW / 2, by + 48, { size: 18, color: '#cbbfe0' });
      return;
    }
    const k = clamp((t - this.readyT) / 0.4, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    g.globalAlpha = k;
    ui.button('boot:start', VW / 2 - 150, by - 10, 300, 66, 'Spelen', { icon: 'play', onClick: () => this.go(true), primary: true, size: 30, sound: 'silent' });
    text(g, canFullscreen() ? 'klik of druk op Enter · het spel gaat op volledig scherm' : 'tik of druk op Enter', VW / 2, by + 92, { size: 16, weight: 800, color: `rgba(255,255,255,${0.55 + pulse * 0.35})` });
    g.globalAlpha = 1;
  }
}
