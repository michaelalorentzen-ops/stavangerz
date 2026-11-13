/** Natural canonical bot runs; diagnostics never mutate a starting state or policy. */
import { readFileSync } from 'node:fs';
import { botPlay, goalMet, newRegionGame, phaseDef, residents, type RegionState, type RegionWorld } from '../packages/gameplay/src/region';
const world = JSON.parse(readFileSync('apps/game-client/public/world/region-v1.json', 'utf8')) as RegionWorld;
const days = Number(process.argv[2] ?? 150), seeds = Number(process.argv[3] ?? 3), extra = Number(process.argv[4] ?? 8), continuation = Number(process.argv[5] ?? 0);
const dense = world.zones.filter(z => z.level === 3).sort((a,b) => residents(b)-residents(a)).filter((_,i) => i%6===0).slice(0,extra).map(z => ({zoneId:z.id,name:`${z.name} (tett)`}));
const rows: { start: string; seed: number; state: RegionState }[] = [];
for (const start of [...world.starts,...dense]) for(let seed=1;seed<=seeds;seed++) rows.push({start:start.name,seed:seed*101,state:botPlay(world,newRegionGame(world,start.zoneId,seed*101),days)});
const blockers: Record<string,number> = {};
for (const row of rows) for(const goal of phaseDef(row.state).goals) if(!goalMet(row.state,world,goal.id)) blockers[goal.id]=(blockers[goal.id]??0)+1;
console.log(JSON.stringify({kind:'natural canonical bot',days,runs:rows.length,wins:rows.filter(r=>r.state.gameOver?.won).length,phases:Object.fromEntries([1,2,3,4,5].map(phase=>[phase,rows.filter(r=>r.state.phase===phase).length])),missingCurrentGate:blockers,phase5Reached:rows.filter(r=>r.state.phase>=5).length},null,2));
if(continuation>0){const survivors=rows.filter(r=>!r.state.gameOver).sort((a,b)=>b.state.phase-a.state.phase||b.state.research.done.length-a.state.research.done.length).slice(0,3);for(const row of survivors){const state=botPlay(world,row.state,continuation);console.log(JSON.stringify({kind:'natural canonical continuation',start:row.start,seed:row.seed,additionalDays:continuation,day:state.day,phase:state.phase,won:!!state.gameOver?.won,ending:state.gameOver?.reason,missing:phaseDef(state).goals.filter(g=>!goalMet(state,world,g.id)).map(g=>g.id),research:state.research.done.length}));}}
