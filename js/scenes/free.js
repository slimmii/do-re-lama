// Vrij oefenen: kies zelf je noten (bv. wat de leerkracht vraagt). Alle bereikte landschappen wisselen af.
// Het tweede tabblad is de liedjesbibliotheek (songs.js).
import { ui } from '../ui.js';
import { C, text, panel, rr, icon, stars as drawStars, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { PRACTICE_NOTES, FRETBOARD, solfegeOf } from '../notes.js';
import { STAR_MIN_NOTES, starsOf } from '../lama-journey.js';
import { miniNote } from '../staff.js';
import { topBar, freeTabs, LIVES } from './common.js';

export class FreeScene {
  enter() { app.backdrop.wander(); }
  update(dt) { app.backdrop.update(dt); }
  back() { app.engine.go(app.scenes.title()); }

  toggle(n) {
    const s = new Set(S.settings.selection);
    s.has(n) ? s.delete(n) : s.add(n);
    S.settings.selection = PRACTICE_NOTES.filter((x) => s.has(x));
    persist();
  }
  set(list) { S.settings.selection = [...list]; persist(); }

  play() {
    if (!S.settings.selection.length) { ui.sound('error'); this.warnT = this.t; return; }
    S.journey.mode = 'vrij';
    S.settings.freeTab = 'notes';
    persist();
    app.engine.go(app.scenes.play({ mode: 'vrij' }));
  }

  key(e) {
    if (e.code === 'Enter' && !ui.kb) { this.play(); return true; }
    return false;
  }

  draw(g, VW, VH) {
    app.backdrop.draw(g, VW, VH, { dim: 0.3 });
    topBar(g, VW, 'Vrij oefenen', () => this.back(), { color: C.blue, dark: C.blueD });
    const sel = new Set(S.settings.selection);
    const w = Math.min(880, VW - 32), h = Math.min(VH - 96, 430);
    const x = (VW - w) / 2, y = 84 + Math.max(0, (VH - 96 - h) / 2) * 0.5;
    const k = ease.out(clamp(this.t / 0.4, 0, 1));
    g.save(); g.globalAlpha = k; g.translate(0, (1 - k) * 30);
    panel(g, x, y, w, h);
    g.restore();
    freeTabs(x + 16, y + 6, 'notes');

    // snelkeuzes
    const qy = y + 12, qh = 34;
    let qx = x + w - 20;
    for (const [id, label, list] of [['none', 'Wissen', []], ['all', 'Alles', PRACTICE_NOTES], ['open', 'Losse snaren', ['D4', 'G4', 'B4', 'E5']]].reverse()) {
      const bw = ui.measure(label, 15) + 30;
      qx -= bw;
      ui.button('f:q' + id, qx, qy, bw, qh, label, { variant: 'paper', size: 15, depth: 3, onClick: () => this.set(list), sound: 'tick' });
      qx -= 8;
    }

    // kaartjes
    const cols = 6, gap = 10, cw = (w - 40 - gap * (cols - 1)) / cols, ch = 118;
    PRACTICE_NOTES.forEach((n, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const cx = x + 20 + c * (cw + gap), cy = y + 58 + r * (ch + gap);
      const on = sel.has(n);
      const st = ui.region({ id: 'f:n' + n, x: cx, y: cy, w: cw, h: ch, onClick: () => this.toggle(n), sound: 'tick' });
      const hv = ui.anim('fh' + n, st.hover || st.focused ? 1 : 0, 16);
      const pr = ui.anim('fp' + n, st.pressed ? 1 : 0, 30);
      g.save();
      g.translate(cx + cw / 2, cy + ch / 2); g.scale(1 + hv * 0.03 - pr * 0.03, 1 + hv * 0.03 - pr * 0.03); g.translate(-cx - cw / 2, -cy - ch / 2);
      rr(g, cx, cy + 4, cw, ch, 16); g.fillStyle = 'rgba(29,16,48,.18)'; g.fill();
      rr(g, cx, cy, cw, ch, 16);
      g.fillStyle = on ? '#fff3e2' : '#fff'; g.fill();
      g.lineWidth = on ? 4 : 2.5; g.strokeStyle = on ? C.orange : C.paperLine; g.stroke();
      miniNote(g, n, cx + 10, cy + 20, cw - 20, 6.5, { ink: on ? C.orangeD : '#6b5a7a' });
      const pos = FRETBOARD[n];
      text(g, solfegeOf(n) + (n === 'G5' || n === 'C5' ? '′' : ''), cx + cw / 2, cy + 70, { size: 24, color: on ? C.orangeD : C.text });
      text(g, `${pos.string}e snaar ${pos.fret ? pos.fret : 'los'}`, cx + cw / 2, cy + 90, { size: 12, weight: 800, color: C.muted });
      drawStars(g, cx + cw / 2, cy + 106, starsOf(S.journey, n), 5.5, 2);
      if (on) {
        g.beginPath(); g.arc(cx + cw - 10, cy + 10, 12, 0, Math.PI * 2); g.fillStyle = C.orange; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
        icon(g, 'check', cx + cw - 10, cy + 10, 15, '#fff', { lw: 3.6 });
      }
      g.restore();
      if (st.focused) ui.focusRing(cx, cy, cw, ch, 16);
    });

    // uitleg over sterren
    const iy = y + 58 + 2 * (ch + gap) + 4;
    const few = sel.size < STAR_MIN_NOTES;
    const warn = this.warnT != null && this.t - this.warnT < 1.5;
    const bad = (few && !S.settings.noGuitar) || warn;
    icon(g, 'info', x + 34, iy + 12, 18, bad ? C.bad : C.muted);
    const tap = S.settings.noGuitar;
    text(g, !sel.size ? 'Kies minstens één noot.' : tap ? `${sel.size} ${sel.size === 1 ? 'noot' : 'noten'} gekozen. Zonder gitaar tik je op de juiste noot; je sterren tellen dan niet mee.`
      : few ? `Kies minstens ${STAR_MIN_NOTES} noten om sterren te verdienen.` : `${sel.size} noten gekozen. Je sterren tellen mee. Er zijn minder munten dan op de reis en geen poortwachters.`,
      x + 52, iy + 13, { size: 14, weight: 800, color: bad ? C.bad : C.muted, align: 'left', maxW: w - 80 });

    // levens + zonder gitaar + start
    const by = y + h - 82, room = w - 40 - 240, lw = Math.round(room * 0.55);
    ui.choice('f:lives', x + 20, by + 4, lw, 62, 'Levens', LIVES, S.settings.lives, (v) => { S.settings.lives = v; persist(); }, { labelW: 90, color: C.pink });
    ui.toggle('f:nog', x + 30 + lw, by + 4, room - lw - 10, 62, 'Zonder gitaar', S.settings.noGuitar, (v) => { S.settings.noGuitar = v; persist(); }, { sub: 'tik de juiste noot aan' });
    ui.button('f:play', x + w - 250, by, 230, 70, 'Spelen', { icon: 'play', primary: true, size: 30, onClick: () => this.play(), disabled: !sel.size, sound: 'silent' });
  }
}
