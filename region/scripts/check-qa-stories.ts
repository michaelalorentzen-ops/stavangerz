/** PR27 S3/S4/S5: real event accounting, honest geography and explicit allied installation. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame } from '../packages/gameplay/src/region/engine';
import type { RegionWorld, ReportLine } from '../packages/gameplay/src/region/types';
import { EVENTS_WORLD, bindWorld } from '../packages/gameplay/src/region/events-world';
import { discoverWonders, gainWonder, wonderCanAccess, wonderEffects, wonderOperational, wonderOrderError, wonderZone, workOnWonder, WONDERS } from '../packages/gameplay/src/region/wonders';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const fresh = () => { const s = newRegionGame(world, world.starts[0].zoneId, 743); delete s.event; return s; };
const def = (id: string) => WONDERS.find(d => d.id === id)!;
assert.equal(wonderZone(world, def('utstein')), 'z3-0238', 'Kartverket SSR608330 is inside Bakklandet; do not move world borders to match a name');
assert.equal(wonderZone(world, def('arena')), 'z3-0178', 'Kartverket SSR480714 is inside Boganes in this world');
const geo: RegionWorld = { ...world, pois: [], links: [], neighbours: [], zones: [
  { id: 'contains', name: 'contains', level: 3, at: [0, 0], geometry: { type: 'MultiPolygon', coordinates: [[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[4,2],[4,4],[2,4],[2,2]]]] } },
  { id: 'nearest', name: 'nearest', level: 3, at: [3,3] },
] };
assert.equal(wonderZone(geo, { ...def('arena'), at: [8,8] }), 'contains', 'Actual polygon wins over a closer centroid');
assert.equal(wonderZone(geo, { ...def('arena'), at: [3,3] }), 'nearest', 'A polygon hole must not claim the point');
const allied = fresh(), churchZone = wonderZone(world, def('cathedral'))!;
allied.factions = [{ ...allied.factions[0], id: 'church', zoneId: churchZone, relation: 40, hostile: false, defeated: false }];
allied.zones[churchZone].status = 'unknown'; allied.zones[churchZone].owner = 'church'; allied.zones[churchZone].zombies = 0; delete allied.zones[churchZone].intel;
const lines: ReportLine[] = [];
discoverWonders(allied, world, lines);
assert.equal(wonderCanAccess(allied, 'cathedral', churchZone), true);
assert.equal(wonderOrderError(allied, 'cathedral', churchZone), undefined);
assert.equal(wonderEffects(allied).hope, 0, 'Friendship alone activates nothing');
workOnWonder(allied, 'cathedral', 100, lines, () => {});
assert.equal(wonderOperational(allied.wonders!.cathedral), false, 'Survey alone activates nothing');
workOnWonder(allied, 'cathedral', 100, lines, () => {});
assert.equal(wonderEffects(allied).hope, 4, 'Real second crew stage enables promised allied site');
allied.factions[0].relation = 39;
assert.equal(wonderCanAccess(allied, 'cathedral', churchZone), false);
assert.equal(wonderEffects(allied).hope, 0);
allied.factions[0].relation = 40; allied.factions[0].hostile = true;
assert.equal(wonderCanAccess(allied, 'cathedral', churchZone), false);
gainWonder(allied, world, 'cruise', lines, churchZone);
assert.equal(wonderCanAccess(allied, 'cruise', churchZone), true, 'D13: the event ship is separate from the faction that holds the L3');
assert.ok(wonderOrderError(allied, 'cruise', churchZone), 'Ship permission does not invent safe approach intel');
allied.zones[churchZone].intel = { min: 0, max: 0, day: allied.day };
assert.equal(wonderOrderError(allied, 'cruise', churchZone), undefined);
workOnWonder(allied, 'cruise', 100, lines, () => {});
assert.equal(wonderOperational(allied.wonders!.cruise), false);
workOnWonder(allied, 'cruise', 100, lines, () => {});
assert.equal(wonderOperational(allied.wonders!.cruise), true, 'A real second crew job can operate the ship where it lies');
// Exercise the actual scheduled siege event, including requested kills exceeding the actual finite crowd.
bindWorld(world);
for (const blocked of [false, true]) {
 const s = fresh(), zone = s.homeZoneId;
 for (const z of Object.values(s.zones)) { z.zombies = 0; z.status = blocked ? 'controlled' : 'unknown'; delete z.owner; }
 s.zones[zone].zombies = 75; s.stock.ammo = 100;
 const total = () => Object.values(s.zones).reduce((n,z) => n+z.zombies,0);
 const before = total(); const event = EVENTS_WORLD.find(d => d.id === 'siegeDay')!;
 s.event = { id: event.id, ...event.make(s, world, () => .99, { zone, size: 300, round: 1 })! };
 // Keep the original stored size to reproduce the stale 109-fell versus 75-moved report.
 s.event.data = { zone, size: 300, round: 1 };
 const report: ReportLine[] = []; event.resolve(s, world, 'sally', () => .99, report);
 assert.equal(total(), before, 'The finite ledger stays unchanged: this action disperses rather than kills');
 const moved = 75 - s.zones[zone].zombies;
 const result = report.at(-1)!;
 assert.equal(result.title, moved ? `${moved} zombier drevet bort` : 'Flokken holder stillingen');
 assert.ok(!result.title.includes('falt'));
}
console.log('PASS PR27 S3/S4/S5: explicit allied work, geographic containment/holes and actual finite siege reporting.');
