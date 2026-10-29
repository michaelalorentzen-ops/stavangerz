import { describe, expect, it } from 'vitest';
import { newGame } from '../src/engine';
import { blockerLabel, infBar } from '../src/ui/panel';
import { BOT_SELF } from '../tools/bot';

const fresh = () => newGame(42, BOT_SELF, ['arild', 'mona', 'toregil']);

describe('panelet', () => {
  it('infeksjonsstolpen røper ikke det sanne tallet for usette sektorer', () => {
    expect(infBar({ z: 0, seen: false }, 10)).toBe(0);
    expect(infBar({ z: 3, seen: false }, 10)).toBeNull();
    expect(infBar({ z: 9, seen: false }, 10)).toBeNull();
    expect(infBar({ z: 5, seen: true }, 10)).toBe(50);
    expect(infBar({ z: 30, seen: true }, 10)).toBe(100);
  });

  it('Avslutt dag-knappen bruker samme ordlyd som dagsrapporten for det som venter', () => {
    const s = fresh();
    expect(blockerLabel(s)).toBeNull();
    s.needLeader = true;
    expect(blockerLabel(s)).toBe('Hvem tar over?');
    s.tokts.push({ id: 'bybrua', crew: ['meg'], stage: 1, haul: {}, cards: [], awaiting: true });
    expect(blockerLabel(s)).toBe('Toktet venter på deg');
    s.pending.push({ pid: 'p1', def: 'sprint', sector: 'obs', crew: ['arild'], threat: 2 });
    expect(blockerLabel(s)).toBe('Encounter venter');
    s.pending.push({ pid: 'p2', def: 'sprint', sector: 'obs', crew: ['mona'], threat: 2 });
    expect(blockerLabel(s)).toBe('2 encounters venter');
    s.over = 'dead';
    expect(blockerLabel(s)).toBeNull();
  });
});
