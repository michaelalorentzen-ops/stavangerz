/** New-HUD checkpoints only: real engine pauses, mandatory choices and exact persistence. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { newRegionGame, indexWorld, SAVE_KEY_REGION, pendingTurnDecision, startRegionDay, continueRegionDay, type RegionState, type RegionWorld } from '../packages/gameplay/src/region/index';
import { saveRegionState } from '../apps/game-client/app/region-save';
const baseURL = process.env.REGION_TEST_URL ?? 'http://localhost:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/hud-checkpoints';
const read = (page: Page) => page.evaluate(() => (window as unknown as { __szRegion: { state: RegionState } }).__szRegion.state);
const stored = (page: Page) => page.evaluate(key => { const save = JSON.parse(localStorage.getItem(key)!); return (save.state ?? save) as RegionState; }, SAVE_KEY_REGION);
async function resume(page: Page) {
  await page.getByRole('button', { name: /Fortsett dag/ }).click();
  await page.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
}
async function main() {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
  const world: RegionWorld = await (await fetch(`${baseURL}/world/region-v1.json`)).json();
  const camp = world.starts.find(s => s.name.startsWith('Lundsneset'))!.zoneId;
  const neighbor = indexWorld(world).adjacent.get(camp)![0].to;
  const results: unknown[] = [];
  try {
    for (const kind of ['field', 'night'] as const) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
      const page = await context.newPage(); const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const state = newRegionGame(world, camp, kind === 'field' ? 805 : 1551, { difficulty: 'story', hardcore: true, avatarId: 'ingrid', runId: `hud-${kind}-checkpoint` });
      delete state.event; for (const zone of Object.values(state.zones)) zone.zombies = 0;
      state.zones[camp].status = 'controlled'; state.stock.food = state.stock.water = 200; state.stock.ammo = 40;
      if (kind === 'field') { state.zones[neighbor].status = 'scouted'; state.zones[neighbor].zombies = 70; }
      else { state.hq = { zoneId: camp, type: 'camp', modules: [] }; state.zones[camp].zombies = 70; }
      const paused = startRegionDay(state, world, kind === 'field' ? [{ id: 'field-test', action: 'search', zoneId: neighbor, survivorIds: ['ingrid'] }] : [], { avatarId: 'ingrid' });
      assert.equal(paused.status, 'paused'); if (paused.status !== 'paused') throw new Error(`Missing ${kind} checkpoint`);
      const decision = pendingTurnDecision(paused.state)!;
      assert.equal(decision.kind, kind === 'field' ? 'field-encounter' : 'hq-night-defence');
      const choiceId = kind === 'field' ? 'withdraw' : 'fire';
      const choice = decision.choices.find(c => c.id === choiceId)!; assert(!choice.disabled);
      const expected = continueRegionDay(paused.state, world, choiceId); assert.equal(expected.status, 'complete');
      // Real save envelope, including the Hardcore high-water receipt, followed by actual Fortsett controls.
      let save = ''; saveRegionState(paused.state, { storage: { getItem: () => null, setItem: (_key, value) => { save = value; }, removeItem: () => {} } });
      await page.goto(baseURL); await page.getByTestId('start-game').waitFor();
      await page.evaluate(({ key, save }) => localStorage.setItem(key, save), { key: SAVE_KEY_REGION, save });
      await page.reload(); await resume(page);
      const dialog = page.getByRole('dialog', { name: decision.title, exact: true }); await dialog.waitFor();
      assert.deepEqual(await read(page), paused.state, 'Checkpoint loading preserves exact state.');
      assert.equal(await page.getByTestId('skip-replay').count(), 0, 'Mandatory choice exposes no Skip, even with motion enabled.');
      assert(await page.getByTestId('end-day').isDisabled(), 'Checkpoint blocks another day.');
      await page.keyboard.press('Escape'); assert(await dialog.isVisible(), 'Escape cannot dismiss the checkpoint.');
      assert.deepEqual(await read(page), paused.state, 'Escape cannot settle or mutate the checkpoint.');
      assert.deepEqual(await stored(page), paused.state, 'Persisted checkpoint remains exact.');
      await page.reload(); await resume(page); await dialog.waitFor();
      assert.deepEqual(await read(page), paused.state, 'Unresolved choice survives exact reload.');
      await page.screenshot({ path: `${output}/mobile-${kind}-pending.png` });
      await dialog.getByRole('button').filter({ hasText: choice.label }).click();
      await page.waitForFunction(() => (window as unknown as { __szRegion?: { state: RegionState } }).__szRegion?.state.day === 1);
      assert.deepEqual(await read(page), expected.state, 'UI equals deterministic continueRegionDay, including one-time costs.');
      assert.deepEqual(await stored(page), expected.state, 'Resolved state is saved exactly.');
      await page.reload(); await resume(page);
      assert.deepEqual(await read(page), expected.state, 'Reload cannot repeat settlement or charges.');
      assert.equal(pendingTurnDecision(await read(page)), undefined); assert.deepEqual(errors, []);
      results.push({ kind, choice: choiceId, skipUnavailable: true, escapeBlocked: true, exactReloadBeforeAndAfter: true, oracleEqual: true, day: expected.state.day, ammo: expected.state.stock.ammo });
      await context.close();
    }
    console.log('PASS HUD field + night: actual saved checkpoints; Skip unavailable; Escape blocked; exact reload before/after; choices equal continueRegionDay.');
  } catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
      writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), body: await page.locator('body').innerText().catch(() => ''), state: await read(page).catch(() => null) }, null, 2));
    }
    throw error;
  } finally { writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
