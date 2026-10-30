// Tokt og quests. Plassholderinnhold: mekanikken er det som gjelder.
import { GATES } from '../../../engine/data';
import { LANDMARKS, SECTORS, ZONES } from '../places';
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
  /** joins: en person som blir med når toktet er fullført */
  reward: { cards?: string[]; res?: Partial<Resources>; flag?: Flag; joins?: string };
  /** sjansen per dag for å finne en overlevende ute */
  recruit?: number;
  /** låst til en hendelse åpner det (unlockTokt) */
  locked?: true;
  /** første gang er det garantert: ingen knipe og ingen skader underveis */
  safeFirst?: true;
  /** belønningen ganges med dette etter første gang, fordi stedet er delvis tømt */
  repeat?: number;
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
    reward: { cards: ['u_kiste'], res: { skrap: 6, tre: 4 }, joins: 'roger' },
  },
  {
    id: 'bybrua', name: `Køen på ${LANDMARKS.bybrua}`,
    desc: 'Rushtrafikken sto stille i går, og står fortsatt stille. Bilene er fulle av ting folk ikke fikk tatt med på hytta.',
    at: 'sor', days: 2, threat: 3,
    reward: { res: { drivstoff: 8, skrap: 6, metall: 4 } },
    recruit: 0.2, locked: true, repeat: 0.5,
  },
  {
    id: 'apotek', name: `Apoteket ${ZONES.hundvag.at}`,
    desc: `Apotek 1 på senteret ${ZONES.hundvag.at}. Hyllene var fulle i går. Ingen har tenkt på dem siden, bortsett fra dere og alle andre.`,
    at: 'nord', days: 2, threat: 2,
    reward: { res: { medisin: 8 } },
    recruit: 0.1, locked: true, safeFirst: true, repeat: 0.4,
  },
  {
    id: 'grossist', name: `Grossistlageret på ${LANDMARKS.forus}`,
    desc: `Et grossistlager på ${LANDMARKS.forus}, helt på grensa mot ${LANDMARKS.sandnes}: paller med hermetikk, mel og tørrfisk til halve fylket. Det er langt å gå, og halve ${LANDMARKS.sandnes} har funnet veien dit før dere.`,
    at: 'sor', days: 3, threat: 4,
    reward: { res: { mat: 30, vann: 10 } },
    recruit: 0.1, locked: true, repeat: 0.5,
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
