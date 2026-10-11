// Het logo: de naam van het spel (DO RE LAMA) in dikke, dansende letters.
import { C, FONT, text } from '../draw.js';

// Elke letter wordt één keer getekend (rand, schaduw, verloop, glans) en daarna enkel nog gekopieerd.
const glyphs = new Map();
function glyph(ch, size, colors, px) {
  const key = `${ch}|${size}|${colors.join()}|${px}`;
  let c = glyphs.get(key);
  if (c) return c;
  const m = document.createElement('canvas').getContext('2d');
  m.font = FONT(size, 900);
  const w = m.measureText(ch).width, pad = size * 0.22;
  c = document.createElement('canvas');
  c.lw = w; c.pad = pad; c.lh = size * 1.5;
  c.width = Math.ceil((w + 2 * pad) * px);
  c.height = Math.ceil(c.lh * px);
  const g = c.getContext('2d');
  g.scale(px, px);
  g.translate(pad, c.lh / 2);
  g.font = FONT(size, 900);
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.26;
  g.strokeStyle = 'rgba(29,16,48,.5)';
  g.strokeText(ch, 0, size * 0.08);
  g.strokeStyle = C.ink;
  g.strokeText(ch, 0, 0);
  const gr = g.createLinearGradient(0, -size * 0.45, 0, size * 0.4);
  gr.addColorStop(0, colors[0]); gr.addColorStop(0.55, colors[1]); gr.addColorStop(1, colors[2]);
  g.fillStyle = gr;
  g.fillText(ch, 0, 0);
  g.save();
  g.beginPath(); g.rect(-w, -size * 0.5, w * 3, size * 0.32); g.clip();
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillText(ch, 0, 0);
  g.restore();
  if (document.fonts.check(FONT(20, 900))) glyphs.set(key, c); // pas bewaren als het lettertype er is
  return c;
}

function word(g, str, cx, y, size, t, phase, colors) {
  const px = Math.min(3, Math.ceil((g.getTransform().a || 1) * 2) / 2); // pixeldichtheid, in stapjes van 0.5
  const letters = [...str].map((ch) => glyph(ch, size, colors, px));
  const spacing = size * 0.02;
  const total = letters.reduce((a, c) => a + c.lw, 0) + spacing * (str.length - 1);
  let x = cx - total / 2;
  letters.forEach((c, i) => {
    const bob = Math.sin(t * 2.4 + i * 0.55 + phase) * size * 0.05;
    const rot = Math.sin(t * 1.7 + i * 0.9 + phase) * 0.035;
    g.save();
    g.translate(x + c.lw / 2, y + bob);
    g.rotate(rot);
    g.drawImage(c, -c.lw / 2 - c.pad, -c.lh / 2, c.width / px, c.height / px);
    g.restore();
    x += c.lw + spacing;
  });
  return total;
}

// De twee regels van het logo: groot bovenaan, kleiner eronder.
export const LOGO = { top: 'DO RE', bottom: 'LAMA' };

export function drawLogo(g, cx, cy, s, t, sub = true) {
  word(g, LOGO.top, cx, cy - 30 * s, 92 * s, t, 0, ['#fffbe6', '#ffe27a', '#f6b13a']);
  word(g, LOGO.bottom, cx + 6 * s, cy + 46 * s, 62 * s, t, 2, ['#ffe1ee', '#ff8fb8', '#e8558c']);
  // muzieknootjes rond het logo
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + i * 2.1;
    const nx = cx + (i === 1 ? 150 : -150 - i * 10) * s + Math.sin(a) * 6 * s;
    const ny = cy - 50 * s + i * 34 * s + Math.cos(a * 1.3) * 8 * s;
    text(g, i === 1 ? '♫' : '♪', nx, ny, { size: (30 + i * 4) * s, color: ['#fff6c8', '#9fd8ff', '#ffc2d8'][i], stroke: C.ink, strokeW: 6 * s });
  }
  if (sub) text(g, 'speel gitaar · laat de lama springen', cx, cy + 96 * s, { size: 18 * s, weight: 900, color: '#fff', stroke: C.ink, strokeW: 5 * s });
}
