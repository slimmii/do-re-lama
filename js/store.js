// Alles wat bewaard wordt: instellingen, munten en spulletjes, de reis en de records.
import { newJourney } from './lama-journey.js';
import { ITEMS } from './lama-style.js';
import { HOUSE_ITEMS, HOUSE_SLOTS } from './treehouse.js';
import { DEFAULT_SELECTION } from './notes.js';
import { FOODS, newFood } from './food.js';

const KEY = 'lama-reis:save';

// Testmodus (?test in de url): alles is van jou en er wordt niets bewaard.
export const TEST = new URLSearchParams(location.search).has('test');

const DEFAULTS = () => ({
  settings: {
    bpm: 30, // noten per minuut
    lives: 3, // levens bij vrij oefenen (0 = onsterfelijk); op de reis altijd 3
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
    onlyGameNotes: true, // de microfoon negeert tonen die niet in het spel voorkomen (bv. zingen)
    micId: '', // gekozen microfoon (deviceId); '' = standaard van de browser
    keyboard: false, // spelen met het toetsenbord in plaats van de gitaar
    noGuitar: false, // vrij oefenen zonder gitaar: tik op de juiste noot (3 keuzes)
    selection: [...DEFAULT_SELECTION], // noten bij vrij oefenen
    freeTab: 'notes', // vrij oefenen: 'notes' (zelf noten kiezen) of 'songs' (liedjesbibliotheek)
  },
  best: {}, // record per spelvorm/combinatie van noten
  songs: {}, // liedjesbibliotheek: beste % juist per liedje (id, of id|tik zonder gitaar)
  song: null, // laatst gekozen liedje
  wallet: { coins: 0, owned: [], outfit: {}, imported: [], vouchers: [], gifts: 0 }, // vouchers: ingewisselde cadeaubonnen, gifts: gratis spulletjes nog te kiezen
  house: { owned: [], placed: {} }, // de boomhut: gekochte spulletjes en wat waar staat
  journey: newJourney(),
  food: newFood(), // eten: de voorraadkast en hoe vol het buikje is
  tune: { at: {}, rewardAt: 0 }, // gitaar stemmen: wanneer elke snaar (klinkende midi) gestemd werd, laatste beloning
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
  house: { ...d.house, ...raw.house },
  tune: { ...d.tune, ...raw.tune },
  food: { ...d.food, ...raw.food, pantry: { ...raw.food?.pantry } },
  journey: Object.assign(newJourney(), raw.journey),
};
delete S.runBest; // van Lama Run, die er niet meer is
// plekken waar meer dingen mogen staan (huisdieren) bewaren een lijst; vroeger was dat één id
for (const s of HOUSE_SLOTS) if (s.multi && S.house.placed[s.id] != null && !Array.isArray(S.house.placed[s.id])) S.house.placed[s.id] = [S.house.placed[s.id]];
if (S.journey.at == null || S.journey.at > S.journey.stage) S.journey.at = S.journey.stage;

if (TEST) S.wallet = { coins: 50, owned: ITEMS.map((i) => i.id), outfit: { ...S.wallet.outfit }, imported: [] };
if (TEST) S.house = { owned: HOUSE_ITEMS.map((i) => i.id), placed: { ...S.house.placed } };
if (TEST) S.food = { ...newFood(), full: 0.2, pantry: Object.fromEntries(FOODS.map((f) => [f.id, 3])) };

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
