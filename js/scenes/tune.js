// Gitaar stemmen met de lama: tokkel een losse snaar, de regenboogmeter toont of ze te laag of te hoog klinkt.
// Hou de toon juist tot de ster vol is: de lama springt van plezier. Alle snaren juist = feest (en eens per dag munten).
// De lama in de boomhut is blij zolang de snaren onlangs gestemd zijn (zie tuning.js).
import { ui } from '../ui.js';
import { C, text, title, rr, star, clamp, lerp } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { mic, unlock, sfx } from '../audio.js';
import { drawParticle } from '../lama-style.js';
import { drawRoom, fitRoom } from '../treehouse.js';
import { TUNE_STRINGS, IN_TUNE, HOLD, REWARD, REWARD_EVERY_H, matchString, isSad } from '../tuning.js';
import { topBar, speech, heartsMeter } from './common.js';
import { mood } from '../food.js';
import { drawRoomLama, rainCloud } from './treehouse.js';

const RANGE = 50; // cent links en rechts op de meter
const STALE = 0.5; // s zonder duidelijke toon: niets meer gehoord

export class TuneScene {
  constructor() {
    this.prog = {}; // midi → 0..1: hoe lang de snaar al juist klonk
    this.done = new Set(); // midi van de snaren die deze keer gestemd zijn
    this.pin = null; // snaarnummer dat de speler zelf koos (anders: automatisch)
    this.hist = []; // laatste metingen [{n, cents}]
    this.cur = null; // {string, cents}: wat we nu horen
    this.heardT = -1; // tijd (this.t) van de laatste duidelijke toon
    this.lastFreqAt = 0;
    this.needle = 0; // getoonde cent (vloeiend)
    this.hop = -1; this.dir = 1;
    this.parts = [];
    this.fx = 0; // tijd tot het volgende hartje/noot
    this.flash = null; // {text, life}: na het afvinken van een snaar
    this.finished = null; // {coins, at}
    this.micOk = null;
  }

  enter() {
    unlock();
    mic.setTuning(true); // ook voor een microfoon die pas straks start
    mic.ensure().then((ok) => { this.micOk = ok; });
  }

  leave() { mic.setTuning(false); }

  back() { app.engine.pop(this); }

  key(e) {
    if (e.code === 'Escape') { this.back(); return true; }
    const n = /^Digit([1-6])$/.exec(e.code)?.[1];
    if (n) { this.togglePin(+n); return true; }
    return false;
  }

  togglePin(n) { this.pin = this.pin === n ? null : n; this.hist = []; this.cur = null; }

  complete(s) {
    this.done.add(s.midi);
    this.prog[s.midi] = 1;
    S.tune.at[s.midi] = Date.now();
    this.hop = 0;
    this.burst('heart', 9);
    this.flash = { text: `Mooi! De ${s.n}e snaar (${s.name}) klinkt juist.`, life: 2.2 };
    sfx('heart');
    if (TUNE_STRINGS.every((x) => this.done.has(x.midi))) {
      let coins = 0;
      if (Date.now() - (S.tune.rewardAt || 0) > REWARD_EVERY_H * 3.6e6) {
        coins = REWARD;
        S.wallet.coins += coins;
        S.tune.rewardAt = Date.now();
      }
      this.finished = { coins, at: this.t };
      this.burst('confetti', 40);
      setTimeout(() => sfx(coins ? 'buy' : 'win'), 350);
    }
    persist();
  }

  burst(kind, n) {
    const h = this.head;
    if (!h) return;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 60 + Math.random() * (kind === 'confetti' ? 220 : 90);
      this.parts.push(kind === 'confetti'
        ? { kind, x: h[0], y: h[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, g: 300, life: 1.4, rot: a, s: 7, color: ['#ff5a8a', '#5ec8ff', '#ffe066', '#7ee08a', '#c79bff'][i % 5] }
        : { kind, x: h[0], y: h[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 1 + Math.random() * 0.4, s: 12 + Math.random() * 8 });
    }
  }

  // De meting: elke nieuwe duidelijke toon van de microfoon, de mediaan van de laatste paar.
  listen() {
    if (mic.freqAt !== this.lastFreqAt && mic.freq) {
      this.lastFreqAt = mic.freqAt;
      const m = matchString(mic.freq, this.pin);
      if (m) {
        this.hist.push({ n: m.string.n, cents: m.cents });
        if (this.hist.length > 5) this.hist.shift();
        const n = this.hist[this.hist.length - 1].n;
        const same = this.hist.filter((h) => h.n === n).map((h) => h.cents).sort((a, b) => a - b);
        if (same.length >= 2) {
          this.cur = { string: TUNE_STRINGS.find((s) => s.n === n), cents: same[same.length >> 1] };
          this.heardT = this.t;
        }
      }
    }
    if (this.t - this.heardT > STALE) { this.cur = null; this.hist = []; }
  }

  update(dt) {
    this.listen();
    const c = this.cur;
    if (c) {
      const s = c.string, ok = Math.abs(c.cents) <= IN_TUNE;
      if (!this.done.has(s.midi)) {
        if (ok) { this.prog[s.midi] = (this.prog[s.midi] || 0) + dt / HOLD; if (this.prog[s.midi] >= 1) this.complete(s); }
        else this.prog[s.midi] = Math.max(0, (this.prog[s.midi] || 0) - dt * 0.3);
      }
      this.needle = lerp(this.needle, clamp(c.cents, -RANGE * 1.2, RANGE * 1.2), 1 - Math.exp(-12 * dt));
      // juist: hartjes; anders noten die uit de gitaar komen
      if ((this.fx -= dt) <= 0 && this.head) {
        this.fx = ok ? 0.18 : 0.35;
        const [hx, hy] = this.head;
        this.parts.push(ok
          ? { kind: 'heart', x: hx + (Math.random() - 0.5) * 30, y: hy, vx: (Math.random() - 0.5) * 30, vy: -50, g: 0, life: 1, s: 12 + Math.random() * 5 }
          : { kind: 'note', text: Math.random() < 0.5 ? '♪' : '♫', color: '#fff6c8', x: hx + 40, y: hy + 30, vx: 20 + Math.random() * 20, vy: -40, g: 0, life: 1.1, s: 18 });
      }
    } else this.needle = lerp(this.needle, 0, 1 - Math.exp(-2 * dt));
    if (this.hop >= 0 && (this.hop += dt) > 0.8) this.hop = this.finished && this.t - this.finished.at < 3 ? 0 : -1; // feest: nog even blijven springen
    if (this.flash && (this.flash.life -= dt) <= 0) this.flash = null;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  // Wat de lama zegt.
  hint() {
    if (this.micOk === false) return mic.error || 'Ik kan de microfoon niet gebruiken.';
    if (this.micOk == null) return 'Even de microfoon aanzetten…';
    if (this.finished) return this.finished.coins ? `Hoera! Alle snaren klinken mooi! Hier zijn ${this.finished.coins} munten.` : 'Hoera! Alle snaren klinken mooi!';
    if (this.flash) return this.flash.text;
    const c = this.cur;
    if (!c) {
      if (this.pin) { const s = TUNE_STRINGS.find((x) => x.n === this.pin); return `Tokkel de ${s.n}e snaar (${s.name}). Ik luister!`; }
      return this.done.size ? 'Goed zo! Tokkel nu een andere losse snaar.' : 'Tokkel een losse snaar. Ik luister!';
    }
    const s = c.string;
    if (this.done.has(s.midi) && Math.abs(c.cents) <= IN_TUNE) return `De ${s.name} klinkt al juist. Nu een andere snaar!`;
    if (c.cents < -IN_TUNE) return `${c.cents < -RANGE ? 'Veel te laag' : 'Te laag'}! Draai de ${s.n}e snaar wat strakker.`;
    if (c.cents > IN_TUNE) return `${c.cents > RANGE ? 'Veel te hoog' : 'Te hoog'}! Draai de ${s.n}e snaar wat losser.`;
    return 'Ja! Zo klinkt het mooi. Hou vast…';
  }

  draw(g, VW, VH) {
    const t = this.t;
    g.fillStyle = '#7fc76f'; g.fillRect(0, 0, VW, VH);
    const grd = g.createLinearGradient(0, 0, 0, VH);
    grd.addColorStop(0, '#9fdcff'); grd.addColorStop(1, '#d9f3c8');
    g.fillStyle = grd; g.fillRect(0, 0, VW, VH);

    const top = 76, stringsH = 82, sy = VH - 16 - stringsH, contentH = sy - 14 - top;
    const leftW = Math.round((VW - 48) * 0.5);
    const R = fitRoom(16, top, leftW, contentH);
    R.y = top + contentH - R.h; // onderaan: plaats voor de tekstballon erboven
    this.drawRoom(g, R, t, 16, 16 + leftW);
    this.drawGauge(g, 32 + leftW, top, VW - 48 - leftW, contentH);
    this.drawStrings(g, 16, sy, VW - 32, stringsH);
    // boven het regenwolkje als de lama droevig is
    if (this.head) speech(g, this.hint(), this.head[0], this.lamaTop - (this.sad ? 56 * this.head[2] : 4), { maxW: Math.min(340, leftW - 10), x0: 16, x1: 16 + leftW, size: 17 });
    for (const p of this.parts) drawParticle(g, p, app.A.img); // hartjes en confetti vliegen over de ballon heen

    topBar(g, VW, 'Gitaar stemmen', () => this.back(), { color: C.pink, dark: C.pinkD });
  }

  drawRoom(g, R, t) {
    g.save();
    g.fillStyle = 'rgba(29,16,48,.35)'; g.beginPath(); g.roundRect(R.x - 4, R.y + 2, R.w + 8, R.h + 8, 18); g.fill();
    g.beginPath(); g.roundRect(R.x, R.y, R.w, R.h, 14); g.clip();
    drawRoom(g, R.x, R.y, R.w, R.h, S.house.placed, t, {
      lama: () => {
        const r = drawRoomLama(g, R, { lx: 0.55, dir: 1, walking: false, hop: this.hop, t });
        this.head = r.head; this.lamaTop = r.rect.y;
      },
    });
    const h = mood(S); // de hartjes: gestemde snaren en een vol buikje
    this.sad = isSad(h);
    if (this.sad && this.head) rainCloud(g, this.head[0], this.lamaTop - 34 * this.head[2], 1.1 * this.head[2], t);
    g.fillStyle = 'rgba(29,16,48,.5)'; g.beginPath(); g.roundRect(R.x + 10, R.y + 10, 158, 36, 18); g.fill();
    heartsMeter(g, R.x + 22, R.y + 16, h, { s: 22, gap: 6 });
    g.restore();
    g.beginPath(); g.roundRect(R.x, R.y, R.w, R.h, 14); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
  }

  // Regenboogmeter: links te laag, midden juist (groen), rechts te hoog.
  drawGauge(g, x, y, w, h) {
    rr(g, x, y, w, h, 20); g.fillStyle = 'rgba(255,248,236,.92)'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    const c = this.cur, s = c?.string;
    const r = Math.min(w * 0.42, h * 0.58), cx = x + w / 2, cy = y + 26 + r;
    const ang = (cents) => Math.PI * 1.5 + (clamp(cents, -RANGE, RANGE) / RANGE) * (Math.PI * 0.42);
    const band = r * 0.26;
    // zones
    const zones = [[-RANGE, -25, '#ff8a8a'], [-25, -IN_TUNE, '#ffc46b'], [-IN_TUNE, IN_TUNE, '#6fdc85'], [IN_TUNE, 25, '#ffc46b'], [25, RANGE, '#ff8a8a']];
    for (const [a, b, col] of zones) {
      g.beginPath(); g.arc(cx, cy, r - band / 2, ang(a), ang(b)); g.lineWidth = band; g.strokeStyle = col; g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, r, ang(-RANGE), ang(RANGE)); g.arc(cx, cy, r - band, ang(RANGE), ang(-RANGE), true); g.closePath();
    g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    // streepjes
    for (let k = -RANGE; k <= RANGE; k += 10) {
      const a = ang(k), r0 = r - band - 4, r1 = r - band - (k % 50 === 0 || k === 0 ? 14 : 9);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.lineWidth = 2; g.strokeStyle = C.inkSoft; g.stroke();
    }
    // onder de uiteinden van de boog, binnen de meter
    const ex = Math.cos(ang(RANGE)) * (r - band / 2), ey = cy + Math.sin(ang(RANGE)) * (r - band / 2) + band / 2 + 18;
    text(g, 'te laag', cx - ex, ey, { size: 15, color: C.muted });
    text(g, 'te hoog', cx + ex, ey, { size: 15, color: C.muted });
    // naald
    const ok = c && Math.abs(c.cents) <= IN_TUNE;
    const a = ang(this.needle);
    g.save();
    g.globalAlpha = c ? 1 : 0.35;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
    g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = C.ink; g.stroke();
    g.lineWidth = 3; g.strokeStyle = ok ? C.green : '#fff'; g.stroke();
    g.restore();
    // knop in het midden met de voortgang (ring) van de snaar die nu klinkt
    const kr = r * 0.2;
    g.beginPath(); g.arc(cx, cy, kr, 0, Math.PI * 2); g.fillStyle = ok ? C.green : '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    const p = s ? (this.prog[s.midi] || 0) : 0;
    if (p > 0) { g.beginPath(); g.arc(cx, cy, kr + 6, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.lineWidth = 6; g.strokeStyle = C.gold; g.lineCap = 'round'; g.stroke(); }
    // welke snaar
    const ny = cy + kr + 30;
    if (this.finished) {
      ui.button('tu:done', cx - 100, ny - 18, 200, 52, 'Klaar', { icon: 'check', variant: 'green', onClick: () => this.back() });
    } else if (s) {
      title(g, s.name, cx, ny + 4, 38, ok ? C.green : C.cream);
      text(g, `${s.n}e snaar`, cx, ny + 36, { size: 16, color: C.muted });
    } else {
      text(g, this.pin ? `${this.pin}e snaar` : 'Tokkel een snaar', cx, ny + 8, { size: 20, color: C.muted });
    }
  }

  // Een kaartje per snaar: tik erop om die snaar vast te zetten (anders herkent hij de snaar zelf).
  drawStrings(g, x, y, w, h) {
    const n = TUNE_STRINGS.length, gap = 10, cw = (w - gap * (n - 1)) / n;
    TUNE_STRINGS.forEach((s, i) => {
      const cx = x + i * (cw + gap);
      const now = this.cur?.string.n === s.n, pinned = this.pin === s.n, done = this.done.has(s.midi);
      const st = ui.region({ id: 'tu:s' + s.n, x: cx, y, w: cw, h, onClick: () => this.togglePin(s.n), sound: 'tick' });
      const hv = ui.anim('tu:s:h' + s.n, st.hover || st.focused ? 1 : 0, 18);
      rr(g, cx, y + 4, cw, h, 16); g.fillStyle = 'rgba(29,16,48,.25)'; g.fill();
      rr(g, cx, y - hv * 2, cw, h, 16);
      g.fillStyle = done ? '#eaffea' : '#fffdf7'; g.fill();
      g.lineWidth = now || pinned ? 5 : 3; g.strokeStyle = pinned ? C.pink : now ? C.blue : C.ink; g.stroke();
      const ty = y - hv * 2;
      text(g, `${s.n}e snaar`, cx + 14, ty + 20, { size: 14, color: C.muted, align: 'left' });
      title(g, s.name, cx + 14, ty + h * 0.62, 30, done ? C.green : C.cream, { align: 'left' });
      // ster die vol loopt
      const sr = Math.min(22, h * 0.3), sx = cx + cw - sr - 12, scy = ty + h / 2;
      star(g, sx, scy, sr, false);
      const p = this.prog[s.midi] || 0;
      if (p > 0) {
        g.save(); g.beginPath(); g.rect(sx - sr - 2, scy + sr + 2 - (2 * sr + 4) * p, 2 * sr + 4, (2 * sr + 4) * p); g.clip();
        star(g, sx, scy, sr, true);
        g.restore();
      }
      if (pinned) text(g, 'vast', cx + cw - 14, ty + 14, { size: 12, color: C.pink, align: 'right' });
      if (st.focused) ui.focusRing(cx, ty, cw, h, 16);
    });
  }
}
