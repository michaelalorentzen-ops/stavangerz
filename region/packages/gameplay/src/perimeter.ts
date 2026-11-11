import type { PlayState, Survivor } from './model';

export function controlledComponent(state: PlayState, start = state.base.zoneId) {
  const held = new Set<string>();
  if (!state.zones[start]?.claimed) return held;
  held.add(start);
  for (const id of held) for (const edge of state.simulationWorld.connections) {
    const next = edge.fromId === id ? edge.toId : edge.toId === id ? edge.fromId : '';
    if (next && state.zones[next]?.claimed) held.add(next);
  }
  return held;
}

export function exposedEdges(state: PlayState, start = state.base.zoneId) {
  const held = controlledComponent(state, start);
  return state.simulationWorld.connections.filter(edge =>
    edge.allowZombies && held.has(edge.fromId) !== held.has(edge.toId)
  ).sort((a,b) => a.id.localeCompare(b.id));
}

export function watchCoverage(state: PlayState, crew: readonly Survivor[]) {
  const capacity = crew.reduce((sum,p) => sum + (p.health >= 50 && p.fatigue < 70 ? 1 + Number(p.skills.scouting >= 5) : 0), 0);
  return exposedEdges(state).filter(edge => !(state.sim.barriers[edge.id]?.durability > 0)).slice(0, capacity);
}

export function districtReadiness(state: PlayState) {
  const districtId = state.worldSnapshot.zones.find(z => z.id === state.base.zoneId)?.parentId;
  const cells = state.worldSnapshot.zones.filter(z => z.level === 3 && z.parentId === districtId && z.playable);
  const held = controlledComponent(state);
  const controlled = cells.filter(z => held.has(z.id)).length;
  const exposed = exposedEdges(state);
  const defended = exposed.filter(e => (state.sim.barriers[e.id]?.durability ?? 0) > 0).length;
  return { name: state.worldSnapshot.zones.find(z => z.id === districtId)?.name ?? 'Distrikt', controlled, total: cells.length,
    exposed: exposed.length, defended, complete: !!state.phaseOne?.hq && cells.length > 0 && controlled === cells.length && exposed.length === defended };
}
