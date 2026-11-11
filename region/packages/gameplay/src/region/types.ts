/** The region game: the whole Stavanger region from the zone editor, one day per turn. */
import type { ZoneMeasures } from '../../../world-data/src/model';

export interface RegionZone {
  id: string; name: string; level: 1 | 2 | 3; parentId?: string;
  type?: string; potential?: Record<string, number>; finds?: string[]; produces?: string[];
  measures?: ZoneMeasures; at?: [number, number];
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
}
export interface RegionNeighbour { a: string; b: string; borderM: number }
export interface RegionLink { id: string; name: string; kind: 'bridge' | 'tunnel'; a: string; b: string; lengthM: number; poiId: string }
export interface RegionPoi {
  id: string; name: string; zoneId: string; role: '' | 'hq' | 'outpost' | 'facility' | 'resource'; kind: string; at: [number, number];
  hqType?: string; facilityType?: string; siteType?: string; lengthM?: number;
}
export interface RegionStart { zoneId: string; name: string; district: string; region: string; hqNearby: string[] }
export interface RegionWorld {
  schemaVersion: 1; worldId: string; worldVersion: string; sources: string[];
  zones: RegionZone[]; neighbours: RegionNeighbour[]; links: RegionLink[]; pois: RegionPoi[]; starts: RegionStart[];
}

export type Stock = Record<string, number>;
export type Weapon = 'melee' | 'pistol' | 'shotgun' | 'rifle';
/** Traits colour how a person reacts to the leader's choices. */
export type Trait = 'kind' | 'hard' | 'devout' | 'suspicious' | 'parent' | 'loner';
/** What a choice says about the leader. People with matching traits like or resent it. */
export type Stance = 'cruel' | 'merciful' | 'harsh' | 'charity' | 'children' | 'faith' | 'betrayal' | 'reckless';
export interface RegionSurvivor {
  id: string; name: string; role: string; about: string;
  skills: { combat: number; scouting: number; craft: number; medical: number };
  weapon: Weapon; health: number; fatigue: number; alive: boolean; joinedDay: number;
  traits?: Trait[];
  /** 0–100. Below 20 they may leave or turn on you. */
  loyalty?: number;
  /** Bitten: the day they turn unless treated. */
  bitten?: number;
  /** Away on a multi-day errand until this day. */
  awayUntil?: number;
  /** Walked out on the group (not dead). */
  left?: boolean;
}
export type ZoneStatus = 'unknown' | 'scouted' | 'controlled';
export interface RegionZoneState {
  zombies: number;
  /** What the player believes: a range, and the day it was seen. */
  intel?: { min: number; max: number; day: number };
  status: ZoneStatus;
  /** Search hours done, and what is left to find. */
  searched: number; loot: Stock;
  upgrades: string[];
  building?: { id: string; hours: number };
  /** Set when an NPC group holds the zone. */
  owner?: string;
}
export type ChokepointState = 'open' | 'held' | 'blocked' | 'blown' | 'flooded';
export interface RegionFaction {
  id: string; name: string; zoneId: string; about: string;
  offers: string[]; wants: string[]; stock: Stock;
  relation: number; known: boolean; tradedDay?: number;
  /** Fighting strength, for raids both ways. */
  strength?: number;
  /** Open enemies demand and raid; masked ones smile until they strike. */
  hostile?: boolean;
  /** Hidden: what they really want. Revealed by intelligence, scouting or too late. */
  intent?: 'honest' | 'betray';
  revealed?: boolean;
  defeated?: boolean;
}
export interface RegionHq { zoneId: string; type: string; modules: string[]; building?: { id: string; hours: number } }

export type ActionId = 'scout' | 'clear' | 'search' | 'claim' | 'fortify' | 'build' | 'establishHq' | 'module' | 'network'
  | 'guard' | 'hold' | 'block' | 'blow' | 'farm' | 'fish' | 'rest' | 'heal' | 'craft'
  | 'research' | 'relocate' | 'assault' | 'repair' | 'wonder';
export interface RegionOrder { id: string; action: ActionId; zoneId: string; survivorIds: string[]; target?: string }

/** The population that is not the named crew: counted, not named. */
export interface Population { adults: number; children: number; elderly: number; sick: number }
export type WorkId = 'farm' | 'fish' | 'scavenge' | 'clear' | 'guard' | 'build' | 'research';

export interface ReportLine { tone: 'info' | 'good' | 'warn' | 'bad'; title: string; text: string; zoneId?: string }
export interface RegionReport {
  day: number; lines: ReportLine[];
  food: { produced: number; eaten: number; spoiled?: number }; water: { produced: number; drunk: number };
  zombiesMoved: number; killed: number;
  /** The night's biggest movements you could see: into, out of or between zones you know. */
  moves?: { from: string; to: string; n: number }[];
}
export interface EventChoice { id: string; label: string; detail: string; disabled?: string; tags?: Stance[] }
export interface PendingEvent {
  id: string; title: string; text: string; zoneId?: string; factionId?: string; choices: EventChoice[];
  data?: Record<string, string | number>;
  /** Shown above the choices: who in the crew objects or agrees. */
  voices?: string[];
  kicker?: string;
}

export interface RegionState {
  schema: 'region-2'; rulesVersion: string; worldVersion: string; seed: number; day: number;
  startZoneId: string; homeZoneId: string;
  survivors: RegionSurvivor[]; stock: Stock;
  /** Hope: the long fuel. At 0 the group falls apart. */
  morale: number;
  /** Discontent: the short fuse. At 100 someone takes the leadership from you. */
  discontent: number;
  population: Population;
  work: Record<WorkId, number>;
  laws: string[]; lawDay: number;
  research: { done: string[]; current?: string; progress: number };
  phase: number; phaseDay: number;
  mutations: { id: string; day: number; known: boolean }[];
  zones: Record<string, RegionZoneState>;
  /** Barricades on land borders and links, by connection id: durability left, and tier. */
  barricades: Record<string, number>;
  barricadeTier: Record<string, number>;
  chokepoints: Record<string, ChokepointState>;
  hq?: RegionHq;
  /** Unique places you hold: level 0 is found, higher levels are built. */
  wonders?: Record<string, { level: number; zoneId: string; progress: number }>;
  /** Networks built per L2 zone. */
  networks: Record<string, string[]>;
  factions: RegionFaction[];
  event?: PendingEvent;
  /** Chains: events that will come back on a given day. */
  scheduled: { day: number; id: string; data?: Record<string, string | number> }[];
  /** Small facts that events remember. */
  flags: Record<string, string | number>;
  /** Big choices, in a sentence each, for the chronicle. */
  memory: { day: number; text: string }[];
  milestones: string[];
  reports: RegionReport[];
  counters: Record<string, number>;
  gameOver?: { day: number; reason: string; won?: boolean };
}
