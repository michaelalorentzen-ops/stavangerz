/** Bounded event UI fixture: force the existing protest, then verify actual population/report consequences. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { newRegionGame } from '../packages/gameplay/src/region/engine';
import { forceEvent } from '../packages/gameplay/src/region/events';
import type { RegionState, RegionWorld } from '../packages/gameplay/src/region/types';
async function main() {
  const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
  let fixture: RegionState | undefined;
  for (let seed = 1; seed <= 100 && !fixture; seed++) {
    const state = newRegionGame(world,world.starts[0].zoneId,seed,{avatarId:'ingrid',runId:`protest-layout-${seed}`});
    state.day=12; state.population.adults=4;
    state.reports=[{day:12,lines:[],food:{produced:0,eaten:4,spoiled:0},water:{produced:0,drunk:4},zombiesMoved:0,killed:0}];
    state.event=forceEvent(state,world,'cowardAgain',{who:'marius'});
    if (state.event?.data?.good===0) fixture=state;
  }
  assert(fixture,'An existing deterministic bad protest variant must be available');
  assert.equal(fixture.event?.title,'Splittet');
  const output=process.env.REGION_TEST_ARTIFACTS??'artifacts/public-protest';mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results: unknown[]=[];
  try {
    for (const [width,height] of [[1280,800],[390,844]]) {
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(process.env.REGION_TEST_URL??'http://127.0.0.1:3000');await page.getByTestId('start-game').waitFor();
      await page.evaluate(state=>localStorage.setItem('stavanger-z.region.v2',JSON.stringify(state)),fixture);
      await page.reload();await page.getByRole('button',{name:/Fortsett dag 12/}).click();
      const event=page.getByRole('dialog',{name:'Splittet',exact:true});await event.waitFor();
      await event.getByRole('button').filter({hasText:'La Marius bli i gruppen'}).click();
      const outcome=await page.evaluate(()=>{const state=(window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state;return {adults:state.population.adults,lines:state.reports.at(-1)!.lines};});
      assert.equal(outcome.adults,2);
      assert(outcome.lines.some(line=>line.facts?.departedAdults===2));
      await page.getByRole('button',{name:'Dagsrapporter',exact:true}).click();
      await page.locator('.dr-outcome h3').filter({hasText:'2 voksne forlot gruppen'}).waitFor();
      assert.match(await page.locator('.rz-daily-report').innerText(),/Avgangen var en protest/);
      if(width===1280)assert(await page.getByRole('dialog').evaluate(element=>element.scrollHeight<=element.clientHeight+1));
      await page.screenshot({path:`${output}/fixture-public-departures-${width}.png`});
      assert.deepEqual(errors,[]);results.push({width,height,kind:'Synthetic event fixture; actual UI choice and report',adultsBefore:4,adultsAfter:outcome.adults,visibleDepartureLine:true,errors});
      console.log(`PASS public protest ${width}: Splittet choice, actual4→2, visible report consequence.`);await context.close();
    }
  }finally{writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
