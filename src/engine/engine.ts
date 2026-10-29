// Spillmotoren. Ren logikk: all tilfeldighet går gjennom state.rng, så samme
// state + samme ordre gir alltid samme resultat. Serveren kan kjøre
// resolveDay() selv når multiplayer kommer.
import { GATES, GATE_STEPS, GEAR, HEALTH_LABEL, NEIGHBORS, PLAYABLE, RES, RES_LABEL, SECTORS, STATS } from './data';
import { mods } from './phases';
import { clamp, pick, rand, sround, sum } from './rng';
import { stat, toSkill } from './skills';
import type {
  CrewMember, GameState, GateId, LogKind, LogLine, SectorId, SelfSetup, Stats, Task, TaskType, TraitId,
} from './types';

export const GATE_IDS = Object.keys(GATES) as GateId[];
const lootLeft = (sec: GameState['sectors'][SectorId]) => sum(Object.values(sec.loot));

// ---------- Oppsett ----------
export function newGame(seed: number, self: SelfSetup, neighborIds: string[]): GameState {
  const s: GameState = {
    v: 3, seed, rng: seed | 0, day: 1, phase: 1, zombieTraits: [], moral: 70, gear: 1,
    res: { mat: 14, vann: 10, medisin: 2, tre: 3, skrap: 3, metall: 0, strom: 0, drivstoff: 0 },
    flags: {}, crew: [], seenEvents: [], log: [], over: null,
    sectors: {} as GameState['sectors'],
    gates: {} as GameState['gates'],
    stats: { kills: 0, found: 0, lost: 0 },
  };
  s.crew.push({ id: 'meg', name: self.name || 'Deg', role: 'Deg', trait: self.trait, stats: Object.fromEntries(STATS.map((k) => [k, toSkill(self.stats[k])])) as Stats, hp: 3, task: { type: 'hvile' }, kills: 0, me: true });
  for (const id of neighborIds) addNeighbor(s, id);
  for (const id of PLAYABLE) {
    const d = SECTORS[id];
    s.sectors[id] = { z: d.z, hidden: d.hidden, loot: { ...d.loot }, lootMax: sum(Object.values(d.loot)), miss: null, noise: 0, seen: id === 'hjem', special: false, cleared: false };
  }
  for (const id of GATE_IDS) s.gates[id] = { work: 0, level: 0 };
  return s;
}

export function addNeighbor(s: GameState, id: string) {
  const n = NEIGHBORS.find((x) => x.id === id);
  if (!n) throw new Error(`Ukjent nabo: ${id}`);
  s.crew.push({ id: n.id, name: n.name, role: n.role, trait: n.trait, stats: { ...n.stats }, hp: 3, task: { type: 'hvile' }, kills: 0 });
}

/** Godtar bare v3. Lagring fra prototypen (v1/v2) forkastes. */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as { v?: number };
  return s.v === 3 ? (raw as GameState) : null;
}

// ---------- Avledede verdier ----------
// Styrkeformlene regner i gamle prikkenheter: stat(c, k) / 10.
const moralMult = (s: GameState) => (s.moral < 25 ? 0.75 : s.moral < 50 ? 0.9 : 1);
const hpMult = (c: CrewMember) => (c.hp >= 3 ? 1 : c.hp === 2 ? 0.85 : 0.55);

export function fightPower(s: GameState, c: CrewMember): number {
  let p = (stat(c, 'muskler') * 1.0 + stat(c, 'nerver') * 0.5 + stat(c, 'kondis') * 0.3) / 10;
  if (c.trait === 'hv') p += 2;
  return p * GEAR[s.gear].mult * moralMult(s) * hpMult(c);
}
export function detectChance(team: CrewMember[]): number {
  if (!team.length) return 0;
  const avg = sum(team.map((c) => stat(c, 'snoking') / 10)) / team.length;
  const p = 0.1 + 0.05 * avg + (team.some((c) => c.trait === 'los') ? 0.1 : 0);
  return clamp(p, 0.05, 0.6);
}
export function searchPower(s: GameState, c: CrewMember): number {
  let p = (stat(c, 'snoking') + stat(c, 'kondis') * 0.3) / 10;
  if (c.trait === 'lokalkjent') p += 2;
  return p * moralMult(s) * hpMult(c);
}
export function buildPower(s: GameState, c: CrewMember): number {
  let p = (stat(c, 'mekk') + stat(c, 'muskler') * 0.4) / 10;
  if (c.trait === 'sveiser') p += 3;
  if (c.trait === 'hms' || c.trait === 'dugnad') p += 2;
  if (s.flags.aggregat) p *= 1.3;
  return p * moralMult(s) * hpMult(c);
}
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

export interface SectorIntel {
  status: 'infisert' | 'klarert';
  estimate: string;
  conf?: number;
  confExact?: boolean;
  searched: number;
}

/** Hva crewet tror om en sektor. Ekte tall bare der det er rimelig. */
export function sectorIntel(s: GameState, id: SectorId): SectorIntel {
  const sec = s.sectors[id];
  const out: SectorIntel = {
    status: sec.z > 0 ? 'infisert' : 'klarert',
    estimate: sec.seen ? `${sec.z}` : `${Math.max(1, Math.round(sec.z * 0.6))}–${Math.round(sec.z * 1.4) + 1}`,
    searched: Math.round((1 - lootLeft(sec) / Math.max(1, sec.lootMax)) * 100),
  };
  if (sec.z === 0) {
    const real = 1 - (sec.miss ?? 1);
    if (hasTrait(s, 'regneark')) { out.conf = Math.round(real * 100); out.confExact = true; }
    else out.conf = clamp(Math.round((real + sec.noise) * 100), 5, 99);
  }
  return out;
}

// ---------- Ordre ----------
export type TaskOption = Task & { label: string };

export function taskOptions(s: GameState): TaskOption[] {
  const opts: TaskOption[] = [{ type: 'hvile', label: 'Hvile hjemme' }];
  for (const id of PLAYABLE) {
    const sec = s.sectors[id], n = SECTORS[id].short;
    if (sec.z > 0) opts.push({ type: 'klarere', target: id, label: `Klarere ${n}` });
    else {
      if (lootLeft(sec) > 0) opts.push({ type: 'lete', target: id, label: `Lete i ${n}` });
      opts.push({ type: 'finsjekk', target: id, label: `Finsjekke ${n}` });
    }
  }
  for (const id of GATE_IDS) {
    if (s.gates[id].level < 3 && s.sectors[GATES[id].sector].z === 0) opts.push({ type: 'befeste', target: id, label: `Befeste ${GATES[id].name}` });
  }
  return opts;
}

export const sameTask = (a: Task, b: Task) => a.type === b.type && ('target' in a ? a.target : null) === ('target' in b ? b.target : null);
const targetOf = (t: Task) => ('target' in t ? t.target : null);

/** Holder sektorstatus i takt med zombietallet og nullstiller ugyldige ordre. */
export function validateTasks(s: GameState) {
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if (sec.z > 0 && sec.cleared) { sec.cleared = false; sec.miss = null; }
    if (sec.z === 0 && !sec.cleared) { sec.cleared = true; sec.miss = sec.miss ?? 0.7; sec.noise = 0; }
  }
  const valid = taskOptions(s);
  for (const c of s.crew) if (!valid.some((o) => sameTask(o, c.task))) c.task = { type: 'hvile' };
}

// ---------- Dagsoppgjør ----------
const EULOGY: ((c: CrewMember) => string)[] = [
  (c) => `Hvil i fred, ${c.name}. Vi tar vare på kaffekoppen din.`,
  (c) => `${c.name} er ikke lenger med oss. Teknisk sett er ${c.name} fortsatt med oss, bare ikke på vår side.`,
  () => 'Crewet holder ett minutts stillhet. Det blir avbrutt av stønning fra Bybrua.',
];
const plural = (n: number) => `zombie${n === 1 ? '' : 'r'}`;
const names = (cs: CrewMember[]) => cs.map((c) => c.name).join(' og ');

export function resolveDay(s: GameState): LogLine[] {
  const M = mods(s);
  const L: LogLine[] = [];
  const log = (t: string, kind: LogKind = '') => L.push({ t, kind });
  const team = (type: TaskType, target: string) => s.crew.filter((c) => c.task.type === type && targetOf(c.task) === target);
  const injure = (c: CrewMember, why: string) => {
    c.hp -= 1;
    if (c.hp <= 0) {
      log(`${c.name} ble bitt ${why}. ${pick(s, EULOGY)(c)}`, 'bad');
      s.moral -= 15; s.stats.lost++;
      s.crew = s.crew.filter((x) => x !== c);
    } else log(`${c.name} ble skadet ${why} (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'warn');
  };

  // 1) Klarering og finsjekk
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    const clr = team('klarere', id), fin = team('finsjekk', id);
    const all = [...clr, ...fin];
    if (!all.length) continue;
    sec.seen = true;
    if (clr.length && sec.z > 0) {
      const power = sum(clr.map((c) => fightPower(s, c)));
      const before = sec.z;
      const kills = Math.min(sec.z, sround(s, power * (0.35 + rand(s) * 0.25) * M.killMult));
      sec.z -= kills; s.stats.kills += kills;
      for (let i = 0; i < kills; i++) pick(s, clr).kills++;
      log(`${names(clr)} ryddet ${kills} ${plural(kills)} i ${SECTORS[id].short}.${sec.z > 0 ? ` ${sec.z} igjen.` : ''}`);
      for (const c of clr) {
        const risk = clamp((0.04 + 0.22 * (before / (power * 1.5 + 1)) - (stat(c, 'kondis') / 10) * 0.02) * M.injuryMult, 0.02, 0.45);
        if (rand(s) < risk) injure(c, `i ${SECTORS[id].short}`);
      }
      if (clr.some((c) => c.trait === 'hv') && rand(s) < 0.3) log('Tor-Egil sammenlignet det med øvelse Cold Response. Igjen.', 'fun');
      if (clr.some((c) => c.trait === 'russ') && rand(s) < 0.25) log('Sondre filmet alt til en TikTok ingen kommer til å se.', 'fun');
    }
    // Leting etter skjulte zombier i kjellere, boder og garasjer
    const checkers = sec.z === 0 ? all : fin;
    if (checkers.length && sec.hidden > 0) {
      const p = detectChance(checkers) + (fin.length ? 0.1 : 0);
      let found = 0;
      for (let i = 0; i < sec.hidden; i++) if (rand(s) < p) found++;
      if (found) {
        sec.hidden -= found; s.stats.kills += found;
        log(`Fant ${found} ${plural(found)} gjemt i kjellerboder i ${SECTORS[id].short}. Tatt hånd om.`, 'good');
        if (rand(s) < 0.15 * M.injuryMult) injure(pick(s, checkers), 'i en kjellerbod');
      }
    }
    if (sec.z === 0 && checkers.length) {
      const p = detectChance(checkers) + (fin.length ? 0.1 : 0);
      sec.miss = (sec.miss ?? 1) * (1 - p);
    }
    if (sec.z === 0 && !sec.cleared) {
      sec.cleared = true;
      if (sec.miss == null) sec.miss = 1 - detectChance(all);
      sec.noise = (rand(s) - 0.3) * 0.35;
      log(`${SECTORS[id].name} er klarert.`, 'good');
      if (hasTrait(s, 'hms')) log('Kjell har fylt ut avviksskjema for klareringen. I tre eksemplarer.', 'fun');
    }
  }

  // 2) Leting
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    const tm = team('lete', id);
    if (!tm.length) continue;
    const frac = 1 - Math.exp(-sum(tm.map((c) => searchPower(s, c))) * 0.09);
    const got: string[] = [];
    for (const r of RES) {
      const n = Math.min(sec.loot[r], sround(s, sec.loot[r] * frac));
      if (n > 0) { sec.loot[r] -= n; s.res[r] += n; s.stats.found += n; got.push(`${n} ${RES_LABEL[r].toLowerCase()}`); }
    }
    log(`${names(tm)} lette i ${SECTORS[id].short}: ${got.length ? got.join(', ') : 'ingenting av verdi, bare IKEA-møbler'}.`);
    const sp = SECTORS[id].special;
    if (sp && !sec.special && lootLeft(sec) / sec.lootMax <= 0.5) {
      sec.special = true;
      log(sp.text, 'find');
      if (sp.res) for (const r of RES) s.res[r] += sp.res[r] ?? 0;
      if (sp.gear) s.gear = Math.max(s.gear, sp.gear);
      if (sp.flag) s.flags[sp.flag] = true;
      if (sp.moral) s.moral += sp.moral;
    }
    if (sec.hidden > 0 && rand(s) < 0.15 * sec.hidden) {
      sec.hidden -= 1; s.stats.kills++;
      const c = pick(s, tm);
      log(`En zombie lå gjemt i en bod i ${SECTORS[id].short}. ${c.name} fikk overraskelsen.`, 'warn');
      if (rand(s) < (0.35 - (stat(c, 'kondis') / 10) * 0.04) * M.injuryMult) injure(c, 'av en bodzombie');
    }
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
    log(`${names(tm)} befestet ${GATES[id].name} (${used} byggemateriale).${up ? ` Nå nivå ${s.gates[id].level}.` : ''}${used < need ? ' Mangler materialer.' : ''}`, up ? 'good' : '');
  }

  // 4) Hvile
  for (const c of s.crew.filter((c) => c.task.type === 'hvile')) {
    if (c.hp >= 3) continue;
    const nurse = hasTrait(s, 'nattevakt');
    if (s.res.medisin > 0 && !(nurse && rand(s) < 0.5)) { s.res.medisin--; c.hp++; log(`${c.name} ble plastret med medisin.`); }
    else if (nurse || rand(s) < 0.35) { c.hp++; log(`${c.name} kom seg etter en dag på sofaen${nurse ? ' (og Monas strenge regime)' : ''}.`); }
  }

  // 5) Forbruk
  s.res.mat -= dailyFood(s); s.res.vann -= dailyWater(s);
  if (s.res.mat < 0) { s.res.mat = 0; s.moral -= 10; log('Det er tomt for mat. Noen foreslo å spise måkene. Ingen lo.', 'bad'); }
  if (s.res.vann < 0) { s.res.vann = 0; s.moral -= 12; log('Tomt for vann. I Stavanger. Det er nesten imponerende.', 'bad'); }
  if (rand(s) < 0.4) { const n = 3 + Math.floor(rand(s) * 4); s.res.vann += n; log(`Det regnet. Selvfølgelig. +${n} vann.`, 'fun'); }

  // 6) Natt: press mot sperringene. Crew som jobber ved porten tar vakta.
  for (const id of GATE_IDS) {
    const g = GATES[id], st = s.gates[id];
    const chance = clamp(g.base + M.nightBase - st.level * M.nightLevelReduction + s.day * M.nightGrowth, 0.02, 0.9);
    if (rand(s) >= chance) continue;
    let n = Math.max(1, 1 + Math.floor(rand(s) * (1 + s.day / M.breachDays)) - st.level);
    const guards = s.crew.filter((c) => (c.task.type === 'befeste' && c.task.target === id) || ((c.task.type === 'klarere' || c.task.type === 'finsjekk') && c.task.target === g.sector));
    if (guards.length) {
      const k = Math.min(n, sround(s, sum(guards.map((c) => fightPower(s, c))) * 0.35));
      n -= k; s.stats.kills += k;
      if (!n) { log(`Natt: ${k} ${plural(k)} prøvde seg ved ${g.name}. ${names(guards)} holdt vakt.`, 'good'); continue; }
    }
    const target = id === 'ros' ? pick(s, ['hjem', 'obs', 'tommerodden', 'sorspissen'] as const) : g.sector;
    const sec = s.sectors[target];
    const wasClear = sec.z === 0;
    sec.z += n;
    if (wasClear) { sec.cleared = false; sec.miss = null; s.moral -= 4; }
    log(`Natt: ${n} ${plural(n)} kom forbi ${g.name} og inn i ${SECTORS[target].short}.${wasClear ? ' Sektoren er infisert igjen.' : ''}`, wasClear ? 'bad' : 'warn');
  }

  // 7) Natt: glemte kjellere
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if (sec.z === 0 && sec.hidden > 0 && rand(s) < M.hiddenOutbreak * sec.hidden) {
      const n = sec.hidden + Math.floor(rand(s) * 3);
      sec.z = n; sec.hidden = 0; sec.cleared = false; sec.miss = null;
      s.moral -= 8;
      log(`Natt: Noen glemte å sjekke kjelleren i ${SECTORS[id].short}. ${n} zombier strømmer ut. Sektoren er infisert igjen.`, 'bad');
    }
  }

  s.moral = clamp(s.moral + 2, 0, 100);
  s.day++;
  validateTasks(s);
  checkEnd(s);
  s.log.push({ day: s.day - 1, lines: L });
  if (s.log.length > 40) s.log.shift();
  return L;
}

export function phaseProgress(s: GameState) {
  const cleared = PLAYABLE.filter((id) => s.sectors[id].z === 0).length;
  const gates = GATE_IDS.map((id) => ({ id, name: GATES[id].name, level: s.gates[id].level }));
  return { cleared, total: PLAYABLE.length, gates, done: cleared === PLAYABLE.length && gates.every((g) => g.level >= 2) };
}

export function checkEnd(s: GameState) {
  if (s.over) return;
  if (!s.crew.length) s.over = 'dead';
  else if (phaseProgress(s).done) s.over = 'won';
}
