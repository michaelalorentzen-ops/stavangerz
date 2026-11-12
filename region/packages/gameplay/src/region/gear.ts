/** V04-05: unique, physically held gear. All scores/slots are playtest hypotheses. */
import type { ActionId, RegionOrder, RegionState, RegionSurvivor, RegionWorld, ReportLine, Weapon } from './types';
import { crewPositionFor } from './location';
import { WEAPONS } from './rules';

export type GearSlot = 'weapon' | 'protection' | 'tool';
export interface GearPreference {
  /** Default true. False keeps the existing personal loadout plus explicit locks. */
  autoEquip?: boolean;
  /** A null lock deliberately leaves a slot empty. Missing keys remain automatic. */
  locks?: Partial<Record<GearSlot, string | null>>;
}
export type GearPreferences = Record<string, GearPreference>;
export type GearLoadout = Partial<Record<GearSlot, string>>;
export type GearLocation =
  | { kind: 'stored'; zoneId: string }
  | { kind: 'carried'; survivorId: string; missionId?: string; targetZoneId?: string; returnDay?: number; returnToZoneId?: string; atZoneId?: string }
  | { kind: 'lost'; day: number; survivorId?: string; zoneId?: string };
export interface GearItem {
  id: string;
  kind: string;
  /** Omitted on older saves means already known. Unreported field finds stay private. */
  reported?: boolean;
  location: GearLocation;
  provenance: { kind: 'personal' | 'search'; survivorId?: string; zoneId?: string; milestone?: number; day: number };
}
export interface GearMission { orderId: string; targetZoneId: string; returnDay: number; returnToZoneId: string; arrived?: boolean }
export interface RegionGearState {
  version: 1;
  items: GearItem[];
  loadouts: Record<string, GearLoadout>;
  /** Also tracks a person who deliberately left every equipment slot empty. */
  missions: Record<string, GearMission>;
  preferences: GearPreferences;
  /** IDs remain here after an item is lost: the same finite cache cannot respawn. */
  claimedLoot: string[];
}
export interface GearDefinition {
  id: string; name: string; slot: GearSlot; description: string;
  weapon?: Weapon; protection?: number; hours?: Partial<Record<ActionId, number>>;
  scouting?: number; medical?: number; noise?: number; weight: number;
}
export const GEAR_CATALOG: Readonly<Record<string, GearDefinition>> = {
  ...Object.fromEntries(Object.entries(WEAPONS).map(([id, w]) => [id, {
    id, name: w.label, slot: 'weapon' as const, weapon: id as Weapon, weight: id === 'melee' ? 1 : 2,
    description: w.ammo ? `Bruker ammunisjon. Støy ${w.noise}; større kampkraft enn nærkamp.` : 'Stille og uten ammunisjon. Mindre kampkraft enn skytevåpen.',
  }])),
  workcoat: { id: 'workcoat', name: 'Solid arbeidsjakke', slot: 'protection', protection: .1, weight: 1.2, description: 'Demper fysisk skade med 10 %. Stopper ikke bitt.' },
  helmet: { id: 'helmet', name: 'Vernehjelm', slot: 'protection', protection: .15, weight: 1, description: 'Demper fysisk skade med 15 %. Stopper ikke bitt.' },
  vest: { id: 'vest', name: 'Beskyttelsesvest', slot: 'protection', protection: .2, weight: 2.5, description: 'Demper fysisk skade med 20 %. Stopper ikke bitt.' },
  crowbar: { id: 'crowbar', name: 'Brekkjern', slot: 'tool', hours: { search: .12 }, weight: 1.5, description: '12 % mer søkearbeid. Må følge laget og leveres tilbake.' },
  binoculars: { id: 'binoculars', name: 'Kikkert', slot: 'tool', scouting: 1, weight: .6, description: '+1 speiding ved observasjon. Brukes ikke som våpen.' },
  toolbox: { id: 'toolbox', name: 'Verktøysett', slot: 'tool', hours: { fortify: .1, build: .1, module: .1, network: .1, repair: .1, wonder: .1, craft: .1 }, weight: 2, description: '10 % mer bygge- og verkstedsarbeid.' },
  medkit: { id: 'medkit', name: 'Feltveske', slot: 'tool', medical: 1, weight: 1, description: '+1 medisinsk kompetanse ved behandling. Medisin forbrukes som før.' },
  flashlight: { id: 'flashlight', name: 'Lommelykt', slot: 'tool', hours: { search: .08 }, noise: .2, weight: .4, description: '8 % mer søkearbeid. Lys kan trekke oppmerksomhet (+0,2 signal).' },
};
export const GEAR_SLOTS: readonly GearSlot[] = ['weapon', 'protection', 'tool'];
export const gearItemName = (item: GearItem) => GEAR_CATALOG[item.kind]?.name ?? item.kind;
const SLOT_NAMES: Record<GearSlot, string> = { weapon: 'våpen', protection: 'beskyttelse', tool: 'oppdragsverktøy' };
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A canonical non-home/transit/unknown position is never overwritten by a gear guess. */
function physicallyHome(state: RegionState, survivorId: string): boolean {
  const person = state.survivors.find(s => s.id === survivorId);
  const position = crewPositionFor(state, survivorId);
  return !!person && !(person.awayUntil && person.awayUntil > state.day)
    && position?.kind === 'zone' && position.zoneId === state.homeZoneId;
}
function livingPerson(state: RegionState, id: string) {
  return state.survivors.find(s => s.id === id && s.alive && !s.left && s.health > 0);
}
/** Read-compatible normalization. Does not invent new equipment or heal unknown locations. */
export function gearStateFor(state: RegionState): RegionGearState {
  const gear: RegionGearState = state.gear ? copy(state.gear) : { version: 1, items: [], loadouts: {}, missions: {}, preferences: {}, claimedLoot: [] };
  gear.missions ??= {};
  gear.preferences ??= {};
  gear.claimedLoot ??= [];
  for (const person of state.survivors) {
    const id = `starter:${person.id}`;
    if (gear.items.some(item => item.id === id)) continue;
    gear.items.push({ id, kind: person.weapon, reported: true, location: person.alive && !person.left
      ? { kind: 'carried', survivorId: person.id }
      : { kind: 'lost', survivorId: person.id, day: state.day },
    provenance: { kind: 'personal', survivorId: person.id, day: person.joinedDay } });
    (gear.loadouts[person.id] ??= {}).weapon ??= id;
  }
  return gear;
}

/** Only stored equipment at the current depot or this person's own real inventory. */
function canUse(state: RegionState, item: GearItem, survivorId: string): boolean {
  const person = livingPerson(state, survivorId);
  if (item.reported === false || !person || (person.awayUntil && person.awayUntil > state.day) || crewGearAway(state, survivorId)) return false;
  if (item.location.kind === 'stored') return item.location.zoneId === state.homeZoneId && person.health >= 25 && physicallyHome(state, survivorId);
  return item.location.kind === 'carried' && item.location.survivorId === survivorId && !item.location.missionId;
}
export const knownGearItems = (state: RegionState): GearItem[] => gearStateFor(state).items.filter(item => item.reported !== false);
export function availableGear(state: RegionState, survivorId: string, slot?: GearSlot): GearItem[] {
  return gearStateFor(state).items.filter(item => canUse(state, item, survivorId) && (!slot || GEAR_CATALOG[item.kind]?.slot === slot));
}
export function crewGearAway(state: RegionState, survivorId: string): boolean {
  return !!(state.gear?.missions?.[survivorId] && state.gear.missions[survivorId].targetZoneId !== state.homeZoneId) || !!state.gear?.items.some(item => item.location.kind === 'carried' && item.location.survivorId === survivorId
    && !!item.location.missionId && item.location.targetZoneId !== state.homeZoneId);
}
export function equippedGear(state: RegionState, survivorId: string, slot: GearSlot): GearDefinition | undefined {
  const gear = state.gear;
  if (!gear) return slot === 'weapon' ? GEAR_CATALOG[state.survivors.find(s => s.id === survivorId)?.weapon ?? ''] : undefined;
  const itemId = gear.loadouts[survivorId]?.[slot];
  const item = gear.items.find(item => item.id === itemId && item.location.kind === 'carried' && item.location.survivorId === survivorId);
  return item ? GEAR_CATALOG[item.kind] : undefined;
}
export function gearWeapon(state: RegionState, person: RegionSurvivor): Weapon {
  return equippedGear(state, person.id, 'weapon')?.weapon ?? 'melee';
}
export const gearDamageMultiplier = (state: RegionState, survivorId: string) => 1 - (equippedGear(state, survivorId, 'protection')?.protection ?? 0);
export function gearWorkMultiplier(state: RegionState, survivorId: string, action: ActionId): number {
  return 1 + (equippedGear(state, survivorId, 'tool')?.hours?.[action] ?? 0);
}

function score(item: GearItem, action: ActionId, ammo: number): number {
  const def = GEAR_CATALOG[item.kind];
  if (!def) return -1;
  if (def.weapon) {
    const w = WEAPONS[def.weapon];
    if (['clear', 'assault', 'guard', 'hold'].includes(action)) return w.kills - (w.ammo && ammo < 3 ? 5 : 0);
    // Observers prefer quiet tools; existing legacy weapons remain theirs when no alternative exists.
    return 4 - w.noise * .4;
  }
  if (def.slot === 'protection') return def.protection ?? 0;
  return (def.hours?.[action] ?? 0) * 10 + (action === 'scout' ? def.scouting ?? 0 : 0)
    + (action === 'heal' ? def.medical ?? 0 : 0) - (def.noise ?? 0) * .1;
}
export interface GearCrewPlan {
  survivorId: string; loadout: GearLoadout; items: Partial<Record<GearSlot, GearItem>>;
  preference: GearPreference; available: GearItem[]; unavailable?: string;
}
export interface GearOrderPlan { orderId: string; crew: GearCrewPlan[]; errors: string[] }
export interface GearPlan {
  items: GearItem[];
  reservations: Record<string, { orderId: string; survivorId: string }>;
  orders: GearOrderPlan[];
  errors: string[];
  /** Engine adapter only: the same prospective loadouts used by the UI. */
  gear: RegionGearState;
}

/** Pure reservation planner. The engine supplies its own authoritative order validator. */
export function planGearForOrders(
  state: RegionState, _world: RegionWorld, orders: readonly RegionOrder[], preferences: GearPreferences = {},
  validate: (order: RegionOrder) => string[] = () => [],
): GearPlan {
  let gear = gearStateFor(state);
  const snapshot = { ...state, gear };
  const reservations: GearPlan['reservations'] = {};
  const plans: GearOrderPlan[] = [];
  const used = new Set<string>();
  for (const order of orders) {
    const gearBeforeOrder = copy(gear);
    const errors = [...validate(order)];
    // A deliberate HQ handover is transactional and precedes all same-crew picks.
    // This makes e.g. Marius' explicitly released rifle available to Tor in one order.
    for (const personId of order.survivorIds) {
      const preference = order.gear?.[personId] ?? preferences[personId] ?? gear.preferences[personId] ?? {};
      if (used.has(personId) || !physicallyHome(state, personId) || (livingPerson(state, personId)?.health ?? 0) < 25 || crewGearAway(state, personId)) continue;
      for (const slot of GEAR_SLOTS) {
        if (!Object.prototype.hasOwnProperty.call(preference.locks ?? {}, slot)) continue;
        const oldId = gear.loadouts[personId]?.[slot];
        if (!oldId || preference.locks?.[slot] === oldId || reservations[oldId]) continue;
        const old = gear.items.find(item => item.id === oldId);
        if (old?.location.kind === 'carried' && !old.location.missionId) {
          old.location = { kind: 'stored', zoneId: state.homeZoneId };
          delete gear.loadouts[personId][slot];
        }
      }
    }
    const crew: GearCrewPlan[] = [];
    const staged: Array<{ personId: string; loadout: GearLoadout; preference: GearPreference }> = [];
    for (const survivorId of order.survivorIds) {
      const person = livingPerson(state, survivorId);
      const preference = copy(order.gear?.[survivorId] ?? preferences[survivorId] ?? gear.preferences[survivorId] ?? {});
      const selected: GearLoadout = {};
      const items: GearCrewPlan['items'] = {};
      const available: GearItem[] = [];
      let unavailable: string | undefined;
      if (!person || (person.awayUntil && person.awayUntil > state.day) || crewGearAway(state, survivorId)) unavailable = 'Personen er borte eller utilgjengelig.';
      else if (used.has(survivorId)) unavailable = 'Personen er allerede reservert i en tidligere ordre.';
      else if (person.health < 25 && !['rest', 'heal'].includes(order.action)) unavailable = 'Personen er for skadet til oppdrag.';
      if (unavailable) errors.push(`${person?.name ?? survivorId}: ${unavailable}`);
      for (const slot of GEAR_SLOTS) {
        const hasLock = Object.prototype.hasOwnProperty.call(preference.locks ?? {}, slot);
        const lockedId = preference.locks?.[slot];
        const candidates = gear.items.filter(item => !reservations[item.id] && canUse(snapshot, item, survivorId) && GEAR_CATALOG[item.kind]?.slot === slot);
        available.push(...copy(candidates));
        let item: GearItem | undefined;
        if (hasLock) {
          if (lockedId !== null) {
            item = candidates.find(item => item.id === lockedId);
            if (!item) errors.push(`${person?.name ?? survivorId}: låst utstyr er utilgjengelig (${SLOT_NAMES[slot]}).`);
          }
        } else if (preference.autoEquip === false) {
          item = candidates.find(item => item.id === gear.loadouts[survivorId]?.[slot]);
        } else {
          item = [...candidates].sort((a, b) => score(b, order.action, state.stock.ammo ?? 0) - score(a, order.action, state.stock.ammo ?? 0)
            || Number(b.id === gear.loadouts[survivorId]?.[slot]) - Number(a.id === gear.loadouts[survivorId]?.[slot]) || a.id.localeCompare(b.id))[0];
          if (item && slot === 'tool' && score(item, order.action, state.stock.ammo ?? 0) <= 0) item = undefined;
        }
        if (item && !unavailable) { selected[slot] = item.id; items[slot] = item; }
      }
      staged.push({ personId: survivorId, loadout: selected, preference });
      crew.push({ survivorId, loadout: selected, items, preference, available, ...(unavailable ? { unavailable } : {}) });
      // Reserve immediately for the next person in this same crew, not just the next order.
      if (!unavailable) for (const item of Object.values(items)) reservations[item.id] = { orderId: order.id, survivorId };
    }
    if (errors.length) {
      for (const [id, reservation] of Object.entries(reservations)) if (reservation.orderId === order.id) delete reservations[id];
      gear = gearBeforeOrder; snapshot.gear = gear;
    } else {
      for (const { personId, loadout, preference } of staged) {
        used.add(personId);
        gear.preferences[personId] = preference;
        // Replacement at camp is an actual handover. Nobody else's carried gear is pooled.
        for (const oldId of Object.values(gear.loadouts[personId] ?? {})) {
          if (Object.values(loadout).includes(oldId)) continue;
          const old = gear.items.find(item => item.id === oldId);
          if (old?.location.kind === 'carried' && !old.location.missionId && physicallyHome(state, personId)
            && (livingPerson(state, personId)?.health ?? 0) >= 25) old.location = { kind: 'stored', zoneId: state.homeZoneId };
        }
        gear.loadouts[personId] = loadout;
        for (const id of Object.values(loadout)) {
          const item = gear.items.find(item => item.id === id)!;
          item.location = { kind: 'carried', survivorId: personId };
        }
      }
    }
    plans.push({ orderId: order.id, crew, errors });
  }
  return { items: gear.items.filter(item => item.reported !== false), gear, reservations, orders: plans, errors: plans.flatMap(order => order.errors) };
}

/** Bind gear through the serialized night checkpoint, never exposing it to another order. */
export function departGear(state: RegionState, order: RegionOrder): void {
  if (!state.gear) return;
  for (const survivorId of order.survivorIds) {
    const person = livingPerson(state, survivorId);
    state.gear.missions[survivorId] = { orderId: order.id, targetZoneId: order.zoneId,
      returnDay: Math.max(state.day + 1, person?.awayUntil ?? 0), returnToZoneId: state.homeZoneId };
  }
  for (const item of state.gear.items) {
    if (item.location.kind !== 'carried' || !order.survivorIds.includes(item.location.survivorId)) continue;
    const person = livingPerson(state, item.location.survivorId);
    item.location = { ...item.location, missionId: order.id, targetZoneId: order.zoneId,
      returnDay: Math.max(state.day + 1, person?.awayUntil ?? 0), returnToZoneId: state.homeZoneId };
  }
}
/** Known arrival beats a planned destination; an unknown legacy route returns where issued. */
function returnZone(state: RegionState, survivorId: string, planned: string): string | undefined {
  const person = livingPerson(state, survivorId);
  if (!person || person.awayUntil && person.awayUntil > state.day) return undefined;
  if (state.crewPositions !== undefined) {
    const position = state.crewPositions[survivorId];
    return position?.kind === 'zone' ? position.zoneId : undefined;
  }
  return planned;
}
/** Only called at actual day settlement/arrival. Injured people keep personal gear. */
export function settleGearReturns(state: RegionState, lines: ReportLine[] = []): void {
  if (!state.gear) return;
  const returned: string[] = [];
  const newFinds: string[] = [];
  for (const item of state.gear.items) {
    if (item.location.kind !== 'carried') continue;
    const carrierId = item.location.survivorId;
    const person = livingPerson(state, carrierId);
    if (!person) {
      item.location = { kind: 'lost', day: state.day, survivorId: carrierId, zoneId: item.location.targetZoneId ?? item.location.atZoneId };
      for (const [slot, id] of Object.entries(state.gear.loadouts[carrierId] ?? {})) if (id === item.id) delete state.gear.loadouts[carrierId][slot as GearSlot];
      continue;
    }
    let arrival: string | undefined;
    if (item.location.missionId) {
      if ((item.location.returnDay ?? Infinity) > state.day) continue;
      arrival = returnZone(state, carrierId, item.location.returnToZoneId ?? state.homeZoneId);
    } else {
      // Recover formerly unselected gear when its injured owner can finally hand it in.
      arrival = returnZone(state, carrierId, item.location.atZoneId ?? state.homeZoneId);
    }
    if (!arrival) continue;
    const assigned = Object.values(state.gear.loadouts[carrierId] ?? {}).includes(item.id);
    const shouldStore = person.health >= 25 && (!assigned || GEAR_CATALOG[item.kind]?.slot === 'tool' && !!item.location.missionId);
    if (shouldStore) {
      item.location = { kind: 'stored', zoneId: arrival };
      for (const [slot, id] of Object.entries(state.gear.loadouts[carrierId] ?? {})) if (id === item.id) delete state.gear.loadouts[carrierId][slot as GearSlot];
      if (arrival === state.homeZoneId && item.reported === false) { item.reported = true; newFinds.push(gearItemName(item)); }
      else if (item.reported !== false) returned.push(`${gearItemName(item)}${arrival === state.homeZoneId ? '' : ' (ved tidligere leirsted)'}`);
    } else item.location = { kind: 'carried', survivorId: carrierId, atZoneId: arrival };
  }
  for (const [personId, mission] of Object.entries(state.gear.missions ?? {})) {
    if (!livingPerson(state, personId)) { delete state.gear.missions[personId]; continue; }
    if (mission.returnDay > state.day) continue;
    const arrival = returnZone(state, personId, mission.arrived ? mission.targetZoneId : mission.returnToZoneId);
    if (!arrival) continue;
    if (arrival === state.homeZoneId) delete state.gear.missions[personId];
    else state.gear.missions[personId] = { ...mission, targetZoneId: arrival, arrived: true };
  }
  if (newFinds.length) lines.push({ tone: 'good', title: 'Personlig utstyr funnet', text: `${newFinds.join(', ')} er nå levert i leiren og kan fordeles.` });
  if (returned.length) lines.push({ tone: 'info', title: 'Utstyr levert ved hjemkomst', text: `${returned.join(', ')}. Bare lageret i nåværende leir er tilgjengelig der.` });
}
/** Explicit whole-group relocation only; stored items use remaining physical carrying room. */
export function moveGearDepot(state: RegionState, from: string, to: string, capacity = 0): void {
  if (from === to) return;
  let remaining = Math.max(0, capacity);
  for (const item of state.gear?.items ?? []) {
    if (item.location.kind !== 'stored' || item.location.zoneId !== from) continue;
    const weight = GEAR_CATALOG[item.kind]?.weight ?? 1;
    if (weight > remaining) continue;
    remaining -= weight;
    item.location.zoneId = to;
  }
}

const searchKinds = ['crowbar', 'workcoat', 'binoculars', 'toolbox', 'flashlight', 'helmet', 'medkit', 'pistol', 'vest', 'shotgun', 'rifle'] as const;
function hash(seed: number, key: string): number {
  let n = 2166136261;
  for (const char of `${seed}|${key}`) n = Math.imul(n ^ char.charCodeAt(0), 16777619) >>> 0;
  return n;
}
/** Three finite seeded caches per zone. Pre-existing searched progress is never replayed. */
export function discoverSearchGear(
  state: RegionState, zoneId: string, before: number, after: number, total: number, order: RegionOrder,
): GearItem[] {
  if (!state.gear || !order.survivorIds.length || after <= before) return [];
  const thresholds = [Math.min(2, total * .15), total * .5, total * .9];
  const found: GearItem[] = [];
  thresholds.forEach((threshold, milestone) => {
    const id = `search:${zoneId}:${milestone}`;
    if (threshold <= before || threshold > after || state.gear!.claimedLoot.includes(id)) return;
    state.gear!.claimedLoot.push(id);
    const survivorId = order.survivorIds[milestone % order.survivorIds.length];
    const person = livingPerson(state, survivorId);
    const kind = searchKinds[hash(state.seed, id) % searchKinds.length];
    const item: GearItem = { id, kind, reported: false, provenance: { kind: 'search', zoneId, milestone, day: state.day },
      location: { kind: 'carried', survivorId, missionId: order.id, targetZoneId: zoneId,
        returnDay: Math.max(state.day + 1, person?.awayUntil ?? 0), returnToZoneId: state.homeZoneId } };
    state.gear!.items.push(item);
    found.push(item);
  });
  return found;
}

/** Keep legacy event disarm effects meaningful even after unique inventory exists. */
export function confiscateGearWeapon(state: RegionState, survivorId: string): void {
  if (!state.gear) return; // Legacy scalar remains authoritative until materialization.
  for (const item of state.gear.items) {
    if (GEAR_CATALOG[item.kind]?.slot === 'weapon' && item.location.kind === 'carried' && item.location.survivorId === survivorId) {
      item.location = { kind: 'lost', survivorId, day: state.day, zoneId: state.homeZoneId };
    }
  }
  delete state.gear.loadouts[survivorId]?.weapon;
  const preference = state.gear.preferences[survivorId] ?? {};
  state.gear.preferences[survivorId] = { ...preference, locks: { ...preference.locks, weapon: null } };
}
