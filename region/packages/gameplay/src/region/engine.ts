/**
 * Region game engine. Pure and deterministic: the same state, orders and seed give the same day.
 * Zombie movement uses the accounted migration in simulation-core: nobody appears from nowhere.
 */
import { resolveDay, type Connection, type SimulationWorld } from '../../../simulation-core/src/index';
import { CONTENT } from '../../../world-data/src/content';
import type {
  ActionId, ChokepointState, RegionFaction, RegionOrder, RegionReport, RegionState, RegionSurvivor, RegionWorld, RegionZone,
  RegionZoneState, ReportLine, Stock,
} from './types';
import {
  ACTIONS, FACTIONS, LOOT_PER_HOME, LOOT_PER_SITE, MILESTONES, MODULE_COST, NETWORK_COST, R, RECRUIT_POOL, REGION_RULES_VERSION,
  SEASONS, START_CREW, UPGRADE_COST, VALUE, WEAPONS,
} from './rules';
import { pickEvent } from './events';

// ------------------------------------------------------------------ world index

export interface Adjacent { to: string; connId: string; kind: 'land' | 'bridge' | 'tunnel'; borderM: number; linkId?: string }
export interface RegionIndex {
  byId: Map<string, RegionZone>; l3: RegionZone[]; adjacent: Map<string, Adjacent[]>; coastal: Set<string>;
  poisByZone: Map<string, RegionWorld['pois']>; children: Map<string, string[]>; connections: Connection[];
}
const indexes = new WeakMap<RegionWorld, RegionIndex>();
export function indexWorld(world: RegionWorld): RegionIndex {
  const cached = indexes.get(world);
  if (cached) return cached;
  const byId = new Map(world.zones.map(z => [z.id, z]));
  const l3 = world.zones.filter(z => z.level === 3);
  const adjacent = new Map<string, Adjacent[]>(l3.map(z => [z.id, []]));
  const connections: Connection[] = [];
  for (const n of world.neighbours) {
    if (!adjacent.has(n.a) || !adjacent.has(n.b)) continue;
    const connId = `L:${n.a}:${n.b}`;
    adjacent.get(n.a)!.push({ to: n.b, connId, kind: 'land', borderM: n.borderM });
    adjacent.get(n.b)!.push({ to: n.a, connId, kind: 'land', borderM: n.borderM });
    connections.push({ id: connId, fromId: n.a, toId: n.b, allowZombies: true,
      capacityPerDirection: Math.max(1, Math.min(12, Math.round(n.borderM / R.borderMetersPerCapacity))) });
  }
  for (const link of world.links) {
    if (!adjacent.has(link.a) || !adjacent.has(link.b)) continue;
    adjacent.get(link.a)!.push({ to: link.b, connId: link.id, kind: link.kind, borderM: 0, linkId: link.id });
    adjacent.get(link.b)!.push({ to: link.a, connId: link.id, kind: link.kind, borderM: 0, linkId: link.id });
    connections.push({ id: link.id, fromId: link.a, toId: link.b, allowZombies: true, capacityPerDirection: R.linkCapacity[link.kind] });
  }
  const coastal = new Set(l3.filter(z => (z.measures?.coastM ?? 0) >= 100).map(z => z.id));
  const poisByZone = new Map<string, RegionWorld['pois']>();
  for (const poi of world.pois) (poisByZone.get(poi.zoneId) ?? poisByZone.set(poi.zoneId, []).get(poi.zoneId)!).push(poi);
  const children = new Map<string, string[]>();
  for (const z of world.zones) if (z.parentId) (children.get(z.parentId) ?? children.set(z.parentId, []).get(z.parentId)!).push(z.id);
  const result = { byId, l3, adjacent, coastal, poisByZone, children, connections };
  indexes.set(world, result);
  return result;
}

// ------------------------------------------------------------------ small helpers

export function random(seed: number, day: number, key: string): () => number {
  let hash = 2166136261;
  for (const char of `${seed}|${day}|${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => { hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0; return hash / 4294967296; };
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const living = (state: RegionState) => state.survivors.filter(s => s.alive);
const add = (stock: Stock, id: string, amount: number) => { stock[id] = Math.max(0, Math.round(((stock[id] ?? 0) + amount) * 10) / 10); };
export const has = (stock: Stock, cost: Record<string, number>) => Object.entries(cost).every(([id, n]) => (stock[id] ?? 0) >= n);
const pay = (stock: Stock, cost: Record<string, number>) => { for (const [id, n] of Object.entries(cost)) add(stock, id, -n); };
export const costText = (cost: Record<string, number>) => Object.entries(cost).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(', ');
export const resourceName = (id: string) => CONTENT.resources.find(r => r.id === id)?.name ?? id;

export function season(day: number) {
  const month = (R.startMonth + Math.floor(day / 30.4)) % 12;
  return SEASONS.find(s => s.months.includes(month))!;
}
export function dateText(day: number) {
  const date = new Date(Date.UTC(2026, R.startMonth, 1 + day));
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function residents(zone: RegionZone) { return Math.round((zone.measures?.floor ?? 0) / R.residentFloorM2); }
export function searchHoursTotal(zone: RegionZone) {
  const m = zone.measures;
  if (!m) return 4;
  return Math.max(4, Math.round(m.floor / R.searchFloorM2PerHour + Math.max(0, m.buildings - m.homes) * R.otherBuildingHours * .5));
}
export const l2Of = (world: RegionWorld, zoneId: string) => indexWorld(world).byId.get(zoneId)?.parentId;
export const controlled = (state: RegionState) => Object.entries(state.zones).filter(([, z]) => z.status === 'controlled').map(([id]) => id);

function initialLoot(world: RegionWorld, zone: RegionZone): Stock {
  const index = indexWorld(world);
  const loot: Stock = {};
  const homes = zone.measures?.homes ?? 0;
  for (const [id, per] of Object.entries(LOOT_PER_HOME)) if (homes) add(loot, id, Math.round(homes * per));
  // Rural homes have tractors, diesel and hunting rifles; boathouses have boats.
  if ((zone.measures?.farm ?? 0) > 2e4) { add(loot, 'fuel', 30); add(loot, 'ammo', 15); add(loot, 'engine', 1); add(loot, 'generator', 1); }
  if (zone.finds?.includes('boat')) add(loot, 'boat', 1 + Math.floor(homes / 60));
  if (zone.finds?.includes('solar')) add(loot, 'solar', 4);
  if ((zone.measures?.industry ?? 0) > 5000) { add(loot, 'metal', Math.round(zone.measures!.industry / 600)); add(loot, 'parts', Math.round(zone.measures!.industry / 1500)); }
  for (const poi of index.poisByZone.get(zone.id) ?? []) {
    const kind = poi.siteType ?? poi.hqType ?? poi.facilityType;
    for (const [id, n] of Object.entries(kind ? LOOT_PER_SITE[kind] ?? {} : {})) add(loot, id, n);
  }
  return loot;
}

// ------------------------------------------------------------------ new game

export function newRegionGame(world: RegionWorld, startZoneId: string, seed = 2026): RegionState {
  const index = indexWorld(world);
  if (!index.adjacent.has(startZoneId)) throw new Error(`Ukjent startsone ${startZoneId}`);
  const zones: Record<string, RegionZoneState> = {};
  for (const zone of index.l3) {
    const rng = random(seed, 0, zone.id);
    const ha = (zone.measures?.m2 ?? 0) / 1e4;
    const zombies = Math.round(residents(zone) * R.zombieShare * (.6 + .8 * rng()) + ha * .04 * rng());
    zones[zone.id] = { zombies, status: 'unknown', searched: 0, loot: initialLoot(world, zone), upgrades: [] };
  }
  const start = zones[startZoneId];
  start.zombies = Math.min(10, Math.round(start.zombies * .2));
  start.status = 'scouted';
  start.intel = { min: start.zombies, max: start.zombies, day: 0 };
  for (const near of index.adjacent.get(startZoneId)!) {
    const z = zones[near.to];
    z.status = 'scouted';
    z.intel = intelFor(z.zombies, 2, random(seed, 0, `intel:${near.to}`));
  }
  const hops = distances(world, [startZoneId], () => true, 99);
  const factions: RegionFaction[] = [];
  const taken = new Set<string>();
  for (const def of FACTIONS) {
    const options = world.pois.filter(p => p.role === 'hq' && p.hqType === def.hqType && !taken.has(p.zoneId) && (hops.get(p.zoneId) ?? 99) >= 4);
    const poi = options.sort((a, b) => (hops.get(a.zoneId) ?? 99) - (hops.get(b.zoneId) ?? 99))[Math.min(1, options.length - 1)];
    if (!poi) continue;
    taken.add(poi.zoneId);
    const stock: Stock = {};
    for (const id of def.offers) add(stock, id, Math.round(400 / (VALUE[id] ?? 1)));
    factions.push({ id: def.id, name: `${def.name} (${poi.name})`, zoneId: poi.zoneId, about: def.about, offers: def.offers, wants: def.wants, stock, relation: 0, known: false });
    zones[poi.zoneId].owner = def.id;
    zones[poi.zoneId].zombies = 0;
  }
  const state: RegionState = {
    schema: 'region-1', rulesVersion: REGION_RULES_VERSION, worldVersion: world.worldVersion, seed, day: 0,
    startZoneId, homeZoneId: startZoneId,
    survivors: START_CREW.map(s => ({ ...s, skills: { ...s.skills }, joinedDay: 0 })),
    stock: { ...R.startStock }, morale: R.morale.start, zones, barricades: {},
    chokepoints: Object.fromEntries(world.links.map(l => [l.id, 'open' as ChokepointState])),
    networks: {}, factions, milestones: [], reports: [], counters: {},
  };
  return state;
}

function intelFor(zombies: number, scouting: number, rng: () => number) {
  const spread = Math.max(.08, .5 - scouting * .06);
  const min = Math.max(0, Math.floor(zombies * (1 - spread * rng())));
  const max = Math.ceil(zombies * (1 + spread * rng())) + (zombies ? 0 : Math.round(2 * rng()));
  return { min, max, day: 0 };
}

// ------------------------------------------------------------------ reach

/** Shortest hop counts from the sources, through land borders and open bridges and tunnels. */
export function distances(world: RegionWorld, sources: string[], passable: (a: Adjacent) => boolean, limit: number, boats = false) {
  const index = indexWorld(world);
  const result = new Map<string, number>(sources.map(s => [s, 0]));
  const queue = [...sources];
  while (queue.length) {
    const here = queue.shift()!;
    const d = result.get(here)!;
    if (d >= limit) continue;
    const next = (index.adjacent.get(here) ?? []).filter(passable).map(a => a.to);
    if (boats && index.coastal.has(here)) next.push(...boatNeighbours(world, here));
    for (const to of next) if (!result.has(to)) { result.set(to, d + 1); queue.push(to); }
  }
  return result;
}
const boatCache = new WeakMap<RegionWorld, Map<string, string[]>>();
function boatNeighbours(world: RegionWorld, zoneId: string) {
  let cache = boatCache.get(world);
  if (!cache) { cache = new Map(); boatCache.set(world, cache); }
  if (!cache.has(zoneId)) {
    const index = indexWorld(world);
    const here = index.byId.get(zoneId)!.at!;
    const km = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 57.4, (a[1] - b[1]) * 111.2);
    cache.set(zoneId, [...index.coastal].filter(id => id !== zoneId && km(index.byId.get(id)!.at!, here) <= R.boatReachKm));
  }
  return cache.get(zoneId)!;
}
/** Zones the group can reach today, with hop counts from what they hold. */
export function reach(state: RegionState, world: RegionWorld) {
  const sources = [...new Set([...controlled(state), state.homeZoneId])];
  return distances(world, sources, a => !a.linkId || !['blown', 'flooded'].includes(state.chokepoints[a.linkId]), R.reachHops,
    (state.stock.boat ?? 0) >= 1);
}

// ------------------------------------------------------------------ previews

export interface OrderPreview { valid: boolean; errors: string[]; hours: number; costs: Record<string, number>; risk: 'Lav' | 'Middels' | 'Høy'; text: string }

function crewOf(state: RegionState, ids: string[]) { return state.survivors.filter(s => ids.includes(s.id) && s.alive); }
const efficiency = (state: RegionState, s: RegionSurvivor) => Math.max(.3, (s.fatigue > 80 ? .6 : 1) * (s.health < 50 ? .7 : 1) * (.8 + state.morale / 250));

export function hqModules(state: RegionState): string[] {
  if (!state.hq) return [];
  const type = CONTENT.hqTypes.find(t => t.id === state.hq!.type);
  const generic = ['kitchen', 'medbay', 'gate', 'workshop', 'ammoLab', 'housing', 'greenhouse', 'watchtower', 'radioRoom', 'depot', 'walls'];
  const coastal = ['dock', 'saltworks'];
  const list = [...generic, ...coastal, ...(type ? [type.unique] : [])];
  return [...new Set(list)].filter(m => !state.hq!.modules.includes(m));
}
export function upgradesFor(state: RegionState, world: RegionWorld, zoneId: string) {
  const zone = indexWorld(world).byId.get(zoneId)!;
  const m = zone.measures;
  const z = state.zones[zoneId];
  return CONTENT.upgrades.filter(u => u.level === 3 && !z.upgrades.includes(u.id) && UPGRADE_COST[u.id]).filter(u => {
    const r = u.requires;
    if (!m) return false;
    if (r.coastM && m.coastM < r.coastM) return false;
    if (r.openHa && (m.open + (m.pasture ?? 0) + m.farm) / 1e4 < r.openHa) return false;
    if (r.housing && m.homes < 5) return false;
    if (r.network && !(state.networks[zone.parentId ?? ''] ?? []).includes(r.network)) return false;
    return true;
  });
}

export function previewOrder(state: RegionState, world: RegionWorld, order: Omit<RegionOrder, 'id'>): OrderPreview {
  const index = indexWorld(world);
  const errors: string[] = [];
  const crew = crewOf(state, order.survivorIds);
  const zone = index.byId.get(order.zoneId);
  const z = state.zones[order.zoneId];
  const hops = reach(state, world).get(order.zoneId);
  let costs: Record<string, number> = {};
  let text = '';
  let risk: OrderPreview['risk'] = 'Lav';
  if (!crew.length) errors.push('Velg minst én person.');
  if (crew.some(s => s.health < 25 && !['rest', 'heal'].includes(order.action))) errors.push('Noen er for skadet til å jobbe. La dem hvile.');
  if (!zone || !z) return { valid: false, errors: ['Ukjent sone.'], hours: 0, costs, risk, text };
  if (z.owner) errors.push('En annen gruppe holder denne sonen. Handle med dem i stedet.');
  if (hops === undefined && !['rest', 'heal', 'craft', 'module'].includes(order.action)) errors.push('Sonen er utenfor rekkevidde. Ta over soner nærmere først.');
  const travel = (hops ?? 0) * R.hopHours * 2;
  const hours = Math.max(0, crew.reduce((n, s) => n + (R.workHours - travel) * efficiency(state, s), 0));
  const isControlled = z.status === 'controlled';
  const total = searchHoursTotal(zone);
  switch (order.action) {
    case 'scout': text = 'Gir et anslag over zombier og hva sonen har.'; break;
    case 'clear': {
      const kills = estimateKills(state, crew, hours);
      text = `Kan drepe om lag ${Math.round(kills.kills)} zombier${kills.ammo ? ` og bruker om lag ${Math.ceil(kills.ammo)} patroner` : ''}.`;
      const known = z.intel ? (z.intel.min + z.intel.max) / 2 : z.zombies;
      risk = known > kills.kills * 2 ? 'Høy' : known > kills.kills ? 'Middels' : 'Lav';
      break;
    }
    case 'search': {
      const left = Math.max(0, total - z.searched);
      text = left ? `Gjennomsøker om lag ${Math.round(Math.min(100, hours / total * 100))} % av sonen. ${Math.round(z.searched / total * 100)} % er gjort.` : 'Sonen er allerede gjennomsøkt.';
      if (!left) errors.push('Ingenting igjen å søke gjennom.');
      const known = z.intel ? z.intel.max : z.zombies;
      risk = known > crew.length * 6 ? 'Høy' : known > crew.length * 2 ? 'Middels' : 'Lav';
      break;
    }
    case 'claim': {
      const nearOwned = controlled(state).length === 0 ? order.zoneId === state.homeZoneId : (hops ?? 9) <= 1;
      if (!nearOwned) errors.push(controlled(state).length ? 'Sonen må grense til en sone dere eier.' : 'Den første sonen dere tar over, må være startsonen.');
      if (isControlled) errors.push('Sonen er allerede deres.');
      const known = z.intel ? z.intel.max : 99;
      if (!z.intel || z.intel.day < state.day - 3) errors.push('Speid sonen først.');
      else if (known > R.claimMaxZombies) errors.push(`Det er for mange zombier igjen (inntil ${known}). Rydd først.`);
      if ((zone.measures?.homes ?? 0) >= 5 && z.searched / total < R.claimMinSearched) errors.push(`Søk gjennom minst ${Math.round(R.claimMinSearched * 100)} % av sonen først.`);
      text = 'Sonen blir deres. Zombier som kommer inn senere, må stoppes av forsvaret.';
      break;
    }
    case 'fortify': {
      if (!isControlled) errors.push('Bare soner dere eier kan sperres.');
      const open = (index.adjacent.get(order.zoneId) ?? []).filter(a => a.kind === 'land' && state.zones[a.to]?.status !== 'controlled' && !(state.barricades[a.connId] > 0));
      costs = { building: open.length * R.fortifyCost.building };
      if (!open.length) errors.push('Alle grensene mot land er sperret eller eid.');
      text = `Sperrer ${open.length} grenser mot land.`;
      break;
    }
    case 'build': {
      if (!isControlled) errors.push('Bygg bare i soner dere eier.');
      const u = UPGRADE_COST[order.target ?? ''];
      if (!u || !upgradesFor(state, world, order.zoneId).some(x => x.id === order.target)) errors.push('Kan ikke bygges her.');
      else { costs = z.building?.id === order.target ? {} : u.cost; text = `${Math.round(Math.min(hours, u.hours - (z.building?.id === order.target ? z.building?.hours ?? 0 : 0)))} av ${u.hours} arbeidstimer.`; }
      break;
    }
    case 'establishHq': {
      if (state.hq) errors.push('Dere har allerede et HQ.');
      if (!isControlled) errors.push('Ta over sonen først.');
      costs = { building: 6 };
      const poi = (index.poisByZone.get(order.zoneId) ?? []).find(p => p.role === 'hq');
      text = poi ? `${poi.name} blir HQ: ${CONTENT.hqTypes.find(t => t.id === poi.hqType)?.name ?? ''}.` : 'En enkel leir blir HQ. Den har ingen unik modul.';
      break;
    }
    case 'module': {
      if (!state.hq) errors.push('Etabler et HQ først.');
      const m = MODULE_COST[order.target ?? ''];
      if (!m || !hqModules(state).includes(order.target ?? '')) errors.push('Modulen kan ikke bygges.');
      else { costs = state.hq?.building?.id === order.target ? {} : m.cost; text = `${m.hours} arbeidstimer i alt.`; }
      break;
    }
    case 'network': {
      const l2 = zone.parentId ?? '';
      const n = NETWORK_COST[order.target ?? ''];
      if (!n) { errors.push('Ukjent nett.'); break; }
      if ((state.networks[l2] ?? []).includes(order.target!)) errors.push('Nettet finnes allerede.');
      if (!isControlled) errors.push('Bygg fra en sone dere eier.');
      const facilities = (index.children.get(l2) ?? []).flatMap(id => (index.poisByZone.get(id) ?? []).filter(p => n.facility?.includes(p.facilityType ?? '') && state.zones[id]?.status === 'controlled'));
      const radioRoom = order.target === 'comms' && state.hq?.modules.includes('radioRoom');
      const enoughZones = (index.children.get(l2) ?? []).filter(id => state.zones[id]?.status === 'controlled').length >= 3;
      if (n.facility && !facilities.length && !radioRoom) errors.push(`Krever: ${n.needs}. Anlegget må være i en sone dere eier.`);
      if (!n.facility && !enoughZones) errors.push('Eie minst tre soner i området.');
      costs = n.cost;
      text = `${n.hours} arbeidstimer. ${CONTENT.networks.find(x => x.id === order.target)?.gives ?? ''}`;
      break;
    }
    case 'guard': if (!isControlled) errors.push('Hold vakt i soner dere eier.'); text = 'Mer forsvar i natt.'; break;
    case 'hold': case 'block': case 'blow': {
      const link = world.links.find(l => l.id === order.target);
      if (!link || (link.a !== order.zoneId && link.b !== order.zoneId)) { errors.push('Velg en bru eller tunnel fra sonen.'); break; }
      const st = state.chokepoints[link.id];
      if (st === 'blown' || st === 'flooded') errors.push('Forbindelsen er borte.');
      if (order.action === 'block') costs = { ...R.blockCost };
      if (order.action === 'blow') {
        costs = { ...R.blowCost };
        if (!crew.some(s => s.skills.craft >= 3 || s.skills.combat >= 5)) errors.push('Krever en med håndverk 3 eller kamp 5.');
      }
      text = order.action === 'hold' ? 'Vakter på forbindelsen. Må gjentas hver dag.' : order.action === 'block' ? 'Barrikade som zombier må slite ned.' : link.kind === 'tunnel' ? 'Tunnelen raser sammen for godt.' : 'Brua faller. Den kan bygges opp igjen sent i spillet.';
      if (order.action === 'block' && st === 'blocked') errors.push('Forbindelsen er allerede sperret.');
      break;
    }
    case 'farm': {
      if (!isControlled) errors.push('Dyrk i soner dere eier.');
      const food = farmYield(state, zone, crew.length, hours);
      if (food <= 0) errors.push('Sonen har ikke jord å dyrke. Bygg «Dyrk opp åpen mark» eller «Riv og dyrk».');
      text = `Om lag ${Math.round(food)} mat i dag (${season(state.day).name.toLowerCase()}).`;
      break;
    }
    case 'fish': {
      if (!isControlled && order.zoneId !== state.homeZoneId) errors.push('Fisk fra en sone dere eier.');
      if (!index.coastal.has(order.zoneId)) errors.push('Sonen ligger ikke ved sjøen.');
      if ((state.stock.boat ?? 0) < 1) errors.push('Dere trenger en båt.');
      text = `Om lag ${Math.round(fishYield(state, z, crew.length))} mat.`;
      break;
    }
    case 'rest': text = 'Mindre utmattelse, litt bedre helse.'; break;
    case 'heal': costs = { medicine: Math.max(1, living(state).filter(s => s.health < 80).length) }; text = 'Behandler alle skadde i leiren.'; break;
    case 'craft': {
      const recipes = craftRecipes(state);
      const recipe = recipes.find(r => r.id === order.target);
      if (!recipe) errors.push('Ingen oppskrift tilgjengelig. Bygg ammoverksted eller laboratorium.');
      else { costs = recipe.cost; text = recipe.text; }
      break;
    }
  }
  if (!has(state.stock, costs)) errors.push(`Mangler: ${costText(Object.fromEntries(Object.entries(costs).filter(([id, n]) => (state.stock[id] ?? 0) < n)))}.`);
  if (hours <= 0 && !['rest', 'heal'].includes(order.action)) errors.push('Ingen arbeidstid igjen etter reisen.');
  return { valid: !errors.length, errors, hours: Math.round(hours), costs, risk, text };
}

export function craftRecipes(state: RegionState) {
  const list: { id: string; name: string; cost: Record<string, number>; gives: Record<string, number>; text: string }[] = [];
  if (state.hq?.modules.includes('ammoLab')) list.push({ id: 'ammo', name: 'Lad ammunisjon', cost: { primers: 1, metal: 1 }, gives: { ammo: 25 }, text: '1 tennhette og 1 metall blir 25 patroner.' });
  if (state.hq?.modules.includes('lab')) list.push({ id: 'antibiotics', name: 'Lag antibiotika', cost: { medicine: 5, electronics: 1 }, gives: { antibiotics: 2 }, text: '5 medisin og 1 elektronikk blir 2 antibiotika.' });
  if (state.hq?.modules.includes('workshop')) list.push({ id: 'building', name: 'Lag byggemateriale av skrap', cost: { metal: 2, parts: 1 }, gives: { building: 8 }, text: '2 metall og 1 del blir 8 byggemateriale.' });
  if (state.hq?.modules.includes('saltworks') || state.hq?.modules.includes('kitchen')) list.push({ id: 'preserve', name: 'Salt og konserver mat', cost: { food: 10, salt: 2 }, gives: { food: 14 }, text: 'Konservert mat svinner ikke: 10 mat og 2 salt blir 14 mat.' });
  return list;
}

function estimateKills(state: RegionState, crew: RegionSurvivor[], hours: number) {
  let kills = 0, ammo = 0, noise = 0;
  let ammoLeft = state.stock.ammo ?? 0;
  const share = hours / Math.max(1, crew.length * R.workHours);
  for (const s of crew) {
    let w = WEAPONS[s.weapon];
    const k0 = w.kills * (s.skills.combat / 4 + .5) * share * 8 / 4;
    if (w.ammo && ammoLeft < k0 * w.ammo) w = WEAPONS.melee;
    const k = w.kills * (s.skills.combat / 4 + .5) * share * 8 / 4;
    kills += k; ammo += k * w.ammo; ammoLeft -= k * w.ammo; noise += w.noise;
  }
  return { kills, ammo, noise };
}
function farmYield(state: RegionState, zone: RegionZone, workers: number, hours: number) {
  const m = zone.measures;
  if (!m) return 0;
  const z = state.zones[zone.id];
  let ha = m.farm / 1e4;
  if (z.upgrades.includes('field')) ha += (m.open + (m.pasture ?? 0)) / 1e4;
  if (z.upgrades.includes('demolishField')) ha += (m.built ?? 0) * .3 / 1e4;
  const capacity = ha * CONTENT.yields.fieldFoodPerHaYear / 365 * season(state.day).farm;
  return Math.min(capacity, workers * 6 * season(state.day).farm * hours / Math.max(1, workers * R.workHours));
}
function fishYield(state: RegionState, z: RegionZoneState, workers: number) {
  const boats = state.stock.boat ?? 0;
  const winter = season(state.day).name === 'Vinter' ? .6 : 1;
  return Math.min(workers, boats * 2) * 3.5 * (z.upgrades.includes('fishing') ? 1.5 : 1) * winter;
}

// ------------------------------------------------------------------ the day

export function endDay(state0: RegionState, world: RegionWorld, orders: RegionOrder[]): { state: RegionState; report: RegionReport } {
  if (state0.gameOver) throw new Error('Spillet er over.');
  if (state0.event) throw new Error('Velg hva dere gjør med hendelsen først.');
  const state = clone(state0);
  const index = indexWorld(world);
  const lines: ReportLine[] = [];
  const noise: Record<string, number> = {};
  const used = new Set<string>();
  const guards: Record<string, number> = {};
  let killed = 0, foodMade = 0, waterMade = 0;
  const day = state.day;
  const rngFor = (key: string) => random(state.seed, day, key);
  const worked = new Set<string>();
  const heldToday = new Set<string>();

  for (const order of orders) {
    const crew = crewOf(state, order.survivorIds).filter(s => !used.has(s.id));
    if (crew.length !== order.survivorIds.length) { lines.push({ tone: 'warn', title: `${ACTIONS[order.action].label} ble ikke gjort`, text: 'Noen var allerede satt på et annet oppdrag.' }); continue; }
    const preview = previewOrder(state, world, order);
    if (!preview.valid) { lines.push({ tone: 'warn', title: `${ACTIONS[order.action].label} ble ikke gjort`, text: preview.errors.join(' '), zoneId: order.zoneId }); continue; }
    for (const s of crew) used.add(s.id);
    const zone = index.byId.get(order.zoneId)!;
    const z = state.zones[order.zoneId];
    const rng = rngFor(order.id);
    const names = crew.map(s => s.name).join(', ');
    const hours = preview.hours;
    if (!['rest', 'heal'].includes(order.action)) for (const s of crew) { s.fatigue = Math.min(100, s.fatigue + 18); worked.add(s.id); }
    noise[order.zoneId] = (noise[order.zoneId] ?? 0) + ACTIONS[order.action].noise * crew.length;
    switch (order.action) {
      case 'scout': {
        const best = Math.max(...crew.map(s => s.skills.scouting));
        z.intel = { ...intelFor(z.zombies, best, rng), day };
        if (z.status === 'unknown') z.status = 'scouted';
        for (const near of index.adjacent.get(order.zoneId) ?? []) {
          const n = state.zones[near.to];
          if (n.status === 'unknown' && best >= 4) { n.status = 'scouted'; n.intel = { ...intelFor(n.zombies, best - 2, rng), day }; }
        }
        meetFactions(state, world, order.zoneId, lines);
        lines.push({ tone: 'info', title: `${zone.name} er speidet`, text: `${names}: om lag ${z.intel.min}–${z.intel.max} zombier.`, zoneId: zone.id });
        break;
      }
      case 'clear': {
        const k = estimateKills(state, crew, hours);
        const kills = Math.min(z.zombies, Math.round(k.kills));
        const ammo = Math.ceil(k.ammo * (kills / Math.max(1, k.kills)));
        add(state.stock, 'ammo', -ammo);
        z.zombies -= kills; killed += kills;
        noise[order.zoneId] += Math.round(k.noise * (ammo ? 1 : .3));
        z.intel = { min: Math.max(0, z.zombies - 2), max: z.zombies + 2, day };
        if (z.status === 'unknown') z.status = 'scouted';
        const danger = (z.zombies + kills) / Math.max(1, k.kills);
        hurt(state, crew, danger > 1.5 ? Math.min(40, (danger - 1) * 8) : danger > .8 ? 4 : 0, rng, lines, zone.name);
        lines.push({ tone: kills ? 'good' : 'info', title: `${kills} zombier drept i ${zone.name}`, text: `${names}${ammo ? `, ${ammo} patroner brukt` : ''}. ${z.zombies ? `Om lag ${z.zombies} igjen.` : 'Sonen ser tom ut.'}`, zoneId: zone.id });
        break;
      }
      case 'search': {
        const total = searchHoursTotal(zone);
        const progress = Math.min(hours, total - z.searched);
        const share = progress / Math.max(1, total - z.searched);
        z.searched += progress;
        const capacity = crew.length * R.carryPerPerson;
        const found: Stock = {};
        let carried = 0;
        // Most valuable per kilo first; what does not fit stays for the next trip.
        for (const [id, left] of Object.entries(z.loot).sort((a, b) => (VALUE[b[0]] ?? 1) / weight(b[0]) - (VALUE[a[0]] ?? 1) / weight(a[0]))) {
          const wanted = Math.floor(left * share + rng());
          const room = weight(id) ? Math.floor((capacity - carried) / weight(id)) : wanted;
          const n = Math.max(0, Math.min(wanted, room));
          if (!n) continue;
          found[id] = n; z.loot[id] = left - n; carried += n * weight(id);
          add(state.stock, id, n);
        }
        const danger = z.zombies / Math.max(1, crew.length * 4);
        hurt(state, crew, danger > 1 ? Math.min(35, danger * 6) : danger > .3 ? 3 : 0, rng, lines, zone.name);
        if (z.zombies && danger > .2) { const lost = Math.min(z.zombies, Math.round(crew.length * rng() * 2)); z.zombies -= lost; killed += lost; }
        lines.push({ tone: 'good', title: `Søk i ${zone.name}`, text: `${names} fant ${Object.entries(found).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(', ') || 'lite av verdi'}. ${Math.round(z.searched / total * 100)} % gjennomsøkt.`, zoneId: zone.id });
        if ((zone.measures?.homes ?? 0) > 5 && rng() < progress * R.recruitChancePerSearchHour) recruit(state, lines, `${names} fant en overlevende som gjemte seg i ${zone.name}.`, rng);
        break;
      }
      case 'claim': {
        killed += z.zombies; z.zombies = 0; z.status = 'controlled';
        z.intel = { min: 0, max: 0, day };
        if (controlled(state).length === 1) state.homeZoneId = order.zoneId;
        lines.push({ tone: 'good', title: `${zone.name} er deres`, text: 'Sonen er overtatt. Hold grensene for å beholde den.', zoneId: zone.id });
        break;
      }
      case 'fortify': {
        const open = (index.adjacent.get(order.zoneId) ?? []).filter(a => a.kind === 'land' && state.zones[a.to]?.status !== 'controlled' && !(state.barricades[a.connId] > 0));
        const affordable = Math.min(open.length, Math.floor((state.stock.building ?? 0) / R.fortifyCost.building), Math.ceil(hours / 2));
        for (const a of open.slice(0, affordable)) state.barricades[a.connId] = R.barricadeDurability;
        add(state.stock, 'building', -affordable * R.fortifyCost.building);
        lines.push({ tone: 'good', title: `Sperringer i ${zone.name}`, text: `${affordable} av ${open.length} grenser er sperret.`, zoneId: zone.id });
        break;
      }
      case 'build': {
        const u = UPGRADE_COST[order.target!];
        if (z.building?.id !== order.target) { pay(state.stock, u.cost); z.building = { id: order.target!, hours: 0 }; }
        z.building!.hours += hours;
        if (z.building!.hours >= u.hours) {
          z.upgrades.push(order.target!);
          delete z.building;
          if (order.target === 'salvage') { add(state.stock, 'building', 40); add(state.stock, 'metal', 10); add(state.stock, 'parts', 6); }
          if (order.target === 'barricades') for (const a of index.adjacent.get(order.zoneId) ?? []) if (a.kind === 'land' && state.zones[a.to]?.status !== 'controlled') state.barricades[a.connId] = R.barricadeDurability * 2;
          lines.push({ tone: 'good', title: `${upgradeName(order.target!)} er ferdig i ${zone.name}`, text: CONTENT.upgrades.find(x => x.id === order.target)?.gives ?? '', zoneId: zone.id });
        } else lines.push({ tone: 'info', title: `Bygger ${upgradeName(order.target!).toLowerCase()} i ${zone.name}`, text: `${Math.round(z.building!.hours)} av ${u.hours} timer.`, zoneId: zone.id });
        break;
      }
      case 'establishHq': {
        pay(state.stock, { building: 6 });
        const poi = (index.poisByZone.get(order.zoneId) ?? []).find(p => p.role === 'hq');
        const type = CONTENT.hqTypes.find(t => t.id === poi?.hqType);
        state.hq = { zoneId: order.zoneId, type: type?.id ?? 'camp', modules: [...(type?.startsWith ?? [])] };
        state.homeZoneId = order.zoneId;
        lines.push({ tone: 'good', title: `HQ etablert: ${poi?.name ?? zone.name}`, text: type ? `${type.name}. Har fra start: ${type.startsWith.map(m => moduleName(m).toLowerCase()).join(', ')}.` : 'En enkel leir.', zoneId: zone.id });
        break;
      }
      case 'module': {
        const m = MODULE_COST[order.target!];
        const hq = state.hq!;
        if (hq.building?.id !== order.target) { pay(state.stock, m.cost); hq.building = { id: order.target!, hours: 0 }; }
        hq.building!.hours += hours;
        if (hq.building!.hours >= m.hours) { hq.modules.push(order.target!); delete hq.building; lines.push({ tone: 'good', title: `${moduleName(order.target!)} er ferdig`, text: CONTENT.modules.find(x => x.id === order.target)?.effect ?? '' }); }
        else lines.push({ tone: 'info', title: `Bygger ${moduleName(order.target!).toLowerCase()}`, text: `${Math.round(hq.building!.hours)} av ${m.hours} timer.` });
        break;
      }
      case 'network': {
        const l2 = zone.parentId!;
        const n = NETWORK_COST[order.target!];
        const key = `network:${l2}:${order.target}`;
        if (!state.counters[key]) pay(state.stock, n.cost);
        state.counters[key] = (state.counters[key] ?? 0) + hours;
        if (state.counters[key] >= n.hours) {
          (state.networks[l2] ??= []).push(order.target!);
          delete state.counters[key];
          lines.push({ tone: 'good', title: `${CONTENT.networks.find(x => x.id === order.target)?.name}nett i ${index.byId.get(l2)?.name}`, text: CONTENT.networks.find(x => x.id === order.target)?.gives ?? '' });
        } else lines.push({ tone: 'info', title: 'Bygger nett', text: `${Math.round(state.counters[key])} av ${n.hours} timer.` });
        break;
      }
      case 'guard': guards[order.zoneId] = (guards[order.zoneId] ?? 0) + crew.reduce((n, s) => n + s.skills.combat * 3, 0); break;
      case 'hold': state.chokepoints[order.target!] = 'held'; heldToday.add(order.target!); state.barricades[order.target!] = Math.max(state.barricades[order.target!] ?? 0, 15); break;
      case 'block': pay(state.stock, R.blockCost); state.chokepoints[order.target!] = 'blocked'; state.barricades[order.target!] = R.blockDurability;
        lines.push({ tone: 'good', title: `${world.links.find(l => l.id === order.target)?.name} er sperret`, text: 'Zombier må slite ned barrikaden.' }); break;
      case 'blow': pay(state.stock, R.blowCost); state.chokepoints[order.target!] = 'blown'; delete state.barricades[order.target!];
        lines.push({ tone: 'warn', title: `${world.links.find(l => l.id === order.target)?.name} er sprengt`, text: 'Forbindelsen er borte. Smellet hørtes over hele byen.' }); break;
      case 'farm': { const food = farmYield(state, zone, crew.length, hours); add(state.stock, 'food', food); foodMade += food; break; }
      case 'fish': { const food = fishYield(state, z, crew.length); add(state.stock, 'food', food); foodMade += food; if (rng() < .03) { add(state.stock, 'boat', -1); lines.push({ tone: 'bad', title: 'En båt gikk tapt', text: 'Været snudde mens dere var ute.' }); } break; }
      case 'rest': for (const s of crew) { s.fatigue = Math.max(0, s.fatigue - 50); s.health = Math.min(100, s.health + (state.hq?.modules.includes('medbay') ? 10 : 5)); } break;
      case 'heal': {
        const patients = living(state).filter(s => s.health < 80);
        const medic = Math.max(...crew.map(s => s.skills.medical));
        add(state.stock, 'medicine', -Math.max(1, patients.length));
        for (const p of patients) p.health = Math.min(100, p.health + (10 + medic * 4) * (state.hq?.modules.includes('medbay') ? 1.5 : 1));
        lines.push({ tone: 'good', title: 'Skadde behandlet', text: `${patients.map(p => p.name).join(', ') || 'Ingen'} fikk behandling.` });
        break;
      }
      case 'craft': {
        const recipe = craftRecipes(state).find(r => r.id === order.target)!;
        const times = Math.max(1, Math.min(Math.floor(hours / 4), ...Object.entries(recipe.cost).map(([id, n]) => Math.floor((state.stock[id] ?? 0) / n))));
        for (let i = 0; i < times; i++) { pay(state.stock, recipe.cost); for (const [id, n] of Object.entries(recipe.gives)) add(state.stock, id, n); }
        lines.push({ tone: 'good', title: recipe.name, text: `${times} ganger.` });
        break;
      }
    }
  }
  for (const s of living(state)) if (!worked.has(s.id)) { s.fatigue = Math.max(0, s.fatigue - 25); s.health = Math.min(100, s.health + 2); }
  // Held links lapse unless someone stands there again tomorrow.
  for (const [id, st] of Object.entries(state.chokepoints)) if (st === 'held' && !heldToday.has(id)) { state.chokepoints[id] = 'open'; delete state.barricades[id]; }

  // Where people live makes noise too.
  noise[state.homeZoneId] = (noise[state.homeZoneId] ?? 0) + Math.ceil(living(state).length / 3) + (state.hq?.modules.includes('heavyWorkshop') ? 2 : 0);

  // Zombie migration
  const migrated = migrate(state, world, noise, lines);

  // Night: zombies in held zones meet the defences.
  killed += nightDefence(state, world, guards, lines, rngFor('night'));

  // Production and needs
  const made = production(state, world, lines);
  foodMade += made.food; waterMade += made.water;
  const people = living(state).length;
  const eaten = Math.min(state.stock.food ?? 0, people * R.dailyFood);
  const drunk = Math.min(state.stock.water ?? 0, people * R.dailyWater);
  add(state.stock, 'food', -eaten); add(state.stock, 'water', -drunk);
  if (eaten < people) { for (const s of living(state)) s.health -= 8; state.morale += R.morale.hunger; lines.push({ tone: 'bad', title: 'Sult', text: 'Det var ikke mat nok til alle.' }); }
  if (drunk < people) { for (const s of living(state)) s.health -= 12; state.morale += R.morale.thirst; lines.push({ tone: 'bad', title: 'Tørst', text: 'Det var ikke vann nok til alle.' }); }
  if (season(day).name === 'Vinter') {
    const fuel = Math.ceil(people * R.winterFuelPerPerson);
    if ((state.stock.fuel ?? 0) >= fuel) add(state.stock, 'fuel', -fuel);
    else { state.morale -= 2; for (const s of living(state)) s.health -= 3; lines.push({ tone: 'bad', title: 'Kaldt', text: 'Det var ikke drivstoff til varme.' }); }
  }
  // Food without salt or depot spoils a little in summer.
  if (season(day).name === 'Sommer' && (state.stock.food ?? 0) > 60 && !state.hq?.modules.includes('depot')) add(state.stock, 'food', -Math.round((state.stock.food ?? 0) * .01));
  for (const s of living(state)) {
    if (s.health <= 0) { s.alive = false; s.health = 0; state.morale += R.morale.death; lines.push({ tone: 'bad', title: `${s.name} er død`, text: `${s.role}. Gruppen sørger.` }); }
  }
  state.morale = Math.max(0, Math.min(100, state.morale + (moraleTarget(state) - state.morale) * .12));

  state.day = day + 1;
  updateFactions(state, world, lines);
  checkMilestones(state, world, lines, foodMade);
  if (!living(state).length) state.gameOver = { day: state.day, reason: 'Alle i gruppen er døde.' };
  else if (state.morale <= 0) state.gameOver = { day: state.day, reason: 'Moralen brast. Gruppen gikk hver til sitt.' };
  if (!state.gameOver) {
    const event = pickEvent(state, world, random(state.seed, state.day, 'event'));
    if (event) { state.event = event; lines.push({ tone: 'warn', title: event.title, text: 'En hendelse krever et valg.' }); }
  }
  const report: RegionReport = { day: state.day, lines, food: { produced: Math.round(foodMade), eaten }, water: { produced: Math.round(waterMade), drunk }, zombiesMoved: migrated, killed };
  state.reports = [...state.reports.slice(-29), report];
  state.counters.killed = (state.counters.killed ?? 0) + killed;
  return { state, report };
}

const WEIGHT: Record<string, number> = { ammo: .05, primers: .01, medicine: .2, antibiotics: .1, batteries: .3, electronics: .5,
  radio: .5, salt: .5, explosives: .5, printer: 5, generator: 8, solar: 3, engine: 10, boat: 0 };
/** Carrying weight of one unit. Boats sail home and weigh nothing to carry. */
export const weight = (id: string) => WEIGHT[id] ?? 1;
/** Where morale settles when nothing special happens. Shocks (deaths, events) move it; this pulls it back. */
export function moraleTarget(state: RegionState) {
  const power = Object.values(state.networks).some(n => n.includes('power'));
  const mods = state.hq?.modules ?? [];
  const hurt = living(state).filter(s => s.health < 50).length;
  const recentDeaths = state.survivors.filter(s => !s.alive).length;
  return Math.max(10, Math.min(90, 45 + (power ? 10 : 0) + (mods.includes('kitchen') ? 5 : 0) + (mods.includes('refuge') ? 8 : 0)
    + (state.hq ? 5 : 0) + Math.min(10, controlled(state).length) - hurt * 4 - recentDeaths * 2
    - ((state.stock.food ?? 0) < living(state).length * 3 ? 10 : 0)));
}
export const upgradeName = (id: string) => CONTENT.upgrades.find(u => u.id === id)?.name ?? id;
export const moduleName = (id: string) => CONTENT.modules.find(m => m.id === id)?.name ?? id;

function hurt(state: RegionState, crew: RegionSurvivor[], amount: number, rng: () => number, lines: ReportLine[], place: string) {
  if (amount <= 0) return;
  for (const s of crew) {
    if (rng() < Math.min(.85, amount / 25)) {
      // Fights happen at the edge of a crowd: bad odds make injuries likely, but no single blow is unlimited.
      const harm = Math.min(40, Math.round((6 + amount * .6) * (.5 + rng())));
      s.health -= harm;
      lines.push({ tone: 'bad', title: `${s.name} ble skadet`, text: `I ${place}: ${harm} i skade.` });
    }
  }
}

export function recruit(state: RegionState, lines: ReportLine[], text: string, rng: () => number) {
  const capacity = 5 + (state.hq?.modules.includes('housing') ? 3 : 0) + (state.hq?.modules.includes('refuge') ? 3 : 0) + (state.hq ? 1 : 0);
  if (living(state).length >= capacity) { lines.push({ tone: 'info', title: 'Ikke plass til flere', text: 'Bygg boliger i HQ for å ta inn flere.' }); return; }
  const taken = new Set(state.survivors.map(s => s.name));
  const options = RECRUIT_POOL.filter(p => !taken.has(p.name));
  if (!options.length) return;
  const p = options[Math.floor(rng() * options.length)];
  state.survivors.push({ ...p, skills: { ...p.skills }, id: `r${state.day}-${state.survivors.length}`, joinedDay: state.day });
  state.morale = Math.min(100, state.morale + R.morale.recruit);
  lines.push({ tone: 'good', title: `${p.name} ble med`, text: `${text} ${p.role}: ${p.about}` });
}

function migrate(state: RegionState, world: RegionWorld, noise: Record<string, number>, lines: ReportLine[]) {
  const index = indexWorld(world);
  const zoneIds = index.l3.map(z => z.id).sort();
  const connections = index.connections.filter(c => !['blown', 'flooded'].includes(state.chokepoints[c.id] ?? 'open'));
  const simWorld: SimulationWorld = { zoneIds, reservoirIds: [], connections };
  const known = new Set(connections.map(c => c.id));
  const barriers = Object.fromEntries(Object.entries(state.barricades).filter(([id, d]) => known.has(id) && d > 0).map(([id, d]) => [id, { durability: Math.round(d) }]));
  const population = Object.fromEntries(zoneIds.map(id => [id, state.zones[id].zombies]));
  const orders = Object.entries(noise).filter(([id, n]) => n > 0 && state.zones[id]).map(([zoneId, n]) => ({ zoneId, noise: Math.round(n) }));
  const result = resolveDay(simWorld, { day: state.day, population, barriers }, orders, state.seed, R.migration);
  for (const id of zoneIds) state.zones[id].zombies = result.state.population[id];
  for (const [id, b] of Object.entries(result.state.barriers)) state.barricades[id] = b.durability;
  for (const id of result.report.breaches) {
    const name = world.links.find(l => l.id === id)?.name ?? 'En sperring';
    lines.push({ tone: 'bad', title: `${name} brøt sammen`, text: 'Zombier har slitt ned sperringen.' });
    if (state.chokepoints[id] === 'blocked') state.chokepoints[id] = 'open';
    delete state.barricades[id];
  }
  // NPC groups clear their own ground.
  for (const f of state.factions) state.zones[f.zoneId].zombies = 0;
  const intoOwned = result.movements.filter(m => state.zones[m.toId].status === 'controlled').reduce((n, m) => n + m.count, 0);
  if (intoOwned) lines.push({ tone: 'warn', title: `${intoOwned} zombier kom inn i områdene deres`, text: 'Lyd trekker dem til. Sperr grensene eller hold vakt.' });
  return result.report.moved;
}

function nightDefence(state: RegionState, world: RegionWorld, guards: Record<string, number>, lines: ReportLine[], rng: () => number) {
  const index = indexWorld(world);
  let killed = 0;
  const homeCombat = living(state).reduce((n, s) => n + s.skills.combat * (s.health > 40 ? 1.5 : .5), 0);
  for (const id of controlled(state)) {
    const z = state.zones[id];
    if (!z.zombies) continue;
    let defense = R.baseDefense + (guards[id] ?? 0);
    for (const u of z.upgrades) defense += UPGRADE_COST[u]?.defense ?? 0;
    if (id === state.homeZoneId) defense += homeCombat;
    if (state.hq?.zoneId === id) for (const m of state.hq.modules) defense += MODULE_COST[m]?.defense ?? 0;
    const k = Math.min(z.zombies, Math.round(defense));
    z.zombies -= k; killed += k;
    if (!z.zombies) continue;
    const name = index.byId.get(id)!.name;
    if (id === state.homeZoneId) {
      const victims = living(state).sort(() => rng() - .5).slice(0, Math.min(3, Math.ceil(z.zombies / 4)));
      for (const v of victims) v.health -= Math.min(45, z.zombies * R.injuryPerExcessZombie);
      state.morale -= 4;
      lines.push({ tone: 'bad', title: `Angrep i natt i ${name}`, text: `${z.zombies} zombier kom gjennom forsvaret. ${victims.map(v => v.name).join(', ')} ble skadet.`, zoneId: id });
      z.zombies = Math.max(0, z.zombies - victims.length * 2);
    } else if (z.zombies > 6) {
      z.status = 'scouted';
      z.intel = { min: z.zombies - 2, max: z.zombies + 3, day: state.day };
      state.morale -= 3;
      lines.push({ tone: 'bad', title: `${name} er tapt`, text: `${z.zombies} zombier tok over sonen. Rydd og ta den tilbake.`, zoneId: id });
    } else lines.push({ tone: 'warn', title: `Zombier i ${name}`, text: `${z.zombies} vandrer rundt i sonen. Hold vakt eller rydd.`, zoneId: id });
  }
  return killed;
}

function production(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  const index = indexWorld(world);
  let food = 0, water = 0;
  const winter = season(state.day).name === 'Vinter';
  const power = (l2?: string) => !!l2 && (state.networks[l2] ?? []).includes('power');
  for (const id of controlled(state)) {
    const z = state.zones[id];
    const l2 = index.byId.get(id)!.parentId;
    for (const u of z.upgrades) for (const [r, n] of Object.entries(UPGRADE_COST[u]?.daily ?? {})) {
      const amount = n * (u === 'greenhouse' && winter && !power(l2) ? .4 : 1) * (u === 'greenhouse' && power(l2) ? 1.3 : 1);
      add(state.stock, r, amount);
      if (r === 'food') food += amount; if (r === 'water') water += amount;
    }
  }
  if (state.hq) for (const m of state.hq.modules) for (const [r, n] of Object.entries(MODULE_COST[m]?.daily ?? {})) { add(state.stock, r, n); if (r === 'food') food += n; }
  for (const [l2, nets] of Object.entries(state.networks)) if (nets.includes('water')) { add(state.stock, 'water', 15); water += 15; void l2; }
  // Every zone you hold has rain barrels and taps that still drip.
  // Rain barrels at camp, and taps that still drip in every zone you hold.
  const small = 3 + controlled(state).length * 1.5;
  add(state.stock, 'water', small); water += small;
  void lines;
  return { food, water };
}

// ------------------------------------------------------------------ NPC groups and trade

function meetFactions(state: RegionState, world: RegionWorld, zoneId: string, lines: ReportLine[]) {
  const index = indexWorld(world);
  const near = new Set([zoneId, ...(index.adjacent.get(zoneId) ?? []).map(a => a.to)]);
  for (const f of state.factions) if (!f.known && near.has(f.zoneId)) {
    f.known = true;
    lines.push({ tone: 'good', title: `Kontakt med ${f.name}`, text: `${f.about} De vil ha ${f.wants.map(w => resourceName(w).toLowerCase()).join(', ')}.` });
  }
}
function updateFactions(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  const radio = (state.stock.radio ?? 0) >= 1 || state.hq?.modules.includes('radioRoom') || Object.values(state.networks).some(n => n.includes('comms'));
  for (const f of state.factions) {
    if (!f.known && radio && state.day % 5 === 0) { f.known = true; lines.push({ tone: 'good', title: `Radiokontakt med ${f.name}`, text: f.about }); }
    if (state.day % 7 === 0) for (const id of f.offers) add(f.stock, id, Math.round(60 / (VALUE[id] ?? 1)));
  }
  void world;
}
export function tradeValue(state: RegionState, faction: RegionFaction, give: Stock, take: Stock) {
  const worthGive = Object.entries(give).reduce((n, [id, k]) => n + k * (VALUE[id] ?? 1) * (faction.wants.includes(id) ? 1.3 : .7), 0) * (1 + faction.relation / 200);
  const worthTake = Object.entries(take).reduce((n, [id, k]) => n + k * (VALUE[id] ?? 1) * (faction.offers.includes(id) ? 1.1 : 1.6), 0);
  return { worthGive: Math.round(worthGive * 10) / 10, worthTake: Math.round(worthTake * 10) / 10, fair: worthGive >= worthTake && worthTake > 0 };
}
export function trade(state0: RegionState, factionId: string, give: Stock, take: Stock): { state: RegionState; message: string } {
  const state = clone(state0);
  const f = state.factions.find(x => x.id === factionId);
  if (!f || !f.known) throw new Error('Dere har ikke kontakt med gruppen.');
  if (f.relation <= -40) throw new Error(`${f.name} vil ikke handle med dere.`);
  if (f.tradedDay !== undefined && state.day - f.tradedDay < 3) throw new Error('De handler med dere igjen om noen dager.');
  if (!has(state.stock, give)) throw new Error('Dere har ikke det dere vil gi.');
  if (!has(f.stock, take)) throw new Error('De har ikke så mye.');
  const v = tradeValue(state, f, give, take);
  if (!v.fair) throw new Error(`De synes byttet er for dårlig: ${v.worthGive} mot ${v.worthTake}.`);
  for (const [id, n] of Object.entries(give)) { add(state.stock, id, -n); add(f.stock, id, n); }
  for (const [id, n] of Object.entries(take)) { add(f.stock, id, -n); add(state.stock, id, n); }
  f.tradedDay = state.day;
  f.relation = Math.min(100, f.relation + 3);
  state.counters.trades = (state.counters.trades ?? 0) + 1;
  if (!state.milestones.includes('trade')) state.milestones.push('trade');
  return { state, message: `Handel med ${f.name} er gjennomført.` };
}

// ------------------------------------------------------------------ milestones and score

function checkMilestones(state: RegionState, world: RegionWorld, lines: ReportLine[], foodMade: number) {
  const index = indexWorld(world);
  const owned = controlled(state);
  const reached = (id: string) => {
    switch (id) {
      case 'claimStart': return state.zones[state.startZoneId].status === 'controlled';
      case 'hq': return !!state.hq;
      case 'food': return foodMade > 0;
      case 'fiveZones': return owned.length >= 5;
      case 'contact': return state.factions.some(f => f.known);
      case 'trade': return (state.counters.trades ?? 0) > 0;
      case 'district': return [...index.children.entries()].some(([id, kids]) => index.byId.get(id)?.level === 2 && kids.every(k => state.zones[k]?.status === 'controlled'));
      case 'network': return Object.values(state.networks).some(n => n.length);
      case 'day60': return state.day >= 60;
    }
    return false;
  };
  for (const m of MILESTONES) if (!state.milestones.includes(m.id) && reached(m.id)) {
    state.milestones.push(m.id);
    state.morale = Math.min(100, state.morale + 2);
    lines.push({ tone: 'good', title: `Milepæl: ${m.title}`, text: m.text });
  }
}

export function score(state: RegionState) {
  return {
    day: state.day, alive: living(state).length, zones: controlled(state).length, milestones: state.milestones.length,
    morale: Math.round(state.morale), food: Math.round(state.stock.food ?? 0), killed: state.counters.killed ?? 0,
    trades: state.counters.trades ?? 0, gameOver: state.gameOver?.reason ?? null,
  };
}
