/** V04-09: campaign identity, mode rules and derived endings. Values are playtest hypotheses. */
import type { RegionState, RegionWorld } from './types';
import { LAWS, TECHS } from './systems';

export type Difficulty = 'story' | 'survival' | 'realistic';
export interface CampaignOptions { difficulty?: Difficulty; hardcore?: boolean; avatarId?: string; runId?: string }
export interface CampaignEnding {
  kind: 'cure' | 'alliance' | 'stable'; day: number; title: string; summary: string; epilogue: string[];
  facts: {
    population: number; controlledZones: number; researchCompleted: number; hope: number; unrest: number;
    government: string; alliances: number; stableDays: number; survivingCrew: string[]; lostCrew: string[];
    decisions: { day: number; text: string }[]; research: string[];
  };
}
export interface CampaignState {
  version: 1; id: string; difficulty: Difficulty; hardcore: boolean; avatarId?: string;
  sequence: number; fingerprint: string;
  /** Deterministic ancestry receipts, used to reject ordinary UI rewind in Hardcore. Not anti-cheat. */
  history: string[];
  ending?: CampaignEnding;
}
export const DIFFICULTIES: readonly { id: Difficulty; name: string; description: string }[] = [
  { id: 'story', name: 'Story', description: 'Større startforsyninger, mildere skader og forbruk, flere funn og konkrete råd.' },
  { id: 'survival', name: 'Survival', description: 'Standard. Vanlige forsyninger og konsekvenser, med rom for å hente seg inn.' },
  { id: 'realistic', name: 'Realistic', description: 'Knappere startforsyninger og funn, større forbruk, skader og utmattelse.' },
];
/** HYPOTESE: distinct, centralized starting/risk/supply rules; these are not tuned difficulty targets. */
export const DIFFICULTY_RULES = {
  story: { startSupplies: 1.5, damage: .7, foodWater: .85, loot: 1.15, fatigue: .8, extraHints: true },
  survival: { startSupplies: 1, damage: 1, foodWater: 1, loot: 1, fatigue: 1, extraHints: false },
  realistic: { startSupplies: .75, damage: 1.25, foodWater: 1.15, loot: .85, fatigue: 1.15, extraHints: false },
} as const;

/** Small deterministic receipt hash, not a cryptographic signature or protection from file editing. */
export function campaignFingerprint(value: string): string {
  let a = 2166136261, b = 2246822519;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b ^ value.charCodeAt(i), 3266489917);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export function campaignAvatarId(state: RegionState): string | undefined {
  return state.campaign?.avatarId ?? (typeof state.flags.playerAvatarId === 'string' ? state.flags.playerAvatarId : undefined);
}
export function campaignFor(state: RegionState): CampaignState {
  if (state.campaign) return state.campaign;
  const id = `legacy:${state.worldVersion}:${state.startZoneId}:${state.seed}`;
  const fingerprint = campaignFingerprint(id);
  return { version: 1, id, difficulty: 'survival', hardcore: false, avatarId: campaignAvatarId(state), sequence: 0, fingerprint, history: [fingerprint] };
}
function ensureCampaign(state: RegionState): CampaignState { return state.campaign ??= campaignFor(state); }
export const difficultyRules = (state: RegionState) => DIFFICULTY_RULES[campaignFor(state).difficulty];

/** Mutates a newly constructed game only. Never call this while loading an existing save. */
export function initializeCampaign(state: RegionState, options: CampaignOptions = {}): void {
  if (state.campaign) throw new Error('Kampanjen er allerede opprettet.');
  const difficulty = options.difficulty ?? 'survival';
  if (!DIFFICULTIES.some(mode => mode.id === difficulty)) throw new Error('Ukjent vanskelighetsgrad.');
  const avatarId = options.avatarId;
  if (avatarId && !state.survivors.some(person => person.id === avatarId && person.alive && !person.left && person.health > 0)) throw new Error('Hovedpersonen må være en levende overlevende.');
  const id = options.runId ?? `region:${state.worldVersion}:${state.startZoneId}:${state.seed}`;
  const fingerprint = campaignFingerprint(`${id}|${difficulty}|${!!options.hardcore}|${avatarId ?? ''}`);
  state.campaign = { version: 1, id, difficulty, hardcore: !!options.hardcore, avatarId, sequence: 0, fingerprint, history: [fingerprint] };
  if (avatarId) state.flags.playerAvatarId = avatarId;
  for (const resource of ['food', 'water', 'medicine', 'ammo']) {
    if (state.stock[resource] !== undefined) state.stock[resource] = Math.round(state.stock[resource] * DIFFICULTY_RULES[difficulty].startSupplies);
  }
}

/** Every authoritative mutation records its actual resulting state, including pending checkpoints. */
export function advanceCampaignCommit(state: RegionState, choiceKey: string): void {
  const campaign = ensureCampaign(state);
  const { campaign: _campaign, ...snapshot } = state;
  const fingerprint = campaignFingerprint(`${campaign.fingerprint}|${choiceKey}|${JSON.stringify(snapshot)}`);
  campaign.sequence += 1;
  campaign.fingerprint = fingerprint;
  campaign.history.push(fingerprint);
}
export function campaignAvatarStatus(state: RegionState) {
  const id = campaignAvatarId(state);
  const person = state.survivors.find(candidate => candidate.id === id);
  const status = !id ? 'unselected' : !person ? 'missing' : !person.alive || person.health <= 0 ? 'dead' : person.left ? 'left' : 'alive';
  return { id, person, status, needsSelection: status === 'unselected',
    needsSuccessor: !campaignFor(state).hardcore && ['dead', 'left', 'missing'].includes(status) } as const;
}
/** A living avatar remains the same person even while away, in transit or out of contact. */
export function chooseCampaignAvatar(state: RegionState, survivorId: string): RegionState {
  if (state.gameOver) throw new Error('Gjennomspillingen er avsluttet.');
  const before = campaignAvatarStatus(state);
  if (before.id && before.status === 'alive') throw new Error('Hovedpersonen er allerede valgt. En bortreist person blir ikke erstattet.');
  if (before.id && campaignFor(state).hardcore) throw new Error('Hardcore tillater ikke å bytte hovedperson.');
  const person = state.survivors.find(candidate => candidate.id === survivorId && candidate.alive && !candidate.left && candidate.health > 0);
  if (!person) throw new Error('Velg en levende overlevende.');
  const next = JSON.parse(JSON.stringify(state)) as RegionState;
  ensureCampaign(next).avatarId = survivorId;
  next.flags.playerAvatarId = survivorId;
  if (before.id) next.memory.push({ day: next.day, text: `${person.name} fører historien videre etter ${before.person?.name ?? 'den tidligere hovedpersonen'}.` });
  advanceCampaignCommit(next, `avatar:${before.id ?? 'initial'}:${survivorId}`);
  return next;
}
/** Death takes priority over a victory reached during the same Hardcore turn. */
export function enforceAvatarFate(state: RegionState): void {
  const campaign = campaignFor(state);
  const avatar = campaignAvatarStatus(state);
  if (!campaign.hardcore || avatar.status !== 'dead') return;
  state.gameOver = { day: state.day, reason: `${avatar.person?.name ?? 'Hovedpersonen'} døde. Hardcore-gjennomspillingen er avsluttet.` };
  delete ensureCampaign(state).ending;
}

export function campaignHints(state: RegionState): string[] {
  if (!difficultyRules(state).extraHints || state.gameOver) return [];
  const hints: string[] = [];
  if ((state.stock.water ?? 0) < 12) hints.push('Vannlageret er lavt. Se etter trygge søkeområder og arbeid som gir forsyninger.');
  if ((state.stock.food ?? 0) < 12) hints.push('Maten går ned. Søk, dyrking og fiske er forskjellige veier til nye forsyninger.');
  if (state.survivors.some(person => person.alive && !person.left && person.health < 45)) hints.push('La alvorlig skadde hvile, eller gi et medisinkyndig lag oppdraget Behandle.');
  if (!state.hq) hints.push('Speid og rydd nærområdet før dere overtar en sone og etablerer HQ.');
  return hints.slice(0, 2);
}

/** Epilogue is derived from recorded society, research and choices; no final ending-choice button. */
export function buildCampaignEnding(state: RegionState, kind: CampaignEnding['kind'], _world?: RegionWorld): CampaignEnding {
  const alive = state.survivors.filter(person => person.alive && !person.left && person.health > 0);
  const lost = state.survivors.filter(person => !person.alive || person.health <= 0);
  const government = state.laws.map(id => LAWS.find(law => law.id === id)).find(law => law?.group === 'gov')?.name ?? 'Ingen styreform vedtatt';
  const population = alive.length + state.population.adults + state.population.children + state.population.elderly;
  const controlledZones = Object.values(state.zones).filter(zone => zone.status === 'controlled').length;
  const research = state.research.done.map(id => TECHS.find(tech => tech.id === id)?.name ?? id);
  const facts: CampaignEnding['facts'] = {
    population, controlledZones, researchCompleted: research.length, research, hope: Math.round(state.morale), unrest: Math.round(state.discontent), government,
    alliances: state.factions.filter(faction => !faction.defeated && !faction.hostile && faction.relation >= 60).length,
    stableDays: state.counters.stable ?? 0, survivingCrew: alive.map(person => person.name), lostCrew: lost.map(person => person.name), decisions: state.memory.map(memory => ({ ...memory })),
  };
  const openings = {
    cure: { title: 'En vei tilbake', summary: 'Vaksineforsøket virket. Kunnskapen dere bygde, gir de levende en ny mulighet.' },
    alliance: { title: 'Regionen står sammen', summary: 'De gjenværende gruppene står sammen med dere. Avtalene har blitt et grunnlag for en felles fremtid.' },
    stable: { title: 'Et samfunn som varer', summary: 'Tretti sammenhengende dager med mat, håp og ro. Dere har vist at livet kan fortsette.' },
  };
  const epilogue = [
    `${population} mennesker står igjen i samfunnet, med ${controlledZones} kontrollerte lokale soner.`,
    `${government}. Håp ${facts.hope}, uro ${facts.unrest}. Dette er samfunnet valgene deres etterlater.`,
    alive.length ? `De navngitte overlevende: ${facts.survivingCrew.join(', ')}.` : 'Ingen av de navngitte overlevende fører historien videre.',
    lost.length ? `De døde blir husket: ${facts.lostCrew.join(', ')}.` : 'Ingen av de navngitte overlevende er registrert døde.',
    `${facts.researchCompleted} forskningsprosjekter er fullført; ${facts.alliances} gjenværende grupper har et nært forhold til dere.`,
  ];
  const lastDecision = facts.decisions.at(-1);
  if (lastDecision) epilogue.push(`Et spor i krøniken, dag ${lastDecision.day}: ${lastDecision.text}`);
  return { kind, day: state.day, ...openings[kind], epilogue, facts };
}
export function recordCampaignEnding(state: RegionState, kind: CampaignEnding['kind']): void {
  ensureCampaign(state).ending = buildCampaignEnding(state, kind);
}
