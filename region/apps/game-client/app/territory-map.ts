/** Presentation geometry only: dissolve actual controlled L3 polygons, preserving holes. */
import polygonClipping from 'polygon-clipping';
import type { RegionState, RegionWorld } from '../../../packages/gameplay/src/region/types';
type Multi = [number, number][][][];
const polygons = (geometry: GeoJSON.Geometry): Multi => geometry.type === 'Polygon' ? [geometry.coordinates as [number, number][][]] : geometry.type === 'MultiPolygon' ? geometry.coordinates as Multi : [];
export function territoryGeometry(world: RegionWorld, state: RegionState): GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> {
  const parts = world.zones.filter(zone => zone.level === 3 && zone.geometry && state.zones[zone.id]?.status === 'controlled').map(zone => polygons(zone.geometry as GeoJSON.Geometry)).filter(part => part.length);
  if (!parts.length) return { type: 'FeatureCollection', features: [] };
  let coordinates: Multi;
  try { coordinates = polygonClipping.union(parts[0], ...parts.slice(1)) as Multi; }
  catch { coordinates = parts.flat(); } // Invalid legacy geometry still retains truthful ownership.
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates } }] };
}
export function territoryBounds(world: RegionWorld, state: RegionState): [[number, number], [number, number]] | undefined {
  const points = territoryGeometry(world, state).features.flatMap(feature => feature.geometry.coordinates.flat(2));
  const home = world.zones.find(zone => zone.id === state.homeZoneId)?.at;
  if (home) points.push(home);
  if (!points.length) return undefined;
  const lower: [number, number] = [Infinity, Infinity], upper: [number, number] = [-Infinity, -Infinity];
  for (const point of points) { lower[0] = Math.min(lower[0], point[0]); lower[1] = Math.min(lower[1], point[1]); upper[0] = Math.max(upper[0], point[0]); upper[1] = Math.max(upper[1], point[1]); }
  return [lower, upper];
}
