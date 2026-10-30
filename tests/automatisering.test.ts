import { describe, expect, it } from 'vitest';
import {
  applyPlan, deletePlan, MAX_PLANS, migrate, newGame, nextTask, repeatYesterday, resolveDay as resolveDayAndDrawEvent, savePlan, taskOptions, validateTasks,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
const resolveDay = (s: GameState) => { const L = resolveDayAndDrawEvent(s); s.event = null; return L; };

describe('neste naturlige oppgave', () => {
  it('speide ferdig med zombier igjen går til rydde', () => {
    const s = fresh();
    s.sectors.obs.z = 5;
    s.sectors.obs.scouted = true;
    expect(nextTask(s, { type: 'speide', target: 'obs' }, taskOptions(s))).toEqual({ type: 'rydde', target: 'obs' });
  });
  it('speide eller rydde ferdig uten zombier går til sanke (eller vakt)', () => {
    const s = fresh();
    Object.assign(s.sectors.obs, { z: 0, hidden: 0, searched: 100, scouted: true });
    const opts = taskOptions(s);
    const want = opts.some((o) => o.type === 'sanke' && o.target === 'obs') ? { type: 'sanke', target: 'obs' } : { type: 'vakt', target: 'obs' };
    expect(nextTask(s, { type: 'speide', target: 'obs' }, opts)).toEqual(want);
    expect(nextTask(s, { type: 'rydde', target: 'obs' }, opts)).toEqual(want);
  });
  it('andre oppgaver har ingen neste, og ugyldige velges ikke', () => {
    const s = fresh();
    expect(nextTask(s, { type: 'hvile' }, taskOptions(s))).toBeNull();
    expect(nextTask(s, { type: 'rydde', target: 'obs' }, [])).toBeNull();
  });
  it('dagsslutt: ferdig speiding gir en ny oppgave i samme sektor, deterministisk', () => {
    const run = () => {
      const s = fresh();
      s.crew[0].task = { type: 'speide', target: 'obs' };
      const lines = resolveDay(s).map((l) => l.t);
      return { task: s.crew[0].task, lines };
    };
    const a = run(), b = run();
    expect(a).toEqual(b);
    expect(a.task).toMatchObject({ target: 'obs' });
    expect(a.task.type).not.toBe('hvile');
    expect(a.lines.some((t) => t.includes('fortsetter med å'))).toBe(true);
  });
  it('utenom dagsslutt hviler de fortsatt med den gamle meldingen', () => {
    const s = fresh();
    s.sectors.obs.scouted = true;
    s.crew[0].task = { type: 'speide', target: 'obs' };
    expect(validateTasks(s)[0]).toContain('Hviler i stedet');
    expect(s.crew[0].task.type).toBe('hvile');
  });
});

describe('planer og «Som i går»', () => {
  it('lagrer, bruker og sletter en plan', () => {
    const s = fresh();
    s.crew[0].task = { type: 'trene', stat: 'muskler' };
    s.crew[1].task = { type: 'pleie' };
    expect(savePlan(s, '  Morgen  ')).toBe(true);
    expect(s.plans[0].name).toBe('Morgen');
    for (const c of s.crew) c.task = { type: 'hvile' };
    const r = applyPlan(s, 'Morgen');
    expect(r.set.length + r.skipped.length).toBe(s.crew.length);
    expect(s.crew[1].task.type).toBe('pleie');
    deletePlan(s, 'Morgen');
    expect(s.plans).toHaveLength(0);
  });
  it('ugyldige ordre i planen hoppes over', () => {
    const s = fresh();
    s.crew[0].task = { type: 'rydde', target: 'obs' };
    savePlan(s, 'Rydd');
    Object.assign(s.sectors.obs, { z: 0, searched: 100 });
    s.crew[0].task = { type: 'hvile' };
    const r = applyPlan(s, 'Rydd');
    expect(r.skipped).toEqual([s.crew[0].id]);
    expect(s.crew[0].task.type).toBe('hvile');
  });
  it('tomt navn avvises, antallet er begrenset og samme navn overskriver', () => {
    const s = fresh();
    expect(savePlan(s, '   ')).toBe(false);
    for (let i = 0; i < MAX_PLANS; i++) expect(savePlan(s, `P${i}`)).toBe(true);
    expect(savePlan(s, 'for mange')).toBe(false);
    expect(savePlan(s, 'P0')).toBe(true);
    expect(s.plans).toHaveLength(MAX_PLANS);
  });
  it('Som i går setter tilbake forrige dags oppdrag', () => {
    const s = fresh();
    s.crew[1].task = { type: 'pleie' };
    resolveDay(s);
    for (const c of s.crew) c.task = { type: 'hvile' };
    const r = repeatYesterday(s);
    expect(r.set.length + r.skipped.length).toBeGreaterThan(0);
    expect(s.crew[1].task.type).toBe('pleie');
  });
  it('migrate legger til feltene i gamle lagringer', () => {
    const s = fresh() as Partial<GameState>;
    delete s.plans; delete s.lastTasks;
    const m = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(m.plans).toEqual([]);
    expect(m.lastTasks).toEqual({});
  });
});
