/** Real field evidence, physical finite rewards, public history and deterministic context. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newRegionGame} from '../packages/gameplay/src/region/engine';
import {LOCAL_OBSERVATIONS,PERSON_DISCOVERY_STORIES} from '../packages/gameplay/src/region/discovery-content';
import {REACTIVE_OBSERVATIONS,REACTIVE_CHOICE_STORIES,type FieldContext} from '../packages/gameplay/src/region/discovery-reactive-content';
import {discoverySites,observeDiscoveries,deliverDiscoveryReports,executeDiscoveryOrder,discoveryOrderPreview,maintainDiscoveries,DISCOVERY_WORK,type DiscoveryRegionState,type DiscoveryEntry} from '../packages/gameplay/src/region/discoveries';
import type {RegionWorld} from '../packages/gameplay/src/region/types';
const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const fresh=()=>{const s:DiscoveryRegionState=newRegionGame(world,world.starts[0].zoneId,1229);delete s.event;s.crewPositions=Object.fromEntries(s.survivors.map(p=>[p.id,{kind:'zone' as const,zoneId:s.homeZoneId}]));s.discoveries={version:1,entries:{},pending:[],receipts:[]};return s;};
const mark=(s:DiscoveryRegionState,id:string)=>s.discoveries!.entries[id]={id,kind:'ordinary',title:id,poiId:'',poiName:'',zoneId:s.homeZoneId,status:'resolved',step:1,revision:0,discoveredDay:s.day,sources:['search'],notes:[],choices:[]};
function ready(){const s=fresh();for(const d of LOCAL_OBSERVATIONS)mark(s,`local-${d.id}`);for(const d of PERSON_DISCOVERY_STORIES)mark(s,d.id);mark(s,'emergency-cupboard');mark(s,'tor-repair-notes');return s;}
const place=(s:DiscoveryRegionState,id:string,zoneId:string)=>s.crewPositions![id]={kind:'zone',zoneId};
function work(s:DiscoveryRegionState,e:DiscoveryEntry,choice?:string){place(s,e.boundPersonId!,e.zoneId);const target=choice?`${e.id}:${choice}`:e.id,kind=choice?'choice':'investigate';const p=discoveryOrderPreview(s,world,e.zoneId,target,[e.boundPersonId!],kind);assert(p.ok,p.reason ?? 'Valid work');assert.equal(p.hours,4);const stock=clone(s.stock);const r=executeDiscoveryOrder(s,world,{zoneId:e.zoneId,target,kind,crewIds:[e.boundPersonId!],hours:p.hours,delivery:'none'},[]);assert.deepEqual(s.stock,stock);assert(r.completed);place(s,e.boundPersonId!,s.homeZoneId);deliverDiscoveryReports(s,world,[]);return r;}
for(const def of REACTIVE_CHOICE_STORIES){
 const s=ready(),legacy=discoverySites(s,world),poi=world.pois.find(p=>def.siteTypes.includes(p.siteType??p.hqType??p.facilityType??'')&&p.zoneId!==legacy.ordinary?.zoneId&&p.zoneId!==legacy.tor?.zoneId)!;assert(poi);
 const person=s.survivors.find(p=>p.id===def.personId)!;person.health=75;s.hq={...s.hq!,zoneId:s.homeZoneId};s.barricades={fixture:10};place(s,person.id,poi.zoneId);
 const evidence={zoneId:poi.zoneId,source:'search' as const,reporterIds:[person.id],delivery:'none' as const},a=clone(s),b=clone(s),stock=clone(s.stock);
 observeDiscoveries(a,world,evidence,[]);observeDiscoveries(b,world,evidence,[]);assert.deepEqual(a,b);assert.equal(a.seed,s.seed);assert.deepEqual(a.stock,stock);
 observeDiscoveries(s,world,evidence,[]);assert(!s.discoveries!.entries[def.id]);assert(s.discoveries!.pending.some(p=>p.entry.id===def.id));
 const dead=clone(s);dead.survivors.find(p=>p.id===person.id)!.alive=false;maintainDiscoveries(dead,[]);deliverDiscoveryReports(dead,world,[]);assert(!dead.discoveries!.entries[def.id]);
 const reload=clone(s);place(reload,person.id,reload.homeZoneId);deliverDiscoveryReports(reload,world,[]);const e=reload.discoveries!.entries[def.id];assert(e);assert.equal(e.storyId,undefined);
 assert(!discoveryOrderPreview(reload,world,e.zoneId,e.id,['ingrid'],'investigate').ok);
 if(def.id==='field-home-debrief'){assert.equal(e.status,'followup');assert.equal(e.zoneId,s.homeZoneId);assert.deepEqual(e.choices,[]);const hope=reload.morale,loyalty=reload.survivors.find(p=>p.id===person.id)!.loyalty!;assert.deepEqual(work(reload,e).cargo,{});assert.equal(reload.morale,Math.min(100,hope+5));assert.equal(reload.survivors.find(p=>p.id===person.id)!.loyalty,Math.min(100,loyalty+5));}
 else for(const choice of e.choices){const branch=clone(reload),r=work(branch,e,choice.id),preset=choice.id==='parts'?'salvage':choice.id==='kit'?'finishedKit':choice.id==='medical'?'ordinaryMedical':'ordinaryFood';assert.deepEqual(r.cargo,DISCOVERY_WORK[preset]);assert.equal(branch.discoveries!.entries[e.id].status,'resolved');assert(!discoveryOrderPreview(clone(branch),world,e.zoneId,`${e.id}:${choice.id}`,[person.id],'choice').ok);}
}
for(const def of REACTIVE_OBSERVATIONS){
 const s=ready();for(const story of REACTIVE_CHOICE_STORIES)mark(s,story.id);s.stock.food=0;s.stock.water=10;s.barricades={fixture:1};s.survivors.find(p=>p.id==='tor')!.health=75;
 const contexts=world.zones.filter(z=>z.level===3).map(zone=>{s.zones[zone.id].status='controlled';s.hq={...s.hq!,zoneId:zone.id};return {state:clone(s),zone,pois:world.pois.filter(p=>p.zoneId===zone.id),witnesses:['tor'],source:'search'} satisfies FieldContext;});
 const c=contexts.find(c=>def.matches(c));assert(c,def.id);const state=c.state as DiscoveryRegionState;
 const ownHistory=clone(c);for(const key of Object.keys(ownHistory.state.discoveries!.entries))if(key!==`local-${def.id.split('-')[0]}`)delete ownHistory.state.discoveries!.entries[key];assert(def.matches(ownHistory),'No obligation to visit unrelated environments');
 for(const other of REACTIVE_OBSERVATIONS)if(other.id!==def.id)mark(state,`local-${other.id}`);
 place(state,'tor',c.zone.id);const stock=clone(state.stock),hope=state.morale;
 observeDiscoveries(state,world,{zoneId:c.zone.id,source:'search',reporterIds:['tor'],delivery:'none'},[]);assert(!state.discoveries!.entries[`local-${def.id}`]);place(state,'tor',state.homeZoneId);deliverDiscoveryReports(state,world,[]);
 const e=state.discoveries!.entries[`local-${def.id}`];assert(e,def.id);assert.equal(e.illustration,def.illustration);assert.equal(e.status,'resolved');assert.equal(e.poiId,'');assert.deepEqual(state.stock,stock);assert.equal(state.morale,hope);
}
const healthy=ready(),care=REACTIVE_CHOICE_STORIES.find(s=>s.id==='field-care-priority')!,poi=world.pois.find(p=>care.siteTypes.includes(p.siteType??''))!;place(healthy,'leila',poi.zoneId);
observeDiscoveries(healthy,world,{zoneId:poi.zoneId,source:'search',reporterIds:['leila'],delivery:'none'},[]);assert(!healthy.discoveries!.pending.some(p=>p.entry.id===care.id));
const remote=ready();observeDiscoveries(remote,world,{zoneId:poi.zoneId,source:'search',reporterIds:['leila'],delivery:'radio',radioVerified:true},[]);assert(!remote.discoveries!.entries[care.id]);
const legacy=fresh(),before=JSON.stringify(legacy);assert(!discoveryOrderPreview(legacy,world,legacy.homeZoneId,'missing',['tor'],'investigate').ok);assert.equal(JSON.stringify(legacy),before);
console.log('PASS reactive content: 8 contextual finite observations, 2 direct cargo choices, 1 single-order HQ debrief; deterministic/private/physical, death, reload, legacy and witness gates.');
