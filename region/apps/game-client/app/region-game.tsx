'use client';

/** Stavanger Z, the region game: the whole Stavanger region from the zone editor, one day at a time. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LibreMap, GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
import {
  ACTIONS, BRANCHES, HQ_BRANCH, LAW_GROUPS, LAWS, MILESTONES, MODULE_COST, MUTATIONS, NETWORK_COST, PHASES, PHASE_ONE_CAPACITY, R, SAVE_KEY_REGION, TECHS, TRAIT_NAMES, UPGRADE_COST, VALUE, WEAPONS, WORK_IDS, WORK_NAMES,
  areaNet, assaultOdds, assigned, autoWork, bestTier, controlled, craftRecipes, crewGearAway, dailyFlows, equippedGear, gearWeapon, dateText, discontentTarget, goalMet, hopeTarget, hqModules, indexWorld, lawAvailable, lawWait, living,
  moduleName, newRegionGame, passLaw, phaseDef, phaseOneReadiness, prepareGearPlan, previewOrder, reach, repealLaw, resolveEvent, resourceName, searchHoursTotal, season, setWork, shelter, specialBranch, startDanger,
  startRegionDay, continueRegionDay, pendingTurnDecision, startResearch, techBlocked, techCost, totalPeople, trade, tradeValue, upgradeName, upgradesFor, workforce, WONDERS, wonderZone, nextWonderLevel,
  type ActionId, type Branch, type Flows, type RegionOrder, type RegionReport, type RegionState, type RegionWorld, type WorkId,
} from '../../../packages/gameplay/src/region/index';
import { CONTENT } from '../../../packages/world-data/src/content';
import { attachBuildings, COLORS, gameStyle, MAP_ATTRIBUTION, markerElement } from './region-map-style';
import ZaBook from './za-book';
import CrewEquipment, { GearInventory, OrderGearSummary, equipmentDraftOrders } from './crew-equipment';
import { attachTerritoryCaptureEffects, territoryShifts, type TerritoryCaptureController } from './territory-capture-effects';
import CampaignControls, { CampaignModeInfo, CampaignHelp, CampaignEndingView } from './campaign-controls';
import { advanceCampaignCommit, campaignAvatarStatus, chooseCampaignAvatar, type CampaignOptions } from '../../../packages/gameplay/src/region/campaign';
import { loadRegionSave, saveRegionState, clearRegionSave } from './region-save';
import { attachOperationalMap, areaLeaves, type OperationalMapController } from './operational-map';
import { AdministrativeView } from './administrative-view';
import { applyAdministrationCommand, administrations } from '../../../packages/gameplay/src/region/administration';
import { PoiJournal, DiscoveryZonePanel } from './poi-journal';
import { WondersOperations } from './wonders-operations';
import { wonderOperational, wonderStatus } from '../../../packages/gameplay/src/region/wonders';
import { MissionOptions, LogisticsPanel } from './mission-controls';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { redirectMission } from '../../../packages/gameplay/src/region/mobility';
import './region.css';

const WORLD_URL = '/world/region-v1.json';
const ZONE_EDITOR_URL = 'http://127.0.0.1:5178/';
const CORE = ['medicine', 'fuel', 'ammo', 'building'];
const STATUS_LABEL = { unknown: 'Ukjent', scouted: 'Speidet', controlled: 'Deres' } as const;
const DANGER_COLOR: Record<string, string> = { Rolig: '#5f9a5f', Middels: '#a8a24a', Krevende: '#c48a3a', 'Svært krevende': '#b8563c', 'Nesten umulig': '#7c2230' };
const number = (n: number) => Math.round(n).toLocaleString('nb-NO');
const decimal = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${decimal(Math.abs(Math.round(n * 10) / 10))}`;

type Modal = null | 'report' | 'trade' | 'goals' | 'menu' | 'stock' | 'society' | 'research' | 'chronicle' | 'wonders' | 'book' | 'equipment' | 'discoveries' | 'administration' | 'attention';
type DayReplaySession = { before: RegionState; report: RegionReport; pendingEvent: boolean };

// ------------------------------------------------------------------ art
// Pictures live in public/art and are listed in public/art/manifest.json (pnpm art:manifest).
// Anything not listed is simply not shown, so the game works before and while the art arrives.
let artList: Promise<Set<string>> | null = null;
const artIndex = () => (artList ??= fetch('/art/manifest.json').then(r => r.ok ? r.json() : []).then((l: string[]) => new Set(l)).catch(() => new Set<string>()));
export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function Art({ path, className, alt = '' }: { path: string; className?: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    artIndex().then(set => { if (!live) return; const hit = ['webp', 'jpg', 'png', 'svg'].map(e => `${path}.${e}`).find(p => set.has(p)); setSrc(hit ? `/art/${hit}` : null); });
    return () => { live = false; };
  }, [path]);
  return src ? <img className={className ?? 'rz-art'} src={src} alt={alt} /> : null;
}

/** Keep the active dialog reachable without letting keyboard focus slip behind it. */
function useDialogFocus() {
  useEffect(() => {
    let active: HTMLElement | null = null;
    let returnTo: HTMLElement | null = null;
    const focusable = () => active ? [...active.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter(el => el.getClientRects().length > 0) : [];
    const sync = () => {
      const next = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].at(-1) ?? null;
      if (next === active) return;
      if (!active && next) returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      active = next;
      if (active) {
        active.tabIndex = -1;
        (active.querySelector<HTMLElement>('[autofocus]') ?? focusable()[0] ?? active).focus();
      } else if (returnTo?.isConnected && returnTo.getClientRects().length) returnTo.focus();
    };
    const trap = (event: KeyboardEvent) => {
      if (!active || event.key !== 'Tab') return;
      const candidates = focusable();
      const first = candidates[0] ?? active;
      const last = candidates.at(-1) ?? active;
      if (!active.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', trap);
    sync();
    return () => { observer.disconnect(); document.removeEventListener('keydown', trap); };
  }, []);
}

export default function RegionGame() {
  useDialogFocus();
  const [world, setWorld] = useState<RegionWorld | null>(null);
  const [state, setState] = useState<RegionState | null>(null);
  const [saved, setSaved] = useState<RegionState | null>(null);
  const [intro, setIntro] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const acceptState = (next: RegionState, replace = false) => {
    try { saveRegionState(next, { replace }); setState(next); setSaveError(''); }
    catch (e) { setSaveError((e as Error).message); throw e; }
  };
  const readSave = () => { try { return loadRegionSave(); } catch (e) { setSaveError((e as Error).message); return null; } };
  const quit = () => { setState(null); setSaved(readSave()); };
  const restart = () => { try { clearRegionSave(); quit(); } catch (e) { setSaveError((e as Error).message); } };
  useEffect(() => {
    fetch(WORLD_URL).then(r => r.json()).then((w: RegionWorld) => { setWorld(w); setSaved(readSave()); }).catch(e => setError(`Fant ikke spillverdenen: ${e.message}`));
  }, []);
  if (error) return <main className="rz-shell rz-center"><p>{error}</p></main>;
  if (!world) return <main className="rz-shell rz-center"><p>Laster kartet over Stavanger …</p></main>;
  if (!state) return <><StartScreen world={world} saved={saved} onStart={(s, fresh) => { try { acceptState(s, fresh); setSaved(s); setIntro(fresh); } catch { /* Error stays visible; the previous save is retained. */ } }} />{saveError && <div className="rz-save-error" role="alert">{saveError}</div>}</>;
  return <>
    <Play world={world} state={state} setState={acceptState} onQuit={quit} onRestart={restart} />
    {saveError && <div className="rz-save-error" role="alert">{saveError}</div>}
    {intro && <Intro world={world} state={state} onDone={() => setIntro(false)} />}
  </>;
}

// ------------------------------------------------------------------ start

function StartScreen({ world, saved, onStart }: { world: RegionWorld; saved: RegionState | null; onStart: (s: RegionState, fresh: boolean) => void }) {
  const index = indexWorld(world);
  const [choice, setChoice] = useState(world.starts.find(s => s.name.startsWith('Lundsneset'))?.zoneId ?? world.starts[0]?.zoneId ?? '');
  const [campaignOptions, setCampaignOptions] = useState<CampaignOptions>({ difficulty: 'survival', hardcore: false });
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9999));
  const dangers = useMemo(() => Object.fromEntries(index.l3.map(z => [z.id, startDanger(world, z.id)])), [world, index]);
  const zone = index.byId.get(choice);
  const d = dangers[choice];
  const l2 = index.byId.get(zone?.parentId ?? '');
  const hqNear = [choice, ...(index.adjacent.get(choice) ?? []).map(a => a.to)].flatMap(id => (index.poisByZone.get(id) ?? []).filter(p => p.role === 'hq')).map(p => `${p.name} (${CONTENT.hqTypes.find(t => t.id === p.hqType)?.name ?? ''})`);
  return <main className="rz-shell rz-start">
    <section className="rz-start-intro">
      <Art path="intro/hero" className="rz-art rz-art-hero" alt="Stavanger etter dag null" />
      <p className="rz-kicker">STAVANGER Z / ETTER DAG NULL</p>
      <h1>Hele regionen.<br />Ett døgn av gangen.</h1>
      <p>Du leder en liten gruppe gjennom en zombieapokalypse i Stavanger-regionen. Det finnes ingen regjering lenger, bare deg, folkene dine og de valgene du tar.</p>
      <p>Start hvor du vil. Tette bysentre har mye å finne, men så mange døde at det kan være umulig å bli. Da er første oppgave å komme seg ut. På landet er det jord, båter og diesel, og lange avstander.</p>
      {saved && <button className="rz-primary rz-wide" onClick={() => onStart(saved, false)}>{saved.gameOver ? 'Vis avslutningen etter' : 'Fortsett'} dag {saved.day} i {index.byId.get(saved.homeZoneId)?.name} →</button>}
      <CampaignControls value={campaignOptions} onChange={setCampaignOptions} />
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
        <p><b style={{ color: DANGER_COLOR[d.level] }}>Å bli: {d.level}</b> · om lag {number(d.zombies)} døde i sonen og {number(d.around)} rundt.{d.escape ? <> Beste fluktvei: <b>{index.byId.get(d.escape.zoneId)?.name}</b> (om lag {number(d.escape.zombies)} døde).</> : null}</p>
        <p className="rz-small">{d.level === 'Nesten umulig' ? 'Dere kommer ikke til å klare å holde dette stedet. Planlegg flukten fra første dag.' : d.level === 'Svært krevende' ? 'Mange døde. Det kan være lurt å flytte leiren før dere tar over noe.' : d.level === 'Krevende' ? 'Det går, men det koster.' : 'Et godt sted å begynne.'}
          {' '}{CONTENT.zoneTypes.find(t => t[0] === zone.type)?.[1] ?? ''}.{hqNear.length ? ` HQ i nærheten: ${hqNear.slice(0, 3).join(', ')}.` : ''}</p>
        <div className="rz-start-go">
          <label>Frø <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 1)} /></label>
          <button className="rz-primary" data-testid="start-game" onClick={() => {
            if (saved && !confirm('En ny gjennomspilling erstatter den lagrede. Fortsette?')) return;
            onStart(newRegionGame(world, choice, seed, { ...campaignOptions, runId: crypto.randomUUID() }), true);
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
      map = new lib.Map({ container: ref.current, center: [5.72, 58.96], zoom: 10.2, minZoom: 9, maxZoom: 16, dragRotate: false, attributionControl: false, style: gameStyle() });
      map.addControl(new lib.AttributionControl({ compact: true, customAttribution: MAP_ATTRIBUTION }));
      map.on('load', () => {
        const l3 = world.zones.filter(z => z.level === 3 && z.geometry).map(z => ({ type: 'Feature' as const, id: z.id, properties: { id: z.id, c: DANGER_COLOR[dangers[z.id]?.level ?? 'Rolig'] }, geometry: z.geometry as GeoJSON.Geometry }));
        map!.addSource('l3', { type: 'geojson', data: { type: 'FeatureCollection', features: l3 }, promoteId: 'id' });
        attachBuildings(map!);
        map!.addLayer({ id: 'fill', type: 'fill', source: 'l3', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': .42 } });
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
  return <div className="rz-start-canvas" aria-busy={!ready}><div ref={ref} className="rz-map-canvas" />
    <div className="rz-legend">{Object.entries(DANGER_COLOR).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}<span>Klikk en sone for å starte der</span></div></div>;
}

// ------------------------------------------------------------------ intro

function Intro({ world, state, onDone }: { world: RegionWorld; state: RegionState; onDone: () => void }) {
  const [page, setPage] = useState(0);
  const index = indexWorld(world);
  const place = index.byId.get(state.startZoneId)?.name ?? 'Stavanger';
  const d = startDanger(world, state.startZoneId);
  const pages = [
    { kicker: 'TIRSDAG 31. MARS', title: 'Det begynte på Forus', text: 'Først var det en nyhetssak om «uro» på et lager. Så stengte de Bybrua og Byfjordtunnelen. Ved midnatt var mobilnettet nede, og radioen spilte den samme meldingen om å holde seg innendørs.' },
    { kicker: 'NATT TIL 1. APRIL', title: `${place}`, text: `Dere er fire som fant hverandre i trappeoppgangen: Ingrid, som kjenner hver bakgård, Marius med jaktrifla, sykepleier Leila og mekaniker Tor. Ute i gatene går det som var naboene deres. ${d.level === 'Nesten umulig' || d.level === 'Svært krevende' ? 'Det er altfor mange av dem her. Dere må ut.' : 'Det er færre av dem her enn mange andre steder. Kanskje går det an å holde.'}` },
    { kicker: 'SLIK LEDER DU', title: 'Ett døgn av gangen', text: 'Velg folk under Mannskap, velg en sone på kartet og gi dem et oppdrag. Avslutt dagen, og alt skjer samtidig: zombiene vandrer mot lyd, natta tester forsvaret, og noen ganger banker noen på døra. Ta over en sone, etabler et hovedkvarter, og bygg et samfunn. Hvilket samfunn er opp til deg.' },
    { kicker: 'FASE 1: UTBRUDDET', title: 'Første mål', text: 'Finn et operativt hovedkvarter og sikre en sammenhengende kjerne rundt det. Bygg varig forsvar og nok mat og vann til å holde ut. Hele distriktet trenger ikke være deres. ZA-boka gir råd, og Faser og mål viser hva dere faktisk mangler.' },
  ];
  const p = pages[page];
  return <div className="rz-shell rz-overlay rz-intro"><section className="rz-dialog" role="dialog" aria-modal="true" aria-label="Introduksjon">
    <Art path={`intro/${page + 1}`} className="rz-art rz-art-wide" />
    <p className="rz-kicker">{p.kicker}</p><h2>{p.title}</h2><p className="rz-intro-text">{p.text}</p>
    <div className="rz-intro-nav"><span className="rz-small">{page + 1} / {pages.length}</span>
      <button onClick={onDone}>Hopp over</button>
      <button className="rz-primary" data-testid="intro-next" onClick={() => page < pages.length - 1 ? setPage(page + 1) : onDone()}>{page < pages.length - 1 ? 'Videre →' : 'Dag 0 →'}</button></div>
  </section></div>;
}

// ------------------------------------------------------------------ play

function Play({ world, state: committedState, setState, onQuit, onRestart }: { world: RegionWorld; state: RegionState; setState: (s: RegionState) => void; onQuit: () => void; onRestart: () => void }) {
  const [replay, setReplay] = useState<DayReplaySession | null>(null);
  const [replayStep, setReplayStep] = useState(-1);
  const [reportAfterEvent, setReportAfterEvent] = useState<RegionReport | null>(null);
  // Save the authoritative result immediately, but do not render any of its
  // information until the journal reaches that point in the day.
  const state = replay?.before ?? committedState;
  const index = indexWorld(world);
  const [selected, setSelected] = useState(state.homeZoneId);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [crew, setCrew] = useState<string[]>([]);
  const [orders, setOrders] = useState<RegionOrder[]>([]);
  const [equipmentDraft, setEquipmentDraft] = useState<RegionOrder | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [report, setReport] = useState<RegionReport | null>(null);
  const [message, setMessage] = useState('');
  const [panel, setPanel] = useState<'map' | 'crew' | 'zone'>('map');
  const [guide, setGuide] = useState(true);
  const [zoneQuery, setZoneQuery] = useState('');
  const [plannedSupply, setPlannedSupply] = useState<{ zoneId: string; cargo: Record<string, number> } | null>(null);
  const zonePanelRef = useRef<HTMLElement>(null);
  useEffect(() => { zonePanelRef.current?.scrollTo({ top: 0 }); }, [selected, selectedArea]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ zoneId: string; key: number } | null>(null);
  const [overlay, setOverlay] = useState<'zombies' | 'food'>('zombies');
  const [phaseShown, setPhaseShown] = useState(state.phase);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);
  const gearPlan = useMemo(() => prepareGearPlan(state, world, orders), [state, world, orders]);
  const draftGearPlan = useMemo(() => equipmentDraft ? prepareGearPlan(state, world, equipmentDraftOrders(orders, equipmentDraft)).orders.find(o => o.orderId === equipmentDraft.id) : undefined, [state, world, orders, equipmentDraft]);
  const hops = useMemo(() => reach(state, world), [state, world]);
  const flows = useMemo(() => dailyFlows(state, world), [state, world]);
  const mapState = useMemo(() => {
    if (!replay || replayStep < 0) return state;
    const zones = { ...replay.before.zones };
    for (const stage of replay.report.replay?.slice(0, replayStep + 1) ?? []) {
      for (const change of stage.zoneChanges) {
        const zone = zones[change.zoneId];
        if (zone) zones[change.zoneId] = { ...zone, status: change.after };
      }
    }
    return { ...replay.before, zones };
  }, [replay, replayStep, state]);
  // -1 = operations running (07→22), 0 = night running (22→07),
  // 1 = night settled at 07, 2 = new-day journal settled.
  // Show night movements during the night window only, not beforehand.
  const replayMoves = replay ? (replayStep === 0 ? replay.report.replay?.[1]?.moves ?? [] : []) : undefined;
  const closeReplay = () => {
    if (!replay) return;
    setReplay(null);
    setReplayStep(-1);
    setReport(replay.report);
    // An unresolved event takes precedence over the report, including on Skip.
    if (replay.pendingEvent) { setReportAfterEvent(replay.report); setModal(null); }
    else setModal('report');
  };
  useEffect(() => {
    if (!replay) return;
    const delay = [-1, 0, 1, 2].includes(replayStep)
      ? replayStep === -1 ? 1100 : replayStep === 0 ? 850 : replayStep === 1 ? 450 : 350
      : 350;
    const timer = window.setTimeout(() => {
      if (replayStep < 2) setReplayStep(replayStep + 1);
      else closeReplay();
    }, delay);
    return () => window.clearTimeout(timer);
    // closeReplay operates on the same immutable session as replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, replayStep]);
  useEffect(() => {
    if (!replay) return;
    // The translucent shield blocks pointer actions; trap keyboard focus too,
    // so players cannot issue a second order against an older visible state.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[data-testid="skip-replay"]')?.focus();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && !(event.target instanceof Node && document.querySelector('.rz-replay-card')?.contains(event.target))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', trap, true);
    return () => window.removeEventListener('keydown', trap, true);
  }, [replay]);
  useEffect(() => {
    if (!reportAfterEvent || replay || committedState.event) return;
    setReport(committedState.reports.find(r => r.day === reportAfterEvent.day) ?? reportAfterEvent);
    setReportAfterEvent(null);
    setModal('report');
  }, [reportAfterEvent, replay, committedState.event, committedState.reports]);
  useEffect(() => {
    if (!modal && !confirmEnd) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setModal(null); setConfirmEnd(false); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal, confirmEnd]);
  const busy = new Set(orders.flatMap(o => o.survivorIds));
  const people = living(state);
  const avatarStatus = campaignAvatarStatus(state);
  const configuredAvatarId = avatarStatus.id;
  const activeAvatar = people.find(person => person.id === configuredAvatarId);
  const previousAvatar = state.survivors.find(person => person.id === configuredAvatarId);
  const pendingNightDecision = pendingTurnDecision(committedState);
  const avatarNeedsSelection = (avatarStatus.needsSelection || avatarStatus.needsSuccessor) && !state.turnCheckpoint && !state.gameOver && people.length > 0;
  const zone = index.byId.get(selected);
  const apply = (fn: () => RegionState, committed = false, key?: string) => { try { const next = structuredClone(fn()); if (!committed) advanceCampaignCommit(next, key ?? `ui:${next.day}:${next.memory.length}`); setState(next); setMessage(''); } catch (e) { setMessage((e as Error).message); } };

  const addOrder = (action: ActionId, target?: string, zoneId = selected, custom?: RegionOrder) => {
    // The id seeds the dice for this order, so it must not depend on the clock: same clicks, same day.
    const order: RegionOrder = custom ?? { id: `o${state.day}-${action}-${zoneId}-${crew.join('.')}${target ? `-${target}` : ''}`, action, zoneId, survivorIds: crew, target };
    const p = previewOrder(state, world, order);
    if (!p.valid) { setMessage(p.errors.join(' ')); return; }
    const next = [...orders, order];
    const plan = prepareGearPlan(state, world, next);
    const errors = plan.orders.find(o => o.orderId === order.id)?.errors ?? [];
    if (errors.length) { setMessage(errors.join(' ')); return; }
    setOrders(next); setCrew([]); setMessage('Oppdrag lagt i dagsplanen.'); setPanel('crew');
  };
  const showCompletedDay = (before: RegionState, result: { state: RegionState; report: RegionReport }, skipReplay = false) => {
      setState(result.state); setOrders([]); setCrew([]); setReport(result.report);
      const stages = result.report.replay;
      if (!skipReplay && stages?.length === 3 && stages[0].phase === 'operations' && stages[1].phase === 'night' && stages[2].phase === 'new-day'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setReplay({ before, report: result.report, pendingEvent: !!result.state.event });
        setReplayStep(-1);
        setModal(null);
      } else if (result.state.event) {
        setReportAfterEvent(result.report);
        setModal(null);
      } else setModal('report');
  };
  const finishDay = () => {
    if (gearPlan.errors.length) { setMessage(gearPlan.errors.join(' ')); setPanel('crew'); return; }
    if (replay || committedState.event || committedState.turnCheckpoint || !activeAvatar || avatarNeedsSelection) return;
    try {
      const result = startRegionDay(state, world, orders, { avatarId: activeAvatar.id });
      if (result.status === 'paused') {
        // The authoritative partial turn is saved before asking the player.
        // It must be resumed, never simulated again with the old daily orders.
        setState(result.state); setOrders([]); setCrew([]); setReport(null); setModal(null);
        return;
      }
      showCompletedDay(state, result);
    } catch (e) { setMessage((e as Error).message); }
  };
  const answerNightDecision = (choice: string) => {
    if (!pendingNightDecision || replay) return;
    try {
      const result = continueRegionDay(committedState, world, choice);
      if (result.status === 'paused') { setState(result.state); setOrders([]); setCrew([]); setModal(null); return; }
      // The checkpoint is already post-operations. Without a persisted dawn
      // snapshot, animating the whole day from it would leak/falsify history.
      // Show the actual complete report directly for this first vertical slice.
      showCompletedDay(committedState, result, true);
      setMessage('');
    } catch (e) { setMessage((e as Error).message); }
  };
  // For automated testers: the current state, world, plan and forecast, read-only.
  useEffect(() => { (window as unknown as { __szRegion?: unknown }).__szRegion = { state, world, orders, selected, flows }; }, [state, world, orders, selected, flows]);
  const s = season(state.day);
  const phase = phaseDef(state);
  const away = (id: string) => { const p = crewPositionFor(state, id); return !p || p.kind !== 'zone' || Object.values(state.crewMissions ?? {}).some(m => !['complete', 'failed'].includes(m.status) && m.survivorIds.includes(id)); };
  const placement = (id: string) => { const p = crewPositionFor(state, id); return p?.kind === 'zone' ? `ved ${index.byId.get(p.zoneId)?.name ?? p.zoneId}` : p?.kind === 'transit' ? `på reise mot ${index.byId.get(p.toZoneId)?.name ?? p.toZoneId}` : p?.kind === 'area-duty' ? `områdevakt i ${index.byId.get(p.areaZoneId)?.name ?? p.areaZoneId}` : 'sted ikke rapportert'; };
  const showPhase = state.phase > phaseShown && !state.event && modal !== 'report';
  const selectZone = (id: string) => { if (index.byId.get(id)?.level !== 3) setSelectedArea(id); else { setSelected(id); setSelectedArea(null); } setPanel('zone'); };
  const focusZone = (id: string) => { selectZone(id); setPanel('zone'); setMapFocus({ zoneId: id, key: Date.now() }); };
  const freeCrew = people.filter(p => !busy.has(p.id) && !away(p.id));
  const regionalAlerts = administrations(state).flatMap(region => region.alerts.map(text => ({ text, zoneId: region.hqZoneId })));
  const urgent = flows.food.daysLeft !== null && flows.food.daysLeft < 3 ? 'Matlageret varer under tre døgn.' : flows.water.daysLeft !== null && flows.water.daysLeft < 3 ? 'Vannlageret varer under tre døgn.' : people.some(p => p.health < 45) ? 'Noen i mannskapet er alvorlig skadet.' : state.morale < 20 ? 'Håpet er kritisk lavt. Se Samfunn.' : state.discontent > 75 ? 'Uroen er kritisk høy. Se Samfunn.' : (state.stock.ammo ?? 0) < 1 && people.some(p => gearWeapon(state, p) !== 'melee') ? 'Tomt for ammunisjon. Skytevåpen kan ikke brukes.' : '';
  const attentionCount = (urgent ? 1 : 0) + regionalAlerts.length + people.filter(p => p.health < 45).length;
  return <main className={`rz-shell rz-play rz-panel-${panel}`}>

    <header className="rz-top">
      <div className="rz-brand">STAVANGER Z<small>{index.byId.get(state.homeZoneId)?.name}</small></div>
      <div className="rz-day"><strong>DAG {state.day} <small>07:00</small></strong><span>{dateText(state.day)} · {s.name}</span></div>
      <button className="rz-phase" onClick={() => setModal('goals')} title="Mål for fasen"><b>Fase {state.phase}</b><span>{phase.name} · Vis mål</span></button>
      <Meter label="Håp" value={state.morale} target={hopeTarget(state, world)} good />
      <Meter label="Uro" value={state.discontent} target={discontentTarget(state, world)} />
      <div className="rz-stock">
        <Supply label="Mat" stock={state.stock.food ?? 0} net={flows.food.net} days={flows.food.daysLeft} title={`Produsert ${decimal(flows.food.produced)}, spist ${decimal(flows.food.eaten)}, råtner ${decimal(flows.food.spoiled)}, patruljer ${decimal(flows.food.upkeep)} per dag`} />
        <Supply label="Vann" stock={state.stock.water ?? 0} net={flows.water.net} days={flows.water.daysLeft} title={`Samlet ${decimal(flows.water.produced)}, drukket ${decimal(flows.water.drunk)} per dag`} />
        {CORE.map(id => <span key={id}><b>{number(state.stock[id] ?? 0)}</b>{resourceName(id)}</span>)}
        <span title={`${people.length} i crewet, ${state.population.adults} voksne, ${state.population.children} barn, ${state.population.elderly} eldre, ${state.population.sick} syke`}><b>{totalPeople(state)}</b>Folk</span>
      </div>
      <nav className="rz-nav" aria-label="Spilloversikter">
        <button onClick={() => setModal('book')} data-testid="open-book">ZA-boka</button>
        <button onClick={() => { setReport(state.reports.at(-1) ?? null); setModal('report'); }} disabled={!state.reports.length}>Rapport</button>
        <button onClick={() => setModal('menu')}>Oversikter</button>
      </nav>
    </header>
    <aside className="rz-left" aria-label="Mannskap og dagsplan">
      <div className="rz-panel-heading"><span>MANNSKAP & PLAN</span><button onClick={() => setPanel('map')} aria-label="Lukk mannskap">×</button></div>
      <h2>Mannskap <small>{freeCrew.length} ledige</small></h2><p className="rz-small">Velg folk, så en sone og et oppdrag.</p>
      {people.map(p => <button key={p.id} className={`rz-person ${crew.includes(p.id) ? 'on' : ''} ${busy.has(p.id) || away(p.id) ? 'busy' : ''}`} disabled={busy.has(p.id) || away(p.id)}
        aria-pressed={crew.includes(p.id)} onClick={() => setCrew(crew.includes(p.id) ? crew.filter(x => x !== p.id) : [...crew, p.id])}>
        <Art path={`crew/${slug(p.name)}`} className="rz-portrait" alt={`Portrett av ${p.name}`} />
        <strong>{p.name}{p.id === activeAvatar?.id && <em className="rz-avatar-tag"> deg</em>}{p.bitten !== undefined && <em className="rz-bitten"> bitt</em>}<em> · {placement(p.id)}</em></strong>
        <span>{p.role} · {WEAPONS[gearWeapon(state, p)].label}</span>
        <i className="rz-bar"><b style={{ width: `${Math.max(0, p.health)}%` }} /></i>
        <small>Helse {Math.round(p.health)} · Utmattet {Math.round(p.fatigue)}</small>
        {(equippedGear(state, p.id, 'protection') || equippedGear(state, p.id, 'tool')) && <small>{[equippedGear(state, p.id, 'protection')?.name, equippedGear(state, p.id, 'tool')?.name].filter(Boolean).join(' · ')}</small>}
        <small className="rz-person-skills">Kamp {p.skills.combat} · Speiding {p.skills.scouting} · Bygg {p.skills.craft} · Pleie {p.skills.medical}</small>
      </button>)}
      {!!crew.length && <div className="rz-crew-selection"><strong>{crew.length} valgt</strong><button onClick={() => setPanel('zone')}>Velg oppdrag →</button><button className="rz-link" onClick={() => setCrew([])}>Tøm valg</button></div>}
      <details className="rz-crew-notes"><summary>Om folkene dine</summary>{people.map(p => <p key={p.id}><b>{p.name}</b> — {p.about} {p.traits?.map(t => TRAIT_NAMES[t]).join(', ')}.</p>)}</details>
      <p className="rz-small">{workforce(state)} kan jobbe i leiren, {assigned(state)} har arbeid. <button className="rz-link" onClick={() => setModal('society')}>Fordel arbeid</button></p>
      <h2>Dagsplan <small>{orders.length} oppdrag</small></h2>
      {Object.values(state.crewMissions ?? {}).filter(m => !['complete', 'failed'].includes(m.status)).map(m => <section key={m.id} className="rz-active-mission"><h3>{ACTIONS[m.action].label} · {index.byId.get(m.targetZoneId)?.name}</h3><p>{m.survivorIds.map(id => state.survivors.find(p => p.id === id)?.name).join(', ')} · {m.status === 'returning' ? 'på retur' : m.status === 'working' ? 'arbeider' : 'på vei'}</p><button onClick={() => apply(() => redirectMission(state, world, m.id, state.homeZoneId))}>Kall tilbake til leiren</button>{selected !== state.homeZoneId && <button onClick={() => apply(() => redirectMission(state, world, m.id, selected), false, `redirect:${m.id}:${selected}`)}>Avbryt og reis til {index.byId.get(selected)?.name}</button>}</section>)}
      {!orders.length && <p className="rz-small">Ingen nye oppdrag. Ledige folk blir der de er. Bare de som er i leiren, kan forsvare den.</p>}
      {orders.map(o => <div key={o.id} className="rz-order"><div className="rz-order-body"><b>{ACTIONS[o.action].label}</b> {index.byId.get(o.zoneId)?.name}{o.target ? ` · ${targetName(world, o)}` : ''}
        {gearPlan.orders.find(plan => plan.orderId === o.id) && <OrderGearSummary state={state} plan={gearPlan.orders.find(plan => plan.orderId === o.id)!} />}
        </div><div className="rz-order-controls"><button aria-label={`Utstyr for ${ACTIONS[o.action].label}`} onClick={() => { setEquipmentDraft(structuredClone(o)); setModal('equipment'); }}>Utstyr</button>
        <button aria-label="Fjern oppdrag" onClick={() => setOrders(orders.filter(x => x.id !== o.id))}>×</button></div></div>)}
      {gearPlan.errors.length > 0 && <p className="rz-message" role="alert">{gearPlan.errors.join(' ')} Åpne Utstyr eller fjern oppdraget.</p>}
      <p className="rz-small">Oppdrag løses samlet når du lar døgnet gå. Fjern et oppdrag for å velge folkene på nytt.</p>
      <CampaignHelp state={state} />
    </aside>
    <div className="rz-map-stage">
    <RegionMap focus={mapFocus} world={world} state={mapState} flows={flows} overlay={replay ? 'zombies' : overlay} selected={selectedArea ?? selected} hops={hops} replayMoves={replayMoves} onSelect={selectZone} onOverlay={setOverlay} />
    <section className={`rz-brief ${guide ? '' : 'rz-brief-folded'}`} aria-label="Veiviser">
      <button className="rz-brief-toggle" aria-expanded={guide} onClick={() => setGuide(!guide)}><span>DAG {state.day} · {guide ? 'Dagens utgangspunkt' : 'Vis veiviser'}</span><span aria-hidden="true">{guide ? '−' : '+'}</span></button>
      {guide && <><h2>{state.hq ? 'Hold kjernen levende.' : controlled(state).length ? 'Et sted å bli.' : `${people.length} liv. Din neste beslutning.`}</h2>
        <p>{state.hq ? 'Forsvar det dere har, og vurder forsyninger før dere utvider. Fasekravene viser hva som gjenstår.' : controlled(state).length ? 'Sonen er deres. Etabler HQ på et egnet sted og sikre forbindelsene rundt det.' : 'Speid før dere satser. Rydd et overkommelig område og ta det over når det er trygt nok.'}</p>
        <div className="rz-brief-actions"><button onClick={() => { setPanel('crew'); window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.rz-person:not(:disabled)')?.focus()); }}>1 · Velg folk</button><button onClick={() => setPanel('zone')}>2 · Gi oppdrag</button><button className="rz-link" onClick={() => setModal('book')}>Les ZA-boka ↗</button></div>
      </>}
    </section>
    <details className="rz-nearby"><summary>Finn en sone</summary><div><input aria-label="Søk etter sone" placeholder="Søk i kartet …" value={zoneQuery} onChange={e => setZoneQuery(e.target.value)} /><button onClick={() => focusZone(state.homeZoneId)}>⌂ {index.byId.get(state.homeZoneId)?.name} · leiren</button>{(zoneQuery.trim() ? index.l3.filter(z => z.name.toLocaleLowerCase('nb').includes(zoneQuery.toLocaleLowerCase('nb'))).slice(0, 12).map(z => z.id) : (index.adjacent.get(state.homeZoneId) ?? []).map(a => a.to)).map(id => <button key={id} data-zone-id={id} onClick={() => focusZone(id)}>{index.byId.get(id)?.name} · {STATUS_LABEL[state.zones[id].status]}</button>)}</div></details>
    </div>
    <aside ref={zonePanelRef} className="rz-right" aria-label="Valgt sone"><div className="rz-panel-heading"><span>VALGT SONE</span><button onClick={() => setPanel('map')} aria-label="Lukk sone">×</button></div>
      {selectedArea ? <AreaPanel world={world} state={state} areaId={selectedArea} onZone={focusZone} /> : zone && <ZonePanel key={selected} world={world} state={state} flows={flows} zoneId={selected} crew={crew} hops={hops.get(selected)} onOrder={addOrder} />}
      {!selectedArea && <><DiscoveryZonePanel state={state} world={world} zoneId={selected} crewIds={crew} onOrder={(action, zoneId, target) => addOrder(action, target, zoneId)} onSelectZone={focusZone} /><LogisticsPanel key={`${selected}-${crew.join('.')}-${plannedSupply?.zoneId === selected ? JSON.stringify(plannedSupply.cargo) : ''}`} initialCargo={plannedSupply?.zoneId === selected ? plannedSupply.cargo : undefined} state={state} world={world} zoneId={selected} crewIds={crew} onOrder={o => addOrder(o.action, o.target, o.zoneId, o)} /></>}
    </aside>
    <footer className="rz-command">
      <nav className="rz-mobile-panels" aria-label="Arbeidsflater"><button aria-pressed={panel === 'crew'} onClick={() => setPanel(panel === 'crew' ? 'map' : 'crew')}>Folk {crew.length ? `(${crew.length})` : ''}</button><button aria-pressed={panel === 'map'} onClick={() => setPanel('map')}>Kart</button><button aria-pressed={panel === 'zone'} onClick={() => setPanel(panel === 'zone' ? 'map' : 'zone')}>Sone</button></nav>
      <div className="rz-command-status" aria-live="polite">{message || urgent || `${freeCrew.length} ledige · ${orders.length} planlagte oppdrag`}</div>
      {attentionCount > 0 && <button className="rz-attention-link" onClick={() => setModal('attention')}>Saker <b>{attentionCount}</b></button>}
      <button className="rz-plan-link" onClick={() => setPanel('crew')}>Dagsplan <b>{orders.length}</b></button>
      {(urgent || message) && <p className="rz-mobile-message" role="status">{message || urgent}</p>}
      <button className="rz-primary rz-advance" data-testid="end-day" disabled={!!state.event || !!state.gameOver || !!replay || !!state.turnCheckpoint || !activeAvatar} onClick={() => orders.length ? finishDay() : setConfirmEnd(true)}>La døgnet gå →</button>
    </footer>
    {confirmEnd && <div className="rz-overlay"><section className="rz-dialog" role="dialog" aria-modal="true" aria-label="Ingen planlagte oppdrag"><h2>En rolig dag i leiren?</h2><p>Ingen nye oppdrag er planlagt. Pågående reiser og vakter fortsetter. Ledige folk blir der de er, og alle trenger mat og vann.</p><div className="rz-dialog-actions"><button autoFocus onClick={() => setConfirmEnd(false)}>Tilbake til planen</button><button className="rz-primary" onClick={() => { setConfirmEnd(false); finishDay(); }}>La døgnet gå uten oppdrag</button></div></section></div>}
    {state.event && <div className="rz-overlay"><section className="rz-dialog rz-event" role="dialog" aria-label={state.event.title}>
      <Art path={`events/${state.event.id}`} className="rz-art rz-art-wide" />
      <p className="rz-kicker">{state.event.kicker ?? `HENDELSE · DAG ${state.day}`}</p><h2>{state.event.title}</h2><p>{state.event.text}</p>
      {!!state.event.voices?.length && <ul className="rz-voices">{state.event.voices.map(v => <li key={v}>{v}</li>)}</ul>}
      {state.event.choices.map(c => <button key={c.id} disabled={!!c.disabled} onClick={() => apply(() => resolveEvent(state, world, c.id).state, false, `event:${state.event!.id}:${c.id}`)}><strong>{c.label}</strong><small>{c.disabled ?? c.detail}</small></button>)}
    </section></div>}
    {avatarNeedsSelection && <div className="rz-overlay"><section className="rz-dialog rz-avatar-choice" role="dialog" aria-modal="true" aria-label="Velg hovedperson">
      <p className="rz-kicker">DIN HISTORIE · FASE {state.phase}</p>
      <h2>{previousAvatar ? 'Hvem skal føre historien videre?' : 'Hvem spiller du som?'}</h2>
      <p>{previousAvatar
        ? `${previousAvatar.name} er ikke lenger tilgjengelig. Velg eksplisitt hvem av de overlevende du følger videre. Historien fortsetter med den du velger.`
        : 'Velg den du selv styrer ute i Stavanger. Personen kan bli skadet eller dø, og du tar valg når vedkommende er til stede. Samfunnets leder kan senere være en annen.'}</p>
      <div className="rz-avatar-options">{people.map(person => <button key={person.id} onClick={() => apply(() => chooseCampaignAvatar(committedState, person.id), true)}>
        <Art path={`crew/${slug(person.name)}`} className="rz-portrait" alt={`Portrett av ${person.name}`} />
        <span><strong>{person.name}</strong><small>{person.role} · Helse {Math.round(person.health)} · Kamp {person.skills.combat} · Speiding {person.skills.scouting}</small></span>
      </button>)}</div>

    </section></div>}
    {pendingNightDecision && !replay && <div className="rz-overlay"><section className="rz-dialog rz-event rz-night-decision" role="dialog" aria-modal="true" aria-label={pendingNightDecision.title}>
      <p className="rz-kicker">KRITISK · DAG {state.day} · {pendingNightDecision.kind === 'field-encounter' ? 'UTENFOR LEIREN' : 'NATT 22:00–07:00'}</p>
      <h2>{pendingNightDecision.title}</h2><p>{pendingNightDecision.text}</p>
      <p className="rz-small">{index.byId.get(pendingNightDecision.zoneId)?.name}</p>
      {pendingNightDecision.choices.map(choice => <button key={choice.id} disabled={!!choice.disabled} onClick={() => answerNightDecision(choice.id)}><strong>{choice.label}</strong><small>{choice.disabled ?? choice.detail}</small></button>)}
      {message && <p className="rz-message" role="alert">{message}</p>}
      <p className="rz-small">Døgnet er satt på pause og lagret. Valget må tas før neste dag kan begynne.</p>
    </section></div>}
    {showPhase && !state.gameOver && <div className="rz-overlay"><section className="rz-dialog rz-phase-dialog" role="dialog" aria-label="Ny fase">
      <Art path={`phases/${state.phase}`} className="rz-art rz-art-wide" />
      <p className="rz-kicker">DAG {state.day} · FASE {state.phase}</p><h2>{phase.name}</h2><p>{phase.intro}</p>
      {phase.unlocks.length > 0 && <p><b>Nytt:</b> {phase.unlocks.join(', ')}.</p>}
      {state.mutations.filter(m => m.day === state.phaseDay).map(m => <p key={m.id} className="rz-errors">{m.known ? `Mutasjon: ${MUTATIONS.find(x => x.id === m.id)?.name}. ${MUTATIONS.find(x => x.id === m.id)?.text}` : 'Zombiene har forandret seg. Forsk på zombiestudier for å finne ut hvordan.'}</p>)}
      <p><b>Mål:</b> {phase.goals.map(g => g.text).join(' ')}</p>
      <button className="rz-primary" onClick={() => setPhaseShown(state.phase)}>Videre</button>
    </section></div>}
    {state.gameOver && <div className="rz-overlay"><section className="rz-dialog" role="dialog" aria-modal="true" aria-label="Gjennomspillingen er over"><Art path={`end/${state.gameOver.won ? 'win' : 'lose'}`} className="rz-art rz-art-wide" /><p className="rz-kicker">{state.gameOver.won ? 'SEIER' : 'SLUTT'}</p><h2>{state.gameOver.won ? 'Dere klarte det' : `Slutt etter ${state.gameOver.day} dager`}</h2><p>{state.gameOver.reason}</p>
      <p>Fase {state.phase}, {controlled(state).length} soner, {totalPeople(state)} mennesker, {state.research.done.length} oppfinnelser, {state.counters.killed ?? 0} zombier drept.</p>
      <CampaignEndingView state={state} /><button className="rz-primary" onClick={onRestart}>Ny gjennomspilling</button></section></div>}
    {modal && <div className="rz-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}><section className={`rz-dialog rz-wide-dialog${modal === 'equipment' ? ' rz-equipment-dialog' : ''}`} role="dialog" aria-modal="true" aria-label={modal === 'report' ? `Dagsrapport for dag ${report?.day ?? state.day}` : modal === 'book' ? 'ZA-boka' : modal === 'equipment' ? 'Utstyr til oppdraget' : 'Spilloversikt'}>
      <button className="rz-close" aria-label="Lukk" autoFocus onClick={() => setModal(null)}>×</button>
      {modal === 'equipment' && equipmentDraft && <><div className="rz-equipment-scroll"><CrewEquipment state={state} world={world} orders={orders} draftOrder={equipmentDraft} onChange={setEquipmentDraft} /><MissionOptions state={state} world={world} order={equipmentDraft} onChange={setEquipmentDraft} /></div><div className="rz-dialog-actions"><button onClick={() => { setModal(null); setEquipmentDraft(null); }}>Avbryt</button><button className="rz-primary" disabled={!draftGearPlan || !!draftGearPlan.errors.length} onClick={() => { setOrders(equipmentDraftOrders(orders, equipmentDraft)); setEquipmentDraft(null); setModal(null); setMessage('Utstyr oppdatert. Reservasjonene følger dagsplanen.'); }}>Lagre utstyrsvalg</button></div></>}
      {modal === 'attention' && <><p className="rz-kicker">TRENGER OPPFØLGING</p><h2>Åpne saker</h2>{urgent && <section className="rz-attention-item"><h3>Leirens kapasitet</h3><p>{urgent}</p><button onClick={() => setModal('stock')}>Se lager og forsyninger</button></section>}{people.filter(p => p.health < 45).map(p => <section className="rz-attention-item" key={p.id}><h3>{p.name} trenger hjelp</h3><p>Helse {Math.round(p.health)} · {placement(p.id)}</p><button onClick={() => { setModal(null); setPanel('crew'); }}>Se mannskap og planlegg behandling</button></section>)}{regionalAlerts.map((alert, i) => <section className="rz-attention-item" key={`${alert.zoneId}-${i}`}><h3>{index.byId.get(alert.zoneId)?.name}</h3><p>{alert.text}</p><button onClick={() => setModal('administration')}>Følg opp regionen</button></section>)}{!attentionCount && <p>Ingen kritiske avvik er meldt.</p>}</>}
      {modal === 'administration' && <AdministrativeView enabled state={state} world={world} onCommand={command => apply(() => applyAdministrationCommand(state, world, command), false, `administration:${JSON.stringify(command)}`)} onSelectZone={id => { focusZone(id); setModal(null); }} onSupplyRequest={(destinationZoneId, cargo) => { setPlannedSupply({ zoneId: destinationZoneId, cargo }); focusZone(destinationZoneId); setModal(null); setPanel('crew'); setMessage('Forsendelsen er klargjort i sonepanelet. Velg et samlet lag ved avreisestedet og kontroller last og kapasitet.'); }} />}
      {modal === 'discoveries' && <PoiJournal state={state} world={world} crewIds={crew} onSelectZone={id => { focusZone(id); setModal(null); }} onOrder={(action, zoneId, target) => { addOrder(action, target, zoneId); setModal(null); }} />}
      {modal === 'book' && <ZaBook world={world} state={state} onGoals={() => setModal('goals')} onDiscoveries={() => setModal('discoveries')} />}
      {modal === 'report' && report && <><label className="rz-report-picker">Rapportarkiv <select aria-label="Velg dagsrapport" value={report.day} onChange={e => setReport(state.reports.find(r => r.day === Number(e.target.value)) ?? report)}>{state.reports.slice().reverse().map(r => <option key={r.day} value={r.day}>Dag {r.day}{r.day === state.day ? ' · siste rapport' : ''}</option>)}</select></label><ReportView report={report} state={state} flows={flows} onZone={id => { focusZone(id); setModal(null); }} /></>}
      {modal === 'trade' && <TradeView state={state} world={world} onTrade={(id, give, take) => { try { const r = trade(state, id, give, take); advanceCampaignCommit(r.state, `trade:${id}`); setState(r.state); setMessage(r.message); } catch (e) { setMessage((e as Error).message); } }} message={message} />}
      {modal === 'goals' && <GoalsView world={world} state={state} />}
      {modal === 'society' && <SocietyView world={world} state={state} flows={flows} apply={apply} message={message} />}
      {modal === 'research' && <ResearchView state={state} apply={apply} message={message} />}
      {modal === 'wonders' && <WondersOperations world={world} state={state} crewIds={crew} onOrder={(zoneId, wonderId) => { addOrder('wonder', wonderId, zoneId); setModal(null); }} onSelectZone={id => { focusZone(id); setModal(null); }} />}
      {modal === 'chronicle' && <><h2>Krønike</h2><ol className="rz-chronicle">{[...state.memory].reverse().map((m, i) => <li key={i}><b>Dag {m.day}</b> {m.text}</li>)}</ol></>}
      {modal === 'stock' && <><h2>Lager</h2><div className="rz-stock-grid">{[...CONTENT.resources.filter(r => r.layer !== 'capacity').map(r => r.id), 'samples'].map(id => <span key={id}><b>{number(state.stock[id] ?? 0)}</b>{resourceName(id)}</span>)}</div><h3>Personlig utstyr</h3><GearInventory state={state} world={world} plan={gearPlan} open /></>}
      {modal === 'menu' && <><p className="rz-kicker">KOMMANDOSENTRAL</p><h2>Oversikter</h2><div className="rz-overviews">{([['attention', 'Åpne saker'], ['report', 'Dagsrapporter'], ['goals', 'Faser og mål'], ['book', 'ZA-boka'], ['society', 'Samfunn og arbeid'], ...(state.phase >= 4 ? [['administration', 'Regionale ledere']] : []), ['research', 'Forskning'], ['trade', 'Grupper og handel'], ['wonders', 'Unike steder'], ['discoveries', 'Oppdagelser og spor'], ['stock', 'Lager'], ['chronicle', 'Krønike']] as [Exclude<Modal, null>, string][]).map(([id, label]) => <button key={id} disabled={id === 'report' && !state.reports.length} onClick={() => { if (id === 'report') setReport(state.reports.at(-1) ?? null); setModal(id); }}>{label} <span>→</span></button>)}</div>
        <CampaignModeInfo state={state} /><p>Frø {state.seed} · Regler {state.rulesVersion} · Verden {state.worldVersion}</p>
        <button onClick={() => { const blob = new Blob([JSON.stringify(state)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stavanger-z-dag-${state.day}.json`; a.click(); URL.revokeObjectURL(a.href); }}>Last ned lagring</button>
        <button onClick={onQuit}>Til startskjermen</button>
        <button onClick={() => { if (confirm('Avslutte og starte på nytt? Lagringen slettes.')) { onRestart(); } }}>Ny gjennomspilling</button>
        <a className="rz-link" href={ZONE_EDITOR_URL} target="_blank" rel="noreferrer">Åpne soneeditoren ↗</a></>}
    </section></div>}
    {replay && <DayReplay session={replay} step={replayStep} onSkip={closeReplay} />}
  </main>;
}

/** A presentation of settled journal entries, not a minute-based simulation. */
function DayReplay({ session, step, onSkip }: { session: DayReplaySession; step: number; onSkip: () => void }) {
  const [clock, setClock] = useState('07:00');
  useEffect(() => {
    if (step >= 1) { setClock('07:00'); return; }
    const start = performance.now();
    const night = step === 0;
    const duration = night ? 850 : 1100;
    const beginMinutes = night ? 22 * 60 : 7 * 60;
    const spanMinutes = (night ? 9 : 15) * 60;
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (performance.now() - start) / duration);
      const minutes = (beginMinutes + Math.floor(spanMinutes * ratio)) % (24 * 60);
      setClock(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
    }, 60);
    return () => window.clearInterval(timer);
  }, [step]);
  const journal = session.report.replay ?? [];
  const settled = step >= 0 ? journal[Math.min(step, journal.length - 1)] : null;
  const label = step < 0 ? 'DAGENS OPERASJONER' : step === 0 ? 'NATTEN FALLER' : step === 1 ? 'MORGENEN GRYR' : 'NY DAG';
  const headline = step < 0 ? 'Oppdragene gjennomføres' : step === 0 ? 'Operasjonene er avgjort' : step === 1 ? 'Nattevakten har rapportert' : 'Døgnet er oppsummert';
  const lines = settled?.lines.slice().sort((a, b) => reportPriority(b, session.before.phase) - reportPriority(a, session.before.phase)).slice(0, 3) ?? [];
  const resources = settled?.mainResourcesAfter ?? { food: session.before.stock.food ?? 0, water: session.before.stock.water ?? 0 };
  return <div className="rz-replay-shield" role="dialog" aria-modal="true" aria-label="Døgnet spilles av">
    <section className="rz-replay-card" aria-live="off">
      <div className="rz-replay-head"><div><p className="rz-kicker">DAG {session.before.day} · {label}</p><h2>{headline}</h2></div><time className="rz-replay-clock">{clock}</time></div>
      <div className="rz-replay-track" aria-hidden="true"><span key={step} style={{ animationDuration: `${step < 0 ? 1100 : step === 0 ? 850 : step === 1 ? 450 : 350}ms` }} /></div>
      <div className="rz-replay-feed">
        {lines.length ? lines.map((line, i) => <p key={`${step}-${i}`} className={`rz-replay-line rz-replay-${line.tone}`}>{line.title}</p>) : <p className="rz-replay-empty">{step < 0 ? 'Laget er ute. Utfallet vises etter operasjonene.' : 'Ingen større hendelser i denne delen av døgnet.'}</p>}
        {!!settled?.zoneChanges.length && <p className="rz-replay-zones">{settled.zoneChanges.length} {settled.zoneChanges.length === 1 ? 'sone endret status' : 'soner endret status'} på kartet</p>}
      </div>
      <div className="rz-replay-bottom"><span>Mat <b>{number(resources.food)}</b> · Vann <b>{number(resources.water)}</b></span><button className="rz-primary" onClick={onSkip} data-testid="skip-replay">Hopp over avspilling →</button></div>
    </section>
  </div>;
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
  const faction = state.factions.find(f => f.zoneId === zoneId && f.known && !f.defeated);
  const pois = index.poisByZone.get(zoneId) ?? [];
  const links = world.links.filter(l => l.a === zoneId || l.b === zoneId);
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
    actions.push({ action: 'rest' }, { action: 'heal' });
    if (state.hq?.zoneId === zoneId) {
      if (state.phase >= 2) actions.push({ action: 'research' });
      actions.push({ action: 'module', targets: hqModules(state).map(m => ({ id: m, name: `${moduleName(m)} (${costLabel(MODULE_COST[m]?.cost)})` })) });
      const recipes = craftRecipes(state);
      if (recipes.length) actions.push({ action: 'craft', targets: recipes.map(r => ({ id: r.id, name: r.name })) });
    }
    if (links.length) for (const a of ['hold', 'block', 'blow', 'repair'] as ActionId[]) actions.push({ action: a, targets: links.filter(l => a !== 'repair' || state.chokepoints[l.id] === 'blown').map(l => ({ id: l.id, name: `${l.name} (${chokeLabel(state.chokepoints[l.id])})` })) });
  }
  const here = Object.entries(state.wonders ?? {}).filter(([, w]) => w.zoneId === zoneId);
  const buildable = here.map(([id]) => ({ id, def: WONDERS.find(d => d.id === id)!, next: nextWonderLevel(state, id) })).filter(x => x.next);
  if (buildable.length) actions.unshift({ action: 'wonder', targets: buildable.map(x => ({ id: x.id, name: `${x.def.name}: ${x.next!.name} (${costLabel(x.next!.cost)})` })) });
  const barricaded = (index.adjacent.get(zoneId) ?? []).filter(a => state.barricades[a.connId] > 0);
  return <div className="rz-zone">
    <p className="rz-kicker">{l1?.name} · {l2?.name}</p>
    <h1>{zone.name}</h1>
    <p className="rz-tags"><span className={`rz-status rz-${z.status}`}>{faction ? faction.name : STATUS_LABEL[z.status]}</span>
      <span>{CONTENT.zoneTypes.find(t => t[0] === zone.type)?.[1] ?? 'Ukjent type'}</span>
      {zoneId === state.homeZoneId && <span>★ Leiren</span>}
      {hops !== undefined ? <span>{hops ? `${hops} steg fra leiren` : 'Leirens sone'}</span> : <span>Utenfor leirens nærområde</span>}</p>
    {here.map(([id, w]) => { const def = WONDERS.find(d => d.id === id)!; return <div key={id} className="rz-wonder-card"><Art path={`wonders/${id}`} className="rz-art rz-art-wide" /><b>✦ {def.name}</b><small>{wonderOperational(w) ? `${def.levels[w.level].name}: ${def.levels[w.level].text}` : `Kjent anlegg · ${wonderStatus(w) === 'secured' ? 'undersøkt og sikret, grunnfunksjon gjenstår' : 'krever undersøkelse og sikring'}`}</small></div>; })}
    {state.hq?.zoneId === zoneId && <Art path={`hq/${state.hq.type}`} className="rz-art rz-art-wide" />}
    {owned && flow && <div className="rz-net">
      <div><b className={flow.net >= 0 ? 'rz-good' : 'rz-errors'}>{signed(flow.net)}</b><span>mat/dag i sonen</span></div>
      {l2 && <div><b className={areaNet(state, world, flows, l2.id) >= 0 ? 'rz-good' : 'rz-errors'}>{signed(areaNet(state, world, flows, l2.id))}</b><span>{l2.name}</span></div>}
      {l1 && <div><b className={areaNet(state, world, flows, l1.id) >= 0 ? 'rz-good' : 'rz-errors'}>{signed(areaNet(state, world, flows, l1.id))}</b><span>{l1.name}</span></div>}
      <small>Produksjon {decimal(flow.food)} mat og {decimal(flow.water)} vann, patruljer koster {decimal(flow.upkeep)} mat. {flow.upkeep > flow.food ? 'Sonen koster mer enn den gir, men kan være viktig for å holde grensen.' : ''}</small>
    </div>}
    <dl className="rz-facts">
      <dt>Zombier</dt><dd>{faction ? 'Ingen. Gruppen holder sonen.' : z.intel ? `${z.intel.min}–${z.intel.max}${z.intel.day < state.day ? ` (dag ${z.intel.day})` : ''}` : 'Ukjent'}</dd>
      {!owned && !faction && <><dt>Før overtakelse</dt><dd>Fersk speiding, høyst {R.claimMaxZombies} zombier{(zone.measures?.homes ?? 0) >= 5 ? ` og minst ${Math.round(R.claimMinSearched * 100)} % gjennomsøkt` : ''}.</dd></>}
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
      {known && pois.filter(p => p.role && p.role !== 'resource').length > 0 && <><dt>Steder</dt><dd>{pois.filter(p => p.role && p.role !== 'resource').map(p => p.hqType && !state.hq ? `${p.name} (mulig HQ: ${CONTENT.hqTypes.find(t => t.id === p.hqType)?.name})` : p.name).join(', ')}</dd></>}
      {links.length > 0 && <><dt>Bru og tunnel</dt><dd>{links.map(l => `${l.name}: ${chokeLabel(state.chokepoints[l.id])}`).join(', ')}</dd></>}
    </dl>
    {faction && <p className="rz-small">{faction.about} {faction.known ? `Forhold ${faction.relation}. Styrke om lag ${Math.round(faction.strength ?? 30)}.` : 'Speid for å få kontakt.'}{faction.revealed ? ' Dere vet hva de egentlig vil.' : ''}{faction.hostile ? ' De er fiender.' : ''}</p>}
    <h2>Oppdrag {crew.length ? <small>{crew.length} valgt</small> : <small>velg folk under Mannskap først</small>}</h2>
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
      {action === 'establishHq' && zoneId !== state.homeZoneId && <small className="rz-errors">HQ flytter leiren hit. Utstyr på gamle depoter og lag som er ute følger ikke automatisk med. Velg nåværende leirsted hvis du vil beholde tilgangen der.</small>}
      {targets && <select aria-label={`Velg for ${ACTIONS[action].label}`} value={target} onChange={e => setTarget(e.target.value)}>{targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}
      {preview && <small className={preview.valid ? 'rz-preview' : 'rz-errors'}>{preview.valid ? `${preview.text} ${preview.hours} timer. Risiko: ${preview.risk}.${Object.keys(preview.costs).length ? ` Koster ${costLabel(preview.costs)}.` : ''}` : preview.errors.join(' ')}</small>}
    </div>
    <button aria-label={`Planlegg ${ACTIONS[action].label}`} disabled={!preview?.valid} onClick={() => onOrder(action, target)}>Planlegg</button>
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
      {p.id === 1 && state.phase === 1 ? <PhaseOneGoals world={world} state={state} />
        : p.id >= state.phase && <ul>{p.goals.map(g => <li key={g.id} className={p.id === state.phase && goalMet(state, world, g.id) ? 'done' : ''}>{p.id === state.phase && goalMet(state, world, g.id) ? '✓ ' : ''}{g.text}</li>)}</ul>}
    </li>)}</ol>
    {state.mutations.length > 0 && <><h3>Zombiene</h3><ul>{state.mutations.map(m => <li key={m.id}>{m.known ? `${MUTATIONS.find(x => x.id === m.id)?.name}: ${MUTATIONS.find(x => x.id === m.id)?.text}` : 'Ukjent mutasjon. Forsk på zombiestudier.'}</li>)}</ul></>}
    <h3>Milepæler</h3><ol className="rz-goals">{MILESTONES.map(m => <li key={m.id} className={state.milestones.includes(m.id) ? 'done' : ''}><b>{m.title}</b> {m.text}</li>)}</ol>
    <p className="rz-small">Seier i fase 5: 30 dager på rad med mat nok, håp over 50 og uro under 50, en kur fra vaksineforsøket, eller alle gruppene i regionen som venner.</p></>;
}

/** Visible, honest capacity feedback from the same engine rules as the phase transition. */
function PhaseOneGoals({ world, state }: { world: RegionWorld; state: RegionState }) {
  const capacity = phaseOneReadiness(state, world);
  const supplyText = (days: number | null) => days === null ? 'balanse i pluss' : `${decimal(Math.max(0, days))} døgn`;
  const coreText = !capacity.hasHQ ? 'Etabler HQ for å måle kontrollen rundt det.'
    : capacity.fullL2 ? 'Hele HQ-området (L2) er sikret og sammenhengende.'
      : `${capacity.connectedL3} av ${capacity.requiredL3} nødvendige L3-soner er sammenhengende med HQ.`;
  const defenseText = capacity.fullL2 ? 'Hele HQ-området er sikret.'
    : capacity.fortifiedBorders ? `${capacity.fortifiedBorders} holdbare sperringer mot ukontrollert område.`
      : capacity.permanentDefence ? 'Varig vaktpost eller HQ-forsvar er etablert.'
        : 'Bygg sperring, vaktpost eller fast HQ-forsvar.';
  const checks = [
    { title: 'Hovedkvarter', done: capacity.hasHQ, detail: capacity.hasHQ ? 'Operativt HQ i en kontrollert sone.' : 'Etabler HQ i en sone dere eier.' },
    { title: 'Sammenhengende område', done: capacity.coreReady, detail: coreText },
    { title: 'Varig forsvar', done: capacity.defenceReady, detail: defenseText },
    { title: 'Mat og vann', done: capacity.suppliesReady,
      detail: `Mat: ${supplyText(capacity.foodDays)}${capacity.foodReady ? ' ✓' : ''} · vann: ${supplyText(capacity.waterDays)}${capacity.waterReady ? ' ✓' : ''}. Krav: ${PHASE_ONE_CAPACITY.supplyDays} døgn.` },
  ];
  return <div className="rz-phase-one">
    <p className="rz-small">Når dere har en trygg kjerne og forsyninger, kan dere gå videre til fase 2. Hele L2 er en større prestasjon, ikke et absolutt krav.</p>
    <ul className="rz-phase-one-checklist">{checks.map(item => <li key={item.title} className={item.done ? 'done' : 'pending'}>
      <span className="rz-phase-one-symbol" aria-hidden="true">{item.done ? '✓' : '○'}</span>
      <div><strong>{item.title}</strong><small>{item.detail}</small></div>
      <span className="rz-phase-one-state">{item.done ? 'Klart' : 'Mangler'}</span>
    </li>)}</ul>
    {capacity.ready && <p className="rz-phase-one-ready">Kriteriene er oppfylt. Neste fullførte døgn kan åpne fase 2.</p>}
  </div>;
}

/** Visual priority is derived from events the engine actually reported, never inferred outcomes. */
function reportPriority(line: RegionReport['lines'][number], phase: number): number {
  const title = line.title.toLocaleLowerCase('nb-NO');
  let score = { bad: 400, warn: 260, good: 110, info: 25 }[line.tone];
  if (line.text.startsWith('Dere valgte: ')) score += 300;
  if (/død|døde|tapt|mistet|brøt sammen|snudde i natt|kom ikke hjem/.test(title)) score += 180;
  if (/angrep|sult|tørst|bitt|fiender|kom inn|mislyktes/.test(title)) score += 120;
  if (/fase|milepæl|hq etablert|er deres|er slått/.test(title)) score += 100;
  if (/ble med|nye i leiren|er ferdig|kontakt med/.test(title)) score += 65;
  if (/speidet|^søk i |zombier drept|ryddelaget/.test(title)) score += phase <= 2 ? 65 : -25;
  return score;
}

function resourceOutlook(days: number | null, net: number) {
  if (net >= 0) return { text: 'Dekker forbruket per dag', risk: 'stable' } as const;
  if (days === null || !Number.isFinite(days)) return { text: 'Fallende lager', risk: 'watch' } as const;
  if (days < 3) return { text: `Kritisk · ca. ${decimal(Math.max(0, days))} døgn igjen`, risk: 'critical' } as const;
  if (days < 7) return { text: `Lav beholdning · ca. ${decimal(days)} døgn igjen`, risk: 'watch' } as const;
  return { text: `Ca. ${decimal(days)} døgn igjen`, risk: 'stable' } as const;
}

function ReportView({ report, state, flows, onZone }: { report: RegionReport; state: RegionState; flows: Flows; onZone: (id: string) => void }) {
  const resolvedTitles = new Set(report.lines.filter(line => line.text.startsWith('Dere valgte: ')).map(line => line.title));
  const visibleLines = report.lines.filter(line => line.text !== 'En hendelse krever et valg.' || !resolvedTitles.has(line.title));
  const ranked = visibleLines.map((line, index) => ({ line, index, priority: reportPriority(line, state.phase) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index);
  const main = ranked[0]?.line;
  const secondary = ranked.slice(1);
  const food = resourceOutlook(flows.food.daysLeft, flows.food.net);
  const water = resourceOutlook(flows.water.daysLeft, flows.water.net);

  return <div className="rz-daily-report">
    <section className={`rz-report-hero rz-report-hero-${main?.tone ?? 'info'}`} aria-label="Dagens viktigste hendelse">
      <Art path={`report/${main?.tone === 'bad' || main?.tone === 'warn' ? 'danger' : main?.tone === 'good' ? 'success' : 'quiet'}`} className="rz-art rz-report-art" />
      <p className="rz-kicker">DAGSRAPPORT · DAG {report.day} · VIKTIGST</p>
      <h2>{main?.title ?? 'Dagen er over'}</h2>
      <p>{main?.text ?? 'Ingen spesielle hendelser er rapportert.'}</p>
      {main?.zoneId && <button className="rz-link rz-report-zone" onClick={() => onZone(main.zoneId!)}>Vis sone på kartet →</button>}
    </section>

    <section aria-label="Mat og vann" className="rz-report-resources">
      <div className={`rz-report-resource rz-report-resource-${food.risk}`}>
        <div className="rz-report-resource-top"><span>Mat · lager nå</span><b>{number(state.stock.food ?? 0)}</b></div>
        <strong>{food.text}</strong>
        <small>Dag {report.day}: +{number(report.food.produced)} produsert · −{number(report.food.eaten)} spist{report.food.spoiled ? ` · −${number(report.food.spoiled)} svinn` : ''}</small>
      </div>
      <div className={`rz-report-resource rz-report-resource-${water.risk}`}>
        <div className="rz-report-resource-top"><span>Vann · lager nå</span><b>{number(state.stock.water ?? 0)}</b></div>
        <strong>{water.text}</strong>
        <small>Dag {report.day}: +{number(report.water.produced)} hentet · −{number(report.water.drunk)} drukket</small>
      </div>
    </section>
    <p className="rz-report-footnote">Lager og prognose er fra nåværende spillstatus. Dagstallene viser registrert produksjon og forbruk, ikke full lagerendring.</p>
    <div className="rz-report-activity" aria-label="Zombier denne dagen"><span><b>{number(report.killed)}</b> zombier drept</span><span><b>{number(report.zombiesMoved)}</b> zombier flyttet seg</span></div>
    {secondary.length > 0 && <section aria-label="Øvrige hendelser" className="rz-report-secondary">
      <h3>Øvrige hendelser <small>{secondary.length}</small></h3>
      <ul className="rz-report">{secondary.map(({ line, index }) => <li key={index} className={`rz-${line.tone}`}>
        <div><b>{line.title}</b><p>{line.text}</p></div>
        {line.zoneId && <button className="rz-link" aria-label={`Vis sone for ${line.title}`} onClick={() => onZone(line.zoneId!)}>Vis sone →</button>}
      </li>)}</ul>
    </section>}
  </div>;
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

function AreaPanel({ world, state, areaId, onZone }: { world: RegionWorld; state: RegionState; areaId: string; onZone: (id: string) => void }) {
  const area = world.zones.find(z => z.id === areaId);
  const leaves = areaLeaves(world, areaId);
  const own = leaves.filter(z => state.zones[z.id]?.status === 'controlled');
  const known = leaves.filter(z => state.zones[z.id]?.status !== 'unknown');
  const intel = known.flatMap(z => state.zones[z.id]?.intel ? [state.zones[z.id].intel!] : []);
  return <section className="rz-area-panel"><p className="rz-kicker">L{area?.level} · OMRÅDE</p><h2>{area?.name}</h2>
    <p><b>{own.length} av {leaves.length}</b> lokale soner kontrollert. {known.length} kjent.</p>
    <p className="rz-small">Kontroll gjelder hver lokale sone. En delvis sikret region er fortsatt delvis sikret.</p>
    {!!intel.length && <p>Sist rapportert: {number(intel.reduce((n, z) => n + z.min, 0))}–{number(intel.reduce((n, z) => n + z.max, 0))} zombier i {intel.length} soner med etterretning. Ukjente områder er ikke medregnet.</p>}
    <h3>Lokale soner</h3><div className="rz-area-zones">{leaves.map(z => <button key={z.id} onClick={() => onZone(z.id)}><strong>{z.name}</strong><span>{STATUS_LABEL[state.zones[z.id]?.status ?? 'unknown']} →</span></button>)}</div>
  </section>;
}

// ------------------------------------------------------------------ map

function RegionMap({ focus, world, state, flows, overlay, selected, hops, replayMoves, onSelect, onOverlay }: { focus: { zoneId: string; key: number } | null; world: RegionWorld; state: RegionState; flows: Flows; overlay: 'zombies' | 'food'; selected: string; hops: Map<string, number>; replayMoves?: { from: string; to: string; n: number }[]; onSelect: (id: string) => void; onOverlay: (o: 'zombies' | 'food') => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const markersRef = useRef<{ remove: () => void }[]>([]);
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
          'fill-opacity': ['match', ['coalesce', ['feature-state', 's'], 'unknown'], 'unknown', ['case', ['boolean', ['feature-state', 'reach'], false], .5, .72], 'controlled', .16, 'scouted', .22, .3] } });
        map!.addLayer({ id: 'heat', type: 'heatmap', source: 'heat', maxzoom: 16, paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 0, 0, 300, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, .6, 15, 1.4],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 12, 13, 40, 16, 90],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', .2, 'rgba(120,20,20,.25)', .5, 'rgba(200,50,30,.45)', 1, 'rgba(255,120,60,.6)'],
          'heatmap-opacity': .9 } });
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
        map!.addLayer({ id: 'l2-line', type: 'line', source: 'l2', paint: { 'line-color': '#d9d2b0', 'line-width': 1, 'line-opacity': .3 } });
        map!.addLayer({ id: 'l1-line', type: 'line', source: 'l1', paint: { 'line-color': '#f2e2a0', 'line-width': 2, 'line-opacity': .4, 'line-dasharray': [4, 2] } });
        map!.addLayer({ id: 'links', type: 'line', source: 'links', paint: {
          'line-color': ['match', ['coalesce', ['feature-state', 'c'], 'open'], 'blown', '#e05a4a', 'flooded', '#4a8ee0', 'blocked', '#e0a64a', 'held', '#6fd08a', '#e8e1c4'],
          'line-width': 3, 'line-dasharray': [2, 1.5] } });
        map!.addLayer({ id: 'moves', type: 'line', source: 'moves', minzoom: 12, paint: {
          'line-color': COLORS.zombie, 'line-width': ['interpolate', ['linear'], ['get', 'n'], 1, 1.5, 30, 6], 'line-opacity': .8, 'line-dasharray': [0, 2, 2] }, layout: { 'line-cap': 'round' } });
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
        operationsRef.current = attachOperationalMap(map!, lib, world, stateRef.current, id => onSelectRef.current(id), setLevel);
        mapRef.current = map;
        setReady(true);
      });
    });
    return () => { cancelled = true; operationsRef.current?.destroy(); operationsRef.current = null; markersRef.current.forEach(m => m.remove()); captureRef.current?.destroy(); captureRef.current = null; previousZonesRef.current = undefined; map?.remove(); mapRef.current = null; };
    // The map is created once; state is pushed through feature-state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !ready || !lib) return;
    operationsRef.current?.update(state);
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
    map.setPaintProperty('heat', 'heatmap-opacity', overlay === 'food' ? 0 : .9);
    const moves = (replayMoves ?? state.reports.at(-1)?.moves ?? []).filter(m => index.byId.get(m.from)?.at && index.byId.get(m.to)?.at).map(m => ({ type: 'Feature' as const, properties: { n: m.n }, geometry: { type: 'LineString' as const, coordinates: [index.byId.get(m.from)!.at!, index.byId.get(m.to)!.at!] } }));
    (map.getSource('moves') as GeoJSONSource).setData({ type: 'FeatureCollection', features: moves });
    // Markers: home, HQ candidates you have seen, wonders, groups you know.
    markersRef.current.forEach(m => m.remove());
    const add = (at: [number, number] | undefined, kind: Parameters<typeof markerElement>[0], title: string) => { if (at) markersRef.current.push(new lib.Marker({ element: markerElement(kind, title) }).setLngLat(at).addTo(map)); };
    markersRef.current = [];
    for (const p of world.pois.filter(p => p.role === 'hq' && state.zones[p.zoneId]?.status !== 'unknown' && !state.factions.some(f => f.zoneId === p.zoneId && !f.defeated))) add(p.at, 'hq', `${p.name}: mulig HQ (${CONTENT.hqTypes.find(t => t.id === p.hqType)?.name ?? ''})`);
    for (const d of WONDERS) { const zid = state.wonders?.[d.id]?.zoneId ?? (d.found === 'claim' ? wonderZone(world, d) : undefined); if (zid && (state.wonders?.[d.id] || state.zones[zid]?.status !== 'unknown')) add(index.byId.get(zid)?.at, 'wonder', `${d.name}${state.wonders?.[d.id] ? wonderOperational(state.wonders[d.id]) ? ' (operativt)' : ' (kjent, krever anleggsoppdrag)' : ''}`); }
    for (const f of state.factions.filter(f => f.known && !f.defeated && state.zones[f.zoneId]?.status !== 'controlled')) add(index.byId.get(f.zoneId)?.at, f.hostile ? 'enemy' : 'faction', f.name);
    add(index.byId.get(state.homeZoneId)?.at, 'home', 'Leiren');
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
    for (const n of [1, 2, 3]) map.setFilter(`l${n}-selected`, ['==', ['get', 'id'], selected]);
  }, [selected, ready]);
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
