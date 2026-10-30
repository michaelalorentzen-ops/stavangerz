import { describe, expect, it } from 'vitest';
import { canRecruit, GATE_IDS, housing, isSafe, newGame, PHASES, resolveDay as resolveDayAndDrawEvent, sectorIntel, SECTORS, sum, raiseSearched, taskOptions } from '../src/engine';
import type { GameState, SectorId, SectorState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
/** Dagsoppgjøret uten dagens hendelse: testene her gjelder dagen, ikke hendelseskortene. */
const resolveDay = (s: GameState) => { const L = resolveDayAndDrawEvent(s); s.event = null; return L; };
const lootLeft = (sec: SectorState) => sum(Object.values(sec.loot));
const base = (): SectorState => ({ ...fresh().sectors.hjem, z: 0, hidden: 0, searched: 100, control: 50 });
/** Gjør en sektor tom og rolig, og sender hele crewet på samme oppdrag. */
const calm = (s: GameState, id: SectorId, patch: Partial<SectorState> = {}) => {
  Object.assign(s.sectors[id], { z: 0, hidden: 0 }, patch);
};
const assign = (s: GameState, type: 'rydde' | 'sanke', target: SectorId) => { for (const c of s.crew) c.task = { type, target }; };

describe('isSafe', () => {
  it('krever alle fire betingelsene', () => {
    expect(isSafe(base())).toBe(true);
    expect(isSafe({ ...base(), z: 1 })).toBe(false);
    expect(isSafe({ ...base(), hidden: 1 })).toBe(false);
    expect(isSafe({ ...base(), searched: 99 })).toBe(false);
    expect(isSafe({ ...base(), control: 49 })).toBe(false);
  });
});

describe('sektordata', () => {
  it('har type, trussel, kapasitet og utbytte', () => {
    expect(SECTORS.hjem).toMatchObject({ kind: 'hjem', threat: 1, capacity: 6, yield: { vann: 2 } });
    expect(SECTORS.tommerodden).toMatchObject({ kind: 'kai', threat: 2, capacity: 2, yield: { mat: 6 } });
    expect(SECTORS.skolen).toMatchObject({ kind: 'offentlig', capacity: 8, yield: { mat: 1, medisin: 0.5 } });
  });

  it('starter med hjem som bosatt og speidet, resten ubrukt', () => {
    const s = fresh();
    expect(s.sectors.hjem).toMatchObject({ control: 60, settled: true, searched: 0, scouted: true });
    expect(s.sectors.skolen).toMatchObject({ control: 0, settled: false, searched: 0, scouted: false });
  });

  it('gir 30 % mer mat i sektorbyttet, ganget med fasens lootMult', () => {
    expect(fresh().sectors.buoy_nord.loot.mat).toBe(Math.round(SECTORS.buoy_nord.loot.mat * 1.3 * PHASES[1].mods.lootMult));
  });
});

describe('rydde', () => {
  it('øker searched og tømmer lager proporsjonalt på en tom sektor', () => {
    const s = fresh();
    calm(s, 'buoy_nord');
    const start = lootLeft(s.sectors.buoy_nord);
    let prev = start;
    for (let day = 0; day < 20 && s.sectors.buoy_nord.searched < 100; day++) {
      assign(s, 'rydde', 'buoy_nord');
      const before = s.sectors.buoy_nord.searched;
      s.pending = []; // encounters testes for seg
      resolveDay(s);
      calm(s, 'buoy_nord', { searched: s.sectors.buoy_nord.searched }); // natta skal ikke spille inn
      expect(s.sectors.buoy_nord.searched).toBeGreaterThan(before);
      expect(lootLeft(s.sectors.buoy_nord)).toBeLessThanOrEqual(prev);
      prev = lootLeft(s.sectors.buoy_nord);
    }
    expect(s.sectors.buoy_nord.searched).toBe(100);
    expect(lootLeft(s.sectors.buoy_nord)).toBe(0);
  });

  it('searched 100 fjerner alle skjulte', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      calm(s, 'obs', { hidden: 3, searched: 95, control: 60 });
      assign(s, 'rydde', 'obs');
      resolveDay(s);
      expect(s.sectors.obs.searched).toBe(100);
      expect(s.sectors.obs.hidden).toBe(0);
    }
  });

  it('kjellerutbrudd skjer ikke når searched er 100', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = fresh(seed);
      calm(s, 'skolen', { searched: 100, hidden: 2, control: 80 });
      resolveDay(s);
      expect(s.sectors.skolen.z).toBe(0);
    }
  });

  it('utløser sektorens funn når searched krysser 50, bare én gang', () => {
    const s = fresh();
    calm(s, 'hjem', { searched: 45, control: 60 });
    const mat = s.res.mat;
    assign(s, 'rydde', 'hjem');
    resolveDay(s);
    expect(s.sectors.hjem.specialFound).toBe(true);
    expect(s.res.mat).toBeGreaterThanOrEqual(mat + 6 - 4); // elgkjøttdeig, minus dagens forbruk
  });

  it('mot zombier øker searched bare litt', () => {
    const s = fresh();
    s.sectors.obs.z = 200;
    assign(s, 'rydde', 'obs');
    resolveDay(s);
    expect(s.sectors.obs.searched).toBeGreaterThan(0);
    expect(s.sectors.obs.searched).toBeLessThanOrEqual(0.3 * 45 + 1e-9);
  });

  it('kamp gir aldri 100 % gjennomsøkt mens det er skjulte zombier igjen', () => {
    const s = fresh();
    Object.assign(s.sectors.obs, { z: 200, hidden: 2, searched: 98, control: 80 });
    assign(s, 'rydde', 'obs');
    resolveDay(s);
    expect(s.sectors.obs.searched).toBe(99);
    // når sektoren er tom, kan Rydde fortsatt velges og tar de siste kjellerne
    Object.assign(s.sectors.obs, { z: 0, hidden: 2 });
    expect(taskOptions(s).some((o) => o.type === 'rydde' && o.target === 'obs')).toBe(true);
  });

  it('raiseSearched stopper på 99 med skjulte igjen, og når 100 uten', () => {
    const sec = { ...base(), searched: 95, hidden: 1 };
    raiseSearched(sec, 10);
    expect(sec.searched).toBe(99);
    sec.hidden = 0;
    raiseSearched(sec, 10);
    expect(sec.searched).toBe(100);
  });
});

describe('kontroll og forfall', () => {
  it('kontroll forfaller uten folk', () => {
    const s = fresh();
    calm(s, 'skolen', { control: 40, searched: 100 });
    const before = s.sectors.skolen.control;
    resolveDay(s);
    expect(s.sectors.skolen.control).toBe(before - PHASES[1].mods.controlDecay);
  });

  it('bosatt sektor faller ikke under 50', () => {
    const s = fresh();
    calm(s, 'skolen', { control: 52, settled: true });
    resolveDay(s);
    expect(s.sectors.skolen.control).toBe(50);
    resolveDay(s);
    expect(s.sectors.skolen.control).toBe(50);
  });

  it('ingen forfall når alle porter er nivå 3', () => {
    const s = fresh();
    for (const g of GATE_IDS) s.gates[g].level = 3;
    calm(s, 'skolen', { control: 40, searched: 100 });
    resolveDay(s);
    expect(s.sectors.skolen.control).toBe(40);
  });

  it('rydde og sanke gir hver +10 kontroll', () => {
    const s = fresh();
    calm(s, 'buoy_nord', { control: 10 });
    assign(s, 'sanke', 'buoy_nord');
    resolveDay(s);
    expect(s.sectors.buoy_nord.control).toBe(20);
  });

  it('forfall kan infisere en ryddet sektor igjen', () => {
    let infected = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const s = fresh(seed);
      calm(s, 'skolen', { control: 0, searched: 100 });
      for (let d = 0; d < 10; d++) { resolveDay(s); s.sectors.skolen.control = 0; if (s.sectors.skolen.z > 0) break; }
      if (s.sectors.skolen.z > 0) infected++;
    }
    expect(infected).toBeGreaterThanOrEqual(1);
  });

  it('forfall senker searched når kontrollen er under 30', () => {
    const s = fresh();
    calm(s, 'skolen', { control: 5, searched: 80 });
    resolveDay(s);
    expect(s.sectors.skolen.searched).toBe(78);
  });
});

describe('sanke', () => {
  it('gir sektorens ressurs', () => {
    const s = fresh();
    calm(s, 'tommerodden');
    const mat = s.res.mat;
    assign(s, 'sanke', 'tommerodden');
    resolveDay(s);
    const eaten = Math.max(1, Math.ceil(s.crew.length * 0.6));
    expect(s.res.mat + eaten).toBeGreaterThan(mat);
  });

  it('er ikke et alternativ mens sektoren er infisert', () => {
    const s = fresh();
    s.sectors.tommerodden.z = 5;
    s.crew[0].task = { type: 'sanke', target: 'tommerodden' };
    resolveDay(s);
    expect(s.crew.find((c) => c.me)?.task.type).not.toBe('sanke');
  });
});

describe('kapasitet', () => {
  it('housing er 6 ved start, og canRecruit er usann når crewet er fullt', () => {
    const s = fresh();
    expect(housing(s)).toBe(6);
    expect(canRecruit(s)).toBe(true);
    while (s.crew.length < 6) s.crew.push({ ...s.crew[1], id: `x${s.crew.length}` });
    expect(canRecruit(s)).toBe(false);
  });

  it('bosetting skjer første gang en sektor med kapasitet blir trygg', () => {
    const s = fresh();
    calm(s, 'skolen', { searched: 100, control: 80 });
    resolveDay(s);
    expect(s.sectors.skolen.settled).toBe(true);
    expect(housing(s)).toBe(6 + 8);
  });

  it('en sektor uten kapasitet blir aldri bosatt', () => {
    const s = fresh();
    calm(s, 'obs', { searched: 100, control: 80 });
    resolveDay(s);
    expect(s.sectors.obs.settled).toBe(false);
  });
});

describe('sektorinnsikt', () => {
  it('skjuler trusselen til sektoren er speidet', () => {
    const s = fresh();
    expect(sectorIntel(s, 'skolen').threat).toBeNull();
    expect(sectorIntel(s, 'hjem').threat).toBe(1);
  });

  it('melder trygg bare når isSafe er sann', () => {
    const s = fresh();
    expect(sectorIntel(s, 'skolen').safe).toBe(false);
    calm(s, 'skolen', { searched: 100, control: 80 });
    expect(sectorIntel(s, 'skolen').safe).toBe(true);
  });
});

describe('mat som råtner', () => {
  it('mat i sektorlagre råtner hver 10. dag', () => {
    const s = fresh();
    const before = s.sectors.buoy_nord.loot.mat;
    for (let i = 0; i < 10; i++) resolveDay(s);
    expect(s.day).toBe(11);
    expect(s.sectors.buoy_nord.loot.mat).toBe(Math.floor(before * 0.85));
  });
});
