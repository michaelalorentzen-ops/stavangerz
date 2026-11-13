import type { SimulationState, SimulationWorld, PopulationLedger, ResourceLedger } from '../../simulation-core/src/index';
import type { WorldDefinition } from '../../world-data/src/model';
import type { BuildingWorkload, FieldWork, WorkMode } from './field-work';
import type { CommunityState, WaterStation } from './community';

export type ActionType = 'scout' | 'clear' | 'claim' | 'secure' | 'scavenge' | 'rest' | 'heal' | 'establishBase' | 'repair' | 'raid' | 'surface' | 'search' | 'watch' | 'upgradeHQ' | 'installWater' | 'filterWater';
export interface GameOrder { id: string; type: ActionType; targetId: string; crewIds: string[]; poiId?: string; mode?: WorkMode }
export interface Survivor {
  id: string; name: string; role: string; description: string; strength: string; weakness: string;
  health: number; fatigue: number; experience: number; alive: boolean;
  skills: { combat: number; scouting: number; craft: number; medical: number };
  gear: { weapon: string; protection: string; utility: string };
}
export interface ZoneProgress { explored: boolean; observedDay?: number; intel?: { min: number; max: number }; claimed: boolean; secured: boolean; exteriorCleared?: boolean; routeIntel?: {id:string; name:string} }
export interface ActionPreview {
  valid: boolean; errors: string[]; costs: Record<string, number>; risk: 'Lav' | 'Moderat' | 'Høy' | 'Ukjent'; reasons: string[];
  route: string[]; eta: number; travelMinutes: number; expectedKills?: { min: number; max: number }; noise: number;
  scavenge?: { capacity: number; cargo: Record<string, number> };
  interruption?: {level: ActionPreview['risk']; text: string};
  hqWork?: {completed:number; total:number; planned:number};
  work?: { hours: number; totalHours: number; completed: number; totalBuildings: number; previousHours: number; expectedCompleted: number };
}
export interface PhaseOneState {
  workloads: Record<string, BuildingWorkload>;
  searches: Record<string, FieldWork>;
  surface: Record<string, number>;
  hq: boolean;
  hqProgress?: number;
  water?: WaterStation;
  community?: CommunityState;
}
export interface ReportEntry { type: 'info' | 'success' | 'warning' | 'danger'; title: string; text: string; zoneId?: string; survivorId?: string }
export interface DayReport {
  day: number; fromDay: number; entries: ReportEntry[]; kills: number; injuries: string[]; deaths: string[];
  population: PopulationLedger & { openingTotal: number; killed: number }; resources: ResourceLedger;
}
export interface PlayState {
  schemaVersion: 1; gameRulesVersion: string; seed: number; day: number;
  worldSnapshot: WorldDefinition; simulationWorld: SimulationWorld; sim: SimulationState;
  survivors: Survivor[]; zones: Record<string, ZoneProgress>; base: { zoneId: string; poiId?: string; established: boolean };
  morale: number; reports: DayReport[]; lastReport?: DayReport; gameOver: boolean;
  phaseOne?: PhaseOneState;
  event?: { id: string; title: string; text: string; choices: { id: string; label: string; description: string }[]; status: 'pending' | 'resolved'; choice?: string; decidedDay?: number; consequenceApplied?: boolean };
}
export interface PlayerZone extends ZoneProgress { id: string; name: string; playable: boolean; status: 'Ukjent' | 'Utforsket' | 'Ryddet' | 'Overtatt' | 'Sikret'; threat: string }
export interface PlayerPoi { id: string; name: string; cellId: string; kind: string; discovered: boolean; supplies?: Record<string, number>; hqCandidate: boolean }
export type PlayerDayReport = Omit<DayReport, 'population' | 'resources'>;
export interface GameView {
  day: number; survivors: Survivor[]; zones: PlayerZone[]; pois: PlayerPoi[]; stocks: Record<string, number>;
  base: PlayState['base']; objective: { title: string; text: string; targetId: string; poiId: string; complete: boolean };
  morale: number; gameOver: boolean; lastReport?: PlayerDayReport; reports: PlayerDayReport[]; event?: PlayState['event'];
  phaseOne?: PhaseOneState & { district: {name:string; controlled:number; total:number; exposed:number; defended:number; complete:boolean}; perimeter: {id:string; durability:number}[]; waterSource:number; dailyNeeds: {food:number; water:number}; };
}
