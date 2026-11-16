/** Actual production UI replay journey. No game-state injection. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import type { RegionState, RegionWorld } from '../packages/gameplay/src/region/types';
const url = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/expedition-replay';
const read = (page: Page) => page.evaluate(() => (window as unknown as { __szRegion: { state: RegionState } }).__szRegion.state);
async function main() {
  mkdirSync(output, { recursive: true });
  const world = await (await fetch(`${url}/world/region-v1.json`)).json() as RegionWorld;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium', args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results: unknown[] = [];
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 800 }, reducedMotion: 'no-preference' });
      const page = await context.newPage(); page.setDefaultTimeout(18000);
      const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(url); await page.getByTestId('start-game').waitFor();
      await page.locator('input[type=number]').fill('101'); await page.getByTestId('start-game').click();
      for (let i = 0; i < 4; i++) await page.getByTestId('intro-next').click();
      await page.getByRole('dialog', { name: 'Velg hovedperson', exact: true }).getByRole('button').filter({ hasText: 'Ingrid' }).click();
      await page.locator('.rz-map[aria-busy=false]').waitFor();
      const before = await read(page);
      const home = world.zones.find(z => z.id === before.homeZoneId)!;
      const search = page.locator('.sz-search');
      await search.locator('summary').click();
      await search.getByRole('textbox', { name: 'Søk etter sone' }).fill(home.name);
      await search.locator(`[data-zone-id="${home.id}"]`).click();
      await page.getByRole('navigation', { name: 'Soneinnhold' }).getByRole('button', { name: 'Handlinger', exact: true }).click();
      await page.locator('[data-task=search]').click();
      const composer = page.getByRole('dialog', { name: 'Planlegg oppdrag', exact: true });
      await composer.getByRole('button', { name: 'Velg ledige her', exact: true }).click();
      await composer.getByRole('button', { name: 'Legg i dagsplanen', exact: true }).click();
      await page.getByTestId('open-plan').click();
      await page.getByRole('button', { name: 'Gjennomfør døgnet', exact: true }).click();
      const scene = page.locator('.exp-replay-scene'); await scene.waitFor();
      const sceneId = await scene.getAttribute('data-scene-id');
      assert(sceneId && !sceneId.startsWith('departure:'), 'Home search is not narrated as shelter departure');
      await scene.getByRole('button', { name: 'Sett avspillingen på pause', exact: true }).click();
      await page.waitForTimeout(6000);
      assert.equal(await scene.getAttribute('data-scene-id'), sceneId, 'Pause holds actual scene beyond its normal duration');
      assert.equal(await page.locator('.exp-replay-scene').count(), 1, 'Exactly one featured moment');
      const card = await scene.boundingBox(); const top = await page.locator('.live-replay-status').boundingBox();
      assert(card && top && top.y + top.height < card.y, 'Top controls and lower scene do not overlap');
      const layout = await scene.evaluate(e => ({ width: e.clientWidth, height: e.clientHeight, scroll: e.scrollHeight, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth,
        images: Array.from(e.querySelectorAll('img')).every(i => i.complete && i.naturalWidth > 0), badge: getComputedStyle(e.querySelector('.exp-replay-kicker span')!).fontSize }));
      assert(layout.images); assert(layout.scroll <= layout.height + 2); assert.equal(layout.viewport, layout.documentWidth);
      await page.screenshot({ path: `${output}/paused-${width}.png` });
      // Tab stays inside playback, and ordinary game shortcuts cannot open panels.
      await page.keyboard.press('Tab'); await page.keyboard.press('j');
      assert.equal(await page.getByRole('dialog', { name: 'Feltjournal', exact: true }).count(), 0);
      const focused = await page.evaluate(() => !!document.activeElement?.closest('.rz-replay-shield'));
      assert(focused, 'Keyboard focus stays in replay');
      await scene.getByRole('button', { name: 'Fortsett avspillingen', exact: true }).click();
      const seen: string[] = [sceneId];
      const start = Date.now();
      while (await page.locator('.rz-replay-shield').count() && Date.now() - start < 30000) {
        const id = await scene.getAttribute('data-scene-id').catch(() => null);
        if (id && !seen.includes(id)) seen.push(id);
        await page.waitForTimeout(200);
      }
      assert.equal(await page.locator('.rz-replay-shield').count(), 0, 'Playback auto-advances to report/mandatory decision');
      assert(seen.length >= 2, 'Real operation produces multiple distinct, auto-advanced moments');
      assert.deepEqual(errors, []);
      results.push({ width, sceneIds: seen, layout, errors });
      console.log(`PASS expedition replay ${width}: actual home search, pause, focus, progression, images, no scroll/overlap`);
      await context.close();
    }
  } catch (error) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.screenshot({ path: `${output}/failure-${page.viewportSize()?.width}.png` }).catch(() => {});
      writeFileSync(`${output}/failure.json`, JSON.stringify({ error: String(error), text: await page.locator('body').innerText().catch(() => '') }, null, 2));
    }
    throw error;
  } finally { writeFileSync(`${output}/journey.json`, JSON.stringify(results, null, 2)); await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
