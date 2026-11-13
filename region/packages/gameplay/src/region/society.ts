/**
 * The community: the counted population, who works where, the laws, hope and discontent.
 * Named crew lead; everyone else is counted and given work as groups.
 */
import type { RegionState, RegionSurvivor, RegionWorld, ReportLine, WorkId } from './types';
import { controlled, indexWorld, living, season } from './engine';
const seasonFarm = (state: RegionState) => season(state.day).farm;
import { LAW_COOLDOWN, LAWS, POP, REACTIONS, type LawEffect } from './systems';
import { wonderEffects } from './wonders';
import { administrations, centralCommunity, centralPopulation } from './administration';

export const WORK_IDS: WorkId[] = ['farm', 'fish', 'scavenge', 'clear', 'guard', 'build', 'research'];
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** The combined effect of all laws in force. */
export function lawMods(state: RegionState): Required<LawEffect> {
  const m: Required<LawEffect> = { accidents: 0, sickMult: 1, hope: 0, discontent: 0, foodMult: 1, dependentFood: 1, workMult: 1, childWork: 0, childResearch: 0, crime: 1, refugees: 1,
    lawCooldown: LAW_COOLDOWN, guardMult: 1, researchMult: 1, healthPerDay: 0, fatigue: 0 };
  const cards = state.research.done.includes('rationCards');
  for (const id of state.laws) {
    const law = LAWS.find(l => l.id === id);
    if (!law) continue;
    const e = law.effect;
    const harsh = (law.tags ?? []).some(t => t === 'harsh' || t === 'cruel');
    m.hope += e.hope ?? 0;
    m.discontent += (e.discontent ?? 0) * (harsh && cards && (e.discontent ?? 0) > 0 ? .5 : 1);
    m.foodMult *= e.foodMult ?? 1; m.dependentFood *= e.dependentFood ?? 1; m.workMult *= e.workMult ?? 1;
    m.childWork += e.childWork ?? 0; m.childResearch += e.childResearch ?? 0; m.crime *= e.crime ?? 1;
    m.refugees *= e.refugees ?? 1; m.guardMult *= e.guardMult ?? 1; m.researchMult *= e.researchMult ?? 1;
    m.healthPerDay += e.healthPerDay ?? 0; m.fatigue += e.fatigue ?? 0; m.accidents += e.accidents ?? 0; m.sickMult *= e.sickMult ?? 1;
    if (e.lawCooldown !== undefined) m.lawCooldown = e.lawCooldown;
  }
  if (state.research.done.includes('charter')) m.discontent -= 8;
  return m;
}

export function lawAvailable(state: RegionState, id: string) {
  const law = LAWS.find(l => l.id === id);
  if (!law) return 'Ukjent lov.';
  if (state.phase < law.phase) return `Kommer i fase ${law.phase}.`;
  if (law.needsTech && !state.research.done.includes(law.needsTech)) return 'Krever forskning først.';
  if (state.laws.includes(id)) return 'Loven gjelder allerede.';
  const wait = lawWait(state);
  if (wait > 0) return `Neste lov kan vedtas om ${wait} dager.`;
  return undefined;
}
export function lawWait(state: RegionState) { return Math.max(0, state.lawDay + lawMods(state).lawCooldown - state.day); }

/** Pass a law. It replaces any law in the same group. People react at once. */
export function passLaw(state0: RegionState, id: string): RegionState {
  const why = lawAvailable(state0, id);
  if (why) throw new Error(why);
  const state = clone(state0);
  const law = LAWS.find(l => l.id === id)!;
  state.laws = state.laws.filter(l => LAWS.find(x => x.id === l)?.group !== law.group).concat(id);
  state.lawDay = state.day;
  for (const p of living(state)) for (const trait of p.traits ?? []) for (const tag of law.tags ?? []) p.loyalty = Math.max(0, Math.min(100, (p.loyalty ?? 60) + (REACTIONS[trait][tag] ?? 0) / 2));
  if ((law.tags ?? []).includes('harsh') || (law.tags ?? []).includes('cruel')) state.discontent = Math.min(100, state.discontent + 4);
  state.memory.push({ day: state.day, text: `Ny lov: ${law.name}.` });
  return state;
}
/** Go back to no law in a group. Counts as a law change. */
export function repealLaw(state0: RegionState, group: string): RegionState {
  if (lawWait(state0) > 0) throw new Error(`Neste lovendring kan gjøres om ${lawWait(state0)} dager.`);
  const state = clone(state0);
  const before = state.laws.length;
  state.laws = state.laws.filter(l => LAWS.find(x => x.id === l)?.group !== group);
  if (state.laws.length === before) throw new Error('Ingen lov å oppheve.');
  state.lawDay = state.day;
  return state;
}

// ------------------------------------------------------------------ people and work

export function populationCount(state: RegionState) { const p = state.population; return p.adults + p.children + p.elderly; }
export function totalPeople(state: RegionState) { return living(state).length + populationCount(state); }
/** Adults who can work today, plus children if the law says so. */
export function workforce(state: RegionState) {
  const population = centralPopulation(state);
  const healthy = Math.max(0, population.adults - Math.min(population.sick, population.adults));
  return Math.floor(healthy + population.children * lawMods(state).childWork);
}
export function assigned(state: RegionState) { return WORK_IDS.reduce((n, id) => n + (state.work[id] ?? 0), 0); }
/** Set how many work in each job. Extra people are trimmed from the end of the list. */
export function setWork(state0: RegionState, work: Partial<Record<WorkId, number>>): RegionState {
  const state = clone(state0);
  for (const id of WORK_IDS) state.work[id] = Math.max(0, Math.floor(work[id] ?? state.work[id] ?? 0));
  trimWork(state);
  return state;
}
export function trimWork(state: RegionState) {
  let over = assigned(state) - workforce(state);
  for (const id of [...WORK_IDS].reverse()) { if (over <= 0) break; const cut = Math.min(over, state.work[id]); state.work[id] -= cut; over -= cut; }
}
/** A sensible default split: food first, then guards, builders, research and scavengers. */
export function autoWork(state: RegionState, world: RegionWorld): Record<WorkId, number> {
  if (administrations(state).length) { const scope = centralCommunity(state, world); return autoWork(scope.state, scope.world); }
  const index = indexWorld(world);
  const n = workforce(state);
  const owned = controlled(state);
  const farmHa = owned.reduce((s, id) => s + (index.byId.get(id)?.measures?.farm ?? 0) / 1e4, 0);
  const coast = owned.some(id => index.coastal.has(id)) && (state.stock.boat ?? 0) >= 1;
  const w: Record<WorkId, number> = { farm: 0, fish: 0, scavenge: 0, clear: 0, guard: 0, build: 0, research: 0 };
  let left = n;
  const take = (id: WorkId, k: number) => { const t = Math.max(0, Math.min(left, Math.floor(k))); w[id] += t; left -= t; };
  // Enough on food to feed everyone, as far as land and boats allow.
  const eat = totalPeople(state) * .85;
  const farmEach = POP.work.farmFood * Math.max(.1, seasonFarm(state));
  const fishMax = coast ? (state.stock.boat ?? 0) * (state.research.done.includes('fishery') ? 5 : 3) : 0;
  take('fish', Math.min(fishMax, n * .25, eat / 3));
  take('farm', Math.min(farmHa * 1.6 + 1, Math.max(0, eat - w.fish * 3) / farmEach + 1, n * .55));
  if (state.phase >= 2 && state.research.current) take('research', Math.max(1, n * .12));
  take('guard', n * .12);
  take('clear', n * .15);
  take('build', n * .1);
  take('scavenge', left * .7);
  take('clear', left);
  return w;
}

/** Room under a roof that you can defend. */
export function shelter(state: RegionState, world: RegionWorld) {
  const index = indexWorld(world);
  let room = POP.shelter.base;
  if (state.hq) room += 8;
  if (state.hq?.modules.includes('housing')) room += POP.shelter.housing;
  if (state.hq?.modules.includes('refuge')) room += POP.shelter.refuge;
  room += wonderEffects(state).shelter;
  for (const id of controlled(state)) room += Math.min(POP.shelter.perZoneMax, (index.byId.get(id)?.measures?.homes ?? 0) * POP.shelter.perZoneHomes);
  return Math.round(room);
}

// ------------------------------------------------------------------ hope and discontent

export function hopeTarget(state: RegionState, world: RegionWorld) {
  const mods = state.hq?.modules ?? [];
  const power = Object.values(state.networks).some(n => n.includes('power'));
  const hurt = living(state).filter(s => s.health < 50).length;
  const recentDeaths = state.counters[`deaths:${Math.floor(state.day / 14)}`] ?? 0;
  const people = totalPeople(state);
  const crowd = Math.max(0, people - shelter(state, world));
  const food = state.stock.food ?? 0;
  // Even a good camp in a dead world is not a happy place: hope settles at 80 at most, and wears later on.
  return Math.max(5, Math.min(80 - Math.max(0, state.phase - 3) * 4, 45 + (power ? 8 : 0) + (mods.includes('kitchen') ? 5 : 0) + (mods.includes('refuge') ? 6 : 0) + (state.hq?.type === 'refuge' ? 4 : 0)
    + (state.hq ? 5 : 0) + Math.min(10, controlled(state).length * .8) + Math.min(6, state.milestones.length)
    - hurt * 3 - recentDeaths * 3 - crowd * .6 - (food < people * 3 ? 12 : 0) - Math.min(10, state.population.sick * .5)
    + lawMods(state).hope + wonderEffects(state).hope));
}
export function discontentTarget(state: RegionState, world: RegionWorld) {
  const people = totalPeople(state);
  const crowd = Math.max(0, people - shelter(state, world));
  const hungry = state.counters.hungerStreak ?? 0;
  return Math.max(0, Math.min(100, 8 + state.phase * 2 + lawMods(state).discontent + Math.max(0, people - 20) * .2 + crowd * .5 + hungry * 6
    + (state.morale < 30 ? 10 : 0) + (state.population.sick > people * .15 ? 6 : 0)));
}

/** End-of-day drift and the slow consequences of how people live. */
export function societyDay(state: RegionState, world: RegionWorld, lines: ReportLine[], rng: () => number) {
  const before = centralPopulation(state);
  if (!administrations(state).length && Object.keys(before).every(key => before[key as keyof typeof before] === state.population[key as keyof typeof before])) { societyCommunityDay(state, world, lines, rng); return; }
  const central = { ...state, administration: undefined, mobility: undefined, population: { ...before } } as RegionState;
  societyCommunityDay(central, world, lines, rng);
  for (const key of Object.keys(before) as (keyof typeof before)[]) state.population[key] = Math.max(0, state.population[key] + central.population[key] - before[key]);
  state.morale = central.morale; state.discontent = central.discontent;
  trimWork(state);
}
function societyCommunityDay(state: RegionState, world: RegionWorld, lines: ReportLine[], rng: () => number) {
  const mods = lawMods(state);
  // Hard laws have a body count: tired workers and working children get hurt.
  const accidents = Math.floor(workforce(state) * mods.accidents + rng());
  if (accidents && state.population.adults > accidents) { state.population.adults -= accidents; lines.push({ tone: 'bad', title: accidents === 1 ? 'En arbeidsulykke' : `${accidents} arbeidsulykker`, text: 'Slitne folk gjør feil. Noen kom ikke hjem fra skiftet.' }); }
  if (mods.childWork && state.population.children > 3 && rng() < state.population.children * .003) { state.population.children -= 1; state.morale -= 3; lines.push({ tone: 'bad', title: 'Et barn døde i arbeid', text: 'Under garna, i grøfta, ved maskinen. Foreldrene stiller ikke på jobb i dag.' }); }
  // Children grow up. In a world like this they grow up fast.
  if (state.population.children > 0 && rng() < state.population.children * .004) { state.population.children -= 1; state.population.adults += 1; }
  // Health: hard rations and long shifts wear people down.
  for (const s of living(state)) {
    s.health = Math.min(100, s.health + mods.healthPerDay);
    s.fatigue = Math.min(100, s.fatigue + mods.fatigue * .5);
  }
  // Sickness among the many, worse when crowded or without hygiene.
  const people = populationCount(state);
  if (people) {
    const crowd = Math.max(0, totalPeople(state) - shelter(state, world)) / Math.max(1, totalPeople(state));
    const water = Object.values(state.networks).some(n => n.includes('water'));
    const rate = POP.sickPerDay * mods.sickMult * (1 + crowd * 4) * (state.research.done.includes('hygiene') ? .5 : 1) * (water ? .6 : 1);
    const newSick = Math.floor(people * rate + rng());
    state.population.sick = Math.min(people, state.population.sick + newSick);
    const healed = Math.min(state.population.sick, Math.ceil(state.population.sick * (state.hq?.modules.includes('medbay') ? .25 : .12)));
    const medicineUsed = Math.min(state.stock.medicine ?? 0, Math.ceil(healed * .3));
    state.stock.medicine = Math.max(0, (state.stock.medicine ?? 0) - medicineUsed);
    state.population.sick -= healed;
    if (!medicineUsed && state.population.sick > 4 && rng() < .2) {
      const kind = state.population.elderly > 0 && rng() < .6 ? 'elderly' : 'adults';
      state.population[kind] -= 1;
      state.population.sick -= 1;
      state.counters[`deaths:${Math.floor(state.day / 14)}`] = (state.counters[`deaths:${Math.floor(state.day / 14)}`] ?? 0) + 1;
      lines.push({ tone: 'bad', title: 'En syk døde', text: 'Uten medisin klarte ikke kroppen mer.' });
    }
  }
  // Drift towards where hope and discontent settle.
  state.morale = Math.max(0, Math.min(100, state.morale + (hopeTarget(state, world) - state.morale) * .1));
  state.discontent = Math.max(0, Math.min(100, state.discontent + (discontentTarget(state, world) - state.discontent) * .15));
  // People without hope drift away in the night.
  if (state.morale < 20 && state.population.adults > 2 && rng() < .5) {
    const gone = Math.max(1, Math.round(state.population.adults * .05));
    state.population.adults -= gone;
    lines.push({ tone: 'bad', title: `${gone} forlot leiren i natt`, text: 'De tror de har bedre sjanser alene.' });
  }
  promoteLeaders(state, lines, rng);
  trimWork(state);
}

const NAMES = ['Siri', 'Bjørn', 'Kari', 'Arne', 'Linn', 'Øystein', 'Hilde', 'Torbjørn', 'Nora', 'Sindre', 'Ragnhild', 'Eirik', 'Aud', 'Jarle', 'Mona', 'Kjetil',
  'Ingvild', 'Svein', 'Marte', 'Leif', 'Turid', 'Håkon', 'Vigdis', 'Odd', 'Elin', 'Stian', 'Gunn', 'Per', 'Randi', 'Trond'];
const ROLES: [string, string, RegionSurvivor['skills'], RegionSurvivor['traits']][] = [
  ['Lagleder', 'Holdt sammen gruppa si i flere uker før dere kom.', { combat: 4, scouting: 3, craft: 2, medical: 1 }, ['hard']],
  ['Håndverker', 'Har bygd halve leiren med egne hender.', { combat: 2, scouting: 1, craft: 5, medical: 1 }, ['loner']],
  ['Speider', 'Kjenner hver bakgård i området.', { combat: 3, scouting: 5, craft: 1, medical: 1 }, ['suspicious']],
  ['Helsearbeider', 'Har stelt de syke siden første dag.', { combat: 1, scouting: 1, craft: 2, medical: 5 }, ['kind']],
  ['Vaktsjef', 'Har sovet med økse under puta i tre måneder.', { combat: 5, scouting: 2, craft: 1, medical: 1 }, ['hard']],
];
/** When the crew thins out, people from the camp step up. The named are the leaders of the many. */
function promoteLeaders(state: RegionState, lines: ReportLine[], rng: () => number) {
  const want = Math.min(8, 3 + state.phase);
  if (living(state).length >= want || state.population.adults < 4) return;
  if (state.day - Number(state.flags.lastPromotion ?? -99) < 4) return;
  const taken = new Set(state.survivors.map(s => s.name));
  const name = NAMES.filter(n => !taken.has(n))[Math.floor(rng() * NAMES.filter(n => !taken.has(n)).length)];
  if (!name) return;
  const [role, about, skills, traits] = ROLES[Math.floor(rng() * ROLES.length)];
  state.population.adults -= 1;
  state.survivors.push({ id: `p${state.day}-${state.survivors.length}`, name, role, about, skills: { ...skills }, traits: [...(traits ?? [])], loyalty: 55,
    weapon: skills.combat >= 4 ? 'shotgun' : 'melee', health: 90, fatigue: 0, alive: true, joinedDay: state.day });
  state.flags.lastPromotion = state.day;
  lines.push({ tone: 'good', title: `${name} trer fram`, text: `${role} fra leiren. ${about}` });
}
