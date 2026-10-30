// Utfall av valg: hva et valg endret, og hva det kan endre. Forhåndsvisningen kjører valget på kopier av
// tilstanden med andre frø, så den aldri røper det neste terningkastet og aldri endrer selve spillet.
import { CARDS } from '../regions/content';
import { questDef } from '../regions/content';
import { GATES, NEIGHBORS, RES, RES_LABEL } from './data';
import { nameList } from './crew';
import type { Flag, GameState, GateId, ResKey } from './types';

export interface Delta {
  res: Partial<Record<ResKey, number>>;
  moral: number;
  /** navn på kort som kom på lageret */
  cards: string[];
  /** navn på de som ble skadet, og de som døde */
  hurt: string[];
  lost: string[];
  /** zombier lagt til (eller fjernet) i sektorene */
  zombies: number;
  /** holdbarhet utstyret mistet */
  wear: number;
  /** navn på de som ble med i crewet */
  joined: string[];
  /** naboer som er borte for godt */
  gone: string[];
  /** portarbeid lagt til, og nivåer porten gikk opp, per port */
  gateWork: Partial<Record<GateId, number>>;
  gateUp: Partial<Record<GateId, number>>;
  /** titler på oppdrag som ble tatt på */
  quests: string[];
  /** sektorer crewet så for første gang */
  scouted: number;
  /** sum av kontroll og gjennomsøkt i alle sektorer */
  control: number;
  searched: number;
}

const durOf = (s: GameState) => s.crew.reduce((n, c) => n + Object.values(c.gear).reduce((m, k) => m + (k?.dur ?? 0), 0), 0);
const zOf = (s: GameState) => Object.values(s.sectors).reduce((n, sec) => n + sec.z + sec.hidden, 0);
const sumOf = (s: GameState, k: 'control' | 'searched') => Object.values(s.sectors).reduce((n, sec) => n + sec[k], 0);

/** Hva som endret seg fra `a` til `b`. Moral telles etter at den er klemt til 0–100. */
export function delta(a: GameState, b: GameState): Delta {
  const res: Delta['res'] = {};
  for (const k of RES) if (b.res[k] !== a.res[k]) res[k] = b.res[k] - a.res[k];
  const had = new Set(a.stash.map((k) => k.uid));
  const hurt: string[] = [], lost: string[] = [];
  // gone_ satt i samme valg uten dead_: personen forlot crewet, og døde ikke
  const fresh = (pre: 'gone_' | 'dead_', id: string) => b.flags[`${pre}${id}` as Flag] && !a.flags[`${pre}${id}` as Flag];
  for (const c of a.crew) {
    const now = b.crew.find((x) => x.id === c.id);
    if (!now) { if (!fresh('gone_', c.id) || fresh('dead_', c.id)) lost.push(c.name); }
    else if (now.hp < c.hp) hurt.push(c.name);
  }
  const clampM = (m: number) => Math.max(0, Math.min(100, m));
  // kort som er kommet til, men ikke kort som bare ble lagt tilbake fra noens spor
  const worn = new Set(a.crew.flatMap((c) => Object.values(c.gear).map((k) => k!.uid)));
  const gateWork: Delta['gateWork'] = {}, gateUp: Delta['gateUp'] = {};
  for (const g of Object.keys(b.gates) as GateId[]) {
    const w = Math.round(b.gates[g].work - a.gates[g].work), up = b.gates[g].level - a.gates[g].level;
    if (w) gateWork[g] = w;
    if (up) gateUp[g] = up;
  }
  return {
    res, moral: clampM(b.moral) - clampM(a.moral),
    cards: b.stash.filter((k) => !had.has(k.uid) && !worn.has(k.uid)).map((k) => CARDS[k.def].name),
    hurt, lost, zombies: zOf(b) - zOf(a),
    wear: Math.max(0, durOf(a) - durOf(b) - lostDur(a, b)),
    joined: b.crew.filter((c) => !a.crew.some((x) => x.id === c.id)).map((c) => c.name),
    gone: Object.keys(b.flags).filter((f) => f.startsWith('gone_') && b.flags[f as Flag] && !a.flags[f as Flag] && !fresh('dead_', f.slice(5))).map((f) => NEIGHBORS.find((n) => `gone_${n.id}` === f)?.name ?? f.slice(5)),
    gateWork, gateUp,
    quests: b.quests.filter((q) => !a.quests.some((x) => x.id === q.id)).map((q) => questDef(q.id).title),
    scouted: (Object.keys(b.sectors) as (keyof GameState['sectors'])[]).filter((id) => b.sectors[id].seen && !a.sectors[id].seen).length,
    control: Math.round(sumOf(b, 'control') - sumOf(a, 'control')),
    searched: Math.round(sumOf(b, 'searched') - sumOf(a, 'searched')),
  };
}

/** Holdbarhet som forsvant fordi bæreren døde (utstyret ligger igjen), ikke fordi det ble slitt. */
const lostDur = (a: GameState, b: GameState) =>
  a.crew.filter((c) => !b.crew.some((x) => x.id === c.id)).reduce((n, c) => n + Object.values(c.gear).reduce((m, k) => m + (k?.dur ?? 0), 0), 0);

/**
 * Fjerner regnskap fra fortellingen: «(−4 mat, −2 moral)» og «(Kjell er borte for godt)» hører hjemme i
 * resultatchipsene, ikke i teksten. Andre deler av en parentes blir stående.
 */
export function plainText(t: string): string {
  const mech = /^(?:[−+-]\d+ .+|ingenting å (?:miste|slite på)|.+ er borte for godt)$/;
  return t
    .replace(/ ?\(([^()]*)\)/g, (m, inner: string) => {
      const keep = inner.split(', ').filter((p) => !mech.test(p));
      return keep.length === inner.split(', ').length ? m : keep.length ? ` (${keep.join(', ')})` : '';
    })
    .replace(/([.!?])\.+/g, '$1');
}

const sgn = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);

/** Et tall eller et spenn, for eksempel «+3 mat» eller «opptil −4 mat». Tom streng når alt er 0. */
function span(vals: number[], label: string): string {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === 0 && hi === 0) return '';
  if (lo === hi) return `${sgn(lo)} ${label}`;
  if (lo === 0 || hi === 0) return `opptil ${sgn(lo || hi)} ${label}`;
  return lo > 0 ? `+${lo}–${hi} ${label}` : hi < 0 ? `−${-hi}–${-lo} ${label}` : `${sgn(lo)} til ${sgn(hi)} ${label}`;
}

/** Oppsummerer ett eller flere mulige utfall som korte linjer. Med flere utfall blir sjeldne ting «kan …». */
export function summarize(ds: Delta[]): string[] {
  if (!ds.length) return [];
  const out: string[] = [];
  const maybe = (n: number, all: string, some: string) => { if (n === ds.length) out.push(all); else if (n) out.push(some); };
  for (const k of RES) out.push(span(ds.map((d) => d.res[k] ?? 0), RES_LABEL[k].toLowerCase()));
  out.push(span(ds.map((d) => d.moral), 'moral'));
  const z = ds.map((d) => d.zombies);
  if (Math.max(...z) > 0) out.push(span(z.map((n) => Math.max(0, n)), Math.max(...z) === 1 ? 'zombie' : 'zombier'));
  if (Math.min(...z) < 0) out.push(span(z.map((n) => Math.min(0, n)), 'zombier'));
  const single = ds.length === 1;
  maybe(ds.filter((d) => d.cards.length).length, single ? `nytt utstyr: ${ds[0].cards.join(', ')}` : 'nytt utstyr', 'kan gi utstyr');
  maybe(ds.filter((d) => d.lost.length).length, single ? `${nameList(ds[0].lost)} døde` : 'noen dør', 'kan koste et liv');
  maybe(ds.filter((d) => d.hurt.length).length, single ? `${nameList(ds[0].hurt)} skadet` : 'skade', 'kan gi skade');
  maybe(ds.filter((d) => d.wear > 0).length, 'utstyret slites', 'kan slite utstyr');
  maybe(ds.filter((d) => d.joined.length).length, single ? `${nameList(ds[0].joined)} blir med` : 'ny i crewet', 'kan gi ny i crewet');
  maybe(ds.filter((d) => d.gone.length).length, single ? `${nameList(ds[0].gone)} er borte for godt` : 'noen er borte for godt', 'kan miste noen for godt');
  maybe(ds.filter((d) => d.quests.length).length, single ? `nytt oppdrag: ${ds[0].quests.join(', ')}` : 'nytt oppdrag', 'kan gi nytt oppdrag');
  for (const g of Object.keys(GATES) as GateId[]) {
    const up = ds.map((d) => d.gateUp[g] ?? 0);
    if (Math.max(...up) > 0) out.push(span(up, `nivå ${GATES[g].name}`));
    else out.push(span(ds.map((d) => d.gateWork[g] ?? 0), `portarbeid ${GATES[g].name}`));
  }
  out.push(span(ds.map((d) => d.scouted), Math.max(...ds.map((d) => d.scouted)) === 1 ? 'sektor speidet' : 'sektorer speidet'));
  out.push(span(ds.map((d) => d.control), 'kontroll'));
  out.push(span(ds.map((d) => d.searched), 'gjennomsøkt'));
  return out.filter(Boolean);
}

/** Antall prøvekjøringer per utfall. Nok til å fange det som skjer med sjanse på rundt 15 % eller mer. */
const SAMPLES = 12;

/** Kjører `run` på kopier med andre frø og samler hva som kan skje. Selve tilstanden røres ikke. */
export function sampleOutcomes(s: GameState, run: (copy: GameState) => void): string[] {
  const ds: Delta[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const copy = structuredClone(s);
    copy.rng = (s.rng ^ Math.imul(i + 1, 0x9e3779b1)) | 0;
    run(copy);
    ds.push(delta(s, copy));
  }
  return summarize(ds);
}

/** Forhåndsvisning av et valg: hva det kan gi når det lykkes, og når det går galt (null uten sjekk). */
export interface ChoicePreview {
  ok: string[];
  fail: string[] | null;
}
