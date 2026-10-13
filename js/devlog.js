// Logboek voor de ontwikkelaar: alles wat de microfoon hoort en wat het spel ermee doet, regel per regel (JSON).
// Bij `npm run dev` staat het vanzelf aan en schrijft de dev-server het naar logs/<sessie>.jsonl (zie vite.config.js);
// `node tools/logboek.mjs` maakt het leesbaar. Op een andere plek (bv. de online versie) zet je het aan met ?log
// in de adresbalk en haal je het achteraf op met dev.logboek() (download). Zo kan je na het spelen laten uitzoeken
// waarom een noot gemist of fout gerekend werd. dev.notitie('...') zet er een eigen regel tussen ("nu speel ik sol").
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
const MAX_LINES = 20000; // in het geheugen, voor de download

export const devlog = {
  on: import.meta.env.DEV || /[?&]log\b/.test(location.search),
  server: import.meta.env.DEV, // de dev-server bewaart de regels in logs/
  session: stamp(new Date()),
  lines: [],
  queue: [],
  timer: 0,
  get file() { return `logs/${this.session}.jsonl`; },

  // Eén regel: {at: kloktijd, type, ...data}. Tijden in de data (t, time) zijn seconden van de audioklok,
  // dezelfde klok voor de detector en het spel, zodat je de regels aan elkaar kan koppelen.
  write(type, data = {}) {
    if (!this.on) return;
    const line = { at: clock(new Date()), ...data, type }; // type laatst: de detector stuurt zelf ook een type mee (note/debug)
    this.lines.push(line);
    if (this.lines.length > MAX_LINES) this.lines.shift();
    if (!this.server) return;
    this.queue.push(line);
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 500);
  },

  flush(beacon = false) {
    clearTimeout(this.timer); this.timer = 0;
    if (!this.queue.length) return;
    const body = JSON.stringify({ session: this.session, lines: this.queue });
    this.queue = [];
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon('/__devlog', new Blob([body], { type: 'application/json' })); return; }
    fetch('/__devlog', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  },

  // Het hele logboek als bestand ophalen (voor waar er geen dev-server is).
  download() {
    const blob = new Blob(this.lines.map((l) => JSON.stringify(l) + '\n'), { type: 'application/x-ndjson' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lama-logboek-${this.session}.jsonl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return a.download;
  },
};

if (devlog.on) {
  devlog.write('sessie', { url: location.href, browser: navigator.userAgent, scherm: `${screen.width}x${screen.height}` });
  addEventListener('pagehide', () => devlog.flush(true));
}
