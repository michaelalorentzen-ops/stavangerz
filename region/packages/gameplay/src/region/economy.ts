/**
 * Daily flows: what each zone and the HQ produce, what people eat, what rots, and what holding a border costs.
 * The same numbers drive the day and the forecast, so what the player sees is what happens.
 */
import type { RegionState, RegionWorld } from './types';
import { controlled, indexWorld, living, season } from './engine';
import { MODULE_COST, R, UPGRADE_COST } from './rules';
import { CONTENT } from '../../../world-data/src/content';
import { POP } from './systems';
import { lawMods } from './society';
import { tech } from './progress';
import { wonderEffects } from './wonders';
import { administrations, centralPopulation, regionalL1 } from './administration';
import { crewPositionFor } from './location';
import { difficultyRules } from './campaign';

export interface ZoneFlow { food: number; water: number; other: Record<string, number>; upkeep: number; net: number }
export interface Flows {
  zones: Record<string, ZoneFlow>;
  hq: Record<string, number>;
  food: { produced: number; eaten: number; spoiled: number; upkeep: number; net: number; daysLeft: number | null };
  water: { produced: number; drunk: number; net: number; daysLeft: number | null };
  fuel: { used: number };
  other: Record<string, number>;
  farmCapacity: number; fishers: number; power: boolean;
}

export function hqPower(state: RegionState, world: RegionWorld) {
  if (!state.hq) return false;
  const l2 = indexWorld(world).byId.get(state.hq.zoneId)?.parentId ?? '';
  return (state.networks[l2] ?? []).includes('power') || (tech(state, 'generators') && (state.stock.generator ?? 0) >= 1 && (state.stock.fuel ?? 0) >= 2);
}

/** Food a zone's land can give per day this season, with what is built and researched. */
export function farmCapacity(state: RegionState, world: RegionWorld, zoneId: string) {
  const zone = indexWorld(world).byId.get(zoneId);
  const m = zone?.measures;
  if (!m) return 0;
  const z = state.zones[zoneId];
  let ha = m.farm / 1e4;
  if (z.upgrades.includes('field')) ha += (m.open + (m.pasture ?? 0)) / 1e4;
  else if (tech(state, 'livestock')) ha += (m.pasture ?? 0) / 1e4 * .5;
  if (z.upgrades.includes('demolishField')) ha += (m.built ?? 0) * .3 / 1e4;
  return ha * CONTENT.yields.fieldFoodPerHaYear / 365 * season(state.day).farm * (tech(state, 'rotation') ? 1.3 : 1);
}

export function people(state: RegionState) {
  const p = centralPopulation(state);
  const crew = living(state).filter(s => { const p = crewPositionFor(state, s.id); return p?.kind === 'zone' && p.zoneId === state.homeZoneId; }).length;
  return { crew, adults: p.adults, children: p.children, elderly: p.elderly };
}

export function dailyFlows(state: RegionState, world: RegionWorld): Flows {
  const delegated = administrations(state);
  if (delegated.length) {
    const regions = new Set(delegated.map(r => r.l1Id));
    state = { ...state, population: centralPopulation(state), administration: undefined, mobility: undefined,
      zones: Object.fromEntries(Object.entries(state.zones).map(([id, z]) => [id, regions.has(regionalL1(world, id) ?? '') && z.status === 'controlled' ? { ...z, status: 'scouted' } : z])),
    } as RegionState;
  }
  const index = indexWorld(world);
  const owned = controlled(state);
  const law = lawMods(state);
  const s = season(state.day);
  const winter = s.name === 'Vinter';
  const power = hqPower(state, world);
  const zones: Record<string, ZoneFlow> = {};
  const other: Record<string, number> = {};
  const flow = (id: string) => (zones[id] ??= { food: 0, water: 0, other: {}, upkeep: 0, net: 0 });
  const addOther = (id: string, r: string, n: number) => { const f = flow(id); f.other[r] = (f.other[r] ?? 0) + n; other[r] = (other[r] ?? 0) + n; };

  // Built things in each zone.
  for (const id of owned) {
    const z = state.zones[id];
    const l2 = index.byId.get(id)?.parentId ?? '';
    const l2Power = (state.networks[l2] ?? []).includes('power');
    for (const u of z.upgrades) for (const [r, n] of Object.entries(UPGRADE_COST[u]?.daily ?? {})) {
      let amount = n;
      if (u === 'greenhouse') amount *= (winter && !l2Power && !tech(state, 'hydroponics') ? .4 : 1) * (l2Power ? 1.3 : 1) * (tech(state, 'hydroponics') ? 2 : 1);
      if (r === 'food') flow(id).food += amount; else if (r === 'water') flow(id).water += amount; else addOther(id, r, amount);
    }
    // Rain barrels and taps that still drip: more homes, more roofs and gutters.
    flow(id).water += Math.min(5, 1.5 + (index.byId.get(id)?.measures?.homes ?? 0) * .05);
    // Patrols along every border you do not hold.
    const open = (index.adjacent.get(id) ?? []).filter(a => state.zones[a.to]?.status !== 'controlled' && !(a.linkId && ['blown', 'flooded'].includes(state.chokepoints[a.linkId]))).length;
    flow(id).upkeep += open * .2;
  }
  // Water networks.
  for (const [l2, nets] of Object.entries(state.networks)) if (nets.includes('water')) {
    const kid = (index.children.get(l2) ?? []).find(k => owned.includes(k));
    if (kid) flow(kid).water += 15;
  }
  // The HQ: modules, and camp barrels.
  const hq: Record<string, number> = {};
  const home = state.hq?.zoneId ?? state.homeZoneId;
  // Everyone sets out buckets. It rains. This is Stavanger.
  const pAtHome = people(state);
  const everyone = pAtHome.crew + pAtHome.adults + pAtHome.children + pAtHome.elderly;
  hq.water = 3 + everyone * (s.name === 'Sommer' ? .45 : .7);
  if (state.hq) for (const m of state.hq.modules) for (const [r, n] of Object.entries(MODULE_COST[m]?.daily ?? {})) {
    const amount = n * (m === 'greenhouse' || m === 'rooftop' ? (winter && !power && !tech(state, 'hydroponics') ? .4 : 1) * (tech(state, 'hydroponics') ? 2 : 1) : 1);
    hq[r] = (hq[r] ?? 0) + amount;
  }
  // Workers on the land: limited by hands and by soil.
  const capacities = owned.map(id => [id, farmCapacity(state, world, id)] as const).filter(([, c]) => c > 0);
  const capacity = capacities.reduce((n, [, c]) => n + c, 0);
  const farmHands = (state.work.farm ?? 0) * POP.work.farmFood * s.farm * (tech(state, 'rotation') ? 1.3 : 1) * law.workMult;
  const farmed = Math.min(capacity, farmHands);
  for (const [id, c] of capacities) flow(id).food += farmed * c / capacity;
  // Fishers: need boats and a coast you hold.
  const coast = owned.filter(id => index.coastal.has(id)).sort((a, b) => Number(state.zones[b].upgrades.includes('fishing')) - Number(state.zones[a].upgrades.includes('fishing')));
  const perBoat = tech(state, 'fishery') ? 5 : POP.work.fishersPerBoat;
  const fishers = coast.length ? Math.min(state.work.fish ?? 0, Math.floor((state.stock.boat ?? 0) * perBoat)) : 0;
  if (fishers) {
    const bonus = (coast.some(id => state.zones[id].upgrades.includes('fishing')) ? 1.4 : 1) * (tech(state, 'saltDry') ? 1.2 : 1) * (tech(state, 'fishery') ? 1.5 : 1);
    flow(coast[0]).food += fishers * POP.work.fishFood * (winter ? .6 : 1) * bonus * law.workMult;
  }
  // Research that turns land into medicine and fuel.
  const farmers = state.work.farm ?? 0;
  if (tech(state, 'herbal') && farmers >= 2 && capacities.length) addOther(capacities[0][0], 'medicine', Math.min(4, farmers / 4));
  if (tech(state, 'biogas') && farmers >= 3 && capacities.length) addOther(capacities[0][0], 'fuel', Math.min(6, farmers / 2));

  // Wonders that grow, heal or fuel.
  for (const [, w] of Object.entries(state.wonders ?? {})) void w;
  const we = wonderEffects(state);
  const wz = Object.values(state.wonders ?? {})[0]?.zoneId ?? state.homeZoneId;
  if (we.food) { if (owned.includes(wz)) flow(wz).food += we.food; else hq.food = (hq.food ?? 0) + we.food; }
  if (we.medicine) other.medicine = (other.medicine ?? 0) + we.medicine;
  if (we.fuel) other.fuel = (other.fuel ?? 0) + we.fuel;

  // Who eats.
  const p = people(state);
  const dependents = (p.children * POP.food.child + p.elderly * POP.food.elderly) * law.dependentFood;
  const difficultyConsumption = difficultyRules(state).foodWater;
  const eaten = (p.crew + p.adults * POP.food.adult + dependents) * law.foodMult * difficultyConsumption;
  const drunk = (p.crew + p.adults + p.children * .6 + p.elderly * .8) * difficultyConsumption;
  // What rots: fresh food above a small reserve.
  const stockFood = state.stock.food ?? 0;
  const rate = ({ Sommer: .025, Vår: .015, Høst: .015, Vinter: .007 } as Record<string, number>)[s.name] ?? .015;
  // Salting, cellars and depots help, but fresh food never keeps forever; only cold storage really stops the rot.
  const cold = tech(state, 'coldStore') && power;
  const keep = Math.max(cold ? .12 : .35, (tech(state, 'saltDry') ? .6 : 1) * (tech(state, 'rootCellar') ? .7 : 1) * (state.hq?.modules.includes('depot') ? .7 : 1) * (cold ? .2 : 1));
  // The bigger the pile, the harder to keep it dry, cool and away from rats.
  const spoiled = Math.max(0, stockFood - 40) * rate * keep * (1 - we.spoil) * (1 + Math.max(0, stockFood - 200) / 400);
  const fuelUsed = (winter ? (p.crew + p.adults + p.children + p.elderly) * .12 * (tech(state, 'woodGas') ? .6 : 1) : 0)
    + (power && state.hq && !(state.networks[indexWorld(world).byId.get(state.hq.zoneId)?.parentId ?? ''] ?? []).includes('power') ? 2 : 0);

  let foodProduced = (hq.food ?? 0), waterProduced = hq.water, upkeep = 0;
  for (const [id, f] of Object.entries(zones)) { f.net = f.food - f.upkeep; foodProduced += f.food; waterProduced += f.water; upkeep += f.upkeep; }
  void home;
  const foodNet = foodProduced - eaten - spoiled - upkeep;
  const waterNet = waterProduced - drunk;
  return {
    zones, hq, other, farmCapacity: capacity, fishers, power,
    food: { produced: foodProduced, eaten, spoiled, upkeep, net: foodNet, daysLeft: foodNet < 0 ? stockFood / -foodNet : null },
    water: { produced: waterProduced, drunk, net: waterNet, daysLeft: waterNet < 0 ? (state.stock.water ?? 0) / -waterNet : null },
    fuel: { used: fuelUsed },
  };
}

/** Net food per day for a zone or for all owned zones inside an L2 or L1 area. */
export function areaNet(state: RegionState, world: RegionWorld, flows: Flows, areaId: string) {
  const index = indexWorld(world);
  const zone = index.byId.get(areaId);
  if (!zone) return 0;
  if (zone.level === 3) return flows.zones[areaId]?.net ?? 0;
  const kids = (index.children.get(areaId) ?? []).flatMap(k => index.byId.get(k)?.level === 3 ? [k] : index.children.get(k) ?? []);
  return kids.reduce((n, k) => n + (flows.zones[k]?.net ?? 0), 0);
}
void R;
