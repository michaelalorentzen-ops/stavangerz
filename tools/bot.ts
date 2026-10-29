// En enkel bot som spiller fase 1. Brukes av balansetesten og tools/sim.ts.
// Den er bevisst dum: en tenkende spiller skal gjøre det bedre.
import { canEndDay, canEndPhase, CARDS, describeEncounter, drawEvent, endPhase, equip, GATE_IDS, newGame, isOnTokt, PLAYABLE, resolveDay, resolveEncounter, runChoice, setLeader, SLOTS, taskOptions } from '../src/engine';
import type { GameState, GateId, SelfSetup } from '../src/engine';

export const BOT_SELF: SelfSetup = { name: 'Bot', stats: { muskler: 3, kondis: 2, snoking: 3, nerver: 3, mekk: 2, prat: 2 }, trait: 'lokalkjent' };

/** Setter det beste kortet fra lageret i hvert spor, ellers beholdes det som er. */
function botEquip(s: GameState) {
  for (const c of s.crew) {
    for (const slot of SLOTS) {
      const have = c.gear[slot] ? CARDS[c.gear[slot]!.def].level : 0;
      const best = s.stash.filter((k) => CARDS[k.def].slot === slot && CARDS[k.def].level > have).sort((a, b) => CARDS[b.def].level - CARDS[a.def].level)[0];
      if (best) equip(s, c.id, best.uid);
    }
  }
}

export function botTurn(s: GameState) {
  botEquip(s);
  const bygg = s.res.tre + s.res.skrap;
  const inf = PLAYABLE.filter((id) => s.sectors[id].z > 0).sort((a, b) => s.sectors[a].z - s.sectors[b].z);
  const opts = taskOptions(s);
  // en vakt ved en port under nivå 2, så lenge noen kan spares
  const vaktGate = opts.find((o) => o.type === 'vakt' && GATE_IDS.includes(o.target as GateId) && s.gates[o.target as GateId].level < 2);
  s.crew.forEach((c, i) => {
    if (isOnTokt(s, c)) return; // boten tar aldri tokt, men låste ordre skal ikke røres
    if (c.hp <= 1) { c.task = { type: 'hvile' }; return; }
    const gate = opts.find((o) => o.type === 'befeste' && s.gates[o.target].level < 2);
    const lete = opts.filter((o) => o.type === 'rydde' && s.sectors[o.target].z === 0);
    if (c.trait === 'sveiser' && gate && bygg > 2) { c.task = gate; return; }
    if (inf.length && i < 3) { c.task = { type: 'rydde', target: inf[0] }; return; }
    if (vaktGate && i === s.crew.length - 1) { c.task = vaktGate; return; }
    if (gate && bygg > 2) { c.task = gate; return; }
    if (lete.length) { c.task = lete[i % lete.length]; return; }
    if (gate) { c.task = gate; return; }
    c.task = { type: 'hvile' };
  });
}

/** Løser alle ventende encounters: første valg som ikke er tilbaketrekk, men tilbaketrekk om noen har 1 i liv. */
export function botEncounters(s: GameState) {
  while (s.pending.length && !s.over) {
    const p = s.pending[0], v = describeEncounter(s, p);
    const weak = s.crew.some((c) => p.crew.includes(c.id) && c.hp === 1);
    const idx = weak ? v.choices.findIndex((c) => c.retreat) : v.choices.findIndex((c) => !c.retreat);
    resolveEncounter(s, p.pid, idx);
  }
}

export function playGame(seed: number, neighbors = ['arild', 'mona', 'toregil'], maxDays = 80): GameState {
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
