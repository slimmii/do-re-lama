// Cadeaubonnen: een code van 8 cijfers die je één keer kan inwisselen voor munten of voor één gratis spulletje
// naar keuze in de winkel (een beloning van papa of mama).
// Hier staat enkel een controlegetal van elke code, zodat de codes zelf niet in het spel te lezen zijn.
// De lijst met de echte codes staat in vouchers.txt (niet in git).
const SALT = 'lama-bon';
function hash(s) { // FNV-1a, zoals in sync.js
  let h = 0x811c9dc5;
  for (const ch of SALT + s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const BONS = {
  '94131ff5': 50,
  '287274a8': 50,
  '62c06e30': 50,
  'ded9dadc': 50,
  '40e8b267': 50,
  'ee364946': 50,
  '32e30e6e': 50,
  'e353867a': 50,
  '9a9c7a78': 50,
  'd899abab': 50,
  '590fa5a2': 50,
  '88a2df9e': 50,
  '1e9bc6f1': 50,
  '2220d9bb': 50,
  '998bc713': 50,
  '410f4146': 50,
  '6dae7f57': 50,
  '1448a243': 50,
  'a338f7e6': 50,
  '87702ae6': 50,
  '711bbbd4': 50,
  '01240152': 50,
  '0b97d1f1': 50,
  'd206be90': 50,
  '55824bd9': 50,
  '64d8bd4e': 100,
  '806e47bc': 100,
  'b9a7cb4f': 100,
  'db021327': 100,
  'c16178c8': 100,
  '8e76bfef': 100,
  'eadf06de': 100,
  'f6964502': 100,
  'bf710e96': 100,
  '4dd12264': 100,
  '09996bb0': 100,
  'bcf0ec0a': 100,
  '728c052a': 100,
  'ab26bc31': 100,
  'b92d0d1f': 100,
  '85ee8e21': 100,
  '1a0bd371': 100,
  'd6eeed8c': 100,
  'bd5eb2f8': 100,
  '738d9d1c': 100,
  '5a75cf25': 100,
  'f3b68c8b': 100,
  '1628a1ea': 100,
  '5e2d28bb': 100,
  'db2894bb': 100,
  // 'item': één gratis spulletje naar keuze
  'd6f4d1ce': 'item',
  '391a8d65': 'item',
  '95f7fbfb': 'item',
  '306ed37b': 'item',
  'd2d2832d': 'item',
  '972a2442': 'item',
  'd68f6b9d': 'item',
  '86038874': 'item',
  '18dd651a': 'item',
  'f5a9c45d': 'item',
};

export const VOUCHER_LEN = 8;
export const isVoucher = (s) => /^\d{8}$/.test(s.replace(/[\s-]/g, ''));

// Een bon inwisselen in de portemonnee w (in place). Geeft { coins } of { item: true } terug.
export function redeemVoucher(w, code) {
  const h = hash(code.replace(/[\s-]/g, ''));
  const bon = BONS[h];
  if (!bon) throw new Error('Deze code ken ik niet. Kijk nog eens goed naar de cijfers.');
  w.vouchers ||= [];
  if (w.vouchers.includes(h)) throw new Error('Deze bon is al ingewisseld.');
  w.vouchers.push(h);
  if (bon === 'item') { w.gifts = (w.gifts || 0) + 1; return { item: true }; }
  w.coins += bon;
  return { coins: bon };
}
