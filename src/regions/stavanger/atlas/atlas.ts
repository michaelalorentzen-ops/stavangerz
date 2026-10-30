// Atlaset: strukturerte data for hele byen, som fase 3–5 skal bygges på. Ett område per fil
// (<id>.json i denne mappa; atlas.config.json er oppsettet), kurert fra OSM med tools/build_atlas.py. Atlaset er IKKE koblet inn
// i spillet ennå; det er grunnlag, ikke spilldata. Se README.md her for hvordan et område kureres.
//
// Reglene (docs/kartlegging-stavanger.md, vedtatt av eieren):
// - Navn følger regelheftet (docs/stedsnavn.md): funksjonsnavn i `name`, det ekte stedet i `real`.
// - Trussel er relativ til fasen: 1–5 innenfor området. Fasen ganger opp via mods(s), så en 3 i fase 5
//   er farligere enn en 3 i fase 2. Tallene skal aldri skrives som absolutte.
// - Avstand telles i områder (`ring`): 0 Buøy; 1 Vestøyene, Hundvåg, Østøyene; 2 Sentrum, Storhaug,
//   Våland, Eiganes/Bjergsted; 3 Madla, Hillevåg, Ullandhaug/Hinna, Forus/Lura.
// - 6–8 sektorer per område, høyst ett nøkkelsted og én HQ-kandidat (begge med trussel 4–5).
import type { SectorKind } from '../../../engine/types';

export type Threat = 1 | 2 | 3 | 4 | 5;

/** Undertype for butikker og lignende (regelheftet, kapittel 2). Bensinstasjon og bilforhandler har kind «industri». */
export type ShopType =
  | 'matbutikk' | 'byggvarehus' | 'jernvarehandel' | 'dyrebutikk' | 'interiorbutikk' | 'klesbutikk'
  | 'sportsbutikk' | 'bensinstasjon' | 'bilforhandler' | 'elektronikk' | 'kjopesenter';

/** Typene et nøkkelsted kan ha (regelheftet, kapittel 3). */
export type KeyPlaceType = 'apotek' | 'vapen_jakt';

/** Typene en HQ-kandidat kan ha (regelheftet, kapittel 3). */
export type HqType = 'sykehus' | 'brannstasjon' | 'politistasjon' | 'verft' | 'kjopesenter' | 'fort';

/** En inngang til området. `between` er to område-id-er, der det ene er området selv. */
export interface AtlasGate {
  /** funksjonsnavn: «Brua mot byen», «Tunnelen» */
  name: string;
  /** det ekte stedet: «Stavanger bybru» */
  real: string;
  between: [string, string];
  lat: number;
  lon: number;
  notes?: string;
}

/** Et sted i området, med navn etter regelheftet. */
export interface AtlasPlace {
  /** id, unik i hele atlaset (små bokstaver, a–z, 0–9 og _) */
  id: string;
  name: string;
  short: string;
  /** navnet med preposisjon: «på industriområdet», «i blokkene» */
  at: string;
  real: string;
  realAt: string;
  kind: SectorKind;
  shopType?: ShopType;
  /** 1–5, relativt til fasen */
  threat: Threat;
  lat: number;
  lon: number;
  /** hva stedet gir, kort: «skrap, metall, litt drivstoff» */
  gives: string;
  notes?: string;
}

export type AtlasSector = AtlasPlace;
export interface AtlasKeyPlace extends AtlasPlace { type: KeyPlaceType }
export interface AtlasHqCandidate extends AtlasPlace { type: HqType }

/** Et steds rådata fra OSM, til senere kurering og tekster. `osm` er «node/123», «way/456» eller «relation/789». */
export interface AtlasPoi {
  name: string;
  /** kategorien fra tools/build_atlas.py: matbutikk, industri, bru, skog … */
  type: string;
  lat: number;
  lon: number;
  osm: string;
}

export interface AtlasArea {
  /** samme som filnavnet */
  id: string;
  name: string;
  at: string;
  /** avstand i områder fra Buøy */
  ring: 0 | 1 | 2 | 3;
  /** fasen området hører til (1–5) */
  phase: 1 | 2 | 3 | 4 | 5;
  /** hvor tett bebygd: 1 spredt (hytter, jorder) … 5 tett (sentrum) */
  density: Threat;
  /** grunntrussel 1–5, relativt til fasen; sektorene varierer rundt den */
  baseThreat: Threat;
  gates: AtlasGate[];
  /** 6–8 vanlige sektorer, uten nøkkelsted og HQ-kandidat */
  sectors: AtlasSector[];
  keyPlace?: AtlasKeyPlace;
  hqCandidate?: AtlasHqCandidate;
  pois: AtlasPoi[];
  sources: string[];
  /** hvorfor området er delt slik, åpne spørsmål og [Sjekk]-punkter */
  notes?: string;
}

export const SECTOR_KINDS: readonly SectorKind[] = ['hjem', 'butikk', 'industri', 'bolig', 'natur', 'kai', 'offentlig'];
export const SHOP_TYPES: readonly ShopType[] = [
  'matbutikk', 'byggvarehus', 'jernvarehandel', 'dyrebutikk', 'interiorbutikk', 'klesbutikk',
  'sportsbutikk', 'bensinstasjon', 'bilforhandler', 'elektronikk', 'kjopesenter',
];
export const KEY_PLACE_TYPES: readonly KeyPlaceType[] = ['apotek', 'vapen_jakt'];
export const HQ_TYPES: readonly HqType[] = ['sykehus', 'brannstasjon', 'politistasjon', 'verft', 'kjopesenter', 'fort'];
/** Hele atlaset ligger innenfor denne boksen [sør, vest, nord, øst], samme som «bbox» i atlas.config.json */
export const ATLAS_BBOX = [58.84, 5.55, 59.02, 5.82] as const;
