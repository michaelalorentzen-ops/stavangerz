import type { Map as LibreMap, GeoJSONSource, Marker } from 'maplibre-gl';
import type { RegionState, RegionWorld, RegionZone } from '../../../packages/gameplay/src/region/types';
import { crewPositionFor, knownCrewL3Zone } from '../../../packages/gameplay/src/region/location';

/** Zoom changes the geographic command level; it never grants ownership. */
export function commandLevel(zoom: number): 1 | 2 | 3 { return zoom < 10.5 ? 1 : zoom < 12 ? 2 : 3; }
export function areaLeaves(world: RegionWorld, areaId: string): RegionZone[] {
  const byId = new Map(world.zones.map(z => [z.id, z]));
  return world.zones.filter(z => {
    if (z.level !== 3) return false;
    let next: RegionZone | undefined = z;
    while (next) { if (next.id === areaId) return true; next = byId.get(next.parentId ?? ''); }
    return false;
  });
}
export interface OperationalMapController { update(state: RegionState): void; destroy(): void }
/** One bounded overlay, fed only by the canonical placement register. */
export function attachOperationalMap(map: LibreMap, lib: typeof import('maplibre-gl'), world: RegionWorld, initial: RegionState, onSelect: (id: string) => void, onLevel: (level: 1 | 2 | 3) => void, individualCrew = false): OperationalMapController {
  let state = initial;
  let markers: Marker[] = [];
  const byId = new Map(world.zones.map(z => [z.id, z]));
  const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  map.addSource('crew-routes', { type: 'geojson', data: empty });
  map.addSource('crew-coverage', { type: 'geojson', data: empty });
  map.addLayer({ id: 'crew-routes', type: 'line', source: 'crew-routes', minzoom: 12, paint: { 'line-color': '#a2d9e4', 'line-width': 2.5, 'line-opacity': .85 } });
  map.addLayer({ id: 'crew-coverage-fill', type: 'fill', source: 'crew-coverage', paint: { 'fill-color': '#9edbe7', 'fill-opacity': .09 } });
  map.addLayer({ id: 'crew-coverage-line', type: 'line', source: 'crew-coverage', paint: { 'line-color': '#9edbe7', 'line-width': 2, 'line-dasharray': [2, 2] } });
  const ancestor = (id: string, level: number) => {
    let zone = byId.get(id);
    while (zone && zone.level > level) zone = byId.get(zone.parentId ?? '');
    return zone;
  };
  const render = () => {
    if (!map.getSource('crew-routes') || !map.getSource('crew-coverage')) return;
    const level = commandLevel(map.getZoom());
    onLevel(level);
    markers.forEach(m => m.remove()); markers = [];
    const groups = new Map<string, { zone: RegionZone; names: string[]; transit: boolean; area: boolean }>();
    const routes: GeoJSON.Feature[] = [];
    const coverage: GeoJSON.Feature[] = [];
    for (const person of state.survivors) {
      const position = crewPositionFor(state, person.id);
      if (!position || position.kind === 'away-unknown') continue;
      if (position.kind === 'area-duty') {
        const zone = byId.get(position.areaZoneId);
        if (zone?.geometry) coverage.push({ type: 'Feature', properties: {}, geometry: zone.geometry as GeoJSON.Geometry });
        // A whole-area assignment is always shown as area coverage, never as a
        // guessed crew coordinate within a leaf zone.
        if (zone && level <= zone.level) {
          const parent = ancestor(zone.id, level) ?? zone;
          const key = `area:${parent.id}`;
          const group = groups.get(key) ?? { zone: parent, names: [], transit: false, area: true };
          group.names.push(person.name); groups.set(key, group);
        }
        continue;
      }
      const leaf = knownCrewL3Zone(position);
      const zone = leaf ? ancestor(leaf, level) : undefined;
      if (!zone) continue;
      const group = groups.get(zone.id) ?? { zone, names: [], transit: false, area: false };
      group.names.push(person.name); group.transit ||= position.kind === 'transit'; groups.set(zone.id, group);
      if (position.kind === 'transit' && routes.length < 20) {
        const coordinates = position.routeZoneIds.map(id => byId.get(id)?.at).filter((at): at is [number, number] => !!at);
        if (coordinates.length > 1) routes.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
      }
    }
    (map.getSource('crew-routes') as GeoJSONSource).setData({ type: 'FeatureCollection', features: routes });
    (map.getSource('crew-coverage') as GeoJSONSource).setData({ type: 'FeatureCollection', features: coverage });
    const occupied: { left: number; top: number; right: number; bottom: number }[] = [];
    const label = (zone: RegionZone, text: string, title: string, crew = false, tag?: string) => {
      if (!zone.at || !map.getBounds().contains(zone.at) || markers.length >= 100) return;
      const point = map.project(zone.at);
      if (tag && (point.y < 155 || point.y > map.getCanvas().clientHeight - 190 || point.x < 90 || point.x > map.getCanvas().clientWidth - 70)) return;
      const width = Math.min(180, Math.max(70, text.length * 7 + 20)), height = tag ? 38 : 32;
      let offset = 0;
      if (!crew) {
        const placement = [0, -38, 38, -76, 76].find(dy => {
          const box = { left: point.x - width / 2 - 5, right: point.x + width / 2 + 5, top: point.y + dy - height / 2 - 4, bottom: point.y + dy + height / 2 + 4 };
          return !occupied.some(r => box.left < r.right && box.right > r.left && box.top < r.bottom && box.bottom > r.top);
        });
        if (placement === undefined) return;
        offset = placement;
      }
      occupied.push(crew ? { left: point.x, right: point.x + width + 20, top: point.y - height - 16, bottom: point.y + 6 } : { left: point.x - width / 2 - 5, right: point.x + width / 2 + 5, top: point.y + offset - height / 2 - 4, bottom: point.y + offset + height / 2 + 4 });
      const button = document.createElement('button');
      button.type = 'button'; button.className = crew ? 'rz-map-unit' : 'rz-map-area-label';
      button.textContent = text;
      if (tag) { button.classList.add('rz-map-place-label'); button.classList.toggle('is-owned', state.zones[zone.id]?.status === 'controlled'); const caption = document.createElement('small'); caption.textContent = tag; button.append(caption); button.dataset.zoneId = zone.id; }
      button.title = title; button.setAttribute('aria-label', title);
      button.addEventListener('click', event => { event.stopPropagation(); onSelect(zone.id); });
      markers.push(new lib.Marker({ element: button, anchor: crew ? 'bottom-left' : 'center', offset: [0, offset] }).setLngLat(zone.at).addTo(map));
    };
    for (const { zone, names, transit, area } of groups.values()) if (!(individualCrew && level === 3 && !area)) label(zone,
      `${area ? '▱' : transit ? '→' : '●'} ${names.length === 1 && level === 3 ? names[0].split(' ')[0] : `${names.length} crew`}`,
      `${names.join(', ')} · ${area ? 'områdevakt i' : transit ? 'på reise ved' : 'ved'} ${zone.name}`, true);
    if (level === 3 && map.getZoom() >= 12.7) {
      // Never pin people or an area-duty crew to an invented point. These are public place labels.
      for (const group of groups.values()) if (group.zone.at) { const p = map.project(group.zone.at); occupied.push({ left: p.x - 30, right: p.x + 220, top: p.y - 65, bottom: p.y + 50 }); }
      const known = world.zones.filter(zone => zone.level === 3 && zone.at && state.zones[zone.id]?.status !== 'unknown');
      const home = byId.get(state.homeZoneId)?.at;
      known.sort((a, b) => Number(state.zones[b.id]?.status === 'controlled') - Number(state.zones[a.id]?.status === 'controlled') || (home ? Math.hypot(a.at![0] - home[0], a.at![1] - home[1]) - Math.hypot(b.at![0] - home[0], b.at![1] - home[1]) : 0));
      for (const zone of known.slice(0, 18)) {
        const faction = state.factions.find(f => f.zoneId === zone.id && f.known && !f.defeated);
        const tag = state.zones[zone.id].status === 'controlled' ? 'Ditt område' : faction ? 'Annen gruppe' : 'Speidet';
        label(zone, zone.name, `${zone.name} · ${tag === 'Speidet' ? 'Speidet, ikke overtatt' : tag}`, false, tag);
      }
    }
    if (level < 3) for (const area of world.zones.filter(z => z.level === level)) {
      const leaves = areaLeaves(world, area.id);
      const known = leaves.filter(z => state.zones[z.id]?.status !== 'unknown');
      if (!known.length) continue;
      const own = leaves.filter(z => state.zones[z.id]?.status === 'controlled').length;
      label(area, `${area.name} · ${own}/${leaves.length}`, `${area.name}: ${own} av ${leaves.length} soner kontrollert. ${known.length} kjent. Åpne område.`);
    }

  };
  map.on('moveend', render);
  render();
  return { update(next) { state = next; render(); }, destroy() {
    map.off('moveend', render); markers.forEach(m => m.remove());
    for (const id of ['crew-routes', 'crew-coverage-fill', 'crew-coverage-line']) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of ['crew-routes', 'crew-coverage']) if (map.getSource(id)) map.removeSource(id);
  } };
}
