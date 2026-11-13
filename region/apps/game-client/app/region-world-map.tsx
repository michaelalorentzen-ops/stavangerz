 'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LibreMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import { indexWorld, WONDERS, wonderZone, type ActionId, type Flows, type RegionState, type RegionWorld } from '../../../packages/gameplay/src/region/index';
import { attachBuildings, COLORS, gameStyle, MAP_ATTRIBUTION, markerElement } from './region-map-style';
import { attachTerritoryCaptureEffects, territoryShifts, type TerritoryCaptureController } from './territory-capture-effects';
import { attachOperationalMap, type OperationalMapController } from './operational-map';
import { wonderOperational } from '../../../packages/gameplay/src/region/wonders';
import { attachWorldObjects, type WorldObjectController } from './world-object-layer';
import './world-map.css';
const STATUS_LABEL = { unknown: 'Ukjent', scouted: 'Speidet', controlled: 'Deres' } as const;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('nb-NO', { maximumFractionDigits: 1 })}`;
export default function RegionWorldMap({ focus, world, state, flows, overlay, selected, hops, replayMoves, onSelect, onOverlay, onSelectPoi, onSelectCrew, targeting, validTargetZoneIds }: { focus: { zoneId: string; key: number } | null; world: RegionWorld; state: RegionState; flows: Flows; overlay: 'zombies' | 'food'; selected: string; hops: Map<string, number>; replayMoves?: { from: string; to: string; n: number }[]; onSelect: (id: string) => void; onOverlay: (o: 'zombies' | 'food') => void; onSelectPoi?: (poiId: string) => void; onSelectCrew?: (personId: string) => void; targeting?: { action: ActionId; crewIds: string[] }; validTargetZoneIds?: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const markersRef = useRef<{ remove: () => void }[]>([]);
  const objectsRef = useRef<WorldObjectController | null>(null);
  const callbacksRef = useRef({ onSelectPoi, onSelectCrew }); callbacksRef.current = { onSelectPoi, onSelectCrew };
  const captureRef = useRef<TerritoryCaptureController | null>(null);
  const operationsRef = useRef<OperationalMapController | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3>(3);
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const previousZonesRef = useRef<RegionState['zones'] | undefined>(undefined);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const flowsRef = useRef(flows);
  flowsRef.current = flows;
  const index = indexWorld(world);
  useEffect(() => {
    let map: LibreMap | null = null;
    let cancelled = false;
    import('maplibre-gl').then(lib => {
      if (cancelled || !ref.current) return;
      libRef.current = lib;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const home = index.byId.get(state.homeZoneId)?.at ?? [5.73, 58.97];
      map = new lib.Map({ container: ref.current, center: home, zoom: 14, pitch: 35, minZoom: 9, maxZoom: 17.5, maxPitch: 60, dragRotate: true, attributionControl: false, style: gameStyle() });
      map.addControl(new lib.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }));
      map.addControl(new lib.NavigationControl({ visualizePitch: true, showZoom: false }), 'bottom-right');
      map.on('load', () => {
        attachBuildings(map!);
        const l3 = world.zones.filter(z => z.level === 3 && z.geometry).map(z => ({ type: 'Feature' as const, id: z.id, properties: { id: z.id }, geometry: z.geometry as GeoJSON.Geometry }));
        const outlines = (level: number) => world.zones.filter(z => z.level === level && z.geometry).map(z => ({ type: 'Feature' as const, properties: { id: z.id }, geometry: z.geometry as GeoJSON.Geometry }));
        map!.addSource('l3', { type: 'geojson', data: { type: 'FeatureCollection', features: l3 }, promoteId: 'id' });
        map!.addSource('l2', { type: 'geojson', data: { type: 'FeatureCollection', features: outlines(2) } });
        map!.addSource('l1', { type: 'geojson', data: { type: 'FeatureCollection', features: outlines(1) } });
        const links = world.links.map(l => ({ type: 'Feature' as const, properties: { id: l.id, kind: l.kind }, geometry: { type: 'LineString' as const, coordinates: [index.byId.get(l.a)!.at!, index.byId.get(l.b)!.at!] } }));
        map!.addSource('links', { type: 'geojson', data: { type: 'FeatureCollection', features: links }, promoteId: 'id' });
        map!.addSource('heat', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map!.addSource('moves', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        // What you do not know lies in fog. What is yours glows.
        map!.addLayer({ id: 'l3-fill', type: 'fill', source: 'l3', paint: {
          'fill-color-transition': { duration: 500, delay: 0 },
          'fill-color': ['case', ['==', ['feature-state', 'mode'], 'food'],
            ['case', ['==', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled'], ['interpolate', ['linear'], ['coalesce', ['feature-state', 'net'], 0], -3, '#c0533f', 0, '#8f8a5a', 6, '#4f9a6b'], '#05090b'],
            ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled', COLORS.owned, 'faction', COLORS.faction, 'enemy', COLORS.enemy, 'scouted',
              ['interpolate', ['linear'], ['coalesce', ['feature-state', 'z'], 0], 0, '#8a9a64', 25, '#b08a3e', 100, '#a2412f', 300, '#5e1a24'], '#04080a']],
          'fill-opacity': ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'unknown', ['case', ['boolean', ['feature-state', 'reach'], false], .22, .36], 'controlled', .10, 'scouted', .13, .20] } });
        map!.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', maxzoom: 16, paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 0, 0, 300, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, .6, 15, 1.4],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 12, 13, 40, 16, 90],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', .2, 'rgba(120,20,20,.25)', .5, 'rgba(200,50,30,.45)', 1, 'rgba(255,120,60,.6)'],
          'heatmap-opacity': .55 } });
        map!.addLayer({ id: 'l3-line', type: 'line', source: 'l3', paint: { 'line-color': '#0a1214', 'line-width': .6, 'line-opacity': .8 } });
        captureRef.current = attachTerritoryCaptureEffects(map!, new Map(index.l3.filter(z => z.geometry).map(z => [z.id, z.geometry as GeoJSON.Geometry])));
        map!.addLayer({ id: 'l3-glow', type: 'line', source: 'l3', paint: {
          'line-color': ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled', COLORS.owned, 'enemy', COLORS.enemy, 'faction', COLORS.faction, 'rgba(0,0,0,0)'],
          'line-width': ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled', 2.4, 'enemy', 2, 'faction', 1.6, 0], 'line-blur': 2, 'line-opacity': .85 } });
        for (const areaLevel of [1, 2] as const) {
          map!.addLayer({ id: `l${areaLevel}-hit`, type: 'fill', source: `l${areaLevel}`, minzoom: areaLevel === 1 ? 0 : 10.5, maxzoom: areaLevel === 1 ? 10.5 : 12, paint: { 'fill-color': '#a9c2bc', 'fill-opacity': .025 } });
          map!.on('click', `l${areaLevel}-hit`, (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id; if (id) onSelectRef.current(id); });
          map!.addLayer({ id: `l${areaLevel}-selected`, type: 'line', source: `l${areaLevel}`, filter: ['==', ['get', 'id'], ''], paint: { 'line-color': COLORS.home, 'line-width': 3 } });
        }
        map!.addLayer({ id: 'l2-line', type: 'line', source: 'l2', paint: { 'line-color': '#d9d2b0', 'line-width': 1, 'line-opacity': .16 } });
        map!.addLayer({ id: 'l1-line', type: 'line', source: 'l1', paint: { 'line-color': '#f2e2a0', 'line-width': 2, 'line-opacity': .22, 'line-dasharray': [4, 2] } });
        map!.addLayer({ id: 'links', type: 'line', source: 'links', paint: {
          'line-color': ['match', ['coalesce', ['feature-state', 'c'], 'open'], 'blown', '#e05a4a', 'flooded', '#4a8ee0', 'blocked', '#e0a64a', 'held', '#6fd08a', '#e8e1c4'],
          'line-width': 3, 'line-dasharray': [2, 1.5] } });
        map!.addLayer({ id: 'moves', type: 'line', source: 'moves', minzoom: 12, paint: {
          'line-color': COLORS.zombie, 'line-width': ['interpolate', ['linear'], ['get', 'n'], 1, 1.5, 30, 6], 'line-opacity': .8, 'line-dasharray': [0, 2, 2] }, layout: { 'line-cap': 'round' } });
        map!.addLayer({ id: 'valid-targets', type: 'line', source: 'l3', filter: ['in', ['get', 'id'], ['literal', []]], paint: { 'line-color': '#b4d8ee', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': .8 } });
        map!.addLayer({ id: 'l3-selected', type: 'line', source: 'l3', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': COLORS.home, 'line-width': 3 } });
        map!.on('click', 'l3-fill', (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id as string | undefined; if (id && map!.getZoom() >= 12) onSelectRef.current(id); });
        map!.on('mousemove', 'l3-fill', (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (!id) return;
          const z = stateRef.current.zones[id];
          const name = index.byId.get(id)?.name ?? '';
          const net = flowsRef.current.zones[id]?.net;
          setHover({ x: e.point.x, y: e.point.y, text: `${name} · ${z.owner ? 'Annen gruppe' : STATUS_LABEL[z.status]}${z.intel && !z.owner ? ` · ${z.intel.min}–${z.intel.max} zombier` : ''}${net !== undefined && z.status === 'controlled' ? ` · ${signed(net)} mat/dag` : ''}` });
          map!.getCanvas().style.cursor = 'pointer';
        });
        map!.on('mouseleave', 'l3-fill', () => { setHover(null); map!.getCanvas().style.cursor = ''; });
        objectsRef.current = attachWorldObjects(map!, lib, world, stateRef.current, { onCrew: (id, zoneId) => { if (callbacksRef.current.onSelectCrew) callbacksRef.current.onSelectCrew(id); else onSelectRef.current(zoneId); }, onZone: id => onSelectRef.current(id) });
        operationsRef.current = attachOperationalMap(map!, lib, world, stateRef.current, id => onSelectRef.current(id), setLevel, true);
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => { cancelled = true; objectsRef.current?.destroy(); objectsRef.current = null; operationsRef.current?.destroy(); operationsRef.current = null; markersRef.current.forEach(m => m.remove()); captureRef.current?.destroy(); captureRef.current = null; previousZonesRef.current = undefined; map?.remove(); mapRef.current = null; };
    // The map is created once; state is pushed through feature-state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !ready || !lib) return;
    operationsRef.current?.update(state);
    objectsRef.current?.update(state);
    for (const zone of index.l3) {
      const z = state.zones[zone.id];
      const f = state.factions.find(x => x.zoneId === zone.id && !x.defeated);
      // Journal-controlled territory must not stay tinted as an old enemy
      // just because the replay deliberately retains its previous faction data.
      const s = z.status === 'controlled' ? 'controlled' : f && f.known ? (f.hostile ? 'enemy' : 'faction') : z.status;
      map.setFeatureState({ source: 'l3', id: zone.id }, { s, z: z.intel ? (z.intel.min + z.intel.max) / 2 : 0, reach: hops.has(zone.id), net: flows.zones[zone.id]?.net ?? 0, mode: overlay });
    }
    const shifts = territoryShifts(previousZonesRef.current, state.zones);
    previousZonesRef.current = state.zones;
    if (shifts.length) void captureRef.current?.play(shifts.map(change => ({ ...change, entry: index.byId.get(change.zoneId)?.at })), 650);
    for (const l of world.links) map.setFeatureState({ source: 'links', id: l.id }, { c: state.chokepoints[l.id] });
    // Heat only where you have looked.
    const heat = index.l3.filter(z => state.zones[z.id].intel && state.zones[z.id].status !== 'controlled' && z.at).map(z => ({ type: 'Feature' as const, properties: { n: (state.zones[z.id].intel!.min + state.zones[z.id].intel!.max) / 2 }, geometry: { type: 'Point' as const, coordinates: z.at! } }));
    (map.getSource('heat') as GeoJSONSource).setData({ type: 'FeatureCollection', features: heat });
    map.setPaintProperty('heat', 'heatmap-opacity', overlay === 'food' ? 0 : .55);
    const moves = (replayMoves ?? state.reports.at(-1)?.moves ?? []).filter(m => index.byId.get(m.from)?.at && index.byId.get(m.to)?.at).map(m => ({ type: 'Feature' as const, properties: { n: m.n }, geometry: { type: 'LineString' as const, coordinates: [index.byId.get(m.from)!.at!, index.byId.get(m.to)!.at!] } }));
    (map.getSource('moves') as GeoJSONSource).setData({ type: 'FeatureCollection', features: moves });
    // All known geographic POIs remain selectable; unknown active sites stay hidden.
    markersRef.current.forEach(m => m.remove()); markersRef.current = [];
    const add = (at: [number, number] | undefined, kind: Parameters<typeof markerElement>[0], title: string, select: () => void, label?: string) => {
      if (!at) return;
      const element = markerElement(kind, title);
      if (label) element.textContent = label;
      element.addEventListener('click', event => { event.stopPropagation(); select(); });
      markersRef.current.push(new lib.Marker({ element }).setLngLat(at).addTo(map));
    };
    for (const p of world.pois.filter(p => state.zones[p.zoneId]?.status !== 'unknown')) {
      add(p.at, p.role === 'hq' ? 'hq' : 'wonder', p.name, () => { onSelectRef.current(p.zoneId); callbacksRef.current.onSelectPoi?.(p.id); }, p.role === 'hq' ? '⌂' : p.kind.includes('water') ? '≈' : p.role === 'resource' ? '▧' : '◇');
    }
    for (const d of WONDERS) { const zid = state.wonders?.[d.id]?.zoneId ?? (d.found === 'claim' ? wonderZone(world, d) : undefined); if (zid && (state.wonders?.[d.id] || state.zones[zid]?.status !== 'unknown')) add(index.byId.get(zid)?.at, 'wonder', `${d.name}${state.wonders?.[d.id] ? wonderOperational(state.wonders[d.id]) ? ' (operativt)' : ' (kjent)' : ''}`, () => onSelectRef.current(zid)); }
    for (const f of state.factions.filter(f => f.known && !f.defeated && state.zones[f.zoneId]?.status !== 'controlled')) add(index.byId.get(f.zoneId)?.at, f.hostile ? 'enemy' : 'faction', f.name, () => onSelectRef.current(f.zoneId));
    add(index.byId.get(state.homeZoneId)?.at, 'home', 'Leiren · egen posisjon', () => onSelectRef.current(state.homeZoneId));
  }, [state, ready, hops, world, index, flows, overlay, replayMoves]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !(replayMoves ?? state.reports.at(-1)?.moves ?? []).length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dash = [[0, 4, 3], [.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, .5], [3, 4, 0]];
    let frame = 0, step = 0, last = 0;
    const animate = (time: number) => {
      if (time - last > 90 && map.getZoom() >= 12 && map.getLayer('moves')) {
        map.setPaintProperty('moves', 'line-dasharray', dash[step++ % dash.length]); last = time;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [ready, replayMoves, state.reports]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer('valid-targets')) map.setFilter('valid-targets', ['in', ['get', 'id'], ['literal', targeting ? validTargetZoneIds ?? [] : []]]);
    for (const n of [1, 2, 3]) map.setFilter(`l${n}-selected`, ['==', ['get', 'id'], selected]);
  }, [selected, ready, targeting, validTargetZoneIds]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !ref.current) return;
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready]);
  useEffect(() => {
    if (!focus || !ready) return;
    const at = index.byId.get(focus.zoneId)?.at;
    if (at) mapRef.current?.easeTo({ center: at, zoom: index.byId.get(focus.zoneId)?.level === 3 ? Math.max(mapRef.current.getZoom(), 12.5) : index.byId.get(focus.zoneId)?.level === 2 ? 11 : 10, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450 });
  }, [focus, ready, world]);
  return <section className="rz-map" aria-label="Kart over regionen" aria-busy={!ready}>
    {targeting && <div className="rz-map-targeting" role="status">Velg mål på kartet · {targeting.crewIds.length} crew · {validTargetZoneIds?.length ?? 0} mulige soner</div>}
    <div ref={ref} className="rz-map-canvas" />
    {!ready && <p className="rz-map-loading" role="status">Tegner kartet …</p>}
    {hover && <div className="rz-tip" style={{ left: hover.x + 14, top: hover.y + 10 }}>{hover.text}</div>}
    <div className="rz-legend">{overlay === 'zombies'
      ? <><span><i style={{ background: COLORS.owned }} />Deres</span><span><i style={{ background: '#b08a3e' }} />Speidet</span><span><i style={{ background: COLORS.zombie }} />Zombier og nattens bevegelser</span><span><i style={{ background: COLORS.faction }} />Gruppe</span><span><i style={{ background: COLORS.enemy }} />Fiender</span><span><i style={{ background: '#04080a', border: '1px solid #333' }} />Ukjent</span></>
      : <><span><i style={{ background: '#4f9a6b' }} />Gir mat</span><span><i style={{ background: '#8f8a5a' }} />Går i null</span><span><i style={{ background: '#c0533f' }} />Koster mat</span></>}</div>
    <div className="rz-map-tools"><span className="rz-command-level">{level === 3 ? 'L3 · Lokale soner' : level === 2 ? 'L2 · Distrikter' : 'L1 · Regioner'}</span>
      <button aria-label="Zoom inn" onClick={() => mapRef.current?.zoomIn()}>+</button><button aria-label="Zoom ut" onClick={() => mapRef.current?.zoomOut()}>−</button>
      <button className={overlay === 'zombies' ? 'on' : ''} onClick={() => onOverlay('zombies')}>Zombier</button>
      <button className={overlay === 'food' ? 'on' : ''} onClick={() => onOverlay('food')}>Netto mat</button>
      <button onClick={() => { const at = index.byId.get(state.homeZoneId)?.at; if (at) mapRef.current?.flyTo({ center: at, zoom: 14.5, pitch: 40 }); onSelect(state.homeZoneId); }}>Til leiren</button>
    </div>
  </section>;
}
