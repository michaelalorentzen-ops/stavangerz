// Sektorer: Rydde, Sanke, kontroll, forfall og bosetting. Ren logikk.
import { PLAYABLE, RES, RES_LABEL, SECTORS } from './data';
import { armorMult, collectDropped, hasTag, isRanged, newCard, rollCard, wear } from './cards';
import { CARDS } from './content/cards';
import { injure } from './crew';
import type { LogFn } from './crew';
import { hasMutation } from './phases';
import type { PhaseModifiers } from './phases';
import { clamp, pick, rand, sround, sum } from './rng';
import { detectChance, fightPower, searchPower, stat } from './skills';
import type { CrewMember, GameState, SectorId, SectorState, WeaponTag } from './types';

/** Indeks = trusselnivå 1–5. Indeks 0 er ubrukt. */
export const THREAT_KILL = [0, 1, 0.9, 0.78, 0.66, 0.55];
export const THREAT_INJURY = [0, 1, 1.15, 1.35, 1.6, 1.9];

/** Regelkonstanter for Vakt på sektor og Speide (ikke vanskelighetsknotter). */
export const WATCH_CONTROL_BASE = 15, WATCH_CONTROL_PER_NERVER = 3;
export const SPEIDE_INJURY = 0.03;
/** Våpenegenskaper i Rydde: avstand senker skaderisiko, spredning og gjennomslag øker drap. */
export const RANGED_INJURY = 0.75, SPREAD_KILL = 1.1, SPREAD_MIN_Z = 8, PIERCE_KILL = 1.15;
/** Kontroll en sektor får av én dags vakt, etter beste Nerver i teamet. */
export const watchControl = (team: CrewMember[]) =>
  WATCH_CONTROL_BASE + (Math.max(...team.map((c) => stat(c, 'nerver'))) / 10) * WATCH_CONTROL_PER_NERVER;

export const lootLeft = (sec: SectorState) => sum(Object.values(sec.loot));
const plural = (n: number) => `zombie${n === 1 ? '' : 'r'}`;
const names = (cs: CrewMember[]) => cs.map((c) => c.name).join(' og ');

/**
 * Øker gjennomsøkt-prosenten utenom et vanlig søk (kamp, hendelser). De siste kjellerne sjekkes bare
 * av Rydde i en tom sektor, så med skjulte zombier igjen stopper den på 99. Ellers ville sektoren stått
 * på 100 % uten Rydde som valg, og aldri blitt trygg.
 */
export function raiseSearched(sec: SectorState, n: number) {
  sec.searched = Math.min(sec.hidden > 0 ? 99 : 100, sec.searched + n);
}

export function isSafe(sec: SectorState): boolean {
  return sec.z === 0 && sec.hidden === 0 && sec.searched >= 100 && sec.control >= 50;
}

export interface SectorIntel {
  estimate: string;
  searched: number;
  control: number;
  safe: boolean;
  /** null til sektoren er speidet */
  threat: number | null;
  /** eksakt antall gjemte zombier. Bare Regnearket vet det, ellers null */
  hidden: number | null;
}

/** Hva crewet vet om en sektor. Zombietallet er et anslag til sektoren er sett. */
export function sectorIntel(s: GameState, id: SectorId): SectorIntel {
  const sec = s.sectors[id];
  return {
    estimate: sec.seen ? `${sec.z}` : `${Math.max(1, Math.round(sec.z * 0.6))}–${Math.round(sec.z * 1.4) + 1}`,
    searched: Math.round(sec.searched),
    control: Math.round(sec.control),
    safe: isSafe(sec),
    threat: sec.scouted ? SECTORS[id].threat : null,
    hidden: s.crew.some((c) => c.trait === 'regneark') ? sec.hidden : null,
  };
}

/** Gjennomsøkt-gevinst på en dag med full innsats mot en tom sektor. */
const searchGain = (s: GameState, team: CrewMember[]) => clamp(sum(team.map((c) => searchPower(s, c))) * 4, 8, 45);

/** Sektorens funn tas første gang gjennomsøkt-prosenten krysser 50. */
function checkSpecial(s: GameState, id: SectorId, before: number, log: LogFn) {
  const sec = s.sectors[id], sp = SECTORS[id].special;
  if (!sp || sec.specialFound || before >= 50 || sec.searched < 50) return;
  sec.specialFound = true;
  log(sp.text, 'find');
  if (sp.res) for (const r of RES) s.res[r] += sp.res[r] ?? 0;
  if (sp.card) {
    const k = newCard(s, sp.card);
    s.stash.push(k);
    log(`Crewet fikk med seg ${CARDS[k.def].name}.`, 'find');
  }
  if (sp.flag) s.flags[sp.flag] = true;
  if (sp.moral) s.moral += sp.moral;
}

/** Sektorens unike kort tas første gang gjennomsøkt-prosenten krysser 60. */
function checkUnique(s: GameState, id: SectorId, before: number, log: LogFn) {
  const def = s.uniques[id];
  if (!def || before >= 60 || s.sectors[id].searched < 60) return;
  delete s.uniques[id];
  const k = newCard(s, def);
  s.stash.push(k);
  log(`Gjemt bak et panel i ${SECTORS[id].short} lå ${CARDS[def].name}. ${CARDS[def].text}`, 'find');
}

/** Slitasje på verktøy for alle i teamet. */
export function wearTools(s: GameState, team: CrewMember[], log: LogFn) {
  for (const c of team) wear(s, c, 'verktoy', log);
}

/** Rydde: kjemp mot synlige zombier, eller gjennomsøk en tom sektor. */
export function rydde(s: GameState, id: SectorId, team: CrewMember[], M: PhaseModifiers, log: LogFn) {
  const sec = s.sectors[id], def = SECTORS[id];
  sec.seen = true; sec.scouted = true;
  const searchedBefore = sec.searched;

  if (sec.z > 0) {
    const power = sum(team.map((c) => fightPower(s, c)));
    const before = sec.z;
    const anyTag = (tag: WeaponTag) => team.some((c) => hasTag(c, tag));
    let tagMult = 1;
    if (before >= SPREAD_MIN_Z && anyTag('spredning')) tagMult *= SPREAD_KILL;
    if (anyTag('gjennomslag') && (hasMutation(s, 'seige') || hasMutation(s, 'pansret'))) tagMult *= PIERCE_KILL;
    const ranged = new Set(team.filter(isRanged));
    const kills = Math.min(sec.z, sround(s, power * (0.35 + rand(s) * 0.25) * M.killMult * THREAT_KILL[def.threat] * tagMult));
    for (const c of team) wear(s, c, 'vapen', log);
    sec.z -= kills; s.stats.kills += kills;
    for (let i = 0; i < kills; i++) pick(s, team).kills++;
    log(`${names(team)} ryddet ${kills} ${plural(kills)} i ${def.short}.${sec.z > 0 ? ` ${sec.z} igjen.` : ' Sektoren er tom for synlige zombier.'}`);
    for (const c of team) {
      const risk = clamp((0.04 + 0.22 * (before / (power * 1.5 + 1)) - (stat(c, 'kondis') / 10) * 0.02) * M.injuryMult * THREAT_INJURY[def.threat] * armorMult(c) * (ranged.has(c) ? RANGED_INJURY : 1), 0.02, 0.45);
      if (rand(s) < risk) injure(s, c, `i ${def.short}`, log);
    }
    if (team.some((c) => c.trait === 'hv') && rand(s) < 0.3) log('Tor-Egil sammenlignet det med øvelse Cold Response. Igjen.', 'fun');
    if (team.some((c) => c.trait === 'russ') && rand(s) < 0.25) log('Sondre filmet alt til en TikTok ingen kommer til å se.', 'fun');
    raiseSearched(sec, searchGain(s, team) * 0.3);
    checkSpecial(s, id, searchedBefore, log);
    checkUnique(s, id, searchedBefore, log);
    wearTools(s, team, log);
    pickUp(s, id, team, log);
    return;
  }

  // Tom for synlige zombier: gjennomsøk
  if (rand(s) < M.cardFind) {
    const k = rollCard(s, def.threat);
    s.stash.push(k);
    log(`${names(team)} fant ${CARDS[k.def].name} i ${def.short}.`, 'find');
  }
  const gain = searchGain(s, team);
  if (sec.hidden > 0) {
    const p = detectChance(team);
    let found = 0;
    for (let i = 0; i < sec.hidden; i++) if (rand(s) < p) found++;
    if (found) {
      sec.hidden -= found; s.stats.kills += found;
      log(`Fant ${found} ${plural(found)} gjemt i kjellerboder i ${def.short}. Tatt hånd om.`, 'good');
      if (rand(s) < 0.15 * M.injuryMult) injure(s, pick(s, team), 'i en kjellerbod', log);
    }
  }
  const share = Math.min(1, gain / Math.max(1, 100 - searchedBefore));
  const got: string[] = [];
  for (const r of RES) {
    const n = share >= 1 ? sec.loot[r] : Math.min(sec.loot[r], sround(s, sec.loot[r] * share));
    if (n > 0) { sec.loot[r] -= n; s.res[r] += n; s.stats.found += n; got.push(`${n} ${RES_LABEL[r].toLowerCase()}`); }
  }
  sec.searched = Math.min(100, searchedBefore + gain);
  log(`${names(team)} gjennomsøkte ${def.short}: ${got.length ? got.join(', ') : 'ingenting av verdi, bare IKEA-møbler'}. ${Math.round(sec.searched)} % gjennomsøkt.`);
  if (sec.searched >= 100 && sec.hidden > 0) {
    s.stats.kills += sec.hidden;
    log(`I den siste kjelleren i ${def.short} lå ${sec.hidden} ${plural(sec.hidden)}. Ingen gjemmer seg lenger.`, 'good');
    sec.hidden = 0;
    if (rand(s) < 0.15 * M.injuryMult) injure(s, pick(s, team), 'i den siste kjelleren', log);
  }
  checkSpecial(s, id, searchedBefore, log);
  checkUnique(s, id, searchedBefore, log);
  wearTools(s, team, log);
  pickUp(s, id, team, log);
}

/** Speide: finn ut trusselnivået uten å ta kamp. Liten risiko for å bli oppdaget. */
export function speide(s: GameState, id: SectorId, team: CrewMember[], M: PhaseModifiers, log: LogFn) {
  const sec = s.sectors[id], def = SECTORS[id];
  sec.seen = true; sec.scouted = true;
  log(`${names(team)} speidet i ${def.short}: trusselnivå ${def.threat} av 5, og ${sec.z} ${plural(sec.z)} i sikte.`);
  if (s.uniques[id]) log(`Rykter om noe spesielt i ${def.short}. Ingen vet hva, men alle har en mening.`, 'find');
  for (const c of team) if (rand(s) < SPEIDE_INJURY * THREAT_INJURY[def.threat] * M.injuryMult) injure(s, c, `på speiding i ${def.short}`, log);
}

/** Utstyr som ligger igjen hentes av de som er i sektoren. */
function pickUp(s: GameState, id: SectorId, team: CrewMember[], log: LogFn) {
  if (team.some((c) => s.crew.includes(c))) collectDropped(s, id, log);
}

/** Sanke: hent dagens utbytte fra en sektor uten zombier. */
export function sanke(s: GameState, id: SectorId, team: CrewMember[], log: LogFn) {
  const def = SECTORS[id];
  const power = sum(team.map((c) => searchPower(s, c)));
  const got: string[] = [];
  for (const r of RES) {
    const base = def.yield[r];
    if (!base) continue;
    const n = sround(s, base * (0.5 + 0.1 * power));
    if (n > 0) { s.res[r] += n; s.stats.found += n; got.push(`${n} ${RES_LABEL[r].toLowerCase()}`); }
  }
  log(`${names(team)} sanket i ${def.short}: ${got.length ? got.join(', ') : 'ingenting i dag'}.`);
  wearTools(s, team, log);
  pickUp(s, id, team, log);
}

/** Kontroll: +10 per gruppe med Rydde eller Sanke, vakt gir eget tillegg, forfall der ingen er. */
export function updateControl(s: GameState, M: PhaseModifiers, groups: Record<SectorId, number>, watch: Partial<Record<SectorId, number>> = {}) {
  const frozen = Object.values(s.gates).every((g) => g.level >= 3);
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if ((groups[id] ?? 0) > 0 || watch[id] !== undefined) sec.control += 10 * (groups[id] ?? 0) + (watch[id] ?? 0);
    else if (!frozen) sec.control -= M.controlDecay;
    sec.control = clamp(sec.control, sec.settled ? 50 : 0, 100);
  }
}

/** Forfall: uten kontroll glemmer sektoren hva dere ryddet, og zombier siver inn. */
export function decay(s: GameState, M: PhaseModifiers, log: LogFn) {
  const avgGate = sum(Object.values(s.gates).map((g) => g.level)) / Object.keys(s.gates).length;
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    if (sec.control >= 30) continue;
    sec.searched = Math.max(0, sec.searched - M.searchedDecay);
    if (rand(s) < M.creepChance * (1 - sec.control / 30) * (1 - avgGate / 3)) {
      const wasClear = sec.z === 0;
      sec.z++;
      if (wasClear) log(`Noe har sneket seg inn i ${SECTORS[id].short} mens ingen holdt øye med den.`, 'warn');
    }
  }
}

/** Bosatte sektorer holder minst 50 i kontroll. */
export function floorControl(s: GameState) {
  for (const id of PLAYABLE) {
    const sec = s.sectors[id];
    sec.control = clamp(sec.control, sec.settled ? 50 : 0, 100);
  }
}

/** En sektor med plass blir bosatt første gang den er trygg. */
export function settle(s: GameState, log: LogFn) {
  for (const id of PLAYABLE) {
    const sec = s.sectors[id], def = SECTORS[id];
    if (def.capacity > 0 && !sec.settled && isSafe(sec)) {
      sec.settled = true;
      log(`${def.name} er trygg. Det er plass til ${def.capacity} flere her.`, 'good');
    }
  }
}

/** Mat i sektorlagrene råtner hver 10. dag. */
export function rotFood(s: GameState, M: PhaseModifiers) {
  if (s.day % 10 !== 0) return;
  for (const id of PLAYABLE) s.sectors[id].loot.mat = Math.floor(s.sectors[id].loot.mat * M.foodRot);
}
