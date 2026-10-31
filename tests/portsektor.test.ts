// Crew som er ute i portens sektor om natta, tar imot det som kommer gjennom porten (SECTOR_GUARD).
import { describe, expect, it } from 'vitest';
import { GATES, newGame, resolveDay, SECTOR_GUARD } from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const NB = ['arild', 'mona', 'toregil'];
const SEC = GATES.sor.sector;

/** Én natt sent i fasen, med alle andre porter på nivå 3 og vakt, så bare Bybrusperringen slipper noe inn. */
function night(seed: number, inSector: boolean): GameState {
  const s = newGame(seed, BOT_SELF, NB);
  s.day = 40;
  for (const id of Object.keys(s.sectors) as (keyof typeof s.sectors)[]) Object.assign(s.sectors[id], { z: 0, hidden: 0, searched: 100, control: 100 });
  for (const c of s.crew) { c.hp = 3; c.task = inSector ? { type: 'rydde', target: SEC } : { type: 'hvile' }; }
  s.res.mat = 50; s.res.vann = 50;
  s.event = null; s.pending = [];
  resolveDay(s);
  return s;
}

describe('portens sektor om natta', () => {
  it('crew i sektoren holder igjen noe av det som kommer gjennom porten', () => {
    expect(SECTOR_GUARD).toBe(0.5);
    let away = 0, there = 0;
    for (let seed = 1; seed <= 60; seed++) {
      away += night(seed, false).sectors[SEC].z;
      there += night(seed, true).sectors[SEC].z;
    }
    expect(away).toBeGreaterThan(0);
    expect(there).toBeLessThan(away);
  });
});
