// Spillmotoren. Ren logikk: all tilfeldighet går gjennom state.rng, så samme
// state + samme ordre gir alltid samme resultat. Serveren kan kjøre
// resolveDay() selv når multiplayer kommer.
import { give, hasTag, lage, newCard, placeUniques } from './cards';
import { addNeighbor, injure, leteOverlevende, setLeader } from './crew';
import { noiseProfile, rollEncounter, ENC_MAX_PER_DAY } from './encounters';
import { GATES, GATE_STEPS, HEALTH_LABEL, PLAYABLE, SECTORS, STAT_LABEL, STATS } from './data';
import { advancePhase, BRANCHES, mods } from './phases';
import { clamp, pick, rand, sround, sum } from './rng';
import { decay, floorControl, isSafe, rotFood, rydde, sanke, settle, speide, updateControl, watchControl, wearTools } from './sectors';
import { isOnTokt, expireQuests, recallTokts, resolveTokts, toktAvailable, TOKTS } from './tokt';
import { crewLevel, fightPower, buildPower, gainXp, stat, toSkill } from './skills';
import type {
  CrewMember, GameState, GateId, LogKind, LogLine, SectorId, SelfSetup, StatKey, Stats, Task, TaskType, TraitId,
} from './types';

/** Vakter ved porten med et rekkevidde-våpen teller mer om natta. */
export const RANGE_GUARD = 1.25;

/** Samlet kampkraft for vaktene ved en port om natta. Rekkevidde-våpen teller mer. */
export const guardPower = (s: GameState, guards: CrewMember[]): number =>
  sum(guards.map((c) => fightPower(s, c) * (hasTag(c, 'rekkevidde') ? RANGE_GUARD : 1)));

export const GATE_IDS = Object.keys(GATES) as GateId[];

// ---------- Oppsett ----------
export function newGame(seed: number, self: SelfSetup, neighborIds: string[]): GameState {
  const s: GameState = {
    v: 3, seed, rng: seed | 0, day: 1, phase: 1, mutations: [], knownMutations: [], branchWeights: { bevegelse: 1, sanser: 1, kropp: 1, atferd: 1 }, goalDay: null, phaseStartDay: 1, moral: 70, stash: [], uniques: {}, nextUid: 1, needLeader: false,
    res: { mat: 14, vann: 10, medisin: 2, tre: 3, skrap: 3, metall: 0, strom: 0, drivstoff: 0 },
    flags: {}, crew: [], seenEvents: [], pending: [], recentEnc: [], tokts: [], quests: [], log: [], over: null,
    sectors: {} as GameState['sectors'],
    gates: {} as GameState['gates'],
    stats: { kills: 0, found: 0, lost: 0, starvedDays: 0, deaths: { kamp: 0, natt: 0, tokt: 0 } },
  };
  s.crew.push({ id: 'meg', name: self.name || 'Deg', role: 'Deg', trait: self.trait, stats: Object.fromEntries(STATS.map((k) => [k, toSkill(self.stats[k])])) as Stats, hp: 3, task: { type: 'hvile' }, kills: 0, gear: {}, me: true });
  give(s.crew[0], newCard(s, 'k_ror'));
  give(s.crew[0], newCard(s, 'baufil'));
  for (const id of neighborIds) addNeighbor(s, id);
  for (const id of PLAYABLE) {
    const d = SECTORS[id];
    const loot = { ...d.loot, mat: Math.round(d.loot.mat * 1.3) };
    const home = id === 'hjem';
    s.sectors[id] = {
      z: d.z, hidden: d.hidden, searched: 0, control: home ? 60 : 0, loot, lootMax: sum(Object.values(loot)),
      seen: home, scouted: home, settled: home, specialFound: false, dropped: [],
    };
  }
  for (const id of GATE_IDS) s.gates[id] = { work: 0, level: 0 };
  placeUniques(s);
  for (const b of BRANCHES) s.branchWeights[b] = 0.5 + rand(s);
  return s;
}

/** Godtar bare v3. Lagring fra prototypen (v1/v2) forkastes. */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as { v?: number };
  // v3 fra før utstyrskortene mangler lager og kan ikke brukes
  if (s.v !== 3 || !Array.isArray((raw as GameState).stash)) return null;
  (raw as GameState).needLeader ??= false;
  (raw as GameState).pending ??= [];
  (raw as GameState).recentEnc ??= [];
  (raw as GameState).tokts ??= [];
  (raw as GameState).quests ??= [];
  const g = raw as GameState & { zombieTraits?: unknown };
  delete g.zombieTraits;
  g.mutations ??= [];
  g.knownMutations ??= [];
  g.branchWeights ??= { bevegelse: 1, sanser: 1, kropp: 1, atferd: 1 };
  g.goalDay ??= null;
  g.phaseStartDay ??= 1;
  g.stats.starvedDays ??= 0;
  g.stats.deaths ??= { kamp: 0, natt: 0, tokt: 0 };
  // lagringer fra før nivåene: omtrent én erfaring per dag spilt, så crewet ikke starter på nivå 1 på dag 13
  for (const c of g.crew) c.xp ??= Math.max(0, g.day - 1);
  return g;
}

// ---------- Avledede verdier ----------
export const hasTrait = (s: GameState, t: TraitId) => s.crew.some((c) => c.trait === t);
export const dailyFood = (s: GameState) => Math.max(1, Math.ceil(s.crew.length * 0.6) - (hasTrait(s, 'kokk') ? 1 : 0));
export const dailyWater = (s: GameState) => Math.max(1, Math.ceil(s.crew.length * 0.5));

/** Legger arbeid til en sperring og hever nivået når terskelen nås. */
export function addGateWork(s: GameState, id: GateId, work: number): number {
  const g = s.gates[id];
  const before = g.level;
  g.work += work;
  while (g.level < 3 && g.work >= GATE_STEPS[g.level + 1]) g.level++;
  return g.level - before;
}

// ---------- Ordre ----------
export type TaskOption = Task & { label: string };

export function taskOptions(s: GameState): TaskOption[] {
  const opts: TaskOption[] = [
    { type: 'hvile', label: 'Hvile hjemme' },
    { type: 'pleie', label: 'Pleie de som hviler' },
    { type: 'lage', label: 'Lage utstyr (3 skrap, 1 tre)' },
    ...STATS.map((k): TaskOption => ({ type: 'trene', stat: k, label: `Trene ${STAT_LABEL[k]}` })),
  ];
  for (const id of PLAYABLE) {
    const sec = s.sectors[id], n = SECTORS[id].short, kind = SECTORS[id].kind;
    if (sec.z > 0 || sec.searched < 100) opts.push({ type: 'rydde', target: id, label: `Rydde ${n}` });
    if (sec.z === 0) opts.push({ type: 'sanke', target: id, label: `Sanke ${n}` });
    if (!sec.scouted) opts.push({ type: 'speide', target: id, label: `Speide ${n}` });
    if (sec.z === 0) opts.push({ type: 'vakt', target: id, label: `Holde vakt ${n}` });
    if (sec.z === 0 && (kind === 'bolig' || kind === 'offentlig')) opts.push({ type: 'overlevende', target: id, label: `Lete etter overlevende ${n}` });
  }
  for (const id of GATE_IDS) {
    if (s.sectors[GATES[id].sector].z !== 0) continue;
    if (s.gates[id].level < 3) opts.push({ type: 'befeste', target: id, label: `Befeste ${GATES[id].name}` });
    opts.push({ type: 'vakt', target: id, label: `Holde vakt ${GATES[id].name}` });
  }
  for (const d of TOKTS) if (toktAvailable(s, d)) opts.push({ type: 'tokt', target: d.id, label: `Tokt: ${d.name}` });
  return opts;
}

const targetOf = (t: Task): string | null => ('target' in t ? t.target : 'stat' in t ? t.stat : null);
/** Entydig nøkkel for en ordre, med mål eller ferdighet. */
/** Sektoren oppgaven foregår i, eller null for tokt. */
const whereIs = (t: Task): SectorId | null =>
  !('target' in t) ? 'hjem' : t.target in GATES ? GATES[t.target as GateId].sector : t.target in SECTORS ? (t.target as SectorId) : null;
export const taskKey = (t: Task) => `${t.type}:${targetOf(t) ?? ''}`;
export const sameTask = (a: Task, b: Task) => taskKey(a) === taskKey(b);

/** Kan dagen avsluttes? Ikke før alle encounters er løst, tokt har fått beslutning og en ny leder er valgt. */
export const canEndDay = (s: GameState): boolean => (!s.needLeader || !s.crew.length) && s.pending.length === 0 && !s.tokts.some((t) => t.awaiting);

/** Hva hindrer at dagen avsluttes nå? Ventende encounters først, så tokt-beslutninger, så valg av ny leder. Encounters kan drepe lederen og avslutte toktet, så rekkefølgen er alltid denne. */
export const endDayBlocker = (s: GameState): 'pending' | 'tokt' | 'leader' | null =>
  isFinished(s) ? null : s.pending.length ? 'pending' : s.tokts.some((t) => t.awaiting) ? 'tokt' : s.needLeader && s.crew.length ? 'leader' : null;

/** Er runden avgjort? Bare «won-seen» kan spille videre. */
export const isFinished = (s: Pick<GameState, 'over'>): boolean => s.over !== null && s.over !== 'won-seen';

/** Spilleren fortsetter på Buøy etter seieren. Runden er da i sandkassa og kan spilles videre. */
export function continueAfterWin(s: GameState): boolean {
  if (s.over !== 'won') return false;
  s.over = 'won-seen';
  return true;
}

/** Kan spilleren avslutte fasen? Fra og med dagen målet først ble nådd, og ikke mens noe venter på et valg. */
export const canEndPhase = (s: GameState): boolean => s.goalDay !== null && endDayBlocker(s) === null;

/** Avslutter fasen. Fase 1 er foreløpig siste: fase 2 finnes ikke ennå, så runden er vunnet. */
export function endPhase(s: GameState): string[] {
  if (!canEndPhase(s) || s.over) return [];
  if (s.phase === 1) { s.over = 'won'; return []; }
  return advancePhase(s);
}

/**
 * Turgrensen er nådd etter at målet er nådd: fasen avsluttes selv om noe venter. Ventende encounters
 * forsvinner, tokt kommer hjem med byttet, og mangler det en leder, tar den første i crewet over.
 */
export function forceEndPhase(s: GameState): string[] {
  if (s.goalDay === null || s.over) return [];
  s.pending = [];
  recallTokts(s);
  if (s.needLeader && s.crew.length) setLeader(s, s.crew[0].id);
  s.needLeader = false;
  return endPhase(s);
}

/** Nullstiller ordre som ikke lenger er gyldige. */
export function validateTasks(s: GameState) {
  const valid = taskOptions(s);
  // de som er ute på tokt er låst til det
  for (const c of s.crew) if (!isOnTokt(s, c) && !valid.some((o) => sameTask(o, c.task))) c.task = { type: 'hvile' };
}

// ---------- Dagsoppgjør ----------
const plural = (n: number) => `zombie${n === 1 ? '' : 'r'}`;
const names = (cs: CrewMember[]) => cs.map((c) => c.name).join(' og ');

export function resolveDay(s: GameState): LogLine[] {
  // bare «Fortsett på Buøy» kan spille videre etter at runden er avgjort. Dagen kan heller ikke løses mens
  // noe venter på et valg: serveren skal kunne stole på at motoren håndhever det selv.
  if (isFinished(s) || !canEndDay(s)) return [];
  const M = mods(s);
  const L: LogLine[] = [];
  const log = (t: string, kind: LogKind = '') => L.push({ t, kind });
  const team = (type: TaskType, target: string | null) => s.crew.filter((c) => c.task.type === type && targetOf(c.task) === target);
  expireQuests(s, log);
  /** Nivået hver person startet dagen på, så nivåopprykk kan meldes */
  const levels = new Map(s.crew.map((c) => [c.id, crewLevel(c.xp ?? 0)]));
  /** Sektorer noen fra crewet var i i dag. Der blir ingen kjeller glemt. Vakt og befesting står ved portens sektor,
   *  og hvile, trening, laging og pleie skjer hjemme. Tokt er langt unna. */
  const present = new Set(s.crew.map((c) => whereIs(c.task)));
  /** Erfaring til de som fortsatt er med i crewet */
  const xp = (cs: CrewMember[], k: StatKey, n: number) => { for (const c of cs) if (s.crew.includes(c)) gainXp(c, k, n); };

  // 0) Tokt først: hver dag ute trekker et kort (kap. 8), så tokt får plass under dagstaket før Rydde
  let encounters = resolveTokts(s, M, log, ENC_MAX_PER_DAY);

  // 1) Rydde og 2) Sanke
  const groups = {} as Record<SectorId, number>;
  const loud: SectorId[] = [];
  for (const id of PLAYABLE) {
    const ry = team('rydde', id), sa = team('sanke', id);
    groups[id] = (ry.length ? 1 : 0) + (sa.length ? 1 : 0);
    if (ry.length) {
      // støyen avgjøres av våpnene gruppa gikk ut med, før noe rekker å gå i stykker
      const noise = noiseProfile(ry);
      if (noise.loud) loud.push(id);
      rydde(s, id, ry, M, log); xp(ry, 'muskler', 1.5); xp(ry, 'nerver', 0.5);
      if (encounters < ENC_MAX_PER_DAY && rollEncounter(s, M, id, ry, noise, log)) encounters++;
    }
    if (sa.length && s.sectors[id].z === 0) { s.sectors[id].seen = true; s.sectors[id].scouted = true; sanke(s, id, sa, log); xp(sa, 'snoking', 1); }
  }

  // 2b) Speide
  for (const id of PLAYABLE) {
    const sp = team('speide', id);
    if (sp.length) { speide(s, id, sp, M, log); xp(sp, 'snoking', 1.5); }
  }

  // 2c) Vakt på sektor gir kontroll
  const watch: Partial<Record<SectorId, number>> = {};
  for (const id of PLAYABLE) {
    const vk = team('vakt', id);
    if (!vk.length) continue;
    watch[id] = watchControl(vk);
    log(`${names(vk)} holdt vakt ${SECTORS[id].at}.`);
    xp(vk, 'nerver', 1);
  }

  // 3) Befesting
  for (const id of GATE_IDS) {
    const tm = team('befeste', id);
    if (!tm.length) continue;
    let work = sum(tm.map((c) => buildPower(s, c)));
    const need = Math.ceil(work / 3);
    const used = Math.min(need, s.res.tre + s.res.skrap);
    if (used < need) work *= (used / need) * 0.7 + 0.3;
    for (let i = 0; i < used; i++) s.res[s.res.skrap > s.res.tre ? 'skrap' : 'tre']--;
    const up = addGateWork(s, id, work);
    wearTools(s, tm, log);
    xp(tm, 'mekk', 1.5);
    log(`${names(tm)} befestet ${GATES[id].name} (${used} tre og skrap).${up ? ` Nå nivå ${s.gates[id].level}.` : ''}${used < need ? ' Mangler tre eller skrap.' : ''}`, up ? 'good' : '');
  }

  // 3b) Lage utstyr
  for (const c of team('lage', null)) { lage(s, c, stat(c, 'mekk'), log); xp([c], 'mekk', 1.5); }

  // 3c) Trene
  for (const c of s.crew.filter((c) => c.task.type === 'trene')) if (c.task.type === 'trene') gainXp(c, c.task.stat, 5);

  // 3d) Lete etter overlevende
  for (const id of PLAYABLE) {
    const ov = team('overlevende', id);
    if (ov.length) { leteOverlevende(s, id, ov, log); xp(ov, 'prat', 1.5); }
  }


  // 3e) Pleie: de som hviler blir friskere uten medisin
  const nursed = new Set<CrewMember>();
  const nurses = s.crew.filter((c) => c.task.type === 'pleie');
  if (nurses.length) {
    for (const c of s.crew.filter((c) => c.task.type === 'hvile' && c.hp < 3)) { c.hp++; nursed.add(c); log(`${c.name} ble pleid av ${names(nurses)}, uten at medisinskapet ble åpnet.`); }
    for (const n of nurses) if (n.trait === 'nattevakt' && n.hp < 3) { n.hp++; log(`${n.name} pleide seg selv også. Gammel vane fra nattevakt på SUS.`); }
    xp(nurses, 'prat', 1);
  }

  // 4) Hvile
  for (const c of s.crew.filter((c) => c.task.type === 'hvile')) {
    if (c.hp >= 3 || nursed.has(c)) continue;
    const nurse = hasTrait(s, 'nattevakt');
    if (s.res.medisin > 0 && !(nurse && rand(s) < 0.5)) { s.res.medisin--; c.hp++; log(`${c.name} ble plastret med medisin.`); }
    else if (nurse || rand(s) < 0.35) { c.hp++; log(`${c.name} kom seg etter en dag på sofaen${nurse ? ' (og Monas strenge regime)' : ''}.`); }
  }

  // 4b) Nivåopprykk
  for (const c of s.crew) {
    const n = crewLevel(c.xp ?? 0), was = levels.get(c.id);
    if (was !== undefined && n > was) log(`${c.name} er nå nivå ${n}. Det merkes på alt ${c.name} gjør.`, 'good');
  }

  // 5) Forbruk
  s.res.mat -= dailyFood(s); s.res.vann -= dailyWater(s);
  // en sultedag er en dag der det ikke var nok mat eller vann til alle
  const starved = s.res.mat < 0 || s.res.vann < 0;
  if (starved) s.stats.starvedDays++;
  if (s.res.mat < 0) { s.res.mat = 0; s.moral -= 10; log('Det er tomt for mat. Noen foreslo å spise måkene. Ingen lo.', 'bad'); }
  if (s.res.vann < 0) { s.res.vann = 0; s.moral -= 12; log('Tomt for vann. I Stavanger. Det er nesten imponerende.', 'bad'); }
  // sult tærer på kroppen: de svakeste kan dø av det
  if (starved) for (const c of [...s.crew]) {
    if (rand(s) >= M.starveInjury) continue;
    if (c.hp > 1) { c.hp--; log(`${c.name} er svak av sult (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'bad'); }
    else injure(s, c, 'av sulten, på en måte', log);
  }
  if (rand(s) < 0.4) { const n = 3 + Math.floor(rand(s) * 4); s.res.vann += n; log(`Det regnet. Selvfølgelig. +${n} vann.`, 'fun'); }

  // Kontroll og forfall
  updateControl(s, M, groups, watch);
  decay(s, M, log);

  // 6) Natt: press mot sperringene. Crew som jobber ved porten tar vakta.
  for (const id of GATE_IDS) {
    const g = GATES[id], st = s.gates[id];
    xp(team('vakt', id), 'nerver', 1);
    const chance = clamp(g.base + M.nightBase - st.level * M.nightLevelReduction + s.day * M.nightGrowth, 0.02, 0.9);
    if (rand(s) >= chance) continue;
    let n = Math.max(1, 1 + Math.floor(rand(s) * (1 + s.day / M.breachDays)) - st.level);
    const guards = s.crew.filter((c) => (c.task.type === 'befeste' || c.task.type === 'vakt') && c.task.target === id);
    if (st.level >= 3 && guards.length) continue;
    if (guards.length) {
      const k = Math.min(n, sround(s, guardPower(s, guards) * 0.35));
      n -= k; s.stats.kills += k;
      if (!n) { log(`Natt: ${k} ${plural(k)} prøvde seg ved ${g.name}. ${names(guards)} holdt vakt.`, 'good'); continue; }
    }
    const target = id === 'ros' ? pick(s, ['hjem', 'obs', 'tommerodden', 'sorspissen'] as const) : g.sector;
    const sec = s.sectors[target];
    const wasClear = sec.z === 0;
    sec.z += n;
    sec.control -= 20;
    if (wasClear) s.moral -= 4;
    log(`Natt: ${n} ${plural(n)} kom forbi ${g.name} og står nå ${SECTORS[target].at}.${wasClear ? ' Sektoren er infisert igjen.' : ''}`, wasClear ? 'bad' : 'warn');
  }

  // 6b) Natt: bråk fra Rydde trekker zombier
  for (const id of loud) {
    if (rand(s) >= M.noiseAttract) continue;
    s.sectors[id].z++;
    log(`Natt: Bråket fra ryddingen ${SECTORS[id].at} trakk til seg en zombie.`, 'warn');
  }

  // 7) Natt: glemte kjellere, bare i sektorer ingen var i i dag
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if (present.has(id)) continue;
    if (sec.z === 0 && sec.hidden > 0 && sec.searched < 100 && rand(s) < M.hiddenOutbreak * sec.hidden) {
      const n = sec.hidden + Math.floor(rand(s) * 3);
      sec.z = n; sec.hidden = 0; sec.control -= 20;
      s.moral -= 8;
      log(`Natt: Noen glemte å sjekke kjelleren ${SECTORS[id].at}. ${n} zombier strømmer ut. Sektoren er infisert igjen.`, 'bad');
    }
  }

  floorControl(s);

  // 7b) Bosetting og matråte
  settle(s, log);
  rotFood(s, M);

  s.moral = clamp(s.moral + 2, 0, 100);
  s.day++;
  validateTasks(s);
  checkEnd(s);
  s.log.push({ day: s.day - 1, lines: L });
  if (s.log.length > 40) s.log.shift();
  return L;
}

export function phaseProgress(s: GameState) {
  const safe = PLAYABLE.filter((id) => isSafe(s.sectors[id])).length;
  const gates = GATE_IDS.map((id) => ({ id, name: GATES[id].name, level: s.gates[id].level }));
  return { safe, total: PLAYABLE.length, gates, done: safe === PLAYABLE.length && gates.every((g) => g.level >= 2) };
}

export function checkEnd(s: GameState) {
  // ventende encounters der ingen i gruppa lever lenger, forsvinner
  s.pending = s.pending.filter((p) => p.crew.some((id) => s.crew.some((c) => c.id === id)));
  if (!s.crew.length) { s.pending = []; s.tokts = []; }
  // tokt uten levende deltakere er tapt, med alt bytte
  for (const t of s.tokts) t.crew = t.crew.filter((id) => s.crew.some((c) => c.id === id));
  s.tokts = s.tokts.filter((t) => t.crew.length);
  // et tomt crew avslutter runden, også i sandkassa etter seier
  if (!s.crew.length && (s.over === null || s.over === 'won-seen')) { s.over = 'dead'; s.needLeader = false; return; }
  if (s.over) return;
  if (s.goalDay === null && phaseProgress(s).done) s.goalDay = s.day;
  if (s.day - s.phaseStartDay >= mods(s).turnCap) {
    if (s.goalDay !== null) forceEndPhase(s);
    else s.over = 'timeout';
  }
}
