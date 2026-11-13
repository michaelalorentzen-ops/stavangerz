'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import { indexWorld, newRegionGame, startDanger, type RegionWorld, type RegionState } from '../../../packages/gameplay/src/region';
import { DIFFICULTIES, type CampaignOptions } from '../../../packages/gameplay/src/region/campaign';
import { CONTENT } from '../../../packages/world-data/src/content';
import { attachBuildings, gameStyle, MAP_ATTRIBUTION } from './region-map-style';
import './start-screen.css';
import { HudIcon, type HudIconName } from './hud-icons';
const DANGER_COLOR: Record<string,string> = { Rolig:'#5f9a5f',Middels:'#a8a24a',Krevende:'#c48a3a','Svært krevende':'#b8563c','Nesten umulig':'#7c2230' };
const number=(n:number)=>Math.round(n).toLocaleString('nb-NO');
export default function StartScreen({ world, saved, onStart }: { world: RegionWorld; saved: RegionState | null; onStart: (s: RegionState, fresh: boolean) => void }) {
  const index = useMemo(() => indexWorld(world), [world]);
  const [choice, setChoice] = useState(world.starts.find(s => s.name.startsWith('Lundsneset'))?.zoneId ?? world.starts[0]?.zoneId ?? '');
  const [campaignOptions, setCampaignOptions] = useState<CampaignOptions>({ difficulty: 'survival', hardcore: false });
  const [startPage, setStartPage] = useState(0);
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const estimates = useMemo(() => Object.fromEntries(index.l3.map(z => [z.id, startDanger(world, z.id)])), [world, index]);
  const seededStarts = useMemo(() => Object.fromEntries(world.starts.map(start => [start.zoneId, startDanger(world, start.zoneId, seed)])), [world, seed]);
  const zone = index.byId.get(choice);
  const d = useMemo(() => choice ? seededStarts[choice] ?? startDanger(world, choice, seed) : undefined, [world, choice, seed, seededStarts]);
  const dangers = useMemo(() => ({ ...estimates, ...seededStarts, ...(choice && d ? { [choice]: d } : {}) }), [estimates, seededStarts, choice, d]);
  const l2 = index.byId.get(zone?.parentId ?? '');
  const hqNear = [choice, ...(index.adjacent.get(choice) ?? []).map(a => a.to)].flatMap(id => (index.poisByZone.get(id) ?? []).filter(p => p.role === 'hq')).map(p => `${p.name} (${CONTENT.hqTypes.find(t => t.id === p.hqType)?.name ?? ''})`);
  return <main className={`rz-shell rz-start rz-start-ready ${saved?'is-returning':''}`}>
    <section className="rz-start-intro">
      <div className="rz-start-brand"><img src="/art/intro/hero.webp" className="rz-art rz-art-hero" alt="" /><div><p className="rz-kicker">ETTER DAG NULL</p><h1 className="start-wordmark"><span>STAVANGER</span><b>Z</b></h1><p className="start-tagline">Hele regionen. Ett døgn av gangen.</p></div></div>
      <p className="rz-start-lead">Led folkene dine gjennom utbruddet. Velg et startsted på kartet, gi ordre og se hva neste døgn bringer.</p>
      <details className="rz-start-story"><summary>Om verden og startstedet</summary><p>Tette bysentre har mye å finne, men så mange døde at første oppgave kan være å flykte. På landet finnes jord, båter og diesel, men avstandene er lange.</p></details>
      {saved && <button className="rz-primary rz-wide" onClick={() => onStart(saved, false)}>{saved.gameOver ? 'Vis avslutningen etter' : 'Fortsett'} dag {saved.day} i {index.byId.get(saved.homeZoneId)?.name} →</button>}
      <section className="start-campaign" aria-label="Vanskelighetsgrad og Hardcore"><fieldset><legend>Velg spillestil</legend><div className="start-modes">{DIFFICULTIES.map(mode=><label key={mode.id} data-difficulty={mode.id} className={campaignOptions.difficulty===mode.id?'selected':''}><HudIcon name={({story:'book',survival:'guard',realistic:'unrest'} as Record<string,HudIconName>)[mode.id]} size={25}/><input type="radio" name="start-difficulty" checked={campaignOptions.difficulty===mode.id} onChange={()=>setCampaignOptions({...campaignOptions,difficulty:mode.id})}/><span><strong>{mode.name}</strong><small>{mode.id==='survival'?'Standard':mode.id==='story'?'Mer rom for historien':'En hardere kamp'}</small></span></label>)}</div></fieldset><p className="start-mode-description">{DIFFICULTIES.find(mode=>mode.id===campaignOptions.difficulty)?.description}</p><label className="start-hardcore"><input type="checkbox" checked={campaignOptions.hardcore??false} onChange={e=>setCampaignOptions({...campaignOptions,hardcore:e.target.checked})}/><span><strong>Hardcore</strong><small>Hovedpersonens død avslutter gjennomspillingen.</small></span></label><details><summary>Om Hardcore og lagring</summary><p>Hardcore kan kombineres med alle tre spillestiler. Du fortsetter fra siste kontrollpunkt uten å gå tilbake til tidligere valg. Uten Hardcore kan du velge en etterfølger hvis hovedpersonen dør.</p></details></section>
      <div className="start-suggestions-heading"><h2 className="rz-subhead">Forslag</h2><div aria-label="Sider med startforslag"><button aria-label="Forrige startforslag" disabled={startPage===0} onClick={()=>setStartPage(startPage-1)}>←</button><span>{startPage+1} / {Math.ceil(world.starts.length/6)}</span><button aria-label="Neste startforslag" disabled={(startPage+1)*6>=world.starts.length} onClick={()=>setStartPage(startPage+1)}>→</button></div></div>
      <div className="rz-start-list" aria-label="Forslag til startområder">
        {world.starts.slice(startPage*6,startPage*6+6).map(s => <button key={s.zoneId} className={`rz-start-card ${choice === s.zoneId ? 'on' : ''}`} aria-pressed={choice===s.zoneId} onClick={() => setChoice(s.zoneId)}>
          <strong>{s.name.split(',')[0]}</strong><span><i className="rz-dot" style={{ background: DANGER_COLOR[dangers[s.zoneId].level] }} />{dangers[s.zoneId].level}</span>
        </button>)}
      </div>
      <p className="rz-small">Spillet lagres automatisk i nettleseren. <a href="/fase1">Buøy – førsteutgaven</a></p>
    </section>
    <section className="rz-start-map">
      <StartMap world={world} dangers={dangers} selected={choice} onSelect={setChoice} />
      {zone && d && <div className="rz-start-pick">
        <p className="rz-kicker">{l2?.name}</p>
        <h2>{zone.name}</h2>
        <p><b style={{ color: DANGER_COLOR[d.level] }}>Startforhold: {d.level}</b> · om lag {number(d.zombies)} døde i sonen og {number(d.around)} rundt.{d.escape ? <> Beste fluktvei: <b>{index.byId.get(d.escape.zoneId)?.name}</b> (om lag {number(d.escape.zombies)} døde).</> : null}</p>
        <p className="rz-small">{d.level === 'Nesten umulig' ? 'Dere kommer ikke til å klare å holde dette stedet. Planlegg flukten fra første dag.' : d.level === 'Svært krevende' ? 'Mange døde. Det kan være lurt å flytte leiren før dere tar over noe.' : d.level === 'Krevende' ? 'Det går, men det koster.' : 'Et godt sted å begynne.'}
          {' '}{CONTENT.zoneTypes.find(t => t[0] === zone.type)?.[1] ?? ''}.{hqNear.length ? ` HQ i nærheten: ${hqNear.slice(0, 3).join(', ')}.` : ''}</p>
        <div className="rz-start-go">
          <label>Frø <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 1)} /></label>
          <button className="rz-primary" data-testid="start-game" onClick={() => {
            if (saved && !confirm('En ny gjennomspilling erstatter den lagrede. Fortsette?')) return;
            onStart(newRegionGame(world, choice, seed, { ...campaignOptions, runId: crypto.randomUUID() }), true);
          }}><HudIcon name="claim" size={20}/><span>Start i {zone.name}</span><HudIcon name="arrow" size={18}/></button>
        </div>
      </div>}
    </section>
  </main>;
}

function StartMap({ world, dangers, selected, onSelect }: { world: RegionWorld; dangers: Record<string, ReturnType<typeof startDanger>>; selected: string; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const index = useMemo(() => indexWorld(world), [world]);
  useEffect(() => {
    let map: LibreMap | null = null;
    let cancelled = false;
    let resize: ResizeObserver | undefined;
    import('maplibre-gl').then(lib => {
      if (cancelled || !ref.current) return;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      map = new lib.Map({ container: ref.current, center: [5.72, 58.96], zoom: 10.2, minZoom: 9, maxZoom: 16, dragRotate: false, attributionControl: false, style: gameStyle() });
      map.addControl(new lib.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }));
      resize = new ResizeObserver(() => map?.resize());
      resize.observe(ref.current);
      map.on('error', event => { if (!cancelled && !map?.isStyleLoaded()) setFailed(true); });
      map.on('load', () => {
        const l3 = world.zones.filter(z => z.level === 3 && z.geometry).map(z => ({ type: 'Feature' as const, id: z.id, properties: { id: z.id, c: DANGER_COLOR[dangers[z.id]?.level ?? 'Rolig'] }, geometry: z.geometry as GeoJSON.Geometry }));
        map!.addSource('l3', { type: 'geojson', data: { type: 'FeatureCollection', features: l3 }, promoteId: 'id' });
        attachBuildings(map!);
        map!.addLayer({ id: 'fill', type: 'fill', source: 'l3', paint: { 'fill-color': ['coalesce', ['feature-state', 'danger'], ['get', 'c']], 'fill-opacity': .42 } });
        map!.addLayer({ id: 'line', type: 'line', source: 'l3', paint: { 'line-color': '#0c1416', 'line-width': .5 } });
        map!.addLayer({ id: 'sel', type: 'line', source: 'l3', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#ffe08a', 'line-width': 3 } });
        map!.on('click', 'fill', (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id as string | undefined; if (id) onSelect(id); });
        map!.on('mouseenter', 'fill', () => { map!.getCanvas().style.cursor = 'pointer'; });
        map!.on('mouseleave', 'fill', () => { map!.getCanvas().style.cursor = ''; });
        mapRef.current = map;
        map!.once('idle', () => { if (!cancelled) setReady(true); });
        map!.resize();
        map!.triggerRepaint();
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; resize?.disconnect(); map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    for (const [id, danger] of Object.entries(dangers)) mapRef.current.setFeatureState({ source: 'l3', id }, { danger: DANGER_COLOR[danger.level] });
  }, [dangers, ready]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setFilter('sel', ['==', ['get', 'id'], selected]);
    const at = index.byId.get(selected)?.at;
    if (at) mapRef.current.easeTo({ center: at, zoom: Math.max(mapRef.current.getZoom(), 11.5) });
  }, [selected, ready, index]);
  return <div className="rz-start-canvas" aria-label="Velg startsted på kartet" aria-busy={!ready}><div ref={ref} className="rz-map-canvas" />{!ready && <div className="start-map-loading" role="status"><strong>{failed?'Kartet kunne ikke lastes':'Laster Stavanger-regionen'}</strong><span>{failed?'Du kan fortsatt velge et startforslag.':'Soner, veier og startsteder gjøres klare …'}</span></div>}
    <div className="rz-legend">{Object.entries(DANGER_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}<span>Startforslag og valgt sted følger frøet · øvrige farger er anslag</span></div></div>;
}

