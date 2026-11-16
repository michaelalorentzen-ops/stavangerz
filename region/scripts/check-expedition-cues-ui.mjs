/** Real first scout through the UI. Captures live DOM, not fabricated report fixtures or late screenshots. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/expedition-cues';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'no-preference' });
    const page = await context.newPage(), cues = [], errors = [];
    page.setDefaultTimeout(25000);
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__captureCue', cue => cues.push(cue));
    await page.addInitScript(() => {
      const seen = new Set();
      new MutationObserver(() => document.querySelectorAll('.rz-expedition-cue').forEach(element => {
        const id = element.dataset.experienceId;
        if (seen.has(id)) return;
        seen.add(id);
        const place = element.querySelector('small'), title = element.querySelector('strong'), rect = element.getBoundingClientRect();
        const overlaps = [...document.querySelectorAll('.rz-replay-card,.sz-top,.sz-brief-wrap,.sz-territory-button')].filter(other => {
          const r = other.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top;
        }).map(other => other.className);
        void window.__captureCue({ id, place: place.textContent, title: title.textContent, titleFont: parseFloat(getComputedStyle(title).fontSize), placeFont: parseFloat(getComputedStyle(place).fontSize), placeClipped: place.scrollWidth > place.clientWidth + 1 || place.scrollHeight > place.clientHeight + 1, rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }, overlaps });
      })).observe(document, { childList: true, subtree: true });
    });
    await page.goto(process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000');
    await page.getByTestId('start-game').waitFor();
    await page.locator('input[type=number]').fill('101');
    await page.getByTestId('start-game').click();
    for (let i = 0; i < 4; i++) await page.getByTestId('intro-next').click();
    await page.getByRole('dialog', { name: 'Velg hovedperson', exact: true }).getByRole('button').filter({ hasText: 'Ingrid' }).click();
    await page.locator('.rz-map[aria-busy=false]').waitFor();
    const home = await page.evaluate(() => {
      const { state, world } = window.__szRegion;
      return { name: world.zones.find(zone => zone.id === state.homeZoneId).name, id: state.homeZoneId, crew: state.survivors.map(person => person.name) };
    });
    const search = page.locator('.sz-search');
    await search.locator('summary').click();
    await search.getByRole('textbox', { name: 'Søk etter sone' }).fill(home.name);
    await search.locator(`[data-zone-id="${home.id}"]`).click();
    await page.getByRole('navigation', { name: 'Soneinnhold' }).getByRole('button', { name: 'Handlinger', exact: true }).click();
    await page.locator('[data-task=scout]').click();
    const order = page.getByRole('dialog', { name: 'Planlegg oppdrag', exact: true });
    for (const name of home.crew) await order.locator('.cmd-person').filter({ has: page.locator('strong', { hasText: name }) }).getByRole('checkbox').check();
    await order.getByRole('button', { name: 'Legg i dagsplanen', exact: true }).click();
    await page.keyboard.press('Escape');
    const close = page.getByRole('button', { name: 'Lukk kontekstpanel', exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByTestId('end-day').click();
    await page.getByRole('button', { name: 'Gjennomfør døgnet', exact: true }).click();
    await page.locator('.rz-daily-report').waitFor();
    assert(cues.length > 0, 'A real first operation must show a map result with normal motion');
    for (const cue of cues) {
      assert.equal(cue.place, home.name, 'Map result uses the full known place name');
      assert(cue.titleFont >= (width === 390 ? 12 : 11) && cue.placeFont >= (width === 390 ? 12 : 11));
      assert.equal(cue.placeClipped, false);
      assert(cue.rect.x >= 0 && cue.rect.y >= 0 && cue.rect.right <= width && cue.rect.bottom <= height);
      assert.deepEqual(cue.overlaps, []);
    }
    const cueCount = cues.length;
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Dagsrapporter', exact: true }).click();
    await page.waitForTimeout(2600);
    assert.equal(cues.length, cueCount, 'Report archive does not replay a map result');
    assert.deepEqual(errors, []);
    results.push({ width, height, actualDay: await page.evaluate(() => window.__szRegion.state.day), cues, archiveReplayedCue: false, errors, screenshotLimitation: 'DOM measured during live replay; no claim about animation frames on a physical GPU' });
    console.log(`PASS live map ${width}: real scout, full place name, readable text, no clipping/occlusion, no archive replay.`);
    await context.close();
  }
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
