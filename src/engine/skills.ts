// Ferdigheter på skala 1–100. Lagres som desimaltall; UI viser bare stolpe og nivå.
import { toolMult, weaponMult } from './cards';
import { CARDS } from './content/cards';
import { clamp, sum } from './rng';
import type { CrewMember, GameState, StatKey } from './types';

export { skillLevel, toSkill } from './levels';
export type { SkillLevel } from './levels';

/** Effektiv ferdighet (1–100) med egenskapsbonuser. */
export function stat(c: CrewMember, k: StatKey): number {
  let v = c.stats[k];
  for (const card of Object.values(c.gear)) v += CARDS[card!.def].bonus?.[k] ?? 0;
  if (k === 'nerver' && c.trait === 'filmnerd') v += 10;
  if (k === 'kondis' && c.trait === 'buss' && c.task.type !== 'hvile') v += 10;
  return clamp(v, 1, 100);
}

/** Erfaring gir mindre jo høyere ferdigheten er. */
export function gainXp(c: CrewMember, k: StatKey, amount: number): void {
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
