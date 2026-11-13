/** Predicate fixtures are boundary tests, not claimed natural victories. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame, checkVictory, PHASES, goalMet, type RegionWorld, type RegionState } from '../packages/gameplay/src/region';
import { campaignProgress, campaignAchievements } from '../apps/game-client/app/campaign-progress-model';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const initial = newRegionGame(world, world.starts[0].zoneId, 101);
const clone = () => JSON.parse(JSON.stringify(initial)) as RegionState;
function fixture(phase: number) { const state = clone(); state.phase = phase; state.morale = 50; state.discontent = 49; state.factions.forEach(f => { f.relation = 59; f.hostile = false; }); return state; }
for (const phase of PHASES) { const state = fixture(phase.id); assert.deepEqual(campaignProgress(state, world).goals.map(g => g.met), phase.goals.map(g => goalMet(state, world, g.id))); }
for (const phase of [1, 4, 5]) { const state = fixture(phase); state.research.done.push('cure'); checkVictory(state, -10); assert.equal(!!state.gameOver?.won, phase === 5, 'cure requires phase5'); }
for (const relation of [59, 60]) for (const hostile of [false, true]) { const state = fixture(5); state.factions.forEach(f => { f.relation = relation; f.hostile = hostile; }); const shown = campaignProgress(state, world).alliance.ready; checkVictory(state, -1); assert.equal(!!state.gameOver?.won, shown); assert.equal(shown, relation === 60 && !hostile); }
for (const food of [-1, 0]) for (const morale of [49, 50]) for (const discontent of [49, 50]) { const state = fixture(5); state.morale = morale; state.discontent = discontent; state.counters.stable = 29; checkVictory(state, food); const expected = food >= 0 && morale >= 50 && discontent < 50; assert.equal(!!state.gameOver?.won, expected); assert.equal(state.counters.stable, expected ? 30 : 0); }
const noCrew = fixture(5); noCrew.survivors.forEach(person => { person.alive = false; }); noCrew.counters.stable = 29; checkVictory(noCrew, 0); assert.equal(!!noCrew.gameOver?.won, false);
const before = JSON.stringify(initial); campaignProgress(initial, world); campaignAchievements(initial); assert.equal(JSON.stringify(initial), before);
const legacy = clone(); delete legacy.discoveries; delete legacy.gear; assert.equal(campaignAchievements(legacy).discoveries, 0);
console.log('Campaign presentation: goals, 3 victory predicate boundaries, reset, legacy and immutability passed. Fixtures, not natural wins.');
