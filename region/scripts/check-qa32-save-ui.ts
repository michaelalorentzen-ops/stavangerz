/** Integrated three-slot journey and custom-key confirmation, desktop and mobile. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { newRegionGame } from '../packages/gameplay/src/region/engine';
import type { RegionWorld, RegionState } from '../packages/gameplay/src/region/types';
import { SAVE_KEY_REGION } from '../packages/gameplay/src/region/rules';
import { DEFAULT_SHORTCUT_BINDINGS } from '../apps/game-client/app/shortcut-bindings';
const GAME_PREFERENCES_KEY='stavanger-z.preferences.v1';
const DEFAULT_GAME_PREFERENCES={masterVolume:0,musicVolume:0,effectsVolume:0,reducedMotion:true,keyboardShortcuts:true,textScale:'normal',shortcutBindings:DEFAULT_SHORTCUT_BINDINGS};
const base = process.env.REGION_BASE_URL ?? 'http://localhost:3000';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const camp = world.starts.find(s => s.name.startsWith('Lundsneset'))!.zoneId;
const output = 'artifacts/qa32-save-ui'; mkdirSync(output, { recursive: true });
async function main() {
 const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
 try { for (const width of [1280, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 1280 ? 800 : 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const state = newRegionGame(world, camp, 805, { difficulty: 'story', avatarId: 'ingrid', runId: `save-ui-${width}` }); delete state.event;
  for (const z of Object.values(state.zones)) z.zombies = 0;
  await page.goto(base); await page.getByTestId('start-game').waitFor();
  await page.evaluate(({key,state,prefKey,prefs}) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(state)); localStorage.setItem(prefKey,JSON.stringify(prefs)); }, { key: SAVE_KEY_REGION,state,prefKey: GAME_PREFERENCES_KEY,prefs: {...DEFAULT_GAME_PREFERENCES,reducedMotion:true,shortcutBindings:{...DEFAULT_GAME_PREFERENCES.shortcutBindings,endDay:'KeyN'}} });
  await page.reload();
  await page.getByRole('button', { name: 'Gjennomspillinger · lagre og last' }).click();
  let library = page.getByRole('dialog', {name:'Gjennomspillinger',exact:true}); await library.waitFor();
  await library.locator('input').first().fill('Første leir'); await library.getByRole('button',{name:'Lagre',exact:true}).first().click();
  await library.getByRole('status').filter({hasText:'oppdatert'}).waitFor();
  if(width===1280) assert(await library.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Desktop library needs no scrolling');
  await page.screenshot({path:`${output}/library-${width}.png`});
  await library.getByRole('button',{name:'Lukk gjennomspillinger'}).click();
  await page.getByRole('button',{name:/Fortsett dag/}).click();
  await page.getByTestId('end-day').waitFor(); assert.match(await page.getByTestId('end-day').getAttribute('title')??'',/N/);
  await page.keyboard.down('n');
  await page.getByRole('dialog',{name:'Ingen planlagte oppdrag'}).waitFor();
  await page.keyboard.down('n'); await page.keyboard.up('n');
  assert.equal(await page.evaluate(()=> (window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state.day),0,'Held first shortcut must not advance');
  await page.keyboard.press('n');
  await page.waitForFunction(()=> (window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state.day===1);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Flere oversikter'}).click();
  await page.getByRole('button',{name:'Gjennomspillinger · lagre og last'}).click();
  library=page.getByRole('dialog',{name:'Gjennomspillinger',exact:true});
  await library.getByRole('button',{name:'Last',exact:true}).first().click(); await library.getByRole('button',{name:'Bekreft',exact:true}).click();
  await page.waitForFunction(()=> (window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state.day===0);
  const loaded=await page.evaluate(()=> (window as unknown as {__szRegion:{state:RegionState}}).__szRegion.state); assert.deepEqual(loaded,JSON.parse(JSON.stringify(state)));
  await page.getByRole('button',{name:/FASE 1/}).click(); await page.getByRole('button',{name:'Seiersveier',exact:true}).click();
  await page.getByRole('region',{name:'Veien videre'}).waitFor(); await page.screenshot({path:`${output}/goals-${width}.png`});
  if(width===1280) assert(await page.getByRole('dialog').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Desktop goals needs no scrolling');
  assert.deepEqual(errors,[]); await context.close();
 }} finally {await browser.close();}
 console.log('PASS integrated save UI desktop/mobile, named snapshot/day/restore exactness, held custom key safety, dynamic HUD label and victory progress.');
}
main().catch(e=>{console.error(e);process.exit(1);});
