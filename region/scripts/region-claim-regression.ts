/** Regression: a claim order must not erase zombies hidden by stale-but-recent scouting intel. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { endDay, newRegionGame, previewOrder, searchHoursTotal, type RegionOrder, type RegionWorld } from '../packages/gameplay/src/region/index';

const full = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const startId = full.starts[0].zoneId;
const localZone = full.zones.find(z => z.id === startId)!;
// Isolate one real L3 so the result tests the claim action rather than night migration or neighbouring zombies.
const world: RegionWorld = { ...full, zones: [localZone], neighbours: [], links: [], pois: [], starts: [] };
const opening = newRegionGame(world, startId, 9001);
opening.event = undefined;
const target = opening.zones[startId];
target.searched = searchHoursTotal(localZone);
target.status = 'scouted';
target.intel = { min: 0, max: 0, day: opening.day };
target.zombies = 50; // New zombies have arrived after the last report.
const order: RegionOrder = { id: 'claim-stale-intel', action: 'claim', zoneId: startId, survivorIds: [opening.survivors[0].id] };

assert.equal(previewOrder(opening, world, order).valid, true, 'The preview uses the known intel, not omniscient actual zombies');
const untouched = JSON.stringify(opening);
const { state, report } = endDay(opening, world, [order]);
assert.equal(JSON.stringify(opening), untouched, 'The pure day resolution must not mutate its input');
assert.equal(state.zones[startId].status, 'scouted', 'A hidden horde must prevent ownership');
assert.equal(state.zones[startId].zombies, 50, 'Claim cannot silently kill 50 zombies');
assert.equal(report.killed, 0, 'No accidental kills may enter the zombie ledger');
assert.ok(report.lines.some(l => l.zoneId === startId && l.title === 'Overtakelsen ble stanset'), 'The player must be told why the claim failed');

const nearlyClear = structuredClone(opening);
nearlyClear.zones[startId].zombies = 2;
const cleared = endDay(nearlyClear, world, [order]);
assert.equal(cleared.state.zones[startId].status, 'controlled', 'A nearly empty zone can still be claimed');
assert.equal(cleared.report.killed, 2, 'Remaining zombies removed by the claim count as kills');

console.log('PASS region claim: stale intel cannot erase a horde; valid small remainder still counts correctly.');
