// De lama-boomhut: een kamer waar de lama uitrust. In het begin staat er enkel een bedje; de rest koop je in
// de winkel (afdeling Boomhut). Per plek staat er één ding, net zoals de lama per plek één spulletje draagt;
// enkel huisdieren mag je er meer tegelijk hebben (die wandelen rond).
//
// Iets nieuws toevoegen:
// - een nieuw spulletje: zet een beeld (doorzichtige achtergrond) in img/lama/boomhut/<id>.webp en voeg één
//   regel toe aan HOUSE_ITEMS. Het beeld wordt vanzelf geladen en geschaald op zijn plek.
//   Een bed kan ook een versie met de slapende lama erin hebben: <id>_slaap.webp (zelfde bed, zelfde breedte).
// - een nieuwe soort (bv. lampen, planken, speelgoed): voeg een plek toe aan HOUSE_SLOTS (waar in de kamer en
//   hoe groot) en geef de spulletjes die slot. De winkel krijgt er vanzelf een tabblad bij.
// De beelden zijn gemaakt met OpenArt (Nano Banana 2) op een magenta achtergrond en daarna uitgeknipt.

const DIR = 'img/lama/boomhut/';

// De kamer zelf (een lege boomhut). De plekken hieronder zijn breuken van dit beeld.
export const ROOM = { img: 'kamer', w: 1600, h: 893, floor: 0.82 };

// Plekken. spot: x = midden, y = onderkant (center: true → y is het midden), en h = hoogte of w = breedte,
// allemaal als breuk van de kamer. z: tekenvolgorde (de lama staat op z = 3). anim: 'breathe' of 'sway'.
// base: het ding dat er altijd staat (gratis) als je niets anders kiest; zonder base kan de plek leeg blijven.
// sleepHead: waar het hoofd van de slapende lama ligt (breuk van het slaapbeeld), voor de zzz.
// top: waar het bovenblad is (breuk van de hoogte van het beeld), voor dingen die erop staan (on: 'tafel').
// multi: er mogen meer dingen tegelijk staan (placed[slot] is dan een lijst); max: hoeveel hoogstens.
// spots: elk ding krijgt zijn eigen plek (het eerste de eerste, ...). hang: y is de bovenkant (iets dat ophangt).
// fixture: iets dat altijd op elke plek hangt, ook als die leeg is (de haakjes voor de gitaren).
// labels: wat er op de knop in de winkel staat ({on: als het er staat, add: om het erbij te zetten}).
export const HOUSE_SLOTS = [
  { id: 'bed', name: 'Bed', base: 'bed_gewoon', spot: { x: 0.27, y: 0.94, w: 0.34 }, z: 2, sleepHead: [0.34, 0.1] },
  { id: 'poster', name: 'Posters', spot: { x: 0.25, y: 0.38, h: 0.25, center: true }, z: 0 },
  { id: 'spiegel', name: 'Spiegel', spot: { x: 0.76, y: 0.38, h: 0.25, center: true }, z: 0 },
  { id: 'bloemen', name: 'Bloemen', spot: { x: 0.5, y: 0.53, h: 0.16 }, z: 0, anim: 'sway' },
  { id: 'mat', name: 'Matjes', spot: { x: 0.52, y: 0.915, w: 0.3, center: true }, z: 1 },
  { id: 'tafel', name: 'Tafel', base: 'tafel_gewoon', spot: { x: 0.655, y: 0.93, h: 0.19 }, z: 2, top: 0.2 },
  { id: 'stoel', name: 'Stoelen', spot: { x: 0.8, y: 0.94, h: 0.25 }, z: 2 },
  { id: 'gitaar', name: 'Gitaren', multi: true, max: 2, z: 0, anim: 'swing', labels: { on: 'Hangt er', add: 'Ophangen' },
    spots: [{ x: 0.335, y: 0.205, h: 0.3, hang: true }, { x: 0.665, y: 0.205, h: 0.3, hang: true }], fixture: { img: 'haakje', h: 0.085, dy: 0.028 } }, // het haakje hangt achter de kop; de hals zit in de vork
  { id: 'dier', name: 'Dieren', multi: true, labels: { on: 'Woont er', add: 'Erbij' }, spot: { x: 0.64, y: 0.965, h: 0.12 }, z: 4, anim: 'breathe' },
];
export const HOUSE_SLOT = Object.fromEntries(HOUSE_SLOTS.map((s) => [s.id, s]));

// Spulletjes. at: wijkt af van de plek (zelfde velden als spot). stars: krijg je met sterren in plaats van munten.
// sleep: beeld van dit ding met de slapende lama erin (enkel voor bedden).
// on: staat bovenop het ding van die plek (bv. de visbokaal op de tafel) in plaats van op zijn eigen plek.
// walk: huisdieren die rondwandelen: speed (breuk van de kamer per seconde) en hop (huppelen in plaats van stappen).
const I = (slot, id, name, price, extra = {}) => ({ slot, id, name, price, house: true, ...extra });
const BED = (id, name, price) => I('bed', id, name, price, { sleep: id + '_slaap' });
export const HOUSE_ITEMS = [
  // bedovertrekjes (het bed zelf blijft hetzelfde)
  BED('bed_gewoon', 'Gewoon', 0),
  BED('bed_sterren', 'Sterrennacht', 20),
  BED('bed_hartjes', 'Hartjes', 20),
  BED('bed_ruitjes', 'Ruitjes', 20),
  BED('bed_lama', 'Lamaatjes', 30),
  BED('bed_regenboog', 'Regenboog', 30),
  // gitaren (aan de haakjes aan de muur)
  I('gitaar', 'gitaar_klassiek', 'Klassiek', 20),
  I('gitaar', 'gitaar_ukelele', 'Ukelele', 20, { at: { h: 0.22 } }),
  I('gitaar', 'gitaar_roze', 'Hartjesgitaar', 30),
  I('gitaar', 'gitaar_rood', 'Rode elektrische', 40),
  I('gitaar', 'gitaar_ster', 'Sterrengitaar', 40),
  I('gitaar', 'gitaar_regenboog', 'Regenbooggitaar', 50),
  // tafels
  I('tafel', 'tafel_gewoon', 'Tafeltje', 0),
  // posters
  I('poster', 'poster_lama', 'Lama', 10),
  I('poster', 'poster_gitaar', 'Gitaar', 10),
  I('poster', 'poster_regenboog', 'Regenboog', 10),
  I('poster', 'poster_bergen', 'Bergen', 20),
  // spiegels
  I('spiegel', 'spiegel_rond', 'Ronde spiegel', 20),
  I('spiegel', 'spiegel_hart', 'Hartjesspiegel', 30),
  I('spiegel', 'spiegel_goud', 'Gouden spiegel', 40, { at: { h: 0.3 } }),
  // bloemen (op de vensterbank)
  I('bloemen', 'bloem_cactus', 'Cactus', 10, { at: { h: 0.12 } }),
  I('bloemen', 'bloem_tulpen', 'Tulpen', 10),
  I('bloemen', 'bloem_lavendel', 'Lavendel', 20),
  I('bloemen', 'bloem_zonnebloem', 'Zonnebloem', 20, { at: { h: 0.2 } }),
  // matjes
  I('mat', 'mat_stippen', 'Stippenmat', 10),
  I('mat', 'mat_blad', 'Blaadje', 20),
  I('mat', 'mat_tapijt', 'Tapijt', 20, { at: { w: 0.28 } }),
  I('mat', 'mat_regenboog', 'Regenboogmat', 30),
  // stoelen
  I('stoel', 'stoel_krukje', 'Krukje', 10, { at: { h: 0.19 } }),
  I('stoel', 'stoel_zitzak', 'Zitzak', 20, { at: { h: 0.2 } }),
  I('stoel', 'stoel_schommel', 'Schommelstoel', 30),
  I('stoel', 'stoel_zetel', 'Zetel', 30),
  // huisdiertjes
  I('dier', 'dier_hamster', 'Hamster', 30, { at: { h: 0.09 }, walk: { speed: 0.05 } }),
  I('dier', 'dier_goudvis', 'Goudvis', 30, { at: { h: 0.11 }, anim: null, on: 'tafel' }),
  I('dier', 'dier_schildpad', 'Schildpad', 30, { at: { h: 0.075 }, walk: { speed: 0.018 } }),
  I('dier', 'dier_kat', 'Poes', 40, { walk: { speed: 0.08 } }),
  I('dier', 'dier_hond', 'Hondje', 40, { walk: { speed: 0.1 } }),
  I('dier', 'dier_konijn', 'Konijn', 40, { walk: { speed: 0.07, hop: true } }),
];
export const HOUSE_ITEM = Object.fromEntries(HOUSE_ITEMS.map((i) => [i.id, i]));

// ---------- laden ----------
export const HOUSE_IMG = {};
let loading = null;
export function loadHouse() {
  if (loading) return loading;
  const names = [ROOM.img, ...HOUSE_SLOTS.filter((s) => s.fixture).map((s) => s.fixture.img), ...HOUSE_ITEMS.flatMap((i) => [i.img || i.id, ...(i.sleep ? [i.sleep] : [])])];
  loading = Promise.all(names.map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { HOUSE_IMG[n] = im; res(); };
    im.onerror = () => res(); // een ontbrekend beeld mag de rest niet tegenhouden
    im.src = DIR + n + '.webp';
  })));
  return loading;
}
export const itemImage = (it) => HOUSE_IMG[it.img || it.id];
// Kan de lama in dit bed slapen? (is er een beeld met de slapende lama erin)
export const sleepImage = (it) => (it?.sleep ? HOUSE_IMG[it.sleep] : null);

// Wat er staat: de keuzes, aangevuld met de base van elke plek. {slot: id}, of {slot: [id, ...]} bij multi.
export function furnished(placed = {}) {
  const out = {};
  for (const s of HOUSE_SLOTS) {
    if (s.multi) { out[s.id] = placedIds(placed, s.id); continue; }
    const id = placed[s.id] ?? s.base;
    if (id && HOUSE_ITEM[id]?.slot === s.id) out[s.id] = id;
  }
  return out;
}
// De id's op een plek, altijd als lijst (handig voor plekken met meer dingen).
export function placedIds(placed = {}, slot) {
  const v = placed[slot];
  const ids = Array.isArray(v) ? v : v ? [v] : HOUSE_SLOT[slot].base ? [HOUSE_SLOT[slot].base] : [];
  const ok = [...new Set(ids)].filter((id) => HOUSE_ITEM[id]?.slot === slot);
  return HOUSE_SLOT[slot].max ? ok.slice(0, HOUSE_SLOT[slot].max) : ok;
}
// Alles wat in de kamer staat, als lijst van spulletjes (in tekenvolgorde).
export function roomItems(placed) {
  const items = HOUSE_SLOTS.flatMap((s) => placedIds(placed, s.id).map((id) => HOUSE_ITEM[id]));
  return items.sort((a, b) => HOUSE_SLOT[a.slot].z - HOUSE_SLOT[b.slot].z);
}

// Rechthoek van een spulletje in de kamer (in breuken), volgens zijn plek en zijn eigen beeld.
// Staat het op iets anders (on), dan komt het midden op het bovenblad daarvan (placed: wat er staat).
// i: het hoeveelste ding op een plek met spots.
export function itemRect(it, img = itemImage(it), placed = {}, i = 0) {
  const slot = HOUSE_SLOT[it.slot];
  const sp = { ...(slot.spots ? slot.spots[i % slot.spots.length] : slot.spot), ...(it.at && (it.at.w || it.at.h) ? { w: undefined, h: undefined } : {}), ...it.at };
  if (it.on) {
    const host = HOUSE_ITEM[placedIds(placed, it.on)[0]];
    if (host) {
      const hr = itemRect(host);
      sp.x = hr.x + hr.w / 2; sp.y = hr.y + hr.h * (HOUSE_SLOT[it.on].top ?? 0); sp.center = false;
    }
  }
  const ar = img ? img.width / img.height : 1, R = ROOM.w / ROOM.h;
  let w, h;
  if (sp.w) { w = sp.w; h = (w * R) / ar; } else { h = sp.h; w = (h * ar) / R; }
  const y = sp.hang ? sp.y : sp.center ? sp.y - h / 2 : sp.y - h;
  return { x: sp.x - w / 2, y, w, h };
}

// De vaste dingen op elke plek (haakjes), met hun rechthoek in breuken.
function fixtures(slot) {
  const img = HOUSE_IMG[slot.fixture.img];
  if (!img) return [];
  const h = slot.fixture.h, w = (h * img.width) / img.height / (ROOM.w / ROOM.h);
  return slot.spots.map((sp) => ({ img, x: sp.x - w / 2, y: sp.y + (slot.fixture.dy ?? 0), w, h }));
}

// Waar huisdieren staan als niemand ze laat wandelen (in de winkel): naast elkaar op de vloer.
const PET_X = [0.6, 0.48, 0.72, 0.38, 0.84, 0.54, 0.27];
export const restingPose = (i) => ({ x: PET_X[i % PET_X.length], dir: i % 2 ? -1 : 1, lift: 0, moving: false });

/**
 * Teken de kamer met spulletjes in de rechthoek (x, y, w, h) (die heeft de verhouding van ROOM).
 * placed: {slot: id}. o.lama(z): tekent de lama tussen de lagen (wordt opgeroepen met z = 3).
 * o.night: 0..1 (licht uit). o.highlight: slot dat even oplicht (passen in de winkel).
 * o.asleep: de lama ligt in bed (het bed wordt dan getekend met de lama erin); o.onHead(x, y, s) krijgt
 * dan de plek van haar hoofd en de schaal van het bed.
 * o.pose(it, i): waar huisdier i rondloopt ({x, dir, lift, moving}); o.onItem(it, x, y, w, h): na het tekenen
 * van elk ding, met zijn rechthoek in pixels (om erop te kunnen klikken).
 */
export function drawRoom(g, x, y, w, h, placed, t, o = {}) {
  const bg = HOUSE_IMG[ROOM.img];
  if (bg) g.drawImage(bg, x, y, w, h);
  else { g.fillStyle = '#c98d55'; g.fillRect(x, y, w, h); }
  const items = roomItems(placed);
  let lamaDone = !o.lama, petI = 0;
  const idx = {}; // het hoeveelste ding per plek
  // haakjes e.d. komen achter de dingen van hun eigen plek (de kop van de gitaar hangt ervoor)
  const fix = HOUSE_SLOTS.filter((s) => s.fixture);
  const flush = (z) => {
    while (fix.length && fix[0].z <= z) for (const f of fixtures(fix.shift())) g.drawImage(f.img, x + f.x * w, y + f.y * h, f.w * w, f.h * h);
  };
  for (const it of items) {
    const slot = HOUSE_SLOT[it.slot];
    flush(slot.z);
    if (!lamaDone && slot.z > 3) { o.lama(); lamaDone = true; }
    const asleep = o.asleep && sleepImage(it);
    const img = asleep || itemImage(it);
    if (!img) continue;
    const i = (idx[it.slot] = (idx[it.slot] ?? -1) + 1);
    const r = itemRect(it, img, placed, i); // zelfde breedte en onderkant als het bed: de slaapversie past er precies over
    let pose = null;
    if (it.walk) { // rondwandelend huisdier
      pose = o.pose?.(it, petI) ?? restingPose(petI);
      petI++;
      r.x = pose.x - r.w / 2; r.y -= pose.lift;
    }
    const rx = x + r.x * w, ry = y + r.y * h, rw = r.w * w, rh = r.h * h;
    let anim = 'anim' in it ? it.anim : slot.anim;
    if (pose?.moving) anim = null;
    if (asleep) {
      anim = 'sleep';
      if (slot.sleepHead) o.onHead?.(rx + slot.sleepHead[0] * rw, ry + slot.sleepHead[1] * rh, rw / img.width);
    }
    g.save();
    if (anim === 'breathe') { // ademen: een beetje op en neer van onderuit
      const k = 1 + 0.035 * Math.sin(t * 2.6 + rx);
      g.translate(rx + rw / 2, ry + rh); g.scale(1 + (1 - k) * 0.5, k); g.translate(-(rx + rw / 2), -(ry + rh));
    } else if (anim === 'sleep') { // rustig ademen onder het dekentje
      const k = 1 + 0.012 * Math.sin(t * 1.8);
      g.translate(rx, ry + rh); g.scale(1, k); g.translate(-rx, -(ry + rh));
    } else if (anim === 'swing') { // zachtjes schommelen aan het haakje (harder als je erop klikt: o.swing)
      const a = (0.012 + (o.swing?.(it) ?? 0)) * Math.sin(t * 1.3 + i * 2);
      g.translate(rx + rw / 2, ry); g.rotate(a); g.translate(-(rx + rw / 2), -ry);
    } else if (anim === 'sway') { // wiegen in de wind van het raam
      g.translate(rx + rw / 2, ry + rh); g.rotate(0.03 * Math.sin(t * 1.4)); g.translate(-(rx + rw / 2), -(ry + rh));
    }
    if (pose && pose.dir < 0) { g.translate(rx + rw / 2, 0); g.scale(-1, 1); g.translate(-(rx + rw / 2), 0); } // de beelden kijken naar rechts
    if (o.highlight === it.slot) { g.shadowColor = 'rgba(255,255,255,.95)'; g.shadowBlur = 14; }
    g.drawImage(img, rx, ry, rw, rh);
    g.restore();
    o.onItem?.(it, rx, ry, rw, rh);
  }
  flush(Infinity);
  if (!lamaDone) o.lama();
  if (o.night > 0) {
    g.save();
    g.globalAlpha = o.night;
    g.fillStyle = 'rgba(18,12,52,.7)'; g.fillRect(x, y, w, h);
    // het lantaarntje blijft zacht gloeien
    const lx = x + w * 0.5, ly = y + h * 0.075, gr = g.createRadialGradient(lx, ly, 0, lx, ly, h * 0.22);
    gr.addColorStop(0, 'rgba(255,214,120,.55)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = gr; g.fillRect(lx - h * 0.22, ly - h * 0.22, h * 0.44, h * 0.44);
    g.restore();
  }
}

// Ruimte rond de kamer (boven, onder of opzij als het scherm een andere vorm heeft): bladeren van de boom.
export function drawFoliage(g, VW, VH, t) {
  const gr = g.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, '#3f8f4e'); gr.addColorStop(1, '#2a5e3a');
  g.fillStyle = gr; g.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 40; i++) {
    const px = ((i * 137.5) % 100) / 100 * VW, py = ((i * 61.8) % 100) / 100 * VH;
    const r = 26 + (i % 5) * 9;
    g.fillStyle = i % 3 ? 'rgba(120,200,110,.18)' : 'rgba(20,60,30,.22)';
    g.beginPath(); g.ellipse(px + Math.sin(t * 0.6 + i) * 3, py, r, r * 0.7, i, 0, Math.PI * 2); g.fill();
  }
}

// Rechthoek waarin de kamer past (zo groot mogelijk, met de verhouding van ROOM).
export function fitRoom(x, y, w, h) {
  const s = Math.min(w / ROOM.w, h / ROOM.h);
  const rw = ROOM.w * s, rh = ROOM.h * s;
  return { x: x + (w - rw) / 2, y: y + (h - rh) / 2, w: rw, h: rh };
}
