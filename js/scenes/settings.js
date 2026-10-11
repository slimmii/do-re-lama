// Instellingen (over het menu of het spel heen): spel, microfoon, geluid & beeld, gegevens.
import { ui } from '../ui.js';
import { C, text, title, panel, ribbon, rr, icon, wrap, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist, resetAll, TEST } from '../store.js';
import { mic, calibrate, unlock } from '../audio.js';
import { solfege } from '../notes.js';
import { exportCode, importCode } from '../sync.js';
import { isFullscreen, canFullscreen, toggleFullscreen } from '../engine.js';
import { dimScreen } from './common.js';

const TABS = [
  { id: 'game', name: 'Spel', icon: 'play' },
  { id: 'mic', name: 'Microfoon', icon: 'mic' },
  { id: 'av', name: 'Geluid & beeld', icon: 'sound' },
  { id: 'data', name: 'Gegevens', icon: 'copy' },
];
const LIVES = [{ label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '5', value: 5 }, { label: '10', value: 10 }, { label: '∞', value: 0 }];
const TOL = [{ label: 'Makkelijk', value: 0.28 }, { label: 'Normaal', value: 0.18 }, { label: 'Streng', value: 0.1 }];
const sensLabel = (v) => (v < -0.2 ? 'heel laag' : v < 0.25 ? 'laag' : v < 0.65 ? 'normaal' : 'hoog');

let lastTab = 'game';

export class SettingsScene {
  constructor(o = {}) {
    this.o = o;
    this.overlay = true;
    this.tab = lastTab;
    this.code = null; // gemaakte code
    this.msg = null; // {text, ok}
    this.calib = null; // {ctl, status}
    this.wipe = 0;
  }

  enter() {
    this.onPaste = (e) => {
      if (this.tab !== 'data') return;
      const s = e.clipboardData?.getData('text');
      if (s) { e.preventDefault(); this.importText(s); }
    };
    addEventListener('paste', this.onPaste);
    mic.refreshDevices();
  }
  leave() {
    removeEventListener('paste', this.onPaste);
    this.calib?.ctl?.cancel();
    persist();
    this.o.onClose?.();
  }
  back() { app.engine.pop(this); }

  key(e) {
    if (e.code === 'Escape') return false;
    return false;
  }

  set(k, v) { S.settings[k] = v; persist(); mic.applySettings(); }

  // ---------- gegevens ----------
  async makeCode() {
    this.code = exportCode(S.wallet, S.journey, S.house);
    try { await navigator.clipboard.writeText(this.code); this.msg = { text: 'Code gekopieerd! Plak ze op het andere toestel bij “Code plakken”.', ok: true }; }
    catch { this.msg = { text: 'Kopiëren lukte niet automatisch. Neem de code hieronder over.', ok: false }; }
  }
  async pasteCode() {
    try {
      const s = await navigator.clipboard.readText();
      if (!s) throw new Error();
      this.importText(s);
    } catch {
      this.msg = { text: 'Ik mag het klembord niet lezen. Druk op Ctrl+V (of ⌘V op een Mac) om de code te plakken.', ok: false };
    }
  }
  importText(s) {
    try {
      const r = importCode(S.wallet, s.trim(), S.journey, S.house);
      persist(true);
      this.msg = { text: `Gelukt! ${r.added} ${r.added === 1 ? 'nieuw spulletje' : 'nieuwe spulletjes'}${r.gained ? `, ${r.gained} munten erbij` : ''}${r.stages > 0 ? ` en ${r.stages} ${r.stages === 1 ? 'landschap' : 'landschappen'} verder op de reis` : ''}.`, ok: true };
      ui.sound('buy');
    } catch (e) {
      this.msg = { text: e.message, ok: false };
      ui.sound('error');
    }
  }

  // ---------- tekenen ----------
  draw(g, VW, VH) {
    dimScreen(g, VW, VH, Math.min(0.55, this.t * 3));
    const w = Math.min(860, VW - 32), h = Math.min(500, VH - 30);
    const x = (VW - w) / 2, y = (VH - h) / 2 + 12;
    const k = ease.back(clamp(this.t / 0.3, 0, 1));
    g.save();
    g.globalAlpha = clamp(this.t / 0.12, 0, 1);
    g.translate(VW / 2, VH / 2); g.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); g.translate(-VW / 2, -VH / 2);
    panel(g, x, y, w, h);
    ribbon(g, 'Instellingen', VW / 2, y - 24, { size: 26, color: C.purple, dark: C.purpleD });
    g.restore();
    ui.iconButton('s:close', x + w - 8, y + 8, 48, 'close', { onClick: () => this.back(), variant: 'pink', sound: 'back' });

    // tabbladen links
    const tw = 186;
    TABS.forEach((tb, i) => {
      const on = this.tab === tb.id;
      ui.button('s:t' + tb.id, x + 18, y + 44 + i * 62, tw, 50, tb.name, { icon: tb.icon, variant: on ? 'purple' : 'paper', size: 17, align: 'left', iconSize: 20, depth: on ? 2 : 4,
        onClick: () => { this.tab = lastTab = tb.id; this.msg = null; }, sound: 'tick' });
    });
    if (TEST) text(g, 'Testmodus: niets wordt bewaard', x + 18 + tw / 2, y + h - 24, { size: 12, color: C.bad });

    const cx = x + tw + 36, cw = w - tw - 54, cy = y + 40, ch = h - 56;
    rr(g, cx - 8, cy - 6, cw + 16, ch + 12, 16); g.fillStyle = C.paper2; g.fill();
    const rows = this.rows(cw);
    const total = rows.reduce((s, r) => s + r.h + 10, 0) + 12;
    ui.scroll('s:sc:' + this.tab, cx - 8, cy - 6, cw + 16, ch + 12, total, (top) => {
      let ry = top + 10;
      for (const r of rows) { r.draw(cx + 2, ry, cw - 18); ry += r.h + 10; }
    });
  }

  rows(cw) {
    const st = S.settings, g = ui.g;
    const R = (h, draw) => ({ h, draw });
    if (this.tab === 'game') return [
      R(62, (x, y, w) => ui.choice('s:lives', x, y, w, 62, 'Levens', LIVES, st.lives, (v) => this.set('lives', v), { labelW: 170, color: C.pink, sub: '∞ = onsterfelijk' })),
      R(62, (x, y, w) => ui.slider('s:bpm', x, y, w, 62, 'Snelheid', st.bpm, 15, 90, 5, (v) => this.set('bpm', v), { labelW: 170, fmt: (v) => `${v} /min`, sub: 'noten per minuut (← →)' })),
      R(62, (x, y, w) => ui.choice('s:tol', x, y, w, 62, 'Hoe streng?', TOL, st.tol, (v) => this.set('tol', v), { labelW: 170, sub: 'breedte van de blauwe balk', size: 15 })),
      R(58, (x, y, w) => ui.toggle('s:big', x, y, w, 58, 'Grote notennaam', st.bigName, (v) => this.set('bigName', v), { sub: 'de noot die aan de beurt is, groot in de lucht' })),
      R(58, (x, y, w) => ui.toggle('s:names', x, y, w, 58, 'Notennamen bij de noten', st.names, (v) => this.set('names', v), { sub: 'do re mi onder elke noot' })),
      R(58, (x, y, w) => ui.toggle('s:fing', x, y, w, 58, 'Vingers (m / i)', st.fingers, (v) => this.set('fingers', v), { sub: 'welke vinger tokkelt: middelvinger of wijsvinger' })),
      R(58, (x, y, w) => ui.toggle('s:metro', x, y, w, 58, 'Metronoom', st.metro, (v) => this.set('metro', v), { sub: 'tikt als een noot midden in de balk staat' })),
    ];
    if (this.tab === 'mic') return [
      R(70, (x, y, w) => this.micRow(x, y, w)),
      ...(st.keyboard ? [] : [R(70, (x, y, w) => this.deviceRow(x, y, w))]),
      R(62, (x, y, w) => ui.slider('s:sens', x, y, w, 62, 'Gevoeligheid', st.sens, -0.6, 1, 0.05, (v) => this.set('sens', v), { labelW: 170, fmt: sensLabel, valueW: 90, sub: 'hoort hij te veel of te weinig?' })),
      R(62, (x, y, w) => ui.slider('s:lat', x, y, w, 62, 'Vertraging', st.latency, 0, 400, 5, (v) => this.set('latency', v), { labelW: 170, fmt: (v) => `${v} ms`, sub: 'tijd tot de microfoon het hoort' })),
      R(this.calibH ?? 96, (x, y, w) => this.calibRow(x, y, w)),
      R(58, (x, y, w) => ui.toggle('s:echo', x, y, w, 58, 'Geen koptelefoon', st.echo, (v) => { this.set('echo', v); mic.stop(); }, { sub: 'echo-onderdrukking aanzetten' })),
      R(58, (x, y, w) => ui.toggle('s:kb', x, y, w, 58, 'Spelen met het toetsenbord', st.keyboard, (v) => this.set('keyboard', v), { sub: 'zonder gitaar: A S D F … zijn de noten van laag naar hoog' })),
    ];
    if (this.tab === 'av') return [
      R(58, (x, y, w) => ui.toggle('s:metro2', x, y, w, 58, 'Metronoom', st.metro, (v) => this.set('metro', v), { sub: 'tikken tijdens het spel' })),
      R(62, (x, y, w) => ui.slider('s:mvol', x, y, w, 62, 'Volume metronoom', st.metroVol, 0, 1, 0.05, (v) => this.set('metroVol', v), { labelW: 190, fmt: (v) => `${Math.round(v * 100)}%`, color: C.green })),
      R(58, (x, y, w) => ui.toggle('s:sfx', x, y, w, 58, 'Geluidjes', st.sfx, (v) => this.set('sfx', v), { sub: 'in de menu’s en in de boomhut (niet tijdens het gitaarspel)' })),
      ...(canFullscreen() ? [R(58, (x, y, w) => ui.toggle('s:full', x, y, w, 58, 'Volledig scherm', isFullscreen(), () => toggleFullscreen(), { sub: 'of druk op F' }))] : []),
    ];
    // gegevens
    return [
      R(96, (x, y, w) => {
        rr(g, x, y, w, 96, 14); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        text(g, 'Overzetten naar een ander toestel', x + 16, y + 22, { size: 18, color: C.text, align: 'left' });
        const lines = wrap(g, 'Maak een code met je munten, spulletjes en je reis, en plak ze op het andere toestel. Codes uit de Simisol-notentrainer werken hier ook.', w - 32, 14, 700);
        lines.forEach((l, i) => text(g, l, x + 16, y + 48 + i * 18, { size: 14, weight: 700, color: C.muted, align: 'left' }));
      }),
      R(56, (x, y, w) => {
        const bw = (w - 12) / 2;
        ui.button('s:mk', x, y, bw, 52, 'Code maken', { icon: 'copy', variant: 'blue', size: 18, onClick: () => this.makeCode() });
        ui.button('s:ps', x + bw + 12, y, bw, 52, 'Code plakken', { icon: 'paste', variant: 'green', size: 18, onClick: () => this.pasteCode() });
      }),
      ...(this.msg ? [R(this.msgH ?? 50, (x, y, w) => {
        const lines = wrap(g, this.msg.text, w - 50, 15, 800);
        this.msgH = lines.length * 20 + 22;
        rr(g, x, y, w, this.msgH, 12); g.fillStyle = this.msg.ok ? '#e2f6e6' : '#fde4e4'; g.fill();
        icon(g, this.msg.ok ? 'check' : 'info', x + 22, y + this.msgH / 2, 20, this.msg.ok ? C.greenD : C.bad);
        lines.forEach((l, i) => text(g, l, x + 42, y + 21 + i * 20, { size: 15, weight: 800, color: C.text, align: 'left' }));
      })] : []),
      ...(this.code ? [R(this.codeH ?? 60, (x, y, w) => {
        const chunk = Math.floor((w - 24) / 8.2), lines = [];
        for (let i = 0; i < this.code.length; i += chunk) lines.push(this.code.slice(i, i + chunk));
        this.codeH = lines.length * 17 + 20;
        rr(g, x, y, w, this.codeH, 12); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = C.paperLine; g.stroke();
        g.font = '600 13.5px ui-monospace, Menlo, monospace'; g.fillStyle = C.text; g.textAlign = 'left'; g.textBaseline = 'top';
        lines.forEach((l, i) => g.fillText(l, x + 12, y + 10 + i * 17));
      })] : []),
      R(56, (x, y, w) => {
        const armed = this.wipe && this.t - this.wipe < 3;
        ui.button('s:wipe', x, y, w, 52, armed ? 'Zeker? Klik nog eens: alles wordt gewist' : 'Alles wissen en opnieuw beginnen', { icon: 'trash', variant: armed ? 'pink' : 'paper', size: 16,
          onClick: () => {
            if (!armed) { this.wipe = this.t; return; }
            resetAll(); mic.stop(); this.wipe = 0; this.code = null;
            this.msg = { text: 'Alles is gewist. Je begint opnieuw in de weide.', ok: true };
          } });
      }),
    ];
  }

  micRow(x, y, w) {
    const g = ui.g;
    rr(g, x, y, w, 70, 14); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    if (S.settings.keyboard) {
      icon(g, 'keyboard', x + 30, y + 35, 28, C.muted);
      text(g, 'Je speelt nu met het toetsenbord.', x + 56, y + 36, { size: 16, color: C.muted, align: 'left' });
      return;
    }
    if (!mic.running) {
      icon(g, 'mic', x + 30, y + 35, 28, C.muted);
      text(g, mic.error ? 'Microfoon werkt niet' : 'Microfoon staat uit', x + 56, y + 26, { size: 16, color: C.text, align: 'left' });
      text(g, 'Zet hem aan om te testen.', x + 56, y + 47, { size: 13, weight: 700, color: C.muted, align: 'left' });
      ui.button('s:micon', x + w - 170, y + 12, 158, 46, 'Aanzetten', { icon: 'mic', variant: 'green', size: 17, onClick: () => { unlock(); mic.ensure(); } });
      return;
    }
    icon(g, 'mic', x + 30, y + 35, 28, C.greenD);
    text(g, 'Ik hoor', x + 56, y + 24, { size: 14, color: C.muted, align: 'left' });
    rr(g, x + 56, y + 40, w - 200, 14, 7); g.fillStyle = '#e6d8ea'; g.fill();
    rr(g, x + 56, y + 40, (w - 200) * clamp(mic.level, 0, 1), 14, 7); g.fillStyle = C.green; g.fill();
    const recent = mic.midi != null && performance.now() - mic.heardAt < 700;
    title(g, recent ? solfege(mic.midi + 12) : '–', x + w - 70, y + 36, 32, recent ? '#7ee08a' : '#fff');
  }

  // Welke microfoon: de knop gaat de lijst rond.
  deviceRow(x, y, w) {
    const g = ui.g, list = mic.devices, id = S.settings.micId;
    rr(g, x, y, w, 70, 14); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    const cur = list.find((d) => d.id === id);
    let name = cur?.label ?? 'Standaard van de browser';
    if (!id && mic.label) name = `Standaard: ${mic.label}`;
    else if (id && !cur) name = 'Niet gevonden, ik gebruik de standaard';
    text(g, 'Welke microfoon?', x + 16, y + 24, { size: 18, color: C.text, align: 'left' });
    while (name.length > 4 && ui.measure(name, 14, 700) > w - 200) name = name.slice(0, -2) + '…';
    text(g, name, x + 16, y + 48, { size: 14, weight: 700, color: id && !cur ? C.bad : C.muted, align: 'left' });
    ui.button('s:dev', x + w - 172, y + 10, 160, 50, 'Andere', { icon: 'next', variant: 'blue', size: 18, disabled: list.length < 2, sound: 'tick',
      onClick: () => {
        const i = list.findIndex((d) => d.id === id);
        this.set('micId', list[(i + 1) % list.length].id);
        mic.choose(S.settings.micId);
      } });
  }

  calibRow(x, y, w) {
    const g = ui.g, c = this.calib;
    rr(g, x, y, w, this.calibH ?? 96, 14); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    text(g, 'Vertraging meten', x + 16, y + 24, { size: 18, color: C.text, align: 'left' });
    let msg = 'Tokkel een losse snaar telkens je de klik hoort. Het spel meet dan zelf de vertraging.';
    let big = null;
    if (c?.status) {
      const s = c.status;
      if (s.done) msg = s.msg;
      else if (s.phase === 'listen') { msg = 'Luister naar de kliks…'; big = `${s.n}`; }
      else { msg = 'Tokkel nu op de klik!'; big = `${s.n} / ${s.of}`; }
    }
    const lines = wrap(g, msg, w - 210, 14, 700);
    lines.forEach((l, i) => text(g, l, x + 16, y + 48 + i * 18, { size: 14, weight: 700, color: c?.status?.done ? (c.status.ok ? C.greenD : C.bad) : C.muted, align: 'left' }));
    this.calibH = Math.max(96, 58 + lines.length * 18 + 10);
    if (big) title(g, big, x + w - 250, y + 26, 22, C.gold, { align: 'right' });
    const running = c && !c.status?.done;
    ui.button('s:cal', x + w - 172, y + 22, 160, 50, running ? 'Stop' : 'Meten', { icon: running ? 'close' : 'target', variant: running ? 'pink' : 'blue', size: 18,
      onClick: async () => {
        if (running) { c.ctl?.cancel(); return; }
        const cal = this.calib = { status: null, ctl: null };
        cal.ctl = await calibrate((s) => { cal.status = s; if (s.done) persist(); });
      } });
  }
}
