'use client';

/** Stavanger Z, the region game: the whole Stavanger region from the zone editor, one day at a time. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ACTIONS, BRANCHES, HQ_BRANCH, LAW_GROUPS, LAWS, MILESTONES, MODULE_COST, MUTATIONS, NETWORK_COST, PHASES, PHASE_ONE_CAPACITY, R, SAVE_KEY_REGION, TECHS, TRAIT_NAMES, UPGRADE_COST, VALUE, WEAPONS, WORK_IDS, WORK_NAMES,
  areaNet, assaultOdds, assigned, autoWork, bestTier, controlled, craftRecipes, crewGearAway, dailyFlows, equippedGear, gearWeapon, dateText, discontentTarget, goalMet, hopeTarget, hqModules, indexWorld, lawAvailable, lawWait, living,
  moduleName, newRegionGame, passLaw, phaseDef, phaseOneReadiness, prepareGearPlan, previewOrder, reach, repealLaw, resolveEvent, resourceName, searchHoursTotal, season, setWork, shelter, specialBranch, startDanger,
  startRegionDay, continueRegionDay, pendingTurnDecision, startResearch, techBlocked, techCost, totalPeople, trade, tradeValue, upgradeName, upgradesFor, workforce, WONDERS, wonderZone, nextWonderLevel,
  type ActionId, type Branch, type Flows, type RegionOrder, type RegionReport, type RegionState, type RegionWorld, type WorkId,
} from '../../../packages/gameplay/src/region/index';
import { CONTENT } from '../../../packages/world-data/src/content';
import ZaBook from './za-book';
import StartScreen from './start-screen';
import { CampaignLibrary } from './campaign-library';
import { CampaignProgress, CampaignAchievements } from './campaign-progress';
import PerformanceBenchmark from './performance-benchmark';
import { actionForKeyboardEvent, displayShortcut, type ShortcutAction } from './shortcut-bindings';
import CrewEquipment, { GearInventory, OrderGearSummary, equipmentDraftOrders } from './crew-equipment';
import { attachTerritoryCaptureEffects, territoryShifts, type TerritoryCaptureController } from './territory-capture-effects';
import { CampaignModeInfo, CampaignHelp, CampaignEndingView } from './campaign-controls';
import { advanceCampaignCommit, campaignAvatarStatus, chooseCampaignAvatar } from '../../../packages/gameplay/src/region/campaign';
import { loadRegionSave, saveRegionState, clearRegionSave } from './region-save';
import { attachOperationalMap, areaLeaves, type OperationalMapController } from './operational-map';
import { AdministrativeView } from './administrative-view';
import { applyAdministrationCommand, administrations } from '../../../packages/gameplay/src/region/administration';
import { PoiJournal, DiscoveryZonePanel } from './poi-journal';
import { usePinnedInfo, PinChooser, PinnedCards } from './pinned-info';
import { WondersOperations } from './wonders-operations';
import { wonderOperational, wonderStatus } from '../../../packages/gameplay/src/region/wonders';
import { MissionOptions, LogisticsPanel } from './mission-controls';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { redirectMission } from '../../../packages/gameplay/src/region/mobility';
import RegionWorldMap from './region-world-map';
import { HudIcon, type HudIconName } from './hud-icons';
import { CrewContext, ZoneContext, TodayBrief, TaskPalette, actionIcon } from './hud-context';
import { CrewDock, TerritoryOverview, ResourceFocus, DailyResourceFlow } from './command-overview';
import { InventoryShelf } from './inventory-shelf';
import { DailyReport } from './daily-report';
import { CommunityWork } from './community-work';
import './territory-hud.css';
import { CrewProfile } from './crew-profile';
import { PoiProfile } from './poi-profile';
import { HQManagement } from './hq-management';
import { OrderComposer } from './order-composer';
import { DayPlan } from './day-plan';
import './region.css';
import './situational-hud.css';
import './game-identity.css';
import './player-controls.css';
import { GameSettings, useGamePreferences } from './game-settings';
import { useGameAudio, type GameSound } from './game-audio';
import './usability.css';
import './game-presentation.css';
import './expedition-presentation.css';
import './detail-presentation.css';
import './item-art.css';

const HUD_SHORTCUT_ACTIONS:Record<string,ShortcutAction>={crew:'crew',book:'book',settings:'settings',hq:'hq'};
const shortcutAria = (code: string) => code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code;
function reportSound(report:RegionReport):GameSound {
  if(report.lines.some(line=>line.tone==='bad'))return 'event';
  if(report.replay?.some(stage=>stage.zoneChanges.some(change=>change.before!=='controlled'&&change.after==='controlled')))return 'claim';
  if(report.lines.some(line=>line.tone==='good'&&(line.category==='discovery'||/^(Personlig utstyr funnet|HQ etablert:)/.test(line.title))))return 'discovery';
  return report.killed>0?'combat':'day';
}
const WORLD_URL = '/world/region-v1.json';
const CORE = ['medicine', 'fuel', 'ammo', 'building'];
const STATUS_LABEL = { unknown: 'Ukjent', scouted: 'Speidet', controlled: 'Deres' } as const;
const number = (n: number) => Math.round(n).toLocaleString('nb-NO');
const decimal = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${decimal(Math.abs(Math.round(n * 10) / 10))}`;

type Modal = null | 'report' | 'trade' | 'goals' | 'menu' | 'stock' | 'society' | 'research' | 'chronicle' | 'wonders' | 'book' | 'equipment' | 'discoveries' | 'administration' | 'attention' | 'crew-profile' | 'hq' | 'plan' | 'command' | 'poi' | 'community' | 'resources' | 'settings';
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
    const focusable = () => active ? [...active.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter(el => el.getClientRects().length > 0 && !el.closest('[inert]')) : [];
    const sync = () => {
      const native = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
      const scope = native ?? document;
      const next = [...scope.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].filter(el => el.getClientRects().length > 0 && !el.closest('[inert]')).at(-1) ?? native ?? null;
      if (next === active) return;
      if (!active && next) returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      active = next;
      if (active) {
        active.tabIndex = -1;
        (active.querySelector<HTMLElement>('[data-initial-focus]:not(:disabled), [autofocus]') ?? focusable()[0] ?? active).focus();
      } else if (returnTo?.isConnected && returnTo.getClientRects().length) returnTo.focus();
    };
    const trap = (event: KeyboardEvent) => {
      if (!active || event.key !== 'Tab' || active instanceof HTMLDialogElement) return; // The native top layer already traps its own focus.
      const candidates = focusable();
      const first = candidates[0] ?? active;
      const last = candidates.at(-1) ?? active;
      if (!active.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'inert', 'aria-hidden'] });
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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [playSession, setPlaySession] = useState(0);
  const acceptLoaded = (next: RegionState) => { setState(next); setSaved(next); setSaveError(''); setIntro(false); setPlaySession(value => value + 1); };
  const library = libraryOpen && <CampaignLibrary current={state ?? saved} onLoad={acceptLoaded} onClose={() => setLibraryOpen(false)}/>;
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
  if (!state) return <><StartScreen world={world} saved={saved} onLibrary={() => setLibraryOpen(true)} onStart={(s, fresh) => { try { acceptState(s, fresh); setSaved(s); setIntro(fresh); } catch { /* Error stays visible; the previous save is retained. */ } }} />{library}{saveError && <div className="rz-save-error" role="alert">{saveError}</div>}</>;
  return <>
    <Play key={playSession} world={world} state={state} setState={acceptState} onQuit={quit} onRestart={restart} onLibrary={() => setLibraryOpen(true)} />
    {library}
    {saveError && <div className="rz-save-error" role="alert">{saveError}</div>}
    {intro && <Intro world={world} state={state} onDone={() => setIntro(false)} />}
  </>;
}

// ------------------------------------------------------------------ start

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

function Play({ world, state: committedState, setState, onQuit, onRestart, onLibrary }: { world: RegionWorld; state: RegionState; setState: (s: RegionState) => void; onQuit: () => void; onRestart: () => void; onLibrary: () => void }) {
  const {preferences,updatePreferences} = useGamePreferences();
  const inputModality=useRef<'pointer'|'keyboard'>('pointer');
  const shortcutKeyDown=useRef<string | null>(null);
  useEffect(()=>{
    const pointer=()=>{inputModality.current='pointer';};
    const keyDown=(event:KeyboardEvent)=>{if(event.key==='Tab')inputModality.current='keyboard';if(event.code===shortcutKeyDown.current&&event.repeat)event.preventDefault();};
    const keyUp=(event:KeyboardEvent)=>{if(event.code===shortcutKeyDown.current){shortcutKeyDown.current=null;event.preventDefault();event.stopPropagation();}};
    const blur=()=>{shortcutKeyDown.current=null;};
    window.addEventListener('pointerdown',pointer,true);window.addEventListener('keydown',keyDown,true);window.addEventListener('keyup',keyUp,true);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('pointerdown',pointer,true);window.removeEventListener('keydown',keyDown,true);window.removeEventListener('keyup',keyUp,true);window.removeEventListener('blur',blur);};
  },[]);
  const [replay, setReplay] = useState<DayReplaySession | null>(null);
  const [replayStep, setReplayStep] = useState(-1);
  const audibleState = replay?.before ?? committedState;
  const knownHarbor = audibleState.zones[audibleState.homeZoneId]?.status !== 'unknown' && world.pois.some(poi => poi.zoneId === audibleState.homeZoneId && poi.siteType === 'marina');
  const playSound = useGameAudio(preferences, replay && replayStep === 0 ? 'night' : knownHarbor ? 'harbor' : 'camp');
  const previousEnding = useRef(committedState.gameOver);
  useEffect(() => {
    if (replay) return;
    if (!previousEnding.current && committedState.gameOver) playSound(committedState.gameOver.won ? 'victory' : 'defeat');
    previousEnding.current = committedState.gameOver;
  }, [committedState.gameOver, playSound, replay]);
  const binding = (action: ShortcutAction) => preferences.shortcutBindings[action];
  const shortcutLabel = (action: ShortcutAction) => displayShortcut(binding(action));
  const [reportAfterEvent, setReportAfterEvent] = useState<RegionReport | null>(null);
  // Save the authoritative result immediately, but do not render any of its
  // information until the journal reaches that point in the day.
  const state = replay?.before ?? committedState;
  const index = indexWorld(world);
  const pinned = usePinnedInfo(committedState);
  const [selected, setSelected] = useState(state.homeZoneId);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [mapSelectionTouched, setMapSelectionTouched] = useState(false);
  const [crew, setCrew] = useState<string[]>([]);
  const [orders, setOrders] = useState<RegionOrder[]>([]);
  const [equipmentDraft, setEquipmentDraft] = useState<RegionOrder | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [hqTab,setHqTab]=useState<'overview'|'construction'|'society'|'research'|'stock'>('overview');
  const [bookTopic, setBookTopic] = useState<string | undefined>();
  const [bookReturn, setBookReturn] = useState<Modal>(null);
  const openHelp=(topic:string)=>{setBookReturn(modal);setBookTopic(topic.startsWith('resource:')?'supplies':topic);setModal('book');};
  const closeModal=()=>{if(modal==='book'&&bookReturn){setModal(bookReturn);setBookReturn(null);}else setModal(null);};
  const [report, setReport] = useState<RegionReport | null>(null);
  const [message, setMessage] = useState('');
  const [drawer, setDrawer] = useState<'crew' | 'zone' | 'poi' | null>(null);
  const [personId, setPersonId] = useState(state.survivors[0]?.id ?? '');
  const [poiId, setPoiId] = useState('');
  const [zoneTab, setZoneTab] = useState<'overview' | 'places' | 'develop' | 'logistics'>('overview');
  const [commandDraft, setCommandDraft] = useState<RegionOrder | null>(null);
  const [targeting, setTargeting] = useState(false);
  const [briefHidden, setBriefHidden] = useState(false);
  const [guide, setGuide] = useState(true);
  const [zoneQuery, setZoneQuery] = useState('');
  const [plannedSupply, setPlannedSupply] = useState<{ zoneId: string; cargo: Record<string, number> } | null>(null);
  const zonePanelRef = useRef<HTMLElement>(null);
  useEffect(() => { zonePanelRef.current?.scrollTo({ top: 0 }); }, [selected, selectedArea]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [mapFocus, setMapFocus] = useState<{ zoneId: string; key: number; scope?: 'territory' } | null>(null);
  const [overlay, setOverlay] = useState<'territory' | 'zombies' | 'food'>('territory');
  const [territoryList, setTerritoryList] = useState(false);
  const [stockResource, setStockResource] = useState<string | null>(null);
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
    const snapshot = replay.report.replay?.[replayStep]?.mapSnapshot;
    if (snapshot) {
      const zones = Object.fromEntries(Object.entries(replay.before.zones).map(([id, z]) => [id, { ...z, intel: undefined, owner: undefined, ...(snapshot.zones[id] ?? { status: 'unknown' as const }) }]));
      const factions = replay.before.factions.map(f => ({ ...f, known: snapshot.zones[f.zoneId]?.owner === f.id }));
      return { ...replay.before, zones, factions, homeZoneId: snapshot.homeZoneId, crewPositions: snapshot.crewPositions, crewMissions: snapshot.crewMissions };
    }
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
    if (replay.pendingEvent) {playSound('event');setReportAfterEvent(replay.report);setModal(null);}
    else {playSound(reportSound(replay.report));setModal('report');}
  };
  useEffect(()=>{if(replay&&replayStep===0)playSound('night');},[replay?.report.day,replayStep,playSound]);
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
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { closeModal(); setConfirmEnd(false); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal, confirmEnd, bookReturn]);
  useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key!=='Escape'||replay||committedState.event||committedState.turnCheckpoint)return;if(targeting){setTargeting(false);setModal(commandDraft?'command':null);}else if(!modal)setDrawer(null);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[targeting,modal,replay,committedState.event,committedState.turnCheckpoint,commandDraft]);
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

  const commandId = (action: ActionId, zoneId: string, ids: string[], target?: string) => `o${state.day}-${action}-${zoneId}-${ids.join('.')}${target ? `-${target}` : ''}`;
  const taskTargets = (action: ActionId, zid: string): { id: string; label: string }[] => {
    if (action === 'build') return upgradesFor(state, world, zid).map(u => ({ id: u.id, label: u.name }));
    if (action === 'module') return hqModules(state).map(id => ({ id, label: moduleName(id) }));
    if (action === 'network') return CONTENT.networks.filter(n => !(state.networks[index.byId.get(zid)?.parentId ?? ''] ?? []).includes(n.id)).map(n => ({ id: n.id, label: n.name }));
    if (action === 'craft') return craftRecipes(state).map(r => ({ id: r.id, label: r.name }));
    if (action === 'establishHq') return (index.poisByZone.get(zid) ?? []).filter(p => p.role === 'hq').map(p => ({ id: p.id, label: p.name }));
    if (action === 'wonder') return Object.entries(state.wonders ?? {}).filter(([id,w]) => w.zoneId === zid && nextWonderLevel(state,id)).map(([id]) => ({ id, label: WONDERS.find(d=>d.id===id)?.name ?? id }));
    if (['hold','block','blow','repair'].includes(action)) return world.links.filter(l => l.a === zid || l.b === zid).map(l => ({ id: l.id, label: l.name }));
    return [];
  };
  const addOrder = (action: ActionId, target?: string, zoneId = selected, custom?: RegionOrder) => {
    const zid = action === 'return' ? state.homeZoneId : zoneId;
    const actualTarget = target ?? taskTargets(action, zid)[0]?.id;
    const draft: RegionOrder = custom ? structuredClone(custom) : { id: commandId(action,zid,crew,actualTarget), action, zoneId: zid, survivorIds: [...crew], target: actualTarget };
    setCommandDraft(draft); setTargeting(false); setModal('command');
  };
  const queueCommand = (input: RegionOrder) => {
    const order = { ...input, id: orders.some(o=>o.id===input.id) ? input.id : commandId(input.action,input.zoneId,input.survivorIds,input.target) };
    const preview = previewOrder(state, world, order);
    const next = orders.some(o=>o.id===order.id) ? orders.map(o=>o.id===order.id?order:o) : [...orders,order];
    const plan = prepareGearPlan(state,world,next);
    const errors = [...preview.errors, ...(plan.orders.find(o=>o.orderId===order.id)?.errors ?? [])];
    if (errors.length) { setMessage([...new Set(errors)].join(' ')); return; }
    playSound('order');setOrders(next); setCrew([]); setCommandDraft(null); setTargeting(false); setModal(orders.some(o=>o.id===input.id)?'plan':null); setSelected(order.zoneId); setSelectedArea(null); setTerritoryList(false); setZoneTab('overview'); setDrawer(orders.some(o=>o.id===input.id)?null:'zone'); setMessage(`${ACTIONS[order.action].label} lagt i dagsplanen.`);
  };
  const openProfile = (id: string) => { setPersonId(id); setModal('crew-profile'); };
  const chooseCrewTask = (action: ActionId) => {
    const first = crewPositionFor(state,crew[0]);
    const zid = ['rest','heal'].includes(action) && first?.kind === 'zone' ? first.zoneId : action === 'return' ? state.homeZoneId : selected;
    const target = taskTargets(action,zid)[0]?.id;
    const draft = { id: commandId(action,zid,crew,target),action,zoneId:zid,survivorIds:[...crew],target };
    setCommandDraft(draft); setDrawer(null);
    if (['rest','heal','return'].includes(action)) { setTargeting(false); setModal('command'); }
    else { setTargeting(true); setModal(null); setMessage('Velg målsonen på kartet.'); }
  };
  const showCompletedDay = (before: RegionState, result: { state: RegionState; report: RegionReport }, skipReplay = false) => {
      setState(result.state); setOrders([]); setCrew([]); setReport(result.report);
      const stages = result.report.replay;
      if (!skipReplay && stages?.length === 3 && stages[0].phase === 'operations' && stages[1].phase === 'night' && stages[2].phase === 'new-day'
        && !preferences.reducedMotion) {
        playSound('day');setReplay({ before, report: result.report, pendingEvent: !!result.state.event });
        setReplayStep(-1);
        setModal(null);
      } else if (result.state.event) {
        playSound('event');setReportAfterEvent(result.report);
        setModal(null);
      } else {playSound(reportSound(result.report));setModal('report');}
  };
  const finishDay = () => {
    if (gearPlan.errors.length) { setMessage(gearPlan.errors.join(' ')); setDrawer('crew'); return; }
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
  useEffect(()=>{const key=(event:KeyboardEvent)=>{
    if(event.repeat||event.defaultPrevented||!preferences.keyboardShortcuts)return;
    const action=actionForKeyboardEvent(event,preferences.shortcutBindings);
    if(!action)return;
    const target=event.target instanceof Element?event.target:null;
    if(target?.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]')||replay||committedState.event||committedState.turnCheckpoint||state.gameOver||!activeAvatar||avatarNeedsSelection||showPhase||targeting)return;
    if(action==='endDay'&&(confirmEnd||modal==='plan')){
      // The opening press never confirms. Only a fresh press on the focused primary review action can proceed.
      const review=document.activeElement instanceof HTMLButtonElement&&document.activeElement.matches('[data-end-day-review]')?document.activeElement:null;
      if(!review||review.disabled)return;
      if(event.code==='Space')return; // Native Space activates this focused button on keyup.
      event.preventDefault();shortcutKeyDown.current=event.code;review.click();return;
    }
    if(document.querySelector('[role=dialog]')||modal||confirmEnd)return;
    if(event.code==='Space'&&inputModality.current==='keyboard'&&target?.closest('button,a,summary,[role=button]'))return;
    if(action==='endDay'){
      const interactive=target?.closest('button,a,summary,[role=button]');
      // Tab users retain native Space activation, while pointer-focused HUD buttons allow the global shortcut.
      if(event.code==='Space'&&interactive&&(inputModality.current==='keyboard'||!interactive.closest('.sz-top,.sz-nav,.sz-command-bar,.rz-map-tools')))return;
      event.preventDefault();shortcutKeyDown.current=event.code;if(orders.length)setModal('plan');else setConfirmEnd(true);return;
    }
    event.preventDefault();shortcutKeyDown.current=event.code;
    if(action==='crew')setDrawer(previous=>previous==='crew'?null:'crew');
    else if(action==='book'){setBookTopic(undefined);setBookReturn(null);setModal('book');}
    else if(action==='plan')setModal('plan');
    else if(action==='hq')setModal(state.hq?'hq':'community');
    else if(action==='settings')setModal('settings');
    else setMapFocus({zoneId:state.homeZoneId,key:Date.now()});
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[preferences.keyboardShortcuts,preferences.shortcutBindings,modal,confirmEnd,replay,committedState.event,committedState.turnCheckpoint,state.gameOver,state.homeZoneId,state.hq,activeAvatar,avatarNeedsSelection,showPhase,targeting,orders.length]);
  const selectZone = (id: string) => {
    setTerritoryList(false);
    setMapSelectionTouched(true);
    if (index.byId.get(id)?.level !== 3) { setSelectedArea(id); setDrawer('zone'); return; }
    setSelected(id); setSelectedArea(null);
    if (targeting && commandDraft) { const target = taskTargets(commandDraft.action,id)[0]?.id; setCommandDraft({...commandDraft,zoneId:id,target}); setTargeting(false); setModal('command'); setDrawer(null); }
    else setDrawer('zone');
  };
  const focusZone = (id: string) => { selectZone(id); setMapFocus({zoneId:id,key:Date.now()}); };
  const selectPoi = (id: string) => { const poi = world.pois.find(p=>p.id===id); if (!poi || state.zones[poi.zoneId]?.status === 'unknown') return; if (targeting && commandDraft) { setCommandDraft({...commandDraft,zoneId:poi.zoneId,target:commandDraft.action==='establishHq'?id:commandDraft.target}); setTargeting(false); setModal('command'); return; } setPoiId(id); setSelected(poi.zoneId); setSelectedArea(null); setDrawer('poi'); };
  const changeAreaLevel = (level:1|2|3) => { let current = index.byId.get(selected); while(current && current.level>level) current=index.byId.get(current.parentId??''); if(current && current.level===level) focusZone(current.id); };
  const freeCrew = people.filter(p => !busy.has(p.id) && !away(p.id));
  const regionalAlerts = administrations(state).flatMap(region => region.alerts.map(text => ({ text, zoneId: region.hqZoneId })));
  const urgent = flows.food.daysLeft !== null && flows.food.daysLeft < 3 ? 'Matlageret varer under tre døgn.' : flows.water.daysLeft !== null && flows.water.daysLeft < 3 ? 'Vannlageret varer under tre døgn.' : people.some(p => p.health < 45) ? 'Noen i mannskapet er alvorlig skadet.' : state.morale < 20 ? 'Håpet er kritisk lavt. Se Samfunn.' : state.discontent > 75 ? 'Uroen er kritisk høy. Se Samfunn.' : (state.stock.ammo ?? 0) < 1 && people.some(p => gearWeapon(state, p) !== 'melee') ? 'Tomt for ammunisjon. Skytevåpen kan ikke brukes.' : '';
  const attentionCount = (urgent ? 1 : 0) + regionalAlerts.length + people.filter(p => p.health < 45).length;
  const resourceCards: {id:string;icon:HudIconName;label:string;value:number;days?:number|null;net?:number}[] = [
    {id:'food',icon:'food',label:'Mat',value:state.stock.food??0,days:flows.food.daysLeft,net:flows.food.net},
    {id:'water',icon:'water',label:'Vann',value:state.stock.water??0,days:flows.water.daysLeft,net:flows.water.net},
    {id:'ammo',icon:'ammo',label:'Ammunisjon',value:state.stock.ammo??0},
    {id:'medicine',icon:'medicine',label:'Medisin',value:state.stock.medicine??0},
    ...(state.phase>=2?[{id:'building',icon:'building' as const,label:'Materialer',value:state.stock.building??0},{id:'people',icon:'people' as const,label:'Mennesker',value:totalPeople(state)}]:[]),
  ];
  const navItems: {id:string;icon:HudIconName;label:string;active:boolean;action:()=>void;count?:number}[] = [
    {id:'crew',icon:'crew',label:'Mannskap',active:drawer==='crew',action:()=>setDrawer(drawer==='crew'?null:'crew')},
    ...(state.population.adults+state.population.children+state.population.elderly>0?[{id:'community',icon:'work' as const,label:'Leiren',active:modal==='community',action:()=>setModal('community'),count:Math.max(0,workforce(state)-assigned(state))}]:[]),
    {id:'zone',icon:'zone',label:'Mine områder',active:drawer==='zone',action:()=>{setTerritoryList(true);setDrawer(drawer==='zone'?null:'zone');}},
    {id:'settings',icon:'settings',label:'Innstillinger',active:modal==='settings',action:()=>setModal('settings')},
    {id:'book',icon:'book',label:'ZA-boka',active:modal==='book',action:()=>{setBookTopic(undefined);setBookReturn(null);setModal('book');}},
    ...(state.hq?[{id:'hq',icon:'hq' as const,label:'Hovedkvarter',active:modal==='hq',action:()=>setModal('hq')}]:[]),
    ...(state.phase>=4?[{id:'regions',icon:'compass' as const,label:'Regioner',active:modal==='administration',action:()=>setModal('administration'),count:regionalAlerts.length}]:[]),
  ];
  const drawerTitle = drawer==='crew'?'Mannskap':drawer==='poi'?world.pois.find(p=>p.id===poiId)?.name:territoryList?'Ditt område':index.byId.get(selectedArea??selected)?.name;
  const stockView=stockResource?<><ResourceFocus state={state} world={world} orders={orders} resource={stockResource} onSearch={()=>addOrder('search',undefined,state.homeZoneId)} onWork={()=>setModal('community')}/><DailyResourceFlow flows={flows} resource={stockResource}/><button className="sz-wide-action" onClick={()=>setStockResource(null)}><HudIcon name="stock"/>Åpne ikonlageret<HudIcon name="arrow"/></button></>:<InventoryShelf state={state} world={world} plan={gearPlan} onHelp={openHelp}/>;
  const communityView=<CommunityWork state={state} world={world} onWork={allocation=>apply(()=>setWork(state,allocation),false,'work-allocation')} onAdvanced={()=>setModal('society')} onHelp={openHelp}/>;
  const ownedCount=Object.values(state.zones).filter(z=>z.status==='controlled').length;
  const fitTerritory=()=>{setOverlay('territory');setMapFocus({zoneId:state.homeZoneId,key:Date.now(),scope:'territory'});};
  const zoneContent = territoryList?<TerritoryOverview state={state} world={world} onZone={focusZone}/>:<ZoneContext key={selectedArea??selected} state={state} world={world} zoneId={selected} areaId={selectedArea} tab={zoneTab} onTab={setZoneTab} onLevel={changeAreaLevel} onZone={focusZone} onTask={action=>addOrder(action)} onPoi={selectPoi} onHq={()=>setModal('hq')} onHelp={openHelp}/>;
  return <main className={`rz-shell sz-game ${drawer?'has-drawer':''} ${targeting?'is-targeting':''} ${preferences.reducedMotion?'pref-reduced-motion':''} ${preferences.textScale==='large'?'pref-large-text':''}`}>
    <div className="sz-map-stage"><RegionWorldMap reducedMotion={preferences.reducedMotion} focus={mapFocus} world={world} state={mapState} flows={flows} overlay={replay?'zombies':overlay} selected={mapSelectionTouched?selectedArea??selected:''} hops={hops} replayMoves={replayMoves} onSelect={selectZone} onOverlay={setOverlay} onSelectPoi={selectPoi} onSelectCrew={id=>{const position=crewPositionFor(state,id);if(targeting&&position?.kind==='zone')selectZone(position.zoneId);else openProfile(id);}} targeting={targeting&&commandDraft?{action:commandDraft.action,crewIds:commandDraft.survivorIds}:undefined}/></div>
    <header className="sz-top" aria-label="Samfunnets status">
      <div className="sz-brand-group"><button className="sz-brand" onClick={()=>setModal('menu')} aria-label="Spillmeny"><span className="sz-brand-mark"><HudIcon name="compass" size={25}/></span><span>STAVANGER<em>Z</em></span></button><button className="sz-home-location" onClick={()=>setModal(state.hq?'hq':'community')}><HudIcon name="location" size={10}/><span>Leiren · {index.byId.get(state.homeZoneId)?.name}</span></button></div>
      <div className="sz-resources">{resourceCards.map(r=><button className={`sz-resource ${r.days!==undefined&&r.days!==null&&r.days<3?'is-critical':''}`} key={r.id} data-resource={r.id} onClick={()=>{if(r.id==='people'){setModal('community');return;}setStockResource(r.id);setModal('stock');}} aria-label={`${r.label}: ${number(r.value)}${r.days!==undefined?`, ${r.days===null?'dekker forbruket':Math.floor(r.days)+' døgn igjen'}`:''}`} title={`${r.label}${r.net!==undefined?' · '+signed(r.net)+' per døgn':''}`}><HudIcon name={r.icon} size={20}/><span><small className="sz-resource-name">{r.label}</small><strong>{number(r.value)}</strong></span>{r.net!==undefined&&<span className="sz-resource-rate"><b>{signed(r.net)}<small>/d</small></b><small>{r.days===null?'dekker forbruk':`${Math.floor(r.days??0)} døgn igjen`}</small></span>}</button>)}<button className="sz-resource-more" onClick={()=>setModal('resources')} aria-label="Alle ressurser"><HudIcon name="stock"/><span>Alle</span></button></div>
      <div className="sz-date"><strong>DAG {state.day}<small>07:00</small></strong><span>{dateText(state.day)} · {s.name}</span></div>
      <button className="sz-phase" onClick={()=>setModal('goals')}><span>FASE {state.phase}</span><strong>{phase.name}</strong><HudIcon name="chevron" size={15}/></button>
    </header>
    <nav className="sz-nav" aria-label="Kommandomeny">{navItems.map(item=><button key={item.id} data-testid={`nav-${item.id}`} aria-label={item.label} aria-pressed={item.active} aria-keyshortcuts={preferences.keyboardShortcuts&&HUD_SHORTCUT_ACTIONS[item.id]?shortcutAria(binding(HUD_SHORTCUT_ACTIONS[item.id])):undefined} title={preferences.keyboardShortcuts&&HUD_SHORTCUT_ACTIONS[item.id]?`${item.label} (${shortcutLabel(HUD_SHORTCUT_ACTIONS[item.id])})`:item.label} onClick={item.action}><HudIcon name={item.icon} size={23}/><span>{item.id==='hq'?'HQ':item.label}</span>{!!item.count&&<b>{item.count}</b>}</button>)}<i/><button aria-label="Dagsrapporter" title="Dagsrapporter" disabled={!state.reports.length} onClick={()=>{setReport(state.reports.at(-1)??null);setModal('report');}}><HudIcon name="report" size={22}/><span>Rapport</span></button><button aria-label="Flere oversikter" title="Flere oversikter" onClick={()=>setModal('menu')}><HudIcon name="settings" size={22}/><span>Mer</span></button></nav>
    {!targeting&&!drawer&&<button className="sz-territory-button" onClick={fitTerritory} aria-label={`Vis ditt område: ${ownedCount} soner`}><HudIcon name="claim" size={20}/><span><strong>{ownedCount?`${ownedCount} ${ownedCount===1?'sone':'soner'}`:'Ingen soner sikret'}</strong><small>{ownedCount?'Ditt område':'Leiren er ikke overtatt'}</small></span><HudIcon name="expand" size={16}/></button>}
    {!targeting&&<details className="sz-search rz-nearby"><summary><HudIcon name="search" size={17}/><span>Finn et sted</span></summary><div><label><span className="sz-sr-only">Søk etter sone</span><input aria-label="Søk etter sone" placeholder="Søk i Stavanger …" value={zoneQuery} onChange={e=>setZoneQuery(e.target.value)}/></label><button onClick={()=>focusZone(state.homeZoneId)}><HudIcon name="hq"/>{index.byId.get(state.homeZoneId)?.name} · leiren</button>{(zoneQuery.trim()?index.l3.filter(z=>z.name.toLocaleLowerCase('nb').includes(zoneQuery.toLocaleLowerCase('nb'))).slice(0,10).map(z=>z.id):(index.adjacent.get(state.homeZoneId)??[]).map(e=>e.to)).map(id=><button key={id} data-zone-id={id} onClick={()=>focusZone(id)}><HudIcon name="location" size={15}/>{index.byId.get(id)?.name}<small>{STATUS_LABEL[state.zones[id].status]}</small></button>)}</div></details>}
    {!targeting&&!drawer&&!modal&&!briefHidden&&<div className="sz-brief-wrap"><TodayBrief state={state} world={world} flows={flows} onZone={focusZone} onReport={()=>{setReport(state.reports.at(-1)??null);setModal('report');}} onWork={()=>setModal('community')} onGoals={()=>setModal('goals')} onCrew={()=>setDrawer('crew')} onRegions={()=>setModal('administration')} onStock={()=>{setStockResource(flows.water.daysLeft!==null&&flows.water.daysLeft<3?'water':'food');setModal('stock');}}/><button className="sz-brief-close" aria-label="Skjul dagens råd" onClick={()=>setBriefHidden(true)}><HudIcon name="close" size={14}/></button></div>}
    {!targeting&&briefHidden&&!drawer&&<button className="sz-show-brief" onClick={()=>setBriefHidden(false)}><HudIcon name="compass"/>I dag</button>}
    {targeting&&commandDraft&&<div className="sz-target-prompt" role="status"><span className="sz-target-icon"><HudIcon name={actionIcon(commandDraft.action)} size={23}/></span><span><small>{commandDraft.survivorIds.map(id=>state.survivors.find(p=>p.id===id)?.name).join(' · ')}</small><strong>{ACTIONS[commandDraft.action].label}: velg mål på kartet</strong></span><button onClick={()=>{setTargeting(false);setModal('command');}}><HudIcon name="back"/>Tilbake</button></div>}
    {drawer&&<aside className={`sz-drawer sz-drawer-${drawer}`} aria-label={drawer==='crew'?'Mannskap':drawer==='poi'?'Valgt sted':'Valgt område'}><header className="sz-drawer-heading"><span className="sz-drawer-icon"><HudIcon name={drawer==='crew'?'crew':drawer==='poi'?'location':'zone'} size={19}/></span><h2>{drawerTitle}</h2>{drawer==='poi'&&<button aria-label="Utvid stedsinformasjon" onClick={()=>setModal('poi')}><HudIcon name="expand" size={17}/></button>}<button aria-label="Lukk kontekstpanel" onClick={()=>setDrawer(null)}><HudIcon name="close" size={20}/></button></header><div className="sz-drawer-body">
      {drawer==='crew'&&<><CrewContext state={state} world={world} selected={crew} busy={busy} onToggle={id=>setCrew(crew.includes(id)?crew.filter(x=>x!==id):[...crew,id])} onProfile={openProfile} onTask={chooseCrewTask}/><details className="sz-pin-settings"><summary>Faste kort</summary><PinChooser state={state} pins={pinned.pins} toggle={pinned.toggle}/></details></>}
      {drawer==='zone'&&zoneContent}
      {drawer==='poi'&&<PoiProfile state={state} world={world} poiId={poiId} crewIds={crew} onSelectZone={focusZone} onOrder={(action,zid,target)=>addOrder(action,target,zid)} onJournal={()=>setModal('discoveries')}/>}
    </div></aside>}
    {!drawer&&!targeting&&<PinnedCards state={state} world={world} flows={flows} pins={pinned.pins} toggle={pinned.toggle} onCrew={()=>setDrawer('crew')} onStock={()=>{setStockResource(flows.water.daysLeft!==null&&flows.water.daysLeft<3?'water':'food');setModal('stock');}}/>}
    <footer className="sz-command-bar"><CrewDock state={state} world={world} orders={orders} onPerson={openProfile}/><div className="sz-command-context">{attentionCount>0?<button className="sz-alert" onClick={()=>setModal('attention')}><HudIcon name="warning"/><b>{attentionCount}</b><span>Saker å følge opp</span></button>:<span className="sz-ready"><HudIcon name="check" size={16}/>{state.phase>=4?'Regionene venter på din plan':`${freeCrew.length} ledige i mannskapet`}</span>}</div><button className="sz-plan-button" onClick={()=>setModal('plan')} data-testid="open-plan" aria-keyshortcuts={preferences.keyboardShortcuts?shortcutAria(binding('plan')):undefined} title={preferences.keyboardShortcuts?`Dagsplan (${shortcutLabel('plan')})`:'Dagsplan'}><HudIcon name="plan"/><span>Dagsplan</span><b>{orders.length}</b></button><button className="sz-end-day" data-testid="end-day" aria-keyshortcuts={preferences.keyboardShortcuts?shortcutAria(binding('endDay')):undefined} title={preferences.keyboardShortcuts?`La døgnet gå (${shortcutLabel('endDay')})`:'La døgnet gå'} disabled={!!state.event||!!state.gameOver||!!replay||!!state.turnCheckpoint||!activeAvatar||targeting} onClick={()=>orders.length?setModal('plan'):setConfirmEnd(true)}><HudIcon name="sun" size={19}/><span>La døgnet gå</span>{preferences.keyboardShortcuts&&<kbd aria-hidden="true">{shortcutLabel('endDay')}</kbd>}<HudIcon name="arrow" size={18}/></button></footer>
    {message&&<div className="sz-toast" role="status"><HudIcon name="check" size={16}/>{message}<button aria-label="Lukk melding" onClick={()=>setMessage('')}><HudIcon name="close" size={14}/></button></div>}
    {confirmEnd && <div className="rz-overlay"><section className="rz-dialog" role="dialog" aria-modal="true" aria-label="Ingen planlagte oppdrag"><h2>En rolig dag i leiren?</h2><p>Ingen nye oppdrag er planlagt. Pågående reiser og vakter fortsetter. Ledige folk blir der de er, og alle trenger mat og vann.</p><div className="rz-dialog-actions"><button onClick={() => setConfirmEnd(false)}>Tilbake til planen</button><button className="rz-primary" autoFocus data-initial-focus data-end-day-review onClick={() => { setConfirmEnd(false); finishDay(); }}>La døgnet gå uten oppdrag <kbd aria-hidden="true">↵{preferences.keyboardShortcuts?` / ${shortcutLabel('endDay')}`:''}</kbd></button></div></section></div>}
    {state.event && <div className="rz-overlay"><section className="rz-dialog rz-event" role="dialog" aria-label={state.event.title}>
      <Art path={`events/${state.event.id}`} className="rz-art rz-art-wide" />
      <p className="rz-kicker">{state.event.kicker ?? `HENDELSE · DAG ${state.day}`}</p><h2>{state.event.title}</h2><p>{state.event.text}</p>
      {!!state.event.voices?.length && <ul className="rz-voices">{state.event.voices.map(v => <li key={v}>{v}</li>)}</ul>}
      {state.event.choices.map(c => <button key={c.id} disabled={!!c.disabled} onClick={() => apply(() => resolveEvent(state, world, c.id).state, true, `event:${state.event!.id}:${c.id}`)}><strong>{c.label}</strong><small>{c.disabled ?? c.detail}</small></button>)}
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
    {state.gameOver && <CampaignConclusion state={state} onRestart={onRestart} onLibrary={onLibrary}/>}
    {modal && <div className="rz-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}><section className={`rz-dialog rz-wide-dialog sz-modal sz-modal-${modal}${modal === 'equipment' ? ' rz-equipment-dialog' : ''}`} role="dialog" aria-modal="true" aria-label={modal === 'report' ? `Dagsrapport for dag ${report?.day ?? state.day}` : modal === 'book' ? 'ZA-boka' : modal === 'equipment' ? 'Utstyr til oppdraget' : modal === 'command' ? 'Planlegg oppdrag' : modal === 'plan' ? 'Dagsplan' : modal === 'crew-profile' ? 'Persondetaljer' : modal === 'hq' ? 'Hovedkvarter' : modal === 'resources' ? 'Alle ressurser' : modal === 'settings' ? 'Innstillinger' : 'Spilloversikt'}>
      <button className="rz-close" aria-label="Lukk" autoFocus={modal!=='plan'} onClick={closeModal}>×</button>
      {modal === 'settings' && <GameSettings value={preferences} onChange={updatePreferences} onTestSound={()=>playSound('confirm')} performancePanel={<PerformanceBenchmark/>}/>}
      {modal === 'resources' && <><p className="rz-kicker">SAMFUNNET</p><h2>Alle ressurser</h2><div className="sz-resource-overview">{resourceCards.map(r=><button key={r.id} data-resource-detail={r.id} onClick={()=>{if(r.id==='people'){setModal('community');return;}setStockResource(r.id);setModal('stock');}}><HudIcon name={r.icon} size={25}/><span>{r.label}<strong>{number(r.value)}</strong></span>{r.net!==undefined&&<small>{signed(r.net)} / døgn</small>}</button>)}</div></>}
      {modal === 'command' && commandDraft && <OrderComposer state={state} world={world} orders={orders} draft={commandDraft} targetOptions={taskTargets(commandDraft.action,commandDraft.zoneId)} onChange={setCommandDraft} onConfirm={queueCommand} onHelp={openHelp} onCancel={()=>{setModal(orders.some(o=>o.id===commandDraft.id)?'plan':null);setCommandDraft(null);setTargeting(false);}} onPickTarget={()=>{setModal(null);setDrawer(null);setTargeting(true);}}/>}
      {modal === 'plan' && <><DayPlan state={state} world={world} orders={orders} onEdit={id=>{setCommandDraft(structuredClone(orders.find(o=>o.id===id)!));setModal('command');}} onRemove={id=>setOrders(orders.filter(o=>o.id!==id))} onLocate={id=>{setModal(null);focusZone(id);}} onRedirect={id=>apply(()=>redirectMission(state,world,id,state.homeZoneId),false,`redirect:${id}`)}/><div className="sz-plan-footer"><button onClick={()=>setModal(null)}><HudIcon name="back"/>Tilbake til kartet</button><button className="sz-primary" autoFocus data-initial-focus data-end-day-review disabled={!!gearPlan.errors.length||!!state.event||!!state.turnCheckpoint||!activeAvatar} onClick={()=>{setModal(null);finishDay();}}><HudIcon name="sun"/>Gjennomfør døgnet<HudIcon name="arrow"/></button></div></>}
      {modal === 'crew-profile' && <CrewProfile onHelp={openHelp} state={state} world={world} personId={personId} onAssign={id=>{setCrew([id]);setModal(null);setDrawer('crew');}} onLocate={id=>{setModal(null);focusZone(id);}} onEquipment={id=>{setCrew([id]);const position=crewPositionFor(state,id);addOrder('rest',undefined,position?.kind==='zone'?position.zoneId:selected,{id:commandId('rest',position?.kind==='zone'?position.zoneId:selected,[id]),action:'rest',zoneId:position?.kind==='zone'?position.zoneId:selected,survivorIds:[id]});}}/>}
      {modal === 'poi' && <PoiProfile state={state} world={world} poiId={poiId} crewIds={crew} onSelectZone={id=>{setModal(null);focusZone(id);}} onOrder={(action,zid,target)=>addOrder(action,target,zid)} onJournal={()=>setModal('discoveries')}/>}
      {modal === 'hq' && <HQManagement activeTab={hqTab} onTab={setHqTab} state={state} world={world} onSelectZone={id=>{setModal(null);focusZone(id);}} onOpen={view=>{if(view==='construction'){setSelected(state.hq?.zoneId??state.homeZoneId);setSelectedArea(null);setZoneTab('develop');setDrawer('zone');setModal(null);}else setModal(view==='society'?'community':view);}} construction={<section className="sz-hq-development"><p className="sz-eyebrow">UTVIKLE BASEN</p><h3>Hva trenger hovedkvarteret?</h3><TaskPalette actions={['module',...(state.phase>=2?['build' as const]:[]),...(state.phase>=3?['network' as const]:[]),'fortify','craft']} disabled={(['module','build','network','craft'] as ActionId[]).filter(action=>!taskTargets(action,state.hq?.zoneId??state.homeZoneId).length)} onTask={action=>addOrder(action,undefined,state.hq?.zoneId??state.homeZoneId)}/></section>} society={communityView} research={<ResearchView state={state} apply={apply} message={message} onHelp={openHelp}/>} stock={stockView}/>}
      {modal === 'equipment' && equipmentDraft && <><div className="rz-equipment-scroll"><CrewEquipment state={state} world={world} orders={orders} draftOrder={equipmentDraft} onChange={setEquipmentDraft} /><MissionOptions state={state} world={world} order={equipmentDraft} onChange={setEquipmentDraft} /></div><div className="rz-dialog-actions"><button onClick={() => { setModal(null); setEquipmentDraft(null); }}>Avbryt</button><button className="rz-primary" disabled={!draftGearPlan || !!draftGearPlan.errors.length} onClick={() => { setOrders(equipmentDraftOrders(orders, equipmentDraft)); setEquipmentDraft(null); setModal(null); setMessage('Utstyr oppdatert. Reservasjonene følger dagsplanen.'); }}>Lagre utstyrsvalg</button></div></>}
      {modal === 'attention' && <><p className="rz-kicker">TRENGER OPPFØLGING</p><h2>Åpne saker</h2>{urgent && <section className="rz-attention-item"><h3>Leirens kapasitet</h3><p>{urgent}</p><button onClick={() => setModal('stock')}>Se lager og forsyninger</button></section>}{people.filter(p => p.health < 45).map(p => <section className="rz-attention-item" key={p.id}><h3>{p.name} trenger hjelp</h3><p>Helse {Math.round(p.health)} · {placement(p.id)}</p><button onClick={() => { setModal(null); setDrawer('crew'); }}>Se mannskap og planlegg behandling</button></section>)}{regionalAlerts.map((alert, i) => <section className="rz-attention-item" key={`${alert.zoneId}-${i}`}><h3>{index.byId.get(alert.zoneId)?.name}</h3><p>{alert.text}</p><button onClick={() => setModal('administration')}>Følg opp regionen</button></section>)}{!attentionCount && <p>Ingen kritiske avvik er meldt.</p>}</>}
      {modal === 'administration' && <AdministrativeView enabled state={state} world={world} onCommand={command => apply(() => applyAdministrationCommand(state, world, command), false, `administration:${JSON.stringify(command)}`)} onSelectZone={id => { focusZone(id); setModal(null); }} onSupplyRequest={(destinationZoneId, cargo) => addOrder('supply',undefined,destinationZoneId,{id:commandId('supply',destinationZoneId,crew),action:'supply',zoneId:destinationZoneId,survivorIds:[...crew],logistics:{cargo}})} />}
      {modal === 'discoveries' && <PoiJournal state={state} world={world} crewIds={crew} onSelectZone={id => { focusZone(id); setModal(null); }} onOrder={(action, zoneId, target) => { addOrder(action, target, zoneId); }} />}
      {modal === 'book' && <ZaBook world={world} state={state} initialTopic={bookTopic} onGoals={() => setModal('goals')} onDiscoveries={() => setModal('discoveries')} />}
      {modal === 'report' && report && <><label className="rz-report-picker">Rapportarkiv <select aria-label="Velg dagsrapport" value={report.day} onChange={e => setReport(state.reports.find(r => r.day === Number(e.target.value)) ?? report)}>{state.reports.slice().reverse().map(r => <option key={r.day} value={r.day}>Dag {r.day}{r.day === state.day ? ' · siste rapport' : ''}</option>)}</select></label><DailyReport key={report.day} report={report} state={state} world={world} flows={flows} onHelp={openHelp} onZone={id => { focusZone(id); setModal(null); }} /></>}
      {modal === 'trade' && <TradeView state={state} world={world} onTrade={(id, give, take) => { try { const r = trade(state, id, give, take); advanceCampaignCommit(r.state, `trade:${id}`); setState(r.state); setMessage(r.message); } catch (e) { setMessage((e as Error).message); } }} message={message} />}
      {modal === 'goals' && <GoalsView world={world} state={state} />}
      {modal === 'community' && communityView}
      {modal === 'society' && <SocietyView world={world} state={state} flows={flows} apply={apply} message={message} />}
      {modal === 'research' && <ResearchView state={state} apply={apply} message={message} onHelp={openHelp}/>}
      {modal === 'wonders' && <WondersOperations world={world} state={state} crewIds={crew} onOrder={(zoneId, wonderId) => { addOrder('wonder', wonderId, zoneId); }} onSelectZone={id => { focusZone(id); setModal(null); }} />}
      {modal === 'chronicle' && <><h2>Krønike</h2><ol className="rz-chronicle">{[...state.memory].reverse().map((m, i) => <li key={i}><b>Dag {m.day}</b> {m.text}</li>)}</ol></>}
      {modal === 'stock' && stockView}
      {modal === 'menu' && <><p className="rz-kicker">KOMMANDOSENTRAL</p><h2>Oversikter</h2><div className="rz-overviews">{([['settings', 'Innstillinger'], ['attention', 'Åpne saker'], ['report', 'Dagsrapporter'], ['goals', 'Faser og mål'], ['book', 'ZA-boka'], ['community', 'Leiren og arbeidsfordeling'], ...(state.phase >= 4 ? [['administration', 'Regionale ledere']] : []), ['research', 'Forskning'], ['trade', 'Grupper og handel'], ['wonders', 'Unike steder'], ['discoveries', 'Oppdagelser og spor'], ['stock', 'Lager'], ['chronicle', 'Krønike']] as [Exclude<Modal, null>, string][]).map(([id, label]) => <button key={id} disabled={id === 'report' && !state.reports.length} onClick={() => { if(id==='book'){setBookTopic(undefined);setBookReturn(null);} if(id==='stock')setStockResource(null); if (id === 'report') setReport(state.reports.at(-1) ?? null); setModal(id); }}>{label} <span>→</span></button>)}</div>
        <button onClick={() => { setModal(null); onLibrary(); }}>Gjennomspillinger · lagre og last</button>
        <CampaignModeInfo state={state} /><p>Frø {state.seed} · Regler {state.rulesVersion} · Verden {state.worldVersion}</p>
        <button onClick={() => { const blob = new Blob([JSON.stringify(state)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `stavanger-z-dag-${state.day}.json`; a.click(); URL.revokeObjectURL(a.href); }}>Last ned lagring</button>
        <button onClick={onQuit}>Til startskjermen</button>
        <button onClick={() => { if (confirm('Til startskjermen for en ny gjennomspilling? Den aktive lagres på en ledig plass. Er alle plassene fulle, må du først åpne Gjennomspillinger.')) { onRestart(); } }}>Ny gjennomspilling</button>
</>}
    </section></div>}
    {replay && <DayReplay session={replay} step={replayStep} onSkip={closeReplay} />}
  </main>;
}

/** Endings are paged presentation only; the full ending and history stay in the save. */
function CampaignConclusion({state,onRestart,onLibrary}:{state:RegionState;onRestart:()=>void;onLibrary:()=>void}) {
  const [tab,setTab]=useState<'overview'|'story'|'achievements'>('overview'),[page,setPage]=useState(0);
  const ending=state.campaign?.ending, gameOver=state.gameOver!;
  const epiloguePages=Math.max(1,Math.ceil((ending?.epilogue.length??0)/2));
  const researchPages=Math.ceil((ending?.facts.research.length??0)/6);
  const decisionPages=ending?.facts.decisions.length??0;
  const pages=tab==='story'?epiloguePages+researchPages+decisionPages:Math.max(1,Math.ceil(state.milestones.length/4));
  const decision=ending?.facts.decisions[page-epiloguePages-researchPages];
  const viewState:RegionState={...state,milestones:state.milestones.slice(page*4,page*4+4),campaign:state.campaign&&{...state.campaign,ending:ending&&{...ending,epilogue:ending.epilogue.slice(page*2,page*2+2),facts:{...ending.facts,decisions:[],research:[]}}}};
  return <div className="rz-overlay"><section className="rz-dialog" role="dialog" aria-modal="true" aria-label="Gjennomspillingen er over">
    <p className="rz-kicker">{gameOver.won?'SEIER':'SLUTT'} · DAG {gameOver.day}</p>
    <nav className="sz-context-tabs sz-ending-tabs" aria-label="Avslutningen">{([['overview','Oversikt'],['story','Historien'],['achievements','Prestasjoner']]as const).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setPage(0);}}>{label}</button>)}</nav>
    {tab==='overview'&&<><Art path={`end/${gameOver.won?'win':'lose'}`} className="rz-art rz-art-wide"/><h2>{gameOver.won?'Dere klarte det':`Slutt etter ${gameOver.day} dager`}</h2><p>{gameOver.reason}</p><p>Fase {state.phase} · {controlled(state).length} soner · {totalPeople(state)} mennesker · {state.research.done.length} oppfinnelser</p></>}
    {tab==='story'&&(ending?page<epiloguePages?<CampaignEndingView state={viewState}/>:page<epiloguePages+researchPages?<section><h2>Kunnskapen dere etterlater</h2><ul>{ending.facts.research.slice((page-epiloguePages)*6,(page-epiloguePages+1)*6).map((name,index)=><li key={index}>{name}</li>)}</ul></section>:<section><h2>Valgene som formet samfunnet</h2><p className="rz-kicker">Dag {decision?.day}</p><p>{decision?.text}</p></section>:<p>Historien tok slutt etter {gameOver.day} døgn. Se prestasjonene for det samfunnet rakk å bygge.</p>)}
    {tab==='achievements'&&<CampaignAchievements state={viewState}/>}
    {tab!=='overview'&&pages>1&&<div className="sz-zone-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Forrige</button><span>{page+1} / {pages}</span><button disabled={page+1>=pages} onClick={()=>setPage(page+1)}>Neste</button></div>}
    <div className="rz-dialog-actions"><button onClick={onLibrary}>Gjennomspillinger · lagre og last</button><button className="rz-primary" onClick={onRestart}>Ny gjennomspilling</button></div>
  </section></div>;
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

function ResearchView({state,apply,message,onHelp}:{state:RegionState;apply:(fn:()=>RegionState)=>void;message:string;onHelp?:(topic:string)=>void}) {
 const special=specialBranch(state),[branch,setBranch]=useState<Branch>(special??'food'),[page,setPage]=useState(0),current=TECHS.find(t=>t.id===state.research.current),techs=TECHS.filter(t=>t.branch===branch);
 return <div className="sz-research"><header className="sz-research-heading"><h2>Forskning</h2>{onHelp&&<button className="sz-help-icon" aria-label="Håndbok: forskning" onClick={()=>onHelp('research')}><HudIcon name="book"/></button>}</header>{current&&<p className="sz-current-research"><HudIcon name="research"/>{current.name} · {Math.round(state.research.progress)}/{techCost(state,current).points} poeng</p>}<nav className="sz-research-branches" aria-label="Forskningsgrener">{(Object.keys(BRANCHES)as Branch[]).map(id=><button key={id} aria-pressed={branch===id} onClick={()=>{setBranch(id);setPage(0);}}>{BRANCHES[id]}{special===id?' ★':''}</button>)}</nav><div className="sz-research-grid">{techs.slice(page*4,page*4+4).map(t=>{const done=state.research.done.includes(t.id),why=techBlocked(state,t),cost=techCost(state,t),active=state.research.current===t.id;return <article key={t.id} className={`${done?'is-done':active?'is-active':''}`}><HudIcon name={done?'check':why?'lock':'research'}/><h3>{t.name}</h3><p>{t.text}</p><small>Fase {cost.phase} · {cost.points} poeng{Object.keys(cost.cost).length?` · ${costLabel(cost.cost)}`:''}</small>{done?<strong>Ferdig</strong>:active?<strong>Pågår</strong>:<button disabled={!!why} title={why} onClick={()=>apply(()=>startResearch(state,t.id))}>{why??'Start forskning'}</button>}</article>;})}</div><div className="sz-zone-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Forrige</button><span>{page+1}/{Math.ceil(techs.length/4)}</span><button disabled={(page+1)*4>=techs.length} onClick={()=>setPage(page+1)}>Neste</button></div>{message&&<p role="status">{message}</p>}</div>;
}

// ------------------------------------------------------------------ goals, report and trade

function GoalsView({world,state}:{world:RegionWorld;state:RegionState}) {
 const [tab,setTab]=useState<'phase'|'milestones'|'knowledge'|'victory'>('phase'),[phaseId,setPhaseId]=useState(state.phase),[page,setPage]=useState(0);
 const phase=PHASES.find(p=>p.id===phaseId)??PHASES[0];
 return <div className="sz-goals-view"><p className="sz-eyebrow">FREMGANG</p><h2>Neste steg</h2><nav className="sz-context-tabs" aria-label="Fremgangsoversikt">{([['phase','Faser'],['victory','Seiersveier'],['milestones','Milepæler'],['knowledge','Zombiekunnskap']]as const).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);setPage(0);}}>{label}</button>)}</nav>
 {tab==='victory'&&<CampaignProgress state={state} world={world}/>}
 {tab==='phase'&&<><div className="sz-phase-selector">{PHASES.map(p=><button key={p.id} aria-pressed={phase.id===p.id} onClick={()=>setPhaseId(p.id)}><HudIcon name={p.id<state.phase?'check':p.id===state.phase?'goals':'lock'}/>Fase {p.id}</button>)}</div><h3>{phase.name}</h3>{phase.id===1&&state.phase===1?<PhaseOneGoals world={world} state={state}/>:<ul className="sz-goal-checks">{phase.goals.map(g=><li key={g.id}><HudIcon name={phase.id<state.phase||phase.id===state.phase&&goalMet(state,world,g.id)?'check':'target'}/>{g.text}</li>)}</ul>}</>}
 {tab==='milestones'&&<><ul className="sz-goal-checks">{MILESTONES.slice(page*4,page*4+4).map(m=><li key={m.id}><HudIcon name={state.milestones.includes(m.id)?'check':'goals'}/><span><strong>{m.title}</strong><small>{m.text}</small></span></li>)}</ul><div className="sz-zone-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Forrige</button><span>{page+1}/{Math.max(1,Math.ceil(MILESTONES.length/4))}</span><button disabled={(page+1)*4>=MILESTONES.length} onClick={()=>setPage(page+1)}>Neste</button></div></>}
 {tab==='knowledge'&&<><ul className="sz-goal-checks">{state.mutations.slice(page*4,page*4+4).map(m=><li key={m.id}><HudIcon name={m.known?'research':'help'}/>{m.known?`${MUTATIONS.find(x=>x.id===m.id)?.name}: ${MUTATIONS.find(x=>x.id===m.id)?.text}`:'Ukjent mutasjon · undersøk zombiene'}</li>)}</ul>{!state.mutations.length&&<p>Ingen mutasjoner er registrert.</p>}{state.mutations.length>4&&<div className="sz-zone-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Forrige</button><button disabled={(page+1)*4>=state.mutations.length} onClick={()=>setPage(page+1)}>Neste</button></div>}</>}
 </div>;
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
  if (line.priority !== undefined) return 100 + line.priority * 5;
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

