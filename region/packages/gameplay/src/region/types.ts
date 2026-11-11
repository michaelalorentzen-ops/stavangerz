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
export interface RegionSurvivor {
  id: string; name: string; role: string; about: string;
  skills: { combat: number; scouting: number; craft: number; medical: number };
  weapon: Weapon; health: number; fatigue: number; alive: boolean; joinedDay: number;
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
}
export interface RegionHq { zoneId: string; type: string; modules: string[]; building?: { id: string; hours: number } }

export type ActionId = 'scout' | 'clear' | 'search' | 'claim' | 'fortify' | 'build' | 'establishHq' | 'module' | 'network'
  | 'guard' | 'hold' | 'block' | 'blow' | 'farm' | 'fish' | 'rest' | 'heal' | 'craft';
export interface RegionOrder { id: string; action: ActionId; zoneId: string; survivorIds: string[]; target?: string }

export interface ReportLine { tone: 'info' | 'good' | 'warn' | 'bad'; title: string; text: string; zoneId?: string }
export interface RegionReport {
  day: number; lines: ReportLine[];
  food: { produced: number; eaten: number }; water: { produced: number; drunk: number };
  zombiesMoved: number; killed: number;
}
export interface EventChoice { id: string; label: string; detail: string; disabled?: string }
export interface PendingEvent { id: string; title: string; text: string; zoneId?: string; factionId?: string; choices: EventChoice[]; data?: Record<string, string | number> }

export interface RegionState {
  schema: 'region-1'; rulesVersion: string; worldVersion: string; seed: number; day: number;
  startZoneId: string; homeZoneId: string;
  survivors: RegionSurvivor[]; stock: Stock; morale: number;
  zones: Record<string, RegionZoneState>;
  /** Barricades on land borders and links, by connection id: durability left. */
  barricades: Record<string, number>;
  chokepoints: Record<string, ChokepointState>;
  hq?: RegionHq;
  /** Networks built per L2 zone. */
  networks: Record<string, string[]>;
  factions: RegionFaction[];
  event?: PendingEvent;
  milestones: string[];
  reports: RegionReport[];
  counters: Record<string, number>;
  gameOver?: { day: number; reason: string };
}
