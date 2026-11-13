/**
 * v0.4 crew geography and mission contracts.
 *
 * Pure data types, safe for JSON saves and deterministic replay. This module does
 * not move people: the future day resolver owns that transition. Existing
 * region-2 saves are read using the conservative legacy fallback below.
 */
import type { ActionId, RegionOrder, Stock, Population } from './types';

/** A named person is at a known L3 zone, not at an arbitrary map coordinate. */
export interface CrewAtZone {
  kind: 'zone';
  zoneId: string;
}

/**
 * Travel advances over a declared route of L3 zones. `atIndex` identifies the
 * current known route zone, including when the journey lasts multiple days.
 */
export interface CrewInTransit {
  kind: 'transit';
  fromZoneId: string;
  toZoneId: string;
  routeZoneIds: string[];
  atIndex: number;
  departedDay: number;
  estimatedArrivalDay: number;
}

/**
 * The unit holds a *whole area*, not a fabricated L3 position within an L2.
 * Render as perimeter/coverage rather than a point marker.
 */
export interface CrewAreaDuty {
  kind: 'area-duty';
  areaLevel: 2 | 3;
  areaZoneId: string;
  duty: 'guard' | 'patrol';
}

/**
 * Legacy v0.3 only recorded `awayUntil`. Its actual location is unknown: do
 * not silently put an away crew at HQ or its mission target.
 */
export interface CrewAwayUnknown {
  kind: 'away-unknown';
  expectedReturnDay?: number;

}

export type CrewPosition = CrewAtZone | CrewInTransit | CrewAreaDuty | CrewAwayUnknown;

export type CrewMissionStatus = 'reserved' | 'outbound' | 'working' | 'returning' | 'complete' | 'failed';

/**
 * One mission can involve multiple named people. Status changes are performed
 * by the authoritative simulation, never by this contract or UI components.
 */
export interface CrewMission {
  id: string;
  orderId: string;
  action: ActionId;
  survivorIds: string[];
  originZoneId: string;
  targetZoneId: string;
  issuedDay: number;
  status: CrewMissionStatus;
  expectedReturnDay?: number;
  order?: RegionOrder;
  routeZoneIds?: string[];
  routeIndex?: number;
  elapsedHours?: number;
  returnZoneId?: string;
  workHours?: number;
  cargo?: Stock;
  transportBoat?: number;
  privateLines?: import('./types').ReportLine[];
  passengers?: Population;
  cargoGearIds?: string[];
  encounterResolved?: boolean;
  lastAdvancedDay?: number;
  operationDone?: boolean;
  observations?: Record<string, { status: import('./types').ZoneStatus; intel?: { min: number; max: number; day: number } }>;
}

export interface CrewLocationState {
  day: number;
  homeZoneId: string;
  survivors: Array<{ id: string; alive: boolean; left?: boolean; awayUntil?: number }>;
  /** v0.4's sole placement authority when populated; omitted by legacy saves. */
  crewPositions?: Record<string, CrewPosition>;
}

/**
 * Safe read across save versions. `undefined` means the named person is dead,
 * has left or does not exist; no marker should be rendered for them.
 */
export function crewPositionFor(state: CrewLocationState, survivorId: string): CrewPosition | undefined {
  const survivor = state.survivors.find(person => person.id === survivorId);
  if (!survivor || !survivor.alive || survivor.left) return undefined;

  // Once the v0.4 location register exists, it is authoritative. An absent
  // entry is a data gap, not evidence that the person is standing at HQ.
  if (state.crewPositions !== undefined) return state.crewPositions[survivorId];

  // Only saves from before location tracking may use the legacy heuristic.
  if (survivor.awayUntil !== undefined && survivor.awayUntil > state.day) {
    return { kind: 'away-unknown', expectedReturnDay: survivor.awayUntil };
  }
  return { kind: 'zone', zoneId: state.homeZoneId };
}

/**
 * Returns a point-addressable L3 zone only for actually point-addressable
 * placements. Whole-area duty and untracked legacy errands deliberately do
 * not yield a guessed L3 zone.
 */
export function knownCrewL3Zone(position: CrewPosition): string | undefined {
  if (position.kind === 'zone') return position.zoneId;
  if (position.kind === 'transit') return position.routeZoneIds[position.atIndex];
  return undefined;
}

/** Reject malformed route states before committing them to a save. */
export function validCrewPosition(position: CrewPosition): boolean {
  if (position.kind === 'zone') return position.zoneId.length > 0;
  if (position.kind === 'area-duty') {
    return position.areaZoneId.length > 0
      && (position.areaLevel === 2 || position.areaLevel === 3)
      && (position.duty === 'guard' || position.duty === 'patrol');
  }
  if (position.kind === 'away-unknown') {
    return position.expectedReturnDay === undefined || Number.isInteger(position.expectedReturnDay);
  }
  if (position.kind !== 'transit') return false;
  return position.routeZoneIds.length > 0
    && position.fromZoneId === position.routeZoneIds[0]
    && position.toZoneId === position.routeZoneIds[position.routeZoneIds.length - 1]
    && position.routeZoneIds.every(Boolean)
    && Number.isInteger(position.atIndex)
    && position.atIndex >= 0
    && position.atIndex < position.routeZoneIds.length
    && Number.isInteger(position.departedDay)
    && Number.isInteger(position.estimatedArrivalDay)
    && position.estimatedArrivalDay >= position.departedDay;
}
