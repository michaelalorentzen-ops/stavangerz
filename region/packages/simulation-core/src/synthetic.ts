import type { SimulationConfig, SimulationState, SimulationWorld } from './index';

/** H-only synthetic fixture. Names are roles, not real geography or balance. */
export const syntheticWorld: SimulationWorld = {
  zoneIds: ['start', 'crossroads', 'quay', 'supplies'],
  reservoirIds: ['outside-north'],
  connections: [
    { id: 'start-crossroads', fromId: 'start', toId: 'crossroads', allowZombies: true, capacityPerDirection: 8 },
    { id: 'crossroads-supplies', fromId: 'crossroads', toId: 'supplies', allowZombies: true, capacityPerDirection: 10 },
    { id: 'start-quay', fromId: 'start', toId: 'quay', allowZombies: true, capacityPerDirection: 6 },
    { id: 'quay-supplies-water', fromId: 'quay', toId: 'supplies', allowZombies: false, capacityPerDirection: 0 },
    { id: 'open-north', fromId: 'outside-north', toId: 'supplies', allowZombies: true, capacityPerDirection: 5 },
  ],
};
export const syntheticState: SimulationState = {
  day: 0,
  population: { start: 0, crossroads: 28, quay: 12, supplies: 20, 'outside-north': 30 },
  barriers: { 'start-crossroads': { durability: 3 } },
  stocks: { base: { food: 100, materials: 20 }, 'finite-cache': { food: 30 } },
};
export const syntheticConfig: SimulationConfig = { mobilityRate: .35, noiseWeight: 2, attemptsPerDurability: 3 };
