#!/usr/bin/env node
// Leest een logboek van het spel (logs/<sessie>.jsonl, zie js/devlog.js) en zet het leesbaar onder elkaar:
// per aanslag wat de detector hoorde, welke noot eruit kwam en wat het spel ermee deed; daartussen de
// oordelen (ook 'te laat' zonder dat er iets gehoord werd), je notities en de instellingen.
//   node tools/logboek.mjs                 het nieuwste logboek
//   node tools/logboek.mjs logs/x.jsonl    een bepaald logboek (ook een gedownload bestand)
//   node tools/logboek.mjs --kort          enkel de oordelen, notities en de samenvatting
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { solfegeMidi } from '../js/notes.js';

const args = process.argv.slice(2);
const kort = args.includes('--kort');
let file = args.find((a) => !a.startsWith('--'));
if (!file) {
  const dir = 'logs';
  const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!files.length) { console.error('Geen logboeken in logs/. Speel eerst met npm run dev.'); process.exit(1); }
  file = files[0];
}
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

const nm = (m) => (m == null ? '–' : typeof m === 'string' ? m : `${solfegeMidi(m)}(${m})`);
const nms = (a) => (a?.length ? a.map(nm).join(' ') : '–');
const tt = (t) => (t == null ? '        ' : t.toFixed(2).padStart(8));

// detector + noot + spel over dezelfde aanslag (zelfde audiotijd) worden één regel
const out = [];
const groups = new Map();
for (const l of lines) {
  if (['detector', 'noot', 'spel'].includes(l.type)) {
    const key = (l.t ?? l.time).toFixed(3);
    let g = groups.get(key);
    if (!g) { g = { t: l.t ?? l.time, at: l.at }; groups.set(key, g); out.push({ type: 'aanslag', g }); }
    g[l.type] = l;
  } else out.push(l);
}

const teller = {}; // noot -> {raak, fout, laat}
const fouten = [];
let geen = 0, aanslagen = 0;
console.log(`Logboek ${file}: ${lines.length} regels, ${lines[0]?.at} – ${lines.at(-1)?.at}\n`);
for (const l of out) {
  switch (l.type) {
    case 'sessie': console.log(`[${l.at}] sessie: ${l.url}  ${l.browser}`); break;
    case 'microfoon': console.log(`[${l.at}] microfoon: ${l.naam || '?'}, ${l.sampleRate} Hz, gevoeligheid ${l.sens}, vertraging ${Math.round(l.latency * 1000)} ms, echo-onderdrukking ${l.echo ? 'aan' : 'uit'}, enkel spelnoten ${l.enkelSpelnoten ? 'ja' : 'nee'}${l.stemmen ? ', stemmodus' : ''}`); break;
    case 'start': console.log(`\n[${l.at}] START ${l.spelvorm}${l.landschap != null ? ` (landschap ${l.landschap})` : ''}: noten ${l.noten.join(' ')}, ${l.bpm} per minuut, balk ${l.balk} tel, levens ${l.levens || '∞'}${l.toetsenbord ? ', toetsenbord' : ''}${l.zonderGitaar ? ', zonder gitaar' : ''}`); break;
    case 'notitie': console.log(`\n[${l.at}] ======== NOTITIE: ${l.tekst} ========\n`); break;
    case 'verwacht': if (!kort) console.log(`${tt(l.t)}  verwacht nu: ${nms(l.midis)}`); break;
    case 'niveau': if (!kort) console.log(`${tt(l.t)}  (geluid: niveau ${l.max}${l.midi != null ? `, toon ${nm(l.midi)}` : ''})`); break;
    case 'oordeel': {
      const k = (teller[l.noot] ||= { raak: 0, fout: 0, laat: 0 });
      if (l.juist) k.raak++; else if (l.uitslag === 'wrong') { k.fout++; fouten.push(l); } else k.laat++;
      const wat = l.juist ? `RAAK ${nm(l.midi)}` : `MIS ${nm(l.midi)}: ${l.tekst}`;
      console.log(`${tt(l.t)}  >> ${wat}${l.soort === 'coin' ? ' (munt)' : ''}${l.poort ? ' (poortwachter)' : ''}`);
      break;
    }
    case 'aanslag': {
      if (kort) break;
      const { g } = l, d = g.detector, n = g.noot, s = g.spel;
      aanslagen++;
      let txt;
      if (d && (d.m === 'GEEN' || d.m === 'GEEN TOON')) {
        geen++;
        txt = `aanslag → ${d.m}  (yin ${nm(d.y)}×${d.strict}, stemmen ${nms(d.votes)}, best ${nm(d.best)}${d.foreign != null ? `, vreemde toon ${nm(d.foreign)}` : ''}${d.strength ? `, kracht ${d.strength}` : ''}; verwacht ${nms(d.exp)})`;
      } else if (d) {
        txt = `aanslag → ${nm(d.m)}${d.sub != null ? ` (yin zei ${nm(d.sub)}: ondertoon)` : ''}${d.hit != null ? ` [via verwacht ${nm(d.hit)}]` : ''}  yin ${nm(d.y)}×${d.strict} best ${nm(d.best)} nieuw ${d.fy ?? '–'}/${d.fb ?? '–'}${d.ch ? ` keuze ${d.ch}` : ''}; verwacht ${nms(d.exp)}`;
      } else if (n) {
        txt = `${n.attack === false ? 'toonwissel zonder aanslag' : 'noot'} → ${nm(n.midi)}${n.fresh != null ? ` nieuw ${n.fresh}` : ''}`;
      } else txt = 'noot (toetsenbord/tik)';
      if (n && d) txt += `  nieuw=${n.fresh ?? '–'} kracht=${n.strength?.toFixed?.(1) ?? n.strength}`;
      if (s) txt += `  | spel: ${s.oordeel.toUpperCase()} (wil ${nm(s.wil)} voor ${s.noot}${s.soort === 'coin' ? ' munt' : ''}, ${s.px}px)`;
      else if (n) txt += '  | spel: (niet gebruikt: geen spel bezig of geen noot aan de beurt)';
      console.log(`${tt(g.t)}  ${txt}`);
      break;
    }
    default: console.log(`${tt(l.t)}  ${l.type}: ${JSON.stringify(l)}`);
  }
}

console.log('\n---- samenvatting ----');
for (const [p, k] of Object.entries(teller)) console.log(`${p.padEnd(4)} raak ${k.raak}  fout ${k.fout}  te laat/gemist ${k.laat}`);
if (!kort) console.log(`aanslagen ${aanslagen}, waarvan zonder noot ${geen}`);
if (fouten.length) console.log('fout gespeeld: ' + fouten.map((f) => `${f.noot}→${f.gespeeld}`).join(', '));
