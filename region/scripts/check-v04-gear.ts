/** V04-05: finite gear, pure reservations and physical return across real checkpoints. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  availableGear, crewGearAway, departGear, discoverSearchGear, endDay, estimateKills, GEAR_CATALOG,
  gearDamageMultiplier, gearStateFor, gearWeapon, knownGearItems, moveGearDepot, newRegionGame, prepareGearPlan, present, previewOrder,
  resumeRegionDay, settleGearReturns, startRegionDay, resolveEvent, forceEvent,
  type GearItem, type RegionOrder, type RegionState, type RegionWorld,
} from '../packages/gameplay/src/region/index';
const source = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const original = source.zones.find(z => z.id === source.starts[0].zoneId)!;
const a = { ...structuredClone(original), id: 'a', name: 'Testleiren', measures: { ...original.measures!, floor: 6000, homes: 10 } };
const b = { ...structuredClone(a), id: 'b', name: 'Testmarka' };
const world: RegionWorld = { ...source, zones: [a, b], neighbours: [{ a: a.id, b: b.id, borderM: 10 }], links: [], pois: [], starts: [] };
function fresh(): RegionState {
  const state = newRegionGame(world, a.id, 177);
  state.event = undefined;
  for (const zone of Object.values(state.zones)) { zone.zombies = 0; zone.intel = { min: 0, max: 0, day: state.day }; }
  state.stock.food = state.stock.water = 200;
  return state;
}
function stored(state: RegionState, id: string, kind: string): GearItem {
  const item: GearItem = { id, kind, location: { kind: 'stored', zoneId: state.homeZoneId }, provenance: { kind: 'search', zoneId: 'a', day: 0, milestone: 99 } };
  state.gear!.items.push(item); return item;
}
const search = (id: string, survivorId: string, zoneId = 'a'): RegionOrder => ({ id, action: 'search', zoneId, survivorIds: [survivorId] });
const state = fresh();
const before = JSON.stringify(state);
const legacy = gearStateFor(state);
assert.equal(JSON.stringify(state), before, 'Reading old region-2 saves never mutates them');
assert.equal(legacy.items.length, state.survivors.length);
assert.deepEqual(legacy.items.map(i => i.kind), state.survivors.map(s => s.weapon), 'Identical initial weapons, no invented bonuses');
assert.equal(new Set(legacy.items.map(i => i.id)).size, legacy.items.length);
assert.deepEqual(gearStateFor({ ...state, gear: legacy }), legacy, 'Repeated initialization cannot duplicate items');
state.gear = legacy;
stored(state, 'one-crowbar', 'crowbar'); stored(state, 'one-vest', 'vest');
const orders = [search('first', 'leila'), search('second', 'tor')];
const snapshot = JSON.stringify(state);
const plan = prepareGearPlan(state, world, orders);
assert.equal(JSON.stringify(state), snapshot, 'Planning stays pure');
assert.deepEqual(plan.errors, []);
assert.equal(plan.orders[0].crew[0].loadout.tool, 'one-crowbar');
assert.equal(plan.orders[1].crew[0].loadout.tool, undefined, 'Two simultaneous crews cannot duplicate the crowbar');
assert.equal(plan.reservations['one-crowbar'].orderId, 'first');
assert.equal(plan.orders[1].crew[0].available.some(i => i.id === 'one-crowbar'), false, 'Dropdown follows earlier reservations');
assert.equal(prepareGearPlan(state, world, [orders[1]]).reservations['one-crowbar'].orderId, 'second', 'Cancel releases');
assert.equal(prepareGearPlan(state, world, [...orders].reverse()).reservations['one-crowbar'].orderId, 'second', 'Reorder changes priority');
const sameCrew = prepareGearPlan(state, world, [{ ...orders[0], survivorIds: ['leila', 'tor'] }]);
assert.equal(sameCrew.orders[0].crew.filter(p => p.loadout.tool === 'one-crowbar').length, 1, 'No duplication within one crew');
const locked: RegionOrder = { ...orders[0], gear: { leila: { locks: { tool: null, weapon: 'starter:leila' } } } };
const locks = prepareGearPlan(state, world, [locked]);
assert.equal(locks.orders[0].crew[0].loadout.tool, undefined, 'Empty manual lock wins over auto');
assert.equal(locks.orders[0].crew[0].loadout.weapon, 'starter:leila');
assert.equal(locks.orders[0].crew[0].loadout.protection, 'one-vest', 'Unlocked slots stay automatic');
const invalid = prepareGearPlan(state, world, [{ ...orders[0], gear: { leila: { locks: { tool: 'missing' } } } }]);
assert.ok(invalid.errors.length, 'Missing locked gear never silently substitutes');
assert.equal(Object.keys(invalid.reservations).length, 0, 'Invalid orders do not retain reservations');
const off = prepareGearPlan(state, world, [{ ...orders[0], gear: { leila: { autoEquip: false } } }]);
assert.equal(off.orders[0].crew[0].loadout.tool, undefined);
assert.equal(off.orders[0].crew[0].loadout.weapon, 'starter:leila', 'Auto OFF retains personal weapon');
const equipped = { ...state, gear: plan.gear };
assert.equal(gearDamageMultiplier(equipped, 'leila'), .8);
assert.ok(previewOrder(state, world, orders[0]).hours > previewOrder(state, world, { ...orders[0], gear: { leila: { locks: { tool: null } } } }).hours, 'Crowbar changes actual engine hours');
const weapons = fresh(); weapons.gear = gearStateFor(weapons);
const marius = weapons.survivors.find(p => p.id === 'marius')!;
const firearm = estimateKills(weapons, [marius], 8);
const quiet: RegionOrder = { id: 'quiet', action: 'clear', zoneId: 'a', survivorIds: ['marius'], gear: { marius: { locks: { weapon: null } } } };
const melee = estimateKills({ ...weapons, gear: prepareGearPlan(weapons, world, [quiet]).gear }, [marius], 8);
assert.equal(gearWeapon(weapons, marius), marius.weapon); assert.equal(melee.ammo, 0);
assert.ok(firearm.ammo > 0 && firearm.noise > melee.noise && firearm.kills > melee.kills, 'Weapon affects ammo, noise and combat');
const loot = fresh(), searchOrder = search('loot', 'leila');
const lootInitial = JSON.stringify(loot), completed = endDay(loot, world, [searchOrder]);
assert.equal(JSON.stringify(loot), lootInitial);
assert.deepEqual(endDay(loot, world, [searchOrder]), completed, 'Deterministic real search and day');
assert.ok(completed.state.gear?.claimedLoot.length, 'Normal search finds early personal gear');
assert.ok(completed.state.gear!.items.filter(i => i.provenance.kind === 'search').every(i => i.location.kind === 'stored'), 'Homecoming delivers loot');
assert.ok(completed.report.lines.some(l => l.title.includes('Personlig utstyr funnet')));
const finite = fresh(); finite.gear = gearStateFor(finite);
const caches = discoverSearchGear(finite, 'a', 0, 40, 40, searchOrder);
assert.equal(caches.length, 3);
assert.equal(discoverSearchGear(finite, 'a', 0, 40, 40, searchOrder).length, 0, 'Same progress cannot respawn caches');
assert.equal(new Set(finite.gear.items.map(i => i.id)).size, finite.gear.items.length);
assert.equal(discoverSearchGear(finite, 'a', 39, 40, 40, searchOrder).length, 0, 'No retroactive old-save loot');
assert.equal(discoverSearchGear(finite, 'a', 40, 40, 40, searchOrder).length, 0, 'No loot from empty repeated search');
assert.ok(caches.every(i => GEAR_CATALOG[i.kind] && i.provenance.zoneId === 'a'));
const bound = { ...state, gear: structuredClone(plan.gear) };
departGear(bound, search('field', 'leila', 'b'));
assert.equal(crewGearAway(bound, 'leila'), true);
assert.equal(present(bound).some(p => p.id === 'leila'), false, 'A field person cannot simultaneously defend HQ');
for (const id of ['leila', 'tor']) assert.equal(availableGear(bound, id).some(i => i.id === 'one-crowbar'), false, 'A mission item is bound until return');
const away = structuredClone(bound); away.day = 1; away.survivors.find(p => p.id === 'leila')!.awayUntil = 3;
settleGearReturns(away);
assert.equal(away.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'carried');
away.day = 3; delete away.survivors.find(p => p.id === 'leila')!.awayUntil; settleGearReturns(away);
assert.equal(away.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'stored', 'Actual return releases the tool');
const canonical = structuredClone(bound); canonical.day = 1;
canonical.crewPositions = { leila: { kind: 'transit', fromZoneId: 'b', toZoneId: 'a', routeZoneIds: ['b', 'a'], atIndex: 0, departedDay: 0, estimatedArrivalDay: 2 } };
settleGearReturns(canonical);
assert.equal(canonical.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'carried', 'Canonical transit cannot be guessed home');
canonical.crewPositions.leila = { kind: 'zone', zoneId: 'a' }; settleGearReturns(canonical);
assert.equal(canonical.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'stored');
const injured = structuredClone(bound); injured.day = 1; injured.survivors.find(p => p.id === 'leila')!.health = 10; settleGearReturns(injured);
assert.equal(injured.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'carried');
assert.equal(availableGear(injured, 'tor').some(i => i.id === 'one-crowbar'), false, 'Injured carrier cannot lend through HQ');
const dead = structuredClone(bound); dead.day = 1; dead.survivors.find(p => p.id === 'leila')!.alive = false; settleGearReturns(dead);
assert.equal(dead.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'lost');
assert.equal(availableGear(dead, 'tor').some(i => i.id === 'one-crowbar'), false, 'Death never teleports gear into HQ');
assert.equal(gearStateFor(dead).items.filter(i => i.id === 'starter:leila').length, 1);
const empty = fresh();
const emptyOrder: RegionOrder = { ...search('unarmed', 'leila', 'b'), gear: { leila: { locks: { weapon: null, protection: null, tool: null } } } };
empty.gear = prepareGearPlan(empty, world, [emptyOrder]).gear; departGear(empty, emptyOrder);
assert.equal(crewGearAway(empty, 'leila'), true, 'Empty slots do not make an away person appear at HQ');
const critical = fresh(); critical.gear = gearStateFor(critical); stored(critical, 'checkpoint-crowbar', 'crowbar');
critical.zones.a.status = 'controlled'; critical.zones.a.zombies = 70;
const criticalOrders: RegionOrder[] = [{ id: 'night-search', action: 'search', zoneId: 'b', survivorIds: ['leila'], gear: { leila: { locks: { tool: 'checkpoint-crowbar' } } } }];
const paused = startRegionDay(critical, world, criticalOrders, { avatarId: 'ingrid' });
assert.equal(paused.status, 'paused');
if (paused.status === 'paused') {
  assert.equal(paused.state.gear!.items.find(i => i.id === 'checkpoint-crowbar')!.location.kind, 'stored', 'A short trip really returns and delivers before night');
  assert.equal(availableGear(paused.state, 'tor').some(i => i.id === 'checkpoint-crowbar'), true, 'Physically returned gear is no longer mission-bound');
  const resumed = resumeRegionDay(JSON.parse(JSON.stringify(paused.state)), world, 'hold');
  assert.deepEqual(resumed, resumeRegionDay(paused.state, world, 'hold'), 'Checkpoint JSON retains gear and finite loot');
  assert.deepEqual({ ...resumed, state: { ...resumed.state, campaign: undefined } }, (() => { const atomic = endDay(critical, world, criticalOrders); return { ...atomic, state: { ...atomic.state, campaign: undefined } }; })(), 'Atomic and manual paths agree on all gameplay; campaign receipts retain actual interaction ancestry');
  assert.equal(resumed.state.gear?.preferences.leila.locks?.tool, 'checkpoint-crowbar', 'Locks survive next day');
  assert.equal(resumed.state.gear?.items.find(i => i.id === 'checkpoint-crowbar')?.location.kind, 'stored');
  resumed.state.event = undefined;
  assert.equal(prepareGearPlan(resumed.state, world, [search('again', 'leila')]).orders[0].crew[0].loadout.tool, 'checkpoint-crowbar');
}
// Same-crew manual handover happens before assignment; invalid transactions roll back.
const handover = fresh(); handover.gear = gearStateFor(handover);
const handOrder: RegionOrder = { id: 'handover', action: 'search', zoneId: 'a', survivorIds: ['marius', 'tor'],
  gear: { marius: { locks: { weapon: null } }, tor: { locks: { weapon: 'starter:marius' } } } };
const handed = prepareGearPlan(handover, world, [handOrder]);
assert.deepEqual(handed.errors, []);
assert.equal(handed.orders[0].crew[1].loadout.weapon, 'starter:marius');
assert.equal(handed.orders[0].crew[1].available.some(i => i.id === 'starter:marius'), true);
assert.equal(Object.values(handed.reservations).filter(r => r.survivorId === 'tor').length, 1);
const badHand = prepareGearPlan(handover, world, [{ ...handOrder, gear: { marius: { locks: { weapon: null } }, tor: { locks: { tool: 'missing' } } } }]);
assert.ok(badHand.errors.length);
assert.deepEqual(badHand.gear, gearStateFor(handover), 'Failed handover leaves all physical items unchanged');
handover.survivors.find(p => p.id === 'marius')!.health = 10;
assert.ok(prepareGearPlan(handover, world, [handOrder]).errors.length, 'A severely injured carrier cannot hand his gun to another');

// Returning to an old camp is a local arrival, never automatic delivery to a new HQ.
const movedHome = structuredClone(bound); movedHome.homeZoneId = 'b'; movedHome.day = 1;
settleGearReturns(movedHome);
assert.deepEqual(movedHome.gear!.items.find(i => i.id === 'one-crowbar')!.location, { kind: 'stored', zoneId: 'a' });
assert.equal(crewGearAway(movedHome, 'leila'), true, 'The returned person is still at the actual old camp');
assert.equal(availableGear(movedHome, 'tor').some(i => i.id === 'one-crowbar'), false);
const transported = fresh(); transported.gear = gearStateFor(transported); stored(transported, 'heavy-vest', 'vest'); stored(transported, 'light', 'flashlight');
moveGearDepot(transported, 'a', 'b', .5);
assert.equal(transported.gear.items.find(i => i.id === 'heavy-vest')!.location.kind === 'stored' && (transported.gear.items.find(i => i.id === 'heavy-vest')!.location as { zoneId: string }).zoneId, 'a');
assert.deepEqual(transported.gear.items.find(i => i.id === 'light')!.location, { kind: 'stored', zoneId: 'b' });
const recovering = structuredClone(injured);
delete recovering.gear!.loadouts.leila.tool;
recovering.survivors.find(p => p.id === 'leila')!.health = 30;
settleGearReturns(recovering);
assert.equal(recovering.gear!.items.find(i => i.id === 'one-crowbar')!.location.kind, 'stored', 'Unselected injury-bound equipment can be handed in after recovery');

// Dead lone scouts never reveal newly acquired item identities to HQ.
const lone = fresh(); lone.gear = gearStateFor(lone);
const secretItems = discoverSearchGear(lone, 'a', 0, 40, 40, search('secret', 'leila'));
assert.equal(secretItems.length, 3);
lone.survivors.find(p => p.id === 'leila')!.alive = false; lone.day = 1;
const secretLines: Parameters<typeof settleGearReturns>[1] = [];
settleGearReturns(lone, secretLines);
assert.equal(secretItems.every(item => item.reported === false && item.location.kind === 'lost'), true);
assert.equal(knownGearItems(lone).some(i => secretItems.some(secret => secret.id === i.id)), false);
assert.equal(prepareGearPlan(lone, world, []).items.some(i => i.reported === false), false);
assert.equal(secretLines.length, 0, 'No loot report appears from the dead unreporting scout');
assert.equal(knownGearItems(lone).some(i => i.id === 'starter:leila' && i.location.kind === 'lost'), true, 'Previously known lost gear remains visible');

// Real old event must still disarm unique gear, even when the base weapon was melee.
for (const survivorId of ['marius', 'leila']) {
  const disarmed = fresh(); disarmed.gear = gearStateFor(disarmed);
  const item = stored(disarmed, `found-rifle-${survivorId}`, 'rifle');
  disarmed.gear = prepareGearPlan(disarmed, world, [{ ...search('equip', survivorId), gear: { [survivorId]: { locks: { weapon: item.id } } } }]).gear;
  disarmed.event = forceEvent(disarmed, world, 'coward');
  assert.ok(disarmed.event); disarmed.event!.data = { who: survivorId };
  const result = resolveEvent(disarmed, world, 'shame').state;
  assert.equal(result.survivors.find(p => p.id === survivorId)!.weapon, 'melee');
  assert.equal(gearWeapon(result, result.survivors.find(p => p.id === survivorId)!), 'melee');
  assert.equal(result.gear!.items.find(i => i.id === item.id)!.location.kind, 'lost');
  assert.equal(prepareGearPlan(result, world, [search('after-shame', survivorId)]).orders[0].crew[0].loadout.weapon, undefined,
    'Auto equip cannot undo an event disarm the next day');
}
// Event eligibility/picker uses actual held guns rather than the old scalar.
const gate = fresh(); gate.gear = gearStateFor(gate);
for (const id of ['ingrid', 'marius']) delete gate.gear.loadouts[id].weapon;
const gateGun = stored(gate, 'gate-rifle', 'rifle');
gate.gear = prepareGearPlan(gate, world, [{ ...search('gate-equip', 'leila'), gear: { leila: { locks: { weapon: gateGun.id } } } }]).gear;
const shooting = forceEvent(gate, world, 'gateShooting');
assert.equal(shooting?.data?.who, 'leila', 'A found rifle counts for firearm events despite a melee baseline');
delete gate.gear.loadouts.leila.weapon;
assert.equal(forceEvent(gate, world, 'gateShooting'), undefined, 'An empty weapon slot cannot fire a gun from the old scalar');
// Canonical geography never falls back to a guessed HQ person or lendable starter weapon.
const registered = fresh(); registered.gear = gearStateFor(registered);
const locationCases = [
  { kind: 'transit', fromZoneId: 'b', toZoneId: 'a', routeZoneIds: ['b', 'a'], atIndex: 0, departedDay: 0, estimatedArrivalDay: 2 },
  { kind: 'away-unknown', expectedReturnDay: 2 },
  { kind: 'zone', zoneId: 'b' },
  { kind: 'area-duty', areaLevel: 3, areaZoneId: 'a', duty: 'guard' },
  undefined,
] as const;
for (const position of locationCases) {
  registered.crewPositions = position ? { leila: structuredClone(position) as NonNullable<RegionState['crewPositions']>[string] } : {};
  assert.equal(crewGearAway(registered, 'leila'), true, `Canonical ${position?.kind ?? 'missing entry'} binds the person`);
  assert.equal(present(registered).some(p => p.id === 'leila'), false, 'No free point-HQ defense from area/transit/unknown placement');
  if (position?.kind === 'zone') assert.deepEqual(prepareGearPlan(registered, world, [search('canonical-local', 'leila', position.zoneId)]).errors, [], 'An idle field crew can receive a real local order');
  else assert.ok(prepareGearPlan(registered, world, [search('canonical-hq', 'leila')]).errors.length, 'No direct HQ order from transit, area duty or unknown position');
  assert.equal(availableGear(registered, 'leila').length, 0, 'A carried starter weapon does not make the absent person available');
}
registered.crewPositions = { leila: { kind: 'zone', zoneId: registered.homeZoneId } };
assert.equal(crewGearAway(registered, 'leila'), false);
assert.equal(present(registered).some(p => p.id === 'leila'), true);
assert.deepEqual(prepareGearPlan(registered, world, [search('canonical-present', 'leila')]).errors, []);
const unregistered = fresh();
assert.equal(crewGearAway(unregistered, 'leila'), false, 'Legacy saves without canonical register retain the existing HQ fallback');
assert.deepEqual(prepareGearPlan(unregistered, world, [search('legacy-present', 'leila')]).errors, []);
console.log('PASS v0.4 gear: pure priority reservations, locks, real effects, finite loot, physical return/absence/injury/death, JSON checkpoint and legacy weapons.');
