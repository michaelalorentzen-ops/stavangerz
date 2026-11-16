import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as current from '../packages/gameplay/src/region/engine';
import {ensureMobility} from '../packages/gameplay/src/region/mobility';
import type {RegionState, RegionWorld, RegionOrder} from '../packages/gameplay/src/region/types';
const source=JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json','utf8')) as RegionWorld;
const template=source.zones.find(z=>z.level===3)!;
const world:RegionWorld={...source,zones:Array.from({length:22},(_,i)=>({...template,id:`z${i}`,name:`Sone ${i}`,parentId:'l2',measures:{...template.measures!,floor:0,homes:0,coastM:0}})),neighbours:Array.from({length:21},(_,i)=>({a:`z${i}`,b:`z${i+1}`,borderM:10})),links:[],pois:[],starts:[]};
function fresh(){const s=current.newRegionGame(world,'z0',51);delete s.event;for(const z of Object.values(s.zones)){z.zombies=0;z.status='scouted';z.intel={min:0,max:0,day:0}}s.stock.food=s.stock.water=1000;return s;}
const order=(ids=['marius'],zoneId='z0'):RegionOrder=>({id:'rest-test',action:'rest',zoneId,survivorIds:ids});
function parity(s:RegionState,o:RegionOrder){const before=JSON.stringify(s),now=current.endDay(s,world,[o]);assert.equal(JSON.stringify(s),before,'Input stays pure');assert.deepEqual(current.endDay(s,world,[o]),now,'Deterministic replay');return now;}
const s=fresh();s.survivors.find(p=>p.id==='marius')!.fatigue=65;s.survivors.find(p=>p.id==='marius')!.health=82;s.survivors.find(p=>p.id==='tor')!.fatigue=12;s.survivors.find(p=>p.id==='tor')!.health=98;
const home=parity(s,order(['marius','tor']));const recovery=home.report.lines.filter(l=>l.category==='recovery');assert.equal(recovery.length,1);assert.equal(recovery[0].facts?.fatigueReduced,62);assert.equal(recovery[0].facts?.healthRecovered,7);assert.equal(recovery[0].priority,30);assert.equal(recovery[0].zoneId,'z0');assert.match(recovery[0].title,/Marius, Tor fikk hvile/);assert.equal(home.report.replay![0].lines.filter(l=>l.category==='recovery').length,1);
const capped=fresh();for(const p of capped.survivors){p.fatigue=0;p.health=100;}assert.equal(parity(capped,order()).report.lines.filter(l=>l.category==='recovery').length,0,'No invented improvement when capped');
const medbay=fresh();medbay.hq={zoneId:'z0',type:'house',modules:['medbay']} as any;medbay.survivors.find(p=>p.id==='marius')!.health=70;assert.equal(parity(medbay,order()).report.lines.find(l=>l.category==='recovery')?.facts?.healthRecovered,10);
const field=fresh();ensureMobility(field);field.crewPositions!.marius={kind:'zone',zoneId:'z20'};field.mobility!.depots.z20={food:100,water:100};const p=field.survivors.find(p=>p.id==='marius')!;p.fatigue=80;p.health=70;
let away=parity(field,order(['marius'],'z20'));assert.equal(away.report.lines.some(l=>l.category==='recovery'),false,'Distant crew without radio do not publish private recovery');const mission=Object.values(away.state.crewMissions!).find(m=>m.orderId==='rest-test')!;assert.equal(mission.privateLines?.filter(l=>l.category==='recovery').length,1,'Actual recovery follows existing private report transport');
away=JSON.parse(JSON.stringify(away));let delivered=0;for(let i=0;i<5;i++){delete away.state.event;away=current.endDay(away.state,world,[]);delivered+=away.report.lines.filter(l=>l.category==='recovery').length;if(delivered)break;}assert.equal(delivered,1,'One recovery report publishes at physical homecoming');delete away.state.event;assert.equal(current.endDay(away.state,world,[]).report.lines.filter(l=>l.category==='recovery').length,0,'Delivery never repeats');
console.log('PASS recovery: deterministic home/caps/medbay/remote rest, authoritative exact totals, operations replay, private report delivered once after JSON resume.');
