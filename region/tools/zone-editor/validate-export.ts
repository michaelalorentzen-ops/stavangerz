import { readFileSync } from 'node:fs';
import type { WorldDefinition } from '../../packages/world-data/src/model';
import { validateWorld } from '../../packages/world-data/src/validate';

const world = JSON.parse(readFileSync(process.argv[2], 'utf8')) as WorldDefinition;
const issues = validateWorld(world);
console.log(JSON.stringify({ valid: issues.length === 0, issueCount: issues.length, issues: issues.slice(0, 40) }));
