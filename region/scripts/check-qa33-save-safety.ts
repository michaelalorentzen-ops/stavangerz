/** QA33 F02: a normal snapshot can preserve outgoing progress in the same atomic write. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endDay, newRegionGame } from '../packages/gameplay/src/region/engine';
import { advanceCampaignCommit } from '../packages/gameplay/src/region/campaign';
import type { RegionWorld } from '../packages/gameplay/src/region/types';
import { listRegionSaves, loadRegionSave, loadRegionSlot, saveRegionSlot, saveRegionState, type RegionSaveStorage } from '../apps/game-client/app/region-save';
const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const camp=world.starts.find(s=>s.name.startsWith('Lundsneset'))!.zoneId;
function disk(){let raw:string|null=null,fail=false;const storage:RegionSaveStorage={getItem:()=>raw,setItem:(_,next)=>{if(fail)throw Error('quota');raw=next;},removeItem:()=>{raw=null;}};return{storage,raw:()=>raw,fail:(value:boolean)=>{fail=value;}};}
const equal=(a:unknown,b:unknown)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const initial=newRegionGame(world,camp,615,{difficulty:'story',avatarId:'ingrid',runId:'qa33-rewind'});delete initial.event;
const next=endDay(initial,world,[]).state;assert.equal(next.day,1);
const d=disk(),s=d.storage;saveRegionState(initial,{storage:s});saveRegionSlot(0,'Dag null',initial,{storage:s});saveRegionState(next,{storage:s});
// UI cancel performs no storage operation; keeping the exact original bytes is tested in the browser.
const before=d.raw();assert(before);d.fail(true);assert.throws(()=>loadRegionSlot(0,s,{preserveCurrent:true}),/Forrige/);assert.equal(d.raw(),before);d.fail(false);
equal(loadRegionSlot(0,s,{preserveCurrent:true}),initial);equal(loadRegionSave(s),initial);const slots=listRegionSaves(s);assert.equal(slots.length,2);equal(slots.find(slot=>slot.id===1)!.state,next);equal(slots[0].state,initial);
// An already preserved exact checkpoint needs no fourth slot.
saveRegionState(next,{storage:s});loadRegionSlot(0,s,{preserveCurrent:true});assert.equal(listRegionSaves(s).length,2);
const extra=structuredClone(initial);extra.day=3;advanceCampaignCommit(extra,'test:third');saveRegionSlot(2,'Annet kontrollpunkt',extra,{storage:s});const newer=structuredClone(next);newer.day=2;advanceCampaignCommit(newer,'test:second');saveRegionState(newer,{storage:s});const full=d.raw();assert.throws(()=>loadRegionSlot(0,s,{preserveCurrent:true}),/fulle/);assert.equal(d.raw(),full);equal(loadRegionSave(s),newer);
// The existing explicit discard mode still rewinds, without silently replacing snapshots.
equal(loadRegionSlot(0,s,{preserveCurrent:false}),initial);assert.equal(listRegionSaves(s).length,3);equal(listRegionSaves(s)[1].state,next);
const h=disk(),hc=newRegionGame(world,camp,615,{hardcore:true,avatarId:'ingrid',runId:'qa33-hc'});delete hc.event;saveRegionState(hc,{storage:h.storage});saveRegionSlot(0,'Hardcore',hc,{storage:h.storage});const advanced=endDay(hc,world,[]).state;saveRegionState(advanced,{storage:h.storage});equal(loadRegionSlot(0,h.storage,{preserveCurrent:true}),advanced);assert.throws(()=>saveRegionSlot(1,'Gammel dag',hc,{storage:h.storage}),/Hardcore/);
console.log('PASS QA33 rewind: optional exact outgoing backup, quota/full atomicity, explicit discard, dedup and Hardcore latest-only.');
