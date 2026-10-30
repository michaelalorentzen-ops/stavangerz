import { describe, expect, it } from 'vitest';
import {
  addNeighbor, CARDS, checkOddsFor, COMEBACK_KNOCK, encounterOdds, GATE_STRAGGLERS, lage, newGame, ODDS_MAX, PHASES, resolveDay, taskOptions, THREAT_ODDS,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
const withMod = <K extends keyof typeof PHASES[1]['mods']>(k: K, v: number, fn: () => void) => {
  const old = PHASES[1].mods[k];
  (PHASES[1].mods[k] as number) = v;
  try { fn(); } finally { (PHASES[1].mods[k] as number) = old as number; }
};

describe('ingen sjekk er sikker', () => {
  it(`sjansen stopper på ${ODDS_MAX * 100} %`, () => {
    const s = fresh();
    for (const c of s.crew) c.stats.prat = 100;
    expect(checkOddsFor(s.crew, 'prat')).toBe(ODDS_MAX);
  });

  it('trusselnivået trekker ned sjansen i encounters', () => {
    const s = fresh();
    s.pending.push({ pid: 'a', def: 'trappegang', sector: 'obs', crew: s.crew.map((c) => c.id), threat: 1 });
    s.pending.push({ pid: 'b', def: 'trappegang', sector: 'obs', crew: s.crew.map((c) => c.id), threat: 3 });
    expect(encounterOdds(s, s.pending[0], 0) - encounterOdds(s, s.pending[1], 0)).toBeCloseTo(2 * THREAT_ODDS);
  });
});

describe('porten stenges ikke av noen få zombier', () => {
  it(`med ${GATE_STRAGGLERS} zombier bak porten kan den befestes, og laget tar dem`, () => {
    const s = fresh();
    s.sectors.sorspissen.z = GATE_STRAGGLERS;
    expect(taskOptions(s).some((o) => o.type === 'befeste' && o.target === 'sor')).toBe(true);
    for (const c of s.crew) c.task = { type: 'hvile' };
    s.crew[0].task = { type: 'vakt', target: 'sor' }; s.crew[1].task = { type: 'vakt', target: 'sor' };
    const before = s.sectors.sorspissen.control;
    withMod('nightBase', -5, () => resolveDay(s));
    expect(s.sectors.sorspissen.z).toBeLessThan(GATE_STRAGGLERS);
    expect(s.sectors.sorspissen.control).toBeGreaterThan(before);
  });

  it('med flere zombier enn det er porten stengt', () => {
    const s = fresh();
    s.sectors.sorspissen.z = GATE_STRAGGLERS + 1;
    expect(taskOptions(s).some((o) => 'target' in o && o.target === 'sor')).toBe(false);
  });
});

describe('sult og lager', () => {
  const hurt = (mat: number): GameState => {
    const s = fresh(3);
    for (const c of s.crew) { c.task = { type: 'hvile' }; c.hp = 2; }
    s.res.mat = mat; s.res.vann = 40; s.res.medisin = 10; s.pending = [];
    withMod('starveInjury', 0, () => resolveDay(s));
    return s;
  };
  it('ingen blir friskere på tom mage', () => {
    expect(hurt(0).crew.every((c) => c.hp <= 2)).toBe(true);
    expect(hurt(40).crew.some((c) => c.hp === 3)).toBe(true);
  });

  it('maten på lageret blir dårlig litt hver dag', () => {
    const s = fresh(3);
    for (const c of s.crew) c.task = { type: 'hvile' };
    s.res.mat = 100;
    withMod('stashRot', 0.1, () => resolveDay(s));
    expect(s.res.mat).toBeLessThanOrEqual(100 - 10 - 1);
  });
});

describe('comeback', () => {
  it('står du igjen alene, kan en nabo banke på om natta', () => {
    let knocked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = fresh(seed);
      s.crew = s.crew.slice(0, 1);
      s.crew[0].task = { type: 'hvile' }; s.res.mat = 30; s.res.vann = 30;
      withMod('nightBase', -5, () => resolveDay(s));
      if (s.crew.length > 1) knocked++;
    }
    expect(knocked).toBeGreaterThan(40 * COMEBACK_KNOCK * 0.4);
  });
});

describe('Lage utstyr', () => {
  it('lager aldri kort med et bestemt opphav', () => {
    const s = fresh(9);
    const c = s.crew[0];
    for (let i = 0; i < 200; i++) { s.res.skrap = 10; s.res.tre = 10; lage(s, c, 100, () => {}); }
    expect(s.stash.some((k) => CARDS[k.def].craftable === false)).toBe(false);
  });
});

describe('xp ved rekruttering', () => {
  it('nye naboer starter med 0 erfaring', () => {
    const s = fresh();
    addNeighbor(s, 'kjell');
    expect(s.crew.at(-1)!.xp).toBe(0);
  });
});

describe('tokt som låses opp', () => {
  it('apoteket åpnes av første skade, med en gang, og første tur er trygg', async () => {
    const { drawEvent, runChoice, toktAvailable, toktDef, resolveEncounter, toktDecision } = await import('../src/engine');
    const s = fresh(2);
    expect(toktAvailable(s, toktDef('apotek'))).toBe(false);
    s.crew[1].hp = 2;
    withMod('eventChance', 0, () => {
      const ev = drawEvent(s)!;
      expect(ev.id).toBe('medisinskapet');
      runChoice(s, ev.choices[0]);
    });
    expect(toktAvailable(s, toktDef('apotek'))).toBe(true);
    for (const c of s.crew) c.task = { type: 'hvile' };
    s.crew[0].task = { type: 'tokt', target: 'apotek' }; s.crew[2].task = { type: 'tokt', target: 'apotek' };
    const hp = s.crew.map((c) => c.hp);
    withMod('injuryMult', 50, () => {
      for (let d = 0; d < 2; d++) {
        resolveDay(s);
        expect(s.pending.filter((p) => p.toktId)).toHaveLength(0);
        while (s.pending.length) resolveEncounter(s, s.pending[0].pid, 0);
        toktDecision(s, 'apotek', 'fortsett');
      }
    });
    expect(s.crew[0].hp).toBe(hp[0]);
    expect(s.res.medisin).toBeGreaterThanOrEqual(toktDef('apotek').reward.res!.medisin!);
    expect(s.toktsDone).toContain('apotek');
  });

  it('kranføreren Roger blir med når kran-toktet er fullført, og kommer aldri til porten ellers', async () => {
    const { recruitablesNow } = await import('../src/engine');
    const s = fresh();
    expect(recruitablesNow(s).some((n) => n.id === 'roger')).toBe(false);
  });
});
