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
  radios: Record<string, { carrierId: string; originZoneId: string; radio: number; batteries: number }>;
}
export interface MissionPreview { valid: boolean; errors: string[]; originZoneId: string; targetZoneId: string; returnZoneId: string; routeZoneIds: string[]; travelHours: number; workHours: number; capacity: number; returnsToday: boolean }
export const MOBILITY_ACTIONS = ['travel', 'return', 'retrieve', 'supply', 'areaGuard'] as const;
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
}
export function routeBetween(state: RegionState, world: RegionWorld, from: string, to: string): string[] | undefined {
  if (!world.zones.some(z => z.id === from && z.level === 3) || !world.zones.some(z => z.id === to && z.level === 3)) return undefined;
  const queue: string[][] = [[from]], seen = new Set([from]);
  while (queue.length) {
    const route = queue.shift()!, here = route.at(-1)!;
    if (here === to) return route;
    const edges = world.neighbours.flatMap(edge => edge.a === here ? [edge.b] : edge.b === here ? [edge.a] : []);
    for (const link of world.links) if (!['blown', 'flooded', 'blocked'].includes(state.chokepoints[link.id] ?? 'open')) {
      if (link.a === here) edges.push(link.b); else if (link.b === here) edges.push(link.a);
    }
    for (const next of edges.sort()) if (!seen.has(next)) { seen.add(next); queue.push([...route, next]); }
  }
  return undefined;
}
export function missionPreview(state: RegionState, world: RegionWorld, order: RegionOrder): MissionPreview {
  const errors: string[] = [];
  const positions = order.survivorIds.map(id => crewPositionFor(state, id));
  const first = positions[0];
  const origin = first?.kind === 'zone' ? first.zoneId : first?.kind === 'area-duty' && first.areaLevel === 3 ? first.areaZoneId : '';
  if (!origin || positions.some(p => p?.kind !== 'zone' || p.zoneId !== origin)) errors.push('Laget må være samlet i en kjent sone før avreise.');
  if (order.survivorIds.some(id => Object.values(state.crewMissions ?? {}).some(m => !['complete', 'failed'].includes(m.status) && m.survivorIds.includes(id)))) errors.push('Noen er allerede på et pågående oppdrag. Omdiriger dette først.');
  const target = order.zoneId;
  const route = routeBetween(state, world, origin, target) ?? [];
  if (!route.length) errors.push('Ingen åpen, sammenhengende rute til målet.');
  const travelHours = Math.max(0, route.length - 1) * R.hopHours;
  const returnZoneId = order.logistics?.destinationZoneId ?? (['travel', 'return', 'areaGuard'].includes(order.action) || order.logistics?.stay ? target : state.homeZoneId);
  const back = routeBetween(state, world, target, returnZoneId);
  if (!back) errors.push('Ingen åpen returrute. Velg et annet retursted eller bli i målsonen.');
  const capacity = order.survivorIds.length * R.carryPerPerson;
  const stock = localStock(state, order.action === 'retrieve' ? order.zoneId : order.logistics?.sourceZoneId ?? origin);
  const cargo = order.logistics?.cargo ?? {};
  for (const [id, amount] of Object.entries(cargo)) if (!Number.isFinite(amount) || amount < 0 || (stock[id] ?? 0) < amount) errors.push(`Forsendelsen mangler ${id}, eller mengden er ugyldig.`);
  if (order.action === 'supply' && (order.logistics?.sourceZoneId ?? origin) !== origin) errors.push('Forsyninger må lastes der laget faktisk er.');
  const passengers = order.logistics?.passengers;
  if (passengers) {
    const available = origin === state.homeZoneId ? centralAvailablePopulation(state) : state.mobility?.depotResidents?.[origin];
    for (const [kind, amount] of Object.entries(passengers)) if (!Number.isInteger(amount) || amount < 0 || amount > (available?.[kind as keyof typeof passengers] ?? 0)) errors.push('Passasjerene må være fysisk tilgjengelige ved avreisestedet.');
  }
  const passengerWeight = passengers ? (passengers.adults + passengers.children + passengers.elderly) * 10 : 0;
  const gearWeight = (order.logistics?.gearIds ?? []).reduce((sum, id) => sum + (GEAR_CATALOG[state.gear?.items.find(i => i.id === id)?.kind ?? '']?.weight ?? 0), 0);
  if (cargoWeight(cargo) + gearWeight + passengerWeight > capacity) errors.push('Forsendelsen overstiger lagets bærekapasitet.');
  const returnHours = Math.max(0, (back?.length ?? 1) - 1) * R.hopHours;
  const workHours = ['travel', 'return', 'retrieve', 'supply', 'areaGuard'].includes(order.action) ? 0 : Math.max(1, Math.min(R.workHours, 15 - travelHours - returnHours));
  return { valid: !errors.length, errors, originZoneId: origin, targetZoneId: target, returnZoneId, routeZoneIds: route, travelHours, workHours, capacity, returnsToday: travelHours + workHours + returnHours <= 15 };
}
export function beginMission(state: RegionState, world: RegionWorld, order: RegionOrder): CrewMission {
  ensureMobility(state);
  const preview = missionPreview(state, world, order);
  if (!preview.valid) throw new Error(preview.errors.join(' '));
  const mission: CrewMission = { id: `mission:${state.day}:${order.id}`, orderId: order.id, action: order.action, survivorIds: [...order.survivorIds], originZoneId: preview.originZoneId, targetZoneId: order.zoneId, issuedDay: state.day, status: 'outbound', expectedReturnDay: state.day + Math.max(1, Math.ceil((preview.travelHours + preview.workHours + Math.max(0, (routeBetween(state, world, order.zoneId, preview.returnZoneId)?.length ?? 1) - 1) * R.hopHours) / 15)),
    order: JSON.parse(JSON.stringify(order)), routeZoneIds: preview.routeZoneIds, routeIndex: 0, elapsedHours: 0, returnZoneId: preview.returnZoneId, cargo: {}, cargoGearIds: [], workHours: preview.workHours };
  state.crewMissions![mission.id] = mission;
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
  let room = mission.survivorIds.length * R.carryPerPerson - cargoWeight(mission.cargo ?? {});
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
    const fresh = routeBetween(state, world, at, next);
    if (!fresh || fresh.length !== 2) break; // A blown/blocked connection stops movement, never teleports.
    mission.routeIndex = (mission.routeIndex ?? 0) + 1; remaining -= R.hopHours;
  }
  const index = mission.routeIndex ?? 0;
  for (const id of mission.survivorIds) state.crewPositions![id] = index === route.length - 1
    ? { kind: 'zone', zoneId: route[index] }
    : { kind: 'transit', fromZoneId: route[0], toZoneId: route.at(-1)!, routeZoneIds: route, atIndex: index, departedDay: mission.issuedDay, estimatedArrivalDay: state.day + Math.max(1, Math.ceil((route.length - 1 - index) * R.hopHours / 15)) };
  mission.elapsedHours = 15 - remaining;
  return remaining;
}
export function returnMission(state: RegionState, world: RegionWorld, mission: CrewMission, budget: number, lines: ReportLine[]): void {
  const at = mission.routeZoneIds?.[mission.routeIndex ?? 0] ?? mission.targetZoneId;
  const destination = mission.returnZoneId ?? state.homeZoneId;
  const route = routeBetween(state, world, at, destination);
  if (!route) { mission.status = 'returning'; return; }
  mission.routeZoneIds = route; mission.routeIndex = 0; mission.status = 'returning';
  advanceTravel(state, world, mission, budget);
  if (mission.routeIndex !== route.length - 1) return;
  const reported: string[] = [];
  unloadCargo(state, mission, destination, lines);
  mission.status = 'complete';
  if (mission.survivorIds.some(id => state.survivors.some(p => p.id === id && p.alive && p.health > 0 && !p.left))) {
    for (const [id, observation] of Object.entries(mission.observations ?? {})) if (state.zones[id]) { state.zones[id].status = observation.status; state.zones[id].intel = observation.intel; }
  }
  mission.observations = undefined;
  for (const id of mission.survivorIds) {
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
  const route = routeBetween(state, world, mission.routeZoneIds?.[mission.routeIndex ?? 0] ?? mission.targetZoneId, destinationZoneId);
  if (!route) throw new Error('Ingen åpen rute til valgt retursted.');
  mission.returnZoneId = destinationZoneId; mission.routeZoneIds = route; mission.routeIndex = 0; mission.status = 'returning';
  return state;
}

/** Carry costs and field provisions out of the departure depot before any action. */
export function reserveMissionStores(state: RegionState, mission: CrewMission, costs: Stock): void {
  if (mission.action === 'supply') return;
  const source = localStock(state, mission.originZoneId);
  const required = { ...mission.order?.logistics?.cargo, ...costs };
  required.ammo = Math.max(required.ammo ?? 0, Math.min(source.ammo ?? 0, mission.survivorIds.length * 20));
  for (const id of ['food', 'water']) required[id] = Math.max(required[id] ?? 0, Math.min(source[id] ?? 0, mission.survivorIds.length * 2));
  if (mission.action === 'fish' && (source.boat ?? 0)) required.boat = 1;
  if (cargoWeight(required) > mission.survivorIds.length * R.carryPerPerson) throw new Error('Oppdragslasten er for tung. Send flere bærere.');
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
    lines.push({ tone: 'bad', title: 'Laget kom ikke tilbake', text: 'Lasten ligger ved siste kjente oppdragssted. Den er ikke levert i HQ.' });
  }
}
