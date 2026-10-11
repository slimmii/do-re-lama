// Ontwikkelaarshulp in de console van Chrome (DevTools): typ dev.hulp(). Alles spoelt het gewone spel vooruit
// en volgt dezelfde regels: de poortwachter komt via ready()/checkGate(), verslaan gaat via hitBoss(), een
// landschap verder via advance(). Buiten ?test wordt alles gewoon bewaard, net als bij echt spelen.
import { app } from './app.js';
import { S, persist, TEST } from './store.js';
import { STAGES, GATE_HITS, isLastStage, accuracy, ready, advance, fastForward } from './lama-journey.js';
import { PlayScene } from './scenes/play.js';

const log = (msg) => console.log(`%c🦙 ${msg}`, 'color:#b07cff;font-weight:bold');
const play = () => app.engine.stack.find((s) => s instanceof PlayScene);

const dev = {
  hulp() {
    console.table({
      'dev.status()': 'waar je bent op de reis en hoe ver tot de poort',
      'dev.poort()': 'spoel dit landschap door: de poortwachter komt meteen (of zodra je speelt)',
      'dev.win()': 'versla de poortwachter die nu staat (alsof je zijn noot nog x keer speelt)',
      'dev.landschap(n)': 'reis door tot landschap n (0 = weide), alsof je elke poortwachter versloeg',
      'dev.munten(n)': 'n munten erbij',
    });
    if (!TEST) log('Let op: zonder ?test in de adresbalk wordt alles bewaard.');
  },

  status() {
    const j = S.journey, b = app.game?.boss;
    console.table({
      landschap: `${j.stage} (${STAGES[j.stage].name})`,
      'speelt nu': `${j.at} (${STAGES[j.at].name})`,
      'juiste noten': `${j.progress}/${GATE_HITS}`,
      'laatste pogingen juist': `${Math.round(accuracy(j.recent) * 100)}% (${j.recent.length})`,
      'klaar voor de poort': ready(j),
      poortwachter: b ? `${b.monster}: ${b.hits}/${b.need}${b.won ? ' (verslagen)' : ''}` : '-',
      munten: S.wallet.coins,
    });
  },

  poort() {
    const j = S.journey;
    if (isLastStage(j.stage)) return log('Je bent al in het laatste landschap: daar staat geen poort meer.');
    fastForward(j);
    persist();
    const p = play();
    if (!p?.journey) return log('Klaar: start een reis in je verste landschap, de poortwachter komt bij de eerste noot.');
    if (!p.atFront()) return log(`Je speelt een oud landschap; de poort staat in ${STAGES[j.stage].name}.`);
    p.checkGate();
    const b = app.game.boss;
    log(b && !b.won ? `Daar is de poortwachter van ${b.name}!` : 'Klaar: de poortwachter komt bij de volgende noot.');
  },

  win() {
    const b = app.game?.boss;
    if (!b || b.won) return log('Er staat geen poortwachter. Roep er eerst een met dev.poort().');
    while (!b.won) app.game.hitBoss();
    log(`De poortwachter van ${b.name} is verslagen.`);
  },

  landschap(n) {
    const j = S.journey;
    n = Math.max(0, Math.min(STAGES.length - 1, n | 0));
    if (play()) return log('Ga eerst terug naar het menu: het landschap wissel je niet midden in een spel.');
    while (j.stage < n) advance(j);
    j.at = n;
    persist();
    log(`Je staat nu in ${STAGES[n].name}${n < j.stage ? ` (verste: ${STAGES[j.stage].name})` : ''}.`);
  },

  munten(n = 100) {
    S.wallet.coins += n | 0;
    persist();
    log(`${S.wallet.coins} munten.`);
  },
};
dev.help = dev.hulp;

export function installDev() {
  window.dev = dev;
  log('Ontwikkelaarshulp: typ dev.hulp()');
}
