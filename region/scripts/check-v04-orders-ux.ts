/** User review: observable risk, deliberate phase gates, group effort and exact destinations. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIONS, botPlanDay, endDay, estimateKills, newRegionGame, previewOrder, searchHoursTotal, type RegionOrder, type RegionState, type RegionWorld } from '../packages/gameplay/src/region/index';
const source = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const original = source.zones.find(z => z.id === source.starts[0].zoneId)!;
const zone = (id: string) => ({ ...structuredClone(original), id, name: `Sone ${id}`, parentId: 'test-l2', measures: { ...original.measures!, homes: 20, floor: 12000 } });
const world: RegionWorld = { ...source, zones: [zone('a'), zone('b'), zone('c')], neighbours: [{ a: 'a', b: 'b', borderM: 100 }, { a: 'a', b: 'c', borderM: 100 }], links: [], pois: [], starts: [] };
function fresh(): RegionState {
  const s = newRegionGame(world, 'a', 177); s.event = undefined; s.factions = [];
  s.stock = { food: 200, water: 200, building: 200, parts: 200, metal: 200, fuel: 200, radio: 10, batteries: 20, electronics: 20 };
  for (const z of Object.values(s.zones)) { z.zombies = 0; z.status = 'scouted'; z.intel = { min: 0, max: 0, day: 0 }; }
  for (const p of s.survivors) { p.health = 100; p.fatigue = 0; p.weapon = 'melee'; p.skills.combat = 4; p.skills.craft = 4; }
  return s;
}
const order = (action: RegionOrder['action'], survivorIds = ['tor'], target?: string): RegionOrder => ({ id: `${action}-${survivorIds.length}`, action, zoneId: 'a', survivorIds, target });
for (const action of ['clear', 'search'] as const) {
  for (const observation of ['unknown', 'missing', 'known', 'old'] as const) {
    const low = fresh(), high = fresh(); high.zones.a.zombies = 999;
    if (observation === 'unknown') { low.zones.a.status = high.zones.a.status = 'unknown'; }
    if (observation === 'missing') { delete low.zones.a.intel; delete high.zones.a.intel; }
    if (observation === 'known' || observation === 'old') {
      low.zones.a.intel = high.zones.a.intel = { min: 3, max: 8, day: observation === 'old' ? -50 : 0 };
    }
    assert.deepEqual(previewOrder(low, world, order(action)), previewOrder(high, world, order(action)), `${action}: hidden population cannot affect the ${observation} preview`);
    if (observation === 'unknown' || observation === 'missing') assert.equal(previewOrder(low, world, order(action)).risk, 'Ukjent');
  }
}
assert.equal(ACTIONS.clear.label, 'Bekjemp zombier');
const gated = fresh();
for (const z of Object.values(gated.zones)) z.status = 'controlled';
for (const phase of [1, 2, 3] as const) {
  gated.phase = phase;
  const build = previewOrder(gated, world, order('build', ['tor'], 'rainwater'));
  const network = previewOrder(gated, world, order('network', ['tor'], 'roads'));
  assert.equal(build.valid, phase >= 2, build.errors.join(' '));
  assert.equal(network.valid, phase >= 3, network.errors.join(' '));
  for (const o of botPlanDay(gated, world)) {
    assert.ok(previewOrder(gated, world, o).valid, 'Bot only submits valid orders');
    if (phase === 1) assert.notEqual(o.action, 'build');
    if (phase < 3) assert.notEqual(o.action, 'network');
  }
}
const early = fresh(); early.zones.a.status = 'controlled';
assert.equal(previewOrder(early, world, order('establishHq')).valid, true, 'HQ remains available in phase 1');
assert.equal(previewOrder(early, world, order('fortify')).valid, true, 'Basic border defence remains available in phase 1');
early.hq = { zoneId: 'a', type: 'camp', modules: [] };
for (const target of ['kitchen', 'watchtower', 'housing', 'radioRoom']) assert.equal(previewOrder(early, world, order('module', ['tor'], target)).valid, true, `${target} remains available in phase 1`);
const phase1Build = endDay(early, world, [order('build', ['tor'], 'rainwater')]);
assert.equal(phase1Build.state.zones.a.building, undefined);
assert.ok(!phase1Build.state.zones.a.upgrades.includes('rainwater'), 'The resolver enforces the phase gate');
const ids = ['tor', 'leila', 'marius'];
const effort = fresh();
const searchOne = previewOrder(effort, world, order('search'));
const searchThree = previewOrder(effort, world, order('search', ids));
assert.ok(searchThree.hours > searchOne.hours);
const searchedOne = endDay(effort, world, [order('search')]).state.zones.a.searched;
const searchedThree = endDay(effort, world, [order('search', ids)]).state.zones.a.searched;
assert.ok(searchedThree > searchedOne, 'Three people perform more actual search work in one order');
effort.zones.a.zombies = 100; effort.zones.a.intel = { min: 100, max: 100, day: 0 };
const clearOne = previewOrder(effort, world, order('clear'));
const clearThree = previewOrder(effort, world, order('clear', ids));
assert.ok(clearThree.hours > clearOne.hours);
const killsOne = estimateKills(effort, effort.survivors.filter(p => p.id === 'tor'), clearOne.hours).kills;
const killsThree = estimateKills(effort, effort.survivors.filter(p => ids.includes(p.id)), clearThree.hours).kills;
assert.ok(killsThree > killsOne);
assert.ok(endDay(effort, world, [order('clear', ids)]).report.killed > endDay(effort, world, [order('clear')]).report.killed, 'Three people contribute more actual combat effort');
const claim = fresh(); claim.zones.a.searched = searchHoursTotal(world.zones[0]);
assert.equal(previewOrder(claim, world, order('claim', ids)).valid, true);
assert.equal(endDay(claim, world, [order('claim', ids)]).state.zones.a.status, 'controlled', 'Actual claim accepts a three-person crew');
// More than forty distinct incoming movements: the report must retain every destination.
const pairs = Array.from({ length: 45 }, (_, i) => [`dest-${i}`, `source-${i}`]);
const migrationWorld: RegionWorld = { ...world, zones: pairs.flat().map(zone), neighbours: pairs.map(([a,b]) => ({ a,b,borderM: 1000 })) };
const migration = newRegionGame(migrationWorld, pairs[0][0], 177); migration.event = undefined; migration.factions = [];
migration.stock.food = migration.stock.water = 200;
for (const [dest, from] of pairs) { migration.zones[dest].status = 'controlled'; migration.zones[dest].zombies = 0; migration.zones[from].status = 'scouted'; migration.zones[from].zombies = 100; }
const incoming = endDay(migration, migrationWorld, []).report;
const lines = incoming.lines.filter(l => l.category === 'migration');
assert.equal(incoming.moves!.length, 40, 'Animation retains its original cap');
assert.equal(lines.length, 45, 'Every actual destination survives the animation cap');
const total = lines.reduce((sum,l) => sum + Number(l.facts!.count), 0);
for (const line of lines) {
  assert.ok(line.zoneId?.startsWith('dest-'));
  assert.equal(line.facts!.totalIncoming, total);
  assert.equal(line.facts!.destinationCount, 45);
  assert.ok(line.title.includes(migrationWorld.zones.find(z => z.id === line.zoneId)!.name));
}
console.log(JSON.stringify({ result: 'PASS orders UX', searchHours: [searchOne.hours, searchThree.hours], searched: [searchedOne, searchedThree], combatHours: [clearOne.hours, clearThree.hours], estimatedKills: [killsOne, killsThree], incomingDestinations: lines.length, incomingTotal: total }));
