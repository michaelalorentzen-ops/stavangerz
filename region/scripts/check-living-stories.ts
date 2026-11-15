/** Real optional content: physical delivery, existing finite outcomes, fog and save safety. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newRegionGame} from '../packages/gameplay/src/region/engine';
import {routeBetween} from '../packages/gameplay/src/region/mobility';
import {PERSON_DISCOVERY_STORIES,LOCAL_OBSERVATIONS,personStoryIllustration} from '../packages/gameplay/src/region/discovery-content';
import {DISCOVERY_WORK,discoverySites,observeDiscoveries,visibleDiscoveries,discoveryOrderPreview,executeDiscoveryOrder,deliverDiscoveryReports,maintainDiscoveries,transmitDiscoveryReports,type DiscoveryRegionState} from '../packages/gameplay/src/region/discoveries';
import type {RegionWorld,ReportLine} from '../packages/gameplay/src/region/types';
const world=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const fresh=()=>{const s:DiscoveryRegionState=newRegionGame(world,world.starts[0].zoneId,1229);delete s.event;s.crewPositions=Object.fromEntries(s.survivors.map(p=>[p.id,{kind:'zone' as const,zoneId:s.homeZoneId}]));return s;};
const lines:ReportLine[]=[],clone=<T,>(s:T):T=>JSON.parse(JSON.stringify(s));
const place=(s:DiscoveryRegionState,id:string,zoneId:string)=>{s.crewPositions![id]={kind:'zone',zoneId};};
const entry=(s:DiscoveryRegionState,id:string)=>s.discoveries!.entries[id];
function operate(s:DiscoveryRegionState,id:string,choice?:string,deferred=false){
 const e=entry(s,id),person=e.boundPersonId!;place(s,person,e.zoneId);
 const target=choice?`${id}:${choice}`:id,kind=choice?'choice':'investigate';
 const p=discoveryOrderPreview(s,world,e.zoneId,target,[person],kind);assert.equal(p.ok,true,p.reason??'Valid discovery operation');
 const stock=clone(s.stock),r=executeDiscoveryOrder(s,world,{zoneId:e.zoneId,target,kind,crewIds:[person],hours:p.hours,delivery:'none'},lines);
 assert.equal(r.completed,true);assert.deepEqual(s.stock,stock,'Rewards are physical cargo, not global stock');
 if(!deferred){place(s,person,s.homeZoneId);deliverDiscoveryReports(s,world,lines);}return r;
}
const sites=discoverySites(fresh(),world);
for(const def of PERSON_DISCOVERY_STORIES){
 const s=fresh(),poi=world.pois.find(p=>def.siteTypes.includes(p.siteType??p.hqType??p.facilityType??'')&&p.zoneId!==sites.ordinary?.zoneId&&p.zoneId!==sites.tor?.zoneId)!;
 assert(poi);const evidence={zoneId:poi.zoneId,source:'scout' as const,reporterIds:[def.personId],delivery:'none' as const};
 observeDiscoveries(s,world,{...evidence,delivery:'radio',radioVerified:true},lines);assert.equal(s.discoveries?.entries[def.id],undefined,'A remote person is no local witness');
 place(s,def.personId,poi.zoneId);observeDiscoveries(s,world,evidence,lines);assert(!visibleDiscoveries(s).some(e=>e.id===def.id));
 const radio=clone(s);transmitDiscoveryReports(radio,world,[def.personId],false,lines);assert.equal(radio.discoveries?.entries[def.id],undefined);
 const dead=clone(s);dead.survivors.find(p=>p.id===def.personId)!.alive=false;maintainDiscoveries(dead,lines);deliverDiscoveryReports(dead,world,lines);assert.equal(dead.discoveries?.entries[def.id],undefined);
 place(s,def.personId,s.homeZoneId);deliverDiscoveryReports(s,world,lines);assert.equal(entry(s,def.id).poiId,poi.id);assert.equal(entry(s,def.id).illustration,personStoryIllustration(def,poi));
 assert.equal(discoveryOrderPreview(s,world,poi.zoneId,def.id,['tor'],'investigate').ok,false);
 operate(s,def.id,undefined,true);assert.equal(entry(s,def.id).status,'clue');assert.equal(discoveryOrderPreview(s,world,poi.zoneId,def.id,[def.personId],'investigate').ok,false,'Unreported revision blocks repeat work');
 place(s,def.personId,s.homeZoneId);deliverDiscoveryReports(s,world,lines);assert.deepEqual(entry(s,def.id).choices.map(c=>c.id),['follow','supplies']);
 const stop=clone(s);assert.deepEqual(operate(stop,def.id,'supplies').cargo,DISCOVERY_WORK[def.stopCargo]);assert.equal(entry(stop,def.id).status,'resolved');assert.equal(discoveryOrderPreview(stop,world,poi.zoneId,`${def.id}:supplies`,[def.personId],'choice').ok,false);
 const follow=clone(s),other=world.pois.find(p=>p.id!==poi.id&&def.siteTypes.includes(p.siteType??p.hqType??p.facilityType??'')&&routeBetween(follow,world,poi.zoneId,p.zoneId,false));if(other)follow.zones[other.zoneId].status='scouted';
 operate(follow,def.id,'follow');const next=entry(follow,def.id).followup!;assert(next);assert.notEqual(follow.zones[next.zoneId].status,'unknown');if(next.poiId)assert(world.pois.some(p=>p.id===next.poiId&&p.zoneId===next.zoneId&&p.name===next.poiName));
 operate(follow,def.id);const kit=clone(follow);assert.deepEqual(operate(kit,def.id,'kit').cargo,DISCOVERY_WORK.finishedKit);
 const share=clone(follow),hope=share.morale,loyalty=share.survivors.find(p=>p.id===def.personId)!.loyalty!,tor=share.survivors.find(p=>p.id==='tor')!.loyalty;
 operate(share,def.id,'share');assert.equal(share.morale,Math.min(100,hope+5));assert.equal(share.survivors.find(p=>p.id===def.personId)!.loyalty,Math.min(100,loyalty+5));assert.equal(share.survivors.find(p=>p.id==='tor')!.loyalty,tor);assert.deepEqual(entry(share,def.id).chosen,['follow','share']);assert.equal(entry(share,def.id).notes.length,5);
 const reloaded=clone(share),before=JSON.stringify(reloaded);assert.equal(discoveryOrderPreview(reloaded,world,entry(reloaded,def.id).zoneId,`${def.id}:share`,[def.personId],'choice').ok,false);assert.equal(JSON.stringify(reloaded),before);
 const loss=clone(follow);loss.survivors.find(p=>p.id===def.personId)!.health=0;maintainDiscoveries(loss,lines);assert.equal(entry(loss,def.id).status,'lost');assert.equal(loss.gameOver,undefined);
}
// Settings follow actual observed site data; person theme is only a fallback.
const marius=PERSON_DISCOVERY_STORIES.find(s=>s.personId==='marius')!;
for(const [site,illustration] of [['coastFarm','farm'],['marina','coast'],['hardware','industry'],['outdoorShop','shop'],['shootingRange','forest'],['school','residential']] as const){
 const poi=world.pois.find(p=>(p.siteType??p.hqType??p.facilityType??p.kind)===site)!;assert(poi,site);assert.equal(personStoryIllustration(marius,poi),illustration);
}
const leila=PERSON_DISCOVERY_STORIES.find(s=>s.personId==='leila')!,school=world.pois.find(p=>p.siteType==='school')!;
assert.equal(personStoryIllustration(leila,school),'residential');
const farm=world.pois.find(p=>p.hqType==='coastFarm'&&p.zoneId!==sites.ordinary?.zoneId&&p.zoneId!==sites.tor?.zoneId)!,farmStory=fresh();
place(farmStory,'marius',farm.zoneId);observeDiscoveries(farmStory,world,{zoneId:farm.zoneId,source:'search',reporterIds:['marius'],delivery:'radio',radioVerified:true},lines);
assert.equal(entry(farmStory,marius.id).illustration,'farm','A new Marius farm visit uses farm illustration');
entry(farmStory,marius.id).illustration='forest'; // Simulate a pre-fix historical note.
observeDiscoveries(farmStory,world,{zoneId:farm.zoneId,source:'search',reporterIds:['marius'],delivery:'radio',radioVerified:true},lines);
assert.equal(entry(farmStory,marius.id).illustration,'forest','Existing saved illustration is not retconned');
const local=fresh(),stock=clone(local.stock),hope=local.morale;
for(const zone of world.zones.filter(z=>z.level===3)){
 place(local,'tor',zone.id);observeDiscoveries(local,world,{zoneId:zone.id,source:'search',reporterIds:['tor'],delivery:'radio',radioVerified:true},lines);
 if(LOCAL_OBSERVATIONS.every(d=>local.discoveries?.entries[`local-${d.id}`]))break;
}
for(const def of LOCAL_OBSERVATIONS){const e=entry(local,`local-${def.id}`);assert(e,def.id);assert.equal(e.status,'resolved');assert.equal(e.illustration,def.illustration);assert.equal(e.poiId,'');assert.equal(world.zones.find(z=>z.id===e.zoneId)?.name,e.poiName);}
assert.deepEqual(local.stock,stock);assert.equal(local.morale,hope);
for(const def of LOCAL_OBSERVATIONS){const e=entry(local,`local-${def.id}`);place(local,'tor',e.zoneId);observeDiscoveries(local,world,{zoneId:e.zoneId,source:'search',reporterIds:['tor'],delivery:'radio',radioVerified:true},lines);}
assert.equal(Object.keys(local.discoveries!.entries).filter(id=>id.startsWith('local-')).length,6);
console.log('PASS living stories: 3 optional person chains/3 outcomes each; known reachable follow-up; physical/private reports; correct loyalty; finite cargo; reload/death/repeat; 6 reward-free local observations.');
