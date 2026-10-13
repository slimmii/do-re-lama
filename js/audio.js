// Geluid en microfoon: één AudioContext voor de metronoom, de menugeluidjes en de toonhoogteherkenning.
// Tijdens het gitaarspel zijn er geen geluidjes (de microfoon zou ze voor noten kunnen houden), enkel de metronoom.
import { PitchDetector } from './pitch.js';
import { S } from './store.js';
import { GAME_MIDIS } from './notes.js';
import { devlog } from './devlog.js';

let ctx = null;
export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  return ctx;
}
export function unlock() { const c = audioCtx(); if (c.state !== 'running') c.resume().catch(() => {}); return c; }

// ---------- metronoom ----------
export function click(time, accent) {
  const c = audioCtx();
  const vol = S.settings.metroVol;
  if (vol <= 0) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.value = accent ? 1760 : 1100;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime((accent ? 0.6 : 0.35) * vol, time + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
  osc.connect(g).connect(c.destination);
  osc.start(time);
  osc.stop(time + 0.08);
}

// Klik zonder toonhoogte (korte ruis-'tok'), voor het meten van de vertraging.
let tokBuffer = null;
function tok(time, accent) {
  const c = audioCtx();
  if (!tokBuffer) {
    tokBuffer = c.createBuffer(1, Math.round(c.sampleRate * 0.03), c.sampleRate);
    const d = tokBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.006));
  }
  const src = c.createBufferSource();
  src.buffer = tokBuffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = accent ? 3500 : 2500;
  bp.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = accent ? 1.6 : 1.1;
  src.connect(bp).connect(g).connect(c.destination);
  src.start(time);
  return src;
}

// ---------- getokkelde gitaarsnaar (zonder gitaar spelen) ----------
// Karplus-Strong: een kort ruisje dat steeds rondgaat en zachter wordt klinkt als een snaar. Eén buffer per noot.
const plucks = new Map();
let ringing = null; // de snaar die nu klinkt: een nieuwe tokkel dempt ze, zoals op een echte gitaar
function pluckBuffer(c, midi) {
  if (plucks.has(midi)) return plucks.get(midi);
  const sr = c.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12);
  const N = Math.max(2, Math.round(sr / f - 0.5)); // het middelen vertraagt een halve sample
  const b = c.createBuffer(1, Math.round(sr * 2), sr), d = b.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < N; i++) { prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5; d[i] = prev; } // zacht ruisje: warme aanslag
  for (let i = N; i < d.length; i++) d[i] = 0.996 * 0.5 * (d[i - N] + d[i - N - 1 < 0 ? 0 : i - N - 1]);
  plucks.set(midi, b);
  return b;
}
export function pluck(midi, time) {
  const c = audioCtx();
  const t = Math.max(time ?? c.currentTime, c.currentTime);
  if (ringing) { ringing.g.gain.cancelScheduledValues(t); ringing.g.gain.setTargetAtTime(0, t, 0.02); ringing.s.stop(t + 0.15); }
  const s = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
  s.buffer = pluckBuffer(c, midi);
  lp.type = 'lowpass'; lp.frequency.value = 3500;
  g.gain.setValueAtTime(0.7, t);
  g.gain.setValueAtTime(0.7, t + 1.5);
  g.gain.linearRampToValueAtTime(0, t + 2); // uitdoven: de buffer stopt na 2 s
  s.connect(lp).connect(g).connect(c.destination);
  s.start(t);
  ringing = { s, g };
  s.onended = () => { if (ringing?.s === s) ringing = null; };
}

// ---------- geluidjes ----------
export const sound = { quiet: false }; // quiet: het gitaarspel luistert

function tone(c, t, f0, f1, dur, vol, type = 'sine') {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(c, t, dur, vol, freq = 1200) {
  const n = Math.round(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination);
  s.start(t);
}

export function sfx(name) {
  if (!S.settings.sfx || sound.quiet) return;
  const c = ctx;
  if (!c || c.state !== 'running') return;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'click': tone(c, t, 520, 820, 0.07, 0.12); tone(c, t, 1040, 1640, 0.05, 0.03); break;
    case 'tick': tone(c, t, 1300, 1300, 0.025, 0.035); break;
    case 'back': tone(c, t, 640, 380, 0.08, 0.1); break;
    case 'open': tone(c, t, 440, 660, 0.06, 0.08); tone(c, t + 0.05, 660, 990, 0.08, 0.07); break;
    case 'coin': tone(c, t, 1318, 1318, 0.07, 0.07, 'square'); tone(c, t + 0.07, 1976, 1976, 0.18, 0.06, 'square'); break;
    case 'buy': [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, t + i * 0.07, f, f, 0.16, 0.06, 'triangle')); break;
    case 'error': tone(c, t, 220, 180, 0.16, 0.12, 'sawtooth'); break;
    case 'start': [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.06, f, f, 0.14, 0.07, 'triangle')); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, f, f, 0.22, 0.07, 'triangle')); break;
    case 'jump': tone(c, t, 330, 760, 0.14, 0.08, 'square'); break;
    case 'hurt': noise(c, t, 0.18, 0.25, 900); tone(c, t, 200, 90, 0.2, 0.1, 'square'); break;
    case 'stomp': noise(c, t, 0.08, 0.2, 2000); tone(c, t, 520, 1040, 0.1, 0.07, 'square'); break;
    case 'strum': [196, 247, 294, 392, 494, 659].forEach((f, i) => tone(c, t + i * 0.025, f, f, 0.7, 0.05, 'triangle')); break; // G-akkoord
    case 'eat': [0, 0.13, 0.26].forEach((d) => { noise(c, t + d, 0.07, 0.22, 2600); tone(c, t + d, 300, 180, 0.06, 0.05, 'square'); }); break; // knabbel knabbel
    case 'heart': [784, 988, 1319].forEach((f, i) => tone(c, t + i * 0.06, f, f, 0.12, 0.06, 'triangle')); break;
    case 'over': [392, 330, 262, 196].forEach((f, i) => tone(c, t + i * 0.14, f, f * 0.98, 0.22, 0.08, 'triangle')); break;
  }
}

// ---------- microfoon ----------
const TUNE_MIN_HZ = 72; // stemmodus: ruim onder de lage mi (82 Hz), zodat ook een te lage snaar gehoord wordt
// mic.listen(fn) bepaalt wie de herkende noten krijgt. Ook het toetsenbord (S.settings.keyboard) stuurt
// noten via mic.emit, alsof ze van de gitaar kwamen.
export const mic = {
  detector: null,
  level: 0, midi: null, cents: 0, heardAt: 0,
  freq: null, freqAt: 0, // nauwkeurige toonhoogte (Hz) van een duidelijke toon, voor het stemmen
  error: null,
  label: '', // naam van de microfoon die nu luistert
  devices: [], // [{id, label}] alle microfoons; id '' = standaard van de browser
  listener: null,
  tuning: false, // stemmodus: de meting zoekt ook lage tonen (lage mi, 82 Hz)
  debug: false, // de detector legt per aanslag uit hoe hij aan zijn noot kwam (dev.mic() in de console)
  debugLog: [], // de laatste uitleg-berichten, voor de overlay in het spel
  listen(fn) { this.listener = fn; },
  emit(ev) { this.listener?.(ev); },
  get running() { return !!this.detector?.running; },

  async ensure() {
    const c = audioCtx();
    await c.resume().catch(() => {});
    if (this.detector?.running) return true;
    if (!navigator.mediaDevices?.getUserMedia || !c.audioWorklet) {
      this.error = 'Deze browser kan de microfoon niet gebruiken. Open het spel via http://localhost (zie start.command).';
      return false;
    }
    const d = new PitchDetector(c);
    d.sensitivity = S.settings.sens;
    d.latency = S.settings.latency / 1000;
    d.echoCancellation = S.settings.echo;
    d.deviceId = S.settings.micId;
    d.setAllowed(S.settings.onlyGameNotes ? GAME_MIDIS : []);
    d.setMinFreq(this.tuning ? TUNE_MIN_HZ : 90);
    let lvl = { max: 0, midi: null, since: 0 }; // logboek: om de seconde het luidste wat er was
    d.onFrame = (f) => {
      this.level = f.level;
      if (f.midi != null) { this.midi = f.midi; this.cents = f.cents; this.heardAt = this.freqAt = performance.now(); this.freq = f.freq; }
      else if (f.level < 0.05) this.midi = null;
      if (devlog.on) {
        if (f.level > lvl.max) lvl = { ...lvl, max: f.level, midi: f.midi };
        if (f.time - lvl.since > 1) {
          if (lvl.max > 0.02) devlog.write('niveau', { t: +f.time.toFixed(2), max: +lvl.max.toFixed(2), midi: lvl.midi });
          lvl = { max: 0, midi: null, since: f.time };
        }
      }
    };
    d.onNote = (ev) => { devlog.write('noot', ev); this.emit(ev); };
    d.debug = this.debug || devlog.on;
    d.onDebug = (m) => { devlog.write('detector', m); this.debugLog.push(m); if (this.debugLog.length > 12) this.debugLog.shift(); };
    try {
      await d.start();
      this.detector = d;
      this.label = d.label;
      this.error = null;
      devlog.write('microfoon', { naam: d.label, sampleRate: c.sampleRate, sens: d.sensitivity, latency: d.latency, echo: d.echoCancellation, enkelSpelnoten: !!S.settings.onlyGameNotes, stemmen: this.tuning });
      this.refreshDevices(); // na de toestemming kent de browser ook de namen
      return true;
    } catch (e) {
      this.error = 'Ik kan de microfoon niet gebruiken. Geef toestemming in je browser (klik op het slotje naast het adres).';
      return false;
    }
  },
  stop() { this.detector?.stop(); this.detector = null; this.level = 0; this.midi = null; this.label = ''; },

  // Lijst van microfoons. Zonder toestemming geeft de browser geen namen, dan nummeren we ze.
  async refreshDevices() {
    let all = [];
    try { all = await navigator.mediaDevices.enumerateDevices(); } catch {}
    // 'default' en 'communications' zijn verwijzingen van Chrome naar een echte microfoon uit de lijst
    const inputs = all.filter((x) => x.kind === 'audioinput' && x.deviceId && !['default', 'communications'].includes(x.deviceId));
    this.devices = [{ id: '', label: 'Standaard van de browser' }, ...inputs.map((x, i) => ({ id: x.deviceId, label: x.label || `Microfoon ${i + 1}` }))];
  },
  // Kies een andere microfoon; luisterde hij al, dan meteen herstarten met de nieuwe.
  async choose(id) {
    S.settings.micId = id;
    if (this.detector) { this.stop(); await this.ensure(); }
  },
  setExpect(midis) { this.detector?.setExpect(midis); },
  setTuning(on) { this.tuning = on; this.detector?.setMinFreq(on ? TUNE_MIN_HZ : 90); },
  setDebug(on) { this.debug = on; this.debugLog = []; if (this.detector) this.detector.debug = on || devlog.on; },
  applySettings() {
    const d = this.detector;
    if (!d) return;
    d.sensitivity = S.settings.sens;
    d.latency = S.settings.latency / 1000;
    d.setAllowed(S.settings.onlyGameNotes ? GAME_MIDIS : []);
  },
};

navigator.mediaDevices?.addEventListener?.('devicechange', () => mic.refreshDevices());

// ---------- microfoonvertraging meten ----------
// 4 aftelklikken en dan 8 klikken; bij elke klik tokkel je een losse snaar. Het mediane verschil tussen klik
// en tokkel is de totale vertraging (luidspreker + reactie + microfoon).
const CALIB_BPM = 75, CALIB_COUNT = 4, CALIB_PLAYS = 8;
const OPEN_STRINGS = [40, 45, 50, 55, 59, 64]; // klinkende midi van de losse snaren E A D G B E

export async function calibrate(onStatus) {
  if (!(await mic.ensure())) { onStatus({ done: true, ok: false, msg: mic.error }); return null; }
  const c = audioCtx();
  const prev = mic.listener;
  mic.detector.latency = 0;
  mic.detector.setAllowed(OPEN_STRINGS); // de lage snaren E A D horen niet bij de spelnoten
  mic.setExpect([]);
  const spb = 60 / CALIB_BPM;
  const t0 = c.currentTime + 0.6;
  const clicks = [], srcs = [], onsets = [], timers = [];
  for (let k = 0; k < CALIB_COUNT + CALIB_PLAYS; k++) {
    const t = t0 + k * spb;
    srcs.push(tok(t, k === 0 || k === CALIB_COUNT));
    if (k >= CALIB_COUNT) clicks.push(t);
    timers.push(setTimeout(() => onStatus(k < CALIB_COUNT
      ? { phase: 'listen', n: k + 1, of: CALIB_COUNT }
      : { phase: 'play', n: k - CALIB_COUNT + 1, of: CALIB_PLAYS, heard: onsets.length }), Math.max(0, (t - c.currentTime) * 1000)));
  }
  mic.listen((ev) => {
    if (ev.attack === false || !OPEN_STRINGS.includes(ev.midi)) return;
    if (ev.fresh != null && ev.fresh < 0.35) return;
    onsets.push(ev.time);
  });
  let over = false;
  const finish = (cancelled) => {
    if (over) return;
    over = true;
    timers.forEach(clearTimeout);
    srcs.forEach((s) => { try { s.stop(); } catch {} });
    mic.listen(prev);
    mic.applySettings();
    if (cancelled) return onStatus({ done: true, ok: false, msg: 'Gestopt.' });
    const diffs = [];
    for (const t of clicks) {
      const o = onsets.find((x) => x > t - 0.15 && x < t + 0.45);
      if (o != null) diffs.push(o - t);
    }
    if (diffs.length < 5) return onStatus({ done: true, ok: false, msg: `Ik hoorde maar ${diffs.length} van de ${CALIB_PLAYS} tokkels. Tokkel wat harder of zet de microfoon gevoeliger.` });
    diffs.sort((a, b) => a - b);
    const median = diffs[diffs.length >> 1];
    const spread = diffs.map((d) => Math.abs(d - median)).sort((a, b) => a - b)[diffs.length >> 1];
    if (spread > 0.07) return onStatus({ done: true, ok: false, msg: `De tokkels waren niet regelmatig genoeg (± ${Math.round(spread * 1000)} ms). Probeer nog eens, zo precies mogelijk op de klik.` });
    const ms = Math.max(0, Math.min(400, Math.round((median * 1000) / 5) * 5));
    S.settings.latency = ms;
    mic.applySettings();
    onStatus({ done: true, ok: true, ms, msg: `Gemeten: ${ms} ms (${diffs.length} van de ${CALIB_PLAYS} tokkels). Ingesteld!` });
  };
  const end = t0 + (CALIB_COUNT + CALIB_PLAYS - 1) * spb + 0.7;
  timers.push(setTimeout(() => finish(false), (end - c.currentTime) * 1000));
  return { cancel: () => finish(true) };
}
