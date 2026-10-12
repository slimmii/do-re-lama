// Eten voor de lama: in de winkel (afdeling Eten) koop je voedsel, in de boomhut geef je het haar (knop Eten).
// Eten is op als het opgegeten is (anders dan de spulletjes), zodat munten altijd iets waard blijven.
// Het buikje (0..1) loopt in een dag leeg; een lama met honger zegt dat, en is minder blij.
// De blijheid van de lama (hartjes) is de helft gestemde snaren en de helft een vol buikje.
//
// Iets nieuws toevoegen: één regel in FOODS. fill = hoeveel van het buikje het vult; treat = lekkers (vult
// weinig, maar de lama springt van plezier); party = feest (confetti).
import { happiness as tuneHappiness } from './tuning.js';

const EMPTY_H = 24; // in zoveel uur loopt een vol buikje leeg
export const HUNGRY = 0.35; // daaronder heeft de lama honger
export const FULL = 0.95; // daarboven zit ze vol

// De tabbladen in de winkel.
export const FOOD_CATS = [
  { id: 'lama', name: 'Lamavoer' },
  { id: 'fruit', name: 'Fruit' },
  { id: 'groente', name: 'Groenten' },
  { id: 'maal', name: 'Maaltijd' },
  { id: 'snoep', name: 'Lekkers' },
  { id: 'drank', name: 'Drinken' },
];

const F = (cat, id, emoji, name, price, fill, extra = {}) => ({ cat, slot: cat, id, emoji, name, price, fill, food: true, ...extra });
export const FOODS = [
  // lamavoer: goedkoop en gezond
  F('lama', 'hooi', '🌾', 'Hooi', 2, 0.2, { say: 'Mmm, knapperig hooi!' }),
  F('lama', 'gras', '🌿', 'Vers gras', 2, 0.2, { say: 'Vers gras, mijn lievelings!' }),
  F('lama', 'klaver', '🍀', 'Klavertje vier', 4, 0.25, { say: 'Een klavertje vier! Geluk!', treat: true }),
  F('lama', 'blaadjes', '🍃', 'Blaadjes', 2, 0.15),
  F('lama', 'zaadjes', '🌻', 'Zonnepitten', 3, 0.2),
  // fruit
  F('fruit', 'appel', '🍎', 'Appel', 3, 0.25),
  F('fruit', 'peer', '🍐', 'Peer', 3, 0.25),
  F('fruit', 'banaan', '🍌', 'Banaan', 3, 0.3),
  F('fruit', 'mandarijn', '🍊', 'Mandarijn', 3, 0.2),
  F('fruit', 'aardbei', '🍓', 'Aardbeien', 4, 0.25),
  F('fruit', 'druiven', '🍇', 'Druiven', 4, 0.25),
  F('fruit', 'kersen', '🍒', 'Kersen', 4, 0.2),
  F('fruit', 'bosbessen', '🫐', 'Bosbessen', 4, 0.2),
  F('fruit', 'kiwi', '🥝', 'Kiwi', 3, 0.2),
  F('fruit', 'perzik', '🍑', 'Perzik', 4, 0.25),
  F('fruit', 'mango', '🥭', 'Mango', 5, 0.3),
  F('fruit', 'ananas', '🍍', 'Ananas', 6, 0.4),
  F('fruit', 'meloen', '🍉', 'Watermeloen', 6, 0.45, { say: 'Sappig! Wat een grote meloen!' }),
  F('fruit', 'kokos', '🥥', 'Kokosnoot', 6, 0.35),
  // groenten
  F('groente', 'wortel', '🥕', 'Wortel', 2, 0.25, { say: 'Knabbel knabbel, een wortel!' }),
  F('groente', 'sla', '🥬', 'Sla', 2, 0.2),
  F('groente', 'komkommer', '🥒', 'Komkommer', 2, 0.2),
  F('groente', 'tomaat', '🍅', 'Tomaat', 2, 0.2),
  F('groente', 'broccoli', '🥦', 'Broccoli', 3, 0.3, { say: 'Een boompje! Gezond!' }),
  F('groente', 'mais', '🌽', 'Maïs', 3, 0.3),
  F('groente', 'erwtjes', '🫛', 'Erwtjes', 3, 0.25),
  F('groente', 'paprika', '🫑', 'Paprika', 3, 0.25),
  F('groente', 'aardappel', '🥔', 'Aardappel', 3, 0.3),
  F('groente', 'pompoen', '🎃', 'Pompoen', 7, 0.5, { say: 'Een hele pompoen! Ik ben bijna vol.' }),
  // maaltijden: duurder, vullen veel
  F('maal', 'brood', '🍞', 'Brood', 4, 0.35),
  F('maal', 'croissant', '🥐', 'Croissant', 4, 0.3),
  F('maal', 'kaas', '🧀', 'Kaas', 4, 0.3),
  F('maal', 'havermout', '🥣', 'Havermout', 5, 0.4),
  F('maal', 'pannenkoek', '🥞', 'Pannenkoeken', 7, 0.55, { say: 'Pannenkoeken! Hoera!' }),
  F('maal', 'wafel', '🧇', 'Wafel', 6, 0.45),
  F('maal', 'soep', '🍲', 'Groentesoep', 7, 0.55),
  F('maal', 'spaghetti', '🍝', 'Spaghetti', 8, 0.65, { say: 'Slurp! Spaghetti!' }),
  F('maal', 'pizza', '🍕', 'Pizza', 8, 0.65, { say: 'Pizza! Mijn buikje is blij.' }),
  F('maal', 'frietjes', '🍟', 'Frietjes', 6, 0.45),
  // lekkers: vult weinig, maar de lama springt van plezier
  F('snoep', 'snoepje', '🍬', 'Snoepje', 2, 0.05, { treat: true }),
  F('snoep', 'lolly', '🍭', 'Lolly', 3, 0.05, { treat: true }),
  F('snoep', 'koekje', '🍪', 'Koekje', 3, 0.1, { treat: true }),
  F('snoep', 'chocolade', '🍫', 'Chocolade', 4, 0.1, { treat: true }),
  F('snoep', 'popcorn', '🍿', 'Popcorn', 3, 0.1, { treat: true }),
  F('snoep', 'donut', '🍩', 'Donut', 4, 0.15, { treat: true }),
  F('snoep', 'cupcake', '🧁', 'Cupcake', 5, 0.15, { treat: true }),
  F('snoep', 'ijsje', '🍦', 'IJsje', 5, 0.1, { treat: true, say: 'Brrr, koud! Maar zo lekker!' }),
  F('snoep', 'taart', '🍰', 'Taartje', 7, 0.2, { treat: true }),
  F('snoep', 'feesttaart', '🎂', 'Feesttaart', 15, 0.4, { treat: true, party: true, say: 'Een feesttaart! Feest!' }),
  // drinken
  F('drank', 'water', '💧', 'Water', 1, 0.05, { say: 'Fris water, dankjewel!' }),
  F('drank', 'melk', '🥛', 'Melk', 2, 0.1),
  F('drank', 'sapje', '🧃', 'Sapje', 3, 0.1),
  F('drank', 'thee', '🍵', 'Kruidenthee', 3, 0.1, { say: 'Warme thee… zalig.' }),
  F('drank', 'milkshake', '🥤', 'Milkshake', 5, 0.2, { treat: true }),
];
export const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export const newFood = () => ({ pantry: {}, full: 0.6, at: Date.now() }); // pantry: id → hoeveel je er hebt

/** Hoe vol is het buikje nu (0..1)? */
export function fullness(food, now = Date.now()) {
  if (!food) return 0;
  return Math.max(0, Math.min(1, (food.full ?? 0) - (now - (food.at ?? now)) / (EMPTY_H * 3.6e6)));
}
export const isHungry = (food, now) => fullness(food, now) < HUNGRY;
export const isFull = (food, now) => fullness(food, now) >= FULL;

/** Blijheid van de lama (0..1): de helft gestemde snaren, de helft een vol buikje. */
export const mood = (S, now = Date.now()) => (tuneHappiness(S.tune, now) + Math.min(1, fullness(S.food, now) / 0.8)) / 2;

export const pantryCount = (food, id) => food?.pantry?.[id] || 0;
/** Wat er in de voorraadkast zit, in de volgorde van de winkel. */
export const pantryList = (food) => FOODS.filter((f) => pantryCount(food, f.id) > 0);

export function addFood(food, id, n = 1) { food.pantry[id] = pantryCount(food, id) + n; }

/** De lama eet iets op (uit de voorraad). Geeft false als het niet kan (niet in de kast, of ze zit vol). */
export function eat(food, id, now = Date.now()) {
  const f = FOOD[id];
  if (!f || pantryCount(food, id) <= 0 || (isFull(food, now) && !f.treat)) return false;
  food.full = Math.min(1, fullness(food, now) + f.fill);
  food.at = now;
  if (!--food.pantry[id]) delete food.pantry[id];
  return true;
}

/** Een eten-plaatje (emoji) tekenen, gecentreerd op (x, y), size = hoogte. */
export function drawFood(g, f, x, y, size) {
  g.save();
  g.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(f.emoji, x, y + size * 0.06);
  g.restore();
}
