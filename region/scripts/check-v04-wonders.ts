/** D27: all six finite installation paths, legacy effects and private discovery reporting. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame } from '../packages/gameplay/src/region/engine';
import type { RegionState, RegionWorld, ReportLine, Stock } from '../packages/gameplay/src/region/types';
import { WONDERS, WONDER_INSTALLATIONS, gainWonder, discoverWonders, wonderEffects, nextWonderLevel, wonderHolding, wonderOperational, wonderWorkCost, wonderOrderError, wonderZone, workOnWonder } from '../packages/gameplay/src/region/wonders';
import { observeDiscoveries, deliverDiscoveryReports, maintainDiscoveries, transmitDiscoveryReports, type DiscoveryRegionState } from '../packages/gameplay/src/region/discoveries';
import { EVENTS_WONDERS } from '../packages/gameplay/src/region/events-wonders';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const lines: ReportLine[] = [];
const fresh = (): DiscoveryRegionState => { const s = newRegionGame(world, world.starts[0].zoneId, 743); delete s.event; s.crewPositions = Object.fromEntries(s.survivors.map(p => [p.id, { kind: 'zone' as const, zoneId: s.homeZoneId }])); return s; };
for (const def of WONDERS) {
  let state = fresh(); const zoneId = wonderZone(world, def)!;
  assert.ok(zoneId, `${def.id} has a real world attachment`);
  state.zones[zoneId].status = 'controlled'; state.zones[zoneId].zombies = 0;
  const stockBefore = structuredClone(state.stock);
  gainWonder(state, world, def.id, lines, zoneId);
  assert.equal(wonderHolding(state, def.id)?.installation?.status, 'discovered');
  assert.equal(wonderOperational(wonderHolding(state, def.id)!), false);
  assert.equal(wonderEffects(state).hope, 0, 'Discovery is no free operating effect');
  assert.equal(wonderEffects(state).shelter, 0);
  assert.deepEqual(state.stock, stockBefore);
  assert.ok(wonderOrderError(state, def.id, '__wrong-zone__'));
  let paid: Stock = {}, calls = 0;
  const pay = (cost: Stock) => { calls++; for (const [id, n] of Object.entries(cost)) paid[id] = (paid[id] ?? 0) + n; };
  const survey = nextWonderLevel(state, def.id)!;
  assert.equal(survey.hours, WONDER_INSTALLATIONS[def.id].survey.hours);
  workOnWonder(state, def.id, 0, lines, pay); assert.equal(calls, 0);
  workOnWonder(state, def.id, 1000, lines, pay, 'population');
  assert.equal(wonderHolding(state, def.id)!.progress, 0, 'Anonymous workers cannot perform the crew-only survey');
  workOnWonder(state, def.id, 1, lines, pay); assert.equal(calls, 1);
  state = JSON.parse(JSON.stringify(state));
  assert.deepEqual(wonderWorkCost(state, def.id), {}, 'Paid partial work survives reload');
  workOnWonder(state, def.id, survey.hours - 1, lines, pay);
  assert.equal(calls, 1, 'Survey cost is paid exactly once');
  assert.equal(wonderHolding(state, def.id)!.installation!.status, 'secured');
  assert.equal(wonderEffects(state).hope, 0, 'Securing alone still gives no operating effects');
  assert.equal(wonderHolding(state, def.id)!.progress, 0, 'Excess work cannot jump into a new paid stage');
  const operate = nextWonderLevel(state, def.id)!;
  workOnWonder(state, def.id, 1, lines, pay);
  state = JSON.parse(JSON.stringify(state));
  workOnWonder(state, def.id, operate.hours - 1, lines, pay);
  assert.equal(calls, 2, 'Operation cost is paid once across reload');
  assert.equal(wonderOperational(wonderHolding(state, def.id)!), true);
  assert.equal(wonderHolding(state, def.id)!.level, 0, 'Initial installation preserves existing upgrade levels');
  assert.equal(wonderEffects(state).shelter, def.levels[0].effect.shelter ?? 0);
  assert.equal(wonderEffects(state).hope, def.levels[0].effect.hope ?? 0);
  assert.deepEqual(nextWonderLevel(state, def.id), def.levels[1], 'Normal upgrades remain available after operation');
  assert.deepEqual(paid, Object.fromEntries([...new Set([...Object.keys(survey.cost), ...Object.keys(operate.cost)])].map(id => [id, (survey.cost[id] ?? 0) + (operate.cost[id] ?? 0)])));
  const taken = JSON.stringify(state.wonders); gainWonder(state, world, def.id, lines, zoneId);
  assert.equal(JSON.stringify(state.wonders), taken, 'Repeated discovery cannot reset or duplicate an installation');
  const legacy = fresh(); legacy.zones[zoneId].status = 'controlled';
  legacy.wonders = { [def.id]: { zoneId, level: 1, progress: 3 } };
  const effects = wonderEffects(legacy), snapshot = JSON.stringify(legacy.wonders[def.id]);
  discoverWonders(legacy, world, lines);
  assert.equal(JSON.stringify(legacy.wonders[def.id]), snapshot, 'Legacy active installation state is not rewritten');
  assert.deepEqual(wonderEffects(legacy), effects);
  assert.equal(wonderOperational(legacy.wonders[def.id]), true);
}

// Actual horde blocks stage work without payment; no zombie is silently deleted.
const unsafe = fresh(), tower = WONDERS.find(d => d.id === 'tower')!, towerZone = wonderZone(world, tower)!;
gainWonder(unsafe, world, 'tower', lines, towerZone);
unsafe.zones[towerZone].zombies = 50; unsafe.zones[towerZone].status = 'scouted'; unsafe.zones[towerZone].intel = { min: 0, max: 0, day: unsafe.day };
let charge = 0; workOnWonder(unsafe, 'tower', 100, lines, () => { charge++; });
assert.equal(charge, 0); assert.equal(wonderHolding(unsafe, 'tower')!.progress, 0); assert.equal(unsafe.zones[towerZone].zombies, 50);

// Unique-site knowledge also requires real return or a live verified transmission.
const scout = fresh(); scout.crewPositions!.ingrid = { kind: 'zone', zoneId: towerZone };
observeDiscoveries(scout, world, { source: 'scout', zoneId: towerZone, reporterIds: ['ingrid'], delivery: 'none' }, lines);
assert.equal(scout.wonders?.tower, undefined);
const dead = structuredClone(scout); dead.survivors.find(p => p.id === 'ingrid')!.alive = false;
maintainDiscoveries(dead, lines); deliverDiscoveryReports(dead, world, lines); transmitDiscoveryReports(dead, world, ['ingrid'], true, lines);
assert.equal(dead.wonders?.tower, undefined);
transmitDiscoveryReports(scout, world, ['ingrid'], false, lines); assert.equal(scout.wonders?.tower, undefined);
transmitDiscoveryReports(scout, world, ['ingrid'], true, lines); assert.equal(wonderHolding(scout, 'tower')?.installation?.status, 'discovered');

// New wonder events supply clues, not remote combat/people/resources. Saved old event promises remain active.
for (const [id, choice, wonderId] of [['cruiseShip', 'board', 'cruise'], ['planeFound', 'take', 'plane']] as const) {
  const state = fresh(), eventDef = EVENTS_WONDERS.find(e => e.id === id)!;
  state.event = { id, ...eventDef.make(state, world, () => .5)! };
  const beforeStock = structuredClone(state.stock), beforePopulation = structuredClone(state.population);
  eventDef.resolve(state, world, choice, () => .5, lines);
  assert.equal(wonderHolding(state, wonderId)!.installation!.status, 'discovered');
  assert.deepEqual(state.stock, beforeStock); assert.deepEqual(state.population, beforePopulation);
  const old = fresh(); old.event = { id, ...eventDef.make(old, world, () => .5)! }; delete old.event.data!.installationFlow;
  old.stock.ammo = 50; eventDef.resolve(old, world, choice, () => .9, lines);
  assert.equal(wonderHolding(old, wonderId)!.installation, undefined, 'A persisted pre-D27 accepted event preserves legacy active status');
}
console.log('PASS D27: six explicit crew installation paths, once-only finite costs, partial work reload, no anonymous activation, actual threat gate, legacy effects/events, private live-only site reports.');
