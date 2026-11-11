'use client';

/** Stavanger Z, the region game: the whole Stavanger region from the zone editor, one day at a time. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LibreMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import {
  ACTIONS, BRANCHES, HQ_BRANCH, LAW_GROUPS, LAWS, MILESTONES, MODULE_COST, MUTATIONS, NETWORK_COST, PHASES, SAVE_KEY_REGION, TECHS, TRAIT_NAMES, UPGRADE_COST, VALUE, WEAPONS, WORK_IDS, WORK_NAMES,
  areaNet, assaultOdds, assigned, autoWork, bestTier, controlled, craftRecipes, dailyFlows, dateText, discontentTarget, endDay, goalMet, hopeTarget, hqModules, indexWorld, lawAvailable, lawWait, living,
  moduleName, newRegionGame, passLaw, phaseDef, previewOrder, reach, repealLaw, resolveEvent, resourceName, searchHoursTotal, season, setWork, shelter, specialBranch, startDanger,
  startResearch, techBlocked, techCost, totalPeople, trade, tradeValue, upgradeName, upgradesFor, workforce,
  type ActionId, type Branch, type Flows, type RegionOrder, type RegionReport, type RegionState, type RegionWorld, type WorkId,
} from '../../../packages/gameplay/src/region/index';
import { CONTENT, takeoverEffort } from '../../../packages/world-data/src/content';
import './region.css';

const WORLD_URL = '/world/region-v1.json';
const ZONE_EDITOR_URL = 'http://127.0.0.1:5178/';
const CORE = ['medicine', 'fuel', 'ammo', 'building'];
const STATUS_LABEL = { unknown: 'Ukjent', scouted: 'Speidet', controlled: 'Deres' } as const;
const DANGER_COLOR: Record<string, string> = { Rolig: '#5f9a5f', Middels: '#a8a24a', Krevende: '#c48a3a', 'Svært krevende': '#b8563c', 'Nesten umulig': '#7c2230' };
const number = (n: number) => Math.round(n).toLocaleString('nb-NO');
const decimal = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${decimal(Math.abs(Math.round(n * 10) / 10))}`;

type Modal = null | 'report' | 'trade' | 'goals' | 'menu' | 'stock' | 'society' | 'research' | 'chronicle';

function load(): RegionState | null {
  try { const raw = localStorage.getItem(SAVE_KEY_REGION); const s = raw ? JSON.parse(raw) as RegionState : null; return s?.schema === 'region-2' ? s : null; } catch { return null; }
}
function persist(state: RegionState | null) {
  try { if (state) localStorage.setItem(SAVE_KEY_REGION, JSON.stringify(state)); else localStorage.removeItem(SAVE_KEY_REGION); } catch { /* private mode */ }
}

export default function RegionGame() {
  const [world, setWorld] = useState<RegionWorld | null>(null);
  const [state, setState] = useState<RegionState | null>(null);
  const [saved, setSaved] = useState<RegionState | null>(null);
  const [intro, setIntro] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(WORLD_URL).then(r => r.json()).then((w: RegionWorld) => { setWorld(w); setSaved(load()); }).catch(e => setError(`Fant ikke spillverdenen: ${e.message}`));
  }, []);
  useEffect(() => { if (state) persist(state); }, [state]);
  if (error) return <main className="rz-shell rz-center"><p>{error}</p></main>;
  if (!world) return <main className="rz-shell rz-center"><p>Laster kartet over Stavanger …</p></main>;
  if (!state) return <StartScreen world={world} saved={saved} onStart={(s, fresh) => { setState(s); setSaved(s); setIntro(fresh); }} />;
  return <>
    <Play world={world} state={state} setState={setState} onQuit={() => { setState(null); setSaved(load()); }} />
    {intro && <Intro world={world} state={state} onDone={() => setIntro(false)} />}
  </>;
}

// ------------------------------------------------------------------ start

function StartScreen({ world, saved, onStart }: { world: RegionWorld; saved: RegionState | null; onStart: (s: RegionState, fresh: boolean) => void }) {
  const index = indexWorld(world);
  const [choice, setChoice] = useState(world.starts.find(s => s.name.startsWith('Lundsneset'))?.zoneId ?? world.starts[0]?.zoneId ?? '');
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const dangers = useMemo(() => Object.fromEntries(index.l3.map(z => [z.id, startDanger(world, z.id)])), [world, index]);
  const zone = index.byId.get(choice);
  const d = dangers[choice];
  const l2 = index.byId.get(zone?.parentId ?? '');
  const hqNear = [choice, ...(index.adjacent.get(choice) ?? []).map(a => a.to)].flatMap(id => (index.poisByZone.get(id) ?? []).filter(p => p.role === 'hq')).map(p => `${p.name} (${CONTENT.hqTypes.find(t => t.id === p.hqType)?.name ?? ''})`);
  return <main className="rz-shell rz-start">
    <section className="rz-start-intro">
      <p className="rz-kicker">STAVANGER Z / ETTER DAG NULL</p>
      <h1>Hele regionen.<br />Ett døgn av gangen.</h1>
      <p>Du leder en liten gruppe gjennom en zombieapokalypse i Stavanger-regionen. Det finnes ingen regjering lenger, bare deg, folkene dine og de valgene du tar.</p>
      <p>Start hvor du vil. Tette bysentre har mye å finne, men så mange døde at det kan være umulig å bli. Da er første oppgave å komme seg ut. På landet er det jord, båter og diesel, og lange avstander.</p>
      {saved && !saved.gameOver && <button className="rz-primary rz-wide" onClick={() => onStart(saved, false)}>Fortsett dag {saved.day} i {index.byId.get(saved.homeZoneId)?.name} →</button>}
      <h2 className="rz-subhead">Forslag</h2>
      <div className="rz-start-list" aria-label="Forslag til startområder">
        {world.starts.map(s => <button key={s.zoneId} className={`rz-start-card ${choice === s.zoneId ? 'on' : ''}`} onClick={() => setChoice(s.zoneId)}>
          <strong>{s.name}</strong><span><i className="rz-dot" style={{ background: DANGER_COLOR[dangers[s.zoneId].level] }} />{dangers[s.zoneId].level}</span>
        </button>)}
      </div>
      <p className="rz-small">Spillet lagres automatisk i nettleseren. <a href="/fase1">Den første Buøy-prototypen</a> · <a href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Soneeditoren ↗</a></p>
    </section>
    <section className="rz-start-map">
      <StartMap world={world} dangers={dangers} selected={choice} onSelect={setChoice} />
      {zone && d && <div className="rz-start-pick">
        <p className="rz-kicker">{l2?.name}</p>
        <h2>{zone.name}</h2>
        <p><b style={{ color: DANGER_COLOR[d.level] }}>{d.level}</b> · om lag {number(d.zombies)} døde i sonen og {number(d.around)} rundt.</p>
        <p className="rz-small">{d.level === 'Nesten umulig' ? 'Dere kommer ikke til å klare å holde dette stedet. Planlegg flukten fra første dag.' : d.level === 'Svært krevende' ? 'Mange døde. Det kan være lurt å flytte leiren før dere tar over noe.' : d.level === 'Krevende' ? 'Det går, men det koster.' : 'Et godt sted å begynne.'}
          {' '}{CONTENT.zoneTypes.find(t => t[0] === zone.type)?.[1] ?? ''}.{hqNear.length ? ` HQ i nærheten: ${hqNear.slice(0, 3).join(', ')}.` : ''}</p>
        <div className="rz-start-go">
          <label>Frø <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 1)} /></label>
          <button className="rz-primary" data-testid="start-game" onClick={() => {
            if (saved && !saved.gameOver && !confirm('En ny gjennomspilling erstatter den lagrede. Fortsette?')) return;
            onStart(newRegionGame(world, choice, seed), true);
          }}>Start i {zone.name} →</button>
        </div>
      </div>}
    </section>
  </main>;
}

function StartMap({ world, dangers, selected, onSelect }: { world: RegionWorld; dangers: Record<string, ReturnType<typeof startDanger>>; selected: string; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const index = indexWorld(world);
  useEffect(() => {
    let map: LibreMap | null = null;
    let cancelled = false;
    import('maplibre-gl').then(lib => {
      if (cancelled || !ref.current) return;
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      map = new lib.Map({ container: ref.current, center: [5.72, 58.96], zoom: 10.2, minZoom: 9, maxZoom: 16, dragRotate: false, attributionControl: false, style: baseStyle() });
      map.addControl(new lib.AttributionControl({ compact: true, customAttribution: world.sources.join(' · ') }));
      map.on('load', () => {
        const l3 = world.zones.filter(z => z.level === 3 && z.geometry).map(z => ({ type: 'Feature' as const, id: z.id, properties: { id: z.id, c: DANGER_COLOR[dangers[z.id]?.level ?? 'Rolig'] }, geometry: z.geometry as GeoJSON.Geometry }));
        map!.addSource('l3', { type: 'geojson', data: { type: 'FeatureCollection', features: l3 }, promoteId: 'id' });
        map!.addLayer({ id: 'fill', type: 'fill', source: 'l3', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': .5 } });
        map!.addLayer({ id: 'line', type: 'line', source: 'l3', paint: { 'line-color': '#0c1416', 'line-width': .5 } });
        map!.addLayer({ id: 'sel', type: 'line', source: 'l3', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#ffe08a', 'line-width': 3 } });
        map!.on('click', 'fill', (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id as string | undefined; if (id) onSelect(id); });
        map!.on('mouseenter', 'fill', () => { map!.getCanvas().style.cursor = 'pointer'; });
        map!.on('mouseleave', 'fill', () => { map!.getCanvas().style.cursor = ''; });
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setFilter('sel', ['==', ['get', 'id'], selected]);
    const at = index.byId.get(selected)?.at;
    if (at) mapRef.current.easeTo({ center: at, zoom: Math.max(mapRef.current.getZoom(), 11.5) });
  }, [selected, ready, index]);
  return <div className="rz-start-canvas"><div ref={ref} className="rz-map-canvas" />
    <div className="rz-legend">{Object.entries(DANGER_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}<span>Klikk en sone for å starte der</span></div></div>;
}
const baseStyle = () => ({
  version: 8 as const, sources: { topo: { type: 'raster' as const, tileSize: 256, maxzoom: 18, attribution: '© Kartverket', tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'] } },
  layers: [{ id: 'bg', type: 'background' as const, paint: { 'background-color': '#0f1a1c' } },
    { id: 'topo', type: 'raster' as const, source: 'topo', paint: { 'raster-opacity': .55, 'raster-saturation': -.85, 'raster-brightness-max': .55, 'raster-contrast': .1 } }],
});

// ------------------------------------------------------------------ intro

function Intro({ world, state, onDone }: { world: RegionWorld; state: RegionState; onDone: () => void }) {
  const [page, setPage] = useState(0);
  const index = indexWorld(world);
  const place = index.byId.get(state.startZoneId)?.name ?? 'Stavanger';
  const d = startDanger(world, state.startZoneId);
  const pages = [
    { kicker: 'TIRSDAG 31. MARS', title: 'Det begynte på Forus', text: 'Først var det en nyhetssak om «uro» på et lager. Så stengte de Bybrua og Byfjordtunnelen. Ved midnatt var mobilnettet nede, og radioen spilte den samme meldingen om å holde seg innendørs.' },
    { kicker: 'NATT TIL 1. APRIL', title: `${place}`, text: `Dere er fire som fant hverandre i trappeoppgangen: Ingrid, som kjenner hver bakgård, Marius med jaktrifla, sykepleier Leila og mekaniker Tor. Ute i gatene går det som var naboene deres. ${d.level === 'Nesten umulig' || d.level === 'Svært krevende' ? 'Det er altfor mange av dem her. Dere må ut.' : 'Det er færre av dem her enn mange andre steder. Kanskje går det an å holde.'}` },
    { kicker: 'SLIK LEDER DU', title: 'Ett døgn av gangen', text: 'Velg folk til venstre, velg en sone på kartet og gi dem et oppdrag. Avslutt dagen, og alt skjer samtidig: zombiene vandrer mot lyd, natta tester forsvaret, og noen ganger banker noen på døra. Ta over en sone, etabler et hovedkvarter, og bygg et samfunn. Hvilket samfunn er opp til deg.' },
    { kicker: 'FASE 1: UTBRUDDET', title: 'Første mål', text: `${PHASES[0].intro} Mål: ${PHASES[0].goals.map(g => g.text.toLowerCase()).join(' Og ')}` },
  ];
  const p = pages[page];
  return <div className="rz-shell rz-overlay rz-intro"><section className="rz-dialog" role="dialog" aria-label="Introduksjon">
    <p className="rz-kicker">{p.kicker}</p><h2>{p.title}</h2><p className="rz-intro-text">{p.text}</p>
    <div className="rz-intro-nav"><span className="rz-small">{page + 1} / {pages.length}</span>
      <button onClick={onDone}>Hopp over</button>
      <button className="rz-primary" data-testid="intro-next" onClick={() => page < pages.length - 1 ? setPage(page + 1) : onDone()}>{page < pages.length - 1 ? 'Videre →' : 'Dag 0 →'}</button></div>
  </section></div>;
}

// ------------------------------------------------------------------ play

function Play({ world, state, setState, onQuit }: { world: RegionWorld; state: RegionState; setState: (s: RegionState) => void; onQuit: () => void }) {
  const index = indexWorld(world);
  const [selected, setSelected] = useState(state.homeZoneId);
  const [crew, setCrew] = useState<string[]>([]);
  const [orders, setOrders] = useState<RegionOrder[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [report, setReport] = useState<RegionReport | null>(null);
  const [message, setMessage] = useState('');
  const [overlay, setOverlay] = useState<'zombies' | 'food'>('zombies');
  const [phaseShown, setPhaseShown] = useState(state.phase);
  const hops = useMemo(() => reach(state, world), [state, world]);
  const flows = useMemo(() => dailyFlows(state, world), [state, world]);
  const busy = new Set(orders.flatMap(o => o.survivorIds));
  const people = living(state);
  const zone = index.byId.get(selected);
  const apply = (fn: () => RegionState) => { try { setState(fn()); setMessage(''); } catch (e) { setMessage((e as Error).message); } };

  const addOrder = (action: ActionId, target?: string) => {
    const order: RegionOrder = { id: `o${state.day}-${orders.length}-${Date.now() % 100000}`, action, zoneId: selected, survivorIds: crew, target };
    const p = previewOrder(state, world, order);
    if (!p.valid) { setMessage(p.errors.join(' ')); return; }
    setOrders([...orders, order]); setCrew([]); setMessage('');
  };
  const finishDay = () => {
    try {
      const result = endDay(state, world, orders);
      setState(result.state); setOrders([]); setCrew([]); setReport(result.report); setModal('report');
    } catch (e) { setMessage((e as Error).message); }
  };
  // For automated testers: the current state, world, plan and forecast, read-only.
  useEffect(() => { (window as unknown as { __szRegion?: unknown }).__szRegion = { state, world, orders, selected, flows }; }, [state, world, orders, selected, flows]);
  const s = season(state.day);
  const phase = phaseDef(state);
  const away = (id: string) => { const p = state.survivors.find(x => x.id === id); return !!(p?.awayUntil && p.awayUntil > state.day); };
  const showPhase = state.phase > phaseShown && !state.event && modal !== 'report';
  return <main className="rz-shell rz-play">
    <header className="rz-top">
      <div className="rz-brand">STAVANGER Z<small>{index.byId.get(state.homeZoneId)?.name}</small></div>
      <div className="rz-day"><strong>DAG {state.day}</strong><span>{dateText(state.day)} · {s.name}</span></div>
      <button className="rz-phase" onClick={() => setModal('goals')} title="Mål for fasen"><b>Fase {state.phase}</b><span>{phase.name} · {phase.goals.filter(g => goalMet(state, world, g.id)).length}/{phase.goals.length}</span></button>
      <Meter label="Håp" value={state.morale} target={hopeTarget(state, world)} good />
      <Meter label="Uro" value={state.discontent} target={discontentTarget(state, world)} />
      <div className="rz-stock">
        <Supply label="Mat" stock={state.stock.food ?? 0} net={flows.food.net} days={flows.food.daysLeft} title={`Produsert ${decimal(flows.food.produced)}, spist ${decimal(flows.food.eaten)}, råtner ${decimal(flows.food.spoiled)}, patruljer ${decimal(flows.food.upkeep)} per dag`} />
        <Supply label="Vann" stock={state.stock.water ?? 0} net={flows.water.net} days={flows.water.daysLeft} title={`Samlet ${decimal(flows.water.produced)}, drukket ${decimal(flows.water.drunk)} per dag`} />
        {CORE.map(id => <span key={id}><b>{number(state.stock[id] ?? 0)}</b>{resourceName(id)}</span>)}
        <span title={`${people.length} i crewet, ${state.population.adults} voksne, ${state.population.children} barn, ${state.population.elderly} eldre, ${state.population.sick} syke`}><b>{totalPeople(state)}</b>Folk</span>
      </div>
      <nav className="rz-nav">
        <button onClick={() => setModal('society')} data-testid="open-society">Samfunn</button>
        <button onClick={() => setModal('research')} data-testid="open-research">Forskning{state.research.current ? ' ●' : ''}</button>
        <button onClick={() => setModal('trade')}>Grupper {state.factions.filter(f => f.known && !f.defeated).length}</button>
        <button onClick={() => setModal('stock')}>Lager</button>
        <button onClick={() => setModal('chronicle')}>Krønike</button>
        <button onClick={() => { setReport(state.reports.at(-1) ?? null); setModal('report'); }} disabled={!state.reports.length}>Rapport</button>
        <button onClick={() => setModal('menu')}>Meny</button>
      </nav>
    </header>
    <aside className="rz-left" aria-label="Mannskap og dagsplan">
      <h2>Crew <small>velg folk, så en handling</small></h2>
      {people.map(p => <button key={p.id} className={`rz-person ${crew.includes(p.id) ? 'on' : ''} ${busy.has(p.id) || away(p.id) ? 'busy' : ''}`} disabled={busy.has(p.id) || away(p.id)}
        aria-pressed={crew.includes(p.id)} onClick={() => setCrew(crew.includes(p.id) ? crew.filter(x => x !== p.id) : [...crew, p.id])}>
        <strong>{p.name}{p.bitten !== undefined && <em className="rz-bitten"> bitt</em>}{away(p.id) && <em> borte til dag {p.awayUntil}</em>}</strong>
        <span>{p.role} · {WEAPONS[p.weapon].label}{p.traits?.length ? ` · ${p.traits.map(t => TRAIT_NAMES[t]).join(', ')}` : ''}</span>
        <i className="rz-bar"><b style={{ width: `${Math.max(0, p.health)}%` }} /></i>
        <small>Helse {Math.round(p.health)} · Utmattet {Math.round(p.fatigue)} · Lojal {Math.round(p.loyalty ?? 60)} · K{p.skills.combat} S{p.skills.scouting} H{p.skills.craft} M{p.skills.medical}</small>
      </button>)}
      <p className="rz-small">{workforce(state)} kan jobbe i leiren, {assigned(state)} har arbeid. <button className="rz-link" onClick={() => setModal('society')}>Fordel arbeid</button></p>
      <h2>Dagsplan</h2>
      {!orders.length && <p className="rz-small">Ingen oppdrag. Crew uten oppdrag hviler og forsvarer leiren.</p>}
      {orders.map(o => <div key={o.id} className="rz-order"><span><b>{ACTIONS[o.action].label}</b> {index.byId.get(o.zoneId)?.name}{o.target ? ` · ${targetName(world, o)}` : ''}<small>{o.survivorIds.map(id => state.survivors.find(p => p.id === id)?.name).join(', ')}</small></span>
        <button aria-label="Fjern oppdrag" onClick={() => setOrders(orders.filter(x => x.id !== o.id))}>×</button></div>)}
      <button className="rz-primary rz-end" data-testid="end-day" disabled={!!state.event || !!state.gameOver} onClick={finishDay}>Avslutt dag {state.day} →</button>
      {message && <p className="rz-message" role="alert">{message}</p>}
    </aside>
    <RegionMap world={world} state={state} flows={flows} overlay={overlay} selected={selected} hops={hops} onSelect={setSelected} onOverlay={setOverlay} />
    <aside className="rz-right" aria-label="Valgt sone">
      {zone && <ZonePanel world={world} state={state} flows={flows} zoneId={selected} crew={crew} hops={hops.get(selected)} onOrder={addOrder} />}
    </aside>
    {state.event && <div className="rz-overlay"><section className="rz-dialog rz-event" role="dialog" aria-label={state.event.title}>
      <p className="rz-kicker">{state.event.kicker ?? `HENDELSE · DAG ${state.day}`}</p><h2>{state.event.title}</h2><p>{state.event.text}</p>
      {!!state.event.voices?.length && <ul className="rz-voices">{state.event.voices.map(v => <li key={v}>{v}</li>)}</ul>}
      {state.event.choices.map(c => <button key={c.id} disabled={!!c.disabled} onClick={() => apply(() => resolveEvent(state, world, c.id).state)}><strong>{c.label}</strong><small>{c.disabled ?? c.detail}</small></button>)}
    </section></div>}
    {showPhase && !state.gameOver && <div className="rz-overlay"><section className="rz-dialog rz-phase-dialog" role="dialog" aria-label="Ny fase">
      <p className="rz-kicker">DAG {state.day} · FASE {state.phase}</p><h2>{phase.name}</h2><p>{phase.intro}</p>
      {phase.unlocks.length > 0 && <p><b>Nytt:</b> {phase.unlocks.join(', ')}.</p>}
      {state.mutations.filter(m => m.day === state.phaseDay).map(m => <p key={m.id} className="rz-errors">{m.known ? `Mutasjon: ${MUTATIONS.find(x => x.id === m.id)?.name}. ${MUTATIONS.find(x => x.id === m.id)?.text}` : 'Zombiene har forandret seg. Forsk på zombiestudier for å finne ut hvordan.'}</p>)}
      <p><b>Mål:</b> {phase.goals.map(g => g.text).join(' ')}</p>
      <button className="rz-primary" onClick={() => setPhaseShown(state.phase)}>Videre</button>
    </section></div>}
    {state.gameOver && <div className="rz-overlay"><section className="rz-dialog"><p className="rz-kicker">{state.gameOver.won ? 'SEIER' : 'SLUTT'}</p><h2>{state.gameOver.won ? 'Dere klarte det' : `Slutt etter ${state.gameOver.day} dager`}</h2><p>{state.gameOver.reason}</p>
      <p>Fase {state.phase}, {controlled(state).length} soner, {totalPeople(state)} mennesker, {state.research.done.length} oppfinnelser, {state.counters.killed ?? 0} zombier drept.</p>
      <button className="rz-primary" onClick={() => { persist(null); onQuit(); }}>Ny gjennomspilling</button></section></div>}
    {modal && <div className="rz-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><section className="rz-dialog rz-wide-dialog">
      <button className="rz-close" aria-label="Lukk" onClick={() => setModal(null)}>×</button>
      {modal === 'report' && report && <ReportView report={report} onZone={id => { setSelected(id); setModal(null); }} />}
      {modal === 'trade' && <TradeView state={state} world={world} onTrade={(id, give, take) => { try { const r = trade(state, id, give, take); setState(r.state); setMessage(r.message); } catch (e) { setMessage((e as Error).message); } }} message={message} />}
      {modal === 'goals' && <GoalsView world={world} state={state} />}
      {modal === 'society' && <SocietyView world={world} state={state} flows={flows} apply={apply} message={message} />}
      {modal === 'research' && <ResearchView state={state} apply={apply} message={message} />}
      {modal === 'chronicle' && <><h2>Krønike</h2><ol className="rz-chronicle">{[...state.memory].reverse().map((m, i) => <li key={i}><b>Dag {m.day}</b> {m.text}</li>)}</ol></>}
      {modal === 'stock' && <><h2>Lager</h2><div className="rz-stock-grid">{[...CONTENT.resources.filter(r => r.layer !== 'capacity').map(r => r.id), 'samples'].map(id => <span key={id}><b>{number(state.stock[id] ?? 0)}</b>{resourceName(id)}</span>)}</div></>}
      {modal === 'menu' && <><h2>Meny</h2>
        <p>Frø {state.seed} · Regler {state.rulesVersion} · Verden {state.worldVersion}</p>
        <button onClick={() => { const blob = new Blob([JSON.stringify(state)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stavanger-z-dag-${state.day}.json`; a.click(); }}>Last ned lagring</button>
        <button onClick={() => { if (confirm('Avslutte og starte på nytt? Lagringen slettes.')) { persist(null); onQuit(); } }}>Ny gjennomspilling</button>
        <a className="rz-link" href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Åpne soneeditoren ↗</a></>}
    </section></div>}
  </main>;
}

function Meter({ label, value, target, good }: { label: string; value: number; target: number; good?: boolean }) {
  const arrow = target > value + 2 ? '↑' : target < value - 2 ? '↓' : '';
  return <div className="rz-morale" title={`${label} trekker mot ${Math.round(target)}`}><span>{label}</span>
    <meter min={0} max={100} low={good ? 30 : 50} high={good ? 60 : 80} optimum={good ? 90 : 0} value={value} /><b>{Math.round(value)}{arrow}</b></div>;
}
function Supply({ label, stock, net, days, title }: { label: string; stock: number; net: number; days: number | null; title: string }) {
  return <span className={`rz-supply ${net < 0 ? (days !== null && days < 7 ? 'low' : 'falling') : 'rising'}`} title={title}>
    <b>{number(stock)} <em>{signed(net)}</em></b>{label}{days !== null && <small>{days < 99 ? `${Math.floor(days)} dager` : ''}</small>}</span>;
}

function targetName(world: RegionWorld, o: RegionOrder) {
  if (!o.target) return '';
  if (o.action === 'build') return upgradeName(o.target);
  if (o.action === 'module') return moduleName(o.target);
  if (o.action === 'network') return CONTENT.networks.find(n => n.id === o.target)?.name ?? o.target;
  if (['hold', 'block', 'blow', 'repair'].includes(o.action)) return world.links.find(l => l.id === o.target)?.name ?? o.target;
  return o.target;
}

// ------------------------------------------------------------------ zone panel and actions

function ZonePanel({ world, state, flows, zoneId, crew, hops, onOrder }: { world: RegionWorld; state: RegionState; flows: Flows; zoneId: string; crew: string[]; hops?: number; onOrder: (a: ActionId, target?: string) => void }) {
  const index = indexWorld(world);
  const zone = index.byId.get(zoneId)!;
  const z = state.zones[zoneId];
  const l2 = index.byId.get(zone.parentId ?? '');
  const l1 = index.byId.get(l2?.parentId ?? '');
  const faction = state.factions.find(f => f.zoneId === zoneId && !f.defeated);
  const pois = index.poisByZone.get(zoneId) ?? [];
  const links = world.links.filter(l => l.a === zoneId || l.b === zoneId);
  const effort = zone.measures ? takeoverEffort(zone.measures) : null;
  const known = z.status !== 'unknown';
  const owned = z.status === 'controlled';
  const total = searchHoursTotal(zone);
  const flow = flows.zones[zoneId];
  const actions: { action: ActionId; targets?: { id: string; name: string }[] }[] = [];
  if (faction) { actions.push({ action: 'scout' }, { action: 'assault' }); }
  else {
    if (!owned) actions.push({ action: 'scout' }, { action: 'clear' }, { action: 'search' }, { action: 'claim' });
    if (!state.hq && !controlled(state).length && zoneId !== state.homeZoneId) actions.push({ action: 'relocate' });
    if (owned) {
      actions.push({ action: 'search' }, { action: 'clear' }, { action: 'guard' }, { action: 'fortify' });
      actions.push({ action: 'build', targets: upgradesFor(state, world, zoneId).map(u => ({ id: u.id, name: `${u.name} (${costLabel(UPGRADE_COST[u.id]?.cost)})` })) });
      if (!state.hq) actions.push({ action: 'establishHq' });
      actions.push({ action: 'network', targets: CONTENT.networks.filter(n => !(state.networks[zone.parentId ?? ''] ?? []).includes(n.id)).map(n => ({ id: n.id, name: `${n.name} (${costLabel(NETWORK_COST[n.id].cost)})` })) });
      if ((zone.measures?.farm ?? 0) > 0 || z.upgrades.includes('field') || z.upgrades.includes('demolishField')) actions.push({ action: 'farm' });
      if (index.coastal.has(zoneId)) actions.push({ action: 'fish' });
    }
    if (zoneId === state.homeZoneId) actions.push({ action: 'rest' }, { action: 'heal' });
    if (state.hq?.zoneId === zoneId) {
      actions.push({ action: 'research' });
      actions.push({ action: 'module', targets: hqModules(state).map(m => ({ id: m, name: `${moduleName(m)} (${costLabel(MODULE_COST[m]?.cost)})` })) });
      const recipes = craftRecipes(state);
      if (recipes.length) actions.push({ action: 'craft', targets: recipes.map(r => ({ id: r.id, name: r.name })) });
    }
    if (links.length) for (const a of ['hold', 'block', 'blow', 'repair'] as ActionId[]) actions.push({ action: a, targets: links.filter(l => a !== 'repair' || state.chokepoints[l.id] === 'blown').map(l => ({ id: l.id, name: `${l.name} (${chokeLabel(state.chokepoints[l.id])})` })) });
  }
  const barricaded = (index.adjacent.get(zoneId) ?? []).filter(a => state.barricades[a.connId] > 0);
  return <div className="rz-zone">
    <p className="rz-kicker">{l1?.name} · {l2?.name}</p>
    <h1>{zone.name}</h1>
    <p className="rz-tags"><span className={`rz-status rz-${z.status}`}>{faction ? faction.name : STATUS_LABEL[z.status]}</span>
      <span>{CONTENT.zoneTypes.find(t => t[0] === zone.type)?.[1] ?? 'Ukjent type'}</span>
      {zoneId === state.homeZoneId && <span>★ Leiren</span>}
      {hops !== undefined ? <span>{hops ? `${hops} steg unna` : 'Her er dere'}</span> : <span>Utenfor rekkevidde</span>}</p>
    {owned && flow && <div className="rz-net">
      <div><b className={flow.net >= 0 ? 'rz-good' : 'rz-errors'}>{signed(flow.net)}</b><span>mat/dag i sonen</span></div>
      {l2 && <div><b className={areaNet(state, world, flows, l2.id) >= 0 ? 'rz-good' : 'rz-errors'}>{signed(areaNet(state, world, flows, l2.id))}</b><span>{l2.name}</span></div>}
      {l1 && <div><b className={areaNet(state, world, flows, l1.id) >= 0 ? 'rz-good' : 'rz-errors'}>{signed(areaNet(state, world, flows, l1.id))}</b><span>{l1.name}</span></div>}
      <small>Produksjon {decimal(flow.food)} mat og {decimal(flow.water)} vann, patruljer koster {decimal(flow.upkeep)} mat. {flow.upkeep > flow.food ? 'Sonen koster mer enn den gir, men kan være viktig for å holde grensen.' : ''}</small>
    </div>}
    <dl className="rz-facts">
      <dt>Zombier</dt><dd>{faction ? 'Ingen. Gruppen holder sonen.' : z.intel ? `${z.intel.min}–${z.intel.max}${z.intel.day < state.day ? ` (dag ${z.intel.day})` : ''}` : 'Ukjent'}</dd>
      {effort && !faction && <><dt>Vanskelighet</dt><dd>{effort.level}, ca. {number(effort.hours)} arbeidstimer</dd></>}
      {!faction && <><dt>Gjennomsøkt</dt><dd>{Math.round(Math.min(100, z.searched / total * 100))} % av {number(total)} timer</dd></>}
      {zone.measures && <><dt>Husrom</dt><dd>ca. {number(zone.measures.floor / 30)} personer, {number(zone.measures.homes)} boliger</dd>
        <dt>Jord</dt><dd>{decimal(zone.measures.farm / 1e4)} ha i drift, {decimal((zone.measures.pasture ?? 0) / 1e4)} ha beite</dd>
        <dt>Kyst</dt><dd>{zone.measures.coastM ? `${decimal(zone.measures.coastM / 1000)} km` : 'Ingen'}</dd></>}
      {known && !faction && <><dt>Kan finnes</dt><dd>{Object.entries(z.loot).filter(([, n]) => n >= 1).sort((a, b) => b[1] * (VALUE[b[0]] ?? 1) - a[1] * (VALUE[a[0]] ?? 1)).slice(0, 6).map(([id, n]) => `${number(n)} ${resourceName(id).toLowerCase()}`).join(', ') || 'Lite igjen'}</dd></>}
      {owned && <><dt>Sperringer</dt><dd>{barricaded.length ? `${barricaded.length} grenser, svakeste ${Math.round(Math.min(...barricaded.map(a => state.barricades[a.connId])))} igjen` : 'Ingen'} · beste dere kan bygge: {bestTier(state).name.toLowerCase()}</dd></>}
      {z.upgrades.length > 0 && <><dt>Bygget</dt><dd>{z.upgrades.map(upgradeName).join(', ')}</dd></>}
      {z.building && <><dt>Under bygging</dt><dd>{upgradeName(z.building.id)}, {Math.round(z.building.hours)} timer</dd></>}
      {state.hq?.zoneId === zoneId && <><dt>HQ</dt><dd>{CONTENT.hqTypes.find(t => t.id === state.hq!.type)?.name ?? 'Leir'}: {state.hq.modules.map(moduleName).join(', ') || 'ingen moduler'}{state.hq.building ? ` · bygger ${moduleName(state.hq.building.id).toLowerCase()} (${Math.round(state.hq.building.hours)} t)` : ''}</dd>
        {HQ_BRANCH[state.hq.type] && <><dt>Spesialisering</dt><dd>{HQ_BRANCH[state.hq.type].text}</dd></>}</>}
      {(state.networks[zone.parentId ?? ''] ?? []).length > 0 && <><dt>Nett i området</dt><dd>{state.networks[zone.parentId ?? ''].map(n => CONTENT.networks.find(x => x.id === n)?.name).join(', ')}</dd></>}
      {pois.filter(p => p.role && p.role !== 'resource').length > 0 && <><dt>Steder</dt><dd>{pois.filter(p => p.role && p.role !== 'resource').map(p => p.hqType && !state.hq ? `${p.name} (mulig HQ: ${CONTENT.hqTypes.find(t => t.id === p.hqType)?.name})` : p.name).join(', ')}</dd></>}
      {links.length > 0 && <><dt>Bru og tunnel</dt><dd>{links.map(l => `${l.name}: ${chokeLabel(state.chokepoints[l.id])}`).join(', ')}</dd></>}
    </dl>
    {faction && <p className="rz-small">{faction.about} {faction.known ? `Forhold ${faction.relation}. Styrke om lag ${Math.round(faction.strength ?? 30)}.` : 'Speid for å få kontakt.'}{faction.revealed ? ' Dere vet hva de egentlig vil.' : ''}{faction.hostile ? ' De er fiender.' : ''}</p>}
    <h2>Handlinger {crew.length ? <small>{crew.length} valgt</small> : <small>velg folk til venstre først</small>}</h2>
    <div className="rz-actions">{actions.filter(a => !a.targets || a.targets.length).map(a => <ActionRow key={a.action} world={world} state={state} zoneId={zoneId} crew={crew} action={a.action} targets={a.targets} onOrder={onOrder} />)}</div>
  </div>;
}
const chokeLabel = (s: string) => ({ open: 'åpen', held: 'holdes', blocked: 'sperret', blown: 'sprengt', flooded: 'under vann' } as Record<string, string>)[s] ?? s;
const costLabel = (cost?: Record<string, number>) => cost && Object.keys(cost).length ? Object.entries(cost).map(([id, n]) => `${n} ${resourceName(id).toLowerCase()}`).join(', ') : 'gratis';

function ActionRow({ world, state, zoneId, crew, action, targets, onOrder }: { world: RegionWorld; state: RegionState; zoneId: string; crew: string[]; action: ActionId; targets?: { id: string; name: string }[]; onOrder: (a: ActionId, t?: string) => void }) {
  const [target, setTarget] = useState(targets?.[0]?.id);
  useEffect(() => { if (targets && !targets.some(t => t.id === target)) setTarget(targets[0]?.id); }, [targets, target]);
  const preview = crew.length ? previewOrder(state, world, { action, zoneId, survivorIds: crew, target }) : null;
  return <div className={`rz-action ${preview?.valid ? 'ok' : ''}`}>
    <div><b>{ACTIONS[action].label}</b><small>{ACTIONS[action].help}</small>
      {targets && <select aria-label={`Velg for ${ACTIONS[action].label}`} value={target} onChange={e => setTarget(e.target.value)}>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
      {preview && <small className={preview.valid ? 'rz-preview' : 'rz-errors'}>{preview.valid ? `${preview.text} ${preview.hours} timer. Risiko: ${preview.risk}.${Object.keys(preview.costs).length ? ` Koster ${costLabel(preview.costs)}.` : ''}` : preview.errors.join(' ')}</small>}
    </div>
    <button disabled={!preview?.valid} onClick={() => onOrder(action, target)}>Legg til</button>
  </div>;
}

// ------------------------------------------------------------------ society: work, laws, people

function SocietyView({ world, state, flows, apply, message }: { world: RegionWorld; state: RegionState; flows: Flows; apply: (fn: () => RegionState) => void; message: string }) {
  const [tab, setTab] = useState<'work' | 'laws' | 'people'>('work');
  const free = workforce(state) - assigned(state);
  const step = (id: WorkId, d: number) => apply(() => setWork(state, { ...state.work, [id]: Math.max(0, (state.work[id] ?? 0) + d) }));
  const p = state.population;
  const wait = lawWait(state);
  const workText: Record<WorkId, string> = {
    farm: `${decimal(Math.min(flows.farmCapacity, (state.work.farm ?? 0) * 5 * season(state.day).farm))} mat/dag. Jorda tåler ${decimal(flows.farmCapacity)}.`,
    fish: `${flows.fishers} fisker. Krever båt og kyst. ${number(state.stock.boat ?? 0)} båter.`,
    scavenge: 'Søker gjennom trygge soner i nærheten.',
    clear: 'Rydder zombier i deres soner og de roligste naboene.',
    guard: `${decimal((state.work.guard ?? 0) * 2.5)} ekstra forsvar om natta.`,
    build: 'Hjelper på byggeprosjekter og reparerer sperringer.',
    research: state.research.current ? `Forsker på ${TECHS.find(t => t.id === state.research.current)?.name}.` : 'Ingen prosjekt valgt.',
  };
  return <><h2>Samfunn</h2>
    <div className="rz-tabs">{(['work', 'laws', 'people'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{{ work: 'Arbeid', laws: 'Lover', people: 'Folk' }[t]}</button>)}</div>
    {tab === 'work' && <>
      <p>{workforce(state)} kan jobbe. {free > 0 ? <b className="rz-errors">{free} går ledige.</b> : 'Alle har arbeid.'} Mat {signed(flows.food.net)} per dag{flows.food.daysLeft !== null ? `, ${Math.floor(flows.food.daysLeft)} dager igjen` : ''}.</p>
      <div className="rz-work">{WORK_IDS.map(id => <div key={id} className="rz-work-row"><span><b>{WORK_NAMES[id]}</b><small>{workText[id]}</small></span>
        <button onClick={() => step(id, -1)} disabled={!state.work[id]}>−</button><b>{state.work[id] ?? 0}</b><button onClick={() => step(id, 1)} disabled={free <= 0}>+</button></div>)}</div>
      <button onClick={() => apply(() => setWork(state, autoWork(state, world)))} data-testid="auto-work">Foreslå fordeling</button>
    </>}
    {tab === 'laws' && <>
      <p className="rz-small">Dette er unntakstilstand. Lover gjelder til du endrer dem. {wait ? `Neste lovendring om ${wait} dager.` : 'Du kan vedta en lov nå.'} Harde lover gir ro eller mat, men koster håp og lojalitet hos noen.</p>
      {state.phase < 2 && <p>Lovene kommer når dere har et hovedkvarter.</p>}
      {state.phase >= 2 && Object.entries(LAW_GROUPS).map(([group, name]) => {
        const laws = LAWS.filter(l => l.group === group);
        const active = laws.find(l => state.laws.includes(l.id));
        return <section key={group} className="rz-law-group"><h3>{name}{active ? <small> · {active.name}</small> : <small> · ingen lov</small>}</h3>
          <div className="rz-laws">{laws.map(l => {
            const why = lawAvailable(state, l.id);
            const on = state.laws.includes(l.id);
            return <div key={l.id} className={`rz-law ${on ? 'on' : ''}`}><b>{l.name}</b><small>{l.text}</small><small className="rz-quiet">{lawEffectText(l.effect)}</small>
              {on ? <button onClick={() => apply(() => repealLaw(state, group))} disabled={wait > 0}>Opphev</button> : <button onClick={() => apply(() => passLaw(state, l.id))} disabled={!!why} title={why}>{why && state.phase < l.phase ? `Fase ${l.phase}` : 'Vedta'}</button>}</div>;
          })}</div></section>;
      })}
    </>}
    {tab === 'people' && <>
      <div className="rz-stock-grid">
        <span><b>{living(state).length}</b>Crew</span><span><b>{p.adults}</b>Voksne</span><span><b>{p.children}</b>Barn</span><span><b>{p.elderly}</b>Eldre</span>
        <span><b>{p.sick}</b>Syke</span><span><b>{shelter(state, world)}</b>Plass under tak</span><span><b>{Math.round(state.morale)}</b>Håp</span><span><b>{Math.round(state.discontent)}</b>Uro</span>
      </div>
      {totalPeople(state) > shelter(state, world) && <p className="rz-errors">Det er trangt. Folk sover i ganger og trappeoppganger. Ta over soner med boliger eller bygg boliger i HQ.</p>}
      <h3>Crew og lojalitet</h3>
      <ul className="rz-loyal">{living(state).map(s => <li key={s.id}><b>{s.name}</b> {s.role}{s.traits?.length ? ` · ${s.traits.map(t => TRAIT_NAMES[t]).join(', ')}` : ''} <i className="rz-bar"><b style={{ width: `${s.loyalty ?? 60}%`, background: (s.loyalty ?? 60) < 25 ? 'var(--bad)' : undefined }} /></i></li>)}</ul>
      <p className="rz-small">Snille liker barmhjertighet og hater grusomhet. Harde liker harde valg. Foreldre tilgir ikke det som rammer barn. Troende vil ha tro og nåde. Lojalitet under 15 betyr at de vurderer å gå.</p>
    </>}
    {message && <p className="rz-message">{message}</p>}
  </>;
}
function lawEffectText(e: (typeof LAWS)[number]['effect']) {
  const out: string[] = [];
  if (e.hope) out.push(`håp ${e.hope > 0 ? '+' : ''}${e.hope}`);
  if (e.discontent) out.push(`uro ${e.discontent > 0 ? '+' : ''}${e.discontent}`);
  if (e.foodMult) out.push(`matforbruk ×${e.foodMult}`);
  if (e.dependentFood) out.push(`barn og eldre spiser ×${e.dependentFood}`);
  if (e.workMult) out.push(`arbeid ×${e.workMult}`);
  if (e.crime) out.push(`kriminalitet ×${e.crime}`);
  if (e.refugees !== undefined) out.push(e.refugees === 0 ? 'ingen flyktninger' : `flyktninger ×${e.refugees}`);
  if (e.guardMult) out.push(`vakter ×${e.guardMult}`);
  if (e.childWork) out.push('barn jobber');
  if (e.childResearch) out.push('barn forsker');
  if (e.lawCooldown) out.push(`ny lov hver ${e.lawCooldown}. dag`);
  return out.join(' · ');
}

// ------------------------------------------------------------------ research

function ResearchView({ state, apply, message }: { state: RegionState; apply: (fn: () => RegionState) => void; message: string }) {
  const special = specialBranch(state);
  const current = TECHS.find(t => t.id === state.research.current);
  return <><h2>Forskning</h2>
    <p className="rz-small">Det dere har mistet, må finnes opp på nytt. Forskere fra leiren og crew som forsker i HQ gir poeng hver dag. {special ? `HQ-et gjør ${BRANCHES[special].toLowerCase()} billigere og en fase tidligere.` : 'Et HQ med en spesiell type gir en spesialisering.'}</p>
    {current && <p>Nå: <b>{current.name}</b> · {Math.round(state.research.progress)} av {techCost(state, current).points} poeng <i className="rz-bar rz-inline"><b style={{ width: `${Math.min(100, state.research.progress / techCost(state, current).points * 100)}%` }} /></i></p>}
    {state.phase < 2 && <p>Forskning starter når dere har et HQ.</p>}
    <div className="rz-tree">{(Object.keys(BRANCHES) as Branch[]).map(b => <section key={b} className={special === b ? 'special' : ''}><h3>{BRANCHES[b]}{special === b ? ' ★' : ''}</h3>
      {TECHS.filter(t => t.branch === b).map(t => {
        const done = state.research.done.includes(t.id);
        const why = techBlocked(state, t);
        const c = techCost(state, t);
        const on = state.research.current === t.id;
        return <div key={t.id} className={`rz-tech ${done ? 'done' : on ? 'on' : why ? 'blocked' : 'open'}`}>
          <b>{t.name}</b><small>{t.text}</small>
          <small className="rz-quiet">Fase {c.phase} · {c.points} poeng{Object.keys(c.cost).length ? ` · ${costLabel(c.cost)}` : ''}</small>
          {done ? <small className="rz-good">Ferdig</small> : on ? <small className="rz-preview">Pågår</small> : <button disabled={!!why} title={why} onClick={() => apply(() => startResearch(state, t.id))}>{why ? why.replace('Ferdig.', '') : 'Start'}</button>}
        </div>;
      })}</section>)}</div>
    {message && <p className="rz-message">{message}</p>}
  </>;
}

// ------------------------------------------------------------------ goals, report and trade

function GoalsView({ world, state }: { world: RegionWorld; state: RegionState }) {
  return <><h2>Faser og mål</h2>
    <ol className="rz-phases">{PHASES.map(p => <li key={p.id} className={p.id < state.phase ? 'done' : p.id === state.phase ? 'on' : ''}>
      <b>Fase {p.id}: {p.name}</b>
      {p.id >= state.phase && <ul>{p.goals.map(g => <li key={g.id} className={p.id === state.phase && goalMet(state, world, g.id) ? 'done' : ''}>{p.id === state.phase && goalMet(state, world, g.id) ? '✓ ' : ''}{g.text}</li>)}</ul>}
    </li>)}</ol>
    {state.mutations.length > 0 && <><h3>Zombiene</h3><ul>{state.mutations.map(m => <li key={m.id}>{m.known ? `${MUTATIONS.find(x => x.id === m.id)?.name}: ${MUTATIONS.find(x => x.id === m.id)?.text}` : 'Ukjent mutasjon. Forsk på zombiestudier.'}</li>)}</ul></>}
    <h3>Milepæler</h3><ol className="rz-goals">{MILESTONES.map(m => <li key={m.id} className={state.milestones.includes(m.id) ? 'done' : ''}><b>{m.title}</b> {m.text}</li>)}</ol>
    <p className="rz-small">Seier i fase 5: 30 dager på rad med mat nok, håp over 50 og uro under 50, en kur fra vaksineforsøket, eller alle gruppene i regionen som venner.</p></>;
}

function ReportView({ report, onZone }: { report: RegionReport; onZone: (id: string) => void }) {
  return <><p className="rz-kicker">RAPPORT · DAG {report.day}</p><h2>Natten er over</h2>
    <p className="rz-small">Mat: +{report.food.produced} / −{report.food.eaten}{report.food.spoiled ? ` / ${report.food.spoiled} råtnet` : ''} · Vann: +{report.water.produced} / −{report.water.drunk} · {report.killed} zombier drept · {report.zombiesMoved} zombier flyttet seg i regionen</p>
    <ul className="rz-report">{report.lines.map((l, i) => <li key={i} className={`rz-${l.tone}`}><b>{l.title}</b> {l.text}{l.zoneId && <button className="rz-link" onClick={() => onZone(l.zoneId!)}>Vis</button>}</li>)}</ul></>;
}

function TradeView({ state, world, onTrade, message }: { state: RegionState; world: RegionWorld; onTrade: (id: string, give: Record<string, number>, take: Record<string, number>) => void; message: string }) {
  const known = state.factions.filter(f => f.known && !f.defeated);
  const [fid, setFid] = useState(known[0]?.id);
  const [give, setGive] = useState<Record<string, number>>({});
  const [take, setTake] = useState<Record<string, number>>({});
  const f = known.find(x => x.id === fid);
  if (!known.length) return <><h2>Grupper</h2><p>Dere har ikke kontakt med noen ennå. Speid rundt, finn en radio, forsk på krystallradio eller vent på hendelser.</p></>;
  const v = f && !f.hostile ? tradeValue(state, f, give, take) : null;
  const ourItems = Object.keys(state.stock).filter(id => (state.stock[id] ?? 0) >= 1 && VALUE[id]);
  const step = (set: typeof setGive, obj: Record<string, number>, id: string, d: number, max: number) => set({ ...obj, [id]: Math.max(0, Math.min(max, (obj[id] ?? 0) + d)) });
  const odds = f ? assaultOdds(state, living(state).sort((a, b) => b.skills.combat - a.skills.combat).slice(0, 4), f) : null;
  return <><h2>Grupper</h2>
    <div className="rz-tabs">{known.map(x => <button key={x.id} className={x.id === fid ? 'on' : ''} onClick={() => { setFid(x.id); setGive({}); setTake({}); }}>{x.name}{x.hostile ? ' ⚠' : ''}</button>)}</div>
    {f && <><p>{f.about} Forhold: <b>{f.relation}</b>. Styrke om lag {Math.round(f.strength ?? 30)}{odds ? ` (de fire beste i crewet: ${odds.power})` : ''}. Holder til i {indexWorld(world).byId.get(f.zoneId)?.name}.</p>
      {f.revealed && <p className="rz-errors">Dere vet hva de egentlig vil: {f.intent === 'betray' ? 'de planlegger å ta det dere har.' : 'de er det de sier de er.'}</p>}
      {f.hostile ? <p className="rz-errors">De er fiender og handler ikke. Velg sonen deres på kartet for å speide eller angripe.</p> : <>
        <p className="rz-small">De vil ha {f.wants.map(w => resourceName(w).toLowerCase()).join(', ')}.</p>
        <div className="rz-trade">
          <div><h3>Dere gir</h3>{ourItems.map(id => <div key={id} className="rz-trade-row"><span>{resourceName(id)} <small>({number(state.stock[id])})</small></span>
            <button onClick={() => step(setGive, give, id, -5, state.stock[id])}>−</button><b>{give[id] ?? 0}</b><button onClick={() => step(setGive, give, id, 5, state.stock[id])}>+</button></div>)}</div>
          <div><h3>Dere får</h3>{Object.keys(f.stock).filter(id => f.stock[id] >= 1).map(id => <div key={id} className="rz-trade-row"><span>{resourceName(id)} <small>({number(f.stock[id])})</small></span>
            <button onClick={() => step(setTake, take, id, -1, f.stock[id])}>−</button><b>{take[id] ?? 0}</b><button onClick={() => step(setTake, take, id, 1, f.stock[id])}>+</button></div>)}</div>
        </div>
        {v && <p className={v.fair ? 'rz-good' : 'rz-errors'}>Verdien dere gir: {v.worthGive}. Verdien dere får: {v.worthTake}. {v.fair ? 'De går med på det.' : 'De vil ha mer.'}</p>}
        <button className="rz-primary" disabled={!v?.fair} onClick={() => { onTrade(f.id, Object.fromEntries(Object.entries(give).filter(([, n]) => n > 0)), Object.fromEntries(Object.entries(take).filter(([, n]) => n > 0))); setGive({}); setTake({}); }}>Bytt</button>
      </>}
      {message && <p className="rz-small">{message}</p>}</>}
  </>;
}

// ------------------------------------------------------------------ map

function RegionMap({ world, state, flows, overlay, selected, hops, onSelect, onOverlay }: { world: RegionWorld; state: RegionState; flows: Flows; overlay: 'zombies' | 'food'; selected: string; hops: Map<string, number>; onSelect: (id: string) => void; onOverlay: (o: 'zombies' | 'food') => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
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
      lib.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const home = index.byId.get(state.homeZoneId)?.at ?? [5.73, 58.97];
      map = new lib.Map({ container: ref.current, center: home, zoom: 14, minZoom: 9, maxZoom: 18, dragRotate: false, pitchWithRotate: false, attributionControl: false, style: baseStyle() });
      map.addControl(new lib.AttributionControl({ compact: true, customAttribution: world.sources.join(' · ') }));
      map.on('load', () => {
        const l3 = world.zones.filter(z => z.level === 3 && z.geometry).map(z => ({ type: 'Feature' as const, id: z.id, properties: { id: z.id }, geometry: z.geometry as GeoJSON.Geometry }));
        const outlines = (level: number) => world.zones.filter(z => z.level === level && z.geometry).map(z => ({ type: 'Feature' as const, properties: { id: z.id }, geometry: z.geometry as GeoJSON.Geometry }));
        map!.addSource('l3', { type: 'geojson', data: { type: 'FeatureCollection', features: l3 }, promoteId: 'id' });
        map!.addSource('l2', { type: 'geojson', data: { type: 'FeatureCollection', features: outlines(2) } });
        map!.addSource('l1', { type: 'geojson', data: { type: 'FeatureCollection', features: outlines(1) } });
        const links = world.links.map(l => ({ type: 'Feature' as const, properties: { id: l.id, kind: l.kind }, geometry: { type: 'LineString' as const, coordinates: [index.byId.get(l.a)!.at!, index.byId.get(l.b)!.at!] } }));
        map!.addSource('links', { type: 'geojson', data: { type: 'FeatureCollection', features: links }, promoteId: 'id' });
        map!.addSource('marks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map!.addLayer({ id: 'l3-fill', type: 'fill', source: 'l3', paint: {
          'fill-color': ['case', ['==', ['feature-state', 'mode'], 'food'],
            ['case', ['==', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled'], ['interpolate', ['linear'], ['coalesce', ['feature-state', 'net'], 0], -3, '#c0533f', 0, '#8f8a5a', 6, '#4f9a6b'], '#1d2a2c'],
            ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'controlled', '#4f9a6b', 'faction', '#8a6fc4', 'enemy', '#c24a8a', 'scouted',
              ['interpolate', ['linear'], ['coalesce', ['feature-state', 'z'], 0], 0, '#7f8f5a', 20, '#b39046', 80, '#b4553f', 300, '#7c2230'], '#1d2a2c']],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'reach'], false], .62, .38] } });
        map!.addLayer({ id: 'l3-line', type: 'line', source: 'l3', paint: { 'line-color': '#0c1416', 'line-width': .6, 'line-opacity': .7 } });
        map!.addLayer({ id: 'l2-line', type: 'line', source: 'l2', paint: { 'line-color': '#d9d2b0', 'line-width': 1.2, 'line-opacity': .45 } });
        map!.addLayer({ id: 'l1-line', type: 'line', source: 'l1', paint: { 'line-color': '#f2e2a0', 'line-width': 2.6, 'line-opacity': .6 } });
        map!.addLayer({ id: 'links', type: 'line', source: 'links', paint: {
          'line-color': ['match', ['coalesce', ['feature-state', 'c'], 'open'], 'blown', '#e05a4a', 'flooded', '#4a8ee0', 'blocked', '#e0a64a', 'held', '#6fd08a', '#e8e1c4'],
          'line-width': 3, 'line-dasharray': [2, 1.5] } });
        map!.addLayer({ id: 'l3-selected', type: 'line', source: 'l3', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#ffe08a', 'line-width': 3 } });
        map!.addLayer({ id: 'marks', type: 'circle', source: 'marks', paint: { 'circle-radius': ['get', 'r'], 'circle-color': ['get', 'c'], 'circle-stroke-color': '#0c1416', 'circle-stroke-width': 1.5 } });
        map!.on('click', 'l3-fill', (e: MapLayerMouseEvent) => { const id = e.features?.[0]?.properties?.id as string | undefined; if (id) onSelect(id); });
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
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => { cancelled = true; map?.remove(); mapRef.current = null; };
    // The map is created once; state is pushed through feature-state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const zone of index.l3) {
      const z = state.zones[zone.id];
      const f = state.factions.find(x => x.zoneId === zone.id && !x.defeated);
      const s = f ? (f.hostile ? 'enemy' : 'faction') : z.status;
      map.setFeatureState({ source: 'l3', id: zone.id }, { s, z: z.intel ? (z.intel.min + z.intel.max) / 2 : 0, reach: hops.has(zone.id), net: flows.zones[zone.id]?.net ?? 0, mode: overlay });
    }
    for (const l of world.links) map.setFeatureState({ source: 'links', id: l.id }, { c: state.chokepoints[l.id] });
    const marks = [
      { at: index.byId.get(state.homeZoneId)!.at!, r: 8, c: '#ffe08a' },
      ...state.factions.filter(f => f.known && !f.defeated).map(f => ({ at: index.byId.get(f.zoneId)!.at!, r: 6, c: f.hostile ? '#e05a8a' : '#b9a0f0' })),
      ...world.pois.filter(p => p.role === 'hq' && state.zones[p.zoneId]?.status !== 'unknown').map(p => ({ at: p.at, r: 4, c: '#f2c14e' })),
    ];
    (map.getSource('marks') as GeoJSONSource).setData({ type: 'FeatureCollection', features: marks.map(m => ({ type: 'Feature', properties: { r: m.r, c: m.c }, geometry: { type: 'Point', coordinates: m.at } })) });
  }, [state, ready, hops, world, index, flows, overlay]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter('l3-selected', ['==', ['get', 'id'], selected]);
  }, [selected, ready]);
  return <section className="rz-map" aria-label="Kart over regionen">
    <div ref={ref} className="rz-map-canvas" />
    {hover && <div className="rz-tip" style={{ left: hover.x + 14, top: hover.y + 10 }}>{hover.text}</div>}
    <div className="rz-legend">{overlay === 'zombies'
      ? <><span><i style={{ background: '#4f9a6b' }} />Deres</span><span><i style={{ background: '#b39046' }} />Speidet, få</span><span><i style={{ background: '#b4553f' }} />Mange zombier</span><span><i style={{ background: '#8a6fc4' }} />Annen gruppe</span><span><i style={{ background: '#c24a8a' }} />Fiender</span><span><i style={{ background: '#1d2a2c' }} />Ukjent</span></>
      : <><span><i style={{ background: '#4f9a6b' }} />Gir mat</span><span><i style={{ background: '#8f8a5a' }} />Går i null</span><span><i style={{ background: '#c0533f' }} />Koster mat</span></>}</div>
    <div className="rz-map-tools">
      <button className={overlay === 'zombies' ? 'on' : ''} onClick={() => onOverlay('zombies')}>Zombier</button>
      <button className={overlay === 'food' ? 'on' : ''} onClick={() => onOverlay('food')}>Netto mat</button>
      <button onClick={() => { const at = index.byId.get(state.homeZoneId)?.at; if (at) mapRef.current?.flyTo({ center: at, zoom: 14 }); onSelect(state.homeZoneId); }}>Til leiren</button>
    </div>
  </section>;
}
