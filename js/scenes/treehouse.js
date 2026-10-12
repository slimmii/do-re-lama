// De lama-boomhut: de lama rust uit in haar eigen kamer. Inrichten doe je in de winkel (afdeling Boomhut).
// Klik op de lama (springen), op een huisdier (hartjes) of op een gitaar aan de muur (akkoordje). De huisdieren wandelen elk op hun eigen tempo rond. Met "Slapen" gaat het licht uit: de lama wandelt
// naar haar bed en springt erin (als er van dat bed een versie met de slapende lama is, anders slaapt ze rechtop).
// Met "Eten" open je de voorraadkast: tik op iets en het vliegt naar de lama, die het opeet. Heeft ze honger, dan zegt ze dat.
import { ui } from '../ui.js';
import { C, text, clamp, rr, icon } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { drawLlama, drawParticle } from '../lama-style.js';
import { drawRoom, drawFoliage, fitRoom, furnished, placedIds, restingPose, sleepImage, HOUSE_ITEM } from '../treehouse.js';
import { topBar, speech, heartsMeter } from './common.js';
import { happiness, isSad } from '../tuning.js';
import { mood, fullness, isHungry, isFull, eat, pantryList, pantryCount, drawFood } from '../food.js';

const FLOOR = 0.955; // waar de pootjes van de lama staan (breuk van de kamer)
const WALK = [0.42, 0.62]; // tussen het bed en het tafeltje
const PET_WALK = [0.15, 0.86]; // de huisdieren lopen vooraan, over de hele vloer
const BED_SIDE = 0.46;

/**
 * De lama in de kamer R tekenen. st: {lx (plaats, breuk), dir, walking, hop (s sinds de sprong, < 0: niet),
 * t, pace (hoe snel de pootjes gaan)}. Geeft het klikgebied en de plek van het hoofd [x, y, schaal] terug.
 */
export function drawRoomLama(g, R, st) {
  const A = app.A, m = A.meta, t = st.t;
  let sheet = 'walk', i = st.walking ? Math.floor(t * m.walk.fps * (st.pace ?? 0.7)) % m.walk.frames : 0, lift = 0;
  if (st.hop >= 0) {
    const u = Math.min(1, st.hop / 0.8), j = m.jump;
    sheet = 'jump';
    i = Math.round(u < 0.5 ? j.takeoff + (u / 0.5) * (j.apex - j.takeoff) : j.apex + ((u - 0.5) / 0.5) * (j.land - j.apex));
    lift = R.h * 0.12 * 4 * u * (1 - u);
  }
  const s = (R.h * 0.3) / m.standH, sm = m[sheet];
  const cx = R.x + st.lx * R.w, by = R.y + FLOOR * R.h;
  g.fillStyle = 'rgba(40,20,10,.18)';
  g.beginPath(); g.ellipse(cx, by, 40 * s - lift * 0.1, 7 * s, 0, 0, Math.PI * 2); g.fill();
  g.save();
  if (st.dir < 0) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
  const out = { ...S.wallet.outfit };
  delete out.trail;
  drawLlama(g, A, sheet, i, cx - sm.anchorX * s, by + 3 * s - lift - sm.cellH * s, s, out, t);
  g.restore();
  const top = by - lift - sm.cellH * s;
  return { rect: { x: cx - 50 * s, y: top + 20 * s, w: 100 * s, h: sm.cellH * s - 20 * s }, head: [cx + st.dir * 30 * s, top + 30 * s, s] };
}

// Grijs regenwolkje (boven het hoofd van een droevige lama).
export function rainCloud(g, x, y, s, t) {
  g.save();
  g.strokeStyle = 'rgba(120,170,230,.85)'; g.lineWidth = 2.5 * s; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const k = (t * 1.6 + i * 0.27) % 1, dx = (i - 1.5) * 9 * s;
    g.globalAlpha = 1 - k;
    g.beginPath(); g.moveTo(x + dx, y + 8 * s + k * 26 * s); g.lineTo(x + dx - 2 * s, y + 14 * s + k * 26 * s); g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = '#b9b3c6'; g.strokeStyle = C.ink; g.lineWidth = 2.5;
  g.beginPath();
  g.arc(x - 14 * s, y + 2 * s, 9 * s, Math.PI * 0.5, Math.PI * 1.5);
  g.arc(x - 4 * s, y - 6 * s, 11 * s, Math.PI, Math.PI * 1.9);
  g.arc(x + 11 * s, y - 1 * s, 9 * s, Math.PI * 1.3, Math.PI * 0.5);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

export class TreehouseScene {
  constructor() {
    this.lx = 0.55; this.dir = 1; // plaats (breuk) en kijkrichting
    this.target = null; this.wait = 1.2;
    this.hop = -1; // tijd sinds de sprong (< 0: niet aan het springen)
    this.sleep = false; this.night = 0;
    this.inBed = false; this.intoBed = false; // ligt in bed / is aan het in bed springen
    this.bedHead = null; // plek van het hoofd op het kussen (voor de zzz)
    this.parts = [];
    this.zT = 0;
    this.swing = {}; // id → hoe hard een gitaar nog schommelt
    this.pets = {}; // id → {x, dir, target, wait, step, hop}: de rondwandelende huisdieren
    this.say = null; // {text, life}: tekstballon bij de lama
    this.tray = false; // de voorraadkast is open
    this.flying = null; // {f, x, y, t}: eten dat naar de lama vliegt
    this.hungerT = 1.5; // binnen zoveel seconden zegt de lama dat ze honger heeft
    this.moodT = 0;
  }

  enter() { this.happy = mood(S); this.sad = isSad(this.happy); this.hungry = isHungry(S.food); this.tuneSad = isSad(happiness(S.tune)); }
  resumeFocus() { this.enter(); } // terug van het stemmen: opnieuw berekenen

  tune() { app.engine.push(app.scenes.tune()); }
  games() { app.engine.push(app.scenes.games()); }

  back() { app.engine.go(app.scenes.title()); }

  key(e) {
    if (e.code === 'KeyZ') { this.toggleSleep(); return true; }
    if (e.code === 'KeyS') { this.tune(); return true; }
    if (e.code === 'KeyG') { this.games(); return true; }
    if (e.code === 'KeyE') { this.toggleTray(); return true; }
    return false;
  }

  bedItem() { return HOUSE_ITEM[furnished(S.house.placed).bed]; }

  toggleTray() {
    if (this.sleep) return;
    this.tray = !this.tray;
    ui.sound(this.tray ? 'open' : 'back');
  }

  shop() { app.engine.push(app.scenes.shop({ section: 'food' })); }

  // tik op iets in de voorraadkast: het vliegt naar de lama
  feed(f, x, y) {
    if (this.flying || this.sleep || this.inBed) return;
    if (pantryCount(S.food, f.id) <= 0) return;
    if (isFull(S.food) && !f.treat) { this.say = { text: 'Ik zit vol! Straks weer. Of iets lekkers als toetje?', life: 3 }; ui.sound('error'); return; }
    this.flying = { f, x, y, t: 0 };
    this.target = null; this.wait = 2.5; // even blijven staan
    ui.sound('tick');
  }

  // het eten is bij de lama: opeten
  swallow(f) {
    const was = isHungry(S.food);
    if (!eat(S.food, f.id)) return;
    persist();
    this.enter();
    ui.sound('eat');
    const [hx, hy, s] = this.lamaHead || [0, 0, 1];
    for (let i = 0; i < 7; i++) this.parts.push({ kind: 'spark', color: ['#f3d27a', '#e8a85a', '#fff3c4'][i % 3], x: hx, y: hy + 10 * s, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60, g: 260, life: 0.6, s: 4 + Math.random() * 3, rot: Math.random() * 3 });
    for (let i = 0; i < 3; i++) this.parts.push({ kind: 'heart', x: hx + (Math.random() - 0.5) * 40 * s, y: hy - 10 * s, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 30, g: 0, life: 1.1 + Math.random() * 0.4, s: 12 + Math.random() * 6 });
    this.parts.push({ kind: 'note', text: 'nom!', color: '#fff', x: hx + 26 * s, y: hy - 6 * s, vx: 14, vy: -30, g: 0, life: 1.2, s: 16 * s + 4 });
    if (f.party) for (let i = 0; i < 40; i++) this.parts.push({ kind: 'confetti', color: ['#ff6f9c', '#ffd23f', '#5cc8ff', '#7ee081', '#b57cff'][i % 5], x: this.room.x + Math.random() * this.room.w, y: this.room.y - 10, vx: (Math.random() - 0.5) * 40, vy: 40 + Math.random() * 60, g: 30, life: 2.5 + Math.random(), s: 8, rot: Math.random() * 6 });
    if (f.treat && this.hop < 0) { this.hop = 0; ui.sound('jump'); } // een sprongetje van plezier
    const full = isFull(S.food);
    this.say = { text: full ? 'Mmm! Nu zit ik vol. Dankjewel!' : f.say || (was && isHungry(S.food) ? `Mmm, ${f.name.toLowerCase()}! Nog wat meer, ik heb nog honger.` : pick(YUM)(f)), life: 2.8 };
    if (full) this.tray = false;
    this.hungerT = 20;
  }

  toggleSleep() {
    this.sleep = !this.sleep;
    this.tray = false;
    this.target = this.sleep ? BED_SIDE : null;
    this.wait = this.sleep ? 0 : 0.6;
    this.intoBed = false;
    if (!this.sleep && this.inBed) { // uit bed springen
      this.inBed = false;
      this.lx = BED_SIDE - 0.06; this.dir = 1;
      this.hop = 0;
      this.wait = 1.2;
    }
    ui.sound(this.sleep ? 'back' : 'start');
  }

  jump() {
    if (this.sleep || this.hop >= 0) return;
    if (this.hungry) { this.say = { text: pick(HUNGRY_SAY), life: 3.5 }; ui.sound('back'); return; }
    if (this.sad && this.tuneSad) { this.say = { text: 'Mijn gitaar klinkt vals… Stem je ze voor mij?', life: 3.5 }; ui.sound('back'); return; }
    this.hop = 0;
    ui.sound('jump');
  }

  pet(id, r) {
    const p = this.pets[id];
    if (p && p.hop < 0) p.hop = 0; // een sprongetje van plezier
    for (let i = 0; i < 5; i++) this.parts.push({ kind: 'heart', x: r.x + r.w * (0.3 + Math.random() * 0.4), y: r.y + 4, vx: (Math.random() - 0.5) * 40, vy: -50 - Math.random() * 40, g: 0, life: 1 + Math.random() * 0.4, s: 12 + Math.random() * 6 });
    ui.sound('heart');
  }

  strum(id, r) {
    this.swing[id] = 0.12;
    for (let i = 0; i < 4; i++) this.parts.push({ kind: 'note', text: i % 2 ? '♪' : '♫', color: ['#fff6c8', '#9fd8ff', '#ffc2d8'][i % 3], x: r.x + r.w * (0.2 + Math.random() * 0.6), y: r.y + r.h * 0.6, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 30, g: 0, life: 1.2, s: 16 + Math.random() * 6 });
    ui.sound('strum');
  }

  update(dt) {
    if ((this.moodT -= dt) <= 0) { this.moodT = 1; this.enter(); } // het buikje loopt langzaam leeg
    if (this.flying && (this.flying.t += dt) >= FLY) { const f = this.flying.f; this.flying = null; this.swallow(f); }
    // honger? dat zegt de lama af en toe zelf
    if (this.hungry && !this.sleep && !this.say && !this.flying && (this.hungerT -= dt) <= 0) {
      this.hungerT = 14 + Math.random() * 8;
      this.say = { text: pick(HUNGRY_SAY), life: 3.5 };
    }
    for (const id of Object.keys(this.swing)) { this.swing[id] *= Math.exp(-1.5 * dt); if (this.swing[id] < 0.002) delete this.swing[id]; }
    this.night += ((this.sleep ? 1 : 0) - this.night) * (1 - Math.exp(-3 * dt));
    if (this.hop >= 0) {
      this.hop += dt;
      if (this.intoBed) { // op weg naar het kussen; halverwege de sprong ligt ze erin
        this.lx -= 0.15 * dt;
        if (this.hop > 0.42) { this.hop = -1; this.intoBed = false; this.inBed = true; this.zT = 0.5; ui.sound('heart'); }
      } else if (this.hop > 0.8) this.hop = -1;
    }
    this.updatePets(dt);
    // rondwandelen: een doel kiezen, ernaartoe stappen, even wachten
    if (this.hop < 0) {
      if (this.target == null) {
        this.wait -= dt;
        if (this.wait <= 0 && !this.sleep) this.target = WALK[0] + Math.random() * (WALK[1] - WALK[0]);
      } else {
        const d = this.target - this.lx;
        if (Math.abs(d) < 0.004) {
          this.target = null;
          this.wait = 1.5 + Math.random() * 3;
          if (this.sleep) {
            this.dir = -1; // naar het bed kijken
            if (sleepImage(this.bedItem())) { this.intoBed = true; this.hop = 0; ui.sound('jump'); }
          }
        } else {
          this.dir = Math.sign(d);
          this.lx += this.dir * Math.min(Math.abs(d), (this.sad ? 0.04 : 0.07) * dt);
        }
      }
    }
    // zzz
    const head = this.inBed ? this.bedHead : this.lamaHead;
    if (this.sleep && this.target == null && !this.intoBed && head) {
      this.zT += dt;
      if (this.zT > 0.9) {
        this.zT = 0;
        const [hx, hy, s] = head;
        this.parts.push({ kind: 'note', text: 'z', color: '#fff', x: hx, y: hy, vx: 10 + Math.random() * 10, vy: -26, g: 0, life: 2, s: 14 * s + Math.random() * 6 });
      }
    }
    if (this.say && (this.say.life -= dt) <= 0) this.say = null;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  // Elk huisdier wandelt op zijn eigen tempo: doel kiezen, ernaartoe, even blijven zitten. 's Nachts slapen ze.
  updatePets(dt) {
    const ids = placedIds(S.house.placed, 'dier').filter((id) => HOUSE_ITEM[id].walk);
    for (const id of Object.keys(this.pets)) if (!ids.includes(id)) delete this.pets[id];
    ids.forEach((id, i) => {
      const p = (this.pets[id] ||= { x: restingPose(i).x, dir: restingPose(i).dir, target: null, wait: 0.5 + Math.random() * 2, step: Math.random() * 6, hop: -1 });
      const w = HOUSE_ITEM[id].walk;
      if (p.hop >= 0) { p.hop += dt; if (p.hop > 0.45) p.hop = -1; }
      if (this.sleep) { p.target = null; return; }
      if (p.target == null) {
        p.wait -= dt;
        if (p.wait <= 0) p.target = PET_WALK[0] + Math.random() * (PET_WALK[1] - PET_WALK[0]);
        return;
      }
      const d = p.target - p.x;
      if (Math.abs(d) < 0.004) { p.target = null; p.wait = 1 + Math.random() * 4; return; }
      p.dir = Math.sign(d);
      p.x += p.dir * Math.min(Math.abs(d), w.speed * dt);
      p.step += dt * (w.hop ? 7 : 12);
    });
  }

  petPose(it) {
    const p = this.pets[it.id];
    if (!p) return null;
    const moving = p.target != null && !this.sleep;
    const w = it.walk;
    let lift = 0;
    if (moving) lift = w.hop ? Math.abs(Math.sin(p.step)) * 0.035 : Math.abs(Math.sin(p.step)) * 0.006; // huppelen of stapjes
    if (p.hop >= 0) lift += 0.05 * 4 * (p.hop / 0.45) * (1 - p.hop / 0.45);
    return { x: p.x, dir: p.dir, lift, moving };
  }

  drawLama(g, R) {
    if (this.inBed) { this.lamaRect = null; return; } // dan zit ze in het beeld van het bed
    const walking = this.target != null && this.hop < 0;
    const r = drawRoomLama(g, R, { lx: this.lx, dir: this.dir, walking, hop: this.hop, t: this.t, pace: this.sad ? 0.45 : 0.7 });
    this.lamaRect = r.rect;
    this.lamaHead = r.head;
  }

  draw(g, VW, VH) {
    const t = this.t;
    drawFoliage(g, VW, VH, t);
    const rects = [];
    const R = fitRoom(8, 64, VW - 16, VH - 64 - 78);
    this.room = R;
    // houten rand rond de kamer
    g.save();
    g.fillStyle = 'rgba(29,16,48,.35)'; g.beginPath(); g.roundRect(R.x - 4, R.y + 2, R.w + 8, R.h + 8, 18); g.fill();
    g.beginPath(); g.roundRect(R.x, R.y, R.w, R.h, 14); g.clip();
    drawRoom(g, R.x, R.y, R.w, R.h, S.house.placed, t, { lama: () => this.drawLama(g, R), night: this.night,
      asleep: this.inBed, onHead: (hx, hy, k) => { this.bedHead = [hx, hy, k * 1.6]; },
      pose: (it) => this.petPose(it), swing: (it) => this.swing[it.id] ?? 0,
      onItem: (it, x, y, w, h) => { if (it.slot === 'dier' || it.slot === 'gitaar') rects.push({ id: it.id, slot: it.slot, x, y, w, h }); } });
    for (const p of this.parts) drawParticle(g, p, app.A.img);
    if (this.sad && !this.sleep && this.lamaRect && this.lamaHead) rainCloud(g, this.lamaHead[0], this.lamaRect.y - 34 * this.lamaHead[2], 1.1 * this.lamaHead[2], t);
    if (!this.tray) this.drawSay(g, R);
    // hoe blij is de lama?
    g.fillStyle = 'rgba(29,16,48,.5)'; g.beginPath(); g.roundRect(R.x + 10, R.y + 10, 158, 36, 18); g.fill();
    heartsMeter(g, R.x + 22, R.y + 16, this.happy, { s: 22, gap: 6 });
    this.drawTummy(g, R.x + 10, R.y + 52, 158, 26);
    g.restore();
    g.beginPath(); g.roundRect(R.x, R.y, R.w, R.h, 14); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();

    // klikken op de lama en de huisdieren
    if (this.lamaRect) ui.region({ id: 'bh:lama', ...this.lamaRect, onClick: () => this.jump(), focus: false });
    for (const r of rects) ui.region({ id: 'bh:pet:' + r.id, x: r.x, y: r.y, w: r.w, h: r.h, onClick: () => (r.slot === 'gitaar' ? this.strum(r.id, r) : this.pet(r.id, r)), focus: false });

    topBar(g, VW, 'Lama-boomhut', () => this.back(), { color: C.green, dark: C.greenD });

    // knoppen onderaan
    const gap = 12, bw = Math.min(210, (VW - 32 - 3 * gap) / 4), by = VH - 66, bx = VW / 2 - bw * 2 - gap * 1.5;
    ui.button('bh:shop', bx, by, bw, 54, 'Inrichten', { icon: 'bag', variant: 'gold', sound: 'open',
      onClick: () => app.engine.push(app.scenes.shop({ section: 'house' })) });
    ui.button('bh:food', bx + bw + gap, by, bw, 54, 'Eten', { icon: 'apple', variant: this.tray ? 'blue' : 'green', sound: 'silent', badge: this.hungry && !this.sleep ? '!' : null,
      disabled: this.sleep, onClick: () => this.toggleTray() });
    ui.button('bh:games', bx + 2 * (bw + gap), by, bw, 54, 'Spelen', { icon: 'play', variant: 'pink', sound: 'open', badge: this.tuneSad ? '!' : null,
      onClick: () => this.games() });
    ui.button('bh:sleep', bx + 3 * (bw + gap), by, bw, 54, this.sleep ? 'Opstaan' : 'Slapen', { icon: this.sleep ? 'star' : 'moon', variant: 'purple',
      onClick: () => this.toggleSleep(), sound: 'silent' });
    if (this.tray && !this.sleep) { this.drawTray(g, R, VW); this.drawSay(g, R); } // het ballonnetje over de kast heen
    if (this.flying) this.drawFlying(g); // boven de kast: het vliegt eruit

    const empty = !S.house.owned.length;
    if (empty && !this.sleep) {
      const a = clamp((t - 0.6) / 0.4, 0, 1);
      g.save(); g.globalAlpha = a;
      text(g, 'Nog wat leeg hier… Koop spulletjes voor de boomhut in de winkel!', VW / 2, R.y + 22, { size: 16, color: '#fff', stroke: C.ink, strokeW: 5, maxW: R.w - 30 });
      g.restore();
    }
  }

  drawSay(g, R) {
    if (this.say && this.lamaHead) speech(g, this.say.text, this.lamaHead[0], (this.lamaRect ? this.lamaRect.y : this.lamaHead[1]) - (this.sad && !this.sleep ? 56 * this.lamaHead[2] : 6), { maxW: Math.min(320, R.w - 24), x0: R.x + 10, x1: R.x + R.w - 10, alpha: Math.min(1, this.say.life * 2) });
  }

  // klein balkje onder de hartjes: hoe vol het buikje is
  drawTummy(g, x, y, w, h) {
    const f = fullness(S.food);
    g.fillStyle = 'rgba(29,16,48,.5)'; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
    icon(g, 'apple', x + 16, y + h / 2, 17, this.hungry ? C.pink : '#ffe9a8');
    const bx = x + 30, bw = w - 42, bh = 10, byy = y + (h - bh) / 2;
    rr(g, bx, byy, bw, bh, 5); g.fillStyle = 'rgba(255,255,255,.25)'; g.fill();
    if (f > 0.01) { rr(g, bx, byy, bw * f, bh, 5); g.fillStyle = this.hungry ? C.pink : C.green; g.fill(); }
  }

  // eten in een boogje naar de mond van de lama
  drawFlying(g) {
    const { f, x, y, t } = this.flying, u = clamp(t / FLY, 0, 1);
    const [hx, hy, s] = this.lamaHead || [x, y, 1];
    const tx = hx + 18 * s * this.dir, ty = hy + 14 * s;
    const px = x + (tx - x) * u, py = y + (ty - y) * u - Math.sin(u * Math.PI) * 120;
    drawFood(g, f, px, py, 44 - 14 * u);
  }

  // de voorraadkast: alles wat je gekocht hebt, onderaan in de kamer
  drawTray(g, R, VW) {
    const list = pantryList(S.food);
    const cell = 70, pad = 14;
    // bovenaan rechts (naast de hartjes), zodat je de lama eronder ziet eten
    const w = Math.min(R.w - 196, 700), perRow = Math.max(1, Math.floor((w - 2 * pad - 130) / cell));
    const rows = clamp(Math.ceil(list.length / perRow), 1, 2), h = 30 + rows * cell + pad;
    const x = R.x + R.w - w - 10, y = R.y + 10;
    ui.region({ id: 'bh:tray', x, y, w, h, focus: false }); // klikken in de kast gaan niet naar de kamer eronder
    rr(g, x, y + 4, w, h, 18); g.fillStyle = 'rgba(29,16,48,.3)'; g.fill();
    rr(g, x, y, w, h, 18); g.fillStyle = '#fff8ec'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    text(g, this.hungry ? 'Voorraadkast · de lama heeft honger!' : 'Voorraadkast', x + pad, y + 17, { size: 15, color: this.hungry ? C.pinkD : C.text, align: 'left' });
    ui.button('bh:buyfood', x + w - pad - 116, y + 30, 116, 46, 'Kopen', { icon: 'bag', variant: 'gold', size: 16, sound: 'open', onClick: () => this.shop() });
    if (!list.length) {
      text(g, 'De kast is leeg. Koop eten in de winkel!', x + pad + (w - 2 * pad - 130) / 2, y + 30 + cell / 2, { size: 16, weight: 800, color: C.muted, maxW: w - 2 * pad - 140 });
      return;
    }
    const ax = x + pad, ay = y + 28, aw = perRow * cell, ah = rows * cell;
    ui.scroll('bh:pantry', ax, ay, aw, ah, Math.ceil(list.length / perRow) * cell, (top) => {
      list.forEach((f, i) => {
        const cx = ax + (i % perRow) * cell, cy = top + Math.floor(i / perRow) * cell;
        const st = ui.region({ id: 'bh:f:' + f.id, x: cx + 3, y: cy + 3, w: cell - 6, h: cell - 6, onClick: () => this.feed(f, cx + cell / 2, cy + cell / 2), sound: 'silent' });
        const hv = ui.anim('bhf' + f.id, st.hover ? 1 : 0, 16);
        rr(g, cx + 3, cy + 3 - hv * 2, cell - 6, cell - 6, 14); g.fillStyle = st.hover ? '#eaf3ff' : '#fff'; g.fill();
        g.lineWidth = 2.5; g.strokeStyle = st.hover ? C.blue : C.paperLine; g.stroke();
        drawFood(g, f, cx + cell / 2, cy + cell / 2 - 4 - hv * 2, 36 * (1 + hv * 0.08));
        text(g, '×' + pantryCount(S.food, f.id), cx + cell - 12, cy + cell - 14, { size: 13, color: C.text, align: 'right' });
      });
    });
  }
}


const FLY = 0.55; // zo lang vliegt het eten naar de lama
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HUNGRY_SAY = ['Ik heb honger! Geef je me iets te eten?', 'Mijn buikje rommelt…', 'Is er nog iets lekkers in de kast?', 'Honger! Een wortel zou fijn zijn.'];
const YUM = [(f) => `Mmm, ${f.name.toLowerCase()}! Lekker!`, () => 'Smakelijk! Dankjewel!', (f) => `Jammie, ${f.name.toLowerCase()}!`, () => 'Mmm! Mag ik er nog eentje?'];
