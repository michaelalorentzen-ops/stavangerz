import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { joinAreas, syncReferences } from '../packages/world-data/src/editor-geometry';
import { isMapExtract, type MapExtract } from '../packages/world-data/src/editor-osm';
import type { AreaGeometry, WorldDefinition } from '../packages/world-data/src/model';
import { geometryIssues, validateWorld } from '../packages/world-data/src/validate';

const output = resolve('dist');
const input: WorldDefinition = JSON.parse(readFileSync(resolve(output, 'geografi-41-work.json'), 'utf8'));
const world = syncReferences(input, input.zones);
if (world.status !== 'draft' || world.zones.filter(zone => zone.level === 3).length !== 41) {
  throw new Error('Expected the separate 41-zone draft.');
}
const issues = validateWorld(world);
if (issues.length) throw new Error(JSON.stringify(issues, null, 2));

const parsed: MapExtract = JSON.parse(readFileSync(resolve(output, 'geografi-41-context-work.json'), 'utf8'));
const blocks = [...parsed.blocks ?? []];
for (let i = 0; i < blocks.length; i++) {
  if (!geometryIssues('kartflate', blocks[i]).length) continue;
  let repaired = false;
  for (let j = 0; j < blocks.length; j++) {
    if (i === j) continue;
    let merged: AreaGeometry;
    try { merged = joinAreas(blocks[i], blocks[j]); }
    catch { continue; }
    if (merged.type !== 'Polygon' || geometryIssues('kartflate', merged).length) continue;
    blocks[j] = merged;
    blocks.splice(i, 1);
    i--;
    repaired = true;
    break;
  }
  if (!repaired) throw new Error('Could not join a numerically invalid map block to its neighbor.');
}
const extract: MapExtract = {...parsed, blocks};
if (!isMapExtract(extract)) throw new Error('Invalid map context.');
const backup = {
  world,
  locked: [],
  mapLibrary: { extracts: [extract], active: extract.name },
};
writeFileSync(resolve(output, 'stavanger-z-world-41-road-draft.json'), JSON.stringify(world, null, 2));
writeFileSync(resolve(output, 'stavanger-z-41-soner-veigrenser-utkast.json'), JSON.stringify(backup));
console.log('Validated 41 zones and wrote WorldDefinition plus editor backup.');
