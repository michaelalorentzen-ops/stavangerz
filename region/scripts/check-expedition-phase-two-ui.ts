/** Explicit late-firsts scenario made from an actual UI campaign export. Not natural progression evidence. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { indexWorld, phaseOneReadiness, startRegionDay, type RegionState, type RegionWorld } from '../packages/gameplay/src/region';
const out=process.env.REGION_TEST_ARTIFACTS??'artifacts/live-phase-two';mkdirSync(out,{recursive:true});
async function main(){
 const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
 const state=JSON.parse(readFileSync(process.env.REGION_SCENARIO_SOURCE??'docs/evidence/live-expeditions/actual-save6.json','utf8')) as RegionState;
 assert.equal(new Set(state.experiences?.map(e=>e.kind)).size,8,'Source is an actual campaign that used all eight first experiences');
 delete state.event; const index=indexWorld(world),core=[state.homeZoneId],l2=index.byId.get(state.homeZoneId)!.parentId;
 for(let i=0;i<core.length&&core.length<3;i++)for(const e of index.adjacent.get(core[i])??[])if(!core.includes(e.to)&&index.byId.get(e.to)?.parentId===l2){core.push(e.to);if(core.length===3)break;}
 assert.equal(core.length,3);for(const id of core){state.zones[id].status='controlled';state.zones[id].zombies=0;}
 for(const z of Object.values(state.zones))z.zombies=0;
 const border=core.flatMap(id=>index.adjacent.get(id)??[]).find(e=>!core.includes(e.to))!;
 state.barricades[border.connId]=12;state.stock.food=200;state.stock.water=200;
 assert(phaseOneReadiness(state,world).ready,'Only scenario setup, never production gate changes');
 const expected=startRegionDay(state,world,[],{avatarId:state.flags.playerAvatarId as string});assert.equal(expected.status,'complete');assert.equal(expected.state.phase,2);
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results:unknown[]=[];
 try{for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:800},reducedMotion:'no-preference'});const page=await context.newPage();page.setDefaultTimeout(30000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.REGION_TEST_URL??'http://127.0.0.1:3000');await page.getByTestId('start-game').waitFor();await page.evaluate(s=>localStorage.setItem('stavanger-z.region.v2',JSON.stringify(s)),state);await page.reload();await page.getByRole('button',{name:new RegExp(`Fortsett dag ${state.day}`)}).click();await page.locator('.rz-map[aria-busy=false]').waitFor();
  await page.getByTestId('end-day').click();await page.getByRole('button',{name:'La døgnet gå uten oppdrag',exact:true}).click();
  const scene=page.locator('.exp-replay-scene[data-scene-id^="memory:phase-2:"]');await scene.waitFor();await scene.getByRole('button',{name:'Sett avspillingen på pause',exact:true}).click();assert.equal(await page.locator('.exp-replay-scene[data-scene-id^="experience:"]').count(),0);
  assert(await scene.locator('img').first().evaluate(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0));assert.match(await scene.innerText(),/FASE|fase|samfunn|tilflukt|STEG|Milepæl/);await page.screenshot({path:`${out}/phase-two-${width}.png`});
  await scene.getByTestId('skip-replay').click();await page.waitForFunction(()=>!document.querySelector('.rz-replay-shield'));const after=await page.evaluate(()=>(window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state);assert.deepEqual(after,expected.state);assert.equal(after.experiences?.length,8);assert(after.earnedMemories?.some(e=>e.milestone==='phase-2'));assert.deepEqual(errors,[]);
  results.push({width,scenario:true,sourceDay:state.day,allFirstsAlreadyUsed:true,phase:after.phase,actualPhaseCard:true,engineEqual:true,errors});await context.close();
 }}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}
 console.log('PASS phase-2 scenario PC/mobile: all firsts already used, actual phase transition scene, preserved eight memories, exact engine outcome.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
