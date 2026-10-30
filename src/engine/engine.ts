// Spillmotoren. Ren logikk: all tilfeldighet går gjennom state.rng, så samme
// state + samme ordre gir alltid samme resultat. Serveren kan kjøre
// resolveDay() selv når multiplayer kommer.
import { give, hasTag, lage, newCard, placeUniques } from './cards';
import { addNeighbor, canRecruit, injure, leteOverlevende, recruitablesNow, setLeader } from './crew';
import type { LogFn } from './crew';
import { noiseProfile, rollEncounter, ENC_MAX_PER_DAY } from './encounters';
import { AREA, GATES, LANDMARKS, GATE_STEPS, HEALTH_LABEL, PLAYABLE, SECTORS, STAT_LABEL, STATS } from './data';
import { advancePhase, BRANCHES, mods, PHASES } from './phases';
import { clamp, pick, rand, sround, sum } from './rng';
import { decay, floorControl, isSafe, rotFood, rydde, sanke, settle, speide, updateControl, watchControl, wearTools } from './sectors';
import { drawEvent } from './events';
import { isOnTokt, expireQuests, recallTokts, resolveTokts, toktAvailable, TOKTS } from './tokt';
import { crewLevel, fightPower, buildPower, gainXp, stat, toSkill } from './skills';
import type {
  CrewMember, GameState, GateId, LogKind, LogLine, Resources, SectorId, SelfSetup, StatKey, Stats, Task, TaskType, TraitId,
} from './types';

/** Vakter ved porten med et rekkevidde-våpen teller mer om natta. */
export const RANGE_GUARD = 1.25;
/** Så mange zombier kan stå i portens sektor uten at porten stenges for befesting og vakt. Laget tar dem først. */
export const GATE_STRAGGLERS = 2;
/** Sjansen for at en dag på sofaen helbreder uten medisin */
export const REST_HEAL = 0.45;
/** Med så få igjen kan overlevende banke på om natta, så runden kan reddes. */
export const COMEBACK_CREW = 2, COMEBACK_KNOCK = 0.3;

/** Samlet kampkraft for vaktene ved en port om natta. Rekkevidde-våpen teller mer. */
export const guardPower = (s: GameState, guards: CrewMember[]): number =>
  sum(guards.map((c) => fightPower(s, c) * (hasTag(c, 'rekkevidde') ? RANGE_GUARD : 1)));

export const GATE_IDS = Object.keys(GATES) as GateId[];

// ---------- Oppsett ----------
export function newGame(seed: number, self: SelfSetup, neighborIds: string[]): GameState {
  const s: GameState = {
    v: 3, seed, rng: seed | 0, day: 1, phase: 1, mutations: [], knownMutations: [], branchWeights: { bevegelse: 1, sanser: 1, kropp: 1, atferd: 1 }, goalDay: null, phaseStartDay: 1, moral: 70, stash: [], uniques: {}, nextUid: 1, needLeader: false,
    res: { mat: 14, vann: 10, medisin: 0, tre: 3, skrap: 3, metall: 0, strom: 0, drivstoff: 0 },
    flags: {}, crew: [], seenEvents: [], pending: [], event: null, recentEnc: [], tokts: [], toktsOpen: [], toktsDone: [], quests: [], log: [], over: null,
    sectors: {} as GameState['sectors'],
    gates: {} as GameState['gates'],
    stats: { kills: 0, found: 0, lost: 0, starvedDays: 0, deaths: { kamp: 0, natt: 0, tokt: 0 } },
  };
  s.crew.push({ id: 'meg', name: self.name || 'Deg', role: 'Deg', trait: self.trait, stats: Object.fromEntries(STATS.map((k) => [k, toSkill(self.stats[k])])) as Stats, hp: 3, task: { type: 'hvile' }, kills: 0, gear: {}, me: true, xp: 0 });
  give(s.crew[0], newCard(s, 'k_ror'));
  give(s.crew[0], newCard(s, 'baufil'));
  for (const id of neighborIds) addNeighbor(s, id);
  for (const id of PLAYABLE) {
    const d = SECTORS[id];
    const M0 = PHASES[1].mods;
    const loot = Object.fromEntries(Object.entries({ ...d.loot, mat: d.loot.mat * 1.3 }).map(([k, v]) => [k, Math.round(v * M0.lootMult)])) as Resources;
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
  (raw as GameState).event ??= null;
  (raw as GameState).pending ??= [];
  (raw as GameState).recentEnc ??= [];
  (raw as GameState).tokts ??= [];
  (raw as GameState).quests ??= [];
  // lagringer fra før toktene ble låst opp: Bybrua var åpent fra start
  (raw as GameState).toktsOpen ??= ['bybrua'];
  (raw as GameState).toktsDone ??= [];
  const g = raw as GameState & { zombieTraits?: unknown };
  delete g.zombieTraits;
  g.mutations ??= [];
  g.knownMutations ??= [];
  g.branchWeights ??= { bevegelse: 1, sanser: 1, kropp: 1, atferd: 1 };
  g.goalDay ??= null;
  g.phaseStartDay ??= 1;
  g.stats.starvedDays ??= 0;
  g.stats.deaths ??= { kamp: 0, natt: 0, tokt: 0 };
  // lagringer fra før nivåene (ingen i crewet har erfaring): omtrent én erfaring per dag spilt.
  // Nye spill setter xp: 0, så en nettopp rekruttert nabo får ikke gratis erfaring ved reload.
  if (g.crew.every((c) => c.xp === undefined)) for (const c of g.crew) c.xp = Math.max(0, g.day - 1);
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
    if (s.sectors[GATES[id].sector].z > GATE_STRAGGLERS) continue;
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

/** Kan dagen avsluttes? Ikke før hendelsen og alle encounters er løst, tokt har fått beslutning og en ny leder er valgt. */
export const canEndDay = (s: GameState): boolean => (!s.needLeader || !s.crew.length) && !s.event && s.pending.length === 0 && !s.tokts.some((t) => t.awaiting);

/**
 * Hva hindrer at dagen avsluttes nå? Dagens hendelse først, så ventende encounters, så tokt-beslutninger, så valg
 * av ny leder. Hendelser og encounters kan drepe lederen og avslutte toktet, så rekkefølgen er alltid denne.
 */
export const endDayBlocker = (s: GameState): 'event' | 'pending' | 'tokt' | 'leader' | null =>
  isFinished(s) ? null : s.event ? 'event' : s.pending.length ? 'pending' : s.tokts.some((t) => t.awaiting) ? 'tokt' : s.needLeader && s.crew.length ? 'leader' : null;

/**
 * Logger utfallet av en hendelse eller et encounter: tittel, valget, om sjekken lyktes og hva som endret seg.
 * Linja havner på den siste dagen som er logget (dagen valget kom fra), eller på dagen i dag før den første er over.
 */
export function logChoice(s: GameState, title: string, label: string, r: { ok: boolean; changes: string[] }, checked: boolean) {
  const how = checked ? (r.ok ? ' (lyktes)' : ' (mislyktes)') : '';
  const what = r.changes.length ? ` ${r.changes.join(', ')}.` : '';
  const line: LogLine = { t: `${title}: ${label.replace(/[.!?…]$/, '')}${how}.${what}`, kind: checked ? (r.ok ? 'good' : 'bad') : '' };
  const last = s.log.at(-1);
  if (last) last.lines.push(line);
  else s.log.push({ day: s.day, lines: [line] });
}

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
  s.event = null;
  recallTokts(s);
  if (s.needLeader && s.crew.length) setLeader(s, s.crew[0].id);
  s.needLeader = false;
  return endPhase(s);
}

/** Navnet på et sted eller en port, slik det står i meldinger. */
const placeName = (id: string): string => (id in GATES ? GATES[id as GateId].name : id in SECTORS ? SECTORS[id as SectorId].short : id);

/** Ordren som kort tekst i infinitiv, for meldinger. */
export function taskText(t: Task): string {
  switch (t.type) {
    case 'hvile': return 'hvile';
    case 'pleie': return 'pleie de som hviler';
    case 'lage': return 'lage utstyr';
    case 'trene': return `trene ${STAT_LABEL[t.stat].toLowerCase()}`;
    case 'rydde': return `rydde ${placeName(t.target)}`;
    case 'sanke': return `sanke ${placeName(t.target)}`;
    case 'speide': return `speide ${placeName(t.target)}`;
    case 'vakt': return `holde vakt ${placeName(t.target)}`;
    case 'overlevende': return `lete etter overlevende ${placeName(t.target)}`;
    case 'befeste': return `befeste ${placeName(t.target)}`;
    case 'tokt': return `dra på tokt (${placeName(t.target)})`;
  }
}

/** Hvorfor en ordre ikke lenger kan utføres. */
function invalidReason(s: GameState, t: Task): string {
  const sec = (id: string) => s.sectors[(id in GATES ? GATES[id as GateId].sector : id) as SectorId];
  switch (t.type) {
    case 'rydde': return `${placeName(t.target)} er ryddet og gjennomsøkt`;
    case 'speide': return `${placeName(t.target)} er allerede speidet`;
    case 'sanke': case 'overlevende': return `${placeName(t.target)} har zombier igjen`;
    case 'vakt': return sec(t.target)?.z > 0 ? `${placeName(t.target)} har zombier igjen` : 'stedet er ikke lenger tilgjengelig';
    case 'befeste': return sec(t.target)?.z > 0 ? `${placeName(t.target)} har zombier igjen` : `${placeName(t.target)} er fullt utbygd`;
    case 'tokt': return 'toktet er ikke lenger tilgjengelig';
    default: return 'ordren er ikke lenger mulig';
  }
}

/**
 * Nullstiller ordre som ikke lenger er gyldige, og sier fra om hvem og hvorfor. Meldingene går til `log`
 * (som 'warn') og returneres, så kallere uten dagslogg kan vise dem selv.
 */
export function validateTasks(s: GameState, log?: LogFn): string[] {
  const valid = taskOptions(s);
  const msgs: string[] = [];
  // de som er ute på tokt er låst til det
  for (const c of s.crew) {
    if (isOnTokt(s, c) || valid.some((o) => sameTask(o, c.task))) continue;
    const msg = `${c.name} fikk ikke ${taskText(c.task)}: ${invalidReason(s, c.task)}. Hviler i stedet.`;
    c.task = { type: 'hvile' };
    msgs.push(msg);
    log?.(msg, 'warn');
  }
  return msgs;
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
    if (sa.length && s.sectors[id].z === 0) { s.sectors[id].seen = true; s.sectors[id].scouted = true; sanke(s, id, sa, M, log); xp(sa, 'snoking', 1); }
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

  // 2d) Laget ved porten tar zombiene som står i portens sektor, og holder øye med den
  for (const id of GATE_IDS) {
    const tm = s.crew.filter((c) => (c.task.type === 'befeste' || c.task.type === 'vakt') && c.task.target === id);
    if (!tm.length) continue;
    const sid = GATES[id].sector, sec = s.sectors[sid];
    if (sec.z > 0) {
      const k = Math.min(sec.z, Math.max(1, sround(s, guardPower(s, tm) * 0.35)));
      sec.z -= k; s.stats.kills += k;
      log(`${names(tm)} tok ${k} ${plural(k)} ${SECTORS[sid].at} før de gikk til porten.`);
      for (const c of tm) if (rand(s) < 0.08 * M.injuryMult) injure(s, c, SECTORS[sid].at, log);
    }
    watch[sid] = (watch[sid] ?? 0) + watchControl(tm) / 2;
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
  const hungry = s.res.mat < dailyFood(s) || s.res.vann < dailyWater(s);
  if (nurses.length && !hungry) {
    for (const c of s.crew.filter((c) => c.task.type === 'hvile' && c.hp < 3)) { c.hp++; nursed.add(c); log(`${c.name} ble pleid av ${names(nurses)}, uten at medisinskapet ble åpnet.`); }
    for (const n of nurses) if (n.trait === 'nattevakt' && n.hp < 3) { n.hp++; log(`${n.name} pleide seg selv også. Gammel vane fra nattevakt på ${LANDMARKS.sus}.`); }
    xp(nurses, 'prat', 1);
  }

  // 4) Hvile. Uten nok mat og vann til dagen blir ingen friskere.
  if (hungry && s.crew.some((c) => c.task.type === 'hvile' && c.hp < 3)) log('Ingen blir friskere på tom mage.', 'warn');
  for (const c of s.crew.filter((c) => c.task.type === 'hvile')) {
    if (hungry || c.hp >= 3 || nursed.has(c)) continue;
    const nurse = hasTrait(s, 'nattevakt');
    if (s.res.medisin > 0 && !(nurse && rand(s) < 0.5)) { s.res.medisin--; c.hp++; log(`${c.name} ble plastret med medisin.`); }
    else if (nurse || rand(s) < REST_HEAL) { c.hp++; log(`${c.name} kom seg etter en dag på sofaen${nurse ? ` (og ${s.crew.find((x) => x.trait === 'nattevakt')!.name}s strenge regime)` : ''}.`); }
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
  if (s.res.vann < 0) { s.res.vann = 0; s.moral -= 12; log(`Tomt for vann. I ${AREA.city}. Det er nesten imponerende.`, 'bad'); }
  // sult tærer på kroppen: de svakeste kan dø av det
  if (starved) for (const c of [...s.crew]) {
    if (rand(s) >= M.starveInjury) continue;
    if (c.hp > 1) { c.hp--; log(`${c.name} er svak av sult (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'bad'); }
    else injure(s, c, 'av sulten, på en måte', log);
  }
  if (rand(s) < M.rainChance) { const n = 3 + Math.floor(rand(s) * 4); s.res.vann += n; log(`Det regnet. Selvfølgelig. +${n} vann.`, 'fun'); }
  // Maten på lageret blir dårlig litt etter litt
  const rot = Math.floor(s.res.mat * M.stashRot);
  if (rot > 0) s.res.mat -= rot;
  // Fyring: tre til ovnen hver dag. Uten ved fryser folk, og moralen synker.
  const heat = Math.ceil(s.crew.length * M.heatPerCrew);
  if (s.res.tre >= heat) s.res.tre -= heat;
  else { s.res.tre = 0; s.moral -= 3; log('Ingen ved i ovnen. Alle sitter i dobbel ullgenser og ser på hverandre.', 'warn'); }

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
    const target = g.spills?.length ? pick(s, g.spills) : g.sector;
    const sec = s.sectors[target];
    const wasClear = sec.z === 0;
    sec.z += n;
    sec.control -= 20;
    if (wasClear) s.moral -= 4;
    log(`Natt: ${n} ${plural(n)} kom forbi ${g.name} og står nå ${SECTORS[target].at}.${wasClear ? ' Sektoren er infisert igjen.' : ''}`, wasClear ? 'bad' : 'warn');
  }

  // 6a) Comeback: når nesten alle er borte, finner overlevende frem til dere
  if (s.crew.length > 0 && s.crew.length <= COMEBACK_CREW && rand(s) < COMEBACK_KNOCK) {
    const cands = recruitablesNow(s);
    if (cands.length && canRecruit(s)) {
      const n = pick(s, cands);
      addNeighbor(s, n.id);
      log(`Natt: Det banker på døra. ${n.name} (${n.age}) har sett lyset i vinduet og vil heller være med dere enn alene. «${n.quip}»`, 'good');
    }
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
  validateTasks(s, log);
  checkEnd(s);
  // 8) Dagens hendelse trekkes til slutt, etter natta, så rekkefølgen i rng er den samme hver gang.
  // Den lagres som ventende, og spilleren velger med resolveEvent() før neste dag.
  const ev = s.over ? null : drawEvent(s);
  s.event = ev ? { id: ev.id } : null;
  // linjer som ble logget før den første dagen var over (introen), havner på samme dag
  const same = s.log.at(-1);
  if (same && same.day === s.day - 1) same.lines.push(...L);
  else s.log.push({ day: s.day - 1, lines: [...L] });
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
  if (!s.crew.length) { s.pending = []; s.tokts = []; s.event = null; }
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
