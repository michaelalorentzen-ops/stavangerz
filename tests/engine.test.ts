import { describe, expect, it } from 'vitest';
import {
  addGateWork, continueAfterWin, GATE_STEPS, migrate, newGame, PLAYABLE, rand, resolveDay, sectorIntel, taskOptions, toSkill, validateTasks,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF, playGame } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);

describe('determinisme', () => {
  it('samme seed gir samme tallrekke', () => {
    const a = { rng: 7 }, b = { rng: 7 };
    expect(Array.from({ length: 5 }, () => rand(a))).toEqual(Array.from({ length: 5 }, () => rand(b)));
  });

  it('samme seed og samme ordre gir identisk spill', () => {
    expect(playGame(123)).toEqual(playGame(123));
  });

  it('ulik seed gir ulike spill', () => {
    expect(playGame(1)).not.toEqual(playGame(2));
  });
});

describe('rydding', () => {
  it('reduserer zombier', () => {
    const s = fresh();
    for (let i = 0; i < 5 && s.sectors.hjem.z > 0; i++) {
      for (const c of s.crew) c.task = { type: 'rydde', target: 'hjem' };
      resolveDay(s);
    }
    // natta kan sende nye zombier inn, men crewet skal ha drept noen
    expect(s.stats.kills).toBeGreaterThanOrEqual(4);
  });

  it('viser ikke trusselnivå for en sektor som ikke er speidet', () => {
    const s = fresh();
    expect(sectorIntel(s, 'obs').threat).toBeNull();
    expect(sectorIntel(s, 'obs').safe).toBe(false);
  });

  it('gir et intervall som anslag for usette sektorer', () => {
    const s = fresh();
    expect(sectorIntel(s, 'skolen').estimate).toMatch(/^\d+–\d+$/);
    expect(sectorIntel(s, 'hjem').estimate).toBe(String(s.sectors.hjem.z));
  });
});

describe('skjulte zombier i kjellere', () => {
  const clearedWithHidden = (seed: number, hidden: number) => {
    const s = fresh(seed);
    s.sectors.obs = { ...s.sectors.obs, z: 0, hidden, searched: 50, control: 40 };
    return s;
  };

  it('bryter ut og infiserer sektoren igjen før eller siden', () => {
    let outbreaks = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = clearedWithHidden(seed, 4);
      resolveDay(s);
      if (s.sectors.obs.z > 0) outbreaks++;
    }
    expect(outbreaks).toBeGreaterThan(5);
  });

  it('bryter aldri ut når kjellerne faktisk er tomme', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = clearedWithHidden(seed, 0);
      resolveDay(s);
      // obs kan bare få zombier via Rosenberg-gjerdet om natta
      if (s.sectors.obs.z > 0) expect(s.log.at(-1)!.lines.some((l) => l.t.includes('Rosenberg-gjerdet'))).toBe(true);
    }
  });
});

describe('sperringer', () => {
  it('går opp i nivå ved tersklene og stopper på 3', () => {
    const s = fresh();
    addGateWork(s, 'nord', GATE_STEPS[1] - 0.1);
    expect(s.gates.nord.level).toBe(0);
    addGateWork(s, 'nord', 0.1);
    expect(s.gates.nord.level).toBe(1);
    addGateWork(s, 'nord', 1000);
    expect(s.gates.nord.level).toBe(3);
  });

  it('kan bare befestes når sektoren foran er klarert', () => {
    const s = fresh();
    const canBuild = (st: GameState) => taskOptions(st).some((o) => o.type === 'befeste' && o.target === 'nord');
    expect(canBuild(s)).toBe(false);
    s.sectors.nordkrysset.z = 0;
    expect(canBuild(s)).toBe(true);
  });
});

describe('ordre', () => {
  it('nullstiller ordre som ikke lenger er gyldige', () => {
    const s = fresh();
    s.crew[0].task = { type: 'sanke', target: 'skolen' }; // skolen er infisert
    validateTasks(s);
    expect(s.crew[0].task).toEqual({ type: 'hvile' });
  });

  it('tilbyr Rydde for alle sektorer som ikke er gjennomsøkt', () => {
    const s = fresh();
    expect(taskOptions(s).filter((o) => o.type === 'rydde').length).toBe(PLAYABLE.length);
    s.sectors.obs.searched = 100; s.sectors.obs.z = 0;
    expect(taskOptions(s).some((o) => o.type === 'rydde' && o.target === 'obs')).toBe(false);
  });

  it('tilbyr Sanke bare i sektorer uten zombier', () => {
    const s = fresh();
    expect(taskOptions(s).some((o) => o.type === 'sanke')).toBe(false);
    s.sectors.obs.z = 0;
    expect(taskOptions(s).some((o) => o.type === 'sanke' && o.target === 'obs')).toBe(true);
  });
});

describe('lagring', () => {
  it('forkaster lagring fra prototypen (v1 og v2)', () => {
    expect(migrate({ v: 2 })).toBeNull();
    expect(migrate({ v: 1 })).toBeNull();
  });

  it('godtar en v3-tilstand uendret', () => {
    const s = fresh();
    expect(migrate(s)).toEqual(s);
    expect(s.v).toBe(3);
  });

  it('gir en eldre v3-lagring sultedager og dødsårsaker', () => {
    const s = JSON.parse(JSON.stringify(fresh()));
    s.stats = { kills: 3, found: 2, lost: 1 };
    const m = migrate(s)!;
    expect(m.stats).toEqual({ kills: 3, found: 2, lost: 1, starvedDays: 0, deaths: { kamp: 0, natt: 0, tokt: 0 } });
  });

  it('avviser ukjente data', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ v: 99 })).toBeNull();
  });
});

describe('oppsett', () => {
  it('starter med de nye ressursene', () => {
    expect(fresh().res).toEqual({ mat: 14, vann: 10, medisin: 0, tre: 3, skrap: 3, metall: 0, strom: 0, drivstoff: 0 });
  });

  it('regner spillerens prikker om til ferdigheter 1–100', () => {
    expect(fresh().crew[0].stats.muskler).toBe(toSkill(BOT_SELF.stats.muskler));
  });
});

describe('fortsett etter seier', () => {
  it('continueAfterWin gjør won til won-seen og ingenting ellers', () => {
    const s = fresh();
    expect(continueAfterWin(s)).toBe(false);
    expect(s.over).toBeNull();
    s.over = 'won';
    expect(continueAfterWin(s)).toBe(true);
    expect(s.over).toBe('won-seen');
    expect(resolveDay(s).length).toBeGreaterThan(0);
    s.over = 'timeout';
    expect(continueAfterWin(s)).toBe(false);
    expect(s.over).toBe('timeout');
  });
});
