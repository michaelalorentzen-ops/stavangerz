/** V04-02B: true saved night checkpoint, no double daytime or zombie migration. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endDay, newRegionGame, resumeRegionDay, startRegionDay, type RegionOrder, type RegionWorld } from '../packages/gameplay/src/region/index';

const source = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const zone = source.zones.find(z => z.id === source.starts[0].zoneId)!;
const world: RegionWorld = { ...source, zones: [zone], neighbours: [], links: [], pois: [], starts: [] };
const state = newRegionGame(world, zone.id, 1551);
state.event = undefined;
state.zones[zone.id].status = 'controlled';
state.zones[zone.id].zombies = 70; // HYPOTESE: a deliberately critical, controlled-HQ scenario.
state.stock.ammo = 40;
const avatarId = state.survivors[0].id;
const orders: RegionOrder[] = [
  { id: 'daytime-clear', action: 'clear', zoneId: zone.id, survivorIds: ['marius'] },
  { id: 'home-guard', action: 'guard', zoneId: zone.id, survivorIds: ['tor'] },
];
const initial = JSON.stringify(state);
// Receipt ancestry records the manual checkpoint versus the atomic path; gameplay must still match exactly.
const gameplay = <T extends { state: typeof state }>(result: T) => ({ ...result, state: { ...result.state, campaign: undefined } });

const paused = startRegionDay(state, world, orders, { avatarId });
assert.equal(paused.status, 'paused', 'An avatar physically at a threatened HQ must be asked');
if (paused.status !== 'paused') throw new Error('Expected a night defence incident');
assert.equal(JSON.stringify(state), initial, 'The source state stays untouched');
assert.equal(paused.state.day, state.day, 'A pending turn has not started the next day');
assert.equal(paused.state.turnCheckpoint?.stage, 'before-night-defence');
assert.ok(paused.state.zones[zone.id].zombies < 70 && paused.state.zones[zone.id].zombies >= 8,
  'The daytime clear mission ran, but night defence has not');
assert.ok(paused.state.stock.ammo < 40, 'Daytime rifle ammo was charged once, before the checkpoint');
assert.ok((paused.state.turnCheckpoint?.guards[zone.id] ?? 0) > 0,
  'Actual guard-order defence power is persisted, not recalculated on resume');
const checkpointAmmo = paused.state.stock.ammo ?? 0;
assert.deepEqual(paused.decision.choices.map(c => c.id), ['hold', 'fire']);

const serialized = JSON.stringify(paused.state);
const reloaded = JSON.parse(serialized) as typeof paused.state;
const hold = resumeRegionDay(paused.state, world, 'hold');
const resumedFromJson = resumeRegionDay(reloaded, world, 'hold');
assert.deepEqual(resumedFromJson, hold, 'JSON save/reload produces an identical final day');
assert.equal(hold.state.day, state.day + 1);
assert.equal(hold.state.turnCheckpoint, undefined, 'Completed day consumes the checkpoint');
assert.equal(hold.state.reports.at(-1)?.day, hold.state.day);
assert.deepEqual(hold.report.replay?.map(stage => stage.phase), ['operations', 'night', 'new-day']);
assert.deepEqual(gameplay(hold), gameplay(endDay(state, world, orders)), 'Legacy atomic endDay remains equivalent to the hold/default path');

const fire = resumeRegionDay(reloaded, world, 'fire');
assert.equal(fire.state.day, hold.state.day);
assert.equal(fire.state.stock.ammo, (hold.state.stock.ammo ?? 0) - 5, 'Five cartridges spent exactly once');
assert.ok((fire.state.stock.ammo ?? 0) <= checkpointAmmo - 5, 'Resume never re-adds the ammunition used in daytime');
assert.ok(fire.report.killed >= hold.report.killed, 'Defence bonus cannot reduce kills');
assert.ok(fire.report.lines.some(line => line.title === 'Dekkild ved HQ'));
assert.deepEqual(resumeRegionDay(JSON.parse(serialized), world, 'fire'), fire, 'Choice outcome is deterministic');

assert.throws(() => endDay(paused.state, world, orders), /Fortsett hendelsen/,
  'Cannot start the same day while a blocking decision is pending');
assert.throws(() => startRegionDay(paused.state, world, orders, { avatarId }), /Fortsett hendelsen/);
assert.throws(() => resumeRegionDay(paused.state, world), /Ta stilling/,
  'Skip/reload cannot bypass an unresolved choice');
assert.throws(() => resumeRegionDay(hold.state, world, 'hold'), /Ingen gyldig dagscheckpoint/,
  'A completed save cannot settle the day again');
assert.throws(() => resumeRegionDay(paused.state, world, 'incorrect' as 'hold'), /Ta stilling/);
assert.throws(() => resumeRegionDay({ ...paused.state, day: state.day + 1 }, world, 'hold'), /annet døgn/);
assert.equal(JSON.stringify(paused.state), serialized, 'Failed calls and resume must not mutate checkpoint');

const alone = startRegionDay(state, world, orders);
assert.equal(alone.status, 'complete', 'No identified on-site avatar: no fabricated personal choice');
if (alone.status === 'complete') assert.deepEqual(gameplay(alone), gameplay({ status: 'complete', ...endDay(state, world, orders) }));

const radioCrew = structuredClone(state);
radioCrew.stock.radio = 1;
radioCrew.crewPositions = { [avatarId]: { kind: 'zone', zoneId: 'some-other-zone' } };
assert.equal(startRegionDay(radioCrew, world, orders, { avatarId }).status, 'complete',
  'Radio alone must not escalate an offsite crew encounter (D24)');

const dry = structuredClone(state);
dry.stock.ammo = 0;
const dryPause = startRegionDay(dry, world, [], { avatarId });
assert.equal(dryPause.status, 'paused');
if (dryPause.status === 'paused') {
  assert.ok(dryPause.decision.choices.find(c => c.id === 'fire')?.disabled);
  assert.throws(() => resumeRegionDay(dryPause.state, world, 'fire'), /ikke tilgjengelig/);
  assert.ok(resumeRegionDay(dryPause.state, world, 'hold').report);
}

console.log('PASS v0.4 real night checkpoint: replay/resume, JSON save, radio delegation fallback, single settlement and ammo accounting.');
