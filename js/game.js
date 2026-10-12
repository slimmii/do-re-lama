// Het lama-spel: de lama loopt vanzelf door het landschap. Boven in de lucht hangt een notenbalk;
// elke noot staat recht boven een monster. De blauwe balk (vlak voor de lama) is het venster
// waarin je de noot moet spelen. Speel je ze juist terwijl ze in de balk staat, dan springt de
// lama meteen over het monster (+1 punt). Fout gespeeld, of de noot is de balk uit: het monster
// botst tegen de lama (-1 leven). Zijn de levens op, dan is het spel uit.
// Af en toe hangt er in plaats van een monster een munt in de lucht: speel die noot en de lama springt
// en vangt de munt (voor de winkel). Mis je ze, dan vliegt ze weg; botsen doe je niet. Onsterfelijk: geen munten.
// Op de reis staat er aan de grens met een nieuw landschap een poortwachter (queueBoss): speel zijn noot
// (de nieuwe noot) een paar keer juist en hij is verslagen. Zijn wolkjes kosten geen leven.
// Alles (ook de notenbalk) wordt op het canvas getekend; de HUD tekent de speelscène (scenes/play.js).
import { parseNote, soundingMidi, solfegeMidi, solfegeOf, describePosition } from './notes.js';
import { loadLlama, drawLlama, drawParticle, trailParticles, trailRate } from './lama-style.js';
import { World, MONSTERS, BOSS_FRAMES } from './lama-world.js';
import { drawClef, diatonic, E4, B4, SP } from './staff.js';
import { FONT } from './draw.js';

// Spelwereld in canvaspixels: 540 hoog, de breedte volgt het scherm (minstens 720).
export const H = 540;
const BG_SCALE = H / 672; // achtergrond + bodem van elk landschap zijn de boven-/onderstrook van een 1584x672 beeld
export const GROUND_Y = 606 * BG_SCALE; // hier staan de pootjes
export const PLAYER_X = 190;
const PLAYER_H = 112;
const PX_PER_BEAT = 220; // afstand tussen twee monsters (= twee noten)
const LEAD_BEATS = 4; // zoveel tellen loopt de lama voor het eerste monster komt

// Beoordeling. Het speelvenster (de blauwe balk) ligt tussen BAR_LATE en BAR_LATE + breedte
// pixels vóór de lama: zolang de noot daarin staat, is het monster eronder nog niet bij de lama.
const CONTACT_PX = 34; // het monster raakt de lama als het zo dicht bij is
const BAR_LATE = CONTACT_PX + 18; // linkerrand van de balk (laatste moment om te spelen)
const GRACE = 0.15; // s na de botsing waarin een (vertraagd herkende) juiste tokkel nog telt
const JUMP_MARGIN = 20; // px extra lucht achter het monster

// De notenbalk (wolk bovenaan)
export const PANEL = { y: 5, h: 166 };
const lineY = (i) => 42 + SP * i; // 0 = bovenste lijn, 4 = onderste
const NOTE_X0 = 84; // hier begint de ruimte voor noten (na de sleutel)
const HALF = SP / 2; // een halve ruimte (één stap op de notenbalk)

const COIN_Y = GROUND_Y - 165; // hoogte van de munten: daar zit de lama bovenaan haar sprong
const COIN_CHANCE = 1 / 2; // kans op een munt na minstens één monster: gemiddeld 1 op 3 noten (nooit twee na elkaar)
const BOSS_H = 150;
const BOSS_FPS = 8; // zo snel speelt de poortwachter zijn animatie (24 frames = 3 s, zoals de video)

// Toetsen als je met het toetsenbord speelt: de noten van laag naar hoog op de middelste rij.
export const KEYS = [['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'], ['Quote', "'"], ['Backslash', '\\']];

export class LamaGame {
  /**
   * @param {{ctx: () => AudioContext, click: (t:number, accent:boolean) => void, setExpect: (midis:number[]) => void, onOver?: () => void}} opts
   */
  constructor(opts) {
    this.o = opts;
    this.W = 960;
    this.running = false;
    this.paused = false;
    this.over = false;
    this.pool = ['G4', 'B4', 'E5'];
    this.bpm = 30;
    this.metro = true;
    this.showNames = false;
    this.showFingers = true;
    this.bigName = true; // naam van de noot die aan de beurt is, groot in de lucht
    this.keyboard = false; // spelen met het toetsenbord: toon de toets bij de noot
    this.maxLives = 3; // 0 = onsterfelijk: botsen mag, het spel stopt nooit
    this.barBeats = 0.45; // breedte van het speelvenster in tellen
    this.best = 0;
    this.newBest = false;
    this.onBest = null; // (best) => void, om het record te bewaren
    this.onCoin = null; // () => void, als de lama een munt vangt
    this.onJudge = null; // (noot, juist, n) => void, voor elke beslissing (sterren en de voortgang op de reis)
    this.onBossWon = null; // (boss) => munten
    this.coinChance = COIN_CHANCE;
    this.fresh = {}; // noot -> hoe vaak ze nog extra vaak (en met naam) moet komen, net nadat ze nieuw is
    this.boss = null;
    this.outfit = {}; // wat de lama draagt (zie lama-style.js)
    this.trailT = 0;
    this.img = {};
    this.lay = { W: this.W, H, top: 0 };
    this.world = new World(this.lay);
    this.dist = this.W; // afgelegde weg (loopt ook in het startscherm)
    this.biomeNow = null;
    this.banner = null; // naam van een nieuw landschap, even in beeld
    this.msg = null; // {text, life}: korte boodschap in een tekstballon bij de lama
    this.hurtT = 0; // voor de HUD: hartjes schudden
    this.coinT = 0; // voor de HUD: muntenteller springt op
    this.ready = this.load();
    this.reset();
  }

  async load() {
    const [A] = await Promise.all([loadLlama(), this.world.load()]);
    this.A = A;
    Object.assign(this.img, A.img);
    this.meta = A.meta;
  }

  resize(W) {
    this.W = W;
    this.lay.W = W;
  }

  setPool(pool) {
    this.pool = pool.length ? [...pool] : ['G4', 'B4', 'E5'];
    this.setKeys(this.pool);
    if (!this.running && !this.paused) this.reset();
  }

  // Toetsenbord: de noten van laag naar hoog op A S D F ...
  setKeys(list) {
    this.keyOf = new Map([...new Set(list)].sort((a, b) => parseNote(a).midi - parseNote(b).midi).map((p, i) => [p, KEYS[i]]));
  }

  // Toetsenbord: welke noot hoort bij deze toets?
  noteForKey(code) {
    for (const [p, k] of this.keyOf || []) if (k?.[0] === code) return p;
    return null;
  }

  reset() {
    this.notes = []; // {p, beat, kind, finger, state: null|'hit'|'wrong'|'missed', ...}
    this.trace = []; // laatste gehoorde noten en wat het spel ermee deed: {t, midi, d, verdict} (zie dev.mic())
    this.beat = 0;
    this.score = 0;
    this.lives = this.maxLives;
    this.bumps = 0;
    this.hits = 0;
    this.misses = 0;
    this.over = false;
    this.paused = false;
    this.newBest = false;
    this.lastBeatClick = -1;
    this.hist = [];
    this.prev = [];
    this.lastFinger = 'i';
    this.sinceCoin = 0;
    this.coins = 0; // munten gevangen in dit spel
    this.bossCoins = 0;
    this.boss = null;
    this.lastHit = null;
    this.player = { y: GROUND_Y, jump: null, queue: [], landT: 1, walk: 0, hurt: 0 }; // queue: noten om over te springen
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
    this.msg = null;
    this.fill();
  }

  // Willekeurige noot uit de pool; een net nieuwe noot (fresh) komt drie keer zo vaak.
  pickPitch() {
    const w = this.pool.map((p) => (this.fresh[p] > 0 ? 3 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return this.pool[i];
    return this.pool[0];
  }

  nextPitch() {
    let p, tries = 0;
    do { p = this.pickPitch(); tries++; }
    while (this.pool.length > 1 && this.prev.length >= 2 && this.prev.every((x) => x === p) && tries < 10);
    this.prev = [...this.prev.slice(-1), p];
    return p;
  }

  fill() {
    const visible = this.W / PX_PER_BEAT + 2;
    let last = this.notes.length ? this.notes[this.notes.length - 1].beat : LEAD_BEATS - 1;
    while (last < this.beat + visible) {
      last += 1;
      this.lastFinger = this.lastFinger === 'm' ? 'i' : 'm';
      const b = this.boss;
      if (b && !b.won) { // poortwachter: al zijn noten zijn de nieuwe noot, met naam erbij
        this.notes.push({
          p: b.notes[b.made++ % b.notes.length], beat: last, state: null, finger: this.lastFinger,
          kind: b.minion, boss: true, showName: true, t: Math.random() * 6,
        });
        continue;
      }
      const coin = !this.immortal() && last >= LEAD_BEATS + 2 && this.sinceCoin >= 1 && Math.random() < this.coinChance;
      this.sinceCoin = coin ? 0 : this.sinceCoin + 1;
      const p = this.nextPitch();
      const fresh = this.fresh[p] > 0;
      if (fresh) this.fresh[p]--;
      this.notes.push({
        p, beat: last, state: null, finger: this.lastFinger, showName: fresh,
        // het monster hoort bij het landschap waar het staat
        kind: coin ? 'coin' : this.world.monsterAt(this.worldX(last)), t: Math.random() * 6,
      });
    }
  }

  // Waar (afgelegde weg) de noot op tel 'beat' op de bodem staat.
  worldX(beat) { return this.dist + PLAYER_X + (beat - this.beat) * PX_PER_BEAT; }
  bossX() { return this.W - 190; }

  // ---------- poortwachter ----------
  // b = {notes: [nieuwe noten], need: aantal keer juist, monster: id van de wachter, minion: id van zijn wolkjes, name}
  queueBoss(b) {
    if (this.boss) return;
    this.boss = { ...b, hits: 0, made: 0, won: false, x: this.W + 140, flash: 0, dieT: 0 };
    this.setKeys([...this.pool, ...b.notes]); // ook de nieuwe noot krijgt een toets
    this.banner = { text: `Een poortwachter! Speel ${b.notes.map(solfegeOf).join(' en ')}`, life: 3.5 };
    this.say(`De poortwachter van ${b.name} laat je pas door als je ${b.need} keer ${b.notes.map(solfegeOf).join('/')} speelt.`);
  }

  hitBoss() {
    const b = this.boss;
    b.hits++;
    b.flash = 0.35;
    for (let i = 0; i < 12; i++) { // een straal sterretjes van de lama naar de wachter
      const u = i / 12;
      this.particles.push({ kind: 'spark', x: PLAYER_X + u * (b.x - PLAYER_X), y: GROUND_Y - 80 - Math.sin(u * Math.PI) * 60, vx: 0, vy: -20, g: 0, life: 0.5 + u * 0.2, color: '#ffe066', s: 7, rot: 0 });
    }
    this.floaters.push({ x: b.x, y: GROUND_Y - BOSS_H - 50, text: `${b.hits}/${b.need}`, life: 0.9 });
    if (b.hits >= b.need) this.winBoss();
  }

  winBoss() {
    const b = this.boss;
    b.won = true;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260;
      this.particles.push({ kind: 'confetti', x: b.x, y: GROUND_Y - BOSS_H / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, g: 400, life: 1.4, rot: a,
        color: ['#ff5a8a', '#5ec8ff', '#ffe066', '#7ee08a', '#c79bff'][i % 5], s: 8 });
    }
    // de scène maakt de noot vrij, geeft de munten en zet het volgende landschap klaar
    const coins = this.onBossWon?.(b) || 0;
    this.bossCoins += coins;
    if (coins) this.floaters.push({ x: b.x + 20, y: GROUND_Y - BOSS_H - 30, text: `+${coins}`, life: 2.2, coin: true });
    this.say(coins ? `Poortwachter verslagen! +${coins} munten` : 'Poortwachter verslagen!');
    // de wolkjes die nog komen, worden gewone noten (met de nieuwe noot erbij)
    for (const n of this.notes) {
      if (!n.boss || n.state) continue;
      n.boss = false; n.showName = false;
      n.p = this.nextPitch();
      n.kind = this.world.monsterAt(this.worldX(n.beat));
    }
    this.sendExpect();
  }

  // De noot die nu aan de beurt is: de eerste die nog niet beslist is.
  target() { return this.notes.find((n) => !n.state) || null; }

  clock() { return this.running ? this.o.ctx().currentTime : performance.now() / 1000; }

  start() {
    this.reset();
    this.running = true;
    this.lastT = this.clock();
    this.sendExpect();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.lastT = null;
    this.o.setExpect([]);
  }

  // Pauze: de tijd van de audioklok loopt door, dus alles wat met tijdstippen werkt, schuift mee bij het hervatten.
  pause() {
    if (!this.running) return;
    this.running = false;
    this.paused = true;
    this.pausedAt = this.o.ctx().currentTime;
    this.o.setExpect([]);
  }

  resume() {
    if (!this.paused) return;
    const now = this.o.ctx().currentTime, d = now - this.pausedAt;
    const pl = this.player;
    if (pl.jump) pl.jump.t0 += d;
    for (const n of this.notes) { if (n.contactAt != null) n.contactAt += d; if (n.earlyUntil) n.earlyUntil += d; }
    for (const h of this.hist) h.t += d;
    if (this.lastHit) this.lastHit.time += d;
    this.paused = false;
    this.running = true;
    this.lastT = now;
    this.sendExpect();
  }

  gameOver() {
    this.stop();
    this.over = true;
    this.o.onOver?.();
  }

  immortal() { return !this.maxLives; }

  barW() { return this.barBeats * PX_PER_BEAT; }
  // afstand (px) van de noot tot de lama: in de balk als BAR_LATE <= d <= BAR_LATE + barW()
  inBar(d) { return d >= BAR_LATE && d <= BAR_LATE + this.barW(); }
  setBarBeats(b) { this.barBeats = b; }

  spb() { return 60 / this.bpm; }
  speed() { return (PX_PER_BEAT * this.bpm) / 60; } // px per seconde
  xOf(n) { return PLAYER_X + (n.beat - this.beat) * PX_PER_BEAT; }

  update() {
    if (this.paused) return;
    const now = this.clock();
    const dt = this.lastT == null ? 0 : Math.max(0, Math.min(0.1, now - this.lastT));
    this.lastT = now;
    this.now = now;
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 500) * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.y -= 40 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.coinT = Math.max(0, this.coinT - dt);
    if (this.msg) { this.msg.life -= dt; if (this.msg.life <= 0) this.msg = null; }
    const pl = this.player;
    pl.hurt = Math.max(0, pl.hurt - dt);

    if (this.running) {
      const next = this.beat + (dt * this.bpm) / 60;
      // metronoom: tik telkens een noot in het midden van de blauwe balk staat
      const mid = (BAR_LATE + this.barW() / 2) / PX_PER_BEAT;
      const whole = Math.floor(next + mid + 1e-6);
      if (whole > this.lastBeatClick) {
        this.lastBeatClick = whole;
        if (this.metro) this.o.click(now, whole % 4 === 0);
      }
      this.beat = next;
      this.dist += this.speed() * dt;
      this.hist.push({ t: now, beat: next });
      while (this.hist.length > 2 && now - this.hist[0].t > 4) this.hist.shift();
      this.fill();
      this.collide(now);
    } else if (!this.over) {
      this.dist += 60 * dt; // rustig wandelen in het startscherm
    }

    // springen (een juiste noot tijdens een sprong: na de landing meteen opnieuw)
    if (!pl.jump && pl.queue.length) {
      const D = this.jumpTime(pl.queue.shift());
      pl.jump = { t0: now, D, h: 105 + 45 * Math.min(1, D) };
    }
    if (pl.jump) {
      const u = (now - pl.jump.t0) / pl.jump.D;
      if (u >= 1) { pl.jump = null; pl.y = GROUND_Y; pl.landT = 0; this.puff(PLAYER_X, GROUND_Y, 5); }
      else pl.y = GROUND_Y - 4 * pl.jump.h * u * (1 - u);
    }
    pl.landT += dt;
    // spoor achter de lama (zie de winkel)
    if (this.outfit.trail && !this.over) {
      const r = trailRate(this.outfit.trail);
      this.trailT = Math.min(this.trailT + dt, 0.3);
      while (this.trailT > r) {
        this.trailT -= r;
        this.particles.push(...trailParticles(this.outfit.trail, PLAYER_X - 36, pl.y - 50, this.running ? this.speed() : 60));
      }
    }
    for (const n of this.notes) n.t += dt;
    // een nieuw landschap onder de pootjes: even de naam tonen
    const here = this.world.biomeAt(this.dist + PLAYER_X);
    if (this.biomeNow && here !== this.biomeNow && this.running) this.banner = { text: here.name, life: 3 };
    this.biomeNow = here;
    if (this.boss) {
      const b = this.boss;
      b.flash = Math.max(0, b.flash - dt);
      if (b.won) { b.dieT += dt; if (b.dieT > 1.2) this.boss = null; }
      else b.x = Math.max(this.bossX(), b.x - 160 * dt); // komt binnen en blijft dan staan
    }
    if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    if (!this.over) pl.walk += dt * Math.max(0.5, this.running ? this.bpm / 30 : 0.5);
  }

  // Luchttijd: de lama blijft in de lucht tot het monster van noot n helemaal onder haar door is.
  // Bij een munt: zo lang dat ze bovenaan haar sprong is als de munt bij haar is.
  jumpTime(n) {
    const d = this.xOf(n) - PLAYER_X;
    if (n.kind === 'coin') return Math.min(Math.max((2 * d) / this.speed(), 0.4), 0.95 * this.spb() + 0.3);
    return Math.min(Math.max((d + CONTACT_PX + JUMP_MARGIN) / this.speed(), 0.35), 0.95 * this.spb() + 0.3);
  }

  collide(now) {
    for (const n of this.notes) {
      const x = this.xOf(n);
      if (n.kind === 'coin' && n.state === 'hit' && !n.caught && x <= PLAYER_X + 20) this.catchCoin(n, x);
      if (n.bumped || n.state === 'hit') continue;
      if (x > PLAYER_X + CONTACT_PX) break;
      if (n.kind === 'coin') { // een munt botst niet: gemist is gemist
        if (n.state === 'wrong') { n.bumped = true; continue; }
        if (n.contactAt == null) n.contactAt = now;
        if (now - n.contactAt < GRACE) continue;
        n.state = 'missed'; n.wrongText = 'gemist'; n.bumped = true; n.lostT = n.t;
        this.judge(n, false);
        this.say('Munt gemist…');
        this.sendExpect();
        continue;
      }
      if (n.contactAt == null) n.contactAt = now;
      // even wachten: de herkenning van een tokkel die nét op tijd was, heeft wat tijd nodig
      if (n.state !== 'wrong' && now - n.contactAt < GRACE) continue;
      if (!n.state) { n.state = 'missed'; n.wrongText = 'te laat'; this.judge(n, false); }
      if (n.boss) { // een wolkje van de poortwachter: even schrikken, maar geen leven kwijt
        n.bumped = true; n.poof = true;
        this.player.hurt = 0.5; this.shake = 0.2;
        this.say(`Bijna! De poortwachter wil ${solfegeOf(n.p)} horen (${describePosition(n.p)}).`);
      } else this.bump(n);
      if (!this.running) return;
      this.sendExpect();
    }
    while (this.notes.length && this.xOf(this.notes[0]) < -120) this.notes.shift();
  }

  judge(n, ok) {
    if (ok) this.hits++; else this.misses++;
    this.onJudge?.(n.p, ok, n);
  }

  catchCoin(n, x) {
    n.caught = true;
    this.coins++;
    this.coinT = 0.5;
    this.onCoin?.();
    this.floaters.push({ x: x + 30, y: COIN_Y - 40, text: '+1', life: 1.2, coin: true });
    this.sparkle(x, COIN_Y, '#ffd84a');
    this.sparkle(x, COIN_Y, '#fff6a8');
    this.say(this.coins === 1 ? 'Een munt! Daarmee koop je iets in de winkel.' : `Munt gevangen! (${this.coins} dit spel)`);
  }

  bump(n) {
    n.bumped = true;
    n.poof = true;
    this.bumps++;
    if (!this.immortal()) this.lives--;
    this.player.hurt = 1.2;
    this.shake = 0.35;
    this.hurtT = 0.9;
    this.sparkle(PLAYER_X + 30, GROUND_Y - 50, '#ff5a8a');
    if (!this.immortal() && this.lives <= 0) return this.gameOver();
    this.say(n.state === 'wrong' ? `Au! Dat was ${solfegeMidi(soundingMidi(n.p))}, niet ${n.played}.` : `Au! Te laat voor ${solfegeOf(n.p)}.`);
  }

  // Positie van de wereld op tijdstip t (bv. het moment van een tokkel, al gecorrigeerd voor de microfoonvertraging).
  beatAt(t) {
    const h = this.hist;
    if (!h.length || t >= h[h.length - 1].t) return this.beat;
    if (t <= h[0].t) return h[0].beat;
    let i = h.length - 1;
    while (i > 0 && h[i - 1].t > t) i--;
    const a = h[i - 1], b = h[i];
    return a.beat + ((b.beat - a.beat) * (t - a.t)) / (b.t - a.t || 1);
  }

  sendExpect() {
    const open = this.notes.filter((n) => !n.state).slice(0, 2).map((n) => soundingMidi(n.p));
    this.o.setExpect([...new Set(open)]);
  }

  onNote(ev) {
    if (!this.running) return;
    const tgt = this.target();
    if (!tgt) return;
    const now = this.o.ctx().currentTime;
    const at = Math.min(ev.time ?? now, now);
    // Waar stond de noot op het moment van de tokkel (niet: toen de herkenning klaar was)?
    const d = (tgt.beat - this.beatAt(at)) * PX_PER_BEAT;
    const trace = { t: ev.time, midi: ev.midi, want: soundingMidi(tgt.p), d, verdict: '' };
    this.trace.push(trace);
    if (this.trace.length > 12) this.trace.shift();
    // Nog niet in de blauwe balk: niet meetellen en niet bestraffen, enkel laten zien.
    if (d > BAR_LATE + this.barW()) {
      trace.verdict = 'te vroeg';
      if (ev.attack !== false) tgt.earlyUntil = now + 0.6;
      return;
    }
    // Voorbij de balk en het monster is al bij de lama: te laat, het gaat botsen.
    // (Net na de balk, maar vóór de botsing, telt nog: een kleine onzichtbare marge.)
    if (d < CONTACT_PX && ev.midi === soundingMidi(tgt.p)) { trace.verdict = 'te laat'; return; }
    trace.verdict = ev.midi === soundingMidi(tgt.p) ? 'raak' : 'fout';
    if (ev.midi === soundingMidi(tgt.p) && tgt.kind === 'coin') { // springen om de munt te vangen, geen punt
      tgt.state = 'hit';
      this.judge(tgt, true);
      this.lastHit = { midi: ev.midi, time: ev.time };
      this.player.queue.push(tgt);
      this.sendExpect();
      return;
    }
    if (ev.midi === soundingMidi(tgt.p)) {
      tgt.state = 'hit';
      this.judge(tgt, true);
      if (tgt.boss && this.boss && !this.boss.won) this.hitBoss();
      this.lastHit = { midi: ev.midi, time: ev.time };
      this.score++;
      if (!this.immortal() && this.score > this.best) {
        if (!this.newBest && this.best > 0) this.say('Nieuw record!');
        this.best = this.score; this.newBest = true; this.onBest?.(this.best);
      } else if (this.score % 10 === 0) this.say(`${this.score} punten!`);
      this.floaters.push({ x: PLAYER_X, y: GROUND_Y - PLAYER_H - 20, text: '+1', life: 0.8 });
      this.player.queue.push(tgt); // meteen springen, over het monster van deze noot
      this.sendExpect();
      return;
    }
    // Alleen een duidelijke nieuwe aanslag kan fout zijn: geen nagalm, geen dubbele detectie van de vorige noot.
    if (ev.attack === false) { trace.verdict = 'nagalm'; return; }
    if (this.lastHit && ev.midi === this.lastHit.midi && ev.time - this.lastHit.time < 0.3) { trace.verdict = 'dubbel'; return; }
    tgt.state = 'wrong';
    tgt.played = solfegeMidi(ev.midi);
    tgt.wrongText = `fout: ${tgt.played}`;
    this.judge(tgt, false);
    if (tgt.boss) this.say(`Fout: ${tgt.played}. De poortwachter wil ${solfegeMidi(soundingMidi(tgt.p))} horen.`);
    else if (tgt.kind === 'coin') { tgt.lostT = tgt.t; this.say(`Fout: ${tgt.played}. De munt vliegt weg…`); }
    else this.say(`Fout: ${tgt.played}. De lama gaat botsen…`);
    this.sendExpect();
  }

  // ---------- tekenen ----------
  draw(g, { staff = true, behind = null } = {}) {
    if (!this.meta) return;
    const now = this.now ?? this.clock();
    const W = this.W;
    g.save();
    if (this.shake > 0 && !this.paused) g.translate((Math.random() - 0.5) * 10 * this.shake, (Math.random() - 0.5) * 6 * this.shake);
    this.world.draw(g, this.dist);

    for (const n of this.notes) {
      const x = this.xOf(n);
      if (x > W + 80 || x < -120) continue;
      if (n.kind === 'coin') { this.drawCoin(g, n, x); continue; }
      if (n.poof) { this.poofMonster(n, x); continue; }
      this.drawMonster(g, n, x);
    }
    if (this.boss) this.drawBoss(g, now);
    for (const p of this.particles) if (p.kind) drawParticle(g, p, this.img); // spoor: achter de lama
    behind?.(); // bv. de tekstballon: de lama springt ervoor langs
    this.drawLlama(g, now);
    for (const p of this.particles) {
      if (p.kind) continue;
      g.globalAlpha = Math.max(0, p.life * 2.5);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    g.globalAlpha = 1;
    if (this.banner && (this.running || this.paused)) {
      g.globalAlpha = Math.max(0, Math.min(1, this.banner.life, (3 - this.banner.life) * 3));
      label(g, this.banner.text, W / 2, 330, 38, '#fff6c8');
      g.globalAlpha = 1;
    }
    if (this.bigName && (this.running || this.paused)) this.drawBigName(g);
    for (const f of this.floaters) {
      g.globalAlpha = Math.max(0, Math.min(1, f.life * 2));
      if (f.coin) g.drawImage(this.img.coin, f.x - 48, f.y - 18, 34, 36);
      label(g, f.text, f.x, f.y, 30, f.coin ? '#ffd84a' : '#5cdc84');
      g.globalAlpha = 1;
    }
    g.restore();
    if (staff) this.drawStaff(g, now);
  }

  // ---------- notenbalk ----------
  drawStaff(g, now) {
    const W = this.W;
    // wolk achter de notenbalk
    g.save();
    g.beginPath(); g.roundRect(6, PANEL.y + 5, W - 12, PANEL.h, 20); g.fillStyle = 'rgba(29,16,48,.18)'; g.fill();
    g.beginPath(); g.roundRect(6, PANEL.y, W - 12, PANEL.h, 20);
    g.fillStyle = 'rgba(255, 255, 255, .88)'; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.98)'; g.stroke();
    // speelvenster: de blauwe balk, met een dun lijntje voor het ideale moment
    const top = lineY(0) - 35, height = lineY(4) - lineY(0) + 70;
    const x0 = PLAYER_X + BAR_LATE, w = this.barW();
    const tgt = this.running || this.paused ? this.target() : null;
    const hot = tgt && this.inBar(this.xOf(tgt) - PLAYER_X);
    g.beginPath(); g.roundRect(x0, top, w, height, 10);
    g.fillStyle = hot ? 'rgba(47,111,220,.26)' : 'rgba(47,111,220,.15)'; g.fill();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(47,111,220,.5)'; g.stroke();
    g.fillStyle = 'rgba(47,111,220,.4)';
    g.fillRect(x0 + w / 2 - 1.5, top + 6, 3, height - 12);
    // lijnen + sleutel
    g.strokeStyle = '#8f8296';
    g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(13, lineY(i)); g.lineTo(W - 13, lineY(i)); g.stroke(); }
    g.beginPath(); g.moveTo(13, lineY(0)); g.lineTo(13, lineY(4)); g.stroke();
    drawClef(g, 22, lineY(3), '#3a2350');
    // noten (afgeknipt na de sleutel)
    g.beginPath(); g.rect(NOTE_X0 - 6, 0, W - 13 - NOTE_X0 + 6, PANEL.y + PANEL.h); g.clip();
    for (const n of this.notes) {
      const x = this.xOf(n);
      if (x > W + 30 || x < NOTE_X0 - 30) continue;
      this.drawNote(g, n, x, n === tgt, now);
    }
    g.restore();
  }

  drawNote(g, n, x, isTarget, now) {
    const d = diatonic(n.p);
    const base = lineY(4);
    const y = base - (d - E4) * HALF;
    const inBar = isTarget && this.inBar(x - PLAYER_X);
    const coin = n.kind === 'coin' && n.state !== 'missed' && n.state !== 'wrong';
    let ink = '#2b2420';
    if (n.state === 'hit') ink = '#2f9e57';
    else if (n.state === 'wrong') ink = '#dc3b3b';
    else if (n.state === 'missed') ink = '#b9a99b';
    else if (coin) ink = '#e8a200';
    else if (isTarget) ink = '#2f6fdc';
    g.save();
    if (n.state === 'hit') g.globalAlpha = 0.45;
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = 2.1;
    g.lineCap = 'round';
    const ledger = (s) => { const ly = base - (s - E4) * HALF; g.beginPath(); g.moveTo(x - 14.5, ly); g.lineTo(x + 14.5, ly); g.stroke(); };
    for (let s = E4 - 2; s >= d; s -= 2) ledger(s);
    for (let s = E4 + 10; s <= d; s += 2) ledger(s);
    if (inBar) { g.shadowColor = 'rgba(47,111,220,.9)'; g.shadowBlur = 10; }
    g.beginPath(); g.ellipse(x, y, 9.9, 7, -0.35, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.beginPath();
    if (d < B4) { g.moveTo(x + 9, y - 1.6); g.lineTo(x + 9, y - 54); } else { g.moveTo(x - 9, y + 1.6); g.lineTo(x - 9, y + 54); }
    g.stroke();
    const acc = parseNote(n.p).acc;
    if (acc) { g.font = FONT(22, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(acc === '#' ? '♯' : '♭', x - 25, y); }
    g.restore();
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    if (this.showFingers) {
      g.font = 'italic 700 17.6px Georgia, serif';
      g.fillStyle = n.state === 'missed' ? '#b9a99b' : '#b45d14';
      g.fillText(n.finger, x, lineY(0) - 21);
    }
    const named = this.showNames || n.showName; // nieuwe noten en die van de poortwachter: altijd met naam
    if (named) {
      g.font = FONT(16, 900);
      g.fillStyle = n.state === 'missed' ? '#b9a99b' : '#2f6fdc';
      g.fillText(solfegeOf(n.p), x, base + 38);
    }
    const early = n.earlyUntil > now && !n.state;
    const tag = n.state === 'wrong' || n.state === 'missed' ? n.wrongText : early ? 'wacht…' : '';
    if (tag) {
      g.font = FONT(13, 800);
      g.fillStyle = n.state ? '#dc3b3b' : '#7d7067';
      g.fillText(tag, x, base + (named ? 57 : 42));
    } else if (this.keyboard && !n.state && this.keyOf?.get(n.p)) {
      const k = this.keyOf.get(n.p)[1], ky = base + (named ? 52 : 38);
      g.beginPath(); g.roundRect(x - 10, ky - 13, 20, 18, 5);
      g.fillStyle = isTarget ? '#2f6fdc' : 'rgba(58,35,80,.12)'; g.fill();
      g.font = FONT(12.5, 900); g.fillStyle = isTarget ? '#fff' : '#3a2350'; g.fillText(k, x, ky + 1);
    }
  }

  // Grote naam van de noot die nu aan de beurt is, met waar je ze vindt. Fel blauw zodra ze in de balk staat.
  drawBigName(g) {
    const t = this.target();
    if (!t) return;
    const x = PLAYER_X + (this.W - PLAYER_X) * 0.48, y = 240;
    const name = solfegeOf(t.p);
    const hot = this.inBar(this.xOf(t) - PLAYER_X);
    const ink = t.kind === 'coin' ? '#c98a00' : '#2f6fdc'; // een munt: goud in plaats van blauw
    const sub = this.keyboard && this.keyOf?.get(t.p) ? `toets ${this.keyOf.get(t.p)[1]}` : describePosition(t.p);
    g.save();
    g.font = FONT(64, 900);
    const w = Math.max(190, g.measureText(name).width + 80);
    g.beginPath(); g.roundRect(x - w / 2, y - 48 + 6, w, 96, 24); g.fillStyle = 'rgba(29,16,48,.22)'; g.fill();
    g.beginPath(); g.roundRect(x - w / 2, y - 48, w, 96, 24);
    g.fillStyle = hot ? ink : 'rgba(255, 255, 255, .92)';
    g.fill();
    g.lineWidth = 3.5; g.strokeStyle = hot ? '#3a2350' : ink + '8c'; g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = hot ? '#ffffff' : ink;
    g.fillText(name, x, y - 9);
    g.font = FONT(16, 800);
    g.fillStyle = hot ? '#dce8ff' : '#7d7067';
    g.fillText(sub, x, y + 29);
    g.restore();
  }

  drawMonster(g, n, x) {
    const def = MONSTERS[n.kind], im = this.world.monster[n.kind];
    if (!def || !im) return;
    const h = def.h, w = (im.width * h) / im.height, t = n.t;
    const cy = GROUND_Y - def.lift - h / 2;
    g.save();
    g.translate(x, cy);
    switch (def.anim) {
      case 'sway': g.translate(0, h / 2); g.rotate(Math.sin(t * 8) * 0.06); g.translate(0, -h / 2); break; // wiebelen op de voet
      case 'hop': g.translate(0, -Math.abs(Math.sin(t * 12)) * 3); break;
      case 'fly': g.translate(0, Math.sin(t * 3) * 6); g.scale(1, 0.9 + Math.abs(Math.sin(t * 14)) * 0.1); break;
      case 'float': g.translate(0, Math.sin(t * 2) * 8); break;
      case 'slide': g.translate(0, Math.sin(t * 6) * 1.5); g.rotate(Math.sin(t * 3) * 0.04); break;
      case 'wobble': g.translate(0, h / 2); g.scale(1 + Math.sin(t * 7) * 0.05, 1 - Math.sin(t * 7) * 0.05); g.translate(0, -h / 2); break;
      case 'scuttle': g.translate(Math.sin(t * 18) * 2, -Math.abs(Math.sin(t * 18)) * 1.5); break;
      case 'roll': g.rotate(-t * 4); break; // rolt naar de lama toe
      case 'stomp': g.translate(0, -Math.max(0, Math.sin(t * 5)) * 4); break;
    }
    if (def.flip) g.scale(-1, 1);
    if (def.glow) { g.shadowColor = 'rgba(190, 215, 255, .9)'; g.shadowBlur = 14; }
    if (n.state === 'wrong') g.rotate(Math.sin(n.t * 30) * 0.08); // boos
    if (n.state === 'hit') g.globalAlpha = 0.85;
    g.drawImage(im, -w / 2, -h / 2, w, h);
    g.restore();
    if (n.state === 'wrong') label(g, '!', x, cy - h / 2 - 16, 30, '#ff5a5a');
  }

  // De poortwachter: een groot monster van het volgende landschap als gitaarheld, met levensbolletjes.
  drawBoss(g, now) {
    const b = this.boss, anim = this.world.bossAnim[b.monster], big = this.world.boss[b.monster];
    const im = anim || big || this.world.monster[b.monster];
    if (!im) return;
    const flip = !anim && !big && MONSTERS[b.monster].flip; // het gitaarheld-beeld kijkt al naar de lama
    // animatie: één frame uit de strook, BOSS_FPS per seconde
    const fw = anim ? im.width / BOSS_FRAMES : im.width, sx = anim ? (Math.floor(now * BOSS_FPS) % BOSS_FRAMES) * fw : 0;
    const k = b.won ? Math.max(0, 1 - b.dieT / 1.2) : 1;
    const h = BOSS_H * k, w = (fw * h) / im.height;
    const x = b.x + (b.flash > 0 ? Math.sin(now * 80) * 5 : 0), y = GROUND_Y - h / 2 + Math.sin(now * 3) * 3;
    g.save();
    g.globalAlpha = k;
    g.translate(x, y);
    if (flip) g.scale(-1, 1);
    g.drawImage(im, sx, 0, fw, im.height, -w / 2, -h / 2, w, h);
    if (b.flash > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = b.flash * 1.5; g.drawImage(im, sx, 0, fw, im.height, -w / 2, -h / 2, w, h); }
    g.restore();
    if (b.won) return;
    // levensbolletjes boven zijn hoofd: hoeveel keer nog
    const cy = y - h / 2 - 6;
    const left = b.need - b.hits, r = 7, gap = 18, x0 = x - ((b.need - 1) * gap) / 2;
    for (let i = 0; i < b.need; i++) {
      g.beginPath(); g.arc(x0 + i * gap, cy - 8, r, 0, Math.PI * 2);
      g.fillStyle = i < left ? '#ff5a8a' : 'rgba(255,255,255,.35)'; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#3a2350'; g.stroke();
    }
    label(g, 'Poortwachter', x, cy - 32, 20, '#fff6c8');
  }

  // Munt in de lucht: draait en zweeft. Gemist of fout: ze vliegt omhoog weg.
  drawCoin(g, n, x) {
    if (n.caught) return;
    const im = this.img.coin;
    let y = COIN_Y + Math.sin(n.t * 3) * 5, alpha = 1;
    if (n.lostT != null) {
      const u = n.t - n.lostT;
      y -= u * 260; alpha = Math.max(0, 1 - u * 1.5);
      if (!alpha) return;
    }
    const h = 42, w = h * (im.width / im.height) * (0.3 + 0.7 * Math.abs(Math.cos(n.t * 2.5)));
    g.save();
    g.globalAlpha = alpha;
    g.shadowColor = 'rgba(255, 220, 80, .9)';
    g.shadowBlur = 14;
    g.drawImage(im, x - w / 2, y - h / 2, w, h);
    g.restore();
  }

  poofMonster(n, x) {
    if (n.poofed) return;
    n.poofed = true;
    const def = MONSTERS[n.kind];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ x, y: GROUND_Y - def.lift - def.h / 2, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200 - 80, life: 0.5, color: '#fff6e8', s: 7 });
    }
  }

  llamaFrame(now) {
    const m = this.meta, pl = this.player, j = m.jump;
    if (pl.jump) {
      const u = Math.min(1, (now - pl.jump.t0) / pl.jump.D);
      const f = u < 0.5 ? j.takeoff + (u / 0.5) * (j.apex - j.takeoff) : j.apex + ((u - 0.5) / 0.5) * (j.land - j.apex);
      return ['jump', j, Math.round(f)];
    }
    if (pl.landT < 0.2) {
      const n = Math.max(1, j.frames - 1 - j.land);
      return ['jump', j, Math.min(j.frames - 1, j.land + Math.floor((pl.landT / 0.2) * n))];
    }
    return ['walk', m.walk, Math.floor(pl.walk * m.walk.fps) % m.walk.frames];
  }

  drawLlama(g, now) {
    const pl = this.player;
    if (pl.hurt > 0 && Math.floor(pl.hurt * 12) % 2) return;
    const [sheet, sm, i] = this.llamaFrame(now);
    const s = PLAYER_H / this.meta.standH;
    g.fillStyle = 'rgba(0,0,0,.14)';
    const lift = GROUND_Y - pl.y;
    g.beginPath(); g.ellipse(PLAYER_X - 4, GROUND_Y + 1, Math.max(14, 38 - lift * 0.15), 6, 0, 0, Math.PI * 2); g.fill();
    drawLlama(g, this.A, sheet, i, Math.round(PLAYER_X - sm.anchorX * s), Math.round(pl.y - sm.cellH * s), s, this.outfit, now);
  }

  puff(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ x, y, vx: -60 - Math.random() * 120, vy: -Math.random() * 120, life: 0.4 + Math.random() * 0.2, color: '#fff6e8', s: 4 + Math.random() * 4 });
    }
  }

  sparkle(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 0.4, color, s: 6 });
    }
  }

  say(text) { this.msg = text ? { text, life: 4 } : null; }
}

export function label(g, str, x, y, size, color) {
  g.save();
  g.font = FONT(size, 900);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(4, size / 5);
  g.strokeStyle = '#3a2350';
  g.strokeText(str, x, y);
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.restore();
}
