/** UI projection privacy boundary: reached PUBLIC stage, not future results. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame, endDay } from '../packages/gameplay/src/region/engine';
import type { ExpeditionExperience, RegionWorld, RegionReplayStage, RegionOrder, ReportLine } from '../packages/gameplay/src/region/types';
import { departureScene, replayStageScenes } from '../apps/game-client/app/expedition-replay';

const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const before = newRegionGame(world, world.starts[0].zoneId, 101);
delete before.event;
const home = before.homeZoneId;
const target = world.neighbours.flatMap(n => n.a === home ? [n.b] : n.b === home ? [n.a] : []).find(id => world.zones.some(z => z.id === id && z.level === 3))!;
assert(target, 'Real adjacent L3 target exists');
const order: RegionOrder = { id: 'replay-test', action: 'scout', zoneId: target, survivorIds: ['ingrid'] };
const initial = JSON.stringify(before);
const departure = departureScene(before, world, [order])!;
assert(departure);
assert.equal(departure.zoneId, target);
assert.equal(departure.participants[0].name, 'Ingrid');
assert.match(departure.text, /skal observere/);
assert.doesNotMatch(departure.text, /ankom|nådd|fant|drept|kom tilbake/);
assert.equal(departureScene(before, world, [{ ...order, zoneId: home }]), undefined, 'Home search is not departure');
assert.equal(departureScene(before, world, [{ ...order, survivorIds: ['not-a-person'] }]), undefined);
const away = structuredClone(before); away.crewPositions = { ...away.crewPositions, ingrid: { kind: 'away-unknown' } };
assert.equal(departureScene(away, world, [order]), undefined);
const unavailable = structuredClone(before); unavailable.survivors.find(p => p.id === 'ingrid')!.alive = false;
assert.equal(departureScene(unavailable, world, [order]), undefined);

const actual = endDay(before, world, [{ ...order, zoneId: home }]);
const operations = actual.report.replay!.find(s => s.phase === 'operations')!;
const projected = replayStageScenes(before, world, operations);
assert(projected.featured.some(s => s.kind === 'scout' && s.participants.some(p => p.name === 'Ingrid')), 'Real first scouting result becomes replay scene');
assert(projected.featured.every(s => s.phase === 'operations'));
assert.equal(JSON.stringify(before), initial, 'Projection and day resolver preserve caller');
assert.deepEqual(projected, replayStageScenes(JSON.parse(initial), world, JSON.parse(JSON.stringify(operations))), 'JSON roundtrip preserves projection');

const empty: RegionReplayStage = { ...operations, lines: [], zoneChanges: [] };
assert.deepEqual(replayStageScenes(before, world, empty), { featured: [], compact: [] }, 'Empty stage cannot inspect later report');
const secret = 'DO_NOT_REVEAL_UNRETURNED';
const guarded = structuredClone(before);
Object.defineProperty(guarded, 'discoveries', { get() { throw Error(secret); } });
Object.defineProperty(guarded, 'reports', { get() { throw Error(secret); } });
Object.defineProperty(world, 'pois', { configurable: true, get() { throw Error(secret); } });
assert.deepEqual(replayStageScenes(guarded, world, operations), projected, 'No access to private discoveries, future report or world POIs');
assert(departureScene(guarded, world, [order]), 'Planning does not inspect world POIs or report results');

const memory = operations.lines.find(l => l.experience)?.experience as ExpeditionExperience;
assert(memory);
const hidden = structuredClone(empty);
hidden.mapSnapshot!.zones[target].status = 'unknown';
const old = structuredClone(before); old.zones[target].status = 'unknown';
hidden.lines = [{ tone: 'info', title: memory.title, text: memory.result, zoneId: target, experience: { ...memory, zoneId: target } }];
assert.equal(replayStageScenes(old, world, hidden).featured.length, 0, 'Unknown zone cannot authorize a first-experience scene');
const travel = { tone: 'info' as const, category: 'travel', title: 'Arbeidet fortsetter neste døgn', text: 'Dagens operasjonsvindu gikk med til faktisk reise.', zoneId: target };
assert.equal(replayStageScenes(old, world, { ...hidden, lines: [travel] }).compact[0], travel, 'Public travel progress is not hidden target intelligence');
hidden.mapSnapshot!.zones[target].status = 'scouted';
assert.equal(replayStageScenes(old, world, hidden).featured.length, 1, 'Reached scouting snapshot authorizes newly known zone');

const repeated: ReportLine = { tone: 'good', title: 'Søk', text: 'Rapportert søk.', zoneId: home, facts: { action: 'search', searchBefore: 1, searchAfter: 2 } };
const busy: RegionReplayStage = { ...empty, lines: Array.from({ length: 8 }, (_, i) => ({ tone: 'bad', title: `Faktisk varsel ${i}`, text: 'Autorisert konsekvens.', zoneId: home })) };
const bounded = replayStageScenes(before, world, busy);
assert.equal(bounded.featured.length, 3);
assert.equal(bounded.compact.length, 2, 'Warnings beyond featured budget remain compact');
const normal = replayStageScenes(before, world, { ...empty, lines: [repeated] });
assert.equal(normal.featured[0].kind, 'search');
assert.equal(normal.featured[0].first, false);
assert.equal(normal.featured[0].participants.length, 0, 'Routine reports cannot infer crew from orders or final state');
assert.equal(normal.featured[0].result, repeated.text);
const duplicate = replayStageScenes(before, world, { ...operations, lines: [
  { ...repeated, zoneId: target, facts: { action: 'search', searchBefore: 1, searchAfter: 2 } },
  { tone: 'info', title: memory.title, text: memory.result, zoneId: target, experience: { ...memory, kind: 'search', zoneId: target } },
] });
assert.equal(duplicate.featured.length, 1); assert.equal(duplicate.compact.length, 0, 'First scene replaces ordinary duplicate');
const crowded = replayStageScenes(before, world, { ...operations, lines: ['search', 'gear', 'combat'].map(kind => ({
  tone: 'info' as const, title: `Test ${kind}`, text: 'Testresultat', zoneId: home,
  experience: { ...memory, id: `priority:${kind}`, kind: kind as ExpeditionExperience['kind'], zoneId: home },
})) });
assert.equal(crowded.featured[0].kind, 'combat', 'First fight cannot be crowded out by an equipment card');
const combatLine: ReportLine = { tone: 'info', category: 'experience', title: 'Første kamp', text: 'Resultat', zoneId: home,
  facts: { orderId: 'injury-order', missionId: 'injury-mission' },
  experience: { ...memory, id: 'injury-combat', kind: 'combat', zoneId: home, result: '2 zombier ble drept. 1 i laget ble skadet.', facts: { injuredCount: 1 } } };
const namedInjury: ReportLine = { tone: 'bad', category: 'loot', title: 'Tor ble skadet', text: 'I testområdet: 8 i skade.',
  facts: { action: 'search', orderId: 'injury-order', missionId: 'injury-mission' } };
const fold = (lines: ReportLine[]) => replayStageScenes(before, world, { ...operations, lines });
const merged = fold([namedInjury, combatLine]);
assert.equal(merged.featured.length, 1, 'Named same-operation injury is part of first combat, not a second scene');
assert.equal(merged.featured[0].kind, 'combat'); assert.equal(merged.featured[0].tone, 'bad');
assert(merged.featured[0].result.includes(`${namedInjury.title}. ${namedInjury.text}`), 'Exact public injury title and damage text preserved');
assert.equal(merged.featured[0].result.split(namedInjury.title).length - 1, 1, 'Named injury appears exactly once');
assert.equal(merged.compact.length, 0, 'Merged named injury is not duplicated in compact strip');
assert.deepEqual(merged, fold([combatLine, namedInjury]), 'Joining does not depend on injury/report order');
assert.equal(fold([namedInjury, { ...combatLine, facts: { orderId: 'injury-order', missionId: 'another-mission' } }]).featured.length, 2, 'Different mission must remain independent');
assert.equal(fold([namedInjury, { ...combatLine, facts: { orderId: 'another-order', missionId: 'injury-mission' } }]).featured.length, 2, 'Different order must remain independent');
assert.equal(fold([namedInjury, { ...combatLine, facts: { orderId: '', missionId: '' } }]).featured.length, 2, 'Empty operation identities cannot authorize merging');
assert.equal(fold([namedInjury, { ...combatLine, experience: { ...combatLine.experience!, facts: { injuredCount: 0 } } }]).featured.length, 2, 'No injured combat fact means no suppression');
assert.equal(fold([{ ...namedInjury, title: 'Tor døde' }, combatLine]).featured.length, 2, 'Death/loss is never folded away');
assert.equal(fold([{ ...namedInjury, category: 'combat' }, combatLine]).featured.length, 2, 'Narrow loot injury contract only');
assert.equal(departureScene(actual.state, world, [order]), undefined, 'First introduction ends once scouting is recorded');
console.log('Expedition replay projection: authoritative day, privacy, no lookahead, JSON retention, bounded scenes, truthful planning PASS');
