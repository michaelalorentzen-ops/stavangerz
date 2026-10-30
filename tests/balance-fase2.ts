// Balansen i fase 2 (Rosenberg som HQ), delt på tre testfiler så de kjører i parallell (balance-fase2-*.test.ts).
// Boten spiller fase 1 og fortsetter inn i fase 2. Målene står i kapittel 9b i docs/spilldesign.md.
// Bare runder som kom til fase 2 teller. Boten er bevisst enkel, så en god spiller slår den.
import { beforeAll, describe, expect, it } from 'vitest';
import type { GameState } from '../src/engine';
import { BOT_NEIGHBORS, COMBOS, playGame } from '../tools/bot';

/** Runder per crew. 80 gir stabile tall, og hver fil tar rundt 20 sekunder. */
const N = 80;
/** Langvarig sult: crewet manglet mat eller vann i minst så mange dager i fase 2. */
const STARVED_LOSS = 3;
/**
 * En sultespiral er langvarig sult som begynte før denne dagen i fasen (halve fristen). Sult som først kommer
 * etter en lang, mislykket kamp om verftet er en følge av tapet, ikke grunnen. Under en tredel av tapene skal være spiraler.
 */
const EARLY_STARVE = 30;

const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a[a.length >> 1]; };

interface Run { s: GameState; starved: number; firstStarve: number | null }

function play(neighbors: string[]): Run[] {
  return Array.from({ length: N }, (_, i) => {
    let start = -1, firstStarve: number | null = null;
    const s = playGame(i + 1, neighbors, {
      fase2: true,
      onDay2: (g) => {
        if (start < 0) start = g.stats.starvedDays; // første kall er når fase 2 starter
        if (firstStarve === null && g.stats.starvedDays > start) firstStarve = g.day - g.phaseStartDay;
      },
    });
    return { s, starved: start < 0 ? 0 : s.stats.starvedDays - start, firstStarve };
  }).filter((r) => r.s.phase >= 2);
}

const winRate = (rs: Run[]) => rs.filter((r) => r.s.over === 'won').length / rs.length;
const days = (rs: Run[]) => median(rs.filter((r) => r.s.over === 'won').map((r) => r.s.day - r.s.phaseStartDay));

/** Crewene testfilene velger blant: standardcrewet og kombinasjonene i COMBOS (k1–k4). */
export const FASE2_CREWS: Record<string, string[]> = { std: BOT_NEIGHBORS, ...Object.fromEntries(COMBOS.map((c, i) => [`k${i + 1}`, c])) };

export function fase2Balance(names: string[]) {
  describe(`balanse i fase 2 (${names.join(', ')})`, { timeout: 120_000 }, () => {
    let runs: { name: string; crew: string[]; runs: Run[] }[] = [];
    beforeAll(() => {
      runs = names.map((name) => ({ name, crew: FASE2_CREWS[name], runs: play(FASE2_CREWS[name]) }));
    }, 240_000);

    it('standardcrewet vinner 80–92 %, kombinasjonene 72–92 %', () => {
      for (const r of runs) {
        const label = `${r.name}: ${r.crew.join(', ')}`;
        expect(winRate(r.runs), label).toBeGreaterThanOrEqual(r.name === 'std' ? 0.8 : 0.72);
        expect(winRate(r.runs), label).toBeLessThanOrEqual(0.92);
      }
    });

    it('en seier i fase 2 tar typisk 22–40 dager', () => {
      for (const r of runs) {
        expect(days(r.runs), r.name).toBeGreaterThanOrEqual(22);
        expect(days(r.runs), r.name).toBeLessThanOrEqual(40);
      }
    });

    it('sultespiraler er ikke hovedgrunnen til at fase 2 tapes', () => {
      const lost = runs.flatMap((r) => r.runs).filter((r) => r.s.over !== 'won');
      const spiral = lost.filter((r) => r.starved >= STARVED_LOSS && r.firstStarve !== null && r.firstStarve < EARLY_STARVE);
      const info = JSON.stringify({ lost: lost.length, spiral: spiral.length, starved: lost.filter((r) => r.starved >= STARVED_LOSS).length });
      expect(lost.length, info).toBeGreaterThan(0);
      expect(spiral.length, info).toBeLessThan(lost.length / 3);
    });
  });
}
