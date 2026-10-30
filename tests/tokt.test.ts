import { describe, expect, it } from 'vitest';
import {
  acceptQuest, canEndDay, dailyFood, drawEvent, PLAYABLE, checkEnd, endDayBlocker, injure, newCard, newGame, resolveDay, resolveEncounter, taskKey, taskOptions, toktDecision, validateTasks,
  EVENTS, QUESTS, TOKTS,
} from '../src/engine';
import type { GameState } from '../src/engine';
import { BOT_SELF, playGame, toktStats } from '../tools/bot';

// Bybrua åpnes av et rykte i spillet. Her er det åpent fra start.
const fresh = (seed = 42) => { const s = newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']); s.toktsOpen.push('bybrua'); return s; };
/** Sender de to første på tokt og løser dagen. */
const out = (s: GameState, id = 'bybrua', ids = ['meg', 'arild']) => {
  for (const c of s.crew) if (ids.includes(c.id)) c.task = { type: 'tokt', target: id };
  resolveDay(s);
};
/** Svarer på alle ventende encounters med det første valget. */
const answer = (s: GameState) => { while (s.pending.length) resolveEncounter(s, s.pending[0].pid, 0); };
const hasOpt = (s: GameState, id: string) => taskOptions(s).some((o) => o.type === 'tokt' && o.target === id);

describe('tokt', () => {
  it('innholdet finnes', () => {
    expect(TOKTS.find((t) => t.id === 'kran')).toMatchObject({ at: 'ros', days: 2, threat: 3, quest: 'sos_kran' });
    expect(TOKTS.find((t) => t.id === 'bybrua')).toMatchObject({ at: 'sor', days: 2, threat: 3, reward: { res: { drivstoff: 8, skrap: 6, metall: 4 } }, locked: true });
    expect(QUESTS.length).toBeGreaterThanOrEqual(1);
  });

  it('toktet starter, låser crew og lager ventende encounter', () => {
    const s = fresh();
    out(s);
    expect(s.tokts).toHaveLength(1);
    const t = s.tokts[0];
    expect(t).toMatchObject({ id: 'bybrua', stage: 1, awaiting: true });
    expect(t.crew.sort()).toEqual(['arild', 'meg']);
    expect(s.pending).toHaveLength(1);
    expect(s.pending[0]).toMatchObject({ toktId: 'bybrua', sector: null, threat: 3 });
    // de er låst: ordren overlever validering, og toktet kan ikke startes på nytt
    validateTasks(s);
    expect(s.crew.find((c) => c.id === 'meg')!.task).toEqual({ type: 'tokt', target: 'bybrua' });
    expect(hasOpt(s, 'bybrua')).toBe(false);
  });

  it('snu tar med haul og kort hjem', () => {
    const s = fresh();
    out(s);
    const card = newCard(s, 'k_ror');
    s.tokts[0].haul = { mat: 3, skrap: 2 };
    s.tokts[0].cards = [card];
    answer(s);
    // målt etter encounteret, som selv kan gi bytte
    const before = { mat: s.res.mat, skrap: s.res.skrap }, stash = s.stash.length;
    const txt = toktDecision(s, 'bybrua', 'snu');
    expect(txt).toBeTruthy();
    expect(s.res.mat).toBe(before.mat + 3);
    expect(s.res.skrap).toBe(before.skrap + 2);
    expect(s.stash).toHaveLength(stash + 1);
    expect(s.stash).toContain(card);
    expect(s.tokts).toHaveLength(0);
    for (const id of ['meg', 'arild']) expect(s.crew.find((c) => c.id === id)!.task).toEqual({ type: 'hvile' });
  });

  it('fullført tokt gir belønning og frigjør crew', () => {
    const s = fresh();
    out(s);
    answer(s);
    // første dag ute: å fortsette sender dem videre
    toktDecision(s, 'bybrua', 'fortsett');
    expect(s.tokts[0]).toMatchObject({ stage: 1, awaiting: false });
    expect(canEndDay(s)).toBe(true);
    resolveDay(s);
    expect(s.tokts[0]).toMatchObject({ stage: 2, awaiting: true });
    answer(s);
    const dr = s.res.drivstoff, sk = s.res.skrap, haul = { ...s.tokts[0].haul };
    toktDecision(s, 'bybrua', 'fortsett');
    expect(s.res.drivstoff).toBe(dr + 8 + (haul.drivstoff ?? 0));
    expect(s.res.skrap).toBe(sk + 6 + (haul.skrap ?? 0));
    expect(s.tokts).toHaveLength(0);
    expect(s.crew.find((c) => c.id === 'meg')!.task).toEqual({ type: 'hvile' });
  });

  it('quest-tokt er ikke tilgjengelig før questen er akseptert, og utløper ved until', () => {
    const s = fresh();
    expect(hasOpt(s, 'kran')).toBe(false);
    acceptQuest(s, 'sos_kran');
    expect(hasOpt(s, 'kran')).toBe(true);
    const q = s.quests[0];
    expect(q.until).toBe(s.day + 6);
    // toktet tar 2 dager, så siste dag å starte er until - 1
    s.day = q.until - 1;
    expect(hasOpt(s, 'kran')).toBe(true);
    s.day = q.until;
    expect(hasOpt(s, 'kran')).toBe(false);
    // questen lever til og med until. Dagen etter er fristen ute og det logges én gang.
    expect(resolveDay(s).some((l) => /Fristen/.test(l.t))).toBe(false);
    expect(hasOpt(s, 'kran')).toBe(false);
    expect(resolveDay(s).some((l) => /Fristen/.test(l.t))).toBe(true);
    expect(resolveDay(s).some((l) => /Fristen/.test(l.t))).toBe(false);
  });

  it('fullført quest-tokt gir unikt kort, og ingenting etter fristen', () => {
    const s = fresh();
    acceptQuest(s, 'sos_kran');
    out(s, 'kran');
    answer(s);
    toktDecision(s, 'kran', 'fortsett');
    resolveDay(s);
    answer(s);
    const sk = s.res.skrap;
    toktDecision(s, 'kran', 'fortsett');
    expect(s.res.skrap).toBeGreaterThanOrEqual(sk + 4);
    expect(s.stash.some((k) => k.def === 'u_kiste')).toBe(true);
    expect(s.quests[0].done).toBe(true);

    const late = fresh(7);
    acceptQuest(late, 'sos_kran');
    out(late, 'kran');
    answer(late);
    toktDecision(late, 'kran', 'fortsett');
    late.quests[0].until = late.day - 1; // fristen går ut mens de er ute
    resolveDay(late);
    answer(late);
    const n = late.stash.length;
    toktDecision(late, 'kran', 'fortsett');
    expect(late.stash.some((k) => k.def === 'u_kiste')).toBe(false);
    expect(late.stash.length).toBeGreaterThanOrEqual(n);
    expect(late.quests[0].done).toBe(false);
  });

  it('død på tokt legger utstyret i målsektoren', () => {
    const s = fresh();
    out(s);
    const c = s.crew.find((x) => x.id === 'arild')!;
    const gear = Object.values(c.gear).map((k) => k!.uid);
    expect(gear.length).toBeGreaterThan(0);
    c.hp = 1;
    injure(s, c, 'på Bybrua', () => {});
    expect(s.crew.some((x) => x.id === 'arild')).toBe(false);
    expect(s.sectors.sorspissen.dropped.map((k) => k.uid)).toEqual(expect.arrayContaining(gear));
    checkEnd(s);
    expect(s.tokts[0].crew).toEqual(['meg']);
  });

  it('canEndDay er usann mens et tokt venter på beslutning', () => {
    const s = fresh();
    out(s);
    expect(endDayBlocker(s)).toBe('pending');
    answer(s);
    expect(s.tokts[0].awaiting).toBe(true);
    expect(canEndDay(s)).toBe(false);
    expect(endDayBlocker(s)).toBe('tokt');
    toktDecision(s, 'bybrua', 'snu');
    expect(canEndDay(s)).toBe(true);
    expect(endDayBlocker(s)).toBe(null);
  });

  it('hele toktet dør: toktet fjernes og ingen beslutning henger igjen', () => {
    const s = fresh();
    out(s);
    for (const id of ['meg', 'arild']) {
      const c = s.crew.find((x) => x.id === id)!;
      c.hp = 1;
      injure(s, c, 'på Bybrua', () => {});
    }
    checkEnd(s);
    expect(s.tokts).toHaveLength(0);
    expect(s.pending).toHaveLength(0);
    expect(canEndDay(s) || endDayBlocker(s) === 'leader').toBe(true);
    expect(endDayBlocker(s)).not.toBe('tokt');
  });

  it('toktet krever at noen er med, og ugyldig beslutning kaster', () => {
    const s = fresh();
    expect(() => toktDecision(s, 'bybrua', 'snu')).toThrow();
    out(s);
    expect(() => toktDecision(s, 'bybrua', 'snu')).toThrow(); // encounteret er ikke løst
  });

  it('SOS-hendelsen aksepterer questen', () => {
    const s = fresh();
    const ev = EVENTS.find((e) => e.id === 'sos_kran')!;
    s.day = 5; expect(ev.when!(s)).toBe(false);
    s.day = 6; expect(ev.when!(s)).toBe(true);
    ev.choices[0].run(s, true);
    expect(s.quests.map((q) => q.id)).toEqual(['sos_kran']);
    expect(taskKey({ type: 'tokt', target: 'kran' })).toBe('tokt:kran');
    expect(ev.when!(s)).toBe(false);
  });

  it('crew på tokt teller i dailyFood, så de spiser', () => {
    const s = fresh();
    expect(s.crew).toHaveLength(4);
    const before = s.res.mat, food = dailyFood(s);
    out(s);
    expect(s.tokts[0].crew).toHaveLength(2);
    expect(food).toBe(3); // ceil(4 * 0.6), ikke ceil(2 * 0.6)
    expect(s.res.mat).toBe(before - food);
  });

  it('crew på tokt står ikke vakt ved porten om natta', () => {
    // Sørporten er på nivå 3. En vakt der stopper alle angrep, så uten vakt må noen slippe gjennom.
    let breaches = 0, guarded = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const s = fresh(seed);
      s.gates.sor.level = 3;
      s.sectors.sorspissen.z = 0;
      out(s);
      if (s.log.at(-1)!.lines.some((l) => /kom forbi Bybrusperringen/.test(l.t))) breaches++;
      const g = fresh(seed);
      g.gates.sor.level = 3;
      g.crew.find((c) => c.id === 'toregil')!.task = { type: 'vakt', target: 'sor' };
      out(g);
      if (g.log.at(-1)!.lines.some((l) => /kom forbi Bybrusperringen/.test(l.t))) guarded++;
    }
    expect(breaches).toBeGreaterThan(0);
    expect(guarded).toBe(0);
  });

  it('crew på tokt gir ikke kontroll i noen sektor', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = fresh(seed);
      for (const c of s.crew) c.task = { type: 'tokt', target: 'bybrua' };
      const before = PLAYABLE.map((id) => s.sectors[id].control);
      resolveDay(s);
      PLAYABLE.forEach((id, i) => expect(s.sectors[id].control).toBeLessThanOrEqual(before[i]));
    }
  });

  it('død på tokt til Rosenberg-gjerdet legger utstyret på lageret, siden porten ligger i hjem', () => {
    const s = fresh();
    acceptQuest(s, 'sos_kran');
    out(s, 'kran');
    const c = s.crew.find((x) => x.id === 'arild')!;
    const gear = Object.values(c.gear).map((k) => k!.uid);
    expect(gear.length).toBeGreaterThan(0);
    c.hp = 1;
    injure(s, c, 'ved gjerdet', () => {});
    const stash = s.stash.map((k) => k.uid);
    for (const uid of gear) expect(stash).toContain(uid);
    expect(s.sectors.hjem.dropped).toHaveLength(0);
  });

  it('SOS-hendelsen: å avslå lager ingen quest, og hendelsen kommer ikke igjen', () => {
    const s = fresh();
    s.day = 6;
    const ev = EVENTS.find((e) => e.id === 'sos_kran')!;
    const moral = s.moral;
    ev.choices[1].run(s, true);
    expect(s.quests).toHaveLength(0);
    expect(s.moral).toBeLessThan(moral);
    expect(hasOpt(s, 'kran')).toBe(false);
    // drawEvent merker den som sett
    s.seenEvents.push('sos_kran');
    for (let i = 0; i < 100; i++) { const d = drawEvent(s); expect(d?.id).not.toBe('sos_kran'); }
  });

  it('tokt-belønningskort legges aldri ut som unike kort i sektorer', () => {
    const rewarded = TOKTS.flatMap((d) => d.reward.cards ?? []);
    expect(rewarded).toContain('u_kiste');
    for (let seed = 1; seed <= 300; seed++) {
      const s = fresh(seed);
      for (const id of rewarded) expect(Object.values(s.uniques)).not.toContain(id);
    }
  });
});

describe('bot med tokt', () => {
  it('tar Køen på Bybrua når det er rolig, svarer på valgene og spiller deterministisk', () => {
    const games = Array.from({ length: 20 }, (_, i) => playGame(i + 1, undefined, { tokt: true }));
    expect(games.reduce((n, s) => n + toktStats(s).done + toktStats(s).turned, 0)).toBeGreaterThan(0);
    // ingen runde blir stående med et ubesvart tokt
    for (const s of games) expect(s.over).not.toBeNull();
    expect(playGame(5, undefined, { tokt: true })).toEqual(playGame(5, undefined, { tokt: true }));
    // uten valget tar boten aldri tokt
    expect(toktStats(playGame(5)).done).toBe(0);
  });
});
