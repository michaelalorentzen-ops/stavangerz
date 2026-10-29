// En bot som spiller fase 1. Brukes av balansetesten og tools/sim.ts.
// Den følger en fast prioritetsliste og tenker ikke langt frem. En god spiller skal slå den.
import {
  canEndDay, canEndPhase, CARDS, dailyFood, dailyWater, describeEncounter, drawEvent, endPhase, equip, fightPower, GATE_IDS, GATES,
  isOnTokt, isSafe, LAGE_COST, newGame, PLAYABLE, resolveDay, resolveEncounter, runChoice, sameTask, searchPower, buildPower, SECTORS, setLeader,
  SLOTS, taskOptions, THREAT_KILL,
} from '../src/engine';
import type { CrewMember, GameState, GateId, ResKey, SelfSetup, Task } from '../src/engine';

export const BOT_SELF: SelfSetup = { name: 'Bot', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent' };
export const BOT_NEIGHBORS = ['arild', 'mona', 'toregil'];
/** Fire kombinasjoner av tre fra START_NEIGHBORS, som til sammen bruker alle åtte. */
export const COMBOS: string[][] = [
  ['kjell', 'mona', 'arild'],
  ['sondre', 'ingrid', 'toregil'],
  ['leah', 'bjarne', 'kjell'],
  ['arild', 'sondre', 'bjarne'],
];

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
const breached = (s: GameState, g: GateId) => s.sectors[GATES[g].sector].z > 0;

export function botTurn(s: GameState) {
  botEquip(s);
  const opts = taskOptions(s);
  const can = (t: Task) => opts.some((o) => sameTask(o, t));
  const free = s.crew.filter((c) => !isOnTokt(s, c)); // boten tar aldri tokt, men låste ordre skal ikke røres
  const plan = new Map<CrewMember, Task>();
  const avail = () => free.filter((c) => !plan.has(c));
  const by = (f: (c: CrewMember) => number) => avail().sort((a, b) => f(b) - f(a));
  const set = (c: CrewMember | undefined, t: Task) => { if (c && can(t)) { plan.set(c, t); return true; } return false; };

  // 1) Hvile med 1 i liv
  for (const c of free) if (c.hp <= 1) plan.set(c, { type: 'hvile' });

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

  // 3) Vakt ved en port under nivå 2, eller der sektoren bak har fått inn zombier.
  // 4) Befeste porten i stedet når det er materialer, siden byggerne også holder vakt om natta.
  const weakGate = GATE_IDS.filter((g) => s.gates[g].level < 2 && can({ type: 'vakt', target: g }))
    .sort((a, b) => s.gates[a].level - s.gates[b].level || GATES[b].base - GATES[a].base)[0];
  if (weakGate) {
    const c = by((c) => buildPower(s, c))[0];
    if (!(materials(s) > 0 && set(c, { type: 'befeste', target: weakGate }))) set(c, { type: 'vakt', target: weakGate });
  }
  for (const g of GATE_IDS) {
    if (s.gates[g].level < 2 && materials(s) > 2 && ![...plan.values()].some((t) => t.type === 'befeste' && t.target === g)) {
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
  const unsafe = () => PLAYABLE.filter((id) => s.sectors[id].z === 0 && !isSafe(s.sectors[id]) && ![...plan.values()].some((t) => 'target' in t && t.target === id))
    .sort((a, b) => s.sectors[a].control - s.sectors[b].control);
  for (let id = unsafe()[0]; id && avail().length; id = unsafe()[0]) if (!set(by((c) => c.stats.nerver)[0], { type: 'vakt', target: id })) break;

  // 8) Lage utstyr hvis noen mangler våpen
  const unarmed = s.crew.some((c) => !c.gear.vapen) && !s.stash.some((k) => CARDS[k.def].slot === 'vapen');
  if (unarmed && s.res.skrap >= LAGE_COST.skrap && s.res.tre >= LAGE_COST.tre) set(by((c) => c.stats.mekk)[0], { type: 'lage' });

  // Resten: bygg portene videre mot nivå 3, hold vakt ved portene, ellers hvil.
  // Materialene spares til portene under nivå 2 så lenge noen av dem mangler.
  for (const g of [...GATE_IDS].sort((a, b) => s.gates[a].level - s.gates[b].level)) {
    if (!avail().length) break;
    if (breached(s, g)) continue;
    const c = by((c) => buildPower(s, c))[0];
    const build = s.gates[g].level < 3 && materials(s) > 0 && (s.gates[g].level < 2 || !gatesLeft || materials(s) > 8);
    if (!(build && set(c, { type: 'befeste', target: g }))) set(c, { type: 'vakt', target: g });
  }
  for (const c of free) c.task = plan.get(c) ?? { type: 'hvile' };
}

/** Løser ventende encounters: det valget med best odds, men tilbaketrekk om noen i gruppa har 1 i liv. */
export function botEncounters(s: GameState) {
  while (s.pending.length && !s.over) {
    const p = s.pending[0], v = describeEncounter(s, p);
    const weak = s.crew.some((c) => p.crew.includes(c.id) && c.hp === 1);
    let idx = v.choices.findIndex((c) => c.retreat);
    if (!weak) {
      const best = v.choices.map((c, i) => ({ c, i })).filter((x) => !x.c.retreat).sort((a, b) => b.c.odds - a.c.odds)[0];
      if (best) idx = best.i;
    }
    resolveEncounter(s, p.pid, idx);
  }
}

export function playGame(seed: number, neighbors: string[] = BOT_NEIGHBORS, maxDays = 80): GameState {
  const s = newGame(seed, BOT_SELF, neighbors);
  while (!s.over && s.day < maxDays) {
    botTurn(s);
    resolveDay(s);
    const ev = s.over ? null : drawEvent(s);
    if (ev) runChoice(s, ev.choices.filter((c) => !c.when || c.when(s))[0]);
    // som i spillet: encounters først (de kan drepe lederen), så ny leder
    botEncounters(s);
    if (!canEndDay(s) && s.crew.length) setLeader(s, s.crew[0].id);
    // avslutter fasen samme dag målet er nådd, når ingenting venter lenger
    if (canEndPhase(s)) endPhase(s);
  }
  return s;
}
