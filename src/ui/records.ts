// Rekorder og opplåsing. Poengsummen er dager brukt per fase (færre er bedre).
// Ren logikk øverst (testes uten nettleser), lagring i localStorage nederst.
import type { Difficulty } from '../engine';

export type RecordPhase = 1 | 2;

export interface Records {
  v: 1;
  /** beste antall dager, nøkkel `f1:normal` (per grad) eller `f1:normal:arild+mona+toregil` (per crew-kombinasjon) */
  best: Record<string, number>;
  /** grader som er låst opp ved siden av Normal */
  unlocked: Difficulty[];
}

export interface FinishedRun {
  phase: RecordPhase;
  difficulty: Difficulty;
  /** dager brukt på fasen */
  days: number;
  /** naboene spilleren startet med, i valgfri rekkefølge */
  combo?: string[];
}

export interface RecordResult {
  records: Records;
  /** slo runden den gamle rekorden for graden (eller var den første) */
  newBest: boolean;
  /** slo runden rekorden for denne crew-kombinasjonen */
  newComboBest: boolean;
  /** graden denne seieren låste opp */
  unlocked: Difficulty | null;
  /** forrige rekord for graden, hvis noen */
  previous: number | null;
}

/** Hva en seier på en grad låser opp. Brutal har ingenting over seg. */
export const UNLOCKS: Partial<Record<Difficulty, Difficulty>> = { normal: 'hard', hard: 'brutal' };
/** Graden som må vinnes for å låse opp en grad. Normal er alltid åpen. */
export const UNLOCKED_BY: Partial<Record<Difficulty, Difficulty>> = { hard: 'normal', brutal: 'hard' };

export const emptyRecords = (): Records => ({ v: 1, best: {}, unlocked: [] });

export const comboKey = (combo: string[]): string => [...combo].sort().join('+');
export const recordKey = (phase: RecordPhase, d: Difficulty, combo?: string[]): string =>
  `f${phase}:${d}${combo?.length ? `:${comboKey(combo)}` : ''}`;

export const isUnlocked = (r: Records, d: Difficulty): boolean => !UNLOCKED_BY[d] || r.unlocked.includes(d);
export const bestDays = (r: Records, phase: RecordPhase, d: Difficulty, combo?: string[]): number | null => r.best[recordKey(phase, d, combo)] ?? null;

/**
 * Tar inn gamle rekorder og en ferdig runde (fasen vunnet, ikke tvunget av fristen) og gir nye.
 * Rører ikke inndata. Fase 1 vunnet på en grad låser opp neste grad.
 */
export function recordRun(old: Records, run: FinishedRun): RecordResult {
  const records: Records = { v: 1, best: { ...old.best }, unlocked: [...old.unlocked] };
  const beat = (key: string): boolean => {
    const was = records.best[key];
    if (was !== undefined && run.days >= was) return false;
    records.best[key] = run.days;
    return true;
  };
  const previous = bestDays(old, run.phase, run.difficulty);
  const newBest = beat(recordKey(run.phase, run.difficulty));
  const newComboBest = run.combo?.length ? beat(recordKey(run.phase, run.difficulty, run.combo)) : false;
  let unlocked: Difficulty | null = null;
  const next = UNLOCKS[run.difficulty];
  if (run.phase === 1 && next && !records.unlocked.includes(next)) { records.unlocked.push(next); unlocked = next; }
  return { records, newBest, newComboBest, unlocked, previous };
}

/** Seeden som kort kode som kan deles (base 36 uten fortegn). */
export const seedCode = (seed: number): string => (seed >>> 0).toString(36).toUpperCase();
/** Leser en delt kode tilbake til en seed, eller null hvis den ikke er gyldig. */
export function parseSeed(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!/^[0-9a-z]{1,7}$/.test(t)) return null;
  const n = parseInt(t, 36);
  return n <= 0xffffffff ? n | 0 : null;
}

// ---- lagring: valgfri, spillet virker uten ----

const KEY = 'stavanger-z-records-v1';
const RUN_KEY = 'stavanger-z-run-v1';

/** Tåler tomt, ødelagt eller fremmed innhold: da starter listen på nytt. */
export function parseRecords(text: string | null): Records {
  try {
    const o = text ? JSON.parse(text) : null;
    if (!o || o.v !== 1 || !o.best || typeof o.best !== 'object' || !Array.isArray(o.unlocked)) return emptyRecords();
    const best: Record<string, number> = {};
    for (const [k, v] of Object.entries(o.best)) if (typeof v === 'number' && v > 0 && Number.isFinite(v)) best[k] = v;
    return { v: 1, best, unlocked: o.unlocked.filter((d: unknown) => d === 'hard' || d === 'brutal') };
  } catch { return emptyRecords(); }
}

export function loadRecords(): Records {
  try { return parseRecords(localStorage.getItem(KEY)); } catch { return emptyRecords(); }
}
export function saveRecords(r: Records) {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* rekorder er en bonus */ }
}

/** Naboene runden startet med. Staten har dem ikke, så de huskes ved siden av (per seed). */
export function rememberRun(seed: number, combo: string[]) {
  try { localStorage.setItem(RUN_KEY, JSON.stringify({ seed, combo })); } catch { /* ignorer */ }
}
export function recallCombo(seed: number): string[] | undefined {
  try {
    const o = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null');
    return o && o.seed === seed && Array.isArray(o.combo) ? o.combo.filter((x: unknown) => typeof x === 'string') : undefined;
  } catch { return undefined; }
}

/** Registrerer en ferdig fase i nettleseren og gir resultatet. */
export function logRun(run: FinishedRun): RecordResult {
  const res = recordRun(loadRecords(), run);
  saveRecords(res.records);
  return res;
}
