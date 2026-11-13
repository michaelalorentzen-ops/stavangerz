/** D24: opt-in is insufficient without a physically reserved radio and a live path. */
import type { RegionState, RegionWorld, RegionOrder } from './types';
import type { CrewMission } from './location';
import { centralAvailablePopulation } from './administration';
import { crewPositionFor } from './location';
import { ensureMobility, localStock, routeBetween } from './mobility';
export function reserveMissionRadio(state: RegionState, mission: CrewMission): boolean {
  if (!mission.order?.communication?.radio) return false;
  ensureMobility(state);
  const carrier = mission.order.communication.leaderId ?? mission.survivorIds[0];
  const stock = localStock(state, mission.originZoneId);
  if (!mission.survivorIds.includes(carrier) || (stock.radio ?? 0) < 1 || (stock.batteries ?? 0) < 1) return false;
  stock.radio -= 1; stock.batteries -= 1;
  state.mobility!.radios[mission.id] = { carrierId: carrier, originZoneId: mission.originZoneId, radio: 1, batteries: 1 };
  return true;
}
export function communicationsStatus(state: RegionState, world: RegionWorld, crewIds: readonly string[]): { connected: boolean; reason: string; carrierId?: string } {
  const mission = Object.values(state.crewMissions ?? {}).find(m => m.survivorIds.some(id => crewIds.includes(id)) && !['complete', 'failed'].includes(m.status));
  const radio = mission && state.mobility?.radios[mission.id];
  if (!radio || radio.radio < 1 || radio.batteries <= 0 || !state.survivors.some(p => p.id === radio.carrierId && p.alive && !p.left && p.health > 0)) return { connected: false, reason: 'Ingen fungerende radio følger dette laget.' };
  const staffed = centralAvailablePopulation(state).adults > 0 || state.survivors.some(person => {
    const position = crewPositionFor(state, person.id);
    return person.alive && !person.left && person.health >= 25 && !(person.awayUntil && person.awayUntil > state.day) && !state.mobility?.reservedAwayIds?.includes(person.id) && position?.kind === 'zone' && position.zoneId === state.homeZoneId;
  });
  const endpoint = staffed && ((state.stock.radio ?? 0) >= 1 || state.hq?.modules.includes('radioRoom')) && (state.stock.batteries ?? 0) > 0;
  if (!endpoint) return { connected: false, reason: 'HQ mangler en bemannet, strømført radioende.' };
  const zone = mission!.routeZoneIds?.[mission!.routeIndex ?? 0] ?? mission!.targetZoneId;
  const route = routeBetween(state, world, zone, state.homeZoneId);
  const relayed = world.zones.find(z => z.id === zone)?.parentId;
  const linked = relayed && state.networks[relayed]?.includes('comms');
  if (!route || route.length - 1 > (linked ? 8 : 3)) return { connected: false, reason: 'Sambandet er utenfor rekkevidde eller forbindelsen er brutt.' };
  return { connected: true, reason: 'Fysisk radio, strøm og sammenhengende radiorekkevidde er bekreftet.', carrierId: radio.carrierId };
}
export function shouldEscalateField(state: RegionState, world: RegionWorld, order: RegionOrder, avatarId?: string): boolean {
  if (avatarId && order.survivorIds.includes(avatarId)) return true;
  return !!order.communication?.contactOnCritical && communicationsStatus(state, world, order.survivorIds).connected;
}
export function fieldMandate(state: RegionState, order: RegionOrder): 'proceed' | 'withdraw' {
  const leader = state.survivors.find(p => p.id === (order.communication?.leaderId ?? order.survivorIds[0]));
  const mandate = order.communication?.mandate ?? (leader?.traits?.includes('hard') ? 'bold' : leader?.traits?.includes('suspicious') ? 'cautious' : 'balanced');
  const strength = order.survivorIds.reduce((n, id) => n + (state.survivors.find(p => p.id === id)?.skills.combat ?? 0) + 2, 0);
  return (state.zones[order.zoneId]?.zombies ?? 0) > strength * (mandate === 'bold' ? 10 : mandate === 'cautious' ? 3 : 6) ? 'withdraw' : 'proceed';
}
