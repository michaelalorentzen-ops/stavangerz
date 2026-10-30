// Hendelseskort. when(s) avgjør om et kort kan trekkes, choices[].run(s, ok)
// endrer tilstanden og returnerer teksten som vises etterpå. check er en
// stat-sjekk mot crewets beste på den staten.
import { EVENTS, INTRO } from '../regions/content';
export { EVENTS, finaleText, INTRO, phase2Intro, phase2Teaser, winBanner } from '../regions/content';
import { checkEnd, logChoice, validateTasks } from './engine';
import { mods } from './phases';
import { clamp, pick, rand } from './rng';
import { bestOf, checkOddsFor } from './skills';
import { delta, sampleOutcomes, summarize, type ChoicePreview } from './outcome';
import type { CrewMember, GameState, StatKey } from './types';

export interface ChoiceDef {
  label: string;
  check?: StatKey;
  when?: (s: GameState) => boolean;
  run: (s: GameState, ok: boolean) => string;
}
export interface EventDef {
  id: string;
  title: string;
  channel?: string;
  when?: (s: GameState) => boolean;
  /** kommer med en gang når dette er sant, uten å vente på tilfeldigheten */
  urgent?: (s: GameState) => boolean;
  text: (s: GameState) => string;
  choices: ChoiceDef[];
}

export const best = (s: GameState, k: StatKey): CrewMember => bestOf(s.crew, k);
export const checkOdds = (s: GameState, k: StatKey, base = 0.25): number => checkOddsFor(s.crew, k, base);
const roll = (s: GameState, k: StatKey) => rand(s) < checkOdds(s, k);
/** Trekker et hendelseskort og merker det som sett. Brukes av resolveDay(), som lagrer det i `state.event`. */
export function drawEvent(s: GameState): EventDef | null {
  const pool = EVENTS.filter((e) => !s.seenEvents.includes(e.id) && (!e.when || e.when(s)));
  // hendelser som må komme nå (for eksempel apoteket etter første skade) går foran tilfeldigheten
  const now = pool.find((e) => e.urgent?.(s));
  if (now) { s.seenEvents.push(now.id); return now; }
  if (!pool.length || rand(s) > mods(s).eventChance) return null;
  const e = pick(s, pool);
  s.seenEvents.push(e.id);
  return e;
}

/** Hva et hendelsesvalg kan gi når det lykkes og når det går galt, prøvd ut på kopier av tilstanden. */
export function previewChoice(s: GameState, ch: ChoiceDef): ChoicePreview {
  const run = (ok: boolean) => sampleOutcomes(s, (copy) => { ch.run(copy, ok); });
  return { ok: run(true), fail: ch.check ? run(false) : null };
}

/** Løser et hendelsesvalg. `changes` er det som faktisk endret seg. */
export function runChoice(s: GameState, ch: ChoiceDef): { ok: boolean; text: string; changes: string[] } {
  const before = structuredClone(s);
  const ok = ch.check ? roll(s, ch.check) : true;
  const text = ch.run(s, ok);
  s.moral = clamp(s.moral, 0, 100);
  const resets = validateTasks(s);
  checkEnd(s);
  return { ok, text, changes: [...summarize([delta(before, s)]), ...resets] };
}

/** Hendelseskortet med denne id-en, også introen. */
export function eventDef(id: string): EventDef {
  const e = id === INTRO.id ? INTRO : EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Ukjent hendelse: ${id}`);
  return e;
}

/** Valgene som kan tas i en hendelse nå, med indeksen i `choices`. */
export const eventChoices = (s: GameState, e: EventDef): { ch: ChoiceDef; i: number }[] =>
  e.choices.map((ch, i) => ({ ch, i })).filter(({ ch }) => !ch.when || ch.when(s));

/** Introen venter som dagens hendelse i en ny runde. */
export function queueIntro(s: GameState) {
  s.event = { id: INTRO.id };
}

/** Løser dagens ventende hendelse med valg nummer `choiceIdx` i kortets `choices`. `changes` er det som faktisk endret seg. */
export function resolveEvent(s: GameState, choiceIdx: number): { ok: boolean; text: string; changes: string[] } {
  if (!s.event) throw new Error('Ingen hendelse venter');
  const e = eventDef(s.event.id), ch = e.choices[choiceIdx];
  if (!ch || (ch.when && !ch.when(s))) throw new Error(`Ugyldig valg ${choiceIdx} i ${e.id}`);
  s.event = null;
  const r = runChoice(s, ch);
  logChoice(s, e.title, ch.label, r, !!ch.check);
  return r;
}
