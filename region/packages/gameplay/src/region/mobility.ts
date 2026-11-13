/** Physical routes and local ledgers. Timing/capacity numbers remain HYPOTHESES. */
import type { RegionState, RegionWorld, RegionOrder, Stock, ReportLine } from './types';
import type { CrewMission } from './location';
import { crewPositionFor } from './location';
import { R } from './rules';
import { centralAvailablePopulation } from './administration';
import { GEAR_CATALOG, gearStateFor } from './gear';
export interface MobilityState {
  version: 1;
  depots: Record<string, Stock>;
  depotResidents?: Record<string, import('./types').Population>;
  reservedAwayIds?: string[];
  legacyAway?: Record<string, { returnDay: number; returnZoneId: string; cargo: Stock }>;
  radios: Record<string, { carrierId: string; originZoneId: string; radio: number; batteries: number }>;
}
export interface MissionPreview { valid: boolean; errors: string[]; originZoneId: string; targetZoneId: string; returnZoneId: string; routeZoneIds: string[]; travelHours: number; workHours: number; capacity: number; returnsToday: boolean; boatRequired: boolean; reservedCargo: Stock; availableCapacity: number }
export const MOBILITY_ACTIONS = ['travel', 'return', 'retrieve', 'supply', 'areaGuard'] as const;
export const carriedGearWeight = (state: RegionState, crewIds: readonly string[]) => gearStateFor(state).items.filter(item => item.location.kind === 'carried' && crewIds.includes(item.location.survivorId)).reduce((sum, item) => sum + (GEAR_CATALOG[item.kind]?.weight ?? 1), 0);
export const cargoWeight = (stock: Stock) => Object.entries(stock).reduce((n, [id, amount]) => n + amount * ({ ammo: .05, medicine: .2, antibiotics: .1, batteries: .3, radio: .5, boat: 0 }[id] ?? 1), 0);
export function localStock(state: RegionState, zoneId: string): Stock {
  return zoneId === state.homeZoneId ? state.stock : state.mobility?.depots[zoneId] ?? {};
}
export function ensureMobility(state: RegionState): void {
  state.mobility ??= { version: 1, depots: {}, radios: {} };
  if (!state.crewPositions) {
    const positions = Object.fromEntries(state.survivors.filter(p => p.alive && !p.left).map(person => {
      const old = state.gear?.missions?.[person.id];
      return [person.id, old?.arrived ? { kind: 'zone' as const, zoneId: old.targetZoneId } : crewPositionFor(state, person.id)!];
    }));
    state.crewPositions = positions;
  }
  state.crewMissions ??= {};
  state.gear ??= gearStateFor(state);
  registerLegacyAbsences(state);
}
const seaCache = new WeakMap<RegionWorld, Map<string, string[]>>();
function seaNeighbours(world: RegionWorld, zoneId: string): string[] {
  let cache = seaCache.get(world);
  if (!cache) {
    cache = new Map();
    const coastal = world.zones.filter(z => z.level === 3 && z.at && (z.measures?.coastM ?? 0) >= 100);
    for (const zone of coastal) cache.set(zone.id, coastal.filter(other => other.id !== zone.id && Math.hypot((other.at![0] - zone.at![0]) * 57.4, (other.at![1] - zone.at![1]) * 111.2) <= R.boatReachKm).map(z => z.id));
    seaCache.set(world, cache);
  }
  return cache.get(zoneId) ?? [];
}
function landEdge(state: RegionState, world: RegionWorld, a: string, b: string): boolean {
  return world.neighbours.some(edge => edge.a === a && edge.b === b || edge.a === b && edge.b === a) || world.links.some(edge => !['blown', 'flooded', 'blocked'].includes(state.chokepoints[edge.id] ?? 'open') && (edge.a === a && edge.b === b || edge.a === b && edge.b === a));
}
export function routeBetween(state: RegionState, world: RegionWorld, from: string, to: string, boat = (localStock(state, from).boat ?? 0) >= 1): string[] | undefined {
  if (!world.zones.some(z => z.id === from && z.level === 3) || !world.zones.some(z => z.id === to && z.level === 3)) return undefined;
  const queue: string[][] = [[from]], seen = new Set([from]);
  while (queue.length) {
    const route = queue.shift()!, here = route.at(-1)!;
    if (here === to) return route;
    const edges = world.neighbours.flatMap(edge => edge.a === here ? [edge.b] : edge.b === here ? [edge.a] : []);
    for (const link of world.links) if (!['blown', 'flooded', 'blocked'].includes(state.chokepoints[link.id] ?? 'open')) {
      if (link.a === here) edges.push(link.b); else if (link.b === here) edges.push(link.a);
    }
    if (boat) edges.push(...seaNeighbours(world, here));
    for (const next of edges.sort()) if (!seen.has(next)) { seen.add(next); queue.push([...route, next]); }
  }
  return undefined;
}
export function missionPreview(state: RegionState, world: RegionWorld, order: RegionOrder, actionCosts: Stock = {}): MissionPreview {
  const errors: string[] = [];
  const positions = order.survivorIds.map(id => crewPositionFor(state, id));
  const first = positions[0];
  const origin = first?.kind === 'zone' ? first.zoneId : first?.kind === 'area-duty' && first.areaLevel === 3 ? first.areaZoneId : '';
  if (!origin || positions.some(p => p?.kind !== 'zone' || p.zoneId !== origin)) errors.push('Laget må være samlet i en kjent sone før avreise.');
  if (order.survivorIds.some(id => Object.values(state.crewMissions ?? {}).some(m => !['complete', 'failed'].includes(m.status) && m.survivorIds.includes(id)))) errors.push('Noen er allerede på et pågående oppdrag. Omdiriger dette først.');
  const target = order.zoneId;
  const availableBoat = (localStock(state, origin).boat ?? 0) >= 1;
  const route = routeBetween(state, world, origin, target, availableBoat) ?? [];
  if (!route.length) errors.push('Ingen åpen, sammenhengende rute til målet.');
  const travelHours = Math.max(0, route.length - 1) * R.hopHours;
  const returnZoneId = order.logistics?.destinationZoneId ?? (['travel', 'return', 'areaGuard'].includes(order.action) || order.logistics?.stay ? target : state.homeZoneId);
  const back = routeBetween(state, world, target, returnZoneId, availableBoat);
  if (!back) errors.push('Ingen åpen returrute. Velg et annet retursted eller bli i målsonen.');
  const capacity = order.survivorIds.length * R.carryPerPerson;
  const stock = localStock(state, order.action === 'retrieve' ? order.zoneId : order.logistics?.sourceZoneId ?? origin);
  const cargo = order.action === 'retrieve' ? order.logistics?.cargo ?? {} : missionStoreRequest(state, order, actionCosts);
  for (const [id, amount] of Object.entries(cargo)) if (!Number.isFinite(amount) || amount < 0 || (stock[id] ?? 0) < amount) errors.push(`Forsendelsen mangler ${id}, eller mengden er ugyldig.`);
  if (order.action === 'supply' && (order.logistics?.sourceZoneId ?? origin) !== origin) errors.push('Forsyninger må lastes der laget faktisk er.');
  const passengers = order.logistics?.passengers;
  if (passengers) {
    const available = origin === state.homeZoneId ? centralAvailablePopulation(state) : state.mobility?.depotResidents?.[origin];
    for (const [kind, amount] of Object.entries(passengers)) if (!Number.isInteger(amount) || amount < 0 || amount > (available?.[kind as keyof typeof passengers] ?? 0)) errors.push('Passasjerene må være fysisk tilgjengelige ved avreisestedet.');
  }
  const passengerWeight = passengers ? (passengers.adults + passengers.children + passengers.elderly) * 10 : 0;
  const gearWeight = (order.logistics?.gearIds ?? []).reduce((sum, id) => sum + (GEAR_CATALOG[state.gear?.items.find(i => i.id === id)?.kind ?? '']?.weight ?? 0), 0);
  if (cargoWeight(cargo) + gearWeight + carriedGearWeight(state, order.survivorIds) + passengerWeight > capacity) errors.push('Forsendelsen overstiger lagets bærekapasitet.');
  const returnHours = Math.max(0, (back?.length ?? 1) - 1) * R.hopHours;
  const workHours = ['travel', 'return', 'retrieve', 'supply', 'areaGuard'].includes(order.action) ? 0 : Math.max(1, Math.min(R.workHours, 15 - travelHours - returnHours));
  return { valid: !errors.length, errors, originZoneId: origin, targetZoneId: target, returnZoneId, routeZoneIds: route, travelHours, workHours, capacity, reservedCargo: missionStoreRequest(state, order, actionCosts), availableCapacity: Math.max(0, capacity - cargoWeight(missionStoreRequest(state, order, actionCosts)) - gearWeight - carriedGearWeight(state, order.survivorIds) - passengerWeight), returnsToday: travelHours + workHours + returnHours <= 15, boatRequired: route.some((id, i) => i > 0 && !landEdge(state, world, route[i - 1], id)) || (back ?? []).some((id, i, list) => i > 0 && !landEdge(state, world, list[i - 1], id)) };
}
export function beginMission(state: RegionState, world: RegionWorld, order: RegionOrder): CrewMission {
  ensureMobility(state);
  const preview = missionPreview(state, world, order);
  if (!preview.valid) throw new Error(preview.errors.join(' '));
  const mission: CrewMission = { id: `mission:${state.day}:${order.id}`, orderId: order.id, action: order.action, survivorIds: [...order.survivorIds], originZoneId: preview.originZoneId, targetZoneId: order.zoneId, issuedDay: state.day, status: 'outbound', expectedReturnDay: state.day + Math.max(1, Math.ceil((preview.travelHours + preview.workHours + Math.max(0, (routeBetween(state, world, order.zoneId, preview.returnZoneId)?.length ?? 1) - 1) * R.hopHours) / 15)),
    order: JSON.parse(JSON.stringify(order)), routeZoneIds: preview.routeZoneIds, routeIndex: 0, elapsedHours: 0, returnZoneId: preview.returnZoneId, cargo: {}, cargoGearIds: [], workHours: preview.workHours };
  state.crewMissions![mission.id] = mission;
  if (preview.boatRequired) { localStock(state, preview.originZoneId).boat -= 1; mission.transportBoat = 1; }
  if (order.logistics?.passengers) {
    mission.passengers = JSON.parse(JSON.stringify(order.logistics.passengers));
    if (preview.originZoneId !== state.homeZoneId) { const available = state.mobility!.depotResidents![preview.originZoneId]; for (const kind of ['adults', 'children', 'elderly', 'sick'] as const) available[kind] -= mission.passengers![kind]; }
  }
  if (order.action === 'supply') loadCargo(state, mission, preview.originZoneId);
  return mission;
}
export function loadCargo(state: RegionState, mission: CrewMission, zoneId: string): void {
  const request = mission.order?.logistics;
  const stock = localStock(state, zoneId);
  let room = mission.survivorIds.length * R.carryPerPerson - cargoWeight(mission.cargo ?? {}) - carriedGearWeight(state, mission.survivorIds);
  if (mission.passengers) room -= (mission.passengers.adults + mission.passengers.children + mission.passengers.elderly) * 10;
  const requested = request?.cargo ?? (mission.action === 'retrieve' ? { ...stock } : {});
  for (const [id, amount] of Object.entries(requested).sort()) {
    const unitWeight = cargoWeight({ [id]: 1 });
    const take = Math.max(0, Math.min(amount, stock[id] ?? 0, unitWeight ? Math.floor(room / unitWeight * 10) / 10 : amount));
    if (!take) continue;
    stock[id] -= take; (mission.cargo ??= {})[id] = (mission.cargo?.[id] ?? 0) + take; room -= take * unitWeight;
  }
  const candidates = state.gear?.items.filter(item => item.location.kind === 'stored' && item.location.zoneId === zoneId && item.reported !== false) ?? [];
  for (const item of candidates) {
    if (request?.gearIds && !request.gearIds.includes(item.id)) continue;
    if (mission.action !== 'retrieve' && !request?.gearIds?.includes(item.id)) continue;
    const weight = GEAR_CATALOG[item.kind]?.weight ?? 1;
    if (weight > room) continue;
    room -= weight;
    item.location = { kind: 'carried', survivorId: mission.survivorIds[0], missionId: mission.id, targetZoneId: mission.returnZoneId, returnDay: 1e9, returnToZoneId: mission.returnZoneId };
    (mission.cargoGearIds ??= []).push(item.id);
  }
}
export function unloadCargo(state: RegionState, mission: CrewMission, zoneId: string, lines: ReportLine[]): void {
  ensureMobility(state);
  const stock = zoneId === state.homeZoneId ? state.stock : (state.mobility!.depots[zoneId] ??= {});
  for (const [id, amount] of Object.entries(mission.cargo ?? {})) stock[id] = Math.round(((stock[id] ?? 0) + amount) * 10) / 10;
  mission.cargo = {};
  if (mission.passengers) {
    const residents = (state.mobility!.depotResidents ??= {})[zoneId] ??= { adults: 0, children: 0, elderly: 0, sick: 0 };
    if (zoneId !== state.homeZoneId) for (const kind of ['adults', 'children', 'elderly', 'sick'] as const) residents[kind] += mission.passengers[kind];
    mission.passengers = undefined;
  }
  for (const id of mission.cargoGearIds ?? []) {
    const item = state.gear?.items.find(item => item.id === id);
    if (item) item.location = { kind: 'stored', zoneId };
  }
  mission.cargoGearIds = [];
  lines.push({ tone: 'good', title: zoneId === state.homeZoneId ? 'Leveransen er fremme' : 'Lokalt depot fylt', text: 'Lasten er levert på det faktiske ankomststedet.', zoneId });
}
export function advanceTravel(state: RegionState, world: RegionWorld, mission: CrewMission, budget: number): number {
  const route = mission.routeZoneIds ?? [];
  let remaining = budget;
  while ((mission.routeIndex ?? 0) < route.length - 1 && remaining >= R.hopHours) {
    const at = route[mission.routeIndex ?? 0], next = route[(mission.routeIndex ?? 0) + 1];
    const fresh = routeBetween(state, world, at, next, !!mission.transportBoat);
    if (!fresh || fresh.length !== 2) break; // A blown/blocked connection stops movement, never teleports.
    mission.routeIndex = (mission.routeIndex ?? 0) + 1; remaining -= R.hopHours;
  }
  const index = mission.routeIndex ?? 0;
  for (const id of mission.survivorIds.filter(id => state.survivors.some(p => p.id === id && p.alive && !p.left && p.health > 0))) state.crewPositions![id] = index === route.length - 1
    ? { kind: 'zone', zoneId: route[index] }
    : { kind: 'transit', fromZoneId: route[0], toZoneId: route.at(-1)!, routeZoneIds: route, atIndex: index, departedDay: mission.issuedDay, estimatedArrivalDay: state.day + Math.max(1, Math.ceil((route.length - 1 - index) * R.hopHours / 15)) };
  mission.elapsedHours = 15 - remaining;
  return remaining;
}
export function returnMission(state: RegionState, world: RegionWorld, mission: CrewMission, budget: number, lines: ReportLine[]): void {
  const live = mission.survivorIds.filter(id => state.survivors.some(p => p.id === id && p.alive && !p.left && p.health > 0));
  if (!live.length) return; // No surviving courier can deliver a dead party's cargo.
  const at = mission.routeZoneIds?.[mission.routeIndex ?? 0] ?? mission.targetZoneId;
  const destination = mission.returnZoneId ?? state.homeZoneId;
  const capacity = Math.max(0, live.length * R.carryPerPerson - carriedGearWeight(state, live));
  let excess = Math.max(0, cargoWeight(mission.cargo ?? {}) - capacity);
  if (excess > 0) { const cache = state.mobility!.depots[at] ??= {}; for (const id of Object.keys(mission.cargo ?? {}).sort().reverse()) { const unit = cargoWeight({ [id]: 1 }); if (!unit || excess <= 0) continue; const amount = Math.min(mission.cargo![id], Math.ceil(excess / unit * 10) / 10); mission.cargo![id] -= amount; cache[id] = (cache[id] ?? 0) + amount; excess -= amount * unit; } }
  const radio = state.mobility?.radios[mission.id];
  if (radio && !live.includes(radio.carrierId)) radio.carrierId = live[0];
  const route = routeBetween(state, world, at, destination, !!mission.transportBoat);
  if (!route) { mission.status = 'returning'; return; }
  mission.routeZoneIds = route; mission.routeIndex = 0; mission.status = 'returning';
  advanceTravel(state, world, mission, budget);
  if (mission.routeIndex !== route.length - 1) return;
  const reported: string[] = [];
  unloadCargo(state, mission, destination, lines);
  mission.status = 'complete';
  if (destination === state.homeZoneId && state.mobility?.reservedAwayIds) state.mobility.reservedAwayIds = state.mobility.reservedAwayIds.filter(id => !mission.survivorIds.includes(id));
  if (destination === state.homeZoneId) transmitMissionReports(state, mission, lines, false);
  for (const id of mission.survivorIds) {
    if (!live.includes(id)) { delete state.crewPositions?.[id]; continue; }
    if (state.gear?.missions) delete state.gear.missions[id];
    for (const item of state.gear?.items ?? []) if (item.location.kind === 'carried' && item.location.survivorId === id && !mission.cargoGearIds?.includes(item.id)) {
      item.location = { ...item.location, missionId: undefined, returnDay: undefined, returnToZoneId: destination, atZoneId: destination };
      if ((GEAR_CATALOG[item.kind]?.slot === 'tool' || item.provenance.kind === 'search' && !Object.values(state.gear!.loadouts[id] ?? {}).includes(item.id)) && (state.survivors.find(p => p.id === id)?.health ?? 0) >= 25) {
        item.location = { kind: 'stored', zoneId: destination };
        if (destination === state.homeZoneId && item.reported === false) { item.reported = true; reported.push(GEAR_CATALOG[item.kind]?.name ?? item.kind); }
        for (const slot of ['weapon', 'protection', 'tool'] as const) if (state.gear!.loadouts[id]?.[slot] === item.id) delete state.gear!.loadouts[id][slot];
      }
    }
  }
  if (reported.length) lines.push({ tone: 'good', category: 'loot', priority: 70, title: 'Personlig utstyr funnet', text: `${reported.join(', ')} er fysisk levert i leiren.` });
  releaseMissionRadio(state, mission, destination);
  if (mission.transportBoat) { const depot = destination === state.homeZoneId ? state.stock : (state.mobility!.depots[destination] ??= {}); depot.boat = (depot.boat ?? 0) + mission.transportBoat; mission.transportBoat = 0; }
}
export function releaseMissionRadio(state: RegionState, mission: CrewMission, zoneId: string): void {
  const radio = state.mobility?.radios[mission.id]; if (!radio) return;
  const stock = zoneId === state.homeZoneId ? state.stock : (state.mobility!.depots[zoneId] ??= {});
  stock.radio = (stock.radio ?? 0) + radio.radio;
  stock.batteries = (stock.batteries ?? 0) + radio.batteries;
  delete state.mobility!.radios[mission.id];
}
/** Explicitly redirect an existing moving/stationed crew, preserving all carried cargo. */
export function redirectMission(state0: RegionState, world: RegionWorld, missionId: string, destinationZoneId: string): RegionState {
  const state = JSON.parse(JSON.stringify(state0)) as RegionState;
  if (state.turnCheckpoint) throw new Error('Avklar den pågående hendelsen først.');
  ensureMobility(state);
  const mission = state.crewMissions![missionId];
  if (!mission || ['complete', 'failed'].includes(mission.status)) throw new Error('Oppdraget er ikke aktivt.');
  const route = routeBetween(state, world, mission.routeZoneIds?.[mission.routeIndex ?? 0] ?? mission.targetZoneId, destinationZoneId, !!mission.transportBoat);
  if (!route) throw new Error('Ingen åpen rute til valgt retursted.');
  mission.returnZoneId = destinationZoneId; mission.routeZoneIds = route; mission.routeIndex = 0; mission.status = 'returning';
  return state;
}

/** Carry costs and field provisions out of the departure depot before any action. */
export function reserveMissionStores(state: RegionState, mission: CrewMission, costs: Stock): void {
  if (mission.action === 'supply') return;
  const source = localStock(state, mission.originZoneId);
  const required = missionStoreRequest(state, mission.order!, costs);
  if (cargoWeight(required) + carriedGearWeight(state, mission.survivorIds) > mission.survivorIds.length * R.carryPerPerson) throw new Error('Oppdragslasten er for tung. Send flere bærere.');
  for (const [id, amount] of Object.entries(required)) if ((source[id] ?? 0) < amount) throw new Error(`Avreisestedet mangler ${id}.`);
  for (const [id, amount] of Object.entries(required)) {
    source[id] = (source[id] ?? 0) - amount;
    (mission.cargo ??= {})[id] = (mission.cargo?.[id] ?? 0) + amount;
  }
}
export function failEmptyMissions(state: RegionState, lines: ReportLine[]): void {
  for (const mission of Object.values(state.crewMissions ?? {})) {
    if (['complete', 'failed'].includes(mission.status) || mission.survivorIds.some(id => state.survivors.some(p => p.id === id && p.alive && !p.left && p.health > 0))) continue;
    const zone = mission.routeZoneIds?.[mission.routeIndex ?? 0] ?? mission.targetZoneId;
    const cache = state.mobility!.depots[zone] ??= {};
    for (const [id, amount] of Object.entries(mission.cargo ?? {})) cache[id] = (cache[id] ?? 0) + amount;
    mission.cargo = {}; mission.status = 'failed';
    if (mission.transportBoat) { cache.boat = (cache.boat ?? 0) + mission.transportBoat; mission.transportBoat = 0; }
    releaseMissionRadio(state, mission, zone);
    if (mission.passengers) { const residents = (state.mobility!.depotResidents ??= {})[zone] ??= { adults: 0, children: 0, elderly: 0, sick: 0 }; for (const kind of ['adults', 'children', 'elderly', 'sick'] as const) residents[kind] += mission.passengers[kind]; mission.passengers = undefined; }
    lines.push({ tone: 'bad', title: 'Laget kom ikke tilbake', text: 'Lasten ligger ved siste kjente oppdragssted. Den er ikke levert i HQ.' });
  }
}

/** Preserve old awayUntil errands without inventing their unknown route. */
export function registerLegacyAbsences(state: RegionState): void {
  if (!state.mobility || !state.crewPositions) return;
  const register = state.mobility.legacyAway ??= {};
  for (const person of state.survivors) {
    if (!person.alive || !person.awayUntil || person.awayUntil <= state.day || register[person.id]
      || Object.values(state.crewMissions ?? {}).some(m => !['complete', 'failed'].includes(m.status) && m.survivorIds.includes(person.id))) continue;
    const cargo: Stock = {};
    for (const id of ['food', 'water']) {
      const take = Math.min(state.stock[id] ?? 0, person.awayUntil - state.day, R.carryPerPerson / 2);
      state.stock[id] = (state.stock[id] ?? 0) - take; cargo[id] = take;
    }
    register[person.id] = { returnDay: person.awayUntil, returnZoneId: state.homeZoneId, cargo };
    state.crewPositions[person.id] = { kind: 'away-unknown', expectedReturnDay: person.awayUntil };
  }
}
export function completeLegacyReturns(state: RegionState): void {
  for (const [id, absence] of Object.entries(state.mobility?.legacyAway ?? {})) {
    const person = state.survivors.find(p => p.id === id);
    if (!person || !person.alive || person.health <= 0 || person.left) { delete state.mobility!.legacyAway![id]; continue; }
    if (absence.returnDay > state.day || person.awayUntil && person.awayUntil > state.day) continue;
    state.crewPositions![id] = { kind: 'zone', zoneId: absence.returnZoneId };
    const stock = absence.returnZoneId === state.homeZoneId ? state.stock : (state.mobility!.depots[absence.returnZoneId] ??= {});
    for (const [resource, amount] of Object.entries(absence.cargo)) stock[resource] = (stock[resource] ?? 0) + amount;
    delete state.mobility!.legacyAway![id];
  }
}

/** Shared UI/motor departure manifest. Explicit quantities, including zero, override auto supplies. */
export function missionStoreRequest(state: RegionState, order: RegionOrder, costs: Stock = {}): Stock {
  const position = crewPositionFor(state, order.survivorIds[0] ?? '');
  const origin = position?.kind === 'zone' ? position.zoneId : state.homeZoneId;
  const source = localStock(state, origin);
  const supplied = order.action === 'retrieve' ? {} : order.logistics?.cargo ?? {};
  const result = { ...supplied };
  if (order.action !== 'supply') {
    for (const id of ['food', 'water']) if (!Object.prototype.hasOwnProperty.call(supplied, id)) result[id] = Math.min(source[id] ?? 0, order.survivorIds.length * 2);
    if (!Object.prototype.hasOwnProperty.call(supplied, 'ammo')) result.ammo = Math.min(source.ammo ?? 0, order.action === 'clear' ? order.survivorIds.length * 20 : order.action === 'assault' ? order.survivorIds.length * 5 : 0);
    if (order.action === 'fish' && !Object.prototype.hasOwnProperty.call(supplied, 'boat') && (source.boat ?? 0) > 0) result.boat = 1;
  }
  for (const [id, amount] of Object.entries(costs)) result[id] = Math.max(result[id] ?? 0, amount);
  return Object.fromEntries(Object.entries(result).filter(([, amount]) => amount > 0));
}

/** Knowledge travels with a living reporter or a verified radio; cargo never does. */
export function transmitMissionReports(state: RegionState, mission: CrewMission, lines: ReportLine[], radioVerified: boolean): void {
  const live = new Set(mission.survivorIds.filter(id => state.survivors.some(p => p.id === id && p.alive && !p.left && p.health > 0)));
  if (!live.size) return;
  const delivered = [...live].some(id => { const position = crewPositionFor(state, id); return position?.kind === 'zone' && position.zoneId === state.homeZoneId; });
  if (!radioVerified && !delivered) return;
  for (const entry of Object.values(state.crewMissions ?? {})) {
    if (entry.status === 'failed' || !entry.survivorIds.some(id => live.has(id))) continue;
    for (const [id, observation] of Object.entries(entry.observations ?? {})) if (state.zones[id]) { state.zones[id].status = observation.status; state.zones[id].intel = observation.intel; }
    entry.observations = undefined;
    for (const [id, observation] of Object.entries(entry.factionObservations ?? {})) { const faction = state.factions.find(f => f.id === id); if (faction) { faction.known = observation.known; faction.revealed = observation.revealed; } }
    entry.factionObservations = undefined;
    if (entry.privateLines?.length) lines.push(...entry.privateLines);
    entry.privateLines = undefined;
  }
  for (const item of state.gear?.items ?? []) if (item.reported === false && item.location.kind === 'carried' && live.has(item.location.survivorId)) {
    item.reported = true;
    lines.push({ tone: 'good', category: 'loot', priority: 65, title: radioVerified ? 'Utstyr rapportert fra feltet' : 'Personlig utstyr funnet', text: `${GEAR_CATALOG[item.kind]?.name ?? item.kind}. ${radioVerified ? 'Fortsatt fysisk med laget; ikke i felleslageret.' : 'Rapportert av laget ved faktisk hjemkomst.'}` });
  }
}
