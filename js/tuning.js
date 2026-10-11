// Gitaar stemmen: welke snaar hoor je, hoe vals is ze, en hoe blij is de lama.
// De lama is blij als de snaren onlangs gestemd zijn; elke snaar telt even zwaar.
// Een gestemde snaar blijft een halve dag 'vers' en zakt dan in drie dagen weg (snaren ontstemmen vanzelf).
import { solfege } from './notes.js';

// De zes snaren (6 t.e.m. 1) als klinkende midi. Voor de lage mi (82 Hz) zet het stemmen de meting in een
// lagere stand (mic.setTuning).
export const TUNE_STRINGS = [
  { n: 6, midi: 40 },
  { n: 5, midi: 45 },
  { n: 4, midi: 50 },
  { n: 3, midi: 55 },
  { n: 2, midi: 59 },
  { n: 1, midi: 64 },
].map((s) => ({ ...s, name: solfege(s.midi) }));

export const IN_TUNE = 10; // cent: goed genoeg gestemd
export const HOLD = 1; // seconden juist houden om een snaar af te vinken
const FRESH_H = 12, FADE_H = 72;
export const REWARD = 3; // munten als alle snaren gestemd zijn (hoogstens eens per dag)
export const REWARD_EVERY_H = 20;

const centsBetween = (freq, midi) => 1200 * Math.log2(freq / (440 * Math.pow(2, (midi - 69) / 12)));

/** Welke snaar is dit en hoeveel cent zit ze ernaast? pin = de snaar die de speler zelf koos. */
export function matchString(freq, pin = null) {
  if (!freq) return null;
  const list = pin ? TUNE_STRINGS.filter((s) => s.n === pin) : TUNE_STRINGS;
  let best = null;
  const consider = (s, f) => {
    const c = centsBetween(f, s.midi);
    if (!best || Math.abs(c) < Math.abs(best.cents)) best = { string: s, cents: c };
  };
  for (const s of list) {
    consider(s, freq);
    // de lage mi heeft een sterke boventoon: soms hoort de meting haar een octaaf te hoog
    if (s.n === 6) consider(s, freq / 2);
  }
  // te ver van elke snaar: iets anders (een gegrepen noot, iemand die zingt)
  return best && Math.abs(best.cents) <= (pin ? 600 : 250) ? best : null;
}

/** Hoe vers is een snaar die op tijdstip `at` (ms) gestemd werd? 1 = net gestemd, 0 = lang geleden of nooit. */
export function freshness(at, now = Date.now()) {
  if (!at) return 0;
  const h = (now - at) / 3.6e6;
  if (h <= FRESH_H) return 1;
  return Math.max(0, 1 - (h - FRESH_H) / FADE_H);
}

/** Blijheid van de lama (0..1) uit de stemtijden per snaar ({midi: ms}). */
export function happiness(tune, now = Date.now()) {
  const at = tune?.at || {};
  return TUNE_STRINGS.reduce((s, x) => s + freshness(at[x.midi], now), 0) / TUNE_STRINGS.length;
}

export const isSad = (h) => h < 0.4;
