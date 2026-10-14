// Do Re Lama: opstarten. Laadt alles, maakt de motor en de scènes.
import { Engine, toggleFullscreen } from './engine.js';
import { ui } from './ui.js';
import { app } from './app.js';
import { sfx } from './audio.js';
import { S } from './store.js';
import { loadLlama } from './lama-style.js';
import { preloadWorld } from './lama-world.js';
import { Backdrop } from './backdrop.js';
import { loadHouse } from './treehouse.js';
import { BootScene } from './scenes/boot.js';
import { TitleScene } from './scenes/title.js';
import { JourneyScene } from './scenes/journey.js';
import { FreeScene } from './scenes/free.js';
import { SongsScene } from './scenes/songs.js';
import { PlayScene } from './scenes/play.js';
import { PauseScene } from './scenes/pause.js';
import { SettingsScene } from './scenes/settings.js';
import { ShopScene } from './scenes/shop.js';
import { TreehouseScene } from './scenes/treehouse.js';
import { TuneScene } from './scenes/tune.js';
import { GamesScene } from './scenes/games.js';
import { CatchScene } from './scenes/catch.js';
import { installDev } from './dev.js';

const engine = new Engine(document.getElementById('game'));
app.engine = engine;
app.scenes = {
  title: () => new TitleScene(),
  journey: () => new JourneyScene(),
  free: () => new FreeScene(),
  songs: () => new SongsScene(),
  play: (o) => new PlayScene(o),
  pause: (o) => new PauseScene(o),
  settings: (o) => new SettingsScene(o),
  shop: (o) => new ShopScene(o),
  treehouse: () => new TreehouseScene(),
  tune: () => new TuneScene(),
  games: () => new GamesScene(),
  catch: () => new CatchScene(),
};
ui.onSound = (name) => { if (name !== 'silent') sfx(name); };

// F = volledig scherm (overal, behalve waar een scène de toets zelf gebruikt)
engine.keyHandlers.push((e) => { if (e.code === 'KeyF') { toggleFullscreen(); return true; } return false; });

async function load(progress) {
  let done = 0;
  const total = 12;
  const step = () => progress(++done / total);
  await Promise.all([
    document.fonts.load('900 20px Nunito').then(step, step),
    loadLlama().then((A) => { app.A = A; step(); }),
    preloadWorld(() => step()),
    loadHouse().then(step, step),
  ]);
  app.backdrop = new Backdrop(app.A);
  await app.backdrop.ready;
  progress(1);
}

engine.go(new BootScene(load));
engine.start();

// Testhaakje (console): window.__lama.app.engine.top()
window.__lama = { app, ui, S };
installDev(); // dev.hulp() in de console
