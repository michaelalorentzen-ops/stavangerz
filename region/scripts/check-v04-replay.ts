/** A v0.4 replay journal must match the actual deterministic day outcome. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endDay, newRegionGame, searchHoursTotal, type RegionOrder, type RegionWorld, type ZoneStatus } from '../packages/gameplay/src/region/index';

const worldData = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const startId = worldData.starts[0].zoneId;
const startZone = worldData.zones.find(zone => zone.id === startId)!;
const world: RegionWorld = { ...worldData, zones: [startZone], neighbours: [], links: [], pois: [], starts: [] };
const start = newRegionGame(world, startId, 941);
start.event = undefined;
start.zones[startId].zombies = 0;
start.zones[startId].status = 'scouted';
start.zones[startId].intel = { min: 0, max: 0, day: start.day };
start.zones[startId].searched = searchHoursTotal(startZone);
const order: RegionOrder = { id: 'replay-claim', action: 'claim', zoneId: startId, survivorIds: [start.survivors[0].id] };

const initial = JSON.stringify(start);
const first = endDay(start, world, [order]);
const second = endDay(start, world, [order]);
assert.equal(JSON.stringify(start), initial, 'endDay is still pure and does not alter input');
assert.deepEqual(first, second, 'Same state, seed and orders must yield identical journal and result');
assert.equal(first.report.replay?.length, 3);
const [operations, night, newDay] = first.report.replay!;
assert.deepEqual(first.report.replay!.map(stage => stage.phase), ['operations', 'night', 'new-day']);
assert.deepEqual(operations.from, { dayOffset: 0, clock: '07:00' });
assert.deepEqual(operations.to, { dayOffset: 0, clock: '22:00' });
assert.deepEqual(night.from, { dayOffset: 0, clock: '22:00' });
assert.deepEqual(night.to, { dayOffset: 1, clock: '07:00' });
assert.deepEqual(newDay.from, { dayOffset: 1, clock: '07:00' });
assert.equal(newDay.to, undefined, 'Dawn is a marker, not an invented third time interval');
assert.deepEqual(first.report.replay!.flatMap(stage => stage.lines), first.report.lines);
assert.deepEqual(night.moves, first.report.moves);

const observedStatus: Record<string, ZoneStatus> = Object.fromEntries(Object.entries(start.zones).map(([id, zone]) => [id, zone.status]));
for (const stage of first.report.replay!) {
  for (const change of stage.zoneChanges) {
    assert.equal(observedStatus[change.zoneId], change.before, 'Replay zone delta must describe the actual previous status');
    observedStatus[change.zoneId] = change.after;
  }
}
for (const [id, zone] of Object.entries(first.state.zones)) assert.equal(observedStatus[id], zone.status, 'Replay must reach the authoritative final ownership state');
assert.ok(operations.zoneChanges.some(change => change.zoneId === startId && change.after === 'controlled'), 'Claim is an operations-stage change');
assert.equal(newDay.mainResourcesAfter.food, first.state.stock.food ?? 0);
assert.equal(newDay.mainResourcesAfter.water, first.state.stock.water ?? 0);
assert.deepEqual(JSON.parse(JSON.stringify(first.report.replay)), first.report.replay, 'Journal must survive JSON save/restore');

// A legacy v0.3 report with no replay still has the original authoritative lines.
const legacyReport = { ...first.report, replay: undefined };
assert.deepEqual(legacyReport.lines, first.report.lines);
console.log('PASS v0.4 deterministic day replay phases and legacy report fallback.');
