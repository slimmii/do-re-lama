// Spelletjesmenu van de lama (over de boomhut heen). Een nieuw minispel = een regel in LAMA_GAMES.
import { ui } from '../ui.js';
import { C, title, text } from '../draw.js';
import { app } from '../app.js';
import { S } from '../store.js';
import { happiness, isSad } from '../tuning.js';
import { card, dimScreen } from './common.js';

export const LAMA_GAMES = [
  { id: 'tune', name: 'Gitaar stemmen', sub: 'maak de lama blij', icon: 'note', variant: 'pink', key: 'KeyS',
    open: () => app.scenes.tune(), badge: () => (isSad(happiness(S.tune)) ? '!' : null) },
];

export class GamesScene {
  constructor() { this.overlay = true; }

  back() { app.engine.pop(this); }
  start(game) { app.engine.pop(this); app.engine.push(game.open()); }

  key(e) {
    if (e.code === 'Escape') { ui.sound('back'); this.back(); return true; }
    const game = LAMA_GAMES.find((x) => x.key === e.code);
    if (game) { this.start(game); return true; }
    return false;
  }

  draw(g, VW, VH) {
    dimScreen(g, VW, VH, Math.min(0.55, this.t * 3));
    const w = 420, h = 150 + LAMA_GAMES.length * 76 + 50;
    card(g, VW, VH, w, h, this.t, (x, y) => {
      title(g, 'Spelen', VW / 2, y + 44, 40, C.pink);
      const bx = x + 40, bw = w - 80;
      let by = y + 88;
      for (const game of LAMA_GAMES) {
        ui.button('gm:' + game.id, bx, by, bw, 64, game.name, { icon: game.icon, variant: game.variant, sub: game.sub, sound: 'open',
          badge: game.badge?.(), onClick: () => this.start(game) });
        by += 76;
      }
      text(g, 'Binnenkort meer spelletjes met de lama!', VW / 2, by + 10, { size: 15, weight: 800, color: C.muted });
      ui.button('gm:back', bx, by + 36, bw, 48, 'Terug', { icon: 'back', variant: 'paper', size: 18, sound: 'back', onClick: () => this.back() });
    });
  }
}
