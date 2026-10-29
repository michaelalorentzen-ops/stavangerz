// Utstyrskort: instanser, utstyring, slitasje, funn og Lage utstyr. Ren logikk.
import { CARDS } from './content/cards';
import type { LogFn } from './crew';
import { skillLevel } from './levels';
import { pick, rand } from './rng';
import type { CardDef, CardInst, CrewMember, GameState, Resources, SectorId, Slot } from './types';

export { CARDS };
export const SLOTS: Slot[] = ['vapen', 'beskyttelse', 'verktoy'];
export const SLOT_LABEL: Record<Slot, string> = { vapen: 'Våpen', beskyttelse: 'Beskyttelse', verktoy: 'Verktøy' };

/** Kostnad for Lage utstyr. */
export const LAGE_COST = { skrap: 3, tre: 1 };
const RARITY_WEIGHT = { vanlig: 6, sjelden: 3, episk: 1, unik: 0 };

export function newCard(s: GameState, defId: string): CardInst {
  const def = CARDS[defId];
  if (!def) throw new Error(`Ukjent kort: ${defId}`);
  return { uid: `k${s.nextUid++}`, def: defId, dur: def.durability };
}

const gearOf = (c: CrewMember) => Object.values(c.gear).filter((k): k is CardInst => !!k);
const levelOf = (c: CrewMember, slot: Slot) => { const k = c.gear[slot]; return k ? CARDS[k.def].level : 0; };

/** Setter et kort fra lageret i sporet sitt. Kortet som lå der går tilbake på lageret. */
export function equip(s: GameState, crewId: string, uid: string): boolean {
  const c = s.crew.find((x) => x.id === crewId);
  const i = s.stash.findIndex((k) => k.uid === uid);
  if (!c || i < 0) return false;
  const [card] = s.stash.splice(i, 1);
  const slot = CARDS[card.def].slot;
  const old = c.gear[slot];
  if (old) s.stash.push(old);
  c.gear[slot] = card;
  return true;
}

export function unequip(s: GameState, crewId: string, slot: Slot): boolean {
  const c = s.crew.find((x) => x.id === crewId);
  const k = c?.gear[slot];
  if (!c || !k) return false;
  s.stash.push(k);
  delete c.gear[slot];
  return true;
}

export const weaponMult = (c: CrewMember): number => (c.gear.vapen ? [0, 1.0, 1.2, 1.4, 1.6, 1.8][levelOf(c, 'vapen')] : 0.8);
/** Ganges med skaderisiko. */
export const armorMult = (c: CrewMember): number => (c.gear.beskyttelse ? [0, 0.9, 0.8, 0.7, 0.6, 0.5][levelOf(c, 'beskyttelse')] : 1);
/** Ganges med searchPower og buildPower. */
export const toolMult = (c: CrewMember): number => (c.gear.verktoy ? [0, 1.1, 1.2, 1.3, 1.4, 1.5][levelOf(c, 'verktoy')] : 1);

/** Trekker 1 holdbarhet. På 0 ryker kortet. */
export function wear(_s: GameState, c: CrewMember, slot: Slot, log: LogFn) {
  const k = c.gear[slot];
  if (!k) return;
  k.dur--;
  if (k.dur <= 0) {
    delete c.gear[slot];
    log(`${CARDS[k.def].name} tilhørende ${c.name} gikk i stykker. Det var en god tid.`, 'warn');
  }
}

/** Alt utstyret en person bærer havner på lageret eller blir liggende i sektoren. */
export function dropGear(s: GameState, c: CrewMember, where: SectorId | 'stash') {
  const cards = gearOf(c);
  c.gear = {};
  if (where === 'stash' || where === 'hjem') s.stash.push(...cards);
  else s.sectors[where].dropped.push(...cards);
}

/** Flytter utstyr som ligger igjen i sektoren til lageret. */
export function collectDropped(s: GameState, id: SectorId, log: LogFn) {
  const sec = s.sectors[id];
  if (!sec.dropped.length) return;
  const names = sec.dropped.map((k) => CARDS[k.def].name).join(', ');
  s.stash.push(...sec.dropped);
  sec.dropped = [];
  log(`Crewet hentet utstyr som lå igjen: ${names}.`, 'find');
}

function weighted<T>(s: GameState, items: T[], w: (x: T) => number): T {
  let r = rand(s) * items.reduce((a, x) => a + w(x), 0);
  for (const x of items) { r -= w(x); if (r < 0) return x; }
  return items[items.length - 1];
}

/** Trekker et kort som aldri er over maxLevel. Unike kort trekkes aldri her. */
export function rollCard(s: GameState, maxLevel: number): CardInst {
  const pool = Object.values(CARDS).filter((d) => d.rarity !== 'unik');
  let level = maxLevel <= 1 || rand(s) < 0.5 ? maxLevel : 1 + Math.floor(rand(s) * (maxLevel - 1));
  const family = rand(s) < 0.75 ? 'makeshift' : 'for';
  // Faller ned et nivå om katalogen mangler kandidater
  let cands: CardDef[] = [];
  for (; level >= 1; level--) {
    cands = pool.filter((d) => d.level === level && d.family === family);
    if (!cands.length) cands = pool.filter((d) => d.level === level);
    if (cands.length) break;
  }
  return newCard(s, weighted(s, cands, (d) => RARITY_WEIGHT[d.rarity]).id);
}

/** Et tilfeldig makeshift-kort på nivå 1. */
export const rollStarter = (s: GameState): CardInst =>
  newCard(s, pick(s, Object.values(CARDS).filter((d) => d.family === 'makeshift' && d.level === 1 && d.rarity !== 'unik')).id);

/** Setter et kort rett i sporet. Brukes ved oppstart. */
export function give(c: CrewMember, card: CardInst) { c.gear[CARDS[card.def].slot] = card; }

/** Plasserer to unike kort i hver sin sektor. Seedet. */
export function placeUniques(s: GameState) {
  const left = Object.values(CARDS).filter((d) => d.rarity === 'unik');
  for (let n = 0; n < 2 && left.length; n++) {
    const d = left.splice(Math.floor(rand(s) * left.length), 1)[0];
    const free = (d.places ?? []).filter((id) => !s.uniques[id]);
    if (free.length) s.uniques[pick(s, free)] = d.id;
  }
}

/** Identiske kort (samme def) samlet i rekkefølgen de først forekommer. Bare til visning. */
export function groupStash(stash: CardInst[]): { def: string; cards: CardInst[] }[] {
  const groups = new Map<string, CardInst[]>();
  for (const k of stash) { const g = groups.get(k.def); if (g) g.push(k); else groups.set(k.def, [k]); }
  return [...groups].map(([def, cards]) => ({ def, cards }));
}

/** Kopien med mest holdbarhet. Den som tas på fra en stabel. */
export const bestCopy = (cards: CardInst[]): CardInst => cards.reduce((a, b) => (b.dur > a.dur ? b : a));

/** Kopien som demonteres fra en stabel: lavest holdbarhet, aldri en favoritt. */
export const salvageCopy = (cards: CardInst[]): CardInst | null =>
  cards.filter((k) => !k.fav).reduce<CardInst | null>((a, b) => (!a || b.dur < a.dur ? b : a), null);

/** Skrap kortet gir ved demontering. Unike kort gir det dobbelte. */
export function salvageValue(def: CardDef): Partial<Resources> {
  const base = def.family === 'makeshift' ? def.level + 1 : def.level * 2 + 1;
  return { skrap: def.rarity === 'unik' ? base * 2 : base };
}

/** Demonterer et kort på lageret til ressurser. Nekter favoritter og kort utenfor lageret. */
export function salvage(s: GameState, uid: string): Partial<Resources> | null {
  const i = s.stash.findIndex((k) => k.uid === uid);
  if (i < 0 || s.stash[i].fav) return null;
  const [card] = s.stash.splice(i, 1);
  const value = salvageValue(CARDS[card.def]);
  for (const [r, n] of Object.entries(value) as [keyof Resources, number][]) s.res[r] += n;
  return value;
}

/** Slår favoritt av/på for et kort på lageret eller i et spor. */
export function toggleFavorite(s: GameState, uid: string): boolean {
  const card = [...s.stash, ...s.crew.flatMap((c) => Object.values(c.gear))].find((k) => k?.uid === uid);
  if (!card) return false;
  card.fav = !card.fav;
  return true;
}

/** Lage utstyr: koster skrap og tre, lykkes etter Mekk. `mekk` er stat(c, 'mekk'). */
export function lage(s: GameState, c: CrewMember, mekk: number, log: LogFn) {
  if (s.res.skrap < LAGE_COST.skrap || s.res.tre < LAGE_COST.tre) {
    log(`${c.name} prøvde å lage utstyr, men det mangler ${LAGE_COST.skrap} skrap og ${LAGE_COST.tre} tre. Det ble et fint moodboard.`, 'warn');
    return;
  }
  s.res.skrap -= LAGE_COST.skrap; s.res.tre -= LAGE_COST.tre;
  wear(s, c, 'verktoy', log);
  const chance = Math.max(0.3, Math.min(0.9, 0.3 + (mekk / 10) * 0.1));
  if (rand(s) >= chance) { log(`${c.name} bygde noe. Det ble ikke til noe, bortsett fra en stor haug skrap.`, 'warn'); return; }
  const level = ['God', 'Rå'].includes(skillLevel(mekk)) ? 2 : 1;
  const cands = Object.values(CARDS).filter((d) => d.family === 'makeshift' && d.level === level && d.rarity !== 'unik');
  const k = newCard(s, pick(s, cands).id);
  s.stash.push(k);
  log(`${c.name} laget ${CARDS[k.def].name}.`, 'good');
}
