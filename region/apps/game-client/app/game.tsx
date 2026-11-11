'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPhaseOneGame, decideRecruitment, getView, getActionPreview, resolveGameDay, chooseEvent, ACTION_LABELS } from '../../../packages/gameplay/src/index';
import { canWork, RECRUITMENT_CHOICES, type RecruitmentChoice } from '../../../packages/gameplay/src/community';
import type { WorkMode } from '../../../packages/gameplay/src/field-work';
import type { PlayState, GameOrder, ActionType, PlayerPoi, PlayerZone } from '../../../packages/gameplay/src/model';
import type { AreaGeometry, WorldDefinition } from '../../../packages/world-data/src/model';
import { readSave, writeSave, parseSave, exportSave, recoverSave, withSaveLock, SAVE_KEY, type SaveEnvelope } from '../lib/save';
import basemap from '../../../packages/world-data/data/basemap.json';
import locations from '../../../packages/world-data/data/review-locations.json';
import './game.css';
import './tactical.css';
import './readability.css';
import portraits from '../../../assets/ui/survivors-atlas-v1.webp';
import locationArt from '../../../assets/ui/locations-atlas-v1.webp';
import { Icon, type IconName } from './tactical-icons';
import { zoneSymbol, poiSymbol, poiKindLabel } from './map-symbols';

const portraitUrl = typeof portraits === 'string' ? portraits : portraits.src;
const locationUrl = typeof locationArt === 'string' ? locationArt : locationArt.src;
const portraitPosition: Record<string, string> = { ingrid:'18% 0%', marius:'86% 0%', leila:'12% 100%', tor:'85% 100%' };

const resources: Record<string, string> = { food: 'Mat', water: 'Vann', medicine: 'Medisin', materials: 'Materialer', ammo: 'Ammo', filterKit: 'Rensesett' };
// The zone editor runs locally beside the game (Stavanger Z.cmd starts both).
const ZONE_EDITOR_URL = 'http://127.0.0.1:5178/';
const EMPTY_DAY_HINT_KEY = `${SAVE_KEY}.empty-day-explained`;
const descriptions: Record<ActionType, string> = {
  scout: 'Observer antall og finn interessante steder. Gir kunnskap, men verken rydding eller kontroll.',
  clear: 'Reduser zombieantallet. Utstyr, erfaring og laget avgjør kapasitet og risiko. Området kan fylles igjen.',
  claim: 'Ta kontroll over adkomsten og åpne ruter videre. Aktiv motstand kan avbryte overtakelsen.',
  secure: 'Bygg sperringer ved utsatte passasjer fra en overtatt sone. Arbeidet krever materialer, og press kan slite ned sperringene.',
  scavenge: 'Hent et begrenset funn. Lagets bæreevne avgjør hvor mye som kommer hjem.',
  rest: 'Hvil i leiren. Reduserer utmattelse og lar folk komme seg før neste oppdrag.',
  heal: 'Bruk medisin og medisinsk kompetanse til å behandle skadde i leiren.',
  establishBase: 'Gjør annekset ved Buøy idrettsanlegg til operasjonsbase etter at sonen er overtatt. Rosenberg er et senere mål.',
  raid: 'Forsøk å hente forsyninger på et POI før sonen er overtatt. Ufullstendig etterretning øker usikkerheten.',
  surface: 'Søk raskt i tilgjengelige deler av byggene. Arbeidet og de begrensede funnene deles med grundig søk.',
  search: 'Undersøk bygg over flere dager og se etter spor som kan gi nye muligheter. Søk samlet for lavere risiko eller spred laget for raskere fremdrift.',
  watch: 'Sett av folk til vakthold ved en utsatt yttergrense.',
  upgradeHQ: 'Bygg opp et permanent HQ over flere døgn. Arbeidet konkurrerer om folk med forsyningsoppdrag og vakthold.',
  installWater: 'Installer rensesettet med materialer og en håndverker ved operasjonsbasen.',
  filterWater: 'Bruk en operatør til å behandle vann fra anleggets begrensede regnvannsbuffer.',
  repair: 'Bruk materialer og arbeid til å reparere slitt forsvar i en sikret sone.',
};
const missionActions: ActionType[] = ['scout', 'clear', 'claim', 'secure', 'raid', 'surface', 'search', 'scavenge', 'watch', 'repair', 'establishBase', 'installWater', 'filterWater', 'upgradeHQ'];
const candidateStatuses = { waiting: 'Venter på svar', deferred: 'På vent', admitted: 'Tatt inn', refused: 'Avvist', helped: 'Fikk forsyninger' };
const position = (p: readonly number[]) => [(p[0] - 5.715) / .029 * 1000, (58.9978 - p[1]) / .0158 * 1000] as const;
const linePath = (coords: readonly (readonly number[])[]) => coords.map((p, i) => `${i ? 'L' : 'M'}${position(p).map(n => n.toFixed(2)).join(',')}`).join('');
const areaPath = (geometry: AreaGeometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).map(poly => poly.map(ring => `${linePath(ring)}Z`).join('')).join('');
const contextRoads = basemap.features.filter(f => f.properties.kind === 'road' && f.properties.tunnel !== 'yes' && ['secondary', 'tertiary', 'residential', 'unclassified', 'service'].includes(f.properties.highway ?? '')).map(f => ({ path: linePath(f.geometry.coordinates), major: f.properties.highway === 'secondary' }));
const contextCoast = basemap.features.filter(f => f.properties.kind === 'coast').map(f => linePath(f.geometry.coordinates));
const contextBuildings = basemap.features.filter(f => f.properties.kind === 'building').map(f => `${linePath(f.geometry.coordinates)}Z`);
function pointFor(id: string) {
  const p = locations.find(point => point.id === id);
  return position(p ? [p.lon, p.lat] : [5.736, 58.987]);
}
function ZoneIntelligence({ zone, day }: { zone?: PlayerZone; day: number }) {
  if(!zone?.playable)return <p>Framtidig område. Ikke tilgjengelig i første fase.</p>;
  const age=zone.observedDay===undefined?undefined:day-zone.observedDay;
  const observed=zone.intel ? zone.intel.min===zone.intel.max ? `${zone.intel.min}` : `${zone.intel.min}–${zone.intel.max}` : 'Ukjent';
  return <section className="sz-intelligence" aria-label="Kontroll og etterretning"><dl>
    <div><dt>Kontroll</dt><dd className={zone.secured?'sz-control-secured':''}>{zone.secured?'Sikret':zone.claimed?'Overtatt':'Ikke overtatt'}</dd></div>
    <div><dt>Siste observasjon</dt><dd>{zone.observedDay===undefined?'Ingen':`Dag ${zone.observedDay}`}</dd></div>
    <div><dt>Observerte zombier</dt><dd>{observed}</dd></div>
  </dl><p className={age!==undefined&&age>0?'sz-intel-aged':''}>{age===undefined?'Speid for å få en trusselrapport.':age===0?'Informasjonen er fra i dag.':`Informasjonen er ${age} ${age===1?'dag':'dager'} gammel.`}</p>{zone.secured&&<p>Sikring gir forsvar. Nye zombier kan fortsatt komme inn.</p>}</section>;
}
function Modal({ title, onClose, children, wide = false }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className={`sz-dialog ${wide ? 'sz-wide' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="sz-dialog-head"><h2>{title}</h2><button onClick={onClose} aria-label="Lukk vindu">×</button></div>{children}
  </dialog>;
}
function GameMap({ world, statuses, selected, onSelect, route, baseId, pois, selectedPoi, onSelectPoi, perimeter }: {
  world: WorldDefinition; statuses: Map<string, { status: string; threat: string }>; selected: string; onSelect(id: string): void;
  route: string[]; baseId: string; pois: PlayerPoi[]; selectedPoi: string; onSelectPoi(id: string): void;
  perimeter: ReadonlyMap<string,number>;
}) {
  const [zoom, setZoom] = useState(1.35);
  const [center, setCenter] = useState({ x: 585, y: 625 });
  const width = 1000 / zoom;
  const routeEdges = world.edges.filter(edge => route.some((id, i) => i > 0 && [route[i - 1], id].every(item => [edge.fromCellId, edge.toCellId].includes(item))));
  function focusSelected() { const [x, y] = pointFor(selected); setCenter({ x, y }); setZoom(2); }
  return <section className="sz-map" aria-label="Spillkart over Buøy og Hundvåg">
    <svg viewBox={`${center.x - width / 2} ${center.y - width / 2} ${width} ${width}`} aria-label="Velg en sone på kartet" role="group">
      <defs>
        <filter id="sz-grain"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <pattern id="sz-terrain" width="180" height="180" patternUnits="userSpaceOnUse"><rect width="180" height="180" fill="#343830"/><rect width="180" height="180" filter="url(#sz-grain)" opacity=".18"/></pattern>
        <radialGradient id="sz-sea"><stop stopColor="#1b3035"/><stop offset="1" stopColor="#0b171c"/></radialGradient>
      </defs>
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#sz-sea)" />
      <g className="sz-land" pointerEvents="none">{world.zones.filter(z => z.level === 3).map(z => <path key={z.id} d={areaPath(z.geometry)} fill="url(#sz-terrain)" fillRule="evenodd" />)}</g>
      <g className="sz-building-context" pointerEvents="none">{contextBuildings.map((d,i) => <path key={i} d={d} />)}</g>
      <g className="sz-road-casing" pointerEvents="none">{contextRoads.map((road,i) => <path key={i} d={road.path} className={road.major ? 'sz-major-road' : ''} />)}</g>
      <g className="sz-road-context" pointerEvents="none">{contextRoads.map((road,i) => <path key={i} d={road.path} className={road.major ? 'sz-major-road' : ''} />)}</g>
      <g className="sz-zones">{world.zones.filter(z => z.level === 3).map(zone => {
        const info = statuses.get(zone.id);
        const status = info?.status ?? 'Ukjent';
        return <path key={zone.id} d={areaPath(zone.geometry)} fillRule="evenodd" className={`sz-zone sz-state-${status.toLowerCase()} ${!zone.playable ? 'sz-future' : ''} ${selected === zone.id ? 'sz-selected-zone' : ''}`} role="button" tabIndex={0}
          aria-label={`${zone.name}. ${zone.playable ? `${status}. ${info?.threat ?? ''}` : 'Framtidig område'}`} aria-pressed={selected === zone.id}
          onClick={() => onSelect(zone.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(zone.id); } }} />;
      })}</g>
      <g className="sz-coast-context" pointerEvents="none">{contextCoast.map((path, i) => <path key={i} d={path} />)}</g>
      <g className="sz-connections" pointerEvents="none">{world.edges.filter(e => e.status === 'active').map(edge => <path key={edge.id} className={perimeter.has(edge.id) ? perimeter.get(edge.id)! > 0 ? 'sz-edge-defended' : 'sz-edge-exposed' : undefined} d={linePath(edge.geometry.coordinates)} />)}</g>
      <g className="sz-route" pointerEvents="none">{routeEdges.map(edge => <path key={edge.id} d={linePath(edge.geometry.coordinates)} />)}</g>
      <g className="sz-zone-symbols">{world.zones.filter(z => z.level === 3).map(zone => {
        const [x,y] = pointFor(zone.id); const symbol = zoneSymbol(zone.id); const isBase = zone.id === baseId;
        return <g key={zone.id} transform={`translate(${x},${y})`} className={`sz-zone-symbol ${selected === zone.id ? 'sz-zone-symbol-selected' : ''} ${isBase ? 'sz-zone-symbol-base' : ''}`} role="button" tabIndex={0} aria-label={`Velg sone: ${zone.name}. ${symbol.label}${isBase ? '. Leir' : ''}`} aria-pressed={selected === zone.id} onClick={() => onSelect(zone.id)} onKeyDown={event => {if(event.key === 'Enter' || event.key === ' ') {event.preventDefault();onSelect(zone.id);}}}>
          <title>{`${isBase ? 'Leir · ' : ''}${symbol.label} · ${zone.name}`}</title><circle r="18"/><svg x="-13" y="-13" width="26" height="26" viewBox="0 0 24 24"><Icon name={isBase ? 'establishBase' : symbol.icon} /></svg>
        </g>;
      })}</g>
      <g className="sz-poi-markers">{world.pois.map(p => {
        const info = pois.find(item => item.id === p.id);
        if(!info || (!world.zones.some(zone => zone.id === p.cellId && zone.playable) && !p.hqCandidate)) return null;
        const [x,y] = position(p.geometry.coordinates); const exhausted = info.discovered && !Object.values(info.supplies ?? {}).some(n => n > 0);
        const supplyLabel = info.discovered ? Object.entries(info.supplies ?? {}).filter(([,n]) => n > 0).map(([id,n]) => `${n} ${resources[id] ?? id}`).join(', ') || 'Tømt' : p.hqCandidate ? 'Framtidig HQ-kandidat' : 'Beholdning ukjent';
        const label = `${p.name} · ${poiKindLabel(p.kind)} · ${supplyLabel}`;
        return <g key={p.id} transform={`translate(${x},${y})`} className={`sz-poi-marker ${selectedPoi === p.id ? 'sz-poi-selected' : ''} ${exhausted ? 'sz-poi-empty' : ''} ${!info.discovered ? 'sz-poi-future' : ''}`} role="button" tabIndex={0} aria-label={`Velg POI: ${label}`} aria-pressed={selectedPoi === p.id} onClick={() => onSelectPoi(p.id)} onKeyDown={event => {if(event.key === 'Enter' || event.key === ' ') {event.preventDefault();onSelectPoi(p.id);}}}>
          <title>{label}</title><rect className="sz-poi-hit" x="-28" y="-56" width="56" height="60"/><path className="sz-poi-stem" d="M-5-8 0 0 5-8"/><rect x="-21" y="-48" width="42" height="40" rx="2"/><svg x="-14" y="-43" width="28" height="28" viewBox="0 0 24 24"><Icon name={!info.discovered && p.hqCandidate ? 'establishBase' : poiSymbol(p.kind)} /></svg>
          {selectedPoi === p.id && <text textAnchor="middle" y="-58">{p.name}</text>}
        </g>;
      })}</g>
    </svg>
    <div className="sz-map-atmosphere" aria-hidden="true" />
    <div className="sz-map-title"><span>OPERASJONSOMRÅDE / STAVANGER</span><strong>Buøy & Hundvåg</strong><small>LOKALE OPERASJONER · FASE 01</small></div>
    <div className="sz-compass" aria-hidden="true">N<span>♧</span><i />S</div>
    <div className="sz-map-controls"><button onClick={() => setZoom(z => Math.min(3.2, z + .3))} aria-label="Zoom inn">+</button><button onClick={() => setZoom(z => Math.max(.85, z - .3))} aria-label="Zoom ut">−</button><button onClick={focusSelected} aria-label="Zoom til valgt sone">Valgt</button><button onClick={() => { setZoom(.95); setCenter({ x: 500, y: 500 }); }}>Oversikt</button></div>
    <div className="sz-map-key"><span><i className="sz-key-secured" />Sikret</span><span><i className="sz-key-claimed" />Overtatt</span><span><i className="sz-key-contested" />Utforsket</span><span><i className="sz-key-unknown" />Ukjent</span><span className="sz-key-separator"><Icon name="residential" />Rund markør: sonetype</span><span><Icon name="scavenge" />Firkant: forsyningssted</span><span><Icon name="establishBase" />Hus: leir / framtidig HQ</span><span className="sz-perimeter-key">Stiplet: utsatt · grønn: sperret</span></div>
    <a className="sz-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>
  </section>;
}

export default function Game() {
  const [ready, setReady] = useState(false);
  const [game, setGame] = useState<PlayState | null>(null);
  const [available, setAvailable] = useState<SaveEnvelope | null>(null);
  const envelope = useRef<SaveEnvelope | null>(null);
  const [orders, setOrders] = useState<GameOrder[]>([]);
  const [selected, setSelected] = useState('cell-002');
  const [crew, setCrew] = useState<string[]>([]);
  const [mode, setMode] = useState<WorkMode>('together');
  const [handbookOpen, setHandbookOpen] = useState(false);
  const [action, setAction] = useState<ActionType>('scout');
  const [poi, setPoi] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmEmptyDay, setConfirmEmptyDay] = useState(false);
  const [emptyDayExplained, setEmptyDayExplained] = useState(false);
  const [importText, setImportText] = useState('');
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [unreadableSave, setUnreadableSave] = useState(false);
  const [historyDay, setHistoryDay] = useState<number | null>(null);
  useEffect(() => {
    try {setEmptyDayExplained(window.localStorage.getItem(EMPTY_DAY_HINT_KEY)==='1');} catch { /* Session-only explanation if storage is unavailable. */ }
    try { const saved = readSave(); setAvailable(saved); envelope.current = saved; } catch (e) { setError((e as Error).message); setUnreadableSave(true); }
    setReady(true);
    const listener = (event: StorageEvent) => { if (event.key === SAVE_KEY) setMessage('En annen fane har lagret. Åpne Lagring og hent siste lagring før du fortsetter.'); };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  }, []);
  const view = useMemo(() => game ? getView(game) : null, [game]);
  useEffect(() => { document.title = game ? `Stavanger Z · Dag ${game.day}` : 'Stavanger Z · Etter dag null'; }, [game?.day]);
  const preview = useMemo(() => game ? getActionPreview(game, action, selected, crew, poi || undefined, mode) : null, [game, action, selected, crew, poi, mode]);
  const assigned = new Set(orders.flatMap(order => order.crewIds));
  const living = view?.survivors.filter(s => s.alive) ?? [];
  const zone = view?.zones.find(z => z.id === selected);
  const visiblePois = view?.pois.filter(p => p.cellId === selected && p.discovered) ?? [];
  const raidPois = view?.pois.filter(p => p.cellId === selected) ?? [];
  const chosenPoi = raidPois.find(p => p.id === poi);
  const activeReport = historyDay === null ? view?.lastReport : view?.reports.find(r => r.day === historyDay);

  async function commit(next: PlayState, nextOrders: GameOrder[], nextSelected = selected, recover = false) {
    const saved: SaveEnvelope = memoryOnly ? { format: SAVE_KEY, revision: (envelope.current?.revision ?? 0) + 1, savedAt: new Date().toISOString(), game: next, orders: nextOrders, selectedZoneId: nextSelected }
      : await withSaveLock(() => recover && unreadableSave ? recoverSave({ game: next, orders: nextOrders, selectedZoneId: nextSelected }) : writeSave({ game: next, orders: nextOrders, selectedZoneId: nextSelected }, envelope.current?.revision ?? null));
    envelope.current = saved; setAvailable(saved); setGame(next); setOrders(nextOrders); setSelected(nextSelected); setError(''); setUnreadableSave(false);
  }
  async function guarded(work: () => Promise<void>) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { setError((e as Error).message); } finally { busyRef.current = false; setBusy(false); }
  }
  function resume(saved: SaveEnvelope) { envelope.current = saved; setGame(saved.game); setOrders(saved.orders); setSelected(saved.selectedZoneId); setAvailable(saved); setCrew([]); setError(''); }
  function selectZone(id: string) { setSelected(id); setPoi(''); setAction('scout'); setError(''); }
  function selectPoi(id: string) {
    const target = view?.pois.find(p => p.id === id); if(!target) return;
    setSelected(target.cellId);setError('');
    const targetZone = view?.zones.find(z => z.id === target.cellId);
    if(targetZone?.playable) {setPoi(id);setAction(target.discovered ? 'scavenge' : 'raid');}
    else {setPoi('');setAction('scout');}
  }
  function startNew() { void guarded(async () => { const next = createPhaseOneGame(435); await commit(next, [], next.base.zoneId, true); setConfirmNew(false); setCrew([]); }); }
  function addOrder() {
    if (!game || !preview?.valid || !crew.length) return;
    const order: GameOrder = { id: `${game.day}:${action}:${selected}:${[...crew].sort().join(',')}:${poi}`, type: action, targetId: selected, crewIds: [...crew], ...(poi ? { poiId: poi } : {}), ...(['surface', 'search'].includes(action) ? { mode } : {}) };
    void guarded(async () => { await commit(game, [...orders, order]); setCrew([]); setMessage('Oppdrag lagt i dagsplanen. Avslutt dagen når du er klar.'); });
  }
  function endDay(confirmed = false) {
    if (!game || busyRef.current || game.gameOver) return;
    if(!orders.length&&!emptyDayExplained&&!confirmed) {setConfirmEmptyDay(true);return;}
    void guarded(async () => {
      const next = resolveGameDay(game, orders, game.day); await commit(next, []);
      if(!orders.length) {setEmptyDayExplained(true);try {window.localStorage.setItem(EMPTY_DAY_HINT_KEY,'1');} catch { /* Memory fallback retains this choice for the session. */ }}
      setConfirmEmptyDay(false);setCrew([]);setHistoryDay(null);setReportOpen(true);setMessage('');
    });
  }
  function downloadSave() {
    if (!envelope.current) return;
    const blob = new Blob([exportSave(envelope.current)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `stavanger-z-dag-${envelope.current.game.day}.json`; link.click(); URL.revokeObjectURL(url);
  }
  function importGame() {
    void guarded(async () => { const saved = parseSave(importText); await commit(saved.game, saved.orders, saved.selectedZoneId, true); setCrew([]); setSaveOpen(false); setImportText(''); setMessage(`Lagring fra dag ${saved.game.day} lastet inn.`); });
  }
  if (!ready) return <main className="sz-game sz-loading">Klargjør leiren …</main>;
  if (!game || !view) return <main className="sz-game sz-welcome">
    <div className="sz-welcome-map" aria-hidden="true"><svg viewBox="0 0 1000 1000">{contextCoast.map((d, i) => <path key={i} d={d} />)}</svg></div>
    <section className="sz-welcome-content"><div className="sz-wordmark">AFTER DAY ZERO</div><p className="sz-kicker">STAVANGER Z / ETTER DAG NULL</p><h1>Fire overlevende.<br />Ett døgn av gangen.</h1>
      <p>Fra veien over Buøy hører du et sammenstøt. Så blir det stille. Dere fire kjenner hverandre fra nabolaget. Ingrid fikk dere inn, Marius holder øye med gata, og Leila hjelper Tor med å skyve kommoden foran døra.</p>
      <p>På kjøkkenet står et lite beredskapslager. Øverst ligger en slitt bok med en håndskrevet lapp: «Les før du går ut.»</p>
      <div className="sz-first-goal"><span>FØRSTE MÅL</span><h2>Et lite, sikkert tilhold</h2><p>Etabler en midlertidig base ved Buøy idrettsanlegg. Rosenberg kan vente.</p></div>
      {available && <button className="sz-primary sz-large" onClick={() => resume(available)}>Fortsett dag {available.game.day} <span>→</span></button>}
      <button className={available ? 'sz-secondary sz-large' : 'sz-primary sz-large'} disabled={busy} onClick={() => available ? setConfirmNew(true) : startNew()}>Start på dag 0 <span>→</span></button>
      <button className="sz-text-button" onClick={() => setSaveOpen(true)}>Last inn en lagringsfil</button>
      <a className="sz-text-button" href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Åpne soneeditoren ↗</a>
      {unreadableSave && <p className="sz-small">Ved ny gjennomspilling eller innlasting blir uleselig lagring arkivert før den erstattes.</p>}
      <p className="sz-small">Lagrer automatisk i denne nettleseren. Ingen tidsfrist. Ingen fordel av å skynde seg.</p>
      {error && <div className="sz-alert" role="alert">{error}<button onClick={() => { setMemoryOnly(true); setError(''); }}>Spill uten automatisk lagring – bruk eksport</button></div>}
    </section>{confirmNew && <Modal title="Starte på nytt?" onClose={() => setConfirmNew(false)}><p>En ny gjennomspilling erstatter aktiv lagring. Last gjerne ned den eksisterende først.</p><button onClick={downloadSave}>Last ned eksisterende lagring</button><button className="sz-primary" onClick={startNew}>Start ny gjennomspilling</button></Modal>}{saveOpen && <Modal title="Last inn lagring" onClose={() => setSaveOpen(false)}><SaveImport text={importText} onText={setImportText} onImport={importGame} error={error} /></Modal>}
  </main>;

  const phase = view.phaseOne;
  const workload = phase?.workloads[selected];
  const progress = phase?.searches[selected];
  const community = phase?.community;
  const district = phase?.district;
  const pendingRecruits = community?.arrival.candidates.filter(person => person.status === 'waiting' || person.status === 'deferred').length ?? 0;
  const steps = [true, view.base.established, !!phase?.water, !!phase?.hq, view.objective.complete];
  return <main className="sz-game">
    <header className="sz-header">
      <div className="sz-wordmark">AFTER DAY ZERO<small>STAVANGER Z / EKTE STEDER. REELLE VALG.</small></div>
      <div className="sz-day"><strong>DAG {view.day}</strong><div><b>{view.objective.complete ? 'FASE 02 — KLAR FOR UTVIDELSE' : 'FASE 01 — OVERLEVELSE'}</b><small>{view.base.established ? 'HOLD · FORSVAR · UTVID' : 'SPEID · RYDD · ETABLER'}</small></div></div>
      <div className="sz-survival-strip"><span><Icon name="person" /> {living.length} OVERLEVENDE</span>{phase && <span title="Forbruk ved starten av neste døgn"><Icon name="clock" /> {phase.dailyNeeds.food} MAT · {phase.dailyNeeds.water} VANN / DØGN</span>}</div>
      <div className="sz-resources">{Object.entries(resources).map(([id,label]) => <div key={id} className={(view.stocks[id] ?? 0) < (id === 'food' || id === 'water' ? living.length*2 : 1) ? 'sz-stock-low' : ''}><strong><Icon name={id === 'filterKit' ? 'water' : id as IconName} />{view.stocks[id] ?? 0}</strong><span>{label}</span></div>)}</div>
      <div className="sz-save-status"><span>{memoryOnly ? 'Kun i minnet — last ned før du lukker' : busy ? 'Lagrer …' : '● Fremdrift lagret'}</span><button onClick={() => setHandbookOpen(true)}>Håndbok</button><button onClick={() => setSaveOpen(true)}>Lagring ↗</button><a href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Soneeditor ↗</a></div>
    </header>
    {error && <div className="sz-alert sz-global-alert" role="alert">{error}<button onClick={() => setError('')} aria-label="Lukk feilmelding">×</button></div>}
    <div className="sz-play-layout">
      <aside className="sz-people" tabIndex={0} aria-label="Overlevende og dagsplan"><div className="sz-roster-heading"><div className="sz-section-label">DINE OVERLEVENDE <span>{living.length} i live</span></div><p className="sz-scroll-hint">Rull for flere og dagsplan ↓</p></div>
        {view.survivors.map(person => <div key={person.id} className={`sz-person ${!person.alive ? 'sz-person-dead' : ''} ${crew.includes(person.id) ? 'sz-person-selected' : ''}`}>
          <button className="sz-person-main" aria-pressed={crew.includes(person.id)} disabled={!canWork(person) || assigned.has(person.id) || busy} onClick={() => setCrew(ids => ids.includes(person.id) ? ids.filter(id => id !== person.id) : [...ids, person.id])}>
            <span className="sz-avatar" aria-hidden="true" style={{ backgroundImage: portraitPosition[person.id] ? `url(${portraitUrl})` : undefined, backgroundPosition: portraitPosition[person.id] }} /><span><strong>{person.name}</strong><small>{person.alive ? person.role : 'Død – permanent tap'}</small><em className={assigned.has(person.id) ? 'sz-person-assigned' : ''}>{!person.alive ? 'TAPT' : !canWork(person) ? 'TRENGER OMSORG' : assigned.has(person.id) ? 'PÅ OPPDRAG' : crew.includes(person.id) ? 'VALGT TIL LAGET' : 'TILGJENGELIG'}</em></span><span className="sz-person-check">{assigned.has(person.id) ? 'På plan' : crew.includes(person.id) ? '✓' : '+'}</span>
          </button>
          <div className="sz-vitals"><span>Helse <b>{person.health}</b></span><span>Utmattelse <b>{person.fatigue}</b></span></div><div className="sz-health-track"><i style={{ width: `${person.health}%` }} /></div>
          <details><summary>{person.gear.weapon} · Utstyr og egenskaper</summary><p>{person.description}</p><p><b>Styrke:</b> {person.strength}<br /><b>Svakhet:</b> {person.weakness}</p><p>{person.gear.weapon} / {person.gear.protection} / {person.gear.utility}</p><p>Kamp {person.skills.combat} · Speiding {person.skills.scouting} · Håndverk {person.skills.craft} · Medisin {person.skills.medical} · Erfaring {person.experience}</p></details>
        </div>)}
        <div className="sz-camp-actions"><button disabled={!crew.length || busy} onClick={() => { setAction('rest'); setSelected(view.base.zoneId); setPoi(''); }}>Hvil valgte</button><button disabled={!crew.length || busy} onClick={() => { setAction('heal'); setSelected(view.base.zoneId); setPoi(''); }}>Behandle skader</button></div>
        <section className="sz-plan"><div className="sz-section-label">DAGSPLAN <span>{orders.length} oppdrag</span></div>{orders.length === 0 ? <p className="sz-hint">Ingen ordre ennå. Velg en sone, handling og overlevende.</p> : orders.map(order => <div className="sz-planned" key={order.id}><div><strong>{ACTION_LABELS[order.type]} · {order.targetId.slice(-2)}</strong><small>{order.crewIds.map(id => view.survivors.find(p => p.id === id)?.name.split(' ')[0]).join(', ')}</small></div><button disabled={busy} aria-label={`Fjern ${ACTION_LABELS[order.type]}`} onClick={() => void guarded(() => commit(game, orders.filter(item => item.id !== order.id)))}>×</button></div>)}<p className="sz-small">Uten ordre: hviler i leiren. Alle trenger mat og vann.</p></section>
      </aside>
      <GameMap world={game.worldSnapshot} statuses={new Map(view.zones.map(z => [z.id,z]))} selected={selected} onSelect={selectZone} route={preview?.route ?? []} baseId={view.base.zoneId} pois={view.pois} selectedPoi={poi} onSelectPoi={selectPoi} perimeter={new Map(phase?.perimeter.map(edge => [edge.id,edge.durability]))} />
      <aside className="sz-command" tabIndex={0} aria-label="Ordre og valgt sone"><div className="sz-dossier-label">{chosenPoi ? 'POI // FORSYNINGSMÅL' : 'SONE // KONTROLLOMRÅDE'} <span>{selected.slice(-2)} · RULL ↓</span></div><div className="sz-location-art" role="img" aria-label="Stemningsillustrasjon av området" style={{backgroundImage:`url(${locationUrl})`,backgroundPosition:selected === 'cell-003' ? '0% 0%' : selected === 'cell-002' ? '100% 0%' : ['cell-006','cell-007','cell-012','cell-014'].includes(selected) ? '100% 100%' : '0% 100%'}}><span>STEDSBILDE · ILLUSTRASJON</span></div><div className="sz-selected-heading"><div className="sz-section-label">{chosenPoi ? `FORSYNINGSSTED I SONE ${selected.slice(-2)}` : `VALGT SONE / ${selected.slice(-2)}`}</div><h1>{chosenPoi?.name ?? zone?.name ?? game.worldSnapshot.zones.find(z => z.id === selected)?.name}</h1><div className="sz-area-type"><Icon name={chosenPoi ? poiSymbol(chosenPoi.kind) : zoneSymbol(selected).icon} />{chosenPoi ? `${poiKindLabel(chosenPoi.kind)} · Sone ${selected.slice(-2)}` : zoneSymbol(selected).label}</div><ZoneIntelligence zone={zone} day={view.day} />{chosenPoi && !chosenPoi.discovered && <p>Beholdningen er ukjent. Speid først eller forsøk et raid.</p>}{chosenPoi?.discovered && <section className="sz-poi-inventory"><h2>Beholdning igjen på stedet</h2><p>Hele lageret på POI-et. Ett oppdrag henter bare det laget kan bære.</p><div className="sz-poi-stock" aria-label="Kjente forsyninger på stedet">{Object.values(chosenPoi.supplies ?? {}).some(n => n > 0) ? Object.entries(chosenPoi.supplies ?? {}).filter(([,n]) => n > 0).map(([id,n]) => <span key={id} title={`${resources[id] ?? id}: ${n}`}><Icon name={id === 'filterKit' ? 'water' : id as IconName} /><b>{n}</b><small>{resources[id] ?? id}</small></span>) : <p>Stedet er tømt for forsyninger.</p>}</div></section>}{chosenPoi && <button className="sz-back-to-zone" onClick={() => selectZone(selected)}>← Vis kontrollområdet</button>}{!chosenPoi && <label className="sz-zone-picker">Velg sone<select value={selected} onChange={event => selectZone(event.target.value)}>{view.zones.map(z => <option key={z.id} value={z.id}>{z.id.slice(-2)} · {z.name}</option>)}</select></label>}</div>
        {zone?.playable ? <><div className="sz-actions">{missionActions.slice(0,4).map(type => <button key={type} aria-pressed={action === type} onClick={() => { setAction(type); setPoi(''); }}><Icon name={type as IconName} />{ACTION_LABELS[type]}</button>)}</div><label className="sz-operation-picker"><select aria-label="Flere oppdrag" value={missionActions.slice(4).includes(action) ? action : ''} onChange={event => { if(event.target.value) {setAction(event.target.value as ActionType);setPoi('');} }}><option value="">Forsyninger / perimeter / base</option>{missionActions.slice(4).map(type => <option key={type} value={type}>{ACTION_LABELS[type]}</option>)}</select></label>
          <section className="sz-mission"><h2>{ACTION_LABELS[action]}</h2><p>{descriptions[action]}</p>
            {(action === 'search' || action === 'surface') && <label className="sz-field">Arbeidsmåte<select value={mode} onChange={event => setMode(event.target.value as WorkMode)}><option value="together">Samlet · tryggere</option><option value="spread">Spredt · raskere</option></select></label>}
            {workload && zone.explored && <p className="sz-route-text">Innvendig søk: {progress?.completed ?? 0}/{workload.buildings} bygg · {progress?.hours ?? 0}/{workload.hours} arbeidstimer</p>}
            {preview?.work && crew.length > 0 && <p className="sz-estimate">Anslag: {preview.work.hours} arbeidstimer · {Math.max(0,preview.work.expectedCompleted-preview.work.completed)} nye bygg undersøkt.</p>}
            {(action === 'installWater' || action === 'filterWater') && <p className="sz-estimate">Råvann igjen i anlegget: {phase?.waterSource ?? 0} enheter.</p>}
            {(action === 'scavenge' || action === 'raid') && !chosenPoi && <label className="sz-field">Sted<select value={poi} onChange={event => setPoi(event.target.value)}><option value="">Velg forsyningssted</option>{(action === 'raid' ? raidPois : visiblePois).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
            {visiblePois.length > 0 && action !== 'scavenge' && action !== 'raid' && <details className="sz-pois"><summary>{visiblePois.length} {visiblePois.length === 1 ? 'forsyningssted' : 'forsyningssteder'} i sonen</summary>{visiblePois.map(p => <button className="sz-poi-choice" key={p.id} onClick={() => selectPoi(p.id)}><Icon name={poiSymbol(p.kind)} /><span>{p.name}<small>{Object.values(p.supplies ?? {}).some(n => n > 0) ? 'Velg forsyningsoppdrag' : 'Tømt'}</small></span></button>)}</details>}
            {preview && <><div className="sz-preview"><div><span>Dagens ordre</span><strong>{preview.eta} dag{preview.eta === 1 ? '' : 'er'}</strong></div><div><span>Fare for laget</span><strong className={`sz-risk-${preview.risk.toLowerCase()}`}>{crew.length ? preview.risk : 'Velg lag'}</strong></div><div><span>Støy</span><strong>{crew.length ? preview.noise : '—'}</strong></div></div>
              {preview.interruption && <p className="sz-estimate"><b>Avbruddsfare · {preview.interruption.level}</b><br />{preview.interruption.text}</p>}
              {preview.hqWork && <p className="sz-estimate"><b>HQ-arbeid · {preview.hqWork.completed}/{preview.hqWork.total}</b><br />Anslag for dagens lag: {preview.hqWork.planned} arbeidsenheter.</p>}
              {zone.routeIntel && <p className="sz-estimate"><b>Rutekunnskap fra bygningssøk</b><br />{zone.routeIntel.name}</p>}
              {preview.route.length > 0 && <p className="sz-route-text">Rute: {preview.route.map(id => id.slice(-2)).join(' → ')} · {preview.travelMinutes ? `ca. ${preview.travelMinutes} min tur-retur` : 'på basen'}</p>}
              {preview.scavenge && crew.length > 0 && <div className="sz-haul-preview"><h3>Anslått hjemtransport</h3><strong>{Object.entries(preview.scavenge.cargo).map(([id,n]) => `${n} ${resources[id] ?? id}`).join(' · ') || 'Ingen forsyninger'}</strong><p>Lagets bæreevne: {preview.scavenge.capacity} enheter per oppdrag. Anslaget kan endres av andre oppdrag og hendelser.</p></div>}
              {preview.expectedKills && crew.length > 0 && <p className="sz-estimate">Anslått kapasitet: {preview.expectedKills.min}–{preview.expectedKills.max} zombier. Ingen garanti for skadefri retur.</p>}
              {Object.values(preview.costs).some(n => n > 0) && <p className="sz-cost">Kostnad: {Object.entries(preview.costs).filter(([,n]) => n > 0).map(([id,n]) => `${n} ${resources[id] ?? id}`).join(' · ')}</p>}
              {preview.errors.length > 0 && crew.length > 0 && <div className="sz-validation">{preview.errors.map((issue,i) => <p key={i}>{issue}</p>)}</div>}
              <button className="sz-primary sz-queue" onClick={addOrder} disabled={!preview.valid || !crew.length || busy}>{crew.length ? `Legg oppdrag i planen · ${crew.length} person${crew.length > 1 ? 'er' : ''}` : 'Velg overlevende først'}</button>
              <details className="sz-risk-details"><summary>Grunnlaget for oppdraget</summary>{preview.reasons.map((reason,i) => <p className="sz-reason" key={i}>{reason}</p>)}</details>
            </>}
          </section></> : <p className="sz-unavailable">Rosenberg er et langsiktig mål. Begynn med et mindre tilhold og en sikker adkomst.</p>}
        {community && <section className="sz-event" id="recruitment"><span className="sz-section-label">MENNESKER SOM TRENGER HJELP <span>{pendingRecruits} venter</span></span><p>Hver person du tar inn trenger mat og vann hver dag. En arbeidsfør person kan bruke deler av hvilen på tilsyn. Uten tilsyn mister beboerne helse.</p>
          {community.arrival.candidates.map(person => <details key={person.id} open={person.status === 'waiting'}>
            <summary>{person.name} · {candidateStatuses[person.status]}</summary><p>{person.profile}</p><p>{person.needs} Helse {person.health}.</p>
            {(person.status === 'waiting' || person.status === 'deferred') && (Object.keys(RECRUITMENT_CHOICES) as RecruitmentChoice[]).filter(choice => choice !== 'defer' || person.status !== 'deferred').map(choice => <button key={choice} disabled={busy || view.gameOver || (choice === 'help' && (!view.stocks.food || !view.stocks.water))} onClick={() => void guarded(() => commit(decideRecruitment(game, person.id, choice), orders))}>{RECRUITMENT_CHOICES[choice]}</button>)}
          </details>)}
          {community.reactions.length > 0 && <details><summary>Personlige reaksjoner</summary>{community.reactions.map((reaction, i) => <p key={i}>Dag {reaction.day} · {reaction.text} ({reaction.trustChange > 0 ? '+' : ''}{reaction.trustChange} tillit)</p>)}</details>}
        </section>}
        {view.event?.status === 'pending' && <section className="sz-event"><span className="sz-section-label">EN HENVENDELSE</span><h2>{view.event.title}</h2><p>{view.event.text}</p>{view.event.choices.map(choice => <button key={choice.id} disabled={busy} onClick={() => void guarded(() => commit(chooseEvent(game,choice.id),orders))}><strong>{choice.label}</strong><small>{choice.description}</small></button>)}</section>}
      </aside>
    </div>
    <footer className="sz-footer">
      <div className="sz-timeline"><div className="sz-section-label">{view.objective.complete ? 'DISTRIKTET HOLDER' : district ? `${district.name} · ${district.controlled}/${district.total} SONER · ${district.defended}/${district.exposed} GRENSER` : 'ET DISTRIKT SOM KAN HOLDE'}<span>DAG {view.day}</span></div><ol aria-label="Fremdrift mot HQ og distrikt" title={view.objective.text}>{['Tilhold','Base','Vann','HQ','Distrikt'].map((label,i) => <li className={steps[i] ? 'sz-done' : ''} key={label}><span>{steps[i] ? '✓' : <Icon name={(['pin','establishBase','water','secure','claim'] as const)[i]} />}</span><b>{label}</b></li>)}</ol></div>
      <div className="sz-recent-activity"><div className="sz-section-label">SISTE AKTIVITET</div>{pendingRecruits > 0 ? <button onClick={() => document.getElementById('recruitment')?.scrollIntoView({block:'start'})}>{pendingRecruits} trenger svar →</button> : view.lastReport ? view.lastReport.entries.slice(-2).map((entry,i) => <p key={i}><span>D{view.lastReport!.day}</span>{entry.title}</p>) : <p>Dag null. Fire personer. En ny begynnelse.</p>}</div>
      <div className="sz-footer-actions"><div className="sz-bottom-status"><strong>{view.gameOver ? 'Leiren har kollapset' : orders.length ? `${orders.length} oppdrag klare` : 'Ingen ordre — alle hviler'}</strong><span aria-live="polite">{message || (!orders.length ? 'Mat og vann brukes. Zombiene beveger seg fortsatt.' : view.objective.complete ? 'Fortsett å sikre nabolaget.' : 'Velg lag og gi ordre før dagen avsluttes.')}</span></div><div><button disabled={!view.lastReport} onClick={() => { setHistoryDay(null); setReportOpen(true); }}>Dagsrapport</button><button className="sz-end-day" disabled={busy || view.gameOver} onClick={() => endDay()}>{busy ? 'Løser dagen …' : `Avslutt dag ${view.day}`} <span>→</span></button></div></div>
    </footer>
    {handbookOpen && <Modal title="The Zombie Apocalypse Survival Handbook" onClose={() => setHandbookOpen(false)} wide>
      <p>«Hold lav profil. Finn ut hva som skjer før du går ut. Ta med en venn og noe å bryte opp ei dør med. Jeg regnet med at vi skulle ha bedre tid.»</p>
      <h3>Velg hva som haster</h3><p>Raiding kan gi raske forsyninger med større risiko. Speid først for bedre etterretning, rydd ute for tryggere adkomst eller bruk flere dager på innvendig søk. Overtakelse åpner videre ruter.</p>
      <h3>Planlegg arbeidsdagen</h3><p>Velg overlevende, sone og handling. Sjekk anslaget før du legger ordren i dagsplanen. Ved innvendig søk arbeider laget tryggere samlet og raskere spredt. Alle i leiren trenger mat og vann.</p>
      <h3>Hold det dere tar</h3><p>Prioriter utsatte passasjer med vakthold og sperringer. Sammenhengende kontroll gjør at innsiden krever mindre forsvar. Etabler operasjonsbasen ved Buøy idrettsanlegg, installer vannrensing og bygg videre mot HQ og et forsvarbart distrikt.</p>
      <h3>Mennesker underveis</h3><p>Ta inn, hjelp, avvis eller utsett valget for hver person. Les behovet deres før du velger. Gruppen kan reagere forskjellig på samme valg.</p>
    </Modal>}
    {confirmEmptyDay && <Modal title="La hele laget hvile?" onClose={() => setConfirmEmptyDay(false)}><p>Ingen har fått ordre. Alle overlevende hviler i leiren og kan hente seg inn.</p><p>Mat og vann forbrukes fortsatt. Zombiene fortsetter å bevege seg, og basen kan bli utsatt for press.</p><p>Dette varselet vises bare første gang du gjennomfører en dag uten ordre.</p>{error && <p className="sz-save-error" role="alert">{error}</p>}<button disabled={busy} onClick={() => setConfirmEmptyDay(false)}>Tilbake til planlegging</button><button className="sz-primary" disabled={busy} onClick={() => endDay(true)}>{busy?'Løser dagen …':'La alle hvile og avslutt dagen'}</button></Modal>}
    {reportOpen && activeReport && <Modal title={`Dag ${activeReport.day} · Dette skjedde`} onClose={() => setReportOpen(false)} wide>
      <div className="sz-report-summary"><span><strong>{activeReport.kills}</strong> zombier drept</span><span><strong>{activeReport.injuries.length}</strong> skader</span><span><strong>{activeReport.deaths.length}</strong> tap</span></div>
      <div className="sz-report-entries">{activeReport.entries.map((entry,i) => {
        const place = view.zones.find(zone => zone.id === entry.zoneId);
        const person = view.survivors.find(survivor => survivor.id === entry.survivorId);
        return <article key={i} className={`sz-entry sz-entry-${entry.type}`}>
          <h3>{entry.title}</h3>
          <p>{entry.text}</p>
          {person && <small>{person.name}</small>}
          {place && <button onClick={() => { selectZone(place.id); setReportOpen(false); }}>Vis {place.name}</button>}
        </article>;
      })}</div>
      <div className="sz-report-bottom"><label>Tidligere dager<select value={activeReport.day} onChange={e => setHistoryDay(Number(e.target.value))}>{view.reports.map(r => <option key={r.day} value={r.day}>Dag {r.day}</option>)}</select></label><button className="sz-primary" onClick={() => setReportOpen(false)}>Planlegg dag {view.day} →</button></div>
    </Modal>}
    {saveOpen && <Modal title="Lagre og fortsett" onClose={() => setSaveOpen(false)}><p>Fremdrift og dagsplan lagres automatisk i denne nettleseren. Last ned en sikkerhetskopi hvis du bytter enhet eller nettleser.</p><p className="sz-save-confirmation">Dag {view.day} · {living.length} overlevende · {memoryOnly ? 'automatisk lagring er av' : 'lagret lokalt'}</p><div className="sz-save-buttons"><button className="sz-primary" onClick={downloadSave}>Last ned lagring</button><button onClick={() => { try { const latest = readSave(); if (latest) { resume(latest); setSaveOpen(false); setMessage('Siste lokale lagring lastet inn.'); } } catch(e) { setError((e as Error).message); } }}>Hent siste lokale lagring</button></div><SaveImport text={importText} onText={setImportText} onImport={importGame} error={error} /><details><summary>Start på nytt / lagringsproblemer</summary><p>Last ned lagringen først hvis du vil beholde denne gjennomspillingen.</p><button onClick={() => { setSaveOpen(false); setConfirmNew(true); }}>Ny gjennomspilling</button><button onClick={() => { setMemoryOnly(true); setError(''); setMessage('Automatisk lagring er av. Last ned lagring før du lukker.'); }}>Fortsett uten automatisk lagring</button></details></Modal>}
    {confirmNew && <Modal title="Starte ny gjennomspilling?" onClose={() => setConfirmNew(false)}><p>Aktiv lagring erstattes. Du kan beholde den som en nedlastet lagringsfil.</p><button onClick={downloadSave}>Last ned først</button><button className="sz-primary" onClick={startNew}>Start ny gjennomspilling</button></Modal>}
  </main>;
}

function SaveImport({ text, onText, onImport, error }: { text: string; onText(value: string): void; onImport(): void; error: string }) {
  return <section className="sz-save-import"><h3>Last inn en lagringsfil</h3><label className="sz-field">Velg JSON-fil<input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(onText); }} /></label><label className="sz-field">Eller lim inn lagringen<textarea value={text} onChange={event => onText(event.target.value)} rows={3} placeholder="Lim inn innholdet fra en lagringsfil" /></label><p className="sz-small">Innlasting erstatter aktiv gjennomspilling. Last ned den du vil beholde først.</p><button disabled={!text.trim()} onClick={onImport}>Last inn denne lagringen</button>{error && <p role="alert" className="sz-save-error">{error}</p>}</section>;
}
