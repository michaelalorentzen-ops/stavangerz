/** The treatment preview describes existing rules without changing costs or eligibility. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame, previewOrder, endDay } from '../packages/gameplay/src/region/engine';
import type { RegionState, RegionWorld } from '../packages/gameplay/src/region/types';
const original = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const template = original.zones.find(zone=>zone.level===3)!;
const world:RegionWorld = {...original,zones:Array.from({length:3},(_,i)=>({...template,id:`z${i}`,name:`Testområde ${i}`,parentId:'l2',measures:{...template.measures!,floor:0,homes:0,coastM:0}})),neighbours:[{a:'z0',b:'z1',borderM:10},{a:'z1',b:'z2',borderM:10}],links:[],pois:[],starts:[]};
const state = newRegionGame(world,'z0',621);delete state.event;
for(const zone of Object.values(state.zones)){zone.status='scouted';zone.zombies=0;zone.intel={min:0,max:0,day:0};}
state.crewPositions=Object.fromEntries(state.survivors.map(person=>[person.id,{kind:'zone' as const,zoneId:'z0'}]));
state.stock.medicine=10;state.survivors.find(person=>person.id==='leila')!.health=88;
const order={id:'heal-preview',action:'heal' as const,zoneId:'z0',survivorIds:['leila']};
const originalState=JSON.stringify(state),empty=previewOrder(state,world,order);
assert.equal(JSON.stringify(state),originalState,'Read-only preview');assert.equal(empty.valid,true,'No new rule blocks existing orders');assert.deepEqual(empty.costs,{medicine:1},'Existing minimum cost retained');assert.match(empty.text,/Ingen pasienter under 80 helse/);assert.match(empty.text,/hvile/);
const noPatients=endDay(state,world,[order]);assert.equal(noPatients.state.stock.medicine,9,'Text change does not silently refund or change simulation');assert(noPatients.report.lines.some(line=>line.title==='Skadde behandlet'&&line.text.includes('Ingen i crewet')));
const patients=structuredClone(state);patients.survivors.find(person=>person.id==='ingrid')!.health=70;patients.survivors.find(person=>person.id==='tor')!.health=79.9;patients.survivors.find(person=>person.id==='marius')!.health=60;patients.crewPositions!.marius={kind:'zone',zoneId:'z1'};
const two=previewOrder(patients,world,order);assert.deepEqual(two.costs,{medicine:2});assert.match(two.text,/2 pasienter under 80 helse/);assert.match(two.text,/Ingrid, Tor/);assert.doesNotMatch(two.text,/Marius|Leila/,'Absent and lightly injured people are not promised treatment');
patients.survivors.find(person=>person.id==='tor')!.health=80;const boundary=previewOrder(patients,world,order);assert.deepEqual(boundary.costs,{medicine:1});assert.match(boundary.text,/1 pasient under 80 helse/);assert.doesNotMatch(boundary.text,/Tor/,'80 is not below the existing threshold');
const local=structuredClone(state);local.population={adults:10,children:0,elderly:0,sick:5};local.mobility={version:1,depots:{z1:{}},radios:{},depotResidents:{z1:{adults:3,children:0,elderly:0,sick:2}}};
const home=previewOrder(local,world,order);assert.match(home.text,/3 syke i den lokale befolkningen/);assert.doesNotMatch(home.text,/bruk hvile/,'Sick population still gives the treatment a purpose');assert.deepEqual(home.costs,{medicine:1});
const depot=previewOrder(local,world,{...order,zoneId:'z1'});assert.match(depot.text,/2 syke i den lokale befolkningen/);assert.doesNotMatch(depot.text,/5 syke/,'Empire total is not local treatment capacity');
local.administration={version:1,regions:{r:{l1Id:'r',hqZoneId:'z2',leaderId:'marius',residents:{adults:2,children:0,elderly:0,sick:1},policy:'balanced',work:{...state.work},budget:{},establishedDay:0,alerts:[]}}};
const regional=previewOrder(local,world,{...order,zoneId:'z2'});assert.match(regional.text,/1 syk i den lokale befolkningen/);
console.log('PASS treatment preview: actual local patients, strict existing80 threshold, local/depot/regional sick counts, unchanged validity/cost/no-op behavior and no mutation.');
