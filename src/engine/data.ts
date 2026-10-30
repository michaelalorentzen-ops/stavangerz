// Statiske spilldata: sektorer, sperringer, egenskaper og naboer i fase 1.
import { AREA, SECTORS } from '../regions/active';
import type { Flag, PhaseId, ResKey, Resources, SectorId, SectorKind, StatKey, Stats, TraitId } from './types';

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
  locked?: boolean;
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
}

export interface NeighborDef {
  id: string;
  name: string;
  age: number;
  role: string;
  trait: TraitId;
  stats: Stats;
  quip: string;
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

export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  lokalkjent: { name: 'Lokalkjent', desc: `Vet hvor alt er ${AREA.at}. +2 når du leter.` },
  filmnerd: { name: 'Har sett alle zombiefilmene', desc: '+10 Nerver. Sier «sikt mot hodet» ved enhver anledning.' },
  dugnad: { name: 'Fast inventar på dugnad', desc: '+2 når du befester. Har alltid med egen drill.' },
  hms: { name: 'HMS-ansvarlig', desc: 'Befestninger blir solide (+2), men fyller ut avviksskjema etter hver kamp.' },
  nattevakt: { name: 'Nattevakt på SUS', desc: 'Lapper sammen crewet. Hviledager helbreder alltid, og sparer ofte medisin.' },
  sveiser: { name: `Sveiser ${SECTORS.rosenberg.at}`, desc: '+3 når du befester. Kjenner verftet ut og inn (fase 2).' },
  russ: { name: 'Russ 2026', desc: 'Løper fort og redd. Har ingen respekt for noe, inkludert zombier.' },
  regneark: { name: 'Regnearket', desc: `Oljeingeniør. Har regneark over alle kjellere ${AREA.at}, og viser det eksakte antallet gjemte zombier.` },
  hv: { name: 'Heimevernet', desc: '+2 i kamp. Forteller om øvelse Cold Response hver kveld.' },
  buss: { name: 'Kolumbus-sjåfør', desc: 'Kan kjøre hva som helst gjennom hva som helst (fase 2). +10 Kondis på oppdrag.' },
  los: { name: 'Pensjonert los', desc: 'Kjenner hvert skjær. Ser ting andre overser: +0,1 til å finne skjulte zombier.' },
  kokk: { name: 'Kokk på Fisketorget', desc: 'Får mat til å strekke lenger. Crewet bruker 1 porsjon mindre mat per dag.' },
};
export const SELF_TRAITS: TraitId[] = ['lokalkjent', 'filmnerd', 'dugnad'];

// Stedene og folkene kommer fra regionpakken.
export { AREA, GATES, LANDMARKS, NEIGHBORS, PLAYABLE, SECTORS, START_NEIGHBORS, ZONE_INFO, ZONES } from '../regions/active';
