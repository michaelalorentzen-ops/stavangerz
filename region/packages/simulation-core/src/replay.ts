import { resolveDay, type DayResult, type NoiseOrder, type ResourceOrder, type SimulationConfig, type SimulationState, type SimulationWorld } from './index';

export interface ReplayTurn {
  readonly daySeed: number;
  readonly noiseOrders: readonly NoiseOrder[];
  readonly resourceOrders?: readonly ResourceOrder[];
}
/** No I/O, wall clock or hidden seed changes. Caller supplies every day's plan. */
export function replayDays(world: SimulationWorld, initial: SimulationState, turns: readonly ReplayTurn[], config: SimulationConfig): { state: SimulationState; days: readonly DayResult[] } {
  let state = initial;
  const days: DayResult[] = [];
  for (const turn of turns) {
    const result = resolveDay(world, state, turn.noiseOrders, turn.daySeed, config, turn.resourceOrders);
    days.push(result); state = result.state;
  }
  return { state, days };
}
