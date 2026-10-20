import { defineConfig } from 'vite';
import { appendFile, mkdir, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';

// Logboek voor de ontwikkelaar (js/devlog.js): het spel stuurt tijdens `npm run dev` regels naar /__devlog en die
// komen in logs/<sessie>.jsonl terecht. Lezen: node tools/logboek.mjs
function devlogPlugin() {
  return {
    name: 'lama-devlog',
    configureServer(server) {
      server.middlewares.use('/__devlog', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          try {
            const { session, lines } = JSON.parse(body);
            const name = String(session).replace(/[^\w.-]/g, '').slice(0, 60) || 'sessie';
            if (!Array.isArray(lines)) throw new Error('lines ontbreekt');
            await mkdir('logs', { recursive: true });
            await appendFile(`logs/${name}.jsonl`, lines.map((l) => JSON.stringify(l) + '\n').join(''));
            res.statusCode = 204;
            res.end();
          } catch (e) {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
    },
  };
}

// Bouwstempel voor het titelscherm: korte commit-hash en het moment van bouwen (bij `npm run dev` is dat de start van de server).
function commitHash() {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev'; } catch { return 'dev'; }
}
function bouwTijd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Service worker (installeerbare app, ook offline): bij `npm run build` komt dist/sw.js erbij met de lijst van alle
// bestanden, zodat de app na de eerste keer volledig in de cache zit. Elke bouw is een nieuwe cache (de oude wordt opgeruimd).
function serviceWorkerPlugin() {
  return {
    name: 'lama-sw',
    apply: 'build',
    async generateBundle(_, bundle) {
      const pub = (await readdir('public', { recursive: true, withFileTypes: true }))
        .filter((d) => d.isFile() && !d.name.startsWith('.'))
        .map((d) => `${d.parentPath ?? d.path}/${d.name}`.replace(/\\/g, '/').replace(/^public\//, ''));
      const files = ['', ...Object.keys(bundle).filter((f) => !f.endsWith('.map')), ...pub].map((f) => '/' + f);
      const version = `${commitHash()}-${Date.now().toString(36)}`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(version, files) });
    },
  };
}

function swSource(version, files) {
  return `// Gemaakt door vite.config.js (lama-sw). Niet met de hand aanpassen.
const CACHE = 'do-re-lama-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('do-re-lama-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Pagina: eerst het net (dan krijg je de nieuwste versie), anders uit de cache. De rest: eerst de cache.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/', { cacheName: CACHE })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`;
}

// De beelden en het lettertype staan in public/: de code laadt ze bij naam (img/lama/...), dus ze moeten ongewijzigd mee.
export default defineConfig({
  plugins: [devlogPlugin(), serviceWorkerPlugin()],
  define: { __COMMIT__: JSON.stringify(commitHash()), __BUILT__: JSON.stringify(bouwTijd()) },
  // host: ook bereikbaar vanaf een gsm op hetzelfde wifi (zie README)
  server: { port: 8770, host: true },
  preview: { port: 8770, host: true },
});
