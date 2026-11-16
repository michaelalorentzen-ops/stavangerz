/** Inspect an unedited export from the human-directed playtest; never simulate or fabricate state. */
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
      await page.getByTestId('nav-book').click();
      await page.getByRole('button', { name: /^Feltguide/ }).click();
      await page.getByRole('combobox', { name: 'Velg feltnotater' }).selectOption('experiences');
      assert.equal(state.experiences.length, 8);
      await shot('actual-first-memory');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Flere oversikter', exact: true }).click();
      await page.getByRole('button', { name: /^Oppdagelser og spor/ }).click();
      await page.getByRole('button', { name: /^Funn og avsluttede/ }).click();
      await page.getByRole('combobox', { name: 'Velg rapportert spor' }).selectOption('marius-return-notes');
      await shot('actual-marius-resolved');
      await page.getByRole('button', { name: /^Feltnotater ·/ }).click();
      await shot('actual-marius-history');
      await page.keyboard.press('Escape');
      await page.getByTestId('nav-hq').click();
      await shot('actual-hq');
      await page.keyboard.press('Escape');
      await page.reload();
      await page.getByRole('button', { name: new RegExp(`Fortsett dag ${state.day}`) }).click();
      await page.locator('.rz-map[aria-busy=false]').waitFor();
      await exact();
      assert.equal(await page.locator('.exp-card').count(), 0, 'Restoring a save does not replay a first-experience scene');
      assert.deepEqual(errors, []);
      results.push({ width, height, actualDay: state.day, firsts: state.experiences.map((entry: { kind: string }) => entry.kind), exactReload: true, errors });
      console.log(`PASS actual day ${state.day} save ${width}: camp, permanent memories, resolved story/history, HQ, exact reload; no simulation edits.`);
      await context.close();
    }
  } finally {
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
