import basemap from '../../world-data/data/basemap.json';
import type { Position, WorldDefinition } from '../../world-data/src/model';
import { pointInArea } from '../../world-data/src/validate';
import type { Survivor } from './model';

export type WorkMode = 'together' | 'spread';
export type BuildingCategory = 'house' | 'rowhouse' | 'apartments' | 'other';
export interface FieldWork { hours: number; completed: number }
export interface BuildingWorkload {
  buildings: number;
  hours: number;
  categories: Record<BuildingCategory, number>;
}

// Playtest assumptions. A footprint is an aggregate work item, with no inferred dwelling count.
const hoursByCategory = { house: 1, rowhouse: 3, apartments: 6, other: 2 } as const;
const categories = Object.keys(hoursByCategory) as BuildingCategory[];
const workloadCache = new WeakMap<WorldDefinition, Record<string, BuildingWorkload>>();

function buildingCategory(tag: string): BuildingCategory {
  switch (tag) {
    case 'house': case 'detached': return 'house';
    case 'terrace': case 'semidetached_house': return 'rowhouse';
    case 'apartments': case 'dormitory': return 'apartments';
    default: return 'other';
  }
}

/** Assign each mapped footprint to one L3 by its centroid, with a stable boundary tie-break. */
export function buildingWorkloads(world: WorldDefinition): Record<string, BuildingWorkload> {
  const cached = workloadCache.get(world);
  if (cached) return cached;
  const cells = world.zones.filter(zone => zone.level === 3 && zone.playable)
    .sort((left, right) => left.id.localeCompare(right.id));
  const workloads: Record<string, BuildingWorkload> = Object.fromEntries(cells.map(cell => [cell.id, {
    buildings: 0, hours: 0, categories: { house: 0, rowhouse: 0, apartments: 0, other: 0 },
  }]));
  for (const feature of basemap.features) {
    if (feature.properties.kind !== 'building' || !feature.properties.building || feature.properties.building === 'roof') continue;
    const footprint = feature.geometry.coordinates;
    if (footprint.length < 4) continue;
    const [originX, originY] = footprint[0];
    let twiceArea = 0;
    let weightedX = 0;
    let weightedY = 0;
    for (let i = 1; i < footprint.length; i++) {
      const ax = footprint[i - 1][0] - originX;
      const ay = footprint[i - 1][1] - originY;
      const bx = footprint[i][0] - originX;
      const by = footprint[i][1] - originY;
      const cross = ax * by - bx * ay;
      twiceArea += cross;
      weightedX += (ax + bx) * cross;
      weightedY += (ay + by) * cross;
    }
    if (Math.abs(twiceArea) < 1e-16) continue;
    const centroid: Position = [originX + weightedX / (3 * twiceArea), originY + weightedY / (3 * twiceArea)];
    const cell = cells.find(zone => pointInArea(centroid, zone.geometry));
    if (!cell) continue;
    const category = buildingCategory(feature.properties.building);
    const workload = workloads[cell.id];
    workload.categories[category]++;
    workload.buildings++;
    workload.hours += hoursByCategory[category];
  }
  for (const workload of Object.values(workloads)) {
    Object.freeze(workload.categories);
    Object.freeze(workload);
  }
  Object.freeze(workloads);
  workloadCache.set(world, workloads);
  return workloads;
}

export function planFieldWork(workload: BuildingWorkload, previousHours: number, crew: readonly Survivor[], {
  mode = 'together', threat = 0, travelHops = 0, limit = workload.hours, superficial = false,
}: { mode?: WorkMode; threat?: number; travelHops?: number; limit?: number; superficial?: boolean } = {}) {
  const active = crew.filter(person => person.alive && person.health > 0);
  const spreading = mode === 'spread' && active.length > 1;
  const hoursOnSite = Math.max(0, 6 - Math.max(0, travelHops) * 0.75);
  const ability = active.reduce((sum, person) => sum +
    (0.85 + Math.min(0.35, (person.skills.scouting + person.skills.craft) * 0.035) + (person.gear.utility === 'Verktøykasse' ? .12 : 0)) *
    (person.health / 100) * (1 - Math.min(100, person.fatigue) / 125), 0);
  const coordination = spreading ? 1.2 : 1 / (1 + Math.max(0, active.length - 1) * 0.08);
  const defensiveCapacity = active.reduce((sum, person) => sum + (2 + person.skills.combat) * person.health / 100, 0);
  const exposure = Math.max(0, threat) / Math.max(1, defensiveCapacity) * (spreading ? 1.55 : 1);
  const risk = exposure >= 1.4 ? 'Høy' : exposure >= 0.6 ? 'Moderat' : 'Lav';
  const effort = hoursOnSite * ability * coordination * (superficial ? 1.25 : 1) / (1 + exposure * 0.18);
  const previous = Math.max(0, Math.min(workload.hours, Math.floor(previousHours)));
  const hours = Math.min(Math.max(0, Math.min(limit,workload.hours) - previous), effort > 0 ? Math.max(1, Math.floor(effort)) : 0);
  let remaining = previous + hours;
  let completed = 0;
  for (const category of categories) {
    const done = Math.min(workload.categories[category], Math.floor(remaining / hoursByCategory[category]));
    completed += done;
    remaining -= done * hoursByCategory[category];
    if (done < workload.categories[category]) break;
  }
  return {
    hours, totalHours: workload.hours, completed, totalBuildings: workload.buildings,
    risk, noise: hours ? spreading ? 2 : 1 : 0,
  } as const;
}

/** Delta against the original, finite cache caps. Apply it through the resource ledger. */
export function fieldLootProgress(cache: Record<string, number>, previousHours: number, nextHours: number, totalHours: number): Record<string, number> {
  if (totalHours <= 0 || nextHours <= previousHours) return {};
  const before = Math.max(0, Math.min(totalHours, previousHours));
  const after = Math.max(0, Math.min(totalHours, nextHours));
  const cargo: Record<string, number> = {};
  for (const [resource, cap] of Object.entries(cache)) {
    const amount = Math.floor(cap * after / totalHours) - Math.floor(cap * before / totalHours);
    if (amount > 0) cargo[resource] = amount;
  }
  return cargo;
}
