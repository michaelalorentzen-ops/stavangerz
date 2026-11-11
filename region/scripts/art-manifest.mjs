// Lists the pictures in apps/game-client/public/art so the game knows which exist (and asks for no others).
//   pnpm art:manifest
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'apps/game-client/public/art';
mkdirSync(root, { recursive: true });
const files = [];
const walk = dir => { for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (/\.(webp|jpg|png)$/i.test(name)) files.push(relative(root, p).replace(/\\/g, '/')); } };
walk(root);
writeFileSync(join(root, 'manifest.json'), JSON.stringify(files.sort(), null, 1) + '\n');
console.log(`${files.length} pictures in ${root}/manifest.json`);
