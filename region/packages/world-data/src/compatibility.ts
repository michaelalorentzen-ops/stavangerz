import type { WorldDefinition } from './model';
import type { ValidationIssue } from './validate';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/**
 * A conservative gate for an optional additive upgrade. This does not migrate a save.
 * This gate applies to published definitions; drafts may be edited in place.
 * Old published saves continue loading their original immutable worldVersion. Repartitioning,
 * changing existing geometry/access, or renaming IDs requires a separate explicit migration.
 * Labels, rationale, provenance and draft approval status may change in a NEW version.
 */
export function validateAdditiveExtension(previous: WorldDefinition, next: WorldDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (id: string, message: string) => issues.push({ code: 'incompatible-extension', id, message });
  if (previous.worldId !== next.worldId || previous.schemaVersion !== next.schemaVersion) add(previous.worldId, 'World identity and schema must stay unchanged');
  if (previous.status === 'draft' && next.status === 'draft') return issues;
  if (previous.worldVersion === next.worldVersion && canonical(previous) !== canonical(next)) add(previous.worldId, 'An existing worldVersion is immutable; publish a new version');
  const collections = ['zones', 'pois', 'edges', 'barriers', 'frontiers'] as const;
  for (const key of collections) {
    const replacements = new Map((next[key] ?? []).map(item => [item.id, item]));
    for (const item of previous[key] ?? []) {
      const replacement = replacements.get(item.id);
      if (!replacement) { add(item.id, `Existing ${key} ID was removed or renamed`); continue; }
      const structural = (entry: typeof item) => Object.fromEntries(Object.entries(entry).filter(([field]) => !['name', 'rationale', 'sourceIds'].includes(field)));
      if (canonical(structural(item)) !== canonical(structural(replacement))) add(item.id, 'Existing geometry, parent or gameplay-relevant definition changed');
    }
  }
  return issues;
}
