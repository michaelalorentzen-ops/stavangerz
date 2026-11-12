/**
 * Visual-only territory capture feedback. Requires an existing "l3" map source.
 * Ownership comes from the simulation, not this presentation layer.
 */
import type { Map as LibreMap, GeoJSONSource } from 'maplibre-gl';
import polygonClipping from 'polygon-clipping';

type Pt = [number, number];
type Multi = Pt[][][][];
export type TerritoryShift = { zoneId: string; kind: 'gain' | 'loss'; entry?: Pt };
export type TerritoryCaptureController = {
  play(shifts: readonly TerritoryShift[], durationMs?: number): Promise<void>;
  skip(): void;
  destroy(): void;
};

type Work = { id: string; kind: TerritoryShift['kind']; polygon: Multi; center: Pt; max: number };
const SOURCE = 'rz-capture-source';
const FILL = 'rz-capture-fill';
const FRONT = 'rz-capture-front';
const EMPTY: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> = { type: 'FeatureCollection', features: [] };

function polygons(geometry: GeoJSON.Geometry | undefined): Multi | null {
  if (geometry?.type === 'Polygon') return [geometry.coordinates as Pt[][]];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates as Multi;
  return null;
}
function distance(a: Pt, b: Pt): number {
  const dx = (b[0] - a[0]) * Math.cos(a[1] * Math.PI / 180) * 111_320;
  return Math.hypot(dx, (b[1] - a[1]) * 111_320);
}
function circle(center: Pt, radius: number): Pt[][] {
  const cos = Math.max(.1, Math.cos(center[1] * Math.PI / 180));
  const ring: Pt[] = [];
  for (let n = 0; n <= 48; n++) {
    const angle = n / 48 * Math.PI * 2;
    ring.push([
      center[0] + Math.cos(angle) * radius / (cos * 111_320),
      center[1] + Math.sin(angle) * radius / 111_320,
    ]);
  }
  return [ring];
}
function prepare(shifts: readonly TerritoryShift[], geometries: ReadonlyMap<string, GeoJSON.Geometry>): Work[] {
  const result: Work[] = [];
  const seen = new Set<string>();
  for (const shift of shifts) {
    if (result.length >= 12 || seen.has(shift.zoneId)) continue;
    seen.add(shift.zoneId);
    const polygon = polygons(geometries.get(shift.zoneId));
    if (!polygon?.[0]?.[0]?.[0]) continue;
    const center = shift.entry ?? polygon[0][0][0];
    let max = 1;
    for (const component of polygon) for (const ring of component) for (const point of ring) {
      max = Math.max(max, distance(center, point));
    }
    result.push({ id: shift.zoneId, kind: shift.kind, polygon, center, max });
  }
  return result;
}
function render(source: GeoJSONSource, work: Work[], progress: number): void {
  const eased = progress * progress * (3 - 2 * progress);
  const alpha = progress > .82 ? Math.max(0, (1 - progress) / .18) : 1;
  const features: GeoJSON.Feature<GeoJSON.MultiPolygon>[] = [];
  for (const change of work) {
    try {
      // Intersection clips every frame to the real zone polygon, including holes.
      const geometry = polygonClipping.intersection(change.polygon, circle(change.center, Math.max(1, change.max * eased * 1.03)));
      if (!geometry.length) continue;
      features.push({
        type: 'Feature',
        properties: { zoneId: change.id, color: change.kind === 'gain' ? '#73e4a7' : '#fa6c70', alpha },
        geometry: { type: 'MultiPolygon', coordinates: geometry },
      });
    } catch {
      // A malformed map polygon must not block the day transition.
    }
  }
  source.setData({ type: 'FeatureCollection', features });
}

/**
 * Attach after 'l3-fill' and 'l3-line' exist. One controller per map.
 * Call play() with actual gained/lost L3 ids from the day journal.
 * The entry point can be the mission breach or the L3 zone's .at point.
 * No camera movement; skip only affects presentation.
 */
export function attachTerritoryCaptureEffects(
  map: LibreMap,
  geometries: ReadonlyMap<string, GeoJSON.Geometry>,
): TerritoryCaptureController {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
  const before = map.getLayer('l3-line') ? 'l3-line' : undefined;
  if (!map.getLayer(FILL)) map.addLayer({
    id: FILL, type: 'fill', source: SOURCE,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['*', ['get', 'alpha'], .38] },
  }, before);
  if (!map.getLayer(FRONT)) map.addLayer({
    id: FRONT, type: 'line', source: SOURCE,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 16, 3.2],
      'line-opacity': ['get', 'alpha'],
      'line-blur': 1.5,
    },
  }, before);

  let raf = 0;
  let pending: (() => void) | undefined;
  let destroyed = false;
  const source = () => map.getSource(SOURCE) as GeoJSONSource | undefined;
  const finish = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!destroyed) source()?.setData(EMPTY);
    pending?.();
    pending = undefined;
  };

  return {
    play(shifts, durationMs = 650) {
      finish();
      if (destroyed || !source()) return Promise.resolve();
      const work = prepare(shifts, geometries);
      if (!work.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
      const duration = Math.max(150, Math.min(2500, durationMs));
      return new Promise<void>(resolve => {
        pending = resolve;
        const started = performance.now();
        let previous = 0;
        const tick = (now: number) => {
          if (destroyed || !source()) { finish(); return; }
          const progress = Math.min(1, (now - started) / duration);
          if (now - previous >= 1000 / 24 || progress === 1) {
            render(source()!, work, progress);
            previous = now;
          }
          if (progress === 1) finish();
          else raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    },
    skip: finish,
    destroy() {
      finish();
      destroyed = true;
      if (map.getLayer(FRONT)) map.removeLayer(FRONT);
      if (map.getLayer(FILL)) map.removeLayer(FILL);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    },
  };
}
