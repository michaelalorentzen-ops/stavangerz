/** Curated local atmosphere art. These are illustrations, never operational intelligence.
 * Callers authorize the already-reported experience/discovery/known wonder before selecting a key.
 * This resolver intentionally cannot inspect world state, hidden terrain, POIs or current outcomes.
 */
export const STORY_ENVIRONMENTS = Object.freeze({
  residential: '/art/environments/residential.webp',
  shop: '/art/environments/shop.webp',
  industrial: '/art/environments/industrial.webp',
  coast: '/art/environments/coast.webp',
  forest: '/art/environments/forest.webp',
  farm: '/art/environments/farm.webp',
} as const);
export const STORY_WONDERS = Object.freeze({
  cruise: '/art/wonders/cruise.webp',
  utstein: '/art/wonders/utstein.webp',
  tower: '/art/wonders/tower.webp',
  plane: '/art/wonders/plane.webp',
  cathedral: '/art/wonders/cathedral.webp',
  arena: '/art/wonders/arena.webp',
} as const);
/** Event scenes complement the reported environment; they never assert a
 * specific building, injury, item count or participant beyond the report. */
export const EXPERIENCE_SCENES = Object.freeze({
  scout: '/art/experiences/scout.webp',
  poi: '/art/experiences/poi.webp',
  claim: '/art/experiences/claim.webp',
  perimeter: '/art/experiences/perimeter.webp',
  combat: '/art/experiences/combat.webp',
  search: '/art/experiences/search.webp',
  gear: '/art/experiences/gear.webp',
} as const);
const COMBAT_SCENES = Object.freeze({
  farm: '/art/experiences/combat-farm.webp',
  coast: '/art/experiences/combat-coast.webp',
  forest: '/art/experiences/combat-forest.webp',
  industrial: '/art/experiences/combat-industrial.webp',
} as const);
const EARNED_SCENES = Object.freeze({
  'hq-defence': '/art/experiences/perimeter.webp',
  'phase-2': '/art/phases/2.webp',
  'phase-3': '/art/phases/3.webp',
  'phase-4': '/art/phases/4.webp',
  'phase-5': '/art/phases/5.webp',
  'ten-zones': '/art/experiences/claim.webp',
} as const);
export type StoryEnvironment = keyof typeof STORY_ENVIRONMENTS;
export type StoryWonder = keyof typeof STORY_WONDERS;

/** `industry` is the first-experience contract alias; HQ reuses the existing decorative phase art. */
export function environmentArt(key?: string): string | undefined {
  if (key === 'industry') key = 'industrial';
  if (key === 'hq') return '/art/phases/2.webp';
  return key && Object.hasOwn(STORY_ENVIRONMENTS, key)
    ? STORY_ENVIRONMENTS[key as StoryEnvironment] : undefined;
}
/** Presentation only: existing saved memories retain their recorded facts. */
export function experienceArt(kind: string, environment?: string, milestone?: string): string | undefined {
  if (milestone && Object.hasOwn(EARNED_SCENES, milestone)) return EARNED_SCENES[milestone as keyof typeof EARNED_SCENES];
  const scene = environment === 'industry' ? 'industrial' : environment;
  if (kind === 'combat' && scene && Object.hasOwn(COMBAT_SCENES, scene)) return COMBAT_SCENES[scene as keyof typeof COMBAT_SCENES];
  return Object.hasOwn(EXPERIENCE_SCENES, kind)
    ? EXPERIENCE_SCENES[kind as keyof typeof EXPERIENCE_SCENES] : environmentArt(environment);
}
/** Only six registered asset IDs; unknown IDs and arbitrary URL/path strings have no fallback. */
export function wonderArt(id?: string): string | undefined {
  return id && Object.hasOwn(STORY_WONDERS, id) ? STORY_WONDERS[id as StoryWonder] : undefined;
}
/** Manifest-relative semantic paths plus plain environment keys; never constructs an arbitrary URL. */
export function storyArtPath(key?: string): string | undefined {
  if (!key) return undefined;
  if (key.startsWith('environments/')) return environmentArt(key.slice('environments/'.length));
  if (key.startsWith('wonders/')) return wonderArt(key.slice('wonders/'.length));
  return environmentArt(key);
}
