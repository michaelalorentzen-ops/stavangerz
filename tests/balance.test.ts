import { describe, expect, it } from 'vitest';
import { playGame } from '../tools/bot';

// Fase 1 skal kunne vinnes nesten alltid, men ikke for fort.
// Boten er dum, så en god spiller bør gjøre det bedre enn tallene her.
describe('balanse i fase 1', () => {
  const games = Array.from({ length: 150 }, (_, i) => playGame(i + 1));
  const won = games.filter((s) => s.over === 'won');
  const days = won.map((s) => s.day - 1).sort((a, b) => a - b);

  it('boten vinner minst 85 % av rundene', () => {
    expect(won.length / games.length).toBeGreaterThanOrEqual(0.85);
  });

  it('en seier tar typisk mellom 20 og 40 dager', () => {
    const median = days[days.length >> 1];
    expect(median).toBeGreaterThanOrEqual(20);
    expect(median).toBeLessThanOrEqual(40);
  });
});
