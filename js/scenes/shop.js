// De winkel: munten uitgeven aan spulletjes en de lama aankleden. Klik op een kaartje om te passen.
import { ui } from '../ui.js';
import { C, text, title, panel, ribbon, rr, icon, star, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist, TEST } from '../store.js';
import { SLOTS, ITEMS, drawLlama, drawParticle, trailParticles, trailRate } from '../lama-style.js';
import { totalStars } from '../lama-journey.js';
import { dimScreen, walletPills } from './common.js';

export class ShopScene {
  constructor() {
    this.overlay = true;
    this.slot = 'head';
    this.tryOn = null; // {slot, id}
    this.confirm = null; // {id, t}
    this.parts = [];
    this.trailT = 0;
    this.celebrate = 0;
    this.coinBump = 0;
  }

  back() { app.engine.pop(this); }
  leave() { persist(); }

  outfit() {
    const out = { ...S.wallet.outfit };
    if (this.tryOn) { if (this.tryOn.id) out[this.tryOn.slot] = this.tryOn.id; else delete out[this.tryOn.slot]; }
    return out;
  }
  isOwned(it) { return !it.id || S.wallet.owned.includes(it.id) || (it.stars && totalStars(S.journey) >= it.stars); }

  equip(it) {
    const w = S.wallet;
    if (!it.id) delete w.outfit[it.slot];
    else if (w.outfit[it.slot] === it.id) delete w.outfit[it.slot];
    else w.outfit[it.slot] = it.id;
    this.tryOn = null;
    persist();
  }

  buy(it) {
    const w = S.wallet;
    if (it.stars || w.coins < it.price) { ui.sound('error'); return; }
    if (this.confirm?.id !== it.id || this.t - this.confirm.t > 3) { this.confirm = { id: it.id, t: this.t }; return; } // eerst bevestigen
    this.confirm = null;
    w.coins -= it.price;
    w.owned.push(it.id);
    w.outfit[it.slot] = it.id;
    this.tryOn = null;
    this.celebrate = 1.4;
    this.coinBump = 1;
    ui.sound('buy');
    persist();
  }

  randomize() {
    const w = S.wallet;
    for (const s of SLOTS) {
      const mine = ITEMS.filter((i) => i.slot === s.id && this.isOwned(i));
      const pick = mine[Math.floor(Math.random() * (mine.length + 1))]; // ook kans op niets
      if (pick) w.outfit[s.id] = pick.id; else delete w.outfit[s.id];
    }
    this.tryOn = null;
    this.celebrate = 0.5;
    persist();
  }

  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0 && p.x > -20);
    this.coinBump = Math.max(0, this.coinBump - dt * 2);
  }

  draw(g, VW, VH) {
    dimScreen(g, VW, VH, Math.min(0.6, this.t * 3));
    const w = Math.min(980, VW - 24), h = Math.min(500, VH - 34);
    const x = (VW - w) / 2, y = (VH - h) / 2 + 14;
    const k = ease.back(clamp(this.t / 0.3, 0, 1));
    g.save();
    g.globalAlpha = clamp(this.t / 0.12, 0, 1);
    g.translate(VW / 2, VH / 2); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); g.translate(-VW / 2, -VH / 2);
    panel(g, x, y, w, h);
    ribbon(g, 'Lama-winkel', VW / 2, y - 26, { size: 26, color: C.gold, dark: C.goldD });
    g.restore();
    ui.iconButton('sh:close', x + w - 8, y + 8, 48, 'close', { onClick: () => this.back(), variant: 'pink', sound: 'back' });
    walletPills(g, x + w - 40, y + 18, { bump: this.coinBump });

    // voorvertoning links
    const pw = Math.min(290, w * 0.32), px = x + 18, py = y + 22, ph = h - 40;
    this.drawPreview(g, px, py, pw, ph - 70);
    ui.button('sh:dice', px, py + ph - 58, pw, 54, 'Verrassing!', { icon: 'dice', variant: 'purple', size: 19, onClick: () => this.randomize() });
    if (TEST) {
      ui.button('sh:tc', px, py + ph - 116, pw / 2 - 4, 44, '+10', { variant: 'gold', size: 16, onClick: () => { S.wallet.coins += 10; } });
      ui.button('sh:to', px + pw / 2 + 4, py + ph - 116, pw / 2 - 4, 44, 'Alles uit', { variant: 'paper', size: 16, onClick: () => { S.wallet.outfit = {}; } });
    }

    // tabbladen
    const gx = px + pw + 18, gw = x + w - 18 - gx;
    const tabW = Math.min(110, (gw - 6 * 6) / SLOTS.length);
    SLOTS.forEach((s, i) => {
      const on = this.slot === s.id;
      const bx = gx + i * (tabW + 6);
      ui.button('sh:t' + s.id, bx, y + 74, tabW, 46, s.name, { variant: on ? 'gold' : 'paper', size: 15, depth: on ? 2 : 4,
        onClick: () => { this.slot = s.id; this.tryOn = null; this.confirm = null; }, sound: 'tick' });
    });
    text(g, 'Klik op iets om het te passen.', gx, y + 50, { size: 14, weight: 800, color: C.muted, align: 'left' });

    // kaartjes
    const items = [{ id: null, slot: this.slot, name: this.slot === 'fur' ? 'Crème' : 'Niets', price: 0 }, ...ITEMS.filter((i) => i.slot === this.slot)];
    const cols = Math.max(3, Math.floor((gw + 10) / 132)), cw = (gw - 10 * (cols - 1) - 12) / cols, ch = 168;
    const rows = Math.ceil(items.length / cols);
    const ay = y + 134, ah = y + h - 16 - ay;
    rr(g, gx - 6, ay - 6, gw + 12, ah + 12, 16); g.fillStyle = C.paper2; g.fill();
    ui.scroll('sh:grid:' + this.slot, gx, ay, gw, ah, rows * (ch + 10) + 4, (top) => {
      items.forEach((it, i) => this.drawCard(g, it, gx + (i % cols) * (cw + 10), top + 4 + Math.floor(i / cols) * (ch + 10), cw, ch));
    });
  }

  drawPreview(g, x, y, w, h) {
    const t = this.t;
    g.save();
    g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip();
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#9fd8fb'); sky.addColorStop(1, '#e9f6ff');
    g.fillStyle = sky; g.fillRect(x, y, w, h);
    const gy = y + h - 46;
    g.fillStyle = '#8fcf6a'; g.fillRect(x, gy, w, 46);
    g.fillStyle = '#76b955'; for (let gx = x - ((t * 60) % 24); gx < x + w; gx += 24) g.fillRect(gx, gy, 12, 5);
    const A = app.A, m = A.meta, cyc = t % 3.2, jumping = cyc > 2.4;
    let sheet = 'walk', i = Math.floor(t * m.walk.fps) % m.walk.frames, lift = 0;
    if (jumping) {
      const u = (cyc - 2.4) / 0.8, j = m.jump;
      sheet = 'jump';
      i = Math.round(u < 0.5 ? j.takeoff + (u / 0.5) * (j.apex - j.takeoff) : j.apex + ((u - 0.5) / 0.5) * (j.land - j.apex));
      lift = 46 * 4 * u * (1 - u);
    }
    const s = Math.min(1.45, (h - 70) / 170), sm = m[sheet], cx = x + w / 2 + 6;
    g.fillStyle = 'rgba(0,0,0,.14)';
    g.beginPath(); g.ellipse(cx, gy + 3, 50 - lift * 0.3, 8, 0, 0, Math.PI * 2); g.fill();
    const out = this.outfit();
    const dt = ui.dt;
    if (out.trail) {
      this.trailT += dt;
      const r = trailRate(out.trail);
      while (this.trailT > r) { this.trailT -= r; this.parts.push(...trailParticles(out.trail, cx - 40 * s, gy - lift - 70 * s, 60)); }
    }
    if (this.celebrate > 0) {
      this.celebrate -= dt;
      if (Math.random() < 0.6) this.parts.push(...trailParticles('confetti', x + Math.random() * w, y + 10, 0));
    }
    for (const p of this.parts) drawParticle(g, p, A.img);
    drawLlama(g, A, sheet, i, cx - sm.anchorX * s, gy + 3 - lift - sm.cellH * s, s, out, t);
    g.restore();
    g.beginPath(); g.roundRect(x, y, w, h, 18); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    if (this.tryOn) {
      rr(g, x + 10, y + 10, 84, 26, 13); g.fillStyle = C.blue; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      text(g, 'passen…', x + 52, y + 24, { size: 14, color: '#fff' });
    }
  }

  drawCard(g, it, x, y, w, h) {
    const w0 = S.wallet;
    const owned = this.isOwned(it);
    const worn = (w0.outfit[it.slot] ?? null) === it.id;
    const trying = this.tryOn && this.tryOn.slot === it.slot && this.tryOn.id === it.id;
    const key = it.id || 'none:' + it.slot;
    const st = ui.region({ id: 'sh:c:' + key, x, y, w, h: h - 46, onClick: () => { this.tryOn = { slot: it.slot, id: it.id }; }, sound: 'tick', focus: false });
    const hv = ui.anim('shh' + key, st.hover ? 1 : 0, 16);
    rr(g, x, y + 3, w, h, 16); g.fillStyle = 'rgba(29,16,48,.15)'; g.fill();
    rr(g, x, y - hv * 2, w, h, 16);
    g.fillStyle = worn ? '#eafbe9' : trying ? '#eaf3ff' : '#fff'; g.fill();
    g.lineWidth = worn || trying ? 4 : 2.5; g.strokeStyle = worn ? C.green : trying ? C.blue : C.paperLine; g.stroke();
    // lama met dit spulletje
    const A = app.A;
    g.save();
    g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, h - 54, 12); g.clip();
    const out = { ...this.outfit(), [it.slot]: it.id };
    if (!it.id) delete out[it.slot];
    delete out.trail;
    const big = it.slot === 'head' || it.slot === 'eyes';
    const cx = x + w / 2;
    if (big) drawLlama(g, A, 'walk', 0, cx - 94, y + 26, 1.15, out, this.t * 0.3); // ingezoomd op het hoofd
    else drawLlama(g, A, 'walk', 0, cx - 42, y + 6, 0.66, out, this.t * 0.3);
    if (it.slot === 'trail' && it.id) {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push(...trailParticles(it.id, cx - 30 - i * 4, y + 60 + (i % 3) * 6, 0));
      parts.forEach((p, i) => { p.x -= i * 2; p.life = 0.4; drawParticle(g, p, A.img); });
    }
    g.restore();
    if (!owned && it.stars) { // sterrenbeloning
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 4, y + 4, w - 8, h - 54);
    }
    text(g, it.name, cx, y + h - 40, { size: 14.5, color: C.text, maxW: w - 12 });
    // knop
    const bx = x + 8, by = y + h - 30, bw = w - 16, bh = 26;
    let label, variant = 'paper', icn = null, onClick, disabled = false;
    if (worn) { label = it.id ? 'Aan' : 'Aan'; variant = 'green'; icn = 'check'; onClick = () => this.equip(it); disabled = !it.id; }
    else if (owned) { label = it.id ? 'Aandoen' : 'Uitdoen'; variant = 'blue'; onClick = () => this.equip(it); }
    else if (it.stars) { label = `${it.stars} sterren`; variant = 'grey'; disabled = true; }
    else if (this.confirm?.id === it.id && this.t - this.confirm.t < 3) { label = `Zeker? ${it.price}`; variant = 'pink'; onClick = () => this.buy(it); }
    else { label = `${it.price}`; variant = 'gold'; onClick = () => this.buy(it); disabled = w0.coins < it.price; }
    ui.button('sh:b:' + key, bx, by, bw, bh, label, { variant, size: 14, depth: 3, r: 10, onClick, disabled, icon: icn, iconSize: 13, sound: 'tick' });
    if (!owned && !it.stars && !(this.confirm?.id === it.id)) { // muntje voor de prijs
      const tw = ui.measure(label, 14);
      g.drawImage(A.img.coin, x + w / 2 - tw / 2 - 22, by + 4, 16, 17);
    }
    if (it.stars && !owned) star(g, x + w / 2 - ui.measure(label, 14) / 2 - 14, by + 13, 8, true);
  }
}
