// Pauzemenu (over het spel heen).
import { ui } from '../ui.js';
import { C, title, text } from '../draw.js';
import { app } from '../app.js';
import { card, dimScreen } from './common.js';

export class PauseScene {
  constructor(o) { this.o = o; this.overlay = true; }

  close(fn) { app.engine.pop(this); fn?.(); }
  back() { this.close(this.o.onResume); }
  key(e) {
    if (e.code === 'KeyP' || (e.code === 'Space' && !ui.kb)) { ui.sound('click'); this.back(); return true; }
    return false;
  }

  draw(g, VW, VH) {
    dimScreen(g, VW, VH, Math.min(0.55, this.t * 3));
    const w = 380, h = 372;
    card(g, VW, VH, w, h, this.t, (x, y) => {
      title(g, this.o.title || 'Pauze', VW / 2, y + 44, 40, C.orange);
      const bx = x + 40, bw = w - 80;
      let by = y + 88;
      ui.button('p:go', bx, by, bw, 60, 'Doorgaan', { icon: 'play', primary: true, onClick: () => this.close(this.o.onResume) });
      by += 74;
      if (this.o.onRestart) { ui.button('p:re', bx, by, bw, 52, 'Opnieuw beginnen', { icon: 'retry', variant: 'blue', size: 19, onClick: () => this.close(this.o.onRestart) }); by += 64; }
      ui.button('p:set', bx, by, bw, 52, 'Instellingen', { icon: 'gear', variant: 'paper', size: 19, sound: 'open',
        onClick: () => app.engine.push(app.scenes.settings({ onClose: this.o.onSettings })) });
      by += 64;
      ui.button('p:quit', bx, by, bw, 52, 'Stoppen', { icon: 'home', variant: 'pink', size: 19, onClick: () => this.close(this.o.onQuit), sound: 'back' });
      text(g, 'Esc = doorgaan', VW / 2, y + h - 16, { size: 13, weight: 800, color: C.muted });
    });
  }
}
