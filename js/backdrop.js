// Achtergrond van de menu's: de lama wandelt door de landschappen die je al bereikt hebt.
import { World, BIOMES } from './lama-world.js';
import { drawLlama, trailParticles, trailRate, drawParticle } from './lama-style.js';
import { S } from './store.js';

const GROUND_Y = (606 * 540) / 672;

// Kleur van de bovenste rij van een beeld (om de lucht door te trekken op hoge schermen).
const skyCache = new Map();
export function skyColor(img) {
  if (!img) return '#a9d4f5';
  if (skyCache.has(img)) return skyCache.get(img);
  let col = '#a9d4f5';
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 2;
    const o = c.getContext('2d');
    o.drawImage(img, 0, 0, img.width, 4, 0, 0, 16, 2);
    const d = o.getImageData(0, 0, 16, 1).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 16; i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
    col = `rgb(${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)})`;
  } catch {}
  skyCache.set(img, col);
  return col;
}

// Teken een wereld van 540 hoog onderaan het scherm; daarboven loopt de lucht door.
export function fitWorld(g, world, dist, VW, VH, draw) {
  const oy = VH - 540;
  if (oy > 0) {
    const b = world.biomeAt(dist);
    g.fillStyle = skyColor(world.img[b.id]?.scenery);
    g.fillRect(0, 0, VW, oy + 2);
  }
  g.save();
  g.translate(0, oy);
  draw();
  g.restore();
  return oy;
}

export class Backdrop {
  constructor(A) {
    this.A = A;
    this.lay = { W: 960, H: 540, top: 0 };
    this.world = new World(this.lay);
    this.dist = 960;
    this.walk = 0;
    this.speed = 70;
    this.llamaX = 190;
    this.particles = [];
    this.trailT = 0;
    this.ready = this.world.load();
    this.mode = null;
  }

  // Welke landschappen: 'wander' = alle bereikte, of één vast landschap.
  // Zonder sprong: het landschap waar de lama nu is, blijft; het volgende schuift zacht binnen.
  current() { return this.world.route[this.world.segAt(this.dist)].biome; }
  wander() {
    const list = Array.from({ length: S.journey.stage + 1 }, (_, i) => i);
    if (this.mode === 'wander:' + list.length) return;
    this.mode = 'wander:' + list.length;
    const cur = this.mode && this.world.route.length ? this.current() : 0;
    const w = this.world;
    w.cycle = list;
    w.route = [{ start: -Infinity, biome: list.includes(cur) ? cur : list[0] }];
    w.nextStart = this.dist + 1800;
  }
  stay(b) {
    if (this.mode === 'stay:' + b) return;
    this.mode = 'stay:' + b;
    const w = this.world, cur = this.current();
    w.cycle = null;
    w.route = [{ start: -Infinity, biome: cur }];
    if (cur !== b) w.route.push({ start: this.dist + this.lay.W * 0.55, biome: b });
  }

  update(dt) {
    this.dist += this.speed * dt;
    this.walk += dt * 0.55;
    const out = S.wallet.outfit;
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0 && p.x > -40);
    if (out.trail) {
      this.trailT = Math.min(this.trailT + dt, 0.3);
      const r = trailRate(out.trail);
      while (this.trailT > r) { this.trailT -= r; this.particles.push(...trailParticles(out.trail, this.llamaX - 36, GROUND_Y - 50, this.speed)); }
    }
  }

  draw(g, VW, VH, { llama = true, dim = 0 } = {}) {
    this.lay.W = VW;
    fitWorld(g, this.world, this.dist, VW, VH, () => {
      this.world.draw(g, this.dist);
      if (llama && this.A) {
        for (const p of this.particles) drawParticle(g, p, this.A.img);
        const m = this.A.meta, sm = m.walk, s = 112 / m.standH;
        g.fillStyle = 'rgba(0,0,0,.14)';
        g.beginPath(); g.ellipse(this.llamaX - 4, GROUND_Y + 1, 38, 6, 0, 0, Math.PI * 2); g.fill();
        const i = Math.floor(this.walk * sm.fps) % sm.frames;
        drawLlama(g, this.A, 'walk', i, Math.round(this.llamaX - sm.anchorX * s), Math.round(GROUND_Y - sm.cellH * s), s, S.wallet.outfit, performance.now() / 1000);
      }
    });
    if (dim) { g.fillStyle = `rgba(29,16,48,${dim})`; g.fillRect(0, 0, VW, VH); }
  }

  biomeName() { return this.world.biomeAt(this.dist + this.llamaX).name; }
}

export { BIOMES, GROUND_Y };
