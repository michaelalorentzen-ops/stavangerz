import { describe, expect, it } from 'vitest';
import { advancePhase, mods, newGame, PHASES, ZOMBIE_TRAITS } from '../src/engine';
import type { PhaseId } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const ids: PhaseId[] = [1, 2, 3, 4, 5];

describe('fasetabell', () => {
  it('har alle fem fasene', () => {
    expect(Object.keys(PHASES).map(Number)).toEqual(ids);
    for (const id of ids) expect(PHASES[id].id).toBe(id);
  });

  it('gjør zombiene seigere og farligere fra fase 1 til 4', () => {
    for (let i = 1; i < 4; i++) {
      const a = PHASES[ids[i - 1]].mods, b = PHASES[ids[i]].mods;
      expect(b.killMult).toBeLessThanOrEqual(a.killMult);
      expect(b.injuryMult).toBeGreaterThanOrEqual(a.injuryMult);
      expect(b.zombieMult).toBeGreaterThanOrEqual(a.zombieMult);
    }
  });

  it('flytter trusselen fra zombier til fraksjoner i fase 5', () => {
    expect(PHASES[5].mods.factionPressure).toBeGreaterThan(PHASES[4].mods.factionPressure);
    expect(PHASES[5].mods.zombieMult).toBeLessThan(PHASES[4].mods.zombieMult);
  });

  it('fase 1 har ingen zombieevner', () => {
    expect(PHASES[1].traitPool).toEqual([]);
  });

  it('bruker bare zombieevner som finnes', () => {
    for (const id of ids) for (const t of PHASES[id].traitPool) expect(ZOMBIE_TRAITS[t]).toBeDefined();
  });
});

describe('mods()', () => {
  it('gir fasens verdier når ingen evner er aktive', () => {
    expect(mods({ phase: 3, zombieTraits: [] })).toEqual(PHASES[3].mods);
  });

  it('ganger inn aktive zombieevner', () => {
    const m = mods({ phase: 2, zombieTraits: ['lopere'] });
    expect(m.injuryMult).toBeCloseTo(PHASES[2].mods.injuryMult * 1.25);
  });

  it('endrer ikke tabellen', () => {
    const before = JSON.stringify(PHASES);
    mods({ phase: 4, zombieTraits: ['seige', 'smarte'] });
    expect(JSON.stringify(PHASES)).toBe(before);
  });
});

describe('advancePhase()', () => {
  it('går fram én fase om gangen og stopper på 5', () => {
    const s = newGame(9, BOT_SELF, []);
    for (const id of [2, 3, 4, 5]) { advancePhase(s); expect(s.phase).toBe(id); }
    advancePhase(s);
    expect(s.phase).toBe(5);
  });

  it('trekker zombieevner tilfeldig, men likt for samme seed', () => {
    const run = (seed: number) => { const s = newGame(seed, BOT_SELF, []); for (let i = 0; i < 4; i++) advancePhase(s); return s.zombieTraits; };
    expect(run(5)).toEqual(run(5));
    const variants = new Set(Array.from({ length: 30 }, (_, i) => run(i).join(',')));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('gir aldri samme evne to ganger', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = newGame(seed, BOT_SELF, []);
      for (let i = 0; i < 4; i++) advancePhase(s);
      expect(new Set(s.zombieTraits).size).toBe(s.zombieTraits.length);
    }
  });
});
