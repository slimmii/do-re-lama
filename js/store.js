// Alles wat bewaard wordt: instellingen, munten en spulletjes, de reis en de records.
import { newJourney } from './lama-journey.js';
import { ITEMS } from './lama-style.js';
import { DEFAULT_SELECTION } from './notes.js';

const KEY = 'lama-reis:save';

// Testmodus (?test in de url): alles is van jou en er wordt niets bewaard.
export const TEST = new URLSearchParams(location.search).has('test');

const DEFAULTS = () => ({
  settings: {
    bpm: 30, // noten per minuut
    lives: 3, // 0 = onsterfelijk
    tol: 0.18, // hoe streng op de maat (breedte van de blauwe balk)
    bigName: true,
    names: false,
    fingers: true,
    metro: true,
    metroVol: 0.8,
    sfx: true,
    sens: 0.5,
    latency: 60,
    echo: false,
    keyboard: false, // spelen met het toetsenbord in plaats van de gitaar
    selection: [...DEFAULT_SELECTION], // noten bij vrij oefenen
  },
  best: {}, // record per spelvorm/combinatie van noten
  runBest: 0, // record van Lama Run
  wallet: { coins: 0, owned: [], outfit: {}, imported: [] },
  journey: newJourney(),
  intro: false, // uitleg al gezien
});

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

const raw = read();
const d = DEFAULTS();
export const S = {
  ...d,
  ...raw,
  settings: { ...d.settings, ...raw.settings },
  wallet: { ...d.wallet, ...raw.wallet },
  journey: Object.assign(newJourney(), raw.journey),
};
if (S.journey.at == null || S.journey.at > S.journey.stage) S.journey.at = S.journey.stage;

if (TEST) S.wallet = { coins: 50, owned: ITEMS.map((i) => i.id), outfit: { ...S.wallet.outfit }, imported: [] };

let timer = 0;
export function persist(now = false) {
  if (TEST) return;
  clearTimeout(timer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  if (now) write(); else timer = setTimeout(write, 250);
}
addEventListener('pagehide', () => persist(true));

export function resetAll() {
  const fresh = DEFAULTS();
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, fresh);
  persist(true);
}
