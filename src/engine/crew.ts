// Crewet: skader, død og plass. Mer kommer i senere oppgaver (ny leder, rekruttering).
import { HEALTH_LABEL, SECTORS, PLAYABLE } from './data';
import { pick } from './rng';
import type { CrewMember, GameState, LogKind } from './types';

export type LogFn = (t: string, kind?: LogKind) => void;

const EULOGY: ((c: CrewMember) => string)[] = [
  (c) => `Hvil i fred, ${c.name}. Vi tar vare på kaffekoppen din.`,
  (c) => `${c.name} er ikke lenger med oss. Teknisk sett er ${c.name} fortsatt med oss, bare ikke på vår side.`,
  () => 'Crewet holder ett minutts stillhet. Det blir avbrutt av stønning fra Bybrua.',
];

/** Gir ett skadetrinn. Ved 0 er personen bitt og fjernes fra crewet. */
export function injure(s: GameState, c: CrewMember, why: string, log: LogFn) {
  c.hp -= 1;
  if (c.hp <= 0) {
    log(`${c.name} ble bitt ${why}. ${pick(s, EULOGY)(c)}`, 'bad');
    s.moral -= 15; s.stats.lost++;
    s.crew = s.crew.filter((x) => x !== c);
  } else log(`${c.name} ble skadet ${why} (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'warn');
}

/** Antall sengeplasser: summen av kapasitet i sektorer som er bosatt. */
export function housing(s: GameState): number {
  return PLAYABLE.reduce((n, id) => n + (s.sectors[id].settled ? SECTORS[id].capacity : 0), 0);
}

export const canRecruit = (s: GameState): boolean => s.crew.length < housing(s);
