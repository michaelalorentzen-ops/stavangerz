// Fremmede overlevende i hendelser og encounters. Den som er alene, kan verves med en svært vanskelig
// Prat-sjekk. Grupper kan dere handle med, true eller la være, men de blir aldri med: da vokser crewet for fort.
import { addNeighbor, canRecruit, recruitablesNow } from '../../../engine/crew';
import type { NeighborDef } from '../../../engine/data';
import type { GameState } from '../../../engine/types';

/**
 * Grunnsjansen (checkBase) for å verve en fremmed. En vanlig sjekk har 0,25. Med −0,25 har den beste
 * praten i startcrewet (58) rundt 45 %, en vanlig (38) rundt 20 %, og en dårlig så vidt noe.
 */
export const STRANGER_BASE = -0.25;

/** Den fremmede dere møter i dag: en ekte nabo som kan bli med, eller ingen. Avhenger bare av dagen og seeden, så teksten og valget peker på samme person. */
export const stranger = (s: GameState): NeighborDef | undefined => {
  const c = recruitablesNow(s);
  return c.length ? c[(s.day + Math.abs(s.seed)) % c.length] : undefined;
};

/** Kan den fremmede bli med i dag? Det må finnes en, og det må være en seng ledig. */
export const canRecruitStranger = (s: GameState): boolean => !!stranger(s) && canRecruit(s);

/** Navnet på den fremmede i en tekst, eller en reserve når ingen kan bli med. */
export const strangerName = (s: GameState, fallback: string): string => stranger(s)?.name ?? fallback;

/** «Mona (41), sykepleier,» om den fremmede, eller reserven. */
export const strangerIntro = (s: GameState, fallback: string): string => {
  const n = stranger(s);
  return n ? `${n.name} (${n.age}), ${n.role.toLowerCase()},` : fallback;
};

/**
 * Prøver å verve den fremmede. Uten noen å verve eller uten seng, sier teksten hvorfor. `no` er teksten når
 * sjekken går galt, med navnet inn.
 */
export function recruitStranger(s: GameState, ok: boolean, no: (name: string) => string): string {
  const n = stranger(s);
  if (!n) return 'Det viser seg at det ikke er noen som vil bli med likevel (ingenting).';
  if (!canRecruit(s)) return `${n.name} ville kanskje blitt med, men dere har ikke senger til ${s.crew.length + 1} (ingenting).`;
  if (!ok) return no(n.name);
  addNeighbor(s, n.id);
  return `${n.name} blir med i crewet. «${n.quip}» (${n.name} er med i crewet).`;
}
