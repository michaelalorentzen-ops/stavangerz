import assert from 'node:assert/strict';
import { resolveDay } from '../packages/simulation-core/src/index';
import { syntheticConfig as config, syntheticState as initial, syntheticWorld as world } from '../packages/simulation-core/src/synthetic';
import { replayDays, type ReplayTurn } from '../packages/simulation-core/src/replay';
import type { ResourceOrder } from '../packages/simulation-core/src/index';

const seed = 435;
const orders = [{ zoneId: 'start', noise: 4 }, { zoneId: 'supplies', noise: 1 }];
const before = JSON.stringify(initial);
const first = resolveDay(world, initial, orders, seed, config);
assert.deepEqual(first, resolveDay(world, initial, orders, seed, config));
assert.deepEqual(first, resolveDay({ ...world, zoneIds: [...world.zoneIds].reverse(), connections: [...world.connections].reverse(), reservoirIds: [...world.reservoirIds].reverse() }, initial, [...orders].reverse(), seed, config));
assert.equal(JSON.stringify(initial), before);
let state = initial;
let previousWarning = false;
const rows: string[] = [];
for (let i = 0; i < 10; i++) {
  const result = resolveDay(world, state, orders, seed, config);
  assert.equal(result.state.day, state.day + 1);
  assert.equal(result.ledger.totalAfter, 90);
  assert.equal(result.ledger.zonesAfter, result.ledger.zonesBefore + result.ledger.immigration - result.ledger.emigration);
  assert.ok(Object.values(result.state.population).every(n => Number.isSafeInteger(n) && n >= 0));
  assert.ok(!result.movements.some(m => m.connectionId === 'quay-supplies-water'));
  if (result.events.some(e => e.type === 'barrier-breached')) assert.ok(previousWarning, 'Breach must follow a prior warning day');
  if (result.events.some(e => e.type === 'barrier-warning')) previousWarning = true;
  rows.push(`day=${result.state.day} zones=${result.ledger.zonesAfter} outside=${result.ledger.reservoirsAfter} import=${result.ledger.immigration} export=${result.ledger.emigration} barrier=${result.state.barriers['start-crossroads'].durability} events=${result.events.map(e => e.type).join(',') || '-'}`);
  state = result.state;
}
// New arrivals cannot move onward within the same resolution.
const chain = { zoneIds: ['a', 'b', 'c'], reservoirIds: [], connections: [
  { id: 'ab', fromId: 'a', toId: 'b', allowZombies: true, capacityPerDirection: 100 },
  { id: 'bc', fromId: 'b', toId: 'c', allowZombies: true, capacityPerDirection: 100 },
] };
assert.equal(resolveDay(chain, { day: 0, population: { a: 100, b: 0, c: 0 }, barriers: {} }, [], seed, { ...config, mobilityRate: 1 }).state.population.c, 0);
const singletonWorld = { zoneIds: ['a', 'b'], reservoirIds: [], connections: [chain.connections[0]] };
const singletonState = { day: 0, population: { a: 1, b: 0 }, barriers: {} };
assert.ok(Array.from({ length: 16 }, (_, daySeed) => resolveDay(singletonWorld, singletonState, [], daySeed, config))
  .some(result => result.state.population.b === 1), 'A singleton must be able to migrate at fractional mobility');
assert.ok(previousWarning, 'Synthetic run must exercise barrier warning');
assert.ok(state.population['outside-north'] < initial.population['outside-north'], 'External pressure must debit a finite reservoir');
const resourcePlan: ResourceOrder[] = [
  { id: 'supply', type: 'transfer', fromStockId: 'finite-cache', toStockId: 'base', resourceId: 'food', amount: 20 },
  { id: 'meal', type: 'consume', fromStockId: 'base', resourceId: 'food', amount: 2, reason: 'synthetic daily sink' },
];
const resourceResult = resolveDay(world, initial, orders, seed, config, resourcePlan);
assert.deepEqual(resourceResult, resolveDay(world, initial, [...orders].reverse(), seed, config, [...resourcePlan].reverse()));
assert.deepEqual(resourceResult.resourceLedger.food, { before: 130, transferred: 20, consumed: 2, after: 128 });
assert.equal(JSON.stringify(initial), before, 'Resource resolution cannot mutate opening stocks');
const overspend: ResourceOrder[] = [
  { id: 'first', type: 'consume', fromStockId: 'base', resourceId: 'food', amount: 70, reason: 'test' },
  { id: 'second', type: 'consume', fromStockId: 'base', resourceId: 'food', amount: 70, reason: 'test' },
];
assert.throws(() => resolveDay(world, initial, orders, seed, config, overspend), /Insufficient opening stock/);
assert.throws(() => resolveDay(world, initial, orders, seed, config, [resourcePlan[0], resourcePlan[0]]), /Duplicate resource order/);
assert.throws(() => resolveDay(world, { ...initial, stocks: { base: { food: 0 }, 'finite-cache': { food: 30 } } }, orders, seed, config, resourcePlan), /Insufficient opening stock/, 'Arrivals cannot pay another order on the same day');
const turns: ReplayTurn[] = Array.from({ length: 40 }, (_, i) => ({
  daySeed: seed, noiseOrders: orders,
  resourceOrders: [
    { id: `meal-${i}`, type: 'consume' as const, fromStockId: 'base', resourceId: 'food', amount: 2, reason: 'synthetic daily sink' },
    ...(i === 0 || i === 4 ? [{ id: `cache-${i}`, type: 'transfer' as const, fromStockId: 'finite-cache', toStockId: 'base', resourceId: 'food', amount: i === 0 ? 20 : 10 }] : []),
  ],
}));
const replay = replayDays(world, initial, turns, config);
assert.deepEqual(replay, replayDays(world, initial, turns, config));
assert.equal(replay.state.day, 40);
assert.equal(replay.state.stocks?.['finite-cache'].food, 0, 'Finite cache is emptied, never replenished');
assert.equal(replay.days.at(-1)?.resourceLedger.food.after, 50);
for (const day of replay.days) {
  assert.equal(day.ledger.totalAfter, 90);
  for (const entry of Object.values(day.resourceLedger)) assert.equal(entry.after, entry.before - entry.consumed);
}
const secondSeed = replayDays(world, initial, turns.map(turn => ({ ...turn, daySeed: 436 })), config);
assert.equal(secondSeed.days.at(-1)?.ledger.totalAfter, 90);
console.log('M2 synthetic seed=435; H values, no combat/economy/server turn lock');
console.log(rows.join('\n'));
console.log('PASS: deterministic/order-independent, input unchanged, conserved finite population, no same-day multihop, warning before breach');
console.log(`PASS: 40-day deterministic replay, second seed conserved; food 130 -> 50, finite cache empty, duplicate/overspend/same-day-arrival spend rejected; rules=${replay.days[0].report.rulesVersion}`);
