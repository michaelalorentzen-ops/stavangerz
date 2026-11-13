/** Focused integration fixtures; the separate check-region-ui journey starts naturally.
 * This script exercises real browser controls on late-game and field-checkpoint saves.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { newRegionGame, indexWorld, SAVE_KEY_REGION, pendingTurnDecision, startRegionDay, continueRegionDay, botChooseEvent, type RegionState, type RegionWorld, type RegionOrder } from '../packages/gameplay/src/region/index';
import { checkVictory } from '../packages/gameplay/src/region/progress';
import { campaignFor, enforceAvatarFate } from '../packages/gameplay/src/region/campaign';
import { discoverySites, observeDiscoveries, visibleDiscoveries } from '../packages/gameplay/src/region/discoveries';
import { gainWonder, wonderOperational, wonderStatus, WONDERS, wonderZone } from '../packages/gameplay/src/region/wonders';
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
    await page.reload(); await page.getByRole('button', { name: /Fortsett dag|Vis avslutningen etter/ }).click();
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
    await page.locator('.rz-person').filter({ hasText: 'Leila' }).click();
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
    assert.equal(administrations(delivered)[0].residents.adults + (delivered.mobility?.depotResidents?.[neighbor]?.adults ?? 0), 2, 'Passengers physically arrived and joined the local community.');
    await page.getByRole('button', { name: 'Oversikter', exact: true }).click(); await page.getByRole('button', { name: /^Regionale ledere/ }).click();
    const population = page.locator('.regional-card fieldset').filter({ has: page.getByText('Lokale innbyggere', { exact: true }) });
    await population.getByLabel('Voksne', { exact: true }).fill('1');
    await population.getByRole('button', { name: 'Oppdater lokal allokering' }).click();
    assert.equal(administrations((await read(page)).state)[0].residents.adults, 1);
    assert.equal((await read(page)).state.mobility?.depotResidents?.[neighbor]?.adults, 1, 'Released local residents remain physically at that depot.');
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
    const storyContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const sp = await storyContext.newPage(); const storyErrors: string[] = []; sp.on('pageerror', e => storyErrors.push(e.message));
    const story = newRegionGame(world, camp, 806, { difficulty: 'story', avatarId: 'ingrid', runId: 'story-ui-fixture' });
    story.event = undefined; const site = discoverySites(story, world).ordinary!;
    story.homeZoneId = site.zoneId; story.zones[site.zoneId].status = 'controlled';
    for (const z of Object.values(story.zones)) z.zombies = 0;
    story.stock.food = story.stock.water = 200;
    story.crewPositions = Object.fromEntries(story.survivors.map(p => [p.id, { kind: 'zone', zoneId: story.homeZoneId }]));
    observeDiscoveries(story, world, { source: 'rumor', zoneId: site.zoneId, reporterIds: ['ingrid'], delivery: 'returned' }, []);
    await fixture(sp, story);
    for (const [turn, target] of [[0, 'emergency-cupboard'], [1, 'emergency-cupboard:rations']] as const) {
      await sp.getByRole('navigation', { name: 'Arbeidsflater' }).getByRole('button', { name: /^Folk/ }).click();
      await sp.locator('.rz-person').filter({ hasText: 'Ingrid' }).click();
      await sp.getByRole('button', { name: 'Oversikter', exact: true }).click(); await sp.getByRole('button', { name: /^Oppdagelser og spor/ }).click();
      await sp.getByTestId(`discovery-${target}`).click();
      assert.equal((await read(sp)).orders.length, 1);
      await sp.getByTestId('end-day').click(); await closeReport(sp);
      const entries = visibleDiscoveries((await read(sp)).state);
      assert.equal(entries[0].status, turn === 0 ? 'choice' : 'resolved');
    }
    await sp.getByRole('button', { name: 'Oversikter', exact: true }).click(); await sp.getByRole('button', { name: /^Oppdagelser og spor/ }).click();
    await sp.getByRole('button', { name: /Avsluttede/ }).click();
    await sp.screenshot({ path: `${output}/mobile-completed-poi-story.png` });
    assert.deepEqual(storyErrors, []); results.push({ scenario: 'mobile optional POI story', days: 2, entries: visibleDiscoveries((await read(sp)).state), errors: storyErrors });
    await storyContext.close();

    const wonderContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const wp = await wonderContext.newPage(); const wonderErrors: string[] = []; wp.on('pageerror', e => wonderErrors.push(e.message));
    const def = WONDERS.find(w => w.id === 'cathedral')!, wz = wonderZone(world, def)!;
    const installation = newRegionGame(world, wz, 807, { difficulty: 'story', avatarId: 'ingrid', runId: 'installation-ui-fixture' });
    installation.event = undefined; for (const z of Object.values(installation.zones)) z.zombies = 0;
    installation.zones[wz].status = 'controlled'; installation.stock.food = installation.stock.water = 200; installation.stock.building = 100;
    gainWonder(installation, world, def.id, [], wz);
    await fixture(wp, installation);
    for (const status of ['secured', 'operational'] as const) {
      await wp.locator('.rz-person').filter({ hasText: 'Marius' }).click(); await wp.locator('.rz-person').filter({ hasText: 'Tor' }).click();
      await wp.getByRole('button', { name: 'Oversikter', exact: true }).click(); await wp.getByRole('button', { name: /^Unike steder/ }).click();
      await wp.getByTestId('wonder-order-cathedral').click();
      await wp.getByTestId('end-day').click(); await closeReport(wp);
      assert.equal(wonderStatus((await read(wp)).state.wonders!.cathedral), status);
    }
    assert(wonderOperational((await read(wp)).state.wonders!.cathedral));
    await wp.getByRole('button', { name: 'Oversikter', exact: true }).click(); await wp.getByRole('button', { name: /^Unike steder/ }).click();
    await wp.screenshot({ path: `${output}/desktop-operational-installation.png` });
    assert.deepEqual(wonderErrors, []); results.push({ scenario: 'explicit unique installation', status: 'operational', days: 2, errors: wonderErrors });
    await wonderContext.close();
    const phaseContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const pp = await phaseContext.newPage(); const phaseErrors: string[] = []; pp.on('pageerror', e => phaseErrors.push(e.message));
    const ready = newRegionGame(world, camp, 808, { difficulty: 'story', avatarId: 'ingrid', runId: 'phase-ui-fixture' });
    ready.event = undefined; for (const z of Object.values(ready.zones)) z.zombies = 0;
    ready.hq = { zoneId: camp, type: 'camp', modules: [] }; ready.stock.food = ready.stock.water = 200;
    const district = index.byId.get(camp)!.parentId; const core = [camp];
    for (let i = 0; i < core.length && core.length < 3; i++) for (const edge of index.adjacent.get(core[i]) ?? []) {
      if (index.byId.get(edge.to)?.parentId === district && !core.includes(edge.to)) core.push(edge.to);
      if (core.length === 3) break;
    }
    assert.equal(core.length, 3); for (const id of core) ready.zones[id].status = 'controlled';
    const boundary = core.flatMap(id => index.adjacent.get(id) ?? []).find(edge => ready.zones[edge.to].status !== 'controlled')!;
    ready.barricades[boundary.connId] = 12;
    await fixture(pp, ready);
    await pp.getByTestId('end-day').click(); await pp.getByRole('button', { name: 'La døgnet gå uten oppdrag', exact: true }).click(); await closeReport(pp);
    assert.equal((await read(pp)).state.phase, 2, 'D25 unlocks a ready core in the actual day flow.');
    await pp.locator('.rz-phase-dialog').waitFor(); await pp.screenshot({ path: `${output}/mobile-phase-two.png` });
    await pp.locator('.rz-phase-dialog').getByRole('button', { name: 'Videre', exact: true }).click();
    await pp.getByTestId('open-book').click();
    const chapter = pp.getByRole('button', { name: /^Kapittel 2:/ }); assert(await chapter.isEnabled()); await chapter.click();
    assert(await pp.locator('.zab-paper').isVisible());
    assert.deepEqual(phaseErrors, []); results.push({ scenario: 'D25 mobile phase progression', phase: 2, chapterTwoUnlocked: true, errors: phaseErrors });
    await phaseContext.close();
    for (const won of [true, false]) {
      const endingContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
      const ep = await endingContext.newPage(); const endingErrors: string[] = []; ep.on('pageerror', e => endingErrors.push(e.message));
      const ending = newRegionGame(world, camp, 809, { difficulty: 'story', hardcore: !won, avatarId: 'ingrid', runId: `ending-ui-fixture-${won}` });
      ending.event = undefined;
      if (won) { ending.phase = 5; ending.research.done.push('cure'); ending.memory.push({ day: 0, text: 'Dere delte vann med naboene.' }); checkVictory(ending, 0); }
      else { ending.survivors.find(p => p.id === 'ingrid')!.alive = false; enforceAvatarFate(ending); }
      assert.equal(ending.gameOver?.won, won);
      await fixture(ep, ending);
      await ep.getByRole('dialog', { name: 'Gjennomspillingen er over', exact: true }).waitFor();
      assert(await ep.locator('.cmp-ending').isVisible());
      assert((await ep.locator('.cmp-ending').innerText()).includes(ending.campaign!.ending!.title));
      await ep.screenshot({ path: `${output}/mobile-ending-${won ? 'win' : 'hardcore-loss'}.png` });
      assert.deepEqual(endingErrors, []); results.push({ scenario: won ? 'derived victory epilogue UI' : 'permanent HC death UI', errors: endingErrors });
      await endingContext.close();
    }
    console.log('PASS actual regional establishment/mandate/supply/passengers/local allocation/map L2/exact reload; mobile mode selection and mandatory HC field checkpoint/reload/withdraw, optional POI story and two-stage unique installation.');
  } catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: `${output}/failure-${page.viewportSize()?.width}.png`, fullPage: true }).catch(() => {});
      writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), text: await page.locator('body').innerText().catch(() => ''), game: await read(page).catch(() => null) }, null, 2));
    }
    throw error;
  } finally { writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
