// Gedeelde stukjes interface voor de scènes.
import { ui } from '../ui.js';
import { C, text, title, panel, ribbon, pill, star, rr, ease, clamp, wrap, measure } from '../draw.js';
import { app } from '../app.js';
import { S } from '../store.js';
import { totalStars } from '../lama-journey.js';
import { isFullscreen, canFullscreen, toggleFullscreen } from '../engine.js';

// Munten- en sterrenteller rechtsboven.
export function walletPills(g, VW, y = 16, o = {}) {
  const coinW = 104, starW = 96;
  let x = VW - 16 - (o.right ?? 0);
  if (o.stars !== false) {
    x -= starW;
    pill(g, x, y, starW, 40);
    star(g, x + 22, y + 20, 12, true);
    text(g, totalStars(S.journey), x + 42, y + 21, { size: 22, color: '#fff', align: 'left', stroke: C.ink, strokeW: 5 });
    x -= 10;
  }
  x -= coinW;
  const bump = o.bump ?? 0;
  pill(g, x, y, coinW, 40);
  const s = 1 + bump * 0.35;
  g.drawImage(app.A.img.coin, x + 6 + (1 - s) * 15, y + 4 + (1 - s) * 16, 30 * s, 32 * s);
  text(g, S.wallet.coins, x + 44, y + 21, { size: 22, color: C.gold, align: 'left', stroke: C.ink, strokeW: 5 });
  return x;
}

// Bovenbalk: terugknop, titel op een lint, munten en sterren.
export function topBar(g, VW, str, onBack, o = {}) {
  if (onBack) ui.iconButton('top:back', 40, 36, 52, 'back', { onClick: onBack, sound: 'back' });
  ribbon(g, str, VW / 2, 12, { size: 26, color: o.color || C.orange, dark: o.dark || C.orangeD });
  if (o.wallet !== false) walletPills(g, VW);
}

export function fullscreenButton(id, x, y, size = 44) {
  if (!canFullscreen()) return;
  ui.iconButton(id, x, y, size, isFullscreen() ? 'unfull' : 'full', { onClick: toggleFullscreen });
}

// Kaart in het midden (spelregels, game over, ...): schaal-animatie bij het verschijnen.
export function card(g, VW, VH, w, h, t, draw, o = {}) {
  const k = ease.back(clamp(t / 0.32, 0, 1));
  const x = (VW - w) / 2, y = o.y ?? (VH - h) / 2;
  g.save();
  g.globalAlpha = clamp(t / 0.15, 0, 1);
  g.translate(VW / 2, y + h / 2);
  g.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  g.translate(-VW / 2, -(y + h / 2));
  panel(g, x, y, w, h, { r: 26 });
  draw(x, y, w, h);
  g.restore();
  return { x, y, w, h };
}

export function dimScreen(g, VW, VH, a = 0.5) {
  g.fillStyle = `rgba(29,16,48,${a})`;
  g.fillRect(0, 0, VW, VH);
}

// Notenchip: solfège + plek op de gitaar.
export function noteChip(g, x, y, w, h, name, sub, color = C.blue) {
  rr(g, x, y, w, h, 12);
  g.fillStyle = '#fff'; g.fill();
  g.lineWidth = 3; g.strokeStyle = color; g.stroke();
  text(g, name, x + w / 2, y + h * 0.4, { size: h * 0.38, color });
  if (sub) text(g, sub, x + w / 2, y + h * 0.76, { size: h * 0.2, weight: 800, color: C.muted, maxW: w - 10 });
}

// Beeld 'cover' in een cirkel.
export function circleImage(g, img, cx, cy, r, crop = 0.5) {
  if (!img) return;
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  const ih = img.height * 0.92, iw = ih; // vierkant stuk
  const sx = (img.width - iw) * crop;
  g.drawImage(img, sx, 0, iw, ih, cx - r, cy - r, 2 * r, 2 * r);
  g.restore();
}

export { title, text };

// Tekstballon met een staartje naar (tx, ty) (bv. het hoofd van de lama); blijft tussen x0 en x1.
export function speech(g, str, tx, ty, o = {}) {
  const { maxW = 300, size = 16, x0 = 8, x1 = 10000, alpha = 1 } = o;
  const lines = wrap(g, str, maxW - 28, size, 800);
  const lh = size * 1.3;
  const w = Math.min(maxW, Math.max(...lines.map((l) => measure(g, l, size, 800))) + 30), h = lines.length * lh + 18;
  const x = clamp(tx - w * 0.3, x0, x1 - w), y = ty - h - 16;
  const sx = clamp(tx, x + 22, x + w - 22);
  g.save();
  g.globalAlpha *= alpha;
  // één gesloten vorm (ballon + staartje), zodat de rand nergens kruist
  const r = 16, b = y + h;
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, b, r);
  g.arcTo(x + w, b, x, b, r);
  g.lineTo(sx + 10, b); g.lineTo(sx, b + 13); g.lineTo(sx - 12, b);
  g.arcTo(x, b, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = '#fff'; g.fill();
  g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = C.ink; g.stroke();
  lines.forEach((l, i) => text(g, l, x + 15, y + 9 + lh / 2 + i * lh, { size, weight: 800, color: C.text, align: 'left' }));
  g.restore();
}

// Rij hartjes die zich vullen (frac 0..1), bv. hoe blij de lama is.
export function heartsMeter(g, x, y, frac, o = {}) {
  const { n = 5, s = 22, gap = 4 } = o;
  const img = app.A.img.heart;
  for (let i = 0; i < n; i++) {
    const f = clamp(frac * n - i, 0, 1), hx = x + i * (s + gap);
    g.save(); g.globalAlpha *= 0.25;
    g.drawImage(img, hx, y, s, s * 1.08);
    g.restore();
    if (f > 0) {
      g.save();
      g.beginPath(); g.rect(hx, y, s * f, s * 1.1); g.clip();
      g.drawImage(img, hx, y, s, s * 1.08);
      g.restore();
    }
  }
  return n * (s + gap) - gap;
}
