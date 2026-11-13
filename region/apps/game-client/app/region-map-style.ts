/**
 * The game's own map: built from OpenStreetMap at build time (tools/zone-editor/zonebasemap.py) and served with the game.
 * Dark sea, land and land use, roads, and buildings in 3D when you zoom in. No tiles from anyone else while playing.
 */
import type { Map as LibreMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';

const BASE = '/world/basemap';
export const MAP_ATTRIBUTION = '© OpenStreetMap-bidragsytere (ODbL) · © Kartverket · © NIBIO AR5';
export const COLORS = {
  sea: '#102b39', land: '#344138', home: '#ffe08a', owned: '#6fd08a', faction: '#a98be0', enemy: '#e0588f', zombie: '#d8462f', hq: '#e2b84a', wonder: '#7fd7e8',
};

export function gameStyle(): StyleSpecification {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  return {
    version: 8,
    sources: {
      land: { type: 'geojson', data: `${BASE}/land.json` },
      landuse: { type: 'geojson', data: `${BASE}/landuse.json` },
      roads: { type: 'geojson', data: `${BASE}/roads.json` },
      buildings: { type: 'geojson', data: empty },
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': COLORS.sea } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': COLORS.land } },
      { id: 'landuse', type: 'fill', source: 'landuse', paint: {
        'fill-color': ['match', ['get', 'k'], 'residential', '#41483d', 'industry', '#424747', 'farm', '#3e4936', 'forest', '#293f33', 'grass', '#3b4c38',
          'heath', '#424b37', 'wetland', '#304844', 'sand', '#5c5b48', 'rock', '#4d534c', 'water', '#153644', '#344138'],
        'fill-opacity': .95 } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#6a928b', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, .6, 15, 2], 'line-blur': 1.5 } },
      { id: 'roads-minor', type: 'line', source: 'roads', minzoom: 12.5, filter: ['in', ['get', 'c'], ['literal', ['minor', 'track']]], paint: {
        'line-color': '#718071', 'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, .4, 16, 3], 'line-dasharray': ['case', ['==', ['get', 'c'], 'track'], ['literal', [2, 2]], ['literal', [1, 0]]] } },
      { id: 'roads-medium', type: 'line', source: 'roads', minzoom: 10.5, filter: ['==', ['get', 'c'], 'medium'], paint: {
        'line-color': '#899082', 'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, .5, 16, 5] } },
      { id: 'roads-major', type: 'line', source: 'roads', filter: ['==', ['get', 'c'], 'major'], paint: {
        'line-color': '#b3ac8c', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, .6, 16, 7] } },
      { id: 'buildings', type: 'fill-extrusion', source: 'buildings', minzoom: 13.5, paint: {
        'fill-extrusion-color': '#70786b', 'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 15, ['get', 'h']],
        'fill-extrusion-opacity': .88 } },
    ],
  };
}

/** Load building cells as the view needs them, once each. */
export function attachBuildings(map: LibreMap) {
  const abort = new AbortController();
  let disposed = false;
  let index: { file: string; bbox: [number, number, number, number] }[] = [];
  const loaded = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  fetch(`${BASE}/index.json`, { signal: abort.signal }).then(r => r.json()).then((i: { buildings: typeof index }) => { index = i.buildings; update(); }).catch(() => undefined);
  const update = () => {
    if (disposed || map.getZoom() < 13.2 || !index.length) return;
    const b = map.getBounds();
    const want = index.filter(c => !loaded.has(c.file) && c.bbox[0] < b.getEast() && c.bbox[2] > b.getWest() && c.bbox[1] < b.getNorth() && c.bbox[3] > b.getSouth());
    for (const c of want) {
      loaded.add(c.file);
      fetch(`${BASE}/${c.file}`, { signal: abort.signal }).then(r => r.json()).then((fc: GeoJSON.FeatureCollection) => {
        if (disposed) return;
        features.push(...fc.features);
        (map.getSource('buildings') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
      }).catch(() => loaded.delete(c.file));
    }
  };
  map.once('remove', () => { disposed = true; abort.abort(); map.off('moveend', update); });
  map.on('moveend', update);
  update();
}

/** A small DOM marker: a coloured badge with a glyph, so we need no font or sprite server. */
export function markerElement(kind: 'home' | 'hq' | 'wonder' | 'faction' | 'enemy', title: string) {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', title);
  el.className = `rz-marker rz-marker-${kind}`;
  el.title = title;
  el.textContent = { home: '★', hq: '⌂', wonder: '✦', faction: '◆', enemy: '✖' }[kind];
  return el;
}
