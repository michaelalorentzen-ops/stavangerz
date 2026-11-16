/** Earned public milestones: deterministic presentation, not new rewards or natural-play proof. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endDay, newRegionGame } from '../packages/gameplay/src/region/engine';
import { earnedMemoryMarker, experienceMarker, finalizeExperienceReport, recordedExperiences, recordedMemories, recordPhaseExperience } from '../packages/gameplay/src/region/experiences';
import type { EarnedMemoryKind, ExpeditionExperience, ExperienceKind, RegionOrder, RegionReport, RegionState, RegionWorld } from '../packages/gameplay/src/region/types';

async function main() {
  const original = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
  const template = original.zones.find(zone => zone.level === 3)!;
  const world: RegionWorld = { ...original, zones: Array.from({ length: 14 }, (_, index) => ({ ...template, id: `z${index}`, name: `Prøvesone ${index}`, parentId: 'l2', measures: { ...template.measures!, floor: 0, homes: 0, coastM: 0, farm: 0, forest: 0, industry: 0, retail: 0 } })), neighbours: Array.from({ length: 13 }, (_, index) => ({ a: 'z0', b: `z${index + 1}`, borderM: 10 })), links: [], pois: [], starts: [] };
  const crew = ['ingrid', 'marius', 'leila', 'tor'];
  const order = (action: RegionOrder['action'], zoneId = 'z0', target?: string): RegionOrder => ({ id: `earned:${action}:${zoneId}:${target ?? ''}`, action, zoneId, survivorIds: crew, ...(target ? { target } : {}) });
  const fresh = (): RegionState => {
    const state = newRegionGame(world, 'z0', 51);
    delete state.event;
    for (const zone of Object.values(state.zones)) { zone.zombies = 0; zone.status = 'scouted'; zone.intel = { min: 0, max: 0, day: 0 }; }
    Object.assign(state.stock, { food: 200, water: 200, building: 200, metal: 200, ammo: 200 });
    state.zones.z0.status = 'controlled';
    return state;
  };
  const run = (state: RegionState, orders: RegionOrder[]) => {
    const before = JSON.stringify(state), result = endDay(state, world, orders);
    assert.equal(JSON.stringify(state), before, 'Caller remains unchanged');
    assert.deepEqual(result.report.replay!.flatMap(stage => stage.lines), result.report.lines, 'Milestones follow their real replay stage');
    return result;
  };
  const milestones = (report: RegionReport) => report.lines.flatMap(line => line.experience?.milestone ? [line.experience] : []);
  const has = (state: RegionState, key: EarnedMemoryKind) => recordedMemories(state).some(memory => memory.milestone === key);
  const defended = () => { const state = fresh(); state.hq = { zoneId: 'z0', type: 'camp', modules: [] }; state.flags[experienceMarker('perimeter')] = 'previous-public-perimeter'; return state; };

  // Actual module completion, not merely a plan, partial work or pre-existing module.
  const moduleBase = defended(), completed = run(moduleBase, [order('module', 'z0', 'watchtower')]);
  assert(completed.state.hq!.modules.includes('watchtower'));
  assert.equal(milestones(completed.report).filter(memory => memory.milestone === 'hq-defence').length, 1);
  assert.equal(milestones(completed.report)[0].facts.moduleId, 'watchtower');
  assert.match(milestones(completed.report)[0].result, /er ferdig/);
  assert.deepEqual(completed, run(moduleBase, [order('module', 'z0', 'watchtower')]), 'Same operations produce identical earned memories');
  const partial = defended(); const onePerson = { ...order('module', 'z0', 'watchtower'), survivorIds: ['tor'] };
  assert.equal(has(run(partial, [onePerson]).state, 'hq-defence'), false, 'Eight hours are not a completed twelve-hour tower');
  const firstPerimeter = defended(); delete firstPerimeter.flags[experienceMarker('perimeter')];
  assert.equal(has(run(firstPerimeter, [order('module', 'z0', 'watchtower')]).state, 'hq-defence'), false, 'Initial perimeter stays the original first experience');
  const existingModule = defended(); existingModule.hq!.modules = ['watchtower']; delete existingModule.flags['experience:milestone-origin'];
  assert.equal(has(run(existingModule, [order('module', 'z0', 'gate')]).state, 'hq-defence'), false, 'A legacy tower does not become a new first module when a gate is built');
  const again = structuredClone(completed.state); delete again.event;
  assert.equal(milestones(run(again, [order('module', 'z0', 'gate')]).report).length, 0);

  // The tenth actual capture. Its candidate remains private until the real crew returns.
  const nine = fresh(); for (let index = 0; index < 9; index++) nine.zones[`z${index}`].status = 'controlled';
  const tenth = run(nine, [order('claim', 'z9')]);
  assert.equal(Object.values(tenth.state.zones).filter(zone => zone.status === 'controlled').length, 10);
  assert(has(tenth.state, 'ten-zones'));
  assert.equal(milestones(tenth.report).find(memory => memory.milestone === 'ten-zones')!.facts.controlledCount, 10);
  const privateClaim = run(nine, [{ ...order('claim', 'z9'), logistics: { stay: true } }]);
  assert.equal(has(privateClaim.state, 'ten-zones'), false);
  assert.equal(privateClaim.state.flags[earnedMemoryMarker('ten-zones')], undefined);
  assert(Object.values(privateClaim.state.crewMissions ?? {}).some(mission => mission.privateLines?.some(line => line.experience?.milestone === 'ten-zones')));
  const loaded = JSON.parse(JSON.stringify(privateClaim.state)) as RegionState; delete loaded.event;
  const returned = run(loaded, [order('return')]);
  assert(has(returned.state, 'ten-zones'));
  assert.equal(milestones(returned.report).find(memory => memory.milestone === 'ten-zones')!.day, 0, 'Historical action day survives private transport and reload');
  const dead = structuredClone(loaded); for (const person of dead.survivors) { person.alive = false; person.health = 0; }
  assert.equal(has(run(dead, []).state, 'ten-zones'), false, 'A dead, unreported crew does not publish the milestone');
  const oldTen = fresh(); for (let index = 0; index < 10; index++) oldTen.zones[`z${index}`].status = 'controlled'; delete oldTen.flags['experience:milestone-origin'];
  assert.equal(has(run(oldTen, [order('claim', 'z10')]).state, 'ten-zones'), false, 'Loading an old ten-zone campaign does not reconstruct a historical first');

  // Actual phase-two integration; later phase snapshots additionally exercise every finite key.
  const phaseReady = defended(); phaseReady.zones.z1.status = phaseReady.zones.z2.status = 'controlled'; phaseReady.hq!.modules = ['watchtower'];
  const phaseTwo = run(phaseReady, []);
  assert.equal(phaseTwo.state.phase, 2);
  assert(has(phaseTwo.state, 'phase-2'));
  assert.equal(phaseTwo.report.replay!.at(-1)!.lines.some(line => line.experience?.milestone === 'phase-2'), true);
  const phaseState = fresh();
  const makeReport = (state: RegionState, previous: number): RegionReport => { const lines: RegionReport['lines'] = []; recordPhaseExperience(state, world, previous, lines); const report = { day: state.day, lines, food: { produced: 0, eaten: 0 }, water: { produced: 0, drunk: 0 }, zombiesMoved: 0, killed: 0 }; finalizeExperienceReport(state, report); state.reports.push(report); return report; };
  const firstKinds: ExperienceKind[] = ['scout', 'search', 'combat', 'gear', 'claim', 'perimeter', 'poi', 'hq'];
  phaseState.experiences = firstKinds.map(kind => ({ version: 1, id: `saved:${kind}`, kind, day: 0, zoneId: 'z0', zoneName: 'Prøvesone 0', title: 'Tidligere førstegangsminne', text: 'Et allerede publisert prøveminne.', result: 'Bevares.', participants: [], facts: {}, illustration: 'residential', helpTopic: 'day', record: 'first' } as ExpeditionExperience));
  const eight = structuredClone(phaseState.experiences);
  for (const phase of [2, 3, 4, 5]) { phaseState.phase = phase; phaseState.day = phase; assert.equal(milestones(makeReport(phaseState, phase - 1)).length, 1); assert.equal(milestones(makeReport(phaseState, phase)).length, 0); }
  assert.equal(phaseState.earnedMemories!.length, 4);
  assert.equal(recordedMemories(phaseState).length, 12);
  assert.deepEqual(recordedExperiences(phaseState), eight, 'Later milestones never evict or recategorize the original eight');
  const legacy = fresh(); delete legacy.flags['experience:milestone-origin']; legacy.phase = 2;
  assert.equal(milestones(makeReport(legacy, 1))[0].record, 'first-recorded', 'Earlier PR34 campaigns are legacy for new milestone firsts, despite original experience origin');
  const restored = JSON.parse(JSON.stringify(phaseState)) as RegionState;
  assert.deepEqual(recordedMemories(restored), recordedMemories(phaseState));
  restored.reports = [];
  assert.equal(recordedMemories(restored).length, 12, 'Milestone archive survives report rotation');
  assert(restored.earnedMemories!.length <= 12);
  let aged = structuredClone(completed.state); aged.experiences = structuredClone(eight); aged.stock.food = aged.stock.water = 10000;
  for (let day = 0; day < 41; day++) { delete aged.event; aged = run(aged, []).state; }
  assert.equal(aged.reports.length, 30);
  assert(has(aged, 'hq-defence'), 'The later public milestone survives actual forty-one-day report rotation');
  assert.deepEqual(recordedExperiences(aged), eight, 'Milestone retention never removes the original eight');

  if (process.env.EARNED_MEMORY_REFERENCE_ENGINE) {
    const reference = await import(process.env.EARNED_MEMORY_REFERENCE_ENGINE) as typeof import('../packages/gameplay/src/region/engine');
    const projection = (value: RegionState) => JSON.parse(JSON.stringify(value, (key, data) => ['reports', 'experiences', 'earnedMemories', 'experience', 'memory', 'discoveries', 'campaign', 'privateLines'].includes(key) || key.startsWith('experience:') ? undefined : data));
    for (const [state, orders] of [[moduleBase, [order('module', 'z0', 'watchtower')]], [nine, [order('claim', 'z9')]], [phaseReady, []]] as [RegionState, RegionOrder[]][]) {
      assert.deepEqual(projection(run(state, orders).state), projection(reference.endDay(state, world, orders).state), 'Exact mechanical projection equality with the pre-milestone engine');
    }
    console.log('PASS earned-memory numerical reference parity: module completion, tenth capture and phase advancement.');
  }
  console.log('PASS earned memories: six finite keys, real completion/crossing/phase, once/reload, private/dead transport, legacy honesty and independent bounded retention.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
