/** Inspect an unedited actual save; never run a simulated turn or fabricate state. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const url=process.env.REGION_TEST_URL??'http://127.0.0.1:3000';
const save=JSON.parse(readFileSync(process.env.REGION_PLAYTEST_RESUME??'docs/evidence/live-expeditions/actual-save20.json','utf8'));
const output=process.env.REGION_TEST_ARTIFACTS??'artifacts/rest-group-ui';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??'/usr/bin/chromium',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try {
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]) for(const action of ['rest','search','clear']) {
  const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
  const exact=async()=>assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(window.__szRegion.state))),save,'Planning preserves exact simulation state');
  let fit,gearFit;
  try {
   await page.goto(url);await page.getByTestId('start-game').waitFor();
   await page.evaluate(s=>localStorage.setItem('stavanger-z.region.v2',JSON.stringify(s)),save);await page.reload();
   await page.getByRole('button',{name:new RegExp(`Fortsett dag ${save.day}`)}).click();await page.locator('.rz-map[aria-busy=false]').waitFor();await page.evaluate(()=>document.fonts.ready);await exact();
   await page.getByTestId('nav-crew').click();await page.getByRole('button',{name:'Velg Ingrid til oppdrag',exact:true}).click();await page.locator(`[data-task=${action}]`).click();
   if(action!=='rest')await page.mouse.click(viewport.width/2,viewport.height/2);
   const dialog=page.getByRole('dialog',{name:'Planlegg oppdrag',exact:true});await dialog.waitFor();
   const measure=async()=>dialog.locator('.cmd-scroll').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight}));
   await dialog.getByRole('button',{name:'Velg ledige her',exact:true}).click();assert.equal(await dialog.locator('.cmd-person input:checked').count(),5);
   fit=await measure();if(viewport.width>=800)assert(fit.scroll<=fit.client+2,`Five-person ${action} must fit on PC: ${JSON.stringify(fit)}`);
   if(viewport.width>=800){await dialog.getByRole('button',{name:/^Våpen for Ingrid:/}).click();await dialog.getByRole('combobox',{name:'Våpen for Ingrid',exact:true}).selectOption('');gearFit=await measure();assert(gearFit.scroll<=gearFit.client+2,`Open gear editor must fit: ${JSON.stringify(gearFit)}`);await page.screenshot({path:`${output}/${action}-gear-${viewport.width}.png`});await dialog.getByRole('button',{name:'Lukk utstyrsvalg for Ingrid',exact:true}).click();}
   await dialog.getByRole('checkbox',{name:'Tor',exact:true}).uncheck();assert.equal(await dialog.locator('.cmd-person input:checked').count(),4);await exact();
   const controls=await dialog.locator('.cmd-gear-buttons button').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert(controls.every(c=>c.width>=44&&c.height>=44),'Gear buttons remain 44 px');const documentFit=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.equal(documentFit.width,documentFit.scroll,'No horizontal overflow');const confirm=await dialog.getByRole('button',{name:'Legg i dagsplanen',exact:true}).boundingBox();assert(confirm&&confirm.y+confirm.height<=viewport.height,'Confirmation remains visible');assert.deepEqual(errors,[]);
   await page.screenshot({path:`${output}/${action}-${viewport.width}.png`});results.push({viewport,action,actualDay:save.day,oneClickSelected:5,afterDeselect:4,fit,gearFit,exactStatePreserved:true,errors});
  } catch(error){await page.screenshot({path:`${output}/failure-${action}-${viewport.width}.png`}).catch(()=>{});results.push({viewport,action,fit,gearFit,error:String(error)});throw error;} finally{await context.close();}
 }
 console.log(JSON.stringify(results));
}finally{writeFileSync(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
