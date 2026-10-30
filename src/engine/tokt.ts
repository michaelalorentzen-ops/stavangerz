// Tokt: en gruppe drar bort i flere dager. Hver dag ute gir bytte og et encounter, og så velger spilleren
// å fortsette eller snu. Ren logikk.
import { armorMult, cardWord, CARDS, newCard, rollCard } from './cards';
import { addNeighbor, canRecruit, injure, names, recruitablesNow, type LogFn } from './crew';
import { addToktEncounter } from './encounters';
import { NEIGHBORS, PHASE_RES, RES, RES_LABEL } from './data';
import type { PhaseModifiers } from './phases';
import { pick, rand, sround } from './rng';
import { QUESTS, questDef, TOKTS, toktDef } from '../regions/content';
import type { QuestDef, ToktDef } from '../regions/content';
import type { CrewMember, GameState, ResKey, ToktState } from './types';

export { QUESTS, TOKTS, toktDef, questDef };
export type { QuestDef, ToktDef };

/** Regelkonstant: antall ressurser et tokt finner per dag ute. */
const HAUL_KINDS = 2;
/** Byttet per dag er opptil så mye ganger trusselen. Tokt skal lønne seg mer enn å sanke hjemme. */
export const HAUL_PER_THREAT = 3;
/** Sjansen for kort per dag ute, ganget med fasens cardFind */
export const TOKT_CARD_MULT = 2;
/** Sjansen per person per dag ute for å bli skadet, ganger trusselnivået. Byttet de bærer kan gå tapt i flukten. */
export const TOKT_DAY_INJURY = 0.03, TOKT_DROP = 1 / 3;


/** Tokt-staten for en person som er ute, ellers undefined. */
export const toktOf = (s: GameState, crewId: string): ToktState | undefined => s.tokts.find((t) => t.crew.includes(crewId));
export const isOnTokt = (s: GameState, c: CrewMember): boolean => !!toktOf(s, c.id);

/** Akseptert quest som ikke er løst, og der toktet rekker å bli ferdig innen fristen: siste dag ute er s.day + days - 1. */
const questOpen = (s: GameState, id: string, days: number): boolean => s.quests.some((q) => q.id === id && !q.done && s.day + days - 1 <= q.until);

/** Er toktet tilgjengelig som ordre nå? Fritt, eller med en aktiv quest. Aldri mens det allerede er ute. */
export function toktAvailable(s: GameState, d: ToktDef): boolean {
  if (s.tokts.some((t) => t.id === d.id)) return false;
  if (d.locked && !s.toktsOpen.includes(d.id)) return false;
  return !d.quest || questOpen(s, d.quest, d.days);
}

/** Låser opp et tokt, for eksempel fra en hendelse eller et rykte. */
export function unlockTokt(s: GameState, id: string): void {
  toktDef(id);
  if (!s.toktsOpen.includes(id)) s.toktsOpen.push(id);
}

/** Første tur på et tokt med garanti: ingen knipe og ingen skader underveis. */
const guaranteed = (s: GameState, d: ToktDef) => !!d.safeFirst && !s.toktsDone.includes(d.id);

/** Aksepterer en quest. Fristen regnes fra i dag. Gjør ingenting om den allerede er akseptert. */
export function acceptQuest(s: GameState, questId: string): void {
  const q = questDef(questId);
  if (s.quests.some((x) => x.id === q.id)) return;
  s.quests.push({ id: q.id, until: s.day + q.deadline, done: false });
}

/** Logger quester hvis frist gikk ut i går. Kalles i starten av dagsoppgjøret. */
export function expireQuests(s: GameState, log: LogFn) {
  for (const q of s.quests) {
    if (q.done || q.until !== s.day - 1) continue;
    log(`Fristen for «${questDef(q.id).title}» gikk ut. Noen andre får ta den, hvis det finnes noen andre.`, 'warn');
  }
}

/** Starter tokt for de som har fått tokt-ordre uten at toktet er ute. Rydder bort ordre som ikke kan følges. */
function startTokts(s: GameState, log: LogFn) {
  for (const c of s.crew) {
    if (c.task.type !== 'tokt' || isOnTokt(s, c)) continue;
    const id = c.task.target, def = TOKTS.find((d) => d.id === id);
    if (!def || !toktAvailable(s, def)) { c.task = { type: 'hvile' }; continue; }
    const group = s.crew.filter((x) => x.task.type === 'tokt' && x.task.target === id && !isOnTokt(s, x));
    s.tokts.push({ id, crew: group.map((x) => x.id), stage: 0, haul: {}, cards: [], awaiting: false });
    log(`${names(group)} la ut på tokt: ${def.name}.`, 'warn');
  }
}

/**
 * En dag ute for alle tokt som ikke venter på valg. `budget` er hvor mange encounters dagstaket fortsatt
 * tillater. Er taket fullt, går toktet likevel videre og venter på valg, bare uten knipe. Returnerer antall nye.
 */
export function resolveTokts(s: GameState, M: PhaseModifiers, log: LogFn, budget = Infinity): number {
  startTokts(s, log);
  let added = 0;
  for (const t of s.tokts) {
    if (t.awaiting) continue;
    const def = toktDef(t.id), group = s.crew.filter((c) => t.crew.includes(c.id));
    if (!group.length) continue;
    t.stage++;
    const got: Partial<Record<ResKey, number>> = {};
    for (let i = 0; i < HAUL_KINDS; i++) {
      const k: ResKey = pick(s, PHASE_RES[s.phase]), n = sround(s, rand(s) * HAUL_PER_THREAT * def.threat);
      if (n > 0) { t.haul[k] = (t.haul[k] ?? 0) + n; got[k] = (got[k] ?? 0) + n; }
    }
    // samme ressurs flere ganger slås sammen: «3 medisin», ikke «3 medisin, 1 medisin»
    const found: string[] = RES.filter((k) => got[k]).map((k) => `${got[k]} ${RES_LABEL[k].toLowerCase()}`);
    if (rand(s) < M.cardFind * TOKT_CARD_MULT) {
      const k = rollCard(s, def.threat);
      t.cards.push(k);
      found.push(cardWord(CARDS[k.def].name));
    }
    log(`${names(group)} er på tokt (${def.name}), dag ${t.stage} av ${def.days}.${found.length ? ` Fant ${found.join(', ')}.` : ''}`, found.length ? 'find' : '');
    // Dagene ute tærer: skader hoper seg opp, og den som blir skadet, slipper noe av byttet
    let hurt = false;
    if (!guaranteed(s, def)) for (const c of group) if (rand(s) < TOKT_DAY_INJURY * def.threat * M.injuryMult * armorMult(c)) { injure(s, c, 'på toktet', log, 'tokt'); hurt = true; }
    if (hurt) {
      const lost: string[] = [];
      for (const k of RES) { const n = Math.floor((t.haul[k] ?? 0) * TOKT_DROP); if (n > 0) { t.haul[k]! -= n; lost.push(`${n} ${RES_LABEL[k].toLowerCase()}`); } }
      if (lost.length) log(`I flukten mistet gruppa ${lost.join(', ')}.`, 'bad');
    }
    if (!s.crew.some((c) => t.crew.includes(c.id))) continue;
    // Ute finnes folk som aldri ville kommet til porten
    if (def.recruit && rand(s) < def.recruit && canRecruit(s)) {
      const cands = recruitablesNow(s);
      if (cands.length) { const n = pick(s, cands); addNeighbor(s, n.id); log(`${names(group)} fant ${n.name} (${n.age}) i en bil på veien. ${n.name} går hjem til basen. «${n.quip}»`, 'good'); }
    }
    if (added < budget && !guaranteed(s, def) && addToktEncounter(s, group, def.threat, t.id, log)) added++;
    t.awaiting = true;
  }
  return added;
}

/** Sender gruppa hjem og fjerner toktet. */
function sendHome(s: GameState, t: ToktState) {
  for (const c of s.crew) if (t.crew.includes(c.id)) c.task = { type: 'hvile' };
  s.tokts = s.tokts.filter((x) => x !== t);
}

/** Legger byttet fra toktet i beholdningen. */
function unload(s: GameState, t: ToktState): string {
  const parts: string[] = [];
  for (const k of RES) {
    const n = t.haul[k] ?? 0;
    if (n > 0) { s.res[k] += n; parts.push(`${n} ${RES_LABEL[k].toLowerCase()}`); }
  }
  for (const k of t.cards) { s.stash.push(k); parts.push(cardWord(CARDS[k.def].name)); }
  return parts.length ? parts.join(', ') : 'ingenting';
}

/** Henter alle tokt hjem med det de har funnet, uten belønning. Brukes når fasen avsluttes mens noen er ute. */
export function recallTokts(s: GameState): void {
  for (const t of [...s.tokts]) { unload(s, t); sendHome(s, t); }
}

/** Gir belønningen for et fullført tokt. */
function reward(s: GameState, def: ToktDef): string {
  const parts: string[] = [];
  // stedet er delvis tømt etter første tur
  const mult = s.toktsDone.includes(def.id) ? def.repeat ?? 1 : 1;
  for (const [k, base] of Object.entries(def.reward.res ?? {}) as [ResKey, number][]) {
    const n = Math.round(base * mult);
    if (n > 0) { s.res[k] += n; parts.push(`${n} ${RES_LABEL[k].toLowerCase()}`); }
  }
  for (const id of def.reward.cards ?? []) { s.stash.push(newCard(s, id)); parts.push(cardWord(CARDS[id].name)); }
  if (def.reward.flag) s.flags[def.reward.flag] = true;
  if (def.reward.joins) {
    const n = NEIGHBORS.find((x) => x.id === def.reward.joins);
    if (n && !s.crew.some((c) => c.id === n.id) && !s.flags[`gone_${n.id}`]) {
      if (canRecruit(s)) { addNeighbor(s, n.id); parts.push(`${n.name} blir med dere hjem`); }
      else parts.push(`${n.name} ville blitt med, men dere har ikke senger`);
    }
  }
  return parts.join(', ');
}

/** Spilleren velger etter et tokt-encounter. Returnerer teksten som vises. */
export function toktDecision(s: GameState, toktId: string, d: 'fortsett' | 'snu'): string {
  const t = s.tokts.find((x) => x.id === toktId);
  if (!t || !t.awaiting) throw new Error(`Tokt venter ikke på valg: ${toktId}`);
  if (s.pending.some((p) => p.toktId === toktId)) throw new Error(`Tokt har et ubesvart encounter: ${toktId}`);
  const def = toktDef(t.id), group = s.crew.filter((c) => t.crew.includes(c.id));
  if (d === 'fortsett' && t.stage < def.days) {
    t.awaiting = false;
    return `${names(group)} går videre. Dag ${t.stage + 1} av ${def.days} venter.`;
  }
  const done = d === 'fortsett';
  let text = `${names(group)} er på vei hjem med ${unload(s, t)}.`;
  if (done) {
    // belønningen gjelder bare om toktet ble ferdig innen fristen. Dagen toktet ble ferdig er s.day - 1.
    const q = def.quest ? s.quests.find((x) => x.id === def.quest) : undefined;
    if (!q || (!q.done && s.day - 1 <= q.until)) {
      if (q) q.done = true;
      text += ` Oppdraget er fullført. Belønning: ${reward(s, def) || 'ingenting mer'}.`;
      if (!s.toktsDone.includes(def.id)) s.toktsDone.push(def.id);
    } else text += ' Fristen var gått ut, så det ble ingen takk.';
  }
  sendHome(s, t);
  return text;
}
