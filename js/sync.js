// Overzetten naar een ander toestel: een code met je munten, spulletjes, kleren, de boomhut en de reis.
// LAMA-<base64 van de gegevens>-<controlegetal>. Dezelfde codes als in de Simisol-notentrainer, dus je
// kan je lama ook van daar naar hier halen (en terug).
// Bij het inlezen krijg je alle spulletjes erbij (je verliest er nooit), je munten worden het hoogste van de
// twee (niet opgeteld) en elke code werkt maar één keer per toestel.
import { ITEM } from './lama-style.js';
import { mergeJourney } from './lama-journey.js';
import { HOUSE_ITEM, HOUSE_SLOT } from './treehouse.js';

const SALT = 'simisol-lama';
function checksum(str) { // FNV-1a, 6 hexcijfers
  let h = 0x811c9dc5;
  for (const ch of SALT + str) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0').slice(-6);
}
const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

export function exportCode(w, j, h) {
  const data = JSON.stringify({ v: 1, id: Math.random().toString(36).slice(2, 10), c: w.coins, o: w.owned, w: w.outfit,
    j: j ? { s: j.stage, st: j.stars } : undefined, h: h ? { o: h.owned, p: h.placed } : undefined });
  const body = toB64(data);
  return `LAMA-${body}-${checksum(body)}`;
}

export function parseCode(code) {
  const m = code.replace(/\s+/g, '').match(/^LAMA-([A-Za-z0-9_-]+)-([0-9a-f]{6})$/i);
  if (!m) throw new Error('Dat is geen lama-code. Een code begint met LAMA-.');
  if (checksum(m[1]) !== m[2].toLowerCase()) throw new Error('De code klopt niet. Is ze volledig gekopieerd?');
  let d;
  try { d = JSON.parse(fromB64(m[1])); } catch { throw new Error('De code klopt niet. Is ze volledig gekopieerd?'); }
  const owned = (d.o || []).filter((id) => ITEM[id]);
  const outfit = Object.fromEntries(Object.entries(d.w || {}).filter(([s, id]) => ITEM[id]?.slot === s && (owned.includes(id) || ITEM[id].stars)));
  // de boomhut (Simisol kent die niet: dan is ze leeg)
  const hOwned = (d.h?.o || []).filter((id) => HOUSE_ITEM[id]);
  const ok = (s, id) => HOUSE_ITEM[id]?.slot === s && (hOwned.includes(id) || !HOUSE_ITEM[id].price);
  const placed = {};
  for (const [s, v] of Object.entries(d.h?.p || {})) {
    if (!HOUSE_SLOT[s]) continue;
    if (HOUSE_SLOT[s].multi) placed[s] = (Array.isArray(v) ? v : [v]).filter((id) => ok(s, id));
    else if (ok(s, v)) placed[s] = v;
  }
  return { id: String(d.id), coins: Math.max(0, Math.floor(+d.c || 0)), owned, outfit, journey: d.j, house: d.h ? { owned: hOwned, placed } : null };
}

// Een code inlezen in de portemonnee w (in place). Geeft terug wat er bij kwam.
export function importCode(w, code, j, h) {
  const d = parseCode(code);
  w.imported ||= [];
  if (w.imported.includes(d.id)) throw new Error('Deze code is op dit toestel al gebruikt. Maak een nieuwe op het andere toestel.');
  const added = d.owned.filter((id) => !w.owned.includes(id));
  const coins = Math.max(w.coins, d.coins);
  const gained = coins - w.coins;
  w.owned.push(...added);
  w.coins = coins;
  w.outfit = { ...d.outfit };
  w.imported.push(d.id);
  let houseAdded = 0;
  if (h && d.house) {
    const extra = d.house.owned.filter((id) => !h.owned.includes(id));
    h.owned.push(...extra);
    h.placed = { ...d.house.placed };
    houseAdded = extra.length;
  }
  const before = j?.stage ?? 0;
  if (j) mergeJourney(j, d.journey);
  return { added: added.length + houseAdded, gained, stages: (j?.stage ?? 0) - before };
}
