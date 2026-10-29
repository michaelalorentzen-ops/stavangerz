import { describe, expect, it } from 'vitest';
import {
  canEndDay, canRecruit, checkEnd, GATE_IDS, housing, injure, NEIGHBORS, newGame, PLAYABLE, resolveDay, sameTask, sectorIntel,
  setLeader, stat, taskKey, taskOptions, addNeighbor, TOKTS,
} from '../src/engine';
import type { GameState, SectorId } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
const me = (s: GameState) => s.crew.find((c) => c.me)!;
const nobody = () => undefined;
/** Alle sektorer tomme og rolige, alle porter på nivå 3. */
const sealed = (s: GameState) => {
  for (const id of PLAYABLE) Object.assign(s.sectors[id], { z: 0, hidden: 0, searched: 100, control: 60 });
  for (const id of GATE_IDS) s.gates[id] = { work: 999, level: 3 };
};
const totalZ = (s: GameState) => PLAYABLE.reduce((n, id) => n + s.sectors[id].z, 0);

describe('Vakt på port', () => {
  it('vakt på port nivå 3 stopper alle gjennombrudd', () => {
    const s = fresh();
    sealed(s);
    GATE_IDS.forEach((g, i) => { s.crew[i].task = { type: 'vakt', target: g }; });
    for (let i = 0; i < 100; i++) {
      s.day = 40; s.over = null;
      resolveDay(s);
      expect(totalZ(s)).toBe(0);
    }
  });

  it('uten vakt slipper noe igjennom selv på nivå 3', () => {
    const s = fresh();
    sealed(s);
    let z = 0;
    for (let i = 0; i < 100; i++) { s.day = 40; s.over = null; for (const c of s.crew) c.task = { type: 'hvile' }; resolveDay(s); z += totalZ(s); for (const id of PLAYABLE) s.sectors[id].z = 0; }
    expect(z).toBeGreaterThan(0);
  });

  it('Rydde og Sanke teller ikke som vakt, men Befeste gjør det', () => {
    const run = (type: 'rydde' | 'sanke' | 'befeste') => {
      const s = fresh();
      sealed(s);
      s.sectors.nordkrysset.searched = 50;
      s.res.tre = 0; s.res.skrap = 0;
      let breaches = 0;
      for (let i = 0; i < 150; i++) {
        s.day = 40; s.over = null; s.moral = 80;
        for (const c of s.crew) c.task = { type: 'hvile' };
        s.crew[1].task = type === 'befeste' ? { type, target: 'nord' } : { type, target: 'nordkrysset' };
        s.gates.nord.level = 2; s.gates.nord.work = 0;
        resolveDay(s);
        expect(s.gates.nord.level).toBe(2);
        if (s.sectors.nordkrysset.z > 0) { breaches++; s.sectors.nordkrysset.z = 0; }
      }
      return breaches;
    };
    const guarded = run('befeste');
    expect(run('rydde')).toBeGreaterThan(guarded);
    expect(run('sanke')).toBeGreaterThan(guarded);
  });

  it('vakt på sektor gir kontroll etter beste Nerver, uten forfall', () => {
    const s = fresh();
    sealed(s);
    for (const id of PLAYABLE) s.sectors[id].control = 20;
    s.sectors.obs.control = 20;
    GATE_IDS.forEach((g, i) => { s.crew[i + 1].task = { type: 'vakt', target: g }; });
    me(s).task = { type: 'vakt', target: 'obs' };
    const expected = 20 + 15 + (stat(me(s), 'nerver') / 10) * 3;
    resolveDay(s);
    expect(s.sectors.obs.control).toBeCloseTo(expected, 5);
  });

  it('vakt kan velges for porter og tomme sektorer, ikke infiserte', () => {
    const s = fresh();
    expect(taskOptions(s).some((o) => o.type === 'vakt' && o.target === 'hjem')).toBe(false);
    expect(taskOptions(s).some((o) => o.type === 'vakt' && o.target === 'nord')).toBe(false);
    s.sectors.hjem.z = 0;
    expect(taskOptions(s).some((o) => o.type === 'vakt' && o.target === 'hjem')).toBe(true);
    s.sectors.nordkrysset.z = 0;
    expect(taskOptions(s).some((o) => o.type === 'vakt' && o.target === 'nord')).toBe(true);
  });
});

describe('Speide', () => {
  it('speide avslører trusselnivå', () => {
    const s = fresh();
    expect(sectorIntel(s, 'skolen').threat).toBeNull();
    me(s).task = { type: 'speide', target: 'skolen' };
    resolveDay(s);
    expect(sectorIntel(s, 'skolen').threat).toBeTypeOf('number');
    expect(s.sectors.skolen.seen).toBe(true);
  });

  it('kan bare velges for sektorer som ikke er speidet', () => {
    const s = fresh();
    expect(taskOptions(s).some((o) => o.type === 'speide' && o.target === 'hjem')).toBe(false);
    expect(taskOptions(s).some((o) => o.type === 'speide' && o.target === 'skolen')).toBe(true);
    s.sectors.skolen.scouted = true;
    expect(taskOptions(s).some((o) => o.type === 'speide' && o.target === 'skolen')).toBe(false);
  });

  it('gir rykter om sektorer med unikt kort', () => {
    const s = fresh();
    const withUnique = Object.keys(s.uniques)[0] as SectorId;
    const without = PLAYABLE.find((id) => !s.uniques[id] && !s.sectors[id].scouted)!;
    me(s).task = { type: 'speide', target: withUnique };
    s.sectors[withUnique].scouted = false;
    s.crew[1].task = { type: 'speide', target: without };
    const lines = resolveDay(s).map((l) => l.t).join('\n');
    expect(lines).toContain('Rykter om noe spesielt');
    expect(lines.match(/Rykter om noe spesielt/g)).toHaveLength(1);
  });
});

describe('Trene', () => {
  it('trene øker valgt ferdighet og ikke de andre', () => {
    const s = fresh();
    const c = me(s), before = { ...c.stats };
    c.task = { type: 'trene', stat: 'prat' };
    resolveDay(s);
    expect(c.stats.prat).toBeGreaterThan(before.prat + 3);
    expect(c.stats.muskler).toBe(before.muskler);
  });

  it('trene med ulik ferdighet er ikke samme ordre', () => {
    expect(sameTask({ type: 'trene', stat: 'prat' }, { type: 'trene', stat: 'mekk' })).toBe(false);
    expect(sameTask({ type: 'trene', stat: 'prat' }, { type: 'trene', stat: 'prat' })).toBe(true);
    expect(taskKey({ type: 'trene', stat: 'prat' })).not.toBe(taskKey({ type: 'trene', stat: 'mekk' }));
    const keys = taskOptions(fresh()).filter((o) => o.type === 'trene').map(taskKey);
    expect(new Set(keys).size).toBe(6);
  });

  it('en trene-ordre overlever validering', () => {
    const s = fresh();
    me(s).task = { type: 'trene', stat: 'mekk' };
    resolveDay(s);
    expect(me(s).task).toEqual({ type: 'trene', stat: 'mekk' });
  });
});

describe('Pleie', () => {
  it('pleie heler uten medisin', () => {
    const s = fresh();
    s.res.medisin = 5;
    const [a, b, c] = [s.crew[1], s.crew[2], s.crew[3]];
    a.hp = 1; b.hp = 2;
    c.task = { type: 'pleie' };
    resolveDay(s);
    expect(a.hp).toBe(2);
    expect(b.hp).toBe(3);
    expect(s.res.medisin).toBe(5);
  });

  it('uten pleier bruker hvile fortsatt medisin', () => {
    const s = fresh();
    s.res.medisin = 5;
    s.crew[1].hp = 1;
    resolveDay(s);
    expect(s.res.medisin).toBeLessThan(5);
  });

  it('nattevakt kan pleie seg selv', () => {
    const s = fresh();
    const mona = s.crew.find((c) => c.id === 'mona')!;
    mona.hp = 1; mona.task = { type: 'pleie' };
    resolveDay(s);
    expect(mona.hp).toBe(2);
    const s2 = fresh();
    const arild = s2.crew.find((c) => c.id === 'arild')!;
    arild.hp = 1; arild.task = { type: 'pleie' };
    resolveDay(s2);
    expect(arild.hp).toBe(1);
  });
});

describe('Lete etter overlevende', () => {
  const fill = (s: GameState) => {
    for (const n of NEIGHBORS) if (s.crew.length < housing(s) && !s.crew.some((c) => c.id === n.id)) addNeighbor(s, n.id);
  };

  it('overlevende overstiger aldri kapasiteten', () => {
    const s = fresh();
    fill(s);
    expect(s.crew.length).toBe(housing(s));
    const warn: string[] = [];
    for (let i = 0; i < 200; i++) {
      s.over = null; s.moral = 80;
      for (const id of PLAYABLE) s.sectors[id].z = id === 'skolen' || id === 'buoy_nord' ? 0 : s.sectors[id].z;
      for (const c of s.crew) c.hp = 3;
      if (s.crew.length > 0) s.crew[0].task = { type: 'overlevende', target: 'buoy_nord' };
      warn.push(...resolveDay(s).map((l) => l.t));
      expect(s.crew.length).toBeLessThanOrEqual(housing(s));
    }
    expect(warn.some((t) => t.includes('Vi har ikke senger til flere'))).toBe(true);
  });

  it('legger til en nabo når det er plass', () => {
    const s = fresh();
    s.sectors.buoy_nord.z = 0;
    me(s).stats.prat = 100;
    let got = false;
    for (let i = 0; i < 100 && !got; i++) {
      s.over = null; s.sectors.buoy_nord.z = 0;
      const n = s.crew.length;
      s.crew[0].task = { type: 'overlevende', target: 'buoy_nord' };
      resolveDay(s);
      got = s.crew.length > n;
      expect(canRecruit(s) || s.crew.length <= housing(s)).toBe(true);
    }
    expect(got).toBe(true);
  });

  it('kan bare velges i tomme boliger og offentlige bygg', () => {
    const s = fresh();
    for (const id of PLAYABLE) s.sectors[id].z = 0;
    const ids = taskOptions(s).filter((o) => o.type === 'overlevende').map((o) => (o as { target: SectorId }).target).sort();
    expect(ids).toEqual(['buoy_nord', 'skolen']);
    s.sectors.skolen.z = 2;
    expect(taskOptions(s).some((o) => o.type === 'overlevende' && o.target === 'skolen')).toBe(false);
  });
});

describe('Ny leder', () => {
  it('når lederen dør settes needLeader, og canEndDay er usann til setLeader', () => {
    const s = fresh();
    const c = me(s);
    c.hp = 1;
    expect(canEndDay(s)).toBe(true);
    const stashBefore = s.stash.length;
    injure(s, c, 'på Bybrua', nobody);
    expect(s.crew.some((x) => x.id === 'meg')).toBe(false);
    expect(s.stash.length).toBeGreaterThan(stashBefore);
    expect(s.needLeader).toBe(true);
    expect(canEndDay(s)).toBe(false);
    expect(setLeader(s, 'ukjent')).toBe(false);
    expect(canEndDay(s)).toBe(false);
    expect(setLeader(s, 'mona')).toBe(true);
    expect(s.crew.filter((x) => x.me).map((x) => x.id)).toEqual(['mona']);
    expect(s.needLeader).toBe(false);
    expect(canEndDay(s)).toBe(true);
  });

  it('setLeader gjør ingenting uten at lederen mangler', () => {
    const s = fresh();
    expect(setLeader(s, 'mona')).toBe(false);
    expect(me(s).id).toBe('meg');
  });

  it('hele crewet dør: ingen leder å velge, spillet slutter', () => {
    const s = fresh();
    s.crew = [me(s)];
    me(s).hp = 1;
    injure(s, me(s), 'på kaia', nobody);
    expect(s.needLeader).toBe(false);
    expect(canEndDay(s)).toBe(true);
  });

  it('lederen dør og resten av crewet dør samme dag: spillet slutter rent', () => {
    const s = fresh();
    const l = me(s);
    l.hp = 1; l.task = { type: 'rydde', target: 'hjem' };
    injure(s, l, 'i hjemmet', nobody);
    expect(s.needLeader).toBe(true);
    for (const c of [...s.crew]) { c.hp = 1; injure(s, c, 'samme natt', nobody); }
    expect(s.crew).toHaveLength(0);
    expect(s.needLeader).toBe(false);
    expect(canEndDay(s)).toBe(true);
    checkEnd(s);
    expect(s.over).toBe('dead');
    expect(s.needLeader).toBe(false);
  });

  it('en annen som dør setter ikke needLeader', () => {
    const s = fresh();
    const mona = s.crew.find((c) => c.id === 'mona')!;
    mona.hp = 1;
    injure(s, mona, 'på kaia', nobody);
    expect(s.needLeader).toBe(false);
  });
});

describe('Erfaring', () => {
  const gain = (task: GameState['crew'][number]['task'], setup: (s: GameState) => void = () => {}) => {
    const s = fresh();
    setup(s);
    const c = s.crew[1], before = { ...c.stats };
    c.task = task;
    resolveDay(s);
    const out: Record<string, number> = {};
    for (const k of Object.keys(before) as (keyof typeof before)[]) out[k] = c.stats[k] - before[k];
    return out;
  };
  const calm = (id: SectorId) => (s: GameState) => { Object.assign(s.sectors[id], { z: 0, hidden: 0 }); };

  it('erfaring øker med oppgaven', () => {
    const ry = gain({ type: 'rydde', target: 'hjem' });
    expect(ry.muskler).toBeGreaterThan(ry.nerver);
    expect(ry.nerver).toBeGreaterThan(0);
    expect(gain({ type: 'sanke', target: 'hjem' }, calm('hjem')).snoking).toBeGreaterThan(0);
    expect(gain({ type: 'speide', target: 'skolen' }).snoking).toBeGreaterThan(gain({ type: 'sanke', target: 'hjem' }, calm('hjem')).snoking);
    expect(gain({ type: 'vakt', target: 'ros' }, (s) => { s.sectors.hjem.z = 0; }).nerver).toBeGreaterThan(0);
    expect(gain({ type: 'pleie' }).prat).toBeGreaterThan(0);
    expect(gain({ type: 'overlevende', target: 'skolen' }, calm('skolen')).prat).toBeGreaterThan(gain({ type: 'pleie' }).prat);
    expect(gain({ type: 'befeste', target: 'ros' }, (s) => { s.sectors.hjem.z = 0; s.res.tre = 20; }).mekk).toBeGreaterThan(0);
    expect(gain({ type: 'lage' }, (s) => { s.res.skrap = 20; s.res.tre = 20; }).mekk).toBeGreaterThan(0);
  });

  it('hvile gir ingen erfaring', () => {
    const g = gain({ type: 'hvile' });
    expect(Object.values(g).every((v) => v === 0)).toBe(true);
  });
});

describe('Regnearket', () => {
  it('viser eksakt antall gjemte zombier bare når noen har egenskapen', () => {
    const s = fresh();
    expect(sectorIntel(s, 'obs').hidden).toBeNull();
    addNeighbor(s, 'ingrid');
    expect(sectorIntel(s, 'obs').hidden).toBe(s.sectors.obs.hidden);
    s.sectors.obs.hidden = 7;
    expect(sectorIntel(s, 'obs').hidden).toBe(7);
  });
});

describe('Statistikk for balansen', () => {
  it('starvedDays øker bare de dagene mat eller vann ikke rekker', () => {
    const s = fresh();
    s.res.mat = 100; s.res.vann = 100;
    resolveDay(s);
    expect(s.stats.starvedDays).toBe(0);
    s.res.mat = 0;
    resolveDay(s);
    expect(s.stats.starvedDays).toBe(1);
  });

  it('deaths teller etter hvor personen var', () => {
    const s = fresh();
    const [a, b, c] = s.crew.filter((x) => !x.me);
    a.task = { type: 'rydde', target: 'obs' };
    b.task = { type: 'vakt', target: 'nord' };
    c.task = { type: 'tokt', target: TOKTS[0].id };
    for (const x of [a, b, c]) { x.hp = 1; injure(s, x, 'i testen', nobody); }
    expect(s.stats.deaths).toEqual({ kamp: 1, natt: 1, tokt: 1 });
    expect(s.stats.lost).toBe(3);
  });

  it('en oppgitt årsak overstyrer ordren', () => {
    const s = fresh();
    const c = s.crew[1];
    c.task = { type: 'hvile' }; c.hp = 1;
    injure(s, c, 'i et encounter', nobody, 'kamp');
    expect(s.stats.deaths.kamp).toBe(1);
  });
});
