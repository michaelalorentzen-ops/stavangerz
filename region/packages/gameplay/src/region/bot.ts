/** A sensible automatic player, for balance tests. Not optimal on purpose: it plays like a careful newcomer. */
import type { RegionOrder, RegionState, RegionWorld, RegionSurvivor } from './types';
import { assaultOdds, controlled, endDay, has, hqModules, indexWorld, living, present, previewOrder, reach, searchHoursTotal, trade, tradeValue, upgradesFor } from './engine';
import { resolveEvent } from './events';
import { VALUE } from './rules';
import { LAWS, TECHS } from './systems';
import { autoWork, lawAvailable, passLaw, setWork, totalPeople } from './society';
import { phaseOneReadiness, startResearch, techBlocked } from './progress';
import { dailyFlows } from './economy';

export function botChooseEvent(state: RegionState): string {
  const choices = state.event!.choices.filter(c => !c.disabled);
  if (state.event!.id === 'escape') return (choices.find(c => c.id === 'boat') ?? choices.find(c => c.id === 'run') ?? choices[0]).id;
  // A careful newcomer: avoids the cruel and the reckless when there is another way, but does not always pay.
  const score = (c: typeof choices[number]) => {
    const tags = c.tags ?? [];
    let n = 0;
    if (tags.includes('cruel')) n -= 3;
    if (tags.includes('reckless')) n -= 2;
    if (tags.includes('betrayal')) n -= 2;
    if (tags.includes('merciful')) n += 1;
    if (tags.includes('charity')) n += totalPeople(state) < 40 ? 1 : -1;
    if (['ignore', 'refuse', 'wait', 'let', 'skip', 'no', 'silent', 'endure', 'ride', 'leave'].includes(c.id)) n -= 1;
    return n;
  };
  const best = [...choices].sort((a, b) => score(b) - score(a))[0];
  return (best ?? state.event!.choices[0]).id;
}

const RESEARCH_ORDER = ['saltDry', 'hygiene', 'rotation', 'carWall', 'watchRoutine', 'crystalRadio', 'zombieStudy', 'forgedMelee', 'fieldSurgery', 'rationCards', 'spikes',
  'generators', 'reloading', 'rootCellar', 'fishery', 'livestock', 'school', 'armour', 'herbal', 'containers', 'woodGas', 'intel', 'crossbows', 'decoys', 'spirit', 'ferry',
  'solarGrid', 'charter', 'steelFence', 'biogas', 'drill', 'penicillin', 'coldStore', 'hydroponics', 'printing', 'bridgeRepair', 'explosivesCraft', 'cure'];

/** Work, laws and research: the leader's desk. */
export function botManage(state: RegionState, world: RegionWorld): RegionState {
  // Work: the default split, more on food when the forecast is red.
  let w = autoWork(state, world);
  const flows = dailyFlows(setWork(state, w), world);
  if (flows.food.net < 0 && w.scavenge > 2) { const move = Math.ceil(w.scavenge / 2); w = { ...w, scavenge: w.scavenge - move, farm: w.farm + move }; }
  state = setWork(state, w);
  // Laws: practical ones first, rations when food runs short.
  const f = dailyFlows(state, world);
  const wanted = ['buryDead', 'punishLabour', 'bittenQuarantine', 'openGates', 'restDay', 'curfew', 'council', 'childSchool'];
  if (f.food.daysLeft !== null && f.food.daysLeft < 8) wanted.unshift('rationReduced');
  else if (state.laws.includes('rationReduced') && (f.food.daysLeft === null || f.food.daysLeft > 25)) wanted.unshift('restDay');
  for (const id of wanted) if (!lawAvailable(state, id) && !state.laws.includes(id)) { try { state = passLaw(state, id); } catch { /* not now */ } break; }
  // Research: the first project that can start.
  if (!state.research.current) for (const id of RESEARCH_ORDER) {
    const t = TECHS.find(x => x.id === id)!;
    if (techBlocked(state, t)) continue;
    try { state = startResearch(state, id); break; } catch { /* missing materials */ }
  }
  void LAWS;
  return state;
}

export function botPlanDay(state: RegionState, world: RegionWorld): RegionOrder[] {
  const index = indexWorld(world);
  const orders: RegionOrder[] = [];
  const free = new Map(present(state).filter(s => s.health >= 25).map(s => [s.id, s]));
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
  const strength = living(state).reduce((k, s) => k + s.skills.combat, 0) * 2;

  // The tired and hurt rest; a medic treats them.
  const hurt = living(state).filter(s => s.health < 55);
  if (hurt.length && (state.stock.medicine ?? 0) >= hurt.length) tryOrder('heal', home, pick(1, 'medical'));
  for (const s of [...free.values()]) if (s.health < 50 || s.fatigue > 75) tryOrder('rest', home, [s]);

  // First: make a zone ours. If the camp is hopeless, move.
  if (!owned.length) {
    const z = state.zones[home];
    if (z.zombies > strength * 4) {
      const calm = (index.adjacent.get(home) ?? []).map(a => a.to).filter(id => !state.zones[id].owner).sort((a, b) => state.zones[a].zombies - state.zones[b].zombies)[0];
      if (calm && state.zones[calm].zombies < z.zombies * .5 && tryOrder('relocate', calm, [...free.values()])) return orders;
    }
    if (z.zombies > 3) tryOrder('clear', home, pick(3, 'combat'));
    if (z.searched / searchHoursTotal(index.byId.get(home)!) < .2) tryOrder('search', home, pick(2, 'craft'));
    if (!z.intel || z.intel.day < state.day - 3) tryOrder('scout', home, pick(1, 'scouting'));
    tryOrder('claim', home, pick(1, 'scouting'));
    tryOrder('search', home, [...free.values()]);
    return orders;
  }
  if (!state.hq) {
    const hqZone = owned.find(id => (index.poisByZone.get(id) ?? []).some(p => p.role === 'hq')) ?? home;
    tryOrder('establishHq', hqZone, pick(1, 'craft'));
  }

  // An HQ needs rooms: kitchen, watchtower, housing first.
  if (state.hq && !state.hq.building) for (const m of ['kitchen', 'watchtower', 'housing', 'medbay', 'depot', 'workshop', 'classroom', 'radioRoom', 'ammoLab', 'walls', 'refuge', 'lab']) {
    if (hqModules(state).includes(m) && tryOrder('module', state.hq.zoneId, pick(1, 'craft'), m)) break;
  } else if (state.hq?.building) tryOrder('module', state.hq.zoneId, pick(1, 'craft'), state.hq.building.id);
  // From phase 3: a network for an area where we hold enough.
  if (state.phase >= 3) {
    const l2s = [...new Set(owned.map(id => index.byId.get(id)?.parentId).filter(Boolean))] as string[];
    outer: for (const l2 of l2s) for (const net of ['roads', 'water', 'power', 'comms']) {
      if ((state.networks[l2] ?? []).includes(net)) continue;
      const zone = owned.find(id => index.byId.get(id)?.parentId === l2)!;
      if (tryOrder('network', zone, pick(1, 'craft'), net)) break outer;
    }
    for (const key of Object.keys(state.counters).filter(k => k.startsWith('network:'))) {
      const [, l2, net] = key.split(':');
      const zone = owned.find(id => index.byId.get(id)?.parentId === l2);
      if (zone) tryOrder('network', zone, pick(1, 'craft'), net);
    }
  }

  // Water and food first.
  const flows = dailyFlows(state, world);
  const water = state.stock.water ?? 0;
  const homeZone = state.zones[home];
  if ((flows.water.net < 0 || water < people * 8) && !homeZone.upgrades.includes('rainwater')) tryOrder('build', home, pick(1, 'craft'), 'rainwater');
  for (const id of owned) if (flows.water.net < 0 && !state.zones[id].upgrades.includes('rainwater') && (state.stock.building ?? 0) > 20) { if (tryOrder('build', id, pick(1, 'craft'), 'rainwater')) break; }
  const hungry = flows.food.daysLeft !== null && flows.food.daysLeft < 10;
  if (index.coastal.has(home) && (state.stock.boat ?? 0) >= 1 && hungry) tryOrder('fish', home, pick(2, 'scouting'));
  const farmZone = owned.find(id => (index.byId.get(id)?.measures?.farm ?? 0) > 5000);
  if (farmZone && hungry) tryOrder('farm', farmZone, pick(2, 'craft'));
  if (!homeZone.upgrades.includes('greenhouse') && has(state.stock, { building: 10, parts: 2 })) tryOrder('build', home, pick(1, 'craft'), 'greenhouse');

  // Hold the line.
  if ((index.adjacent.get(home) ?? []).some(a => a.kind === 'land' && state.zones[a.to].status !== 'controlled' && !(state.barricades[a.connId] > 0))) tryOrder('fortify', home, pick(1, 'craft'));
  for (const id of owned) if (state.zones[id].zombies > 0) tryOrder('clear', id, pick(2, 'combat'));

  // Research at HQ when someone is free and a project runs.
  if (state.hq && state.research.current && free.size >= 3) tryOrder('research', state.hq.zoneId, pick(1, 'craft'));

  // Expand: in phase one, try to build a *connected* neighbourhood around
  // the HQ before spreading across unrelated L2 areas. This is a bot policy,
  // not a rule that forces the human player down a single path. If the HQ
  // frontier is too dangerous or unreachable, the normal safe fallback stays.
  const hops = reach(state, world);
  const frontier = [...hops.entries()].filter(([id, d]) => d >= 1 && d <= 2 && state.zones[id].status !== 'controlled' && !state.zones[id].owner).map(([id]) => id);
  const coreFrontier = new Set<string>();
  if (state.phase === 1 && state.hq && !phaseOneReadiness(state, world).coreReady) {
    const hqL2 = index.byId.get(state.hq.zoneId)?.parentId;
    const connected = new Set([state.hq.zoneId]);
    const queue = [state.hq.zoneId];
    for (let i = 0; i < queue.length; i++) for (const edge of index.adjacent.get(queue[i]) ?? []) {
      if (index.byId.get(edge.to)?.parentId !== hqL2 ||
        (edge.linkId && ['blown', 'flooded'].includes(state.chokepoints[edge.linkId]))) continue;
      if (state.zones[edge.to]?.status === 'controlled') {
        if (!connected.has(edge.to)) { connected.add(edge.to); queue.push(edge.to); }
      } else if (!state.zones[edge.to]?.owner && (hops.get(edge.to) ?? 99) <= 1) coreFrontier.add(edge.to);
    }
  }
  const priority = (id: string) => coreFrontier.has(id) ? 0 : 1;
  const unscouted = frontier.filter(id => !state.zones[id].intel || state.zones[id].intel!.day < state.day - 5)
    .sort((a, b) => priority(a) - priority(b) || (hops.get(a) ?? 99) - (hops.get(b) ?? 99));
  if (unscouted.length) tryOrder('scout', unscouted[0], pick(1, 'scouting'));
  const known = frontier.filter(id => state.zones[id].intel)
    .sort((a, b) => priority(a) - priority(b) || state.zones[a].intel!.max - state.zones[b].intel!.max);
  const target = known.find(id => (hops.get(id) ?? 9) <= 1 && state.zones[id].intel!.max <= strength * 3);
  if (target) {
    const z = state.zones[target];
    if (z.intel!.max > 3) tryOrder('clear', target, pick(3, 'combat'));
    else if (!tryOrder('claim', target, pick(1, 'scouting'))) tryOrder('search', target, pick(2, 'craft'));
  }
  // Supplies from the closest searched-out-not-yet zone.
  const lootZone = [...hops.entries()].filter(([id, d]) => d <= 2 && !state.zones[id].owner && state.zones[id].searched < searchHoursTotal(index.byId.get(id)!) && (state.zones[id].intel?.max ?? 99) < 8).sort((a, b) => a[1] - b[1])[0]?.[0];
  if (lootZone) tryOrder('search', lootZone, pick(2, 'scouting'));

  // A raid on the gang when the odds are good.
  for (const f of state.factions.filter(x => x.known && x.hostile && !x.defeated)) {
    if ((hops.get(f.zoneId) ?? 9) > 2) continue;
    const crew = pick(4, 'combat');
    if (crew.length >= 3 && assaultOdds(state, crew, f).chance > .7) tryOrder('assault', f.zoneId, crew);
  }

  // Wonders: keep building them out when the materials are there.
  for (const [id, w] of Object.entries(state.wonders ?? {})) { if (tryOrder('wonder', w.zoneId, pick(2, 'craft'), id)) break; }
  // Upgrades when there is material.
  for (const id of owned) {
    const options = upgradesFor(state, world, id).map(u => u.id);
    const z = state.zones[id];
    if (z.building) { tryOrder('build', id, pick(1, 'craft'), z.building.id); continue; }
    for (const u of ['watchpost', 'field', 'fishing', 'rainwater']) if (options.includes(u) && tryOrder('build', id, pick(1, 'craft'), u)) break;
  }
  // Everyone left: search near home, or guard.
  for (const s of [...free.values()]) {
    if (lootZone && tryOrder('search', lootZone, [s])) continue;
    tryOrder('guard', home, [s]);
  }
  return orders;
}

export function botTrade(state: RegionState): RegionState {
  for (const f of state.factions.filter(x => x.known && !x.hostile && !x.defeated && x.relation > -40 && (x.tradedDay === undefined || state.day - x.tradedDay >= 3))) {
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
    let guard = 0;
    while (state.event && guard++ < 5) state = resolveEvent(state, world, botChooseEvent(state)).state;
    state = botManage(state, world);
    state = botTrade(state);
    state = endDay(state, world, botPlanDay(state, world)).state;
  }
  if (state.event) state = resolveEvent(state, world, botChooseEvent(state)).state;
  return state;
}
