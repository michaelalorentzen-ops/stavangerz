import { describe, expect, it } from 'vitest';
import {
  canEndDay, endDayBlocker, ENCOUNTERS, eventChoices, eventDef, INTRO, migrate, newGame, queueIntro, resolveDay, resolveEncounter, resolveEvent, setLeader,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const start = (seed: number) => newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
/** En runde der resolveDay() har trukket en hendelse. */
const withEvent = (seed0 = 1): GameState => {
  for (let seed = seed0; seed < seed0 + 200; seed++) {
    const s = start(seed);
    resolveDay(s);
    if (s.event) return s;
  }
  throw new Error('fant ingen hendelse');
};
const firstChoice = (s: GameState) => eventChoices(s, eventDef(s.event!.id))[0].i;
const plain = (label: string) => label.replace(/[.!?…]$/, '');

describe('hendelsen ligger i tilstanden', () => {
  it('resolveDay trekker dagens hendelse, merker den som sett og sperrer neste dag', () => {
    const s = withEvent();
    expect(s.seenEvents).toContain(s.event!.id);
    expect(canEndDay(s)).toBe(false);
    expect(endDayBlocker(s)).toBe('event');
    const day = s.day;
    expect(resolveDay(s)).toEqual([]);
    expect(s.day).toBe(day);
    resolveEvent(s, firstChoice(s));
    expect(s.event).toBeNull();
    expect(canEndDay(s)).toBe(true);
    expect(() => resolveEvent(s, 0)).toThrow();
  });

  it('hendelsen kommer foran encounters i endDayBlocker', () => {
    const s = withEvent();
    s.pending.push({ pid: 'p1', def: ENCOUNTERS[0].id, sector: 'obs', crew: ['meg'], threat: 2 });
    expect(endDayBlocker(s)).toBe('event');
    resolveEvent(s, firstChoice(s));
    expect(endDayBlocker(s)).toBe('pending');
  });

  it('ugyldige valg avvises, og hendelsen blir stående', () => {
    const s = withEvent();
    expect(() => resolveEvent(s, 99)).toThrow();
    expect(s.event).not.toBeNull();
  });

  it('overlever lagring som JSON og migrate, og gir samme utfall som uten omlasting', () => {
    const s = withEvent();
    const loaded = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(loaded.event).toEqual(s.event);
    expect(endDayBlocker(loaded)).toBe('event');
    const i = firstChoice(s);
    expect(resolveEvent(loaded, i)).toEqual(resolveEvent(s, i));
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s));
  });

  it('lagringer fra før hendelsen lå i tilstanden får ingen ventende hendelse', () => {
    const raw = JSON.parse(JSON.stringify(start(3)));
    delete raw.event;
    expect(migrate(raw)!.event).toBeNull();
  });

  it('utfallet står i loggen for dagen: tittel, valget og hva som endret seg', () => {
    const s = withEvent();
    const e = eventDef(s.event!.id), i = firstChoice(s), day = s.log.at(-1)!.day;
    const r = resolveEvent(s, i);
    const last = s.log.at(-1)!, line = last.lines.at(-1)!.t;
    expect(last.day).toBe(day);
    expect(line).toContain(e.title);
    expect(line).toContain(plain(e.choices[i].label));
    for (const c of r.changes) expect(line).toContain(c);
  });

  it('introen venter som hendelse og logges på dag 1 sammen med dagsoppgjøret', () => {
    const s = start(5);
    queueIntro(s);
    expect(endDayBlocker(s)).toBe('event');
    resolveEvent(s, 2);
    expect(s.log).toHaveLength(1);
    resolveDay(s);
    expect(s.log[0].day).toBe(1);
    expect(s.log.filter((d) => d.day === 1)).toHaveLength(1);
    expect(s.log[0].lines[0].t).toContain(INTRO.title);
  });

  it('encounter-utfall logges også', () => {
    const s = start(7);
    resolveDay(s);
    s.event = null;
    const def = ENCOUNTERS[0], i = def.choices.length - 1;
    s.pending.push({ pid: 'p1', def: def.id, sector: 'obs', crew: ['meg'], threat: 2 });
    resolveEncounter(s, 'p1', i);
    const line = s.log.at(-1)!.lines.at(-1)!.t;
    expect(line).toContain(def.title);
    expect(line).toContain(plain(def.choices[i].label));
  });

  it('samme seed og samme ordre gir samme runde, med hendelsene', () => {
    const play = () => {
      const s = start(11);
      for (let d = 0; d < 15 && !s.over; d++) {
        s.crew[0].task = { type: 'rydde', target: 'hjem' };
        resolveDay(s);
        if (s.event) resolveEvent(s, firstChoice(s));
        while (s.pending.length) resolveEncounter(s, s.pending[0].pid, 0);
        if (s.needLeader && s.crew.length) setLeader(s, s.crew[0].id);
      }
      return s;
    };
    const a = play(), b = play();
    expect(a.seenEvents.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
