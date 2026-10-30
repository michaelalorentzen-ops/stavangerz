// En bot som spiller fase 1. Brukes av balansetesten og tools/sim.ts.
// Den følger en fast prioritetsliste og tenker ikke langt frem. En god spiller skal slå den.
import {
  canEndDay, canEndPhase, CARDS, dailyFood, dailyWater, delta, describeEncounter, drawEvent, endPhase, equip, fightPower, GATE_IDS, GATES,
  isOnTokt, isSafe, LAGE_COST, newGame, toktDecision, toktDef, PLAYABLE, resolveDay, resolveEncounter, runChoice, sameTask, searchPower, buildPower, SECTORS, setLeader,
  SLOTS, taskOptions, THREAT_KILL,
} from '../src/engine';
import type { ChoiceDef, CrewMember, GameState, ResKey, SelfSetup, Task } from '../src/engine';

export const BOT_SELF: SelfSetup = { name: 'Bot', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent' };
export const BOT_NEIGHBORS = ['arild', 'mona', 'toregil'];
/** Fire kombinasjoner av tre fra START_NEIGHBORS, som til sammen bruker alle åtte. */
export const COMBOS: string[][] = [
  ['kjell', 'mona', 'arild'],
  ['sondre', 'ingrid', 'toregil'],
  ['leah', 'bjarne', 'kjell'],
  ['arild', 'sondre', 'bjarne'],
];

/** Valg for boten. `tokt` sender to på «Køen på Bybrua» når det er rolig nok. */
export interface BotOptions { tokt?: boolean; maxDays?: number }

/** Toktet boten tar, og hvor mange den sender. */
const BOT_TOKT = 'bybrua', TOKT_TEAM = 2, TOKT_MIN_CREW = 4;
/** Boten snur etter så mange dager ute, med mindre toktet er ferdig. */
const TOKT_MAX_STAGES = 2;

/** Maks antall i en Rydde-gruppe. */
const RYDDE_MAX = 3;
/** Forventet drap per kampkraft i Rydde, midt i spennet 0,35–0,60. */
const KILL_RATE = 0.47;

/** Steg 9: setter det beste kortet fra lageret i hvert spor. Kortet som lå der går tilbake. */
function botEquip(s: GameState) {
  // de sterkeste i kamp får våpnene først
  const order = [...s.crew].sort((a, b) => fightPower(s, b) - fightPower(s, a));
  for (const c of order) {
    for (const slot of SLOTS) {
      const have = c.gear[slot] ? CARDS[c.gear[slot]!.def].level : 0;
      const best = s.stash.filter((k) => CARDS[k.def].slot === slot && CARDS[k.def].level > have)
        .sort((a, b) => CARDS[b.def].level - CARDS[a.def].level || b.dur - a.dur)[0];
      if (best) equip(s, c.id, best.uid);
    }
  }
}

const materials = (s: GameState) => s.res.tre + s.res.skrap;

export function botTurn(s: GameState, bot: BotOptions = {}) {
  botEquip(s);
  const opts = taskOptions(s);
  const can = (t: Task) => opts.some((o) => sameTask(o, t));
  const free = s.crew.filter((c) => !isOnTokt(s, c)); // de som er ute er låst til toktet
  const plan = new Map<CrewMember, Task>();
  const avail = () => free.filter((c) => !plan.has(c));
  const by = (f: (c: CrewMember) => number) => avail().sort((a, b) => f(b) - f(a));
  const planned = (pred: (t: Task) => boolean) => [...plan.values()].some(pred);
  const set = (c: CrewMember | undefined, t: Task) => { if (c && can(t)) { plan.set(c, t); return true; } return false; };

  // 1) Hvile med 1 i liv
  for (const c of free) if (c.hp <= 1) plan.set(c, { type: 'hvile' });

  // 1b) Tokt (bare med bot.tokt): to friske drar når crewet er stort nok og ingenting haster.
  //     Det haster når en sektor har zombier, noen har 1 i liv, eller mat eller vann er under tre dagers forbruk.
  //     (Med bare Hjemme som krav dro boten nesten hver dag og vant 19 %: to av fire borte hele tiden.)
  if (bot.tokt && s.crew.length >= TOKT_MIN_CREW && can({ type: 'tokt', target: BOT_TOKT })) {
    const urgent = PLAYABLE.some((id) => s.sectors[id].z > 0) || s.crew.some((c) => c.hp <= 1)
      || s.res.mat < 3 * dailyFood(s) || s.res.vann < 3 * dailyWater(s);
    const fit = avail().filter((c) => c.hp === 3).sort((a, b) => fightPower(s, b) - fightPower(s, a));
    if (!urgent && fit.length >= TOKT_TEAM) for (const c of fit.slice(0, TOKT_TEAM)) set(c, { type: 'tokt', target: BOT_TOKT });
  }

  // 1c) Apoteket: når medisinen er tom og noen er skadet, sender boten de to friskeste. Bare den trygge første turen.
  if (!s.toktsDone.includes('apotek') && s.res.medisin < 2 && s.crew.length >= 3 && s.crew.some((c) => c.hp < 3) && can({ type: 'tokt', target: 'apotek' })) {
    const fit = avail().filter((c) => c.hp === 3).sort((a, b) => fightPower(s, b) - fightPower(s, a));
    if (fit.length >= 2) for (const c of fit.slice(0, 2)) set(c, { type: 'tokt', target: 'apotek' });
  }

  // 2) Rydde den minst infiserte sektoren med inntil 3, så mange som trengs
  const infected = PLAYABLE.filter((id) => s.sectors[id].z > 0).sort((a, b) => s.sectors[a].z - s.sectors[b].z);
  if (infected.length) {
    const id = infected[0], need = s.sectors[id].z;
    let power = 0;
    for (const c of by((c) => fightPower(s, c)).slice(0, RYDDE_MAX)) {
      if (power * KILL_RATE * THREAT_KILL[SECTORS[id].threat] >= need) break;
      if (set(c, { type: 'rydde', target: id })) power += fightPower(s, c);
    }
  }

  // 3) Vakt ved en port under nivå 2. En port kan bare voktes og bygges når sektoren bak er tom,
  //    så et åpent gjennombrudd ryddes i steg 2 først.
  // 4) Befeste porten i stedet når det er materialer, siden byggerne også holder vakt om natta.
  const weakGate = GATE_IDS.filter((g) => s.gates[g].level < 2 && can({ type: 'vakt', target: g }))
    .sort((a, b) => s.gates[a].level - s.gates[b].level || GATES[b].base - GATES[a].base)[0];
  if (weakGate) {
    const c = by((c) => buildPower(s, c))[0];
    if (!(materials(s) > 0 && set(c, { type: 'befeste', target: weakGate }))) set(c, { type: 'vakt', target: weakGate });
  }
  for (const g of GATE_IDS) {
    if (s.gates[g].level < 2 && materials(s) > 2 && !planned((t) => t.type === 'befeste' && t.target === g)) {
      set(by((c) => buildPower(s, c))[0], { type: 'befeste', target: g });
    }
  }

  // 5) Sanke når mat eller vann er under 3 dagers forbruk
  const short: ResKey[] = [];
  if (s.res.mat < 3 * dailyFood(s)) short.push('mat');
  if (s.res.vann < 3 * dailyWater(s)) short.push('vann');
  for (const r of short) {
    const id = PLAYABLE.filter((id) => (SECTORS[id].yield[r] ?? 0) > 0 && can({ type: 'sanke', target: id }))
      .sort((a, b) => (SECTORS[b].yield[r] ?? 0) - (SECTORS[a].yield[r] ?? 0))[0];
    if (id) set(by((c) => searchPower(s, c))[0], { type: 'sanke', target: id });
  }

  // 5b) Sanke skrap og tre når det mangler materialer til en port under nivå 2
  const gatesLeft = GATE_IDS.some((g) => s.gates[g].level < 2);
  if (gatesLeft && materials(s) < 3) {
    const id = PLAYABLE.filter((id) => can({ type: 'sanke', target: id }))
      .sort((a, b) => ((SECTORS[b].yield.skrap ?? 0) + (SECTORS[b].yield.tre ?? 0)) - ((SECTORS[a].yield.skrap ?? 0) + (SECTORS[a].yield.tre ?? 0)))[0];
    if (id && (SECTORS[id].yield.skrap || SECTORS[id].yield.tre)) set(by((c) => searchPower(s, c))[0], { type: 'sanke', target: id });
  }

  // 6) Rydde (gjennomsøke) tomme sektorer som ikke er trygge, til de er gjennomsøkt.
  // Én person per sektor, de med minst gjennomsøkt først.
  const unsearched = PLAYABLE.filter((id) => s.sectors[id].z === 0 && (s.sectors[id].searched < 100 || s.sectors[id].hidden > 0))
    .sort((a, b) => s.sectors[a].searched - s.sectors[b].searched);
  for (const id of unsearched) set(by((c) => searchPower(s, c))[0], { type: 'rydde', target: id });

  // 7) Vakt på sektoren med lavest kontroll som ikke er trygg, så lenge det er noen å sende
  const unsafe = () => PLAYABLE.filter((id) => s.sectors[id].z === 0 && !isSafe(s.sectors[id]) && !planned((t) => 'target' in t && t.target === id))
    .sort((a, b) => s.sectors[a].control - s.sectors[b].control);
  while (avail().length) {
    const id = unsafe()[0];
    if (!id || !set(by((c) => c.stats.nerver)[0], { type: 'vakt', target: id })) break;
  }

  // 8) Lage utstyr hvis noen mangler våpen
  const unarmed = s.crew.some((c) => !c.gear.vapen) && !s.stash.some((k) => CARDS[k.def].slot === 'vapen');
  if (unarmed && s.res.skrap >= LAGE_COST.skrap && s.res.tre >= LAGE_COST.tre) set(by((c) => c.stats.mekk)[0], { type: 'lage' });

  // Resten: bygg portene videre mot nivå 3, hold vakt ved portene, ellers hvil.
  // Materialene spares til portene under nivå 2 så lenge noen av dem mangler.
  for (const g of [...GATE_IDS].sort((a, b) => s.gates[a].level - s.gates[b].level)) {
    if (!avail().length) break;
    const c = by((c) => buildPower(s, c))[0];
    const build = s.gates[g].level < 3 && materials(s) > 0 && (s.gates[g].level < 2 || !gatesLeft || materials(s) > 8);
    if (!(build && set(c, { type: 'befeste', target: g }))) set(c, { type: 'vakt', target: g });
  }
  for (const c of free) c.task = plan.get(c) ?? { type: 'hvile' };
}

/** Hva boten synes om en endring: liv og helse teller mest, så mat og vann, så resten. */
function value(a: GameState, b: GameState): number {
  const d = delta(a, b);
  const res = (k: keyof GameState['res'], w: number) => (d.res[k] ?? 0) * w;
  return res('mat', 1.5) + res('vann', 1.2) + res('medisin', 2) + res('tre', 0.6) + res('skrap', 0.6) + res('drivstoff', 0.3)
    + d.moral * 0.3 + d.cards.length * 3 + d.joined.length * 12 - d.hurt.length * 6 - d.lost.length * 30 - d.gone.length * 4
    - Math.max(0, d.zombies) * 2 + Math.max(0, -d.zombies) + d.scouted + d.control * 0.05 + d.searched * 0.05
    + Object.values(d.gateWork).reduce((n, w) => n + (w ?? 0), 0) * 0.8;
}

/** Hendelsesvalget med best forventet verdi, prøvd ut på kopier slik en spiller ser forhåndsvisningen. */
export function botEventChoice(s: GameState, choices: ChoiceDef[]): ChoiceDef {
  let best = choices[0], bestV = -Infinity;
  for (const ch of choices) {
    let v = 0;
    for (let i = 0; i < 6; i++) {
      const copy = structuredClone(s);
      copy.rng = (s.rng ^ Math.imul(i + 1, 0x85ebca6b)) | 0;
      runChoice(copy, ch);
      v += value(s, copy);
    }
    if (v > bestV) { bestV = v; best = ch; }
  }
  return best;
}

/** Løser ventende encounters: det valget med best odds, men tilbaketrekk om noen i gruppa har 1 i liv. */
export function botEncounters(s: GameState) {
  while (s.pending.length && !s.over) {
    const p = s.pending[0], v = describeEncounter(s, p, { preview: false });
    const weak = s.crew.some((c) => p.crew.includes(c.id) && c.hp === 1);
    let idx = v.choices.findIndex((c) => c.retreat);
    if (!weak) {
      const best = v.choices.map((c, i) => ({ c, i })).filter((x) => !x.c.retreat).sort((a, b) => b.c.odds - a.c.odds)[0];
      if (best) idx = best.i;
    }
    resolveEncounter(s, p.pid, idx);
  }
}

/**
 * Tokt-valg: fortsett til toktet er ferdig, men snu når noen i gruppa har 1 i liv eller gruppa har vært ute
 * i TOKT_MAX_STAGES dager uten å bli ferdig. På siste dag betyr «fortsett» å fullføre og få belønningen.
 */
export function botTokts(s: GameState) {
  for (const t of [...s.tokts]) {
    if (!t.awaiting || s.over || s.pending.some((p) => p.toktId === t.id)) continue;
    const done = t.stage >= toktDef(t.id).days;
    const weak = s.crew.some((c) => t.crew.includes(c.id) && c.hp <= 1);
    const d = done ? 'fortsett' : weak || t.stage >= TOKT_MAX_STAGES ? 'snu' : 'fortsett';
    toktDecision(s, t.id, d);
    const st = toktStats(s);
    if (done) st.done++; else if (d === 'snu') st.turned++;
  }
}

/** Telling av bot-tokt per runde, til simuleringen. Ligger utenfor spilltilstanden. */
const TOKT_STATS = new WeakMap<GameState, { done: number; turned: number }>();
export const toktStats = (s: GameState) => {
  let st = TOKT_STATS.get(s);
  if (!st) TOKT_STATS.set(s, (st = { done: 0, turned: 0 }));
  return st;
};

export function playGame(seed: number, neighbors: string[] = BOT_NEIGHBORS, opts: BotOptions = {}): GameState {
  const s = newGame(seed, BOT_SELF, neighbors);
  const maxDays = opts.maxDays ?? 80;
  while (!s.over && s.day < maxDays) {
    botTurn(s, opts);
    resolveDay(s);
    const ev = s.over ? null : drawEvent(s);
    if (ev) runChoice(s, botEventChoice(s, ev.choices.filter((c) => !c.when || c.when(s))));
    // som i spillet: encounters først (de kan drepe lederen), så ny leder
    botEncounters(s);
    botTokts(s);
    if (!canEndDay(s) && s.crew.length) setLeader(s, s.crew[0].id);
    // avslutter fasen samme dag målet er nådd, når ingenting venter lenger
    if (canEndPhase(s)) endPhase(s);
  }
  return s;
}
