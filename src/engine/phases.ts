// Fasetabellen. All vanskelighetsgrad og alle zombieevner hentes herfra,
// aldri fra tall spredt rundt i motoren. Les modifikatorer med mods(s).
import type { Branch, GameState, PhaseId } from './types';
import { BRANCHES, branchMutations, MUTATIONS } from './content/mutations';
import { rand } from './rng';

export { BRANCHES, BRANCH_LABEL, MUTATIONS } from './content/mutations';

export interface PhaseModifiers {
  /** ganges med zombieantall i nye soner som åpnes i denne fasen */
  zombieMult: number;
  /** andel av en sones zombier som gjemmer seg i kjellere */
  hiddenRatio: number;
  /** ganges med drap per dag. Under 1 = seigere zombier */
  killMult: number;
  /** ganges med skaderisiko i kamp */
  injuryMult: number;
  /** legges til portenes grunnsjanse for nattlig gjennombrudd */
  nightBase: number;
  /** økning i gjennombruddssjanse per dag */
  nightGrowth: number;
  /** hvor mye hvert nivå på en sperring senker sjansen */
  nightLevelReduction: number;
  /** antall dager per ekstra zombie i et gjennombrudd */
  breachDays: number;
  /** sjanse per gjemt zombie for at en kjeller bryter ut om natta */
  hiddenOutbreak: number;
  /** sjanse for et hendelseskort etter en dag */
  eventChance: number;
  /** trykk fra andre fraksjoner (fase 5) */
  factionPressure: number;
  /** kontroll en sektor mister per dag uten folk */
  controlDecay: number;
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
}

export interface PhaseDef {
  id: PhaseId;
  name: string;
  focus: string;
  mods: PhaseModifiers;
  /** hvor mange mutasjonspoeng [min, maks] som trekkes når fasen starter */
  mutationPoints: [number, number];
}

export const PHASES: Record<PhaseId, PhaseDef> = {
  1: {
    id: 1, name: 'Utbruddet', focus: 'Klarer hjemsonen, let etter utstyr, sett opp perimeter.',
    mods: { zombieMult: 1, hiddenRatio: 0.25, killMult: 1, injuryMult: 1, nightBase: 0, nightGrowth: 0.004, nightLevelReduction: 0.15, breachDays: 6, hiddenOutbreak: 0.1, eventChance: 0.6, factionPressure: 0, controlDecay: 5, searchedDecay: 2, creepChance: 0.12, encounterChance: 0.18, turnCap: 50, foodRot: 0.85, cardFind: 0.25, noiseAttract: 0.3 },
    mutationPoints: [0, 0],
  },
  2: {
    id: 2, name: 'Hovedkvarter', focus: 'Finn transport, ta et HQ, fordel roller.',
    mods: { zombieMult: 1.3, hiddenRatio: 0.28, killMult: 0.95, injuryMult: 1.1, nightBase: 0.03, nightGrowth: 0.005, nightLevelReduction: 0.15, breachDays: 5, hiddenOutbreak: 0.11, eventChance: 0.6, factionPressure: 0, controlDecay: 6, searchedDecay: 2, creepChance: 0.15, encounterChance: 0.2, turnCap: 60, foodRot: 0.8, cardFind: 0.25, noiseAttract: 0.35 },
    mutationPoints: [1, 2],
  },
  3: {
    id: 3, name: 'Ekspansjon', focus: 'Ta naboområder, få crew-ledere, rekrutter ved porten.',
    mods: { zombieMult: 1.6, hiddenRatio: 0.3, killMult: 0.9, injuryMult: 1.2, nightBase: 0.06, nightGrowth: 0.006, nightLevelReduction: 0.14, breachDays: 4.5, hiddenOutbreak: 0.12, eventChance: 0.55, factionPressure: 0, controlDecay: 7, searchedDecay: 3, creepChance: 0.18, encounterChance: 0.22, turnCap: 70, foodRot: 0.75, cardFind: 0.25, noiseAttract: 0.4 },
    mutationPoints: [1, 3],
  },
  4: {
    id: 4, name: 'Bydel', focus: 'Hold hele bydeler, ikke voks fortere enn forsvaret tåler.',
    mods: { zombieMult: 1.9, hiddenRatio: 0.3, killMult: 0.85, injuryMult: 1.3, nightBase: 0.08, nightGrowth: 0.006, nightLevelReduction: 0.13, breachDays: 4, hiddenOutbreak: 0.13, eventChance: 0.5, factionPressure: 0.1, controlDecay: 8, searchedDecay: 3, creepChance: 0.2, encounterChance: 0.24, turnCap: 80, foodRot: 0.75, cardFind: 0.25, noiseAttract: 0.4 },
    mutationPoints: [2, 3],
  },
  5: {
    id: 5, name: 'Fraksjoner', focus: 'Andre overlevende vil ha det du har. Handel eller krig.',
    mods: { zombieMult: 1.4, hiddenRatio: 0.25, killMult: 0.85, injuryMult: 1.3, nightBase: 0.02, nightGrowth: 0.003, nightLevelReduction: 0.13, breachDays: 5, hiddenOutbreak: 0.1, eventChance: 0.6, factionPressure: 0.4, controlDecay: 8, searchedDecay: 3, creepChance: 0.15, encounterChance: 0.2, turnCap: 90, foodRot: 0.75, cardFind: 0.25, noiseAttract: 0.3 },
    mutationPoints: [1, 2],
  },
};

/** Fasens modifikatorer med mutasjonene ganget inn. Kjente mutasjoner får halv effekt. */
export function mods(s: Pick<GameState, 'phase' | 'mutations' | 'knownMutations'>): PhaseModifiers {
  const m = { ...PHASES[s.phase].mods };
  for (const id of s.mutations) {
    if (!MUTATIONS[id]) continue; // ukjent id i en gammel lagring
    const known = s.knownMutations.includes(id);
    for (const [k, f] of Object.entries(MUTATIONS[id].mult) as [keyof PhaseModifiers, number][]) m[k] *= known ? 1 + (f - 1) * 0.5 : f;
  }
  return m;
}

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
export function advancePhase(s: GameState): string[] {
  if (s.phase >= 5) return [];
  s.phase = (s.phase + 1) as PhaseId;
  s.phaseStartDay = s.day;
  s.goalDay = null;
  const [min, max] = PHASES[s.phase].mutationPoints;
  const points = min + Math.floor(rand(s) * (max - min + 1));
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
