import { describe, expect, it } from 'vitest';
import {
  armorMult, bestCopy, CARDS, equip, groupStash, injure, lage, salvage, salvageCopy, salvageValue, newCard, newGame, resolveDay as resolveDayAndDrawEvent, rollCard, SECTORS, stat, toggleFavorite, toolMult, unequip, weaponMult, wear,
} from '../src/engine';
import type { GameState, LogFn, SectorId } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
/** Dagsoppgjøret uten dagens hendelse: testene her gjelder dagen, ikke hendelseskortene. */
const resolveDay = (s: GameState) => { const L = resolveDayAndDrawEvent(s); s.event = null; return L; };
const log: LogFn = () => {};
const me = (s: GameState) => s.crew[0];

describe('utstyrskort', () => {
  it('equip bytter og legger gammelt kort på lager', () => {
    const s = fresh();
    const a = newCard(s, 'k_ror'), b = newCard(s, 'kobein');
    s.stash.push(a, b);
    me(s).gear = {};
    expect(equip(s, 'meg', a.uid)).toBe(true);
    expect(me(s).gear.vapen).toBe(a);
    expect(equip(s, 'meg', b.uid)).toBe(true);
    expect(me(s).gear.vapen).toBe(b);
    expect(s.stash).toContain(a);
    expect(s.stash).not.toContain(b);
    expect(equip(s, 'meg', 'finnes-ikke')).toBe(false);
    expect(unequip(s, 'meg', 'vapen')).toBe(true);
    expect(s.stash).toContain(b);
    expect(unequip(s, 'meg', 'vapen')).toBe(false);
  });

  it('wear ødelegger kortet på 0 holdbarhet', () => {
    const s = fresh();
    const c = me(s);
    const card = newCard(s, 'kobein');
    card.dur = 2;
    c.gear = { vapen: card };
    wear(s, c, 'vapen', log);
    expect(c.gear.vapen?.dur).toBe(1);
    const lines: string[] = [];
    wear(s, c, 'vapen', (t) => lines.push(t));
    expect(c.gear.vapen).toBeUndefined();
    expect(lines.length).toBe(1);
  });

  it('rollCard overgår aldri maxLevel', () => {
    for (const max of [1, 2, 3] as const) {
      const s = fresh(max);
      for (let i = 0; i < 500; i++) {
        const d = CARDS[rollCard(s, max).def];
        expect(d.level).toBeLessThanOrEqual(max);
        expect(d.rarity).not.toBe('unik');
      }
    }
  });

  it('unike plasseres likt for samme seed og ulikt for ulike seeds', () => {
    expect(fresh(5).uniques).toEqual(fresh(5).uniques);
    expect(Object.keys(fresh(5).uniques)).toHaveLength(2);
    const seen = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(fresh(i + 1).uniques)));
    expect(seen.size).toBeGreaterThan(1);
    for (let i = 1; i < 20; i++) for (const [id, def] of Object.entries(fresh(i).uniques)) expect(CARDS[def!].places).toContain(id);
  });

  it('død ute legger utstyret i sektoren, død hjemme på lager', () => {
    const s = fresh();
    const c = s.crew[1];
    const k = newCard(s, 'kobein');
    c.gear = { vapen: k };
    c.task = { type: 'rydde', target: 'obs' };
    c.hp = 1;
    injure(s, c, 'i test', log);
    expect(s.crew).not.toContain(c);
    expect(s.sectors.obs.dropped).toContain(k);
    expect(s.stash).not.toContain(k);

    const d = s.crew[1];
    const k2 = newCard(s, 'tommestokk');
    d.gear = { verktoy: k2 };
    d.task = { type: 'rydde', target: 'hjem' };
    d.hp = 1;
    injure(s, d, 'hjemme', log);
    expect(s.stash).toContain(k2);

    const e = s.crew[1];
    const k3 = newCard(s, 'tommestokk');
    e.gear = { verktoy: k3 };
    e.task = { type: 'hvile' };
    e.hp = 1;
    injure(s, e, 'på sofaen', log);
    expect(s.stash).toContain(k3);
  });

  it('beskyttelse slites når personen skades', () => {
    const s = fresh();
    const c = me(s);
    const v = newCard(s, 'sykkelhjelm');
    c.gear = { beskyttelse: v };
    c.hp = 3;
    injure(s, c, 'i test', log);
    expect(v.dur).toBe(CARDS.sykkelhjelm.durability - 1);
  });

  it('utstyr i sektoren overlever ny infisering og hentes med neste rydde', () => {
    const s = fresh();
    const k = newCard(s, 'kobein');
    s.sectors.obs.dropped.push(k);
    s.sectors.obs.z = 30;
    resolveDay(s); // tomgang, ingen ordre
    expect(s.sectors.obs.dropped).toContain(k);
    for (const c of s.crew) c.task = { type: 'rydde', target: 'obs' };
    resolveDay(s);
    expect(s.sectors.obs.dropped).toHaveLength(0);
    expect(s.stash).toContain(k);
  });

  it('lage utstyr bruker 3 skrap og 1 tre og gir et makeshift-kort', () => {
    const s = fresh();
    const c = me(s);
    c.stats.mekk = 100;
    s.res.skrap = 3; s.res.tre = 1;
    const before = s.stash.length;
    let ok = 0;
    for (let i = 0; i < 10 && !ok; i++) {
      s.res.skrap = 3; s.res.tre = 1;
      c.task = { type: 'lage' };
      for (const o of s.crew.slice(1)) o.task = { type: 'hvile' };
      resolveDay(s);
      expect(s.res.skrap).toBe(0);
      expect(s.res.tre).toBe(0);
      ok = s.stash.length - before;
    }
    expect(ok).toBeGreaterThan(0);
    const made = CARDS[s.stash.at(-1)!.def];
    expect(made.family).toBe('makeshift');
    expect(made.level).toBe(2); // Mekk 100 er Rå
  });

  it('lage utstyr uten materialer gjør ingenting', () => {
    const s = fresh();
    s.res.skrap = 2; s.res.tre = 5;
    const lines: string[] = [];
    lage(s, me(s), stat(me(s), 'mekk'), (t) => lines.push(t));
    expect(s.res.skrap).toBe(2);
    expect(s.res.tre).toBe(5);
    expect(s.stash).toHaveLength(0);
    expect(lines).toHaveLength(1);
  });

  it('multiplikatorene følger nivå', () => {
    const s = fresh();
    const c = me(s);
    c.gear = {};
    expect(weaponMult(c)).toBe(0.8);
    expect(armorMult(c)).toBe(1);
    expect(toolMult(c)).toBe(1);
    c.gear = { vapen: newCard(s, 'kobein') };
    expect(weaponMult(c)).toBe([0, 1.0, 1.2, 1.4, 1.6, 1.8][CARDS.kobein.level]);
  });

  it('bonus fra utstyret teller i stat', () => {
    const s = fresh();
    const c = me(s);
    c.gear = {};
    const base = stat(c, 'muskler');
    c.gear = { vapen: newCard(s, 'spikerkolle') };
    expect(CARDS.spikerkolle.bonus?.muskler).toBeGreaterThan(0);
    expect(stat(c, 'muskler')).toBeGreaterThan(base);
  });

  it('funn fra tomme sektorer gir kort, aldri over trusselnivået', () => {
    let found = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = fresh(seed);
      Object.assign(s.sectors.hjem, { z: 0, hidden: 0, searched: 0, control: 60 });
      for (const c of s.crew) c.task = { type: 'rydde', target: 'hjem' };
      resolveDay(s);
      for (const k of s.stash) { found++; expect(CARDS[k.def].level).toBeLessThanOrEqual(SECTORS.hjem.threat); }
    }
    expect(found).toBeGreaterThan(5);
  });

  it('unikt kort funnet når searched krysser 60', () => {
    const s = fresh();
    const id = Object.keys(s.uniques)[0] as SectorId;
    const def = s.uniques[id]!;
    Object.assign(s.sectors[id], { z: 0, hidden: 0, searched: 55, control: 60 });
    for (const c of s.crew) c.task = { type: 'rydde', target: id };
    resolveDay(s);
    expect(s.sectors[id].searched).toBeGreaterThanOrEqual(60);
    expect(s.stash.some((k) => k.def === def)).toBe(true);
    expect(s.uniques[id]).toBeUndefined();
  });

  it('startutstyr og sektorfunn', () => {
    const s = fresh();
    expect(CARDS[me(s).gear.vapen!.def].name).toBe('20 mm K-rør');
    expect(CARDS[me(s).gear.verktoy!.def].name).toBe('Baufil');
    for (const c of s.crew.slice(1)) {
      const g = Object.values(c.gear);
      expect(g).toHaveLength(1);
      expect(CARDS[g[0]!.def]).toMatchObject({ family: 'makeshift', level: 1 });
    }
  });

  it('katalogen: nivå 1–5, unike har places, minst 12 + 4', () => {
    const all = Object.values(CARDS);
    for (const d of all) expect(d.level).toBeGreaterThanOrEqual(1), expect(d.level).toBeLessThanOrEqual(5);
    const uniq = all.filter((d) => d.rarity === 'unik');
    expect(uniq.length).toBeGreaterThanOrEqual(4);
    for (const d of uniq) expect(d.places?.length).toBeGreaterThan(0);
    const common = all.filter((d) => d.rarity !== 'unik');
    expect(common.length).toBeGreaterThanOrEqual(12);
    for (const slot of ['vapen', 'beskyttelse', 'verktoy'] as const) expect(common.some((d) => d.slot === slot)).toBe(true);
    for (const lvl of [1, 2, 3]) for (const fam of ['makeshift', 'for']) expect(common.some((d) => d.level === lvl && d.family === fam)).toBe(true);
    for (const sec of Object.values(SECTORS)) if (sec.special?.card) expect(CARDS[sec.special.card]).toBeDefined();
  });

  it('lage direkte bruker nøyaktig 3 skrap og 1 tre', () => {
    const s = fresh();
    s.res.skrap = 5; s.res.tre = 4;
    lage(s, me(s), 100, log);
    expect(s.res.skrap).toBe(2);
    expect(s.res.tre).toBe(3);
  });

  it('multiplikatorene for alle nivå', () => {
    const s = fresh();
    const c = me(s);
    const arm = ['sykkelhjelm', 'trampolinevest', 'vernedress'], tool = ['baufil', 'multiverktoy', 'sveiseapparat'], wep = ['kobein', 'spikerkolle', 'kjedesag'];
    arm.forEach((id, i) => { c.gear = { beskyttelse: newCard(s, id) }; expect(armorMult(c)).toBe([0.9, 0.8, 0.7][i]); });
    tool.forEach((id, i) => { c.gear = { verktoy: newCard(s, id) }; expect(toolMult(c)).toBe([1.1, 1.2, 1.3][i]); });
    wep.forEach((id, i) => { c.gear = { vapen: newCard(s, id) }; expect(weaponMult(c)).toBe([1.0, 1.2, 1.4][i]); });
    c.gear = {};
    expect([armorMult(c), toolMult(c), weaponMult(c)]).toEqual([1, 1, 0.8]);
  });

  it('sektorfunn gir de navngitte kortene når searched krysser 50', () => {
    for (const [id, card] of [['obs', 'spikerpistol_obs'], ['nordkrysset', 'hagle_politibil']] as const) {
      const s = fresh();
      Object.assign(s.sectors[id], { z: 0, hidden: 0, searched: 45, control: 60 });
      for (const c of s.crew) c.task = { type: 'rydde', target: id };
      resolveDay(s);
      expect(s.sectors[id].searched).toBeGreaterThanOrEqual(50);
      expect(s.stash.some((k) => k.def === card)).toBe(true);
    }
  });

  it('Sanke henter utstyr som ligger igjen', () => {
    const s = fresh();
    const k = newCard(s, 'kobein');
    Object.assign(s.sectors.obs, { z: 0, hidden: 0, control: 60 });
    s.sectors.obs.dropped.push(k);
    for (const c of s.crew) c.task = { type: 'sanke', target: 'obs' };
    resolveDay(s);
    expect(s.sectors.obs.dropped).toHaveLength(0);
    expect(s.stash).toContain(k);
  });

  it('slitasje: våpen ved Rydde mot zombier, verktøy ved Sanke og Befeste', () => {
    const s = fresh();
    const c = me(s);
    const w = c.gear.vapen!, tl = c.gear.verktoy!;
    const w0 = w.dur, t0 = tl.dur;
    s.sectors.obs.z = 500;
    for (const o of s.crew) o.task = { type: 'hvile' };
    c.task = { type: 'rydde', target: 'obs' };
    resolveDay(s);
    expect(w.dur).toBe(w0 - 1);
    expect(tl.dur).toBe(t0 - 1);

    Object.assign(s.sectors.hjem, { z: 0, hidden: 0 });
    c.task = { type: 'sanke', target: 'hjem' };
    resolveDay(s);
    expect(tl.dur).toBe(t0 - 2);
    expect(w.dur).toBe(w0 - 1);

    s.sectors.hjem.z = 0;
    s.res.tre = 20;
    c.task = { type: 'befeste', target: 'nord' };
    resolveDay(s);
    expect(tl.dur).toBe(t0 - 3);
  });

  it('rollCard: nivå 3 omtrent halvparten, makeshift omtrent 75 %', () => {
    const s = fresh();
    let l3 = 0, mk = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) { const d = CARDS[rollCard(s, 3).def]; if (d.level === 3) l3++; if (d.family === 'makeshift') mk++; }
    expect(l3 / N).toBeGreaterThan(0.42); expect(l3 / N).toBeLessThan(0.58);
    expect(mk / N).toBeGreaterThan(0.68); expect(mk / N).toBeLessThan(0.82);
  });

  it('toggleFavorite virker på lager og utstyrte kort', () => {
    const s = fresh();
    const k = newCard(s, 'kobein');
    s.stash.push(k);
    const worn = me(s).gear.vapen!;
    expect(toggleFavorite(s, k.uid)).toBe(true);
    expect(k.fav).toBe(true);
    expect(toggleFavorite(s, k.uid)).toBe(true);
    expect(k.fav).toBe(false);
    expect(toggleFavorite(s, worn.uid)).toBe(true);
    expect(worn.fav).toBe(true);
    expect(toggleFavorite(s, 'finnes-ikke')).toBe(false);
  });

  it('groupStash samler identiske kort, og engine beholder enkeltkort', () => {
    const s = fresh();
    const a = newCard(s, 'kobein'), b = newCard(s, 'kobein'), c = newCard(s, 'baufil');
    a.dur = 3; b.dur = 9;
    s.stash.push(a, c, b);
    const g = groupStash(s.stash);
    expect(g.map((x) => [x.def, x.cards.length])).toEqual([['kobein', 2], ['baufil', 1]]);
    expect(s.stash).toHaveLength(3);
    expect(bestCopy(g[0].cards)).toBe(b);
  });

  it('salvageValue-tabell', () => {
    const mk = (family: 'makeshift' | 'for', level: 1 | 2 | 3, rarity: 'vanlig' | 'unik' = 'vanlig') => ({ ...CARDS.kobein, family, level, rarity });
    expect(salvageValue(mk('makeshift', 1))).toEqual({ skrap: 2 });
    expect(salvageValue(mk('makeshift', 3))).toEqual({ skrap: 4 });
    expect(salvageValue(mk('for', 1))).toEqual({ skrap: 3 });
    expect(salvageValue(mk('for', 3))).toEqual({ skrap: 7 });
    expect(salvageValue(mk('for', 3, 'unik'))).toEqual({ skrap: 14 });
  });

  it('salvage legger til ressurser, nekter favoritter og kort utenfor lageret', () => {
    const s = fresh();
    const k = newCard(s, 'hagle_politibil'); // fra før, nivå 2 -> 5 skrap
    s.stash.push(k);
    const before = s.res.skrap;
    k.fav = true;
    expect(salvage(s, k.uid)).toBeNull();
    expect(s.stash).toContain(k);
    k.fav = false;
    expect(salvage(s, k.uid)).toEqual({ skrap: 5 });
    expect(s.res.skrap).toBe(before + 5);
    expect(s.stash).not.toContain(k);
    expect(salvage(s, me(s).gear.vapen!.uid)).toBeNull();
    expect(me(s).gear.vapen).toBeDefined();
  });

  it('salvageCopy tar laveste holdbarhet som ikke er favoritt', () => {
    const s = fresh();
    const a = newCard(s, 'kobein'), b = newCard(s, 'kobein'), c = newCard(s, 'kobein');
    a.dur = 2; b.dur = 5; c.dur = 8; a.fav = true;
    expect(salvageCopy([a, b, c])).toBe(b);
    b.fav = true; c.fav = true;
    expect(salvageCopy([a, b, c])).toBeNull();
  });
});

describe('vern av utstyr', () => {
  it('salvage nekter unike kort uten allowUnique', () => {
    const s = fresh();
    const u = Object.values(CARDS).find((d) => d.rarity === 'unik')!;
    const k = newCard(s, u.id);
    s.stash.push(k);
    const before = s.res.skrap;
    expect(salvage(s, k.uid)).toBeNull();
    expect(s.stash).toContain(k);
    expect(s.res.skrap).toBe(before);
    expect(salvage(s, k.uid, { allowUnique: true })).toEqual(salvageValue(u));
    expect(s.stash).not.toContain(k);
    // favoritter vernes fortsatt, også med flagget
    const f = newCard(s, u.id);
    f.fav = true;
    s.stash.push(f);
    expect(salvage(s, f.uid, { allowUnique: true })).toBeNull();
  });

  it('equip og unequip nektes for de som er på tokt', () => {
    const s = fresh();
    const k = newCard(s, 'kobein');
    s.stash.push(k);
    s.tokts.push({ id: 'bybrua', crew: ['meg'], stage: 1, haul: {}, cards: [], awaiting: false });
    const gear = { ...me(s).gear };
    expect(equip(s, 'meg', k.uid)).toBe(false);
    expect(unequip(s, 'meg', 'vapen')).toBe(false);
    expect(me(s).gear).toEqual(gear);
    expect(s.stash).toContain(k);
    // de som er hjemme kan fortsatt bytte
    expect(equip(s, 'arild', k.uid)).toBe(true);
  });
});
