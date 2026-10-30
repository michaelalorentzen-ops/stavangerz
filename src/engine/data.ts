// Statiske spilldata: sektorer, sperringer, egenskaper og naboer i fase 1.
import type { FacilityCond, Flag, PhaseId, ResKey, Resources, SectorId, SectorKind, StatKey, Stats, TraitId } from './types';

export interface SectorDef {
  name: string;
  short: string;
  /** stedet med preposisjon, slik det står i en setning: «på skolen», «hjemme» */
  at: string;
  /** det ekte stedet, til lokale tekster og undertittel: «Obs Bygg», «Tømmerodden» (se docs/stedsnavn.md) */
  real: string;
  /** det ekte stedet med preposisjon: «på Obs Bygg» */
  realAt: string;
  desc: string;
  kind: SectorKind;
  /** 1–5, styrer hvor seige zombiene er og hvor farlig det er å rydde */
  threat: 1 | 2 | 3 | 4 | 5;
  /** boliger sektoren gir når den er bosatt */
  capacity: number;
  /** hva Sanke gir per dag */
  yield: Partial<Resources>;
  z: number;
  hidden: number;
  loot: Resources;
  /** funn når halve sektoren er gjennomsøkt */
  special?: { text: string; res?: Partial<Resources>; card?: string; flag?: Flag; moral?: number };
  /** fasen sektoren åpnes i. Mangler den, er sektoren med fra fase 1. Før det er den låst. */
  opensInPhase?: PhaseId;
}

/** Et anlegg i HQ-et. Bare tekst: reglene står i hq.ts. */
export interface FacilityDef {
  name: string;
  /** navnet midt i en setning: «verkstedhallen» */
  short: string;
  /** hva anlegget gjør når det er satt i stand */
  effect: string;
  /** rykter etter tilstanden ryktet peker på */
  rumor: Record<FacilityCond, string>;
  /** den sanne tilstanden, vist når HQ-et er tatt */
  known: Record<FacilityCond, string>;
}

export interface GateDef {
  name: string;
  desc: string;
  /** sektoren som må være klarert før det kan bygges, og som får inntrengerne */
  sector: SectorId;
  /** posisjon på kartet */
  x: number;
  y: number;
  /** grunnsjanse for gjennombrudd om natta */
  base: number;
  /** sektorene inntrengerne kan havne i. Uten denne havner de i `sector`. */
  spills?: SectorId[];
  /** sektoren porten holder igjen. Er det HQ-sektoren og HQ-et er tatt, slipper porten ikke inn noe om natta. */
  holds?: SectorId;
}

export interface NeighborDef {
  id: string;
  name: string;
  age: number;
  role: string;
  trait: TraitId;
  stats: Stats;
  quip: string;
  /** kommer bare med via et bestemt tokt eller en hendelse, aldri til porten */
  special?: true;
}

export const STATS: StatKey[] = ['muskler', 'kondis', 'snoking', 'nerver', 'mekk', 'prat'];
export const STAT_LABEL: Record<StatKey, string> = { muskler: 'Muskler', kondis: 'Kondis', snoking: 'Snoking', nerver: 'Nerver', mekk: 'Mekk', prat: 'Prat' };
export const STAT_HINT: Record<StatKey, string> = {
  muskler: 'Slå hardt, bære mye',
  kondis: 'Løpe fra ting, unngå bitt',
  snoking: 'Finne ting, se kjellere',
  nerver: 'Holde hodet kaldt',
  mekk: 'Bygge, fikse, sveise',
  prat: 'Overtale, rekruttere, handle',
};
export const RES: ResKey[] = ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'strom', 'drivstoff'];
export const RES_LABEL: Record<ResKey, string> = { mat: 'Mat', vann: 'Vann', medisin: 'Medisin', tre: 'Tre', skrap: 'Skrap', metall: 'Metall', strom: 'Strøm', drivstoff: 'Drivstoff' };
/** ressursene som alltid vises i toppfeltet i hver fase (andre vises når de er over 0) */
export const PHASE_RES: Record<PhaseId, ResKey[]> = {
  1: ['mat', 'vann', 'medisin', 'tre', 'skrap'],
  2: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'drivstoff'],
  3: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'drivstoff'],
  4: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'strom', 'drivstoff'],
  5: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'strom', 'drivstoff'],
};

export const HEALTH_LABEL = ['Bitt', 'Ille ute', 'Skrapt opp', 'Frisk'];

export const GATE_STEPS = [0, 6, 14, 24];


// Stedene og folkene kommer fra regionpakken.
export { AREA, FACILITIES, GATES, HQ_SECTOR, LANDMARKS, NEIGHBORS, PLAYABLE, SECTOR_IDS, SECTORS, SELF_TRAITS, START_NEIGHBORS, TRAITS, ZONE_INFO, ZONES } from '../regions/active';
