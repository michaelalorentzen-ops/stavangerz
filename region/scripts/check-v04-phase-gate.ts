/** V04-09 / D25: phase 1 unlock requires territorial, defensive and survival capacity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  botChooseEvent, botManage, botPlanDay, botTrade, checkPhase, endDay,
  goalMet, indexWorld, newRegionGame, PHASE_ONE_CAPACITY, phaseOneReadiness, resolveEvent,
  type RegionWorld,
} from '../packages/gameplay/src/region/index';

const world = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const index = indexWorld(world);
const start = world.starts[0].zoneId;
const l2 = index.byId.get(start)?.parentId;
assert.ok(l2, 'Curated start has a home L2');
const siblings = (index.children.get(l2) ?? []).filter(id => index.byId.get(id)?.level === 3);
const core = [start];
for (let i = 0; i < core.length && core.length < 3; i++) for (const edge of index.adjacent.get(core[i]) ?? []) {
  if (index.byId.get(edge.to)?.parentId === l2 && !core.includes(edge.to)) core.push(edge.to);
  if (core.length === 3) break;
}
assert.equal(core.length, 3, 'Test world has three connected L3 within one L2');
const state = newRegionGame(world, start, 101);
state.event = undefined;
state.hq = { zoneId: start, type: 'camp', modules: [] };
state.stock.food = 200;
state.stock.water = 200;
for (const id of core) { state.zones[id].status = 'controlled'; state.zones[id].zombies = 0; }

const before = JSON.stringify(state);
const uncovered = phaseOneReadiness(state, world);
assert.equal(uncovered.hasHQ, true);
assert.equal(uncovered.connectedL3, 3);
assert.equal(uncovered.coreReady, true);
assert.equal(uncovered.defenceReady, false, 'Three claimed zones alone are insufficient');
assert.equal(uncovered.suppliesReady, true);
assert.equal(goalMet(state, world, 'phaseOneDefense'), false);
assert.equal(JSON.stringify(state), before, 'Readiness is a pure derived calculation');

const boundary = core.flatMap(id => index.adjacent.get(id) ?? []).find(edge => state.zones[edge.to]?.status !== 'controlled');
assert.ok(boundary, 'The core has an exposed border');
state.barricades[boundary.connId] = 12;
assert.equal(phaseOneReadiness(state, world).defenceReady, true, 'A real surviving frontier barrier counts');
state.barricades[boundary.connId] = 1;
assert.equal(phaseOneReadiness(state, world).defenceReady, false, 'A nearly broken barrier cannot prove sustainable defence');
state.barricades[boundary.connId] = 12;
assert.equal(phaseOneReadiness(state, world).ready, true);
const next = structuredClone(state);
const lines: Parameters<typeof checkPhase>[2] = [];
checkPhase(next, world, lines);
assert.equal(next.phase, 2, 'A defensible three-zone core can reach phase 2 without all L2');
assert.ok(lines.some(line => line.title.includes('Fase 2')));

const noHq = structuredClone(state);
delete noHq.hq;
assert.equal(phaseOneReadiness(noHq, world).ready, false);

const noSupply = structuredClone(state);
noSupply.stock.food = 0;
noSupply.stock.water = 0;
noSupply.population.adults = 50;
assert.equal(phaseOneReadiness(noSupply, world).foodReady, false);
assert.equal(phaseOneReadiness(noSupply, world).waterReady, false);
assert.equal(phaseOneReadiness(noSupply, world).ready, false, 'Zero provisions do not pass by territorial control alone');

const notEnoughCore = structuredClone(state);
for (const id of core.slice(1)) notEnoughCore.zones[id].status = 'scouted';
assert.equal(phaseOneReadiness(notEnoughCore, world).coreReady, false);

const wholeL2 = structuredClone(state);
wholeL2.barricades = {};
for (const id of siblings) wholeL2.zones[id].status = 'controlled';
const entire = phaseOneReadiness(wholeL2, world);
assert.equal(entire.fullL2, true);
assert.equal(entire.defenceReady, true, 'Whole L2 is the alternative territorial/defensive achievement');
assert.equal(entire.suppliesReady, true, 'Full L2 still requires food and water separately');

const hungryDistrict = structuredClone(wholeL2);
hungryDistrict.stock.food = 0;
hungryDistrict.population.adults = 50;
assert.equal(phaseOneReadiness(hungryDistrict, world).ready, false, 'A full L2 does not exempt food capacity');

// A controlled L2 without passable links cannot act as one defensive core.
const severed = structuredClone(wholeL2);
const linksInL2 = (index.adjacent.get(start) ?? []).filter(edge =>
  edge.linkId && siblings.includes(edge.to));
if (linksInL2.length) {
  for (const edge of linksInL2) severed.chokepoints[edge.linkId!] = 'blown';
  const severedResult = phaseOneReadiness(severed, world);
  assert.equal(severedResult.fullL2, false);
  if (severedResult.connectedL3 < severedResult.requiredL3) assert.equal(severedResult.coreReady, false);
}

console.log('PASS v0.4 phase-one capacity: HQ, connected core, durable perimeter, provisions, whole-L2 route.');

// Explicit deterministic scenario QA. Invoke with --bot to test all curated starts.
if (process.argv.includes('--bot')) {
  // Experimental calibration mode; never mutates rules outside this test process.
  const core = Number(process.argv.find(arg => arg.startsWith('--core='))?.split('=')[1] ?? PHASE_ONE_CAPACITY.connectedL3);
  Object.assign(PHASE_ONE_CAPACITY, { connectedL3: core });
  const days = Number(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1] ?? 40);
  const rows = [];
  for (const entry of world.starts) {
    let sim = newRegionGame(world, entry.zoneId, 101);
    let phase2Day: number | null = null;
    let maxConnected = 0;
    let hadHQ = false;
    let defended = false;
    let supplied = false;
    let coreReady = false;
    for (let day = 1; day <= days && !sim.gameOver; day++) {
      let guard = 0;
      while (sim.event && guard++ < 5) sim = resolveEvent(sim, world, botChooseEvent(sim)).state;
      sim = botManage(sim, world);
      sim = botTrade(sim);
      sim = endDay(sim, world, botPlanDay(sim, world)).state;
      const r = phaseOneReadiness(sim, world);
      maxConnected = Math.max(maxConnected, r.connectedL3);
      hadHQ ||= r.hasHQ;
      defended ||= r.defenceReady;
      supplied ||= r.suppliesReady;
      coreReady ||= r.coreReady;
      if (sim.phase >= 2 && phase2Day === null) phase2Day = sim.day;
    }
    const final = phaseOneReadiness(sim, world);
    rows.push({ start: entry.name, phase2Day, lastDay: sim.day, gameOver: !!sim.gameOver,
      maxConnected, hadHQ, defended, supplied, coreReady,
      finalConnected: final.connectedL3, finalBarricades: final.fortifiedBorders,
      finalSupplies: final.suppliesReady, finalFoodDays: final.foodDays, finalWaterDays: final.waterDays,
      fullL2: final.fullL2 });
  }
  console.log(JSON.stringify({ core, days, phase2Count: rows.filter(row => row.phase2Day !== null).length,
    distribution: rows.map(row => ({ start: row.start, phase2Day: row.phase2Day })),
    blockers: { withoutHQ: rows.filter(row => !row.hadHQ).length,
      withoutCore: rows.filter(row => !row.coreReady).length,
      withoutDefence: rows.filter(row => !row.defended).length,
      withoutSupplies: rows.filter(row => !row.supplied).length },
    rows }, null, 2));
}
