import type { PhaseModifiers } from './phases';

export type StatKey = 'muskler' | 'kondis' | 'snoking' | 'nerver' | 'mekk' | 'prat';
export type Stats = Record<StatKey, number>;
export type ResKey = 'mat' | 'vann' | 'medisin' | 'tre' | 'skrap' | 'metall' | 'strom' | 'drivstoff';
export type Resources = Record<ResKey, number>;

// Steds-id-ene kommer fra regionpakken
import type { GateId, MapSectorId, RegionFlag, SectorId, ZoneId } from '../regions/active';
export type { GateId, MapSectorId, SectorId, ZoneId };
export type PhaseId = 1 | 2 | 3 | 4 | 5;

export type TraitId =
  | 'lokalkjent' | 'filmnerd' | 'dugnad' | 'hms' | 'nattevakt' | 'sveiser'
  | 'russ' | 'regneark' | 'hv' | 'buss' | 'los' | 'kokk';

export type Branch = 'bevegelse' | 'sanser' | 'kropp' | 'atferd';

/** En mutasjon i zombienes utviklingstre. Rekkefølgen innen grenen er fast. */
export interface MutationDef {
  id: string;
  branch: Branch;
  /** plass i grenen, fra 1 */
  order: number;
  name: string;
  /** pseudovitenskapelig stammekode */
  code: string;
  gene: string;
  desc: string;
  /** faktorer som ganges inn i fasens modifikatorer */
  mult: Partial<Record<keyof PhaseModifiers, number>>;
}

export type SectorKind = 'hjem' | 'butikk' | 'industri' | 'bolig' | 'natur' | 'kai' | 'offentlig';

export type Slot = 'vapen' | 'beskyttelse' | 'verktoy';
export type Family = 'makeshift' | 'for';
export type Rarity = 'vanlig' | 'sjelden' | 'episk' | 'unik';

export type WeaponRange = 'naerkamp' | 'avstand';
export type WeaponNoise = 'stille' | 'normal' | 'brak';
export type WeaponTag = 'gjennomslag' | 'spredning' | 'rekkevidde';

export interface CardDef {
  id: string;
  name: string;
  family: Family;
  slot: Slot;
  level: 1 | 2 | 3 | 4 | 5;
  rarity: Rarity;
  bonus?: Partial<Stats>;
  /** bare våpen: nærkamp eller på avstand */
  range?: WeaponRange;
  /** bare våpen: hvor mye støy det lager, standard 'normal' */
  noise?: WeaponNoise;
  /** bare våpen: særegenskaper */
  tags?: WeaponTag[];
  durability: number;
  text: string;
  /** false for kort med et bestemt opphav («fra Obs»), som ikke kan lages med Lage utstyr */
  craftable?: false;
  /** bare unike kort: sektorene kortet kan ligge i */
  places?: SectorId[];
}

/** En kortinstans. */
export interface CardInst {
  uid: string;
  def: string;
  dur: number;
  /** merket som favoritt i lageret */
  fav?: boolean;
}

export type Task =
  | { type: 'hvile' }
  | { type: 'lage' }
  | { type: 'pleie' }
  | { type: 'trene'; stat: StatKey }
  | { type: 'rydde' | 'sanke' | 'speide' | 'overlevende'; target: SectorId }
  | { type: 'vakt'; target: GateId | SectorId }
  | { type: 'befeste'; target: GateId }
  /** target er id-en til toktet */
  | { type: 'tokt'; target: string };
export type TaskType = Task['type'];

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  trait: TraitId;
  stats: Stats;
  /** 3 frisk, 2 skrapt opp, 1 ille ute, 0 bitt (fjernes) */
  hp: number;
  task: Task;
  kills: number;
  /** all erfaring personen har samlet. Gir nivå, se crewLevel */
  xp?: number;
  gear: Partial<Record<Slot, CardInst>>;
  me?: boolean;
}

export interface SectorState {
  /** zombier crewet kan se */
  z: number;
  /** zombier gjemt i kjellere og boder */
  hidden: number;
  /** hvor mye av sektoren som er gjennomsøkt, 0–100 */
  searched: number;
  /** hvor godt crewet har sektoren under kontroll, 0–100 */
  control: number;
  loot: Resources;
  lootMax: number;
  /** crewet har sett sektoren, så zombietallet er eksakt */
  seen: boolean;
  /** speidet, så trusselnivået er kjent */
  scouted: boolean;
  /** sektoren har vært trygg, og kapasiteten teller som bolig */
  settled: boolean;
  /** sektorens funn er tatt */
  specialFound: boolean;
  /** utstyr som ligger igjen i sektoren */
  dropped: CardInst[];
}

/** Et encounter som venter på at spilleren skal velge ved neste planlegging. */
export interface PendingEncounter {
  pid: string;
  /** id til encounterkortet */
  def: string;
  sector: SectorId | null;
  /** id-ene til gruppa */
  crew: string[];
  threat: number;
  toktId?: string;
}

/** Et tokt som er ute: gruppa er borte fra byen til de kommer hjem. */
export interface ToktState {
  id: string;
  crew: string[];
  /** dager ute */
  stage: number;
  haul: Partial<Resources>;
  cards: CardInst[];
  /** venter på at spilleren velger Fortsett eller Snu */
  awaiting: boolean;
}

export interface QuestState {
  id: string;
  /** siste dag questen kan fullføres */
  until: number;
  done: boolean;
}

export interface GateState {
  work: number;
  level: number;
}

export type Flag = RegionFlag | `gone_${string}`;

export interface GameState {
  v: 3;
  seed: number;
  rng: number;
  day: number;
  phase: PhaseId;
  /** mutasjoner zombiene har fått, vokser med fasene */
  mutations: string[];
  /** mutasjoner spilleren har avslørt, de får halv effekt */
  knownMutations: string[];
  /** hvor sannsynlig hver gren er for neste mutasjon, trukket ved start */
  branchWeights: Record<Branch, number>;
  /** dagen målet for fasen først ble nådd */
  goalDay: number | null;
  /** dagen fasen startet, turgrensen telles herfra */
  phaseStartDay: number;
  moral: number;
  /** kort på lageret, ikke utstyrt */
  stash: CardInst[];
  /** unike kort som ligger i sektorer og ikke er funnet */
  uniques: Partial<Record<SectorId, string>>;
  nextUid: number;
  /** lederen er død, og spilleren må velge en ny før dagen kan avsluttes */
  needLeader: boolean;
  res: Resources;
  flags: Partial<Record<Flag, boolean>>;
  crew: CrewMember[];
  sectors: Record<SectorId, SectorState>;
  gates: Record<GateId, GateState>;
  seenEvents: string[];
  /** encounters som venter på valg */
  pending: PendingEncounter[];
  /** de siste encounterkortene som er trukket, nyest sist. De trekkes ikke igjen med en gang. */
  recentEnc: string[];
  /** tokt som er ute */
  tokts: ToktState[];
  quests: QuestState[];
  log: { day: number; lines: LogLine[] }[];
  over: null | 'won' | 'won-seen' | 'dead' | 'timeout';
  stats: {
    kills: number; found: number; lost: number;
    /** dager der mat eller vann var tomt */
    starvedDays: number;
    /** døde etter hvor de var: ute i byen (kamp), hjemme eller ved porten (natt), eller på tokt */
    deaths: Record<DeathCause, number>;
  };
}

export type DeathCause = 'kamp' | 'natt' | 'tokt';

export type LogKind = '' | 'good' | 'warn' | 'bad' | 'fun' | 'find';
export interface LogLine {
  t: string;
  kind: LogKind;
}

export interface SelfSetup {
  name: string;
  stats: Stats;
  trait: TraitId;
}
