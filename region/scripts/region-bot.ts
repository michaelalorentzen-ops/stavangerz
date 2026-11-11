/**
 * Plays the region game headless, for balance checks and for QA.
 *   pnpm region:bot [days=150] [seeds=3] [extraStarts=8]
 * Plays every curated start, plus some of the densest zones (where starting should be nearly hopeless).
 * Prints one line per game and a JSON summary at the end.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { botPlay, newRegionGame, residents, score, startDanger, type RegionWorld } from '../packages/gameplay/src/region/index';

const world = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const days = Number(process.argv[2] ?? 150);
const seeds = Number(process.argv[3] ?? 3);
const extra = Number(process.argv[4] ?? 8);
const dense = world.zones.filter(z => z.level === 3).sort((a, b) => residents(b) - residents(a)).filter((_, i) => i % 6 === 0).slice(0, extra)
  .map(z => ({ zoneId: z.id, name: `${z.name} (tett)` }));
const starts = [...world.starts.map(s => ({ zoneId: s.zoneId, name: s.name })), ...dense];
const rows: (ReturnType<typeof score> & { start: string; seed: number; danger: string; ms: number })[] = [];
for (const start of starts) {
  const danger = startDanger(world, start.zoneId).level;
  for (let seed = 1; seed <= seeds; seed++) {
    const started = Date.now();
    const state = botPlay(world, newRegionGame(world, start.zoneId, seed * 101), days);
    const s = score(state);
    rows.push({ start: start.name, seed: seed * 101, danger, ...s, ms: Date.now() - started });
    console.log(`${start.name.slice(0, 34).padEnd(34)} ${danger.padEnd(15)} frø ${String(seed * 101).padStart(3)} dag ${String(s.day).padStart(3)} fase ${s.phase} crew ${String(s.alive).padStart(2)} folk ${String(s.people).padStart(3)} soner ${String(s.zones).padStart(2)} håp ${String(s.hope).padStart(3)} uro ${String(s.discontent).padStart(3)} mat ${String(s.food).padStart(4)} sult ${String(s.hungry).padStart(3)} forsk ${String(s.research).padStart(2)} hend ${String(s.events).padStart(2)} ${s.won ? 'SEIER ' : ''}${s.gameOver ?? ''}`);
  }
}
const by = (f: (r: typeof rows[number]) => boolean) => rows.filter(f);
const avg = (list: typeof rows, key: 'zones' | 'people' | 'phase' | 'hungry' | 'research' | 'day') => +(list.reduce((n, r) => n + Number(r[key]), 0) / Math.max(1, list.length)).toFixed(1);
const levels = [...new Set(rows.map(r => r.danger))];
console.log(JSON.stringify({
  games: rows.length, survived: by(r => !r.gameOver || r.won).length, won: by(r => r.won).length,
  averageZones: avg(rows, 'zones'), averagePeople: avg(rows, 'people'), averagePhase: avg(rows, 'phase'), averageHungryDays: avg(rows, 'hungry'), averageResearch: avg(rows, 'research'),
  phases: Object.fromEntries([1, 2, 3, 4, 5].map(p => [p, by(r => r.phase === p).length])),
  byDanger: Object.fromEntries(levels.map(l => [l, { games: by(r => r.danger === l).length, survived: by(r => r.danger === l && (!r.gameOver || r.won)).length, phase: avg(by(r => r.danger === l), 'phase') }])),
  endings: Object.fromEntries([...new Set(rows.map(r => r.gameOver ?? 'lever'))].map(e => [e, by(r => (r.gameOver ?? 'lever') === e).length])),
}));
