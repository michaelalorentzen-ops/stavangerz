export type StatKey = 'muskler' | 'kondis' | 'snoking' | 'nerver' | 'mekk' | 'prat';
export type Stats = Record<StatKey, number>;
export type ResKey = 'mat' | 'vann' | 'medisin' | 'tre' | 'skrap' | 'metall' | 'strom' | 'drivstoff';
export type Resources = Record<ResKey, number>;

export type SectorId = 'hjem' | 'tommerodden' | 'obs' | 'nordkrysset' | 'buoy_nord' | 'skolen' | 'sorspissen';
export type MapSectorId = SectorId | 'rosenberg';
export type GateId = 'nord' | 'sor' | 'ros';
export type PhaseId = 1 | 2 | 3 | 4 | 5;

export type TraitId =
  | 'lokalkjent' | 'filmnerd' | 'dugnad' | 'hms' | 'nattevakt' | 'sveiser'
  | 'russ' | 'regneark' | 'hv' | 'buss' | 'los' | 'kokk';

export type ZombieTraitId = 'lopere' | 'kjellerkrypere' | 'flokk' | 'seige' | 'smarte';

export type SectorKind = 'hjem' | 'butikk' | 'industri' | 'bolig' | 'natur' | 'kai' | 'offentlig';

export type Slot = 'vapen' | 'beskyttelse' | 'verktoy';
export type Family = 'makeshift' | 'for';
export type Rarity = 'vanlig' | 'sjelden' | 'episk' | 'unik';

export interface CardDef {
  id: string;
  name: string;
  family: Family;
  slot: Slot;
  level: 1 | 2 | 3 | 4 | 5;
  rarity: Rarity;
  bonus?: Partial<Stats>;
  /** lydløst, teller for vakt og speiding (Oppgave 4) */
  quiet?: boolean;
  durability: number;
  text: string;
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
  | { type: 'befeste'; target: GateId };
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

export interface GateState {
  work: number;
  level: number;
}

export type Flag = 'gann' | 'aggregat' | 'buss' | 'katt' | 'svein' | `gone_${string}`;

export interface GameState {
  v: 3;
  seed: number;
  rng: number;
  day: number;
  phase: PhaseId;
  /** zombieevner som er trukket for denne runden, vokser med fasene */
  zombieTraits: ZombieTraitId[];
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
  log: { day: number; lines: LogLine[] }[];
  over: null | 'won' | 'won-seen' | 'dead';
  stats: { kills: number; found: number; lost: number };
}

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
