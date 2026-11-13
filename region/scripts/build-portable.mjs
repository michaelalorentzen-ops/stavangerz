import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
// tsx already pins esbuild in this workspace; do not download a second toolchain.
const toolRequire = createRequire(require.resolve('tsx/package.json'));
const { build } = toolRequire('esbuild');
const review = process.argv.includes('--editor-review');
const editor = review || process.argv.includes('--editor');
const result = await build({
  absWorkingDir: project,
  entryPoints: [review ? 'apps/game-client/editor-review-portable.tsx' : editor ? 'apps/game-client/editor-portable.tsx' : 'apps/game-client/portable.tsx'],
  outfile: 'dist/portable.js',
  bundle: true,
  write: false,
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
  jsx: 'automatic',
  loader: { '.webp': 'dataurl' },
  minify: true,
  charset: 'utf8',
  legalComments: 'inline',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const javascript = result.outputFiles.find(file => file.path.endsWith('.js'));
const stylesheet = result.outputFiles.find(file => file.path.endsWith('.css'));
if (!javascript || !stylesheet) throw new Error('Standalone-bygg mangler JavaScript eller CSS.');
const escapeScript = text => text.replace(/<\/script/gi, '<\\/script').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const html = `<!doctype html>
<html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Stavanger Z – fase 1. Fire overlevende, ekte geografi og én dag av gangen.">
<title>Stavanger Z · ${editor ? 'World Editor' : 'Dag 0'}</title>
<style>${stylesheet.text.replace(/<\/style/gi, '<\\/style')}</style></head>
<body><div id="root"></div><noscript>Aktiver JavaScript for å spille Stavanger Z.</noscript>
<script>${escapeScript(javascript.text)}</script></body></html>
`;
export const portableTarget = resolve(project, review ? 'dist/stavanger-z-world-editor-41-review.html' : editor ? 'dist/stavanger-z-world-editor.html' : 'dist/stavanger-z-phase1.html');
await mkdir(dirname(portableTarget), { recursive: true });
await writeFile(portableTarget, html, 'utf8');
console.log(`Standalone ready: ${portableTarget} (${Math.round(Buffer.byteLength(html) / 1024)} KiB). No server or network resources required.`);
