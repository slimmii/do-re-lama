// Het gitaarspel (reis of vrij oefenen): spelregels, spelen, pauze en game over. De HUD staat onderaan op de bodem.
import { ui } from '../ui.js';
import { C, text, title, pill, bar, rr, wrap, icon, star, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { audioCtx, click, mic, pluck, sound, sfx, unlock } from '../audio.js';
import { devlog } from '../devlog.js';
import { LamaGame, PLAYER_X, GROUND_Y } from '../game.js';
import { PRACTICE_NOTES, soundingMidi, solfegeMidi, solfegeOf, describePosition } from '../notes.js';
import {
  STAGES, GATE_HITS, BOSS_COINS, STAR_MIN_NOTES, unlockedNotes, isLastStage, accuracy, ready, record, bossFor, advance,
} from '../lama-journey.js';
import { BIOMES } from '../lama-world.js';
import { fitWorld } from '../backdrop.js';
import { card, dimScreen, noteChip } from './common.js';

const COINS_JOURNEY = 1 / 2, COINS_FREE = 1 / 9; // gemiddeld 1 op 3 noten een munt, bij vrij oefenen 1 op 10
const JOURNEY_LIVES = 3; // op de reis altijd 3 levens; de instelling geldt enkel bij vrij oefenen
const TAP_CHOICES = 3; // zonder gitaar: zoveel knoppen om uit te kiezen

// Zonder gitaar: de juiste noot en een paar andere uit het spel, van laag naar hoog. Blijft vast per noot.
function choicesFor(n, pool) {
  if (!n.choices) {
    const others = pool.filter((p) => p !== n.p).sort(() => Math.random() - 0.5).slice(0, TAP_CHOICES - 1);
    n.choices = [n.p, ...others].sort((a, b) => soundingMidi(a) - soundingMidi(b));
  }
  return n.choices;
}

// Naam op een knop: hoge do en sol krijgen een accent, zodat ze verschillen van de lage.
const tapName = (p) => solfegeOf(p) + (p === 'G5' || p === 'C5' ? '′' : '');

function getGame() {
  if (!app.game) app.game = new LamaGame({ ctx: audioCtx, click, setExpect: (m) => mic.setExpect(m) });
  return app.game;
}

export class PlayScene {
  constructor({ mode }) {
    this.mode = mode; // 'reis' | 'vrij'
    this.state = 'ready'; // ready | mic | micerr | play | over
  }

  get journey() { return this.mode === 'reis'; }
  get tap() { return !this.journey && S.settings.noGuitar; } // vrij oefenen zonder gitaar: tikken op een keuze
  atFront() { return S.journey.at === S.journey.stage; }

  enter() {
    const game = this.game = getGame();
    S.journey.mode = this.mode;
    game.o.onOver = () => this.onOver();
    game.onJudge = (note, ok, n) => this.onJudge(note, ok, n);
    game.onBossWon = () => this.onBossWon();
    game.onCoin = () => { S.wallet.coins++; persist(); };
    game.onBest = (best) => { S.best[this.bestKey()] = best; persist(); };
    mic.listen((ev) => game.onNote(ev));
    this.configure();
    this.onVis = () => { if (document.hidden && this.state === 'play' && game.running) this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
  }

  leave() {
    this.game.stop();
    sound.quiet = false;
    mic.listen(null);
    mic.setExpect([]);
    document.removeEventListener('visibilitychange', this.onVis);
  }

  resize(VW) { this.game?.resize(VW); }

  bestKey() {
    const base = this.journey ? `reis:${S.journey.at}` : [...S.settings.selection].sort().join(',');
    const lives = this.journey ? '' : S.settings.lives === 3 ? '' : `|${S.settings.lives}`;
    return base + lives + (this.tap ? '|tik' : '');
  }

  configure() {
    const g = this.game, st = S.settings, j = S.journey;
    g.resize(app.engine.VW);
    g.bpm = st.bpm;
    g.setBarBeats(Math.round(st.tol * 2.5 * 100) / 100);
    g.metro = st.metro;
    g.showNames = st.names;
    g.showFingers = st.fingers;
    g.bigName = st.bigName && !this.tap; // zonder gitaar staan daar de keuzeknoppen
    g.keyboard = st.keyboard && !this.tap;
    g.maxLives = this.journey ? JOURNEY_LIVES : st.lives;
    g.outfit = S.wallet.outfit;
    g.fresh = j.fresh;
    g.coinChance = this.journey ? COINS_JOURNEY : COINS_FREE;
    if (this.journey) g.world.stay(j.at);
    else g.world.wander(STAGES.slice(0, j.stage + 1).map((s) => s.biome), g.dist);
    g.setPool(this.journey ? unlockedNotes(j.at) : PRACTICE_NOTES.filter((n) => st.selection.includes(n)));
    g.best = g.immortal() ? 0 : S.best[this.bestKey()] || 0;
  }

  // Na het wijzigen van instellingen tijdens de pauze.
  applyLive() {
    const g = this.game, st = S.settings;
    g.bpm = st.bpm;
    g.setBarBeats(Math.round(st.tol * 2.5 * 100) / 100);
    g.metro = st.metro; g.showNames = st.names; g.showFingers = st.fingers; g.bigName = st.bigName && !this.tap; g.keyboard = st.keyboard && !this.tap;
    g.outfit = S.wallet.outfit;
    mic.applySettings();
  }

  // ---------- reis ----------
  onJudge(note, ok, n) {
    const j = S.journey, g = this.game;
    const stars = this.journey || (g.pool.length >= STAR_MIN_NOTES && !this.tap); // tikken zegt niets over gitaarspelen
    record(j, note, ok, { journey: this.journey && this.atFront(), boss: !!n.boss, stars });
    persist();
    this.checkGate();
  }

  // Klaar voor de poortwachter (op de reis, in je verste landschap)? Dan komt hij aan de grens staan.
  checkGate() {
    const j = S.journey, g = this.game;
    if (this.journey && this.atFront() && g.running && !g.boss && ready(j)) {
      const b = bossFor(j.stage);
      if (g.world.img[BIOMES[b.stage].id]) g.queueBoss(b);
    }
  }

  onBossWon() {
    const j = S.journey, g = this.game;
    advance(j);
    const coins = g.immortal() ? 0 : BOSS_COINS; // onsterfelijk: geen munten, ook niet van de poortwachter
    S.wallet.coins += coins;
    g.setPool(unlockedNotes(j.stage));
    g.world.goTo(j.stage, g.dist + g.W); // het nieuwe landschap schuift binnen
    g.banner = { text: `Je kent nu ${STAGES[j.stage].notes.map(solfegeOf).join(' en ')}!`, life: 4 };
    this.wonStage = true;
    persist();
    return coins;
  }

  // ---------- spelverloop ----------
  async start() {
    if (this.state === 'mic' || this.state === 'play') return;
    unlock();
    sfx('start');
    if (!S.settings.keyboard && !this.tap) {
      this.state = 'mic';
      const ok = await mic.ensure();
      if (!ok) { this.state = 'micerr'; this.stateT = this.t; return; }
    }
    if (app.engine.top() !== this) { this.state = 'ready'; return; }
    mic.applySettings();
    this.configure();
    this.game.start();
    devlog.write('start', { spelvorm: this.mode, noten: this.game.pool, bpm: this.game.bpm, balk: this.game.barBeats, levens: this.game.maxLives, toetsenbord: !!S.settings.keyboard, zonderGitaar: this.tap, landschap: this.journey ? S.journey.at : null });
    this.game.say(this.tap ? 'Tik op de noot boven het monster als ze in de blauwe balk staat!' : S.intro ? '' : 'Speel de noot boven het monster als ze in de blauwe balk staat!');
    S.intro = true;
    this.wonStage = false;
    sound.quiet = true;
    this.state = 'play';
    this.stateT = this.t;
  }

  onOver() {
    sound.quiet = false;
    this.state = 'over';
    this.stateT = this.t;
    persist();
    setTimeout(() => sfx('over'), 350);
  }

  pause() {
    if (this.state !== 'play' || !this.game.running) return;
    this.game.pause();
    sound.quiet = false;
    app.engine.push(app.scenes.pause({
      title: 'Pauze',
      onResume: () => this.resume(),
      onRestart: () => { this.game.stop(); this.state = 'ready'; this.start(); },
      onQuit: () => this.quit(),
      onSettings: () => this.applyLive(),
    }));
  }

  resume() {
    this.applyLive();
    this.game.resume();
    sound.quiet = true;
  }

  quit() {
    this.game.stop();
    app.engine.go(this.journey ? app.scenes.journey() : app.scenes.free());
  }

  back() {
    if (this.state === 'play') return this.pause();
    this.quit();
  }

  setSpeed(d) {
    S.settings.bpm = clamp(S.settings.bpm + d, 15, 90);
    this.game.bpm = S.settings.bpm;
    persist();
  }

  key(e) {
    const k = e.code;
    if (this.state === 'play') {
      if (k === 'Escape' || k === 'KeyP') { this.pause(); return true; }
      if (k === 'ArrowLeft' || k === 'ArrowRight') { this.setSpeed(k === 'ArrowRight' ? 5 : -5); return true; }
      if (this.tap) {
        const i = /^(?:Digit|Numpad)([1-9])$/.exec(k)?.[1] - 1;
        const t = this.game.running && this.game.target();
        if (t && i >= 0) { const p = choicesFor(t, this.game.pool)[i]; if (p && !e.repeat) this.answer(p); return true; }
      }
      if (S.settings.keyboard && !this.tap && !e.repeat) {
        const p = this.game.noteForKey(k);
        if (p) { mic.emit({ midi: soundingMidi(p), time: audioCtx().currentTime, attack: true }); return true; }
        if (/^Key[A-Z]$|^Semicolon$|^Quote$|^Backslash$/.test(k) && this.game.running) { // een toets zonder noot = fout
          const others = PRACTICE_NOTES.filter((n) => !this.game.pool.includes(n));
          const wrong = others[0] || 'C4';
          mic.emit({ midi: soundingMidi(wrong), time: audioCtx().currentTime, attack: true });
          return true;
        }
      }
      return k === 'Space';
    }
    if ((this.state === 'ready' || this.state === 'over') && (k === 'Space' || k === 'Enter') && !ui.kb) { this.start(); return true; }
    return false;
  }

  update() { this.game.update(); }

  // Zonder gitaar: een keuze telt als een tokkel op die noot, en je hoort ze ook.
  answer(p) {
    const time = audioCtx().currentTime;
    pluck(soundingMidi(p), time);
    mic.emit({ midi: soundingMidi(p), time, attack: true });
  }

  // Meteen bij het neerdrukken (niet pas bij het loslaten): dat telt voor de timing.
  pointer(phase, x, y) {
    if (phase !== 'down' || !this.tap || this.state !== 'play' || !this.game.running) return;
    const i = /^tap:(\d)$/.exec(ui.hit(x, y)?.id ?? '')?.[1];
    const t = this.game.target();
    if (i != null && t) this.answer(choicesFor(t, this.game.pool)[i]);
  }

  draw(g, VW, VH, isTop) {
    const game = this.game;
    game.resize(VW);
    const st = this.state;
    const oy = fitWorld(g, game.world, game.dist, VW, VH, () => {
      game.draw(g, { staff: true, behind: () => this.drawBubble(g) });
      this.drawHud(g, VW);
      if (this.tap && st === 'play' && game.running) this.drawChoices(g);
    });
    if (mic.debug) this.drawDebug(g, VW, VH);
    if (st === 'ready' || st === 'mic') this.drawReady(g, VW, VH);
    else if (st === 'micerr') this.drawMicError(g, VW, VH);
    else if (st === 'over' && this.t - this.stateT > 0.7) this.drawOver(g, VW, VH);
    else if (st === 'play' && this.t - this.stateT < 1.6) { // "Daar gaan we!"
      const u = (this.t - this.stateT) / 1.6;
      g.save(); g.globalAlpha = Math.min(1, (1 - u) * 3);
      title(g, 'Daar gaan we!', VW / 2, oy + 345 - ease.out(Math.min(1, u * 3)) * 20, 46, C.cream);
      g.restore();
    }
  }

  // ---------- tekstballon bij de lama ----------
  drawBubble(g) {
    const m = this.game.msg;
    if (!m || !(this.game.running || this.game.paused)) return;
    const a = Math.min(1, m.life * 2, (4 - m.life) * 6);
    const bigX = PLAYER_X + (this.game.W - PLAYER_X) * 0.48;
    const maxW = Math.min(330, bigX - 110 - 40);
    const lines = wrap(g, m.text, maxW - 28, 17, 800);
    const w = Math.min(maxW, Math.max(...lines.map((l) => ui.measure(l, 17, 800))) + 32), h = lines.length * 22 + 20;
    const x = 18, y = 186;
    g.save();
    g.globalAlpha = a;
    g.translate(0, (1 - Math.min(1, (4 - m.life) * 6)) * 8);
    g.beginPath();
    g.roundRect(x, y, w, h, 16);
    g.moveTo(PLAYER_X - 30, y + h - 1); g.lineTo(PLAYER_X - 16, y + h + 14); g.lineTo(PLAYER_X - 2, y + h - 1);
    g.fillStyle = '#fff'; g.fill();
    g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    g.fillStyle = '#fff'; g.fillRect(PLAYER_X - 28, y + h - 4, 24, 5);
    lines.forEach((l, i) => text(g, l, x + 16, y + 21 + i * 22, { size: 17, weight: 800, color: C.text, align: 'left' }));
    g.restore();
  }

  // ---------- zonder gitaar: keuzeknoppen op de plek van de grote notennaam ----------
  drawChoices(g) {
    const game = this.game, t = game.target();
    if (!t) return;
    const list = choicesFor(t, game.pool);
    const hot = game.inBar(game.xOf(t) - PLAYER_X);
    const bw = 116, bh = 84, gap = 16, tw = list.length * (bw + gap) - gap;
    const cx = Math.min(PLAYER_X + (game.W - PLAYER_X) * 0.48, game.W - tw / 2 - 16), y = 240 - bh / 2;
    list.forEach((p, i) => {
      // geen onClick: pointer() reageert al bij het neerdrukken
      ui.button('tap:' + i, cx - tw / 2 + i * (bw + gap), y, bw, bh, tapName(p), {
        variant: hot ? (t.kind === 'coin' ? 'gold' : 'blue') : 'paper', size: 34, badge: list.length > 1 ? String(i + 1) : null, focus: false,
      });
    });
  }

  // ---------- HUD op de bodem ----------
  drawHud(g, W) {
    const game = this.game, j = S.journey;
    const y = 495, h = 38, cy = y + h / 2;
    const A = app.A;
    let x = 12;
    // levens
    const shake = game.hurtT > 0 ? Math.sin(game.hurtT * 50) * 4 * game.hurtT : 0;
    if (game.immortal()) {
      pill(g, x, y, 128, h);
      text(g, '∞', x + 22, cy, { size: 28, color: C.pink, stroke: C.ink, strokeW: 5 });
      text(g, `${game.bumps} botsing${game.bumps === 1 ? '' : 'en'}`, x + 42, cy + 1, { size: 15, color: '#fff', align: 'left' });
      x += 138;
    } else if (game.maxLives <= 5) {
      const w = game.maxLives * 30 + 14;
      pill(g, x, y, w, h);
      for (let i = 0; i < game.maxLives; i++) {
        g.globalAlpha = i < game.lives ? 1 : 0.22;
        g.drawImage(A.img.heart, x + 8 + i * 30 + (i === game.lives ? shake : 0), y + 6, 26, 27);
      }
      g.globalAlpha = 1;
      x += w + 10;
    } else {
      pill(g, x, y, 88, h);
      g.drawImage(A.img.heart, x + 8 + shake, y + 6, 26, 27);
      text(g, `${game.lives}`, x + 42, cy + 1, { size: 22, color: '#fff', align: 'left', stroke: C.ink, strokeW: 5 });
      x += 98;
    }
    // punten + record
    const sw = game.immortal() ? 96 : 150;
    pill(g, x, y, sw, h);
    star(g, x + 20, cy, 11, true, { color: '#7ee08a' });
    text(g, game.score, x + 38, cy + 1, { size: 24, color: '#fff', align: 'left', stroke: C.ink, strokeW: 5 });
    if (!game.immortal()) text(g, `record ${game.best}`, x + sw - 12, cy + 2, { size: 13, weight: 800, color: game.newBest ? C.gold : '#cbbfe0', align: 'right' });
    x += sw + 10;
    // poort (op de reis, in je verste landschap)
    if (this.journey && this.atFront() && !isLastStage(j.stage)) {
      const gw = W < 900 ? 128 : 168, bw = W < 900 ? 34 : 70;
      pill(g, x, y, gw, h);
      icon(g, 'crown', x + 20, cy, 20, C.gold);
      if (game.boss && !game.boss.won) text(g, 'Poortwachter!', x + 36, cy + 1, { size: 16, color: C.gold, align: 'left', maxW: gw - 44 });
      else if (ready(j)) text(g, 'Poort is open', x + 36, cy + 1, { size: 16, color: C.gold, align: 'left', maxW: gw - 44 });
      else {
        bar(g, x + 36, cy - 6, bw, 12, j.progress / GATE_HITS, { color: C.orange, back: 'rgba(255,255,255,.2)', bw: 1.5, border: 'rgba(255,255,255,.4)' });
        text(g, `${Math.min(j.progress, GATE_HITS)}/${GATE_HITS}`, x + gw - 10, cy + 1, { size: 14, color: '#fff', align: 'right' });
      }
      x += gw + 10;
    }

    // rechts: pauze, snelheid, munten, microfoon
    let r = W - 12;
    const paused = this.state !== 'play';
    if (this.state === 'play') ui.iconButton('hud:pause', r - 21, cy, 42, 'pause', { onClick: () => this.pause(), focus: false });
    r -= 52;
    const spw = 146;
    pill(g, r - spw, y, spw, h);
    if (!paused) {
      ui.button('hud:slow', r - spw + 4, y + 5, 28, 28, null, { icon: 'minus', variant: 'dark', depth: 2, r: 14, iconSize: 14, onClick: () => this.setSpeed(-5), focus: false, sound: 'silent' });
      ui.button('hud:fast', r - 32, y + 5, 28, 28, null, { icon: 'plus', variant: 'dark', depth: 2, r: 14, iconSize: 14, onClick: () => this.setSpeed(5), focus: false, sound: 'silent' });
    }
    text(g, S.settings.bpm, r - spw / 2, cy - 5, { size: 19, color: '#fff' });
    text(g, 'noten/min', r - spw / 2, cy + 11, { size: 10.5, weight: 800, color: '#cbbfe0' });
    r -= spw + 10;
    if (!game.immortal()) {
      const cw = 92, b = game.coinT > 0 ? Math.sin((game.coinT / 0.5) * Math.PI) : 0;
      pill(g, r - cw, y, cw, h);
      const s = 1 + b * 0.35;
      g.drawImage(A.img.coin, r - cw + 6 - b * 5, y + 4 - b * 6, 28 * s, 30 * s);
      text(g, S.wallet.coins, r - cw + 40, cy + 1, { size: 20, color: C.gold, align: 'left', stroke: C.ink, strokeW: 5 });
      r -= cw + 10;
    }
    if (r - x > 150) this.drawMic(g, r - 140, y, 140, h);
  }

  drawMic(g, x, y, w, h) {
    pill(g, x, y, w, h);
    const cy = y + h / 2;
    if (this.tap) {
      icon(g, 'note', x + 20, cy, 20, '#fff');
      text(g, 'zonder gitaar', x + 36, cy + 1, { size: 14, color: '#fff', align: 'left' });
      return;
    }
    if (S.settings.keyboard) {
      icon(g, 'keyboard', x + 20, cy, 20, '#fff');
      text(g, 'toetsenbord', x + 36, cy + 1, { size: 14, color: '#fff', align: 'left' });
      return;
    }
    icon(g, 'mic', x + 18, cy, 20, mic.running ? '#fff' : '#9c8fae');
    rr(g, x + 32, cy - 4, 40, 8, 4); g.fillStyle = 'rgba(255,255,255,.2)'; g.fill();
    rr(g, x + 32, cy - 4, 40 * clamp(mic.level, 0, 1), 8, 4); g.fillStyle = C.green; g.fill();
    const tgt = this.game.running ? this.game.target() : null;
    const recent = mic.midi != null && performance.now() - mic.heardAt < 600;
    const name = recent ? solfegeMidi(mic.midi) : '–';
    const match = recent && tgt && soundingMidi(tgt.p) === mic.midi;
    text(g, name, x + w - 30, cy + 1, { size: 18, color: match ? '#7ee08a' : '#fff', stroke: match ? C.ink : null, strokeW: 4 });
  }

  // ---------- ontwikkelaars: wat hoorde de detector, en wat deed het spel ermee (dev.mic() in de console) ----------
  drawDebug(g, VW, VH) {
    const nm = (m) => (m == null ? '–' : solfegeMidi(m));
    const rows = mic.debugLog.slice(-8).map((d) => {
      const tr = this.game.trace.find((x) => Math.abs(x.t - d.t) < 0.005);
      const heard = d.m === 'GEEN' || d.m == null ? 'GEEN' : nm(d.m) + (d.sub != null ? ` (yin zei ${nm(d.sub)}: ondertoon)` : '');
      const yin = d.y != null ? `${nm(d.y)}×${d.strict}` : '–';
      const game = tr ? `${tr.verdict} (wil ${nm(tr.want)}, ${Math.round(tr.d)}px)` : '';
      return `${d.t.toFixed(2)}  ${heard}   yin ${yin}  best ${nm(d.best)}  nieuw ${d.fy ?? '–'}/${d.fb ?? '–'}${d.hit != null ? `  verwacht ${nm(d.hit)}` : ''}   ${game}`;
    });
    const h = 22 * rows.length + 34, y = VH - h - 12;
    rr(g, 12, y, Math.min(VW - 24, 720), h, 10); g.fillStyle = 'rgba(20,10,30,.8)'; g.fill();
    text(g, 'microfoon (dev.mic(false) zet dit uit)', 24, y + 16, { size: 12, weight: 700, color: '#b07cff', align: 'left' });
    rows.forEach((s, i) => text(g, s, 24, y + 38 + i * 22, { size: 12, weight: 700, color: '#fff', align: 'left' }));
  }

  // ---------- kaarten ----------
  drawReady(g, VW, VH) {
    dimScreen(g, VW, VH, 0.35);
    const j = S.journey, game = this.game;
    const w = Math.min(600, VW - 40), h = 360;
    card(g, VW, VH, w, h, this.t, (x, y) => {
      const head = this.journey ? STAGES[j.at].name : 'Vrij oefenen';
      title(g, head, VW / 2, y + 40, 34, C.orange);
      // de noten van dit spel
      const notes = [...game.pool].sort((a, b) => soundingMidi(a) - soundingMidi(b));
      const cw = Math.min(78, (w - 60) / notes.length - 8), ch = 58;
      const tw = notes.length * (cw + 8) - 8;
      notes.forEach((p, i) => {
        const nx = VW / 2 - tw / 2 + i * (cw + 8);
        noteChip(g, nx, y + 72, cw, ch, solfegeOf(p), this.tap ? 'tik' : S.settings.keyboard ? `toets ${game.keyOf.get(p)?.[1] ?? ''}` : describePosition(p).replace('snaar, ', '· ').replace('e vakje', ''), j.fresh[p] > 0 && this.journey ? C.pink : C.blue);
        if (j.fresh[p] > 0 && this.journey) {
          rr(g, nx + cw / 2 - 24, y + 64, 48, 16, 8); g.fillStyle = C.pink; g.fill();
          text(g, 'NIEUW', nx + cw / 2, y + 72.5, { size: 11, color: '#fff' });
        }
      });
      const lines = [
        this.tap ? 'Tik op de noot boven het monster terwijl ze in de blauwe balk staat: de lama springt!'
          : 'Speel de noot boven het monster terwijl ze in de blauwe balk staat: de lama springt!',
        game.immortal() ? 'Fout of te laat = botsen. Onsterfelijk: je kan niet verliezen (en er zijn geen munten).'
          : `Fout of te laat = botsen. Je hebt ${game.maxLives} ${game.maxLives === 1 ? 'leven' : 'levens'}. Een munt in de lucht? ${this.tap ? 'Tik' : 'Speel'} die noot en vang ze!`,
      ];
      if (this.journey && this.atFront() && !isLastStage(j.stage)) lines.push(ready(j) ? 'De poortwachter wacht op je!' : `Nog ${Math.max(0, GATE_HITS - j.progress)} juiste noten tot de poortwachter (80% juist).`);
      let ly = y + 150;
      for (const l of lines) {
        for (const s of wrap(g, l, w - 70, 16, 800)) { text(g, s, VW / 2, ly, { size: 16, weight: 800, color: C.text }); ly += 21; }
        ly += 6;
      }
      const busy = this.state === 'mic';
      ui.button('rd:start', VW / 2 - 130, y + h - 92, 260, 62, busy ? 'Microfoon…' : 'Start', { icon: busy ? 'mic' : 'play', primary: true, onClick: () => this.start(), disabled: busy, sound: 'silent' });
      ui.button('rd:back', x + 16, y + h - 74, 110, 44, 'Terug', { icon: 'back', variant: 'paper', size: 17, onClick: () => this.quit(), sound: 'back' });
      ui.button('rd:set', x + w - 16 - 52, y + h - 74, 52, 44, null, { icon: 'gear', variant: 'paper', onClick: () => app.engine.push(app.scenes.settings({ onClose: () => this.configure() })), sound: 'open' });
      text(g, 'spatie = start', VW / 2, y + h - 16, { size: 13, weight: 800, color: C.muted });
    });
  }

  drawMicError(g, VW, VH) {
    dimScreen(g, VW, VH, 0.45);
    const w = Math.min(560, VW - 40), h = 300;
    card(g, VW, VH, w, h, this.t - this.stateT, (x, y) => {
      icon(g, 'mic', VW / 2, y + 44, 40, C.pink);
      title(g, 'Geen microfoon', VW / 2, y + 88, 30, C.orange);
      let ly = y + 124;
      for (const s of wrap(g, mic.error || 'De microfoon werkt niet.', w - 70, 16, 800)) { text(g, s, VW / 2, ly, { size: 16, weight: 800, color: C.text }); ly += 21; }
      const bw = (w - 64) / 3;
      ui.button('me:retry', x + 16, y + h - 76, bw, 52, 'Opnieuw', { icon: 'retry', primary: true, size: 18, onClick: () => { this.state = 'ready'; this.start(); } });
      ui.button('me:kb', x + 32 + bw, y + h - 76, bw, 52, 'Toetsenbord', { icon: 'keyboard', variant: 'blue', size: 17, onClick: () => { S.settings.keyboard = true; persist(); this.state = 'ready'; this.start(); } });
      ui.button('me:back', x + 48 + 2 * bw, y + h - 76, bw, 52, 'Terug', { icon: 'back', variant: 'paper', size: 18, onClick: () => { this.state = 'ready'; }, sound: 'back' });
    });
  }

  drawOver(g, VW, VH) {
    const t = this.t - this.stateT - 0.7;
    dimScreen(g, VW, VH, Math.min(0.5, t * 2));
    const game = this.game, j = S.journey;
    const w = Math.min(560, VW - 40), h = 372;
    card(g, VW, VH, w, h, t, (x, y) => {
      title(g, 'GAME OVER', VW / 2, y + 44, 48, '#ff9cbd');
      const n = Math.round(game.score * ease.out(clamp(t / 0.8, 0, 1)));
      title(g, n, VW / 2, y + 112, 64, C.gold);
      text(g, game.score === 1 ? 'punt' : 'punten', VW / 2, y + 152, { size: 18, color: C.muted });
      if (game.newBest && game.score > 0) {
        const p = 1 + Math.sin(this.t * 6) * 0.05;
        g.save(); g.translate(x + w - 92, y + 108); g.rotate(0.18); g.scale(p, p);
        rr(g, -62, -20, 124, 40, 12); g.fillStyle = C.gold; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
        text(g, 'RECORD!', 0, 1, { size: 20, color: '#fff', stroke: C.ink, strokeW: 5 });
        g.restore();
      } else text(g, `record ${game.best}`, x + w - 92, y + 112, { size: 16, color: C.muted });
      // statistieken
      const total = game.hits + game.misses;
      const stats = [
        ['check', `${game.hits}`, 'juist', C.greenD],
        ['close', `${game.misses}`, 'fout/laat', C.bad],
        ['star', total ? `${Math.round((game.hits / total) * 100)}%` : '–', 'raak', C.goldD],
      ];
      if (!game.immortal()) stats.push(['coin', `+${game.coins + game.bossCoins}`, 'munten', C.goldD]);
      const sw = (w - 60) / stats.length;
      stats.forEach(([ic, v, l, col], i) => {
        const sx = x + 30 + i * sw;
        rr(g, sx + 4, y + 172, sw - 8, 74, 14); g.fillStyle = C.paper2; g.fill();
        if (ic === 'coin') g.drawImage(app.A.img.coin, sx + sw / 2 - 40, y + 186, 22, 24);
        else icon(g, ic, sx + sw / 2 - 29, y + 198, 20, col);
        text(g, v, sx + sw / 2 + 10, y + 198, { size: 24, color: C.text });
        text(g, l, sx + sw / 2, y + 228, { size: 14, weight: 800, color: C.muted });
      });
      if (this.wonStage) text(g, `Nieuw landschap bereikt: ${STAGES[j.stage].name}!`, VW / 2, y + 266, { size: 16, color: C.greenD });
      else if (this.journey && this.atFront() && !isLastStage(j.stage))
        text(g, ready(j) ? 'De poortwachter wacht op je!' : `Poort: ${Math.min(j.progress, GATE_HITS)}/${GATE_HITS} juist · ${Math.round(accuracy(j.recent) * 100)}% raak (80% nodig)`, VW / 2, y + 266, { size: 15, color: C.muted });
      const bw = (w - 48) / 2;
      ui.button('go:again', x + 16, y + h - 82, bw, 60, 'Opnieuw', { icon: 'retry', primary: true, onClick: () => this.start(), sound: 'silent' });
      ui.button('go:menu', x + 32 + bw, y + h - 82, bw, 60, this.journey ? 'De kaart' : 'Noten kiezen', { icon: this.journey ? 'map' : 'note', variant: 'blue', size: 20, onClick: () => this.quit(), sound: 'back' });
    });
  }
}
