// HQ-et i fase 2: skjulte anlegg, rykter, istandsetting, reparasjon og faste poster. Ren logikk.
// Navn og tekster på anleggene står i regionpakken (FACILITIES i places.ts). Reglene står her.
import { CARDS } from './cards';
import type { LogFn } from './crew';
import { FACILITIES, HQ_SECTOR, RES_LABEL } from './data';
import { pick, rand, sum } from './rng';
import { isSafe } from './sectors';
import { buildPower, stat } from './skills';
import type { CardInst, CrewMember, FacilityCond, FacilityId, FacilityState, GameState, HqState, PostId, StatKey } from './types';

export const FACILITY_IDS: FacilityId[] = ['verksted', 'kantine', 'kontor', 'kai'];
export const FACILITY_CONDS: FacilityCond[] = ['god', 'middels', 'odelagt'];
export const COND_LABEL: Record<FacilityCond, string> = { god: 'God', middels: 'Middels', odelagt: 'Ødelagt' };

/** Sjansen for hver tilstand når anleggene trekkes ved start. */
export const COND_ODDS: Record<FacilityCond, number> = { god: 0.3, middels: 0.4, odelagt: 0.3 };
/** Arbeid (buildPower-dager) som trengs for å sette i stand, etter tilstand. God stand er billigst. */
export const ISTAND_WORK: Record<FacilityCond, number> = { god: 50, middels: 80, odelagt: 120 };
/** Arbeid per enhet materialer (metall først, så skrap) i istandsettingen. Befesting bruker 3. */
export const ISTAND_WORK_PER_MATERIAL = 3;
/** Sjansen for at et rykte stemmer. Ellers peker det på en annen tilstand. */
export const RUMOR_TRUE = 0.75;
/** Sjansen for et rykte når noen gjennomsøker HQ-sektoren. Speiding gir alltid ett. */
export const RUMOR_ON_SEARCH = 0.5;

/** Verkstedhallen: Lage utstyr gir så mange nivåer høyere (høyst MAX_CRAFT_LEVEL). */
export const VERKSTED_LEVEL = 1, MAX_CRAFT_LEVEL = 3;
/** Reparere: skrap per kort, og kort per dag (1 pluss ett per så mye Mekk). */
export const REPAIR_SKRAP = 2, REPAIR_MEKK_STEP = 30;
/** Kantina: mat per dag. */
export const KANTINE_FOOD = 3;

/**
 * Postene. Bonusene er regelkonstanter, ikke vanskelighetsknotter, så de står her og ikke i fasetabellen:
 * de sier hva crewet får til, ikke hvor sterke zombiene er.
 */
export const POSTS: Record<PostId, { name: string; stat: StatKey; desc: string }> = {
  sikkerhet: { name: 'Sikkerhetssjef', stat: 'nerver', desc: 'Sterkere vakt om natta ved alle porter, etter Nerver.' },
  bygg: { name: 'Byggeleder', stat: 'mekk', desc: 'Mer arbeid per dag på befesting og istandsetting, etter Mekk.' },
  kokk: { name: 'Kokk', stat: 'prat', desc: 'Mindre forbruk av mat, etter Prat.' },
};
export const POST_IDS = Object.keys(POSTS) as PostId[];
/** Sikkerhetssjefen: vaktkraft ved hver port om natta per 10 Nerver. Vaktene ved porten har typisk 4–7 hver. */
export const SECURITY_POWER_PER_NERVER = 0.8;
/** Byggelederen: ekstra arbeid per 10 Mekk, som andel. */
export const BUILD_LEAD_PER_MEKK = 0.06;
/** Kokken: mindre matforbruk per 10 Prat, som andel, og aldri mer enn COOK_MAX_SAVE. */
export const COOK_SAVE_PER_PRAT = 0.05, COOK_MAX_SAVE = 0.4;

/** En egen tallrekke fra seeden, så trekningen av anleggene ikke flytter noe annet i runden. */
const FACILITY_SALT = 0x5eedf00d;

/** Trekker tilstanden til hvert anlegg fra seeden. Bruker ikke state.rng, så fase 1 blir helt lik. */
export function rollFacilities(seed: number): HqState['facilities'] {
  const r = { rng: (seed ^ FACILITY_SALT) | 0 };
  const out = {} as HqState['facilities'];
  for (const id of FACILITY_IDS) {
    let x = rand(r), cond: FacilityCond = 'odelagt';
    for (const c of FACILITY_CONDS) { if ((x -= COND_ODDS[c]) < 0) { cond = c; break; } }
    out[id] = { cond, heard: null, work: 0, ready: false };
  }
  return out;
}

export const newHq = (seed: number): HqState => ({ taken: false, facilities: rollFacilities(seed) });

export const facilityReady = (s: GameState, id: FacilityId): boolean => !!s.hq?.facilities[id]?.ready;
export const readyCount = (s: GameState): number => FACILITY_IDS.filter((id) => facilityReady(s, id)).length;

/** Personen som har posten, eller undefined. Postene virker bare når HQ-et er tatt, og bare én per post teller. */
export function postHolder(s: GameState, id: PostId): CrewMember | undefined {
  if (!s.hq?.taken) return undefined;
  return s.crew.find((c) => c.task.type === 'post' && c.task.target === id);
}

/** Ekstra vaktkraft ved hver port om natta fra sikkerhetssjefen. 0 uten. */
export function securityPower(s: GameState): number {
  const c = postHolder(s, 'sikkerhet');
  return c ? (stat(c, 'nerver') / 10) * SECURITY_POWER_PER_NERVER : 0;
}

/** Ganges med arbeidet på befesting og istandsetting. 1 uten byggeleder. */
export function buildLeadMult(s: GameState): number {
  const c = postHolder(s, 'bygg');
  return c ? 1 + (stat(c, 'mekk') / 10) * BUILD_LEAD_PER_MEKK : 1;
}

/** Ganges med matforbruket. 1 uten kokk. */
export function cookMult(s: GameState): number {
  const c = postHolder(s, 'kokk');
  return c ? 1 - Math.min(COOK_MAX_SAVE, (stat(c, 'prat') / 10) * COOK_SAVE_PER_PRAT) : 1;
}

/** Bonusen posten gir nå, som kort tekst. Til visning. */
export function postEffect(s: GameState, id: PostId): string {
  if (id === 'sikkerhet') return `+${securityPower(s).toFixed(1).replace('.', ',')} vaktkraft per port`;
  if (id === 'bygg') return `+${Math.round((buildLeadMult(s) - 1) * 100)} % arbeid`;
  return `−${Math.round((1 - cookMult(s)) * 100)} % mat`;
}

/** Kort tekst om et anlegg slik crewet kjenner det: sann tilstand når HQ-et er tatt, ellers ryktet. */
export function facilityIntel(s: GameState, id: FacilityId): { cond: FacilityCond | null; known: boolean; text: string } {
  const f = s.hq.facilities[id], def = FACILITIES[id];
  if (s.hq.taken) return { cond: f.cond, known: true, text: def.known[f.cond] };
  if (f.heard) return { cond: f.heard, known: false, text: def.rumor[f.heard] };
  return { cond: null, known: false, text: 'Ingen har sett det ennå.' };
}

/**
 * Et rykte om et anlegg dere ikke har hørt om ennå. Stemmer med RUMOR_TRUE, ellers peker det på en annen
 * tilstand. En sveiser fra verftet i crewet vet hvordan det står til, så da stemmer ryktet alltid.
 */
export function hearRumor(s: GameState, log: LogFn): FacilityId | null {
  const left = FACILITY_IDS.filter((id) => !s.hq.facilities[id].heard);
  if (!left.length || s.hq.taken) return null;
  const id = pick(s, left), f = s.hq.facilities[id];
  const insider = s.crew.some((c) => c.trait === 'sveiser');
  f.heard = insider || rand(s) < RUMOR_TRUE ? f.cond : pick(s, FACILITY_CONDS.filter((c) => c !== f.cond));
  log(`Rykte om ${FACILITIES[id].short}: ${FACILITIES[id].rumor[f.heard]}`, 'find');
  return id;
}

/** HQ-et er tatt første gang HQ-sektoren er trygg i fase 2 eller senere. Da vises den sanne tilstanden. */
export function checkHq(s: GameState, log: LogFn): boolean {
  if (s.hq.taken || s.phase < 2 || !isSafe(s.sectors[HQ_SECTOR])) return false;
  s.hq.taken = true;
  log('HQ-et er tatt. Det er senger til flere, postene kan bemannes, og nå ser dere hvordan det faktisk står til.', 'good');
  for (const id of FACILITY_IDS) {
    const f = s.hq.facilities[id];
    log(`${FACILITIES[id].name} (${COND_LABEL[f.cond].toLowerCase()} stand): ${FACILITIES[id].known[f.cond]}`, f.cond === 'odelagt' ? 'warn' : '');
  }
  return true;
}

/** Arbeid som gjenstår før anlegget er i stand. */
export const istandLeft = (f: FacilityState): number => Math.max(0, ISTAND_WORK[f.cond] - f.work);
/** Materialer det trengs for resten av istandsettingen. */
export const istandMaterials = (f: FacilityState): number => Math.ceil(istandLeft(f) / ISTAND_WORK_PER_MATERIAL);

/** Sette i stand: gruppa legger ned arbeid og bruker metall, så skrap. Mangler materialene, går det tregere. */
export function istand(s: GameState, id: FacilityId, team: CrewMember[], log: LogFn) {
  const f = s.hq.facilities[id], def = FACILITIES[id];
  if (f.ready) return;
  let work = sum(team.map((c) => buildPower(s, c))) * buildLeadMult(s);
  work = Math.min(work, istandLeft(f));
  const need = Math.ceil(work / ISTAND_WORK_PER_MATERIAL);
  const used = Math.min(need, s.res.metall + s.res.skrap);
  if (used < need) work *= need ? used / need : 0;
  for (let i = 0; i < used; i++) s.res[s.res.metall > 0 ? 'metall' : 'skrap']--;
  f.work += work;
  const who = team.map((c) => c.name).join(' og ');
  if (istandLeft(f) <= 0.001) {
    f.ready = true;
    log(`${who} satte ${def.short} i stand (${used} metall og skrap). ${def.effect}`, 'good');
  } else {
    log(`${who} jobbet med ${def.short} (${used} metall og skrap). ${Math.round((f.work / ISTAND_WORK[f.cond]) * 100)} % ferdig.${used < need ? ` Mangler ${RES_LABEL.metall.toLowerCase()} eller skrap.` : ''}`);
  }
}

/** Kortene som kan repareres, mest slitt først: utstyrt før lageret. */
function worn(s: GameState): CardInst[] {
  const ratio = (k: CardInst) => k.dur / CARDS[k.def].durability;
  const gear = s.crew.flatMap((c) => Object.values(c.gear)).filter((k): k is CardInst => !!k && k.dur < CARDS[k.def].durability);
  const stash = s.stash.filter((k) => k.dur < CARDS[k.def].durability);
  return [...gear.sort((a, b) => ratio(a) - ratio(b)), ...stash.sort((a, b) => ratio(a) - ratio(b))];
}

/** Reparere: full holdbarhet tilbake for REPAIR_SKRAP skrap per kort. Bare med verkstedhallen i stand. */
export function reparere(s: GameState, c: CrewMember, log: LogFn) {
  if (!facilityReady(s, 'verksted')) return;
  const max = 1 + Math.floor(stat(c, 'mekk') / REPAIR_MEKK_STEP);
  const done: string[] = [];
  for (const k of worn(s)) {
    if (done.length >= max || s.res.skrap < REPAIR_SKRAP) break;
    s.res.skrap -= REPAIR_SKRAP;
    k.dur = CARDS[k.def].durability;
    done.push(CARDS[k.def].name);
  }
  if (done.length) log(`${c.name} reparerte ${done.join(' og ')} i ${FACILITIES.verksted.short}.`, 'good');
  else log(`${c.name} ryddet i ${FACILITIES.verksted.short}. ${s.res.skrap < REPAIR_SKRAP ? 'Det mangler skrap.' : 'Ingenting trengte reparasjon.'}`);
}
