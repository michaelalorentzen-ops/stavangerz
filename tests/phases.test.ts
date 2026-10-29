import { describe, expect, it } from 'vitest';
import { advancePhase, canEndPhase, checkEnd, endPhase, migrate, hasMutation, MUTATIONS, mods, newGame, PHASES, PLAYABLE, resolveDay } from '../src/engine';
import type { PhaseModifiers } from '../src/engine';
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

  it('fase 1 gir ingen mutasjonspoeng', () => {
    expect(PHASES[1].mutationPoints).toEqual([0, 0]);
    const s = newGame(3, BOT_SELF, []);
    s.phase = 1;
    expect(s.mutations).toEqual([]);
  });

  it('har mutasjonspoeng per fase', () => {
    expect(ids.map((id) => PHASES[id].mutationPoints)).toEqual([[0, 0], [1, 2], [1, 3], [2, 3], [1, 2]]);
  });

  it('alle mutasjoner bruker knotter som finnes', () => {
    const knobs = Object.keys(PHASES[1].mods);
    const all = Object.values(MUTATIONS);
    expect(all.length).toBeGreaterThanOrEqual(13);
    for (const m of all) {
      expect(m.code).toMatch(/^Z\d+-/);
      expect(m.gene.length).toBeGreaterThan(0);
      for (const k of Object.keys(m.mult)) expect(knobs).toContain(k);
    }
    for (const id of ids) for (const k of knobs) expect(PHASES[id].mods[k as keyof PhaseModifiers]).toBeTypeOf('number');
  });
});

describe('mods()', () => {
  it('gir fasens verdier når ingen evner er aktive', () => {
    expect(mods({ phase: 3, mutations: [], knownMutations: [] })).toEqual(PHASES[3].mods);
  });

  it('ganger inn aktive mutasjoner', () => {
    const m = mods({ phase: 2, mutations: ['lopere'], knownMutations: [] });
    expect(m.injuryMult).toBeCloseTo(PHASES[2].mods.injuryMult * 1.25);
  });

  it('kjent mutasjon gir halv effekt', () => {
    const m = mods({ phase: 2, mutations: ['seige'], knownMutations: ['seige'] });
    expect(m.killMult).toBeCloseTo(PHASES[2].mods.killMult * 0.925);
  });

  it('hasMutation leser mutasjonene', () => {
    expect(hasMutation({ mutations: ['seige'] }, 'seige')).toBe(true);
    expect(hasMutation({ mutations: [] }, 'seige')).toBe(false);
  });

  it('endrer ikke tabellen', () => {
    const before = JSON.stringify(PHASES);
    mods({ phase: 4, mutations: ['seige', 'smarte'], knownMutations: [] });
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

  it('trekker mutasjoner tilfeldig, men likt for samme seed', () => {
    const run = (seed: number) => { const s = newGame(seed, BOT_SELF, []); for (let i = 0; i < 4; i++) advancePhase(s); return s.mutations; };
    expect(run(5)).toEqual(run(5));
    const variants = new Set(Array.from({ length: 30 }, (_, i) => run(i).join(',')));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('samme seed gir samme mutasjoner', () => {
    const run = () => { const s = newGame(11, BOT_SELF, []); const a = [advancePhase(s), advancePhase(s)]; return [a, s.mutations, s.rng]; };
    expect(run()).toEqual(run());
  });

  it('mutasjoner i en gren kommer i rekkefølge', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = newGame(seed, BOT_SELF, []);
      for (let i = 0; i < 4; i++) advancePhase(s);
      const have = new Set(s.mutations);
      expect(have.size).toBe(s.mutations.length);
      for (const m of s.mutations) {
        const same = Object.values(MUTATIONS).filter((d) => d.branch === MUTATIONS[m].branch && d.order < MUTATIONS[m].order);
        for (const d of same) expect(have.has(d.id)).toBe(true);
      }
      if (have.has('svommere')) expect(have.has('hoppere')).toBe(true);
    }
  });

  it('antall mutasjoner holder seg innenfor fasenes poeng', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = newGame(seed, BOT_SELF, []);
      const added = [2, 3, 4].map(() => advancePhase(s).length);
      added.forEach((n, i) => { const [a, b] = PHASES[(i + 2) as PhaseId].mutationPoints; expect(n).toBeGreaterThanOrEqual(a); expect(n).toBeLessThanOrEqual(b); });
    }
  });

  it('nullstiller mål og starter ny fase på dagen', () => {
    const s = newGame(2, BOT_SELF, []);
    s.day = 30; s.goalDay = 20;
    advancePhase(s);
    expect(s.goalDay).toBeNull();
    expect(s.phaseStartDay).toBe(30);
  });
});

describe('faseslutt og turgrense', () => {
  const clearAll = (s: ReturnType<typeof newGame>) => {
    for (const id of PLAYABLE) { const sec = s.sectors[id]; sec.z = 0; sec.hidden = 0; sec.searched = 100; sec.control = 100; }
    for (const g of Object.values(s.gates)) g.level = 2;
  };

  it('goalDay settes første dag målet er nådd', () => {
    const s = newGame(1, BOT_SELF, []);
    checkEnd(s);
    expect(s.goalDay).toBeNull();
    s.day = 17; clearAll(s);
    checkEnd(s);
    expect(s.goalDay).toBe(17);
    expect(s.over).toBeNull();
    s.day = 19;
    checkEnd(s);
    expect(s.goalDay).toBe(17);
  });

  it('endPhase krever goalDay', () => {
    const s = newGame(1, BOT_SELF, []);
    expect(canEndPhase(s)).toBe(false);
    endPhase(s);
    expect(s.over).toBeNull();
    s.goalDay = 12;
    expect(canEndPhase(s)).toBe(true);
    endPhase(s);
    expect(s.over).toBe('won');
    expect(s.mutations).toEqual([]);
  });

  it('turgrensen gir timeout uten mål, og seier med mål', () => {
    const a = newGame(1, BOT_SELF, []);
    a.day = a.phaseStartDay + PHASES[1].mods.turnCap;
    checkEnd(a);
    expect(a.over).toBe('timeout');
    const b = newGame(1, BOT_SELF, []);
    b.goalDay = 20;
    b.day = b.phaseStartDay + PHASES[1].mods.turnCap;
    checkEnd(b);
    expect(b.over).toBe('won');
    const c = newGame(1, BOT_SELF, []);
    c.day = c.phaseStartDay + PHASES[1].mods.turnCap - 1;
    checkEnd(c);
    expect(c.over).toBeNull();
  });

  it('turgrense og mål utløses ikke i won-seen', () => {
    const s = newGame(1, BOT_SELF, []);
    s.over = 'won-seen';
    s.day = 200;
    checkEnd(s);
    expect(s.over).toBe('won-seen');
  });

  it('resolveDay gjør ingenting etter at runden er over, men won-seen kan spille videre', () => {
    for (const over of ['won', 'dead', 'timeout'] as const) {
      const s = newGame(1, BOT_SELF, []);
      s.over = over;
      const before = JSON.stringify(s);
      expect(resolveDay(s)).toEqual([]);
      expect(JSON.stringify(s)).toBe(before);
    }
    const s = newGame(1, BOT_SELF, []);
    s.over = 'won-seen';
    const day = s.day;
    resolveDay(s);
    expect(s.day).toBe(day + 1);
  });
});

describe('migrate()', () => {
  it('fyller inn mutasjonsfeltene i eldre v3-lagringer', () => {
    const old = JSON.parse(JSON.stringify(newGame(1, BOT_SELF, [])));
    for (const k of ['mutations', 'knownMutations', 'branchWeights', 'goalDay', 'phaseStartDay']) delete old[k];
    old.zombieTraits = ['seige'];
    const s = migrate(old)!;
    expect(s.mutations).toEqual([]);
    expect(s.knownMutations).toEqual([]);
    expect(s.branchWeights).toEqual({ bevegelse: 1, sanser: 1, kropp: 1, atferd: 1 });
    expect(s.goalDay).toBeNull();
    expect(s.phaseStartDay).toBe(1);
    expect('zombieTraits' in s).toBe(false);
  });
});
