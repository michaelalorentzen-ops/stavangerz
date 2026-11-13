/** Regional delegation. Population is an allocation of empire totals; stock exists only in physical depots. */
import type { Population, RegionState, RegionWorld, ReportLine, Stock, WorkId } from './types';
import { indexWorld } from './engine';
import * as engine from './engine';
import { researchDay } from './progress';
import { POP } from './systems';
import { crewPositionFor } from './location';
import { dailyFlows } from './economy';
import { lawMods } from './society';

// Provisional numeric rules; tuning is intentionally deferred by the owner.
export const REGIONAL_RULES = { hungerDeathInterval: 3, foodDamage: 5, waterDamage: 9, sickRecovery: .12, medicinePerRecovery: .3, loyaltyPause: 20 } as const;

export type RegionalPolicy = 'defense' | 'balanced' | 'growth';
export interface RegionalLedger {
  day: number; produced: Stock; consumed: Stock; shortages: Stock;
}
export interface RegionalAdministration {
  l1Id: string; hqZoneId: string; leaderId?: string; successorId?: string;
  residents: Population; policy: RegionalPolicy; work: Record<WorkId, number>;
  /** Desired reserves, not a second wallet. Only transport can deliver these goods. */
  budget: Stock; establishedDay: number; ledger?: RegionalLedger; alerts: string[];
}
export interface AdministrationState { version: 1; regions: Record<string, RegionalAdministration> }
export type AdministrationGame = RegionState & {
  administration?: AdministrationState;
  mobility?: { version: 1; depots: Record<string, Stock>; radios: Record<string, unknown>; depotResidents?: Record<string, Population> };
};
export const REGIONAL_POLICIES: Record<RegionalPolicy, { name: string; text: string; guardShare: number; fishShare: number }> = {
  defense: { name: 'Forsvar', text: 'Flere på lokal vakt; resten sikrer mat.', guardShare: .4, fishShare: .2 },
  balanced: { name: 'Balanse', text: 'Fordel lokale hender mellom mat og vakt.', guardShare: .2, fishShare: .3 },
  growth: { name: 'Vekst', text: 'Prioriter lokal matproduksjon og reserver.', guardShare: .1, fishShare: .35 },
};
export type AdministrationCommand =
  | { kind: 'establish'; hqZoneId: string; leaderId: string }
  | { kind: 'policy'; l1Id: string; policy: RegionalPolicy }
  | { kind: 'leader'; l1Id: string; leaderId: string }
  | { kind: 'successor'; l1Id: string; survivorId?: string }
  | { kind: 'residents'; l1Id: string; residents: Population }
  | { kind: 'budget'; l1Id: string; budget: Stock };
const emptyPopulation = (): Population => ({ adults: 0, children: 0, elderly: 0, sick: 0 });
const emptyWork = (): Record<WorkId, number> => ({ farm: 0, fish: 0, guard: 0, scavenge: 0, clear: 0, build: 0, research: 0 });
export function administrations(state: RegionState): RegionalAdministration[] { return Object.values((state as AdministrationGame).administration?.regions ?? {}); }
export function regionalL1(world: RegionWorld, zoneId: string): string | undefined {
  const index = indexWorld(world); let zone = index.byId.get(zoneId);
  while (zone && zone.level !== 1) zone = index.byId.get(zone.parentId ?? '');
  return zone?.id;
}
export function regionalPopulation(state: RegionState): Population {
  const total = emptyPopulation();
  for (const region of administrations(state)) for (const key of Object.keys(total) as (keyof Population)[]) total[key] += region.residents[key];
  return total;
}
/** Populations remain in empire totals, including travellers. They cannot also work/eat at central HQ. */
export function centralPopulation(state: RegionState): Population {
  const allocated = regionalPopulation(state); const result = emptyPopulation();
  for (const [zoneId, residents] of Object.entries((state as AdministrationGame).mobility?.depotResidents ?? {})) {
    if (zoneId === state.homeZoneId) continue;
    for (const key of Object.keys(allocated) as (keyof Population)[]) allocated[key] += residents[key];
  }
  for (const mission of Object.values(state.crewMissions ?? {})) {
    const passengers = (mission as typeof mission & { passengers?: Population }).passengers;
    if (passengers && !['complete', 'failed'].includes(mission.status)) for (const key of Object.keys(allocated) as (keyof Population)[]) allocated[key] += passengers[key];
  }
  for (const key of Object.keys(result) as (keyof Population)[]) result[key] = Math.max(0, state.population[key] - allocated[key]);
  return result;
}
export const centralAvailablePopulation = centralPopulation;

export function regionalStock(state: RegionState, region: RegionalAdministration): Stock {
  return (state as AdministrationGame).mobility?.depots[region.hqZoneId] ?? {};
}
export function regionalSurvivorIds(state: RegionState): string[] {
  const hqs = new Set(administrations(state).map(r => r.hqZoneId));
  return state.survivors.filter(s => s.alive && !s.left && (() => { const p = crewPositionFor(state, s.id); return p?.kind === 'zone' && hqs.has(p.zoneId); })()).map(s => s.id);
}
export function regionalMandate(state: RegionState) {
  const government = state.laws.find(id => ['council', 'strongman', 'faithRule', 'militia'].includes(id));
  return {
    government: government ?? 'shared',
    description: government === 'militia' ? 'Vaktplikten gjelder også lokalt. Minst 30 % av lokale hender går til vakt; lederbytte bekrefter du.'
      : government === 'council' ? 'Rådets vedtatte lover og ditt budsjett setter rammen. Lederbytte og strategiske valg bekrefter du.'
      : government === 'strongman' ? 'Lederen utfører ditt mandat og budsjett direkte. Lederbytte og strategiske valg bekrefter du.'
      : government === 'faithRule' ? 'Menighetens lover gjelder også i regionen. Lederbytte og strategiske valg bekrefter du.'
      : 'Lokale rutiner følger ditt mandat. Strategiske valg og lederbekreftelse ligger hos deg.',
    // D28: strategic appointments remain explicit. The designated successor still needs player confirmation.
    automaticSuccession: false,
    minimumGuardShare: government === 'militia' ? .3 : 0,
    strategicAuthority: false as const,
  };
}

function atHq(state: RegionState, id: string, zoneId: string) {
  const p = crewPositionFor(state, id); return p?.kind === 'zone' && p.zoneId === zoneId;
}
function leaderError(state: RegionState, id: string, zoneId: string, exceptL1?: string) {
  const person = state.survivors.find(s => s.id === id);
  if (!person?.alive || person.left) return 'Velg en levende overlevende.';
  if (!atHq(state, id, zoneId)) return 'Lederen må reise fysisk til regionalt HQ først.';
  if (Object.values(state.crewMissions ?? {}).some(m => m.survivorIds.includes(id) && !['complete', 'failed'].includes(m.status))) return 'Personen er bundet til et aktivt oppdrag.';
  if (administrations(state).some(r => r.l1Id !== exceptL1 && r.leaderId === id)) return 'Personen leder allerede en annen region.';
  return undefined;
}
export function administrationCommandError(state: RegionState, world: RegionWorld, command: AdministrationCommand): string | undefined {
  if (state.turnCheckpoint || state.event || state.gameOver) return 'Avklar dagens hendelse før regional styring.';
  if (state.phase < 4) return 'Regional styring åpner i fase 4.';
  if (command.kind === 'establish') {
    const zone = indexWorld(world).byId.get(command.hqZoneId); const l1 = regionalL1(world, command.hqZoneId);
    if (zone?.level !== 3 || state.zones[command.hqZoneId]?.status !== 'controlled' || !l1) return 'Velg en kontrollert L3-sone med en L1-region.';
    if (command.hqZoneId === state.homeZoneId) return 'Hoved-HQ er allerede sentralt administrert.';
    if (administrations(state).some(r => r.l1Id === l1)) return 'Regionen har allerede et HQ.';
    return leaderError(state, command.leaderId, command.hqZoneId);
  }
  const region = administrations(state).find(r => r.l1Id === command.l1Id);
  if (!region) return 'Regionen har ikke et regionalt HQ.';
  if (command.kind === 'leader') return leaderError(state, command.leaderId, region.hqZoneId, region.l1Id);
  if (command.kind === 'successor' && command.survivorId === region.leaderId) return 'Lederen kan ikke være sin egen stedfortreder.';
  if (command.kind === 'successor' && command.survivorId) return leaderError(state, command.survivorId, region.hqZoneId, region.l1Id);
  if (command.kind === 'policy' && !REGIONAL_POLICIES[command.policy]) return 'Ukjent mandat.';
  if (command.kind === 'budget' && Object.values(command.budget).some(n => !Number.isFinite(n) || n < 0)) return 'Budsjett må ha endelige, positive mengder.';
  if (command.kind === 'residents') {
    const pending = (state as AdministrationGame).mobility?.depotResidents?.[region.hqZoneId] ?? emptyPopulation();
    for (const key of Object.keys(emptyPopulation()) as (keyof Population)[]) {
      const n = command.residents[key];
      if (!Number.isSafeInteger(n) || n < 0 || n > region.residents[key] + pending[key]) return 'Folk må transporteres fysisk til regionalt HQ før de kan allokeres.';
    }
    if (command.residents.sick > command.residents.adults + command.residents.children + command.residents.elderly) return 'Antall syke kan ikke overstige innbyggertallet.';
    const remaining = Object.fromEntries(Object.keys(emptyPopulation()).map(key => [key, region.residents[key as keyof Population] + pending[key as keyof Population] - command.residents[key as keyof Population]])) as unknown as Population;
    if (remaining.sick > remaining.adults + remaining.children + remaining.elderly) return 'Syke som venter på transport må følge innbyggerne de tilhører.';
  }
  return undefined;
}
export function applyAdministrationCommand(state0: RegionState, world: RegionWorld, command: AdministrationCommand): RegionState {
  const error = administrationCommandError(state0, world, command); if (error) throw new Error(error);
  const state = structuredClone(state0) as AdministrationGame;
  state.administration ??= { version: 1, regions: {} };
  if (command.kind === 'establish') {
    const l1Id = regionalL1(world, command.hqZoneId)!;
    state.administration.regions[l1Id] = { l1Id, hqZoneId: command.hqZoneId, leaderId: command.leaderId, residents: emptyPopulation(), policy: 'balanced', work: emptyWork(), budget: {}, establishedDay: state.day, alerts: [] };
    state.mobility ??= { version: 1, depots: {}, radios: {} }; state.mobility.depots[command.hqZoneId] ??= {};
    state.memory.push({ day: state.day, text: `Regionalt HQ etablert i ${indexWorld(world).byId.get(command.hqZoneId)?.name}.` });
    return state;
  }
  const region = state.administration.regions[command.l1Id];
  if (command.kind === 'leader') region.leaderId = command.leaderId;
  if (command.kind === 'successor') region.successorId = command.survivorId;
  if (command.kind === 'policy') region.policy = command.policy;
  if (command.kind === 'budget') region.budget = { ...command.budget };
  if (command.kind === 'residents') {
    state.mobility ??= { version: 1, depots: {}, radios: {} }; state.mobility.depotResidents ??= {};
    const pending = state.mobility.depotResidents[region.hqZoneId] ??= emptyPopulation();
    for (const key of Object.keys(pending) as (keyof Population)[]) pending[key] += region.residents[key] - command.residents[key];
    region.residents = { ...command.residents };
  }
  return state;
}
/** Isolates workDay, including construction ledgers. commit merges only the selected community's changes. */
export function centralCommunity(state: RegionState, world: RegionWorld) {
  const excluded = new Set(administrations(state).map(r => r.l1Id));
  const ids = new Set(world.zones.filter(z => z.level !== 3 || !excluded.has(regionalL1(world, z.id) ?? '')).map(z => z.id));
  const scopedWorld = scopeWorld(world, ids);
  const counters = scopeCounters(state, world, ids);
  const beforeCounters = { ...counters };
  const population = centralPopulation(state); const beforePopulation = { ...population };
  const scoped = { ...state, administration: undefined, mobility: undefined, population,
    zones: Object.fromEntries(Object.entries(state.zones).filter(([id]) => ids.has(id))), counters,
    barricades: scopeBarricades(state, world, ids),
    networks: Object.fromEntries(Object.entries(state.networks).filter(([id]) => !excluded.has(regionalL1(world, id) ?? ''))),
    wonders: Object.fromEntries(Object.entries(state.wonders ?? {}).filter(([, w]) => ids.has(w.zoneId))),
  } as RegionState;
  return { state: scoped, world: scopedWorld, commit: (target: RegionState) => {
    for (const key of Object.keys(population) as (keyof Population)[]) target.population[key] = Math.max(0, target.population[key] + scoped.population[key] - beforePopulation[key]);
    for (const key of Object.keys(beforeCounters)) if (!(key in scoped.counters) && (key.startsWith('network:') || key.startsWith('repair:'))) delete target.counters[key];
    for (const [key, value] of Object.entries(scoped.counters)) target.counters[key] = (target.counters[key] ?? 0) + value - (beforeCounters[key] ?? 0);
    Object.assign(target.zones, scoped.zones); Object.assign(target.barricades, scoped.barricades); Object.assign(target.networks, scoped.networks);
    Object.assign(target.wonders ??= {}, scoped.wonders); target.hq = scoped.hq;
  } };
}
function scopeWorld(world: RegionWorld, ids: Set<string>): RegionWorld {
  return { ...world, zones: world.zones.filter(z => ids.has(z.id)), neighbours: world.neighbours.filter(n => ids.has(n.a) && ids.has(n.b)), links: world.links.filter(l => ids.has(l.a) && ids.has(l.b)), pois: world.pois.filter(p => ids.has(p.zoneId)) };
}
function scopeCounters(state: RegionState, world: RegionWorld, ids: Set<string>) {
  return Object.fromEntries(Object.entries(state.counters).filter(([key]) => {
    if (key.startsWith('network:')) return world.zones.some(z => z.level === 2 && key.startsWith(`network:${z.id}:`) && (indexWorld(world).children.get(z.id) ?? []).some(id => ids.has(id)));
    if (key.startsWith('repair:')) { const link = world.links.find(l => `repair:${l.id}` === key); return Boolean(link && ids.has(link.a) && ids.has(link.b)); }
    return true;
  }));
}
function scopeBarricades(state: RegionState, world: RegionWorld, ids: Set<string>) {
  const connections = new Set(indexWorld(world).connections.filter(c => ids.has(c.fromId) && ids.has(c.toId)).map(c => c.id));
  return Object.fromEntries(Object.entries(state.barricades).filter(([id]) => connections.has(id)));
}

/** Existing daily-flow rules, evaluated only on this physical community and its own controlled land. */
export function regionalCommunity(state: RegionState, world: RegionWorld, region: RegionalAdministration): RegionState {
  const ids = new Set(regionalSurvivorIds(state).filter(id => atHq(state, id, region.hqZoneId)));
  return { ...state, administration: undefined, mobility: undefined, homeZoneId: region.hqZoneId, hq: undefined, population: { ...region.residents },
    survivors: state.survivors.filter(s => ids.has(s.id)), stock: regionalStock(state, region), work: region.work,
    wonders: undefined, zones: Object.fromEntries(Object.entries(state.zones).map(([id, z]) => [id, regionalL1(world, id) === region.l1Id ? z : { ...z, status: z.status === 'controlled' ? 'scouted' : z.status }])),
  } as RegionState;
}
export function regionalWork(state: RegionState, world: RegionWorld, region: RegionalAdministration): Record<WorkId, number> {
  const work = emptyWork(); const hands = Math.floor(Math.max(0, region.residents.adults - Math.min(region.residents.adults, region.residents.sick)) + region.residents.children * lawMods(state).childWork);
  const policy = REGIONAL_POLICIES[region.policy];
  const leader = state.survivors.find(s => s.id === region.leaderId);
  const caution = leader?.traits?.includes('suspicious') ? .05 : leader?.traits?.includes('kind') ? -.025 : 0;
  const guardShare = Math.max(policy.guardShare + caution, regionalMandate(state).minimumGuardShare);
  work.guard = Math.floor(hands * guardShare);
  const coast = Object.keys(state.zones).some(id => state.zones[id].status === 'controlled' && regionalL1(world, id) === region.l1Id && indexWorld(world).coastal.has(id));
  work.fish = coast ? Math.min(Math.floor(hands * policy.fishShare), Math.floor((regionalStock(state, region).boat ?? 0) * 3)) : 0;
  let left = hands - work.guard - work.fish;
  work.farm = Math.ceil(left * .55); left -= work.farm;
  work.scavenge = Math.floor(left * .35);
  work.clear = Math.floor(left * .25);
  work.build = Math.floor(left * .25);
  work.research = left - work.scavenge - work.clear - work.build;
  return work;
}
export function regionalSupplyRequest(state: RegionState, region: RegionalAdministration): Stock {
  const stock = regionalStock(state, region);
  return Object.fromEntries(Object.entries(region.budget).map(([id, wanted]) => [id, Math.max(0, wanted - (stock[id] ?? 0))]).filter(([, n]) => Number(n) > 0));
}
/** Mutating settlement hook, called once inside the authoritative daily transaction. */
export function regionalDay(state: RegionState, world: RegionWorld, lines: ReportLine[], rng: () => number = () => .5): string[] {
  const handled: string[] = [];
  for (const region of administrations(state)) {
    if (region.ledger?.day === state.day) { handled.push(...regionalSurvivorIds(state).filter(id => atHq(state, id, region.hqZoneId))); continue; }
    region.alerts = [];
    const arrivals = (state as AdministrationGame).mobility?.depotResidents?.[region.hqZoneId];
    if (arrivals) {
      const arrived = arrivals.adults + arrivals.children + arrivals.elderly;
      for (const key of Object.keys(region.residents) as (keyof Population)[]) { region.residents[key] += arrivals[key]; arrivals[key] = 0; }
      if (arrived) lines.push({ tone: 'info', title: `${arrived} innbyggere ankom regionalt HQ`, text: 'De inngår nå i lokal arbeidsfordeling og forsyning.', zoneId: region.hqZoneId });
    }
    if (state.zones[region.hqZoneId]?.status !== 'controlled') region.alerts.push('Regionalt HQ er ikke kontrollert. Produksjon stanset.');
    const leader = state.survivors.find(s => s.id === region.leaderId && s.alive && !s.left);
    if (!leader) {
      const next = state.survivors.find(s => s.id === region.successorId && s.alive && !s.left && atHq(state, s.id, region.hqZoneId));
      if (next && regionalMandate(state).automaticSuccession) { region.leaderId = next.id; region.successorId = undefined; lines.push({ tone: 'warn', title: `${next.name} overtar regionen`, text: 'Den utpekte stedfortrederen viderefører mandatet.', zoneId: region.hqZoneId }); }
      else { region.leaderId = undefined; region.alerts.push('Ingen regional leder. Bekreft en lokal etterfølger.'); }
    } else if (!atHq(state, leader.id, region.hqZoneId)) region.alerts.push('Lederen er utenfor regionalt HQ. Ny lokal drift venter.');
    if (leader && (leader.loyalty ?? 60) < REGIONAL_RULES.loyaltyPause) region.alerts.push('Lav lederlojalitet: lokal arbeidsfordeling står på vent.');
    region.work = regionalWork(state, world, region);
    if (!region.leaderId || !atHq(state, region.leaderId, region.hqZoneId) || (leader?.loyalty ?? 60) < REGIONAL_RULES.loyaltyPause || state.zones[region.hqZoneId]?.status !== 'controlled') region.work = emptyWork();
    const local = regionalCommunity(state, world, region);
    const ids = new Set(world.zones.filter(z => z.level !== 3 || regionalL1(world, z.id) === region.l1Id).map(z => z.id));
    const regionalWorld = scopeWorld(world, ids);
    local.zones = Object.fromEntries(Object.entries(local.zones).filter(([id]) => ids.has(id)));
    local.counters = scopeCounters(state, world, ids);
    const beforeCounters = { ...local.counters };
    local.barricades = scopeBarricades(state, world, ids);
    local.networks = Object.fromEntries(Object.entries(state.networks).filter(([id]) => regionalL1(world, id) === region.l1Id));
    const beforePopulation = { ...local.population };
    const beforeWorkStock = { ...local.stock };
    const workDay = (engine as typeof engine & { workDay?: (state: RegionState, world: RegionWorld, rng: () => number, lines: ReportLine[]) => unknown }).workDay;
    if (workDay) workDay(local, regionalWorld, rng, lines);
    if (region.work.research) researchDay(local, region.work.research * lawMods(local).researchMult, lines);
    for (const key of Object.keys(region.residents) as (keyof Population)[]) {
      const delta = local.population[key] - beforePopulation[key];
      region.residents[key] += delta; state.population[key] += delta;
    }
    for (const key of Object.keys(beforeCounters)) if (!(key in local.counters) && (key.startsWith('network:') || key.startsWith('repair:'))) delete state.counters[key];
    for (const [key, value] of Object.entries(local.counters)) state.counters[key] = (state.counters[key] ?? 0) + value - (beforeCounters[key] ?? 0);
    Object.assign(state.barricades, local.barricades); Object.assign(state.networks, local.networks);
    const flows = dailyFlows(local, regionalWorld);
    const game = state as AdministrationGame; game.mobility ??= { version: 1, depots: {}, radios: {} };
    const stock = game.mobility.depots[region.hqZoneId] ??= {};
    const flowProduction: Stock = { food: flows.food.produced, water: flows.water.produced, ...flows.other };
    const produced = { ...flowProduction };
    for (const [resource, amount] of Object.entries(stock)) if (amount > (beforeWorkStock[resource] ?? 0)) produced[resource] = (produced[resource] ?? 0) + amount - (beforeWorkStock[resource] ?? 0);
    const consumed: Stock = {}; const shortages: Stock = {};
    for (const [resource, amount] of Object.entries(flowProduction)) stock[resource] = (stock[resource] ?? 0) + amount;
    const consume = (resource: string, amount: number) => { const used = Math.min(stock[resource] ?? 0, Math.max(0, amount)); stock[resource] = Math.max(0, (stock[resource] ?? 0) - used); consumed[resource] = (consumed[resource] ?? 0) + used; shortages[resource] = (shortages[resource] ?? 0) + Math.max(0, amount - used); };
    consume('food', flows.food.eaten + flows.food.upkeep); consume('water', flows.water.drunk); consume('fuel', flows.fuel.used); consume('food', Math.min(stock.food ?? 0, flows.food.spoiled));
    for (const person of local.survivors) {
      handled.push(person.id);
      if ((shortages.food ?? 0) > .01 || (shortages.water ?? 0) > .01) { person.health = Math.max(0, person.health - ((shortages.food ?? 0) > .01 ? REGIONAL_RULES.foodDamage : 0) - ((shortages.water ?? 0) > .01 ? REGIONAL_RULES.waterDamage : 0)); if (person.health <= 0) { person.alive = false; lines.push({ tone: 'bad', title: `${person.name} døde ved regionalt HQ`, text: 'Lokale forsyninger strakk ikke til.', zoneId: region.hqZoneId }); } }
    }
    if ((shortages.food ?? 0) > .01 || (shortages.water ?? 0) > .01) {
      region.alerts.push('Lokalt underskudd på mat eller vann. Send en fysisk forsyning.');
      const count = region.residents.adults + region.residents.children + region.residents.elderly;
      if (count && state.day % REGIONAL_RULES.hungerDeathInterval === 0) { const kind = region.residents.elderly ? 'elderly' : region.residents.adults ? 'adults' : 'children'; region.residents[kind] -= 1; state.population[kind] = Math.max(0, state.population[kind] - 1); const oldSick = region.residents.sick; region.residents.sick = Math.min(oldSick, count - 1); state.population.sick = Math.max(0, state.population.sick - (oldSick - region.residents.sick)); region.alerts.push('En lokal innbygger døde av forsyningssvikt.'); }
    }
    const residentCount = region.residents.adults + region.residents.children + region.residents.elderly;
    const newSick = Math.min(Math.max(0, residentCount - region.residents.sick), Math.floor(residentCount * POP.sickPerDay * lawMods(state).sickMult * (state.research.done.includes('hygiene') ? .5 : 1) + rng()));
    region.residents.sick += newSick; state.population.sick += newSick;
    const sick = Math.min(region.residents.sick, Math.ceil(region.residents.sick * REGIONAL_RULES.sickRecovery));
    const medicine = Math.min(stock.medicine ?? 0, Math.ceil(sick * REGIONAL_RULES.medicinePerRecovery));
    if (medicine > 0) { consume('medicine', medicine); region.residents.sick -= sick; state.population.sick = Math.max(0, state.population.sick - sick); }
    region.ledger = { day: state.day, produced, consumed, shortages };
    for (const alert of region.alerts) lines.push({ tone: 'warn', title: indexWorld(world).byId.get(region.l1Id)?.name ?? 'Regionalt avvik', text: alert, zoneId: region.hqZoneId });
  }
  return handled;
}
/** Local guards defend their own L1; they are never available to central workDay. */
export function regionalGuardFor(state: RegionState, world: RegionWorld, zoneId: string) {
  const region = administrations(state).find(r => r.l1Id === regionalL1(world, zoneId));
  const leader = state.survivors.find(s => s.id === region?.leaderId && s.alive && !s.left);
  return region && leader && atHq(state, leader.id, region.hqZoneId) && state.zones[region.hqZoneId]?.status === 'controlled'
    ? regionalWork(state, world, region).guard * lawMods(state).guardMult : 0;
}
