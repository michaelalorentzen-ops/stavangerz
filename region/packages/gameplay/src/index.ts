import geography from '../../world-data/data/world-draft.json';
import type { WorldDefinition } from '../../world-data/src/model';
import { resolveDay, type NoiseOrder, type ResourceOrder, type SimulationWorld } from '../../simulation-core/src/index';
import { resolveResources } from '../../simulation-core/src/resources';
import { ACTION_LABELS, GAME_RULES_VERSION, INITIAL_SURVIVORS, RULES, WEAPONS } from './config';
import type { ActionPreview, ActionType, DayReport, GameOrder, GameView, PlayState, PlayerZone, ReportEntry, Survivor, ZoneProgress } from './model';
import { buildingWorkloads, fieldLootProgress, planFieldWork, type WorkMode } from './field-work';
import { advanceCommunity, canWork, chooseRecruitment, previewWater, WATER_KIT_POI_ID, WATER_KIT_RESOURCE, WATER_SOURCE_ID, WATER_SOURCE_INITIAL, type RecruitmentChoice } from './community';
import { districtReadiness, exposedEdges, watchCoverage } from './perimeter';
export type * from './model';
export { ACTION_LABELS, GAME_RULES_VERSION, RULES } from './config';

const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value));
const clamp = (n:number,min:number,max:number) => Math.max(min,Math.min(max,n));
const total = (population:Readonly<Record<string,number>>) => Object.values(population).reduce((a,b)=>a+b,0);
export const RESOURCE_LABELS:Record<string,string>={food:'mat',water:'vann',materials:'materialer',medicine:'medisin',ammo:'ammunisjon',filterKit:'filtersett'};
export const PHASE_ONE_RULES_VERSION='phase1.0';
const newActions:ReadonlySet<ActionType>=new Set(['raid','surface','search','watch','upgradeHQ','installWater','filterWater']);
const campStock = (s:PlayState):Record<string,number> => ({...(s.sim.stocks?.camp??{})});
const dailyNeeds = (living:number) => ({food:living*RULES.dailyFoodPerPerson,water:living*RULES.dailyWaterPerPerson});
export const HQ_WORK_HOURS = 20;
const HQ_MATERIALS = 12;
const hqMaterialsThrough = (hours:number) => Math.floor(hours * HQ_MATERIALS / HQ_WORK_HOURS);

function hqHoursForCrew(crew:Survivor[], completed:number): number {
  if (!crew.some(person => canWork(person) && person.skills.craft >= 4)) return 0;
  const hours = crew.filter(canWork).reduce((sum, person) => sum +
    (2 + person.skills.craft / 2) * person.health / 100 * (1 - person.fatigue / 150), 0);
  return Math.min(HQ_WORK_HOURS - completed, 8, Math.floor(hours));
}

function workInterruption(zone: ZoneProgress | undefined, day: number): ActionPreview['interruption'] {
  if (!zone?.intel || zone.observedDay === undefined) {
    return {level:'Ukjent', text:'Arbeidet stanser hvis det fortsatt er zombier på stedet. Speid for en bedre vurdering.'};
  }
  const age = day - zone.observedDay;
  if (zone.intel.min > 0 && age <= 2) {
    return {level:'Høy', text:`Zombier observert dag ${zone.observedDay}. Arbeidet krever et tomt område. Planlegg rydding før arbeidet, eller vent.`};
  }
  if (zone.intel.max > 0 || age > 1) {
    return {level:'Moderat', text:`Observasjonen fra dag ${zone.observedDay} gir ingen sikker avklaring. Arbeidet stanser ved lokal zombieaktivitet.`};
  }
  return {level:'Lav', text:'Siste observasjon var tom. Nye inntrengere kan likevel stanse arbeidet.'};
}
function random(seed:number,key:string) { let n=seed>>>0; for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0; return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}; }
function power(person:Survivor) {
  const weapon=WEAPONS[person.gear.weapon];
  return (person.skills.combat+weapon.power+Math.min(2,person.experience/15))*(.4+.6*person.health/100)*(1-person.fatigue/150);
}
function allConnections(state:PlayState) {return state.worldSnapshot.edges.filter(e=>e.status==='active'&&state.zones[e.fromCellId]&&state.zones[e.toCellId]);}
export function getWorld(state?:PlayState):WorldDefinition {return state?.worldSnapshot??geography as unknown as WorldDefinition;}

export function createGame(seed=435):PlayState {
  if(!Number.isSafeInteger(seed)||seed<0)throw new Error('Ugyldig seed.');
  const world=clone(getWorld());
  const start=world.zones.find(z=>z.id===RULES.startZone)!;
  const ring=start.geometry.type==='Polygon'?start.geometry.coordinates[0]:start.geometry.coordinates[0][0];
  // Use an existing known on-land junction point, not a new geographic investigation.
  const campPoint=world.pois.find(p=>p.id==='poi-junction-005')?.geometry.coordinates??ring[0];
  const campPoi={id:'poi-camp-cache',name:'Lagerrom ved nødbasen',cellId:RULES.startZone,kind:'supplies',geometry:{type:'Point' as const,coordinates:campPoint},sourceIds:['curation']};
  const snapshot:WorldDefinition={...world,pois:[...world.pois,campPoi]};
  const cells=snapshot.zones.filter(z=>z.level===3&&z.playable);
  const zones:Record<string,ZoneProgress>=Object.fromEntries(cells.map(z=>[z.id,{explored:z.id===RULES.startZone,claimed:z.id===RULES.startZone,secured:false,...(z.id===RULES.startZone?{observedDay:0,intel:{min:0,max:0}}:{})}]));
  const frontiers=[...new Map((snapshot.frontiers??[]).filter(f=>zones[f.cellId]).map(f=>[`${f.cellId}:${f.externalAreaId}`,f])).values()];
  const reservoirs=[...new Set(frontiers.map(f=>f.externalAreaId))].sort();
  const simulationWorld:SimulationWorld={zoneIds:cells.map(z=>z.id).sort(),reservoirIds:reservoirs,connections:[
    ...snapshot.edges.filter(e=>e.status==='active'&&zones[e.fromCellId]&&zones[e.toCellId]).map(e=>({id:e.id,fromId:e.fromCellId,toId:e.toCellId,allowZombies:e.modes.includes('walk'),capacityPerDirection:2})),
    ...frontiers.map(f=>({id:`outside:${f.cellId}:${f.externalAreaId}`,fromId:f.externalAreaId,toId:f.cellId,allowZombies:true,capacityPerDirection:1})),
  ]};
  const pop:Record<string,number>={};
  for(const cell of cells) {const rng=random(seed,cell.id);pop[cell.id]=cell.id===RULES.startZone?0:cell.id===RULES.baseZone?7:cell.id==='cell-001'?13:8+Math.floor(rng()*15);}
  for(const reservoir of reservoirs)pop[reservoir]=70;
  const stocks:Record<string,Record<string,number>>={camp:{food:40,water:44,medicine:6,materials:20,ammo:48}};
  for(const poi of snapshot.pois.filter(p=>zones[p.cellId])) {
    let stash:Record<string,number>={food:10,water:12,materials:6,medicine:0,ammo:0};
    if(poi.kind==='medical')stash={food:0,water:8,medicine:20,materials:0,ammo:0};
    if(poi.kind==='supplies')stash={food:45,water:45,medicine:2,materials:10,ammo:8};
    if(poi.id===RULES.basePoi)stash={food:30,water:36,medicine:4,materials:16,ammo:8};
    if(poi.id==='poi-camp-cache')stash={food:16,water:20,medicine:1,materials:8,ammo:6};
    if(poi.kind==='junction'||poi.kind==='transport'||poi.kind==='power')stash={food:0,water:0,medicine:0,materials:8,ammo:0};
    stocks[`poi:${poi.id}`]=stash;
  }
  return {schemaVersion:1,gameRulesVersion:GAME_RULES_VERSION,seed,day:0,worldSnapshot:snapshot,simulationWorld,sim:{day:0,population:pop,barriers:{},stocks},survivors:clone(INITIAL_SURVIVORS),zones,base:{zoneId:RULES.startZone,established:false},morale:65,reports:[],gameOver:false};
}

function buildingCache(buildings:number):Record<string,number> {
  return {food:Math.ceil(buildings*.7),water:Math.ceil(buildings*.7),materials:Math.ceil(buildings*.35),medicine:Math.floor(buildings*.1)};
}
export function createPhaseOneGame(seed=435):PlayState {
  const state=createGame(seed);
  const stocks={...state.sim.stocks,[WATER_SOURCE_ID]:{water:WATER_SOURCE_INITIAL}};
  const caches:Record<string,Record<string,number>>={...stocks};
  caches[`poi:${WATER_KIT_POI_ID}`]={...caches[`poi:${WATER_KIT_POI_ID}`],[WATER_KIT_RESOURCE]:1};
  const workloads=buildingWorkloads(state.worldSnapshot);
  for(const [id,load] of Object.entries(workloads))if(state.zones[id])caches[`buildings:${id}`]=buildingCache(load.buildings);
  return {...state,gameRulesVersion:PHASE_ONE_RULES_VERSION,phaseOne:{workloads,searches:{},surface:{},hq:false},sim:{...state.sim,stocks:caches}};
}

function pathTo(state:PlayState,target:string):string[] {
  if(!state.zones[target])return[];
  const start=state.base.zoneId;
  if(start===target)return[start];
  const queue=[[start]],visited=new Set([start]);
  while(queue.length) {
    const path=queue.shift()!;const here=path.at(-1)!;
    for(const e of allConnections(state)) {
      const next=e.fromCellId===here?e.toCellId:e.toCellId===here?e.fromCellId:'';
      if(!next||visited.has(next))continue;
      const proposed=[...path,next];
      if(next===target)return proposed;
      if(state.zones[next].claimed) {visited.add(next);queue.push(proposed);}
    }
  }
  return[];
}
function observe(state:PlayState,zoneId:string,skill:number,day:number) {
  const actual=state.sim.population[zoneId]??0;
  const uncertainty=actual===0?0:Math.max(1,Math.ceil(actual*(skill>=6?.12:.3)));
  state.zones[zoneId]={...state.zones[zoneId],explored:true,observedDay:day,intel:{min:Math.max(0,actual-uncertainty),max:actual+uncertainty}};
}

function planScavenge(cache:Record<string,number>,crew:Survivor[],stocks:Record<string,number>) {
  const capacity=crew.reduce((n,p)=>n+8+(p.skills.craft>=5?2:0),0);
  let remaining=capacity;const cargo:Record<string,number>={};
  const essentials=['food','water'].sort((a,b)=>(stocks[a]??0)-(stocks[b]??0)||a.localeCompare(b));
  for(const resource of [WATER_KIT_RESOURCE,...essentials,'materials','medicine','ammo']) {
    const amount=Math.min(cache[resource]??0,remaining);remaining-=amount;
    if(amount)cargo[resource]=amount;
  }
  return {capacity,cargo};
}
export function getActionPreview(state:PlayState,type:ActionType,targetId:string,crewIds:string[],poiId?:string,mode:WorkMode='together'):ActionPreview {
  const errors:string[]=[],reasons:string[]=[];const costs:Record<string,number>={};
  const zone=state.zones[targetId];const crew=crewIds.map(id=>state.survivors.find(p=>p.id===id)).filter((p):p is Survivor=>!!p);
  const route=pathTo(state,targetId);const stocks=campStock(state);
  const routeIntel = new Set(Object.values(state.zones).flatMap(progress => progress.routeIntel ? [progress.routeIntel.id] : []));
  const shortcuts = routeIntel.size ? allConnections(state).filter(edge => routeIntel.has(edge.id)) : [];
  const travelMinutes = route.slice(1).reduce((minutes, destination, index) => {
    const origin = route[index];
    const shortcut = shortcuts.some(edge =>
      (edge.fromCellId === origin && edge.toCellId === destination) || (edge.toCellId === origin && edge.fromCellId === destination));
    return minutes + (shortcut ? 30 : 45);
  }, 0);
  const interruption = ['secure','repair','establishBase','upgradeHQ'].includes(type) ? workInterruption(zone, state.day) : undefined;
  let hqWork: ActionPreview['hqWork'];
  let scavenge:ActionPreview['scavenge'];
  let work:ActionPreview['work'];let workRisk:ActionPreview['risk']|undefined;
  if(state.gameOver)errors.push('Gjennomspillingen er avsluttet. Start en ny verden.');
  if(!zone)errors.push('Velg en spillbar L3-sone.');
  if(!crewIds.length)errors.push('Velg minst én overlevende.');
  if(crew.length!==crewIds.length||new Set(crewIds).size!==crewIds.length)errors.push('Ugyldig eller gjentatt person.');
  if(crew.some(p=>!p.alive))errors.push('Døde overlevende kan ikke ta oppdrag.');
  if(crew.some(p=>p.alive&&!canWork(p)))errors.push('Beboere med omsorgsbehov kan ikke ta arbeidsoppdrag.');
  if(newActions.has(type)&&!state.phaseOne)errors.push('Ordren krever den nye fase 1-gjennomspillingen.');
  if(mode!=='together'&&mode!=='spread')errors.push('Ukjent arbeidsform.');
  if(!Object.hasOwn(ACTION_LABELS,type))errors.push('Ukjent handling.');
  if(!route.length||route.length>RULES.maxMissionHops+1)errors.push('Målet krever en rute gjennom overtatte soner og én tilgrensende sone.');
  if(type!=='rest'&&crew.some(p=>p.fatigue>=90))errors.push('En valgt person er utslitt og trenger hvile.');
  if(type==='clear'&&crew.some(p=>p.health<25))errors.push('Alvorlig skadde trenger behandling eller hvile før kamp.');
  let noise=type==='clear'?crew.reduce((n,p)=>n+WEAPONS[p.gear.weapon].noise,0):type==='secure'||type==='repair'||type==='establishBase'?3:type==='scavenge'?1:0;
  if(type==='clear') {
    costs.ammo=crew.reduce((n,p)=>n+WEAPONS[p.gear.weapon].ammo,0);
    if(zone&&!zone.explored&&!state.phaseOne)errors.push('Speid først for å finne mål og vurdere motstanden.');
  }
  if(type==='claim') {
    if(zone?.claimed)errors.push('Sonen er allerede overtatt.');
    if(!state.phaseOne&&(!zone?.explored||!zone.intel||zone.intel.max>0))errors.push('Rydd sonen og bekreft at den er tom før overtakelse.');
    if(!state.phaseOne&&zone?.observedDay!==undefined&&state.day-zone.observedDay>2)errors.push('Etterretningen er for gammel. Speid igjen.');
  }
  if(type==='secure'||type==='repair'||type==='establishBase') {
    if(!zone?.claimed)errors.push('Sonen må være overtatt først.');
    if(state.phaseOne&&type!=='establishBase'&&zone?.claimed) {
      const edges=exposedEdges(state).filter(e=>e.fromId===targetId||e.toId===targetId);
      const eligible=edges.filter(e=>type==='secure'?!(state.sim.barriers[e.id]?.durability>0):state.sim.barriers[e.id]?.durability>0);
      if(!eligible.length)errors.push(type==='secure'?'Ingen åpne ytterpassasjer å sikre her.':'Ingen aktive sperringer å reparere her.');
      else reasons.push(`${eligible.length} utsatte passasjer berøres; interne forbindelser trenger ingen sperring.`);
    } else if(!state.phaseOne) {
      if(type==='secure'&&zone?.secured)errors.push('Sonen er allerede sikret. Reparer hvis perimeteren er slitt.');
      if(type==='repair'&&!zone?.secured)errors.push('Det finnes ingen sikret perimeter å reparere.');
    }
    costs.materials=type==='secure'?RULES.secureMaterials:type==='repair'?RULES.repairMaterials:RULES.baseMaterials;
  }
  if(type==='establishBase') {
    if(targetId!==RULES.baseZone||(poiId&&poiId!==RULES.basePoi))errors.push('Første base etableres i et mindre anneks ved Buøy idrettsanlegg, sone 02.');
    if(!zone?.secured&&!state.phaseOne)errors.push('Sikre sone 02 før basen etableres.');
    if(state.base.established)errors.push('Den midlertidige basen er allerede etablert.');
    if((stocks.food??0)<RULES.baseFoodBuffer||(stocks.water??0)<RULES.baseFoodBuffer)errors.push(`Basen krever minst ${RULES.baseFoodBuffer} mat og vann i buffer.`);
  }
  if(type==='scavenge'||type==='raid') {
    const poi=state.worldSnapshot.pois.find(p=>p.id===poiId&&p.cellId===targetId);
    if(!zone?.explored&&type==='scavenge')errors.push('Speid området før du sanker forsyninger.');
    if(!poi)errors.push(type==='raid'?'Velg et forsyningssted i denne sonen.':'Velg et oppdaget forsyningssted i denne sonen.');
    if(poi&&zone?.explored&&total(state.sim.stocks?.[`poi:${poi.id}`]??{})===0)errors.push('Lageret er tømt. Finn et nytt POI.');
    if(poi&&zone?.explored)scavenge=planScavenge(state.sim.stocks?.[`poi:${poi.id}`]??{},crew,stocks);
    if(type==='raid') {noise=3;reasons.push('Raid kan omgå rekognosering, men trekker mer oppmerksomhet og kan gi skader.');}
  }
  if(state.phaseOne&&(type==='search'||type==='surface')) {
    const load=state.phaseOne.workloads[targetId];
    const previous=state.phaseOne.searches[targetId]?.hours??0;
    if(!load?.buildings)errors.push('Ingen bygningsarbeid er kartlagt her.');
    else {
      const cap=type==='surface'?Math.min(18,Math.ceil(load.hours*.2)):load.hours;
      const plan=planFieldWork(load,previous,crew,{mode,threat:zone?.intel?.max??12,travelHops:travelMinutes/45,limit:cap,superficial:type==='surface'});
      work={...plan,previousHours:previous,expectedCompleted:plan.completed,completed:state.phaseOne.searches[targetId]?.completed??0};
      noise=plan.noise;workRisk=plan.risk;
      if(previous>=cap)errors.push(type==='surface'?'Overflatesøket er ferdig. Velg grundig søk.':'Bygningssøket er ferdig.');
      if(previous<cap&&crew.length&&work.hours<=0)errors.push('Laget har ikke arbeidstid igjen etter reisen.');
      reasons.push(mode==='spread'?'Spredt lag dekker mer, men kan lettere bli isolert.':'Samlet lag arbeider saktere og kan støtte hverandre.');
    }
  }
  if(state.phaseOne&&['watch','upgradeHQ','installWater','filterWater'].includes(type)) {
    if(targetId!==state.base.zoneId)errors.push('Denne ordren gis ved den aktive basen.');
    if(type==='watch') {
      const coverage=watchCoverage(state,crew);
      reasons.push(`Laget kan dekke ${coverage.length} av ${exposedEdges(state).length} utsatte passasjer. Sperringer trenger ikke samme vakthold.`);
      if(crew.length&&!coverage.length)errors.push('Dette laget kan ikke dekke flere åpne ytterpassasjer nå.');
    }
    if(type==='upgradeHQ') {
      if(!state.base.established||!zone?.claimed)errors.push('Etabler en operasjonsbase først.');
      if(state.phaseOne.hq)errors.push('Basen er allerede et HQ.');
      if(!state.phaseOne.water)errors.push('HQ trenger fungerende vannrensing.');
      if(!crew.some(p=>p.skills.craft>=4))errors.push('HQ-arbeidet krever håndverk 4.');
      const completed = state.phaseOne.hq ? HQ_WORK_HOURS : state.phaseOne.hqProgress ?? 0;
      const planned = hqHoursForCrew(crew, completed);
      if (planned <= 0 && !state.phaseOne.hq) errors.push('Laget har ingen effektiv byggetid igjen.');
      hqWork = {completed, total:HQ_WORK_HOURS, planned};
      costs.materials = hqMaterialsThrough(completed + planned) - hqMaterialsThrough(completed);
      reasons.push('Fordel byggearbeidet over flere døgn. Permanent HQ gir bedre restitusjon.');
    }
    if(type==='installWater'||type==='filterWater') {
      const water=previewWater(type,{water:state.phaseOne.water,baseEstablished:state.base.established,crew,stocks,sourceWater:state.sim.stocks?.[WATER_SOURCE_ID]?.water??0});
      errors.push(...water.errors);Object.assign(costs,water.costs);
      if(type==='filterWater')reasons.push(`Forventet renset vann: ${water.output}. Tilgjengelig fra neste døgn.`);
    }
  }
  if(type==='rest'||type==='heal') {
    if(targetId!==state.base.zoneId)errors.push('Hvile og behandling skjer ved basen.');
    noise=0;
  }
  if(type==='heal') {
    costs.medicine=1;
    if(!state.survivors.some(p=>p.alive&&p.health<100))errors.push('Ingen trenger behandling akkurat nå.');
  }
  for(const [resource,cost] of Object.entries(costs))if((stocks[resource]??0)<cost)errors.push(`For lite ${RESOURCE_LABELS[resource]??resource} til handlingen.`);
  const groupPower=crew.reduce((n,p)=>n+power(p),0);const estimate=zone?.intel;
  let risk:ActionPreview['risk']='Lav';
  if(!zone?.explored)risk='Ukjent';
  else if(estimate&&estimate.max>0)risk=estimate.max>groupPower*1.8?'Høy':estimate.max>groupPower*.65?'Moderat':'Lav';
  if(zone?.explored&&workRisk)risk=workRisk;
  if(type==='raid'&&risk==='Lav'&&!zone?.secured)risk='Moderat';
  if(type==='rest'||type==='heal'||type==='establishBase')risk='Lav';
  if(type==='scout')reasons.push('Speiding gir antallsintervall og tidspunkt, men fjerner ingen zombier.');
  if(type==='clear')reasons.push('Kampkraft følger ferdighet, våpen, erfaring, helse og utmattelse. Skader og dødsfall er mulige.');
  if(type==='claim')reasons.push('Overtakelse gir en kontrollert adkomst, men stopper ikke innvandring.');
  if(type==='secure')reasons.push('Barrierer forsinker inntrengning og varsler press. De varer ikke evig.');
  if(type==='scavenge')reasons.push('Folk bærer begrensede forsyninger tilbake. POI-lageret tømmes permanent.');
  if(crew.some(p=>p.fatigue>45))reasons.push('Utmattelse reduserer kampkraft og øker risiko.');
  if(crew.some(p=>p.health<70))reasons.push('Skader reduserer kapasiteten. Leila kan behandle laget.');
  if(noise>0)reasons.push(`Aktiviteten gir støy ${noise}; nabozombier kan reagere samme natt.`);
  if(route.length)reasons.push(`Dagsoppdrag via ${route.map(id=>id.replace('cell-','')).join(' → ')}; laget returnerer til basen.`);
  const savedMinutes = (route.length-1)*45-travelMinutes;
  if(savedMinutes>0)reasons.push(`Kartlagte snarveier sparer ${savedMinutes} minutter på denne turen.`);
  return {valid:errors.length===0,errors,costs,risk,reasons,route,eta:1,travelMinutes,noise,interruption,hqWork,...(work?{work}:{}),...(scavenge?{scavenge}:{}),...(type==='clear'?{expectedKills:{min:Math.max(0,Math.floor(groupPower*.7)),max:Math.ceil(groupPower*1.15)}}:{})};
}

export function getView(state:PlayState):GameView {
  const publicReport=(report:DayReport)=>{const {population: _population,resources: _resources,...visible}=report;return visible;};
  const perimeter=state.phaseOne?exposedEdges(state):[];
  const zones=state.worldSnapshot.zones.filter(z=>z.level===3).map(z=>{
    const progress=state.zones[z.id]??{explored:false,claimed:false,secured:false};
    const incident=perimeter.filter(e=>e.fromId===z.id||e.toId===z.id);
    const secured=state.phaseOne?progress.claimed&&incident.length>0&&incident.every(e=>state.sim.barriers[e.id]?.durability>0):progress.secured;
    const status:PlayerZone['status']=secured?'Sikret':progress.claimed?'Overtatt':(state.phaseOne?progress.exteriorCleared:progress.explored&&progress.intel?.max===0)?'Ryddet':progress.explored?'Utforsket':'Ukjent';
    return {...progress,secured,id:z.id,name:z.name,playable:z.playable,status,threat:!progress.explored?'Ukjent':progress.intel?`${progress.intel.min}–${progress.intel.max} observert · dag ${progress.observedDay}`:'Ingen rapport'};
  });
  const pois=state.worldSnapshot.pois.map(p=>({id:p.id,name:p.name,cellId:p.cellId,kind:p.kind,discovered:!!state.zones[p.cellId]?.explored,...(state.zones[p.cellId]?.explored?{supplies:{...(state.sim.stocks?.[`poi:${p.id}`]??{})}}:{}),hqCandidate:!!p.hqCandidate}));
  const phaseOne=state.phaseOne?{...clone(state.phaseOne),district:districtReadiness(state),perimeter:perimeter.map(edge=>({id:edge.id,durability:state.sim.barriers[edge.id]?.durability??0})),waterSource:state.sim.stocks?.[WATER_SOURCE_ID]?.water??0,dailyNeeds:dailyNeeds(state.survivors.filter(p=>p.alive).length)}:undefined;
  return {day:state.day,survivors:clone(state.survivors),zones,pois,stocks:campStock(state),base:{...state.base},phaseOne,objective:{title:phaseOne?'Et distrikt som kan holde':'Et tak som holder',text:phaseOne?'Velg hvordan du skaffer forsyninger og utvider adkomsten. Bygg HQ og hold et sammenhengende distrikt med forsvarbar ytterkant.':'Speid, rydd, overta og sikre sone 02. Etabler så en liten base ved Buøy idrettsanlegg. Rosenberg er et senere mål.',targetId:RULES.baseZone,poiId:RULES.basePoi,complete:phaseOne?.district.complete??state.base.established},morale:state.morale,gameOver:state.gameOver,lastReport:state.lastReport?publicReport(state.lastReport):undefined,reports:state.reports.map(publicReport),event:state.event};
}

export function resolveGameDay(opening:PlayState,input:GameOrder[],expectedDay:number):PlayState {
  if(expectedDay!==opening.day||opening.sim.day!==opening.day)throw new Error('Denne dagen er allerede avsluttet. Last gjeldende lagring før nye ordre.');
  if(opening.gameOver)throw new Error('Ingen levedyktige overlevende gjenstår.');
  const phase:Record<ActionType,number>={scout:0,clear:1,claim:2,secure:3,repair:3,watch:4,scavenge:4,raid:4,surface:4,search:4,heal:5,rest:5,establishBase:6,installWater:6,filterWater:6,upgradeHQ:6};
  const orders=[...input].sort((a,b)=>phase[a.type]-phase[b.type]||a.targetId.localeCompare(b.targetId)||a.id.localeCompare(b.id));
  if(new Set(orders.map(o=>o.id)).size!==orders.length||orders.some(o=>!o.id))throw new Error('Ordrene må ha unike ID-er.');
  const jobs=new Set<string>();
  const used=new Set<string>();const reserved:Record<string,number>={};
  for(const order of orders) {
    const kind=['scavenge','raid'].includes(order.type)?'loot':['search','surface'].includes(order.type)?'work':['secure','repair'].includes(order.type)?'perimeter':order.type;
    const job=`${kind}:${order.targetId}:${kind==='loot'?order.poiId??'':''}`;
    if(jobs.has(job))throw new Error('Samle personer til samme oppdrag i én ordre.');
    jobs.add(job);
    const preview=getActionPreview(opening,order.type,order.targetId,order.crewIds,order.poiId,order.mode);
    if(!preview.valid)throw new Error(`${ACTION_LABELS[order.type]}: ${preview.errors.join(' ')}`);
    for(const id of order.crewIds){if(used.has(id))throw new Error('En overlevende kan bare ha én ordre per dag.');used.add(id);}
    for(const [resource,cost] of Object.entries(preview.costs))reserved[resource]=(reserved[resource]??0)+cost;
  }
  const openingStocks=campStock(opening);
  for(const [resource,cost] of Object.entries(reserved))if(cost>(openingStocks[resource]??0))throw new Error(`Ordrene bruker samme ${RESOURCE_LABELS[resource]??resource}-beholdning mer enn én gang.`);
  const state=clone(opening);const day=opening.day+1;const entries:ReportEntry[]=[];const injuries:string[]=[];const deaths:string[]=[];
  const resourceOrders:ResourceOrder[]=[];const noise:Record<string,number>={};const watched=new Set<string>();let kills=0;let searchedUnits=0;let searchZone='';
  const rng=random(state.seed,`day:${opening.day}`);const population={...state.sim.population};
  const entry=(type:ReportEntry['type'],title:string,text:string,zoneId?:string,survivorId?:string)=>entries.push({type,title,text,...(zoneId?{zoneId}:{}),...(survivorId?{survivorId}:{})});
  const spend=(id:string,resourceId:string,amount:number,reason:string)=>{if(amount)resourceOrders.push({id,type:'consume',resourceId,fromStockId:'camp',amount,reason});};
  function hurt(person:Survivor,amount:number,why:string,kind:'injury'|'care'='injury') {
    person.health=Math.max(0,person.health-amount);
    if(person.health===0&&person.alive){person.alive=false;deaths.push(person.id);state.morale=clamp(state.morale-15,0,100);entry('danger',`${person.name} er død`,why,undefined,person.id);}
    else if(person.alive) {
      if(kind==='injury') injuries.push(person.id);
      entry('warning',kind==='care'?`${person.name} manglet tilsyn`:`${person.name} er skadet`,`${why} Helse −${amount}.`,kind==='care'?state.base.zoneId:undefined,person.id);
    }
  }
  function reportBlockedWork(zoneId:string,title:string,text:string) {
    state.sim={...state.sim,population};
    observe(state,zoneId,4,day);
    entry('warning',title,text,zoneId);
  }
  const livingAtStart=state.survivors.filter(p=>p.alive).length;
  const required=dailyNeeds(livingAtStart);
  const restRecovery=RULES.restFatigueRecovery+(opening.phaseOne?.hq?8:0);
  for(const [resource,amount] of Object.entries(required)) {
    const available=openingStocks[resource]??0;spend(`needs:${resource}`,resource,Math.min(available,amount),'Dagens mat og vann');
    if(available<amount){entry('danger','Forsyningene strekker ikke til',`Behov ${amount} ${RESOURCE_LABELS[resource]??resource}, bare ${available} ved dagens start. Funn blir tilgjengelige i morgen.`);for(const p of state.survivors.filter(p=>p.alive))hurt(p,resource==='water'?9:5,'Mangel på nødvendige forsyninger.');}
  }
  entry('info','Dagens mat og vann',`${livingAtStart} overlevende trengte ${required.food} mat og ${required.water} vann. Dette ble satt av fra lageret før dagens oppdrag; nye funn kan brukes fra i morgen.`);
  for(const order of orders) {
    const crew=[...order.crewIds].sort().map(id=>state.survivors.find(p=>p.id===id)!).filter(p=>p.alive);
    if(!crew.length){entry('danger','Oppdraget ble avlyst','Ingen av de tildelte overlevende kunne gjennomføre etter dagens forsyningskrise.',order.targetId);continue;}
    const preview=getActionPreview(opening,order.type,order.targetId,order.crewIds,order.poiId,order.mode);
    const zone=state.zones[order.targetId];const names=crew.map(p=>p.name).join(' og ');
    const z=population[order.targetId]??0;
    if(state.phaseOne&&preview.travelMinutes>0)entry('info','Ruten laget fulgte',`${names} brukte anslagsvis ${preview.travelMinutes} min tur-retur via sone ${preview.route.map(id=>id.slice(-2)).join(' → ')}.`,order.targetId);
    let successful=true;
    switch(order.type) {
      case 'scout': {
        const skill=Math.max(...crew.map(p=>p.skills.scouting+(p.gear.utility==='Kikkert'?2:0)));
        // Observation is taken before tonight's migration and therefore ages naturally.
        state.sim={...state.sim,population};observe(state,order.targetId,skill,day);
        const intel=zone.intel=state.zones[order.targetId].intel;
        entry('success','Speiderrapport',`${names} observerte ${intel!.min}–${intel!.max} zombier. Områdets POI-er er nå undersøkt; ingen zombier ble fjernet.`,order.targetId);
        if(z>15&&rng()>.93)hurt(crew[0],12,'Et uventet møte under speidingen.');
        break;
      }
      case 'clear': {
        const strength=crew.reduce((n,p)=>n+power(p),0);
        const killed=Math.min(z,Math.max(1,Math.floor(strength*(.75+rng()*.4))));
        population[order.targetId]-=killed;kills+=killed;
        for(const p of crew) {
          const danger=Math.max(.025,(z-killed*.6)/Math.max(1,strength)*.2);
          if(rng()<Math.min(.85,danger))hurt(p,Math.round((12+rng()*20+Math.max(0,z-strength)*1.1)*(p.gear.protection==='Vernevest'?.65:1)),'Kamp mot flere mål enn laget klarte å holde på avstand.');
        }
        const remaining=population[order.targetId];zone.explored=true;zone.observedDay=day;zone.intel={min:remaining,max:remaining};
        if(state.phaseOne)zone.exteriorCleared=remaining===0;
        entry(remaining?'warning':'success',remaining?'Ryddingen fortsetter':'Området er ryddet',`${names} felte ${killed}. ${remaining?`${remaining} ble igjen ved retrett.`:'Ingen lokale zombier gjensto da laget dro.'} Våpen, erfaring, helse og utmattelse ga kampkraft ${Math.round(strength)}. Støy ${preview.noise} kan trekke nye inn senere.`,order.targetId);
        break;
      }
      case 'claim':
        if(z>(state.phaseOne?2:0)){successful=false;entry('warning','Overtakelsen ble avbrutt',`${names} fant for mye lokal bevegelse til å holde ruten. Vurder rydding eller en annen vei.`,order.targetId);state.sim={...state.sim,population};observe(state,order.targetId,6,day);}
        else {
          zone.claimed=true;
          if(state.phaseOne){state.sim={...state.sim,population};observe(state,order.targetId,5,day);}
          const zoneName=state.worldSnapshot.zones.find(item=>item.id===order.targetId)?.name??order.targetId;
          entry('success',`Overtok ${zoneName}`,`${names} opprettet kontroll i ${zoneName}. Sonen gir tilgang videre. Innvendig søk og forsvar er egne oppgaver.`,order.targetId);
        }
        break;
      case 'secure':case 'repair':
        if(z>0){successful=false;reportBlockedWork(order.targetId,'Perimeterarbeidet stanset','Laget møtte zombier på stedet. Ingen materialer ble brukt. Rydd sonen før perimeterarbeidet fortsetter.');}
        else {
          const craft=Math.max(...crew.map(p=>p.skills.craft));const durability=RULES.barrierDurability+craft*2;
          const barriers={...state.sim.barriers};
          const edges=(state.phaseOne?exposedEdges(state,order.targetId):state.simulationWorld.connections).filter(e=>(e.fromId===order.targetId||e.toId===order.targetId)&&(!state.phaseOne||(order.type==='secure'?!(barriers[e.id]?.durability>0):barriers[e.id]?.durability>0)));
          if(state.phaseOne&&!edges.length){successful=false;entry('info','Ingen utsatte passasjer','Dette er en indre sone. Ingen materialer ble brukt.',order.targetId);break;}
          for(const e of edges)barriers[e.id]={durability};
          state.sim={...state.sim,barriers};zone.secured=true;
          entry('success',order.type==='repair'?'Perimeteren er reparert':'Ytterpassasjer sikret',`${names} brukte ${preview.costs.materials} materialer på ${edges.length} passasjer. ${craft>=5?'Fagkunnskap ga ekstra holdbarhet.':'Enkel avsperring er på plass.'} Barrierer varsler press før brudd.`,order.targetId);
        }
        break;
      case 'scavenge':case 'raid': {
        const {cargo:found}=planScavenge(state.sim.stocks?.[`poi:${order.poiId}`]??{},crew,openingStocks);
        for(const [resource,amount] of Object.entries(found))resourceOrders.push({id:`${order.id}:${resource}`,type:'transfer',fromStockId:`poi:${order.poiId}`,toStockId:'camp',resourceId:resource,amount});
        if(z>0&&rng()<clamp((order.type==='raid'?.25:.1)+.2*z/Math.max(1,crew.reduce((n,p)=>n+power(p),0)),.1,.8))hurt(crew[0],Math.min(45,12+Math.floor(z/4)),'Zombier i en usikret sone presset laget under letingen.');
        entry('success','Forsyninger hentet',`${names} bar tilbake ${Object.entries(found).map(([r,n])=>`${n} ${RESOURCE_LABELS[r]??r}`).join(', ')||'ingen nye forsyninger'}. Beholdningen ved stedet reduseres; dette er ikke en gjentakende inntektskilde.`,order.targetId);
        break;
      }
      case 'surface':case 'search': {
        const field=state.phaseOne!;
        const load=field.workloads[order.targetId];
        const previous=field.searches[order.targetId]?.hours??0;
        const cap=order.type==='surface'?Math.min(18,Math.ceil(load.hours*.2)):load.hours;
        const plan=planFieldWork(load,previous,crew,{mode:order.mode,threat:z,travelHops:preview.travelMinutes/45,limit:cap,superficial:order.type==='surface'});
        const next=previous+plan.hours;
        const completed=plan.completed;
        const gain=Math.max(0,completed-(field.searches[order.targetId]?.completed??0));
        field.searches[order.targetId]={hours:next,completed:Math.max(completed,field.searches[order.targetId]?.completed??0)};
        if(order.type==='surface')field.surface[order.targetId]=next;
        if(gain>0&&completed>=4){searchedUnits+=gain;searchZone ||= order.targetId;}
        const cargo=fieldLootProgress(buildingCache(load.buildings),previous,next,load.hours);
        for(const [resource,amount] of Object.entries(cargo))if(amount>0)resourceOrders.push({id:`${order.id}:${resource}:found`,type:'transfer',fromStockId:`buildings:${order.targetId}`,toStockId:'camp',resourceId:resource,amount});
        if(z>0&&rng()<clamp(z/Math.max(1,crew.reduce((n,p)=>n+power(p),0))*(order.mode==='spread'&&crew.length>1?.3:.15),.02,.8))hurt(crew[0],Math.min(55,10+z),'Laget ble overrasket under bygningssøket.');
        state.sim={...state.sim,population};observe(state,order.targetId,order.type==='search'?6:4,day);
        if (order.type==='search' && plan.hours > 0 && !zone.routeIntel) {
          const known = new Set(Object.values(state.zones).flatMap(progress => progress.routeIntel ? [progress.routeIntel.id] : []));
          const pathEdge = allConnections(state).find(edge =>
            !known.has(edge.id) && (edge.fromCellId === order.targetId || edge.toCellId === order.targetId));
          if (pathEdge) {
            state.zones[order.targetId].routeIntel = {id:pathEdge.id, name:pathEdge.name};
            entry('success','Snarvei kartlagt',`${names} fant et lokalt rutekart. Lagene sparer 15 minutter tur-retur over ${pathEdge.name} når forbindelsen kan brukes.`,order.targetId);
          }
        }
        entry('success',ACTION_LABELS[order.type],`${names} la ned ${next-previous} av ${cap} arbeidstimer (totalt ${next}/${load.hours}). ${field.searches[order.targetId].completed}/${load.buildings} bygg undersøkt. ${Object.entries(cargo).filter(([,n])=>n>0).map(([id,n])=>`${n} ${RESOURCE_LABELS[id]??id}`).join(', ')||'Ingen nye forsyninger i dag'}.`,order.targetId);
        break;
      }
      case 'watch':
        for(const e of watchCoverage(state,crew))watched.add(e.id);
        entry('info','Vakt ved ytterkanten',`${names} dekket ${watched.size} åpne passasjer. Vakthold reduserer nattlig gjennomstrømning i disse passasjene.`,order.targetId);
        break;
      case 'installWater':
        state.phaseOne!.water={installedDay:day};
        entry('success','Vannstasjonen montert','Filtersett og materialer ble til rensekapasitet. Tanken er endelig; tildel arbeid for å rense vann.',order.targetId);
        break;
      case 'filterWater': {
        const output=previewWater('filterWater',{water:state.phaseOne!.water,baseEstablished:state.base.established,crew,stocks:openingStocks,sourceWater:opening.sim.stocks?.[WATER_SOURCE_ID]?.water??0}).output;
        if(output)resourceOrders.push({id:`${order.id}:water`,type:'transfer',fromStockId:WATER_SOURCE_ID,toStockId:'camp',resourceId:'water',amount:output});
        entry('success','Vann renset',`${names} renset ${output} vann fra regnvannstanken. Det er tilgjengelig fra neste døgn.`,order.targetId);
        break;
      }
      case 'upgradeHQ': {
        if(z>0) {
          successful=false;
          reportBlockedWork(order.targetId,'HQ-arbeidet stanset','Zombier på stedet hindret arbeidet. Tidligere byggefremdrift er beholdt, og laget brukte ingen materialer.');
          break;
        }
        const {completed, total} = preview.hqWork!;
        const planned = hqHoursForCrew(crew, completed);
        if (!planned) {
          successful=false;
          entry('warning','HQ-arbeidet stanset','Laget hadde ikke den nødvendige arbeidskapasiteten etter dagens forsyningssjekk. Ingen materialer ble brukt.',order.targetId);
          break;
        }
        preview.costs.materials = hqMaterialsThrough(completed + planned) - hqMaterialsThrough(completed);
        const field = state.phaseOne!;
        field.hqProgress = completed + planned;
        field.hq = field.hqProgress === total;
        if (field.hq) entry('success','Permanent HQ i drift','Annekset har ledelsesrom, vannrensing og bedre hvilefasiliteter. Hold de tilknyttede sonene og yttergrensen.',order.targetId);
        else entry('success','HQ under bygging',`${names} utførte ${planned} effektive arbeidstimer. ${field.hqProgress} av ${total} timer er ferdig. Fremdriften bevares til neste byggedøgn.`,order.targetId);
        break;
      }
      case 'rest':
        for(const p of crew){p.fatigue=Math.max(0,p.fatigue-restRecovery);p.health=Math.min(100,p.health+RULES.restHealing);}
        entry('info','Hvile ved basen',`${names} hentet krefter og fikk lett sårstell.`,order.targetId);
        break;
      case 'heal': {
        const medical=Math.max(...crew.map(p=>p.skills.medical));const patients=state.survivors.filter(p=>p.alive&&p.health<100).sort((a,b)=>a.health-b.health).slice(0,medical>=5?2:1);
        for(const p of patients)p.health=Math.min(100,p.health+12+medical*4);
        entry('success','Skadene er behandlet',`${names} brukte én medisin på ${patients.map(p=>p.name).join(' og ')}. Medisinsk ferdighet ${medical} avgjorde virkningen.`,order.targetId);
        break;
      }
      case 'establishBase':
        if(z>0){successful=false;reportBlockedWork(order.targetId,'Basearbeidet ble utsatt','Laget møtte zombier på stedet. Ingen materialer ble brukt. Rydd før folk flytter inn.');}
        else {state.base={zoneId:RULES.baseZone,poiId:RULES.basePoi,established:true};state.morale=Math.min(100,state.morale+15);entry('success',state.phaseOne?'Operasjonsbase etablert':'Midlertidig base etablert',state.phaseOne?'Annekset gir lager og soveplasser nær nordlige ruter. Vannrensing og HQ er neste muligheter; yttergrensen må forsvares separat.':'Et mindre anneks ved Buøy idrettsanlegg har nå soveplasser, lager og en perimeter. Første mål er nådd. Rosenberg er fortsatt det store strategiske målet. Du kan fortsette å spille.',order.targetId);}
        break;
    }
    if(successful) {
      for(const [resource,amount] of Object.entries(preview.costs))spend(`${order.id}:${resource}`,resource,amount,ACTION_LABELS[order.type]);
      noise[order.targetId]=(noise[order.targetId]??0)+preview.noise;
    }
    for(const p of crew) {
      if(order.type!=='rest')p.fatigue=clamp(p.fatigue+(order.type==='clear'?13:order.type==='secure'?10:7)+(p.id==='tor'?3:0),0,100);
      if(p.alive&&order.type!=='rest')p.experience+=order.type==='clear'?2:1;
    }
  }
  const resting=state.survivors.filter(p=>p.alive&&(!used.has(p.id)||orders.some(o=>o.type==='rest'&&o.crewIds.includes(p.id))));
  for(const p of resting.filter(p=>!used.has(p.id)&&(!state.phaseOne||canWork(p)))){p.fatigue=Math.max(0,p.fatigue-restRecovery);p.health=Math.min(100,p.health+RULES.restHealing);}
  if(resting.some(p=>!used.has(p.id)&&(!state.phaseOne||canWork(p))))entry('info','Laget holdt en roligere dag','Personer uten ordre hvilte ved basen og kom seg etter lett slitasje.');
  if(state.phaseOne) {
    const dependents=state.survivors.filter(p=>p.alive&&!canWork(p));
    const carer=resting.filter(canWork).sort((a,b)=>a.fatigue-b.fatigue||a.id.localeCompare(b.id))[0];
    if(dependents.length&&carer) {
      carer.fatigue=clamp(carer.fatigue+2*dependents.length,0,100);
      for(const p of dependents)p.health=Math.min(100,p.health+2);
      entry('info','Tilsyn ved basen',`${carer.name} brukte deler av hvilen på tilsyn med ${dependents.length} beboere.`);
    } else if(dependents.length) {
      for(const p of dependents)hurt(p,2,'Ingen arbeidsfør person var avsatt til tilsyn i dag.','care');
    }
  }
  // Two scavenging orders at the same POI may reserve the same cache: reject atomically.
  const tonight=watched.size?{...state.simulationWorld,connections:state.simulationWorld.connections.map(e=>watched.has(e.id)?{...e,capacityPerDirection:Math.max(0,(e.capacityPerDirection??2)-1)}:e)}:state.simulationWorld;
  const migrated=resolveDay(tonight,{...state.sim,population},Object.entries(noise).map(([zoneId,n])=>({zoneId,noise:n} satisfies NoiseOrder)),state.seed,RULES.migration,resourceOrders);
  state.sim=migrated.state;
  for(const event of migrated.events) {
    const connection=state.worldSnapshot.edges.find(e=>e.id===event.connectionId);
    const label=connection?.name??'yttergrensen';
    if(event.type==='barrier-warning')entry('warning','Perimeter under press',`${label}: barrierene kan brytes neste dag. Reparer eller trekk folk tilbake.`);
    if(event.type==='barrier-breached')entry('danger','En barriere brøt sammen',`${label}: passasjen kan slippe zombier gjennom fra neste dag. Rydding alene er ikke varig sikkerhet.`);
  }
  // A camp always has nearby witnesses; automatic defensive contact is not hidden intel.
  const camp=state.base.zoneId;let raidKills=0;const present=state.survivors.filter(p=>state.phaseOne?canWork(p):p.alive);
  if((state.sim.population[camp]??0)>0&&present.length) {
    const threat=state.sim.population[camp];
    // Close defense uses training/condition and capped improvised melee equipment,
    // never a free rifle/pistol firing bonus or unaccounted ammunition.
    const closeDefense=present.reduce((n,p)=>n+(p.skills.combat+Math.min(2,WEAPONS[p.gear.weapon].power)+Math.min(2,p.experience/15))*(.4+.6*p.health/100)*(1-p.fatigue/150),0);
    const capacity=Math.max(1,Math.floor(closeDefense*.3));
    raidKills=Math.min(threat,capacity);kills+=raidKills;
    state.sim={...state.sim,population:{...state.sim.population,[camp]:threat-raidKills}};
    entry(threat>capacity?'danger':'warning','Bevegelse ved basen',`Vaktholdet håndterte ${raidKills} inntrengere med nærforsvar uten skyting. ${threat>capacity?'Presset var større enn laget kunne holde unna.':'Trening, helse og utmattelse avgjorde kapasiteten.'} Aktivitet tidligere på dagen kan ha trukket dem hit.`,camp);
    if(threat>capacity){const p=present[Math.floor(rng()*present.length)];hurt(p,Math.min(65,12+(threat-capacity)*4),'Perimeterpress ved basen etter dagens oppdrag.');}
  }
  const breachedCells=new Set<string>();
  for(const e of state.simulationWorld.connections)if(state.sim.barriers[e.id]?.durability===0){if(state.zones[e.fromId])breachedCells.add(e.fromId);if(state.zones[e.toId])breachedCells.add(e.toId);}
  for(const id of breachedCells)if(state.zones[id].secured)state.zones[id].secured=false;
  for(const [id,progress] of Object.entries(state.zones))if(id!==camp&&progress.claimed&&(state.sim.population[id]??0)>=5){
    progress.claimed=false;
    progress.secured=false;
    const zoneName=state.worldSnapshot.zones.find(zone=>zone.id===id)?.name??id;
    entry('warning',`Kontroll tapt i ${zoneName}`,`Zombiepress drev laget bort fra ${zoneName}. Forbindelser gjennom sonen kan ikke brukes som trygg adkomst før den er overtatt igjen.`,id);
  }
  observe(state,camp,8,day);
  const inflow=migrated.movements.filter(m=>m.toId===camp).reduce((n,m)=>n+m.count,0);
  if(inflow)entry('info','Natten følger dagens aktivitet',`${inflow} zombier vandret inn mot baseområdet fra tilknyttede soner. Bevegelsen ble trukket fra nabopopulasjonen.`,camp);
  if(state.phaseOne) {
    const next=advanceCommunity(state.phaseOne.community,{day,searchedUnits,zoneId:searchZone});
    if(next&&!state.phaseOne.community)entry('info','Tre personer ber om hjelp','Signe, Einar og Noah venter. Du velger hva som skjer med hver av dem.',searchZone);
    state.phaseOne.community=next;
  }
  if(!state.phaseOne&&day===4&&!state.event)state.event={id:'strangers-at-the-gate',title:'To bank på døren',text:'Et lite følge ber om mat og vann før de går videre. Dere kan dele fra lageret eller holde døren lukket.',choices:[{id:'help',label:'Del forsyninger',description:'4 mat og 4 vann nå. Hjelpen kan gi tillit og en senere gjengjeldelse.'},{id:'refuse',label:'Hold på forsyningene',description:'Ingen ressurskostnad. Noen i laget reagerer på avgjørelsen.'}],status:'pending'};
  if(state.event?.status==='resolved'&&state.event.choice==='help'&&!state.event.consequenceApplied&&day>=(state.event.decidedDay??day)+3) {
    state.event.consequenceApplied=true;state.morale=Math.min(100,state.morale+8);
    entry('success','Hjelpen blir husket','Følget la igjen en takkemelding og informasjon om ruten nordover. Tilliten i laget økte; ingen ressurser ble skapt av hendelsen.');
  }
  state.day=day;state.gameOver=!state.survivors.some(p=>state.phaseOne?canWork(p):p.alive);
  const report:DayReport={day,fromDay:opening.day,entries,kills,injuries:[...new Set(injuries)],deaths,population:{...migrated.ledger,zonesAfter:migrated.ledger.zonesAfter-raidKills,totalAfter:migrated.ledger.totalAfter-raidKills,openingTotal:total(opening.sim.population),killed:kills},resources:migrated.resourceLedger};
  if(total(state.sim.population)!==total(opening.sim.population)-kills)throw new Error('Zombie-regnskapet stemmer ikke.');
  state.reports=[...state.reports,report];state.lastReport=report;
  return state;
}

export function chooseEvent(opening:PlayState,choice:string):PlayState {
  if(!opening.event||opening.event.status!=='pending'||!opening.event.choices.some(c=>c.id===choice))throw new Error('Hendelsen er ikke tilgjengelig.');
  const state=clone(opening);
  if(choice==='help') {
    const stocks=campStock(state);if((stocks.food??0)<4||(stocks.water??0)<4)throw new Error('Det kreves 4 mat og 4 vann for å dele.');
    state.sim={...state.sim,stocks:{...state.sim.stocks,camp:{...stocks,food:stocks.food-4,water:stocks.water-4}}};state.morale=Math.min(100,state.morale+3);
  } else state.morale=Math.max(0,state.morale-5);
  if(state.lastReport) {
    const report=clone(state.lastReport);
    report.entries.push({type:'info',title:choice==='help'?'Dere delte fra lageret':'Dere beholdt forsyningene',text:choice==='help'?'4 mat og 4 vann ble gitt til følget. Hjelpen kan bli husket.':'Døren ble holdt lukket. Beholdningen er uendret, men tilliten i laget falt.'});
    if(choice==='help')for(const resource of ['food','water']) {
      const ledger=report.resources[resource];
      if(ledger)report.resources={...report.resources,[resource]:{...ledger,consumed:ledger.consumed+4,after:ledger.after-4}};
    }
    state.lastReport=report;state.reports=state.reports.map(r=>r.day===report.day?report:r);
  }
  state.event={...state.event!,status:'resolved',choice,decidedDay:state.day};return state;
}

export function decideRecruitment(opening:PlayState,candidateId:string,choice:RecruitmentChoice):PlayState {
  if(!opening.phaseOne?.community||opening.gameOver)throw new Error('Ingen rekrutteringsbeslutning er tilgjengelig.');
  const state=clone(opening);
  const outcome=chooseRecruitment(state.phaseOne!.community!,candidateId,choice,{day:state.day,stocks:campStock(state),survivors:state.survivors});
  state.phaseOne!.community=outcome.community;
  state.survivors.push(...outcome.admitted);
  const accounting=resolveResources(state.sim.stocks??{},Object.entries(outcome.costs).map(([resourceId,amount])=>({id:`recruit:${candidateId}:${resourceId}`,type:'consume' as const,fromStockId:'camp',resourceId,amount,reason:'Nødhjelp til ventende personer'})));
  state.sim={...state.sim,stocks:accounting.stocks};
  if(state.lastReport) {
    const report=state.lastReport;report.entries.push(outcome.entry);
    const resources={...report.resources};
    for(const [id,amount] of Object.entries(outcome.costs))if(resources[id])resources[id]={...resources[id],consumed:resources[id].consumed+amount,after:resources[id].after-amount};
    report.resources=resources;state.reports=state.reports.map(r=>r.day===report.day?report:r);
  }
  return state;
}

export function validateSavedGame(value:unknown):string[] {
  if(!value||typeof value!=='object')return['Lagringen er ikke et spillobjekt.'];
  try {
  const s=value as PlayState;const errors:string[]=[];
  if(s.schemaVersion!==1||![GAME_RULES_VERSION,PHASE_ONE_RULES_VERSION].includes(s.gameRulesVersion)||Boolean(s.phaseOne)!==(s.gameRulesVersion===PHASE_ONE_RULES_VERSION))return['Lagringen bruker en annen spillversjon.'];
  if(!Number.isSafeInteger(s.day)||s.day<0||!Number.isSafeInteger(s.seed)||s.seed<0)errors.push('Ugyldig dag eller seed.');
  if(!Array.isArray(s.worldSnapshot?.zones)||!Array.isArray(s.worldSnapshot?.edges)||!Array.isArray(s.worldSnapshot?.pois)||!Array.isArray(s.simulationWorld?.zoneIds)||!Array.isArray(s.simulationWorld?.reservoirIds)||!Array.isArray(s.simulationWorld?.connections)||!s.sim||!s.zones||!Array.isArray(s.survivors))return[...errors,'Lagringen mangler verden eller spilltilstand.'];
  if(s.sim.day!==s.day||!s.sim.population||!s.sim.stocks?.camp)errors.push('Tilstanden og dagen stemmer ikke overens.');
  const ids=[...s.simulationWorld.zoneIds,...(s.simulationWorld.reservoirIds??[])];
  if(new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(s.sim.population?.[id])||s.sim.population[id]<0)||Object.keys(s.sim.population??{}).length!==ids.length)errors.push('Ugyldig zombiepopulasjon.');
  for(const stock of Object.values(s.sim.stocks??{}))if(!stock||Object.values(stock).some(n=>!Number.isSafeInteger(n)||n<0))errors.push('Ugyldig ressursbeholdning.');
  if(!s.base||!s.zones[s.base.zoneId])errors.push('Basen mangler gyldig sone.');
  if(s.survivors.length<4||s.survivors.length>(s.phaseOne?7:4)||new Set(s.survivors.map(p=>p.id)).size!==s.survivors.length||s.survivors.some(p=>!p.skills||!p.gear||!Object.hasOwn(WEAPONS,p.gear.weapon)||!Number.isFinite(p.health)||p.health<0||p.health>100||!Number.isFinite(p.fatigue)||p.fatigue<0||p.fatigue>100||p.alive!==(p.health>0)))errors.push('Ugyldige overlevende.');
  if(s.phaseOne) {
    const field=s.phaseOne;
    if(field.hqProgress!==undefined&&(!Number.isSafeInteger(field.hqProgress)||field.hqProgress<0||field.hqProgress>HQ_WORK_HOURS||(field.hqProgress===HQ_WORK_HOURS)!==field.hq))errors.push('Ugyldig HQ-fremdrift.');
    if(Object.entries(s.zones).some(([id,zone])=>zone.routeIntel!==undefined&&
      !s.worldSnapshot.edges.some(edge=>edge.id===zone.routeIntel?.id&&edge.name===zone.routeIntel?.name&&
        (edge.fromCellId===id||edge.toCellId===id))))errors.push('Ugyldig kartlagt snarvei.');
    if(!field.workloads||!field.searches||!field.surface||typeof field.hq!=='boolean'||s.simulationWorld.zoneIds.some(id=>!Number.isSafeInteger(field.workloads[id]?.hours)||field.workloads[id].hours<0||!Number.isSafeInteger(field.workloads[id].buildings)||field.workloads[id].buildings<0))errors.push('Ugyldig arbeidsgrunnlag.');
    if(Object.entries(field.searches??{}).some(([id,work])=>!s.zones[id]||!Number.isSafeInteger(work.hours)||work.hours<0||work.hours>field.workloads?.[id]?.hours||!Number.isSafeInteger(work.completed)||work.completed<0||work.completed>field.workloads?.[id]?.buildings))errors.push('Ugyldig søkefremdrift.');
    if(field.water&&(!s.base.established||!Number.isSafeInteger(field.water.installedDay)||field.water.installedDay<1||field.water.installedDay>s.day))errors.push('Ugyldig vannstasjon.');
    if(field.community&&(!Array.isArray(field.community.arrival?.candidates)||!Array.isArray(field.community.reactions)||!s.zones[field.community.arrival.zoneId]))errors.push('Ugyldig rekrutteringshistorikk.');
  }
  if(s.survivors.some(p=>Object.values(p.skills).some(n=>!Number.isFinite(n)||n<0||n>20)||!Number.isFinite(p.experience)||p.experience<0))errors.push('Ugyldige ferdigheter.');
  if(s.simulationWorld.zoneIds.some(id=>!s.worldSnapshot.zones.some(z=>z.id===id&&z.level===3)||!s.zones[id]))errors.push('Lagringen viser til en manglende sone.');
  if(!Array.isArray(s.reports)||!Number.isFinite(s.morale)||typeof s.gameOver!=='boolean')errors.push('Lagringen mangler rapporter eller status.');
  return errors;
  } catch {return ['Lagringen har en ugyldig eller ufullstendig struktur.'];}
}
