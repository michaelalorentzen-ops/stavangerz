import { describe, expect, it } from 'vitest';
import { bestDays, emptyRecords, isUnlocked, parseRecords, parseSeed, recordKey, recordRun, seedCode } from '../src/ui/records';

describe('rekorder', () => {
  it('første seier er en rekord og låser opp Hard fra Normal', () => {
    const r = recordRun(emptyRecords(), { phase: 1, difficulty: 'normal', days: 31 });
    expect(r.newBest).toBe(true);
    expect(r.previous).toBeNull();
    expect(r.unlocked).toBe('hard');
    expect(bestDays(r.records, 1, 'normal')).toBe(31);
    expect(isUnlocked(r.records, 'hard')).toBe(true);
    expect(isUnlocked(r.records, 'brutal')).toBe(false);
  });

  it('bare færre dager er ny rekord, og inndata endres ikke', () => {
    const a = recordRun(emptyRecords(), { phase: 1, difficulty: 'normal', days: 30 }).records;
    const snapshot = JSON.stringify(a);
    expect(recordRun(a, { phase: 1, difficulty: 'normal', days: 30 }).newBest).toBe(false);
    expect(recordRun(a, { phase: 1, difficulty: 'normal', days: 35 }).records.best['f1:normal']).toBe(30);
    const better = recordRun(a, { phase: 1, difficulty: 'normal', days: 26 });
    expect(better.newBest).toBe(true);
    expect(better.previous).toBe(30);
    expect(better.unlocked).toBeNull(); // Hard var allerede åpen
    expect(JSON.stringify(a)).toBe(snapshot);
  });

  it('Hard vunnet låser opp Brutal, Brutal låser ikke opp noe, fase 2 låser ikke opp', () => {
    expect(recordRun(emptyRecords(), { phase: 1, difficulty: 'hard', days: 40 }).unlocked).toBe('brutal');
    expect(recordRun(emptyRecords(), { phase: 1, difficulty: 'brutal', days: 40 }).unlocked).toBeNull();
    expect(recordRun(emptyRecords(), { phase: 2, difficulty: 'normal', days: 20 }).unlocked).toBeNull();
  });

  it('fase og grad har hver sin rekord, og crew-kombinasjonen er uavhengig av rekkefølge', () => {
    let r = recordRun(emptyRecords(), { phase: 1, difficulty: 'normal', days: 30, combo: ['mona', 'arild', 'toregil'] }).records;
    r = recordRun(r, { phase: 2, difficulty: 'normal', days: 18 }).records;
    expect(bestDays(r, 2, 'normal')).toBe(18);
    expect(bestDays(r, 1, 'hard')).toBeNull();
    expect(bestDays(r, 1, 'normal', ['toregil', 'arild', 'mona'])).toBe(30);
    const again = recordRun(r, { phase: 1, difficulty: 'normal', days: 33, combo: ['arild', 'mona', 'kjell'] });
    expect(again.newBest).toBe(false);
    expect(again.newComboBest).toBe(true); // ny kombinasjon, første gang
    expect(recordKey(1, 'normal', ['b', 'a'])).toBe('f1:normal:a+b');
  });

  it('ødelagt lagring gir tom liste', () => {
    for (const t of [null, '', 'xx', '{"v":2}', '{"v":1,"best":1,"unlocked":[]}']) expect(parseRecords(t)).toEqual(emptyRecords());
    const ok = parseRecords('{"v":1,"best":{"f1:normal":30,"f1:hard":"x","f2:normal":-1},"unlocked":["hard","normal","x"]}');
    expect(ok.best).toEqual({ 'f1:normal': 30 });
    expect(ok.unlocked).toEqual(['hard']);
  });

  it('seed-koden kan leses tilbake', () => {
    for (const s of [0, 1234, -5, 2147483647, -2147483648]) expect(parseSeed(seedCode(s))).toBe(s | 0);
    expect(parseSeed('æøå')).toBeNull();
    expect(parseSeed('')).toBeNull();
  });
});
