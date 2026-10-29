// Tokt og quests. Plassholderinnhold: mekanikken er det som gjelder.
import { GATES } from '../data';
import type { Flag, GateId, Resources, SectorId } from '../types';

export interface ToktDef {
  id: string;
  name: string;
  desc: string;
  /** målet: en sektor eller en port */
  at: SectorId | GateId;
  /** antall dager ute før reisen kan fullføres */
  days: number;
  threat: 1 | 2 | 3 | 4 | 5;
  /** id til questen som låser opp toktet. Uten quest er toktet fritt. */
  quest?: string;
  reward: { cards?: string[]; res?: Partial<Resources>; flag?: Flag };
}

export interface QuestDef {
  id: string;
  title: string;
  text: string;
  tokt: string;
  /** dager fra akseptert til fristen går ut */
  deadline: number;
}

export const TOKTS: ToktDef[] = [
  {
    id: 'kran', name: 'Kranføreren på Rosenberg-gjerdet',
    desc: 'Kranføreren sitter fast i førerhuset, rett over horden. Han har radio, kaffe og sterke meninger om sikkerhetsrutiner.',
    at: 'ros', days: 2, threat: 3, quest: 'sos_kran',
    reward: { cards: ['u_kiste'], res: { skrap: 4 } },
  },
  {
    id: 'bybrua', name: 'Køen på Bybrua',
    desc: 'Rushtrafikken sto stille i går, og står fortsatt stille. Bilene er fulle av ting folk ikke fikk tatt med på hytta.',
    at: 'sor', days: 2, threat: 3,
    reward: { res: { drivstoff: 4, skrap: 4 } },
  },
];

export const QUESTS: QuestDef[] = [
  {
    id: 'sos_kran', title: 'SOS fra kranføreren',
    text: 'Kranføreren på Rosenberg sitter fast i førerhuset og trenger hjelp. Han lover en ordentlig takk.',
    tokt: 'kran', deadline: 6,
  },
];

export const toktDef = (id: string): ToktDef => {
  const d = TOKTS.find((t) => t.id === id);
  if (!d) throw new Error(`Ukjent tokt: ${id}`);
  return d;
};
export const questDef = (id: string): QuestDef => {
  const d = QUESTS.find((q) => q.id === id);
  if (!d) throw new Error(`Ukjent quest: ${id}`);
  return d;
};

/** Sektoren toktet går til. For en port er det sektoren porten ligger i. */
export const toktSector = (d: ToktDef): SectorId => (d.at in GATES ? GATES[d.at as GateId].sector : (d.at as SectorId));
