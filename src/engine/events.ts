// Hendelseskort. when(s) avgjør om et kort kan trekkes, choices[].run(s, ok)
// endrer tilstanden og returnerer teksten som vises etterpå. check er en
// stat-sjekk mot crewets beste på den staten.
import { EVENTS } from '../regions/content';
export { EVENTS, INTRO, phase2Teaser, winBanner } from '../regions/content';
import { checkEnd, validateTasks } from './engine';
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
  validateTasks(s);
  checkEnd(s);
  return { ok, text, changes: summarize([delta(before, s)]) };
}
