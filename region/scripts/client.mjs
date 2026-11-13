import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const dist = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
const target = resolve('apps/game-client/public/maplibre');
mkdirSync(target, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(resolve(dist, file), resolve(target, file));
}
copyFileSync(resolve(dist, '../LICENSE.txt'), resolve(target, 'LICENSE.txt'));
const mode = process.argv[2];
if (!['dev', 'build', 'start'].includes(mode)) throw new Error('Expected dev, build or start');
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), mode, 'apps/game-client', ...(mode === 'dev' || mode === 'start' ? ['--hostname', '127.0.0.1'] : [])], { stdio: 'inherit' });
process.exit(result.status ?? 1);
