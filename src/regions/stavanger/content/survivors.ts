// Fremmede overlevende i hendelser og encounters. Den som er alene, kan verves med en svært vanskelig
// Prat-sjekk. Grupper kan dere handle med, true eller la være, men de blir aldri med: da vokser crewet for fort.
import { addNeighbor, canRecruit, recruitablesNow } from '../../../engine/crew';
import type { NeighborDef } from '../../../engine/data';
import { rand } from '../../../engine/rng';
import type { GameState } from '../../../engine/types';
import { NEIGHBORS } from '../people';

/**
 * Grunnsjansen (checkBase) for å verve en fremmed. En vanlig sjekk har 0,25. Med −0,25 har den beste
 * praten i startcrewet (58) rundt 45 %, en vanlig (38) rundt 20 %, og en dårlig så vidt noe.
 */
export const STRANGER_BASE = -0.25;

/**
 * Historiene en fremmed kan ha. Hver historie hører til én hendelse eller ett encounter, og hver person får
 * høyst én historie per runde. Da møter dere aldri samme person to steder samme dag, og den som bodde i
 * seilbåten, dukker ikke opp i et naust neste uke.
 */
export type StrangerStory = 'tesla' | 'seilbat' | 'sjark' | 'naust' | 'snekke' | 'rekvirert' | 'turnus' | 'finn';

/** Historiene i den rekkefølgen de fordeles. De med krav om hvem som passer, fordeles først. */
const STORIES: { id: StrangerStory; fits?: (n: NeighborDef) => boolean }[] = [
  // hjem fra turnus på riggen: i arbeidsfør alder, ikke russ og ikke pensjonist
  { id: 'turnus', fits: (n) => n.age >= 20 && n.age < 62 },
  { id: 'tesla' }, { id: 'seilbat' }, { id: 'sjark' }, { id: 'naust' }, { id: 'snekke' }, { id: 'rekvirert' }, { id: 'finn' },
];

const casts = new Map<number, Partial<Record<StrangerStory, string>>>();
/**
 * Hvem som har hvilken historie i denne runden. Fast for seeden, og trekker fra en egen rng laget av seeden,
 * så `state.rng` og dermed resten av runden ikke påvirkes.
 */
function cast(seed: number): Partial<Record<StrangerStory, string>> {
  const hit = casts.get(seed);
  if (hit) return hit;
  const r = { rng: (seed ^ 0x51a7e) | 0 };
  const pool = NEIGHBORS.filter((n) => !n.special);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand(r) * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const out: Partial<Record<StrangerStory, string>> = {};
  for (const st of STORIES) {
    const n = pool.find((x) => !st.fits || st.fits(x));
    if (!n) continue;
    out[st.id] = n.id;
    pool.splice(pool.indexOf(n), 1);
  }
  casts.set(seed, out);
  return out;
}

/**
 * Den fremmede i historien: personen som har den i denne runden, så lenge hen fortsatt er der ute (ikke i
 * crewet, ikke borte). Ellers ingen, og teksten bruker en reserve. Avhenger ikke av dagen, så teksten og valget
 * peker på samme person, også med flere ventende kort samme dag.
 */
export const stranger = (s: GameState, story: StrangerStory): NeighborDef | undefined => {
  const id = cast(s.seed)[story];
  return id ? recruitablesNow(s).find((n) => n.id === id) : undefined;
};

/** Kan den fremmede bli med i dag? Det må finnes en, og det må være en seng ledig. */
export const canRecruitStranger = (s: GameState, story: StrangerStory): boolean => !!stranger(s, story) && canRecruit(s);

/** Navnet på den fremmede i en tekst, eller en reserve når ingen kan bli med. */
export const strangerName = (s: GameState, story: StrangerStory, fallback: string): string => stranger(s, story)?.name ?? fallback;

/** «Mona (41), sykepleier,» om den fremmede, eller reserven. */
export const strangerIntro = (s: GameState, story: StrangerStory, fallback: string): string => {
  const n = stranger(s, story);
  return n ? `${n.name} (${n.age}), ${n.role.toLowerCase()},` : fallback;
};

/**
 * Prøver å verve den fremmede. Uten noen å verve eller uten seng, sier teksten hvorfor. `no` er teksten når
 * sjekken går galt, med navnet inn.
 */
export function recruitStranger(s: GameState, story: StrangerStory, ok: boolean, no: (name: string) => string): string {
  const n = stranger(s, story);
  if (!n) return 'Det viser seg at det ikke er noen som vil bli med likevel (ingenting).';
  if (!canRecruit(s)) return `${n.name} ville kanskje blitt med, men dere har ikke senger til ${s.crew.length + 1} (ingenting).`;
  if (!ok) return no(n.name);
  addNeighbor(s, n.id);
  return `${n.name} blir med i crewet. «${n.quip}» (${n.name} er med i crewet).`;
}
