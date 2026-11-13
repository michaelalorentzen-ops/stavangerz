import type { ActionType, Survivor } from './model';
import type { SimulationConfig } from '../../simulation-core/src/index';

/** M3 playtest hypotheses. These values are not researched demographics or final balance. */
export const GAME_RULES_VERSION = 'm3.1';
export const RULES = {
  startZone: 'cell-003', baseZone: 'cell-002', basePoi: 'poi-001',
  secureMaterials: 4, repairMaterials: 2, baseMaterials: 6, baseFoodBuffer: 8,
  dailyFoodPerPerson: 1, dailyWaterPerPerson: 1,
  restFatigueRecovery: 24, restHealing: 7, barrierDurability: 16,
  maxMissionHops: 4, migration: { mobilityRate: .065, noiseWeight: .45, attemptsPerDurability: 4 } satisfies SimulationConfig,
};
export const ACTION_LABELS: Record<ActionType,string> = {
  scout:'Speid', clear:'Rydd', claim:'Overta', secure:'Sikre', scavenge:'Sank forsyninger',
  rest:'Hvil', heal:'Behandle skader', establishBase:'Etabler midlertidig base', repair:'Reparer perimeter',
  raid:'Raskt raid', surface:'Overflatesøk', search:'Grundig bygningssøk', watch:'Hold vakt',
  upgradeHQ:'Bygg opp HQ', installWater:'Sett opp vannfilter', filterWater:'Rens vann',
};
export const WEAPONS: Record<string,{power:number;ammo:number;noise:number}> = {
  'Ingen':{power:0,ammo:0,noise:0},
  'Jaktrifle':{power:5,ammo:3,noise:6}, 'Pistol':{power:3,ammo:2,noise:4},
  'Brekkjern':{power:3,ammo:0,noise:2}, 'Turkniv':{power:1,ammo:0,noise:1},
};
export const INITIAL_SURVIVORS: Survivor[] = [
  {id:'ingrid',name:'Ingrid',role:'Speider',description:'Lokalkjent og rask til å lese en ukjent gate.',strength:'Kikkert gir presise speiderrapporter.',weakness:'Lett beskyttelse; bør ikke rydde alene.',health:100,fatigue:0,experience:0,alive:true,skills:{combat:3,scouting:6,craft:1,medical:1},gear:{weapon:'Pistol',protection:'Lett jakke',utility:'Kikkert'}},
  {id:'marius',name:'Marius',role:'Jeger',description:'Rolig under press, men rifla høres langt.',strength:'Høy kampkraft og god skyting.',weakness:'Rifle bruker ammunisjon og lager mye støy.',health:100,fatigue:0,experience:0,alive:true,skills:{combat:6,scouting:2,craft:1,medical:1},gear:{weapon:'Jaktrifle',protection:'Vernevest',utility:'Ekstra ammunisjonslomme'}},
  {id:'leila',name:'Leila',role:'Sykepleier',description:'Holder folk på beina med hvile, medisin og ro.',strength:'Behandling gir langt mer helse tilbake.',weakness:'Svak i nærkamp; turkniven krever støtte.',health:100,fatigue:0,experience:0,alive:true,skills:{combat:1,scouting:2,craft:1,medical:6},gear:{weapon:'Turkniv',protection:'Arbeidsjakke',utility:'Medisinsk veske'}},
  {id:'tor',name:'Tor',role:'Mekaniker',description:'Kan få en dør og noen materialer til å holde en natt til.',strength:'Verktøy gjør sikring og reparasjon sterkere.',weakness:'Tung utrustning gir raskere utmattelse.',health:100,fatigue:0,experience:0,alive:true,skills:{combat:3,scouting:1,craft:6,medical:1},gear:{weapon:'Brekkjern',protection:'Arbeidsvern',utility:'Verktøykasse'}},
];
