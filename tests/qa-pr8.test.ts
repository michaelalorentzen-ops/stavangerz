// Rettelser etter QA av PR #8: rekorden, fremmede, langskudd, lappen, «Du» i tekstene og meldingen om nådd mål.
import { describe, expect, it } from 'vitest';
import {
  checkEnd, choiceBest, choiceOdds, daysToGoal, endPhase, eventDef, ENCOUNTERS, nameAs, names, newGame, PHASES, PLAYABLE, resolveDay, runChoice, wear, YOU,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { stranger, type StrangerStory } from '../src/regions/stavanger/content/survivors';
import { BOT_SELF } from '../tools/bot';

const STORIES: StrangerStory[] = ['tesla', 'seilbat', 'sjark', 'naust', 'snekke', 'rekvirert', 'turnus', 'finn'];
const clearAll = (s: GameState) => {
  for (const id of PLAYABLE) { const sec = s.sectors[id]; sec.z = 0; sec.hidden = 0; sec.searched = 100; sec.control = 100; }
  for (const g of Object.values(s.gates)) g.level = PHASES[1].goalGateLevel;
};

describe('rekorden teller dagene til målet', () => {
  it('også når nedtellingen spilles ut eller fasen avsluttes senere', () => {
    const s = newGame(1, BOT_SELF, ['kjell', 'mona', 'arild']);
    s.day = 40; clearAll(s);
    checkEnd(s);
    expect(daysToGoal(s)).toBe(39);
    s.day = 43;
    endPhase(s);
    expect(s.phase).toBe(2);
    expect(daysToGoal(s, 1)).toBe(39);
    expect(daysToGoal(s, 2)).toBeNull();
  });

  it('dagen målet nås, står det i loggen med nedtellingen', () => {
    const s = newGame(1, BOT_SELF, ['kjell', 'mona', 'arild']);
    s.event = null;
    clearAll(s);
    const lines = resolveDay(s);
    expect(s.goalDay).not.toBeNull();
    const t = lines.find((l) => l.t.startsWith('Målet for fase 1 er nådd'));
    expect(t?.t).toContain(`${PHASES[1].mods.graceDays} dager`);
    expect(t?.t).toContain('avslutter dere fasen');
  });
});

describe('fremmede overlevende', () => {
  it('hver person har høyst én historie per runde, og den endrer seg ikke med dagen', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
      const seen = new Map<string, StrangerStory>();
      for (let day = 1; day <= 60; day += 7) {
        s.day = day;
        for (const st of STORIES) {
          const n = stranger(s, st);
          if (!n) continue;
          expect(s.crew.some((c) => c.id === n.id)).toBe(false);
          expect(seen.get(n.id) ?? st).toBe(st);
          seen.set(n.id, st);
        }
        const today = STORIES.map((st) => stranger(s, st)?.id).filter(Boolean);
        expect(new Set(today).size).toBe(today.length);
      }
    }
  });

  it('pensjonisten og russen kommer ikke hjem fra turnus', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const n = stranger(newGame(seed, BOT_SELF, []), 'turnus');
      if (n) { expect(n.age).toBeLessThan(62); expect(n.age).toBeGreaterThanOrEqual(20); }
    }
  });

  it('samme seed gir samme person', () => {
    const a = newGame(9, BOT_SELF, []), b = newGame(9, BOT_SELF, []);
    for (const st of STORIES) expect(stranger(a, st)?.id).toBe(stranger(b, st)?.id);
  });
});

describe('langskudd og lappen', () => {
  it('kartet og apoteket viser sjansen for det gode utfallet, og «lyktes» betyr det gode utfallet', () => {
    for (const [id, good] of [['kartet', 'Lageret finnes'], ['apotekruta', 'Alarmen er bare en lampe']] as const) {
      const ch = eventDef(id).choices[0];
      for (let seed = 1; seed <= 40; seed++) {
        const s = newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
        s.res.mat = 20;
        expect(choiceOdds(s, ch)).toBeLessThan(0.7);
        const r = runChoice(s, ch);
        expect(r.text.startsWith(good)).toBe(r.ok);
      }
    }
  });

  it('den som har lagt igjen lappen, løper ikke etter seg selv', () => {
    const e = eventDef('lappen'), ch = e.choices[1];
    for (let day = 5; day < 15; day++) {
      const s = newGame(3, BOT_SELF, ['sondre', 'mona', 'arild']);
      s.day = day; s.moral = 40;
      const leaver = e.text(s).match(/lapp fra ([^:]+):/)![1];
      expect(choiceBest(s, { ...ch, check: 'kondis' }).name).not.toBe(leaver);
      const r = runChoice(s, ch);
      expect(r.text.startsWith(`${leaver} snur`)).toBe(r.ok);
    }
  });
});

describe('spilleren uten navn er «du» midt i setninger', () => {
  const me = { name: YOU };
  it('bøyes etter plassen i setningen', () => {
    expect(nameAs(me)).toBe('Du');
    expect(nameAs(me, 'mid')).toBe('du');
    expect(nameAs(me, 'obj')).toBe('deg');
    expect(nameAs({ name: 'Mona' }, 'obj')).toBe('Mona');
    expect(names([me, { name: 'Mona' }])).toBe('Du og Mona');
    expect(names([{ name: 'Mona' }, me])).toBe('Mona og du');
    expect(names([me, { name: 'Mona' }, { name: 'Tor-Egil' }], 'obj')).toBe('deg, Mona og Tor-Egil');
  });

  it('ingen «Du» med stor bokstav midt i loggen eller i encounter-tekstene', () => {
    const midDu = /[a-zæøå,] Du\b/;
    for (let seed = 1; seed <= 15; seed++) {
      const s = newGame(seed, { ...BOT_SELF, name: '' }, ['mona', 'arild', 'toregil']);
      expect(s.crew[0].name).toBe(YOU);
      for (const e of ENCOUNTERS) {
        const ctx = { sector: 'hjem' as const, crew: s.crew, threat: 1, zombies: 3 };
        if (e.when && !e.when(s, ctx)) continue;
        expect(e.text(s, ctx)).not.toMatch(midDu);
      }
      const lines: string[] = [];
      const c = s.crew[0];
      for (const slot of Object.keys(c.gear) as (keyof typeof c.gear)[]) { c.gear[slot]!.dur = 1; wear(s, c, slot, (t) => lines.push(t)); }
      expect(lines.length).toBeGreaterThan(0);
      for (const t of lines) expect(t).not.toMatch(midDu);
    }
  });
});
