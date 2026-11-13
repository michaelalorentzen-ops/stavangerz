import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { validateAdditiveExtension } from '../packages/world-data/src/compatibility';
import type { GameState, Poi, WorldDefinition } from '../packages/world-data/src/model';
import { validateStateReferences, validateWorld } from '../packages/world-data/src/validate';
import { getWorldDefinition, resolveSavedWorld } from '../packages/world-data/src/worlds';

const path = new URL('../packages/world-data/data/world-draft.json', import.meta.url);
// This is checked-in authoring data, not an untrusted public JSON input endpoint.
const world = JSON.parse(readFileSync(path, 'utf8')) as WorldDefinition;
const started = performance.now();
const issues = validateWorld(world);
for (const issue of issues) console.error(`${issue.code}: ${issue.id}: ${issue.message}`);
assert.equal(issues.length, 0, 'Draft geography failed validation');
console.log(`Geography valid in ${Math.round(performance.now() - started)} ms`);
for (const level of [1, 2, 3] as const) console.log(`L${level}: ${world.zones.filter(z => z.level === level).length}`);
console.log(`POIs: ${world.pois.length}; edges: ${world.edges.length}; barriers: ${world.barriers.length}`);

const firstCell = world.zones.find(z => z.level === 3 && z.playable);
assert.ok(firstCell, 'M1 must contain at least one playable L3 cell');
assert.ok(world.zones.filter(z => z.level === 2).length >= 2, 'M1 must demonstrate at least two L2 areas');
const state: GameState = {
  schemaVersion: 1,
  worldId: world.worldId,
  worldVersion: world.worldVersion,
  day: 0,
  zoneStates: { [firstCell.id]: { knowledge: 'explored', observedDay: 0, controlled: false } },
  poiStates: {},
  edgeStates: {},
};
assert.deepEqual(validateStateReferences(state, world), []);
assert.throws(() => resolveSavedWorld(JSON.parse(JSON.stringify(state))), /Draft geography/, 'Editable drafts must not back published saves');
assert.throws(() => getWorldDefinition(world.worldId, 'missing-version'), /refusing to substitute/);
assert.ok(validateStateReferences({ ...state, zoneStates: { 'missing-cell': { knowledge: 'unknown', controlled: false } } }, world)
  .some(issue => issue.code === 'state-reference'), 'Unknown save IDs must be rejected');

// Add a POI using an existing valid location: new ID, no changes to any old object.
const firstPoi = world.pois[0];
assert.ok(firstPoi, 'M1 must contain a strategic POI');
const additionalPoi: Poi = { ...firstPoi, id: 'validation:additive-poi', name: 'Validation-only additional POI' };
const published: WorldDefinition = { ...world, status: 'approved' };
const next: WorldDefinition = { ...published, worldVersion: `${world.worldVersion}-extension-check`, pois: [...world.pois, additionalPoi] };
assert.deepEqual(validateAdditiveExtension(published, next), []);
assert.deepEqual(validateWorld(next), []);
assert.ok(validateStateReferences(state, next).some(issue => issue.code === 'state-version'),
  'Even a compatible extension cannot silently replace the world pinned by a save');
assert.deepEqual(validateStateReferences(state, world), [], 'The original save remains valid with its original world');

const renamed: WorldDefinition = {
  ...next, zones: next.zones.map(zone => zone.id === firstCell.id ? { ...zone, id: 'validation:renamed-cell' } : zone),
};
assert.ok(validateAdditiveExtension(published, renamed).some(issue => issue.id === firstCell.id), 'Renaming a zone must fail additive compatibility');
const changed: WorldDefinition = {
  ...next,
  zones: next.zones.map(zone => zone.id === firstCell.id ? {
    ...zone,
    geometry: { type: 'Polygon' as const, coordinates: [[[5, 58], [5.001, 58], [5.001, 58.001], [5, 58.001], [5, 58]]] as const },
  } : zone),
};
assert.ok(validateAdditiveExtension(published, changed).some(issue => issue.id === firstCell.id), 'Changing existing geometry must fail additive compatibility');
assert.ok(validateAdditiveExtension(published, { ...published, status: 'draft' }).length,
  'Changing an existing worldVersion in place must fail');
assert.deepEqual(validateAdditiveExtension(world, { ...changed, worldVersion: world.worldVersion, status: 'draft' }), [], 'Drafts can change before publication');
assert.ok((world.frontiers ?? []).length > 0, 'Land extent must explicitly remain unmodeled, not sealed');
console.log('PASS: editable drafts, open land extent, save references, additive IDs, immutable existing geography, pinned saves');
