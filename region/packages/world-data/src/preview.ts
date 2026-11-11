import type { GameState, WorldDefinition } from './model';
/** Authoring preview only. No combat, population or economic state exists in M1. */
export function createPreviewState(world: WorldDefinition): GameState {
  return { schemaVersion: 1, worldId: world.worldId, worldVersion: world.worldVersion, day: 0,
    zoneStates: Object.fromEntries(world.zones.filter(z => z.level === 3).map(z => [z.id, {
      knowledge: z.id === 'cell-003' ? 'explored' : 'unknown',
      ...(z.id === 'cell-003' ? { observedDay: 0 } : {}), controlled: false,
    }])), poiStates: {}, edgeStates: {},
  };
}
