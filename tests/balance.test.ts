import { beforeAll, describe, expect, it } from 'vitest';
import { START_NEIGHBORS } from '../src/engine';
import type { GameState } from '../src/engine';
import { COMBOS, playGame } from '../tools/bot';

// Fase 1 skal kunne vinnes nesten alltid, men ikke for fort. Målene er fra kapittel 11 i docs/spilldesign.md.
// Boten følger en fast prioritetsliste, så en god spiller bør gjøre det bedre enn tallene her.
const N = 150;
/** En tapt runde regnes som sulterunde når crewet manglet mat eller vann i minst så mange dager. */
const STARVED_LOSS = 3;
/** Minste antall tapte runder (alle crewene sammen) før tapstesten sier noe. Færre feiler testen. */
const MIN_LOSSES = 10;

const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a[a.length >> 1]; };
const play = (neighbors?: string[]) => Array.from({ length: N }, (_, i) => playGame(i + 1, neighbors));

/** Hvordan en runde ble tapt: tiden gikk ut, eller crewet døde der flest døde. Sult telles for seg (starvedDays). */
function lossCause(s: GameState): 'timeout' | 'kamp' | 'natt' | 'tokt' {
  if (s.over === 'timeout') return 'timeout';
  const d = s.stats.deaths;
  return (['kamp', 'natt', 'tokt'] as const).reduce((a, k) => (d[k] > d[a] ? k : a), 'kamp' as 'kamp' | 'natt' | 'tokt');
}

// 750 runder spilles i beforeAll. Tidsgrensen er satt med god margin (det tar rundt et par sekunder).
describe('balanse i fase 1', { timeout: 60_000 }, () => {
  let games: GameState[] = [];
  let won: GameState[] = [];
  /** standardcrewet først, så hver kombinasjon i COMBOS */
  let byCombo: { combo: string[]; games: GameState[] }[] = [];
  beforeAll(() => {
    games = play();
    won = games.filter((s) => s.over === 'won');
    byCombo = COMBOS.map((combo) => ({ combo, games: play(combo) }));
  }, 120_000);

  it('boten vinner minst 85 % av rundene, men ikke alle', () => {
    expect(won.length / games.length).toBeGreaterThanOrEqual(0.85);
    expect(won.length / games.length).toBeLessThanOrEqual(0.97);
  });

  it('en seier tar typisk mellom 20 og 40 dager', () => {
    const days = median(won.map((s) => s.day - 1));
    expect(days).toBeGreaterThanOrEqual(20);
    expect(days).toBeLessThanOrEqual(40);
  });

  it('median sultedager per runde er 2 eller mindre', () => {
    expect(median(games.map((s) => s.stats.starvedDays))).toBeLessThanOrEqual(2);
  });

  it('sult er ikke den vanligste grunnen til at runder tapes', () => {
    // Tap er sjeldne, så tapte runder fra alle crewene telles sammen. Testen krever et utvalg, så den
    // kan ikke bestå uten at det finnes tapte runder å se på (seier ≤ 97 % gir minst 25 med 5 × 150 runder).
    const lost = [games, ...byCombo.map((r) => r.games)].flat().filter((g) => g.over !== 'won');
    const starved = lost.filter((s) => s.stats.starvedDays >= STARVED_LOSS);
    const causes: Record<string, number> = {};
    for (const s of lost) causes[lossCause(s)] = (causes[lossCause(s)] ?? 0) + 1;
    const deaths = lost.reduce((a, s) => a + s.stats.lost, 0);
    const info = JSON.stringify({ lost: lost.length, starved: starved.length, causes, deaths });
    expect(lost.length, info).toBeGreaterThanOrEqual(MIN_LOSSES);
    // en typisk tapt runde har lite sult
    expect(median(lost.map((s) => s.stats.starvedDays)), info).toBeLessThanOrEqual(STARVED_LOSS);
    // under halvparten av de tapte rundene har langvarig sult, så noe annet (kamp, natt, porter, tid) er hovedgrunnen
    expect(starved.length, info).toBeLessThan(lost.length / 2);
  });

  it('crewet mister folk av og til', () => {
    const all = [games, ...byCombo.map((r) => r.games)].flat();
    expect(all.reduce((a, s) => a + s.stats.lost, 0) / all.length).toBeGreaterThanOrEqual(0.2);
  });

  it('kombinasjonene bruker bare startnaboer', () => {
    for (const c of COMBOS) for (const id of c) expect(START_NEIGHBORS).toContain(id);
  });

  it('boten vinner 85–97 % med hver kombinasjon, med median 20–40 dager', () => {
    for (const r of byCombo) {
      const w = r.games.filter((s) => s.over === 'won');
      expect(w.length / N, r.combo.join(', ')).toBeGreaterThanOrEqual(0.85);
      expect(w.length / N, r.combo.join(', ')).toBeLessThanOrEqual(0.97);
      const days = median(w.map((s) => s.day - 1));
      expect(days, r.combo.join(', ')).toBeGreaterThanOrEqual(20);
      expect(days, r.combo.join(', ')).toBeLessThanOrEqual(40);
    }
  });
});

// Hard skal merkes: rundt 75–85 % seier i fase 1 for standardcrewet (kapittel 6 i spilldesignet).
// Færre runder enn over, så testen er rask. Spennet har litt slingringsmonn for tilfeldighetene.
const N_HARD = 100;
describe('balanse i fase 1 på hard', { timeout: 60_000 }, () => {
  it('standardcrewet vinner 70–88 % på hard, klart sjeldnere enn på normal', () => {
    const games = Array.from({ length: N_HARD }, (_, i) => playGame(i + 1, undefined, { difficulty: 'hard' }));
    const rate = games.filter((s) => s.over === 'won').length / N_HARD;
    expect(rate).toBeGreaterThanOrEqual(0.7);
    expect(rate).toBeLessThanOrEqual(0.88);
  });
});
