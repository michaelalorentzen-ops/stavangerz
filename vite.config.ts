import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Hele spillet bygges til én HTML-fil, så den kan åpnes lokalt, hostes statisk
// eller publiseres som artifact uten ekstra filer.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  test: { include: ['tests/**/*.test.ts'] },
});
