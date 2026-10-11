// Lama Reis: opstarten. Laadt alles, maakt de motor en de scènes.
import { Engine, toggleFullscreen } from './engine.js';
import { ui } from './ui.js';
import { app } from './app.js';
import { sfx } from './audio.js';
import { S } from './store.js';
import { loadLlama } from './lama-style.js';
import { preloadWorld } from './lama-world.js';
import { Backdrop } from './backdrop.js';
import { BootScene } from './scenes/boot.js';
import { TitleScene } from './scenes/title.js';
import { JourneyScene } from './scenes/journey.js';
import { FreeScene } from './scenes/free.js';
import { PlayScene } from './scenes/play.js';
import { PauseScene } from './scenes/pause.js';
import { SettingsScene } from './scenes/settings.js';
import { ShopScene } from './scenes/shop.js';
import { RunnerScene } from './scenes/runner.js';

const engine = new Engine(document.getElementById('game'));
app.engine = engine;
app.scenes = {
  title: () => new TitleScene(),
  journey: () => new JourneyScene(),
  free: () => new FreeScene(),
  play: (o) => new PlayScene(o),
  pause: (o) => new PauseScene(o),
  settings: (o) => new SettingsScene(o),
  shop: () => new ShopScene(),
  runner: () => new RunnerScene(),
};
ui.onSound = (name) => { if (name !== 'silent') sfx(name); };

// F = volledig scherm (overal, behalve waar een scène de toets zelf gebruikt)
engine.keyHandlers.push((e) => { if (e.code === 'KeyF') { toggleFullscreen(); return true; } return false; });

async function load(progress) {
  let done = 0;
  const total = 11;
  const step = () => progress(++done / total);
  await Promise.all([
    document.fonts.load('900 20px Nunito').then(step, step),
    loadLlama().then((A) => { app.A = A; step(); }),
    preloadWorld(() => step()),
  ]);
  app.backdrop = new Backdrop(app.A);
  await app.backdrop.ready;
  progress(1);
}

engine.go(new BootScene(load));
engine.start();

// Testhaakje (console): window.__lama.app.engine.top()
window.__lama = { app, ui, S };
