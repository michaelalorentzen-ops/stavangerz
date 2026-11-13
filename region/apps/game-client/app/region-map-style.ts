/**
 * The game's own map: built from OpenStreetMap at build time (tools/zone-editor/zonebasemap.py) and served with the game.
 * Dark sea, land and land use, roads, and buildings in 3D when you zoom in. No tiles from anyone else while playing.
 */
import type { Map as LibreMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';

const BASE = '/world/basemap';
export const MAP_ATTRIBUTION = '© OpenStreetMap-bidragsytere (ODbL) · © Kartverket · © NIBIO AR5';
export const COLORS = {
  sea: '#173642', land: '#49544a', home: '#ffe08a', owned: '#6fd08a', faction: '#a98be0', enemy: '#e0588f', zombie: '#d8462f', hq: '#e2b84a', wonder: '#7fd7e8',
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
        'fill-color': ['match', ['get', 'k'], 'residential', '#596055', 'industry', '#515955', 'farm', '#566145', 'forest', '#344d3c', 'grass', '#4a6048',
          'heath', '#62634a', 'wetland', '#3b5950', 'sand', '#83795c', 'rock', '#67716a', 'water', '#254650', '#49544a'],
        'fill-opacity': .95 } },
      { id: 'coast', type: 'line', source: 'land', paint: { 'line-color': '#a0b4a0', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, .6, 15, 2], 'line-blur': .35 } },
      { id: 'roads-minor', type: 'line', source: 'roads', minzoom: 12.5, filter: ['in', ['get', 'c'], ['literal', ['minor', 'track']]], paint: {
        'line-color': '#84917b', 'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, .4, 16, 3], 'line-dasharray': ['case', ['==', ['get', 'c'], 'track'], ['literal', [2, 2]], ['literal', [1, 0]]] } },
      { id: 'roads-medium', type: 'line', source: 'roads', minzoom: 10.5, filter: ['==', ['get', 'c'], 'medium'], paint: {
        'line-color': '#a0a18c', 'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, .5, 16, 5] } },
      { id: 'roads-major-casing', type: 'line', source: 'roads', filter: ['==', ['get', 'c'], 'major'], paint: {'line-color':'#283b38','line-width':['interpolate',['linear'],['zoom'],9,1.6,16,9.5],'line-opacity':.75} },
      { id: 'roads-major', type: 'line', source: 'roads', filter: ['==', ['get', 'c'], 'major'], paint: {
        'line-color': '#c2b999', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, .6, 16, 7] } },
      { id: 'buildings', type: 'fill-extrusion', source: 'buildings', minzoom: 13.5, paint: {
        'fill-extrusion-color': '#9a9b83', 'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 15, ['get', 'h']],
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
