import { describe, expect, it } from 'vitest';
import {
  CARDS, cardBonus, crewLevel, describeEncounter, ENC_COOLDOWN, ENCOUNTERS, EVENTS, gainXp, levelProgress, newCard, newGame, PHASES, previewChoice,
  resolveDay, resolveEncounter, rollEncounter, runChoice, SECTORS, stat, XP_STEP,
} from '../src/engine';
import type { GameState, PendingEncounter } from '../src/engine';
import { BOT_SELF } from '../tools/bot';

const fresh = (seed = 42) => newGame(seed, BOT_SELF, ['arild', 'mona', 'toregil']);
const always = <T>(fn: () => T): T => {
  const old = PHASES[1].mods.encounterChance;
  PHASES[1].mods.encounterChance = 10;
  try { return fn(); } finally { PHASES[1].mods.encounterChance = old; }
};
const NOISE = { loud: false, quiet: false };

describe('encounters passer stedet', () => {
  it('hvert kort har minst ett sted, og hjemme trekkes bare kort som passer hjemme', () => {
    for (const d of ENCOUNTERS) expect(d.places.length).toBeGreaterThan(0);
    always(() => {
      for (let seed = 1; seed <= 60; seed++) {
        const s = fresh(seed);
        expect(rollEncounter(s, PHASES[1].mods, 'hjem', s.crew, NOISE, () => {})).toBe(true);
        const def = ENCOUNTERS.find((d) => d.id === s.pending[0].def)!;
        expect(def.places).toContain('hjem');
      }
    });
  });

  it('heisen dukker aldri opp hjemme', () => {
    expect(ENCOUNTERS.find((d) => d.id === 'heis')!.places).not.toContain('hjem');
  });

  it(`de ${ENC_COOLDOWN} sist trukne kortene trekkes ikke igjen med en gang`, () => {
    always(() => {
      const s = fresh(3);
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) {
        rollEncounter(s, PHASES[1].mods, 'buoy_nord', s.crew, NOISE, () => {});
        const id = s.pending.pop()!.def;
        expect(seen.slice(-ENC_COOLDOWN)).not.toContain(id);
        seen.push(id);
      }
    });
  });

  it('teksten bruker stedets preposisjon, ikke «i Hjemme»', () => {
    const s = fresh();
    const p: PendingEncounter = { pid: 'p', def: 'sprint', sector: 'hjem', crew: s.crew.map((c) => c.id), threat: 1 };
    s.pending.push(p);
    const text = describeEncounter(s, p).text;
    expect(text).toContain('hjemme');
    expect(text).not.toContain('i Hjemme');
    expect(SECTORS.skolen.at).toBe('på skolen');
  });
});

describe('valg viser hva de kan gi', () => {
  it('forhåndsvisningen endrer ikke tilstanden og viser gevinst og risiko', () => {
    const s = fresh();
    const p: PendingEncounter = { pid: 'p', def: 'sprint', sector: 'buoy_nord', crew: s.crew.map((c) => c.id), threat: 2 };
    s.pending.push(p);
    const before = JSON.stringify(s);
    const v = describeEncounter(s, p);
    expect(JSON.stringify(s)).toBe(before);
    expect(v.choices[0].preview.ok).toContain('+1 medisin');
    expect(v.choices[0].preview.fail!.join(' ')).toMatch(/mat/);
    expect(v.choices[0].preview.fail!.join(' ')).toMatch(/skade/);
    expect(v.choices[1].preview.fail).toBeNull();
  });

  it('måkene: å gi dem mat viser −2 mat og +4 moral, både før og etter', () => {
    const s = fresh();
    s.moral = 50;
    const ch = EVENTS.find((e) => e.id === 'maaker')!.choices[1];
    expect(previewChoice(s, ch).ok).toEqual(['−2 mat', '+4 moral']);
    expect(runChoice(s, ch).changes).toEqual(['−2 mat', '+4 moral']);
  });

  it('et løst encounter sier hva som faktisk endret seg', () => {
    const s = fresh();
    s.pending.push({ pid: 'p', def: 'trappegang', sector: 'obs', crew: s.crew.map((c) => c.id), threat: 2 });
    const r = resolveEncounter(s, 'p', 1);
    expect(r.changes).toEqual(['−1 moral']);
  });
});

describe('kjellere bryter bare ut der ingen er', () => {
  const setup = (task: boolean): GameState => {
    const s = fresh(9);
    for (const id of Object.keys(s.sectors) as (keyof GameState['sectors'])[]) { s.sectors[id].z = 0; s.sectors[id].hidden = 0; }
    s.sectors.buoy_nord.hidden = 5; s.sectors.buoy_nord.searched = 50; s.sectors.buoy_nord.control = 80;
    for (const c of s.crew) c.task = { type: 'hvile' };
    if (task) s.crew[0].task = { type: 'sanke', target: 'buoy_nord' };
    return s;
  };
  const old = PHASES[1].mods.hiddenOutbreak;
  it('med crew i sektoren skjer det aldri, uten crew skjer det', () => {
    PHASES[1].mods.hiddenOutbreak = 1;
    try {
      const a = setup(true); resolveDay(a);
      expect(a.sectors.buoy_nord.z).toBe(0);
      const b = setup(false); resolveDay(b);
      expect(b.sectors.buoy_nord.z).toBeGreaterThanOrEqual(5);
    } finally { PHASES[1].mods.hiddenOutbreak = old; }
  });
});

describe('utstyr gir ferdighetspoeng', () => {
  it('sporet gir poeng per nivå, pluss kortets egen bonus', () => {
    expect(cardBonus(CARDS.k_ror)).toEqual({ muskler: 3, prat: 2 });
    expect(cardBonus(CARDS.spikerkolle)).toEqual({ muskler: 11, prat: 4 });
    expect(cardBonus(CARDS.sykkelhjelm)).toEqual({ kondis: 3, nerver: 2 });
    expect(cardBonus(CARDS.multiverktoy)).toEqual({ mekk: 6, snoking: 4 });
  });

  it('stat() tar med bonusen fra kortet personen har på seg', () => {
    const s = fresh();
    const c = s.crew.find((x) => x.id === 'arild')!;
    c.gear = {};
    const bare = stat(c, 'nerver');
    c.gear.beskyttelse = newCard(s, 'sykkelhjelm');
    expect(stat(c, 'nerver')).toBe(bare + 2);
  });
});

describe('nivåer fra erfaring', () => {
  it('nivå 2 ved XP_STEP, og hvert nivå tar lenger tid', () => {
    expect(crewLevel(0)).toBe(1);
    expect(crewLevel(XP_STEP - 0.01)).toBe(1);
    expect(crewLevel(XP_STEP)).toBe(2);
    expect(crewLevel(XP_STEP * 3)).toBe(3);
    expect(levelProgress(XP_STEP / 2)).toBeCloseTo(0.5);
  });

  it('erfaring gir nivå, og nivået gir +1 i alle ferdigheter', () => {
    const s = fresh();
    const c = s.crew[1];
    const before = stat(c, 'prat');
    gainXp(c, 'muskler', XP_STEP * 3);
    expect(crewLevel(c.xp!)).toBe(3);
    expect(stat(c, 'prat')).toBe(before + 2);
  });

  it('nivåopprykk meldes i loggen', () => {
    const s = fresh();
    s.crew[1].xp = XP_STEP - 0.1;
    s.crew[1].task = { type: 'trene', stat: 'kondis' };
    const log = resolveDay(s);
    expect(log.some((l) => l.t.includes(`${s.crew[1].name} er nå nivå 2`))).toBe(true);
  });
});
