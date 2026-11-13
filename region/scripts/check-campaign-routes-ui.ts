/** Layout fixtures only; no claim of a natural phase-five playthrough. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {newRegionGame,SAVE_KEY_REGION,type RegionWorld} from '../packages/gameplay/src/region';
async function main(){
 const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
 const out='artifacts/qa32-campaign-routes';mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:width===1280?800:844},reducedMotion:'reduce'}),page=await context.newPage();const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const state=newRegionGame(world,world.starts[0].zoneId,101,{avatarId:'ingrid',runId:'routes-layout'});delete state.event;state.phase=5;state.day=99;state.counters.stable=17;
  await page.goto(process.env.REGION_BASE_URL??'http://127.0.0.1:3000');await page.getByTestId('start-game').waitFor();await page.evaluate(({state,key})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(state));},{state,key:SAVE_KEY_REGION});await page.reload();await page.getByRole('button',{name:/Fortsett dag/}).click();await page.getByRole('button',{name:/FASE 5/}).click();await page.getByRole('button',{name:'Seiersveier',exact:true}).click();
  const panel=page.getByRole('region',{name:'Veien videre'}),dialog=page.getByRole('dialog');await panel.waitFor();assert.equal(await panel.locator('details').getAttribute('open'),'');assert.match(await panel.innerText(),/17\/30 døgn/);assert.equal(await panel.getByText(/Ukjent gruppe.*\/60/).count(),0);
  await page.screenshot({path:`${out}/phase5-${width}.png`});
  assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal overflow');if(width===1280)assert(await dialog.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'desktop routes fit without scrolling');assert.deepEqual(errors,[]);
  console.log(`PASS phase5 expanded routes ${width}: ${JSON.stringify(await dialog.evaluate(e=>({width:e.clientWidth,height:e.clientHeight,scrollHeight:e.scrollHeight})))}`);await context.close();
 }}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exit(1);});
