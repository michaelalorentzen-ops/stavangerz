// Tokt og quests. Plassholderinnhold: mekanikken er det som gjelder.
import { GATES } from '../../../engine/data';
import { LANDMARKS, SECTORS } from '../places';
import type { Flag, GateId, Resources, SectorId } from '../../../engine/types';

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
  /** gate: portarbeid som bare et tokt kan skaffe (materialer i bulk). recruit: sjansen per dag for å finne en overlevende ute. */
  reward: { cards?: string[]; res?: Partial<Resources>; flag?: Flag; gate?: { id: GateId; work: number; text: string } };
  recruit?: number;
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
    id: 'kran', name: `Kranføreren på ${GATES.ros.name}`,
    desc: 'Kranføreren sitter fast i førerhuset, rett over horden. Han har radio, kaffe og sterke meninger om sikkerhetsrutiner.',
    at: 'ros', days: 2, threat: 3, quest: 'sos_kran',
    reward: { cards: ['u_kiste'], res: { skrap: 6, tre: 4 }, gate: { id: 'ros', work: 18, text: 'Roger heiser tre containere inn mot gjerdet før han klatrer ned' } },
    recruit: 0.1,
  },
  {
    id: 'bybrua', name: `Køen på ${LANDMARKS.bybrua}`,
    desc: 'Rushtrafikken sto stille i går, og står fortsatt stille. Bilene er fulle av ting folk ikke fikk tatt med på hytta.',
    at: 'sor', days: 2, threat: 3,
    reward: { res: { drivstoff: 6, skrap: 6, mat: 4 }, gate: { id: 'sor', work: 18, text: 'dere dytter to bilvrak inn foran sperringen på vei hjem' } },
    recruit: 0.25,
  },
];

export const QUESTS: QuestDef[] = [
  {
    id: 'sos_kran', title: 'SOS fra kranføreren',
    text: `Kranføreren ${SECTORS.rosenberg.at} sitter fast i førerhuset og trenger hjelp. Han lover en ordentlig takk.`,
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
