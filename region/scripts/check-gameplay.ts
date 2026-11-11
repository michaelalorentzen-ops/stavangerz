import assert from 'node:assert/strict';
import { createGame, createPhaseOneGame, decideRecruitment, getView, getActionPreview, resolveGameDay, chooseEvent, validateSavedGame, type GameOrder } from '../packages/gameplay/src/index';
import { advanceCommunity, WATER_SOURCE_ID } from '../packages/gameplay/src/community';
import { exportSave, parseSave, readBackupSave, readSave, SAVE_KEY, writeSave } from '../apps/game-client/lib/save';

const initial=createGame(435);
const copy=JSON.stringify(initial);
const first:GameOrder[]=[
  {id:'a',type:'scout',targetId:'cell-002',crewIds:['ingrid']},
  {id:'b',type:'secure',targetId:'cell-003',crewIds:['tor']},
  {id:'c',type:'scavenge',targetId:'cell-003',crewIds:['leila'],poiId:'poi-camp-cache'},
];
assert.deepEqual(resolveGameDay(initial,first,0),resolveGameDay(initial,[...first].reverse(),0));
assert.equal(JSON.stringify(initial),copy,'Pure resolution cannot change the opening save');
assert.throws(()=>resolveGameDay(initial,[first[0],{...first[0],id:'duplicate-person'}],0),/én ordre|Samle personer/);
assert.equal(getActionPreview(initial,'scout','cell-010',['ingrid']).valid,false,'Unknown remote cells cannot be reached through unchecked territory');
assert.equal(getView(initial).zones.find(z=>z.id==='cell-002')?.threat,'Ukjent');
assert.equal(getActionPreview(initial,'scavenge','cell-002',['ingrid'],'poi-001').scavenge,undefined,'Unscouted caches must not leak a haul estimate');
for(const [crewIds,capacity] of [[['ingrid'],8],[['tor'],10],[['ingrid','tor'],18]] as const) {
  const estimate=getActionPreview(initial,'scavenge','cell-003',[...crewIds],'poi-camp-cache').scavenge!;
  assert.equal(estimate.capacity,capacity);
  const after=resolveGameDay(initial,[{id:'haul',type:'scavenge',targetId:'cell-003',crewIds:[...crewIds],poiId:'poi-camp-cache'}],0);
  for(const [resource,before] of Object.entries(initial.sim.stocks!['poi:poi-camp-cache']))assert.equal(before-after.sim.stocks!['poi:poi-camp-cache'][resource],estimate.cargo[resource]??0,'Haul preview must match the finite cache debit');
}

const plans:GameOrder[][]=[first,
  [{id:'a',type:'clear',targetId:'cell-002',crewIds:['ingrid','marius']}],
  [{id:'a',type:'claim',targetId:'cell-002',crewIds:['tor']}],
  [{id:'a',type:'secure',targetId:'cell-002',crewIds:['tor']}],
  [{id:'a',type:'establishBase',targetId:'cell-002',crewIds:['tor'],poiId:'poi-001'}],
];
let state=initial;
for(const plan of plans) {
  const beforeTotal=Object.values(state.sim.population).reduce((a,b)=>a+b,0);
  const previousDay=state.day;
  state=resolveGameDay(state,plan,state.day);
  assert.equal(state.day,previousDay+1);
  assert.equal(Object.values(state.sim.population).reduce((a,b)=>a+b,0),beforeTotal-state.lastReport!.kills);
  for(const entry of Object.values(state.lastReport!.resources))assert.equal(entry.after,entry.before-entry.consumed);
  assert.ok(Object.values(state.sim.population).every(n=>Number.isSafeInteger(n)&&n>=0));
  assert.deepEqual(validateSavedGame(JSON.parse(JSON.stringify(state))),[]);
}
assert.ok(state.base.established,'First small base must be reachable without capturing Rosenberg');
assert.throws(()=>resolveGameDay(state,[],state.day-1),/allerede avsluttet/);
const withDecision=chooseEvent(state,'help');
assert.equal(withDecision.sim.stocks!.camp.food,state.sim.stocks!.camp.food-4);
assert.equal(withDecision.lastReport!.resources.food.after,withDecision.lastReport!.resources.food.before-withDecision.lastReport!.resources.food.consumed);
assert.deepEqual(validateSavedGame({schemaVersion:1,gameRulesVersion:'m3.1',simulationWorld:{zoneIds:{}},worldSnapshot:{zones:[]}}).length>0,true);
const danger=createGame(435);
danger.zones['cell-002']={explored:true,observedDay:0,intel:{min:80,max:80},claimed:false,secured:false};
danger.sim={...danger.sim,population:{...danger.sim.population,'cell-002':80}};
danger.survivors.find(p=>p.id==='marius')!.health=30;
const casualty=resolveGameDay(danger,[{id:'danger',type:'clear',targetId:'cell-002',crewIds:['marius']}],0);
assert.ok(casualty.lastReport!.injuries.length||casualty.lastReport!.deaths.length,'Overwhelming combat must cause a concrete personal consequence');
console.log(`PASS M3: deterministic ordered plans, no opening mutation, crew double-use/stale day rejected, hidden intel, resource/zombie ledger; temporary base on day ${state.day}; injury/death consequence checked.`);

const phaseOpening=createPhaseOneGame(435);
const phaseOpeningCopy=JSON.stringify(phaseOpening);
const threatenedCamp=structuredClone(phaseOpening);
threatenedCamp.zones['cell-003'].intel={min:1,max:2};
threatenedCamp.sim={...threatenedCamp.sim,population:{...threatenedCamp.sim.population,'cell-003':1}};
const workOrder:GameOrder={id:'blocked-perimeter',type:'secure',targetId:'cell-003',crewIds:['tor']};
const workPreview=getActionPreview(threatenedCamp,workOrder.type,workOrder.targetId,workOrder.crewIds);
assert.equal(workPreview.interruption?.level,'Høy');
assert.equal(workPreview.valid,true,'The player can risk a work order based on an estimate');
const workBlocked=resolveGameDay(threatenedCamp,[workOrder],0);
assert.equal(workBlocked.sim.stocks!.camp.materials,threatenedCamp.sim.stocks!.camp.materials);
assert.ok(workBlocked.lastReport!.entries.some(e=>e.zoneId==='cell-003'&&e.title==='Perimeterarbeidet stanset'));
const careOpening=structuredClone(phaseOpening);
careOpening.phaseOne!.community=advanceCommunity(undefined,{day:1,searchedUnits:5,zoneId:'cell-003'});
const withSigne=decideRecruitment(careOpening,'buoy-signe','admit');
const allInField:GameOrder[]=['cell-002','cell-003','cell-004','cell-006'].map((targetId,index)=>({
  id:`care-regression-${index}`,type:'scout',targetId,crewIds:[phaseOpening.survivors[index].id],
}));
const noCare=resolveGameDay(withSigne,allInField,0);
assert.ok(noCare.lastReport!.entries.some(entry=>entry.survivorId==='buoy-signe'&&entry.title==='Signe manglet tilsyn'));
assert.ok(!noCare.lastReport!.injuries.includes('buoy-signe'));
const phasePlans:GameOrder[][]=[
  [{id:'scout',type:'scout',targetId:'cell-002',crewIds:['ingrid']},
   {id:'cache',type:'scavenge',targetId:'cell-003',crewIds:['tor'],poiId:'poi-camp-cache'}],
  [{id:'clear',type:'clear',targetId:'cell-002',crewIds:['ingrid','marius']},
   {id:'kit',type:'scavenge',targetId:'cell-002',crewIds:['leila'],poiId:'poi-001'}],
  [{id:'claim',type:'claim',targetId:'cell-002',crewIds:['tor']},
   {id:'surface',type:'surface',targetId:'cell-003',crewIds:['ingrid','leila'],mode:'together'}],
  [{id:'base',type:'establishBase',targetId:'cell-002',crewIds:['tor'],poiId:'poi-001'},
   {id:'search',type:'search',targetId:'cell-003',crewIds:['ingrid','leila'],mode:'spread'}],
  [{id:'install',type:'installWater',targetId:'cell-002',crewIds:['tor']}],
  [{id:'hq',type:'upgradeHQ',targetId:'cell-002',crewIds:['tor']},
   {id:'filter',type:'filterWater',targetId:'cell-002',crewIds:['ingrid']}],
];
let phase=phaseOpening;
for(const plan of phasePlans) {
  for(const order of plan) {
    const preview=getActionPreview(phase,order.type,order.targetId,order.crewIds,order.poiId,order.mode);
    assert.ok(preview.valid,`Day ${phase.day}, ${order.type}: ${preview.errors.join(' ')}`);
  }
  const next=resolveGameDay(phase,plan,phase.day);
  assert.deepEqual(next,resolveGameDay(phase,[...plan].reverse(),phase.day),'Phase 1 is independent of order submission order');
  assert.equal(next.day,phase.day+1);
  assert.deepEqual(validateSavedGame(JSON.parse(JSON.stringify(next))),[]);
  if(plan.some(order=>order.type==='search'||order.type==='surface')) {
    const source='buildings:cell-003';
    const priorHours=phase.phaseOne!.searches['cell-003']?.hours??0;
    assert.ok(next.phaseOne!.searches['cell-003'].hours>priorHours);
    for(const [resource,remaining] of Object.entries(next.sim.stocks![source])) {
      const withdrawn=phase.sim.stocks![source][resource]-remaining;
      const ledger=next.lastReport!.resources[resource];
      assert.ok(remaining>=0&&withdrawn>=0);
      assert.equal((next.sim.stocks!.camp[resource]??0)-(phase.sim.stocks!.camp[resource]??0),
        withdrawn-(ledger?.consumed??0),'Building supplies transfer to camp and are only reduced by explicit consumption');
    }
  }
  phase=next;
}
assert.equal(phase.phaseOne!.hq,false,'A single build order does not establish a permanent HQ');
assert.ok(phase.phaseOne!.hqProgress!>0);
assert.ok(phase.zones['cell-003'].routeIntel,'A thorough search reveals a usable route beyond standard loot');
const mappedRoute=phase.worldSnapshot.edges.find(e=>e.id===phase.zones['cell-003'].routeIntel!.id)!;
assert.ok([mappedRoute.fromCellId,mappedRoute.toCellId].includes('cell-003'));
const noShortcut=structuredClone(phase);
delete noShortcut.zones['cell-003'].routeIntel;
assert.equal(getActionPreview(noShortcut,'scout','cell-003',['ingrid']).travelMinutes-
  getActionPreview(phase,'scout','cell-003',['ingrid']).travelMinutes,15);
const firstBuildDay=phase.day;
for(let i=0;i<6&&!phase.phaseOne!.hq;i++){
  const savedPhase=JSON.parse(JSON.stringify(phase));
  assert.deepEqual(validateSavedGame(savedPhase),[]);
  phase=resolveGameDay(savedPhase,[{id:'continue-hq',type:'upgradeHQ',targetId:'cell-002',crewIds:['tor','ingrid','marius']}],savedPhase.day);
}
assert.ok(phase.day>=firstBuildDay+2,'HQ needs several workdays');
assert.equal(JSON.stringify(phaseOpening),phaseOpeningCopy);
assert.throws(()=>resolveGameDay(phase,[],phase.day-1),/allerede avsluttet/);
assert.ok(phase.base.established&&phase.phaseOne!.water&&phase.phaseOne!.hq,'Seed 435 reaches a local HQ through ordinary orders');
assert.equal(phase.sim.stocks!['poi:poi-001'].filterKit,0,'Filter kit is removed from the POI');
assert.equal(phase.sim.stocks!.camp.filterKit,0,'Installation uses the recovered kit');
assert.equal(phaseOpening.sim.stocks![WATER_SOURCE_ID].water-phase.sim.stocks![WATER_SOURCE_ID].water,8);
assert.equal(phase.lastReport!.resources.water.after,phase.lastReport!.resources.water.before-phase.lastReport!.resources.water.consumed);
assert.ok(phase.phaseOne!.searches['cell-003'].hours>=phase.phaseOne!.surface['cell-003']);
const legacyHq=structuredClone(phase);
delete legacyHq.phaseOne!.hqProgress;
assert.deepEqual(validateSavedGame(legacyHq),[],'Prior phase-1 saves keep an already completed HQ');

const legacyKey='stavanger-z.m3';
const legacySave=JSON.stringify({format:legacyKey,game:initial});
const saved=new Map([[legacyKey,legacySave]]);
const storage={getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>{saved.set(key,value);}};
assert.equal(readSave(storage),null);
assert.throws(()=>parseSave(legacySave),/M3/);
const payload={game:phase,orders:[],selectedZoneId:'cell-002'};
const envelope=writeSave(payload,null,storage);
assert.deepEqual(readSave(storage),envelope);
assert.deepEqual(parseSave(exportSave(envelope)).game.phaseOne,phase.phaseOne);
assert.throws(()=>writeSave(payload,null,storage),/annen fane/);
const continued=resolveGameDay(readSave(storage)!.game,[],phase.day);
const updated=writeSave({...payload,game:continued},envelope.revision,storage);
assert.equal(updated.game.day,phase.day+1);
assert.deepEqual(readBackupSave(storage),envelope);
assert.equal(saved.get(legacyKey),legacySave);
assert.equal(saved.get(SAVE_KEY),JSON.stringify(updated));
console.log(`PASS fase 1: vannrensing og HQ dag ${phase.day}, vedvarende søk, endelige lagre og separat M3-lagring.`);
