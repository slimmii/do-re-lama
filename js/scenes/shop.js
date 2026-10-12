// De winkel: munten uitgeven aan spulletjes. Drie afdelingen: de lama aankleden, de boomhut inrichten, en eten
// kopen (dat is op als de lama het opeet; je geeft het haar in de boomhut). Klik op een kaartje om te passen.
import { ui } from '../ui.js';
import { C, text, title, panel, ribbon, rr, icon, star, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist, TEST } from '../store.js';
import { SLOTS, ITEMS, drawLlama, drawParticle, trailParticles, trailRate } from '../lama-style.js';
import { totalStars } from '../lama-journey.js';
import { HOUSE_SLOTS, HOUSE_SLOT, HOUSE_ITEMS, furnished, placedIds, drawRoom, drawFoliage, fitRoom, itemImage } from '../treehouse.js';
import { FOOD_CATS, FOODS, pantryCount, addFood, fullness, isHungry, drawFood } from '../food.js';
import { dimScreen, walletPills, speech } from './common.js';

// De afdelingen. Elke afdeling heeft plekken (tabbladen), spulletjes, en waar bewaard wordt wat je hebt en draagt.
const SECTIONS = {
  lama: { name: 'Lama', slots: SLOTS, items: ITEMS, owned: () => S.wallet.owned, worn: () => S.wallet.outfit, first: 'head' },
  house: { name: 'Boomhut', slots: HOUSE_SLOTS, items: HOUSE_ITEMS, owned: () => S.house.owned, worn: () => S.house.placed, first: 'bed' },
  food: { name: 'Eten', slots: FOOD_CATS, items: FOODS, owned: () => [], worn: () => ({}), first: FOOD_CATS[0].id },
};
const SECTION_ICON = { lama: 'hat', house: 'home', food: 'apple' };

export class ShopScene {
  constructor(o = {}) {
    this.overlay = true;
    this.section = o.section || 'lama';
    this.slot = SECTIONS[this.section].first;
    this.tryOn = null; // {slot, id}
    this.confirm = null; // {id, t}
    this.parts = [];
    this.trailT = 0;
    this.celebrate = 0;
    this.coinBump = 0;
  }

  back() { app.engine.pop(this); }
  leave() { persist(); }

  get sec() { return SECTIONS[this.section]; }
  setSection(id) {
    if (id === this.section) return;
    this.section = id;
    this.slot = SECTIONS[id].first;
    this.tryOn = null; this.confirm = null;
  }

  // wat de lama draagt (met wat je aan het passen bent)
  outfit() {
    const out = { ...S.wallet.outfit };
    if (this.tryOn && this.section === 'lama') { if (this.tryOn.id) out[this.tryOn.slot] = this.tryOn.id; else delete out[this.tryOn.slot]; }
    return out;
  }
  // wat er in de boomhut staat (met wat je aan het passen bent)
  placed() {
    const out = { ...S.house.placed };
    const tr = this.section === 'house' && this.tryOn;
    if (tr && this.isMulti(tr.slot)) out[tr.slot] = tr.id ? this.added(placedIds(out, tr.slot), tr) : []; // erbij zetten
    else if (tr) { if (tr.id) out[tr.slot] = tr.id; else delete out[tr.slot]; }
    return out;
  }
  // plekken waar je meer dingen tegelijk kan hebben (huisdieren): daar zet je dingen erbij of haal je ze weg
  isMulti(slot) { return this.section === 'house' && !!HOUSE_SLOT[slot]?.multi; }
  // iets erbij zetten op een plek met meer dingen; is ze vol (max), dan gaat het oudste weg
  added(ids, it) {
    const max = HOUSE_SLOT[it.slot].max;
    const out = [...ids.filter((id) => id !== it.id), it.id];
    return max ? out.slice(-max) : out;
  }
  isWorn(it) {
    if (!this.isMulti(it.slot)) return this.current(it.slot) === it.id;
    const ids = placedIds(S.house.placed, it.slot);
    return it.id ? ids.includes(it.id) : !ids.length;
  }
  // wat er nu echt op een plek staat of gedragen wordt (in de boomhut telt het basisding mee)
  current(slot) { return (this.section === 'house' ? furnished(S.house.placed)[slot] : S.wallet.outfit[slot]) ?? null; }
  isOwned(it) { return !it.id || (it.house && !it.price && !it.stars) || this.sec.owned().includes(it.id) || (it.stars && totalStars(S.journey) >= it.stars); }

  equip(it) {
    const worn = this.sec.worn();
    if (this.isMulti(it.slot)) {
      const ids = placedIds(worn, it.slot);
      worn[it.slot] = !it.id ? [] : ids.includes(it.id) ? ids.filter((id) => id !== it.id) : this.added(ids, it);
      this.tryOn = null;
      persist();
      return;
    }
    const base = this.section === 'house' ? HOUSE_SLOT[it.slot].base : null;
    if (!it.id) delete worn[it.slot];
    else if (this.current(it.slot) === it.id) { if (!base) delete worn[it.slot]; } // het basisbed kan je niet weghalen
    else worn[it.slot] = it.id;
    this.tryOn = null;
    persist();
  }

  // eten kopen: meteen in de voorraadkast (geen bevestiging: het is goedkoop en je koopt er vaak meer)
  buyFood(it) {
    if (S.wallet.coins < it.price) { ui.sound('error'); return; }
    S.wallet.coins -= it.price;
    addFood(S.food, it.id);
    this.tryOn = { slot: it.slot, id: it.id };
    this.coinBump = 1;
    this.bought = { id: it.id, t: this.t };
    ui.sound('coin');
    persist();
  }

  buy(it) {
    const w = S.wallet, free = w.gifts > 0; // met een cadeaubon krijg je één spulletje naar keuze gratis
    if (it.stars || (!free && w.coins < it.price)) { ui.sound('error'); return; }
    if (this.confirm?.id !== it.id || this.t - this.confirm.t > 3) { this.confirm = { id: it.id, t: this.t }; return; } // eerst bevestigen
    this.confirm = null;
    if (free) w.gifts--;
    else w.coins -= it.price;
    this.sec.owned().push(it.id);
    const worn = this.sec.worn();
    worn[it.slot] = this.isMulti(it.slot) ? this.added(placedIds(worn, it.slot), it) : it.id;
    this.tryOn = null;
    this.celebrate = 1.4;
    this.coinBump = 1;
    ui.sound('buy');
    persist();
  }

  randomize() {
    const worn = this.sec.worn();
    for (const s of this.sec.slots) {
      const mine = this.sec.items.filter((i) => i.slot === s.id && this.isOwned(i));
      if (this.isMulti(s.id)) { worn[s.id] = mine.filter(() => Math.random() < 0.5).map((i) => i.id).slice(0, s.max ?? Infinity); continue; }
      const pick = mine[Math.floor(Math.random() * (mine.length + 1))]; // ook kans op niets
      if (pick) worn[s.id] = pick.id; else delete worn[s.id];
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
    // munten (en sterren) rechtsboven, naast de afdelingsknoppen; is het scherm te smal, dan vallen de sterren weg
    const pw = Math.min(290, w * 0.32), px = x + 18, py = y + 22, ph = h - 40;
    const gx = px + pw + 18, gw = x + w - 18 - gx;
    const nSec = Object.keys(SECTIONS).length;
    const stars = gw - 264 >= nSec * 98;
    walletPills(g, x + w - 40, y + 18, { bump: this.coinBump, stars });
    const gifts = S.wallet.gifts > 0 && this.section !== 'food'; // cadeaubonnen gelden niet voor eten
    const sec = this.sec;

    // voorvertoning links
    if (this.section === 'house') this.drawRoomPreview(g, px, py, pw, ph - 70);
    else if (this.section === 'food') this.drawFoodPreview(g, px, py, pw, ph - 70);
    else this.drawPreview(g, px, py, pw, ph - 70);
    if (gifts) { // nog een gratis spulletje te kiezen
      const str = S.wallet.gifts > 1 ? `${S.wallet.gifts}× gratis!` : '1 gratis!', tw = ui.measure(str, 14) + 40, bob = Math.sin(this.t * 4) * 2;
      rr(g, px + pw - tw - 10, py + 10 + bob, tw, 26, 13); g.fillStyle = C.purple; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      icon(g, 'gift', px + pw - tw + 6, py + 23 + bob, 16, '#fff');
      text(g, str, px + pw - tw / 2 + 2, py + 24 + bob, { size: 14, color: '#fff' });
    }
    if (this.section === 'food') this.drawTummy(g, px, py + ph - 58, pw, 54);
    else ui.button('sh:dice', px, py + ph - 58, pw, 54, 'Verrassing!', { icon: 'dice', variant: 'purple', size: 19, onClick: () => this.randomize() });
    if (TEST) {
      ui.button('sh:tc', px, py + ph - 116, pw / 2 - 4, 44, '+10', { variant: 'gold', size: 16, onClick: () => { S.wallet.coins += 10; } });
      ui.button('sh:to', px + pw / 2 + 4, py + ph - 116, pw / 2 - 4, 44, 'Alles uit', { variant: 'paper', size: 16, onClick: () => { if (this.section === 'house') S.house.placed = {}; else S.wallet.outfit = {}; } });
    }

    // tabbladen
    // afdelingen
    const sw = clamp((gw - (stars ? 264 : 158)) / nSec - 6, 84, 128);
    Object.entries(SECTIONS).forEach(([id, sc], i) => {
      const on = this.section === id;
      ui.button('sh:s' + id, gx + i * (sw + 6), y + 18, sw, 40, sc.name, { icon: SECTION_ICON[id], variant: on ? 'green' : 'paper', size: 15, depth: on ? 2 : 4,
        onClick: () => this.setSection(id), sound: 'tick' });
    });
    // een plek met enkel het basisding (zoals het tafeltje) krijgt pas een tabblad als er iets te kiezen valt
    const slots = sec.slots.filter((s) => !s.base || sec.items.filter((i) => i.slot === s.id).length > 1);
    const tabW = Math.min(110, (gw - 6 * (slots.length - 1)) / slots.length);
    slots.forEach((s, i) => {
      const on = this.slot === s.id;
      const bx = gx + i * (tabW + 6);
      ui.button('sh:t' + s.id, bx, y + 74, tabW, 46, s.name, { variant: on ? 'gold' : 'paper', size: 15, depth: on ? 2 : 4,
        onClick: () => { this.slot = s.id; this.tryOn = null; this.confirm = null; }, sound: 'tick' });
    });


    // kaartjes
    const none = this.section === 'food' || (this.section === 'house' && HOUSE_SLOT[this.slot].base) ? [] : [{ id: null, slot: this.slot, name: this.slot === 'fur' ? 'Crème' : 'Niets', price: 0, house: this.section === 'house' }];
    const items = [...none, ...sec.items.filter((i) => i.slot === this.slot)];
    if (this.section === 'food') { this.drawFoodGrid(g, items, gx, y, gw, h); return; }
    const cols = Math.max(3, Math.floor((gw + 10) / 132)), cw = (gw - 10 * (cols - 1) - 12) / cols, ch = 168;
    const rows = Math.ceil(items.length / cols);
    const ay = y + 134, ah = y + h - 16 - ay;
    rr(g, gx - 6, ay - 6, gw + 12, ah + 12, 16); g.fillStyle = C.paper2; g.fill();
    ui.scroll('sh:grid:' + this.section + ':' + this.slot, gx, ay, gw, ah, rows * (ch + 10) + 4, (top) => {
      items.forEach((it, i) => this.drawCard(g, it, gx + (i % cols) * (cw + 10), top + 4 + Math.floor(i / cols) * (ch + 10), cw, ch));
    });
  }

  // de kaartjes met eten (kleiner dan de spulletjes: er is veel)
  drawFoodGrid(g, items, gx, y, gw, h) {
    const cols = Math.max(3, Math.floor((gw + 10) / 112)), cw = (gw - 10 * (cols - 1) - 12) / cols, ch = 136;
    const rows = Math.ceil(items.length / cols);
    const ay = y + 134, ah = y + h - 16 - ay;
    rr(g, gx - 6, ay - 6, gw + 12, ah + 12, 16); g.fillStyle = C.paper2; g.fill();
    ui.scroll('sh:grid:food:' + this.slot, gx, ay, gw, ah, rows * (ch + 10) + 4, (top) => {
      items.forEach((it, i) => this.drawFoodCard(g, it, gx + (i % cols) * (cw + 10), top + 4 + Math.floor(i / cols) * (ch + 10), cw, ch));
    });
  }

  drawFoodCard(g, it, x, y, w, h) {
    const n = pantryCount(S.food, it.id);
    const trying = this.tryOn?.id === it.id;
    const st = ui.region({ id: 'sh:c:' + it.id, x, y, w, h: h - 40, onClick: () => { this.tryOn = { slot: it.slot, id: it.id }; }, sound: 'tick', focus: false });
    const hv = ui.anim('shh' + it.id, st.hover ? 1 : 0, 16);
    rr(g, x, y + 3, w, h, 16); g.fillStyle = 'rgba(29,16,48,.15)'; g.fill();
    rr(g, x, y - hv * 2, w, h, 16);
    g.fillStyle = trying ? '#eaf3ff' : '#fff'; g.fill();
    g.lineWidth = trying ? 4 : 2.5; g.strokeStyle = trying ? C.blue : C.paperLine; g.stroke();
    // bordje met het eten
    const cx = x + w / 2, cy = y + 40 - hv * 2;
    g.fillStyle = '#f3ece2'; g.beginPath(); g.ellipse(cx, cy + 16, w * 0.36, 9, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 2; g.strokeStyle = C.paperLine; g.stroke();
    const just = this.bought?.id === it.id ? clamp(1 - (this.t - this.bought.t) / 0.4, 0, 1) : 0;
    drawFood(g, it, cx, cy, 42 * (1 + 0.25 * just) * (trying ? 1 + 0.04 * Math.sin(this.t * 6) : 1));
    if (n > 0) { // zoveel heb je er al
      const str = '×' + n, tw = ui.measure(str, 13) + 14;
      rr(g, x + w - tw - 6, y + 6, tw, 22, 11); g.fillStyle = C.green; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
      text(g, str, x + w - 6 - tw / 2, y + 17.5, { size: 13, color: '#fff' });
    }
    if (it.treat) star(g, x + 16, y + 17, 7, true);
    text(g, it.name, cx, y + h - 46, { size: 14, color: C.text, maxW: w - 10 });
    const bx = x + 8, by = y + h - 30, bw = w - 16, bh = 26, label = `${it.price}`;
    ui.button('sh:b:' + it.id, bx, by, bw, bh, label, { variant: 'gold', size: 14, depth: 3, r: 10, onClick: () => this.buyFood(it), disabled: S.wallet.coins < it.price, sound: 'silent' });
    const tw = ui.measure(label, 14);
    g.drawImage(app.A.img.coin, x + w / 2 - tw / 2 - 22, by + 4, 16, 17);
  }

  // hoe vol het buikje van de lama is (onderaan links, in de afdeling Eten)
  drawTummy(g, x, y, w, h) {
    const f = fullness(S.food), hungry = isHungry(S.food);
    rr(g, x, y, w, h, 18); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    text(g, hungry ? 'Buikje: honger!' : 'Buikje', x + 16, y + 16, { size: 14, color: hungry ? C.pinkD : C.text, align: 'left' });
    text(g, `${pantryCountAll()} in de kast`, x + w - 16, y + 16, { size: 13, weight: 800, color: C.muted, align: 'right' });
    rr(g, x + 14, y + 29, w - 28, 14, 7); g.fillStyle = '#eadfd2'; g.fill();
    if (f > 0.01) { rr(g, x + 14, y + 29, (w - 28) * f, 14, 7); g.fillStyle = hungry ? C.pink : C.green; g.fill(); }
    rr(g, x + 14, y + 29, w - 28, 14, 7); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
  }

  // de lama, met in een ballonnetje wat ze van het gekozen eten vindt
  drawFoodPreview(g, x, y, w, h) {
    this.drawPreview(g, x, y, w, h, true);
    const it = this.tryOn && FOODS.find((f) => f.id === this.tryOn.id);
    const str = it ? (it.treat ? `${it.name}! Lekker!` : `Mmm, ${it.name.toLowerCase()}!`) : isHungry(S.food) ? 'Ik heb honger…' : 'Wat zullen we eten?';
    speech(g, str, x + w / 2 + 20, y + h * 0.42, { maxW: w - 20, size: 15, x0: x + 8, x1: x + w - 8 });
    if (it) drawFood(g, it, x + 34, y + h - 34, 40 + 3 * Math.sin(this.t * 4));
  }

  drawPreview(g, x, y, w, h, food = false) {
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
    if (this.tryOn && !food) {
      rr(g, x + 10, y + 10, 84, 26, 13); g.fillStyle = C.blue; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      text(g, 'passen…', x + 52, y + 24, { size: 14, color: '#fff' });
    }
  }

  drawCard(g, it, x, y, w, h) {
    const w0 = S.wallet;
    const owned = this.isOwned(it), free = w0.gifts > 0;
    const worn = this.isWorn(it), multi = this.isMulti(it.slot);
    const labels = (it.house && HOUSE_SLOT[it.slot].labels) || { on: 'Staat er', add: 'Zetten' };
    const trying = this.tryOn && this.tryOn.slot === it.slot && this.tryOn.id === it.id;
    const key = it.id || 'none:' + it.slot;
    const st = ui.region({ id: 'sh:c:' + key, x, y, w, h: h - 46, onClick: () => { this.tryOn = { slot: it.slot, id: it.id }; }, sound: 'tick', focus: false });
    const hv = ui.anim('shh' + key, st.hover ? 1 : 0, 16);
    rr(g, x, y + 3, w, h, 16); g.fillStyle = 'rgba(29,16,48,.15)'; g.fill();
    rr(g, x, y - hv * 2, w, h, 16);
    g.fillStyle = worn ? '#eafbe9' : trying ? '#eaf3ff' : '#fff'; g.fill();
    g.lineWidth = worn || trying ? 4 : 2.5; g.strokeStyle = worn ? C.green : trying ? C.blue : C.paperLine; g.stroke();
    // lama met dit spulletje (of het ding voor de boomhut)
    const A = app.A;
    g.save();
    g.beginPath(); g.roundRect(x + 4, y + 4, w - 8, h - 54, 12); g.clip();
    const cx = x + w / 2;
    if (it.house) this.drawThumb(g, it, x + 4, y + 4, w - 8, h - 54);
    else {
    const out = { ...this.outfit(), [it.slot]: it.id };
    if (!it.id) delete out[it.slot];
    delete out.trail;
    const big = it.slot === 'head' || it.slot === 'eyes';
    if (big) drawLlama(g, A, 'walk', 0, cx - 94, y + 26, 1.15, out, this.t * 0.3); // ingezoomd op het hoofd
    else drawLlama(g, A, 'walk', 0, cx - 42, y + 6, 0.66, out, this.t * 0.3);
    if (it.slot === 'trail' && it.id) {
      const parts = [];
      for (let i = 0; i < 6; i++) parts.push(...trailParticles(it.id, cx - 30 - i * 4, y + 60 + (i % 3) * 6, 0));
      parts.forEach((p, i) => { p.x -= i * 2; p.life = 0.4; drawParticle(g, p, A.img); });
    }
    }
    g.restore();
    if (!owned && it.stars) { // sterrenbeloning
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 4, y + 4, w - 8, h - 54);
    }
    text(g, it.name, cx, y + h - 40, { size: 14.5, color: C.text, maxW: w - 12 });
    // knop
    const bx = x + 8, by = y + h - 30, bw = w - 16, bh = 26;
    let label, variant = 'paper', icn = null, onClick, disabled = false;
    const fixed = it.house && it.id && HOUSE_SLOT[it.slot].base === it.id; // het basisbed blijft staan
    if (worn) { label = it.house ? (it.id ? labels.on : 'Leeg') : 'Aan'; variant = 'green'; icn = 'check'; onClick = () => this.equip(it); disabled = !it.id || fixed; }
    else if (owned) { label = it.house ? (it.id ? labels.add : multi ? 'Alle weg' : 'Weghalen') : it.id ? 'Aandoen' : 'Uitdoen'; variant = 'blue'; onClick = () => this.equip(it); }
    else if (it.stars) { label = `${it.stars} sterren`; variant = 'grey'; disabled = true; }
    else if (this.confirm?.id === it.id && this.t - this.confirm.t < 3) { label = free ? 'Zeker? Gratis' : `Zeker? ${it.price}`; variant = 'pink'; onClick = () => this.buy(it); }
    else if (free) { label = 'Gratis'; variant = 'purple'; icn = 'gift'; onClick = () => this.buy(it); }
    else { label = `${it.price}`; variant = 'gold'; onClick = () => this.buy(it); disabled = w0.coins < it.price; }
    ui.button('sh:b:' + key, bx, by, bw, bh, label, { variant, size: 14, depth: 3, r: 10, onClick, disabled, icon: icn, iconSize: 13, sound: 'tick' });
    if (!owned && !it.stars && !free && !(this.confirm?.id === it.id)) { // muntje voor de prijs
      const tw = ui.measure(label, 14);
      g.drawImage(A.img.coin, x + w / 2 - tw / 2 - 22, by + 4, 16, 17);
    }
    if (it.stars && !owned) star(g, x + w / 2 - ui.measure(label, 14) / 2 - 14, by + 13, 8, true);
  }

  // kaartje van de boomhut: het ding zelf, op een stukje houten muur of vloer
  drawThumb(g, it, x, y, w, h) {
    g.fillStyle = '#e9b77e'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(120,70,30,.12)'; for (let ly = y + 14; ly < y + h; ly += 18) g.fillRect(x, ly, w, 2);
    if (!it.id) { icon(g, 'close', x + w / 2, y + h / 2, 34, 'rgba(90,53,48,.5)'); return; }
    const img = itemImage(it);
    if (!img) return;
    const s = Math.min((w - 16) / img.width, (h - 14) / img.height);
    const k = 1 + (this.tryOn?.id === it.id ? 0.04 * Math.sin(this.t * 6) : 0);
    g.drawImage(img, x + w / 2 - (img.width * s * k) / 2, y + h / 2 - (img.height * s * k) / 2, img.width * s * k, img.height * s * k);
  }

  // voorvertoning van de boomhut, met de lama erin
  drawRoomPreview(g, x, y, w, h) {
    g.save();
    g.beginPath(); g.roundRect(x, y, w, h, 18); g.clip();
    g.translate(x, y);
    drawFoliage(g, w, h, this.t);
    const R = fitRoom(6, 6, w - 12, h - 12);
    const A = app.A, m = A.meta, s = (R.h * 0.3) / m.standH, sm = m.walk;
    const cx = R.x + R.w * (0.55 + 0.06 * Math.sin(this.t * 0.5));
    const i = Math.floor(this.t * m.walk.fps * 0.7) % m.walk.frames;
    drawRoom(g, R.x, R.y, R.w, R.h, this.placed(), this.t, { highlight: this.tryOn?.slot,
      lama: () => { const out = { ...S.wallet.outfit }; delete out.trail; drawLlama(g, A, 'walk', i, cx - sm.anchorX * s, R.y + R.h * 0.955 + 3 * s - sm.cellH * s, s, out, this.t); } });
    if (this.celebrate > 0) {
      this.celebrate -= ui.dt;
      if (Math.random() < 0.6) this.parts.push(...trailParticles('confetti', Math.random() * w, 10, 0));
    }
    for (const p of this.parts) drawParticle(g, p, A.img);
    g.restore();
    g.beginPath(); g.roundRect(x, y, w, h, 18); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
    if (this.tryOn) {
      rr(g, x + 10, y + 10, 84, 26, 13); g.fillStyle = C.blue; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
      text(g, 'passen…', x + 52, y + 24, { size: 14, color: '#fff' });
    }
  }
}

const pantryCountAll = () => Object.values(S.food.pantry).reduce((a, b) => a + b, 0);
