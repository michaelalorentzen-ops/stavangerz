/** Browser regression for GLB visibility, fog, and conservative crew placement.
 * REGION_TEST_URL=http://127.0.0.1:3000 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node --import tsx scripts/check-world-map.ts
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { indexWorld, newRegionGame, SAVE_KEY_REGION, type RegionState, type RegionWorld } from '../packages/gameplay/src/region/index';
const url = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/world-map';
mkdirSync(output, { recursive: true });
async function run() {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const world: RegionWorld = await (await fetch(`${url}/world/region-v1.json`)).json();
  const camp = world.starts[0].zoneId;
  const index = indexWorld(world);
  const neighbor = index.adjacent.get(camp)![0].to;
  const state = newRegionGame(world, camp, 801, { difficulty: 'story', avatarId: 'ingrid', runId: 'world-map-qa' });
  state.event = undefined; state.hq = { zoneId: camp, type: 'camp', modules: [] };
  state.stock.food = state.stock.water = 150;
  state.zones[neighbor].status = 'scouted'; state.zones[neighbor].intel = { min: 12, max: 30, day: state.day };
  state.crewPositions = Object.fromEntries(state.survivors.map(p => [p.id, { kind: 'zone', zoneId: camp }]));
  const errors: string[] = [], requests: string[] = [];
  async function load(page: Page, fixture: RegionState) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().endsWith('.glb')) requests.push(`${response.status()} ${response.url()}`); });
    await page.goto(url);
    await page.evaluate(({ key, fixture }) => localStorage.setItem(key, JSON.stringify(fixture)), { key: SAVE_KEY_REGION, fixture });
    await page.reload(); await page.getByRole('button', { name: /Fortsett dag/ }).click();
    await page.locator('.rz-map[aria-busy="false"]').waitFor();
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await load(page, state);
    await page.waitForFunction(() => document.querySelectorAll('.rz-world-crew.has-model').length === 4);
    assert.equal(await page.locator('.rz-world-crew').count(), 4);
    assert(requests.some(r => r.startsWith('200 ') && r.includes('crew-')));
    const knownPoiIds = new Set(world.pois.filter(p => state.zones[p.zoneId]?.status !== 'unknown').map(p => p.name));
    const shownPoiNames = await page.locator('.rz-marker').evaluateAll(elements => elements.map(e => e.getAttribute('aria-label')));
    for (const name of knownPoiIds) assert(shownPoiNames.includes(name), `Known POI is selectable: ${name}`);
    await page.screenshot({ path: `${output}/coastal-crew-glb.png` });
    await page.locator('.rz-map').screenshot({ path: `${output}/coastal-map-detail.png` });
    for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Zoom ut', exact: true }).click(); await page.waitForTimeout(400); }
    await page.waitForFunction(() => document.querySelectorAll('.rz-world-crew').length === 0);
    assert((await page.locator('.rz-command-level').innerText()).includes('L2'));
    await page.screenshot({ path: `${output}/district-overview.png` });
    const fallback = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fallback.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 1 }));
    const conservative = structuredClone(state);
    const area = index.byId.get(camp)!.parentId!;
    conservative.crewPositions![state.survivors[2].id] = { kind: 'area-duty', areaLevel: 2, areaZoneId: area, duty: 'guard' };
    conservative.crewPositions![state.survivors[3].id] = { kind: 'away-unknown' };
    await load(fallback, conservative);
    await fallback.waitForFunction(() => document.querySelectorAll('.rz-world-crew').length === 2);
    assert.equal(await fallback.locator('.rz-world-crew.has-model').count(), 0);
    assert.equal(await fallback.locator('.rz-world-crew svg').count(), 2);
    await fallback.screenshot({ path: `${output}/low-power-coverage-fallback.png` });
    assert.deepEqual(errors, []);
    writeFileSync(`${output}/world-map-qa.json`, JSON.stringify({ glbResponses: requests, errors, knownPoiCount: knownPoiIds.size, assertions: ['4 real GLB crew at local zoom', 'known POI accessible buttons', 'no local models at L2', 'area-duty and unknown never have point pieces', 'low-power SVG fallback'] }, null, 2));
    console.log(`World map verified; artifacts: ${output}`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
