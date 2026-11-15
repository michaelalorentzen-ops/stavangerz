/** QA33 F01/F03/F04/F06 against the integrated app; fixtures exercise UI, not balance. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright';
import { newRegionGame } from '../packages/gameplay/src/region/engine';
import { SAVE_KEY_REGION } from '../packages/gameplay/src/region/rules';
import type { RegionState, RegionWorld } from '../packages/gameplay/src/region/types';
const url=process.env.REGION_TEST_URL??'http://127.0.0.1:3000';
const output=process.env.REGION_TEST_ARTIFACTS??'artifacts/qa33-polish';mkdirSync(output,{recursive:true});
const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const camp=world.starts.find(start=>start.name.startsWith('Lundsneset'))!.zoneId;
const stored=(page:Page)=>page.evaluate(key=>localStorage.getItem(key),SAVE_KEY_REGION);
const active=(page:Page)=>page.evaluate(()=> (window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state);
async function checkTargets(page:Page,selector:string){
 const small=await page.locator(selector).evaluateAll(elements=>elements.map(element=>({name:element.getAttribute('aria-label')||element.textContent,rect:element.getBoundingClientRect()})).filter(item=>item.rect.width>0&&item.rect.height>0&&(item.rect.width<44||item.rect.height<44)).map(item=>({name:item.name,width:item.rect.width,height:item.rect.height})));
 assert.deepEqual(small,[],`${selector}: visible controls need at least44×44 targets`);
}
async function statusBounds(page:Page,label:string){
 await page.locator('.sz-territory-button').waitFor();await page.locator('.sz-brief-wrap').waitFor();
 const bounds=await page.evaluate(()=>{const a=document.querySelector('.sz-territory-button')!.getBoundingClientRect(),b=document.querySelector('.sz-brief-wrap')!.getBoundingClientRect();return{territory:{x:a.x,y:a.y,width:a.width,height:a.height,right:a.right,bottom:a.bottom},brief:{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom},viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth};});
 const a=bounds.territory,b=bounds.brief;
 const overlap=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
 assert.equal(overlap,0,`${label}: ownership and today's advice must not overlap`);assert.equal(bounds.scrollWidth,bounds.viewport.width,`${label}: horizontal overflow`);
 assert(a.y>=0&&a.bottom<=bounds.viewport.height&&b.y>=0&&b.bottom<=bounds.viewport.height,`${label}: status surfaces must stay visible`);
 return bounds;
}
async function main(){
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results:unknown[]=[];
 try{for(const [width,height] of [[1280,800],[390,844]]){
  if(process.env.QA33_VIEWPORT&&width!==Number(process.env.QA33_VIEWPORT))continue;
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(25000);
  const nativeDialogs:string[]=[],errors:string[]=[];page.on('dialog',async dialog=>{nativeDialogs.push(dialog.type());await dialog.dismiss();});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.getByTestId('start-game').waitFor();await page.evaluate(()=>document.fonts.ready);
  const libraryButton=page.locator('.start-library');assert.match(await libraryButton.innerText(),/Last spill/);await checkTargets(page,'.start-library');
  const startFit=await page.evaluate(()=>{const start=document.querySelector('[data-testid=start-game]')!.getBoundingClientRect(),list=document.querySelector('.rz-start-list')!.getBoundingClientRect();return{startBottom:start.bottom,startTop:start.top,listBottom:list.bottom,scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth};});
  assert(startFit.startTop>=0&&startFit.startBottom<=height,'Start action remains visible');assert.equal(startFit.scrollWidth,width);if(width>820){assert(startFit.listBottom<=height,'Start suggestions remain above fold');assert(startFit.scrollHeight<=height+2,'No desktop start scroll');}
  await page.screenshot({path:`${output}/start-${width}.png`});
  const original=newRegionGame(world,camp,633,{difficulty:'story',avatarId:'ingrid',runId:`qa33-original-${width}`});delete original.event;
  await page.evaluate(({state,key})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(state));localStorage.setItem('stavanger-z.preferences.v1',JSON.stringify({masterVolume:0,musicVolume:0,effectsVolume:0,reducedMotion:true,textScale:'normal'}));},{state:original,key:SAVE_KEY_REGION});await page.reload();await page.getByTestId('start-game').waitFor();
  await libraryButton.click();const library=page.getByRole('dialog',{name:'Gjennomspillinger',exact:true});await library.waitFor();await checkTargets(page,'.campaign-library button');if(width>820)assert(await library.evaluate(element=>element.scrollHeight<=element.clientHeight+1),'Library fits desktop');await library.getByRole('button',{name:'Lukk gjennomspillinger'}).click();
  const beforeStart=await stored(page);await page.getByTestId('start-game').click();let confirm=page.getByRole('dialog',{name:'En ny begynnelse?',exact:true});await confirm.waitFor();assert(await confirm.evaluate(element=>element instanceof HTMLDialogElement));await checkTargets(page,'.game-confirm button');await confirm.getByRole('button',{name:'Avbryt',exact:true}).click();assert.equal(await stored(page),beforeStart,'Cancel start preserves exact save');
  await page.getByTestId('start-game').click();await confirm.waitFor();await page.keyboard.press('Escape');await confirm.waitFor({state:'detached'});assert.equal(await stored(page),beforeStart,'Escape preserves exact save');
  await page.getByTestId('start-game').click();await confirm.waitFor();await confirm.getByRole('button',{name:'Start ny gjennomspilling',exact:true}).click();await page.getByRole('button',{name:'Hopp over',exact:true}).click();
  const avatar=page.getByRole('dialog',{name:'Velg hovedperson',exact:true});if(await avatar.isVisible())await avatar.getByRole('button').filter({hasText:'Ingrid'}).click();
  await page.waitForFunction(()=>!!(window as unknown as {__szRegion?:unknown}).__szRegion);await page.locator('.sz-game').waitFor();
  const afterStart=JSON.parse((await stored(page))!);assert.notEqual(afterStart.state.campaign.id,original.campaign!.id);assert.deepEqual(afterStart.library.slots.find((slot:{state:RegionState})=>slot.state.campaign?.id===original.campaign!.id).state,JSON.parse(JSON.stringify(original)),'Starting anew preserves previous run');
  let normalBounds:unknown=null,largeBounds:unknown=null;
  if(width===390){normalBounds=await statusBounds(page,'390 normal');await page.screenshot({path:`${output}/hud-normal-${width}.png`});await page.getByTestId('nav-settings').click();const settings=page.getByRole('dialog',{name:'Innstillinger',exact:true});await settings.getByRole('tab',{name:'Visning',exact:true}).click();await settings.getByRole('combobox',{name:'Tekststørrelse',exact:true}).selectOption('large');await page.keyboard.press('Escape');await page.locator('.pref-large-text').waitFor();largeBounds=await statusBounds(page,'390 large');await page.screenshot({path:`${output}/hud-large-${width}.png`});}
  await page.getByRole('button',{name:'Flere oversikter',exact:true}).click();const menu=page.locator('.sz-modal-menu');await page.locator('.rz-overviews').waitFor();assert.match(await page.locator('.rz-overviews>button').first().innerText(),/Gjennomspillinger/);await page.screenshot({path:`${output}/menu-${width}.png`});if(width>820)assert(await menu.evaluate(element=>element.scrollHeight<=element.clientHeight+1),'Menu fits desktop');
  const beforeRestart=await stored(page),beforeRestartState=await active(page);await page.getByRole('button',{name:'Ny gjennomspilling',exact:true}).click();confirm=page.getByRole('dialog',{name:'Til en ny begynnelse?',exact:true});await confirm.waitFor();await confirm.getByRole('button',{name:'Avbryt',exact:true}).click();assert.equal(await stored(page),beforeRestart,'Cancel restart preserves exact save');
  await page.getByRole('button',{name:'Ny gjennomspilling',exact:true}).click();await confirm.waitFor();await confirm.getByRole('button',{name:'Til startskjermen',exact:true}).click();await page.getByTestId('start-game').waitFor();const archived=JSON.parse((await stored(page))!);assert.equal(archived.state,null);const restoreSlot=archived.library.slots.find((slot:{state:RegionState})=>slot.state.campaign?.id===beforeRestartState.campaign!.id);assert(restoreSlot);assert.deepEqual(restoreSlot.state,JSON.parse(JSON.stringify(beforeRestartState)));
  await page.locator('.start-library').click();await library.waitFor();await library.getByRole('article',{name:`Lagringsplass ${restoreSlot.id+1}`,exact:true}).getByRole('button',{name:'Last',exact:true}).click();await library.getByRole('button',{name:'Bekreft',exact:true}).click();await page.locator('.sz-game').waitFor();assert.deepEqual(await active(page),JSON.parse(JSON.stringify(beforeRestartState)),'Archived run resumes exactly');assert.deepEqual(JSON.parse((await stored(page))!).state,JSON.parse(JSON.stringify(beforeRestartState)),'Restored checkpoint is persisted exactly');assert.deepEqual(nativeDialogs,[],'No native browser confirm/alert');assert.deepEqual(errors,[]);
  results.push({width,height,startFit,normalBounds,largeBounds,nativeDialogs,errors});console.log(`PASS QA33 polish ${width}: labelled archive/44px, first menu entry, custom new-run cancel/archive/resume, no native dialogs${width===390?', normal+large status bounds separated':''}.`);await context.close();
 }}finally{writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
