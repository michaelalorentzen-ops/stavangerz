// Fasetabellen. All vanskelighetsgrad og alle zombieevner hentes herfra,
// aldri fra tall spredt rundt i motoren. Les modifikatorer med mods(s).
import type { Branch, Difficulty, GameState, PhaseId } from './types';
import { BRANCHES, branchMutations, MUTATIONS } from '../regions/content';
import { rand } from './rng';

export { BRANCHES, BRANCH_LABEL, MUTATIONS } from '../regions/content';

export interface PhaseModifiers {
  /** ganges med zombieantall i nye soner som åpnes i denne fasen */
  zombieMult: number;
  /** andel av en sones zombier som gjemmer seg i kjellere */
  hiddenRatio: number;
  /** ganges med drap per dag. Under 1 = seigere zombier */
  killMult: number;
  /** ganges med skaderisiko i kamp */
  injuryMult: number;
  /** sjansen for at hver person mister 1 helse en dag det er tomt for mat eller vann */
  starveInjury: number;
  /** legges til portenes grunnsjanse for nattlig gjennombrudd */
  nightBase: number;
  /** økning i gjennombruddssjanse per dag i fasen (phaseDay), ikke per dag i runden */
  nightGrowth: number;
  /** hvor mye hvert nivå på en sperring senker sjansen */
  nightLevelReduction: number;
  /** antall dager i fasen (phaseDay) per ekstra zombie i et gjennombrudd */
  breachDays: number;
  /** sjanse per gjemt zombie for at en kjeller bryter ut om natta */
  hiddenOutbreak: number;
  /** sjanse for et hendelseskort etter en dag */
  eventChance: number;
  /** trykk fra andre fraksjoner (fase 5) */
  factionPressure: number;
  /** kontroll en sektor mister per dag uten folk */
  controlDecay: number;
  /**
   * kontroll en sektor fra en tidligere fase mister per dag uten folk (fase 2–5: Buøy holdes, men forfaller sakte).
   * I fase 1 finnes ingen slike sektorer, så verdien der er den samme som controlDecay og brukes ikke.
   */
  heldDecay: number;
  /** gjennomsøkt-prosent en sektor mister per dag når kontrollen er under 30 */
  searchedDecay: number;
  /** grunnsjanse per dag for at en sektor uten kontroll får en zombie til */
  creepChance: number;
  /** sjanse for et encounter når crewet er ute (brukes i Oppgave 5) */
  encounterChance: number;
  /** maks antall dager i fasen. Når den er nådd, er fasen over */
  turnCap: number;
  /** andelen mat som er igjen i sektorlagrene etter hver 10. dag */
  foodRot: number;
  /** sjanse for at Rydde i en tom sektor gir et utstyrskort */
  cardFind: number;
  /** sjanse per Rydde-gruppe med bråk-våpen for at en zombie trekkes til sektoren om natta */
  noiseAttract: number;
  /** ganges med ressursene som ligger i sektorene når de åpnes */
  lootMult: number;
  /** ganges med det Sanke gir per dag */
  yieldMult: number;
  /** sjansen for regn som fyller vanntankene hver dag */
  rainChance: number;
  /** tre per person per dag til fyring. Stavanger-høst. */
  heatPerCrew: number;
  /** andel av maten på lageret som blir dårlig hver dag. Hamstring lønner seg ikke. */
  stashRot: number;
  /** sjansen per natt for at én i crewet drar for godt når moralen er under MORAL_DESERT (engine.ts) */
  desertChance: number;
}

export interface PhaseDef {
  id: PhaseId;
  name: string;
  focus: string;
  mods: PhaseModifiers;
  /** hvor mange mutasjonspoeng [min, maks] som trekkes når fasen starter */
  mutationPoints: [number, number];
}

/** Fasene som er bygd. Når den siste av dem avsluttes, er runden vunnet («Fortsettelse følger»). */
export const BUILT_PHASES: PhaseId = 2;

export const PHASES: Record<PhaseId, PhaseDef> = {
  1: {
    id: 1, name: 'Utbruddet', focus: 'Rydd hjemsonen, sank det dere trenger, sett opp perimeter.',
    mods: { zombieMult: 1, hiddenRatio: 0.25, killMult: 0.73, injuryMult: 2, starveInjury: 0.2, nightBase: 0, nightGrowth: 0.0072, nightLevelReduction: 0.15, breachDays: 5, hiddenOutbreak: 0.18, eventChance: 0.6, factionPressure: 0, heldDecay: 5, controlDecay: 5, searchedDecay: 2, creepChance: 0.12, encounterChance: 0.33, turnCap: 50, foodRot: 0.85, cardFind: 0.25, noiseAttract: 0.3, lootMult: 0.75, yieldMult: 0.75, rainChance: 0.35, heatPerCrew: 0, stashRot: 0.03, desertChance: 0.08 },
    mutationPoints: [0, 0],
  },
  2: {
    id: 2, name: 'Hovedkvarter', focus: 'Finn transport, ta et HQ, fordel roller.',
    mods: { zombieMult: 1.45, hiddenRatio: 0.28, killMult: 0.65, injuryMult: 2.2, starveInjury: 0.22, nightBase: 0.05, nightGrowth: 0.0085, nightLevelReduction: 0.15, breachDays: 6, hiddenOutbreak: 0.19, eventChance: 0.6, factionPressure: 0, heldDecay: 1, controlDecay: 6, searchedDecay: 2, creepChance: 0.15, encounterChance: 0.37, turnCap: 60, foodRot: 0.8, cardFind: 0.25, noiseAttract: 0.35, lootMult: 0.6, yieldMult: 0.95, rainChance: 0.4, heatPerCrew: 0.12, stashRot: 0.03, desertChance: 0.18 },
    mutationPoints: [1, 2],
  },
  3: {
    id: 3, name: 'Ekspansjon', focus: 'Ta naboområder, få crew-ledere, rekrutter ved porten.',
    mods: { zombieMult: 1.6, hiddenRatio: 0.3, killMult: 0.62, injuryMult: 2.4, starveInjury: 0.24, nightBase: 0.1, nightGrowth: 0.009, nightLevelReduction: 0.14, breachDays: 5.5, hiddenOutbreak: 0.2, eventChance: 0.55, factionPressure: 0, heldDecay: 1.5, controlDecay: 7, searchedDecay: 3, creepChance: 0.18, encounterChance: 0.4, turnCap: 70, foodRot: 0.75, cardFind: 0.25, noiseAttract: 0.4, lootMult: 0.55, yieldMult: 0.65, rainChance: 0.3, heatPerCrew: 0.12, stashRot: 0.03, desertChance: 0.2 },
    mutationPoints: [1, 3],
  },
  4: {
    id: 4, name: 'Bydel', focus: 'Hold hele bydeler, ikke voks fortere enn forsvaret tåler.',
    mods: { zombieMult: 1.9, hiddenRatio: 0.3, killMult: 0.6, injuryMult: 2.6, starveInjury: 0.26, nightBase: 0.14, nightGrowth: 0.009, nightLevelReduction: 0.13, breachDays: 5, hiddenOutbreak: 0.21, eventChance: 0.5, factionPressure: 0.1, heldDecay: 2, controlDecay: 8, searchedDecay: 3, creepChance: 0.2, encounterChance: 0.44, turnCap: 80, foodRot: 0.75, cardFind: 0.25, noiseAttract: 0.4, lootMult: 0.5, yieldMult: 0.6, rainChance: 0.3, heatPerCrew: 0.12, stashRot: 0.03, desertChance: 0.22 },
    mutationPoints: [2, 3],
  },
  5: {
    id: 5, name: 'Fraksjoner', focus: 'Andre overlevende vil ha det du har. Handel eller krig.',
    mods: { zombieMult: 1.4, hiddenRatio: 0.25, killMult: 0.72, injuryMult: 2.6, starveInjury: 0.26, nightBase: 0.04, nightGrowth: 0.0045, nightLevelReduction: 0.13, breachDays: 6, hiddenOutbreak: 0.1, eventChance: 0.6, factionPressure: 0.4, heldDecay: 2, controlDecay: 8, searchedDecay: 3, creepChance: 0.15, encounterChance: 0.37, turnCap: 90, foodRot: 0.75, cardFind: 0.25, noiseAttract: 0.3, lootMult: 0.5, yieldMult: 0.6, rainChance: 0.3, heatPerCrew: 0.12, stashRot: 0.03, desertChance: 0.25 },
    mutationPoints: [1, 2],
  },
};

export interface DifficultyDef {
  name: string;
  desc: string;
  /** ganger på fasetabellen. Mangler en nøkkel, er den 1. Normal er 1 overalt */
  mult: Partial<Record<keyof PhaseModifiers, number>>;
  /** prisen når fristen går ut uten at målet er nådd, eller null når runden er tapt */
  deadline: null | {
    /** moral som trekkes fra */
    moral: number;
    /** andel av en ikke-trygg sektors startzombier som kommer tilbake */
    fall: number;
    /** ekstra mutasjonspoeng ved faseskiftet */
    mutations: number;
  };
}

/**
 * Vanskelighetsgradene. Gangene legges oppå fasetabellen i mods(), så fase 1 til 5 skalerer likt.
 * Normal er 1 overalt: balansen i kapittel 11 i spilldesignet måles på normal.
 */
export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  normal: {
    name: 'Normal', desc: 'Går fristen ut, må dere videre likevel, men det koster.', mult: {},
    deadline: { moral: 15, fall: 0.5, mutations: 1 },
  },
  hard: {
    name: 'Hard', desc: 'Sterkere zombier og mindre å leve av. Går fristen ut, må dere videre til en høy pris.',
    mult: { zombieMult: 1.05, killMult: 0.9, injuryMult: 1.2, nightGrowth: 1.4, hiddenOutbreak: 2.2, creepChance: 2.2, lootMult: 0.85, yieldMult: 0.85, rainChance: 0.85, stashRot: 1.5 },
    deadline: { moral: 30, fall: 1, mutations: 2 },
  },
  brutal: {
    name: 'Brutal', desc: 'Sterkeste zombier og knapt noe å leve av. Går fristen ut, er runden tapt.',
    mult: { zombieMult: 1.1, killMult: 0.87, injuryMult: 1.3, nightGrowth: 1.6, hiddenOutbreak: 2.8, creepChance: 2.8, lootMult: 0.75, yieldMult: 0.8, rainChance: 0.75, stashRot: 2 },
    deadline: null,
  },
};

export const DIFFICULTIES = Object.keys(DIFFICULTY) as Difficulty[];

/** Fasens modifikatorer med vanskelighetsgraden og mutasjonene ganget inn. Kjente mutasjoner får halv effekt. */
export function mods(s: Pick<GameState, 'phase' | 'mutations' | 'knownMutations'> & { difficulty?: Difficulty }): PhaseModifiers {
  const m = { ...PHASES[s.phase].mods };
  for (const [k, f] of Object.entries(DIFFICULTY[s.difficulty ?? 'normal'].mult) as [keyof PhaseModifiers, number][]) m[k] *= f;
  for (const id of s.mutations) {
    if (!MUTATIONS[id]) continue; // ukjent id i en gammel lagring
    const known = s.knownMutations.includes(id);
    for (const [k, f] of Object.entries(MUTATIONS[id].mult) as [keyof PhaseModifiers, number][]) m[k] *= known ? 1 + (f - 1) * 0.5 : f;
  }
  return m;
}

/**
 * Dagen i fasen, 1 på fasens første dag. Nattepresset vokser med den, ikke med dagen i runden:
 * hver fase har sin egen nightBase, og fase 1 starter på dag 1, så der er det det samme som s.day.
 */
export const phaseDay = (s: Pick<GameState, 'day' | 'phaseStartDay'>): number => s.day - s.phaseStartDay + 1;

/** Har zombiene fått mutasjonen? */
export const hasMutation = (s: Pick<GameState, 'mutations'>, id: string): boolean => s.mutations.includes(id);

/** Neste mutasjon i grenen som ikke er tatt ennå, eller null når grenen er full. */
function nextInBranch(s: GameState, b: Branch): string | null {
  return branchMutations(b).find((m) => !s.mutations.includes(m.id))?.id ?? null;
}

/**
 * Går til neste fase og trekker mutasjonspoeng. Hvert poeng velger en gren
 * vektet med branchWeights, blant grener som har en neste mutasjon.
 * Returnerer mutasjonene som ble lagt til.
 */
export function advancePhase(s: GameState, extraPoints = 0): string[] {
  if (s.phase >= 5) return [];
  s.phase = (s.phase + 1) as PhaseId;
  s.phaseStartDay = s.day;
  s.goalDay = null;
  const [min, max] = PHASES[s.phase].mutationPoints;
  const points = min + Math.floor(rand(s) * (max - min + 1)) + extraPoints;
  const added: string[] = [];
  for (let i = 0; i < points; i++) {
    const open = BRANCHES.filter((b) => nextInBranch(s, b));
    if (!open.length) break;
    let r = rand(s) * open.reduce((a, b) => a + s.branchWeights[b], 0);
    const branch = open.find((b) => (r -= s.branchWeights[b]) < 0) ?? open[open.length - 1];
    const id = nextInBranch(s, branch)!;
    s.mutations.push(id);
    added.push(id);
  }
  return added;
}
