import { describe, expect, it } from 'vitest';
import { EVENTS, housing, INTRO, newGame, RES, runChoice } from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed: number) => {
  const s = newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
  s.day = 8; // så alle kort med dagkrav kan trekkes
  s.res.drivstoff = 5;
  return s;
};
const valid = (s: GameState) => {
  for (const r of RES) { expect(Number.isNaN(s.res[r])).toBe(false); expect(s.res[r]).toBeGreaterThanOrEqual(0); }
  expect(Number.isNaN(s.moral)).toBe(false);
  expect(s.moral).toBeGreaterThanOrEqual(0);
  expect(s.moral).toBeLessThanOrEqual(100);
  for (const c of s.crew) expect(c.hp).toBeGreaterThanOrEqual(1);
  expect(s.crew.length).toBeLessThanOrEqual(housing(s));
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

describe('rekruttering uten plass', () => {
  it('Hurtigbåten avviser personen med tekst når boligene er fulle', () => {
    const ev = EVENTS.find((e) => e.id === 'hurtigbat')!;
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      while (s.crew.length < housing(s)) s.crew.push({ ...s.crew[1], id: `x${s.crew.length}` });
      const n = s.crew.length;
      const r = runChoice(s, ev.choices[0]);
      expect(r.text).toMatch(/plass/);
      expect(s.crew.length).toBe(n);
      expect(Object.keys(s.flags).filter((k) => k.startsWith('gone_')).length).toBe(1); // kortet gjentas ikke med samme utfall
      valid(s);
    }
  });
});

describe('mat fra hendelser', () => {
  it('minst fire kort kan gi mat, og fryseboksen gir mat uten sjekk', () => {
    const gives = (ev: (typeof EVENTS)[number]) => {
      for (let seed = 1; seed <= 20; seed++) for (const ch of ev.choices) {
        const s = fresh(seed);
        if ((ev.when && !ev.when(s)) || (ch.when && !ch.when(s))) continue;
        const before = s.res.mat;
        runChoice(s, ch);
        if (s.res.mat > before) return true;
      }
      return false;
    };
    expect(EVENTS.filter(gives).length).toBeGreaterThanOrEqual(4);
    const f = EVENTS.find((e) => e.id === 'fryseboks')!;
    const s = fresh(1);
    const before = s.res.mat;
    runChoice(s, f.choices[0]);
    expect(s.res.mat).toBeGreaterThan(before);
  });

  it('Garasjesalget gir et kort på lageret', () => {
    const ev = EVENTS.find((e) => e.id === 'garasjesalg')!;
    const s = fresh(1);
    const n = s.stash.length;
    runChoice(s, ev.choices[0]);
    expect(s.stash.length).toBe(n + 1);
    expect(s.stash[s.stash.length - 1].def).toBe('jernia_kasse');
  });
});
