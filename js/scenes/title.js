// Titelscherm: logo, de lama wandelt door de bereikte landschappen, en het hoofdmenu.
import { ui } from '../ui.js';
import { text, clamp, ease } from '../draw.js';
import { app } from '../app.js';
import { S, TEST, persist } from '../store.js';
import { drawLogo } from './logo.js';
import { walletPills, fullscreenButton } from './common.js';
import { STAGES } from '../lama-journey.js';
import { solfegeOf } from '../notes.js';
import { songById } from '../songs.js';

let vig = null;
function vignette() {
  if (vig) return vig;
  vig = document.createElement('canvas');
  vig.width = 96; vig.height = 54;
  const o = vig.getContext('2d');
  const vg = o.createRadialGradient(48, 27, 10, 48, 27, 70);
  vg.addColorStop(0, 'rgba(29,16,48,0)'); vg.addColorStop(1, 'rgba(29,16,48,.38)');
  o.fillStyle = vg; o.fillRect(0, 0, 96, 54);
  return vig;
}

export class TitleScene {
  enter() {
    app.backdrop.wander();
  }

  update(dt) {
    app.backdrop.update(dt);
  }

  draw(g, VW, VH) {
    const t = this.t;
    app.backdrop.draw(g, VW, VH);
    // zachte vignet zodat het menu leesbaar blijft (klein vooraf getekend en uitgerekt: goedkoop)
    g.drawImage(vignette(), 0, 0, VW, VH);

    const k = (d) => ease.out(clamp((t - d) / 0.45, 0, 1));
    const top = Math.max(0, (VH - 540) * 0.35);
    g.save();
    g.globalAlpha = k(0);
    drawLogo(g, VW / 2, top + 96 - (1 - k(0)) * 30, 0.92, t);
    g.restore();

    const j = S.journey;
    const bw = 340, x = (VW - bw) / 2;
    let y = top + 200;
    const anim = (i, fn) => {
      const a = k(0.1 + i * 0.07);
      g.save(); g.globalAlpha = a; g.translate(0, (1 - a) * 24);
      fn();
      g.restore();
    };
    const next = j.stage < STAGES.length - 1 ? `Stap ${j.stage + 1} van ${STAGES.length} · ${STAGES[j.stage].name}` : 'Je kent alle noten!';
    anim(0, () => ui.button('t:reis', x, y, bw, 66, 'De reis', { icon: 'map', sub: next, primary: true, onClick: () => app.engine.go(app.scenes.journey()) }));
    y += 82;
    anim(1, () => ui.button('t:vrij', x, y, bw, 62, 'Vrij oefenen', { icon: 'target', variant: 'blue', sub: (S.settings.freeTab === 'songs' && songById(S.song) ? `Liedjes · ${songById(S.song).name}` : `Kies zelf je noten · ${S.settings.selection.map(solfegeOf).join(' ')}`).slice(0, 44), onClick: () => app.engine.go(S.settings.freeTab === 'songs' ? app.scenes.songs() : app.scenes.free()) }));
    y += 78;
    anim(2, () => ui.button('t:hut', x, y, bw, 62, 'Lama-boomhut', { icon: 'home', variant: 'green', sub: 'Uitrusten en je kamer inrichten', onClick: () => app.engine.go(app.scenes.treehouse()) }));
    y += 80;
    anim(3, () => {
      const hw = (bw - 14) / 2;
      ui.button('t:shop', x, y, hw, 54, 'Winkel', { icon: 'bag', variant: 'gold', onClick: () => app.engine.push(app.scenes.shop()), sound: 'open' });
      ui.button('t:set', x + hw + 14, y, hw, 54, 'Instellingen', { icon: 'gear', variant: 'paper', size: 20, onClick: () => app.engine.push(app.scenes.settings()), sound: 'open' });
    });

    walletPills(g, VW);
    fullscreenButton('t:full', 38, 36);
    ui.iconButton('t:snd', 92, 36, 44, S.settings.sfx ? 'sound' : 'mute', { onClick: () => { S.settings.sfx = !S.settings.sfx; persist(); } });
    text(g, TEST ? 'TESTMODUS · niets wordt bewaard' : `${__COMMIT__} · ${__BUILT__}`, VW - 16, VH - 16, { size: 14, weight: 800, color: 'rgba(255,255,255,.75)', align: 'right', stroke: 'rgba(29,16,48,.6)', strokeW: 4 });
  }
}
