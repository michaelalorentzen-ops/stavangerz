import { describe, expect, it } from 'vitest';
import { gainXp, newGame, skillLevel, stat, toSkill } from '../src/engine';
import type { CrewMember } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const member = (trait: CrewMember['trait'] = 'lokalkjent'): CrewMember =>
  newGame(1, { ...BOT_SELF, trait }, []).crew[0];

describe('toSkill', () => {
  it('regner prikker om til 1–100', () => {
    expect(toSkill(1)).toBe(18);
    expect(toSkill(5)).toBe(58);
  });
});

describe('skillLevel', () => {
  it('har nivågrenser ved 25, 45 og 70', () => {
    expect(skillLevel(24)).toBe('Elendig');
    expect(skillLevel(25)).toBe('Grei');
    expect(skillLevel(45)).toBe('God');
    expect(skillLevel(70)).toBe('Rå');
  });
});

describe('gainXp', () => {
  it('øker verdien, men mindre jo høyere den er', () => {
    const lav = member(), høy = member();
    lav.stats.muskler = 20; høy.stats.muskler = 80;
    gainXp(lav, 'muskler', 5); gainXp(høy, 'muskler', 5);
    expect(lav.stats.muskler).toBeGreaterThan(20);
    expect(høy.stats.muskler).toBeGreaterThan(80);
    expect(lav.stats.muskler - 20).toBeGreaterThan(høy.stats.muskler - 80);
  });

  it('går aldri over 100', () => {
    const c = member();
    for (let i = 0; i < 2000; i++) gainXp(c, 'nerver', 5);
    expect(c.stats.nerver).toBeLessThanOrEqual(100);
  });
});

describe('stat', () => {
  it('gir filmnerd +10 Nerver', () => {
    const c = member('filmnerd');
    expect(stat(c, 'nerver')).toBe(c.stats.nerver + 10);
  });

  it('gir bussjåfør +10 Kondis bare på oppdrag', () => {
    const c = member('buss');
    expect(stat(c, 'kondis')).toBe(c.stats.kondis);
    c.task = { type: 'rydde', target: 'hjem' };
    expect(stat(c, 'kondis')).toBe(c.stats.kondis + 10);
  });
});
