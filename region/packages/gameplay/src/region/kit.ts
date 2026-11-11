/**
 * The toolkit events are written with. Events are content: they read the state, offer choices and change the state
 * only through these helpers, so the rules stay in one place.
 */
import type { EventChoice, PendingEvent, Population, RegionState, RegionSurvivor, RegionWorld, ReportLine, Stock } from './types';
import { controlled, has, indexWorld, living, resourceName, season } from './engine';

export interface EventDef {
  id: string;
  /** Relative chance among eligible events. */
  weight: number;
  /** Small good surprises can come any day; the rest only on the weekly roll. */
  good?: boolean;
  /** Earliest and latest phase. */
  phase?: [number, number];
  /** Only happens through `schedule` from another event. */
  chainOnly?: boolean;
  /** Happens at most once per game. */
  once?: boolean;
  when: (s: RegionState, w: RegionWorld) => boolean;
  make: (s: RegionState, w: RegionWorld, rng: () => number, data?: Record<string, string | number>) => Omit<PendingEvent, 'id'> | null;
  resolve: (s: RegionState, w: RegionWorld, choice: string, rng: () => number, lines: ReportLine[]) => void;
}

// ------------------------------------------------------------------ stock

export const amount = (s: RegionState, id: string) => s.stock[id] ?? 0;
export const give = (s: RegionState, id: string, n: number) => { s.stock[id] = Math.max(0, Math.round(((s.stock[id] ?? 0) + n) * 10) / 10); };
export const takeShare = (s: RegionState, id: string, share: number) => { const n = Math.round(amount(s, id) * share); give(s, id, -n); return n; };
/** A reason the choice is disabled, or undefined if the stock covers it. */
export const need = (s: RegionState, cost: Stock) => has(s.stock, cost) ? undefined : `Dere har ikke ${Object.entries(cost).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(' og ')}.`;
export const pay = (s: RegionState, cost: Stock) => { for (const [id, n] of Object.entries(cost)) give(s, id, -n); };

// ------------------------------------------------------------------ people

export const totalPeople = (s: RegionState) => living(s).length + s.population.adults + s.population.children + s.population.elderly;
export function addPeople(s: RegionState, add: Partial<Population>) {
  for (const [k, n] of Object.entries(add) as [keyof Population, number][]) s.population[k] = Math.max(0, Math.round(s.population[k] + n));
  s.population.sick = Math.min(s.population.sick, s.population.adults + s.population.children + s.population.elderly);
}
/** Remove people from the counted population; returns how many actually went. */
export function removePeople(s: RegionState, kind: keyof Population, n: number) {
  const gone = Math.min(n, s.population[kind]);
  s.population[kind] -= gone;
  if (kind !== 'sick') s.population.sick = Math.min(s.population.sick, s.population.adults + s.population.children + s.population.elderly);
  return gone;
}
/** A random named crew member at camp, optionally filtered. */
export function pickCrew(s: RegionState, rng: () => number, filter: (p: RegionSurvivor) => boolean = () => true) {
  const options = living(s).filter(p => !(p.awayUntil && p.awayUntil > s.day)).filter(filter);
  return options.length ? options[Math.floor(rng() * options.length)] : undefined;
}
export const crewById = (s: RegionState, id?: string | number) => s.survivors.find(p => p.id === String(id) && p.alive);
export function hurtPerson(s: RegionState, p: RegionSurvivor, harm: number, lines: ReportLine[], text: string) {
  p.health -= harm;
  lines.push({ tone: 'bad', title: `${p.name} ble skadet`, text });
}
export function killPerson(s: RegionState, p: RegionSurvivor, lines: ReportLine[], text: string) {
  p.alive = false; p.health = 0;
  s.morale -= 8;
  lines.push({ tone: 'bad', title: `${p.name} er død`, text });
  remember(s, `${p.name} døde. ${text}`);
}
/** A crew member walks out, maybe with something. */
export function leaves(s: RegionState, p: RegionSurvivor, lines: ReportLine[], text: string, took?: Stock) {
  p.alive = false; p.health = 0; p.about = `Forlot gruppen dag ${s.day}.`;
  p.left = true;
  if (took) pay(s, took);
  lines.push({ tone: 'bad', title: `${p.name} forlot dere`, text });
  remember(s, `${p.name} forlot gruppen.`);
}
export function loyalty(p: RegionSurvivor, n: number) { p.loyalty = Math.max(0, Math.min(100, (p.loyalty ?? 60) + n)); }

// ------------------------------------------------------------------ mood

/** Hope is the long fuel; it settles towards a target, but shocks move it now. */
export const hope = (s: RegionState, n: number) => { s.morale = Math.max(0, Math.min(100, s.morale + n)); };
/** Discontent is the short fuse. */
export const unrest = (s: RegionState, n: number) => { s.discontent = Math.max(0, Math.min(100, s.discontent + n)); };

// ------------------------------------------------------------------ memory and chains

export function schedule(s: RegionState, inDays: number, id: string, data?: Record<string, string | number>) {
  s.scheduled.push({ day: s.day + Math.max(1, Math.round(inDays)), id, data });
}
export const flag = (s: RegionState, key: string) => s.flags[key];
export const setFlag = (s: RegionState, key: string, value: string | number) => { s.flags[key] = value; };
export const remember = (s: RegionState, text: string) => { s.memory.push({ day: s.day, text }); if (s.memory.length > 80) s.memory.shift(); };

// ------------------------------------------------------------------ rules the events check

export const hasLaw = (s: RegionState, id: string) => s.laws.includes(id);
export const hasTech = (s: RegionState, id: string) => s.research.done.includes(id);
export const hasModule = (s: RegionState, id: string) => !!s.hq?.modules.includes(id);
export const seasonName = (s: RegionState) => season(s.day).name;
export const chance = (rng: () => number, p: number) => rng() < p;
export const pickOne = <T>(rng: () => number, list: T[]) => list[Math.floor(rng() * list.length)];

// ------------------------------------------------------------------ places

export const ownedZones = (s: RegionState) => controlled(s);
export const coastalOwned = (s: RegionState, w: RegionWorld) => controlled(s).filter(id => indexWorld(w).coastal.has(id));
export const farmOwned = (s: RegionState, w: RegionWorld) => controlled(s).filter(id => (indexWorld(w).byId.get(id)?.measures?.farm ?? 0) > 1e4);
/** Zones next to what you hold that are not yours or another group's. */
export function borderZones(s: RegionState, w: RegionWorld) {
  const index = indexWorld(w);
  const owned = new Set(controlled(s));
  return [...new Set([...owned].flatMap(id => (index.adjacent.get(id) ?? []).map(a => a.to)).filter(id => !owned.has(id) && !s.zones[id].owner))];
}
export const zoneName = (w: RegionWorld, id?: string | number) => (id !== undefined && indexWorld(w).byId.get(String(id))?.name) || 'området';
/** Zones with a place of a given kind (hqType, siteType or facilityType), e.g. 'hospital', 'mall', 'school'. */
export const zonesWith = (w: RegionWorld, kind: string) => [...new Set(w.pois.filter(p => p.hqType === kind || p.siteType === kind || p.facilityType === kind).map(p => p.zoneId))];
export const homeName = (s: RegionState, w: RegionWorld) => zoneName(w, s.homeZoneId);

/** Turn a list of choices into the event shape. */
export function event(title: string, text: string, choices: EventChoice[], extra: Partial<Omit<PendingEvent, 'id' | 'title' | 'text' | 'choices'>> = {}): Omit<PendingEvent, 'id'> {
  return { title, text, choices, ...extra };
}
