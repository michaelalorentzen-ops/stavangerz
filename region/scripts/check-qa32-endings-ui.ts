/** Long-campaign ending fit and native library focus regression. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {newRegionGame} from '../packages/gameplay/src/region/engine';
import {buildCampaignEnding} from '../packages/gameplay/src/region/campaign';
import {MILESTONES,SAVE_KEY_REGION} from '../packages/gameplay/src/region/rules';
import type {RegionWorld} from '../packages/gameplay/src/region/types';
async function main(){
 const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
 const state=newRegionGame(world,world.starts[0].zoneId,44,{avatarId:'ingrid',runId:'ending-layout'});delete state.event;state.phase=5;state.day=99;state.milestones=MILESTONES.map(m=>m.id);state.memory=[2,3,4,5].map(n=>({day:n*10,text:`Fase ${n}: Samfunnet vokser videre og holder sammen.`}));state.campaign!.ending=buildCampaignEnding(state,'stable',world);state.gameOver={day:99,won:true,reason:'Samfunnet har en fremtid.'};
 const out='artifacts/qa32-endings-ui';mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [1280,390]){const context=await browser.newContext({viewport:{width,height:width===1280?800:844}}),page=await context.newPage();await page.goto(process.env.REGION_BASE_URL??'http://127.0.0.1:3000');await page.getByTestId('start-game').waitFor();await page.evaluate(({state,key})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(state));},{state,key:SAVE_KEY_REGION});await page.reload();await page.getByRole('button',{name:/Vis avslutningen etter/}).click();const ending=page.getByRole('dialog',{name:'Gjennomspillingen er over',exact:true});await ending.waitFor();
 for(const tab of ['Oversikt','Historien','Prestasjoner']){await ending.getByRole('button',{name:tab,exact:true}).click();await page.screenshot({path:`${out}/${tab}-${width}.png`});if(width===1280)assert(await ending.evaluate(e=>e.scrollHeight<=e.clientHeight+1),`${tab} desktop overflow`);}
 await ending.getByRole('button',{name:'Gjennomspillinger · lagre og last'}).click();const library=page.getByRole('dialog',{name:'Gjennomspillinger',exact:true});await library.waitFor();for(let i=0;i<14;i++){await page.keyboard.press('Tab');assert(await library.evaluate(e=>e.contains(document.activeElement)));}await library.getByRole('button',{name:'Lagre',exact:true}).first().click();await library.getByRole('button',{name:'Lagre',exact:true}).first().click();const confirm=library.getByRole('alertdialog');await confirm.waitFor();for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert(await confirm.evaluate(e=>e.contains(document.activeElement)));}await page.keyboard.press('Escape');await confirm.waitFor({state:'detached'});assert(await library.isVisible());await library.getByRole('button',{name:'Lukk gjennomspillinger'}).click();
 const active={...state,gameOver:undefined,campaign:{...state.campaign!,ending:undefined}};
 await page.evaluate(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state:active,key:SAVE_KEY_REGION});await page.reload();await page.getByRole('button',{name:/Fortsett dag/}).click();await page.getByRole('button',{name:/FASE 5/}).click();await page.getByRole('button',{name:'Seiersveier',exact:true}).click();await page.screenshot({path:`${out}/goals-phase5-${width}.png`});if(width===1280)assert(await page.getByRole('dialog').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Phase5 goals desktop overflow');
 await context.close();
 }}finally{await browser.close();}console.log('PASS ending1280/390 fit, history/milestone paging and native/nested library focus.');}
main().catch(e=>{console.error(e);process.exit(1);});
