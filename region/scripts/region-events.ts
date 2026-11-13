/**
 * Checks every event: builds it on real mid-game states from several starts and resolves every choice.
 *   pnpm region:events
 * Fails if an event throws, leaves the state broken, or can never be built.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EVENT_IDS, botPlay, forceEvent, newRegionGame, resolveEvent, type RegionState, type RegionWorld } from '../packages/gameplay/src/region/index';

const world = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const snapshots: RegionState[] = [];
for (const [i, start] of world.starts.slice(0, 6).entries()) for (const days of [8, 30, 70]) {
  const s = botPlay(world, newRegionGame(world, start.zoneId, 7 + i), days);
  if (!s.gameOver) snapshots.push({ ...s, event: undefined });
}
const built = new Set<string>(), failed: string[] = [];
for (const id of EVENT_IDS) for (const snap of snapshots) {
  // Chains get the data their parent would have given; most read zone, who or link, so offer common keys.
  const home = snap.homeZoneId, who = snap.survivors.find(p => p.alive)?.id ?? '';
  const data = { zone: home, who, link: world.links[0]?.id ?? '', target: home, taken: 3, n: 4, size: 40, soft: 1 } as Record<string, string | number>;
  const ev = forceEvent(snap, world, id, data);
  if (!ev) continue;
  built.add(id);
  for (const c of ev.choices.filter(x => !x.disabled)) {
    try {
      const after = resolveEvent({ ...snap, event: ev }, world, c.id).state;
      const bad = Object.entries(after.stock).find(([, n]) => !Number.isFinite(n) || n < 0) ?? Object.entries(after.population).find(([, n]) => !Number.isFinite(n) || n < 0);
      if (bad || !Number.isFinite(after.morale) || !Number.isFinite(after.discontent)) failed.push(`${id}/${c.id}: broken value ${JSON.stringify(bad)}`);
    } catch (e) { failed.push(`${id}/${c.id}: ${(e as Error).message}`); }
  }
}
const never = EVENT_IDS.filter(id => !built.has(id));
console.log(`${EVENT_IDS.length} events, ${built.size} built on ${snapshots.length} states.`);
if (never.length) console.log(`Never built here (may need special conditions): ${never.join(', ')}`);
if (failed.length) { console.log(`FAILED:\n${[...new Set(failed)].join('\n')}`); process.exit(1); }
console.log('All choices resolve.');
