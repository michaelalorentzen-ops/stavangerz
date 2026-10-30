import { describe, expect, it } from 'vitest';
import {
  activeSectors, buildLeadMult, canEndPhase, CARDS, checkEnd, COND_ODDS, cookMult, dailyFood, endPhase, FACILITIES, FACILITY_IDS, facilityIntel, freshSector,
  GATE_IDS, HQ_SECTOR, housing, isLocked, ISTAND_WORK, istandMaterials, KANTINE_FOOD, migrate, mods, newCard, newGame, PHASES, phaseProgress, PLAYABLE,
  resolveDay, REPAIR_SKRAP, SECTOR_IDS, SECTORS, securityPower, sectorsOfPhase, taskOptions, validateTasks,
} from '../src/engine';
import type { FacilityId, GameState, PhaseId } from '../src/engine';
import { BOT_SELF, playGame } from '../tools/bot';

const NB = ['arild', 'mona', 'toregil'];

/** En runde som akkurat har gått over i fase 2. Dagens hendelse fjernes, så resolveDay kan kjøres. */
function inPhase2(seed = 1): GameState {
  const s = newGame(seed, BOT_SELF, NB);
  s.goalDay = s.day;
  endPhase(s);
  return s;
}
/** Gjør en sektor trygg. */
const secure = (s: GameState, id: (typeof SECTOR_IDS)[number]) => Object.assign(s.sectors[id], { z: 0, hidden: 0, searched: 100, control: 100 });
/** Kjører en dag uten hendelseskort i veien. */
function day(s: GameState) { s.event = null; s.pending = []; resolveDay(s); s.event = null; s.pending = []; }
/** HQ-et tatt, uten at noe annet skjer. */
function withHq(seed = 1): GameState {
  const s = inPhase2(seed);
  for (const id of activeSectors(s)) secure(s, id);
  for (const c of s.crew) c.task = { type: 'hvile' };
  day(s);
  return s;
}

describe('sektorer per fase', () => {
  it('verftet er en vanlig sektor i tilstanden, men låst i fase 1', () => {
    const s = newGame(1, BOT_SELF, NB);
    expect(SECTOR_IDS).toContain(HQ_SECTOR);
    expect(s.sectors[HQ_SECTOR]).toBeDefined();
    expect(SECTORS[HQ_SECTOR].opensInPhase).toBe(2);
    expect(isLocked(s, HQ_SECTOR)).toBe(true);
    expect(activeSectors(s)).toEqual(PLAYABLE);
    expect(sectorsOfPhase(1)).toEqual(PLAYABLE);
    expect(taskOptions(s).some((o) => 'target' in o && o.target === HQ_SECTOR)).toBe(false);
    expect(phaseProgress(s).total).toBe(PLAYABLE.length);
  });

  it('fase 1-målet gjelder bare fase 1-sektorene', () => {
    const s = newGame(1, BOT_SELF, NB);
    for (const id of PLAYABLE) secure(s, id);
    for (const g of GATE_IDS) s.gates[g].level = 2;
    expect(s.sectors[HQ_SECTOR].z).toBeGreaterThan(0);
    expect(phaseProgress(s).done).toBe(true);
  });

  it('verftet står urørt i fase 1: ingen kontroll, forfall eller kjellerutbrudd', () => {
    const s = newGame(3, BOT_SELF, NB);
    const before = JSON.stringify(s.sectors[HQ_SECTOR]);
    for (let i = 0; i < 15; i++) { for (const c of s.crew) c.task = { type: 'hvile' }; day(s); }
    expect(JSON.stringify(s.sectors[HQ_SECTOR])).toBe(before);
    expect(housing(s)).toBe(SECTORS.hjem.capacity);
  });

  it('fase 2 åpner verftet med fasens zombier og logger overgangen', () => {
    const s = inPhase2();
    expect(s.phase).toBe(2);
    expect(isLocked(s, HQ_SECTOR)).toBe(false);
    expect(activeSectors(s)).toContain(HQ_SECTOR);
    const M = mods(s);
    expect(s.sectors[HQ_SECTOR].z).toBe(Math.round(SECTORS[HQ_SECTOR].z * M.zombieMult));
    expect(s.sectors[HQ_SECTOR].hidden).toBe(Math.round(SECTORS[HQ_SECTOR].hidden * M.zombieMult));
    expect(s.sectors[HQ_SECTOR].seen).toBe(false);
    expect(s.log.at(-1)!.lines.map((l) => l.t).join(' ')).toContain('Fase 2 starter');
    expect(taskOptions(s).some((o) => o.type === 'rydde' && o.target === HQ_SECTOR)).toBe(true);
  });

  it('verftet er trussel 5 med stor horde og mye å finne', () => {
    const d = SECTORS[HQ_SECTOR];
    expect(d.threat).toBe(5);
    expect(d.z).toBeGreaterThanOrEqual(40);
    expect(d.hidden).toBeGreaterThanOrEqual(10);
    for (const r of ['metall', 'skrap', 'drivstoff', 'mat'] as const) expect(d.loot[r]).toBeGreaterThan(0);
    expect(d.capacity).toBeGreaterThan(0);
  });

  it('fristen i fase 1 uten mål åpner også verftet (normal)', () => {
    const s = newGame(7, BOT_SELF, NB);
    s.day = s.phaseStartDay + PHASES[1].mods.turnCap;
    checkEnd(s);
    expect(s.phase).toBe(2);
    expect(s.forcedPhases).toBe(1);
    expect(activeSectors(s)).toContain(HQ_SECTOR);
  });
});

describe('gamle lagringer', () => {
  it('lagring uten verftet og HQ får dem lagt til', () => {
    const old = JSON.parse(JSON.stringify(newGame(5, BOT_SELF, NB)));
    delete old.sectors[HQ_SECTOR]; delete old.hq;
    const s = migrate(old)!;
    expect(s.sectors[HQ_SECTOR]).toEqual(freshSector(HQ_SECTOR, PHASES[2].mods));
    expect(s.hq).toEqual(newGame(5, BOT_SELF, NB).hq);
  });

  it('lagring i fase 2 (tvunget av fristen) får verftet åpnet med fasens zombier', () => {
    const old = JSON.parse(JSON.stringify(newGame(5, BOT_SELF, NB)));
    delete old.sectors[HQ_SECTOR]; old.phase = 2;
    const s = migrate(old)!;
    expect(s.sectors[HQ_SECTOR].z).toBe(Math.round(SECTORS[HQ_SECTOR].z * mods(s).zombieMult));
  });

  it('en vunnet fase 1 fra før fase 2 fantes kan gå videre til fase 2', () => {
    for (const over of ['won', 'won-seen'] as const) {
      const old = JSON.parse(JSON.stringify(newGame(5, BOT_SELF, NB)));
      old.over = over; old.day = 33; old.goalDay = null;
      const s = migrate(old)!;
      expect(s.over).toBeNull();
      expect(s.goalDay).toBe(33);
      expect(canEndPhase(s)).toBe(true);
      endPhase(s);
      expect(s.phase).toBe(2);
    }
  });
});

describe('skjulte anlegg', () => {
  it('tilstanden trekkes av seeden uten å røre rng, og alle tilstander forekommer', () => {
    const a = newGame(11, BOT_SELF, NB), b = newGame(11, BOT_SELF, NB);
    expect(a.hq).toEqual(b.hq);
    expect(a.hq.taken).toBe(false);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) for (const f of FACILITY_IDS) seen.add(newGame(seed, BOT_SELF, []).hq.facilities[f].cond);
    expect([...seen].sort()).toEqual(Object.keys(COND_ODDS).sort());
  });

  it('hvert anlegg har navn, effekt, rykte og sann tekst for hver tilstand', () => {
    for (const f of FACILITY_IDS) {
      const d = FACILITIES[f];
      expect(d.name && d.short && d.effect).toBeTruthy();
      for (const c of Object.keys(COND_ODDS) as (keyof typeof COND_ODDS)[]) { expect(d.rumor[c]).toBeTruthy(); expect(d.known[c]).toBeTruthy(); }
    }
  });

  it('speiding av verftet gir et rykte, og den sanne tilstanden er skjult til HQ-et er tatt', () => {
    const s = inPhase2(4);
    s.crew = s.crew.filter((c) => c.trait !== 'sveiser');
    for (const c of s.crew) c.task = { type: 'hvile' };
    s.crew[0].task = { type: 'speide', target: HQ_SECTOR };
    day(s);
    const heard = FACILITY_IDS.filter((f) => s.hq.facilities[f].heard);
    expect(heard).toHaveLength(1);
    const f = heard[0], intel = facilityIntel(s, f);
    expect(intel.known).toBe(false);
    expect(intel.cond).toBe(s.hq.facilities[f].heard);
    expect(intel.text).toBe(FACILITIES[f].rumor[s.hq.facilities[f].heard!]);
    expect(s.log.flatMap((d) => d.lines).some((l) => l.t.startsWith(`Rykte om ${FACILITIES[f].short}`))).toBe(true);
  });

  it('rykter kan ta feil, men en sveiser fra verftet vet hvordan det står til', () => {
    let wrong = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = inPhase2(seed);
      s.crew = s.crew.filter((c) => c.trait !== 'sveiser');
      for (const c of s.crew) c.task = { type: 'hvile' };
      s.crew[0].task = { type: 'speide', target: HQ_SECTOR };
      day(s);
      const f = FACILITY_IDS.find((x) => s.hq.facilities[x].heard)!;
      if (s.hq.facilities[f].heard !== s.hq.facilities[f].cond) wrong++;
    }
    expect(wrong).toBeGreaterThan(0);
    expect(wrong).toBeLessThan(20);
    for (let seed = 1; seed <= 20; seed++) {
      const s = inPhase2(seed);
      expect(s.crew.some((c) => c.trait === 'sveiser')).toBe(true);
      for (const c of s.crew) c.task = { type: 'hvile' };
      s.crew[0].task = { type: 'speide', target: HQ_SECTOR };
      day(s);
      const f = FACILITY_IDS.find((x) => s.hq.facilities[x].heard)!;
      expect(s.hq.facilities[f].heard).toBe(s.hq.facilities[f].cond);
    }
  });
});

describe('HQ tatt', () => {
  it('når verftet er trygt i fase 2: logget, senger, poster og istandsetting', () => {
    const s = inPhase2();
    for (const id of activeSectors(s)) secure(s, id);
    for (const id of PLAYABLE) if (SECTORS[id].capacity) s.sectors[id].settled = true;
    const beds = housing(s);
    expect(taskOptions(s).some((o) => o.type === 'post')).toBe(false);
    for (const c of s.crew) c.task = { type: 'hvile' };
    day(s);
    expect(s.hq.taken).toBe(true);
    expect(housing(s)).toBe(beds + SECTORS[HQ_SECTOR].capacity);
    expect(s.log.flatMap((d) => d.lines).some((l) => l.t.startsWith('HQ-et er tatt'))).toBe(true);
    const opts = taskOptions(s);
    for (const p of ['sikkerhet', 'bygg', 'kokk'] as const) expect(opts.some((o) => o.type === 'post' && o.target === p)).toBe(true);
    for (const f of FACILITY_IDS) expect(opts.some((o) => o.type === 'istand' && o.target === f)).toBe(true);
    for (const f of FACILITY_IDS) expect(facilityIntel(s, f)).toMatchObject({ cond: s.hq.facilities[f].cond, known: true });
  });

  it('trygt verft i fase 1 (umulig i spillet) gir ikke HQ', () => {
    const s = newGame(1, BOT_SELF, NB);
    secure(s, HQ_SECTOR);
    for (const c of s.crew) c.task = { type: 'hvile' };
    day(s);
    expect(s.hq.taken).toBe(false);
  });
});

describe('sette i stand', () => {
  it('er billigere jo bedre tilstand', () => {
    expect(ISTAND_WORK.god).toBeLessThan(ISTAND_WORK.middels);
    expect(ISTAND_WORK.middels).toBeLessThan(ISTAND_WORK.odelagt);
    const st = (cond: 'god' | 'odelagt') => ({ cond, heard: null, work: 0, ready: false });
    expect(istandMaterials(st('god'))).toBeLessThan(istandMaterials(st('odelagt')));
  });

  it('bruker arbeid og metall, og anlegget blir klart', () => {
    const s = withHq();
    const f: FacilityId = 'kontor';
    s.hq.facilities[f].cond = 'god';
    s.res.metall = 100; s.res.skrap = 0;
    let days = 0;
    while (!s.hq.facilities[f].ready && days < 30) {
      for (const c of s.crew) c.task = { type: 'istand', target: f };
      day(s); days++;
    }
    expect(s.hq.facilities[f].ready).toBe(true);
    expect(s.res.metall).toBeLessThan(100);
    expect(taskOptions(s).some((o) => o.type === 'istand' && o.target === f)).toBe(false);
    expect(phaseProgress(s).done).toBe(true);
  });

  it('uten materialer går det nesten ingenting', () => {
    const s = withHq();
    s.res.metall = 0; s.res.skrap = 0;
    for (const c of s.crew) c.task = { type: 'istand', target: 'kai' };
    day(s);
    expect(s.hq.facilities.kai.work).toBe(0);
  });
});

describe('faste poster', () => {
  it('postholderen blir i posten fra dag til dag', () => {
    const s = withHq();
    s.crew[1].task = { type: 'post', target: 'kokk' };
    for (let i = 0; i < 3; i++) day(s);
    expect(s.crew[1].task).toEqual({ type: 'post', target: 'kokk' });
  });

  it('bare én per post: den andre hviler etter dagen', () => {
    const s = withHq();
    s.crew[1].task = { type: 'post', target: 'kokk' };
    s.crew[1].stats.prat = 60;
    s.crew[2].task = { type: 'post', target: 'kokk' };
    validateTasks(s);
    expect(s.crew[1].task.type).toBe('post');
    expect(s.crew[2].task.type).toBe('hvile');
  });

  it('kokken sparer mat, byggelederen gir mer arbeid, sikkerhetssjefen vakt ved alle porter', () => {
    const s = withHq();
    for (let i = 0; i < 6; i++) s.crew.push({ ...structuredClone(s.crew[1]), id: `x${i}` });
    const food = dailyFood(s);
    expect([cookMult(s), buildLeadMult(s), securityPower(s)]).toEqual([1, 1, 0]);
    s.crew[1].task = { type: 'post', target: 'kokk' };
    s.crew[1].stats.prat = 60;
    s.crew[2].task = { type: 'post', target: 'bygg' };
    s.crew[3].task = { type: 'post', target: 'sikkerhet' };
    expect(dailyFood(s)).toBeLessThan(food);
    expect(buildLeadMult(s)).toBeGreaterThan(1);
    expect(securityPower(s)).toBeGreaterThan(0);
  });

  it('posten virker ikke før HQ-et er tatt', () => {
    const s = inPhase2();
    s.crew[1].task = { type: 'post', target: 'kokk' };
    expect(cookMult(s)).toBe(1);
  });
});

describe('anleggene virker', () => {
  it('verkstedhallen: Lage utstyr gir ett nivå høyere, og Reparere gir holdbarhet tilbake for skrap', () => {
    const s = withHq();
    expect(taskOptions(s).some((o) => o.type === 'reparere')).toBe(false);
    s.hq.facilities.verksted.ready = true;
    expect(taskOptions(s).some((o) => o.type === 'reparere')).toBe(true);
    const c = s.crew[1];
    c.stats.mekk = 10; c.gear = {};
    const levels: number[] = [];
    for (let i = 0; i < 20; i++) {
      // nok mat og vann, så ingen dør av sult underveis
      s.res.skrap = 10; s.res.tre = 10; s.res.mat = 40; s.res.vann = 40; s.stash = []; c.stats.mekk = 10; c.xp = 0; c.hp = 3;
      for (const x of s.crew) x.task = { type: 'hvile' };
      c.task = { type: 'lage' };
      const uid0 = s.nextUid;
      day(s);
      // bare kortene som ble laget i dag (ikke utstyr fra noen som falt)
      for (const k of s.stash) if (Number(k.uid.slice(1)) >= uid0) levels.push(CARDS[k.def].level);
    }
    expect(levels.length).toBeGreaterThan(0);
    expect([...new Set(levels)]).toEqual([2]);
    // reparere
    const k = newCard(s, 'k_ror');
    k.dur = 1; s.stash = [k]; s.res.skrap = 10;
    // utstyrte kort repareres først, så de er hele her
    for (const x of s.crew) for (const g of Object.values(x.gear)) if (g) g.dur = CARDS[g.def].durability;
    for (const x of s.crew) x.task = { type: 'hvile' };
    s.crew[0].task = { type: 'reparere' };
    day(s);
    expect(k.dur).toBe(CARDS.k_ror.durability);
    expect(s.res.skrap).toBeLessThanOrEqual(10 - REPAIR_SKRAP);
  });

  it('kantina gir mat hver dag', () => {
    const a = withHq(2), b = withHq(2);
    b.hq.facilities.kantine.ready = true;
    a.rng = b.rng = 99;
    for (const c of [...a.crew, ...b.crew]) c.task = { type: 'hvile' };
    day(a); day(b);
    // lageret råtner litt, så forskjellen kan være én mindre
    expect(b.res.mat - a.res.mat).toBeGreaterThanOrEqual(KANTINE_FOOD - 1);
    expect(b.res.mat - a.res.mat).toBeLessThanOrEqual(KANTINE_FOOD);
  });
});

describe('Buøy i fase 2', () => {
  it('fasetabellen har heldDecay for alle faser, lavere enn controlDecay fra fase 2', () => {
    for (const p of [1, 2, 3, 4, 5] as PhaseId[]) expect(PHASES[p].mods.heldDecay).toBeGreaterThan(0);
    for (const p of [2, 3, 4, 5] as PhaseId[]) expect(PHASES[p].mods.heldDecay).toBeLessThan(PHASES[p].mods.controlDecay);
  });

  it('trygge fase 1-sektorer forfaller sakte, verftet med vanlig fart', () => {
    const s = inPhase2();
    secure(s, 'obs'); s.sectors.obs.control = 90;
    Object.assign(s.sectors[HQ_SECTOR], { z: 0, hidden: 0, searched: 40, control: 90 });
    for (const g of GATE_IDS) s.gates[g].level = 2;
    for (const c of s.crew) c.task = { type: 'hvile' };
    day(s);
    expect(s.sectors.obs.control).toBeCloseTo(90 - PHASES[2].mods.heldDecay, 5);
    expect(s.sectors[HQ_SECTOR].control).toBeCloseTo(90 - PHASES[2].mods.controlDecay, 5);
  });
});

describe('fasemålet i fase 2', () => {
  it('trygt verft og ett anlegg i stand gir seier: fortsettelse følger', () => {
    const s = withHq();
    expect(phaseProgress(s).done).toBe(false);
    s.hq.facilities.kai.ready = true;
    checkEnd(s);
    expect(s.goalDay).not.toBeNull();
    s.event = null;
    endPhase(s);
    expect(s.over).toBe('won');
    expect(s.phase).toBe(2);
  });

  it('fristen i fase 2 uten mål er tap, også på normal (fase 3 finnes ikke)', () => {
    const s = inPhase2();
    s.day = s.phaseStartDay + mods(s).turnCap;
    checkEnd(s);
    expect(s.over).toBe('timeout');
  });
});

describe('boten i fase 2', () => {
  it('spiller videre, tar HQ-et og vinner noen ganger', () => {
    const games = Array.from({ length: 12 }, (_, i) => playGame(i + 1, NB, { fase2: true }));
    expect(games.some((s) => s.phase === 2 && s.over === 'won')).toBe(true);
    expect(games.some((s) => s.hq.taken)).toBe(true);
  });

  it('uten fase2 stopper boten etter fase 1 som før', () => {
    const s = playGame(1, NB);
    expect(s.phase === 1 || s.over === 'won' || s.forcedPhases > 0).toBe(true);
    expect(s.sectors[HQ_SECTOR].searched).toBe(0);
  });
});
