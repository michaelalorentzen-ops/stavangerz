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

/** En kortinstans. Tas i bruk i Oppgave 3. */
export interface CardInst {
  uid: string;
  def: string;
  dur: number;
}

export type Task =
  | { type: 'hvile' }
  | { type: 'rydde' | 'sanke'; target: SectorId }
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
  /** utstyr som ligger igjen i sektoren (Oppgave 3) */
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
  gear: number;
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
