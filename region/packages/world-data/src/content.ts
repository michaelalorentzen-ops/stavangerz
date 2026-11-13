/**
 * What zones and places contain, and what that is worth in concrete numbers.
 * The catalog is shared with the zone editor (tools/zone-editor), which reads the same JSON file.
 * No HQ type has a built-in weakness: an HQ is weaker only where its zone and district measure less.
 */
import catalogJson from '../data/content-catalog.json';
import type { Poi, Zone, ZoneMeasures } from './model';

export type ResourceLayer = 'consumable' | 'material' | 'component' | 'capacity';
export interface ResourceDef { id: string; name: string; layer: ResourceLayer; decays?: string; help?: string }
export interface ModuleDef { id: string; name: string; effect: string }
export interface HqTypeDef { id: string; name: string; startsWith: string[]; unique: string; summary: string; finds?: string[] }
export interface FacilityTypeDef { id: string; name: string; network?: NetworkId; summary: string; finds?: string[] }
export interface ChokepointAction { id: 'hold' | 'block' | 'blow'; name: string; effect: string; costs: string; reversible: boolean }
export interface TakeoverRules {
  residentFloorM2: number; zombieShare: number; searchFloorM2PerHour: number; otherBuildingHours: number;
  hoursPerZombie: number; sweepHoursPerHa: number; guardMetersPerPost: number; levels: [number, string][];
}
export interface SiteTypeDef { id: string; name: string; finds?: string[]; produces?: string[] }
export interface UpgradeRequirement { openHa?: number; housing?: number; coastM?: number; network?: NetworkId }
export interface UpgradeDef { id: string; name: string; level: 2 | 3; needs: string[]; requires: UpgradeRequirement; gives: string }
export type NetworkId = 'power' | 'comms' | 'roads' | 'water';
export interface NetworkDef { id: NetworkId; name: string; level: 2; needs: string; gives: string }
export interface Yields {
  fieldFoodPerHaYear: number; openLandFoodPerHaYear: number; pastureFoodPerHaYear: number; gardenShareOfBuilt: number;
  greenhouseFoodPerM2Year: number;
  fishFoodPerBoatDay: number; floorM2PerPerson: number; residentialFloors: Record<string, number>;
}
export interface ContentCatalog {
  version: number;
  resources: ResourceDef[]; modules: ModuleDef[]; hqTypes: HqTypeDef[]; facilityTypes: FacilityTypeDef[];
  siteTypes: SiteTypeDef[]; upgrades: UpgradeDef[]; networks: NetworkDef[]; zoneTypes: [string, string][]; yields: Yields;
  chokepointActions: ChokepointAction[]; takeover: TakeoverRules;
}

export const CONTENT: ContentCatalog = catalogJson as unknown as ContentCatalog;
const byId = <T extends { id: string }>(list: T[]) => new Map(list.map(item => [item.id, item]));
export const RESOURCES = byId(CONTENT.resources);
export const MODULES = byId(CONTENT.modules);
export const HQ_TYPES = byId(CONTENT.hqTypes);
export const FACILITY_TYPES = byId(CONTENT.facilityTypes);
export const SITE_TYPES = byId(CONTENT.siteTypes);

export interface ZoneCapacity {
  /** People the zone's homes can house. */
  housing: number;
  /** Food per year (1 food = one person's day) from farmland in use, and from pasture, gardens, parks and greenhouses once cultivated. */
  fieldFood: number; openLandFood: number; greenhouseFood: number;
  /** Food per day from one boat with crew, when the zone has shoreline. */
  fishPerBoatDay: number;
  /** Share of the zone boundary that is sea or lake (0–1): zombies cannot walk in from there. */
  waterEdge: number;
  hectares: number; farmHa: number; pastureHa: number; gardenHa: number; openHa: number; forestHa: number; coastM: number;
}

export function zoneCapacity(m: ZoneMeasures, yields: Yields = CONTENT.yields): ZoneCapacity {
  const edge = m.coastM + m.landEdgeM;
  const gardens = Math.max(m.open, (m.built ?? 0) * yields.gardenShareOfBuilt);
  const pasture = m.pasture ?? 0;
  return {
    housing: Math.round(m.floor / yields.floorM2PerPerson),
    fieldFood: Math.round(m.farm / 1e4 * yields.fieldFoodPerHaYear),
    openLandFood: Math.round((pasture * yields.pastureFoodPerHaYear + gardens * yields.openLandFoodPerHaYear) / 1e4),
    greenhouseFood: Math.round(m.greenhouse * yields.greenhouseFoodPerM2Year),
    fishPerBoatDay: m.coastM >= 100 ? yields.fishFoodPerBoatDay : 0,
    waterEdge: edge ? Math.round(m.coastM / edge * 100) / 100 : 0,
    hectares: m.m2 / 1e4, farmHa: m.farm / 1e4, pastureHa: pasture / 1e4, gardenHa: gardens / 1e4, openHa: (pasture + gardens) / 1e4,
    forestHa: m.forest / 1e4, coastM: m.coastM,
  };
}

/** People a year of food feeds. */
export const peopleFed = (foodPerYear: number) => Math.floor(foodPerYear / 365);

export interface Advantage { id: string; label: string; value: string }

/**
 * Concrete reasons an HQ is good, from its type and the measured zone and district around it.
 * Missing advantages are its weaknesses; nothing negative is invented.
 */
export function hqAdvantages(poi: Pick<Poi, 'hqType'>, zone: Zone, district?: Zone): Advantage[] {
  const type = poi.hqType ? HQ_TYPES.get(poi.hqType) : undefined;
  const result: Advantage[] = [];
  if (type) {
    result.push({ id: 'start', label: 'Har fra start', value: type.startsWith.map(id => MODULES.get(id)?.name ?? id).join(', ') });
    result.push({ id: 'unique', label: 'Unik mulighet', value: MODULES.get(type.unique)?.name ?? type.unique });
  }
  const own = zone.measures ? zoneCapacity(zone.measures) : undefined;
  const area = district?.measures ? zoneCapacity(district.measures) : own;
  if (own && own.housing > 0) result.push({ id: 'housing', label: 'Husrom i HQ-sonen', value: `${own.housing} personer` });
  if (area) {
    const food = area.fieldFood + area.openLandFood + area.greenhouseFood;
    if (food > 0) result.push({ id: 'food', label: 'Mat ved full dyrking', value: `${peopleFed(food)} personer i året` });
    if (area.fishPerBoatDay) result.push({ id: 'fish', label: 'Fiske', value: `${area.fishPerBoatDay} mat per båt og dag` });
  }
  if (own && own.waterEdge >= .25) result.push({ id: 'water', label: 'Vann rundt sonen', value: `${Math.round(own.waterEdge * 100)} % av grensen` });
  if (district?.measures && zoneCapacity(district.measures).waterEdge >= .5) {
    result.push({ id: 'island', label: 'Området er omgitt av vann', value: `${Math.round(zoneCapacity(district.measures).waterEdge * 100)} % av grensen` });
  }
  return result;
}

/** Upgrades a zone can take today, given its measures and the networks running in its L2 district. */
export function availableUpgrades(zone: Zone, networks: ReadonlySet<NetworkId> = new Set()): UpgradeDef[] {
  if (!zone.measures) return [];
  const cap = zoneCapacity(zone.measures);
  return CONTENT.upgrades.filter(upgrade => upgrade.level === zone.level && Object.entries(upgrade.requires).every(([key, need]) => {
    if (key === 'openHa') return cap.openHa + cap.farmHa >= (need as number);
    if (key === 'housing') return cap.housing >= (need as number);
    if (key === 'coastM') return cap.coastM >= (need as number);
    if (key === 'network') return networks.has(need as NetworkId);
    return false;
  }));
}

/** Networks an L2 district can be built up with, and the places that make each possible. */
export function networkOptions(pois: readonly Pick<Poi, 'name' | 'role' | 'facilityType'>[]) {
  return CONTENT.networks.map(network => ({
    ...network,
    via: pois.filter(p => p.role === 'facility' && p.facilityType && FACILITY_TYPES.get(p.facilityType)?.network === network.id).map(p => p.name),
  }));
}

/** Unknown catalog ids in a world's zones and places. */
export function contentIssues(zones: readonly Zone[], pois: readonly Poi[]): string[] {
  const issues: string[] = [];
  const zoneTypes = new Set(CONTENT.zoneTypes.map(([id]) => id));
  for (const zone of zones) {
    if (zone.primaryType && !zoneTypes.has(zone.primaryType)) issues.push(`${zone.id}: ukjent sonetype ${zone.primaryType}`);
    for (const id of [...(zone.finds ?? []), ...(zone.produces ?? [])]) if (!RESOURCES.has(id)) issues.push(`${zone.id}: ukjent ressurs ${id}`);
  }
  for (const poi of pois) {
    if (poi.hqType && !HQ_TYPES.has(poi.hqType)) issues.push(`${poi.id}: ukjent HQ-type ${poi.hqType}`);
    if (poi.facilityType && !FACILITY_TYPES.has(poi.facilityType)) issues.push(`${poi.id}: ukjent anleggstype ${poi.facilityType}`);
    if (poi.siteType && !SITE_TYPES.has(poi.siteType)) issues.push(`${poi.id}: ukjent ressurssted ${poi.siteType}`);
  }
  return issues;
}

export interface TakeoverEstimate {
  /** People who lived here before, and how many of them are likely zombies now (a hypothesis, not a census). */
  residents: number; zombies: number;
  /** Work hours to search the buildings, clear the zombies and sweep the open ground. Same unit as building searches. */
  searchHours: number; clearHours: number; sweepHours: number; hours: number;
  /** Guard posts needed to hold the zone's border against other land. Water borders need none. */
  guardPosts: number;
  level: string;
}

/** How hard a zone is to take: big zones take long to sweep, dense zones have many buildings and many dead. */
export function takeoverEffort(m: ZoneMeasures, rules: TakeoverRules = CONTENT.takeover): TakeoverEstimate {
  const residents = Math.round(m.floor / rules.residentFloorM2);
  const zombies = Math.round(residents * rules.zombieShare);
  const searchHours = m.floor / rules.searchFloorM2PerHour + Math.max(0, m.buildings - m.homes) * rules.otherBuildingHours;
  const clearHours = zombies * rules.hoursPerZombie;
  const sweepHours = m.m2 / 1e4 * rules.sweepHoursPerHa;
  const hours = Math.round(searchHours + clearHours + sweepHours);
  return {
    residents, zombies, searchHours: Math.round(searchHours), clearHours: Math.round(clearHours), sweepHours: Math.round(sweepHours),
    hours, guardPosts: Math.ceil(m.landEdgeM / rules.guardMetersPerPost),
    level: rules.levels.find(([limit]) => hours <= limit)?.[1] ?? rules.levels[rules.levels.length - 1][1],
  };
}

/** Hold, block or blow up a bridge or tunnel. */
export const chokepointActions = (): ChokepointAction[] => CONTENT.chokepointActions;
