// Encounters: en Rydde-gruppe havner i en knipe, og valget venter til neste planlegging. Ren logikk.
import { hasTag, noiseOf } from './cards';
import { ENCOUNTERS } from '../regions/content';
import type { LogFn } from './crew';
import { checkEnd, logChoice, validateTasks } from './engine';
import { SECTORS } from './data';
import { delta, sampleOutcomes, summarize, type ChoicePreview } from './outcome';
import type { PhaseModifiers } from './phases';
import { clamp, pick, rand } from './rng';
import { bestOf, checkOddsFor, ODDS_MAX } from './skills';
import type { CrewMember, GameState, PendingEncounter, SectorId, SectorKind, StatKey, WeaponTag } from './types';

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

/** Hvor et encounter kan skje: sektortyper, og 'tokt' for tokt langt hjemmefra. */
export type EncPlace = SectorKind | 'tokt';

export interface EncounterDef {
  id: string;
  title: string;
  /** stedene kortet passer, for eksempel ingen heis i et rekkehus */
  places: EncPlace[];
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
/** Sjansen synker så mye per trusselnivå over 1. Farlige steder er farlige også for de flinke. */
export const THREAT_ODDS = 0.08;
/** Så mange av de sist trukne kortene holdes ute av trekningen. */
export const ENC_COOLDOWN = 4;

const defOf = (id: string): EncounterDef => {
  const d = ENCOUNTERS.find((e) => e.id === id);
  if (!d) throw new Error(`Ukjent encounter: ${id}`);
  return d;
};
const names = (cs: CrewMember[]) => cs.map((c) => c.name).join(' og ');

/** Kortene som passer stedet. De sist trukne holdes ute, med mindre ingen andre passer. */
function poolFor(s: GameState, place: EncPlace, ctx: EncounterCtx): EncounterDef[] {
  const fits = ENCOUNTERS.filter((d) => d.places.includes(place) && (!d.when || d.when(s, ctx)));
  const fresh = fits.filter((d) => !s.recentEnc.includes(d.id));
  return fresh.length ? fresh : fits;
}

function push(s: GameState, def: EncounterDef, p: Omit<PendingEncounter, 'pid' | 'def'>) {
  s.pending.push({ pid: `e${s.nextUid++}`, def: def.id, ...p });
  s.recentEnc = [...s.recentEnc.filter((id) => id !== def.id), def.id].slice(-ENC_COOLDOWN);
}

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
  const pool = poolFor(s, SECTORS[sector].kind, ctx);
  if (!pool.length) return false;
  push(s, pick(s, pool), { sector, crew: group.map((c) => c.id), threat });
  log(`${names(group)} havnet i en knipe ${SECTORS[sector].at}.`, 'warn');
  return true;
}

/** Et tokt møter noe hver dag, så lenge dagstaket tillater det. Sektoren er null, siden gruppa er langt hjemmefra. Returnerer true når et encounter er lagt til. */
export function addToktEncounter(s: GameState, group: CrewMember[], threat: number, toktId: string, log: LogFn): boolean {
  const ctx: EncounterCtx = { sector: null, crew: group, threat, toktId };
  const pool = poolFor(s, 'tokt', ctx);
  if (!pool.length) return false;
  push(s, pick(s, pool), { sector: null, crew: group.map((c) => c.id), threat, toktId });
  log(`${names(group)} havnet i en knipe på toktet.`, 'warn');
  return true;
}

/** Sjansen for å lykke med et valg. 1 når valget ikke har en sjekk. */
export function encounterOdds(s: GameState, p: PendingEncounter, choiceIdx: number): number {
  const ch = defOf(p.def).choices[choiceIdx];
  if (!ch?.check) return 1;
  const crew = alive(s, p);
  if (!crew.length) return 0.05;
  const odds = checkOddsFor(crew, ch.check);
  const tagged = ch.tag && crew.some((c) => hasTag(c, ch.tag!)) ? odds + TAG_ODDS : odds;
  return clamp(tagged - THREAT_ODDS * (p.threat - 1), 0.05, ODDS_MAX);
}

export interface EncounterView {
  title: string;
  text: string;
  crew: string[];
  /** `preview` er null når forhåndsvisningen er slått av (boten trenger bare oddsen) */
  choices: { label: string; check?: StatKey; tag?: WeaponTag; retreat?: true; odds: number; best?: string; tagBonus: boolean; preview: ChoicePreview | null }[];
}

/** Hva et valg kan gi når det lykkes og når det går galt, prøvd ut på kopier av tilstanden. */
export function previewEncounter(s: GameState, p: PendingEncounter, choiceIdx: number): ChoicePreview {
  const ch = defOf(p.def).choices[choiceIdx];
  const run = (ok: boolean) => sampleOutcomes(s, (copy) => { const ctx = ctxOf(copy, p); if (ctx.crew.length) ch.run(copy, ctx, ok); });
  return { ok: run(true), fail: ch.check ? run(false) : null };
}

/** Alt UI-en trenger for å vise et ventende encounter. Forhåndsvisningen koster 24 kopier per valg, så den kan slås av. */
export function describeEncounter(s: GameState, p: PendingEncounter, opts: { preview?: boolean } = {}): EncounterView {
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
      preview: opts.preview === false ? null : previewEncounter(s, p, i),
    })),
  };
}

/** Løser et ventende encounter. Fjerner kortet, og avslutter runden om crewet er borte. `changes` er det som faktisk endret seg. */
export function resolveEncounter(s: GameState, pid: string, choiceIdx: number): { text: string; ok: boolean; changes: string[] } {
  const i = s.pending.findIndex((p) => p.pid === pid);
  if (i < 0) throw new Error(`Ukjent encounter: ${pid}`);
  const p = s.pending[i], def = defOf(p.def), ctx = ctxOf(s, p), ch = def.choices[choiceIdx];
  if (!ch) throw new Error(`Ukjent valg ${choiceIdx} i ${p.def}`);
  const before = structuredClone(s);
  const ok = ch.check ? rand(s) < encounterOdds(s, p, choiceIdx) : true;
  s.pending.splice(i, 1);
  const text = ctx.crew.length ? ch.run(s, ctx, ok) : 'Det var ingen igjen til å svare. Situasjonen løste seg selv, på den dårlige måten.';
  s.moral = clamp(s.moral, 0, 100);
  validateTasks(s);
  checkEnd(s);
  const changes = summarize([delta(before, s)]);
  logChoice(s, def.title, ch.label, { ok, changes }, !!ch.check);
  return { text, ok, changes };
}
