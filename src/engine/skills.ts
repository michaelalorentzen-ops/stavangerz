// Ferdigheter på skala 1–100. Lagres som desimaltall; UI viser bare stolpe og nivå.
import { cardBonus, toolMult, weaponMult } from './cards';
import { CARDS } from './content/cards';
import { clamp, sum } from './rng';
import type { CrewMember, GameState, StatKey } from './types';

import { crewLevel } from './levels';

export { crewLevel, levelProgress, MAX_LEVEL, skillLevel, toSkill, XP_STEP } from './levels';
export type { SkillLevel } from './levels';

/** Hvert nivå over 1 gir så mange poeng i alle ferdigheter. */
export const LEVEL_BONUS = 2;

/** Effektiv ferdighet (1–100) med nivå, utstyr og egenskaper. */
export function stat(c: CrewMember, k: StatKey): number {
  let v = c.stats[k] + (crewLevel(c.xp ?? 0) - 1) * LEVEL_BONUS;
  for (const card of Object.values(c.gear)) v += cardBonus(CARDS[card!.def])[k] ?? 0;
  if (k === 'nerver' && c.trait === 'filmnerd') v += 10;
  if (k === 'kondis' && c.trait === 'buss' && c.task.type !== 'hvile') v += 10;
  return clamp(v, 1, 100);
}

/** Erfaring gir mindre jo høyere ferdigheten er, men teller fullt mot personens nivå. */
export function gainXp(c: CrewMember, k: StatKey, amount: number): void {
  c.xp = (c.xp ?? 0) + amount;
  const v = c.stats[k];
  c.stats[k] = Math.min(100, v + amount * (1 - v / 110));
}

// Styrkeformlene regner i gamle prikkenheter: stat(c, k) / 10.
const moralMult = (s: GameState) => (s.moral < 25 ? 0.75 : s.moral < 50 ? 0.9 : 1);
const hpMult = (c: CrewMember) => (c.hp >= 3 ? 1 : c.hp === 2 ? 0.85 : 0.55);

export function fightPower(s: GameState, c: CrewMember): number {
  let p = (stat(c, 'muskler') * 1.0 + stat(c, 'nerver') * 0.5 + stat(c, 'kondis') * 0.3) / 10;
  if (c.trait === 'hv') p += 2;
  return p * weaponMult(c) * moralMult(s) * hpMult(c);
}
export function detectChance(team: CrewMember[]): number {
  if (!team.length) return 0;
  const avg = sum(team.map((c) => stat(c, 'snoking') / 10)) / team.length;
  const p = 0.1 + 0.05 * avg + (team.some((c) => c.trait === 'los') ? 0.1 : 0);
  return clamp(p, 0.05, 0.6);
}
export function searchPower(s: GameState, c: CrewMember): number {
  let p = (stat(c, 'snoking') + stat(c, 'kondis') * 0.3) / 10;
  if (c.trait === 'lokalkjent') p += 2;
  return p * toolMult(c) * moralMult(s) * hpMult(c);
}
export function buildPower(s: GameState, c: CrewMember): number {
  let p = (stat(c, 'mekk') + stat(c, 'muskler') * 0.4) / 10;
  if (c.trait === 'sveiser') p += 3;
  if (c.trait === 'hms' || c.trait === 'dugnad') p += 2;
  if (s.flags.aggregat) p *= 1.3;
  return p * toolMult(c) * moralMult(s) * hpMult(c);
}

/** Den i gruppa med høyest effektiv ferdighet. */
export const bestOf = (crew: CrewMember[], k: StatKey): CrewMember =>
  crew.reduce((a, c) => (stat(c, k) > stat(a, k) ? c : a), crew[0]);
/** Sjansen for å lykkes med en sjekk, etter gruppas beste på ferdigheten. */
export const checkOddsFor = (crew: CrewMember[], k: StatKey, base = 0.25): number =>
  clamp(base + (stat(bestOf(crew, k), k) / 10) * 0.12, 0.05, 0.95);
