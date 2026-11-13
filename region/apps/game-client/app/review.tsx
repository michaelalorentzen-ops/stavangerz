'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, Marker } from 'maplibre-gl';
import type { FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import draft from '../../../packages/world-data/data/world-draft.json';
import basemap from '../../../packages/world-data/data/basemap.json';
import locations from '../../../packages/world-data/data/review-locations.json';
import type { WorldDefinition } from '../../../packages/world-data/src/model';
import { createPreviewState } from '../../../packages/world-data/src/preview';

const world = draft as unknown as WorldDefinition;
const preview = createPreviewState(world);
const cells = world.zones.filter(z => z.level === 3);
const collection = (items: readonly { id: string; geometry: unknown }[]): FeatureCollection => ({
  type: 'FeatureCollection', features: items.map(item => ({ type: 'Feature', id: item.id, properties: { ...item, geometry: undefined } as GeoJsonProperties, geometry: item.geometry as Geometry })),
});
const byId = new Map(world.zones.map(z => [z.id, z]));
const center = (id: string): [number, number] => {
  const point = locations.find(p => p.id === id);
  return point ? [point.lon, point.lat] : [5.732, 58.990];
};

export default function GeographyReview() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [level, setLevel] = useState(3);
  const [selected, setSelected] = useState('cell-003');
  const [routes, setRoutes] = useState(true);
  const [barriers, setBarriers] = useState(true);
  const [dayZero, setDayZero] = useState(false);
  const [routeId, setRouteId] = useState('');
  const [selectedPoi, setSelectedPoi] = useState('');
  const selectedZone = byId.get(selected)!;
  const connections = world.edges.filter(e => e.fromCellId === selected || e.toCellId === selected);
  const selectedRoute = world.edges.find(e => e.id === routeId);

  useEffect(() => {
    let disposed = false;
    let instance: LibreMap | undefined;
    const markers: Marker[] = [];
    import('maplibre-gl').then(lib => {
      if (disposed || !container.current) return;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      instance = new lib.Map({ container: container.current, center: [5.731, 58.990], zoom: 14.8,
        maxZoom: 19, minZoom: 12, attributionControl: false,
        style: { version: 8, sources: {}, layers: [{ id: 'sea', type: 'background', paint: { 'background-color': '#18282c' } }] },
      });
      map.current = instance;
      instance.addControl(new lib.NavigationControl({ showCompass: true }), 'top-left');
      instance.addControl(new lib.ScaleControl({ unit: 'metric' }), 'bottom-left');
      instance.addControl(new lib.AttributionControl({ compact: false, customAttribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a> | Stavanger Z · ugodkjent soneutkast' }));
      instance.on('error', event => { if (!disposed) setError(event.error.message); });
      instance.on('load', () => {
        if (disposed || !instance) return;
        instance.addSource('context', { type: 'geojson', data: basemap as FeatureCollection });
        instance.addSource('zones', { type: 'geojson', data: collection(world.zones) });
        instance.addSource('edges', { type: 'geojson', data: collection(world.edges) });
        instance.addSource('barriers', { type: 'geojson', data: collection(world.barriers) });
        instance.addSource('frontiers', { type: 'geojson', data: collection(world.frontiers ?? []) });
        instance.addLayer({ id: 'land', type: 'fill', source: 'zones', filter: ['==', ['get', 'level'], 1], paint: { 'fill-color': '#343d37' } });
        instance.addLayer({ id: 'zone-fill', type: 'fill', source: 'zones', filter: ['==', ['get', 'level'], 3], paint: {
          'fill-color': ['case', ['==', ['get', 'playable'], false], '#786d54', ['==', ['get', 'parentId'], 'district-001'], '#687b53', '#567976'], 'fill-opacity': .23,
        } });
        instance.addLayer({ id: 'buildings', type: 'line', source: 'context', filter: ['==', ['get', 'kind'], 'building'], paint: { 'line-color': '#9b9f89', 'line-opacity': .23, 'line-width': .6 } });
        instance.addLayer({ id: 'roads', type: 'line', source: 'context', filter: ['all', ['==', ['get', 'kind'], 'road'], ['!=', ['get', 'tunnel'], 'yes']], paint: { 'line-color': '#afad91', 'line-opacity': .48, 'line-width': ['case', ['in', ['get', 'highway'], ['literal', ['primary', 'secondary', 'tertiary']]], 2.4, .9] } });
        instance.addLayer({ id: 'tunnels', type: 'line', source: 'context', filter: ['==', ['get', 'tunnel'], 'yes'], paint: { 'line-color': '#a695d0', 'line-opacity': .7, 'line-width': 2, 'line-dasharray': [2, 3] } });
        instance.addLayer({ id: 'coast', type: 'line', source: 'context', filter: ['==', ['get', 'kind'], 'coast'], paint: { 'line-color': '#819b9c', 'line-width': 1.3 } });
        instance.addLayer({ id: 'zone-boundaries', type: 'line', source: 'zones', filter: ['==', ['get', 'level'], 3], paint: { 'line-color': '#c2c9a7', 'line-width': 1.2, 'line-opacity': .8 } });
        instance.addLayer({ id: 'open-land-boundaries', type: 'line', source: 'frontiers', paint: { 'line-color': '#e0a665', 'line-width': 3, 'line-dasharray': [1, 2] } });
        instance.addLayer({ id: 'barrier-lines', type: 'line', source: 'barriers', paint: { 'line-color': '#82b3c1', 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': .7 } });
        instance.addLayer({ id: 'edge-lines', type: 'line', source: 'edges', paint: { 'line-color': ['case', ['==', ['get', 'status'], 'future'], '#c19a68', '#ced687'], 'line-width': 5 } });
        instance.addLayer({ id: 'edge-selected', type: 'line', source: 'edges', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#fff1c5', 'line-width': 8 } });
        instance.addLayer({ id: 'selection', type: 'line', source: 'zones', filter: ['==', ['get', 'id'], 'cell-003'], paint: { 'line-color': '#f3e4b6', 'line-width': 3 } });
        instance.on('click', 'zone-fill', event => { const id = event.features?.[0]?.properties?.id; if (id) { setSelected(String(id)); setSelectedPoi(''); setRouteId(''); } });
        instance.on('mouseenter', 'zone-fill', () => { if (instance) instance.getCanvas().style.cursor = 'pointer'; });
        instance.on('mouseleave', 'zone-fill', () => { if (instance) instance.getCanvas().style.cursor = ''; });
        for (const zone of cells) {
          const button = document.createElement('button');
          button.className = `zone-label ${zone.playable ? '' : 'future'}`;
          button.textContent = zone.id.slice(-2);
          button.title = zone.name; button.setAttribute('aria-label', `Velg ${zone.name}`);
          button.addEventListener('click', event => { event.stopPropagation(); setLevel(3); setSelected(zone.id); setSelectedPoi(''); setRouteId(''); });
          markers.push(new lib.Marker({ element: button }).setLngLat(center(zone.id)).addTo(instance));
        }
        for (const poi of world.pois) {
          const button = document.createElement('button');
          button.className = 'poi-marker'; button.textContent = poi.hqCandidate ? 'HQ?' : '+';
          button.title = poi.name; button.setAttribute('aria-label', `Vis POI: ${poi.name}`);
          button.addEventListener('click', event => { event.stopPropagation(); setLevel(3); setSelected(poi.cellId); setSelectedPoi(poi.id); setRouteId(''); });
          markers.push(new lib.Marker({ element: button }).setLngLat([...poi.geometry.coordinates]).addTo(instance));
        }
        instance.fitBounds([[5.716, 58.982], [5.744, 58.9978]], { padding: 45, duration: 0 });
        setLoaded(true);
      });
    }).catch(reason => { if (!disposed) setError(String(reason)); });
    return () => { disposed = true; markers.forEach(marker => marker.remove()); instance?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!loaded || !instance) return;
    instance.setFilter('zone-fill', ['==', ['get', 'level'], level]);
    instance.setFilter('zone-boundaries', ['==', ['get', 'level'], level]);
    instance.setFilter('selection', ['==', ['get', 'id'], selected]);
    instance.setFilter('edge-selected', ['==', ['get', 'id'], routeId]);
    instance.setLayoutProperty('edge-lines', 'visibility', routes ? 'visible' : 'none');
    instance.setLayoutProperty('edge-selected', 'visibility', routes ? 'visible' : 'none');
    instance.setLayoutProperty('barrier-lines', 'visibility', barriers ? 'visible' : 'none');
    instance.setPaintProperty('zone-fill', 'fill-opacity', dayZero ? ['case', ['==', ['get', 'id'], 'cell-003'], .38, .07] : .23);
  }, [loaded, level, selected, routeId, routes, barriers, dayZero]);

  function choose(id: string) {
    setSelected(id); setSelectedPoi(''); setRouteId('');
    map.current?.easeTo({ center: center(id), duration: 400 });
  }

  return <main>
    <header><div><strong>STAVANGER Z</strong><span>M1 GODKJENT / ARBEIDSKART</span></div><p>Buøy → Hundvåg sør <b>IKKE LÅST</b></p></header>
    <div className="workspace">
      <section className="map-region" aria-label="Kart over foreslåtte spillsoner">
        <div ref={container} className="map" />
        <div className="map-caption"><strong>13 L3 · 2 aktive L2</strong><span>11 første soner · Rosenberg og Engøy er framtidige</span></div>
        <div className="map-legend"><span className="buoy">Buøy</span><span className="hund">Hundvåg sør</span><span className="future-key">Framtidig</span><span>+ POI · HQ? kandidat</span><span>Blå stiplet: vannbarriere · lilla: tunnel · oransje prikket: umodellert land</span></div>
        {!loaded && !error ? <p className="map-message">Åpner lokalt geografisk uttrekk …</p> : null}
        {error ? <p role="alert" className="map-message">Kartfeil: {error}. Soner og forbindelser kan fortsatt leses i listen.</p> : null}
      </section>
      <aside aria-label="Geografisk vurdering">
        <section className="controls">
          <h1>Buøy / Hundvåg</h1>
          <p>Soneinndeling for første slice. Justeres videre etter spilling.</p>
          <div className="level-controls" aria-label="Geografisk nivå">{[1, 2, 3].map(n => <button key={n} aria-pressed={level === n} onClick={() => { setLevel(n); const first = world.zones.find(z => z.level === n)!; choose(first.id); }}>L{n} {n === 1 ? 'Region' : n === 2 ? 'Distrikt' : 'Sone'}</button>)}</div>
          <div className="toggles"><label><input type="checkbox" checked={routes} onChange={e => setRoutes(e.target.checked)} />Passasjer</label><label><input type="checkbox" checked={barriers} onChange={e => setBarriers(e.target.checked)} />Vannbarrierer</label><label><input type="checkbox" checked={dayZero} onChange={e => setDayZero(e.target.checked)} />Dag 0-skisse</label></div>
          {dayZero ? <p className="note">Kun sone 03 er kjent i skissen. Hele kartet er synlig her for gjennomgang; dette er ingen spillklient med skjult intel.</p> : null}
        </section>
        <section className="context" aria-live="polite">
          <div className="eyebrow">L{selectedZone.level} / {selectedZone.id} {selectedZone.playable ? '' : '/ FRAMTIDIG'}</div>
          <h2>{selectedZone.name}</h2>
          {selectedZone.parentId ? <p className="parent">{byId.get(selectedZone.parentId)?.name}</p> : null}
          <p>{selectedZone.rationale || 'Aggregat av underliggende soner. Ingen egen populasjon eller separat verden.'}</p>
          {selected === 'cell-003' ? <p className="note">Foreslått dag 0-start. Kjent: {preview.zoneStates[selected]?.knowledge === 'explored' ? 'ja' : 'nei'}. Ingen HQ er etablert.</p> : null}
          {selectedZone.level < 3 ? <p>{world.zones.filter(z => z.parentId === selected).length} direkte underområder</p> : null}
          {world.pois.some(p => p.cellId === selected) ? <><h3>POI-er</h3><ul className="poi-list">{world.pois.filter(p => p.cellId === selected).map(p => <li key={p.id}><button aria-pressed={selectedPoi === p.id} onClick={() => setSelectedPoi(p.id)}>{p.name}{p.hqCandidate ? ' · HQ-kandidat' : ''}</button></li>)}</ul></> : null}
          {selectedPoi ? <p className="note">Kilde: OSM-posisjon. Funksjon, faktisk adgang og eventuell HQ-egnethet er ikke bekreftet. Ingen loot eller kapasitet er tildelt.</p> : null}
          {connections.length ? <><h3>Eksplisitte passasjer</h3><ul className="connections">{connections.map(edge => {
            const other = edge.fromCellId === selected ? edge.toCellId : edge.fromCellId;
            return <li key={edge.id}><button aria-pressed={routeId === edge.id} onClick={() => { setRouteId(edge.id); setRoutes(true); }}>{edge.name}<small>→ {byId.get(other)?.name} · {edge.status === 'future' ? 'framtidig' : 'foreslått åpen'}</small></button></li>;
          })}</ul></> : null}
          {selectedRoute ? <p className="note">{selectedRoute.rationale} Modus: {selectedRoute.modes.join(', ')}.</p> : null}
        </section>
        <section className="zone-index"><h3>Velg {level === 3 ? 'L3-sone' : level === 2 ? 'L2-område' : 'L1-region'}</h3>{world.zones.filter(z => z.level === level).map(z => <button key={z.id} aria-pressed={selected === z.id} onClick={() => choose(z.id)}><span>{z.id.split('-').at(-1)}</span>{z.name}{!z.playable ? ' ↗' : ''}</button>)}</section>
        <section className="limits"><h3>Avgrensning</h3><p>Prikkede landgrenser viser umodellert fortsettelse, ikke vegger. Senere migrasjon må regnskapsføres mot et endelig eksternt reservoar. Lilla tunneler er kildekontekst; utløp og trafikkregler er ikke spillmodellert.</p><p>Redigerbart utkast: {world.worldVersion}. Ingen publisert spilltilstand er bundet til utkastet. Publiserte verdener skal beholdes uendret for sine lagrede spill.</p></section>
      </aside>
    </div>
  </main>;
}
