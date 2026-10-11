// Tekenhulpjes voor de hele interface: kleuren, tekst met omlijning, panelen en vector-iconen.
// Alles wordt op het canvas getekend; er is geen HTML-interface.

export const C = {
  ink: '#3a2350', // omlijning van alles (zoals de tekst in het spel)
  inkSoft: 'rgba(58, 35, 80, .55)',
  night: '#1d1630',
  paper: '#fff8ec',
  paper2: '#f4e6d2',
  paperLine: '#e3cfb6',
  text: '#3a2350',
  muted: '#8a7590',
  orange: '#f39a3d', orangeD: '#c2621a',
  blue: '#4f97ef', blueD: '#2a5fc0', cur: '#2f6fdc',
  green: '#5cc96f', greenD: '#2f9e57', good: '#2f9e57',
  pink: '#ff6f9c', pinkD: '#c8366a', bad: '#dc3b3b',
  gold: '#ffd84a', goldD: '#c98a00', goldInk: '#c98a00',
  purple: '#9a72e8', purpleD: '#5f3fb0',
  grey: '#cdbfd8', greyD: '#8a7a9a',
  cream: '#fff6c8',
  white: '#ffffff',
};

export const FONT = (size, weight = 900) => `${weight} ${size}px Nunito, system-ui, -apple-system, sans-serif`;

// Tekst met (optioneel) een dikke omlijning, zoals in een spel.
export function text(g, str, x, y, o = {}) {
  const { size = 20, weight = 900, color = C.text, align = 'center', baseline = 'middle', stroke = null, strokeW = null, maxW = null, alpha = 1 } = o;
  str = String(str);
  g.save();
  g.globalAlpha *= alpha;
  g.font = FONT(size, weight);
  g.textAlign = align;
  g.textBaseline = baseline;
  if (maxW) {
    const w = g.measureText(str).width;
    if (w > maxW) { const k = maxW / w; g.font = FONT(size * k, weight); }
  }
  if (stroke) {
    g.lineJoin = 'round';
    g.miterLimit = 2;
    g.lineWidth = strokeW ?? Math.max(3, size / 4.5);
    g.strokeStyle = stroke;
    g.strokeText(str, x, y);
  }
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.restore();
}

// Grote titeltekst zoals in het spel: witte/gekleurde letters met een dikke paarse rand.
export const title = (g, str, x, y, size, color = C.cream, extra = {}) =>
  text(g, str, x, y, { size, color, stroke: C.ink, strokeW: Math.max(4, size / 5), ...extra });

export function measure(g, str, size, weight = 900) {
  g.save();
  g.font = FONT(size, weight);
  const w = g.measureText(String(str)).width;
  g.restore();
  return w;
}

// Tekst over meerdere regels binnen maxW. Geeft de regels terug.
export function wrap(g, str, maxW, size, weight = 800) {
  g.save();
  g.font = FONT(size, weight);
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const t = line ? line + ' ' + word : word;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  g.restore();
  return out;
}

export function paragraph(g, str, x, y, maxW, o = {}) {
  const { size = 16, weight = 800, lh = size * 1.32, align = 'left' } = o;
  const lines = wrap(g, str, maxW, size, weight);
  lines.forEach((l, i) => text(g, l, align === 'center' ? x + maxW / 2 : x, y + i * lh, { ...o, size, weight, align, baseline: 'top' }));
  return lines.length * lh;
}

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

// Paneel: crèmekleurig met dikke rand en een stevige schaduw.
export function panel(g, x, y, w, h, o = {}) {
  const { r = 22, fill = C.paper, border = C.ink, bw = 4, shadow = 8, alpha = 1 } = o;
  g.save();
  g.globalAlpha *= alpha;
  if (shadow) { rr(g, x, y + shadow, w, h, r); g.fillStyle = 'rgba(29, 16, 48, .35)'; g.fill(); }
  rr(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  if (bw) { g.lineWidth = bw; g.strokeStyle = border; g.stroke(); }
  g.restore();
}

// Lint met een titel bovenaan een paneel.
export function ribbon(g, str, cx, y, o = {}) {
  const { size = 28, color = C.orange, dark = C.orangeD, minW = 220 } = o;
  const w = Math.max(minW, measure(g, str, size) + 70), h = size * 1.7;
  const x = cx - w / 2;
  g.save();
  // staartjes
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x + 6 : x + w - 6;
    g.beginPath();
    g.moveTo(ex, y + 10); g.lineTo(ex + s * 34, y + 14); g.lineTo(ex + s * 22, y + h / 2 + 12); g.lineTo(ex + s * 34, y + h + 10); g.lineTo(ex, y + h + 4);
    g.closePath();
    g.fillStyle = dark; g.fill(); g.lineWidth = 3.5; g.strokeStyle = C.ink; g.lineJoin = 'round'; g.stroke();
  }
  rr(g, x, y, w, h, 14);
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, lighten(color, 0.18)); gr.addColorStop(1, color);
  g.fillStyle = gr; g.fill();
  g.lineWidth = 4; g.strokeStyle = C.ink; g.stroke();
  g.restore();
  title(g, str, cx, y + h / 2 + 1, size, '#fff');
  return h;
}

// Pilletje (bv. munten, sterren) met icoon links.
export function pill(g, x, y, w, h, o = {}) {
  const { fill = 'rgba(29, 16, 48, .55)', border = 'rgba(255,255,255,.18)' } = o;
  rr(g, x, y, w, h, h / 2);
  g.fillStyle = fill; g.fill();
  g.lineWidth = 2; g.strokeStyle = border; g.stroke();
}

export function bar(g, x, y, w, h, frac, o = {}) {
  const { color = C.orange, back = 'rgba(58,35,80,.15)', border = C.ink, bw = 2.5 } = o;
  rr(g, x, y, w, h, h / 2);
  g.fillStyle = back; g.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    rr(g, x, y, Math.max(h, w * f), h, h / 2);
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, lighten(color, 0.25)); gr.addColorStop(1, color);
    g.fillStyle = gr; g.fill();
  }
  if (bw) { rr(g, x, y, w, h, h / 2); g.lineWidth = bw; g.strokeStyle = border; g.stroke(); }
}

// ---------- kleuren ----------
function hex(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const x = hex(a), y = hex(b);
  if (!x || !y) return a;
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#000000', t);

// ---------- vormen ----------
export function starPath(g, x, y, r, n = 5, inner = 0.48, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, rad = i % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
}

export function star(g, x, y, r, on = true, o = {}) {
  starPath(g, x, y, r, 5, 0.5);
  g.fillStyle = on ? (o.color || C.gold) : (o.off || 'rgba(58,35,80,.18)');
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = o.bw ?? Math.max(1.5, r / 4.5);
  g.strokeStyle = on ? C.ink : (o.offBorder || 'rgba(58,35,80,.35)');
  g.stroke();
}

// Rij sterren (bv. ★★☆).
export function stars(g, cx, cy, k, r = 8, gap = 3) {
  const w = 3 * r * 2 + 2 * gap;
  for (let i = 0; i < 3; i++) star(g, cx - w / 2 + r + i * (2 * r + gap), cy, r, i < k);
}

// ---------- iconen ----------
// Elk icoon past in een vierkant van s x s rond (cx, cy). Lijnen in 'color'.
export function icon(g, name, cx, cy, s, color = '#fff', o = {}) {
  const k = s / 24; // ontworpen op een raster van 24
  g.save();
  g.translate(cx, cy);
  g.scale(k, k);
  g.translate(-12, -12);
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = o.lw ?? 2.6;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const P = (d) => { const p = new Path2D(d); return p; };
  const S = (d) => g.stroke(P(d));
  const F = (d) => g.fill(P(d));
  switch (name) {
    case 'play': F('M8 5.5 L19 12 L8 18.5 Z'); g.lineWidth = 2; S('M8 5.5 L19 12 L8 18.5 Z'); break;
    case 'pause': F('M7 5h3.5v14H7z M13.5 5H17v14h-3.5z'); break;
    case 'back': S('M15 5 L8 12 L15 19'); break;
    case 'next': S('M9 5 L16 12 L9 19'); break;
    case 'close': S('M6 6 L18 18 M18 6 L6 18'); break;
    case 'check': S('M5 12.5 L10 17 L19 7'); break;
    case 'plus': S('M12 5v14 M5 12h14'); break;
    case 'minus': S('M5 12h14'); break;
    case 'home': S('M4 11 L12 4 L20 11 M6.5 9.5 V19.5 H17.5 V9.5 M10 19.5 V14 H14 V19.5'); break;
    case 'gear': {
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? 7.2 : 9.6;
        const a2 = a + Math.PI / 16;
        g.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
        g.lineTo(12 + Math.cos(a2) * r, 12 + Math.sin(a2) * r);
      }
      g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath(); g.arc(12, 12, 3.4, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'bag': S('M5 8.5 H19 L18 20 H6 Z M9 8.5 V7 a3 3 0 0 1 6 0 V8.5'); g.globalAlpha = 0.35; F('M5 8.5 H19 L18 20 H6 Z'); break;
    case 'map': S('M3.5 6.5 L9 4.5 L15 6.5 L20.5 4.5 V17.5 L15 19.5 L9 17.5 L3.5 19.5 Z M9 4.5 V17.5 M15 6.5 V19.5'); break;
    case 'target': g.beginPath(); g.arc(12, 12, 8, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(12, 12, 4, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(12, 12, 1.4, 0, Math.PI * 2); g.fill(); break;
    case 'bolt': F('M13.5 2.5 L5.5 13.5 H11 L9.5 21.5 L18.5 9.5 H12.8 Z'); break;
    case 'note': F('M9 17.5 a3 2.4 -20 1 1 -0.2 -0.6 Z'); S('M8.8 17 V5 L18 3 V14.5'); F('M18 14.5 a3 2.4 -20 1 1 -0.2 -0.6 Z'); g.beginPath(); g.ellipse(6.4, 17.3, 3, 2.3, -0.35, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(15.6, 14.8, 3, 2.3, -0.35, 0, Math.PI * 2); g.fill(); break;
    case 'mic': S('M12 3.5 a3 3 0 0 1 3 3 V12 a3 3 0 0 1 -6 0 V6.5 a3 3 0 0 1 3 -3 Z M6 11.5 a6 6 0 0 0 12 0 M12 17.5 V20.5 M9 20.5 H15'); break;
    case 'keyboard': S('M3 7 H21 V17 H3 Z'); g.lineWidth = 2; S('M6 10h.01 M9 10h.01 M12 10h.01 M15 10h.01 M18 10h.01 M8 14 H16'); break;
    case 'full': S('M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15'); break;
    case 'unfull': S('M9 4 V9 H4 M20 9 H15 V4 M15 20 V15 H20 M4 15 H9 V20'); break;
    case 'sound': F('M4 9 H8 L13 5 V19 L8 15 H4 Z'); S('M16 9 a4 4 0 0 1 0 6 M18.5 6.5 a7.5 7.5 0 0 1 0 11'); break;
    case 'mute': F('M4 9 H8 L13 5 V19 L8 15 H4 Z'); S('M16.5 9.5 L21 14 M21 9.5 L16.5 14'); break;
    case 'dice': S('M5 5 H19 V19 H5 Z'); for (const [x, y] of [[8.5, 8.5], [15.5, 8.5], [12, 12], [8.5, 15.5], [15.5, 15.5]]) { g.beginPath(); g.arc(x, y, 1.5, 0, Math.PI * 2); g.fill(); } break;
    case 'retry': S('M19 12 a7 7 0 1 1 -2.2 -5.1 M19 4.5 V8 H15.5'); break;
    case 'lock': S('M8 10.5 V8 a4 4 0 0 1 8 0 V10.5'); F('M5.5 10.5 H18.5 V20 H5.5 Z'); break;
    case 'crown': F('M4 18 L3 7.5 L8 11.5 L12 5 L16 11.5 L21 7.5 L20 18 Z'); break;
    case 'trophy': S('M7 4 H17 V9 a5 5 0 0 1 -10 0 Z M7 6 H4 a3 3 0 0 0 3 4 M17 6 H20 a3 3 0 0 1 -3 4 M12 14 V17 M8 20 H16 M9.5 17 H14.5'); break;
    case 'copy': S('M8 8 H18 V20 H8 Z M5 16 V4 H15'); break;
    case 'paste': S('M7 5 H5 V21 H19 V5 H17 M9 3.5 H15 V7 H9 Z'); break;
    case 'trash': S('M5 7 H19 M9 7 V4.5 H15 V7 M7 7 L8 20 H16 L17 7'); break;
    case 'info': g.beginPath(); g.arc(12, 12, 9, 0, Math.PI * 2); g.stroke(); S('M12 11 V17'); g.beginPath(); g.arc(12, 7.5, 1.4, 0, Math.PI * 2); g.fill(); break;
    case 'heart': F('M12 20 C4 14 3 10 3 8 a4.5 4.5 0 0 1 9 -1 a4.5 4.5 0 0 1 9 1 c0 2 -1 6 -9 12 Z'); break;
    case 'star': starPath(g, 12, 12.5, 9.5, 5, 0.5); g.fill(); break;
    case 'flag': S('M6 21 V4 M6 4 H18 L15 8.5 L18 13 H6'); break;
    case 'hat': F('M3 17 H21 V19 H3 Z M7 17 L8 7 Q12 5 16 7 L17 17 Z'); break;
    case 'speed': S('M4.5 16 a8 8 0 1 1 15 0 M12 16 L16 9'); break;
    case 'wave': S('M3 12 h2 l2 -6 l3 12 l3 -9 l2 6 l2 -3 h4'); break;
    default: g.beginPath(); g.arc(12, 12, 6, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// Klein zacht wolkje (decoratie op het titelscherm)
export function cloud(g, x, y, s, alpha = 1) {
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x, y, 18 * s, 0, Math.PI * 2);
  g.arc(x + 22 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
  g.arc(x + 48 * s, y, 18 * s, 0, Math.PI * 2);
  g.rect(x, y - 2 * s, 48 * s, 20 * s);
  g.fill();
  g.restore();
}

export const ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
