// Eten vangen: eten valt uit de lucht langs de zes snaren (die staan hier rechtop, elke snaar is een rij).
// Tokkel de juiste losse snaar als het eten in de blauwe balk is: het eten is gevangen en gaat gratis in de
// voorraadkast. Zonder microfoon tik je op de snaar (of toets 1-6, zoals bij het stemmen: 1 = hoge mi).
import { ui } from '../ui.js';
import { C, text, title, rr, clamp, lerp } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { mic, unlock, sfx, sound, pluck, audioCtx } from '../audio.js';
import { drawParticle } from '../lama-style.js';
import { TUNE_STRINGS } from '../tuning.js';
import { FOODS, addFood, drawFood } from '../food.js';
import { topBar, speech, card, dimScreen } from './common.js';
import { drawRoomLama } from './treehouse.js';

const ROUND = 24; // zoveel eten valt er per ronde
const FALL = 3; // s van de bovenkant tot de blauwe balk
const TOL = 0.3; // s te vroeg of te laat mag nog
const GAP = [1.9, 1.05]; // s tussen twee stuks eten: in het begin, op het einde
const LANES = TUNE_STRINGS; // links de lage mi (6e snaar), rechts de hoge mi (1e snaar), zoals op de gitaar
const OPEN = LANES.map((s) => s.midi);

// Goedkoop eten valt vaker dan duur (een feesttaart is een buitenkansje).
const WEIGHTS = FOODS.map((f) => 1 / Math.pow(f.price, 1.3));
const WSUM = WEIGHTS.reduce((a, b) => a + b, 0);
function randomFood() {
  let r = Math.random() * WSUM;
  for (let i = 0; i < FOODS.length; i++) if ((r -= WEIGHTS[i]) <= 0) return FOODS[i];
  return FOODS[0];
}

// Welke snaar is deze klinkende noot? De lage snaren hoort de meting soms een octaaf te hoog.
function laneOf(midi) {
  let i = OPEN.indexOf(midi);
  if (i < 0 && midi - 12 <= 50) i = OPEN.indexOf(midi - 12);
  return i;
}

const YAY = ['Gevangen!', 'Mmm!', 'Hap!', 'Jammie!', 'Super!', 'Goed zo!'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class CatchScene {
  constructor() {
    this.state = 'ready'; // ready → mic → play → over
    this.stateT = 0;
    this.items = []; // {f, lane, at (audiotijd aan de balk), caught, missed}
    this.vib = LANES.map(() => 0); // hoe hard elke snaar nog trilt
    this.flash = LANES.map(() => 0); // juist-flits per snaar
    this.flying = []; // gevangen eten op weg naar het mandje {f, x, y, t}
    this.parts = [];
    this.got = {}; // id → hoeveel deze ronde
    this.caught = 0; this.streak = 0; this.best = 0;
    this.say = null;
    this.hop = -1;
    this.micOk = null;
    this.lanes = null; // [{x, w}] uit de laatste draw
  }

  enter() { unlock(); mic.setTuning(true); } // de lage mi (82 Hz) moet ook gehoord worden
  leave() {
    mic.listen(null);
    mic.setTuning(false);
    mic.applySettings(); // de gewone spelnoten terug
    sound.quiet = false;
  }

  back() { app.engine.pop(this); }

  now() { return audioCtx().currentTime; }

  async start() {
    if (this.state === 'mic' || this.state === 'play') return;
    unlock();
    this.state = 'mic';
    const ok = await mic.ensure();
    if (app.engine.top() !== this) return;
    this.micOk = ok;
    if (ok) {
      mic.setTuning(true);
      mic.detector.setAllowed(OPEN); // enkel de losse snaren
      mic.setExpect([]);
      mic.listen((ev) => this.onNote(ev));
      sound.quiet = true; // geen geluidjes: de microfoon zou ze voor snaren kunnen houden
    } else sfx('start');
    this.items = [];
    let at = this.now() + FALL + 1, last = -1;
    for (let i = 0; i < ROUND; i++) {
      let lane = Math.floor(Math.random() * LANES.length);
      if (lane === last && Math.random() < 0.6) lane = (lane + 1 + Math.floor(Math.random() * (LANES.length - 1))) % LANES.length;
      this.items.push({ f: randomFood(), lane, at });
      last = lane;
      at += lerp(GAP[0], GAP[1], i / (ROUND - 1));
    }
    this.end = at - lerp(GAP[0], GAP[1], 1) + 1.2;
    this.got = {}; this.caught = 0; this.streak = 0; this.best = 0;
    this.say = { text: ok ? 'Tokkel de snaar als het eten in de blauwe balk is!' : 'Tik op de snaar als het eten in de blauwe balk is!', life: 4 };
    this.state = 'play';
    this.stateT = this.t;
  }

  finish() {
    sound.quiet = false;
    mic.listen(null);
    this.state = 'over';
    this.stateT = this.t;
    this.say = null;
    persist();
    sfx(this.caught === ROUND ? 'win' : this.caught ? 'buy' : 'over');
    if (this.caught === ROUND) this.confetti();
  }

  // Een snaar werd getokkeld (microfoon, tik of toets) op audiotijd `time`.
  strike(lane, time) {
    if (this.state !== 'play') return;
    this.vib[lane] = 1;
    let best = null;
    for (const it of this.items) {
      if (it.lane !== lane || it.caught || it.missed) continue;
      const d = Math.abs(it.at - time);
      if (d <= TOL && (!best || d < Math.abs(best.at - time))) best = it;
    }
    if (best) this.catchItem(best);
    else this.streak = 0; // niets te vangen op die snaar
  }

  onNote(ev) {
    if (ev.attack === false || (ev.fresh != null && ev.fresh < 0.35)) return; // naklinkende snaar
    const lane = laneOf(ev.midi);
    if (lane >= 0) this.strike(lane, ev.time);
  }

  catchItem(it) {
    it.caught = true;
    this.caught++;
    this.streak++;
    this.best = Math.max(this.best, this.streak);
    this.got[it.f.id] = (this.got[it.f.id] || 0) + 1;
    addFood(S.food, it.f.id);
    persist();
    this.flash[it.lane] = 1;
    const x = this.laneX(it.lane), y = this.hitY;
    this.flying.push({ f: it.f, x, y, t: 0 });
    for (let i = 0; i < 8; i++) this.parts.push({ kind: 'spark', color: ['#fff3c4', '#ffd84a', '#9fd8ff'][i % 3], x, y, vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 140, g: 380, life: 0.6, s: 4 + Math.random() * 4, rot: Math.random() * 3 });
    if (this.streak > 0 && this.streak % 5 === 0) this.say = { text: `${this.streak} op een rij!`, life: 1.6 };
    else if (!this.say || this.say.life < 1.2) this.say = { text: pick(YAY), life: 1 };
    if (this.hop < 0) this.hop = 0;
    sfx('coin');
  }

  confetti() {
    for (let i = 0; i < 50; i++) this.parts.push({ kind: 'confetti', color: ['#ff6f9c', '#ffd23f', '#5cc8ff', '#7ee081', '#b57cff'][i % 5], x: Math.random() * (app.engine.VW), y: -10, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80, g: 40, life: 3 + Math.random(), s: 8, rot: Math.random() * 6 });
  }

  key(e) {
    if (e.code === 'Escape') { ui.sound('back'); this.back(); return true; }
    const n = /^(?:Digit|Numpad)([1-6])$/.exec(e.code)?.[1];
    if (n && this.state === 'play') { if (!e.repeat) this.tap(LANES.findIndex((s) => s.n === +n)); return true; }
    if ((e.code === 'Space' || e.code === 'Enter') && !ui.kb && (this.state === 'ready' || this.state === 'over')) { this.start(); return true; }
    return false;
  }

  // Tikken telt meteen bij het neerdrukken (timing!), en je hoort de snaar.
  pointer(phase, x, y) {
    if (phase !== 'down' || this.state !== 'play' || !this.lanes || y < this.area.y || y > this.area.y + this.area.h) return;
    const i = this.lanes.findIndex((l) => x >= l.x && x < l.x + l.w);
    if (i >= 0) this.tap(i);
  }

  tap(lane) {
    if (lane < 0) return;
    const time = this.now();
    pluck(LANES[lane].midi, time);
    this.strike(lane, time);
  }

  update(dt) {
    const now = this.now();
    if (this.state === 'play') {
      for (const it of this.items) {
        if (!it.caught && !it.missed && now - it.at > TOL) { it.missed = true; this.streak = 0; if (!this.say) this.say = { text: 'Oei, gemist!', life: 0.9 }; }
      }
      if (now > this.end) this.finish();
    }
    for (let i = 0; i < LANES.length; i++) { this.vib[i] *= Math.exp(-3.5 * dt); this.flash[i] *= Math.exp(-4 * dt); }
    for (const f of this.flying) f.t += dt;
    this.flying = this.flying.filter((f) => f.t < 0.6);
    if (this.hop >= 0 && (this.hop += dt) > 0.8) this.hop = this.state === 'over' && this.caught === ROUND && this.t - this.stateT < 3 ? 0 : -1;
    if (this.say && (this.say.life -= dt) <= 0) this.say = null;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  laneX(i) { const l = this.lanes[i]; return l.x + l.w / 2; }

  draw(g, VW, VH, isTop) {
    const t = this.t;
    const grd = g.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, '#8fd3ff'); grd.addColorStop(1, '#d9f3c8');
    g.fillStyle = grd; g.fillRect(0, 0, VW, VH);

    const panelW = clamp(VW * 0.26, 190, 300);
    const top = 76, bottom = VH - 16;
    this.area = { x: 16, y: top, w: VW - panelW - 48, h: bottom - top };
    this.drawNeck(g, this.area, t);
    this.drawPanel(g, VW - panelW - 16, top, panelW, bottom - top, t);
    for (const p of this.parts) drawParticle(g, p, app.A.img);

    topBar(g, VW, 'Eten vangen', () => this.back(), { color: C.orange, dark: C.orangeD });

    if (this.state === 'ready' || this.state === 'mic') this.drawIntro(g, VW, VH);
    if (this.state === 'over') this.drawResult(g, VW, VH);
  }

  // De hals van de gitaar met zes rechtopstaande snaren; het eten valt langs de snaren naar de blauwe balk.
  drawNeck(g, A, t) {
    const n = LANES.length, lw = A.w / n;
    this.lanes = LANES.map((_, i) => ({ x: A.x + i * lw, w: lw }));
    const labelH = 58, topY = A.y + 10;
    const hitY = topY + (A.h - labelH - 30) / (1 + TOL / FALL); // de onderkant van de blauwe balk blijft boven de naamkaartjes
    this.hitY = hitY;
    const now = this.now(), speed = (hitY - topY) / FALL;
    // hout
    g.save();
    rr(g, A.x - 4, A.y + 4, A.w + 8, A.h, 20); g.fillStyle = 'rgba(29,16,48,.3)'; g.fill();
    rr(g, A.x, A.y, A.w, A.h, 18);
    const wood = g.createLinearGradient(A.x, 0, A.x + A.w, 0);
    wood.addColorStop(0, '#6b3f22'); wood.addColorStop(0.5, '#8a5530'); wood.addColorStop(1, '#6b3f22');
    g.fillStyle = wood; g.fill();
    g.clip();
    // fretten en stipjes, die zachtjes mee naar beneden schuiven
    const fretGap = 120, off = ((this.state === 'play' ? now : t) * speed * 0.35) % fretGap;
    for (let y = A.y - fretGap + off; y < A.y + A.h; y += fretGap) {
      g.fillStyle = 'rgba(230,220,200,.35)'; g.fillRect(A.x, y, A.w, 4);
      g.fillStyle = 'rgba(255,248,236,.18)';
      g.beginPath(); g.arc(A.x + A.w / 2, y + fretGap / 2, 9, 0, Math.PI * 2); g.fill();
    }
    // blauwe balk
    const band = TOL * speed;
    g.fillStyle = 'rgba(79,151,239,.35)'; g.fillRect(A.x, hitY - band, A.w, band * 2);
    g.fillStyle = 'rgba(79,151,239,.85)'; g.fillRect(A.x, hitY - band, A.w, 3); g.fillRect(A.x, hitY + band - 3, A.w, 3);
    // oplichten waar je nu moet tokkelen
    const ready = new Set(this.state === 'play' ? this.items.filter((it) => !it.caught && !it.missed && Math.abs(it.at - now) <= TOL).map((it) => it.lane) : []);
    this.lanes.forEach((l, i) => {
      const a = Math.max(ready.has(i) ? 0.35 + 0.15 * Math.sin(t * 16) : 0, this.flash[i] * 0.6);
      if (a > 0) { g.fillStyle = `rgba(255,236,140,${a})`; g.fillRect(l.x + 4, A.y, l.w - 8, A.h); }
    });
    // snaren: links dik (omwonden), rechts dun
    this.lanes.forEach((l, i) => {
      const x = l.x + l.w / 2, wound = i < 3, thick = 6.5 - i * 0.9, amp = this.vib[i] * Math.min(10, l.w * 0.12);
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const u = k / 24, y = A.y + u * A.h;
        const dx = amp * Math.sin(Math.PI * u) * Math.sin(t * 70 + i);
        if (k) g.lineTo(x + dx, y); else g.moveTo(x + dx, y);
      }
      g.lineCap = 'round';
      g.lineWidth = thick + 2; g.strokeStyle = 'rgba(29,16,48,.45)'; g.stroke();
      g.lineWidth = thick; g.strokeStyle = wound ? '#d9a65a' : '#e8edf2'; g.stroke();
      if (wound) { g.setLineDash([2, 3]); g.lineWidth = thick * 0.6; g.strokeStyle = '#a8763a'; g.stroke(); g.setLineDash([]); }
    });
    // het eten
    const size = Math.min(lw * 0.62, 56);
    for (const it of this.items) {
      if (it.caught) continue;
      const y = hitY - (it.at - now) * speed;
      if (y < topY - size || y > A.y + A.h + size) continue;
      const x = this.laneX(it.lane);
      const fade = it.missed ? clamp(1 - (now - it.at - TOL) / 0.8, 0, 1) : clamp((y - topY + size) / size, 0, 1);
      if (fade <= 0) continue;
      g.save(); g.globalAlpha = fade;
      g.fillStyle = 'rgba(255,248,236,.85)'; g.beginPath(); g.arc(x, y, size * 0.58, 0, Math.PI * 2); g.fill();
      g.lineWidth = 3; g.strokeStyle = it.missed ? C.greyD : C.ink; g.stroke();
      if (it.missed) g.globalAlpha = fade * 0.5;
      drawFood(g, it.f, x, y, size * 0.72);
      g.restore();
    }
    g.restore();
    rr(g, A.x, A.y, A.w, A.h, 18); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    // naamkaartjes onderaan
    this.lanes.forEach((l, i) => {
      const s = LANES[i], cx = l.x + l.w / 2, cw = Math.min(l.w - 10, 96), y = A.y + A.h - labelH - 8;
      const on = ready.has(i) || this.flash[i] > 0.3;
      rr(g, cx - cw / 2, y, cw, labelH, 14); g.fillStyle = on ? '#fff6c8' : '#fffdf7'; g.fill();
      g.lineWidth = on ? 4 : 3; g.strokeStyle = on ? C.gold : C.ink; g.stroke();
      title(g, s.name, cx, y + labelH * 0.42, Math.min(26, l.w * 0.3), C.cream);
      text(g, this.micOk === false ? `toets ${s.n}` : `${s.n}e snaar`, cx, y + labelH * 0.8, { size: 12, color: C.muted, maxW: cw - 8 });
    });
  }

  // Rechts: de lama met haar mandje en de score.
  drawPanel(g, x, y, w, h, t) {
    rr(g, x, y + 4, w, h, 20); g.fillStyle = 'rgba(29,16,48,.3)'; g.fill();
    rr(g, x, y, w, h, 20); g.fillStyle = 'rgba(255,248,236,.92)'; g.fill(); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    title(g, `${this.caught}`, x + w / 2, y + 40, 44, C.gold);
    text(g, `van de ${ROUND} gevangen`, x + w / 2, y + 74, { size: 15, color: C.muted, maxW: w - 20 });
    const done = this.items.filter((it) => it.caught || it.missed).length;
    rr(g, x + 20, y + 90, w - 40, 10, 5); g.fillStyle = 'rgba(58,35,80,.15)'; g.fill();
    if (this.state !== 'ready') { rr(g, x + 20, y + 90, (w - 40) * (done / ROUND), 10, 5); g.fillStyle = C.green; g.fill(); }
    if (this.streak >= 3) text(g, `${this.streak} op een rij!`, x + w / 2, y + 120, { size: 16, color: C.pinkD });
    // de lama, onderaan in het paneel
    const rh = h * 0.55, R = { x, y: y + h - 70 - rh * 0.955, w, h: rh }; // pootjes net boven het mandje
    g.save(); rr(g, x, y, w, h, 20); g.clip();
    const r = drawRoomLama(g, R, { lx: 0.5, dir: -1, walking: false, hop: this.hop, t });
    g.restore();
    this.head = r.head;
    // mandje met wat ze al ving
    const bx = x + w / 2, by = y + h - 20;
    this.basket = [bx, by - 30];
    const ids = Object.keys(this.got);
    ids.slice(-8).forEach((id, i) => drawFood(g, FOODS.find((f) => f.id === id), bx - 48 + (i % 4) * 32, by - 46 - Math.floor(i / 4) * 18, 26));
    g.fillStyle = '#c98a4a'; g.strokeStyle = C.ink; g.lineWidth = 3;
    g.beginPath(); g.moveTo(bx - 66, by - 40); g.lineTo(bx + 66, by - 40); g.lineTo(bx + 54, by); g.lineTo(bx - 54, by); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(58,35,80,.35)'; g.lineWidth = 2;
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(bx - 66 + k * 4, by - 40 + k * 13); g.lineTo(bx + 66 - k * 4, by - 40 + k * 13); g.stroke(); }
    // gevangen eten vliegt in een boogje naar het mandje
    for (const f of this.flying) {
      const u = clamp(f.t / 0.6, 0, 1), px = lerp(f.x, bx, u), py = lerp(f.y, by - 50, u) - Math.sin(u * Math.PI) * 140;
      drawFood(g, f.f, px, py, 44 - 14 * u);
    }
    if (this.say && this.head && this.state === 'play') speech(g, this.say.text, this.head[0], r.rect.y - 4, { maxW: w - 16, x0: x + 8, x1: x + w - 8, size: 15, alpha: Math.min(1, this.say.life * 3) });
    if (this.micOk === false && this.state === 'play') text(g, 'Geen microfoon: tik op de snaren', x + w / 2, y + 144, { size: 13, color: C.pinkD, maxW: w - 20 });
  }

  drawIntro(g, VW, VH) {
    dimScreen(g, VW, VH, 0.45);
    const w = Math.min(520, VW - 40), h = 330;
    card(g, VW, VH, w, h, this.t, (x, y) => {
      title(g, 'Eten vangen', VW / 2, y + 44, 38, C.orange);
      const lines = [
        'Eten valt uit de lucht langs de snaren.',
        'Tokkel die losse snaar als het eten in de blauwe balk is,',
        'en het gaat gratis in de voorraadkast van de lama!',
        'Geen gitaar bij de hand? Tik op de snaar of druk 1–6.',
      ];
      lines.forEach((l, i) => text(g, l, VW / 2, y + 96 + i * 28, { size: 16, weight: 800, color: i === 3 ? C.muted : C.text, maxW: w - 40 }));
      const bw = (w - 64 - 12) / 2;
      ui.button('cg:back', x + 32, y + h - 84, bw, 56, 'Terug', { icon: 'back', variant: 'paper', sound: 'back', onClick: () => this.back() });
      ui.button('cg:start', x + 32 + bw + 12, y + h - 84, bw, 56, this.state === 'mic' ? 'Even wachten…' : 'Start', { icon: 'play', variant: 'green', disabled: this.state === 'mic', sound: 'silent', onClick: () => this.start() });
    });
  }

  drawResult(g, VW, VH) {
    dimScreen(g, VW, VH, Math.min(0.45, (this.t - this.stateT) * 2));
    const ids = Object.keys(this.got), perRow = 6, rows = Math.max(1, Math.ceil(ids.length / perRow));
    const w = Math.min(520, VW - 40), h = 220 + rows * 64;
    card(g, VW, VH, w, h, this.t - this.stateT, (x, y) => {
      const all = this.caught === ROUND;
      title(g, all ? 'Alles gevangen!' : this.caught ? 'Goed gevangen!' : 'Oei, niets gevangen', VW / 2, y + 44, 34, all ? C.gold : C.cream);
      text(g, this.caught ? `${this.caught} van de ${ROUND}, nu in de voorraadkast.${this.best >= 5 ? ` ${this.best} op een rij!` : ''}` : 'Probeer nog eens: tokkel als het eten in de blauwe balk is.', VW / 2, y + 86, { size: 16, weight: 800, color: C.text, maxW: w - 40 });
      const cell = 64, gx = VW / 2 - (Math.min(ids.length, perRow) * cell) / 2;
      ids.forEach((id, i) => {
        const cx = gx + (i % perRow) * cell + cell / 2, cy = y + 140 + Math.floor(i / perRow) * cell;
        drawFood(g, FOODS.find((f) => f.id === id), cx, cy, 40);
        text(g, '×' + this.got[id], cx + 22, cy + 20, { size: 14, color: C.text, stroke: '#fff', strokeW: 4 });
      });
      const bw = (w - 64 - 12) / 2;
      ui.button('cg:done', x + 32, y + h - 84, bw, 56, 'Naar de lama', { icon: 'home', variant: 'paper', sound: 'back', onClick: () => this.back() });
      ui.button('cg:again', x + 32 + bw + 12, y + h - 84, bw, 56, 'Nog eens', { icon: 'retry', variant: 'green', sound: 'silent', onClick: () => this.start() });
    });
  }
}
