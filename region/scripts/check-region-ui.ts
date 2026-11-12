/** Actual UI journey plus an explicit checkpoint-save fixture; start the local server first.
 * The desktop/mobile journeys start normally and never inject game state.
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm check:region-ui
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { ACTIONS, SAVE_KEY_REGION, botChooseEvent, botPlanDay, newRegionGame, startRegionDay, resumeRegionDay, type RegionState, type RegionWorld, type RegionOrder } from '../packages/gameplay/src/region/index';

const baseURL = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/region-ui';
mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const results: unknown[] = [];
  let fixtureWorld: RegionWorld | undefined;
  const read = (page: Page) => page.evaluate(() => (window as unknown as { __szRegion: { state: RegionState; world: RegionWorld; orders: RegionOrder[] } }).__szRegion);
  const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 821;
  async function surface(page: Page, name: 'Folk' | 'Kart' | 'Sone') {
    if (!isMobile(page)) return;
    const button = page.getByRole('navigation', { name: 'Arbeidsflater' }).getByRole('button', { name: new RegExp(`^${name}`) });
    if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
  }
  async function order(page: Page, planned: Omit<RegionOrder, 'id'>) {
    const { state, world } = await read(page);
    console.log(`Plan day ${state.day}: ${planned.action} ${planned.zoneId}`);
    await surface(page, 'Folk');
    for (const id of planned.survivorIds) {
      const person = state.survivors.find(p => p.id === id)!;
      await page.locator('.rz-person').filter({ has: page.locator('strong', { hasText: person.name }) }).click();
    }
    await surface(page, 'Kart');
    const nearby = page.locator('.rz-nearby');
    if (!await nearby.evaluate(el => (el as HTMLDetailsElement).open)) await nearby.locator('summary').click();
    await nearby.getByRole('textbox', { name: 'Søk etter sone' }).fill(world.zones.find(z => z.id === planned.zoneId)!.name);
    await nearby.locator(`[data-zone-id="${planned.zoneId}"]`).click();
    const action = page.locator('.rz-action').filter({ has: page.getByRole('button', { name: `Planlegg ${ACTIONS[planned.action].label}`, exact: true }) });
    if (planned.target) await action.locator('select').selectOption(planned.target);
    await action.getByRole('button').click();
    assert.equal((await read(page)).orders.at(-1)?.action, planned.action);
  }
  async function settle(page: Page, skip: boolean) {
    // Every blocking choice is made with a real button. Skip cannot settle it.
    for (let tries = 0; tries < 16; tries++) {
      const night = page.getByRole('dialog', { name: 'Nattangrep ved HQ' });
      if (await night.isVisible()) await night.getByRole('button', { name: 'Hold stillingen' }).click();
      const replay = page.getByTestId('skip-replay');
      if (skip && await replay.isVisible()) await replay.click();
      const { state } = await read(page);
      if (state.event && await page.getByRole('dialog', { name: state.event.title, exact: true }).isVisible()) {
        const choice = state.event.choices.find(c => c.id === botChooseEvent(state))!;
        await page.getByRole('dialog', { name: state.event.title, exact: true }).getByRole('button', { name: new RegExp(`^${choice.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();
      }
      const report = page.locator('[role="dialog"]').filter({ has: page.locator('.rz-daily-report') });
      if (await report.isVisible()) {
        const currentReport = (await read(page)).state.reports.at(-1);
        const text = await report.innerText();
        for (const line of currentReport?.lines ?? []) if (line.text.startsWith('Dere valgte: ')) assert(text.includes(line.text), 'The displayed report includes the actual event choice.');
        if (currentReport?.lines.some(line => line.text.startsWith('Dere valgte: '))) assert(!text.includes('En hendelse krever et valg.'), 'A resolved event is not presented as pending.');
        await page.screenshot({ path: `${output}/latest-report-${page.viewportSize()?.width}.png` }); await report.getByRole('button', { name: 'Lukk', exact: true }).click(); return; }
      await page.waitForTimeout(350);
    }
    throw new Error('Day did not reach its report.');
  }
  try {
    for (const [label, viewport, days] of [['desktop', { width: 1440, height: 1000 }, 8], ['mobile', { width: 390, height: 844 }, 6]] as const) {
      if (process.env.REGION_TEST_VIEWPORT === 'checkpoint') {
        fixtureWorld = JSON.parse(await (await fetch(`${baseURL}/world/region-v1.json`)).text()) as RegionWorld;
        break;
      }
      if (process.env.REGION_TEST_VIEWPORT && process.env.REGION_TEST_VIEWPORT !== label) continue;
      const context = await browser.newContext({ viewport, reducedMotion: 'no-preference', isMobile: label === 'mobile', hasTouch: label === 'mobile' });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', e => { errors.push(e.message); console.log('BROWSER ERROR', e.message); });
      page.setDefaultTimeout(15000);
      console.log(`START ${label}`);
      await page.goto(baseURL);
      await page.getByTestId('start-game').waitFor();
      await page.locator('input[type="number"]').fill('101');
      await page.locator('.rz-start-canvas[aria-busy="false"]').waitFor();
      await page.screenshot({ path: `${output}/${label}-start.png`, fullPage: true });
      await page.getByTestId('start-game').click();
      // Read the complete introduction, rather than skipping it.
      for (let i = 0; i < 4; i++) await page.getByTestId('intro-next').click();
      await page.getByRole('dialog', { name: 'Velg hovedperson' }).getByRole('button').filter({ hasText: 'Ingrid' }).click();
      await page.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
      await page.locator('.rz-map[aria-busy="false"]').waitFor();
      if (label === 'mobile') {
        const canvas = page.locator('.rz-map canvas');
        const bounds = await canvas.boundingBox();
        assert(bounds);
        await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        assert(await page.locator('.rz-right').isVisible(), 'Touching the map opens the zone panel.');
        await surface(page, 'Kart');
      }
      await page.getByTestId('open-book').click();
      const book = page.getByRole('dialog', { name: 'ZA-boka', exact: true });
      assert.equal(await book.getByRole('button', { name: /Kapittel [2-5] låst/ }).count(), 4);
      await book.getByRole('button', { name: 'Håndbok', exact: true }).click();
      await book.getByRole('button', { name: /Døgnet/ }).click();
      await page.screenshot({ path: `${output}/${label}-book.png` });
      await book.getByRole('button', { name: 'Feltguide' }).click();
      assert.equal(await book.locator('.zab-discovery').count(), 0);
      await page.keyboard.press('Escape');
      // Day 0 is a hand-planned split: combat crew clears; support crew searches.
      const initial = await read(page);
      fixtureWorld = initial.world;
      await order(page, { action: 'clear', zoneId: initial.state.homeZoneId, survivorIds: ['ingrid', 'marius'] });
      await order(page, { action: 'search', zoneId: initial.state.homeZoneId, survivorIds: ['leila', 'tor'] });
      await surface(page, 'Folk');
      await page.getByRole('button', { name: 'Utstyr for Rydd', exact: true }).click();
      const equipment = page.getByRole('dialog', { name: 'Utstyr til oppdraget', exact: true });
      assert(await equipment.getByRole('checkbox', { name: 'Auto equip', exact: true }).isChecked());
      await equipment.getByRole('combobox', { name: 'Våpen for Ingrid', exact: true }).selectOption('starter:ingrid');
      await equipment.getByRole('checkbox', { name: 'Auto equip', exact: true }).uncheck();
      await equipment.getByRole('checkbox', { name: 'Auto equip', exact: true }).check();
      assert(await equipment.getByRole('button', { name: 'Lås opp våpen for Ingrid', exact: true }).getAttribute('aria-pressed') === 'true');
      await page.screenshot({ path: `${output}/${label}-equipment.png` });
      await equipment.getByRole('button', { name: 'Lagre utstyrsvalg', exact: true }).click();
      assert.equal((await read(page)).orders[0].gear?.ingrid?.locks?.weapon, 'starter:ingrid');
      // Cancel and replan to verify that crew becomes available again.
      await surface(page, 'Folk');
      await page.getByRole('button', { name: 'Fjern oppdrag' }).last().click();
      assert.equal((await read(page)).orders.length, 1);
      await order(page, { action: 'search', zoneId: initial.state.homeZoneId, survivorIds: ['leila', 'tor'] });
      const diary: unknown[] = [];
      for (let turn = 0; turn < days; turn++) {
        const before = await read(page);
        if (turn > 0) for (const next of botPlanDay(before.state, before.world)) await order(page, next);
        await page.getByTestId('end-day').click();
        if (await page.getByRole('dialog', { name: 'Ingen planlagte oppdrag' }).isVisible()) await page.getByRole('button', { name: 'La døgnet gå uten oppdrag' }).click();
        await settle(page, turn % 2 === 1);
        const after = (await read(page)).state;
        assert.equal(after.day, before.state.day + 1, 'A single click settles exactly one day.');
        assert(after.gear, 'A normal day materializes compatible unique equipment.');
        assert.equal(new Set(after.gear.items.map(item => item.id)).size, after.gear.items.length, 'No equipment duplication.');
        if (turn === 0) {
          assert(after.gear.items.some(item => item.provenance.kind === 'search'), 'The first real search found personal equipment.');
          assert.equal(after.gear.preferences.ingrid?.locks?.weapon, 'starter:ingrid', 'Manual locks survive the day.');
        }
        console.log(`Settled ${label} day ${after.day}`);
        diary.push({ day: after.day, food: after.stock.food, water: after.stock.water, people: after.survivors.filter(p => p.alive).length, zones: Object.values(after.zones).filter(z => z.status === 'controlled').length, gearItems: after.gear.items.length, personalFinds: after.gear.claimedLoot.length, report: after.reports.at(-1)?.lines.map(l => l.title) });
        assert(!after.gameOver, 'The introductory journey must remain playable.');
      }
      await surface(page, 'Kart');
      await page.getByRole('button', { name: 'Oversikter', exact: true }).click();
      await page.getByRole('button', { name: /^Lager/ }).click();
      assert(await page.locator('.ce-stock-grid li').count() >= 4, 'Known equipment can be inspected without a new mission.');
      await page.screenshot({ path: `${output}/${label}-inventory.png` });
      await page.keyboard.press('Escape');
      await page.getByTestId('open-book').click();
      await page.getByRole('dialog', { name: 'ZA-boka', exact: true }).getByRole('button', { name: /^Feltguide/ }).click();
      assert((await page.locator('.zab-field').innerText()).includes('RAPPORTERTE UTSTYRSFUNN'));
      assert(await page.locator('.zab-field .zab-discovery').count() > 0, 'Reported personal equipment appears in the field guide.');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Oversikter', exact: true }).click();
      await page.getByRole('button', { name: /^Dagsrapporter/ }).click();
      await page.getByRole('combobox', { name: 'Velg dagsrapport' }).selectOption('1');
      assert((await page.locator('.rz-report-hero .rz-kicker').innerText()).includes('DAG 1'), 'Earlier reports remain accessible, including on mobile.');
      await page.keyboard.press('Escape');
      await page.screenshot({ path: `${output}/${label}-day-${days}.png` });
      const beforeReload = (await read(page)).state;
      await page.reload();
      await page.getByRole('button', { name: new RegExp(`Fortsett dag ${days}`) }).click();
      await page.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
      assert.deepEqual((await read(page)).state, beforeReload, 'Save/load preserves the exact authoritative state.');
      const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, mapHeight: document.querySelector('.rz-map')!.getBoundingClientRect().height }));
      assert.equal(sizes.scroll, sizes.width, 'No horizontal page overflow.');
      assert(sizes.mapHeight > 400, 'The map remains the primary play surface.');
      assert.deepEqual(errors, [], 'No browser runtime errors.');
      results.push({ label, viewport, days, sizes, diary, errors });
      console.log(`PASS ${label}: ${days} UI turns, intro, avatar, book, touch map/mobile, gear editor/locks/loot, planning/cancel, replay/skip, report archive and exact save reload.`);
      await context.close();
    }
    assert(fixtureWorld);
    // Separate fixture: real engine checkpoint in a region-2 save, with reduced motion.
    const world = fixtureWorld;
    const camp = world.starts.find(start => start.name.startsWith('Lundsneset'))?.zoneId ?? world.starts[0].zoneId;
    const initial = newRegionGame(world, camp, 1551);
    initial.event = undefined;
    for (const zone of Object.values(initial.zones)) zone.zombies = 0;
    initial.zones[camp].status = 'controlled'; initial.zones[camp].zombies = 70;
    initial.hq = { zoneId: camp, type: 'camp', modules: [] };
    initial.stock.food = initial.stock.water = 200; initial.stock.ammo = 40;
    const avatarId = initial.survivors[0].id;
    initial.flags.playerAvatarId = avatarId;
    const paused = startRegionDay(initial, world, [], { avatarId });
    assert.equal(paused.status, 'paused');
    if (paused.status !== 'paused') throw new Error('Checkpoint fixture failed.');
    const expected = resumeRegionDay(paused.state, world, 'fire');
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL);
    await page.getByTestId('start-game').waitFor();
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY_REGION, state: paused.state });
    await page.reload();
    await page.getByRole('button', { name: /Fortsett dag 0/ }).click();
    const decision = page.getByRole('dialog', { name: 'Nattangrep ved HQ', exact: true });
    await decision.waitFor();
    assert.equal(await page.getByTestId('skip-replay').count(), 0, 'Reduced motion never creates a way to skip a mandatory decision.');
    assert(await page.getByTestId('end-day').isDisabled());
    await page.keyboard.press('Escape');
    assert(await decision.isVisible(), 'Escape cannot dismiss the critical decision.');
    await page.reload();
    await page.getByRole('button', { name: /Fortsett dag 0/ }).click();
    await decision.waitFor();
    await page.screenshot({ path: `${output}/mobile-checkpoint-reloaded.png` });
    await decision.getByRole('button', { name: 'Gi dekkild', exact: false }).click();
    await page.waitForFunction(() => (window as unknown as { __szRegion?: { state: RegionState } }).__szRegion?.state.day === 1);
    assert.deepEqual((await read(page)).state, expected.state, 'Browser choice equals one deterministic engine resume.');
    await page.reload();
    await page.getByRole('button', { name: /Fortsett dag 1/ }).click();
    await page.waitForFunction(() => !!(window as unknown as { __szRegion?: unknown }).__szRegion);
    assert.deepEqual((await read(page)).state, expected.state, 'Reload after the choice does not settle or charge it again.');
    assert.deepEqual(errors, []);
    results.push({ label: 'checkpoint-mobile', reducedMotion: true, reloadedBeforeAndAfter: true, ammo: expected.state.stock.ammo, errors });
    console.log('PASS mobile checkpoint: mandatory decision, reduced motion, reload before/after and exact one-time ammo settlement.');
    await context.close();
  } finally {
    writeFileSync(`${output}/journey.json`, JSON.stringify(results, null, 2));
    await browser.close();
  }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
