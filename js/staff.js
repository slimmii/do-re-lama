// De notenbalk op het canvas (vroeger VexFlow-SVG). Maten in canvaspixels; een notenbalkruimte = 16 px.
import { parseNote } from './notes.js';

// Omtrek van de G-sleutel (Bravura, uit VexFlow), in font-eenheden; oorsprong op de sol-lijn.
const CLEF = new Path2D('M541 -598C539 -615 541 -616 550 -625C706 -770 824 -953 824 -1174C824 -1299 789 -1423 730 -1509C708 -1541 671 -1581 655 -1581C635 -1581 590 -1544 562 -1512C455 -1394 420 -1214 420 -1064C420 -981 431 -887 441 -828C444 -811 445 -808 428 -793C220 -622 0 -416 0 -125C0 125 171 363 524 363C557 363 595 360 624 354C639 351 642 350 645 367C662 464 684 589 684 657C684 870 540 896 455 896C377 896 340 873 340 854C340 844 353 840 386 829C431 816 482 778 482 694C482 615 432 547 344 547C248 547 190 624 190 713C190 806 246 948 464 948C560 948 747 904 747 660C747 577 721 441 706 351C703 334 704 336 724 327C870 269 966 147 966 -16C966 -200 831 -363 619 -363C582 -363 582 -363 577 -389ZM677 -1358C724 -1358 763 -1319 763 -1240C763 -1080 626 -950 513 -851C503 -842 497 -844 494 -863C488 -900 485 -949 485 -995C485 -1220 589 -1358 677 -1358ZM520 -377C524 -350 524 -351 498 -343C372 -300 289 -186 289 -63C289 66 357 158 455 192C467 196 484 200 494 200C505 200 511 193 511 184C511 174 500 170 490 166C429 140 386 78 386 12C386 -71 442 -132 530 -157C553 -163 556 -161 559 -145L631 284C634 300 632 300 611 304C588 308 559 311 530 311C278 311 115 171 115 -29C115 -114 130 -228 249 -363C336 -459 402 -513 469 -567C484 -579 487 -577 490 -562ZM619 -148C616 -166 618 -170 635 -168C752 -158 848 -60 848 66C848 157 793 230 713 271C696 279 693 279 690 262Z');

const LETTER_STEP = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
export const diatonic = (p) => { const n = parseNote(p); return n.octave * 7 + LETTER_STEP[n.letter]; };
export const E4 = 4 * 7 + 2; // onderste lijn
export const B4 = 4 * 7 + 6; // middelste lijn

export const SP = 16; // afstand tussen twee lijnen

export function drawClef(g, x, yG, color = '#3a2350') {
  const k = SP * 0.00281; // VexFlow: 39pt bij 10 eenheden per ruimte
  g.save();
  g.translate(x, yG);
  g.scale(k, k);
  g.fillStyle = color;
  g.fill(CLEF);
  g.restore();
}

// Kleine notenbalk met één noot (voor de notenkaartjes). x, y = linksboven, w = breedte; sp = lijnafstand.
export function miniNote(g, p, x, y, w, sp = 7, o = {}) {
  const { line = 'rgba(58,35,80,.45)', ink = '#3a2350', clef = true } = o;
  const ly = (i) => y + sp * i;
  g.save();
  g.strokeStyle = line;
  g.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x, ly(i)); g.lineTo(x + w, ly(i)); g.stroke(); }
  if (clef) {
    const k = sp * 0.00281;
    g.save(); g.translate(x + 3, ly(3)); g.scale(k, k); g.fillStyle = line; g.fill(CLEF); g.restore();
  }
  const d = diatonic(p), base = ly(4), half = sp / 2;
  const nx = x + w * (clef ? 0.62 : 0.5), ny = base - (d - E4) * half;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 1.4;
  const ledger = (s) => { const yy = base - (s - E4) * half; g.beginPath(); g.moveTo(nx - sp * 0.95, yy); g.lineTo(nx + sp * 0.95, yy); g.stroke(); };
  for (let s = E4 - 2; s >= d; s -= 2) ledger(s);
  for (let s = E4 + 10; s <= d; s += 2) ledger(s);
  g.beginPath(); g.ellipse(nx, ny, sp * 0.62, sp * 0.44, -0.35, 0, Math.PI * 2); g.fill();
  g.beginPath();
  if (d < B4) { g.moveTo(nx + sp * 0.56, ny - 1); g.lineTo(nx + sp * 0.56, ny - sp * 3.4); } else { g.moveTo(nx - sp * 0.56, ny + 1); g.lineTo(nx - sp * 0.56, ny + sp * 3.4); }
  g.stroke();
  g.restore();
}
