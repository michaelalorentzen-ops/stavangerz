// Regelrunde 6: vanskelighet i økonomien, Rosenberg-gjerdet etter HQ-et, moral og ved, og anleggene og flaggene i fase 2.
import { describe, expect, it } from 'vitest';
import {
  activeSectors, dailyFoodIn, dailyHeat, DIFFICULTY, endPhase, gateQuiet, GATES, HQ_SECTOR, ISTAND_STRAGGLERS, KAI_FOOD, GANN_FOOD, KANTINE_FOOD,
  KONTOR_TRAIN, MORAL_DESERT, MORAL_HIGH, moralMult, mods, newGame, PHASES, resolveDay, SECTOR_IDS, taskOptions, toktDays, toktDef, trainMult,
} from '../src/engine';
import type { GameState, PhaseId } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const NB = ['arild', 'mona', 'toregil'];

function inPhase2(seed = 1): GameState {
  const s = newGame(seed, BOT_SELF, NB);
  s.goalDay = s.day;
  endPhase(s);
  return s;
}
const secure = (s: GameState, id: (typeof SECTOR_IDS)[number]) => Object.assign(s.sectors[id], { z: 0, hidden: 0, searched: 100, control: 100 });
function day(s: GameState) { s.event = null; s.pending = []; resolveDay(s); s.event = null; s.pending = []; }
function withHq(seed = 1): GameState {
  const s = inPhase2(seed);
  for (const id of activeSectors(s)) secure(s, id);
  for (const c of s.crew) c.task = { type: 'hvile' };
  day(s);
  return s;
}
const lines = (s: GameState) => s.log.find((d) => d.day === s.day - 1)?.lines.map((l) => l.t) ?? [];

describe('vanskelighet i økonomien', () => {
  it('hard og brutal gir mindre loot, sanking og regn, og mer råte enn normal', () => {
    const s = newGame(1, BOT_SELF, NB);
    const at = (d: 'normal' | 'hard' | 'brutal') => mods({ ...s, difficulty: d });
    for (const k of ['lootMult', 'yieldMult', 'rainChance'] as const) {
      expect(at('hard')[k]).toBeLessThan(at('normal')[k]);
      expect(at('brutal')[k]).toBeLessThan(at('hard')[k]);
    }
    expect(at('hard').stashRot).toBeGreaterThan(at('normal').stashRot);
    expect(at('brutal').stashRot).toBeGreaterThan(at('hard').stashRot);
    expect(DIFFICULTY.normal.mult).toEqual({});
  });
});

describe('Rosenberg-gjerdet og istandsetting', () => {
  it('gjerdet holder igjen verftet og slipper ingenting inn når HQ-et er tatt', () => {
    expect(GATES.ros.holds).toBe(HQ_SECTOR);
    const s = inPhase2();
    expect(gateQuiet(s, 'ros')).toBe(false);
    const h = withHq();
    expect(h.hq.taken).toBe(true);
    expect(gateQuiet(h, 'ros')).toBe(true);
    expect(gateQuiet(h, 'nord')).toBe(false);
    // mange netter uten vakt: ingen gjennombrudd ved gjerdet
    const seen: string[] = [];
    for (let i = 0; i < 30; i++) { for (const c of h.crew) c.task = { type: 'hvile' }; h.moral = 60; day(h); seen.push(...lines(h)); if (h.over) break; }
    expect(seen.some((t) => t.includes(`forbi ${GATES.ros.name}`))).toBe(false);
  });

  it('istandsetting tåler noen få streifere, og gruppa tar dem først', () => {
    const s = withHq();
    s.sectors[HQ_SECTOR].z = ISTAND_STRAGGLERS;
    expect(taskOptions(s).some((o) => o.type === 'istand')).toBe(true);
    s.res.metall = 30;
    for (const c of s.crew) c.task = { type: 'istand', target: 'kai' };
    day(s);
    expect(s.sectors[HQ_SECTOR].z).toBeLessThan(ISTAND_STRAGGLERS);
    s.sectors[HQ_SECTOR].z = ISTAND_STRAGGLERS + 1;
    expect(taskOptions(s).some((o) => o.type === 'istand')).toBe(false);
  });
});

describe('moral og ved', () => {
  it('moralen gir bonus over MORAL_HIGH og straff under 50', () => {
    expect(moralMult({ moral: MORAL_HIGH })).toBeGreaterThan(1);
    expect(moralMult({ moral: MORAL_HIGH - 1 })).toBe(1);
    expect(moralMult({ moral: 40 })).toBeLessThan(1);
    expect(moralMult({ moral: 10 })).toBeLessThan(moralMult({ moral: 40 }));
  });

  it('fasetabellen har desertChance for alle fem faser', () => {
    for (const p of [1, 2, 3, 4, 5] as PhaseId[]) expect(PHASES[p].mods.desertChance).toBeGreaterThan(0);
  });

  it('under MORAL_DESERT drar noen for godt, men aldri lederen', () => {
    let left = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(seed, BOT_SELF, [...NB, 'kjell']);
      const before = s.crew.map((c) => c.id);
      for (const c of s.crew) c.task = { type: 'hvile' };
      s.moral = MORAL_DESERT - 10;
      s.res.mat = 50; s.res.vann = 50;
      day(s);
      const gone = before.filter((id) => !s.crew.some((c) => c.id === id));
      expect(gone).not.toContain('meg');
      for (const id of gone) if (!s.flags[`dead_${id}`]) { expect(s.flags[`gone_${id}`]).toBe(true); left++; }
    }
    expect(left).toBeGreaterThan(0);
  });

  it('ingen drar når moralen er god', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(seed, BOT_SELF, [...NB, 'kjell']);
      for (const c of s.crew) c.task = { type: 'hvile' };
      s.moral = MORAL_DESERT + 30;
      day(s);
      expect(lines(s).some((t) => /pakket sekken/.test(t))).toBe(false);
    }
  });

  it('uten ved er det én linje om veden per dag', () => {
    const s = withHq();
    s.res.tre = 0;
    for (const c of s.crew) c.task = { type: 'hvile' };
    expect(dailyHeat(s)).toBeGreaterThan(0);
    day(s);
    expect(lines(s).filter((t) => /ved\b|Veden/i.test(t))).toHaveLength(1);
  });
});

describe('anleggene og flaggene i fase 2', () => {
  it('kaia gir fisk, mer med Gann', () => {
    const s = withHq();
    expect(dailyFoodIn(s)).toBe(0);
    s.hq.facilities.kai.ready = true;
    expect(dailyFoodIn(s)).toBe(KAI_FOOD);
    s.flags.gann = true;
    expect(dailyFoodIn(s)).toBe(KAI_FOOD + GANN_FOOD);
    s.hq.facilities.kantine.ready = true;
    expect(dailyFoodIn(s)).toBe(KANTINE_FOOD + KAI_FOOD + GANN_FOOD);
  });

  it('kontorbygget i stand gir mer erfaring av trening', () => {
    const a = withHq(), b = withHq();
    b.hq.facilities.kontor.ready = true;
    expect(trainMult(a)).toBe(1);
    expect(trainMult(b)).toBe(KONTOR_TRAIN);
    for (const s of [a, b]) for (const c of s.crew) c.task = { type: 'trene', stat: 'mekk' };
    const xa = a.crew[0].xp ?? 0, xb = b.crew[0].xp ?? 0;
    a.rng = b.rng = 7;
    day(a); day(b);
    expect((b.crew[0].xp ?? 0) - xb).toBeGreaterThan((a.crew[0].xp ?? 0) - xa);
  });

  it('bussen gjør tokt én dag kortere fra fase 2, aldri under én', () => {
    const d = toktDef('kran');
    const s = newGame(1, BOT_SELF, NB);
    s.flags.buss = true;
    expect(toktDays(s, d)).toBe(d.days);
    const t = inPhase2();
    expect(toktDays(t, d)).toBe(d.days);
    t.flags.buss = true;
    expect(toktDays(t, d)).toBe(Math.max(1, d.days - 1));
  });
});
