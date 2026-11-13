/** Claim continuity is geographic ownership, independently of a crew's physical route. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRegionGame, previewOrder } from '../packages/gameplay/src/region/engine';
import { ensureMobility } from '../packages/gameplay/src/region/mobility';
import type { RegionWorld } from '../packages/gameplay/src/region/types';
const source=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const template=source.zones.find(z=>z.level===3)!;
const world:RegionWorld={...source,zones:Array.from({length:6},(_,i)=>({...template,id:`z${i}`,name:`Sone ${i}`,measures:{...template.measures!,homes:0,floor:0}})),neighbours:Array.from({length:5},(_,i)=>({a:`z${i}`,b:`z${i+1}`,borderM:10})),links:[],pois:[],starts:[]};
const state=newRegionGame(world,'z0',51);delete state.event;
for(const zone of Object.values(state.zones)){zone.status='scouted';zone.zombies=0;zone.intel={min:0,max:0,day:0};}
ensureMobility(state);state.zones.z0.status='controlled';
const isolated=structuredClone(state);isolated.crewPositions!.marius={kind:'zone',zoneId:'z5'};
const isolatedPreview=previewOrder(isolated,world,{action:'claim',zoneId:'z5',survivorIds:['marius']});
assert.equal(isolatedPreview.valid,false,'Standing inside an isolated zone does not create an ownership connection');
assert.ok(isolatedPreview.errors.some(message=>message.includes('grense til en sone dere eier')));
const frontier=structuredClone(state);frontier.zones.z1.status=frontier.zones.z2.status='controlled';
const frontierPreview=previewOrder(frontier,world,{action:'claim',zoneId:'z3',survivorIds:['marius']});
assert.equal(frontier.crewPositions!.marius.kind,'zone');
assert.deepEqual(frontierPreview.errors,[],'A real frontier next to owned z2 remains claimable despite a three-hop route from HQ');
assert.equal(frontierPreview.valid,true);
console.log('PASS claim frontier: isolated local crew rejected; legitimate controlled frontier accepted independently of HQ travel distance.');
