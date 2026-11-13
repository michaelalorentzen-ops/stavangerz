/** Real React hook + local samples in Chromium; independent of gameplay fixtures. Run against a local server. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild') as { build: (options: unknown) => Promise<{ outputFiles: Array<{ text: string }> }> };
const url = process.env.REGION_TEST_URL ?? 'http://127.0.0.1:3000';
const out = process.env.REGION_AUDIO_ARTIFACTS ?? 'artifacts/audio-foley';
const app = path.resolve('apps/game-client/app');
const cues = ['order','confirm','day','event','combat','night','discovery','claim','victory','defeat'];
async function main() {
 mkdirSync(out,{recursive:true});
 const manifest = JSON.parse(readFileSync('apps/game-client/public/audio/manifest.json','utf8'));
 const bundle = await build({stdin:{resolveDir:app,loader:'tsx',contents:`
  import React,{useState} from 'react';import{createRoot}from'react-dom/client';
  import{useGameAudio}from'./game-audio';
  function Player({muted,scene}){const play=useGameAudio({masterVolume:muted?0:.55,musicVolume:.25,effectsVolume:.6},scene);return <section>${cues.map(c=>`<button onClick={()=>play('${c}')}>${c}</button>`).join('')}</section>}
  function Harness(){const[muted,setMuted]=useState(false),[scene,setScene]=useState('camp'),[mounted,setMounted]=useState(true);return <main>{mounted&&<Player muted={muted} scene={scene}/>}<button onClick={()=>setMuted(!muted)}>Mute</button><button onClick={()=>setMounted(!mounted)}>Unmount</button>{['camp','harbor','night'].map(s=><button key={s} onClick={()=>setScene(s)}>scene-{s}</button>)}</main>}
  createRoot(document.getElementById('audio-qa')).render(<Harness/>);
 `},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',define:{'process.env.NODE_ENV':'"production"'}});
 const browser = await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const page = await browser.newPage();const errors:string[]=[],requested=new Set<string>();page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/audio/')&&r.url().endsWith('.mp3')){assert.equal(r.status(),200);requested.add(new URL(r.url()).pathname)}});
 try {
  await page.addInitScript(()=>{
   const w=window as any;w.__audioContexts=[];w.__audioSources=[];w.__audioStats={buffers:0};w.__audioChunks=[];
   const connect=AudioNode.prototype.connect;
   AudioNode.prototype.connect=function(this:AudioNode,destination:any,...args:any[]){const c=this.context as any;if(destination instanceof AudioDestinationNode&&c.__capture)(connect as any).call(this,c.__capture);return(connect as any).call(this,destination,...args)} as any;
   const Original=AudioContext;
   w.AudioContext=class extends Original {
    constructor(...args:any[]){super(...args);w.__audioContexts.push(this);const c=this as any;c.__capture=this.createMediaStreamDestination();c.__recorder=new MediaRecorder(c.__capture.stream,{mimeType:'audio/webm'});c.__recorder.ondataavailable=(event:BlobEvent)=>w.__audioChunks.push(event.data);c.__recorder.start();}
    private probe<T extends AudioScheduledSourceNode>(source:T,buffer=false):T{const s=source as any;w.__audioSources.push(s);s.__disconnected=false;const disconnect=s.disconnect.bind(s),start=s.start.bind(s);s.disconnect=(...a:any[])=>{s.__disconnected=true;return disconnect(...a)};s.start=(...a:any[])=>{if(buffer)w.__audioStats.buffers++;return start(...a)};return source;}
    createOscillator(){return this.probe(super.createOscillator())}
    createBufferSource(){return this.probe(super.createBufferSource(),true)}
   };
  });
  // A same-origin text document provides asset URLs without mounting another game's audio hook.
  await page.goto(`${url}/audio/README.md`);await page.setContent('<div id="audio-qa"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:'confirm',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>(window as any).__audioContexts.length),0,'No AudioContext before trusted input');
  await page.getByRole('button',{name:'scene-camp',exact:true}).click();await page.waitForFunction(()=>(window as any).__audioStats.buffers>=1);
  for(const cue of cues){const before=await page.evaluate(()=>(window as any).__audioStats.buffers);await page.getByRole('button',{name:cue,exact:true}).click();await page.waitForFunction(n=>(window as any).__audioStats.buffers>n,before);await page.waitForTimeout(cue==='victory'||cue==='defeat'?5500:1800);}
  for(const scene of ['harbor','night']){await page.getByRole('button',{name:`scene-${scene}`,exact:true}).click();await page.waitForTimeout(1100);}
  assert.equal(await page.evaluate(()=>(window as any).__audioContexts.length),1);
  for(const row of manifest.assets)assert(requested.has(`/audio/${row.file}`),`Not loaded/decoded in browser: ${row.file}`);
  await page.getByRole('button',{name:'Mute',exact:true}).click();await page.waitForTimeout(150);const before=await page.evaluate(()=>(window as any).__audioStats.buffers);await page.getByRole('button',{name:'combat',exact:true}).click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>(window as any).__audioStats.buffers),before,'Mute creates no new cue');
  await page.getByRole('button',{name:'Mute',exact:true}).click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>(window as any).__audioContexts[0].state),'suspended');assert.equal(await page.evaluate(()=>(window as any).__audioSources.filter((s:any)=>!s.__disconnected).length),0);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>(window as any).__audioContexts[0].state),'running');
  await page.evaluate(()=>new Promise<void>(resolve=>{const recorder=(window as any).__audioContexts[0].__recorder;recorder.addEventListener('stop',()=>resolve(),{once:true});recorder.stop()}));
  const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await new Blob((window as any).__audioChunks,{type:'audio/webm'}).arrayBuffer())));writeFileSync(`${out}/actual-browser-soundscape.webm`,Buffer.from(bytes));
  await page.getByRole('button',{name:'Unmount',exact:true}).click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>(window as any).__audioContexts[0].state),'closed');assert.equal(await page.evaluate(()=>(window as any).__audioSources.filter((s:any)=>!s.__disconnected).length),0);assert.deepEqual(errors,[]);
  const result={result:'PASS',cues,assets:[...requested],trustedInput:true,mute:true,hiddenTab:true,cleanup:true,errors};writeFileSync(`${out}/results.json`,JSON.stringify(result,null,2));console.log('PASS real audio hook: 13 local assets, 10 Foley/result cues, 3 environments, trusted input, mute, hidden-tab cancellation, closed context and all sources disconnected.');
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
