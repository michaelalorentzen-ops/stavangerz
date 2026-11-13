/**
 * Region game engine. Pure and deterministic: the same state, orders and seed give the same day.
 * Zombie movement uses the accounted migration in simulation-core: nobody appears from nowhere.
 */
import { resolveDay, type Connection, type SimulationWorld } from '../../../simulation-core/src/index';
import { CONTENT } from '../../../world-data/src/content';
import type {
  ActionId, ChokepointState, RegionFaction, RegionOrder, RegionReplayStage, RegionReplayZoneChange, RegionReport,
  RegionState, RegionMapSnapshot, RegionSurvivor, RegionTurnDecision, RegionWorld, RegionZone, RegionZoneState, ReportLine, Stock, ZoneStatus,
} from './types';
import { initializeCampaign, campaignAvatarId, enforceAvatarFate, advanceCampaignCommit, difficultyRules, type CampaignOptions } from './campaign';
import { crewPositionFor, type CrewMission } from './location';
import { ensureMobility, missionPreview, beginMission, advanceTravel, returnMission, loadCargo, unloadCargo, reserveMissionStores, cargoWeight, failEmptyMissions, completeLegacyReturns, localStock, missionStoreRequest, missionLoad, transmitMissionReports, carriedGearWeight } from './mobility';
import { reserveMissionRadio, communicationsStatus, shouldEscalateField, fieldMandate } from './communications';
import { centralCommunity, centralAvailablePopulation, regionalDay, regionalWorkDay, regionalSurvivorIds, regionalGuardFor, regionalOverrun, regionalL1 } from './administration';
import { observeDiscoveries, deliverDiscoveryReports, maintainDiscoveries, discoveryOrderPreview, executeDiscoveryOrder } from './discoveries';
import {
  GEAR_CATALOG, crewGearAway, departGear, discoverSearchGear, equippedGear, gearDamageMultiplier, gearWeapon, gearWorkMultiplier, gearStateFor,
  moveGearDepot, planGearForOrders, settleGearReturns, type GearPlan, type GearPreferences,
} from './gear';
import {
  ACTIONS, FACTIONS, LOOT_PER_HOME, LOOT_PER_SITE, MILESTONES, MODULE_COST, NETWORK_COST, R, RECRUIT_POOL, REGION_RULES_VERSION,
  SEASONS, START_CREW, UPGRADE_COST, VALUE, WEAPONS,
} from './rules';
import { forceEvent, pickEvent } from './events';
import { POP, REACTIONS, TIERS } from './systems';
import { lawMods, societyDay, totalPeople, trimWork } from './society';
import { checkPhase, checkVictory, mods, mutation, researchDay, researchRate, rot, tech } from './progress';
import { dailyFlows } from './economy';
import { discoverWonders, nextWonderLevel, WONDERS, wonderEffects, workOnWonder, wonderOperational, wonderCanAccess, wonderOrderError, wonderWorkCost } from './wonders';

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
/** Only status changes belong in replay: full world snapshots would bloat saves. */
const statusSnapshot = (state: RegionState): Record<string, ZoneStatus> =>
  Object.fromEntries(Object.entries(state.zones).map(([id, zone]) => [id, zone.status]));
function zoneStatusChanges(before: Record<string, ZoneStatus>, after: Record<string, ZoneStatus>): RegionReplayZoneChange[] {
  return Object.keys(after).filter(id => before[id] !== undefined && before[id] !== after[id]).sort().map(zoneId => ({
    zoneId, before: before[zoneId], after: after[zoneId],
  }));
}
export const living = (state: RegionState) => state.survivors.filter(s => s.alive);
/** Crew at camp today, not away on an errand. */
export const present = (state: RegionState) => living(state).filter(s => {
  const position = crewPositionFor(state, s.id);
  return !s.left && !(s.awayUntil && s.awayUntil > state.day) && !crewGearAway(state, s.id)
    && position?.kind === 'zone' && position.zoneId === state.homeZoneId;
});
const add = (stock: Stock, id: string, amount: number) => { stock[id] = Math.max(0, Math.round(((stock[id] ?? 0) + amount) * 10) / 10); };
export const has = (stock: Stock, cost: Record<string, number>) => Object.entries(cost).every(([id, n]) => (stock[id] ?? 0) >= n);
const pay = (stock: Stock, cost: Record<string, number>) => { for (const [id, n] of Object.entries(cost)) add(stock, id, -n); };
export const costText = (cost: Record<string, number>) => Object.entries(cost).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(', ');
const EXTRA_NAMES: Record<string, string> = { samples: 'Zombieprøver' };
export const resourceName = (id: string) => CONTENT.resources.find(r => r.id === id)?.name ?? EXTRA_NAMES[id] ?? id;

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

function initialRegionGame(world: RegionWorld, startZoneId: string, seed = 2026, options?: CampaignOptions): RegionState {
  const index = indexWorld(world);
  if (!index.adjacent.has(startZoneId)) throw new Error(`Ukjent startsone ${startZoneId}`);
  const zones: Record<string, RegionZoneState> = {};
  for (const zone of index.l3) {
    const rng = random(seed, 0, zone.id);
    const ha = (zone.measures?.m2 ?? 0) / 1e4;
    const zombies = Math.round(residents(zone) * R.zombieShare * (.6 + .8 * rng()) + ha * .04 * rng());
    zones[zone.id] = { zombies, status: 'unknown', searched: 0, loot: initialLoot(world, zone), upgrades: [] };
  }
  // You start where you were when it happened. In a dense centre most of the dead are still there.
  const start = zones[startZoneId];
  start.zombies = Math.round(start.zombies * R.startZombieShare);
  start.status = 'scouted';
  start.intel = { min: start.zombies, max: start.zombies, day: 0 };
  for (const near of index.adjacent.get(startZoneId)!) {
    const z = zones[near.to];
    z.status = 'scouted';
    z.intel = intelFor(z.zombies, 2, random(seed, 0, `intel:${near.to}`));
  }
  const hops = distances(world, [startZoneId], () => true, 99);
  const factions: RegionFaction[] = [];
  const taken = new Set<string>([startZoneId]);
  for (const def of FACTIONS) {
    const min = def.minHops ?? 4;
    const options = world.pois.filter(p => p.role === 'hq' && p.hqType === def.hqType && !taken.has(p.zoneId) && (hops.get(p.zoneId) ?? 99) >= min && (hops.get(p.zoneId) ?? 99) < 99)
      .sort((a, b) => (hops.get(a.zoneId) ?? 99) - (hops.get(b.zoneId) ?? 99));
    const fallback = def.hostile || def.masked
      ? [...hops.entries()].filter(([id, d]) => d >= min && d <= min + 4 && !taken.has(id) && (index.byId.get(id)?.measures?.homes ?? 0) > 20).map(([id]) => ({ zoneId: id, name: index.byId.get(id)!.name }))
      : [];
    const place = options[Math.min(1, options.length - 1)] ?? fallback[Math.floor(random(seed, 0, def.id)() * fallback.length)];
    if (!place) continue;
    taken.add(place.zoneId);
    const rng = random(seed, 0, `faction:${def.id}`);
    const stock: Stock = {};
    for (const id of def.offers) add(stock, id, Math.round(400 / (VALUE[id] ?? 1)));
    factions.push({ id: def.id, name: `${def.name} (${place.name})`, zoneId: place.zoneId, about: def.about, offers: def.offers, wants: def.wants, stock,
      relation: def.hostile ? -30 : 0, known: false, strength: Math.round((def.hostile ? 34 : 22) + rng() * 18), hostile: def.hostile,
      intent: def.masked ? (rng() < .7 ? 'betray' : 'honest') : 'honest' });
    zones[place.zoneId].owner = def.id;
    zones[place.zoneId].zombies = 0;
  }
  const state: RegionState = {
    schema: 'region-2', rulesVersion: REGION_RULES_VERSION, worldVersion: world.worldVersion, seed, day: 0,
    startZoneId, homeZoneId: startZoneId,
    survivors: START_CREW.map(s => ({ ...s, skills: { ...s.skills }, traits: [...(s.traits ?? [])], joinedDay: 0 })),
    stock: { ...R.startStock }, morale: R.morale.start, discontent: 5,
    population: { adults: 0, children: 0, elderly: 0, sick: 0 },
    work: { farm: 0, fish: 0, scavenge: 0, clear: 0, guard: 0, build: 0, research: 0 },
    laws: [], lawDay: -99, research: { done: [], progress: 0 }, phase: 1, phaseDay: 0, mutations: [],
    zones, barricades: {}, barricadeTier: {},
    chokepoints: Object.fromEntries(world.links.map(l => [l.id, 'open' as ChokepointState])),
    networks: {}, factions, scheduled: [], flags: {}, memory: [{ day: 0, text: `Dag null i ${index.byId.get(startZoneId)?.name}.` }],
    milestones: [], reports: [], counters: {},
  };
  if (options) { initializeCampaign(state, options); for (const zone of Object.values(state.zones)) for (const id of Object.keys(zone.loot)) zone.loot[id] = Math.max(0, Math.round(zone.loot[id] * difficultyRules(state).loot)); }
  // Where the dead are many, the first choice is how to get out.
  return state;
}

export function newRegionGame(world: RegionWorld, startZoneId: string, seed = 2026, options?: CampaignOptions): RegionState {
  const state = initialRegionGame(world, startZoneId, seed, options);
  if (startDangerForState(state, world).score >= 45) state.event = forceEvent(state, world, 'escape');
  return state;
}

/** The actual unowned neighbour chosen after deterministic faction placement. */
export function escapeRoute(state: RegionState, world: RegionWorld): StartDanger['escape'] {
  return (indexWorld(world).adjacent.get(state.homeZoneId) ?? []).map(a => a.to)
    .filter(id => !state.zones[id].owner)
    .map(zoneId => ({ zoneId, zombies: state.zones[zoneId].zombies }))
    .sort((a, b) => a.zombies - b.zombies)[0];
}
function startDangerForState(state: RegionState, world: RegionWorld): StartDanger {
  const zombies = state.zones[state.homeZoneId].zombies;
  const around = (indexWorld(world).adjacent.get(state.homeZoneId) ?? []).reduce((sum, edge) => sum + state.zones[edge.to].zombies, 0);
  const score = zombies + around * .06;
  return { score, level: dangerLevel(score), zombies, around, escape: escapeRoute(state, world) };
}
const dangerLevel = (score: number): StartDanger['level'] => score < 8 ? 'Rolig' : score < 20 ? 'Middels' : score < 45 ? 'Krevende' : score < 90 ? 'Svært krevende' : 'Nesten umulig';

export interface StartDanger { score: number; level: 'Rolig' | 'Middels' | 'Krevende' | 'Svært krevende' | 'Nesten umulig'; zombies: number; around: number; escape?: { zoneId: string; zombies: number } }
/** Without a seed: cheap map estimate. With a seed: exact initial state and escape route. */
export function startDanger(world: RegionWorld, zoneId: string, seed?: number): StartDanger {
  const index = indexWorld(world);
  const zone = index.byId.get(zoneId);
  if (!zone) return { score: 0, level: 'Rolig', zombies: 0, around: 0 };
  if (seed !== undefined) return startDangerForState(initialRegionGame(world, zoneId, seed), world);
  const zombies = residents(zone) * R.zombieShare * R.startZombieShare;
  const around = (index.adjacent.get(zoneId) ?? []).reduce((n, a) => n + residents(index.byId.get(a.to)!) * R.zombieShare, 0);
  const score = zombies + around * .06;
  const level = dangerLevel(score);
  const calm = (index.adjacent.get(zoneId) ?? []).map(a => ({ zoneId: a.to, zombies: Math.round(residents(index.byId.get(a.to)!) * R.zombieShare) })).sort((a, b) => a.zombies - b.zombies)[0];
  return { score, level, zombies: Math.round(zombies), around: Math.round(around), escape: calm };
}

function intelFor(zombies: number, scouting: number, rng: () => number) {
  const spread = Math.max(.08, .5 - scouting * .06);
  const min = Math.max(0, Math.floor(zombies * (1 - spread * rng())));
  const max = Math.ceil(zombies * (1 + spread * rng())) + (zombies ? 0 : Math.round(2 * rng()));
  return { min, max, day: 0 };
}

// ------------------------------------------------------------------ reach

/** Shortest hop counts from the sources, through land borders and open bridges and tunnels. */
export function distances(world: RegionWorld, sources: string[], passable: (a: Adjacent) => boolean, limit: number, boats = false, boatKm = R.boatReachKm) {
  const index = indexWorld(world);
  const result = new Map<string, number>(sources.map(s => [s, 0]));
  const queue = [...sources];
  while (queue.length) {
    const here = queue.shift()!;
    const d = result.get(here)!;
    if (d >= limit) continue;
    const next = (index.adjacent.get(here) ?? []).filter(passable).map(a => a.to);
    if (boats && index.coastal.has(here)) next.push(...boatNeighbours(world, here, boatKm));
    for (const to of next) if (!result.has(to)) { result.set(to, d + 1); queue.push(to); }
  }
  return result;
}
const boatCache = new WeakMap<RegionWorld, Map<string, string[]>>();
function boatNeighbours(world: RegionWorld, zoneId: string, km: number) {
  let cache = boatCache.get(world);
  if (!cache) { cache = new Map(); boatCache.set(world, cache); }
  const key = `${zoneId}:${km}`;
  if (!cache.has(key)) {
    const index = indexWorld(world);
    const here = index.byId.get(zoneId)!.at!;
    const dist = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 57.4, (a[1] - b[1]) * 111.2);
    cache.set(key, [...index.coastal].filter(id => id !== zoneId && dist(index.byId.get(id)!.at!, here) <= km));
  }
  return cache.get(key)!;
}
/** Zones the group can reach today, with hop counts from what they hold. */
export function reach(state: RegionState, world: RegionWorld) {
  const sources = [...new Set([...controlled(state), state.homeZoneId])];
  return distances(world, sources, a => !a.linkId || !['blown', 'flooded'].includes(state.chokepoints[a.linkId]), R.reachHops,
    (state.stock.boat ?? 0) >= 1, tech(state, 'ferry') ? R.ferryReachKm : R.boatReachKm);
}

// ------------------------------------------------------------------ fighting numbers

function crewOf(state: RegionState, ids: string[], field = false) { return state.survivors.filter(s => ids.includes(s.id) && s.alive && !s.left && !(s.awayUntil && s.awayUntil > state.day) && (field || !crewGearAway(state, s.id))); }
const efficiency = (state: RegionState, s: RegionSurvivor) => Math.max(.3, (s.fatigue > 80 ? .6 : 1) * (s.health < 50 ? .7 : 1) * (.8 + state.morale / 250));
function weaponKills(state: RegionState, weapon: RegionSurvivor['weapon']) {
  const w = WEAPONS[weapon];
  if (weapon !== 'melee') return w.kills;
  return w.kills * (tech(state, 'forgedMelee') ? 1.3 : 1) * (tech(state, 'crossbows') ? 1.25 : 1);
}
export function estimateKills(state: RegionState, crew: RegionSurvivor[], hours: number) {
  let kills = 0, ammo = 0, noise = 0;
  let ammoLeft = state.stock.ammo ?? 0;
  const share = hours / Math.max(1, crew.length * R.workHours);
  const tough = 1 / mutation(state, 'tough', 1.25);
  for (const s of crew) {
    let weapon = gearWeapon(state, s);
    const k0 = weaponKills(state, weapon) * (s.skills.combat / 4 + .5) * share * 2;
    if (WEAPONS[weapon].ammo && ammoLeft < k0 * WEAPONS[weapon].ammo) weapon = 'melee';
    const k = weaponKills(state, weapon) * (s.skills.combat / 4 + .5) * share * 2 * tough;
    kills += k; ammo += k * WEAPONS[weapon].ammo; ammoLeft -= k * WEAPONS[weapon].ammo;
    noise += WEAPONS[weapon].noise * (weapon === 'melee' && tech(state, 'crossbows') ? .5 : 1);
  }
  return { kills, ammo, noise };
}
/** Best perimeter tier you know how to build. */
export function bestTier(state: RegionState) { return [...TIERS].reverse().find(t => !t.tech || tech(state, t.tech))!; }
export function assaultOdds(state: RegionState, crew: RegionSurvivor[], faction: RegionFaction) {
  const ammoEach = 5;
  const armed = (state.stock.ammo ?? 0) >= crew.length * ammoEach;
  const power = crew.reduce((n, s) => n + s.skills.combat * 3 + weaponKills(state, armed ? gearWeapon(state, s) : 'melee') * 2, 0)
    * (tech(state, 'drill') ? 1.3 : 1) * (tech(state, 'armour') ? 1.15 : 1) * (armed ? 1.2 : 1);
  const enemy = faction.strength ?? 30;
  return { power: Math.round(power), enemy, chance: Math.max(.05, Math.min(.95, .5 + (power - enemy) / (enemy * 1.6))), ammo: armed ? crew.length * ammoEach : 0 };
}

// ------------------------------------------------------------------ previews

export interface OrderPreview { valid: boolean; errors: string[]; hours: number; costs: Record<string, number>; risk: 'Lav' | 'Middels' | 'Høy' | 'Ukjent'; text: string }

export function hqModules(state: RegionState): string[] {
  if (!state.hq) return [];
  const type = CONTENT.hqTypes.find(t => t.id === state.hq!.type);
  const generic = ['kitchen', 'medbay', 'gate', 'workshop', 'ammoLab', 'housing', 'greenhouse', 'watchtower', 'radioRoom', 'depot', 'walls', 'classroom'];
  const coastal = ['dock', 'saltworks'];
  const late = state.phase >= 3 ? ['lab', 'refuge'] : [];
  const list = [...generic, ...coastal, ...late, ...(type ? [type.unique] : [])];
  return [...new Set(list)].filter(m => !state.hq!.modules.includes(m) && MODULE_COST[m]);
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
/** Borders the fortify order would build or raise to the best tier. */
function fortifyTargets(state: RegionState, world: RegionWorld, zoneId: string) {
  const tier = bestTier(state).tier;
  return (indexWorld(world).adjacent.get(zoneId) ?? []).filter(a => a.kind === 'land' && state.zones[a.to]?.status !== 'controlled'
    && (!(state.barricades[a.connId] > 0) || (state.barricadeTier[a.connId] ?? 1) < tier));
}

/** Same planner powers UI reservation and authoritative departure. No mutation or LLM. */
export function prepareGearPlan(state: RegionState, world: RegionWorld, orders: readonly RegionOrder[], preferences: GearPreferences = {}): GearPlan {
  const budgetState: RegionState = { ...state, stock: { ...state.stock }, mobility: state.mobility ? { ...state.mobility, depots: clone(state.mobility.depots) } : undefined };
  return planGearForOrders(state, world, orders, preferences, (order, gear) => {
    budgetState.gear = gear;
    const preview = previewOrder(budgetState, world, order, { gearPrepared: true });
    if (preview.errors.length) return preview.errors;
    const movement = missionPreview(budgetState, world, order, preview.costs);
    if (movement.errors.length) return movement.errors;
    const source = localStock(budgetState, movement.originZoneId);
    const manifest = missionLoad(budgetState, order, preview.costs).reservations;
    for (const [id, amount] of Object.entries(manifest)) if ((source[id] ?? 0) < amount) return ['Tidligere ordre har allerede reservert denne lasten.'];
    for (const [id, amount] of Object.entries(manifest)) source[id] = (source[id] ?? 0) - amount;
    if (movement.boatRequired) source.boat = Math.max(0, (source.boat ?? 0) - 1);
    return [];
  });
}

export function previewOrder(state0: RegionState, world: RegionWorld, order: Omit<RegionOrder, 'id'>, internal: { gearPrepared?: boolean; field?: boolean } = {}): OrderPreview {
  // A standalone preview gets exactly the suggested/manual gear for that order.
  // The day resolver already prepared the entire plan in reservation order.
  const plan = internal.gearPrepared ? undefined : prepareGearPlan(state0, world, [{ ...order, id: 'preview' }]);
  const state = plan ? { ...state0, gear: plan.gear } : state0;
  const index = indexWorld(world);
  const errors: string[] = [...(plan?.errors ?? [])];
  const crew = crewOf(state, order.survivorIds, true);
  const zone = index.byId.get(order.zoneId);
  const z = state.zones[order.zoneId];
  const movement = missionPreview(state, world, { ...order, id: 'preview-route' });
  const hops = movement.routeZoneIds.length ? Math.max(0, movement.routeZoneIds.length - 1) : undefined;
  let costs: Record<string, number> = {};
  let text = '';
  let risk: OrderPreview['risk'] = 'Lav';
  if (!crew.length) errors.push('Velg minst én person.');
  if (crew.length !== order.survivorIds.length) errors.push('Noen er borte på oppdrag.');
  if (crew.some(s => s.health < 25 && !['rest', 'heal'].includes(order.action))) errors.push('Noen er for skadet til å jobbe. La dem hvile.');
  if (!zone || !z) return { valid: false, errors: ['Ukjent sone.'], hours: 0, costs, risk, text };
  const faction = state.factions.find(f => f.zoneId === order.zoneId && !f.defeated);
  const wonderHere = Object.entries(state.wonders ?? {}).some(([id, w]) => w.zoneId === order.zoneId && WONDERS.find(d => d.id === id)?.found === 'event');
  if (hops === undefined && order.action === 'wonder' && wonderHere) { /* a ship or a plane is yours wherever it is */ }
  if (faction && !['scout', 'assault'].includes(order.action) && !(order.action === 'wonder' && wonderCanAccess(state, order.target ?? '', order.zoneId))) errors.push('En annen gruppe holder denne sonen. Handle med dem, speid eller angrip.');
  if (hops === undefined && !['rest', 'heal', 'craft', 'module', 'research'].includes(order.action) && !(order.action === 'wonder' && wonderHere)) errors.push('Sonen er utenfor rekkevidde. Ta over soner nærmere først.');
  if (!internal.field && !movement.valid) errors.push(...movement.errors);
  const travel = (hops ?? 0) * R.hopHours * 2;
  const hours = Math.max(0, crew.reduce((n, s) => n + (internal.field ? R.workHours : movement.workHours) * efficiency(state, s) * gearWorkMultiplier(state, s.id, order.action), 0) * lawMods(state).workMult);
  const isControlled = z.status === 'controlled';
  const total = searchHoursTotal(zone);
  switch (order.action) {
    case 'travel': case 'return': case 'retrieve': case 'supply': case 'areaGuard':
      text = `${movement.travelHours} timer på åpen rute. Kapasitet ${movement.capacity}. ${movement.returnsToday ? 'Kan fullføres innen natt.' : 'Fortsetter neste døgn.'}`;
      if (order.action === 'areaGuard' && z.status !== 'controlled') errors.push('Områdevakt krever en kontrollert sone.');
      break;
    case 'investigate': case 'discoveryChoice': {
      const discovery = discoveryOrderPreview(state, world, order.zoneId, order.target ?? '', order.survivorIds, order.action === 'investigate' ? 'investigate' : 'choice');
      if (!discovery.ok) errors.push(discovery.reason ?? 'Sporet kan ikke undersøkes nå.');
      if (hours < discovery.hours) errors.push('Ikke nok arbeidstid på stedet.');
      costs = discovery.cost; text = `${discovery.hours} arbeidstimer ved sporet.`; break;
    }
    case 'scout': text = faction ? 'Ser på basen deres. Kan avsløre hva de egentlig vil.' : 'Gir et anslag over zombier og hva sonen har.'; break;
    case 'clear': {
      const kills = estimateKills(state, crew, hours);
      text = `Kan drepe om lag ${Math.round(kills.kills)} zombier${kills.ammo ? ` og bruker om lag ${Math.ceil(kills.ammo)} patroner` : ''}.`;
      if (z.status === 'unknown' || !z.intel) risk = 'Ukjent';
      else {
        const known = (z.intel.min + z.intel.max) / 2;
        risk = known > kills.kills * 2 ? 'Høy' : known > kills.kills ? 'Middels' : 'Lav';
      }
      break;
    }
    case 'search': {
      const left = Math.max(0, total - z.searched);
      text = left ? `Gjennomsøker om lag ${Math.round(Math.min(100, hours / total * 100))} % av sonen. ${Math.round(z.searched / total * 100)} % er gjort.` : 'Sonen er allerede gjennomsøkt.';
      if (!left) errors.push('Ingenting igjen å søke gjennom.');
      if (z.status === 'unknown' || !z.intel) risk = 'Ukjent';
      else risk = z.intel.max > crew.length * 6 ? 'Høy' : z.intel.max > crew.length * 2 ? 'Middels' : 'Lav';
      break;
    }
    case 'claim': {
      // Territorial continuity follows controlled territory, not where this particular crew stands.
      const territoryHops = reach(state, world).get(order.zoneId);
      const nearOwned = controlled(state).length === 0 ? order.zoneId === state.homeZoneId : (territoryHops ?? 9) <= 1;
      if (!nearOwned) errors.push(controlled(state).length ? 'Sonen må grense til en sone dere eier.' : 'Den første sonen dere tar over, må være der leiren er. Flytt leiren først om dere vil et annet sted.');
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
      const targets = fortifyTargets(state, world, order.zoneId);
      const tier = bestTier(state);
      costs = Object.fromEntries(Object.entries(tier.cost).map(([id, n]) => [id, n * targets.length]));
      if (!targets.length) errors.push(`Alle grensene mot land har ${tier.name.toLowerCase()} eller er eid.`);
      text = `${tier.name} på ${targets.length} grenser (holder om lag ${tier.durability} angrep hver).`;
      break;
    }
    case 'build': {
      if (state.phase < 2) errors.push('Soneutbygging åpnes i fase 2.');
      if (!isControlled) errors.push('Bygg bare i soner dere eier.');
      const u = UPGRADE_COST[order.target ?? ''];
      if (!u || !upgradesFor(state, world, order.zoneId).some(x => x.id === order.target)) errors.push('Kan ikke bygges her.');
      else { costs = z.building?.id === order.target ? {} : u.cost; text = `${Math.round(Math.min(hours, u.hours - (z.building?.id === order.target ? z.building?.hours ?? 0 : 0)))} av ${u.hours} arbeidstimer. Byggelaget hjelper til.`; }
      break;
    }
    case 'establishHq': {
      if (state.hq) errors.push('Dere har allerede et HQ.');
      if (Object.values(state.administration?.regions ?? {}).some(region => region.hqZoneId === order.zoneId)) errors.push('Velg et annet hoved-HQ eller omorganiser regionen først.');
      if (!isControlled) errors.push('Ta over sonen først.');
      costs = { building: 6 };
      const poi = (index.poisByZone.get(order.zoneId) ?? []).find(p => p.role === 'hq');
      text = poi ? `${poi.name} blir HQ: ${CONTENT.hqTypes.find(t => t.id === poi.hqType)?.name ?? ''}.` : 'En enkel leir blir HQ. Den har ingen unik modul eller spesialisering.';
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
      if (state.phase < 3) errors.push('Områdenettverk åpnes i fase 3.');
      const l2 = zone.parentId ?? '';
      const n = NETWORK_COST[order.target ?? ''];
      if (!n) { errors.push('Ukjent nett.'); break; }
      if ((state.networks[l2] ?? []).includes(order.target!)) errors.push('Nettet finnes allerede.');
      if (!isControlled) errors.push('Bygg fra en sone dere eier.');
      const facilities = (index.children.get(l2) ?? []).flatMap(id => (index.poisByZone.get(id) ?? []).filter(p => n.facility?.includes(p.facilityType ?? '') && state.zones[id]?.status === 'controlled'));
      const radioRoom = order.target === 'comms' && state.hq?.modules.includes('radioRoom');
      const solar = order.target === 'power' && tech(state, 'solarGrid');
      const enoughZones = (index.children.get(l2) ?? []).filter(id => state.zones[id]?.status === 'controlled').length >= 3;
      if (n.facility && !facilities.length && !radioRoom && !solar) errors.push(`Krever: ${n.needs}. Anlegget må være i en sone dere eier.`);
      if (!n.facility && !enoughZones) errors.push('Eie minst tre soner i området.');
      costs = solar ? Object.fromEntries(Object.entries(n.cost).map(([id, k]) => [id, Math.ceil(k / 2)])) : n.cost;
      text = `${n.hours} arbeidstimer. ${CONTENT.networks.find(x => x.id === order.target)?.gives ?? ''}`;
      break;
    }
    case 'guard': if (!isControlled) errors.push('Hold vakt i soner dere eier.'); text = 'Mer forsvar i natt.'; break;
    case 'hold': case 'block': case 'blow': case 'repair': {
      const link = world.links.find(l => l.id === order.target);
      if (!link || (link.a !== order.zoneId && link.b !== order.zoneId)) { errors.push('Velg en bru eller tunnel fra sonen.'); break; }
      const st = state.chokepoints[link.id];
      if (order.action === 'repair') {
        if (!tech(state, 'bridgeRepair')) errors.push('Krever forskningen Brubygging.');
        if (st !== 'blown' || link.kind !== 'bridge') errors.push('Bare sprengte bruer kan bygges opp igjen.');
        if (!state.counters[`repair:${link.id}`]) costs = { metal: 20, building: 30 };
        text = `${Math.round(state.counters[`repair:${link.id}`] ?? 0)} av 60 arbeidstimer. Byggelaget hjelper til.`;
        break;
      }
      if (st === 'blown' || st === 'flooded') errors.push('Forbindelsen er borte.');
      if (order.action === 'block') costs = { ...R.blockCost };
      if (order.action === 'blow') {
        costs = { ...R.blowCost };
        if (!crew.some(s => s.skills.craft >= 3 || s.skills.combat >= 5)) errors.push('Krever en med håndverk 3 eller kamp 5.');
      }
      text = order.action === 'hold' ? 'Vakter på forbindelsen. Må gjentas hver dag.' : order.action === 'block' ? 'Barrikade som zombier må slite ned.' : link.kind === 'tunnel' ? 'Tunnelen raser sammen for godt.' : 'Brua faller. Med forskning kan den bygges opp igjen.';
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
    case 'heal': costs = { medicine: Math.max(1, patientsInZone(state, order.zoneId).length) }; text = 'Behandler skadde som faktisk er i denne sonen.'; break;
    case 'craft': {
      const recipe = craftRecipes(state).find(r => r.id === order.target);
      if (!recipe) errors.push('Ingen oppskrift tilgjengelig. Bygg ammoverksted, laboratorium eller forsk.');
      else { costs = recipe.cost; text = recipe.text; }
      break;
    }
    case 'research': {
      if (state.hq?.zoneId !== order.zoneId) errors.push('Forsk i HQ.');
      if (!state.research.current) errors.push('Velg et forskningsprosjekt under Forskning først.');
      const points = crew.reduce((n, s) => n + (s.skills.craft + s.skills.medical) / 2 * 1.2, 0) * hours / Math.max(1, crew.length * R.workHours);
      text = `Om lag ${Math.round(researchRate(state, points) - researchRate(state, 0))} forskningspoeng.`;
      break;
    }
    case 'relocate': {
      if (state.hq || controlled(state).length) errors.push('Dere har allerede et sted. Leiren flyttes ikke lenger.');
      if (order.zoneId === state.homeZoneId) errors.push('Leiren er her allerede.');
      const campHops = distances(world, [state.homeZoneId], a => !a.linkId || !['blown', 'flooded'].includes(state.chokepoints[a.linkId]), 2, (state.stock.boat ?? 0) >= 1, tech(state, 'ferry') ? R.ferryReachKm : R.boatReachKm).get(order.zoneId);
      if (movement.originZoneId !== state.homeZoneId) errors.push('Felles leirflytting må starte med laget i den nåværende leiren.');
      if (campHops === undefined || campHops > 2) errors.push('For langt. Leiren kan flyttes inntil to soner fra nåværende leir.');
      const carry = present(state).length * R.carryPerPerson * 1.5;
      const load = Object.entries(state.stock).reduce((n, [id, k]) => n + k * weight(id), 0);
      const known = z.intel ? z.intel.max : z.zombies;
      risk = known > 20 ? 'Høy' : known > 6 ? 'Middels' : 'Lav';
      text = load > carry ? `Dere kan bære om lag ${Math.round(carry / load * 100)} % av lageret. Resten blir igjen.` : 'Dere får med alt.';
      break;
    }
    case 'wonder': {
      const w = state.wonders?.[order.target ?? ''];
      const next = nextWonderLevel(state, order.target ?? '');
      const def = WONDERS.find(d => d.id === order.target);
      if (!w || !def) { errors.push('Dere har ikke dette stedet.'); break; }
      if (w.zoneId !== order.zoneId) errors.push('Arbeidet gjøres der stedet er.');
      const installationError = wonderOrderError(state, order.target ?? '', order.zoneId);
      if (installationError) errors.push(installationError);
      if (!next) { errors.push('Stedet er ferdig utbygd.'); break; }
      costs = wonderWorkCost(state, order.target ?? '');
      text = `«${next.name}»: ${Math.round(w.progress)} av ${next.hours} timer. ${next.text}`;
      break;
    }
    case 'assault': {
      if (!faction) { errors.push('Ingen gruppe her.'); break; }
      if (!faction.known) errors.push('Dere vet for lite om dem. Speid først.');
      if (!faction.hostile && state.phase < 3) errors.push('Tokt mot fredelige grupper er mulig fra fase 3.');
      if (crew.length < 3) errors.push('Send minst tre.');
      const odds = assaultOdds(state, crew, faction);
      text = `Deres styrke ${odds.power} mot deres ${odds.enemy}. Sjanse for seier om lag ${Math.round(odds.chance * 100)} %.${odds.ammo ? ` Bruker ${odds.ammo} patroner.` : ''}`;
      risk = odds.chance < .4 ? 'Høy' : odds.chance < .7 ? 'Middels' : 'Lav';
      break;
    }
  }
  if (!internal.field) errors.push(...missionPreview(state, world, { ...order, id: 'preview-load' }, costs).errors.filter(error => !errors.includes(error)));
  if (!has(internal.field ? state.stock : localStock(state, movement.originZoneId), costs)) errors.push(`Mangler: ${costText(Object.fromEntries(Object.entries(costs).filter(([id, n]) => (state.stock[id] ?? 0) < n)))}.`);
  if (hours <= 0 && !['rest', 'heal', 'relocate', 'travel', 'return', 'retrieve', 'supply', 'areaGuard'].includes(order.action)) errors.push('Ingen arbeidstid igjen etter reisen.');
  return { valid: !errors.length, errors, hours: Math.round(hours), costs, risk, text };
}

export function craftRecipes(state: RegionState) {
  const list: { id: string; name: string; cost: Record<string, number>; gives: Record<string, number>; text: string }[] = [];
  const m = state.hq?.modules ?? [];
  if (m.includes('ammoLab') || tech(state, 'reloading')) list.push({ id: 'ammo', name: 'Lad ammunisjon', cost: { primers: 1, metal: 1 }, gives: { ammo: 25 }, text: '1 tennhette og 1 metall blir 25 patroner.' });
  if (m.includes('lab')) list.push({ id: 'antibiotics', name: 'Lag antibiotika', cost: { medicine: 5, electronics: 1 }, gives: { antibiotics: 2 }, text: '5 medisin og 1 elektronikk blir 2 antibiotika.' });
  if (tech(state, 'penicillin')) list.push({ id: 'penicillin', name: 'Dyrk penicillin', cost: { food: 5, medicine: 2 }, gives: { antibiotics: 2 }, text: '5 mat og 2 medisin blir 2 antibiotika.' });
  if (m.includes('workshop')) list.push({ id: 'building', name: 'Lag byggemateriale av skrap', cost: { metal: 2, parts: 1 }, gives: { building: 8 }, text: '2 metall og 1 del blir 8 byggemateriale.' });
  if (m.includes('saltworks') || m.includes('kitchen')) list.push({ id: 'preserve', name: 'Salt og konserver mat', cost: { food: 10, salt: 2 }, gives: { food: 14 }, text: 'Konservert mat svinner ikke: 10 mat og 2 salt blir 14 mat.' });
  if (tech(state, 'spirit')) list.push({ id: 'spirit', name: 'Brenn sprit til sårvask', cost: { food: 8 }, gives: { medicine: 3 }, text: '8 mat blir 3 medisin.' });
  if (tech(state, 'woodGas')) list.push({ id: 'woodGas', name: 'Vedgass', cost: { building: 6 }, gives: { fuel: 4 }, text: '6 byggemateriale blir 4 drivstoff.' });
  if (tech(state, 'printing')) list.push({ id: 'print', name: 'Print reservedeler', cost: { electronics: 1, building: 2 }, gives: { parts: 3 }, text: '1 elektronikk og 2 byggemateriale blir 3 deler.' });
  if (tech(state, 'explosivesCraft')) list.push({ id: 'explosives', name: 'Lag sprengstoff', cost: { fuel: 6, salt: 2 }, gives: { explosives: 2 }, text: '6 drivstoff og 2 salt blir 2 sprengstoff.' });
  return list;
}

function farmYield(state: RegionState, zone: RegionZone, workers: number, hours: number) {
  const m = zone.measures;
  if (!m) return 0;
  const z = state.zones[zone.id];
  let ha = m.farm / 1e4;
  if (z.upgrades.includes('field')) ha += (m.open + (m.pasture ?? 0)) / 1e4;
  if (z.upgrades.includes('demolishField')) ha += (m.built ?? 0) * .3 / 1e4;
  const capacity = ha * CONTENT.yields.fieldFoodPerHaYear / 365 * season(state.day).farm * (tech(state, 'rotation') ? 1.3 : 1);
  return Math.min(capacity, workers * 6 * season(state.day).farm * hours / Math.max(1, workers * R.workHours));
}
function fishYield(state: RegionState, z: RegionZoneState, workers: number) {
  const boats = state.stock.boat ?? 0;
  const winter = season(state.day).name === 'Vinter' ? .6 : 1;
  return Math.min(workers, boats * 2) * 3.5 * (z.upgrades.includes('fishing') ? 1.5 : 1) * winter * (tech(state, 'fishery') ? 1.5 : 1);
}

// ------------------------------------------------------------------ the day

function runRegionDayOperations(state0: RegionState, world: RegionWorld, orders0: RegionOrder[], options: { avatarId?: string; resume?: boolean; choice?: 'proceed' | 'withdraw' } = {}): RegionState {
  if (state0.gameOver) throw new Error('Spillet er over.');
  if (state0.event) throw new Error('Velg hva dere gjør med hendelsen først.');
  if (state0.turnCheckpoint && !options.resume) throw new Error('Døgnet er allerede startet. Fortsett hendelsen før nye ordre.');
  const state = clone(state0);
  const index = indexWorld(world);
  const previous = options.resume ? state.turnCheckpoint : undefined;
  const context = previous?.operations;
  delete state.turnCheckpoint;
  ensureMobility(state);
  const lines: ReportLine[] = previous?.lines ?? [];
  // Return reconciliation may follow an event ending an existing awayUntil errand.
  settleGearReturns(state, lines);
  if (!context) state.mobility!.reservedAwayIds = [...new Set(orders0.filter(order => order.zoneId !== state.homeZoneId).flatMap(order => order.survivorIds))];
  const gearPlan = context ? undefined : prepareGearPlan(state, world, orders0);
  if (gearPlan) state.gear = gearPlan.gear;
  const activeOrders: RegionOrder[] = [];
  const noise: Record<string, number> = context?.noise ?? {};
  const used = new Set<string>(context?.used ?? []);
  const guards: Record<string, number> = previous?.guards ?? {};
  let killed = previous?.killed ?? 0, foodMade = previous?.foodMade ?? 0;
  if (!context) for (const mission of Object.values(state.crewMissions ?? {})) {
    if (mission.status === 'returning') { returnMission(state, world, mission, 15, lines); for (const id of mission.survivorIds) used.add(id); }
    else if (mission.status === 'outbound') {
      advanceTravel(state, world, mission, 15);
      if (mission.routeIndex === (mission.routeZoneIds?.length ?? 0) - 1 && mission.order) activeOrders.push(mission.order);
      else for (const id of mission.survivorIds) used.add(id);
    } else if (mission.status === 'working' && !mission.operationDone && mission.order) { mission.elapsedHours = 0; activeOrders.push(mission.order);
    } else if (mission.status === 'working' && mission.action === 'areaGuard') {
      const anchor = index.byId.get(mission.targetZoneId);
      const zones = mission.order?.logistics?.areaLevel === 2 ? index.l3.filter(z => z.parentId === anchor?.parentId) : [anchor];
      const power = mission.survivorIds.reduce((sum, id) => sum + (state.survivors.find(p => p.id === id && p.alive)?.skills.combat ?? 0) * 3, 0);
      for (const zone of zones) if (zone && state.zones[zone.id]?.status === 'controlled') guards[zone.id] = (guards[zone.id] ?? 0) + power / Math.max(1, zones.length);
      for (const id of mission.survivorIds) used.add(id);
    }
  }
  const orders = context?.orders ?? [...activeOrders, ...orders0];
  const day = state.day;
  const rngFor = (key: string) => random(state.seed, day, key);
  const worked = new Set<string>(context?.worked ?? []);
  const heldToday = new Set<string>(context?.heldToday ?? []);
  const law = lawMods(state);
  let crewResearch = previous?.crewResearch ?? 0;
  const initialZoneStatus = previous?.initialZoneStatus ?? statusSnapshot(state);
  const mainResources = () => ({ food: state.stock.food ?? 0, water: state.stock.water ?? 0 });

  for (const [orderIndex, order] of orders.entries()) {
    if (orderIndex < (context?.nextIndex ?? 0)) continue;
    const gearOrder = gearPlan?.orders.find(p => p.orderId === order.id);
    let mission = Object.values(state.crewMissions ?? {}).find(m => m.orderId === order.id && !['complete', 'failed'].includes(m.status));
    if (!mission && gearOrder?.errors.length) { lines.push({ tone: 'warn', title: `${ACTIONS[order.action].label} ble ikke gjort`, text: gearOrder.errors.join(' '), zoneId: order.zoneId }); continue; }
    const crew = crewOf(state, order.survivorIds, true).filter(s => !used.has(s.id));
    if (crew.length !== order.survivorIds.length) { lines.push({ tone: 'warn', title: `${ACTIONS[order.action].label} ble ikke gjort`, text: 'Noen var allerede satt på et annet oppdrag eller er borte.' }); continue; }
    const preview = previewOrder(mission ? { ...state, stock: mission.cargo ?? {} } : state, world, order, { gearPrepared: true, field: !!mission });
    if (!preview.valid) { lines.push({ tone: 'warn', title: `${ACTIONS[order.action].label} ble ikke gjort`, text: preview.errors.join(' '), zoneId: order.zoneId }); continue; }
    if (!mission) {
      mission = beginMission(state, world, order, preview.costs);
      reserveMissionStores(state, mission, preview.costs);
      reserveMissionRadio(state, mission);
      departGear(state, order);
      for (const id of mission.survivorIds) {
        if (state.gear?.missions[id]) state.gear.missions[id].returnDay = 1e9;
        for (const item of state.gear?.items ?? []) if (item.location.kind === 'carried' && item.location.survivorId === id) item.location = { ...item.location, missionId: mission.id, returnDay: 1e9 };
      }
      advanceTravel(state, world, mission, 15);
      if (mission.routeIndex !== (mission.routeZoneIds?.length ?? 0) - 1) { for (const id of mission.survivorIds) used.add(id); continue; }
    }
    mission.status = 'working';
    const critical = order.zoneId !== state.homeZoneId && ['scout', 'search', 'clear', 'assault', 'investigate', 'discoveryChoice'].includes(order.action)
      && state.zones[order.zoneId].zombies >= Math.max(8, crew.reduce((n, p) => n + p.skills.combat, 0) * 2);
    if (critical && !mission.encounterResolved) {
      const decisionChoice = context?.missionId === mission.id ? options.choice : undefined;
      if (!decisionChoice && shouldEscalateField(state, world, order, options.avatarId ?? context?.avatarId)) {
        const decision = { kind: 'field-encounter' as const, avatarId: options.avatarId ?? context?.avatarId ?? order.survivorIds[0], zoneId: order.zoneId, ammoRequired: 0, orderId: order.id, survivorIds: order.survivorIds,
          title: 'Laget møter alvorlig motstand', text: `${crew.map(p => p.name).join(', ')} har nådd målet. Fortsette oppdraget eller trekke seg ut med last og utstyr?`,
          choices: [{ id: 'proceed', label: 'Fortsett oppdraget', detail: 'Gjennomfør med faktisk risiko, ammunisjon og utstyr.' }, { id: 'withdraw', label: 'Trekk laget tilbake', detail: 'Avbryt før arbeidet utføres. Laget følger faktisk returrute.' }] };
        state.turnCheckpoint = { version: 1, day, worldVersion: world.worldVersion, stage: 'before-field-order', lines, guards, guardPower: 0, killed, foodMade, crewResearch, migrated: 0, moves: [], initialZoneStatus, operationsLineEnd: lines.length, operationsZoneStatus: statusSnapshot(state), operationsResources: mainResources(), decision,
          operations: { orders, nextIndex: orderIndex, used: [...used], worked: [...worked], heldToday: [...heldToday], noise, avatarId: options.avatarId ?? context?.avatarId, missionId: mission.id } };
        return state;
      }
      const choice = decisionChoice ?? fieldMandate(state, order);
      mission.encounterResolved = true;
      if (choice === 'withdraw') { for (const id of mission.survivorIds) used.add(id); returnMission(state, world, mission, Math.max(0, 15 - (mission.elapsedHours ?? 0)), lines); continue; }
    }
    for (const s of crew) used.add(s.id);
    const zone = index.byId.get(order.zoneId)!;
    const z = state.zones[order.zoneId];
    const rng = rngFor(order.id);
    const names = crew.map(s => s.name).join(', ');
    const availableHours = Math.max(0, 15 - (mission.elapsedHours ?? 0));
    const hours = Math.min(preview.hours, (mission.workHours ?? R.workHours) * crew.length, availableHours * crew.length);
    if (hours <= 0 && !['travel', 'return', 'supply', 'retrieve', 'areaGuard'].includes(order.action)) { mission.operationDone = false; lines.push({ tone: 'info', category: 'travel', title: 'Arbeidet fortsetter neste døgn', text: 'Dagens operasjonsvindu gikk med til faktisk reise.', zoneId: order.zoneId }); continue; }
    const factionsBefore = Object.fromEntries(state.factions.map(f => [f.id, { known: f.known, revealed: f.revealed }]));
    const intelBefore = Object.fromEntries(Object.entries(state.zones).map(([id, z]) => [id, { status: z.status, intel: z.intel ? { ...z.intel } : undefined }]));
    let headquartersStock = state.stock;
    const headquartersZone = state.homeZoneId;
    const headquartersPopulation = centralAvailablePopulation(state);
    state.stock = mission.cargo ??= {};
    if (!['rest', 'heal'].includes(order.action)) for (const s of crew) { s.fatigue = Math.min(100, s.fatigue + (18 + law.fatigue) * difficultyRules(state).fatigue); worked.add(s.id); }
    noise[order.zoneId] = (noise[order.zoneId] ?? 0) + ACTIONS[order.action].noise * crew.length
      + crew.reduce((sum, person) => sum + (equippedGear(state, person.id, 'tool')?.noise ?? 0), 0);
    const operationLineStart = lines.length;
    const radioVerified = communicationsStatus({ ...state, stock: headquartersStock }, world, order.survivorIds).connected;
    const personalObservation = order.survivorIds.includes(options.avatarId ?? context?.avatarId ?? '');
    switch (order.action) {
      case 'travel': case 'return': break;
      case 'retrieve': loadCargo({ ...state, stock: headquartersStock }, mission, order.zoneId); break;
      case 'supply': unloadCargo({ ...state, stock: headquartersStock }, mission, order.zoneId, lines); state.stock = mission.cargo ??= {}; break;
      case 'areaGuard': break;
      case 'investigate': case 'discoveryChoice': {
        pay(state.stock, preview.costs);
        const linked = communicationsStatus({ ...state, stock: headquartersStock }, world, order.survivorIds).connected;
        const outcome = executeDiscoveryOrder(state, world, { zoneId: order.zoneId, target: order.target ?? '', crewIds: order.survivorIds, kind: order.action === 'investigate' ? 'investigate' : 'choice', hours, delivery: linked ? 'radio' : 'none', radioVerified: linked }, lines);
        for (const [id, amount] of Object.entries(outcome.cargo)) add(state.stock, id, amount);
        break;
      }
      case 'scout': {
        const best = Math.max(...crew.map(s => s.skills.scouting + (equippedGear(state, s.id, 'tool')?.scouting ?? 0)));
        const faction = state.factions.find(f => f.zoneId === order.zoneId && !f.defeated);
        if (faction) {
          // Scouting observes the actual grounds as well as the people holding them.
          z.intel = { ...intelFor(z.zombies, best, rng), day };
          if (z.status === 'unknown') z.status = 'scouted';
          faction.known = true;
          const sharp = crew.some(s => s.traits?.includes('suspicious')) ? .35 : 0;
          if (faction.intent === 'betray' && !faction.revealed && rng() < .3 + sharp + best * .03) {
            faction.revealed = true;
            lines.push({ tone: 'warn', title: `Noe stemmer ikke hos ${faction.name}`, text: `${names} så våpenlager, lister over navn og stjålne kjøretøy. De smiler ikke når de tror ingen ser.`, zoneId: zone.id });
          } else lines.push({ tone: 'info', title: `${names} så på ${faction.name}`, text: `Om lag ${Math.round((faction.strength ?? 30) / 3)} våpenføre. ${faction.intent === 'betray' && !faction.revealed ? 'Alt ser ryddig ut.' : faction.about}`, zoneId: zone.id });
          break;
        }
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
        const samples = Math.floor(kills / R.samplesPerKills + rng());
        if (samples) add(state.stock, 'samples', samples);
        lines.push({ tone: kills ? 'good' : 'info', facts: { action: 'clear', killed: kills, remainingMin: z.intel.min, remainingMax: z.intel.max }, title: `${kills} zombier drept i ${zone.name}`, text: `${names}${ammo ? `, ${ammo} patroner brukt` : ''}. ${z.zombies ? `Om lag ${z.zombies} igjen.` : 'Sonen ser tom ut.'}${samples ? ` ${samples} prøver tatt med hjem.` : ''}`, zoneId: zone.id });
        break;
      }
      case 'search': {
        const searchBefore = z.searched;
        const searchAfter = Math.min(searchHoursTotal(zone), z.searched + hours);
        const gearFound = discoverSearchGear(state, zone.id, searchBefore, searchAfter, searchHoursTotal(zone), order);
        const gearWeight = gearFound.reduce((sum, item) => sum + (GEAR_CATALOG[item.kind]?.weight ?? 0), 0);
        const found = searchZone(state, world, order.zoneId, hours, Math.max(0, crew.length * R.carryPerPerson - cargoWeight(state.stock) - carriedGearWeight(state, order.survivorIds)), rng);
        const total = searchHoursTotal(zone);
        const danger = z.zombies / Math.max(1, crew.length * 4);
        hurt(state, crew, danger > 1 ? Math.min(35, danger * 6) : danger > .3 ? 3 : 0, rng, lines, zone.name);
        if (z.zombies && danger > .2) { const lost = Math.min(z.zombies, Math.round(crew.length * rng() * 2)); z.zombies -= lost; killed += lost; }
        lines.push({ tone: 'good', facts: { action: 'search', searchBefore, searchAfter: z.searched, searchTotal: total }, title: `Søk i ${zone.name}`, text: `${names} fant ${stockText(found) || 'lite av verdi'}. ${Math.round(z.searched / total * 100)} % gjennomsøkt.`, zoneId: zone.id });
        if ((zone.measures?.homes ?? 0) > 5 && rng() < hours * R.recruitChancePerSearchHour) recruit(state, lines, `${names} fant noen som gjemte seg i ${zone.name}.`, rng, { zoneId: zone.id, missionId: mission.id });
        break;
      }
      case 'claim': {
        // A plan is allowed based on the crew's most recent estimate, but the actual
        // horde may have moved since then. A claim must never erase unseen zombies.
        if (z.zombies > R.claimMaxZombies) {
          const scouting = Math.max(...crew.map(s => s.skills.scouting));
          z.intel = { ...intelFor(z.zombies, scouting, rng), day };
          if (z.status === 'unknown') z.status = 'scouted';
          lines.push({ tone: 'warn', title: 'Overtakelsen ble stanset',
            text: `${names} fant flere zombier enn speiderrapporten antydet. Sonen må ryddes før den kan overtas.`, zoneId: zone.id });
          break;
        }
        const remaining = z.zombies;
        killed += remaining; z.zombies = 0; z.status = 'controlled';
        z.intel = { min: 0, max: 0, day };
        if (controlled(state).length === 1) state.homeZoneId = order.zoneId;
        lines.push({ tone: 'good', title: `${zone.name} er deres`, text: `${remaining ? `${remaining} gjenværende zombier ble slått ned. ` : ''}Sonen er overtatt. Hold grensene for å beholde den.`, zoneId: zone.id });
        break;
      }
      case 'fortify': {
        const tier = bestTier(state);
        const targets = fortifyTargets(state, world, order.zoneId);
        const affordable = Math.min(targets.length, Math.ceil(hours / 2), ...Object.entries(tier.cost).map(([id, n]) => Math.floor((state.stock[id] ?? 0) / n)));
        const durability = Math.round(tier.durability * (state.mutations.some(m => m.id === 'climbers' && m.known) ? 1.15 : 1));
        for (const a of targets.slice(0, affordable)) { state.barricades[a.connId] = durability; state.barricadeTier[a.connId] = tier.tier; }
        pay(state.stock, Object.fromEntries(Object.entries(tier.cost).map(([id, n]) => [id, n * affordable])));
        lines.push({ tone: 'good', title: `${tier.name} i ${zone.name}`, text: `${affordable} av ${targets.length} grenser er sperret.`, zoneId: zone.id });
        break;
      }
      case 'build': {
        const u = UPGRADE_COST[order.target!];
        if (z.building?.id !== order.target) { pay(state.stock, u.cost); z.building = { id: order.target!, hours: 0 }; }
        z.building!.hours += hours;
        finishZoneBuilding(state, world, order.zoneId, lines);
        break;
      }
      case 'establishHq': {
        pay(state.stock, { building: 6 });
        const poi = (index.poisByZone.get(order.zoneId) ?? []).find(p => p.role === 'hq');
        const type = CONTENT.hqTypes.find(t => t.id === poi?.hqType);
        state.hq = { zoneId: order.zoneId, type: type?.id ?? 'camp', modules: [...(type?.startsWith ?? [])].filter(m => MODULE_COST[m]) };
        state.flags.hqStartModules = state.hq.modules.length;
        // Changing the HQ address alone does not transport stored equipment.
        state.homeZoneId = order.zoneId;
        lines.push({ tone: 'good', title: `HQ etablert: ${poi?.name ?? zone.name}`, text: type ? `${type.name}. Har fra start: ${type.startsWith.map(m => moduleName(m).toLowerCase()).join(', ')}.` : 'En enkel leir.', zoneId: zone.id });
        break;
      }
      case 'module': {
        const m = MODULE_COST[order.target!];
        const hq = state.hq!;
        if (hq.building?.id !== order.target) { pay(state.stock, m.cost); hq.building = { id: order.target!, hours: 0 }; }
        hq.building!.hours += hours;
        finishModule(state, lines);
        break;
      }
      case 'network': {
        const l2 = zone.parentId!;
        const key = `network:${l2}:${order.target}`;
        if (!state.counters[key]) pay(state.stock, preview.costs);
        state.counters[key] = (state.counters[key] ?? 0) + hours;
        finishNetworks(state, world, lines);
        break;
      }
      case 'guard': guards[order.zoneId] = (guards[order.zoneId] ?? 0) + crew.reduce((n, s) => n + s.skills.combat * 3, 0) * (tech(state, 'watchRoutine') ? 1.4 : 1); break;
      case 'hold': state.chokepoints[order.target!] = 'held'; heldToday.add(order.target!); state.barricades[order.target!] = Math.max(state.barricades[order.target!] ?? 0, 15); break;
      case 'block': pay(state.stock, R.blockCost); state.chokepoints[order.target!] = 'blocked'; state.barricades[order.target!] = R.blockDurability;
        lines.push({ tone: 'good', title: `${world.links.find(l => l.id === order.target)?.name} er sperret`, text: 'Zombier må slite ned barrikaden.' }); break;
      case 'blow': pay(state.stock, R.blowCost); state.chokepoints[order.target!] = 'blown'; delete state.barricades[order.target!];
        lines.push({ tone: 'warn', title: `${world.links.find(l => l.id === order.target)?.name} er sprengt`, text: 'Forbindelsen er borte. Smellet hørtes over hele byen.' }); break;
      case 'repair': {
        const key = `repair:${order.target}`;
        if (!state.counters[key]) pay(state.stock, { metal: 20, building: 30 });
        state.counters[key] = (state.counters[key] ?? 0) + hours;
        finishRepairs(state, world, lines);
        break;
      }
      case 'farm': { const food = farmYield(state, zone, crew.length, hours); add(state.stock, 'food', food); foodMade += food; break; }
      case 'fish': { const food = fishYield(mission.transportBoat ? { ...state, stock: { ...state.stock, boat: (state.stock.boat ?? 0) + mission.transportBoat } } : state, z, crew.length); add(state.stock, 'food', food); foodMade += food; if (rng() < .03) { if (mission.transportBoat) mission.transportBoat -= 1; else add(state.stock, 'boat', -1); lines.push({ tone: 'bad', title: 'En båt gikk tapt', text: 'Været snudde mens dere var ute.' }); } break; }
      case 'rest': for (const s of crew) { s.fatigue = Math.max(0, s.fatigue - 50); s.health = Math.min(100, s.health + (state.hq?.zoneId === order.zoneId && state.hq.modules.includes('medbay') ? 10 : 5)); } break;
      case 'heal': {
        const patients = patientsInZone(state, order.zoneId);
        const medic = Math.max(...crew.map(s => s.skills.medical + (equippedGear(state, s.id, 'tool')?.medical ?? 0)));
        add(state.stock, 'medicine', -Math.max(1, patients.length));
        for (const p of patients) p.health = Math.min(100, p.health + (10 + medic * 4) * (state.hq?.zoneId === order.zoneId && state.hq.modules.includes('medbay') ? 1.5 : 1) * (tech(state, 'fieldSurgery') ? 1.4 : 1));
        // A medic also works through the sick among the many.
        const region = Object.values(state.administration?.regions ?? {}).find(r => r.hqZoneId === order.zoneId);
        const localPopulation = order.zoneId === state.homeZoneId ? centralAvailablePopulation(state) : region?.residents ?? state.mobility?.depotResidents?.[order.zoneId];
        const cured = Math.min(localPopulation?.sick ?? 0, Math.floor(medic * 1.5));
        state.population.sick = Math.max(0, state.population.sick - cured);
        if (order.zoneId !== state.homeZoneId && localPopulation) localPopulation.sick = Math.max(0, localPopulation.sick - cured);
        lines.push({ tone: 'good', title: 'Skadde behandlet', text: `${patients.map(p => p.name).join(', ') || 'Ingen i crewet'} fikk behandling.${cured ? ` ${cured} syke ble friske.` : ''}` });
        break;
      }
      case 'craft': {
        const recipe = craftRecipes(state).find(r => r.id === order.target)!;
        const times = Math.max(1, Math.min(Math.floor(hours / 4), ...Object.entries(recipe.cost).map(([id, n]) => Math.floor((state.stock[id] ?? 0) / n))));
        for (let i = 0; i < times; i++) { pay(state.stock, recipe.cost); for (const [id, n] of Object.entries(recipe.gives)) add(state.stock, id, n); }
        lines.push({ tone: 'good', title: recipe.name, text: `${times} ganger.` });
        break;
      }
      case 'wonder': workOnWonder(state, order.target!, hours, lines, cost => pay(state.stock, cost)); moveShip(state, world); break;
      case 'research': crewResearch += crew.reduce((n, s) => n + (s.skills.craft + s.skills.medical) / 2 * 1.2, 0) * hours / Math.max(1, crew.length * R.workHours); break;
      case 'relocate': { state.stock = headquartersStock; relocate(state, world, order.zoneId, rng, lines); headquartersStock = state.stock; state.stock = mission.cargo ?? {}; mission.returnZoneId = state.homeZoneId; for (const person of present({ ...state, homeZoneId: headquartersZone })) state.crewPositions![person.id] = { kind: 'zone', zoneId: state.homeZoneId }; break; }
      case 'assault': assault(state, world, order.zoneId, crew, rng, lines); break;
    }
    for (const line of lines.slice(operationLineStart)) { line.category ??= ['clear', 'assault'].includes(order.action) ? 'combat' : order.action === 'search' ? 'loot' : ['investigate', 'discoveryChoice'].includes(order.action) ? 'discovery' : order.action; line.priority ??= line.tone === 'bad' ? 90 : line.tone === 'warn' ? 75 : line.tone === 'good' ? 50 : 25; line.facts ??= { action: order.action, orderId: order.id, missionId: mission.id }; }
    mission.operationDone = true;
    mission.cargo = state.stock;
    if (headquartersZone !== state.homeZoneId && order.action !== 'relocate') {
      const oldDepot = state.mobility!.depots[headquartersZone] ??= {};
      for (const [id, amount] of Object.entries(headquartersStock)) oldDepot[id] = (oldDepot[id] ?? 0) + amount;
      headquartersStock = state.mobility!.depots[state.homeZoneId] ?? {};
      delete state.mobility!.depots[state.homeZoneId];
      (state.mobility!.depotResidents ??= {})[headquartersZone] = headquartersPopulation;
      mission.returnZoneId = state.homeZoneId;
    }
    state.stock = headquartersStock;
    if (['scout', 'clear'].includes(order.action) && !radioVerified && !personalObservation) {
      mission.observations ??= {};
      mission.factionObservations ??= {};
      for (const faction of state.factions) { const before = factionsBefore[faction.id]; if (before && (faction.known !== before.known || faction.revealed !== before.revealed)) { mission.factionObservations[faction.id] = { known: faction.known, revealed: faction.revealed }; faction.known = before.known; faction.revealed = before.revealed; } }
      for (const [id, zone] of Object.entries(state.zones)) if (JSON.stringify(zone.intel) !== JSON.stringify(intelBefore[id]?.intel)) { mission.observations[id] = { status: zone.status, intel: zone.intel }; zone.status = intelBefore[id].status; zone.intel = intelBefore[id].intel; }
    }
    if (['scout', 'search'].includes(order.action)) {
      const linked = communicationsStatus(state, world, order.survivorIds).connected;
      observeDiscoveries(state, world, { source: order.action as 'scout' | 'search', zoneId: order.zoneId, reporterIds: order.survivorIds, delivery: linked ? 'radio' : 'none', radioVerified: linked }, lines);
    }
    if (!radioVerified && !personalObservation && order.zoneId !== state.homeZoneId) {
      (mission.privateLines ??= []).push(...lines.splice(operationLineStart));
    }
    if (radioVerified) transmitMissionReports(state, mission, lines, true);
    if (order.action === 'areaGuard') {
      const areaLevel = order.logistics?.areaLevel ?? 3;
      for (const id of order.survivorIds) state.crewPositions![id] = { kind: 'area-duty', areaLevel, areaZoneId: areaLevel === 2 ? zone.parentId! : zone.id, duty: 'guard' };
      const zones = areaLevel === 2 ? index.l3.filter(z => z.parentId === zone.parentId) : [zone];
      for (const at of zones) guards[at.id] = (guards[at.id] ?? 0) + crew.reduce((n, p) => n + p.skills.combat * 3, 0) / Math.max(1, zones.length);
    } else if (['guard', 'hold'].includes(order.action) && order.zoneId !== state.homeZoneId) { mission.status = 'returning'; mission.returnZoneId = state.homeZoneId; }
    else returnMission(state, world, mission, Math.max(0, 15 - (mission.elapsedHours ?? 0) - (mission.workHours ?? 0)), lines);
  }
  failEmptyMissions(state, lines);
  deliverDiscoveryReports(state, world, lines);
  discoverWonders(state, world, lines);
  for (const s of present(state)) if (!worked.has(s.id)) { s.fatigue = Math.max(0, s.fatigue - 25); s.health = Math.min(100, s.health + 2); }
  // Held links lapse unless someone stands there again tomorrow.
  for (const [id, st] of Object.entries(state.chokepoints)) if (st === 'held' && !heldToday.has(id)) { state.chokepoints[id] = 'open'; delete state.barricades[id]; }

  // The many: workers who scavenge, build, guard and research. Farming and fishing come with production.
  const central = centralCommunity(state, world);
  const work = workDay(central.state, central.world, rngFor('work'), lines);
  central.commit(state);
  regionalWorkDay(state, world, lines, rngFor('regional-work'));

  // Day operations are committed to the temporary turn state, never replayed
  // when the saved checkpoint is resumed. This boundary also feeds replay UI.
  const operationsLineEnd = lines.length;
  const operationsZoneStatus = statusSnapshot(state);
  const operationsResources = mainResources();
  const operationsMapSnapshot = mapSnapshot(state);
  const operationsPositions = clone(state.crewPositions ?? {});
  const operationsIntel = Object.fromEntries(Object.entries(state.zones).flatMap(([id, zone]) => zone.intel ? [[id, { ...zone.intel }]] : []));

  // Where people live makes noise too.
  noise[state.homeZoneId] = (noise[state.homeZoneId] ?? 0) + (Math.ceil(present(state).length / 3) + Math.ceil(Object.entries(centralAvailablePopulation(state)).filter(([key]) => key !== 'sick').reduce((n, [, count]) => n + count, 0) / 12) + (state.hq?.modules.includes('heavyWorkshop') ? 2 : 0)) * (tech(state, 'decoys') ? .6 : 1);

  for (const region of Object.values(state.administration?.regions ?? {})) { const people = region.residents.adults + region.residents.children + region.residents.elderly; noise[region.hqZoneId] = (noise[region.hqZoneId] ?? 0) + Math.ceil(people / 12); }
  // Zombie migration, then night.
  const { moved: migrated, moves } = migrate(state, world, noise, lines);
  state.turnCheckpoint = {
    version: 1, day, worldVersion: world.worldVersion, stage: 'before-night-defence',
    lines, guards, guardPower: work.guardPower, killed, foodMade, crewResearch, migrated, moves,
    initialZoneStatus, operationsLineEnd, operationsZoneStatus, operationsResources, operationsMapSnapshot, operationsPositions, operationsIntel,
  };
  return state;
}

/**
 * First genuinely interruptible v0.4 turn slice: a severe HQ night assault
 * while a known player avatar is physically there. Other crews retain their
 * autonomous v0.3 resolution; remote radio escalation is a later slice.
 *
 * HYPOTESE (not a locked balance rule): >=8 attackers trigger the decision;
 * five ammunition provide ten extra night-defence points.
 */
export function startRegionDay(
  state0: RegionState, world: RegionWorld, orders: RegionOrder[],
  options: { avatarId?: string } = {},
): { status: 'paused'; state: RegionState; decision: RegionTurnDecision } | { status: 'complete'; state: RegionState; report: RegionReport } {
  const selected = campaignAvatarId(state0) ?? options.avatarId;
  if (campaignAvatarId(state0) && options.avatarId && options.avatarId !== campaignAvatarId(state0)) throw new Error('Hovedpersonen kan ikke byttes gjennom en dagsordre.');
  const state = runRegionDayOperations(state0, world, orders, { avatarId: selected });
  return settleOperationBoundary(state, world, selected);
}

function settleOperationBoundary(state: RegionState, world: RegionWorld, avatarId?: string): ReturnType<typeof startRegionDay> {
  enforceAvatarFate(state);
  if (!state.gameOver && state.turnCheckpoint?.stage === 'before-field-order') { advanceCampaignCommit(state, `operations:${state.day}:field:${state.turnCheckpoint.operations?.missionId}`); return { status: 'paused', state, decision: pendingTurnDecision(state)! }; }
  if (state.gameOver) { delete state.turnCheckpoint; advanceCampaignCommit(state, `operations:${state.day}:game-over`); return { status: 'complete', state, report: state.reports.at(-1) ?? { day: state.day, lines: [], food: { produced: 0, eaten: 0 }, water: { produced: 0, drunk: 0 }, zombiesMoved: 0, killed: 0 } }; }
  const avatar = avatarId && state.survivors.find(person => person.id === avatarId && person.alive && !person.left);
  const position = avatar ? crewPositionFor(state, avatar.id) : undefined;
  const homeThreat = state.zones[state.homeZoneId];
  // A same-day assignment away from HQ has no verified return position in the
  // v0.3 resolver. Avoid falsely presenting the avatar as present there.
  const sentAwayToday = false; // Physical return position is now authoritative.
  if (avatar && position?.kind === 'zone' && position.zoneId === state.homeZoneId && !sentAwayToday
    && homeThreat?.status === 'controlled' && homeThreat.zombies >= 8) {
    const ammoRequired = 5;
    state.turnCheckpoint!.decision = { kind: 'hq-night-defence', avatarId: avatar.id, zoneId: state.homeZoneId, ammoRequired };
    const choices = [
      { id: 'hold', label: 'Hold stillingen', detail: 'Bruk vanlig vakthold og spar ammunisjonen.' },
      { id: 'fire', label: 'Gi dekkild', detail: `Bruk ${ammoRequired} patroner for ekstra forsvar.`,
        ...((state.stock.ammo ?? 0) < ammoRequired ? { disabled: 'Ikke nok ammunisjon.' } : {}) },
    ];
    advanceCampaignCommit(state, `operations:${state.day}:night`);
    return {
      status: 'paused', state,
      decision: { kind: 'hq-night-defence', title: 'Zombier ved hovedkvarteret',
        text: `${homeThreat.zombies} zombier presser på. ${avatar.name} er til stede og må avgjøre innsatsen før nattforsvaret avgjøres.`,
        zoneId: state.homeZoneId, choices },
    };
  }
  advanceCampaignCommit(state, `operations:${state.day}:night`);
  const finished = resumeRegionDay(state, world);
  return { status: 'complete', ...finished };
}

/**
 * Reconstructs nothing from the caller's orders. The JSON checkpoint is the
 * sole authoritative partial-day input; settlement increments the day once.
 * A consumed checkpoint cannot be resumed again from the finished state.
 */
export function resumeRegionDay(
  state0: RegionState, world: RegionWorld, choice?: 'hold' | 'fire',
): { state: RegionState; report: RegionReport } {
  const checkpoint = state0.turnCheckpoint;
  if (!checkpoint || checkpoint.version !== 1 || checkpoint.stage !== 'before-night-defence') throw new Error('Ingen gyldig dagscheckpoint å fortsette.');
  if (checkpoint.day !== state0.day || checkpoint.worldVersion !== world.worldVersion) throw new Error('Checkpoint gjelder et annet døgn eller en annen verden.');
  if (state0.event || state0.gameOver) throw new Error('Døgnet kan ikke fortsette med en annen uavklart hendelse eller game over.');
  if (checkpoint.decision && choice !== 'hold' && choice !== 'fire') throw new Error('Ta stilling til nattangrepet før døgnet kan fortsette.');
  if (!checkpoint.decision && choice !== undefined) throw new Error('Døgnet har ingen spillerbeslutning.');

  const state = clone(state0);
  delete state.turnCheckpoint;
  const lines = clone(checkpoint.lines);
  const day = checkpoint.day;
  const { guards, guardPower, crewResearch, migrated, moves, initialZoneStatus, operationsLineEnd,
    operationsZoneStatus, operationsResources } = checkpoint;
  let { killed, foodMade } = checkpoint;
  const rngFor = (key: string) => random(state.seed, day, key);
  const mainResources = () => ({ food: state.stock.food ?? 0, water: state.stock.water ?? 0 });
  let homeDefenseBonus = 0;
  if (checkpoint.decision && choice === 'fire') {
    if (checkpoint.decision.kind !== 'hq-night-defence' || checkpoint.decision.zoneId !== state.homeZoneId) throw new Error('Ugyldig beslutning for checkpoint.');
    if (!has(state.stock, { ammo: checkpoint.decision.ammoRequired })) throw new Error('Ammunisjonen er ikke tilgjengelig.');
    pay(state.stock, { ammo: checkpoint.decision.ammoRequired });
    homeDefenseBonus = checkpoint.decision.ammoRequired * 2;
    lines.push({ tone: 'warn', title: 'Dekkild ved HQ', text: `${checkpoint.decision.ammoRequired} patroner brukt for å holde zombiene unna.`, zoneId: state.homeZoneId });
  }
  killed += nightDefence(state, world, guards, guardPower, lines, rngFor('night'), homeDefenseBonus);
  killed += rot(state);
  const nightLineEnd = lines.length;
  const nightZoneStatus = statusSnapshot(state);
  const nightResources = mainResources();
  const nightMapSnapshot = mapSnapshot(state);

  // Production, eating and what rots. The same flows the forecast shows.
  const flows = dailyFlows(state, world);
  const madeFood = flows.food.produced;
  foodMade += madeFood;
  add(state.stock, 'food', madeFood);
  add(state.stock, 'water', flows.water.produced);
  for (const [r, n] of Object.entries(flows.other)) add(state.stock, r, n);
  for (const [r, n] of Object.entries(flows.hq)) if (r !== 'food' && r !== 'water') add(state.stock, r, n);
  add(state.stock, 'food', -flows.food.upkeep);
  add(state.stock, 'fuel', -Math.min(state.stock.fuel ?? 0, flows.fuel.used));
  if (season(day).name === 'Vinter' && (state.stock.fuel ?? 0) <= 0) { state.morale -= 2; for (const s of present(state)) s.health -= 3; state.population.sick += Math.ceil(totalPeople(state) * .02); lines.push({ tone: 'bad', title: 'Kaldt', text: 'Det var ikke drivstoff til varme.' }); }
  const foodNeed = flows.food.eaten;
  const eaten = Math.min(state.stock.food ?? 0, foodNeed);
  const drunk = Math.min(state.stock.water ?? 0, flows.water.drunk);
  add(state.stock, 'food', -eaten); add(state.stock, 'water', -drunk);
  const spoiled = Math.min(state.stock.food ?? 0, flows.food.spoiled);
  add(state.stock, 'food', -spoiled);
  if (eaten < foodNeed - .5) {
    const short = 1 - eaten / Math.max(1, foodNeed);
    for (const s of present(state)) s.health -= 8 * short + 2;
    state.population.sick += Math.ceil(totalPeople(state) * short * .1);
    state.morale += R.morale.hunger * short;
    state.counters.hungerStreak = (state.counters.hungerStreak ?? 0) + 1;
    state.counters.hungryDays = (state.counters.hungryDays ?? 0) + 1;
    if ((state.counters.hungerStreak ?? 0) >= 3 && centralAvailablePopulation(state).children + centralAvailablePopulation(state).elderly > 0) {
      const kind = centralAvailablePopulation(state).elderly ? 'elderly' : 'children';
      state.population[kind] -= 1;
      lines.push({ tone: 'bad', title: kind === 'elderly' ? 'En gammel døde av sult' : 'Et barn døde av sult', text: 'Det er ikke mat nok.' });
    }
    lines.push({ tone: 'bad', title: 'Sult', text: `Det var mat til ${Math.round((1 - short) * 100)} % av behovet.` });
  } else state.counters.hungerStreak = 0;
  if (drunk < flows.water.drunk - .5) { for (const s of present(state)) s.health -= 12; state.morale += R.morale.thirst; lines.push({ tone: 'bad', title: 'Tørst', text: 'Det var ikke vann nok til alle.' }); }
  if (spoiled >= 3) lines.push({ tone: 'warn', title: `${Math.round(spoiled)} mat råtnet`, text: 'Fersk mat holder ikke. Salting, jordkjeller og lager hjelper.' });

  bittenDay(state, lines, rngFor('bitten'));
  const knownSurvivorIds = new Set(state.survivors.map(person => person.id));
  societyDay(state, world, lines, rngFor('society'));
  const promoted = state.survivors.filter(person => !knownSurvivorIds.has(person.id));
  if (promoted.length) ensureMobility(state);
  for (const person of promoted) if (person.alive && !person.left) state.crewPositions![person.id] = { kind: 'zone', zoneId: state.homeZoneId };
  if (promoted.length) state.gear = gearStateFor(state);
  const regionalFed = regionalDay(state, world, lines, rngFor('regional'));
  researchDay(state, researchRate(state, crewResearch), lines);

  for (const s of living(state)) {
    if (s.health <= 0) { s.alive = false; s.health = 0; state.morale += R.morale.death; state.counters[`deaths:${Math.floor(day / 14)}`] = (state.counters[`deaths:${Math.floor(day / 14)}`] ?? 0) + 1; lines.push({ tone: 'bad', title: `${s.name} er død`, text: `${s.role}. Gruppen sørger.` }); }
  }
  state.morale = Math.max(0, Math.min(100, state.morale));

  consumeFieldMeals(state, lines, regionalFed);
  consumePassengerMeals(state, lines);
  failEmptyMissions(state, lines);
  maintainDiscoveries(state, lines);
  state.mobility!.reservedAwayIds = [];
  state.day = day + 1;
  for (const s of living(state)) if (s.awayUntil && s.awayUntil <= state.day) delete s.awayUntil;
  completeLegacyReturns(state);
  settleGearReturns(state, lines);
  deliverDiscoveryReports(state, world, lines);
  updateFactions(state, world, lines);
  checkMilestones(state, world, lines, foodMade);
  checkPhase(state, world, lines);
  checkVictory(state, madeFood - eaten - spoiled - flows.food.upkeep);
  if (!state.gameOver) {
    if (!living(state).length) state.gameOver = { day: state.day, reason: 'Alle i crewet er døde.' };
    else if (state.morale <= 0) state.gameOver = { day: state.day, reason: 'Håpet brast. Gruppen gikk hver til sitt.' };
    else if (state.discontent >= 100) state.gameOver = { day: state.day, reason: 'Folket tok makten fra deg. Du ble ført ut porten i natt.' };
  }
  if (!state.gameOver && state.discontent >= 80 && !state.scheduled.some(x => x.id === 'mutiny') && (state.counters.mutinyDay ?? -99) < state.day - 10) {
    state.scheduled.push({ day: state.day, id: 'mutiny' });
    state.counters.mutinyDay = state.day;
  }
  if (!state.gameOver) {
    const ev = pickEvent(state, world, random(state.seed, state.day, `event:${state.startZoneId}`));
    if (ev) { state.event = ev; lines.push({ tone: 'warn', title: ev.title, text: 'En hendelse krever et valg.' }); }
  }
  const replay: RegionReplayStage[] = [
    { phase: 'operations', from: { dayOffset: 0, clock: '07:00' }, to: { dayOffset: 0, clock: '22:00' },
      lines: lines.slice(0, operationsLineEnd), zoneChanges: zoneStatusChanges(initialZoneStatus, operationsZoneStatus),
      mainResourcesAfter: operationsResources, mapSnapshot: checkpoint.operationsMapSnapshot, crewPositions: checkpoint.operationsPositions, zoneIntel: checkpoint.operationsIntel },
    { phase: 'night', from: { dayOffset: 0, clock: '22:00' }, to: { dayOffset: 1, clock: '07:00' },
      lines: lines.slice(operationsLineEnd, nightLineEnd), zoneChanges: zoneStatusChanges(operationsZoneStatus, nightZoneStatus),
      mainResourcesAfter: nightResources, moves, mapSnapshot: nightMapSnapshot, crewPositions: nightMapSnapshot.crewPositions, zoneIntel: Object.fromEntries(Object.entries(nightMapSnapshot.zones).flatMap(([id, zone]) => zone.intel ? [[id, zone.intel]] : [])) },
    { phase: 'new-day', from: { dayOffset: 1, clock: '07:00' },
      lines: lines.slice(nightLineEnd), zoneChanges: zoneStatusChanges(nightZoneStatus, statusSnapshot(state)),
      mainResourcesAfter: mainResources(), mapSnapshot: mapSnapshot(state), crewPositions: clone(state.crewPositions ?? {}), zoneIntel: Object.fromEntries(Object.entries(state.zones).flatMap(([id, zone]) => zone.intel ? [[id, { ...zone.intel }]] : [])) },
  ];
  const report: RegionReport = { day: state.day, lines, food: { produced: Math.round(foodMade), eaten: Math.round(eaten), spoiled: Math.round(spoiled) }, water: { produced: Math.round(flows.water.produced), drunk: Math.round(drunk) }, zombiesMoved: migrated, killed, moves, replay };
  state.reports = [...state.reports.slice(-29), report];
  state.counters.killed = (state.counters.killed ?? 0) + killed;
  enforceAvatarFate(state); advanceCampaignCommit(state, `day:${state.day}:${choice ?? 'automatic'}`);
  return { state, report };
}

/** Backward-compatible atomic API: no new decision, same authoritative result. */
export function endDay(state0: RegionState, world: RegionWorld, orders: RegionOrder[]): { state: RegionState; report: RegionReport } {
  const operations = runRegionDayOperations(state0, world, orders, { avatarId: campaignAvatarId(state0) });
  if (operations.turnCheckpoint?.stage === 'before-field-order') throw new Error('Et obligatorisk feltvalg krever startRegionDay/continueRegionDay.');
  advanceCampaignCommit(operations, `operations:${operations.day}:night`);
  return resumeRegionDay(operations, world);
}

/** When the cruise ship is towed, it moves to the yard if you hold one, or to your safest coastal zone. */
function moveShip(state: RegionState, world: RegionWorld) {
  const ship = state.wonders?.cruise;
  if (!ship || ship.level < 2 || ship.zoneId === state.flags.shipDock) return;
  const index = indexWorld(world);
  const owned = controlled(state).filter(id => index.coastal.has(id));
  const yard = owned.find(id => (index.poisByZone.get(id) ?? []).some(p => p.hqType === 'shipyard'));
  const dock = yard ?? owned.sort((a, b) => state.zones[a].zombies - state.zones[b].zombies)[0];
  if (!dock) return;
  ship.zoneId = dock;
  state.flags.shipDock = dock;
}

function stockText(stock: Stock) { return Object.entries(stock).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(', '); }

/** Take what can be carried from a zone, most valuable per kilo first. */
function searchZone(state: RegionState, world: RegionWorld, zoneId: string, hours: number, capacity: number, rng: () => number): Stock {
  const zone = indexWorld(world).byId.get(zoneId)!;
  const z = state.zones[zoneId];
  const total = searchHoursTotal(zone);
  const progress = Math.max(0, Math.min(hours, total - z.searched));
  const share = progress / Math.max(1, total - z.searched);
  z.searched += progress;
  const found: Stock = {};
  let carried = 0;
  const findMult = mods(state).lootFind;
  for (const [id, left] of Object.entries(z.loot).sort((a, b) => (VALUE[b[0]] ?? 1) / weight(b[0]) - (VALUE[a[0]] ?? 1) / weight(a[0]))) {
    const wanted = Math.floor(left * share + rng());
    const room = weight(id) ? Math.floor((capacity - carried) / weight(id)) : wanted;
    const n = Math.max(0, Math.min(wanted, room));
    if (!n) continue;
    // Late in the game much of what is left is spoiled or broken.
    const kept = Math.max(id === 'boat' ? n : 0, Math.round(n * (['food', 'water', 'medicine'].includes(id) ? findMult : 1)));
    found[id] = kept; z.loot[id] = left - n; carried += n * weight(id);
    add(state.stock, id, kept);
  }
  return found;
}

function finishZoneBuilding(state: RegionState, world: RegionWorld, zoneId: string, lines: ReportLine[]) {
  const index = indexWorld(world);
  const z = state.zones[zoneId];
  const zone = index.byId.get(zoneId)!;
  if (!z.building) return;
  const u = UPGRADE_COST[z.building.id];
  if (z.building.hours < u.hours) { lines.push({ tone: 'info', title: `Bygger ${upgradeName(z.building.id).toLowerCase()} i ${zone.name}`, text: `${Math.round(z.building.hours)} av ${u.hours} timer.`, zoneId }); return; }
  const id = z.building.id;
  z.upgrades.push(id);
  delete z.building;
  if (id === 'salvage') { add(state.stock, 'building', 40); add(state.stock, 'metal', 10); add(state.stock, 'parts', 6); }
  if (id === 'barricades') for (const a of index.adjacent.get(zoneId) ?? []) if (a.kind === 'land' && state.zones[a.to]?.status !== 'controlled') { state.barricades[a.connId] = Math.max(state.barricades[a.connId] ?? 0, R.barricadeDurability * 2); state.barricadeTier[a.connId] = Math.max(state.barricadeTier[a.connId] ?? 1, 2); }
  lines.push({ tone: 'good', title: `${upgradeName(id)} er ferdig i ${zone.name}`, text: CONTENT.upgrades.find(x => x.id === id)?.gives ?? '', zoneId });
}
function finishModule(state: RegionState, lines: ReportLine[]) {
  const hq = state.hq;
  if (!hq?.building) return;
  const m = MODULE_COST[hq.building.id];
  if (hq.building.hours < m.hours) { lines.push({ tone: 'info', title: `Bygger ${moduleName(hq.building.id).toLowerCase()}`, text: `${Math.round(hq.building.hours)} av ${m.hours} timer.` }); return; }
  hq.modules.push(hq.building.id);
  lines.push({ tone: 'good', title: `${moduleName(hq.building.id)} er ferdig`, text: CONTENT.modules.find(x => x.id === hq.building!.id)?.effect ?? '' });
  delete hq.building;
}
function finishNetworks(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  const index = indexWorld(world);
  for (const [key, hours] of Object.entries(state.counters)) {
    if (!key.startsWith('network:')) continue;
    const [, l2, id] = key.split(':');
    const n = NETWORK_COST[id];
    if (!n || hours < n.hours) continue;
    (state.networks[l2] ??= []).push(id);
    delete state.counters[key];
    lines.push({ tone: 'good', title: `${CONTENT.networks.find(x => x.id === id)?.name}nett i ${index.byId.get(l2)?.name}`, text: CONTENT.networks.find(x => x.id === id)?.gives ?? '' });
  }
}
function finishRepairs(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  for (const [key, hours] of Object.entries(state.counters)) {
    if (!key.startsWith('repair:') || hours < 60) continue;
    const id = key.slice(7);
    state.chokepoints[id] = 'open';
    delete state.counters[key];
    lines.push({ tone: 'good', title: `${world.links.find(l => l.id === id)?.name} er bygd opp igjen`, text: 'Forbindelsen er åpen, for dere og for dem.' });
  }
}

/** The counted population at work: scavengers, builders, guards. Farmers and fishers are part of production. */
export function workDay(state: RegionState, world: RegionWorld, rng: () => number, lines: ReportLine[]) {
  const index = indexWorld(world);
  trimWork(state);
  const law = lawMods(state);
  // Scavengers go through what is near and safe.
  const scavengers = state.work.scavenge ?? 0;
  if (scavengers) {
    let hours = scavengers * POP.work.scavengeHours * law.workMult;
    const hops = reach(state, world);
    const options = [...hops.entries()].filter(([id, d]) => d <= 1 && !state.zones[id].owner && state.zones[id].searched < searchHoursTotal(index.byId.get(id)!)
      && (state.zones[id].status === 'controlled' || (state.zones[id].intel?.max ?? 99) <= 3)).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const found: Stock = {};
    for (const id of options) {
      if (hours <= 0) break;
      const before = state.zones[id].searched;
      const got = searchZone(state, world, id, hours, scavengers * 25, rng);
      hours -= state.zones[id].searched - before;
      for (const [r, n] of Object.entries(got)) found[r] = (found[r] ?? 0) + n;
      if (state.zones[id].zombies > 0 && rng() < Math.min(.4, state.zones[id].zombies / (scavengers * 4))) {
        state.population.adults = Math.max(0, state.population.adults - 1);
        lines.push({ tone: 'bad', title: 'En sanker kom ikke hjem', text: `Det var fortsatt zombier i ${index.byId.get(id)?.name}.` });
      }
    }
    if (Object.keys(found).length) lines.push({ tone: 'good', title: `Sankerne kom hjem`, text: `${scavengers} sankere fant ${stockText(found)}.` });
    else lines.push({ tone: 'info', title: 'Sankerne fant ingenting', text: 'Det er ikke mer å hente i trygge soner i nærheten. Speid eller rydd nye.' });
  }
  // Clearing crews: the many with crowbars and spears. Your own zones first, then the calmest known neighbour.
  const clearers = state.work.clear ?? 0;
  if (clearers) {
    let kills = clearers * POP.work.clearKills * law.workMult * (tech(state, 'forgedMelee') ? 1.3 : 1) / mutation(state, 'tough', 1.25);
    const owned = controlled(state).filter(id => state.zones[id].zombies > 0);
    const near = [...reach(state, world).entries()].filter(([id, d]) => d === 1 && !state.zones[id].owner && state.zones[id].status !== 'controlled' && state.zones[id].intel)
      .sort((a, b) => state.zones[a[0]].zombies - state.zones[b[0]].zombies).map(([id]) => id).slice(0, 2);
    let total = 0, lost = 0;
    for (const id of [...owned, ...near]) {
      if (kills < 1) break;
      const z = state.zones[id];
      const k = Math.min(z.zombies, Math.floor(kills));
      // Too many at once and someone does not come back.
      if (z.zombies > clearers * 2.5 && rng() < .35) { lost++; state.population.adults = Math.max(0, state.population.adults - 1); }
      z.zombies -= k; kills -= k; total += k;
      if (z.intel) z.intel = { min: Math.max(0, z.zombies - 1), max: z.zombies + 2, day: state.day };
      const samples = Math.floor(k / R.samplesPerKills + rng() * .5);
      if (samples) add(state.stock, 'samples', samples);
    }
    if (total || lost) lines.push({ tone: lost ? 'warn' : 'good', title: `Ryddelaget drepte ${total}`, text: lost ? `${lost} fra ryddelaget kom ikke tilbake.` : `${clearers} mann med brekkjern og spyd.` });
    state.counters.killed = (state.counters.killed ?? 0) + total;
  }
  // Builders help whatever is under construction, then mend barricades.
  let buildHours = (state.work.build ?? 0) * POP.work.buildHours * law.workMult;
  if (buildHours > 0) {
    if (state.hq?.building) { const h = Math.min(buildHours, MODULE_COST[state.hq.building.id].hours - state.hq.building.hours); state.hq.building.hours += h; buildHours -= h; finishModule(state, lines); }
    for (const [id, z] of Object.entries(state.zones)) if (z.building && buildHours > 0) { const h = Math.min(buildHours, UPGRADE_COST[z.building.id].hours - z.building.hours); z.building.hours += h; buildHours -= h; finishZoneBuilding(state, world, id, lines); }
    for (const key of Object.keys(state.counters)) if ((key.startsWith('network:') || key.startsWith('repair:')) && buildHours > 0) { const h = Math.min(buildHours, 10); state.counters[key] += h; buildHours -= h; }
    for (const [id, w] of Object.entries(state.wonders ?? {})) if (w.progress > 0 && buildHours > 0 && wonderOperational(w)) { const next = nextWonderLevel(state, id); if (!next) continue; const h = Math.min(buildHours, next.hours - w.progress); buildHours -= h; workOnWonder(state, id, h, lines, () => undefined, 'population'); moveShip(state, world); }
    finishNetworks(state, world, lines); finishRepairs(state, world, lines);
    for (const [id, d] of Object.entries(state.barricades)) {
      if (buildHours <= 0) break;
      const max = TIERS[(state.barricadeTier[id] ?? 1) - 1]?.durability ?? 10;
      if (d < max) { const fix = Math.min(max - d, buildHours / 2); state.barricades[id] = d + fix; buildHours -= fix * 2; }
    }
  }
  const guardPower = (state.work.guard ?? 0) * POP.work.guard * law.guardMult * (tech(state, 'watchRoutine') ? 1.4 : 1) * (tech(state, 'drill') ? 1.5 : 1);
  return { guardPower };
}

/** Before you hold anything, the whole group can move to a better place. What cannot be carried stays behind. */
function relocate(state: RegionState, world: RegionWorld, zoneId: string, rng: () => number, lines: ReportLine[]) {
  const index = indexWorld(world);
  const from = state.homeZoneId;
  const carry = present(state).length * R.carryPerPerson * 1.5 + totalPeople(state) * 4;
  const load = Object.entries(state.stock).reduce((n, [id, k]) => n + k * weight(id), 0);
  const share = Math.min(1, carry / Math.max(1, load));
  const left: Stock = {};
  if (share < 1) for (const [id, n] of Object.entries(state.stock)) { const keep = Math.floor(n * share); if (n - keep > 0 && weight(id)) { left[id] = n - keep; state.zones[from].loot[id] = (state.zones[from].loot[id] ?? 0) + n - keep; state.stock[id] = keep; } }
  const remainingRoom = Math.max(0, carry - Object.entries(state.stock).reduce((n, [id, amount]) => n + amount * weight(id), 0));
  moveGearDepot(state, from, zoneId, remainingRoom);
  state.homeZoneId = zoneId;
  const z = state.zones[zoneId];
  if (z.status === 'unknown') z.status = 'scouted';
  const danger = z.zombies / Math.max(1, present(state).length * 3);
  hurt(state, present(state), danger > 1 ? Math.min(35, danger * 8) : danger > .4 ? 6 : 0, rng, lines, index.byId.get(zoneId)!.name);
  if (state.population.adults + state.population.children && danger > .5) {
    const lost = Math.ceil((state.population.adults + state.population.children) * Math.min(.3, danger * .08));
    const kids = Math.min(state.population.children, Math.floor(lost / 2));
    state.population.children -= kids; state.population.adults = Math.max(0, state.population.adults - (lost - kids));
    lines.push({ tone: 'bad', title: `${lost} kom ikke fram`, text: 'Noen ble tatt på veien.' });
  }
  state.memory.push({ day: state.day, text: `Leiren flyttet fra ${index.byId.get(from)?.name} til ${index.byId.get(zoneId)?.name}.` });
  lines.push({ tone: 'warn', title: `Leiren er flyttet til ${index.byId.get(zoneId)?.name}`, text: Object.keys(left).length ? `Dere måtte la ${stockText(left)} bli igjen i ${index.byId.get(from)?.name}.` : 'Dere fikk med alt.', zoneId });
}

/** A raid on another group's base. Win, and the base and its stores are yours. */
function assault(state: RegionState, world: RegionWorld, zoneId: string, crew: RegionSurvivor[], rng: () => number, lines: ReportLine[]) {
  const f = state.factions.find(x => x.zoneId === zoneId && !x.defeated)!;
  const odds = assaultOdds(state, crew, f);
  add(state.stock, 'ammo', -odds.ammo);
  const peaceful = !f.hostile && f.intent !== 'betray';
  if (rng() < odds.chance) {
    f.defeated = true;
    const z = state.zones[zoneId];
    delete z.owner; z.status = 'controlled'; z.zombies = 0; z.intel = { min: 0, max: 0, day: state.day };
    for (const [id, n] of Object.entries(f.stock)) add(state.stock, id, Math.round(n * .6));
    hurt(state, crew, 10, rng, lines, f.name);
    const survivors = Math.round((f.strength ?? 30) / 4);
    if (peaceful) {
      state.morale -= 6;
      for (const other of state.factions) if (other !== f && !other.defeated) other.relation -= 25;
      for (const p of living(state)) for (const t of p.traits ?? []) p.loyalty = Math.max(0, Math.min(100, (p.loyalty ?? 60) + (REACTIONS[t].betrayal ?? 0) + (REACTIONS[t].cruel ?? 0) / 2));
    } else state.morale += 8;
    state.population.adults += Math.round(survivors * (peaceful ? .5 : .3));
    state.memory.push({ day: state.day, text: `Dere tok ${f.name} med makt.` });
    discoverWonders(state, world, lines);
    lines.push({ tone: 'good', title: `${f.name} er slått`, text: `Basen og lageret er deres. ${Math.round(survivors * (peaceful ? .5 : .3))} av dem ble med dere.${peaceful ? ' De andre gruppene har hørt om det.' : ''}`, zoneId });
  } else {
    hurt(state, crew, 30, rng, lines, f.name);
    f.strength = Math.round((f.strength ?? 30) * .85);
    f.relation = Math.max(-100, f.relation - 40);
    if (peaceful) { f.hostile = true; for (const other of state.factions) if (other !== f) other.relation -= 10; }
    state.morale -= 5;
    lines.push({ tone: 'bad', title: `Toktet mot ${f.name} mislyktes`, text: 'Dere måtte trekke dere tilbake. De glemmer ikke dette.', zoneId });
  }
}

/** The bitten turn on the day they were told, unless the law or a surgeon decides otherwise. */
function bittenDay(state: RegionState, lines: ReportLine[], rng: () => number) {
  for (const p of living(state)) {
    if (p.bitten === undefined || p.bitten > state.day) continue;
    delete p.bitten;
    if (state.laws.includes('bittenQuarantine') && tech(state, 'fieldSurgery') && rng() < .5) {
      p.health = Math.max(5, p.health - 40);
      lines.push({ tone: 'warn', title: `${p.name} ble amputert`, text: 'Karantene og en sag. Hen lever, med én arm.' });
      continue;
    }
    p.alive = false; p.health = 0;
    state.counters[`deaths:${Math.floor(state.day / 14)}`] = (state.counters[`deaths:${Math.floor(state.day / 14)}`] ?? 0) + 1;
    if (state.laws.includes('bittenMercy') || state.laws.includes('bittenQuarantine')) {
      state.morale -= 6;
      lines.push({ tone: 'bad', title: `${p.name} er borte`, text: 'Bittet vant. Det skjedde etter loven, rolig og uten at noen andre ble skadet.' });
    } else {
      state.morale -= 10;
      state.zones[state.homeZoneId].zombies += 1;
      const victim = state.population.adults > 0 ? 'en voksen' : 'ingen andre';
      if (state.population.adults > 0 && rng() < .6) state.population.adults -= 1;
      lines.push({ tone: 'bad', title: `${p.name} snudde i natt`, text: `Inne i leiren. Det tok tid før noen skjønte det. Det gikk ut over ${victim}.` });
    }
  }
}

const WEIGHT: Record<string, number> = { ammo: .05, primers: .01, medicine: .2, antibiotics: .1, batteries: .3, electronics: .5,
  radio: .5, salt: .5, explosives: .5, printer: 5, generator: 8, solar: 3, engine: 10, boat: 0, samples: .2 };
/** Carrying weight of one unit. Boats sail home and weigh nothing to carry. */
export const weight = (id: string) => WEIGHT[id] ?? 1;
export { hopeTarget as moraleTarget } from './society';
export const upgradeName = (id: string) => CONTENT.upgrades.find(u => u.id === id)?.name ?? id;
export const moduleName = (id: string) => CONTENT.modules.find(m => m.id === id)?.name ?? id;

function hurt(state: RegionState, crew: RegionSurvivor[], amount: number, rng: () => number, lines: ReportLine[], place: string) {
  if (amount <= 0) return;
  const armour = tech(state, 'armour') ? .6 : 1;
  for (const s of crew) {
    if (rng() < Math.min(.85, amount * armour / 25)) {
      // Fights happen at the edge of a crowd: bad odds make injuries likely, but no single blow is unlimited.
      const harm = Math.min(40, Math.round((6 + amount * .6) * (.5 + rng()) * armour * gearDamageMultiplier(state, s.id) * difficultyRules(state).damage));
      s.health -= harm;
      lines.push({ tone: 'bad', title: `${s.name} ble skadet`, text: `I ${place}: ${harm} i skade.` });
      // A bad fight can end in a bite.
      if (amount >= 15 && rng() < .12 && s.bitten === undefined) { s.bitten = state.day + 2; lines.push({ tone: 'bad', title: `${s.name} ble bitt`, text: 'Bittet er dypt. Om to døgn vet dere.' }); }
    }
  }
}

export function recruit(state: RegionState, lines: ReportLine[], text: string, rng: () => number, arrival: { zoneId: string; missionId?: string } = { zoneId: state.homeZoneId }) {
  const taken = new Set(state.survivors.map(s => s.name));
  const options = RECRUIT_POOL.filter(p => !taken.has(p.name));
  if (living(state).length < R.crewCap && options.length && rng() < .55) {
    const p = options[Math.floor(rng() * options.length)];
    state.survivors.push({ ...p, skills: { ...p.skills }, traits: [...(p.traits ?? [])], id: `r${state.day}-${state.survivors.length}`, joinedDay: state.day });
    const joined = state.survivors.at(-1)!;
    if (state.crewPositions || arrival.zoneId !== state.homeZoneId) {
      ensureMobility(state);
      state.crewPositions![joined.id] = { kind: 'zone', zoneId: arrival.zoneId };
    }
    state.gear = gearStateFor(state);
    const mission = arrival.missionId && state.crewMissions?.[arrival.missionId];
    if (mission) {
      mission.survivorIds.push(joined.id);
      state.gear.missions[joined.id] = { orderId: mission.orderId, targetZoneId: arrival.zoneId, returnDay: 1e9, returnToZoneId: mission.returnZoneId ?? state.homeZoneId };
      const weapon = state.gear.items.find(item => item.id === `starter:${joined.id}`);
      if (weapon) weapon.location = { kind: 'carried', survivorId: joined.id, missionId: mission.id, targetZoneId: arrival.zoneId, returnDay: 1e9, returnToZoneId: mission.returnZoneId ?? state.homeZoneId };
    }
    state.morale = Math.min(100, state.morale + R.morale.recruit);
    lines.push({ tone: 'good', title: `${p.name} ble med`, text: `${text} ${p.role}: ${p.about}` });
    return;
  }
  const n = 1 + Math.floor(rng() * 3);
  state.population.adults += n;
  const children = rng() < .4 ? 1 : 0;
  state.population.children += children;
  const mission = arrival.missionId && state.crewMissions?.[arrival.missionId];
  if (mission) { mission.passengers ??= { adults: 0, children: 0, elderly: 0, sick: 0 }; mission.passengers.adults += n; mission.passengers.children += children; }
  else if (arrival.zoneId !== state.homeZoneId && state.mobility) { const residents = (state.mobility.depotResidents ??= {})[arrival.zoneId] ??= { adults: 0, children: 0, elderly: 0, sick: 0 }; residents.adults += n; residents.children += children; }
  lines.push({ tone: 'good', title: `${n} nye overlevende`, text });
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
  const m = mods(state);
  const config = {
    mobilityRate: Math.min(.5, R.migration.mobilityRate * m.mobility * mutation(state, 'runners', 1.6)),
    noiseWeight: R.migration.noiseWeight * m.noise * mutation(state, 'hearing', 1.6),
    attemptsPerDurability: state.mutations.some(x => x.id === 'climbers') ? 2 : R.migration.attemptsPerDurability,
  };
  const result = resolveDay(simWorld, { day: state.day, population, barriers }, orders, state.seed, config);
  for (const id of zoneIds) state.zones[id].zombies = result.state.population[id];
  for (const [id, b] of Object.entries(result.state.barriers)) state.barricades[id] = b.durability;
  for (const id of result.report.breaches) {
    const name = world.links.find(l => l.id === id)?.name ?? 'En sperring';
    lines.push({ tone: 'bad', title: `${name} brøt sammen`, text: 'Zombier har slitt ned sperringen.' });
    if (state.chokepoints[id] === 'blocked') state.chokepoints[id] = 'open';
    delete state.barricades[id]; delete state.barricadeTier[id];
  }
  // NPC groups clear their own ground.
  for (const f of state.factions) if (!f.defeated) state.zones[f.zoneId].zombies = 0;
  // Report actual destinations before the map animation's forty-move cap.
  const incoming = new Map<string, number>();
  for (const move of result.movements) if (move.count > 0 && state.zones[move.toId].status === 'controlled') incoming.set(move.toId, (incoming.get(move.toId) ?? 0) + move.count);
  const totalIncoming = [...incoming.values()].reduce((sum, count) => sum + count, 0);
  for (const [zoneId, count] of [...incoming].sort(([a], [b]) => a.localeCompare(b))) lines.push({
    tone: 'warn', category: 'migration', zoneId, facts: { count, totalIncoming, destinationCount: incoming.size },
    title: `${count} zombier kom inn i ${index.byId.get(zoneId)!.name}`,
    text: 'Lyd trekker dem til. Sperr grensene eller hold vakt.',
  });
  const seen = (id: string) => state.zones[id]?.status !== 'unknown';
  const moves = result.movements.filter(mv => mv.count > 0 && (seen(mv.fromId) || seen(mv.toId))).sort((a, b) => b.count - a.count).slice(0, 40)
    .map(mv => ({ from: mv.fromId, to: mv.toId, n: mv.count }));
  return { moved: result.report.moved, moves };
}

function nightDefence(state: RegionState, world: RegionWorld, guards: Record<string, number>, guardPool: number, lines: ReportLine[], rng: () => number, homeDefenseBonus = 0) {
  const index = indexWorld(world);
  let killed = 0;
  let pool = guardPool;
  const homeCombat = present(state).reduce((n, s) => n + s.skills.combat * (s.health > 40 ? 1.5 : .5), 0);
  const dig = state.mutations.some(m => m.id === 'diggers') ? (state.mutations.find(m => m.id === 'diggers')!.known ? .05 : .1) : 0;
  const owned = controlled(state).sort((a, b) => state.zones[b].zombies - state.zones[a].zombies);
  for (const id of owned) {
    const z = state.zones[id];
    if (!z.zombies) continue;
    const borders = (index.adjacent.get(id) ?? []).filter(a => state.barricades[a.connId] > 0);
    let defense = R.baseDefense + (guards[id] ?? 0);
    for (const u of z.upgrades) defense += UPGRADE_COST[u]?.defense ?? 0;
    if (tech(state, 'spikes')) defense += borders.length * 2;
    defense += borders.filter(a => (state.barricadeTier[a.connId] ?? 1) >= 4).length * 4;
    if (id === state.homeZoneId) defense += homeCombat + homeDefenseBonus;
    for (const [wid, w] of Object.entries(state.wonders ?? {})) if (w.zoneId === id && wonderOperational(w)) defense += WONDERS.find(d => d.id === wid)?.levels[w.level]?.effect.defense ?? 0;
    if (state.hq?.zoneId === id) for (const m of state.hq.modules) defense += MODULE_COST[m]?.defense ?? 0;
    const delegated = Object.values(state.administration?.regions ?? {}).some(region => region.l1Id === regionalL1(world, id));
    const fromPool = delegated ? 0 : Math.min(pool, Math.max(0, z.zombies - defense));
    pool -= fromPool; defense += fromPool;
    defense += regionalGuardFor(state, world, id);
    const sneak = Math.floor(z.zombies * dig);
    const k = Math.min(z.zombies - sneak, Math.round(defense));
    z.zombies -= k; killed += k;
    if (!z.zombies) continue;
    const name = index.byId.get(id)!.name;
    if (id !== state.homeZoneId) regionalOverrun(state, world, id, z.zombies, lines, rng);
    if (id === state.homeZoneId) {
      // A random sort comparator is not transitive: JS runtimes may call it in
      // different orders, consuming different RNG draws. Fisher-Yates is explicit.
      const candidates = present(state);
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const victims = candidates.slice(0, Math.min(3, Math.ceil(z.zombies / 4)));
      for (const v of victims) { v.health -= Math.round(Math.min(45, z.zombies * R.injuryPerExcessZombie) * gearDamageMultiplier(state, v.id) * difficultyRules(state).damage); if (z.zombies > 4 && rng() < .1 && v.bitten === undefined) v.bitten = state.day + 2; }
      const localPopulation = centralAvailablePopulation(state);
      const many = localPopulation.adults + localPopulation.children + localPopulation.elderly;
      const dead = many ? Math.min(many, Math.floor(z.zombies / 3 * rng() + (z.zombies > 6 ? 1 : 0))) : 0;
      for (let i = 0; i < dead; i++) { const kind = localPopulation.elderly && rng() < .3 ? 'elderly' : localPopulation.children && rng() < .3 ? 'children' : localPopulation.adults ? 'adults' : 'children'; if (localPopulation[kind] > 0) { localPopulation[kind] -= 1; state.population[kind] -= 1; } }
      state.morale -= 4 + dead;
      lines.push({ tone: 'bad', title: `Angrep i natt i ${name}`, text: `${z.zombies} zombier kom gjennom forsvaret. ${victims.map(v => v.name).join(', ') || 'Ingen i crewet'} ble skadet${dead ? `, og ${dead} i leiren døde` : ''}.`, zoneId: id });
      const repelled = Math.min(z.zombies, victims.length * 2 + Math.ceil(many / 10));
      z.zombies -= repelled; killed += repelled;
    } else if (z.zombies > 6) {
      z.status = 'scouted';
      z.intel = { min: z.zombies - 2, max: z.zombies + 3, day: state.day };
      state.morale -= 3;
      lines.push({ tone: 'bad', title: `${name} er tapt`, text: `${z.zombies} zombier tok over sonen. Rydd og ta den tilbake.`, zoneId: id });
    } else lines.push({ tone: 'warn', title: `Zombier i ${name}`, text: `${z.zombies} vandrer rundt i sonen. Hold vakt eller rydd.`, zoneId: id });
  }
  return killed;
}

// ------------------------------------------------------------------ NPC groups and trade

function meetFactions(state: RegionState, world: RegionWorld, zoneId: string, lines: ReportLine[]) {
  const index = indexWorld(world);
  const near = new Set([zoneId, ...(index.adjacent.get(zoneId) ?? []).map(a => a.to)]);
  for (const f of state.factions) if (!f.known && !f.defeated && near.has(f.zoneId)) {
    f.known = true;
    lines.push({ tone: f.hostile ? 'warn' : 'good', title: `Kontakt med ${f.name}`, text: `${f.about} De vil ha ${f.wants.map(w => resourceName(w).toLowerCase()).join(', ')}.` });
  }
}
function updateFactions(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  const radio = wonderEffects(state).contact || (state.stock.radio ?? 0) >= 1 || state.hq?.modules.includes('radioRoom') || Object.values(state.networks).some(n => n.includes('comms')) || tech(state, 'crystalRadio');
  for (const f of state.factions) {
    if (f.defeated) continue;
    if (!f.known && !f.hostile && radio && state.day % 5 === 0) { f.known = true; lines.push({ tone: 'good', title: `Radiokontakt med ${f.name}`, text: f.about }); }
    if (state.day % 7 === 0) for (const id of f.offers) add(f.stock, id, Math.round(60 / (VALUE[id] ?? 1)));
    f.strength = Math.round(((f.strength ?? 30) + (f.hostile ? .35 * Math.max(1, mods(state).raid) : .08)) * 100) / 100;
    if (tech(state, 'intel') && f.intent === 'betray' && f.known && !f.revealed) { f.revealed = true; lines.push({ tone: 'warn', title: `Etterretning: ${f.name}`, text: 'Informantene er enige. De planlegger å ta det dere har.' }); }
    // Groups you have wronged long enough stop pretending.
    if (!f.hostile && f.relation <= -60) { f.hostile = true; lines.push({ tone: 'bad', title: `${f.name} er nå fiender`, text: 'De har fått nok av dere.' }); }
  }
  void world;
}
export function tradeValue(state: RegionState, faction: RegionFaction, give: Stock, take: Stock) {
  const mall = (state.hq?.type === 'mall' ? 1.15 : 1) * (1 + wonderEffects(state).trade);
  const worthGive = Object.entries(give).reduce((n, [id, k]) => n + k * (VALUE[id] ?? 1) * (faction.wants.includes(id) ? 1.3 : .7), 0) * (1 + faction.relation / 200) * mall;
  const worthTake = Object.entries(take).reduce((n, [id, k]) => n + k * (VALUE[id] ?? 1) * (faction.offers.includes(id) ? 1.1 : 1.6), 0);
  return { worthGive: Math.round(worthGive * 10) / 10, worthTake: Math.round(worthTake * 10) / 10, fair: worthGive >= worthTake && worthTake > 0 };
}
export function trade(state0: RegionState, factionId: string, give: Stock, take: Stock): { state: RegionState; message: string } {
  const state = clone(state0);
  const f = state.factions.find(x => x.id === factionId);
  if (!f || !f.known || f.defeated) throw new Error('Dere har ikke kontakt med gruppen.');
  if (f.hostile) throw new Error(`${f.name} handler ikke. De tar.`);
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
      case 'claimStart': return owned.length > 0;
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
    day: state.day, phase: state.phase, alive: living(state).length, people: totalPeople(state), zones: controlled(state).length, milestones: state.milestones.length,
    hope: Math.round(state.morale), discontent: Math.round(state.discontent), food: Math.round(state.stock.food ?? 0), killed: state.counters.killed ?? 0,
    research: state.research.done.length, laws: state.laws.length, trades: state.counters.trades ?? 0, hungry: state.counters.hungryDays ?? 0,
    events: state.counters.events ?? 0, gameOver: state.gameOver?.reason ?? null, won: !!state.gameOver?.won,
  };
}

/** Rebuild the exact mandatory prompt after JSON save/reload, without simulating anything. */
export function pendingTurnDecision(state: RegionState): RegionTurnDecision | undefined {
  const decision = state.turnCheckpoint?.decision;
  if (!decision) return undefined;
  if (decision.kind === 'field-encounter') return { kind: decision.kind, title: decision.title ?? 'Kritisk feltmøte', text: decision.text ?? 'Laget trenger en avgjørelse.', zoneId: decision.zoneId, choices: decision.choices ?? [] };
  return { kind: 'hq-night-defence', title: 'Zombier ved hovedkvarteret', text: 'Forsvaret venter på din avgjørelse.', zoneId: decision.zoneId, choices: [
    { id: 'hold', label: 'Hold stillingen', detail: 'Bruk vanlig forsvar og spar ammunisjon.' },
    { id: 'fire', label: 'Gi dekkild', detail: `${decision.ammoRequired} patroner.`, ...((state.stock.ammo ?? 0) < decision.ammoRequired ? { disabled: 'Ikke nok ammunisjon.' } : {}) },
  ] };
}
/** Field continuation may encounter another mandatory decision in the same deterministic turn. */
export function continueRegionDay(state: RegionState, world: RegionWorld, choice: string): ReturnType<typeof startRegionDay> {
  if (state.turnCheckpoint?.stage === 'before-field-order') {
    if (!['proceed', 'withdraw'].includes(choice)) throw new Error('Velg fortsett eller tilbaketrekking.');
    const context = state.turnCheckpoint.operations;
    if (!context) throw new Error('Feltcheckpoint mangler gjenstående ordre.');
    const next = runRegionDayOperations(state, world, context.orders, { resume: true, avatarId: context.avatarId, choice: choice as 'proceed' | 'withdraw' });
    advanceCampaignCommit(next, `field:${state.day}:${context.missionId}:${choice}`);
    return settleOperationBoundary(next, world, context.avatarId);
  }
  if (!['hold', 'fire'].includes(choice)) throw new Error('Velg hold eller dekkild.');
  return { status: 'complete', ...resumeRegionDay(state, world, choice as 'hold' | 'fire') };
}

/** Field people eat what actually accompanied them or exists at their physical depot. */
function consumeFieldMeals(state: RegionState, lines: ReportLine[], regionalFed: string[] = []): void {
  for (const person of state.survivors.filter(p => p.alive && !p.left && p.health > 0 && !regionalFed.includes(p.id) && !present(state).some(home => home.id === p.id))) {
    const mission = Object.values(state.crewMissions ?? {}).find(m => !['complete', 'failed'].includes(m.status) && m.survivorIds.includes(person.id));
    const position = crewPositionFor(state, person.id);
    const zone = position?.kind === 'zone' ? position.zoneId : position?.kind === 'area-duty' ? mission?.targetZoneId : undefined;
    const local = zone ? state.mobility?.depots[zone] : undefined;
    let short = false;
    for (const resource of ['food', 'water']) {
      const need = difficultyRules(state).foodWater;
      const carriedPantry = mission?.cargo ?? state.mobility?.legacyAway?.[person.id]?.cargo;
      const carried = Math.min(carriedPantry?.[resource] ?? 0, need);
      if (carriedPantry) carriedPantry[resource] = Math.max(0, (carriedPantry[resource] ?? 0) - carried);
      const nearby = Math.min(local?.[resource] ?? 0, need - carried);
      if (local) local[resource] = Math.max(0, (local[resource] ?? 0) - nearby);
      const amount = carried + nearby;
      if (amount < need) { person.health -= resource === 'water' ? 12 : 8; short = true; }
    }
    if (short) lines.push({ tone: 'warn', title: `${person.name} mangler forsyninger i felt`, text: 'Lokalt lager og båret last dekker ikke behovet. Send faktiske forsyninger til laget.' });
  }
}

function consumePassengerMeals(state: RegionState, lines: ReportLine[]): void {
  const groups: Array<{ people: RegionState['population']; stock: Stock; zoneId?: string }> = [];
  for (const mission of Object.values(state.crewMissions ?? {})) if (!['complete', 'failed'].includes(mission.status) && mission.passengers) groups.push({ people: mission.passengers, stock: mission.cargo ??= {} });
  for (const [zoneId, people] of Object.entries(state.mobility?.depotResidents ?? {})) if (zoneId !== state.homeZoneId && !Object.values(state.administration?.regions ?? {}).some(r => r.hqZoneId === zoneId)) groups.push({ people, stock: state.mobility!.depots[zoneId] ??= {}, zoneId });
  for (const group of groups) {
    const count = group.people.adults + group.people.children + group.people.elderly;
    if (!count) continue;
    let shortage = false;
    for (const id of ['food', 'water']) { const need = count * difficultyRules(state).foodWater; const used = Math.min(group.stock[id] ?? 0, need); group.stock[id] = (group.stock[id] ?? 0) - used; if (used + .01 < need) shortage = true; }
    if (shortage) {
      group.people.sick = Math.min(count, group.people.sick + 1);
      state.population.sick = Math.min(state.population.adults + state.population.children + state.population.elderly, state.population.sick + 1);
      lines.push({ tone: 'warn', category: 'supply', priority: 85, title: 'Forsyningsmangel hos reisende eller lokalt depot', text: 'Gruppen bruker bare mat og vann som faktisk er ved dem.', zoneId: group.zoneId });
    }
  }
}

function patientsInZone(state: RegionState, zoneId: string): RegionSurvivor[] {
  return state.survivors.filter(person => { const position = crewPositionFor(state, person.id); return person.alive && !person.left && person.health < 80 && !(person.awayUntil && person.awayUntil > state.day) && position?.kind === 'zone' && position.zoneId === zoneId; });
}

/** A public presentation snapshot excludes hidden counts, private field reports and unobserved owners. */
function mapSnapshot(state: RegionState): RegionMapSnapshot {
  const zones: RegionMapSnapshot['zones'] = {};
  for (const [id, zone] of Object.entries(state.zones)) if (zone.status !== 'unknown' || zone.intel) {
    const ownerKnown = zone.owner && state.factions.some(f => f.id === zone.owner && f.known && !f.defeated);
    zones[id] = { status: zone.status, ...(zone.intel ? { intel: { ...zone.intel } } : {}), ...(ownerKnown ? { owner: zone.owner } : {}) };
  }
  const crewMissions = Object.fromEntries(Object.entries(state.crewMissions ?? {}).filter(([, m]) => !['complete', 'failed'].includes(m.status) || m.issuedDay >= state.day - 1).map(([id, mission]) => {
    const { cargo: _cargo, observations: _observations, factionObservations: _factions, privateLines: _private, order: _order, ...visible } = mission;
    return [id, visible];
  }));
  const live = new Set(state.survivors.filter(p => p.alive && !p.left && p.health > 0).map(p => p.id));
  return { homeZoneId: state.homeZoneId, zones, crewPositions: clone(Object.fromEntries(Object.entries(state.crewPositions ?? {}).filter(([id]) => live.has(id)))), crewMissions: clone(crewMissions) };
}
