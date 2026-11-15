/** Saved presentation of authoritative outcomes. No randomness, rewards or new simulation. */
import { GEAR_CATALOG } from './gear';
import type { ExpeditionExperience, ExperienceKind, RegionOrder, RegionReport, RegionState, RegionSurvivor, RegionWorld, ReportLine, Stock } from './types';
const ORIGIN = 'experience:origin';
export const experienceMarker = (kind: ExperienceKind) => `experience:first:${kind}`;
const marker = experienceMarker;
/** Permanent, bounded public journal; old saves may fall back to retained public reports. */
export function recordedExperiences(state: RegionState): ExpeditionExperience[] {
  const seen = new Set<ExperienceKind>();
  return [...(state.experiences ?? []), ...state.reports.flatMap(report => report.lines.flatMap(line => line.experience ? [line.experience] : []))].filter(experience => {
    if (seen.has(experience.kind)) return false; seen.add(experience.kind); return true;
  }).sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
}
export const hasRecordedExperience = (state: RegionState, kind: ExperienceKind) => !!state.flags[marker(kind)] || recordedExperiences(state).some(experience => experience.kind === kind);
export function initializeExperienceJournal(state: RegionState) { state.flags[ORIGIN] = 'new'; }
type Illustration = ExpeditionExperience['illustration'];
export function experienceEnvironment(world: RegionWorld, zoneId: string): Illustration {
  const m = world.zones.find(z => z.id === zoneId)?.measures;
  if (!m) return 'residential';
  const size = Math.max(1, m.m2);
  if (m.farm / size > .2) return 'farm';
  if (m.forest / size > .35) return 'forest';
  if (m.industry / size > .12) return 'industry';
  if (m.retail / size > .06) return 'shop';
  if (m.coastM > 100 && m.homes < 15) return 'coast';
  return 'residential';
}
const TITLES: Record<ExperienceKind, string> = {
  scout: 'Et kart med noe å stole på', search: 'Det vi kan bære', combat: 'Etter møtet med de døde', gear: 'Et funn får en eier',
  claim: 'Et sted å holde', perimeter: 'En grense som kan holde', poi: 'Et navn blir et sted', hq: 'Fra tilflukt til hovedkvarter',
};
const TEXTS: Record<ExperienceKind, string> = {
  scout: 'Laget må skille mellom det de vet og det de håper. Speidingen gir dem noe å stole på — men bare et øyeblikksbilde av et område som kan forandre seg.',
  search: 'De leter etter noe som kan gjøre neste døgn mulig. Ingen av dem kan bære alt; funnene må få plass sammen med det de trenger for å komme hjem.',
  combat: 'Etterpå er det ikke bare antallet døde som betyr noe. Det er menneskene som var der sammen. Neste oppdrag må planlegges med det de nettopp lærte.',
  gear: 'Et verktøy som gjør en vanskelig jobb mulig, får fort en historie. Dette funnet hører til menneskene og oppdraget som brakte det fram. Veien til felleslageret må de fortsatt fullføre.',
  claim: 'Et område er ikke lenger bare noe de prøver å komme seg gjennom. Det er noe de har tatt ansvar for. Hver ny grense betyr både litt mer fotfeste og litt mer å holde.',
  perimeter: 'Forsvarsverket gir gruppen noe fast å støtte seg til. Det erstatter ikke menneskene som holder vakt — og det vil trenge dem igjen når det slites.',
  poi: 'Et navn på kartet har fått mer betydning. Det kan bli et holdepunkt, et spørsmål eller en omvei de ikke har råd til ennå. Hva de vil gjøre med stedet, er ikke avgjort.',
  hq: 'Tilflukten har fått en varig oppgave. Nå kan gruppen tenke på hvem de vil bli — samtidig som noen fortsatt må skaffe det de lever av og holde stedet trygt.',
};
const HELP: Record<ExperienceKind, string> = { scout: 'scout', search: 'search', combat: 'clear', gear: 'gear', claim: 'claim', perimeter: 'fortify', poi: 'poi', hq: 'hq' };
const PREFERRED: Record<ExperienceKind, string> = { scout: 'ingrid', search: 'leila', combat: 'marius', gear: 'tor', claim: 'ingrid', perimeter: 'tor', poi: 'ingrid', hq: 'leila' };
const VOICES: Record<ExperienceKind, string> = {
  scout: 'Et anslag er bedre enn å gjette. Vi må fortsatt se oss for.', search: 'Det vi kan bære, er det vi faktisk kan leve av.',
  combat: 'Vi må telle hvem som kommer med oss videre, ikke bare de døde.', gear: 'Et godt verktøy må være med den som trenger det.',
  claim: 'Nå må vi holde det vi har tatt ansvar for.', perimeter: 'En sperring gjør bare jobben sin så lenge vi vedlikeholder den.',
  poi: 'Et navn på kartet er en begynnelse. Vi må fortsatt undersøke stedet.', hq: 'Nå kan vi begynne å planlegge mer enn neste natt.',
};
function make(state: RegionState, world: RegionWorld, kind: ExperienceKind, zoneId: string, crew: readonly RegionSurvivor[], sourceId: string,
  result: string, facts: ExpeditionExperience['facts'] = {}, illustration?: Illustration): ExpeditionExperience {
  const candidates = crew.filter(p => p.alive && p.health > 0 && !p.left);
  const speaker = candidates.find(p => p.id === PREFERRED[kind]) ?? candidates.find(p => p.traits?.includes(kind === 'combat' ? 'hard' : 'kind')) ?? candidates[0];
  return { version: 1, id: `experience:${kind}:${state.day}:${sourceId}`, kind, day: state.day, zoneId,
    zoneName: world.zones.find(z => z.id === zoneId)?.name ?? zoneId, title: TITLES[kind], text: TEXTS[kind], result,
    participants: crew.map(({ id, name, role }) => ({ id, name, role })),
    ...(speaker ? { voice: { personId: speaker.id, name: speaker.name, text: VOICES[kind] } } : {}),
    facts: { ...facts }, illustration: illustration ?? experienceEnvironment(world, zoneId), helpTopic: HELP[kind],
    record: state.flags[ORIGIN] === 'new' ? 'first' : 'first-recorded' };
}
function append(state: RegionState, lines: ReportLine[], experience: ExpeditionExperience) {
  if (hasRecordedExperience(state, experience.kind) || lines.some(line => line.experience?.kind === experience.kind)) return;
  // A candidate is transported inside privateLines until a real witness reports it.
  // Only finalizeExperienceReport consumes the campaign-wide first marker.
  lines.push({ category: 'experience', tone: 'info', priority: 60, title: experience.title, text: experience.result, zoneId: experience.zoneId, experience });
}
export interface OperationExperienceSnapshot {
  status: string; searched: number; health: Record<string, number>; stock: Stock; killed: number;
  gearIds: string[]; barricades: Record<string, number>; upgrades: string[]; modules: string[]; hadHq: boolean;
}
/** Capture immediately before a valid operation, after travel/cargo reservation. */
export function captureOperationExperience(state: RegionState, order: RegionOrder, killed: number): OperationExperienceSnapshot {
  const z = state.zones[order.zoneId];
  return { status: z.status, searched: z.searched, health: Object.fromEntries(order.survivorIds.map(id => [id, state.survivors.find(p => p.id === id)?.health ?? 0])),
    stock: { ...state.stock }, killed, gearIds: (state.gear?.items ?? []).map(i => i.id), barricades: { ...state.barricades }, upgrades: [...z.upgrades], modules: [...(state.hq?.modules ?? [])], hadHq: !!state.hq };
}
/** Only outcomes of the operation that just ran. Neither creates nor publishes knowledge. */
export function recordOperationExperience(state: RegionState, world: RegionWorld, order: RegionOrder, before: OperationExperienceSnapshot,
  killed: number, lines: ReportLine[], lineStart: number, crew: readonly RegionSurvivor[]) {
  if (!crew.some(p => p.alive && p.health > 0 && !p.left)) return;
  const produced = lines.slice(lineStart), zone = state.zones[order.zoneId];
  const source = (category: string) => produced.find(l => l.facts?.action === category || l.category === category) ?? produced.at(-1);
  const add = (kind: ExperienceKind, result: string, facts: ExpeditionExperience['facts'] = {}, illustration?: Illustration) => append(state, lines, make(state, world, kind, order.zoneId, crew, order.id, result, facts, illustration));
  if (order.action === 'scout' && zone.intel?.day === state.day) add('scout', source('scout')?.text ?? 'Observasjonen er rapportert.', { minimum: zone.intel.min, maximum: zone.intel.max });
  if (order.action === 'search' && zone.searched > before.searched) {
    const recovered = Object.fromEntries(Object.entries(state.stock).filter(([id, amount]) => amount > (before.stock[id] ?? 0)).map(([id, amount]) => [id, amount - (before.stock[id] ?? 0)]));
    add('search', source('search')?.text ?? 'Søket er gjennomført.', { searchBefore: before.searched, searchAfter: zone.searched, ...recovered });
    const gear = (state.gear?.items ?? []).filter(item => !before.gearIds.includes(item.id) && item.provenance?.kind === 'search' && item.provenance.zoneId === order.zoneId);
    if (gear.length) add('gear', `Funnet: ${gear.map(item => GEAR_CATALOG[item.kind]?.name ?? item.kind).join(', ')}. Utstyret må følge laget fram til faktisk levering.`, { itemCount: gear.length, itemKinds: gear.map(item => item.kind).join(', ') });
  }
  const killedHere = Math.max(0, killed - before.killed), injured = crew.filter(p => p.health < before.health[p.id]).length;
  if (['clear', 'search', 'claim'].includes(order.action) && (killedHere > 0 || order.action === 'clear' && injured > 0)) add('combat', `${killedHere} zombier ble drept under oppdraget.${injured ? ` ${injured} i laget ble skadet.` : ''}`, { killed: killedHere, injuredCount: injured, ammoUsed: Math.max(0, (before.stock.ammo ?? 0) - (state.stock.ammo ?? 0)) });
  if (before.status !== 'controlled' && zone.status === 'controlled' && ['claim', 'assault'].includes(order.action)) add('claim', 'Sonen er nå kontrollert av gruppen.', { controlled: true });
  const newBarriers = Object.entries(state.barricades).filter(([id, durability]) => durability > (before.barricades[id] ?? 0)).length;
  const builtPost = zone.upgrades.some(id => ['watchpost', 'barricades'].includes(id) && !before.upgrades.includes(id));
  const builtModule = (state.hq?.modules ?? []).some(id => ['gate', 'watchtower', 'walls', 'overview'].includes(id) && !before.modules.includes(id));
  if (['fortify', 'block', 'build', 'module'].includes(order.action) && (newBarriers > 0 || builtPost || builtModule)) add('perimeter', source(order.action)?.text || 'Et varig forsvarsverk er ferdig bygget.', { barriersBuiltOrStrengthened: newBarriers, completedPost: builtPost, completedHqDefence: builtModule });
  if (!before.hadHq && state.hq?.zoneId === order.zoneId && order.action === 'establishHq') add('hq', produced.find(l => l.title.startsWith('HQ etablert:'))?.text ?? 'HQ er etablert.', { hqType: state.hq.type }, 'hq');
  if (['scout', 'search'].includes(order.action)) {
    const poi = world.pois.filter(p => p.zoneId === order.zoneId).sort((a, b) => a.id.localeCompare(b.id))[0];
    if (poi) add('poi', `${poi.name} er registrert i ${world.zones.find(z => z.id === order.zoneId)?.name ?? order.zoneId}.`, { poiId: poi.id, poiName: poi.name });
  }
}
/** Anonymous builders are not replaced by invented named participants. */
export function recordCompletedDefenceExperience(state: RegionState, world: RegionWorld, zoneId: string, sourceId: string, result: string, lines: ReportLine[]) {
  append(state, lines, make(state, world, 'perimeter', zoneId, [], sourceId, result, { completedDefence: true }));
}
/** Night combat is reported in its actual defended zone, never as off-screen kills by a named crew. */
export function recordDefenceCombatExperience(state: RegionState, world: RegionWorld, zoneId: string, killed: number, crew: readonly RegionSurvivor[], lines: ReportLine[], anonymousGuard = false) {
  if (killed <= 0 || !crew.length && !anonymousGuard) return;
  append(state, lines, make(state, world, 'combat', zoneId, crew, `night:${zoneId}`, `${killed} zombier ble drept i forsvaret av ${world.zones.find(z => z.id === zoneId)?.name ?? zoneId}.`, { killed, context: 'night-defence' }));
}
/** Only after public report/replay exist. Private/dead crews never consume first markers.
 * Duplicate candidates are removed from BOTH views without shifting replay boundaries. */
export function finalizeExperienceReport(state: RegionState, report: RegionReport) {
  const previous = recordedExperiences(state);
  if (previous.length && !state.experiences) state.experiences = previous;
  const discarded = new Set<ReportLine>();
  for (const line of report.lines) {
    const experience = line.experience;
    if (!experience) continue;
    const key = marker(experience.kind);
    if (hasRecordedExperience(state, experience.kind)) { delete line.experience; if (line.category === 'experience') discarded.add(line); }
    else {
      state.experiences = [...recordedExperiences(state), experience];
      state.flags[key] = experience.id;
    }
  }
  report.lines = report.lines.filter(line => !discarded.has(line));
  for (const stage of report.replay ?? []) stage.lines = stage.lines.filter(line => !discarded.has(line));
}
export const reportExperiences = (report: RegionReport): ExpeditionExperience[] => report.lines.flatMap(line => line.experience ? [line.experience] : []);
