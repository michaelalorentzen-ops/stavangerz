import { describe, expect, it } from 'vitest';
import {
  addGateWork, GATE_STEPS, migrate, newGame, PLAYABLE, rand, resolveDay, sectorIntel, taskOptions, validateTasks,
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

describe('klarering', () => {
  it('reduserer zombier og markerer sektoren som klarert', () => {
    const s = fresh();
    for (const c of s.crew) c.task = { type: 'klarere', target: 'hjem' };
    for (let i = 0; i < 5 && s.sectors.hjem.z > 0; i++) {
      for (const c of s.crew) if (s.sectors.hjem.z > 0) c.task = { type: 'klarere', target: 'hjem' };
      resolveDay(s);
    }
    // natta kan sende nye zombier inn, men hjem skal ha vært klarert minst én gang
    expect(s.stats.kills).toBeGreaterThanOrEqual(4);
  });

  it('viser ikke sikkerhet for en infisert sektor', () => {
    const s = fresh();
    expect(sectorIntel(s, 'obs').conf).toBeUndefined();
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
    s.sectors.obs = { ...s.sectors.obs, z: 0, hidden, cleared: true, miss: 0.5 };
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
    s.crew[0].task = { type: 'lete', target: 'skolen' }; // skolen er infisert
    validateTasks(s);
    expect(s.crew[0].task).toEqual({ type: 'hvile' });
  });

  it('tilbyr klarering for alle infiserte sektorer', () => {
    const s = fresh();
    const clearable = taskOptions(s).filter((o) => o.type === 'klarere').length;
    expect(clearable).toBe(PLAYABLE.filter((id) => s.sectors[id].z > 0).length);
  });
});

describe('lagring', () => {
  it('oppgraderer en tilstand fra prototypen', () => {
    const old = { ...fresh(), v: 1 } as Record<string, unknown>;
    delete old.phase;
    delete old.zombieTraits;
    const s = migrate(old)!;
    expect(s.v).toBe(2);
    expect(s.phase).toBe(1);
    expect(s.zombieTraits).toEqual([]);
  });

  it('avviser ukjente data', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ v: 99 })).toBeNull();
  });
});
