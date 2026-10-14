// Vrij oefenen › Liedjes: de liedjesbibliotheek. Een schema met alle liedjes van makkelijk naar moeilijk (daarna de
// rock-riffs, ook van makkelijk naar moeilijk) en per
// liedje welke noten erin voorkomen. Kies een liedje, luister ernaar en speel het (in zijn eigen ritme).
import { ui } from '../ui.js';
import { C, text, panel, rr, icon, star, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, persist } from '../store.js';
import { audioCtx, pluck, unlock } from '../audio.js';
import { soundingMidi, solfegeMidi, describePosition } from '../notes.js';
import { unlockedNotes } from '../lama-journey.js';
import { SONG_NOTES, LEVELS, GROUPS, songById, songStars } from '../songs.js';
import { topBar, freeTabs, LIVES } from './common.js';

const LEVEL_COLORS = [C.green, C.blue, C.gold, C.orange, C.pink];
const HEAD_H = 30, ROW_H = 40;
const PREVIEW_BPM = 100; // luisteren: in een tempo waarin je het liedje herkent
const noteName = (p) => solfegeMidi(soundingMidi(p)); // hoge noten met een accent: do′ re′ ...

export class SongsScene {
  enter() {
    app.backdrop.wander();
    if (!songById(S.song)) S.song = GROUPS[0].songs[0].id;
    this.jump = true; // eerst naar het gekozen liedje schuiven
  }
  leave() { this.preview = null; }
  update(dt) {
    app.backdrop.update(dt);
    this.schedule();
  }
  back() { app.engine.go(app.scenes.title()); }

  get song() { return songById(S.song); }

  select(s) {
    if (S.song !== s.id) this.preview = null;
    S.song = s.id;
    persist();
  }

  play() {
    this.preview = null;
    S.settings.freeTab = 'songs';
    persist();
    app.engine.go(app.scenes.play({ mode: 'lied', song: this.song }));
  }

  // ---------- luisteren ----------
  listen() {
    if (this.preview) { this.preview = null; return; }
    const c = unlock();
    this.preview = { song: this.song, t0: c.currentTime + 0.15, i: 0 };
  }

  // De noten een beetje op voorhand inplannen (zo blijft het ritme strak, ook als een frame wat later komt).
  schedule() {
    const pv = this.preview;
    if (!pv) return;
    const now = audioCtx().currentTime, spb = 60 / PREVIEW_BPM, list = pv.song.notes;
    while (pv.i < list.length && pv.t0 + list[pv.i].at * spb < now + 0.2) {
      const n = list[pv.i++];
      pluck(soundingMidi(n.p), pv.t0 + n.at * spb);
    }
    pv.now = list.findLast((n) => pv.t0 + n.at * spb <= now) || null; // de noot die nu klinkt
    if (now > pv.t0 + pv.song.beats * spb + 0.3) this.preview = null;
  }

  key(e) {
    if (e.code === 'Enter' && !ui.kb) { this.play(); return true; }
    return false;
  }

  draw(g, VW, VH) {
    app.backdrop.draw(g, VW, VH, { dim: 0.3 });
    topBar(g, VW, 'Vrij oefenen', () => this.back(), { color: C.blue, dark: C.blueD });
    const w = Math.min(980, VW - 32), x = (VW - w) / 2, y = 84, h = VH - y - 14;
    const k = ease.out(clamp(this.t / 0.4, 0, 1));
    g.save(); g.globalAlpha = k; g.translate(0, (1 - k) * 30);
    panel(g, x, y, w, h);
    g.restore();
    freeTabs(x + 16, y + 12, 'songs');
    const known = new Set(unlockedNotes(S.journey.stage));
    const legend = [[C.blue, 'noot die je al kent'], [C.pink, 'nog niet op de reis']];
    let lx = x + w - 20;
    for (const [col, str] of legend.reverse()) {
      const tw = ui.measure(str, 13, 800);
      lx -= tw;
      text(g, str, lx, y + 34, { size: 13, weight: 800, color: C.muted, align: 'left' });
      g.beginPath(); g.arc(lx - 12, y + 34, 7, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
      lx -= 34;
    }

    // ---------- het schema ----------
    const bottomH = 150;
    const tx = x + 14, tw = w - 28, ty = y + 64;
    const cols = SONG_NOTES.length;
    const cell = clamp((tw - 300) / cols, 24, 36);
    const gx = tx + tw - 12 - cols * cell; // eerste notenkolom
    const nameW = gx - tx - 92; // naam; daarna sterren en ritme
    // kolomkoppen
    rr(g, tx, ty, tw, HEAD_H, 10); g.fillStyle = C.paper2; g.fill();
    text(g, 'Liedje', tx + 14, ty + HEAD_H / 2 + 1, { size: 14, color: C.muted, align: 'left' });
    text(g, 'ritme', gx - 30, ty + HEAD_H / 2 + 1, { size: 12, weight: 800, color: C.muted });
    SONG_NOTES.forEach((p, i) => text(g, noteName(p), gx + i * cell + cell / 2, ty + HEAD_H / 2 + 1, { size: 14, color: C.text, maxW: cell - 2 }));

    const ay = ty + HEAD_H + 4, ah = y + h - bottomH - 10 - ay;
    const rows = [];
    let cy = 0;
    for (const grp of GROUPS) {
      rows.push({ head: grp, y: cy }); cy += 30;
      for (const s of grp.songs) { rows.push({ s, y: cy }); cy += ROW_H; }
    }
    const sel = this.song;
    const st = ui.scroll('sg:list', tx, ay, tw, ah, cy + 6, (top) => {
      for (const r of rows) {
        const ry = top + r.y;
        if (r.head) {
          const grp = r.head, col = grp.rock ? C.purple : LEVEL_COLORS[grp.level];
          const name = grp.name[0].toUpperCase() + grp.name.slice(1);
          rr(g, tx + 4, ry + 6, 12, 18, 4); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
          text(g, name, tx + 24, ry + 16, { size: 15, color: C.text, align: 'left' });
          const nx = tx + 40 + ui.measure(name, 15);
          if (grp.rock) text(g, 'bekende riffs, een paar keer na elkaar · van makkelijk naar moeilijk', nx - 6, ry + 16, { size: 12, weight: 800, color: C.muted, align: 'left' });
          else for (let i = 0; i <= grp.level; i++) star(g, nx + i * 15, ry + 16, 6, true, { color: col });
          continue;
        }
        const s = r.s, on = s === sel;
        const rs = ui.region({ id: 'sg:' + s.id, x: tx, y: ry, w: tw - 10, h: ROW_H - 4, onClick: () => this.select(s), sound: 'tick' });
        const hv = ui.anim('sgh' + s.id, rs.hover || rs.focused ? 1 : 0, 16);
        rr(g, tx, ry, tw - 10, ROW_H - 4, 10);
        g.fillStyle = on ? '#fff3e2' : `rgba(255,255,255,${0.55 + hv * 0.4})`; g.fill();
        g.lineWidth = on ? 3 : 1.5; g.strokeStyle = on ? C.orange : C.paperLine; g.stroke();
        rr(g, tx + 4, ry + 6, 6, ROW_H - 16, 3); g.fillStyle = LEVEL_COLORS[s.level]; g.fill();
        text(g, s.name, tx + 18, ry + 13, { size: 15, color: on ? C.orangeD : C.text, align: 'left', maxW: nameW - 22 });
        text(g, s.from, tx + 18, ry + 28, { size: 11, weight: 800, color: C.muted, align: 'left', maxW: nameW - 22 });
        const best = S.songs[s.id] || 0;
        for (let i = 0; i < 3; i++) star(g, tx + nameW + i * 15, ry + ROW_H / 2 - 2, 6, i < songStars(best));
        // ritme: hoe snel moet de lama springen?
        rhythmMark(g, gx - 30, ry + ROW_H / 2 - 2, s.minDur);
        SONG_NOTES.forEach((p, i) => {
          const cx = gx + i * cell + cell / 2, cyy = ry + ROW_H / 2 - 2;
          if (s.used.includes(p)) {
            g.beginPath(); g.arc(cx, cyy, Math.min(9, cell * 0.3), 0, Math.PI * 2);
            g.fillStyle = known.has(p) ? C.blue : C.pink; g.fill(); g.lineWidth = 2; g.strokeStyle = C.ink; g.stroke();
          } else {
            g.beginPath(); g.arc(cx, cyy, 2.2, 0, Math.PI * 2); g.fillStyle = 'rgba(58,35,80,.18)'; g.fill();
          }
        });
        if (rs.focused) ui.focusRing(tx, ry, tw - 10, ROW_H - 4, 10);
      }
    });
    if (this.jump && sel) { // het gekozen liedje in beeld
      const r = rows.find((q) => q.s === sel);
      st.target = st.pos = clamp(r.y - ah / 2 + ROW_H, 0, st.max);
      this.jump = false;
    }

    // ---------- het gekozen liedje ----------
    if (!sel) return;
    const by = y + h - bottomH;
    g.beginPath(); g.moveTo(x + 16, by - 4); g.lineTo(x + w - 16, by - 4); g.lineWidth = 2; g.strokeStyle = C.paperLine; g.stroke();
    const pw = 200, lw2 = 150, infoW = w - 40 - pw - lw2 - 20;
    text(g, sel.name, x + 22, by + 20, { size: 22, color: C.text, align: 'left', maxW: infoW });
    const meter = `${sel.meter}/4-maat`;
    const rhythm = sel.minDur < 0.5 ? 'heel snelle noten: de lama springt héél vlug'
      : sel.minDur < 1 ? 'korte noten: soms springt de lama dubbel zo snel' : 'rustig ritme: elke noot een tel of langer';
    text(g, `${sel.group === 'rock' ? 'rock-riff · ' : ''}${LEVELS[sel.level]} · ${sel.notes.length} noten · ${meter}`, x + 22, by + 44, { size: 14, weight: 800, color: C.muted, align: 'left', maxW: infoW });
    const pv = this.preview;
    const sub = pv?.now ? `nu: ${noteName(pv.now.p)} (${describePosition(pv.now.p)})` : rhythm;
    text(g, sub, x + 22, by + 63, { size: 14, weight: 800, color: pv ? C.blueD : C.muted, align: 'left', maxW: infoW });
    ui.button('sg:listen', x + w - 20 - pw - 12 - lw2, by + 10, lw2, 58, pv ? 'Stop' : 'Luisteren', { icon: pv ? 'pause' : 'sound', variant: 'blue', size: 19, onClick: () => this.listen(), sound: 'silent' });
    ui.button('sg:play', x + w - 20 - pw, by + 6, pw, 64, 'Spelen', { icon: 'play', primary: true, size: 28, onClick: () => this.play(), sound: 'silent' });
    const ry = by + 82, room = w - 40, lw = Math.round(room * 0.56);
    ui.choice('sg:lives', x + 20, ry, lw, 56, 'Levens', LIVES, S.settings.lives, (v) => { S.settings.lives = v; persist(); }, { labelW: 90, color: C.pink });
    ui.toggle('sg:nog', x + 30 + lw, ry, room - lw - 10, 56, 'Zonder gitaar', S.settings.noGuitar, (v) => { S.settings.noGuitar = v; persist(); }, { sub: 'tik de juiste noot aan' });
  }
}

// Ritme in het schema: één noot (rustig), een achtste (dubbel zo snel) of een zestiende (vier keer zo snel).
function rhythmMark(g, cx, cy, minDur) {
  const col = minDur < 0.5 ? C.pinkD : minDur < 1 ? C.orangeD : C.muted;
  const flags = minDur < 0.5 ? 2 : minDur < 1 ? 1 : 0;
  g.save();
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.ellipse(cx - 3, cy + 6, 5, 3.6, -0.35, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(cx + 1.5, cy + 5); g.lineTo(cx + 1.5, cy - 10); g.stroke();
  for (let i = 0; i < flags; i++) { g.beginPath(); g.moveTo(cx + 1.5, cy - 10 + i * 5); g.quadraticCurveTo(cx + 9, cy - 5 + i * 5, cx + 7, cy + 1 + i * 5); g.stroke(); }
  g.restore();
}
