/** Research, phases, mutations and victory. */
import type { RegionState, RegionWorld, ReportLine } from './types';
import { controlled, indexWorld, living, random } from './engine';
import { HQ_BRANCH, MUTATIONS, PHASES, SPECIAL_DISCOUNT, TECHS, type TechDef } from './systems';
import { lawMods, totalPeople } from './society';
import { wonderEffects } from './wonders';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const tech = (state: RegionState, id: string) => state.research.done.includes(id);
export const phaseDef = (state: RegionState) => PHASES[Math.min(PHASES.length, Math.max(1, state.phase)) - 1];
export const mods = (state: RegionState) => phaseDef(state).mods;

// ------------------------------------------------------------------ research

export function specialBranch(state: RegionState) { return state.hq ? HQ_BRANCH[state.hq.type]?.branch : undefined; }
export function techCost(state: RegionState, t: TechDef) {
  const special = specialBranch(state) === t.branch;
  return {
    points: Math.round(t.points * (special ? SPECIAL_DISCOUNT : 1)),
    cost: Object.fromEntries(Object.entries(t.cost).map(([id, n]) => [id, Math.ceil(n * (special ? SPECIAL_DISCOUNT : 1))])),
    phase: Math.max(2, t.phase - (special ? 1 : 0)),
  };
}
/** Why a project cannot start, or undefined. */
export function techBlocked(state: RegionState, t: TechDef) {
  if (tech(state, t.id)) return 'Ferdig.';
  if (state.phase < 2) return 'Forskning starter når dere har et HQ.';
  const c = techCost(state, t);
  if (state.phase < c.phase) return `Kommer i fase ${c.phase}.`;
  const missing = (t.requires ?? []).filter(id => !tech(state, id));
  if (missing.length) return `Krever ${missing.map(id => TECHS.find(x => x.id === id)?.name).join(' og ')}.`;
  if (t.needsModule && !state.hq?.modules.includes(t.needsModule)) return 'Krever en modul i HQ.';
  if (t.needsNetwork && !Object.values(state.networks).some(n => n.includes(t.needsNetwork!))) return 'Krever strømnett.';
  return undefined;
}
export function startResearch(state0: RegionState, id: string): RegionState {
  const t = TECHS.find(x => x.id === id);
  if (!t) throw new Error('Ukjent prosjekt.');
  const why = techBlocked(state0, t);
  if (why) throw new Error(why);
  if (state0.research.current === id) return state0;
  const state = clone(state0);
  const c = techCost(state, t);
  const paid = state.flags[`paid:${id}`];
  if (!paid) {
    for (const [r, n] of Object.entries(c.cost)) if ((state.stock[r] ?? 0) < n) throw new Error(`Mangler ${n} ${r}.`);
    for (const [r, n] of Object.entries(c.cost)) state.stock[r] = (state.stock[r] ?? 0) - n;
    state.flags[`paid:${id}`] = 1;
  }
  // Switching keeps the progress on the old project for later.
  if (state.research.current) state.flags[`progress:${state.research.current}`] = state.research.progress;
  state.research.current = id;
  state.research.progress = Number(state.flags[`progress:${id}`] ?? 0);
  return state;
}
export function researchRate(state: RegionState, crewPoints: number) {
  const mods = state.hq?.modules ?? [];
  const base = (state.work.research ?? 0) + state.population.children * lawMods(state).childResearch + crewPoints;
  return base * lawMods(state).researchMult * (mods.includes('classroom') ? 1.2 : 1) * (mods.includes('lab') ? 1.3 : 1) * (1 + wonderEffects(state).research);
}
export function researchDay(state: RegionState, points: number, lines: ReportLine[]) {
  const id = state.research.current;
  if (!id || points <= 0) return;
  const t = TECHS.find(x => x.id === id)!;
  state.research.progress += points;
  const need = techCost(state, t).points;
  if (state.research.progress >= need) {
    state.research.done.push(id);
    delete state.research.current;
    state.research.progress = 0;
    lines.push({ tone: 'good', title: `Forskning ferdig: ${t.name}`, text: t.text });
    state.memory.push({ day: state.day, text: `Forskning: ${t.name}.` });
    if (id === 'zombieStudy') for (const m of state.mutations) m.known = true;
  }
}

// ------------------------------------------------------------------ mutations

/** Effect of a mutation: full when unknown, halved when you have studied it. */
export function mutation(state: RegionState, id: string, strength: number) {
  const m = state.mutations.find(x => x.id === id);
  if (!m) return 1;
  return 1 + (strength - 1) * (m.known ? .5 : 1);
}
function mutate(state: RegionState, lines: ReportLine[]) {
  const rng = random(state.seed, state.day, 'mutation');
  const options = MUTATIONS.filter(m => !state.mutations.some(x => x.id === m.id));
  if (!options.length) return;
  const m = options[Math.floor(rng() * options.length)];
  const known = tech(state, 'zombieStudy');
  state.mutations.push({ id: m.id, day: state.day, known });
  lines.push(known
    ? { tone: 'warn', title: `Mutasjon: ${m.name}`, text: `${m.report} ${m.text}` }
    : { tone: 'bad', title: 'Noe er annerledes med zombiene', text: 'De oppfører seg ikke som før. Zombiestudier kan si hva det er.' });
}

// ------------------------------------------------------------------ phases

export function districtsOwned(state: RegionState, world: RegionWorld) {
  const index = indexWorld(world);
  return [...index.children.entries()].filter(([id, kids]) => index.byId.get(id)?.level === 2 && kids.length && kids.every(k => state.zones[k]?.status === 'controlled')).length;
}
export function goalMet(state: RegionState, world: RegionWorld, id: string) {
  switch (id) {
    case 'own1': return controlled(state).length >= 1;
    case 'hq': return !!state.hq;
    case 'zones6': return controlled(state).length >= 6;
    case 'modules3': return (state.hq?.modules.length ?? 0) >= 2 + (startModules(state));
    case 'pop12': return totalPeople(state) >= 12;
    case 'district': return districtsOwned(state, world) >= 1;
    case 'pop30': return totalPeople(state) >= 30;
    case 'tech6': return state.research.done.length >= 6;
    case 'districts3': return districtsOwned(state, world) >= 3;
    case 'network': return Object.values(state.networks).some(n => n.length);
    case 'pop50': return totalPeople(state) >= 50;
    case 'win': return !!state.gameOver?.won;
  }
  return false;
}
/** Modules an HQ type starts with do not count towards building three. */
function startModules(state: RegionState) { return Number(state.flags.hqStartModules ?? 0); }

export function checkPhase(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  const def = phaseDef(state);
  if (state.phase >= PHASES.length) return;
  if (!def.goals.every(g => goalMet(state, world, g.id))) return;
  state.phase += 1;
  state.phaseDay = state.day;
  const next = phaseDef(state);
  lines.push({ tone: 'good', title: `Fase ${next.id}: ${next.name}`, text: next.intro });
  state.memory.push({ day: state.day, text: `Fase ${next.id}: ${next.name}.` });
  if (state.phase >= 3) mutate(state, lines);
  // Wealth draws raiders: from the HQ phase the gang comes for its share.
  if (state.phase === 2 && state.factions.some(f => f.id === 'gang' && !f.defeated)) state.scheduled.push({ day: state.day + 14 + (state.seed % 7), id: 'gangTribute' });
}

/** Zombies that are not killed slowly rot away late in the game. Logged as deaths, not hidden. */
export function rot(state: RegionState) {
  const r = mods(state).rot;
  if (!r) return 0;
  let gone = 0;
  for (const z of Object.values(state.zones)) { const n = Math.floor(z.zombies * r + (z.zombies > 0 && r * z.zombies % 1 > .5 ? 1 : 0)); z.zombies -= n; gone += n; }
  return gone;
}

// ------------------------------------------------------------------ victory

export function checkVictory(state: RegionState, foodNet: number) {
  if (state.phase < 5) return;
  if (tech(state, 'cure')) { state.gameOver = { day: state.day, reason: 'Vaksineforsøket virket. Det finnes en vei tilbake.', won: true }; return; }
  const rivals = state.factions.filter(f => !f.defeated);
  if (rivals.every(f => f.relation >= 60 && !f.hostile)) { state.gameOver = { day: state.day, reason: 'Alle gruppene i regionen står sammen med dere.', won: true }; return; }
  const stable = foodNet >= 0 && state.morale >= 50 && state.discontent < 50 && living(state).length > 0;
  state.counters.stable = stable ? (state.counters.stable ?? 0) + 1 : 0;
  if ((state.counters.stable ?? 0) >= 30) state.gameOver = { day: state.day, reason: 'Tretti dager med mat, håp og ro. Dere har bygd et samfunn som varer.', won: true };
}
