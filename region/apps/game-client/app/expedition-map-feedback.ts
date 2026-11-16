/** Short, read-only map accents for already-published expedition experiences.
 * The caller supplies the active replay stage, never a future committed report.
 * No engine state, camera, map feature-state or world data is changed here.
 */
import type { Map as LibreMap, Marker } from 'maplibre-gl';
import type { RegionState, RegionWorld, ReportLine } from '../../../packages/gameplay/src/region/types';

export interface ExpeditionMapFeedback { key: string; lines: readonly ReportLine[] }
export type MapExperienceKind = 'scout' | 'search' | 'combat' | 'gear' | 'perimeter' | 'poi' | 'hq';
export interface ExpeditionMapCue { id: string; kind: MapExperienceKind; zoneId: string; at: [number, number]; title: string; result: string }
/** This deliberately narrow projection also reads old report types safely.
 * Full narrative snapshots belong to the engine; this adapter needs no private state.
 */
type PublishedExperience = { version?: number; id?: unknown; kind?: unknown; zoneId?: unknown; title?: unknown; result?: unknown };
const PRIORITY: Record<MapExperienceKind, number> = { hq: 7, gear: 6, perimeter: 5, combat: 4, poi: 3, search: 2, scout: 1 };
const LABELS: Record<MapExperienceKind, string> = { scout: 'Området kartlagt', search: 'Søk gjennomført', combat: 'Kamp registrert', gear: 'Nytt utstyr', perimeter: 'Et varig vern', poi: 'Et sted å undersøke', hq: 'Et fast tilhold' };
const PATHS: Record<MapExperienceKind, string> = {
  scout: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M10 6v8M6 10h8"/>',
  search: '<path d="m4 8 8-4 8 4-8 4-8-4Zm0 0v9l8 4 8-4V8M12 12v9"/>',
  combat: '<path d="m5 3 14 14-2 2L3 5V3h2Zm14 0L5 17l2 2L21 5V3h-2ZM3 17l4 4m10-4 4 4"/>',
  gear: '<path d="M8 6V4h8v2M5 6h14v15H5V6ZM5 11h14M10 10v3h4v-3"/>',
  perimeter: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  poi: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  hq: '<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',
};

/** Only authoritative snapshots from the supplied public lines qualify.
 * Claims already have polygon-clipped flood fill and are never duplicated.
 */
export function expeditionMapCues(lines: readonly ReportLine[], world: RegionWorld, zones: RegionState['zones']): ExpeditionMapCue[] {
  const byId = new Map(world.zones.map(zone => [zone.id, zone]));
  const byZone = new Map<string, ExpeditionMapCue>();
  for (const line of lines) {
    const experience = (line as ReportLine & { experience?: PublishedExperience }).experience;
    if (!experience || experience.version !== 1 || typeof experience.id !== 'string' || typeof experience.kind !== 'string' || !Object.hasOwn(PRIORITY, experience.kind)
      || typeof experience.zoneId !== 'string' || typeof experience.title !== 'string' || typeof experience.result !== 'string') continue;
    const zone = byId.get(experience.zoneId), status = zones[experience.zoneId]?.status;
    if (zone?.level !== 3 || !zone.at?.every(Number.isFinite) || !status || status === 'unknown') continue;
    const kind = experience.kind as MapExperienceKind;
    const cue = { id: experience.id, kind, zoneId: experience.zoneId, at: zone.at, title: experience.title, result: experience.result };
    const old = byZone.get(cue.zoneId);
    if (!old || PRIORITY[kind] > PRIORITY[old.kind]) byZone.set(cue.zoneId, cue);
  }
  return [...byZone.values()].sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.zoneId.localeCompare(b.zoneId));
}

export interface ExpeditionFeedbackController {
  show(feedback: ExpeditionMapFeedback | null | undefined, state: RegionState, reducedMotion: boolean): void;
  clear(): void;
  destroy(): void;
}

/** One timeout per live cue batch; CSS motion ends by itself. No RAF/interval.
 * Offscreen/unknown cues are dropped, never queued for a later camera move.
 */
export function attachExpeditionMapFeedback(map: LibreMap, lib: typeof import('maplibre-gl'), world: RegionWorld): ExpeditionFeedbackController {
  let markers: { cue: ExpeditionMapCue; marker: Marker }[] = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;
  let contextLost = false;
  const seen = new Set<string>();
  const clear = () => { if (timeout !== undefined) clearTimeout(timeout); timeout = undefined; markers.forEach(({ marker }) => marker.remove()); markers = []; };
  const inView = (cue: ExpeditionMapCue) => {
    if (destroyed || contextLost || document.hidden || !map.getSource('l3') || map.getZoom() < 12 || !map.getBounds().contains(cue.at)) return false;
    const status = map.getFeatureState({ source: 'l3', id: cue.zoneId }).s;
    if (!status || status === 'unknown') return false;
    const point = map.project(cue.at), canvas = map.getCanvas();
    // The replay summary occupies the upper map. Put the short field result
    // below its geographic point, with room for the chip above the lower HUD.
    // Drop edge results instead of moving the camera or covering the controls.
    if (point.x < 100 || point.x > canvas.clientWidth - 100 || point.y < 145 || point.y > canvas.clientHeight - 130) return false;
    const bounds = canvas.getBoundingClientRect();
    // Reserve the maximum chip rectangle, not merely its geographic anchor.
    const chip = { left: bounds.left + point.x - 100, right: bounds.left + point.x + 100, top: bounds.top + point.y + 40, bottom: bounds.top + point.y + 120 };
    return ![...document.querySelectorAll('.rz-replay-card,.sz-top,.sz-search[open],.sz-brief-wrap,.sz-territory-button')].some(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && chip.left < rect.right && chip.right > rect.left && chip.top < rect.bottom && chip.bottom > rect.top;
    });
  };
  const prune = () => {
    if (document.hidden) { clear(); return; }
    markers = markers.filter(({ cue, marker }) => { if (inView(cue)) return true; marker.remove(); return false; });
    if (!markers.length && timeout !== undefined) { clearTimeout(timeout); timeout = undefined; }
  };
  const lost = () => { contextLost = true; clear(); };
  const restored = () => { contextLost = false; };
  const remove = () => destroy();
  map.on('move', prune); map.on('zoom', prune); map.on('remove', remove);
  const canvas = map.getCanvas(); canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  document.addEventListener('visibilitychange', prune);
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; clear(); seen.clear();
    map.off('move', prune); map.off('zoom', prune); map.off('remove', remove);
    canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); document.removeEventListener('visibilitychange', prune);
  };
  return {
    show(feedback, state, reducedMotion) {
      if (destroyed) return;
      if (!feedback) { clear(); return; }
      if (seen.has(feedback.key)) { prune(); return; }
      clear(); seen.add(feedback.key);
      if (seen.size > 64) seen.delete(seen.values().next().value!);
      const occupied: { x: number; y: number }[] = [];
      for (const cue of expeditionMapCues(feedback.lines, world, state.zones).filter(inView)) {
        if (markers.length >= 5) break;
        const point = map.project(cue.at);
        if (occupied.some(other => Math.abs(other.x - point.x) < 180 && Math.abs(other.y - point.y) < 80)) continue;
        occupied.push(point);
        const element = document.createElement('div');
        element.className = `rz-expedition-cue rz-expedition-cue-${cue.kind}${reducedMotion ? ' is-still' : ''}`;
        element.dataset.experienceId = cue.id; element.dataset.experienceKind = cue.kind;
        element.setAttribute('aria-hidden', 'true'); // The accessible full account is in the report.
        const icon = document.createElement('span'); icon.className = 'rz-expedition-cue-icon';
        // SVG content is a closed local constant, never report/user text.
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PATHS[cue.kind]}</svg>`;
        const text = document.createElement('span'); text.className = 'rz-expedition-cue-text';
        const title = document.createElement('strong'); title.textContent = LABELS[cue.kind];
        const result = document.createElement('small'); result.textContent = cue.result;
        text.append(title, result); element.append(icon, text);
        const marker = new lib.Marker({ element, anchor: 'top', offset: [0, 40] }).setLngLat(cue.at).addTo(map);
        markers.push({ cue, marker });
      }
      if (markers.length) timeout = setTimeout(clear, 2400);
    }, clear, destroy,
  };
}
