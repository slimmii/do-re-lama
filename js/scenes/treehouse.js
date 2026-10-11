// De lama-boomhut: de lama rust uit in haar eigen kamer. Inrichten doe je in de winkel (afdeling Boomhut).
// Klik op de lama (springen), op een huisdier (hartjes) of op een gitaar aan de muur (akkoordje). De huisdieren wandelen elk op hun eigen tempo rond. Met "Slapen" gaat het licht uit: de lama wandelt
// naar haar bed en springt erin (als er van dat bed een versie met de slapende lama is, anders slaapt ze rechtop).
import { ui } from '../ui.js';
import { C, text, clamp } from '../draw.js';
import { app } from '../app.js';
import { S } from '../store.js';
import { drawLlama, drawParticle } from '../lama-style.js';
import { drawRoom, drawFoliage, fitRoom, furnished, placedIds, restingPose, sleepImage, HOUSE_ITEM } from '../treehouse.js';
import { topBar } from './common.js';

const FLOOR = 0.955; // waar de pootjes van de lama staan (breuk van de kamer)
const WALK = [0.42, 0.62]; // tussen het bed en het tafeltje
const PET_WALK = [0.15, 0.86]; // de huisdieren lopen vooraan, over de hele vloer
const BED_SIDE = 0.46;

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
  }

  back() { app.engine.go(app.scenes.title()); }

  key(e) {
    if (e.code === 'KeyZ') { this.toggleSleep(); return true; }
    return false;
  }

  bedItem() { return HOUSE_ITEM[furnished(S.house.placed).bed]; }

  toggleSleep() {
    this.sleep = !this.sleep;
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
          this.lx += this.dir * Math.min(Math.abs(d), 0.07 * dt);
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
    const A = app.A, m = A.meta, t = this.t;
    const walking = this.target != null && this.hop < 0;
    let sheet = 'walk', i = walking ? Math.floor(t * m.walk.fps * 0.7) % m.walk.frames : 0, lift = 0;
    if (this.hop >= 0) {
      const u = this.hop / 0.8, j = m.jump;
      sheet = 'jump';
      i = Math.round(u < 0.5 ? j.takeoff + (u / 0.5) * (j.apex - j.takeoff) : j.apex + ((u - 0.5) / 0.5) * (j.land - j.apex));
      lift = R.h * 0.12 * 4 * u * (1 - u);
    }
    const s = (R.h * 0.3) / m.standH, sm = m[sheet];
    const cx = R.x + this.lx * R.w, by = R.y + FLOOR * R.h;
    g.fillStyle = 'rgba(40,20,10,.18)';
    g.beginPath(); g.ellipse(cx, by, 40 * s - lift * 0.1, 7 * s, 0, 0, Math.PI * 2); g.fill();
    g.save();
    if (this.dir < 0) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
    const out = { ...S.wallet.outfit };
    delete out.trail;
    drawLlama(g, A, sheet, i, cx - sm.anchorX * s, by + 3 * s - lift - sm.cellH * s, s, out, t);
    g.restore();
    // klikgebied en de plek van het hoofd (voor de zzz)
    const top = by - lift - sm.cellH * s;
    this.lamaRect = { x: cx - 50 * s, y: top + 20 * s, w: 100 * s, h: sm.cellH * s - 20 * s };
    this.lamaHead = [cx + this.dir * 30 * s, top + 30 * s, s];
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
    g.restore();
    g.beginPath(); g.roundRect(R.x, R.y, R.w, R.h, 14); g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();

    // klikken op de lama en de huisdieren
    if (this.lamaRect) ui.region({ id: 'bh:lama', ...this.lamaRect, onClick: () => this.jump(), focus: false });
    for (const r of rects) ui.region({ id: 'bh:pet:' + r.id, x: r.x, y: r.y, w: r.w, h: r.h, onClick: () => (r.slot === 'gitaar' ? this.strum(r.id, r) : this.pet(r.id, r)), focus: false });

    topBar(g, VW, 'Lama-boomhut', () => this.back(), { color: C.green, dark: C.greenD });

    // knoppen onderaan
    const bw = Math.min(250, (VW - 48) / 2), by = VH - 66;
    ui.button('bh:shop', VW / 2 - bw - 8, by, bw, 54, 'Inrichten', { icon: 'bag', variant: 'gold', sound: 'open',
      onClick: () => app.engine.push(app.scenes.shop({ section: 'house' })) });
    ui.button('bh:sleep', VW / 2 + 8, by, bw, 54, this.sleep ? 'Opstaan' : 'Slapen', { icon: this.sleep ? 'star' : 'moon', variant: 'purple',
      onClick: () => this.toggleSleep(), sound: 'silent' });

    const empty = !S.house.owned.length;
    if (empty && !this.sleep) {
      const a = clamp((t - 0.6) / 0.4, 0, 1);
      g.save(); g.globalAlpha = a;
      text(g, 'Nog wat leeg hier… Koop spulletjes voor de boomhut in de winkel!', VW / 2, R.y + 22, { size: 16, color: '#fff', stroke: C.ink, strokeW: 5, maxW: R.w - 30 });
      g.restore();
    }
  }
}
