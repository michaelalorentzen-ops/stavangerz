/** Privacy and truthful projection gate for first-expedition map accents. */
import assert from 'node:assert/strict';
import { expeditionMapCues } from '../apps/game-client/app/expedition-map-feedback';
import type { RegionState, RegionWorld, ReportLine } from '../packages/gameplay/src/region/types';

const world = { zones: [
  { id: 'home', level: 3, at: [5.73, 58.97] },
  { id: 'known', level: 3, at: [5.74, 58.97] },
  { id: 'hidden', level: 3, at: [5.75, 58.97] },
  { id: 'district', level: 2, at: [5.75, 58.97] },
  { id: 'invalid', level: 3, at: [NaN, 58.97] },
] } as RegionWorld;
const zone = (status: 'controlled'|'scouted'|'unknown'):RegionState['zones'][string] => ({ status, zombies:0, searched:0, loot:{}, upgrades:[] });
const zones:RegionState['zones'] = { home:zone('controlled'), known:zone('scouted'), hidden:zone('unknown'), district:zone('scouted'), invalid:zone('scouted') };
function line(kind: string, zoneId = 'home', extra = {}): ReportLine {
  return { tone: 'good', title: 'Actual line', text: 'Actual outcome', zoneId,
    experience: { version: 1, id: `${kind}:${zoneId}`, kind, zoneId, title: 'Real recorded outcome', result: '6 mat rapportert', ...extra },
  } as ReportLine;
}
const lines = [line('search'), line('hq'), line('gear', 'known'), line('combat', 'hidden'), line('claim'), line('poi', 'district'), line('scout', 'invalid')];
const before = JSON.stringify({ world, zones, lines });
assert.deepEqual(expeditionMapCues(lines, world, zones).map(cue => [cue.kind, cue.zoneId]), [['hq', 'home'], ['gear', 'known']], 'One highest-value accent per known real L3; unknown, claims and invalid geography are excluded.');
assert.equal(JSON.stringify({ world, zones, lines }), before, 'The projection never mutates report, world or presented state.');
assert.deepEqual(expeditionMapCues([{ tone: 'good', title: 'Fant utstyr', text: 'Legacy routine line' }], world, zones), [], 'Never invent a first-time result from routine/legacy prose.');
assert.deepEqual(expeditionMapCues([line('search', 'missing'), line('toString'), line('search', 'home', { version: 2 }), line('search', 'home', { result: null })], world, zones), [], 'Unsupported and malformed snapshots produce no feedback.');
assert.deepEqual(expeditionMapCues([], world, zones), [], 'Private mission lines/current state cannot be discovered when no published lines were supplied.');
assert.deepEqual(expeditionMapCues([line('hq', 'home', { milestone: 'phase-2' })], world, zones), [], 'A later public milestone must not masquerade as a first-operation map cue.');
const snapshot = line('search', 'known');
const selected = expeditionMapCues([snapshot], world, zones)[0];
assert.equal(selected.result, '6 mat rapportert');
assert.equal(selected.title, 'Real recorded outcome');
assert.deepEqual(selected.at, [5.74, 58.97]);
assert.deepEqual(expeditionMapCues(JSON.parse(JSON.stringify([snapshot])), world, zones), [selected], 'Serialized report snapshots retain identical projection.');
console.log('PASS expedition map feedback: immutable public snapshots, real known L3 only, no claim duplication, private/legacy/malformed suppression and JSON reload.');
