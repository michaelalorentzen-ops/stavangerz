/** Actual finite story paths, private evidence, physical cargo, reload and old wonder compatibility. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame } from '../packages/gameplay/src/region/engine';
import { discoverWonders, wonderEffects, WONDERS, wonderZone } from '../packages/gameplay/src/region/wonders';
import { createDiscoveryEvents } from '../packages/gameplay/src/region/events-wonders';
import type { RegionWorld, ReportLine, Stock } from '../packages/gameplay/src/region/types';
import {
  discoveryOrderPreview, discoverySites, deliverDiscoveryReports, executeDiscoveryOrder,
  maintainDiscoveries, observeDiscoveries, visibleDiscoveries,
  type DiscoveryEvidence, type DiscoveryRegionState, type DiscoveryWork,
} from '../packages/gameplay/src/region/discoveries';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const fresh = (): DiscoveryRegionState => {
  const s = newRegionGame(world, world.starts[0].zoneId, 234);
  s.event = undefined;
  s.crewPositions = Object.fromEntries(s.survivors.map(p => [p.id, { kind: 'zone' as const, zoneId: s.homeZoneId }]));
  return s;
};
const lines: ReportLine[] = [];
function field(s: DiscoveryRegionState, id: string, zoneId: string) { s.crewPositions![id] = { kind: 'zone', zoneId }; }
const ordinary = discoverySites(fresh(), world).ordinary!;
const workshop = discoverySites(fresh(), world).tor!;
assert.ok(ordinary && workshop && world.pois.includes(ordinary) && world.pois.includes(workshop));

// Reading legacy state must never initialize/migrate it, or reveal an undiscovered POI.
const legacy = fresh(), before = JSON.stringify(legacy);
assert.deepEqual(visibleDiscoveries(legacy), []);
assert.equal(discoveryOrderPreview(legacy, world, ordinary.zoneId, 'emergency-cupboard', ['ingrid'], 'investigate').ok, false);
assert.equal(JSON.stringify(legacy), before);

// All four sources lead into exactly the same persistent story, without a mandatory marker chain.
for (const source of ['scout', 'search', 'rumor', 'radio'] as const) {
  const s = fresh();
  observeDiscoveries(s, world, { source, zoneId: ordinary.zoneId, reporterIds: ['ingrid'], delivery: source === 'radio' ? 'radio' : 'returned', radioVerified: source === 'radio' }, lines);
  assert.equal(visibleDiscoveries(s)[0]?.id, 'emergency-cupboard');
  assert.deepEqual(visibleDiscoveries(s)[0].sources, [source]);
}
const hidden = fresh(); hidden.homeZoneId = world.zones.find(z => z.level === 3 && z.id !== ordinary.zoneId)!.id; field(hidden, 'ingrid', ordinary.zoneId);
observeDiscoveries(hidden, world, { source: 'scout', zoneId: ordinary.zoneId, reporterIds: ['ingrid'], delivery: 'none' }, lines);
assert.deepEqual(visibleDiscoveries(hidden), [], 'Field observations are not HQ knowledge');
assert.equal(hidden.discoveries!.pending.length, 1);
deliverDiscoveryReports(hidden, world, lines);
assert.deepEqual(visibleDiscoveries(hidden), [], 'A living scout has to return, not merely exist');
const lost = structuredClone(hidden);
lost.survivors.find(p => p.id === 'ingrid')!.alive = false;
maintainDiscoveries(lost, lines); deliverDiscoveryReports(lost, world, lines);
assert.deepEqual(visibleDiscoveries(lost), [], 'Dead, unreturned scouts do not write the book');
assert.deepEqual(lost.discoveries!.pending, []);
const fatallyHurt = structuredClone(hidden);
fatallyHurt.survivors.find(p => p.id === 'ingrid')!.health = 0;
field(fatallyHurt, 'ingrid', fatallyHurt.homeZoneId);
deliverDiscoveryReports(fatallyHurt, world, lines);
assert.deepEqual(visibleDiscoveries(fatallyHurt), [], 'A fatal injury cannot report while waiting for the death ledger to reconcile');
field(hidden, 'ingrid', hidden.homeZoneId);
deliverDiscoveryReports(hidden, world, lines);
assert.equal(visibleDiscoveries(hidden)[0].status, 'clue');
assert.equal(hidden.discoveries!.pending.length, 0);
const falseRadio = fresh(); field(falseRadio, 'ingrid', ordinary.zoneId);
observeDiscoveries(falseRadio, world, { source: 'radio', zoneId: ordinary.zoneId, reporterIds: ['ingrid'], delivery: 'radio', radioVerified: false }, lines);
assert.deepEqual(visibleDiscoveries(falseRadio), [], 'A claimed radio without verified connection reports nothing');

// Real event definitions receive evidence from a physical visitor, or existing live field notes.
const rumor = fresh(); rumor.day = 2;
const rumorDef = createDiscoveryEvents(() => false).find(e => e.id === 'localFieldRumor')!;
assert.equal(rumorDef.when(rumor, world), true);
rumor.event = { id: rumorDef.id, ...rumorDef.make(rumor, world, () => .5)! };
rumorDef.resolve(rumor, world, 'listen', () => .5, lines);
assert.deepEqual(visibleDiscoveries(rumor)[0].sources, ['rumor']);
const radio = fresh(); radio.homeZoneId = hidden.homeZoneId;
field(radio, 'tor', radio.homeZoneId); field(radio, 'ingrid', ordinary.zoneId);
observeDiscoveries(radio, world, { source: 'scout', zoneId: ordinary.zoneId, reporterIds: ['ingrid'], delivery: 'none' }, lines);
let connected = false;
const radioDef = createDiscoveryEvents(() => connected).find(e => e.id === 'fieldRadioReport')!;
assert.equal(radioDef.when(radio, world), false, 'Event requires the authoritative radio service');
connected = true; assert.equal(radioDef.when(radio, world), true);
radio.event = { id: radioDef.id, ...radioDef.make(radio, world, () => .5)! };
connected = false; radioDef.resolve(radio, world, 'receive', () => .5, lines);
assert.deepEqual(visibleDiscoveries(radio), [], 'A broken connection between make and resolve sends nothing');
const radioStock = structuredClone(radio.stock);
connected = true; radioDef.resolve(radio, world, 'receive', () => .5, lines);
assert.deepEqual(visibleDiscoveries(radio)[0].sources, ['scout', 'radio']);
assert.equal(radio.discoveries!.pending.length, 0);
assert.deepEqual(radio.stock, radioStock, 'Radio sends knowledge, never cargo');

const evidence = (zoneId: string, source: DiscoveryEvidence['source'] = 'search'): DiscoveryEvidence => ({ source, zoneId, reporterIds: ['tor'], delivery: 'returned' });
function run(s: DiscoveryRegionState, target: string, kind: DiscoveryWork['kind'], personId = 'tor'): Stock {
  const entry = s.discoveries!.entries[target.split(':')[0]];
  field(s, personId, entry.zoneId);
  const p = discoveryOrderPreview(s, world, entry.zoneId, target, [personId], kind);
  assert.equal(p.ok, true, p.reason ?? 'Discovery order must be valid');
  const result = executeDiscoveryOrder(s, world, { zoneId: entry.zoneId, target, crewIds: [personId], kind, hours: p.hours, delivery: 'none' }, lines);
  assert.equal(result.completed, true);
  // Knowledge may return immediately only when the order really happened at home.
  field(s, personId, s.homeZoneId); deliverDiscoveryReports(s, world, lines);
  return result.cargo;
}

const ordinaryRun = fresh(); observeDiscoveries(ordinaryRun, world, evidence(ordinary.zoneId), lines);
const stockBefore = structuredClone(ordinaryRun.stock);
const minimum = discoveryOrderPreview(ordinaryRun, world, ordinary.zoneId, 'emergency-cupboard', ['tor'], 'investigate');
const notDone = executeDiscoveryOrder(ordinaryRun, world, { zoneId: ordinary.zoneId, target: 'emergency-cupboard', crewIds: ['tor'], kind: 'investigate', hours: minimum.hours - 1, delivery: 'none' }, lines);
assert.equal(notDone.completed, false);
assert.equal(ordinaryRun.discoveries!.entries['emergency-cupboard'].status, 'clue');
assert.deepEqual(run(ordinaryRun, 'emergency-cupboard', 'investigate'), {});
assert.equal(ordinaryRun.discoveries!.entries['emergency-cupboard'].status, 'choice');
const reloaded: DiscoveryRegionState = JSON.parse(JSON.stringify(ordinaryRun));
const rewards = run(reloaded, 'emergency-cupboard:rations', 'choice');
assert.deepEqual(rewards, { food: 6, water: 6 });
assert.deepEqual(reloaded.stock, stockBefore, 'A story gives physical cargo; even radio cannot teleport it into global stock');
assert.equal(reloaded.discoveries!.entries['emergency-cupboard'].status, 'resolved');
assert.equal(discoveryOrderPreview(reloaded, world, ordinary.zoneId, 'emergency-cupboard:rations', ['tor'], 'choice').ok, false);
assert.deepEqual(executeDiscoveryOrder(reloaded, world, { zoneId: ordinary.zoneId, target: 'emergency-cupboard:rations', crewIds: ['tor'], kind: 'choice', hours: 8, delivery: 'returned' }, lines), { cargo: {}, completed: false });
const alternative = fresh(); observeDiscoveries(alternative, world, evidence(ordinary.zoneId), lines);
run(alternative, 'emergency-cupboard', 'investigate');
assert.deepEqual(run(alternative, 'emergency-cupboard:medical', 'choice'), { medicine: 3, batteries: 2 });
assert.notDeepEqual(alternative.discoveries!.entries['emergency-cupboard'].chosen, reloaded.discoveries!.entries['emergency-cupboard'].chosen);

// Tor's optional story spans several actual work orders with a choice to stop early.
const tor = fresh(); observeDiscoveries(tor, world, evidence(workshop.zoneId, 'rumor'), lines);
assert.equal(discoveryOrderPreview(tor, world, workshop.zoneId, 'tor-repair-notes', ['ingrid'], 'investigate').ok, false);
run(tor, 'tor-repair-notes', 'investigate');
run(tor, 'tor-repair-notes:restore', 'choice');
assert.equal(tor.discoveries!.entries['tor-repair-notes'].status, 'followup');
assert.equal(tor.discoveries!.entries['tor-repair-notes'].zoneId, tor.homeZoneId);
assert.deepEqual(discoveryOrderPreview(tor, world, tor.homeZoneId, 'tor-repair-notes', ['tor'], 'investigate').cost, { parts: 2 });
run(tor, 'tor-repair-notes', 'investigate');
const torLast: DiscoveryRegionState = JSON.parse(JSON.stringify(tor));
const moraleBefore = torLast.morale;
run(torLast, 'tor-repair-notes:teach', 'choice');
assert.equal(torLast.morale, moraleBefore + 5);
assert.equal(torLast.discoveries!.entries['tor-repair-notes'].notes.length, 5);
assert.deepEqual(torLast.discoveries!.entries['tor-repair-notes'].chosen, ['restore', 'teach']);
const spareKit = structuredClone(tor); assert.deepEqual(run(spareKit, 'tor-repair-notes:kit', 'choice'), { parts: 4, building: 4 });
const scrap = fresh(); observeDiscoveries(scrap, world, evidence(workshop.zoneId), lines);
run(scrap, 'tor-repair-notes', 'investigate');
assert.deepEqual(run(scrap, 'tor-repair-notes:scrap', 'choice'), { parts: 6 });
assert.equal(scrap.discoveries!.entries['tor-repair-notes'].status, 'resolved');
const torDead = fresh(); observeDiscoveries(torDead, world, evidence(workshop.zoneId), lines);
torDead.survivors.find(p => p.id === 'tor')!.alive = false;
maintainDiscoveries(torDead, lines);
assert.equal(torDead.discoveries!.entries['tor-repair-notes'].status, 'lost');
assert.equal(torDead.gameOver, undefined, 'An optional person story never gates all progression');
const neverMet = fresh(); neverMet.survivors.find(p => p.id === 'tor')!.alive = false;
observeDiscoveries(neverMet, world, { source: 'search', zoneId: workshop.zoneId, reporterIds: ['ingrid'], delivery: 'returned' }, lines);
assert.deepEqual(visibleDiscoveries(neverMet), [], 'An unseen, dead-person story is not exposed in the journal');

// Existing active unique places preserve their effects and old claim behavior until O06 is explicitly changed.
const oldWonders = fresh();
const cathedral = WONDERS.find(w => w.id === 'cathedral')!;
const cathedralZone = wonderZone(world, cathedral)!;
oldWonders.zones[cathedralZone].status = 'controlled';
discoverWonders(oldWonders, world, lines);
assert.equal(oldWonders.wonders!.cathedral.level, 0);
const effects = wonderEffects(oldWonders), oldSave: DiscoveryRegionState = JSON.parse(JSON.stringify(oldWonders));
maintainDiscoveries(oldSave, lines); deliverDiscoveryReports(oldSave, world, lines);
assert.deepEqual(wonderEffects(oldSave), effects);
assert.deepEqual(oldSave.wonders, oldWonders.wonders);
assert.ok(lines.some(l => (l as ReportLine & { category?: string }).category === 'discovery'));
console.log('PASS v0.4 discoveries: 4 alternative sources; delayed/live-only reporting; radio gate; finite cargo; two ordinary choices; multi-order Tor branches; person loss; reload; legacy unique places.');
