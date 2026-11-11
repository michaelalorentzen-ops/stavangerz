/**
 * Plays the region game headless from every start area, for balance checks and for QA.
 *   pnpm region:bot [days=90] [seeds=3]
 * Prints one line per game and a JSON summary at the end.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { botPlay, newRegionGame, score, type RegionWorld } from '../packages/gameplay/src/region/index';

const world = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const days = Number(process.argv[2] ?? 90);
const seeds = Number(process.argv[3] ?? 3);
const rows: Record<string, unknown>[] = [];
for (const start of world.starts) {
  for (let seed = 1; seed <= seeds; seed++) {
    const started = Date.now();
    const state = botPlay(world, newRegionGame(world, start.zoneId, seed * 101), days);
    const s = score(state);
    const row = { start: start.name, seed: seed * 101, ...s, ms: Date.now() - started, milestones: state.milestones.join(',') };
    rows.push(row);
    console.log(`${start.name.padEnd(42)} seed ${String(seed * 101).padStart(3)} dag ${String(s.day).padStart(3)} levende ${s.alive} soner ${String(s.zones).padStart(2)} moral ${String(s.morale).padStart(3)} mat ${String(s.food).padStart(4)} drept ${String(s.killed).padStart(4)} handler ${s.trades} ${s.gameOver ?? ''}`);
  }
}
const survived = rows.filter(r => !r.gameOver).length;
console.log(JSON.stringify({ games: rows.length, survived, averageZones: +(rows.reduce((n, r) => n + Number(r.zones), 0) / rows.length).toFixed(1) }));
