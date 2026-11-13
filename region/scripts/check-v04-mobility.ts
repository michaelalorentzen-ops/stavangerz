import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame, startRegionDay, continueRegionDay, endDay, pendingTurnDecision, present } from '../packages/gameplay/src/region/engine';
import { routeBetween, missionPreview, redirectMission, ensureMobility } from '../packages/gameplay/src/region/mobility';
import { communicationsStatus } from '../packages/gameplay/src/region/communications';
import { gearStateFor } from '../packages/gameplay/src/region/gear';
import type { RegionWorld, RegionState, RegionOrder } from '../packages/gameplay/src/region/types';
const original = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const template = original.zones.find(z => z.level === 3)!;
const world: RegionWorld = { ...original, zones: Array.from({length:22},(_,i)=>({...template,id:`z${i}`,name:`Sone ${i}`,parentId:'l2',measures:{...template.measures!,floor:0,homes:0,coastM:0}})), neighbours:Array.from({length:21},(_,i)=>({a:`z${i}`,b:`z${i+1}`,borderM:10})),links:[],pois:[],starts:[] };
function fresh(): RegionState { const s=newRegionGame(world,'z0',51);delete s.event;for(const z of Object.values(s.zones)){z.zombies=0;z.status='scouted';z.intel={min:0,max:0,day:0};}s.stock.food=s.stock.water=200;return s; }
const order=(id:string,action:RegionOrder['action'],zoneId:string,ids=['marius']):RegionOrder=>({id,action,zoneId,survivorIds:ids});
const s=fresh(); const input=JSON.stringify(s);
const short= startRegionDay(s,world,[order('short','search','z1')]);assert.equal(short.status,'complete');
assert.equal(JSON.stringify(s),input); assert.equal(short.state.crewPositions?.marius.kind,'zone');
assert.ok(present(short.state).some(p=>p.id==='marius'),'Short trip really returns before night');
const long=startRegionDay(s,world,[order('long','travel','z20')]);assert.equal(long.status,'complete');
assert.equal(long.state.crewPositions?.marius.kind,'transit');assert.equal(present(long.state).some(p=>p.id==='marius'),false);
let next=structuredClone(long.state);delete next.event;
const second=startRegionDay(next,world,[]);assert.equal(second.status,'complete');
assert.deepEqual(second.state.crewPositions?.marius,{kind:'zone',zoneId:'z20'});
const mission=Object.values(second.state.crewMissions??{}).find(m=>m.orderId==='long')!;
let redirected=structuredClone(second.state);delete redirected.event;
const returning=startRegionDay(redirected,world,[order('back','return','z0')]);assert.equal(returning.state.crewPositions?.marius.kind,'transit');
next=returning.state;delete next.event;
const home=startRegionDay(next,world,[]);assert.deepEqual(home.state.crewPositions?.marius,{kind:'zone',zoneId:'z0'});
const depot=fresh();ensureMobility(depot);depot.mobility!.depots.z2={metal:8,food:5};
const retrieve=startRegionDay(depot,world,[order('cache','retrieve','z2')]);assert.equal(retrieve.status,'complete');
assert.equal(retrieve.state.mobility!.depots.z2.metal,0);assert.equal(retrieve.state.stock.metal,8);
const delivery=fresh();const sup=order('supply','supply','z2');sup.logistics={cargo:{food:10,water:5}};
const delivered=startRegionDay(delivery,world,[sup]);assert.equal(delivered.state.mobility!.depots.z2.food,10);
const dangerous=fresh();dangerous.zones.z1.zombies=60;
const personal=order('risk','clear','z1',['ingrid']);
const pause=startRegionDay(dangerous,world,[personal],{avatarId:'ingrid'});assert.equal(pause.status,'paused');
assert.equal(pause.state.turnCheckpoint?.stage,'before-field-order');assert.equal(pause.state.zones.z1.zombies,60,'Field action has not run before mandatory decision');
assert.equal(pause.state.crewPositions?.ingrid.kind,'zone');assert.equal(pendingTurnDecision(pause.state)?.kind,'field-encounter');
const json=JSON.parse(JSON.stringify(pause.state));const withdrew=continueRegionDay(json,world,'withdraw');
assert.equal(withdrew.status,'complete');assert.deepEqual(withdrew,continueRegionDay(pause.state,world,'withdraw'));
assert.equal(withdrew.state.zones.z1.zombies<=60,true);assert.throws(()=>continueRegionDay(pause.state,world,'skip'));
const autonomous=startRegionDay(dangerous,world,[personal]);assert.equal(autonomous.status,'complete','No avatar or opt-in radio: fieldleader decides');
const radio=fresh();radio.zones.z1.zombies=60;radio.stock.radio=2;radio.stock.batteries=4;
const call={...personal,communication:{radio:true,contactOnCritical:true}};
const escalated=startRegionDay(radio,world,[call]);assert.equal(escalated.status,'paused');assert.equal(communicationsStatus(escalated.state,world,['ingrid']).connected,true);
assert.equal(escalated.state.stock.radio,1,'Field radio reserved physically once');
const radioHold=continueRegionDay(escalated.state,world,'withdraw');assert.equal(radioHold.state.stock.radio,2,'Physical return restores radio');
const noOpt=startRegionDay(radio,world,[{...personal,communication:{radio:true}}]);assert.equal(noOpt.status,'complete','Radio alone never escalates');
const deadRadio=structuredClone(radio);deadRadio.stock.batteries=0;assert.equal(startRegionDay(deadRadio,world,[call]).status,'complete');
const budget=fresh();const day15=startRegionDay(budget,world,[order('budget','search','z15')]);
assert.equal(day15.state.zones.z15.searched,0,'Fifteen hours of travel leaves no same-day work');
next=day15.state;delete next.event;
assert.ok(startRegionDay(next,world,[]).state.zones.z15.searched>0,'Deferred field work resumes the next operations window');
const changing=fresh();changing.zones.z1.status='controlled';changing.stock.building=100;changing.stock.metal=73;
const established=startRegionDay(changing,world,[order('newhq','establishHq','z1',['tor'])]);
assert.equal(established.state.homeZoneId,'z1');assert.equal(established.state.stock.metal??0,0,'Changing HQ address cannot teleport uncarried stock');
assert.equal(established.state.mobility!.depots.z0.metal,73);
// A stationary travel arrival releases the transport, then accepts new local work.
next=structuredClone(second.state);delete next.event;
assert.equal(startRegionDay(next,world,[order('local-scout','scout','z20')]).status,'complete');
// Legacy absence is unknown while away and returns through its finite saved provision ledger.
const legacy=fresh();legacy.survivors.find(p=>p.id==='ingrid')!.awayUntil=2;
let absent=startRegionDay(legacy,world,[]);assert.equal(absent.state.crewPositions?.ingrid.kind,'away-unknown');
next=absent.state;delete next.event;absent=startRegionDay(next,world,[]);assert.deepEqual(absent.state.crewPositions?.ingrid,{kind:'zone',zoneId:'z0'});
// Sea routes require an actual available/reserved boat and return that same boat.
const seaWorld:RegionWorld={...world,zones:world.zones.slice(0,2).map((z,i)=>({...z,at:[5.7+i*.005,59],measures:{...z.measures!,coastM:1000}})),neighbours:[]};
const sailor=newRegionGame(seaWorld,'z0',91);delete sailor.event;sailor.stock.boat=1;for(const z of Object.values(sailor.zones)){z.zombies=0;z.status='scouted';}
assert.deepEqual(routeBetween(sailor,seaWorld,'z0','z1'),['z0','z1']);
const island=startRegionDay(sailor,seaWorld,[order('island','scout','z1')]);assert.equal(island.state.stock.boat,1);assert.equal(island.state.crewPositions?.marius.kind,'zone');
const noBoat=structuredClone(sailor);noBoat.stock.boat=0;assert.equal(missionPreview(noBoat,seaWorld,order('blocked','scout','z1')).valid,false);
// Aggregate passengers and their supplies move once to a local depot, never allocate twice.
const people=fresh();people.population.adults=4;
const ferry=order('passengers','supply','z2',['marius','tor']);ferry.logistics={cargo:{food:12,water:12},passengers:{adults:2,children:0,elderly:0,sick:0}};
const arrived=startRegionDay(people,world,[ferry]);assert.equal(arrived.state.population.adults,4);assert.equal(arrived.state.mobility!.depotResidents!.z2.adults,2);assert.equal(arrived.state.crewMissions!['mission:0:passengers'].passengers,undefined);
// Hardcore can persist the very first mandatory field prompt with a new receipt.
const hc=newRegionGame(world,'z0',20,{hardcore:true,avatarId:'ingrid'});delete hc.event;hc.zones.z1.zombies=60;
const hp=startRegionDay(hc,world,[personal]);assert.equal(hp.status,'paused');assert.ok((hp.state.campaign?.sequence??0)>(hc.campaign?.sequence??0));
console.log('PASS mobility: actual routes/multi-day return, depot retrieval/supply, serializable personal field choice and bound radio opt-in.');
