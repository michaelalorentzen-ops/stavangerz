import type { AreaGeometry, GameState, Polygon, Position, WorldDefinition } from './model';
import { contentIssues } from './content';

export interface ValidationIssue { readonly code: string; readonly id: string; readonly message: string }
type Ring = readonly Position[];
const EPS = 1e-10;
const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
const cross = (a: Position, b: Position, p: Position) =>
  (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const side = (a: Position, b: Position, p: Position) => {
  const value = cross(a, b, p);
  return Math.abs(value) <= EPS * Math.hypot(b[0] - a[0], b[1] - a[1]) ? 0 : Math.sign(value);
};
const onSegment = (p: Position, a: Position, b: Position) =>
  p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS &&
  p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS && side(a, b, p) === 0;
const boxesMeet = (a: Position, b: Position, c: Position, d: Position) =>
  Math.max(a[0], b[0])+EPS >= Math.min(c[0], d[0]) && Math.max(c[0], d[0])+EPS >= Math.min(a[0], b[0]) &&
  Math.max(a[1], b[1])+EPS >= Math.min(c[1], d[1]) && Math.max(c[1], d[1])+EPS >= Math.min(a[1], b[1]);
const properCross = (a: Position, b: Position, c: Position, d: Position) =>
  boxesMeet(a,b,c,d) && side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
const intersects = (a: Position, b: Position, c: Position, d: Position) =>
  boxesMeet(a,b,c,d) && (properCross(a, b, c, d) || onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b));
const segments = (ring: Ring): [Position, Position][] => ring.slice(1).map((p, i) => [ring[i], p]);
const polygons = (area: AreaGeometry): readonly Polygon['coordinates'][] =>
  area.type === 'Polygon' ? [area.coordinates] : area.coordinates;

/** -1 outside, 0 boundary, 1 interior. Coordinates are longitude/latitude. */
function inRing(point: Position, ring: Ring): -1 | 0 | 1 {
  let inside = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i-1], b = ring[i];
    if (onSegment(point, a, b)) return 0;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 1 : -1;
}
function inPolygon(point: Position, poly: Polygon['coordinates']): -1 | 0 | 1 {
  if (!poly.length) return -1;
  const outer = inRing(point, poly[0]);
  if (outer !== 1) return outer;
  for (const hole of poly.slice(1)) {
    const value = inRing(point, hole);
    if (value === 0) return 0;
    if (value === 1) return -1;
  }
  return 1;
}
export function pointInArea(point: Position, area: AreaGeometry, includeBoundary = true): boolean {
  return polygons(area).some(poly => {
    const value = inPolygon(point, poly);
    return value === 1 || (includeBoundary && value === 0);
  });
}
const areaSegments = (area: AreaGeometry) => polygons(area).flatMap(poly => poly.flatMap(segments));

/** Interior samples handle coincident boundaries without treating shared borders as overlap. */
function samples(area: AreaGeometry): Position[] {
  const result: Position[] = [];
  for (const poly of polygons(area)) {
    for (const ring of poly) {
      for (const [a, b] of segments(ring)) {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        if (!length) continue;
        for (const side of [-1, 1]) {
          const p: Position = [(a[0] + b[0]) / 2 - side * dy / length * 1e-8,
            (a[1] + b[1]) / 2 + side * dx / length * 1e-8];
          if (inPolygon(p, poly) === 1) result.push(p);
        }
      }
    }
  }
  return result;
}
function overlaps(a: AreaGeometry, b: AreaGeometry): boolean {
  const right = areaSegments(b);
  if (areaSegments(a).some(([p, q]) => right.some(([r, s]) => properCross(p, q, r, s)))) return true;
  return samples(a).some(p => pointInArea(p, b, false)) || samples(b).some(p => pointInArea(p, a, false));
}
function contained(child: AreaGeometry, parent: AreaGeometry): boolean {
  if (!polygons(child).every(poly => poly.every(ring => ring.every(p => pointInArea(p, parent))))) return false;
  const border = areaSegments(parent);
  if (areaSegments(child).some(([a, b]) => border.some(([c, d]) => properCross(a, b, c, d)))) return false;
  // A child may not cover a hole of its parent, even when every child vertex lies inside.
  for (const poly of polygons(parent)) for (const hole of poly.slice(1)) {
    const holeArea: AreaGeometry = { type: 'Polygon', coordinates: [hole] };
    if (samples(holeArea).some(p => pointInArea(p, child, false))) return false;
  }
  return true;
}

export function geometryIssues(id: string, area: AreaGeometry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (message: string) => issues.push({ code: 'geometry', id, message });
  if (!polygons(area).length) add('Area has no polygons');
  for (const poly of polygons(area)) {
    if (!poly.length) add('Polygon has no outer ring');
    for (const ring of poly) {
      if (ring.length < 4 || !same(ring[0], ring[ring.length - 1])) { add('Ring must be closed with at least four positions'); continue; }
      if (ring.some(p => !validPosition(p))) add('Invalid longitude/latitude');
      const edges = segments(ring);
      if (edges.some(([a, b]) => same(a, b))) add('Ring has a zero-length edge');
      // Translate before shoelace summation: large longitude/latitude products can
      // cancel away real small areas. Reject slivers thinner than our boundary tolerance.
      const [ox, oy] = ring[0];
      const signedArea = edges.reduce((sum, [a, b]) => sum + (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy), 0);
      const perimeter = edges.reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
      if (Math.abs(signedArea) <= EPS * perimeter) add('Ring has zero area or a sliver below coordinate tolerance');
      for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
        if (j === i + 1 || (i === 0 && j === edges.length - 1)) continue;
        if (intersects(...edges[i], ...edges[j])) add('Ring self-intersects');
      }
    }
    if (poly[0]) for (let i = 1; i < poly.length; i++) {
      // Boolean polygon edits can produce a valid hole tangent to the shell at
      // one point. Crossing or sharing a boundary segment still invalidates it.
      const shell = segments(poly[0]);
      const hole = segments(poly[i]);
      const contacts: Position[] = [];
      let invalidContact = false;
      for (const [a, b] of hole) for (const [c, d] of shell) {
        if (!intersects(a, b, c, d)) continue;
        if (properCross(a, b, c, d)) invalidContact = true;
        const touching = [a, b, c, d].filter(p => onSegment(p, a, b) && onSegment(p, c, d));
        if (touching.some(p => touching.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) > EPS))) invalidContact = true;
        for (const p of touching) {
          if (!contacts.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) <= EPS)) contacts.push(p);
        }
      }
      if (poly[i].some(p => inRing(p, poly[0]) === -1)) add('Hole lies outside outer ring');
      if (invalidContact || contacts.length > 1) add('Hole crosses or disconnects outer ring');
      for (let j = 1; j < i; j++) {
        if (overlaps({ type: 'Polygon', coordinates: [poly[i]] }, { type: 'Polygon', coordinates: [poly[j]] })) add('Polygon holes overlap');
      }
    }
  }
  const parts = polygons(area);
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    if (overlaps({ type: 'Polygon', coordinates: parts[i] }, { type: 'Polygon', coordinates: parts[j] })) add('MultiPolygon parts overlap');
  }
  return issues;
}
const validPosition = (p: Position) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

/** Validation of trusted, typed draft data, not an arbitrary JSON security parser. */
/** A supplied baseline must already be valid and use immutable geometry objects.
 * Import/export callers omit it for a complete validation. */
export function validateWorld(world: WorldDefinition, baseline?: WorldDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, id: string, message: string) => issues.push({ code, id, message });
  if (world.schemaVersion !== 1 || !world.worldId || !world.worldVersion) add('version', world.worldId, 'Missing/unsupported world identity or version');
  const all = [...world.zones, ...world.pois, ...world.edges, ...world.barriers, ...(world.frontiers ?? []), ...world.sources];
  const ids = new Set<string>();
  for (const item of all) {
    if (!item.id || ids.has(item.id)) add('duplicate-id', item.id, 'IDs must be non-empty and globally unique');
    ids.add(item.id);
  }
  const sources = new Set(world.sources.map(s => s.id));
  for (const item of [...world.zones, ...world.pois, ...world.edges, ...world.barriers, ...(world.frontiers ?? [])]) {
    if (!item.sourceIds.length) add('source', item.id, 'At least one provenance source is required');
    for (const id of item.sourceIds) if (!sources.has(id)) add('source', item.id, `Unknown source ${id}`);
  }
  const zones = new Map(world.zones.map(z => [z.id, z]));
  const previousZones = new Map(baseline?.zones.map(z => [z.id, z]));
  const changed = new Set(world.zones.filter(zone => {
    const previous = previousZones.get(zone.id);
    return !previous || previous.geometry !== zone.geometry ||
      previous.level !== zone.level || previous.parentId !== zone.parentId;
  }).map(zone => zone.id));
  const invalidAreas = new Set<string>();
  for (const zone of world.zones) {
    const found = changed.has(zone.id) ? geometryIssues(zone.id, zone.geometry) : [];
    if (found.length) invalidAreas.add(zone.id);
    issues.push(...found);
    const parent = zone.parentId ? zones.get(zone.parentId) : undefined;
    if (zone.level === 1 && zone.parentId) add('hierarchy', zone.id, 'L1 cannot have a parent');
    if (zone.level !== 1 && (!parent || parent.level !== zone.level - 1)) add('hierarchy', zone.id, 'Zone must reference a parent exactly one level above');
  }
  for (const zone of world.zones) {
    const parent = zone.parentId ? zones.get(zone.parentId) : undefined;
    if (parent && (changed.has(zone.id)||changed.has(parent.id)) && !invalidAreas.has(zone.id) && !invalidAreas.has(parent.id) && !contained(zone.geometry, parent.geometry)) add('containment', zone.id, `Outside parent ${parent.id}`);
  }
  for (let i = 0; i < world.zones.length; i++) for (let j = i + 1; j < world.zones.length; j++) {
    const a = world.zones[i], b = world.zones[j];
    if ((changed.has(a.id)||changed.has(b.id)) && a.level === b.level && a.parentId === b.parentId && !invalidAreas.has(a.id) && !invalidAreas.has(b.id) && overlaps(a.geometry, b.geometry)) add('overlap', a.id, `Positive-area overlap with sibling ${b.id}`);
  }
  for (const poi of world.pois) {
    const cell = zones.get(poi.cellId);
    if (!cell || cell.level !== 3) add('poi-cell', poi.id, 'POI must reference an L3 cell');
    else if (!invalidAreas.has(cell.id) && !pointInArea(poi.geometry.coordinates, cell.geometry)) add('poi-containment', poi.id, 'POI point is outside its cell');
    if (!validPosition(poi.geometry.coordinates)) add('geometry', poi.id, 'Invalid POI coordinate');
  }
  for (const edge of world.edges) {
    for (const id of edge.viaPoiIds ?? []) {
      const point = world.pois.find(p => p.id === id);
      if (!point || ![edge.fromCellId, edge.toCellId].includes(point.cellId)) add('edge-point', edge.id, 'Strategic point must exist in one of the connected cells');
    }
    const from = zones.get(edge.fromCellId), to = zones.get(edge.toCellId);
    if (!from || !to || from.level !== 3 || to.level !== 3 || from.id === to.id) add('edge-cell', edge.id, 'Edge must join two different L3 cells');
    if (!edge.modes.length || new Set(edge.modes).size !== edge.modes.length) add('edge-modes', edge.id, 'Edge modes must be non-empty and unique');
    const line = edge.geometry.coordinates;
    if (line.length < 2 || line.some(p => !validPosition(p))) add('geometry', edge.id, 'Edge needs at least two valid positions');
    else {
      if (from && !invalidAreas.has(from.id) && !pointInArea(line[0], from.geometry)) add('edge-endpoint', edge.id, 'First position is outside origin cell');
      if (to && !invalidAreas.has(to.id) && !pointInArea(line[line.length - 1], to.geometry)) add('edge-endpoint', edge.id, 'Last position is outside destination cell');
    }
    if (edge.status === 'active' && (!from?.playable || !to?.playable)) add('edge-status', edge.id, 'Active edge cannot enter non-playable cells');
  }
  for (const barrier of world.barriers) {
    if (barrier.geometry.type === 'LineString') {
      if (barrier.geometry.coordinates.length < 2 || barrier.geometry.coordinates.some(p => !validPosition(p))) add('geometry', barrier.id, 'Barrier line needs two valid positions');
    } else if(!baseline?.barriers.some(previous=>previous.id===barrier.id&&previous.geometry===barrier.geometry)){
      issues.push(...geometryIssues(barrier.id, barrier.geometry));
    }
  }
  for (const frontier of world.frontiers ?? []) {
    const cell = zones.get(frontier.cellId);
    const line = frontier.geometry.coordinates;
    if (!cell || cell.level !== 3 || !frontier.externalAreaId || frontier.kind !== 'unmodeled-land') add('frontier', frontier.id, 'Open land boundary requires L3 cell and explicit external area');
    if (line.length < 2 || line.some(p => !validPosition(p))) add('frontier', frontier.id, 'Invalid open land boundary geometry');
    else if (cell && line.some(p => !pointInArea(p, cell.geometry))) add('frontier', frontier.id, 'Boundary lies outside referenced cell');
  }
  for (const message of contentIssues(world.zones, world.pois)) add('content', message.split(':')[0], message);
  return issues;
}

export function validateStateReferences(state: GameState, world: WorldDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (state.schemaVersion !== 1 || state.worldId !== world.worldId || state.worldVersion !== world.worldVersion) {
    issues.push({ code: 'state-version', id: state.worldId, message: 'Save requires its exact pinned world definition; no automatic latest-world substitution' });
  }
  for (const [records, ids, kind] of [
    [state.zoneStates, new Set(world.zones.filter(z => z.level === 3).map(z => z.id)), 'zone'],
    [state.poiStates, new Set(world.pois.map(p => p.id)), 'poi'],
    [state.edgeStates, new Set(world.edges.map(e => e.id)), 'edge'],
  ] as const) for (const id of Object.keys(records)) {
    if (!ids.has(id)) issues.push({ code: 'state-reference', id, message: `Unknown ${kind} ID` });
  }
  return issues;
}
