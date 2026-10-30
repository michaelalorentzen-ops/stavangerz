// Crewet: skader, død, ny leder, plass og rekruttering.
import { dropGear, give, rollStarter, wear } from './cards';
import { toktDef, toktSector } from '../regions/content';
import { GATES, HEALTH_LABEL, LANDMARKS, NEIGHBORS, SECTORS, PLAYABLE } from './data';
import { clamp, pick, rand } from './rng';
import { stat } from './skills';
import type { CrewMember, DeathCause, GameState, LogKind, SectorId } from './types';

/** Regelkonstanter for Lete etter overlevende (ikke vanskelighetsknotter). */
const RECRUIT_BASE = 0.15, RECRUIT_PER_PRAT = 0.05, RECRUIT_NOISE = 0.2;

export type LogFn = (t: string, kind?: LogKind) => void;

const EULOGY: ((c: CrewMember) => string)[] = [
  (c) => `Hvil i fred, ${c.name}. Vi tar vare på kaffekoppen din.`,
  (c) => `${c.name} er ikke lenger med oss. Teknisk sett er ${c.name} fortsatt med oss, bare ikke på vår side.`,
  () => `Crewet holder ett minutts stillhet. Det blir avbrutt av stønning fra ${LANDMARKS.bybrua}.`,
];

/** Sektoren personen jobber i, eller 'stash' når personen er hjemme eller hviler. */
function taskSector(c: CrewMember): SectorId | 'stash' {
  const t = c.task;
  if (t.type === 'rydde' || t.type === 'sanke' || t.type === 'speide' || t.type === 'overlevende') return t.target === 'hjem' ? 'stash' : t.target;
  if (t.type === 'befeste' || t.type === 'vakt') {
    const sector: SectorId = t.target in GATES ? GATES[t.target as keyof typeof GATES].sector : (t.target as SectorId);
    return sector === 'hjem' ? 'stash' : sector;
  }
  if (t.type === 'tokt') return toktSector(toktDef(t.target));
  return 'stash';
}

/** Hvor personen var da det skjedde, etter ordren: på tokt, ved porten eller hjemme (natt), ellers ute i en sektor (kamp). */
export function deathCause(c: CrewMember): DeathCause {
  const t = c.task;
  if (t.type === 'tokt') return 'tokt';
  if ((t.type === 'befeste' || t.type === 'vakt') && t.target in GATES) return 'natt';
  // Hjemme skader ingenting crewet i fase 1 i dag (encounters setter årsaken selv). Kartleggingen er for
  // senere nattangrep mot basen, så de havner under natt og ikke under kamp.
  if (t.type === 'hvile' || t.type === 'pleie' || t.type === 'lage' || t.type === 'trene') return 'natt';
  return 'kamp';
}

/**
 * Gir ett skadetrinn. Ved 0 er personen bitt og fjernes fra crewet. `cause` overstyrer dødsårsaken i statistikken,
 * og `where` stedet utstyret blir liggende (encounters løses etter at ordren kan være nullstilt).
 */
export function injure(s: GameState, c: CrewMember, why: string, log: LogFn, cause: DeathCause = deathCause(c), where: SectorId | 'stash' = taskSector(c)) {
  c.hp -= 1;
  if (c.hp <= 0) {
    log(`${c.name} ble bitt ${why}. ${pick(s, EULOGY)(c)}`, 'bad');
    s.moral -= 15; s.stats.lost++; s.stats.deaths[cause]++;
    dropGear(s, c, where);
    s.crew = s.crew.filter((x) => x !== c);
    if (!s.crew.length) s.needLeader = false;
    else if (c.me) {
      s.needLeader = true;
      log('Lederen er borte. Noen må ta over, og ingen rekker opp hånda frivillig.', 'warn');
    }
  } else {
    log(`${c.name} ble skadet ${why} (${HEALTH_LABEL[c.hp].toLowerCase()}).`, 'warn');
    wear(s, c, 'beskyttelse', log);
  }
}

/** Antall sengeplasser: summen av kapasitet i sektorer som er bosatt. */
export function housing(s: GameState): number {
  return PLAYABLE.reduce((n, id) => n + (s.sectors[id].settled ? SECTORS[id].capacity : 0), 0);
}

export const canRecruit = (s: GameState): boolean => s.crew.length < housing(s);

/** Gjør en gjenlevende til ny leder. Bare mulig mens lederen mangler. */
export function setLeader(s: GameState, crewId: string): boolean {
  const c = s.crew.find((x) => x.id === crewId);
  if (!s.needLeader || !c) return false;
  for (const x of s.crew) delete x.me;
  c.me = true;
  s.needLeader = false;
  return true;
}

export function addNeighbor(s: GameState, id: string) {
  const n = NEIGHBORS.find((x) => x.id === id);
  if (!n) throw new Error(`Ukjent nabo: ${id}`);
  s.crew.push({ id: n.id, name: n.name, role: n.role, trait: n.trait, stats: { ...n.stats }, hp: 3, task: { type: 'hvile' }, kills: 0, gear: {} });
  give(s.crew[s.crew.length - 1], rollStarter(s));
}

/** Naboer som kan komme til porten: ikke i crewet og ikke borte for godt. */
export const recruitablesNow = (s: GameState) => NEIGHBORS.filter((n) => !s.crew.some((c) => c.id === n.id) && !s.flags[`gone_${n.id}`]);

/** Lete etter overlevende i en tom bolig. Kan gi et nytt crewmedlem, og kan lage bråk. */
export function leteOverlevende(s: GameState, id: SectorId, team: CrewMember[], log: LogFn) {
  const sec = s.sectors[id], def = SECTORS[id];
  const prat = Math.max(...team.map((c) => stat(c, 'prat')));
  const chance = clamp(RECRUIT_BASE + (prat / 10) * RECRUIT_PER_PRAT, 0, 0.95);
  const who = team.map((c) => c.name).join(' og ');
  if (rand(s) < chance) {
    const cands = recruitablesNow(s);
    if (!cands.length) log(`${who} ropte ${def.at}. Ingen svarte, bortsett fra en måke.`);
    else if (!canRecruit(s)) log('Vi har ikke senger til flere. Noen i trappegangen i ' + def.short + ' ser veldig sultne ut.', 'warn');
    else {
      const n = pick(s, cands);
      addNeighbor(s, n.id);
      log(`${who} fant ${n.name} (${n.role.toLowerCase()}) ${def.at}. ${n.quip}`, 'good');
    }
  } else log(`${who} banket på dører ${def.at}. Det eneste som svarte var ekko og en radio på lavt volum.`);
  if (rand(s) < RECRUIT_NOISE) {
    const n = 1 + Math.floor(rand(s) * 2);
    sec.z += n;
    log(`Roping ${def.at} vekket ${n} ${n === 1 ? 'zombie' : 'zombier'}. Det er sånt som skjer.`, 'bad');
  }
}
