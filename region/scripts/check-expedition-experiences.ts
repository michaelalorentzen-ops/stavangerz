/** Authoritative narrative: actual orders, once-only visibility, checkpoints and save retention. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { endDay, newRegionGame, startRegionDay, continueRegionDay } from '../packages/gameplay/src/region/engine';
import { reportExperiences, recordedExperiences, hasRecordedExperience } from '../packages/gameplay/src/region/experiences';
import type { RegionState, RegionWorld, RegionOrder, RegionReport } from '../packages/gameplay/src/region/types';
async function main() {
const original = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const template = original.zones.find(z=>z.level===3)!;
const world: RegionWorld = {...original,zones:Array.from({length:22},(_,i)=>({...template,id:`z${i}`,name:`Testområde ${i}`,parentId:'l2',measures:{...template.measures!,floor:0,homes:0,coastM:0,farm:0,forest:0,industry:0,retail:0}})),neighbours:Array.from({length:21},(_,i)=>({a:`z${i}`,b:`z${i+1}`,borderM:10})),links:[],pois:[{id:'test-place',name:'Fiktivt teststed',zoneId:'z0',role:'resource',kind:'resource',siteType:'school',at:[5.7,59]}],starts:[]};
function fresh():RegionState {const s=newRegionGame(world,'z0',51);delete s.event;for(const z of Object.values(s.zones)){z.zombies=0;z.status='scouted';z.intel={min:0,max:0,day:0};}s.stock.food=s.stock.water=s.stock.building=s.stock.ammo=200;return s;}
const ids=['ingrid','marius','leila','tor'];
const order=(action:RegionOrder['action'],survivorIds=ids,zoneId='z0',target?:string):RegionOrder=>({id:`test:${action}:${zoneId}:${survivorIds.join('-')}`,action,survivorIds,zoneId,...(target?{target}:{})});
function run(state:RegionState,orders:RegionOrder[]){const input=JSON.stringify(state),result=endDay(state,world,orders);assert.equal(JSON.stringify(state),input,'Caller remains unchanged');assert.deepEqual(result.report.replay!.flatMap(stage=>stage.lines),result.report.lines,'Report/replay remain identical after deduplication');return result;}
const beat=(report:RegionReport,kind:string)=>reportExperiences(report).find(item=>item.kind===kind);
const seen=new Set<string>(),a=fresh();
const scouted=run(a,[order('scout',['ingrid']),order('scout',['marius'])]);
assert.deepEqual(scouted,run(a,[order('scout',['ingrid']),order('scout',['marius'])]));
assert.equal(reportExperiences(scouted.report).filter(e=>e.kind==='scout').length,1);
assert.equal(beat(scouted.report,'scout')!.participants[0].name,'Ingrid');assert.equal(beat(scouted.report,'scout')!.voice!.personId,'ingrid');assert.equal(beat(scouted.report,'scout')!.facts.minimum,0);
assert.equal(beat(scouted.report,'poi')!.facts.poiId,'test-place');assert.equal(beat(scouted.report,'poi')!.facts.poiName,'Fiktivt teststed');
for(const e of reportExperiences(scouted.report))seen.add(e.kind);
assert.deepEqual(recordedExperiences(scouted.state).map(e=>e.kind),reportExperiences(scouted.report).map(e=>e.kind),'Same-day archive preserves actual publication order, not alphabetical ids');
const again=structuredClone(scouted.state);delete again.event;assert.equal(beat(run(again,[order('scout')]).report,'scout'),undefined);
const searched=run(fresh(),[order('search')]);assert(beat(searched.report,'search'));assert(beat(searched.report,'gear'));
assert.equal(beat(searched.report,'gear')!.facts.itemCount,searched.state.gear!.items.filter(i=>i.provenance.kind==='search').length);
assert((beat(searched.report,'search')!.facts.searchAfter as number)>(beat(searched.report,'search')!.facts.searchBefore as number));
for(const e of reportExperiences(searched.report))seen.add(e.kind);
const enemy=fresh();enemy.zones.z0.zombies=6;const fought=run(enemy,[order('clear')]);assert((beat(fought.report,'combat')!.facts.killed as number)>0);assert((beat(fought.report,'combat')!.facts.killed as number)<=fought.report.killed);seen.add('combat');
assert.equal(beat(run(fresh(),[order('clear')]).report,'combat'),undefined,'No invented combat in an empty zone');
const claimed=run(fresh(),[order('claim')]);assert.equal(claimed.state.zones.z0.status,'controlled');assert(beat(claimed.report,'claim'));seen.add('claim');
const defended=fresh();defended.zones.z0.status='controlled';const wall=run(defended,[order('fortify')]);assert(Object.values(wall.state.barricades).some(n=>n>0));assert(beat(wall.report,'perimeter'));seen.add('perimeter');
assert.equal(beat(run(defended,[order('guard')]).report,'perimeter'),undefined,'Day guard is not permanent infrastructure');
const buildBase=structuredClone(defended);buildBase.phase=2;const partial=run(buildBase,[order('build',['tor'],'z0','barricades')]);assert.equal(beat(partial.report,'perimeter'),undefined,'Partial work cannot claim a completed perimeter');
const part2=structuredClone(partial.state);delete part2.event;const completed=run(part2,[order('build',['tor'],'z0','barricades')]);assert(beat(completed.report,'perimeter')); 
const hq=run(defended,[order('establishHq')]);assert(hq.state.hq);assert(beat(hq.report,'hq'));seen.add('hq');
assert.equal(beat(run(fresh(),[order('fortify')]).report,'perimeter'),undefined,'Rejected order is not a success');
assert.deepEqual([...seen].sort(),['scout','search','combat','gear','claim','perimeter','poi','hq'].sort());
// Actual local stay then actual return: no data is made public just because the action ran.
const awayOrder={...order('scout',['ingrid'],'z1'),logistics:{stay:true}};
const away=run(fresh(),[awayOrder]);assert.equal(beat(away.report,'scout'),undefined);assert.equal(hasRecordedExperience(away.state,'scout'),false);assert.equal(recordedExperiences(away.state).length,0);
assert(Object.values(away.state.crewMissions!).some(m=>m.privateLines?.some(l=>l.experience?.kind==='scout')));
const loaded=JSON.parse(JSON.stringify(away.state)) as RegionState;delete loaded.event;loaded.survivors.find(p=>p.id==='ingrid')!.name='Nytt navn etter observasjonen';
const returned=run(loaded,[order('return',['ingrid'],'z0')]);assert(beat(returned.report,'scout'));assert.equal(beat(returned.report,'scout')!.day,0);assert.equal(beat(returned.report,'scout')!.participants[0].name,'Ingrid','Historical names are saved snapshots');
const twoAway=run(fresh(),[awayOrder,{...order('scout',['marius'],'z2'),logistics:{stay:true}}]);const twoHome=structuredClone(twoAway.state);delete twoHome.event;
const mergedReports=run(twoHome,[order('return',['ingrid'],'z0'),order('return',['marius'],'z0')]);assert.equal(reportExperiences(mergedReports.report).filter(e=>e.kind==='scout').length,1,'Two delayed witnesses still publish one first across report/replay boundaries');
const dead=JSON.parse(JSON.stringify(away.state)) as RegionState;delete dead.event;dead.survivors.find(p=>p.id==='ingrid')!.alive=false;dead.survivors.find(p=>p.id==='ingrid')!.health=0;
assert.equal(recordedExperiences(run(dead,[]).state).length,0,'Dead unreporting witness cannot publish a first');
const radio=fresh();radio.stock.radio=2;radio.stock.batteries=4;const called=run(radio,[{...awayOrder,communication:{radio:true}}]);assert(beat(called.report,'scout'));assert.deepEqual(called.state.crewPositions?.ingrid,{kind:'zone',zoneId:'z1'});
const risk=fresh();risk.zones.z1.zombies=60;const prompt=startRegionDay(risk,world,[order('clear',['ingrid'],'z1')],{avatarId:'ingrid'});assert.equal(prompt.status,'paused');assert.equal(hasRecordedExperience(prompt.state,'combat'),false);
const withdrawn=continueRegionDay(JSON.parse(JSON.stringify(prompt.state)),world,'withdraw');assert.equal(withdrawn.status,'complete');if(withdrawn.status!=='complete')throw new Error('Withdraw should settle');assert.deepEqual(withdrawn,continueRegionDay(prompt.state,world,'withdraw'));assert.equal(beat(withdrawn.report!,'combat'),undefined);
const distant=fresh();distant.zones.z3.status='controlled';distant.zones.z3.zombies=1;
const emptyOutpost=run(distant,[]);assert.equal(beat(emptyOutpost.report,'combat'),undefined,'Empty distant base defence does not invent a reportable encounter');assert.equal(hasRecordedExperience(emptyOutpost.state,'combat'),false);
const homeDefence=fresh();homeDefence.zones.z0.status='controlled';homeDefence.zones.z0.zombies=1;
const homeFight=run(homeDefence,[]);assert(beat(homeFight.report,'combat'));assert(beat(homeFight.report,'combat')!.participants.every(p=>ids.includes(p.id)));
const anonymous=fresh();anonymous.zones.z0.status='controlled';anonymous.zones.z0.zombies=1;anonymous.population.adults=2;anonymous.hq={zoneId:'z0',type:'camp',modules:[]};anonymous.work.guard=1;
anonymous.crewPositions=Object.fromEntries(ids.map(id=>[id,{kind:'zone' as const,zoneId:'z1'}]));
const populationFight=run(anonymous,[]);assert(beat(populationFight.report,'combat'));assert.deepEqual(beat(populationFight.report,'combat')!.participants,[]);assert.equal(beat(populationFight.report,'combat')!.voice,undefined,'Anonymous guards never speak as absent starters');
const personalNight=fresh();personalNight.zones.z3.status='controlled';personalNight.zones.z3.zombies=1;personalNight.flags.playerAvatarId='ingrid';personalNight.crewPositions={...personalNight.crewPositions,ingrid:{kind:'zone',zoneId:'z3'}};
const personalFight=run(personalNight,[]);assert.equal(beat(personalFight.report,'combat')!.zoneId,'z3');assert.deepEqual(beat(personalFight.report,'combat')!.participants.map(p=>p.id),['ingrid'],'A physically present avatar can witness distant night combat');
let watch=run(fresh(),[{...order('travel',['ingrid'],'z3'),logistics:{stay:true}}]).state;delete watch.event;watch.zones.z3.status='controlled';watch.zones.z3.zombies=1;
const remoteWatch=run(watch,[]);assert.equal(beat(remoteWatch.report,'combat'),undefined);assert.equal(hasRecordedExperience(remoteWatch.state,'combat'),false,'Remote witness without radio cannot immediately publish');
const watchReturn=structuredClone(remoteWatch.state);delete watchReturn.event;
const reportedWatch=run(watchReturn,[order('return',['ingrid'],'z0')]);assert.equal(beat(reportedWatch.report,'combat')!.zoneId,'z3');assert.equal(beat(reportedWatch.report,'combat')!.day,watch.day,'Night report is carried by the real returning witness');
const legacy=fresh();delete legacy.flags['experience:origin'];legacy.day=10;assert.equal(beat(run(legacy,[order('scout')]).report,'scout')!.record,'first-recorded');
let retained=structuredClone(scouted.state);delete retained.event;retained.stock.food=retained.stock.water=10000;
for(let i=0;i<40;i++){delete retained.event;retained=endDay(retained,world,[]).state;}
assert.equal(retained.reports.length,30);assert(recordedExperiences(retained).some(e=>e.kind==='scout'&&e.day===0),'Permanent journal survives report eviction');assert(recordedExperiences(retained).length<=8);assert.deepEqual(JSON.parse(JSON.stringify(retained.experiences)),retained.experiences);
if(process.env.EXPERIENCE_REFERENCE_ENGINE){
 const reference=await import(process.env.EXPERIENCE_REFERENCE_ENGINE) as typeof import('../packages/gameplay/src/region/engine');
 const projection=(value:RegionState)=>JSON.parse(JSON.stringify(value,(key,v)=>['reports','experiences','experience','memory','discoveries','campaign','privateLines'].includes(key)||key.startsWith('experience:')?undefined:v));
 let current=fresh(),old=reference.newRegionGame(world,'z0',51);delete old.event;for(const z of Object.values(old.zones)){z.zombies=0;z.status='scouted';z.intel={min:0,max:0,day:0};}old.stock.food=old.stock.water=old.stock.building=old.stock.ammo=200;
 const schedule:RegionOrder[][]=[[order('search')],[order('scout')],[order('claim')],[order('build',ids,'z0','watchpost')],[order('establishHq')],[order('fortify')],[order('clear',ids,'z1')]];
 for(const [i,plan] of schedule.entries()){if(i===6){current.zones.z1.zombies=70;old.zones.z1.zombies=70;}delete current.event;delete old.event;current=endDay(current,world,plan).state;old=reference.endDay(old,world,plan).state;assert.deepEqual(projection(current),projection(old),'Exact numerical/physical parity with unchanged baseline engine');}
 console.log('PASS numerical reference parity:',createHash('sha256').update(JSON.stringify(projection(current))).digest('hex'));
}
console.log('PASS expedition experiences: eight real firsts, once/reload, private/dead/radio/checkpoint gates, legacy honesty and 40-day permanent retention.');
}
main().catch(e=>{console.error(e);process.exit(1);});
