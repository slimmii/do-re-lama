// Lama Run: eindeloos rennen zonder gitaar. Spatie / pijltje omhoog / tik = springen
// (in de lucht nog één keer = dubbele sprong, langer indrukken = hoger). Spring óp een monster en het verdwijnt.
// De lama reist door alle landschappen en draagt haar kleren uit de winkel. Munten tellen hier enkel voor je score.
import { ui } from '../ui.js';
import { C, text, title, pill, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { sfx, unlock } from '../audio.js';
import { World, BIOMES, MONSTERS, BIOME_LEN } from '../lama-world.js';
import { drawLlama, drawParticle, trailParticles, trailRate } from '../lama-style.js';
import { fitWorld } from '../backdrop.js';
import { card, dimScreen } from './common.js';
import { label } from '../game.js';

const GROUND_Y = (606 * 540) / 672;
const PLAYER_X = 190, PLAYER_H = 112;
const GRAVITY = 2600, JUMP_V = 900, DOUBLE_JUMP_V = 780, JUMP_CUT = 0.45;
const START_SPEED = 330, MAX_SPEED = 720, SPEED_GAIN = 9;
const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
const FAST = new Set(['hop', 'scuttle', 'roll', 'slide']); // die komen sneller aangelopen

export class RunnerScene {
  constructor() {
    this.state = 'ready'; // ready | play | over
    this.lay = { W: 960, H: 540, top: 0 };
    this.world = new World(this.lay);
    this.world.load();
    this.world.wander(BIOMES.map((_, i) => i), 0);
    this.dist = 0;
    this.reset();
  }

  reset() {
    this.speed = START_SPEED; this.score = 0; this.coins = 0; this.lives = 3; this.time = 0; this.invuln = 0;
    this.spawnIn = 1.6; this.coinIn = 0.6; this.newBest = false;
    this.player = { y: GROUND_Y, vy: 0, onGround: true, jumps: 0, holding: false, landT: 1, walkT: 0, jumpV0: JUMP_V };
    this.entities = []; this.particles = []; this.floaters = [];
    this.trailT = 0;
    this.runDist = 0;
  }

  start() {
    unlock();
    this.reset();
    this.world.wander(BIOMES.map((_, i) => i), this.dist);
    this.state = 'play';
    this.stateT = this.t;
    sfx('start');
  }

  resize(VW) { this.lay.W = VW; }
  back() { if (this.state === 'play') this.pause(); else app.engine.go(app.scenes.title()); }

  pause() {
    if (this.state !== 'play' || this.paused) return;
    this.paused = true;
    app.engine.push(app.scenes.pause({
      title: 'Pauze',
      onResume: () => { this.paused = false; },
      onRestart: () => { this.paused = false; this.start(); },
      onQuit: () => app.engine.go(app.scenes.title()),
    }));
  }

  // ---------- invoer ----------
  press() {
    if (this.state !== 'play' || this.paused) return;
    const p = this.player;
    if (p.onGround || p.jumps < 2) {
      const v = p.onGround ? JUMP_V : DOUBLE_JUMP_V;
      p.vy = -v; p.jumpV0 = v;
      p.onGround = false; p.jumps++; p.holding = true;
      this.puff(PLAYER_X, p.y, 6);
      sfx('jump');
    }
  }
  release() {
    const p = this.player;
    p.holding = false;
    if (p.vy < 0) p.vy *= JUMP_CUT; // korte tik = lage sprong
  }
  key(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (this.state === 'play') { this.pause(); return true; } return false; }
    if (JUMP_KEYS.includes(e.code)) {
      if (this.state === 'play') { if (!e.repeat) this.press(); return true; }
      if ((e.code === 'Space') && !ui.kb && (this.state === 'ready' || (this.state === 'over' && this.t - this.stateT > 0.8))) { this.start(); return true; }
    }
    return false;
  }
  keyUp(e) { if (JUMP_KEYS.includes(e.code)) this.release(); }
  pointer(type, x, y) {
    if (this.state !== 'play') return;
    if (type === 'down' && !ui.hit(x, y)) this.press();
    if (type === 'up') this.release();
  }

  // ---------- spawnen ----------
  spawnEnemy() {
    const biome = this.world.biomeAt(this.runDist + this.lay.W + 100);
    const pool = biome.monsters.filter((m) => this.time >= 16 || !MONSTERS[m].lift);
    const kind = pool[Math.floor(Math.random() * pool.length)];
    const def = MONSTERS[kind], im = this.world.monster[kind];
    if (!im) return;
    const fly = def.lift > 0;
    const h = def.h * 1.08, w = (im.width * h) / im.height;
    const e = { type: 'enemy', kind, def, fly, x: this.lay.W + w, w, h, t: Math.random() * 6, speedMul: fly ? 1.15 : FAST.has(def.anim) && this.time > 8 ? 1.3 : 1 };
    e.baseY = fly ? GROUND_Y - 150 - Math.random() * 90 : GROUND_Y;
    e.y = e.baseY;
    this.entities.push(e);
    if (!fly && Math.random() < 0.6) this.coinArc(e.x - 40, 5, 150);
  }
  coinArc(x0, n, height) {
    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1);
      this.addCoin(x0 + i * 46, GROUND_Y - 60 - Math.sin(f * Math.PI) * height);
    }
  }
  addCoin(x, y) { this.entities.push({ type: 'coin', x, y, w: 34, h: 36, t: Math.random() * 6 }); }
  spawnCoins() {
    const W = this.lay.W, r = Math.random();
    if (r < 0.35) for (let i = 0; i < 6; i++) this.addCoin(W + 40 + i * 46, GROUND_Y - 40);
    else if (r < 0.7) this.coinArc(W + 40, 7, 120 + Math.random() * 120);
    else { const y = GROUND_Y - 220 - Math.random() * 80; for (let i = 0; i < 5; i++) this.addCoin(W + 40 + i * 46, y); }
    if (this.lives < 3 && Math.random() < 0.12) this.entities.push({ type: 'heart', x: W + 360, y: GROUND_Y - 260, w: 38, h: 40, t: 0 });
  }

  puff(x, y, n, color = '#fff6e8') {
    for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: -60 - Math.random() * 120, vy: -Math.random() * 120, life: 0.4 + Math.random() * 0.2, color, s: 4 + Math.random() * 4, g: 500 });
  }
  sparkle(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 0.35, color, s: 5, g: 500 });
    }
  }

  playerBox() {
    const h = PLAYER_H * 0.8, w = PLAYER_H * 0.55;
    return { x: PLAYER_X - w / 2, y: this.player.y - h, w, h };
  }
  entityBox(e) {
    if (e.type !== 'enemy') return { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h };
    const top = e.fly ? e.y - e.h / 2 : e.y - e.h;
    const ix = e.w * 0.18, it = e.h * (e.fly ? 0.22 : 0.15);
    return { x: e.x - e.w / 2 + ix, y: top + it, w: e.w - 2 * ix, h: e.h - it - e.h * (e.fly ? 0.22 : 0.02) };
  }

  // ---------- update ----------
  update(dt) {
    if (this.paused) return;
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.y -= 50 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    const p = this.player;
    if (this.state !== 'play') { p.walkT += dt * 0.6; this.dist += 60 * dt; this.runDist = this.dist; return; }

    this.time += dt;
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.time * SPEED_GAIN);
    this.dist += this.speed * dt;
    this.runDist = this.dist;
    this.score = Math.floor(this.time * 8) + this.coins * 10;
    this.invuln = Math.max(0, this.invuln - dt);

    const g = p.vy > 0 || !p.holding ? GRAVITY * 1.25 : GRAVITY;
    p.vy += g * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND_Y) {
      if (!p.onGround) { p.landT = 0; this.puff(PLAYER_X, GROUND_Y, 5); }
      p.y = GROUND_Y; p.vy = 0; p.onGround = true; p.jumps = 0;
    }
    p.landT += dt;
    p.walkT += dt * (this.speed / START_SPEED);

    const out = S.wallet.outfit;
    if (out.trail) {
      this.trailT = Math.min(this.trailT + dt, 0.3);
      const r = trailRate(out.trail);
      while (this.trailT > r) { this.trailT -= r; this.particles.push(...trailParticles(out.trail, PLAYER_X - 36, p.y - 50, this.speed)); }
    }

    this.spawnIn -= dt; this.coinIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnEnemy();
      const gap = Math.max(0.75, 1.9 - this.time * 0.02);
      this.spawnIn = gap + Math.random() * gap;
    }
    if (this.coinIn <= 0) { this.spawnCoins(); this.coinIn = 2.2 + Math.random() * 1.8; }

    const pb = this.playerBox();
    const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const e of this.entities) {
      e.t += dt;
      e.x -= this.speed * (e.type === 'enemy' ? e.speedMul : 1) * dt;
      if (e.type === 'enemy' && e.fly) e.y = e.baseY + Math.sin(e.t * 3) * 40;
      if (e.dead || !hit(pb, this.entityBox(e))) continue;
      if (e.type === 'coin') { e.dead = true; this.coins++; this.sparkle(e.x, e.y, '#ffd34d'); sfx('coin'); }
      else if (e.type === 'heart') { e.dead = true; this.lives = Math.min(3, this.lives + 1); this.sparkle(e.x, e.y, '#ff5a8a'); sfx('heart'); }
      else if (this.invuln <= 0) {
        // Op een monster landen = monster weg + extra sprong.
        if (p.vy > 200 && pb.y + pb.h < this.entityBox(e).y + 26) {
          e.dead = true; this.coins += 2; p.vy = -JUMP_V * 0.8; p.jumps = 1;
          this.sparkle(e.x, e.y - e.h / 2, '#ffffff');
          this.floaters.push({ x: e.x, y: e.y - e.h, text: '+20', life: 0.9 });
          sfx('stomp');
        } else {
          this.lives--; this.invuln = 1.4; this.shake = 0.35;
          this.sparkle(PLAYER_X, p.y - 50, '#ff5a8a');
          sfx('hurt');
          if (this.lives <= 0) this.gameOver();
        }
      }
    }
    this.shake = Math.max(0, (this.shake || 0) - dt);
    this.entities = this.entities.filter((e) => !e.dead && e.x > -200);
  }

  gameOver() {
    this.state = 'over';
    this.stateT = this.t;
    if (this.score > S.runBest) { S.runBest = this.score; this.newBest = true; persist(); }
    setTimeout(() => sfx('over'), 300);
  }

  // ---------- tekenen ----------
  draw(g, VW, VH) {
    this.lay.W = VW;
    const oy = fitWorld(g, this.world, this.dist, VW, VH, () => {
      g.save();
      if (this.shake > 0) g.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 6 * this.shake);
      this.world.draw(g, this.dist);
      for (const e of this.entities) this.drawEntity(g, e);
      for (const p of this.particles) if (p.kind) drawParticle(g, p, app.A.img);
      this.drawLlama(g);
      for (const p of this.particles) {
        if (p.kind) continue;
        g.globalAlpha = Math.max(0, p.life * 2.5);
        g.fillStyle = p.color; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
      g.globalAlpha = 1;
      for (const f of this.floaters) { g.globalAlpha = Math.min(1, f.life * 2); label(g, f.text, f.x, f.y, 26, '#fff6c8'); }
      g.globalAlpha = 1;
      g.restore();
    });
    this.drawHud(g, VW);
    if (this.state === 'play') {
      const u = this.t - this.stateT;
      if (u < 1.4) { g.globalAlpha = Math.min(1, (1.4 - u) * 3); title(g, 'Rennen!', VW / 2, oy + 250 - ease.out(Math.min(1, u * 3)) * 20, 50, C.cream); g.globalAlpha = 1; }
      const b = this.world.biomeAt(this.dist + PLAYER_X);
      if (this.biomeNow && b !== this.biomeNow) this.banner = { text: b.name, t: this.t };
      this.biomeNow = b;
      if (this.banner && this.t - this.banner.t < 2.5) {
        const a = Math.min(1, (2.5 - (this.t - this.banner.t)) * 2, (this.t - this.banner.t) * 4);
        g.globalAlpha = a; title(g, this.banner.text, VW / 2, oy + 200, 36, C.cream); g.globalAlpha = 1;
      }
    }
    if (this.state === 'ready') this.drawReady(g, VW, VH);
    if (this.state === 'over' && this.t - this.stateT > 0.6) this.drawOver(g, VW, VH);
  }

  drawHud(g, VW) {
    const A = app.A;
    pill(g, 14, 14, 3 * 34 + 14, 44);
    for (let i = 0; i < 3; i++) {
      g.globalAlpha = i < this.lives ? 1 : 0.22;
      g.drawImage(A.img.heart, 21 + i * 34, 20, 30, 32);
    }
    g.globalAlpha = 1;
    title(g, this.score, VW / 2, 40, 38, '#fff');
    text(g, `record ${Math.max(S.runBest, this.score)}`, VW / 2, 70, { size: 14, color: '#fff', stroke: C.ink, strokeW: 4 });
    pill(g, VW - 132 - 70, 14, 132, 44);
    g.drawImage(A.img.coin, VW - 132 - 62, 18, 34, 36);
    text(g, this.coins, VW - 132 - 20, 37, { size: 24, color: C.gold, align: 'left', stroke: C.ink, strokeW: 5 });
    if (this.state === 'play') ui.iconButton('r:pause', VW - 38, 36, 44, 'pause', { onClick: () => this.pause(), focus: false });
  }

  drawEntity(g, e) {
    const A = app.A;
    if (e.type === 'coin') {
      const sx = Math.abs(Math.cos(e.t * 4));
      g.drawImage(A.img.coin, e.x - (e.w * Math.max(sx, 0.15)) / 2, e.y - e.h / 2, e.w * Math.max(sx, 0.15), e.h);
    } else if (e.type === 'heart') {
      g.drawImage(A.img.heart, e.x - e.w / 2, e.y - e.h / 2 + Math.sin(e.t * 5) * 4, e.w, e.h);
    } else {
      const im = this.world.monster[e.kind], def = e.def, t = e.t;
      const top = e.fly ? e.y - e.h / 2 : e.y - e.h;
      g.save();
      g.translate(e.x, top + e.h / 2);
      if (def.anim === 'sway') g.rotate(Math.sin(t * 8) * 0.06);
      else if (def.anim === 'hop' || def.anim === 'scuttle') g.translate(0, -Math.abs(Math.sin(t * 12)) * 3);
      else if (def.anim === 'fly') g.scale(1, 0.9 + Math.abs(Math.sin(t * 14)) * 0.1);
      else if (def.anim === 'roll') g.rotate(-t * 6);
      else if (def.anim === 'wobble') g.scale(1 + Math.sin(t * 7) * 0.05, 1 - Math.sin(t * 7) * 0.05);
      if (def.flip) g.scale(-1, 1);
      if (def.glow) { g.shadowColor = 'rgba(190,215,255,.9)'; g.shadowBlur = 14; }
      g.drawImage(im, -e.w / 2, -e.h / 2, e.w, e.h);
      g.restore();
    }
  }

  drawLlama(g) {
    const p = this.player, m = app.A.meta;
    if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2) return;
    let sheet = 'walk', i;
    if (!p.onGround) {
      const j = m.jump;
      sheet = 'jump';
      if (p.vy < 0) i = j.takeoff + (1 - Math.min(1, -p.vy / p.jumpV0)) * (j.apex - j.takeoff);
      else i = j.apex + Math.min(1, p.vy / (JUMP_V * 1.1)) * (j.land - j.apex);
      i = Math.round(i);
    } else if (p.landT < 0.2) {
      const j = m.jump, n = Math.max(1, j.frames - 1 - j.land);
      sheet = 'jump'; i = Math.min(j.frames - 1, j.land + Math.floor((p.landT / 0.2) * n));
    } else i = Math.floor(p.walkT * m.walk.fps) % m.walk.frames;
    const sm = m[sheet], s = PLAYER_H / m.standH;
    g.fillStyle = 'rgba(0,0,0,.14)';
    g.beginPath(); g.ellipse(PLAYER_X - 4, GROUND_Y + 1, Math.max(14, 38 - (GROUND_Y - p.y) * 0.15), 6, 0, 0, Math.PI * 2); g.fill();
    drawLlama(g, app.A, sheet, i, Math.round(PLAYER_X - sm.anchorX * s), Math.round(p.y - sm.cellH * s), s, S.wallet.outfit, this.t);
  }

  drawReady(g, VW, VH) {
    dimScreen(g, VW, VH, 0.35);
    const w = Math.min(540, VW - 40), h = 330;
    card(g, VW, VH, w, h, this.t, (x, y) => {
      title(g, 'Lama Run', VW / 2, y + 44, 44, '#d9c2ff');
      const lines = [
        ['Spatie, pijltje omhoog of tik', 'springen'],
        ['In de lucht nog eens', 'dubbele sprong'],
        ['Langer ingedrukt houden', 'hoger springen'],
        ['Spring óp een monster', 'weg ermee! +20'],
      ];
      lines.forEach(([a, b], i) => {
        text(g, a, VW / 2 - 12, y + 96 + i * 28, { size: 16, weight: 800, color: C.text, align: 'right' });
        text(g, b, VW / 2 + 12, y + 96 + i * 28, { size: 16, color: C.purpleD, align: 'left' });
      });
      text(g, 'Munten tellen hier enkel voor je score, niet voor de winkel.', VW / 2, y + 214, { size: 13.5, weight: 800, color: C.muted });
      ui.button('rr:start', VW / 2 - 120, y + h - 92, 240, 62, 'Rennen', { icon: 'play', variant: 'purple', onClick: () => this.start(), primary: true, sound: 'silent' });
      ui.button('rr:back', x + 16, y + h - 74, 110, 44, 'Terug', { icon: 'back', variant: 'paper', size: 17, onClick: () => app.engine.go(app.scenes.title()), sound: 'back' });
    });
  }

  drawOver(g, VW, VH) {
    const t = this.t - this.stateT - 0.6;
    dimScreen(g, VW, VH, Math.min(0.5, t * 2));
    const w = Math.min(480, VW - 40), h = 300;
    card(g, VW, VH, w, h, t, (x, y) => {
      title(g, 'GAME OVER', VW / 2, y + 44, 46, '#ff9cbd');
      title(g, Math.round(this.score * ease.out(clamp(t / 0.8, 0, 1))), VW / 2, y + 110, 60, C.gold);
      text(g, this.newBest ? 'Nieuw record!' : `record ${S.runBest}`, VW / 2, y + 152, { size: 18, color: this.newBest ? C.goldD : C.muted });
      text(g, `${this.coins} munten · ${Math.round(this.time)} seconden`, VW / 2, y + 178, { size: 15, weight: 800, color: C.muted });
      const bw = (w - 48) / 2;
      ui.button('ro:again', x + 16, y + h - 82, bw, 60, 'Opnieuw', { icon: 'retry', variant: 'purple', onClick: () => this.start(), sound: 'silent' });
      ui.button('ro:menu', x + 32 + bw, y + h - 82, bw, 60, 'Menu', { icon: 'home', variant: 'paper', onClick: () => app.engine.go(app.scenes.title()), sound: 'back' });
    });
  }
}
