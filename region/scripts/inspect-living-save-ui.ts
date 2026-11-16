/** Inspect an unedited export from the orchestrator-directed playtest; never simulate or fabricate state. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
async function main() {
  const source = process.env.REGION_PLAYTEST_RESUME;
  assert(source, 'REGION_PLAYTEST_RESUME must point to an actual playtest export');
  const state = JSON.parse(readFileSync(source, 'utf8'));
  const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/living-save-inspection';
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results: unknown[] = [];
  try {
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000');
      await page.getByTestId('start-game').waitFor();
      await page.evaluate(saved => localStorage.setItem('stavanger-z.region.v2', JSON.stringify(saved)), state);
      await page.reload();
      await page.getByRole('button', { name: new RegExp(`Fortsett dag ${state.day}`) }).click();
      await page.locator('.rz-map[aria-busy=false]').waitFor();
      await page.evaluate(() => document.fonts.ready);
      const exact = async () => assert.deepEqual(await page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as { __szRegion: { state: unknown } }).__szRegion.state))), state, 'Inspection preserves the exact serialized simulation');
      const shot = async (label: string) => {
        const modal = page.getByRole('dialog');
        if (await modal.count() === 1 && width === 1280) {
          const fit = await modal.evaluate(element => ({ h: element.clientHeight, sh: element.scrollHeight, w: element.clientWidth, sw: element.scrollWidth }));
          assert(fit.sh <= fit.h + 2 && fit.sw <= fit.w + 2, `${label}: desktop window must fit`);
        }
        await exact();
        await page.screenshot({ path: `${output}/${label}-${width}.png` });
      };
      await shot('actual-camp');
      assert.equal(await page.getByTestId('nav-journal').getAttribute('aria-keyshortcuts'),'J');
      await page.keyboard.press('j');
      await page.locator('.rz-poi-journal').waitFor();
      await exact();
      await page.keyboard.press('Escape');
      const rail = await page.locator('.sz-nav>button').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(); return { name: element.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
      }));
      assert(rail.every(button => button.width >= 44 && button.height >= 44 && button.y >= 0 && button.bottom <= height), 'All fixed HUD actions must remain visible and reachable');
      const openStories = Object.values(state.discoveries?.entries ?? {}).filter((entry: any) => !['resolved', 'lost'].includes(entry.status)).length;
      assert.equal(await page.getByTestId('nav-journal').getAttribute('aria-description'), `${openStories} åpne spor`);
      await page.getByTestId('nav-book').click();
      await page.keyboard.press('j');
      assert.equal(await page.locator('.rz-poi-journal').count(),0,'Journal shortcut must not interrupt the open book');
      await page.getByRole('button', { name: /^Feltguide/ }).click();
      await page.getByRole('combobox', { name: 'Velg feltnotater' }).selectOption('experiences');
      assert.equal(state.experiences.length, 8);
      await shot('actual-first-memory');
      const memoryImages: string[] = [];
      for (let index = 0; index < 8; index++) {
        const image = page.locator('.zab-experience-layout>img');
        await image.evaluate(element => (element as HTMLImageElement).decode());
        memoryImages.push((await image.getAttribute('src'))!);
        const citations=await page.locator('.zab-experience-layout cite').evaluateAll(elements=>elements.map(element=>parseFloat(getComputedStyle(element).fontSize)));
        assert(citations.every(size=>size>=(width===390?12:11)),'Names in memory quotations must meet the text floor');
        if (memoryImages.at(-1)?.includes('/experiences/')) await shot(`actual-memory-${memoryImages.at(-1)!.split('/').at(-1)!.split('.')[0]}`);
        if (index < 7) await page.getByRole('navigation', { name: 'Sider i feltnotatene' }).getByRole('button', { name: 'Neste', exact: true }).click();
      }
      assert.equal(new Set(memoryImages).size, 8, 'Each of the eight actual firsts has its own motif, with terrain-appropriate combat');
      await page.keyboard.press('Escape');
      await page.getByTestId('nav-journal').click();
      await page.getByRole('button', { name: /^Funn og avsluttede/ }).click();
      await page.getByRole('combobox', { name: 'Velg rapportert spor' }).selectOption('marius-return-notes');
      await shot('actual-marius-resolved');
      await page.getByRole('button', { name: /^Feltnotater ·/ }).click();
      await shot('actual-marius-history');
      await page.keyboard.press('Escape');
      await page.getByTestId('nav-hq').click();
      assert.equal(await page.locator('.hq-work-bar').getAttribute('role'), 'group', 'The labelled workforce distribution has valid ARIA semantics');
      await shot('actual-hq');
      await page.keyboard.press('Escape');
      await page.reload();
      await page.getByRole('button', { name: new RegExp(`Fortsett dag ${state.day}`) }).click();
      await page.locator('.rz-map[aria-busy=false]').waitFor();
      await exact();
      assert.equal(await page.locator('.exp-card').count(), 0, 'Restoring a save does not replay a first-experience scene');
      assert.deepEqual(errors, []);
      results.push({ width, height, actualDay: state.day, firsts: state.experiences.map((entry: { kind: string }) => entry.kind), memoryImages, rail, openStories, hqWorkforceRole: 'group', exactReload: true, errors });
      console.log(`PASS actual day ${state.day} save ${width}: camp, permanent memories, resolved story/history, HQ, exact reload; no simulation edits.`);
      await context.close();
    }
  } finally {
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
