/** Reproduce an actual day-18 setback from the unedited day-17 UI export. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium,type Page} from 'playwright';
import {startRegionDay,type RegionState,type RegionWorld,type RegionOrder} from '../packages/gameplay/src/region';
const source=process.env.REGION_SCENARIO_SOURCE??'docs/evidence/live-expeditions/actual-save17.json';
const state=JSON.parse(readFileSync(source,'utf8')) as RegionState;
const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const out=process.env.REGION_TEST_ARTIFACTS??'artifacts/live-setback';mkdirSync(out,{recursive:true});
const read=(page:Page)=>page.evaluate(()=>(window as unknown as {__szRegion:{state:RegionState;orders:RegionOrder[]}}).__szRegion);
async function plan(page:Page,zoneId:string,action:string,ids:string[]){
 const close=page.getByRole('button',{name:'Lukk kontekstpanel',exact:true});if(await close.isVisible())await close.click();
 const search=page.locator('.sz-search');if(!await search.evaluate(e=>(e as HTMLDetailsElement).open))await search.locator('summary').click();await search.getByRole('textbox',{name:'Søk etter sone'}).fill(world.zones.find(z=>z.id===zoneId)!.name);await search.locator(`[data-zone-id="${zoneId}"]`).click();
 await page.getByRole('navigation',{name:'Soneinnhold'}).getByRole('button',{name:'Handlinger',exact:true}).click();await page.locator(`[data-task=${action}]`).click();
 const composer=page.getByRole('dialog',{name:'Planlegg oppdrag',exact:true});for(const p of state.survivors){const box=composer.locator('.cmd-person').filter({has:page.locator('strong',{hasText:p.name})}).getByRole('checkbox');if(await box.count())if(await box.isChecked()!==ids.includes(p.id))await box.setChecked(ids.includes(p.id));}
 await composer.getByRole('button',{name:'Legg i dagsplanen',exact:true}).click();
}
async function main(){const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results:unknown[]=[];
 try{for(const width of [1280,390]){const context=await browser.newContext({viewport:{width,height:width===390?844:800},reducedMotion:'no-preference'}),page=await context.newPage();page.setDefaultTimeout(30000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.REGION_TEST_URL??'http://127.0.0.1:3000');await page.getByTestId('start-game').waitFor();await page.evaluate(s=>localStorage.setItem('stavanger-z.region.v2',JSON.stringify(s)),state);await page.reload();await page.getByRole('button',{name:new RegExp(`Fortsett dag ${state.day}`)}).click();await page.locator('.rz-map[aria-busy=false]').waitFor();assert.deepEqual((await read(page)).state,state);
 await plan(page,'z3-0006','claim',['ingrid','tor']);await plan(page,state.homeZoneId,'search',['marius','leila','r1-4']);const orders=(await read(page)).orders,expected=startRegionDay(state,world,orders,{avatarId:'ingrid'});assert.equal(expected.status,'complete');assert(expected.report.lines.some(l=>l.title==='Overtakelsen ble stanset'));
 await page.getByTestId('end-day').click();await page.getByRole('button',{name:'Gjennomfør døgnet',exact:true}).click();const scene=page.locator('.exp-replay-scene').filter({has:page.getByRole('heading',{name:'Overtakelsen ble stanset',exact:true})});await scene.waitFor();await scene.getByRole('button',{name:'Sett avspillingen på pause',exact:true}).click();assert.match(await scene.locator('.exp-replay-location').innerText(),/Hundvåg 2/);assert.match(await scene.innerText(),/flere zombier/);await page.screenshot({path:`${out}/actual-stopped-claim-${width}.png`});
 await scene.getByTestId('skip-replay').click();await page.waitForFunction(()=>!document.querySelector('.rz-replay-shield'));assert.deepEqual((await read(page)).state,expected.state);assert.deepEqual(errors,[]);results.push({width,sourceDay:state.day,actualZone:'Hundvåg 2',featuredFailure:true,engineEqual:true,errors});await context.close();
 }}finally{writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));await browser.close();}console.log('PASS actual stopped takeover PC/mobile: named zone and real cause during replay, exact engine result.');}
main().catch(e=>{console.error(e);process.exitCode=1;});
