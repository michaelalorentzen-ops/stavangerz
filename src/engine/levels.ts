// Ferdighetsnivåer (1–100). Egen fil så både skills og cards kan bruke dem uten sirkelimport.
export type SkillLevel = 'Elendig' | 'Grei' | 'God' | 'Rå';

/** Omregning fra 1–5 prikker (oppretting av spiller) til 1–100. */
export const toSkill = (pips: number): number => 8 + pips * 10;

export function skillLevel(v: number): SkillLevel {
  if (v >= 70) return 'Rå';
  if (v >= 45) return 'God';
  if (v >= 25) return 'Grei';
  return 'Elendig';
}

/** Erfaring per nivåtrinn: nivå n krever XP_STEP · n(n−1)/2, så hvert nivå tar litt lenger tid enn det forrige. */
export const XP_STEP = 6;
export const MAX_LEVEL = 20;

/** Personens nivå (1–20) ut fra samlet erfaring. */
export function crewLevel(xp: number): number {
  let n = 1;
  while (n < MAX_LEVEL && xp >= (XP_STEP * n * (n + 1)) / 2) n++;
  return n;
}

/** Hvor langt personen er kommet mot neste nivå, 0–1. */
export function levelProgress(xp: number): number {
  const n = crewLevel(xp);
  if (n >= MAX_LEVEL) return 1;
  const lo = (XP_STEP * n * (n - 1)) / 2, hi = (XP_STEP * n * (n + 1)) / 2;
  return (xp - lo) / (hi - lo);
}
