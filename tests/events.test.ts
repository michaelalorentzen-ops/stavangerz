import { describe, expect, it } from 'vitest';
import { EVENTS, INTRO, newGame, RES, runChoice } from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed: number) => {
  const s = newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
  s.day = 8; // så alle kort med dagkrav kan trekkes
  s.res.drivstoff = 5;
  return s;
};
const valid = (s: GameState) => {
  for (const r of RES) expect(s.res[r]).toBeGreaterThanOrEqual(0);
  expect(s.moral).toBeGreaterThanOrEqual(0);
  expect(s.moral).toBeLessThanOrEqual(100);
  for (const c of s.crew) expect(c.hp).toBeGreaterThanOrEqual(1);
};

describe('hendelseskort', () => {
  it('har unike id-er', () => {
    const ids = [INTRO, ...EVENTS].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const ev of [INTRO, ...EVENTS]) {
    it(`«${ev.title}»: alle valg gir tekst og gyldig tilstand`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        for (const ch of ev.choices) {
          const s = fresh(seed);
          if (ev.when && !ev.when(s)) continue;
          if (ch.when && !ch.when(s)) continue;
          expect(ev.text(s).length).toBeGreaterThan(10);
          const r = runChoice(s, ch);
          expect(r.text.length).toBeGreaterThan(5);
          valid(s);
        }
      }
    });
  }
});
