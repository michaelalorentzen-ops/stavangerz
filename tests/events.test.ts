import { describe, expect, it } from 'vitest';
import { addNeighbor, checkOdds, choiceOdds, ENCOUNTERS, encounterOdds, EVENTS, housing, INTRO, newGame, RES, runChoice } from '../src/engine';
import type { GameState } from '../src/engine';
import { STRANGER_BASE } from '../src/regions/content';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed: number) => {
  const s = newGame(seed, BOT_SELF, ['kjell', 'mona', 'arild']);
  s.day = 8; // så alle kort med dagkrav kan trekkes
  s.res.drivstoff = 5;
  return s;
};
const valid = (s: GameState) => {
  for (const r of RES) { expect(Number.isNaN(s.res[r])).toBe(false); expect(s.res[r]).toBeGreaterThanOrEqual(0); }
  expect(Number.isNaN(s.moral)).toBe(false);
  expect(s.moral).toBeGreaterThanOrEqual(0);
  expect(s.moral).toBeLessThanOrEqual(100);
  for (const c of s.crew) expect(c.hp).toBeGreaterThanOrEqual(1);
  expect(s.crew.length).toBeLessThanOrEqual(housing(s));
};

describe('hendelseskort', () => {
  it('har unike id-er', () => {
    const ids = [INTRO, ...EVENTS].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const ev of [INTRO, ...EVENTS]) {
    it(`«${ev.title}»: alle valg gir tekst og gyldig tilstand`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        for (const ch of ev.choices) {
          const s = fresh(seed);
          if (ev.when && !ev.when(s)) continue;
          if (ch.when && !ch.when(s)) continue;
          expect(ev.text(s).length).toBeGreaterThan(10);
          const r = runChoice(s, ch);
          expect(r.text.length).toBeGreaterThan(5);
          valid(s);
        }
      }
    });
  }
});

describe('rekruttering uten plass', () => {
  it('Hurtigbåten avviser personen med tekst når boligene er fulle', () => {
    const ev = EVENTS.find((e) => e.id === 'hurtigbat')!;
    for (let seed = 1; seed <= 20; seed++) {
      const s = fresh(seed);
      while (s.crew.length < housing(s)) s.crew.push({ ...s.crew[1], id: `x${s.crew.length}` });
      const n = s.crew.length;
      const r = runChoice(s, ev.choices[0]);
      expect(r.text).toMatch(/plass/);
      expect(s.crew.length).toBe(n);
      expect(Object.keys(s.flags).filter((k) => k.startsWith('gone_')).length).toBe(1); // kortet gjentas ikke med samme utfall
      valid(s);
    }
  });
});

describe('mat fra hendelser', () => {
  it('minst fire kort kan gi mat, og fryseboksen gir mat uten sjekk', () => {
    const gives = (ev: (typeof EVENTS)[number]) => {
      for (let seed = 1; seed <= 20; seed++) for (const ch of ev.choices) {
        const s = fresh(seed);
        if ((ev.when && !ev.when(s)) || (ch.when && !ch.when(s))) continue;
        const before = s.res.mat;
        runChoice(s, ch);
        if (s.res.mat > before) return true;
      }
      return false;
    };
    expect(EVENTS.filter(gives).length).toBeGreaterThanOrEqual(4);
    const f = EVENTS.find((e) => e.id === 'fryseboks')!;
    const s = fresh(1);
    const before = s.res.mat;
    runChoice(s, f.choices[0]);
    expect(s.res.mat).toBeGreaterThan(before);
  });

  it('Garasjesalget gir et kort på lageret', () => {
    const ev = EVENTS.find((e) => e.id === 'garasjesalg')!;
    const s = fresh(1);
    const n = s.stash.length;
    runChoice(s, ev.choices[0]);
    expect(s.stash.length).toBe(n + 1);
    expect(s.stash[s.stash.length - 1].def).toBe('jernia_kasse');
  });
});

describe('vanskelige sjekker (checkBase)', () => {
  it('en lavere grunnsjanse gir lavere odds, både i hendelser og encounters', () => {
    const s = fresh(1);
    const normal = choiceOdds(s, { label: 'x', check: 'prat', run: () => '' });
    const hard = choiceOdds(s, { label: 'x', check: 'prat', checkBase: STRANGER_BASE, run: () => '' });
    expect(normal).toBe(checkOdds(s, 'prat'));
    expect(hard).toBe(checkOdds(s, 'prat', STRANGER_BASE));
    expect(hard).toBeLessThan(normal - 0.3);
    // encounteret «turnus» har et vervevalg ved siden av en vanlig Prat-sjekk
    const def = ENCOUNTERS.find((e) => e.id === 'turnus')!;
    const iHard = def.choices.findIndex((c) => c.checkBase !== undefined);
    const iNormal = def.choices.findIndex((c) => c.check === 'prat' && c.checkBase === undefined);
    s.pending.push({ pid: 'p1', def: 'turnus', sector: 'hjem', crew: s.crew.map((c) => c.id), threat: 1 });
    expect(encounterOdds(s, s.pending[0], iHard)).toBeLessThan(encounterOdds(s, s.pending[0], iNormal) - 0.3);
  });

  it('runChoice bruker grunnsjansen: med den laveste lykkes nesten ingenting', () => {
    let wins = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (runChoice(fresh(seed), { label: 'x', check: 'prat', checkBase: -5, run: () => 'ok' }).ok) wins++;
    }
    expect(wins).toBeLessThan(25); // gulvet er 5 %
  });
});

describe('fremmede som kan verves', () => {
  it('vervevalget gir en ekte nabo med navn, og vises ikke når det ikke er seng', () => {
    const ch = EVENTS.find((e) => e.id === 'tesla')!.choices.find((c) => c.checkBase !== undefined)!;
    const s = fresh(3);
    expect(ch.when!(s)).toBe(true);
    const n = s.crew.length;
    const text = ch.run(s, true);
    expect(s.crew.length).toBe(n + 1);
    expect(text).toContain(s.crew[n].name);
    const full = fresh(3);
    while (full.crew.length < housing(full)) full.crew.push({ ...full.crew[1], id: `x${full.crew.length}` });
    expect(ch.when!(full)).toBe(false);
  });

  it('grupper kan ikke verves: ingen valg i oljefolk eller generalforsamlingen legger til folk', () => {
    for (const id of ['oljeskift', 'kartet', 'pokerkveld', 'dugnaden']) {
      const ev = EVENTS.find((e) => e.id === id)!;
      for (let seed = 1; seed <= 10; seed++) for (const ch of ev.choices) {
        const s = fresh(seed); s.day = 30; s.res.mat = 20;
        if ((ev.when && !ev.when(s)) || (ch.when && !ch.when(s))) continue;
        const n = s.crew.length;
        ch.run(s, true);
        expect(s.crew.length).toBeLessThanOrEqual(n);
      }
    }
  });
});

describe('sene hendelser', () => {
  for (const ev of EVENTS) {
    it(`«${ev.title}»: gyldig tilstand sent i fasen, med stort og lite crew`, () => {
      for (let seed = 1; seed <= 10; seed++) for (const big of [false, true]) for (const ch of ev.choices) {
        const s = fresh(seed);
        s.day = 45;
        if (big) { for (const id of ['sondre', 'ingrid']) addNeighbor(s, id); /* seks, så mange som det er senger til */ s.res.mat = 30; s.res.vann = 20; s.res.tre = 8; s.gates.nord.work = 12; }
        if (ev.when && !ev.when(s)) continue;
        if (ch.when && !ch.when(s)) continue;
        expect(ev.text(s).length).toBeGreaterThan(10);
        const r = runChoice(s, ch);
        expect(r.text.length).toBeGreaterThan(5);
        valid(s);
      }
    });
  }
});
