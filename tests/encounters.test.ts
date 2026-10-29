import { describe, expect, it } from 'vitest';
import {
  canEndDay, CARDS, endDayBlocker, setLeader, checkEnd, describeEncounter, ENCOUNTERS, encounterOdds, housing, newCard, newGame, PHASES, RES, resolveDay, resolveEncounter,
} from '../src/engine';
import type { EncounterCtx, GameState, PendingEncounter, SectorId, WeaponTag } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
const valid = (s: GameState) => {
  for (const r of RES) expect(s.res[r]).toBeGreaterThanOrEqual(0);
  expect(s.moral).toBeGreaterThanOrEqual(0);
  expect(s.moral).toBeLessThanOrEqual(100);
  for (const c of s.crew) expect(c.hp).toBeGreaterThanOrEqual(1);
  expect(s.crew.length).toBeLessThanOrEqual(housing(s));
};
const pend = (s: GameState, def: string, crew = s.crew.map((c) => c.id), threat = 3): PendingEncounter => {
  const p: PendingEncounter = { pid: 'p1', def, sector: 'obs', crew, threat };
  s.pending.push(p);
  return p;
};
/** Setter alle i crewet til å rydde hver sin sektor med zombier. */
const spread = (s: GameState, ids: SectorId[]) => {
  s.crew.forEach((c, i) => { c.task = { type: 'rydde', target: ids[i % ids.length] }; });
  for (const id of ids) s.sectors[id].z = 3;
};
const FOUR: SectorId[] = ['hjem', 'tommerodden', 'obs', 'buoy_nord'];
const withChance = <T>(v: number, fn: () => T): T => {
  const old = PHASES[1].mods.encounterChance;
  PHASES[1].mods.encounterChance = v;
  try { return fn(); } finally { PHASES[1].mods.encounterChance = old; }
};

describe('encounters', () => {
  it('rydde kan gi ventende encounter, høyst to per dag', () => {
    let any = 0, most = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = fresh(seed);
      spread(s, FOUR);
      resolveDay(s);
      any += s.pending.length > 0 ? 1 : 0;
      most = Math.max(most, s.pending.length);
    }
    expect(any).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
    // med sikker sjanse for hver gruppe er taket nøyaktig to
    withChance(5, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const s = fresh(seed);
        spread(s, FOUR.slice(0, 3)); // tre Rydde-grupper
        resolveDay(s);
        expect(s.pending).toHaveLength(2);
      }
    });
  });

  it('canEndDay er usann med ventende encounter', () => {
    const s = fresh();
    expect(canEndDay(s)).toBe(true);
    pend(s, ENCOUNTERS[0].id);
    expect(canEndDay(s)).toBe(false);
    resolveEncounter(s, 'p1', ENCOUNTERS[0].choices.length - 1);
    expect(s.pending).toHaveLength(0);
    expect(canEndDay(s)).toBe(true);
  });

  it('har minst 6 kort, ett for hver ferdighet, og minst to med våpentagg', () => {
    expect(ENCOUNTERS.length).toBeGreaterThanOrEqual(6);
    for (const k of ['muskler', 'kondis', 'snoking', 'nerver', 'mekk', 'prat'] as const) {
      expect(ENCOUNTERS.some((d) => d.choices.some((c) => c.check === k)), k).toBe(true);
    }
    expect(ENCOUNTERS.filter((d) => d.choices.some((c) => c.tag)).length).toBeGreaterThanOrEqual(2);
    expect(new Set(ENCOUNTERS.map((d) => d.id)).size).toBe(ENCOUNTERS.length);
  });

  for (const def of ENCOUNTERS) {
    it(`«${def.title}» har nøyaktig ett tilbaketrekk som siste valg`, () => {
      expect(def.choices.filter((c) => c.retreat)).toHaveLength(1);
      expect(def.choices.at(-1)!.retreat).toBe(true);
    });

    it(`«${def.title}»: alle valg gir tekst og gyldig tilstand`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        for (let i = 0; i < def.choices.length; i++) {
          const s = fresh(seed);
          for (const c of s.crew) c.gear.vapen = newCard(s, 'hagle_politibil');
          const p = pend(s, def.id, undefined, 1 + (seed % 5));
          const ctx: EncounterCtx = { sector: p.sector, crew: s.crew, threat: p.threat };
          if (def.when && !def.when(s, ctx)) continue;
          expect(def.text(s, ctx).length).toBeGreaterThan(10);
          const r = resolveEncounter(s, 'p1', i);
          expect(r.text.length).toBeGreaterThan(5);
          expect(s.pending).toHaveLength(0);
          valid(s);
        }
      }
    });
  }

  it('crewet dør mens noe venter: over blir dead og pending tom', () => {
    const s = fresh();
    pend(s, ENCOUNTERS[0].id);
    s.crew = [];
    checkEnd(s);
    expect(s.over).toBe('dead');
    expect(s.pending).toEqual([]);
  });

  it('ventende encounter uten levende i gruppa fjernes, de andre blir', () => {
    const s = fresh();
    pend(s, ENCOUNTERS[0].id, ['arild']);
    s.pending.push({ pid: 'p2', def: ENCOUNTERS[1].id, sector: 'obs', crew: ['mona'], threat: 2 });
    s.crew = s.crew.filter((c) => c.id !== 'arild');
    checkEnd(s);
    expect(s.over).toBeNull();
    expect(s.pending.map((p) => p.pid)).toEqual(['p2']);
  });

  it('samme seed gir samme encounter', () => {
    const run = () => {
      const s = fresh(7);
      withChance(5, () => { spread(s, FOUR); resolveDay(s); });
      return JSON.stringify(s.pending);
    };
    expect(run()).toBe(run());
    expect(JSON.parse(run()).length).toBeGreaterThan(0);
  });

  it('tilbaketrekk gir ingen belønning og kan koste liv eller holdbarhet', () => {
    let hurt = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = fresh(seed);
      const res = JSON.stringify(s.res), hp = s.crew.reduce((n, c) => n + c.hp, 0);
      const dur = s.crew.reduce((n, c) => n + Object.values(c.gear).reduce((m, k) => m + k!.dur, 0), 0);
      pend(s, ENCOUNTERS[0].id);
      resolveEncounter(s, 'p1', ENCOUNTERS[0].choices.length - 1);
      expect(JSON.stringify(s.res)).toBe(res);
      const dur2 = s.crew.reduce((n, c) => n + Object.values(c.gear).reduce((m, k) => m + k!.dur, 0), 0);
      if (s.crew.reduce((n, c) => n + c.hp, 0) < hp || dur2 < dur) hurt++;
    }
    expect(hurt).toBeGreaterThan(0);
  });
});

describe('encounter som dreper lederen', () => {
  it('lar needLeader stå, sperrer dagen, og setLeader løser det', () => {
    const s = fresh();
    const me = s.crew.find((c) => c.me)!;
    me.hp = 1;
    pend(s, ENCOUNTERS[0].id, [me.id, 'arild']);
    expect(endDayBlocker(s)).toBe('pending');
    // tilbaketrekk skader en tilfeldig person; finn en seed der det rammer lederen
    let killed = false;
    for (let seed = 1; seed <= 200 && !killed; seed++) {
      const t = fresh(seed);
      const m = t.crew.find((c) => c.me)!;
      m.hp = 1;
      for (const c of t.crew) if (c !== m) c.hp = 3;
      pend(t, ENCOUNTERS[0].id, [m.id]);
      resolveEncounter(t, 'p1', ENCOUNTERS[0].choices.length - 1);
      if (t.crew.includes(m)) continue;
      killed = true;
      expect(t.crew.length).toBeGreaterThan(0);
      expect(t.needLeader).toBe(true);
      expect(canEndDay(t)).toBe(false);
      expect(endDayBlocker(t)).toBe('leader');
      expect(setLeader(t, t.crew[0].id)).toBe(true);
      expect(t.needLeader).toBe(false);
      expect(canEndDay(t)).toBe(true);
      expect(endDayBlocker(t)).toBeNull();
    }
    expect(killed).toBe(true);
  });

  it('endDayBlocker: ventende først, så leder, ingenting når over', () => {
    const s = fresh();
    expect(endDayBlocker(s)).toBeNull();
    s.needLeader = true;
    expect(endDayBlocker(s)).toBe('leader');
    pend(s, ENCOUNTERS[0].id);
    expect(endDayBlocker(s)).toBe('pending');
    s.over = 'dead';
    expect(endDayBlocker(s)).toBeNull();
  });
});

describe('våpenegenskaper', () => {
  it('alle våpen i katalogen har range og noise', () => {
    const weapons = Object.values(CARDS).filter((d) => d.slot === 'vapen');
    expect(weapons.length).toBeGreaterThan(0);
    for (const d of weapons) {
      expect(['naerkamp', 'avstand'], d.id).toContain(d.range);
      expect(['stille', 'normal', 'brak'], d.id).toContain(d.noise ?? 'normal');
    }
    expect(CARDS.hagle_politibil).toMatchObject({ range: 'avstand', noise: 'brak', tags: ['spredning'] });
    expect(CARDS.spikerpistol_obs).toMatchObject({ range: 'avstand', noise: 'normal' });
    expect(CARDS.k_ror).toMatchObject({ range: 'naerkamp', noise: 'normal' });
  });

  /** Skader i løpet av en dag for en alenegruppe, summert over seeds. */
  const injuries = (range: 'naerkamp' | 'avstand') => {
    const old = CARDS.k_ror.range;
    CARDS.k_ror.range = range;
    try {
      let n = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const s = fresh(seed);
        s.crew = [s.crew[0]];
        s.crew[0].task = { type: 'rydde', target: 'obs' };
        s.sectors.obs.z = 5;
        resolveDay(s);
        n += 3 - (s.crew[0]?.hp ?? 0);
      }
      return n;
    } finally { CARDS.k_ror.range = old; }
  };
  it('avstand gir lavere skaderisiko', () => {
    expect(injuries('avstand')).toBeLessThan(injuries('naerkamp'));
  });

  /** Antall seeds der en tom sektor ender med zombier etter at en gruppe har ryddet den. */
  const infected = (noise: 'stille' | 'normal' | 'brak') => {
    const old = CARDS.k_ror.noise;
    CARDS.k_ror.noise = noise;
    try {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const s = fresh(seed);
        s.crew = [s.crew[0]];
        s.crew[0].task = { type: 'rydde', target: 'sorspissen' };
        Object.assign(s.sectors.sorspissen, { z: 0, hidden: 0, control: 100 });
        resolveDay(s);
        if (s.sectors.sorspissen.z > 0) n++;
      }
      return n;
    } finally { CARDS.k_ror.noise = old; }
  };
  it('bråk kan trekke zombier', () => {
    expect(infected('brak')).toBeGreaterThan(infected('normal'));
    expect(infected('brak')).toBeGreaterThan(0);
  });

  it('stille gruppe får færre encounters enn bråk-gruppe over mange seeds', () => {
    const count = (noise: 'stille' | 'normal' | 'brak') => {
      const old = CARDS.k_ror.noise;
      CARDS.k_ror.noise = noise;
      try {
        let n = 0;
        for (let seed = 1; seed <= 600; seed++) {
          const s = fresh(seed);
          s.crew = [s.crew[0]];
          s.crew[0].task = { type: 'rydde', target: 'obs' };
          s.sectors.obs.z = 2;
          resolveDay(s);
          n += s.pending.length;
        }
        return n;
      } finally { CARDS.k_ror.noise = old; }
    };
    expect(count('stille')).toBeLessThan(count('brak'));
  });

  it('tag i encounter-valg øker odds', () => {
    const tags: Record<WeaponTag, string> = { spredning: 'hagle_politibil', gjennomslag: 'kjedesag', rekkevidde: 'armbrost' };
    let tested = 0;
    for (const def of ENCOUNTERS) {
      def.choices.forEach((ch, i) => {
        if (!ch.tag) return;
        const s = fresh();
        const me = s.crew[0];
        delete me.gear.vapen;
        const p = pend(s, def.id, [me.id]);
        const without = encounterOdds(s, p, i);
        me.gear.vapen = newCard(s, tags[ch.tag]);
        const withTag = encounterOdds(s, p, i);
        expect(withTag).toBeGreaterThan(without);
        expect(withTag).toBeLessThanOrEqual(0.95);
        const view = describeEncounter(s, p).choices[i];
        expect(view.tag).toBe(ch.tag);
        expect(view.tagBonus).toBe(true);
        tested++;
      });
    }
    expect(tested).toBeGreaterThanOrEqual(2);
  });

  it('spredning gir flere drap når sektoren har mange zombier', () => {
    const kills = (tags: WeaponTag[] | undefined) => {
      const old = CARDS.k_ror.tags;
      CARDS.k_ror.tags = tags;
      try {
        let n = 0;
        for (let seed = 1; seed <= 200; seed++) {
          const s = fresh(seed);
          s.crew = [s.crew[0]];
          s.crew[0].task = { type: 'rydde', target: 'obs' };
          s.sectors.obs.z = 12;
          resolveDay(s);
          n += s.stats.kills;
        }
        return n;
      } finally { CARDS.k_ror.tags = old; }
    };
    expect(kills(['spredning'])).toBeGreaterThan(kills(undefined));
  });
});
