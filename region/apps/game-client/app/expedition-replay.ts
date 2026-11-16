/** UI-only projection. Pass one ALREADY REACHED, public replay stage, never the
 * completed report or resulting state. Nothing here reads private mission lines,
 * pending discoveries, hidden POIs, zombie totals or unreported cargo. */
import type { RegionOrder, RegionReplayStage, RegionState, RegionWorld, ReportLine } from '../../../packages/gameplay/src/region/types';
import { crewPositionFor } from '../../../packages/gameplay/src/region/location';
import { experienceEnvironment } from '../../../packages/gameplay/src/region/experiences';
import { resourceName } from '../../../packages/gameplay/src/region/engine';
import { discoveryArt, experienceArt } from './story-art';

export interface ExpeditionReplayScene {
  id: string;
  kind: 'departure' | 'scout' | 'search' | 'combat' | 'gear' | 'claim' | 'perimeter' | 'poi' | 'hq' | 'discovery' | 'warning' | 'arrival';
  phase: 'departure' | RegionReplayStage['phase'];
  title: string;
  text: string;
  result: string;
  zoneId?: string;
  zoneName?: string;
  participants: { id: string; name: string; role: string }[];
  voice?: { personId: string; name: string; text: string };
  image?: string;
  importance: number;
  tone: ReportLine['tone'];
  first: boolean;
  milestone: boolean;
  /** Optional complete, verified rendering of this public first-search result. */
  loot?: { items: { id: string; name: string; count: number }[]; progress: string };
}

const RESOURCE_IDS = new Set(['food', 'water', 'medicine', 'fuel', 'ammo', 'building', 'metal', 'parts', 'electronics', 'salt',
  'batteries', 'solar', 'generator', 'antibiotics', 'primers', 'radio', 'engine', 'boat', 'printer', 'explosives']);
/** The caller passes only the reached stage, never the following night. */
export function publicReplayMoves(stage?: RegionReplayStage) {
  return stage?.phase === 'night' ? stage.moves ?? [] : [];
}
function firstSearchLoot(experience: NonNullable<ReportLine['experience']>): ExpeditionReplayScene['loot'] {
  if (experience.kind !== 'search') return;
  const entries = Object.entries(experience.facts);
  // Fail closed on new/unrecognized facts. Never silently omit a resource or
  // transform a source sentence that these facts cannot completely reproduce.
  if (entries.some(([key]) => !RESOURCE_IDS.has(key) && !['searchBefore', 'searchAfter'].includes(key))) return;
  const amounts = entries.filter(([key]) => RESOURCE_IDS.has(key));
  if (!amounts.length || amounts.some(([, count]) => typeof count !== 'number' || !Number.isFinite(count) || count <= 0)) return;
  const items = amounts.map(([id, count]) => ({ id, name: resourceName(id), count: count as number }));
  const prefix = `${experience.participants.map(p => p.name).join(', ')} fant `;
  if (!experience.result.startsWith(prefix)) return;
  const match = experience.result.slice(prefix.length).match(/^(.+)\. (\d+ % gjennomsøkt\.)$/u);
  if (!match) return;
  const source = match[1].split(', ').sort();
  const actual = items.map(item => `${item.count} ${item.name.toLowerCase()}`).sort();
  if (source.length !== actual.length || source.some((value, index) => value !== actual[index])) return;
  return { items, progress: match[2] };
}

/** A planning intention, not evidence of departure or arrival. Only the first
 * outward expedition from the shelter gets this introduction. Static place
 * names are public geography; no POI or unobserved zone contents are consulted. */
export function departureScene(before: RegionState, world: RegionWorld, orders: readonly RegionOrder[]): ExpeditionReplayScene | undefined {
  if (before.phase !== 1 || ['scout', 'search', 'combat'].some(kind => before.flags[`experience:first:${kind}`])
    || before.experiences?.some(e => ['scout', 'search', 'combat'].includes(e.kind))) return;
  const active = new Set(Object.values(before.crewMissions ?? {}).filter(m => !['complete', 'failed'].includes(m.status)).flatMap(m => m.survivorIds));
  for (const order of orders) {
    if (order.zoneId === before.homeZoneId || !['scout', 'search', 'clear', 'claim', 'travel', 'investigate'].includes(order.action)) continue;
    const zone = world.zones.find(z => z.id === order.zoneId && z.level === 3);
    if (!zone) continue;
    const crew = before.survivors.filter(p => order.survivorIds.includes(p.id) && p.alive && !p.left && p.health > 0 && !active.has(p.id)
      && !(p.awayUntil !== undefined && p.awayUntil > before.day));
    // An incomplete/unavailable selection is not a departure to narrate.
    if (!crew.length || crew.length !== new Set(order.survivorIds).size || crew.some(p => {
      const position = crewPositionFor(before, p.id);
      return position?.kind !== 'zone' || position.zoneId !== before.homeZoneId;
    })) continue;
    const intentions: Record<string, string> = { scout: 'observere området', search: 'lete etter forsyninger', clear: 'bekjempe zombier', claim: 'forsøke å sikre området', travel: 'reise dit', investigate: 'undersøke et kjent spor' };
    const participants = crew.map(({ id, name, role }) => ({ id, name, role }));
    return {
      id: `departure:${before.day}:${order.id}`, kind: 'departure', phase: 'departure',
      title: 'Før avreise', zoneId: zone.id, zoneName: zone.name,
      text: `${participants.map(p => p.name).join(', ')} skal ${intentions[order.action]} i ${zone.name}.`,
      result: 'Utenfor tilholdsstedet må laget finne ut hva som faktisk venter. Det de kan rapportere, blir grunnlaget for neste trekk.',
      participants, importance: 55, tone: 'info', first: true, milestone: false,
      // An atmosphere illustration, not a pictured route or promised encounter.
      image: experienceArt('scout'),
    };
  }
}

function knownZone(before: RegionState, stage: RegionReplayStage, zoneId?: string): boolean {
  if (!zoneId) return true;
  const status = stage.mapSnapshot?.zones[zoneId]?.status ?? before.zones[zoneId]?.status;
  return status === 'scouted' || status === 'controlled';
}

function kindForLine(line: ReportLine): ExpeditionReplayScene['kind'] | undefined {
  if (line.category === 'discovery') return 'discovery';
  if (line.tone === 'bad') return 'warning';
  if (line.facts?.action === 'clear' && Number(line.facts.killed) > 0) return 'combat';
  if (line.facts?.action === 'search' && Number(line.facts.searchAfter) > Number(line.facts.searchBefore)) return 'search';
  if (line.category === 'loot' && ['Personlig utstyr funnet', 'Utstyr rapportert fra feltet'].includes(line.title)) return 'gear';
  if (line.category === 'loot' && / ble med$/u.test(line.title)) return 'arrival';
  if (line.tone === 'warn' && ((line.priority ?? 0) >= 80 || line.category === 'claim')) return 'warning';
}

/** Featured cards are bounded; all source report lines remain available in the
 * existing report. The caller additionally enforces the day's shared budget.
 * No lookahead: selection never scans another stage or the report's final lines. */
export function replayStageScenes(before: RegionState, world: RegionWorld, stage: RegionReplayStage): {
  featured: ExpeditionReplayScene[]; compact: readonly ReportLine[];
} {
  const featured: ExpeditionReplayScene[] = [];
  const sources = new Map<string, ReportLine>();
  const suppressed = new Set<ReportLine>();
  // Operation metadata is the only safe join: a shared zone, person's name or
  // present-day health cannot establish that two reports describe one fight.
  const foldedInjuries = new Map<ReportLine, ReportLine[]>();
  const injuryOwner = new Set<ReportLine>();
  for (const combat of stage.lines) {
    const experience = combat.experience;
    const orderId = combat.facts?.orderId, missionId = combat.facts?.missionId;
    if (experience?.kind !== 'combat' || Number(experience.facts.injuredCount ?? 0) <= 0
      || !knownZone(before, stage, experience.zoneId) || !knownZone(before, stage, combat.zoneId)
      || typeof orderId !== 'string' || !orderId.trim() || typeof missionId !== 'string' || !missionId.trim()) continue;
    const injuries = stage.lines.filter(line => !injuryOwner.has(line) && !line.experience && line.tone === 'bad'
      && line.category === 'loot' && /\bble skadet$/u.test(line.title)
      && line.facts?.orderId === orderId && line.facts?.missionId === missionId);
    if (injuries.length) {
      foldedInjuries.set(combat, injuries);
      for (const injury of injuries) { injuryOwner.add(injury); suppressed.add(injury); }
    }
  }
  for (const [index, line] of stage.lines.entries()) {
    if (injuryOwner.has(line)) continue;
    if (!knownZone(before, stage, line.zoneId)) continue;
    const experience = line.experience;
    if (experience) {
      if (!knownZone(before, stage, experience.zoneId)) continue;
      const injury = Number(experience.facts.injuredCount ?? 0) > 0;
      const namedInjuries = foldedInjuries.get(line) ?? [];
      featured.push({
        id: experience.id, kind: experience.kind, phase: stage.phase,
        title: experience.title, text: experience.text,
        result: [experience.result, ...namedInjuries.map(injury => `${injury.title}. ${injury.text}`)].join(' '),
        zoneId: experience.zoneId, zoneName: experience.zoneName,
        participants: experience.participants.map(p => ({ ...p })),
        voice: experience.voice ? { ...experience.voice } : undefined,
        image: experienceArt(experience.kind, experience.illustration, experience.milestone),
        importance: namedInjuries.length ? 115 : injury ? 110 : experience.milestone ? 105 : experience.kind === 'combat' ? 103
          : experience.kind === 'hq' ? 102 : ['claim', 'perimeter'].includes(experience.kind) ? 100
            : experience.kind === 'gear' ? 90 : 95,
        tone: namedInjuries.length ? 'bad' : injury ? 'warn' : line.tone, first: true, milestone: !!experience.milestone,
        loot: firstSearchLoot(experience),
      });
      sources.set(experience.id, line);
      continue;
    }
    const kind = kindForLine(line);
    if (!kind) continue;
    // A first-experience card already explains this operation. Avoid a second
    // picture of its ordinary result, but retain a separate serious warning.
    if (kind !== 'warning' && stage.lines.some(other => other.experience && other.experience.zoneId === line.zoneId
      && (other.experience.kind === kind || kind === 'discovery' && other.experience.kind === 'poi'))) {
      suppressed.add(line); continue;
    }
    // Static terrain is public geography, not hidden operational intelligence.
    // It prevents a routine coastal/forest/farm fight using an urban image.
    const environment = typeof line.facts?.illustration === 'string' ? line.facts.illustration
      : line.zoneId ? experienceEnvironment(world, line.zoneId) : undefined;
    const storyId = typeof line.facts?.storyId === 'string' ? line.facts.storyId : undefined;
    const discoveryId = typeof line.facts?.discoveryId === 'string' ? line.facts.discoveryId : undefined;
    featured.push({
      id: `${stage.phase}:${index}:${line.zoneId ?? 'camp'}`, kind, phase: stage.phase,
      title: line.title, text: '', result: line.text, zoneId: line.zoneId,
      zoneName: line.zoneId ? world.zones.find(z => z.id === line.zoneId)?.name : undefined,
      // Routine reports don't identify every participant; never infer them from
      // all orders or from the final crew roster/position.
      participants: [], image: kind === 'discovery' ? discoveryArt(storyId, discoveryId === 'tor-repair-notes' ? 'tor' : undefined, environment)
        : kind === 'warning' || kind === 'arrival' ? undefined : experienceArt(kind, environment),
      importance: line.tone === 'bad' ? 115 : kind === 'warning' ? 100 : kind === 'discovery' ? 80 : kind === 'arrival' ? 75 : kind === 'gear' ? 65 : 35,
      tone: line.tone, first: false, milestone: false,
    });
    sources.set(`${stage.phase}:${index}:${line.zoneId ?? 'camp'}`, line);
  }
  const selected = featured.sort((a, b) => b.importance - a.importance).slice(0, 3);
  const used = new Set(selected.map(scene => sources.get(scene.id)));
  // The compact strip carries actual warnings/progress, not routine inventory
  // returns or a fabricated "quiet day". Empty phases are allowed to be empty.
  const compact = stage.lines.filter(line => !used.has(line) && !suppressed.has(line) && !line.experience
    // A public travel-progress line reports the journey, not intelligence from
    // its still-unknown destination. It may say that work has not started yet.
    && (line.category === 'travel' || knownZone(before, stage, line.zoneId))
    && (line.tone === 'bad' || line.tone === 'warn' || line.category === 'discovery' || line.category === 'travel' || line.category === 'recovery'
      || line.facts?.action === 'search' || line.facts?.action === 'clear'))
    .sort((a, b) => (b.tone === 'bad' ? 100 : b.priority ?? 0) - (a.tone === 'bad' ? 100 : a.priority ?? 0)).slice(0, 2);
  return { featured: selected, compact };
}
