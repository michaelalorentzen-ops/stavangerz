/** PR27 QA: prospective gear and action costs must share the physical departure ledger. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indexWorld, newRegionGame, previewOrder, prepareGearPlan, endDay, type RegionOrder, type RegionWorld } from '../packages/gameplay/src/region/index';
import { beginMission, ensureMobility, missionLoad, missionPreview, reserveMissionStores } from '../packages/gameplay/src/region/mobility';
import { reserveMissionRadio } from '../packages/gameplay/src/region/communications';
import { gainWonder, wonderZone, wonderOperational, wonderEffects, WONDERS } from '../packages/gameplay/src/region/wonders';
import { escapeRoute, startDanger } from '../packages/gameplay/src/region/engine';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const home = 'z3-0433'; // Actual relocated camp in the seed202/day95 reproduction.
function fresh() {
  const state = newRegionGame(world, home, 202);
  state.event = undefined;
  ensureMobility(state);
  state.stock = { food: 200, water: 200, building: 200, radio: 2, batteries: 10 };
  state.factions = [];
  state.zones[home].status = 'controlled';
  for (const edge of indexWorld(world).adjacent.get(home)!.filter(e => e.kind === 'land').slice(8)) state.zones[edge.to].status = 'controlled';
  for (const z of Object.values(state.zones)) { z.zombies = 0; delete z.owner; }
  state.gear!.items.push({ id: 'qa-toolbox', kind: 'toolbox', location: { kind: 'stored', zoneId: home }, provenance: { kind: 'search', zoneId: home, day: 0, milestone: 99 } });
  return state;
}
const state = fresh();
const order: RegionOrder = { id: 'fortify', action: 'fortify', zoneId: home, survivorIds: ['tor'] };
const untouched = JSON.stringify(state);
// Actual seed202/day95 trigger: 8 borders, 24 building + 4 provisions + melee1 =29.
// Auto equip then adds the 2kg toolbox, making the departure 31/30.
assert.equal(missionLoad(state, order, { building: 24 }).weight, 29);
const preview = previewOrder(state, world, order);
assert.equal(preview.costs.building, 24);
assert.equal(preview.valid, false);
assert.match(preview.errors.join(' '), /bærekapasitet/);
assert.ok(prepareGearPlan(state, world, [order]).errors.length);
assert.equal(JSON.stringify(state), untouched, 'Invalid prospective load planning is pure');
assert.doesNotThrow(() => endDay(state, world, [order]), 'Old valid-looking day plan cannot crash the resolver');
const pair = { ...order, survivorIds: ['tor', 'leila'] };
const plan = prepareGearPlan(state, world, [pair]);
assert.deepEqual(plan.errors, []);
const departure = { ...structuredClone(state), gear: plan.gear };
const full = previewOrder(departure, world, pair, { gearPrepared: true });
assert.equal(full.valid, true);
assert.equal(missionPreview(departure, world, pair, full.costs).valid, true);
const mission = beginMission(departure, world, pair, full.costs);
reserveMissionStores(departure, mission, full.costs);
assert.equal(mission.cargo!.building, 24);
assert.equal(departure.stock.building, 176);
// A failed order must not retain its toolbox, crew or manifest ahead of a later order.
const follow = { ...pair, id: 'valid-second' };
const combined = prepareGearPlan(state, world, [order, follow]);
assert.ok(combined.orders[0].errors.length);
assert.deepEqual(combined.orders[1].errors, []);
assert.equal(combined.reservations['qa-toolbox'].orderId, follow.id);
// Manifest takes priority: two radios promised as cargo cannot become one after opt-in link.
const target = world.neighbours.find(e => e.a === home || e.b === home)!;
const zoneId = target.a === home ? target.b : target.a;
const supply: RegionOrder = { id: 'radios', action: 'supply', zoneId, survivorIds: ['tor'], communication: { radio: true }, logistics: { cargo: { radio: 2 }, stay: true } };
for (const radios of [2, 3]) {
  const s = fresh(); s.stock.radio = radios;
  const p = prepareGearPlan(s, world, [supply]);
  assert.deepEqual(p.errors, []);
  s.gear = p.gear;
  const load = missionLoad(s, supply);
  assert.equal(load.radio, radios === 3);
  const m = beginMission(s, world, supply);
  reserveMissionStores(s, m, {});
  assert.equal(reserveMissionRadio(s, m), radios === 3);
  assert.equal(m.cargo!.radio, 2);
  assert.equal(s.stock.radio, 0);
  assert.equal((m.cargo!.radio ?? 0) + (s.mobility!.radios[m.id]?.radio ?? 0), radios);
  const resolved = endDay(fresh(), world, [supply]).state;
  assert.equal(resolved.mobility!.depots[zoneId].radio, 2, 'Resolver fulfils the two-radio delivery');
}
const radioEdge = { ...order, action: 'travel' as const, logistics: { cargo: { building: 28.5, food: 0, water: 0 } }, communication: { radio: true } };
assert.equal(missionPreview(state, world, radioEdge).valid, false, 'Optional carried radio and battery have weight');
const passengerEdge = { ...radioEdge, communication: undefined, logistics: { cargo: { building: 20, food: 0, water: 0 }, passengers: { adults: 1, children: 0, elderly: 0, sick: 0 } } };
state.population.adults = 1;
assert.equal(missionLoad(state, passengerEdge).weight, 31, 'Passenger and existing weapon share capacity');
assert.equal(missionPreview(state, world, passengerEdge).valid, false);
// New version only describes new games; reading/planning old region-2 state never rewrites it.
assert.equal(newRegionGame(world, home, 202).rulesVersion, 'region-0.4');
const legacy = fresh(); legacy.rulesVersion = 'region-0.3';
const old = JSON.stringify(legacy); prepareGearPlan(legacy, world, [pair]);
assert.equal(JSON.stringify(legacy), old);
// Seeded start card and event use the same post-faction initial zombies and escape target.
for (const seed of [101, 202, 303]) for (const start of world.starts) {
  const game = newRegionGame(world, start.zoneId, seed);
  const danger = startDanger(world, start.zoneId, seed);
  assert.equal(danger.zombies, game.zones[start.zoneId].zombies);
  assert.deepEqual(danger.escape, escapeRoute(game, world));
  if (game.event?.id === 'escape') assert.equal(game.event.data!.calm, danger.escape?.zoneId);
  assert.equal(game.zones[danger.escape?.zoneId ?? start.zoneId].owner, undefined);
}
// Actual faction scout and two explicit crew stages at the allied cathedral/event ship.
for (const id of ['cathedral', 'cruise']) {
  const churchZone = wonderZone(world, WONDERS.find(w => w.id === 'cathedral')!)!;
  let s = newRegionGame(world, churchZone, 743); s.event = undefined; ensureMobility(s);
  s.stock = { food: 200, water: 200, building: 200, metal: 200, parts: 200, electronics: 200, fuel: 200, ammo: 200 };
  for (const z of Object.values(s.zones)) { z.zombies = 0; delete z.owner; }
  s.factions = [{ ...s.factions[0], id: 'church', zoneId: churchZone, relation: 40, hostile: false, defeated: false }];
  s.zones[churchZone].owner = 'church'; delete s.zones[churchZone].intel;
  gainWonder(s, world, id, [], churchZone);
  const ids = s.survivors.map(p => p.id);
  const scout: RegionOrder = { id: 'allied-scout', action: 'scout', zoneId: churchZone, survivorIds: ids };
  s = endDay(s, world, [scout]).state;
  assert.ok((s.zones[churchZone].intel?.max ?? 99) <= 2, 'Faction scouting observes the actual zombie grounds');
  for (let stage = 0; stage < 2; stage++) {
    const work: RegionOrder = { id: `allied-${id}-${stage}`, action: 'wonder', target: id, zoneId: churchZone, survivorIds: ids };
    const check = previewOrder(s, world, work);
    assert.equal(check.valid, true, check.errors.join(' '));
    s = endDay(s, world, [work]).state;
    assert.equal(wonderOperational(s.wonders![id]), stage === 1, 'Only the second actual crew stage makes the installation operational');
  }
  if (id === 'cathedral') assert.equal(wonderEffects(s).hope, 4);
}
console.log('PASS PR27 mission load: 29→31kg fortify trigger, prospective gear rollback, radio manifest priority/weight, passengers, legacy version and seeded escape.');
