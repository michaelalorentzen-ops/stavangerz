/** Actual UI journey; start the local server first. No state is injected into the game.
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm check:region-ui
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { ACTIONS, botChooseEvent, botPlanDay, type RegionState, type RegionWorld, type RegionOrder } from '../packages/gameplay/src/region/index';

const baseURL = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/region-ui';
mkdirSync(output, { recursive: true });
async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const results: unknown[] = [];
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
        await canvas.tap({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
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
      await order(page, { action: 'clear', zoneId: initial.state.homeZoneId, survivorIds: ['ingrid', 'marius'] });
      await order(page, { action: 'search', zoneId: initial.state.homeZoneId, survivorIds: ['leila', 'tor'] });
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
        console.log(`Settled ${label} day ${after.day}`);
        diary.push({ day: after.day, food: after.stock.food, water: after.stock.water, people: after.survivors.filter(p => p.alive).length, zones: Object.values(after.zones).filter(z => z.status === 'controlled').length, report: after.reports.at(-1)?.lines.map(l => l.title) });
        assert(!after.gameOver, 'The introductory journey must remain playable.');
      }
      await surface(page, 'Kart');
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
      console.log(`PASS ${label}: ${days} UI turns, intro, avatar, book, planning/cancel, replay/skip, report and exact save reload.`);
      await context.close();
    }
  } finally {
    writeFileSync(`${output}/journey.json`, JSON.stringify(results, null, 2));
    await browser.close();
  }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
