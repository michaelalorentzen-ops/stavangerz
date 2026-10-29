// Crewet: skader, død og plass. Mer kommer i senere oppgaver (ny leder, rekruttering).
import { dropGear, wear } from './cards';
import { GATES, HEALTH_LABEL, SECTORS, PLAYABLE } from './data';
import { pick } from './rng';
import type { CrewMember, GameState, LogKind, SectorId } from './types';

export type LogFn = (t: string, kind?: LogKind) => void;

const EULOGY: ((c: CrewMember) => string)[] = [
  (c) => `Hvil i fred, ${c.name}. Vi tar vare på kaffekoppen din.`,
  (c) => `${c.name} er ikke lenger med oss. Teknisk sett er ${c.name} fortsatt med oss, bare ikke på vår side.`,
  () => 'Crewet holder ett minutts stillhet. Det blir avbrutt av stønning fra Bybrua.',
];

/** Sektoren personen jobber i, eller 'stash' når personen er hjemme eller hviler. */
function taskSector(c: CrewMember): SectorId | 'stash' {
  const t = c.task;
  if (t.type === 'rydde' || t.type === 'sanke') return t.target === 'hjem' ? 'stash' : t.target;
  if (t.type === 'befeste') return GATES[t.target].sector === 'hjem' ? 'stash' : GATES[t.target].sector;
  return 'stash';
}

/** Gir ett skadetrinn. Ved 0 er personen bitt og fjernes fra crewet. */
export function injure(s: GameState, c: CrewMember, why: string, log: LogFn) {
  c.hp -= 1;
  if (c.hp <= 0) {
    log(`${c.name} ble bitt ${why}. ${pick(s, EULOGY)(c)}`, 'bad');
    s.moral -= 15; s.stats.lost++;
    dropGear(s, c, taskSector(c));
    s.crew = s.crew.filter((x) => x !== c);
  } else {
    log(`${c.name} ble skadet ${why} (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'warn');
    wear(s, c, 'beskyttelse', log);
  }
}

/** Antall sengeplasser: summen av kapasitet i sektorer som er bosatt. */
export function housing(s: GameState): number {
  return PLAYABLE.reduce((n, id) => n + (s.sectors[id].settled ? SECTORS[id].capacity : 0), 0);
}

export const canRecruit = (s: GameState): boolean => s.crew.length < housing(s);
