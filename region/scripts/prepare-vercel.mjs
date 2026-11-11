import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build a separate candidate directory for the self-contained phase 1 game.
import { portableTarget } from './build-portable.mjs';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(project, 'dist/vercel-phase1');
await mkdir(target, { recursive: true });
await copyFile(portableTarget, resolve(target, 'index.html'));
await writeFile(resolve(target, 'vercel.json'), JSON.stringify({
  version: 2, framework: null, buildCommand: '', installCommand: '',
  headers: [{ source: '/', headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }] }],
}, null, 2) + '\n');
console.log(`Vercel static release prepared: ${target}`);
