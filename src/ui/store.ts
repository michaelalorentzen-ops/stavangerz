// Felles UI-tilstand: spillet, hva som er valgt, og lagring i nettleseren.
import { migrate } from '../engine';
import type { GameState, GateId, MapSectorId, TaskType } from '../engine';
import rawMap from '../data/map.json';

export interface MapShape { id: string; d: string; cx: number; cy: number }
export interface MapData {
  view: [number, number, number, number];
  focus: [number, number, number, number];
  land: string;
  depth: string[];
  buildings: string;
  roads: { major: string; minor: string };
  sectors: (MapShape & { id: MapSectorId })[];
  zones: (MapShape & { name: string })[];
  geo: { W: number; N: number; KX: number };
}
export const MAP = rawMap as unknown as MapData;

export type Selection =
  | { kind: 'sector'; id: MapSectorId }
  | { kind: 'gate'; id: GateId }
  | { kind: 'zone'; id: string };

export const ui = {
  /** null bare før første runde er startet */
  S: null as GameState | null,
  sel: { kind: 'sector', id: 'hjem' } as Selection,
  /** valgt handling i sektorkortet */
  selAction: null as TaskType | null,
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

const SAVE_KEY = 'stavanger-z-v1';
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
