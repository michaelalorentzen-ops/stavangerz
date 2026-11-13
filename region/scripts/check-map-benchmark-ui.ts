/** Explicit, read-only benchmark journey on the real game map.
 * REGION_TEST_URL=http://127.0.0.1:3000 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node --import tsx scripts/check-map-benchmark-ui.ts
 * Software-renderer results validate the measurement flow, never physical GPU performance.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { indexWorld, newRegionGame, SAVE_KEY_REGION, type RegionWorld } from '../packages/gameplay/src/region/index';
import type { MapBenchmarkResult } from '../apps/game-client/app/map-benchmark';
const url = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const output = process.env.REGION_TEST_ARTIFACTS ?? 'artifacts/map-benchmark';
mkdirSync(output,{recursive:true});
const snapshot = (page: Page) => page.evaluate(() => {
  const game = (window as unknown as {__szRegion:{state:unknown;orders:unknown}}).__szRegion;
  return { game:JSON.stringify({state:game.state,orders:game.orders}), storage:JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)]))) };
});
async function main() {
  const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const stop = () => { void browser.close().finally(()=>process.exit(143)); };
  process.once('SIGTERM',stop);
  const world:RegionWorld=await(await fetch(`${url}/world/region-v1.json`)).json();
  const camp=world.starts[0].zoneId;
  const index=indexWorld(world), neighbor=index.adjacent.get(camp)![0].to;
  const state=newRegionGame(world,camp,801,{difficulty:'story',avatarId:'ingrid',runId:'benchmark-ui-fixture'});
  state.event=undefined;state.hq={zoneId:camp,type:'camp',modules:[]};state.stock.food=state.stock.water=150;
  state.zones[neighbor].status='scouted';state.zones[neighbor].intel={min:12,max:30,day:state.day};
  state.crewPositions=Object.fromEntries(state.survivors.map(p=>[p.id,{kind:'zone',zoneId:camp}]));
  const results:MapBenchmarkResult[]=[];
  const errors:string[]=[];
  try {
    for(const width of [1280,390]) {
      const context=await browser.newContext({viewport:{width,height:800},reducedMotion:'reduce',acceptDownloads:true});
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(url);
      await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:SAVE_KEY_REGION,state});
      await page.reload();await page.getByRole('button',{name:/Fortsett dag/}).click();
      await page.locator('.rz-map[aria-busy="false"]').waitFor();
      await page.waitForFunction(()=>document.querySelectorAll('.rz-world-crew.has-model').length>=4);
      await page.getByRole('button',{name:'Innstillinger',exact:true}).click();
      await page.getByRole('tab',{name:'Ytelse',exact:true}).click();
      const settings=page.getByRole('dialog',{name:'Innstillinger',exact:true,includeHidden:true});
      const start=settings.getByRole('button',{name:'Mål kartytelse',exact:true});
      await start.waitFor();await page.waitForTimeout(200);
      const before=await snapshot(page);
      await start.click();await page.locator('.sz-benchmark-shield').waitFor();
      await page.waitForFunction(()=>document.documentElement.classList.contains('sz-benchmark-running'));
      assert.equal(await settings.locator('..').evaluate(el=>(el as HTMLElement).inert),true);
      assert.equal(await settings.evaluate(el=>getComputedStyle(el).visibility),'hidden');
      await page.screenshot({path:`${output}/running-${width}.png`});
      await page.keyboard.press('Escape');await page.locator('.sz-benchmark-shield').waitFor({state:'detached'});
      await page.waitForFunction(()=>!document.documentElement.classList.contains('sz-benchmark-running'));
      await settings.waitFor();assert.equal(await settings.locator('..').evaluate(el=>(el as HTMLElement).inert),false);
      assert.deepEqual(await snapshot(page),before,'Cancel must not change game state, orders, or any localStorage bytes.');
      await start.click();await page.locator('.sz-benchmark-result').waitFor({timeout:30_000});
      await page.waitForFunction(()=>!document.documentElement.classList.contains('sz-benchmark-running'));
      assert((await page.locator('.sz-benchmark-result').innerText()).includes('Programvarerendering'),'SwiftShader must be clearly labeled software.');
      assert.deepEqual(await snapshot(page),before,'Completed measurement must not change game state, orders, or any localStorage bytes.');
      assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('sz-benchmark-running')),false);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow.');
      if(width===1280) {
        const scrolling=await settings.evaluate(el=>[el,...el.querySelectorAll('*')].filter(node=>{const style=getComputedStyle(node);return /auto|scroll/.test(style.overflowY)&&node.scrollHeight>node.clientHeight+2;}).map(node=>node.className));
        assert.deepEqual(scrolling,[],'Desktop performance panel must fit without scrolling.');
      }
      const downloaded=page.waitForEvent('download');await settings.getByRole('button',{name:'Last ned JSON',exact:true}).click();
      const file=await downloaded;const path=`${output}/measurement-${width}.json`;await file.saveAs(path);
      const measurement:MapBenchmarkResult=JSON.parse(readFileSync(path,'utf8'));
      assert.equal(measurement.schema,'stavangerz-map-benchmark-v1');assert.equal(measurement.graphics.classification,'software');
      assert.match(measurement.graphics.renderer,/swiftshader/i);assert.equal(measurement.viewport.width,width);
      assert.equal(measurement.scene.phase,1);assert(measurement.frames.samples>0);assert(measurement.frames.mapRenders>0);
      assert(measurement.durationMs>=10_000);assert(measurement.assets.modelMarkers>=4);
      assert(measurement.assets.styleLoaded && measurement.assets.tilesLoaded);assert(measurement.frames.p95Ms>0 && measurement.frames.averageMs>0);
      results.push(measurement);await page.screenshot({path:`${output}/result-${width}.png`});
      await context.close();
    }
    assert.deepEqual(errors,[]);writeFileSync(`${output}/summary.json`,JSON.stringify({scope:'Real game map, cloud SwiftShader only; no physical GPU evidence.',results},null,2));
    console.log('PASS real game scene desktop/mobile: explicit cancel/complete, software label, downloaded JSON, no desktop scroll, exact state/storage preservation.');
  } finally {process.removeListener('SIGTERM',stop);await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
