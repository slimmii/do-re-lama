// De kaart van de reis: negen landschappen, elk met een nieuwe noot. Kies een bereikt landschap en speel.
import { ui } from '../ui.js';
import { C, text, title, panel, bar, rr, icon, stars as drawStars, clamp, ease, wrap } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { STAGES, GATE_HITS, unlockedNotes, isLastStage, accuracy, ready, starsOf } from '../lama-journey.js';
import { BIOMES } from '../lama-world.js';
import { solfegeOf, describePosition } from '../notes.js';
import { drawLlama } from '../lama-style.js';
import { topBar, circleImage } from './common.js';

export class JourneyScene {
  enter() {
    this.sel = S.journey.at;
    app.backdrop.stay(this.sel);
  }
  update(dt) { app.backdrop.update(dt); }
  back() { app.engine.go(app.scenes.title()); }

  select(i) {
    if (i > S.journey.stage) { ui.sound('error'); this.shakeI = i; this.shakeT = this.t; return; }
    this.sel = i;
    app.backdrop.stay(i);
  }

  play() {
    const j = S.journey;
    j.at = this.sel;
    j.mode = 'reis';
    persist();
    app.engine.go(app.scenes.play({ mode: 'reis' }));
  }

  key(e) {
    if (e.code === 'Enter' && !ui.kb) { this.play(); return true; }
    if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !ui.kb) {
      const i = clamp(this.sel + (e.code === 'ArrowRight' ? 1 : -1), 0, S.journey.stage);
      if (i !== this.sel) { ui.sound('tick'); this.select(i); }
      return true;
    }
    return false;
  }

  nodePos(i, VW, top) {
    const n = STAGES.length, mx = 72;
    const x = mx + (i * (VW - 2 * mx)) / (n - 1);
    const y = top + (i % 2 ? 108 : 22) + Math.sin(i * 1.7) * 8;
    return [x, y];
  }

  draw(g, VW, VH) {
    const j = S.journey, t = this.t;
    app.backdrop.draw(g, VW, VH, { dim: 0.28 });
    topBar(g, VW, 'De reis', () => this.back());

    const top = 128 + Math.max(0, (VH - 540) * 0.25);
    const pos = STAGES.map((_, i) => this.nodePos(i, VW, top));
    // pad
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < pos.length - 1; i++) {
      const [x0, y0] = pos[i], [x1, y1] = pos[i + 1];
      const done = i < j.stage;
      g.beginPath(); g.moveTo(x0, y0);
      g.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1);
      g.lineWidth = 14; g.strokeStyle = 'rgba(29,16,48,.55)'; g.setLineDash([]); g.stroke();
      g.lineWidth = 7;
      g.strokeStyle = done ? C.gold : 'rgba(255,255,255,.7)';
      g.setLineDash(done ? [] : [2, 12]);
      g.lineDashOffset = -t * 20;
      g.stroke();
    }
    g.restore();

    // knooppunten
    STAGES.forEach((st, i) => {
      const [x, y0] = pos[i];
      const locked = i > j.stage, here = i === j.stage, sel = i === this.sel;
      const shake = this.shakeI === i && t - this.shakeT < 0.4 ? Math.sin((t - this.shakeT) * 60) * 5 : 0;
      const x0 = x + shake;
      const r = 34;
      const enter = ease.back(clamp((t - i * 0.04) / 0.4, 0, 1));
      const y = y0 + (1 - enter) * 30;
      const reg = ui.region({ id: 'j:' + i, x: x0 - r - 6, y: y - r - 6, w: 2 * r + 12, h: 2 * r + 40, onClick: () => this.select(i), sound: locked ? 'silent' : 'tick' });
      const hv = ui.anim('jh' + i, reg.hover || reg.focused || sel ? 1 : 0, 14);
      const rr2 = r + hv * 4;
      g.save();
      g.globalAlpha = enter;
      g.beginPath(); g.arc(x0, y + 6, rr2 + 4, 0, Math.PI * 2); g.fillStyle = 'rgba(29,16,48,.4)'; g.fill();
      g.beginPath(); g.arc(x0, y, rr2 + 4, 0, Math.PI * 2);
      g.fillStyle = sel ? C.orange : locked ? '#8f84a0' : i < j.stage ? C.green : C.gold; g.fill();
      g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
      circleImage(g, app.backdrop.world.img[BIOMES[i].id]?.scenery, x0, y, rr2 - 1, 0.35);
      if (locked) {
        g.beginPath(); g.arc(x0, y, rr2 - 1, 0, Math.PI * 2); g.fillStyle = 'rgba(40,28,60,.62)'; g.fill();
        icon(g, 'lock', x0, y, 26, '#e8def0');
      }
      g.beginPath(); g.arc(x0, y, rr2 - 1, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
      if (i < j.stage) { // vinkje
        g.beginPath(); g.arc(x0 + rr2 - 4, y - rr2 + 6, 11, 0, Math.PI * 2); g.fillStyle = C.green; g.fill(); g.lineWidth = 2.5; g.stroke();
        icon(g, 'check', x0 + rr2 - 4, y - rr2 + 6, 15, '#fff', { lw: 3.5 });
      }
      if (here && !isLastStage(i) && ready(j)) icon(g, 'crown', x0 + rr2 - 2, y - rr2 + 4, 22, C.gold);
      // naam + noot
      const notes = locked ? '?' : st.notes.map(solfegeOf).join(' ');
      text(g, st.name.replace(/^(De|Het) /, ''), x0, y + rr2 + 16, { size: 14, color: '#fff', stroke: C.ink, strokeW: 4.5, maxW: 110 });
      text(g, notes, x0, y + rr2 + 33, { size: 13, weight: 900, color: locked ? '#cbbfe0' : C.gold, stroke: C.ink, strokeW: 4 });
      g.restore();
      if (reg.focused) ui.focusRing(x0 - rr2 - 4, y - rr2 - 4, 2 * rr2 + 8, 2 * rr2 + 8, rr2 + 4);
      if (i === this.sel && app.A) { // de lama staat op het gekozen landschap
        const m = app.A.meta, sm = m.walk, s = 0.36, bob = Math.abs(Math.sin(t * 5)) * 4;
        const fr = Math.floor(t * 18) % sm.frames;
        drawLlama(g, app.A, 'walk', fr, x0 - sm.anchorX * s + 2, y - rr2 - 4 - sm.cellH * s - bob, s, S.wallet.outfit, t);
      }
    });

    this.drawInfo(g, VW, VH, top);
  }

  drawInfo(g, VW, VH) {
    const j = S.journey, i = this.sel, st = STAGES[i];
    const w = Math.min(860, VW - 32), h = 172;
    const x = (VW - w) / 2, y = VH - h - 16;
    const k = ease.out(clamp((this.t - 0.15) / 0.4, 0, 1));
    g.save();
    g.translate(0, (1 - k) * 60);
    g.globalAlpha = k;
    panel(g, x, y, w, h, { r: 22 });
    const status = i < j.stage ? 'Al bereikt · opnieuw spelen voor sterren en munten' : i === j.stage ? (isLastStage(i) ? 'Je kent alle noten! Speel verder voor sterren.' : 'Hier ben je nu') : '';
    title(g, st.name, x + 24, y + 30, 28, C.orange, { align: 'left', maxW: w * 0.45 });
    text(g, status, x + 24, y + 58, { size: 14, weight: 800, color: C.muted, align: 'left' });

    // de noten van dit landschap
    text(g, i === 0 ? 'Je begint met:' : 'Nieuwe noot:', x + 24, y + 86, { size: 14, color: C.text, align: 'left' });
    let cx = x + 24;
    for (const n of st.notes) {
      const cw = 96;
      rr(g, cx, y + 98, cw, 62, 12); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = C.blue; g.stroke();
      text(g, solfegeOf(n), cx + cw / 2, y + 116, { size: 22, color: C.cur });
      text(g, describePosition(n), cx + cw / 2, y + 135, { size: 10.5, weight: 800, color: C.muted, maxW: cw - 8 });
      drawStars(g, cx + cw / 2, y + 150, starsOf(j, n), 5.5, 2);
      cx += cw + 8;
    }
    const all = unlockedNotes(i);
    if (all.length > st.notes.length) {
      const lines = wrap(g, `Je speelt met: ${all.map(solfegeOf).join(', ')}`, w * 0.62 - (cx - x) - 10, 14, 800);
      lines.slice(0, 3).forEach((l, k2) => text(g, l, cx + 8, y + 112 + k2 * 19, { size: 14, weight: 800, color: C.text, align: 'left' }));
    }

    // voortgang en spelen
    const rx = x + w - 250;
    if (i === j.stage && !isLastStage(i)) {
      if (ready(j)) {
        icon(g, 'crown', rx + 14, y + 30, 22, C.goldD);
        text(g, 'De poortwachter wacht!', rx + 32, y + 31, { size: 15, color: C.goldD, align: 'left' });
      } else {
        text(g, 'Naar de poortwachter', rx, y + 22, { size: 13, color: C.text, align: 'left' });
        bar(g, rx, y + 34, 226, 16, j.progress / GATE_HITS, { color: C.orange });
        text(g, `${Math.min(j.progress, GATE_HITS)}/${GATE_HITS} juist${j.recent.length ? ` · ${Math.round(accuracy(j.recent) * 100)}% raak` : ''}`, rx, y + 64, { size: 12.5, weight: 800, color: C.muted, align: 'left' });
      }
    } else {
      const best = S.best[`reis:${i}`] || 0;
      if (best) text(g, `Record: ${best} punten`, rx, y + 34, { size: 15, color: C.text, align: 'left' });
    }
    g.restore();
    ui.button('j:play', x + w - 250, y + h - 88, 226, 70, 'Spelen', { icon: 'play', primary: true, size: 30, onClick: () => this.play(), sound: 'silent' });
  }
}
