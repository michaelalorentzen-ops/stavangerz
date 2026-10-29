// En enkel bot som spiller fase 1. Brukes av balansetesten og tools/sim.ts.
// Den er bevisst dum: en tenkende spiller skal gjøre det bedre.
import { CARDS, drawEvent, equip, newGame, PLAYABLE, resolveDay, runChoice, SLOTS, taskOptions } from '../src/engine';
import type { GameState, SelfSetup } from '../src/engine';

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
  s.crew.forEach((c, i) => {
    if (c.hp <= 1) { c.task = { type: 'hvile' }; return; }
    const gate = opts.find((o) => o.type === 'befeste' && s.gates[o.target].level < 2);
    const lete = opts.filter((o) => o.type === 'rydde' && s.sectors[o.target].z === 0);
    if (c.trait === 'sveiser' && gate && bygg > 2) { c.task = gate; return; }
    if (inf.length && i < 3) { c.task = { type: 'rydde', target: inf[0] }; return; }
    if (gate && bygg > 2) { c.task = gate; return; }
    if (lete.length) { c.task = lete[i % lete.length]; return; }
    if (gate) { c.task = gate; return; }
    c.task = { type: 'hvile' };
  });
}

export function playGame(seed: number, neighbors = ['arild', 'mona', 'toregil'], maxDays = 80): GameState {
  const s = newGame(seed, BOT_SELF, neighbors);
  while (!s.over && s.day < maxDays) {
    botTurn(s);
    resolveDay(s);
    const ev = drawEvent(s);
    if (ev) runChoice(s, ev.choices.filter((c) => !c.when || c.when(s))[0]);
  }
  return s;
}
