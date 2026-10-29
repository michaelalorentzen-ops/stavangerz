// Lager dist/artifact.html fra dist/index.html: en Claude-artifact får sitt eget
// <html>/<head>/<body>-skjelett, så vi sender bare innholdet.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync('dist/artifact.html', `${head.trim()}\n${body.trim()}\n`);
console.log(`dist/artifact.html ${Math.round((head.length + body.length) / 1024)} KB`);
