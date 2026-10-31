// Felles UI-tilstand: spillet, hva som er valgt, og lagring i nettleseren.
import { GATES, migrate } from '../engine';
import type { GameState, GateId, MapSectorId, SectorKind, Slot, TaskType, ZoneId } from '../engine';
import rawMap from '../data/map.json';

/** Porten som skjermer hjemsonen (regionens eneste sperring bak hjemsektoren). */
export const HOME_GATE = (Object.keys(GATES) as GateId[]).find((g) => GATES[g].sector === 'hjem')!;

export interface MapShape { id: string; d: string; cx: number; cy: number }
export interface MapData {
  view: [number, number, number, number];
  focus: [number, number, number, number];
  land: string;
  depth: string[];
  buildings: string;
  roads: { major: string; minor: string };
  sectors: (MapShape & { id: MapSectorId })[];
  /** fx/fy = etikettpunkt i oversiktskartet over hele byen, bare for store soner; small = mindre etikett der */
  zones: (MapShape & { id: ZoneId; fx?: number; fy?: number; small?: boolean })[];
  geo: { W: number; N: number; KX: number };
  /** Oversiktskartet over hele byen: bare land og hovedveier, ingen sektorer eller regler */
  city?: { view: [number, number, number, number]; land: string; coast: string; roads: { major: string; minor: string } };
}
/** Tekstsymboler (ikke emoji) og navn for sektortypene. \uFE0E tvinger tekstvisning. */
export const KIND_ICON: Record<SectorKind, string> = {
  hjem: '⌂\uFE0E', butikk: '▤\uFE0E', industri: '⚙\uFE0E', bolig: '▦\uFE0E', natur: '❦\uFE0E', kai: '⚓\uFE0E', offentlig: '✚\uFE0E',
};
export const KIND_LABEL: Record<SectorKind, string> = {
  hjem: 'Hjem', butikk: 'Butikk', industri: 'Industri', bolig: 'Bolig', natur: 'Natur', kai: 'Kai', offentlig: 'Offentlig',
};

export const MAP = rawMap as unknown as MapData;

export type Selection =
  | { kind: 'sector'; id: MapSectorId }
  | { kind: 'gate'; id: GateId }
  | { kind: 'zone'; id: string };

export type PanelTab = 'sted' | 'crew' | 'lager' | 'logg';
export const PANEL_TABS: PanelTab[] = ['sted', 'crew', 'lager', 'logg'];
const TAB_KEY = 'stavanger-z-tab';
function loadTab(): PanelTab {
  try { const t = sessionStorage.getItem(TAB_KEY) as PanelTab | null; return t && PANEL_TABS.includes(t) ? t : 'sted'; } catch { return 'sted'; }
}
export function setTab(t: PanelTab) {
  ui.tab = t;
  try { sessionStorage.setItem(TAB_KEY, t); } catch { /* fanen huskes da bare til siden lastes på nytt */ }
}

export const ui = {
  /** null bare før første runde er startet */
  S: null as GameState | null,
  sel: { kind: 'sector', id: 'hjem' } as Selection,
  /** valgt handling i sektorkortet */
  selAction: null as TaskType | null,
  /** sortering av utstyrslageret */
  stashSort: 'spor' as 'spor' | 'nivå' | 'sjeldenhet' | 'holdbarhet',
  /** åpen kortvelger på et crewkort */
  picker: null as { crewId: string; slot: Slot } | null,
  /** crewraden som er foldet ut, bare én om gangen */
  openCrew: null as string | null,
  /** siste melding fra planer og «Som i går» */
  planNote: '',
  /** personen lageret sammenligner kortene mot */
  compareCrew: null as string | null,
  /** valgt fane i panelet, huskes i sessionStorage */
  tab: loadTab(),
  /** true mens forhåndsvisningen bak tittelskjermen tegnes, så den ikke lagres */
  previewing: false,
  /** settes av main.ts, tegner alt på nytt */
  refresh: () => {},
};

/** Spilltilstanden. Kun gyldig etter at en runde er startet. */
export function game(): GameState {
  if (!ui.S) throw new Error('Ingen aktiv runde');
  return ui.S;
}

const SAVE_KEY = 'stavanger-z-v3';
export function save() {
  if (ui.previewing || !ui.S) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(ui.S)); } catch { /* lagring er en bonus */ }
}
export function load(): GameState | null {
  try { const t = localStorage.getItem(SAVE_KEY); return t ? migrate(JSON.parse(t)) : null; } catch { return null; }
}
export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignorer */ }
}

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
