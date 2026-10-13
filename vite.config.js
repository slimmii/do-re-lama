import { defineConfig } from 'vite';
import { appendFile, mkdir } from 'node:fs/promises';

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

// De beelden en het lettertype staan in public/: de code laadt ze bij naam (img/lama/...), dus ze moeten ongewijzigd mee.
export default defineConfig({
  plugins: [devlogPlugin()],
  server: { port: 8770 },
  preview: { port: 8770 },
});
