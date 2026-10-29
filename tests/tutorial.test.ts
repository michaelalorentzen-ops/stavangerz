import { describe, expect, it } from 'vitest';
import { newGame } from '../src/engine';
import { dismissKey, stepFor, TUTORIAL } from '../src/ui/tutorial';
import { BOT_SELF } from '../tools/bot';

const game = () => newGame(7, BOT_SELF, ['kjell', 'mona', 'arild']);

describe('tutorial', () => {
  it('«Skjønner»-nøkkelen skiller runder og dager', () => {
    expect(dismissKey({ seed: 1, day: 1 })).not.toBe(dismissKey({ seed: 2, day: 1 }));
    expect(dismissKey({ seed: 1, day: 1 })).not.toBe(dismissKey({ seed: 1, day: 2 }));
    expect(dismissKey({ seed: 1, day: 1 })).toBe(dismissKey({ seed: 1, day: 1 }));
  });

  it('har ett trinn for hver av dag 1–3 og ingen etter', () => {
    expect(TUTORIAL.map((t) => t.day)).toEqual([1, 2, 3]);
    const s = game();
    s.day = 4;
    expect(stepFor(s)).toBeNull();
    s.day = 2;
    expect(stepFor(s)?.day).toBe(2);
    s.phase = 2 as typeof s.phase;
    expect(stepFor(s)).toBeNull();
  });

  it('dag 1 er ferdig først når to rydder Hjemme', () => {
    const s = game(), d = TUTORIAL[0].done;
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'rydde', target: 'hjem' };
    expect(d(s)).toBe(false);
    s.crew[1].task = { type: 'rydde', target: 'obs' };
    expect(d(s)).toBe(false);
    s.crew[1].task = { type: 'rydde', target: 'hjem' };
    expect(d(s)).toBe(true);
  });

  it('dag 2 godtar Befeste eller Vakt ved Rosenberg-gjerdet, ikke andre gjerder', () => {
    const s = game(), d = TUTORIAL[1].done;
    s.crew[0].task = { type: 'befeste', target: 'nord' };
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'befeste', target: 'ros' };
    expect(d(s)).toBe(true);
    s.crew[0].task = { type: 'vakt', target: 'ros' };
    expect(d(s)).toBe(true);
  });

  it('dag 3 er ferdig når noen sanker', () => {
    const s = game(), d = TUTORIAL[2].done;
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'sanke', target: 'hjem' };
    expect(d(s)).toBe(true);
  });
});
