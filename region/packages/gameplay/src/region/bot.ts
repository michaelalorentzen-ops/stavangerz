/** A sensible automatic player, for balance tests. Not optimal on purpose: it plays like a careful newcomer. */
import type { RegionOrder, RegionState, RegionWorld, RegionSurvivor } from './types';
import { controlled, endDay, has, hqModules, indexWorld, living, previewOrder, reach, searchHoursTotal, trade, tradeValue, upgradesFor } from './engine';
import { resolveEvent } from './events';
import { VALUE } from './rules';

export function botChooseEvent(state: RegionState): string {
  const choices = state.event!.choices.filter(c => !c.disabled);
  const avoid = ['ignore', 'refuse', 'wait', 'let', 'skip', 'no', 'silent', 'endure', 'accept', 'ride'];
  return (choices.find(c => !avoid.includes(c.id)) ?? choices[0] ?? state.event!.choices[0]).id;
}

export function botPlanDay(state: RegionState, world: RegionWorld): RegionOrder[] {
  const index = indexWorld(world);
  const orders: RegionOrder[] = [];
  const free = new Map(living(state).filter(s => s.health >= 25).map(s => [s.id, s]));
  let n = 0;
  const tryOrder = (action: RegionOrder['action'], zoneId: string, crew: RegionSurvivor[], target?: string) => {
    if (!crew.length) return false;
    const order = { id: `b${state.day}-${n++}`, action, zoneId, survivorIds: crew.map(s => s.id), target };
    if (!previewOrder(state, world, order).valid) return false;
    orders.push(order);
    for (const s of crew) free.delete(s.id);
    return true;
  };
  const pick = (count: number, key: 'combat' | 'scouting' | 'craft' | 'medical') => [...free.values()].sort((a, b) => b.skills[key] - a.skills[key]).slice(0, count);
  const people = living(state).length;
  const home = state.homeZoneId;
  const owned = controlled(state);

  // The tired and hurt rest; a medic treats them.
  const hurt = living(state).filter(s => s.health < 55);
  if (hurt.length && (state.stock.medicine ?? 0) >= hurt.length) tryOrder('heal', home, pick(1, 'medical'));
  for (const s of [...free.values()]) if (s.health < 50 || s.fatigue > 75) tryOrder('rest', home, [s]);

  // First: make the start zone ours.
  if (!owned.length) {
    const z = state.zones[home];
    if (z.zombies > 3) tryOrder('clear', home, pick(3, 'combat'));
    if (z.searched / searchHoursTotal(index.byId.get(home)!) < .2) tryOrder('search', home, pick(2, 'craft'));
    tryOrder('claim', home, pick(1, 'scouting'));
    tryOrder('search', home, [...free.values()]);
    return orders;
  }
  if (!state.hq) tryOrder('establishHq', home, pick(1, 'craft'));

  // Water and food first.
  const food = state.stock.food ?? 0, water = state.stock.water ?? 0;
  const homeZone = state.zones[home];
  if (water < people * 8 && !homeZone.upgrades.includes('rainwater')) tryOrder('build', home, pick(1, 'craft'), 'rainwater');
  for (const id of owned) if (!state.zones[id].upgrades.includes('rainwater') && (state.stock.building ?? 0) > 20) { if (tryOrder('build', id, pick(1, 'craft'), 'rainwater')) break; }
  if (index.coastal.has(home) && (state.stock.boat ?? 0) >= 1 && food < people * 12) tryOrder('fish', home, pick(2, 'scouting'));
  const farmZone = owned.find(id => (index.byId.get(id)?.measures?.farm ?? 0) > 5000);
  if (farmZone && food < people * 15) tryOrder('farm', farmZone, pick(2, 'craft'));
  if (!homeZone.upgrades.includes('greenhouse') && has(state.stock, { building: 10, parts: 2 })) tryOrder('build', home, pick(1, 'craft'), 'greenhouse');

  // Hold the line.
  const homeOpen = (index.adjacent.get(home) ?? []).some(a => a.kind === 'land' && state.zones[a.to].status !== 'controlled' && !(state.barricades[a.connId] > 0));
  if (homeOpen && (state.stock.building ?? 0) >= 6) tryOrder('fortify', home, pick(1, 'craft'));
  for (const id of owned) if (state.zones[id].zombies > 0) tryOrder('clear', id, pick(2, 'combat'));

  // Expand: the reachable neighbour with fewest zombies.
  const hops = reach(state, world);
  const frontier = [...hops.entries()].filter(([id, d]) => d >= 1 && d <= 2 && state.zones[id].status !== 'controlled' && !state.zones[id].owner).map(([id]) => id);
  const unscouted = frontier.filter(id => !state.zones[id].intel || state.zones[id].intel!.day < state.day - 5);
  if (unscouted.length) tryOrder('scout', unscouted[0], pick(1, 'scouting'));
  const known = frontier.filter(id => state.zones[id].intel).sort((a, b) => state.zones[a].intel!.max - state.zones[b].intel!.max);
  // A careful player skips zones far beyond what the group can fight today.
  const strength = living(state).reduce((n, s) => n + s.skills.combat, 0) * 2;
  const target = known.find(id => (hops.get(id) ?? 9) <= 1 && state.zones[id].intel!.max <= strength * 3);
  if (target) {
    const z = state.zones[target];
    if (z.intel!.max > 3) tryOrder('clear', target, pick(3, 'combat'));
    else if (!tryOrder('claim', target, pick(1, 'scouting'))) tryOrder('search', target, pick(2, 'craft'));
  }
  // Supplies from the closest searched-out-not-yet zone.
  const lootZone = [...hops.entries()].filter(([id, d]) => d <= 2 && !state.zones[id].owner && state.zones[id].searched < searchHoursTotal(index.byId.get(id)!) && (state.zones[id].intel?.max ?? 99) < 8).sort((a, b) => a[1] - b[1])[0]?.[0];
  if (lootZone) tryOrder('search', lootZone, pick(2, 'scouting'));

  // HQ modules and upgrades when there is material.
  if (state.hq && !state.hq.building) for (const m of ['kitchen', 'watchtower', 'housing', 'medbay', 'depot', 'workshop', 'radioRoom', 'ammoLab']) {
    if (hqModules(state).includes(m) && tryOrder('module', state.hq.zoneId, pick(1, 'craft'), m)) break;
  } else if (state.hq?.building) tryOrder('module', state.hq.zoneId, pick(1, 'craft'), state.hq.building.id);
  for (const id of owned) {
    const options = upgradesFor(state, world, id).map(u => u.id);
    const z = state.zones[id];
    if (z.building) { tryOrder('build', id, pick(1, 'craft'), z.building.id); continue; }
    for (const u of ['watchpost', 'field', 'fishing']) if (options.includes(u) && tryOrder('build', id, pick(1, 'craft'), u)) break;
  }
  // Everyone left: search near home, or guard.
  for (const s of [...free.values()]) {
    if (lootZone && tryOrder('search', lootZone, [s])) continue;
    tryOrder('guard', home, [s]);
  }
  return orders;
}

export function botTrade(state: RegionState): RegionState {
  for (const f of state.factions.filter(x => x.known && x.relation > -40 && (x.tradedDay === undefined || state.day - x.tradedDay >= 3))) {
    const need = f.offers.find(id => (state.stock[id] ?? 0) < 10 && (f.stock[id] ?? 0) >= 5);
    const surplus = f.wants.find(id => (state.stock[id] ?? 0) > 60) ?? Object.keys(state.stock).find(id => (state.stock[id] ?? 0) > 80 && id !== need);
    if (!need || !surplus) continue;
    let giveN = 10;
    const take = { [need]: Math.max(1, Math.floor(20 / (VALUE[need] ?? 1))) };
    while (giveN < (state.stock[surplus] ?? 0) * .5 && !tradeValue(state, f, { [surplus]: giveN }, take).fair) giveN += 5;
    if (!tradeValue(state, f, { [surplus]: giveN }, take).fair) continue;
    try { state = trade(state, f.id, { [surplus]: giveN }, take).state; } catch { /* not this time */ }
  }
  return state;
}

/** Play one game to the end or to `days`. Returns the final state. */
export function botPlay(world: RegionWorld, state: RegionState, days: number) {
  while (state.day < days && !state.gameOver) {
    if (state.event) state = resolveEvent(state, world, botChooseEvent(state)).state;
    state = botTrade(state);
    state = endDay(state, world, botPlanDay(state, world)).state;
  }
  if (state.event) state = resolveEvent(state, world, botChooseEvent(state)).state;
  return state;
}
