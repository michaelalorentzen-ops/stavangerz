// Encounters: en Rydde-gruppe havner i en knipe, og valget venter til neste planlegging. Ren logikk.
import { hasTag, noiseOf } from './cards';
import { ENCOUNTERS } from './content/encounters';
import type { LogFn } from './crew';
import { checkEnd, validateTasks } from './engine';
import { SECTORS } from './data';
import type { PhaseModifiers } from './phases';
import { clamp, pick, rand } from './rng';
import { bestOf, checkOddsFor } from './skills';
import type { CrewMember, GameState, PendingEncounter, SectorId, StatKey, WeaponTag } from './types';

export { ENCOUNTERS };

export interface EncounterCtx {
  sector: SectorId | null;
  /** de i gruppa som lever */
  crew: CrewMember[];
  threat: number;
  toktId?: string;
}

export interface EncChoice {
  label: string;
  check?: StatKey;
  /** våpentagg som gir bedre odds */
  tag?: WeaponTag;
  /** å trekke seg ut: koster litt, gir ingen belønning */
  retreat?: true;
  run: (s: GameState, ctx: EncounterCtx, ok: boolean) => string;
}

export interface EncounterDef {
  id: string;
  title: string;
  when?: (s: GameState, ctx: EncounterCtx) => boolean;
  text: (s: GameState, ctx: EncounterCtx) => string;
  /** Nøyaktig ett valg har retreat: true, og det står sist. */
  choices: EncChoice[];
}

/** Regelkonstanter for encounters (ikke vanskelighetsknotter, de ligger i fasetabellen). */
export const ENC_MAX_PER_DAY = 2;
/** Encounter-sjansen følger trusselnivået: 0.7 på nivå 0, +0.3 per nivå. */
const ENC_THREAT_BASE = 0.7, ENC_THREAT_STEP = 0.3;
/** Bråk-våpen gir flere encounters, en stille gruppe færre. */
const ENC_LOUD = 1.2, ENC_QUIET = 0.7;
/** Odds-bonus når noen i gruppa har et våpen med valgets tagg. */
export const TAG_ODDS = 0.2;

const defOf = (id: string): EncounterDef => {
  const d = ENCOUNTERS.find((e) => e.id === id);
  if (!d) throw new Error(`Ukjent encounter: ${id}`);
  return d;
};
const names = (cs: CrewMember[]) => cs.map((c) => c.name).join(' og ');

/** De i gruppa som fortsatt lever. */
const alive = (s: GameState, p: PendingEncounter): CrewMember[] =>
  p.crew.map((id) => s.crew.find((c) => c.id === id)).filter((c): c is CrewMember => !!c);
const ctxOf = (s: GameState, p: PendingEncounter): EncounterCtx => ({ sector: p.sector, crew: alive(s, p), threat: p.threat, toktId: p.toktId });

/** Hvor mye støy gruppa lager: minst ett bråk-våpen, eller bare stille våpen og ingen våpen. */
export function noiseProfile(team: CrewMember[]): { loud: boolean; quiet: boolean } {
  return { loud: team.some((c) => noiseOf(c) === 'brak'), quiet: team.every((c) => { const n = noiseOf(c); return n === null || n === 'stille'; }) };
}

export const encounterChance = (M: PhaseModifiers, threat: number, profile: { loud: boolean; quiet: boolean }): number =>
  clamp(M.encounterChance * (ENC_THREAT_BASE + ENC_THREAT_STEP * threat) * (profile.loud ? ENC_LOUD : 1) * (profile.quiet ? ENC_QUIET : 1), 0, 1);

/** Kanskje havner gruppa i en knipe. Returnerer true når et encounter er lagt til. Kalles bare under dagstaket. */
export function rollEncounter(s: GameState, M: PhaseModifiers, sector: SectorId, team: CrewMember[], profile: { loud: boolean; quiet: boolean }, log: LogFn): boolean {
  const group = team.filter((c) => s.crew.includes(c));
  if (!group.length) return false;
  const threat = SECTORS[sector].threat;
  if (rand(s) >= encounterChance(M, threat, profile)) return false;
  const ctx: EncounterCtx = { sector, crew: group, threat };
  const pool = ENCOUNTERS.filter((d) => !d.when || d.when(s, ctx));
  if (!pool.length) return false;
  const def = pick(s, pool);
  s.pending.push({ pid: `e${s.nextUid++}`, def: def.id, sector, crew: group.map((c) => c.id), threat });
  log(`${names(group)} havnet i en knipe i ${SECTORS[sector].short}.`, 'warn');
  return true;
}

/** Et tokt møter alltid noe. Sektoren er null, siden gruppa er langt hjemmefra. */
export function addToktEncounter(s: GameState, group: CrewMember[], threat: number, toktId: string, log: LogFn) {
  const ctx: EncounterCtx = { sector: null, crew: group, threat, toktId };
  const pool = ENCOUNTERS.filter((d) => !d.when || d.when(s, ctx));
  if (!pool.length) return;
  const def = pick(s, pool);
  s.pending.push({ pid: `e${s.nextUid++}`, def: def.id, sector: null, crew: group.map((c) => c.id), threat, toktId });
  log(`${names(group)} havnet i en knipe på toktet.`, 'warn');
}

/** Sjansen for å lykke med et valg. 1 når valget ikke har en sjekk. */
export function encounterOdds(s: GameState, p: PendingEncounter, choiceIdx: number): number {
  const ch = defOf(p.def).choices[choiceIdx];
  if (!ch?.check) return 1;
  const crew = alive(s, p);
  if (!crew.length) return 0.05;
  const odds = checkOddsFor(crew, ch.check);
  return ch.tag && crew.some((c) => hasTag(c, ch.tag!)) ? Math.min(0.95, odds + TAG_ODDS) : odds;
}

export interface EncounterView {
  title: string;
  text: string;
  crew: string[];
  choices: { label: string; check?: StatKey; tag?: WeaponTag; retreat?: true; odds: number; best?: string; tagBonus: boolean }[];
}

/** Alt UI-en trenger for å vise et ventende encounter. */
export function describeEncounter(s: GameState, p: PendingEncounter): EncounterView {
  const def = defOf(p.def), ctx = ctxOf(s, p);
  return {
    title: def.title,
    text: def.text(s, ctx),
    crew: ctx.crew.map((c) => c.name),
    choices: def.choices.map((ch, i) => ({
      label: ch.label, check: ch.check, tag: ch.tag, retreat: ch.retreat,
      odds: encounterOdds(s, p, i),
      best: ch.check && ctx.crew.length ? bestOf(ctx.crew, ch.check).name : undefined,
      tagBonus: !!ch.tag && ctx.crew.some((c) => hasTag(c, ch.tag!)),
    })),
  };
}

/** Løser et ventende encounter. Fjerner kortet, og avslutter runden om crewet er borte. */
export function resolveEncounter(s: GameState, pid: string, choiceIdx: number): { text: string; ok: boolean } {
  const i = s.pending.findIndex((p) => p.pid === pid);
  if (i < 0) throw new Error(`Ukjent encounter: ${pid}`);
  const p = s.pending[i], def = defOf(p.def), ctx = ctxOf(s, p), ch = def.choices[choiceIdx];
  if (!ch) throw new Error(`Ukjent valg ${choiceIdx} i ${p.def}`);
  const ok = ch.check ? rand(s) < encounterOdds(s, p, choiceIdx) : true;
  s.pending.splice(i, 1);
  const text = ctx.crew.length ? ch.run(s, ctx, ok) : 'Det var ingen igjen til å svare. Situasjonen løste seg selv, på den dårlige måten.';
  s.moral = clamp(s.moral, 0, 100);
  validateTasks(s);
  checkEnd(s);
  return { text, ok };
}
