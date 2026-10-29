import { describe, expect, it } from 'vitest';
import { newGame, taskOptions } from '../src/engine';
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

  it('dag 1 ber om at alle som kan, rydder', () => {
    expect(TUTORIAL[0].text).toContain('send alle dere kan');
  });

  it('dag 2 godtar Befeste eller Vakt ved Rosenberg-gjerdet, ikke andre gjerder', () => {
    const s = game(), d = TUTORIAL[1].done;
    s.sectors.hjem.z = 0;
    s.crew[0].task = { type: 'befeste', target: 'nord' };
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'befeste', target: 'ros' };
    expect(d(s)).toBe(true);
    s.crew[0].task = { type: 'vakt', target: 'ros' };
    expect(d(s)).toBe(true);
  });

  it('dag 2 godtar rydding av Hjemme så lenge det er zombier der, siden gjerdet da ikke kan bygges', () => {
    const s = game(), d = TUTORIAL[1].done;
    expect(TUTORIAL[1].text).toContain('rydd det ferdig først');
    s.sectors.hjem.z = 2;
    // gjerdet er ikke en gyldig ordre mens Hjemme er infisert
    expect(taskOptions(s).some((o) => o.type === 'befeste' && o.target === 'ros')).toBe(false);
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'rydde', target: 'obs' };
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'rydde', target: 'hjem' };
    expect(d(s)).toBe(true);
    // når Hjemme er tomt, holder ikke rydding lenger
    s.sectors.hjem.z = 0;
    expect(d(s)).toBe(false);
    s.crew[1].task = { type: 'vakt', target: 'ros' };
    expect(d(s)).toBe(true);
  });

  it('dag 2 kan alltid fullføres: med zombier i Hjemme finnes Rydde, ellers Befeste eller Vakt', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
      s.day = 2;
      for (const z of [0, 3]) {
        s.sectors.hjem.z = z;
        const ok = taskOptions(s).find((o) => (o.type === 'rydde' && o.target === 'hjem' && z > 0) || ((o.type === 'befeste' || o.type === 'vakt') && o.target === 'ros'));
        expect(ok, `seed ${seed}, z ${z}`).toBeDefined();
        const { label: _l, ...task } = ok!;
        s.crew[0].task = task as typeof s.crew[0]['task'];
        expect(TUTORIAL[1].done(s)).toBe(true);
      }
    }
  });

  it('dag 3 er ferdig når noen sanker', () => {
    const s = game(), d = TUTORIAL[2].done;
    expect(d(s)).toBe(false);
    s.crew[0].task = { type: 'sanke', target: 'hjem' };
    expect(d(s)).toBe(true);
  });
});
