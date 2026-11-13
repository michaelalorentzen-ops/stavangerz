/** V04-09: real day/ending scenarios and durable save/high-water checks, not a balance benchmark. */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { newRegionGame, endDay, startRegionDay, resumeRegionDay } from '../packages/gameplay/src/region/engine';
import { dailyFlows } from '../packages/gameplay/src/region/economy';
import { checkVictory } from '../packages/gameplay/src/region/progress';
import { advanceCampaignCommit, campaignAvatarId, campaignAvatarStatus, campaignFor, campaignHints, chooseCampaignAvatar, type Difficulty } from '../packages/gameplay/src/region/campaign';
import type { RegionState, RegionWorld } from '../packages/gameplay/src/region/types';
import { loadRegionSave, saveRegionState, clearRegionSave, RegionSaveError, type RegionSaveStorage } from '../apps/game-client/app/region-save';
import { SAVE_KEY_REGION } from '../packages/gameplay/src/region/rules';

const source = JSON.parse(readFileSync(resolve('apps/game-client/public/world/region-v1.json'), 'utf8')) as RegionWorld;
const originalZone = source.zones.find(zone => zone.id === source.starts[0].zoneId)!;
const zone = { ...originalZone, finds: [], measures: { ...originalZone.measures!, floor: 600, homes: 4, buildings: 4, farm: 0, coastM: 0, retail: 0, industry: 0 } };
const world: RegionWorld = { ...source, zones: [zone], neighbours: [], links: [], pois: [], starts: [] };
function game(difficulty: Difficulty = 'survival', hardcore = false) {
  const state = newRegionGame(world, zone.id, 1551, { difficulty, hardcore, avatarId: 'ingrid', runId: `test-${difficulty}-${hardcore}` });
  state.zones[zone.id].zombies = 0;
  state.zones[zone.id].intel = { min: 0, max: 0, day: 0 };
  state.factions = [];
  delete state.event;
  return state;
}
const story = game('story'), survival = game(), realistic = game('realistic');
assert.equal(story.stock.food, 60);
assert.equal(survival.stock.food, 40);
assert.equal(realistic.stock.food, 30);
const totalCache = (state: RegionState) => Object.values(state.zones[zone.id].loot).reduce((sum, n) => sum + n, 0);
assert.ok(totalCache(story) > totalCache(survival) && totalCache(survival) > totalCache(realistic), 'Modes generate distinct finite caches; no extra items are created while looting');
const foodNeeds = [story, survival, realistic].map(state => dailyFlows(state, world).food.eaten);
assert.ok(foodNeeds[0] < foodNeeds[1] && foodNeeds[1] < foodNeeds[2], 'Actual authoritative forecast uses each mode consumption rule');
const dayResults = [story, survival, realistic].map(state => { const input = structuredClone(state); input.stock.food = 100; input.stock.water = 100; return endDay(input, world, []); });
assert.ok(dayResults[0].state.stock.water > dayResults[1].state.stock.water && dayResults[1].state.stock.water > dayResults[2].state.stock.water, 'Resolved water consumption matches the mode distinction');
const injury = (difficulty: Difficulty) => {
  const state = game(difficulty); state.stock.ammo = 100; state.zones[zone.id].zombies = 80;
  const result = endDay(state, world, [{ id: 'campaign-risk', action: 'clear', zoneId: zone.id, survivorIds: ['marius'] }]);
  const line = result.report.lines.find(entry => entry.title === 'Marius ble skadet');
  assert.ok(line, 'The deterministic risky-clear scenario must actually produce an injury');
  return Number(line.text.match(/(\d+) i skade/)?.[1]);
};
assert.ok(injury('story') < injury('realistic'), 'The same real injury scenario applies different risk consequences');
assert.ok(campaignHints(story).length > 0 && !campaignHints(survival).length && !campaignHints(realistic).length, 'Story provides real hints without giving the other modes incorrect help flags');

// A missing-food day kills the already critical avatar through the real day engine.
function famine(hardcore: boolean) {
  const state = game('survival', hardcore);
  state.stock.food = 0; state.stock.water = 0;
  state.survivors.find(person => person.id === 'ingrid')!.health = 1;
  return endDay(state, world, []).state;
}
const ordinaryDeath = famine(false);
assert.equal(campaignAvatarStatus(ordinaryDeath).status, 'dead');
assert.equal(ordinaryDeath.gameOver, undefined, 'Three living survivors keep normal society alive');
assert.equal(campaignAvatarId(ordinaryDeath), 'ingrid', 'No automatic successor replaces the physical avatar');
assert.equal(campaignAvatarStatus(ordinaryDeath).needsSuccessor, true);
const successor = chooseCampaignAvatar(ordinaryDeath, 'tor');
assert.equal(campaignAvatarId(successor), 'tor');
assert.equal(campaignAvatarId(ordinaryDeath), 'ingrid', 'Explicit succession does not mutate the prior save');
const permanentDeath = famine(true);
assert.match(permanentDeath.gameOver?.reason ?? '', /Hardcore/);
assert.notEqual(permanentDeath.gameOver?.won, true);
assert.throws(() => chooseCampaignAvatar(permanentDeath, 'tor'), /avsluttet/);
const away = game();
away.survivors.find(person => person.id === 'ingrid')!.awayUntil = 5;
assert.equal(campaignAvatarId(away), 'ingrid');
assert.equal(campaignAvatarStatus(away).needsSuccessor, false);
assert.throws(() => chooseCampaignAvatar(away, 'tor'), /bortreist/);

// The three existing victory gates remain authoritative; only their derived epilogue is new.
const cure = game(); cure.phase = 5; cure.research.done.push('cure'); cure.population.adults = 7; cure.population.sick = 3;
cure.memory.push({ day: 0, text: 'Dere delte vann med naboene.' });
checkVictory(cure, 0);
assert.equal(cure.gameOver?.won, true);
assert.equal(cure.campaign?.ending?.kind, 'cure');
assert.equal(cure.campaign?.ending?.facts.population, 11, 'Sick people are a subset, not extra population');
assert.ok(cure.campaign?.ending?.epilogue.some(line => line.includes('delte vann')));
const alliance = game(); alliance.phase = 5;
alliance.factions.push({ id: 'neighbours', name: 'Naboene', zoneId: zone.id, about: '', offers: [], wants: [], stock: {}, relation: 75, known: true });
checkVictory(alliance, 0);
assert.equal(alliance.campaign?.ending?.kind, 'alliance');
const stable = game(); stable.phase = 5; stable.counters.stable = 29;
stable.factions.push({ ...alliance.factions[0], relation: 0 });
checkVictory(stable, 1);
assert.equal(stable.campaign?.ending?.kind, 'stable');
assert.equal(stable.campaign?.ending?.facts.stableDays, 30);
const deathBeforeCure = game('survival', true); deathBeforeCure.phase = 5; deathBeforeCure.research.done.push('cure'); deathBeforeCure.survivors[0].alive = false;
checkVictory(deathBeforeCure, 1);
assert.notEqual(deathBeforeCure.gameOver?.won, true, 'Hardcore death overrides victory on the same turn');
assert.equal(deathBeforeCure.campaign?.ending, undefined);

// Exercise the actual adapter against a durable single-file store; fault injection only simulates quota failure.
const directory = mkdtempSync(join(tmpdir(), 'stavangerz-campaign-'));
function diskStorage(): RegionSaveStorage {
  const file = join(directory, 'local-save.json');
  return {
    getItem(key) { assert.equal(key, SAVE_KEY_REGION); return existsSync(file) ? readFileSync(file, 'utf8') : null; },
    setItem(key, value) { assert.equal(key, SAVE_KEY_REGION); writeFileSync(`${file}.new`, value); renameSync(`${file}.new`, file); },
    removeItem(key) { assert.equal(key, SAVE_KEY_REGION); rmSync(file, { force: true }); },
  };
}
const savedShape = (state: RegionState) => JSON.parse(JSON.stringify(state)) as RegionState;
try {
  const storage = diskStorage();
  const legacy = game(); delete legacy.campaign;
  storage.setItem(SAVE_KEY_REGION, JSON.stringify(legacy));
  assert.deepEqual(loadRegionSave(diskStorage()), savedShape(legacy));
  assert.equal(campaignFor(legacy).difficulty, 'survival');
  assert.equal(campaignFor(legacy).hardcore, false);
  const initial = game('survival', true);
  initial.zones[zone.id].status = 'controlled'; initial.zones[zone.id].zombies = 70; initial.stock.ammo = 40;
  saveRegionState(initial, { storage, replace: true });
  const paused = startRegionDay(initial, world, [], { avatarId: 'ingrid' });
  assert.equal(paused.status, 'paused');
  if (paused.status !== 'paused') throw new Error('Expected real persisted HQ decision');
  saveRegionState(paused.state, { storage });
  const reloadedCheckpoint = loadRegionSave(diskStorage())!;
  assert.deepEqual(reloadedCheckpoint, savedShape(paused.state), 'Fresh adapter reload recovers the exact authoritative checkpoint');
  const answered = resumeRegionDay(reloadedCheckpoint, world, 'hold').state;
  saveRegionState(answered, { storage });
  assert.deepEqual(loadRegionSave(diskStorage()), savedShape(answered), 'Reload after the answer retains it and does not settle again');
  assert.throws(() => saveRegionState(reloadedCheckpoint, { storage }), (error: unknown) => error instanceof RegionSaveError && error.code === 'rewind');
  const changedAnswer = resumeRegionDay(reloadedCheckpoint, world, 'fire').state;
  assert.throws(() => saveRegionState(changedAnswer, { storage }), (error: unknown) => error instanceof RegionSaveError && error.code === 'rewind', 'A sibling choice cannot replace the answer already saved');
  const uncommitted = structuredClone(answered); uncommitted.flags.rewind = 1;
  assert.throws(() => saveRegionState(uncommitted, { storage }), (error: unknown) => error instanceof RegionSaveError && error.code === 'rewind', 'Changing data without a new authoritative commit is rejected');
  const next = structuredClone(answered); next.flags.newFact = 1; advanceCampaignCommit(next, 'test:next-authoritative-mutation');
  const brokenStorage: RegionSaveStorage = { ...storage, setItem() { throw new Error('QuotaExceededError'); } };
  assert.throws(() => saveRegionState(next, { storage: brokenStorage }), (error: unknown) => error instanceof RegionSaveError && error.code === 'write');
  assert.deepEqual(loadRegionSave(diskStorage()), savedShape(answered), 'Failed write leaves the complete previous checkpoint and high-water mark intact');
  assert.throws(() => saveRegionState(game(), { storage }), /Hardcore/);
  saveRegionState(game(), { storage, replace: true });
  assert.equal(campaignFor(loadRegionSave(storage)!).hardcore, false, 'An explicitly new run may replace an abandoned Hardcore run');
  storage.setItem(SAVE_KEY_REGION, '{broken');
  assert.throws(() => loadRegionSave(storage), (error: unknown) => error instanceof RegionSaveError && error.code === 'invalid');
  assert.equal(storage.getItem(SAVE_KEY_REGION), '{broken', 'A corrupt save is reported, never silently overwritten');
  assert.throws(() => clearRegionSave(storage), (error: unknown) => error instanceof RegionSaveError && error.code === 'invalid');
  assert.equal(storage.getItem(SAVE_KEY_REGION), '{broken', 'Leaving a run cannot erase corrupt data');
  storage.removeItem(SAVE_KEY_REGION); // Explicit test cleanup, not automatic recovery.
  assert.equal(loadRegionSave(storage), null);
} finally { rmSync(directory, { recursive: true, force: true }); }
console.log('PASS v0.4 campaign: real mode supplies/flows/day, permanent HC death, explicit succession, fixed away-avatar, three derived endings, disk reload/checkpoint and HC rewind/divergence/write-failure rejection.');
