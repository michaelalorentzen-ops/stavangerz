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
