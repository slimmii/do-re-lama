import { defineConfig } from 'vite';

// De beelden en het lettertype staan in public/: de code laadt ze bij naam (img/lama/...), dus ze moeten ongewijzigd mee.
export default defineConfig({
  server: { port: 8770 },
  preview: { port: 8770 },
});
