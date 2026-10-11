// Interface op het canvas ("immediate mode"): elke frame tekent een scène haar knoppen opnieuw en meldt
// ze aan als klikgebied. Klikken en toetsen worden meteen in de event-handler afgehandeld (met de gebieden
// van de vorige frame), zodat volledig scherm, klembord en geluid werken als echte gebruikersactie.
import { C, FONT, text, rr, lighten, darken, icon as drawIcon, clamp } from './draw.js';

const VARIANTS = {
  primary: [C.orange, C.orangeD],
  blue: [C.blue, C.blueD],
  green: [C.green, C.greenD],
  pink: [C.pink, C.pinkD],
  gold: [C.gold, C.goldD],
  purple: [C.purple, C.purpleD],
  grey: [C.grey, C.greyD],
  paper: ['#fffdf7', '#d9c3a5'],
  dark: ['#4a3a68', '#2a1f40'],
};

export const ui = {
  g: null, VW: 960, VH: 540, t: 0, dt: 0,
  px: -1, py: -1, inside: false, down: false,
  enabled: true, // uit voor scènes onder een overlay
  regions: [], prev: [],
  focusables: [], prevFocus: [],
  focusId: null, kb: false,
  hoverId: null, pressId: null, dragId: null, scrollDrag: null,
  downX: 0, downY: 0, moved: false,
  anims: new Map(), scrolls: new Map(),
  clips: [], oy: 0,
  onSound: null, // (naam) => void
  cursor: 'default',

  beginFrame(g, VW, VH, t, dt) {
    this.g = g; this.VW = VW; this.VH = VH; this.t = t; this.dt = dt;
    this.regions = []; this.focusables = []; this.clips = []; this.oy = 0;
  },

  endFrame() {
    this.prev = this.regions;
    this.prevFocus = this.focusables;
    const hit = this.hit(this.px, this.py);
    this.hoverId = this.inside ? hit?.id ?? null : null;
    this.cursor = hit && (hit.onClick || hit.onDrag) && !hit.disabled ? 'pointer' : 'default';
    if (this.focusId && !this.focusables.some((f) => f.id === this.focusId)) this.focusId = null;
    for (const [id, a] of this.anims) if (a.seen !== this.t) this.anims.delete(id);
  },

  // ---------- gebieden ----------
  region(r) {
    if (!this.enabled) return { hover: false, pressed: false, focused: false };
    let { x, y, w, h } = r;
    y += this.oy;
    const clip = this.clips[this.clips.length - 1];
    let vis = { x, y, w, h };
    if (clip) {
      const x0 = Math.max(x, clip.x), y0 = Math.max(y, clip.y);
      const x1 = Math.min(x + w, clip.x + clip.w), y1 = Math.min(y + h, clip.y + clip.h);
      vis = x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
    }
    const reg = { ...r, x, y, w, h, vis, scroller: clip?.scroller, contentY: r.y };
    if (vis) this.regions.push(reg);
    if (r.focus !== false && (r.onClick || r.onLeft) && !r.disabled) this.focusables.push(reg);
    return {
      hover: this.hoverId === r.id && !r.disabled,
      pressed: this.pressId === r.id && this.hoverId === r.id && !r.disabled,
      focused: this.kb && this.focusId === r.id,
    };
  },

  hit(x, y, pred = () => true) {
    for (let i = this.prev.length - 1; i >= 0; i--) {
      const r = this.prev[i], v = r.vis;
      if (v && x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h && pred(r)) return r;
    }
    return null;
  },
  byId(id) { return this.prev.find((r) => r.id === id) || this.prevFocus.find((r) => r.id === id); },

  // Zacht naar een doelwaarde bewegen (voor hover/indrukken).
  anim(id, target, rate = 14) {
    let a = this.anims.get(id);
    if (!a) { a = { v: target }; this.anims.set(id, a); }
    a.v += (target - a.v) * (1 - Math.exp(-rate * this.dt));
    a.seen = this.t;
    return a.v;
  },

  sound(name) { this.onSound?.(name); },

  // ---------- invoer (aangeroepen door de engine) ----------
  pointerMove(x, y) {
    this.px = x; this.py = y; this.inside = true;
    if (Math.hypot(x - this.downX, y - this.downY) > 3) this.kb = false;
    if (!this.down) return;
    if (Math.hypot(x - this.downX, y - this.downY) > 8) this.moved = true;
    if (this.dragId) { this.byId(this.dragId)?.onDrag?.(x, y, 'move'); return; }
    const sd = this.scrollDrag;
    if (sd && this.moved) {
      this.pressId = null;
      sd.st.target = clamp(sd.start - (y - this.downY), 0, sd.st.max);
      sd.st.pos = sd.st.target;
    }
  },
  pointerDown(x, y) {
    this.px = x; this.py = y; this.down = true; this.moved = false; this.downX = x; this.downY = y; this.kb = false;
    const r = this.hit(x, y);
    this.pressId = r && !r.disabled ? r.id : null;
    this.dragId = r?.onDrag && !r.disabled ? r.id : null;
    if (this.dragId) r.onDrag(x, y, 'start');
    const sc = this.hit(x, y, (q) => q.scrollArea);
    this.scrollDrag = sc ? { st: sc.scrollArea, start: sc.scrollArea.target } : null;
  },
  pointerUp(x, y) {
    this.down = false;
    if (this.dragId) { this.byId(this.dragId)?.onDrag?.(x, y, 'end'); this.dragId = null; this.pressId = null; return; }
    const r = this.hit(x, y);
    if (r && r.id === this.pressId && r.onClick && !r.disabled) {
      if (!r.silent) this.sound(r.sound || 'click');
      r.onClick();
    }
    this.pressId = null;
    this.scrollDrag = null;
  },
  pointerLeave() { this.inside = false; this.hoverId = null; },
  wheel(x, y, dy) {
    const r = this.hit(x, y, (q) => q.onWheel);
    if (r) { r.onWheel(dy); return true; }
    return false;
  },

  // Toetsenbord: pijltjes zoeken de dichtstbijzijnde knop in die richting, Enter/spatie klikt.
  key(e) {
    const list = this.prevFocus;
    if (!list.length) return false;
    const cur = list.find((f) => f.id === this.focusId);
    const k = e.code;
    if (k === 'Enter' || k === 'Space' || k === 'NumpadEnter') {
      if (!cur || !this.kb) return false;
      if (cur.onClick && !cur.disabled) { this.sound(cur.sound || 'click'); cur.onClick(); }
      return true;
    }
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (k === 'Tab') {
      const i = cur ? list.indexOf(cur) : -1;
      const n = list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
      this.setFocus(n);
      return true;
    }
    if (!dirs[k]) return false;
    if (!this.kb || !cur) { this.setFocus(cur || list.find((f) => f.primary) || list[0]); return true; }
    if (k === 'ArrowLeft' && cur.onLeft) { cur.onLeft(); this.sound('tick'); return true; }
    if (k === 'ArrowRight' && cur.onRight) { cur.onRight(); this.sound('tick'); return true; }
    const [dx, dy] = dirs[k];
    const cx = cur.x + cur.w / 2, cy = cur.contentY + (cur.scroller ? 0 : 0) + cur.h / 2;
    let best = null, bs = Infinity;
    for (const f of list) {
      if (f === cur) continue;
      const fx = f.x + f.w / 2, fy = f.contentY + f.h / 2;
      const ddx = fx - cx, ddy = fy - cy;
      const along = ddx * dx + ddy * dy;
      if (along <= 4) continue;
      const across = Math.abs(ddx * dy) + Math.abs(ddy * dx);
      const s = along + across * 2.2;
      if (s < bs) { bs = s; best = f; }
    }
    if (best) this.setFocus(best);
    return true;
  },
  setFocus(f) {
    if (!f) return;
    this.kb = true;
    if (f.id !== this.focusId) this.sound('tick');
    this.focusId = f.id;
    const st = f.scroller; // in een schuifgebied: in beeld schuiven
    if (st) {
      const top = f.contentY - 10, bot = f.contentY + f.h + 10;
      if (top < st.target) st.target = clamp(top, 0, st.max);
      else if (bot > st.target + st.viewH) st.target = clamp(bot - st.viewH, 0, st.max);
    }
  },

  // ---------- widgets ----------
  focusRing(x, y, w, h, r) {
    const g = this.g, p = 0.5 + 0.5 * Math.sin(this.t * 6);
    g.save();
    rr(g, x - 6, y - 6, w + 12, h + 12, r + 6);
    g.lineWidth = 4;
    g.strokeStyle = `rgba(255, 255, 255, ${0.75 + p * 0.25})`;
    g.shadowColor = 'rgba(255, 230, 120, .9)';
    g.shadowBlur = 10 + p * 6;
    g.stroke();
    g.restore();
  },

  /**
   * Snoepknop met een dikke rand en diepte.
   * o: {variant, icon, size, onClick, disabled, sub, primary, align, iconSize, sound, badge}
   */
  button(id, x, y, w, h, label, o = {}) {
    const g = this.g;
    const st = this.region({ id, x, y, w, h, onClick: o.onClick, disabled: o.disabled, primary: o.primary, sound: o.sound, onLeft: o.onLeft, onRight: o.onRight });
    const [base, dark] = VARIANTS[o.variant || 'primary'];
    const depth = o.depth ?? (h >= 54 ? 7 : h >= 40 ? 5 : 4);
    const hv = this.anim(id + ':h', st.hover || st.focused ? 1 : 0, 18);
    const pr = this.anim(id + ':p', st.pressed ? 1 : 0, 30);
    const r = o.r ?? Math.min(h / 2, 18);
    const lift = (depth - 1) * pr;
    const sc = 1 + hv * 0.025;
    g.save();
    g.globalAlpha *= o.disabled ? 0.55 : o.alpha ?? 1;
    g.translate(x + w / 2, y + h / 2);
    g.scale(sc, sc);
    g.translate(-w / 2, -h / 2);
    // schaduw + diepte
    rr(g, 0, depth + 3, w, h, r); g.fillStyle = 'rgba(29,16,48,.28)'; g.fill();
    rr(g, 0, depth, w, h, r); g.fillStyle = dark; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    // bovenkant
    const top = lift;
    rr(g, 0, top, w, h, r);
    const gr = g.createLinearGradient(0, top, 0, top + h);
    const b = o.disabled ? '#b7aac2' : base;
    gr.addColorStop(0, lighten(b, 0.22 + hv * 0.1));
    gr.addColorStop(1, lighten(b, hv * 0.08));
    g.fillStyle = gr; g.fill();
    g.lineWidth = 3.5; g.strokeStyle = C.ink; g.stroke();
    // glans
    rr(g, 6, top + 4, w - 12, Math.min(h * 0.32, 16), Math.min(r, 10));
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
    g.restore();
    if (st.focused) this.focusRing(x, y + lift, w, h, r);
    // inhoud
    const light = o.variant === 'paper';
    const ink = light ? C.ink : '#fff';
    const size = o.size ?? Math.min(26, h * 0.42);
    const cy = y + lift + h / 2 - (o.sub ? size * 0.32 : 0);
    const isz = o.iconSize ?? size * 1.15;
    const cx = x + w / 2;
    if (label) {
      const tw = this.measure(label, size);
      const gap = o.icon ? isz * 0.45 : 0;
      const total = tw + (o.icon ? isz + gap : 0);
      let lx = o.align === 'left' ? x + 18 : cx - total / 2;
      if (o.icon) { this.iconOutlined(o.icon, lx + isz / 2, cy, isz, ink, light); lx += isz + gap; }
      text(g, label, lx, cy + 1, { size, color: ink, align: 'left', stroke: light ? null : C.ink, strokeW: size / 4, maxW: w - 24 - (o.icon ? isz + gap : 0) });
    } else if (o.icon) this.iconOutlined(o.icon, cx, cy, isz, ink, light);
    if (o.sub) text(g, o.sub, cx, y + lift + h / 2 + size * 0.62, { size: size * 0.52, weight: 800, color: light ? C.muted : 'rgba(255,255,255,.92)', maxW: w - 20 });
    if (o.badge) {
      const bx = x + w - 8, by = y + 6 + lift;
      g.save(); g.beginPath(); g.arc(bx, by, 13, 0, Math.PI * 2); g.fillStyle = C.pink; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke(); g.restore();
      text(g, o.badge, bx, by + 1, { size: 14, color: '#fff' });
    }
    return st;
  },

  // Icoon met een donkere omlijning (zodat het op elke kleur leesbaar is).
  iconOutlined(name, cx, cy, s, color, light = false) {
    if (!light) drawIcon(this.g, name, cx, cy + 1.5, s, 'rgba(58,35,80,.55)', { lw: 4.2 });
    drawIcon(this.g, name, cx, cy, s, color, { lw: light ? 2.8 : 3 });
  },

  iconButton(id, cx, cy, size, name, o = {}) {
    return this.button(id, cx - size / 2, cy - size / 2, size, size, null, { icon: name, r: size / 2, iconSize: size * 0.5, variant: 'dark', depth: 4, ...o });
  },

  measure(str, size, weight = 900) {
    const g = this.g;
    g.save(); g.font = FONT(size, weight);
    const w = g.measureText(String(str)).width;
    g.restore();
    return w;
  },

  // Rij met een label en een schakelaar.
  toggle(id, x, y, w, h, label, value, onChange, o = {}) {
    const g = this.g;
    const st = this.region({ id, x, y, w, h, onClick: () => onChange(!value), sound: 'tick' });
    this.rowBack(x, y, w, h, st);
    text(g, label, x + 16, y + h / 2 + (o.sub ? -9 : 1), { size: 19, weight: 900, color: C.text, align: 'left', maxW: w - 120 });
    if (o.sub) text(g, o.sub, x + 16, y + h / 2 + 13, { size: 13.5, weight: 700, color: C.muted, align: 'left', maxW: w - 120 });
    const on = this.anim(id + ':v', value ? 1 : 0, 16);
    const sw = 62, sh = 32, sx = x + w - sw - 16, sy = y + (h - sh) / 2;
    rr(g, sx, sy + 3, sw, sh, sh / 2); g.fillStyle = 'rgba(29,16,48,.25)'; g.fill();
    rr(g, sx, sy, sw, sh, sh / 2);
    g.fillStyle = on > 0.5 ? C.green : '#d8cbe0';
    g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    const kx = sx + sh / 2 + on * (sw - sh);
    g.beginPath(); g.arc(kx, sy + sh / 2, sh / 2 - 4, 0, Math.PI * 2);
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2.5; g.stroke();
    if (st.focused) this.focusRing(x, y, w, h, 14);
    return st;
  },

  rowBack(x, y, w, h, st) {
    const g = this.g;
    const hv = this.anim(`${x},${y}:row`, st.hover || st.focused ? 1 : 0, 18);
    rr(g, x, y, w, h, 14);
    g.fillStyle = `rgba(255,255,255,${0.55 + hv * 0.35})`;
    g.fill();
    g.lineWidth = 2; g.strokeStyle = C.paperLine; g.stroke();
  },

  // Schuifregelaar. fmt(v) = tekst rechts.
  slider(id, x, y, w, h, label, value, min, max, step, onChange, o = {}) {
    const g = this.g;
    const tx = x + (o.labelW ?? 200), tw = w - (o.labelW ?? 200) - (o.valueW ?? 90) - 16;
    const set = (v) => { const q = clamp(Math.round(v / step) * step, min, max); if (q !== value) onChange(+q.toFixed(4)); };
    const fromX = (px) => set(min + clamp((px - tx) / tw, 0, 1) * (max - min));
    const st = this.region({
      id, x, y, w, h, focus: true,
      onDrag: (px, py, phase) => { if (phase !== 'end') fromX(px); },
      onLeft: () => set(value - step), onRight: () => set(value + step),
    });
    this.rowBack(x, y, w, h, st);
    text(g, label, x + 16, y + h / 2 + (o.sub ? -9 : 1), { size: 19, color: C.text, align: 'left', maxW: (o.labelW ?? 200) - 24 });
    if (o.sub) text(g, o.sub, x + 16, y + h / 2 + 13, { size: 13.5, weight: 700, color: C.muted, align: 'left', maxW: (o.labelW ?? 200) - 24 });
    const f = (value - min) / (max - min);
    const ty = y + h / 2;
    rr(g, tx, ty - 7, tw, 14, 7); g.fillStyle = '#e6d8ea'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
    if (o.meter != null) { // live niveau (microfoon)
      rr(g, tx + 2, ty - 5, Math.max(0, (tw - 4) * clamp(o.meter, 0, 1)), 10, 5); g.fillStyle = 'rgba(92,201,111,.6)'; g.fill();
    } else {
      rr(g, tx, ty - 7, Math.max(14, tw * f), 14, 7); g.fillStyle = o.color || C.blue; g.fill(); g.lineWidth = 2.5; g.stroke();
    }
    const kx = tx + tw * f, hv = this.anim(id + ':k', st.hover || st.focused || this.dragId === id ? 1 : 0, 16);
    g.beginPath(); g.arc(kx, ty, 13 + hv * 2, 0, Math.PI * 2);
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = 3; g.strokeStyle = C.ink; g.stroke();
    g.beginPath(); g.arc(kx, ty, 5, 0, Math.PI * 2); g.fillStyle = o.color || C.blue; g.fill();
    text(g, o.fmt ? o.fmt(value) : value, x + w - 16, ty + 1, { size: 18, color: C.text, align: 'right', maxW: (o.valueW ?? 90) - 8 });
    if (st.focused) this.focusRing(x, y, w, h, 14);
    return st;
  },

  // Keuze uit een paar mogelijkheden (gesegmenteerd).
  choice(id, x, y, w, h, label, options, value, onChange, o = {}) {
    const g = this.g;
    const lw = label ? o.labelW ?? 200 : 0;
    const back = this.region({ id: id + ':row', x, y, w, h, focus: false });
    this.rowBack(x, y, w, h, back);
    if (label) {
      text(g, label, x + 16, y + h / 2 + (o.sub ? -9 : 1), { size: 19, color: C.text, align: 'left', maxW: lw - 24 });
      if (o.sub) text(g, o.sub, x + 16, y + h / 2 + 13, { size: 13.5, weight: 700, color: C.muted, align: 'left', maxW: lw - 24 });
    }
    const sx = x + lw + 8, sw = w - lw - 16, n = options.length, bw = sw / n, bh = h - 16;
    rr(g, sx, y + 8, sw, bh, 12); g.fillStyle = '#eadcef'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.ink; g.stroke();
    const idx = Math.max(0, options.findIndex((op) => op.value === value));
    const ax = this.anim(id + ':sel', idx, 16);
    rr(g, sx + ax * bw + 3, y + 11, bw - 6, bh - 6, 10);
    g.fillStyle = o.color || C.orange; g.fill(); g.lineWidth = 2.5; g.stroke();
    options.forEach((op, i) => {
      const st = this.region({ id: `${id}:${i}`, x: sx + i * bw, y: y + 8, w: bw, h: bh, onClick: () => onChange(op.value), sound: 'tick',
        onLeft: () => onChange(options[Math.max(0, i - 1)].value), onRight: () => onChange(options[Math.min(n - 1, i + 1)].value) });
      const on = i === idx;
      text(g, op.label, sx + i * bw + bw / 2, y + h / 2 + 1, { size: o.size ?? 17, color: on ? '#fff' : st.hover ? C.ink : C.muted, stroke: on ? C.ink : null, strokeW: 4, maxW: bw - 10 });
      if (st.focused) this.focusRing(sx + i * bw + 3, y + 11, bw - 6, bh - 6, 10);
    });
  },

  // Schuifgebied: draw() tekent de inhoud vanaf y (in inhoudscoördinaten, verschoven).
  scroll(id, x, y, w, h, contentH, draw) {
    const g = this.g;
    let st = this.scrolls.get(id);
    if (!st) { st = { pos: 0, target: 0, max: 0, viewH: h }; this.scrolls.set(id, st); }
    st.viewH = h;
    st.max = Math.max(0, contentH - h);
    st.target = clamp(st.target, 0, st.max);
    st.pos += (st.target - st.pos) * (1 - Math.exp(-16 * this.dt));
    if (Math.abs(st.target - st.pos) < 0.3) st.pos = st.target;
    if (this.enabled) this.regions.push({ id: id + ':area', x, y, w, h, vis: { x, y, w, h }, onWheel: (dy) => { st.target = clamp(st.target + dy, 0, st.max); }, scrollArea: st });
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.translate(0, -st.pos);
    this.clips.push({ x, y, w, h, scroller: st });
    const oy = this.oy;
    this.oy = oy - st.pos;
    draw(y);
    this.oy = oy;
    this.clips.pop();
    g.restore();
    if (st.max > 0) { // schuifbalk + zachte randen
      const th = Math.max(40, (h * h) / contentH), ty = y + (h - th) * (st.pos / st.max);
      rr(g, x + w - 8, y + 4, 6, h - 8, 3); g.fillStyle = 'rgba(58,35,80,.12)'; g.fill();
      rr(g, x + w - 8, ty + 4, 6, th - 8, 3); g.fillStyle = 'rgba(58,35,80,.45)'; g.fill();
    }
    return st;
  },
};
