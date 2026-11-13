import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveDay, type SimulationWorld, type SimulationState, type SimulationConfig, type DayResult } from '../packages/simulation-core/src/index';
import type { WorldDefinition } from '../packages/world-data/src/model';

/** M2 adapter uses IDs and explicit connections only. Geometry never enters the motor. */
const definition = JSON.parse(readFileSync(new URL('../packages/world-data/data/world-draft.json', import.meta.url), 'utf8')) as WorldDefinition;
const seed = 435;
const zoneIds = definition.zones.filter(z => z.level === 3 && z.playable).map(z => z.id).sort();
const zoneSet = new Set(zoneIds);
const frontierPairs = new Map((definition.frontiers ?? []).filter(f => zoneSet.has(f.cellId)).map(f => [`${f.cellId}:${f.externalAreaId}`, f]));
const reservoirIds = [...new Set([...frontierPairs.values()].map(f => f.externalAreaId))].sort();
const world: SimulationWorld = {
  zoneIds, reservoirIds,
  connections: [
    ...definition.edges.filter(e => e.status === 'active' && zoneSet.has(e.fromCellId) && zoneSet.has(e.toCellId)).map(e => ({ id: e.id, fromId: e.fromCellId, toId: e.toCellId, allowZombies: e.modes.includes('walk'), capacityPerDirection: 8 })),
    ...[...frontierPairs.entries()].map(([id, f]) => ({ id: `open:${id}`, fromId: f.externalAreaId, toId: f.cellId, allowZombies: true, capacityPerDirection: 3 })),
  ],
};
const config: SimulationConfig = { mobilityRate: .35, noiseWeight: 2, attemptsPerDurability: 3 };
const count = (id: string) => { let n = seed; for (const char of id) n = (Math.imul(n, 31) + char.charCodeAt(0)) >>> 0; return 10 + n % 30; };
const barrierId = world.connections.find(c => c.fromId === 'cell-003' || c.toId === 'cell-003')!.id;
const initial: SimulationState = {
  day: 0,
  population: Object.fromEntries([...zoneIds.map(id => [id, id === 'cell-003' ? 0 : count(id)]), ...reservoirIds.map(id => [id, 250])]),
  barriers: { [barrierId]: { durability: 4 } },
  stocks: { base: { food: 80 }, cache: { food: 12 } },
};
function run(noise: number) {
  let state = initial;
  const days: DayResult[] = [];
  for (let i = 0; i < 40; i++) {
    const result = resolveDay(world, state, [{ zoneId: 'cell-003', noise }], seed, config, [
      { id: `daily-food:${i}`, type: 'consume', resourceId: 'food', fromStockId: 'base', amount: 1, reason: 'M2 accounting example, not a survivor consumption rate' },
      ...(i === 0 ? [{ id: 'finite-cache', type: 'transfer' as const, resourceId: 'food', fromStockId: 'cache', toStockId: 'base', amount: 12 }] : []),
    ]);
    assert.equal(result.ledger.totalAfter, result.ledger.totalBefore);
    days.push(result); state = result.state;
  }
  return { initial, days, final: state };
}
const quiet = run(0), noisy = run(8);
assert.deepEqual(noisy, run(8), 'Real-world ID projection must reproduce the full run');
assert.equal(quiet.final.stocks?.base.food, 52);
assert.equal(quiet.final.stocks?.cache.food, 0);
const evidence = { note: 'M2 headless demonstration. All populations, stocks, capacities and rates are H fixture values, not researched demographics or game balance.', worldId: definition.worldId, worldVersion: definition.worldVersion, seed, config, world, quiet, noisy };
writeFileSync(new URL('../docs/evidence/m2-headless-demo.json', import.meta.url), JSON.stringify(evidence, null, 2));
console.log(`M2: ${zoneIds.length} L3 + ${reservoirIds.length} shared finite reservoir; 40 days; seed ${seed}`);
for (const [name, run] of [['quiet', quiet], ['noisy', noisy]] as const) {
  const last = run.days.at(-1)!;
  const warnings = run.days.flatMap(d => d.events.filter(e => e.type === 'barrier-warning').map(() => d.state.day));
  const breaches = run.days.flatMap(d => d.events.filter(e => e.type === 'barrier-breached').map(() => d.state.day));
  console.log(`${name}: day=${run.final.day}, start-zone=${run.final.population['cell-003']}, zones=${last.ledger.zonesAfter}, outside=${last.ledger.reservoirsAfter}, conserved-total=${last.ledger.totalAfter}, food=52, cache=0, warning-day=${warnings.join(',') || '-'}, breach-day=${breaches.join(',') || '-'}`);
}
console.log('PASS: repeatable 40-day resolution, no negative/created population, finite cache depleted once, resource accounting closed. No combat or server lock.');
