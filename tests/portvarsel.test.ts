// Varsel ved porten: gult når portens sektor stenger porten for befesting og vakt, rødt når hele crewet ikke
// rydder fortere enn det som forventes å komme inn om natta. Bare varsel: natta skal være helt uendret.
import { describe, expect, it } from 'vitest';
import { breachOdds, breachSize, gateAlerts, GATE_STRAGGLERS, GATES, newGame, PHASES, SECTORS } from '../src/engine';
import type { GameState, PhaseId } from '../src/engine';
import { BOT_NEIGHBORS, BOT_SELF, playGame } from '../tools/bot';

const NORD = GATES.nord.sector;

/** Ny runde der bare Nordportens sektor har zombier, så de andre portene ikke varsler. */
function game(z: number, day = 1, crew = 4): GameState {
  const s = newGame(1, BOT_SELF, BOT_NEIGHBORS);
  for (const id of Object.keys(s.sectors) as (keyof typeof s.sectors)[]) Object.assign(s.sectors[id], { z: 0, hidden: 0 });
  s.sectors[NORD].z = z;
  s.day = day;
  s.crew = s.crew.slice(0, crew);
  return s;
}
const nord = (s: GameState) => gateAlerts(s).find((a) => a.gate === 'nord');

describe('portvarsel', () => {
  it('varsler ikke med 0 til GATE_STRAGGLERS zombier i portens sektor', () => {
    for (let z = 0; z <= GATE_STRAGGLERS; z++) expect(gateAlerts(game(z, 60, 1))).toEqual([]);
  });

  it('gult når porten står ubevoktet og crewet er sterkt nok', () => {
    const a = nord(game(10))!;
    expect(a.level).toBe('gul');
    expect(a.sector).toBe(NORD);
    expect(a.text).toContain(GATES.nord.name);
    expect(a.text).toContain(SECTORS[NORD].short);
    expect(a.text).toContain(`ned til ${GATE_STRAGGLERS}`);
  });

  it('rødt med mange zombier, sent i fasen og et svakt crew', () => {
    const s = game(60, 60, 1);
    s.crew[0].hp = 2;
    const a = nord(s)!;
    expect(a.level).toBe('rød');
    expect(a.text).toContain(SECTORS[NORD].at);
  });

  it('gult igjen når crewet kan rydde hele sektoren på én dag', () => {
    expect(nord(game(GATE_STRAGGLERS + 1, 60, 4))!.level).toBe('gul');
  });

  it('virker i alle fem fasene', () => {
    for (const ph of Object.keys(PHASES).map(Number) as PhaseId[]) {
      const s = game(10);
      s.phase = ph;
      expect(nord(s)?.level).toBe('gul');
      const w = game(80, 60, 1);
      w.phase = ph; w.phaseStartDay = 1;
      expect(nord(w)?.level).toBe('rød');
    }
  });

  it('Rosenberg-gjerdet varsler når hjem-sektoren stenger det', () => {
    const s = game(0);
    s.sectors[GATES.ros.sector].z = 8;
    const a = gateAlerts(s).find((x) => x.gate === 'ros')!;
    expect(a.sector).toBe('hjem');
    expect(a.level).toBe('gul');
  });

  it('endrer ikke tilstanden og bruker ikke rng', () => {
    for (const s of [game(10), game(60, 60, 1), newGame(7, BOT_SELF, BOT_NEIGHBORS)]) {
      const before = structuredClone(s);
      gateAlerts(s);
      expect(s.rng).toBe(before.rng);
      expect(s).toEqual(before);
    }
  });

  it('fordelingen av gjennombruddet stemmer med trekket i natta', () => {
    for (const [span, level] of [[1, 0], [3.4, 1], [13, 2], [7, 3]]) {
      const odds = breachOdds(span, level);
      expect(odds.reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 10);
      const N = 20_000;
      let sum = 0;
      for (let i = 0; i < N; i++) sum += breachSize((i + 0.5) / N, span, level);
      expect(odds.reduce((a, o) => a + o.p * o.n, 0)).toBeCloseTo(sum / N, 3);
    }
  });
});

// Natta skal gi nøyaktig samme resultat som før formlene ble trukket ut. Hashene er tatt med boten før omleggingen.
const hash = (x: string) => { let a = 5381; for (let i = 0; i < x.length; i++) a = (a * 33 + x.charCodeAt(i)) >>> 0; return a.toString(16); };
describe('natta er uendret', () => {
  it('fase 1, 30 dager med boten', () => {
    const want: Record<number, string> = { 1: '28d1bdc2', 2: '984ed533', 3: '54ce29ba', 7: '29cb468a', 42: 'e963f07a' };
    for (const [seed, h] of Object.entries(want)) expect(hash(JSON.stringify(playGame(Number(seed), BOT_NEIGHBORS, { maxDays: 31 }))), `seed ${seed}`).toBe(h);
  });
  it('inn i fase 2 med boten', () => {
    const want: Record<number, string> = { 5: 'e734e922', 11: '8be1c3a4' };
    for (const [seed, h] of Object.entries(want)) expect(hash(JSON.stringify(playGame(Number(seed), BOT_NEIGHBORS, { maxDays: 60, fase2: true }))), `seed ${seed}`).toBe(h);
  });
});

