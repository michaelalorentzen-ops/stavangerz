/** Focused integration fixtures; the separate check-region-ui journey starts naturally.
 * This script exercises real browser controls on late-game and field-checkpoint saves.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { newRegionGame, indexWorld, SAVE_KEY_REGION, pendingTurnDecision, startRegionDay, continueRegionDay, botChooseEvent, type RegionState, type RegionWorld, type RegionOrder } from '../packages/gameplay/src/region/index';
import { campaignFor } from '../packages/gameplay/src/region/campaign';
import { administrations } from '../packages/gameplay/src/region/administration';
const baseURL = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/v04-completion';
mkdirSync(output, { recursive: true });
const read = (page: Page) => page.evaluate(() => (window as unknown as { __szRegion: { state: RegionState; orders: RegionOrder[] } }).__szRegion);
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const world: RegionWorld = await (await fetch(`${baseURL}/world/region-v1.json`)).json();
  const index = indexWorld(world);
  const camp = world.starts.find(s => s.name.startsWith('Lundsneset'))!.zoneId;
  const neighbor = index.adjacent.get(camp)![0].to;
  const results: unknown[] = [];
  async function fixture(page: Page, state: RegionState) {
    await page.goto(baseURL); await page.getByTestId('start-game').waitFor();
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY_REGION, state });
    await page.reload(); await page.getByRole('button', { name: /Fortsett dag/ }).click();
    await page.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
    await page.locator('.rz-map[aria-busy="false"]').waitFor();
  }
  async function closeReport(page: Page) {
    for (let tries = 0; tries < 30; tries++) {
      const { state } = await read(page);
      const pending = pendingTurnDecision(state);
      if (pending) {
        const choice = pending.choices.find(c => c.id === 'hold' || c.id === 'proceed') ?? pending.choices.find(c => !c.disabled)!;
        await page.getByRole('dialog', { name: pending.title, exact: true }).getByRole('button').filter({ hasText: choice.label }).click();
      }
      if (state.event) {
        const choice = state.event.choices.find(c => c.id === botChooseEvent(state))!;
        await page.getByRole('dialog', { name: state.event.title, exact: true }).getByRole('button').filter({ hasText: choice.label }).click();
      }
      const skip = page.getByTestId('skip-replay'); if (await skip.isVisible()) await skip.click();
      const report = page.locator('[role="dialog"]').filter({ has: page.locator('.rz-daily-report') });
      if (await report.isVisible()) { await report.getByRole('button', { name: 'Lukk', exact: true }).click(); return; }
      await page.waitForTimeout(200);
    }
    throw new Error('Fixture day did not settle.');
  }
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const state = newRegionGame(world, camp, 801, { difficulty: 'story', avatarId: 'ingrid', runId: 'regional-ui-fixture' });
    state.phase = 4; state.phaseDay = 0; state.event = undefined;
    for (const z of Object.values(state.zones)) z.zombies = 0;
    state.zones[camp].status = state.zones[neighbor].status = 'controlled';
    state.hq = { zoneId: camp, type: 'camp', modules: [] };
    state.stock.food = state.stock.water = 200; state.stock.ammo = 100;
    state.population.adults = 8;
    state.crewPositions = Object.fromEntries(state.survivors.map(p => [p.id, { kind: 'zone', zoneId: p.id === 'tor' ? neighbor : camp }]));
    await fixture(page, state);
    await page.getByRole('button', { name: 'Oversikter', exact: true }).click();
    await page.getByRole('button', { name: /^Regionale ledere/ }).click();
    await page.getByRole('button', { name: 'Etabler HQ', exact: true }).click();
    assert.equal(administrations((await read(page)).state).length, 1);
    await page.locator('.regional-card label').filter({ hasText: /^Mandat/ }).locator('select').selectOption('defense');
    assert.equal(administrations((await read(page)).state)[0].policy, 'defense');
    await page.screenshot({ path: `${output}/desktop-regional-hq.png` });
    await page.keyboard.press('Escape');
    await page.locator('.rz-person').filter({ hasText: 'Marius' }).click();
    const nearby = page.locator('.rz-nearby'); await nearby.locator('summary').click();
    await nearby.getByRole('textbox').fill(index.byId.get(neighbor)!.name);
    await nearby.locator(`[data-zone-id="${neighbor}"]`).click();
    const panel = page.locator('.rz-logistics'); await panel.locator('label').filter({ hasText: /^Oppdrag/ }).locator('select').selectOption('supply');
    await panel.getByLabel(/^Mat ·/).fill('12'); await panel.getByLabel(/^Vann ·/).fill('12');
    await panel.getByLabel(/^Voksne ·/).fill('2');
    await panel.getByRole('button', { name: 'Legg forsendelse i dagsplanen' }).click();
    assert.equal((await read(page)).orders[0].logistics?.passengers?.adults, 2);
    const beforeStock = (await read(page)).state.stock.food;
    await page.getByTestId('end-day').click(); await closeReport(page);
    const delivered = (await read(page)).state;
    assert(delivered.stock.food < beforeStock, 'Transport and ordinary consumption reduce central stock.');
    assert((delivered.mobility?.depots[neighbor]?.food ?? 0) > 0, 'Supply really arrived at the remote depot.');
    assert.equal(delivered.mobility?.depotResidents?.[neighbor]?.adults, 2, 'Passengers physically arrived.');
    await page.getByRole('button', { name: 'Oversikter', exact: true }).click(); await page.getByRole('button', { name: /^Regionale ledere/ }).click();
    const population = page.locator('.regional-card fieldset').filter({ has: page.getByText('Lokale innbyggere', { exact: true }) });
    await population.getByLabel('Voksne', { exact: true }).fill('2');
    await population.getByRole('button', { name: 'Oppdater lokal allokering' }).click();
    assert.equal(administrations((await read(page)).state)[0].residents.adults, 2);
    await page.keyboard.press('Escape');
    for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Zoom ut', exact: true }).click(); await page.waitForTimeout(350); }
    await page.waitForTimeout(700);
    assert((await page.locator('.rz-command-level').innerText()).includes('L2'));
    assert(await page.locator('.rz-map-area-label').count() > 0, 'Known district summaries are visible.');
    await page.locator('.rz-map-area-label').first().click();
    await page.locator('.rz-area-panel').waitFor();
    await page.screenshot({ path: `${output}/desktop-district-crew.png` });
    const committed = (await read(page)).state;
    await page.reload(); await page.getByRole('button', { name: /Fortsett dag/ }).click();
    await page.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
    assert.deepEqual((await read(page)).state, committed, 'Regional decisions survive exact reload.');
    assert.deepEqual(errors, []);
    results.push({ scenario: 'regional UI', day: committed.day, deliveredDepot: delivered.mobility?.depots[neighbor], residents: administrations(committed)[0].residents, errors });
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mp = await mobile.newPage(); const mobileErrors: string[] = [];
    mp.on('pageerror', e => mobileErrors.push(e.message));
    await mp.goto(baseURL);
    await mp.getByRole('radio', { name: /Realistic/ }).check();
    await mp.getByRole('checkbox', { name: /Hardcore/ }).check();
    await mp.getByTestId('start-game').click();
    for (let i = 0; i < 4; i++) await mp.getByTestId('intro-next').click();
    await mp.getByRole('dialog', { name: 'Velg hovedperson', exact: true }).getByRole('button').filter({ hasText: 'Ingrid' }).click();
    assert.equal(campaignFor((await read(mp)).state).difficulty, 'realistic');
    assert.equal(campaignFor((await read(mp)).state).hardcore, true);
    await mp.screenshot({ path: `${output}/mobile-realistic-hardcore.png` });
    await mobile.close();

    const fieldContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const fp = await fieldContext.newPage(); fp.on('pageerror', e => mobileErrors.push(e.message));
    const field = newRegionGame(world, camp, 805, { difficulty: 'story', hardcore: true, avatarId: 'ingrid', runId: 'field-ui-fixture' });
    field.event = undefined; for (const z of Object.values(field.zones)) z.zombies = 0;
    field.zones[camp].status = 'controlled'; field.zones[neighbor].status = 'scouted'; field.zones[neighbor].zombies = 70;
    field.stock.food = field.stock.water = 200;
    const paused = startRegionDay(field, world, [{ id: 'field-test', action: 'search', zoneId: neighbor, survivorIds: ['ingrid'] }]);
    assert.equal(paused.status, 'paused'); if (paused.status !== 'paused') throw new Error('Expected actual field checkpoint.');
    const decision = pendingTurnDecision(paused.state)!; assert.equal(decision.kind, 'field-encounter');
    await fixture(fp, paused.state);
    const dialog = fp.getByRole('dialog', { name: decision.title, exact: true });
    await dialog.waitFor(); await fp.keyboard.press('Escape'); assert(await dialog.isVisible());
    await fp.reload(); await fp.getByRole('button', { name: /Fortsett dag/ }).click(); await dialog.waitFor();
    await fp.screenshot({ path: `${output}/mobile-field-checkpoint.png` });
    const expected = continueRegionDay(paused.state, world, 'withdraw');
    await dialog.getByRole('button').filter({ hasText: 'Trekk laget tilbake' }).click();
    await fp.waitForFunction(() => (window as unknown as { __szRegion?: { state: RegionState } }).__szRegion?.state.day === 1);
    assert.deepEqual((await read(fp)).state, expected.state, 'Mobile field choice equals deterministic one-time continuation.');
    const exact = (await read(fp)).state;
    await fp.reload(); await fp.getByRole('button', { name: /Fortsett dag/ }).click();
    await fp.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
    assert.deepEqual((await read(fp)).state, exact);
    const width = await fp.evaluate(() => ({ actual: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.equal(width.actual, width.scroll); assert.deepEqual(mobileErrors, []);
    results.push({ scenario: 'mobile modes and HC field pause', exactReload: true, width, errors: mobileErrors });
    await fieldContext.close();
    console.log('PASS actual regional establishment/mandate/supply/passengers/local allocation/map L2/exact reload; mobile mode selection and mandatory HC field checkpoint/reload/withdraw.');
  } finally { writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
