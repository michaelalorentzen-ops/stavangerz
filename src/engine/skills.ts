// Ferdigheter på skala 1–100. Lagres som desimaltall; UI viser bare stolpe og nivå.
import { clamp } from './rng';
import type { CrewMember, StatKey } from './types';

export type SkillLevel = 'Elendig' | 'Grei' | 'God' | 'Rå';

/** Omregning fra 1–5 prikker (oppretting av spiller) til 1–100. */
export const toSkill = (pips: number): number => 8 + pips * 10;

export function skillLevel(v: number): SkillLevel {
  if (v >= 70) return 'Rå';
  if (v >= 45) return 'God';
  if (v >= 25) return 'Grei';
  return 'Elendig';
}

/** Effektiv ferdighet (1–100) med egenskapsbonuser. */
export function stat(c: CrewMember, k: StatKey): number {
  let v = c.stats[k];
  if (k === 'nerver' && c.trait === 'filmnerd') v += 10;
  if (k === 'kondis' && c.trait === 'buss' && c.task.type !== 'hvile') v += 10;
  return clamp(v, 1, 100);
}

/** Erfaring gir mindre jo høyere ferdigheten er. */
export function gainXp(c: CrewMember, k: StatKey, amount: number): void {
  const v = c.stats[k];
  c.stats[k] = Math.min(100, v + amount * (1 - v / 110));
}
