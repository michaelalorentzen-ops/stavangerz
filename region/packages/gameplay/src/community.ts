import type { ReportEntry, Survivor } from './model';

export type RecruitmentChoice = 'admit' | 'refuse' | 'help' | 'defer';
export type CandidateStatus = 'waiting' | 'deferred' | 'admitted' | 'refused' | 'helped';

export interface RecruitmentCandidate {
  id: string;
  name: string;
  profile: string;
  needs: string;
  health: number;
  status: CandidateStatus;
}

export interface PersonalReaction {
  survivorId: string;
  candidateId: string;
  day: number;
  trustChange: number;
  text: string;
}

export interface CommunityState {
  arrival: { day: number; zoneId: string; candidates: RecruitmentCandidate[] };
  reactions: PersonalReaction[];
}

const household = [
  { id: 'buoy-signe', name: 'Signe', profile: 'Pensjonert kantinearbeider. Holder familien samlet mens de leter etter ly.', needs: 'Mat, vann og hjelp med forflytning. Kan ikke ta arbeidsoppdrag.', health: 72 },
  { id: 'buoy-einar', name: 'Einar', profile: 'Signes bror. Har brukt kreftene på å følge familien gjennom nabolaget.', needs: 'Mat, vann og jevnlig tilsyn. Kan ikke ta arbeidsoppdrag.', health: 64 },
  { id: 'buoy-noah', name: 'Noah', profile: 'Signes barnebarn. Kjenner bare veien til fotballbanen.', needs: 'Mat, vann og omsorg. Barnet kan ikke arbeide eller delta i kamp.', health: 90 },
] satisfies Omit<RecruitmentCandidate, 'status'>[];

export function canWork(person: Pick<Survivor, 'id' | 'alive'>): boolean {
  return person.alive && !household.some(candidate => candidate.id === person.id);
}

export function advanceCommunity(previous: CommunityState | undefined, activity: {
  day: number;
  searchedUnits: number;
  zoneId: string;
}): CommunityState | undefined {
  if (previous || activity.searchedUnits <= 0 || !activity.zoneId) return previous;
  return {
    arrival: {
      day: activity.day,
      zoneId: activity.zoneId,
      candidates: household.map(candidate => ({ ...candidate, status: 'waiting' })),
    },
    reactions: [],
  };
}

export const RECRUITMENT_CHOICES: Readonly<Record<RecruitmentChoice, string>> = {
  admit: 'Ta inn',
  refuse: 'Avvis',
  help: 'Gi én mat og ett vann',
  defer: 'Sett på vent',
};

export function chooseRecruitment(community: CommunityState, candidateId: string, choice: RecruitmentChoice, context: {
  day: number;
  stocks: Readonly<Record<string, number>>;
  survivors: readonly Survivor[];
}): { community: CommunityState; admitted: Survivor[]; costs: Record<string, number>; entry: ReportEntry } {
  const candidate = community.arrival.candidates.find(person => person.id === candidateId);
  if (!candidate || !['waiting', 'deferred'].includes(candidate.status)) throw new Error('Valget for denne personen er allerede avgjort.');
  if (!Object.hasOwn(RECRUITMENT_CHOICES, choice)) throw new Error('Ukjent rekrutteringsvalg.');
  if (choice === 'defer' && candidate.status === 'deferred') throw new Error('Personen venter allerede på svar.');
  if (context.survivors.some(person => person.id === candidateId)) throw new Error('Personen tilhører allerede gruppen.');

  const costs: Record<string, number> = choice === 'help' ? { food: 1, water: 1 } : {};
  if (Object.entries(costs).some(([resource, amount]) => (context.stocks[resource] ?? 0) < amount)) {
    throw new Error('Dere trenger én mat og ett vann for å hjelpe.');
  }

  const statusByChoice: Record<RecruitmentChoice, CandidateStatus> = {
    admit: 'admitted', refuse: 'refused', help: 'helped', defer: 'deferred',
  };
  const outcomes: Record<RecruitmentChoice, string> = {
    admit: `${candidate.name} fikk en plass ved basen og vil trenge daglig mat, vann og omsorg.`,
    refuse: `${candidate.name} fikk avslag og forlot området.`,
    help: `${candidate.name} fikk én mat og ett vann før ferden fortsatte.`,
    defer: `${candidate.name} venter utenfor basen på en avgjørelse.`,
  };
  const reactions = [...community.reactions];
  if (choice !== 'defer') {
    const leilaTrust = choice === 'admit' ? 2 : choice === 'help' ? 1 : -2;
    const newReactions: PersonalReaction[] = [
      { survivorId: 'leila', candidateId, day: context.day, trustChange: leilaTrust,
        text: choice === 'refuse' ? 'Leila mener at gruppen sviktet en person som trengte dem.' : 'Leila setter pris på at gruppen tar ansvar for andre.' },
      { survivorId: 'marius', candidateId, day: context.day, trustChange: -leilaTrust,
        text: choice === 'refuse' ? 'Marius er lettet over at gruppen prioriterte egne reserver.' : 'Marius er bekymret for forsyningene til dem som allerede bor her.' },
    ];
    reactions.push(...newReactions.filter(reaction => context.survivors.some(person => person.id === reaction.survivorId && person.alive)));
  }

  const admitted: Survivor[] = choice === 'admit' ? [{
    id: candidate.id, name: candidate.name, role: 'Beboer med omsorgsbehov', description: candidate.profile,
    strength: 'Familie og personlig tilhørighet.', weakness: candidate.needs,
    health: candidate.health, fatigue: 0, experience: 0, alive: true,
    skills: { combat: 0, scouting: 0, craft: 0, medical: 0 },
    gear: { weapon: 'Turkniv', protection: 'Vanlige klær', utility: 'Personlige eiendeler' },
  }] : [];
  return {
    community: {
      arrival: { ...community.arrival, candidates: community.arrival.candidates.map(person => person.id === candidateId ? { ...person, status: statusByChoice[choice] } : person) },
      reactions,
    },
    admitted,
    costs,
    entry: { type: 'info', title: `${candidate.name} · ${RECRUITMENT_CHOICES[choice]}`, text: outcomes[choice], zoneId: community.arrival.zoneId },
  };
}

export const WATER_SOURCE_ID = 'water:buoy-rain';
export const WATER_SOURCE_INITIAL = 36;
export const WATER_KIT_POI_ID = 'poi-001';
export const WATER_KIT_RESOURCE = 'filterKit';
export interface WaterStation { installedDay: number }

export function previewWater(action: 'installWater' | 'filterWater', context: {
  water?: WaterStation;
  baseEstablished: boolean;
  crew: readonly Survivor[];
  stocks: Readonly<Record<string, number>>;
  sourceWater: number;
}): { errors: string[]; costs: Record<string, number>; output: number } {
  const errors: string[] = [];
  if (!context.baseEstablished) errors.push('Vannstasjonen trenger en etablert operasjonsbase.');
  if (!context.crew.some(canWork)) errors.push('Velg en person som kan arbeide på basen.');
  if (action === 'installWater') {
    const costs = { materials: 4, [WATER_KIT_RESOURCE]: 1 };
    if (context.water) errors.push('Vannstasjonen er allerede montert.');
    if (!context.crew.some(person => canWork(person) && person.skills.craft >= 4)) errors.push('Montering krever håndverkskompetanse på minst 4.');
    if ((context.stocks.materials ?? 0) < costs.materials) errors.push('Du trenger fire materialer.');
    if ((context.stocks[WATER_KIT_RESOURCE] ?? 0) < costs[WATER_KIT_RESOURCE]) errors.push('Du trenger et filtersett.');
    return { errors, costs, output: 0 };
  }
  if (!context.water) errors.push('Monter vannstasjonen før rensing.');
  if (context.sourceWater <= 0) errors.push('Regnvannstanken er tømt.');
  return { errors, costs: {}, output: errors.length ? 0 : Math.min(8, context.sourceWater) };
}
