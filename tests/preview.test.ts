import { describe, expect, it } from 'vitest';
import {
  encounterChance, mods, newGame, noiseProfile, previewTask, resolveDay, rydde, ryddeInjuryRisk, ryddeKillParams, sankeAmount, SECTORS, taskOptions, taskText, validateTasks,
} from '../src/engine';
import type { GameState, SectorId } from '../src/engine';
import { previewText, taskGroups } from '../src/ui/panel';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);

describe('previewTask', () => {
  it('endrer verken tilstand eller rng', () => {
    const s = fresh();
    s.sectors.obs.z = 6;
    const before = structuredClone(s);
    previewTask(s, { type: 'rydde', target: 'obs' }, s.crew);
    previewTask(s, { type: 'sanke', target: 'hjem' }, s.crew);
    expect(s).toEqual(before);
  });

  it('Rydde: drap, skaderisiko og knipe følger formlene i rydde og encounterChance', () => {
    const s = fresh(), id: SectorId = 'obs', M = mods(s);
    s.sectors[id].z = 6;
    const team = s.crew.slice(0, 2);
    const p = previewTask(s, { type: 'rydde', target: id }, team);
    if (p?.kind !== 'rydde') throw new Error('forventet Rydde-forhåndsvisning');
    const { power, mult } = ryddeKillParams(s, id, team, M);
    expect(p.kills).toBeCloseTo(Math.min(6, power * 0.475 * mult), 10);
    expect(p.risk.map((r) => r.risk)).toEqual(team.map((c) => ryddeInjuryRisk(c, 6, power, id, M)));
    expect(p.encounter).toBe(encounterChance(M, SECTORS[id].threat, noiseProfile(team), 6));
  });

  it('Rydde: forventet antall drap stemmer med gjennomsnittet av mange kjøringer', () => {
    const s = fresh(), id: SectorId = 'obs';
    s.sectors[id].z = 40; // høyt nok til at taket ikke griper inn
    const p = previewTask(s, { type: 'rydde', target: id }, s.crew);
    if (p?.kind !== 'rydde') throw new Error('forventet Rydde-forhåndsvisning');
    let kills = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const c = structuredClone(s);
      c.rng = i + 1;
      rydde(c, id, c.crew, mods(c), () => {});
      kills += 40 - c.sectors[id].z;
    }
    expect(Math.abs(kills / N - p.kills)).toBeLessThan(p.kills * 0.1);
  });

  it('Sanke: utbyttet følger sankeAmount', () => {
    const s = fresh();
    s.sectors.hjem.z = 0;
    const p = previewTask(s, { type: 'sanke', target: 'hjem' }, [s.crew[0]]);
    if (p?.kind !== 'sanke') throw new Error('forventet Sanke-forhåndsvisning');
    expect(p.yield.vann!).toBeGreaterThanOrEqual(sankeAmount(SECTORS.hjem.yield.vann!, 0, mods(s)));
  });

  it('gir null uten gruppe, og for oppdrag uten forhåndsvisning', () => {
    const s = fresh();
    expect(previewTask(s, { type: 'rydde', target: 'obs' }, [])).toBeNull();
    expect(previewTask(s, { type: 'hvile' }, s.crew)).toBeNull();
  });

  it('tekstlinjen er kort og viser drap, skaderisiko og knipe', () => {
    const s = fresh();
    s.sectors.obs.z = 6;
    const p = previewTask(s, { type: 'rydde', target: 'obs' }, s.crew)!;
    expect(previewText(p)).toMatch(/^~[\d,]+ av 6 drap · skaderisiko [\d–]+ % · knipe \d+ %$/);
  });
});

describe('oppdragsgrupper', () => {
  it('deler alle valg i grupper uten å miste eller duplisere noe', () => {
    const s = fresh();
    const opts = taskOptions(s), groups = taskGroups(opts);
    expect(groups.flatMap((g) => g.opts).length).toBe(opts.length);
    expect(groups[0].label).toBe('Hjemme');
    expect(groups.map((g) => g.label)).toContain('Rydde');
  });
});

describe('nullstilte ordre', () => {
  it('forteller hvem og hvorfor, som warn', () => {
    const s: GameState = fresh();
    s.crew[0].task = { type: 'sanke', target: 'skolen' }; // skolen er infisert
    const lines: { t: string; kind?: string }[] = [];
    const msgs = validateTasks(s, (t, kind) => lines.push({ t, kind }));
    expect(s.crew[0].task).toEqual({ type: 'hvile' });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain(s.crew[0].name);
    expect(msgs[0]).toContain(taskText({ type: 'sanke', target: 'skolen' }));
    expect(lines).toEqual([{ t: msgs[0], kind: 'warn' }]);
  });

  it('dagsloggen får meldingen når en ordre blir ugyldig', () => {
    const s = fresh();
    s.sectors.hjem.z = 2;
    s.crew[0].task = { type: 'sanke', target: 'hjem' };
    const lines = resolveDay(s);
    expect(lines.some((l) => l.kind === 'warn' && l.t.includes('Hviler i stedet') && l.t.includes(s.crew[0].name))).toBe(true);
  });
});
