import { describe, expect, it } from 'vitest';
import {
  craftShortfall, daysLeft, delta, eventChoices, eventDef, injure, LAGE_COST, nameList, newGame, plainText, recruitablesNow, resolveDay, resolveEvent, taskOptions, validateTasks,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 7) => newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
const kill = (s: GameState, id: string) => {
  const c = s.crew.find((x) => x.id === id)!;
  c.hp = 1;
  injure(s, c, 'i en test', () => {});
};

describe('navnelister', () => {
  it('komma mellom, og bare før siste', () => {
    expect(nameList([])).toBe('');
    expect(nameList(['Du'])).toBe('Du');
    expect(nameList(['Du', 'Mona'])).toBe('Du og Mona');
    expect(nameList(['Du', 'Mona', 'Tor-Egil'])).toBe('Du, Mona og Tor-Egil');
  });
});

describe('de døde kommer ikke tilbake', () => {
  it('den som dør, kan ikke rekrutteres igjen', () => {
    const s = fresh();
    kill(s, 'mona');
    expect(s.flags.gone_mona).toBe(true);
    expect(recruitablesNow(s).some((n) => n.id === 'mona')).toBe(false);
  });
  it('kommer ikke tilbake over mange dager med comeback og lete etter overlevende', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      kill(s, 'mona'); kill(s, 'kjell');
      for (let d = 0; d < 40 && !s.over; d++) {
        s.pending = []; s.tokts = []; s.event = null; s.needLeader = false;
        for (const c of s.crew) c.task = { type: 'overlevende', target: 'hjem' };
        resolveDay(s);
        expect(s.crew.some((c) => c.id === 'mona' || c.id === 'kjell')).toBe(false);
      }
    }
  });
});

describe('død skilles fra å dra', () => {
  it('delta teller døde som døde og frivillige avskjed som borte for godt', () => {
    const a = fresh();
    const died = structuredClone(a);
    kill(died, 'kjell');
    expect(delta(a, died).lost).toEqual(['Kjell']);
    expect(delta(a, died).gone).toEqual([]);
    const left = structuredClone(a);
    left.crew = left.crew.filter((c) => c.id !== 'kjell');
    left.flags.gone_kjell = true;
    expect(delta(a, left).lost).toEqual([]);
    expect(delta(a, left).gone).toEqual(['Kjell']);
  });
  it('mekanikk i parentes fjernes fra fortellingen, resten blir stående', () => {
    expect(plainText('Han går (Kjell er borte for godt, ingenting å miste, −6 moral).')).toBe('Han går.');
    expect(plainText('Dere tok støyten (hammer tilhørende Mona, −2 holdbarhet).')).toBe('Dere tok støyten (hammer tilhørende Mona).');
    expect(plainText('Det går (+4 zombier hjemme, −5 moral).')).toBe('Det går.');
  });
});

describe('hendelsens dag', () => {
  it('logges under dagen kortet vises med', () => {
    for (let seed = 1; seed < 100; seed++) {
      const s = fresh(seed);
      resolveDay(s);
      if (!s.event) continue;
      const day = s.day;
      resolveEvent(s, eventChoices(s, eventDef(s.event.id))[0].i);
      expect(s.log.at(-1)!.day).toBe(day);
      expect(s.log.filter((l) => l.day === day)).toHaveLength(1);
      return;
    }
    throw new Error('ingen hendelse');
  });
});

describe('småting fra nettlesertesten', () => {
  it('speiding som er gjort sies som ferdig, ikke som feil', () => {
    const s = fresh();
    s.crew[0].task = { type: 'speide', target: 'obs' };
    const lines = resolveDay(s).map((l) => l.t);
    expect(lines.some((t) => t.includes('Speidingen av') && t.includes('er gjort') && t.includes('hviler i morgen'))).toBe(true);
    expect(lines.some((t) => t.includes('fikk ikke'))).toBe(false);
  });
  it('validateTasks utenom dagsslutt beholder den gamle meldingen', () => {
    const s = fresh();
    s.sectors.obs.scouted = true;
    s.crew[0].task = { type: 'speide', target: 'obs' };
    expect(validateTasks(s)[0]).toContain('fikk ikke');
  });
  it('sanke tilbys bare der sektoren gir noe', () => {
    const s = fresh();
    for (const id of Object.keys(s.sectors) as (keyof GameState['sectors'])[]) s.sectors[id].z = 0;
    const sanke = taskOptions(s).filter((o) => o.type === 'sanke');
    expect(sanke.length).toBeGreaterThan(0);
  });
  it('mangel på materialer til å lage utstyr oppdages', () => {
    const s = fresh();
    s.res.skrap = LAGE_COST.skrap; s.res.tre = LAGE_COST.tre;
    s.crew[0].task = { type: 'lage' }; s.crew[1].task = { type: 'lage' };
    expect([...craftShortfall(s)]).toEqual([s.crew[1].id]);
  });
  it('dager igjen av mat og vann, og advarsel når det blir under tre', () => {
    const s = fresh();
    s.res.mat = 100; s.res.vann = 100;
    expect(daysLeft(s, 'mat')).toBeGreaterThan(10);
    s.res.mat = 10; s.res.vann = 100;
    const lines = resolveDay(s).map((l) => l.t);
    expect(lines.some((t) => t.startsWith('Maten holder bare'))).toBe(true);
  });
});
