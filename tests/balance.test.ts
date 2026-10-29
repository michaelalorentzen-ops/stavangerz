import { beforeAll, describe, expect, it } from 'vitest';
import { START_NEIGHBORS } from '../src/engine';
import type { GameState } from '../src/engine';
import { COMBOS, playGame } from '../tools/bot';

// Fase 1 skal kunne vinnes nesten alltid, men ikke for fort. Målene er fra kapittel 11 i docs/spilldesign.md.
// Boten følger en fast prioritetsliste, så en god spiller bør gjøre det bedre enn tallene her.
const N = 150;
/** En tapt runde regnes som tapt på sult når crewet manglet mat eller vann i minst så mange dager. */
const STARVED_LOSS = 5;

const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a[a.length >> 1]; };
const play = (neighbors?: string[]) => Array.from({ length: N }, (_, i) => playGame(i + 1, neighbors));

/** Hovedgrunnen til at en runde ble tapt: sult, flest døde et sted, eller tiden gikk ut. */
function lossCause(s: GameState): 'sult' | 'kamp' | 'natt' | 'tokt' | 'timeout' {
  if (s.stats.starvedDays >= STARVED_LOSS) return 'sult';
  const d = s.stats.deaths;
  const worst = (['kamp', 'natt', 'tokt'] as const).reduce((a, k) => (d[k] > d[a] ? k : a), 'kamp' as 'kamp' | 'natt' | 'tokt');
  return s.over === 'dead' || d[worst] > 0 ? worst : 'timeout';
}

describe('balanse i fase 1', () => {
  let games: GameState[] = [];
  let won: GameState[] = [];
  /** standardcrewet først, så hver kombinasjon i COMBOS */
  let byCombo: { combo: string[]; games: GameState[] }[] = [];
  beforeAll(() => {
    games = play();
    won = games.filter((s) => s.over === 'won');
    byCombo = COMBOS.map((combo) => ({ combo, games: play(combo) }));
  });

  it('boten vinner minst 85 % av rundene', () => {
    expect(won.length / games.length).toBeGreaterThanOrEqual(0.85);
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
    // tapte runder er få, så alle crewene telles sammen for å få et utvalg
    const lost = [games, ...byCombo.map((r) => r.games)].flat().filter((g) => g.over !== 'won');
    const count: Record<string, number> = {};
    for (const s of lost) count[lossCause(s)] = (count[lossCause(s)] ?? 0) + 1;
    const others = Object.entries(count).filter(([k]) => k !== 'sult').map(([, n]) => n);
    // ingen runder tapt på sult, eller en annen grunn er vanligere
    if (count.sult) expect(count.sult, JSON.stringify(count)).toBeLessThan(Math.max(0, ...others));
  });

  it('kombinasjonene bruker bare startnaboer', () => {
    for (const c of COMBOS) for (const id of c) expect(START_NEIGHBORS).toContain(id);
  });

  it('boten vinner minst 85 % med hver kombinasjon, med median 20–40 dager', () => {
    for (const r of byCombo) {
      const w = r.games.filter((s) => s.over === 'won');
      expect(w.length / N, r.combo.join(', ')).toBeGreaterThanOrEqual(0.85);
      const days = median(w.map((s) => s.day - 1));
      expect(days, r.combo.join(', ')).toBeGreaterThanOrEqual(20);
      expect(days, r.combo.join(', ')).toBeLessThanOrEqual(40);
    }
  });
});
