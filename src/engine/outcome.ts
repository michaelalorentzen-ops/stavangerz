// Utfall av valg: hva et valg endret, og hva det kan endre. Forhåndsvisningen kjører valget på kopier av
// tilstanden med andre frø, så den aldri røper det neste terningkastet og aldri endrer selve spillet.
import { CARDS } from './content/cards';
import { RES, RES_LABEL } from './data';
import type { GameState, ResKey } from './types';

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
}

const durOf = (s: GameState) => s.crew.reduce((n, c) => n + Object.values(c.gear).reduce((m, k) => m + (k?.dur ?? 0), 0), 0);
const zOf = (s: GameState) => Object.values(s.sectors).reduce((n, sec) => n + sec.z + sec.hidden, 0);

/** Hva som endret seg fra `a` til `b`. Moral telles etter at den er klemt til 0–100. */
export function delta(a: GameState, b: GameState): Delta {
  const res: Delta['res'] = {};
  for (const k of RES) if (b.res[k] !== a.res[k]) res[k] = b.res[k] - a.res[k];
  const had = new Set(a.stash.map((k) => k.uid));
  const hurt: string[] = [], lost: string[] = [];
  for (const c of a.crew) {
    const now = b.crew.find((x) => x.id === c.id);
    if (!now) lost.push(c.name);
    else if (now.hp < c.hp) hurt.push(c.name);
  }
  const clampM = (m: number) => Math.max(0, Math.min(100, m));
  // kort som er kommet til, men ikke kort som bare ble lagt tilbake fra noens spor
  const worn = new Set(a.crew.flatMap((c) => Object.values(c.gear).map((k) => k!.uid)));
  return {
    res, moral: clampM(b.moral) - clampM(a.moral),
    cards: b.stash.filter((k) => !had.has(k.uid) && !worn.has(k.uid)).map((k) => CARDS[k.def].name),
    hurt, lost, zombies: zOf(b) - zOf(a),
    wear: Math.max(0, durOf(a) - durOf(b) - lostDur(a, b)),
  };
}

/** Holdbarhet som forsvant fordi bæreren døde (utstyret ligger igjen), ikke fordi det ble slitt. */
const lostDur = (a: GameState, b: GameState) =>
  a.crew.filter((c) => !b.crew.some((x) => x.id === c.id)).reduce((n, c) => n + Object.values(c.gear).reduce((m, k) => m + (k?.dur ?? 0), 0), 0);

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
  maybe(ds.filter((d) => d.lost.length).length, single ? `${ds[0].lost.join(' og ')} døde` : 'noen dør', 'kan koste et liv');
  maybe(ds.filter((d) => d.hurt.length).length, single ? `${ds[0].hurt.join(' og ')} skadet` : 'skade', 'kan gi skade');
  maybe(ds.filter((d) => d.wear > 0).length, 'utstyret slites', 'kan slite utstyr');
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
