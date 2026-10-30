// Forhåndsvisning av oppdrag: hva Rydde og Sanke kan gi, før spilleren velger. Ren logikk som bruker de samme
// formlene som dagsoppgjøret og aldri endrer tilstanden eller rng.
import { RES, SECTORS } from './data';
import { encounterChance, noiseProfile } from './encounters';
import { mods } from './phases';
import { KILL_ROLL_MIN, KILL_ROLL_SPAN, ryddeInjuryRisk, ryddeKillParams, sankeAmount, searchGain } from './sectors';
import { searchPower } from './skills';
import { sum } from './rng';
import type { CrewMember, GameState, ResKey, SectorId, Task } from './types';

export type TaskPreview =
  | {
      kind: 'rydde';
      /** forventede drap (høyst så mange som står i sektoren) */
      kills: number;
      /** zombier som står der nå */
      zombies: number;
      /** sannsynlighet for skade per person */
      risk: { id: string; name: string; risk: number }[];
      /** sjansen for at gruppa havner i en knipe */
      encounter: number;
    }
  | {
      kind: 'rydde-tom';
      /** forventet økning i gjennomsøkt, i prosentpoeng */
      searchGain: number;
      encounter: number;
    }
  | {
      kind: 'sanke';
      /** forventet utbytte per ressurs */
      yield: Partial<Record<ResKey, number>>;
    };

/**
 * Hva `task` kan gi for `team`, regnet med reglene i `rydde`, `sanke` og `encounterChance`. Null for oppdrag
 * uten forhåndsvisning eller uten noen i gruppa. Tilstanden og rng røres ikke.
 */
export function previewTask(s: GameState, task: Task, team: CrewMember[]): TaskPreview | null {
  if (!team.length) return null;
  if (task.type !== 'rydde' && task.type !== 'sanke') return null;
  const id: SectorId = task.target;
  const sec = s.sectors[id], def = SECTORS[id];
  // gruppa regnes med oppdraget satt, siden noen egenskaper avhenger av om personen hviler
  const group = team.map((c) => ({ ...c, task }));
  if (task.type === 'sanke') {
    if (sec.z > 0) return null;
    const power = sum(group.map((c) => searchPower(s, c)));
    const out: Partial<Record<ResKey, number>> = {};
    for (const r of RES) if (def.yield[r]) out[r] = sankeAmount(def.yield[r]!, power, mods(s));
    return { kind: 'sanke', yield: out };
  }
  const M = mods(s);
  const encounter = encounterChance(M, def.threat, noiseProfile(group));
  if (sec.z === 0) return { kind: 'rydde-tom', searchGain: searchGain(s, group), encounter };
  const { power, mult } = ryddeKillParams(s, id, group, M);
  const expected = power * (KILL_ROLL_MIN + KILL_ROLL_SPAN / 2) * mult;
  return {
    kind: 'rydde',
    kills: Math.min(sec.z, expected),
    zombies: sec.z,
    risk: group.map((c) => ({ id: c.id, name: c.name, risk: ryddeInjuryRisk(c, sec.z, power, id, M) })),
    encounter,
  };
}
