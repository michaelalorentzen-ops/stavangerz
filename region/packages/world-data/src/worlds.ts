import draft from '../data/world-draft.json';
import type { GameState, WorldDefinition } from './model';
import { validateStateReferences } from './validate';

/** Keep prior published definitions registered when introducing another version. */
const definitions: ReadonlyMap<string, WorldDefinition> = new Map([
  [`${draft.worldId}@${draft.worldVersion}`, draft as unknown as WorldDefinition],
]);

export function getWorldDefinition(worldId: string, worldVersion: string): WorldDefinition {
  const world = definitions.get(`${worldId}@${worldVersion}`);
  if (!world) throw new Error(`World definition unavailable: ${worldId}@${worldVersion}; refusing to substitute a newer map`);
  return world;
}

/** Resolve exactly the definition a saved state references, never the newest map. */
export function resolveSavedWorld(state: GameState): WorldDefinition {
  const world = getWorldDefinition(state.worldId, state.worldVersion);
  if (world.status === 'draft') throw new Error('Draft geography is editable and cannot back a published saved game');
  const issues = validateStateReferences(state, world);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join('; '));
  return world;
}
