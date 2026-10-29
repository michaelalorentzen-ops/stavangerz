// Fasetabellen. All vanskelighetsgrad og alle zombieevner hentes herfra,
// aldri fra tall spredt rundt i motoren. Les modifikatorer med mods(s).
import type { GameState, PhaseId, ZombieTraitId } from './types';
import { pick, rand } from './rng';

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
}

export interface PhaseDef {
  id: PhaseId;
  name: string;
  focus: string;
  mods: PhaseModifiers;
  /** zombieevner som kan dukke opp når fasen starter */
  traitPool: ZombieTraitId[];
  /** hvor mange nye evner som trekkes ved faseskiftet */
  newTraits: number;
}

export const PHASES: Record<PhaseId, PhaseDef> = {
  1: {
    id: 1, name: 'Utbruddet', focus: 'Klarer hjemsonen, let etter utstyr, sett opp perimeter.',
    mods: { zombieMult: 1, hiddenRatio: 0.25, killMult: 1, injuryMult: 1, nightBase: 0, nightGrowth: 0.004, nightLevelReduction: 0.15, breachDays: 6, hiddenOutbreak: 0.1, eventChance: 0.6, factionPressure: 0 },
    traitPool: [], newTraits: 0,
  },
  2: {
    id: 2, name: 'Hovedkvarter', focus: 'Finn transport, ta et HQ, fordel roller.',
    mods: { zombieMult: 1.3, hiddenRatio: 0.28, killMult: 0.95, injuryMult: 1.1, nightBase: 0.03, nightGrowth: 0.005, nightLevelReduction: 0.15, breachDays: 5, hiddenOutbreak: 0.11, eventChance: 0.6, factionPressure: 0 },
    traitPool: ['lopere', 'kjellerkrypere'], newTraits: 1,
  },
  3: {
    id: 3, name: 'Ekspansjon', focus: 'Ta naboområder, få crew-ledere, rekrutter ved porten.',
    mods: { zombieMult: 1.6, hiddenRatio: 0.3, killMult: 0.9, injuryMult: 1.2, nightBase: 0.06, nightGrowth: 0.006, nightLevelReduction: 0.14, breachDays: 4.5, hiddenOutbreak: 0.12, eventChance: 0.55, factionPressure: 0 },
    traitPool: ['lopere', 'kjellerkrypere', 'flokk', 'seige'], newTraits: 1,
  },
  4: {
    id: 4, name: 'Bydel', focus: 'Hold hele bydeler, ikke voks fortere enn forsvaret tåler.',
    mods: { zombieMult: 1.9, hiddenRatio: 0.3, killMult: 0.85, injuryMult: 1.3, nightBase: 0.08, nightGrowth: 0.006, nightLevelReduction: 0.13, breachDays: 4, hiddenOutbreak: 0.13, eventChance: 0.5, factionPressure: 0.1 },
    traitPool: ['lopere', 'kjellerkrypere', 'flokk', 'seige', 'smarte'], newTraits: 1,
  },
  5: {
    id: 5, name: 'Fraksjoner', focus: 'Andre overlevende vil ha det du har. Handel eller krig.',
    mods: { zombieMult: 1.4, hiddenRatio: 0.25, killMult: 0.85, injuryMult: 1.3, nightBase: 0.02, nightGrowth: 0.003, nightLevelReduction: 0.13, breachDays: 5, hiddenOutbreak: 0.1, eventChance: 0.6, factionPressure: 0.4 },
    traitPool: ['lopere', 'kjellerkrypere', 'flokk', 'seige', 'smarte'], newTraits: 1,
  },
};

export interface ZombieTraitDef {
  name: string;
  desc: string;
  /** endringer som ganges inn i fasens modifikatorer */
  mult: Partial<Record<keyof PhaseModifiers, number>>;
}

export const ZOMBIE_TRAITS: Record<ZombieTraitId, ZombieTraitDef> = {
  lopere: { name: 'Løpere', desc: 'Noen av dem har begynt å jogge. Flere skader i kamp.', mult: { injuryMult: 1.25 } },
  kjellerkrypere: { name: 'Kjellerkrypere', desc: 'De har lært seg å gjemme seg. Flere kjellere bryter ut.', mult: { hiddenRatio: 1.3, hiddenOutbreak: 1.4 } },
  flokk: { name: 'Flokk', desc: 'De kommer i grupper. Gjennombrudd blir større.', mult: { breachDays: 0.75 } },
  seige: { name: 'Seige', desc: 'De tåler mer juling enn før.', mult: { killMult: 0.85 } },
  smarte: { name: 'Smarte', desc: 'De tester sperringene om natta, igjen og igjen.', mult: { nightBase: 1.5, nightLevelReduction: 0.85 } },
};

/** Fasens modifikatorer med de aktive zombieevnene ganget inn. */
export function mods(s: Pick<GameState, 'phase' | 'zombieTraits'>): PhaseModifiers {
  const m = { ...PHASES[s.phase].mods };
  for (const t of s.zombieTraits) {
    for (const [k, f] of Object.entries(ZOMBIE_TRAITS[t].mult) as [keyof PhaseModifiers, number][]) m[k] *= f;
  }
  return m;
}

/**
 * Går til neste fase og trekker nye zombieevner tilfeldig fra fasens pott.
 * Returnerer evnene som ble lagt til.
 */
export function advancePhase(s: GameState): ZombieTraitId[] {
  if (s.phase >= 5) return [];
  s.phase = (s.phase + 1) as PhaseId;
  const def = PHASES[s.phase];
  const added: ZombieTraitId[] = [];
  const pool = def.traitPool.filter((t) => !s.zombieTraits.includes(t));
  for (let i = 0; i < def.newTraits && pool.length; i++) {
    const t = pick(s, pool);
    pool.splice(pool.indexOf(t), 1);
    // ikke alle faseskifter gir nye evner, det skal være litt uforutsigbart
    if (rand(s) < 0.85) { s.zombieTraits.push(t); added.push(t); }
  }
  return added;
}
