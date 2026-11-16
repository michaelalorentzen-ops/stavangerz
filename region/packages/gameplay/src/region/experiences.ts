/** Saved presentation of authoritative outcomes. No randomness, rewards or new simulation. */
import { GEAR_CATALOG } from './gear';
import { crewPositionFor } from './location';
import type { EarnedMemoryKind, ExpeditionExperience, ExperienceKind, RegionOrder, RegionReport, RegionState, RegionSurvivor, RegionWorld, ReportLine, Stock } from './types';
const ORIGIN = 'experience:origin';
const MILESTONE_ORIGIN = 'experience:milestone-origin';
const DEFENCE_MODULES = new Set(['gate', 'watchtower', 'walls', 'overview']);
const MEMORY_LIMIT = 12;
export const experienceMarker = (kind: ExperienceKind) => `experience:first:${kind}`;
export const earnedMemoryMarker = (kind: EarnedMemoryKind) => `experience:milestone:${kind}`;
const marker = experienceMarker;
/** Permanent, bounded public journal; old saves may fall back to retained public reports. */
export function recordedExperiences(state: RegionState): ExpeditionExperience[] {
  const seen = new Set<ExperienceKind>();
  return [...(state.experiences ?? []), ...state.reports.flatMap(report => report.lines.flatMap(line => line.experience ? [line.experience] : []))].filter(experience => {
    if (experience.milestone || seen.has(experience.kind)) return false; seen.add(experience.kind); return true;
  }).sort((a, b) => a.day - b.day);
}
export const hasRecordedExperience = (state: RegionState, kind: ExperienceKind) => !!state.flags[marker(kind)] || recordedExperiences(state).some(experience => experience.kind === kind);
/** Milestones never displace the original eight, even after the report window rotates. */
export function recordedMemories(state: RegionState): ExpeditionExperience[] {
  const seen = new Set<EarnedMemoryKind>();
  const milestones = [...(state.earnedMemories ?? []), ...state.reports.flatMap(report => report.lines.flatMap(line => line.experience?.milestone ? [line.experience] : []))]
    .filter(experience => { if (!experience.milestone || seen.has(experience.milestone)) return false; seen.add(experience.milestone); return true; }).slice(-MEMORY_LIMIT);
  return [...recordedExperiences(state), ...milestones].sort((a, b) => a.day - b.day);
}
export function initializeExperienceJournal(state: RegionState) { state.flags[ORIGIN] = 'new'; state.flags[MILESTONE_ORIGIN] = 'new'; }
function hasEarnedMemory(state: RegionState, milestone: EarnedMemoryKind) {
  return !!state.flags[earnedMemoryMarker(milestone)] || recordedMemories(state).some(experience => experience.milestone === milestone);
}
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
  scout: 'Veien ut, veien hjem', search: 'Det vi kan bære', combat: 'Etter møtet med de døde', gear: 'Noe verdt å ta vare på',
  claim: 'Et sted å holde', perimeter: 'En grense som kan holde', poi: 'Et navn blir et sted', hq: 'Fra tilflukt til hovedkvarter',
};
const TEXTS: Record<ExperienceKind, string> = {
  scout: '{laget} stanser og ser ruten an før neste steg. Det som faktisk lar seg observere, blir skrevet ned; resten får vente. Et tokt handler også om å finne veien hjem.',
  search: '{laget} fordeler oppmerksomheten mellom letingen og neste steg. Det er lett å ønske seg ett funn til. Det som blir med videre, må faktisk bæres.',
  combat: 'Etter kampen må neste steg finnes igjen. {laget} går gjennom det som skjedde før arbeidet fortsetter. Dette er en erfaring å ta med inn i neste vurdering, ikke bare et tall over døde.',
  gear: '{laget} ser over det som er funnet før turen går videre. En gjenstand kan gjøre neste oppdrag annerledes. Hvem som skal bruke den, er ikke avgjort av funnet.',
  claim: 'En ny grense blir trukket på kartet. {laget} har et konkret sted å vende tilbake til, men navnet er ingen garanti for morgendagen. Nå er spørsmålet hvordan området skal holdes.',
  perimeter: '{laget} går over det som nå er ferdig. Det er ikke lenger bare en plan om å holde noe ute. Forsvarsverket står der — og må passes på når arbeidet går videre.',
  poi: '{laget} stanser ved opplysningene om stedet. Navnet får en strek i notatene, ikke et svar på alt som finnes der. Det er noe å følge videre når det passer med resten av planen.',
  hq: 'Nå finnes det et punkt å planlegge fra. Arbeid skal fordeles, folk skal komme tilbake hit, og noen må holde oversikten. {laget} har gitt tilflukten en oppgave som varer lenger enn dette døgnet.',
};
function experienceText(kind: ExperienceKind, crew: readonly RegionSurvivor[]) {
  const subject = crew.length === 1 ? crew[0].name : crew.length ? 'Laget' : kind === 'combat' ? 'Vaktholdet' : 'Byggelaget';
  return TEXTS[kind].replaceAll('{laget}', subject);
}
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
    zoneName: world.zones.find(z => z.id === zoneId)?.name ?? zoneId, title: TITLES[kind], text: experienceText(kind, crew), result,
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
function appendMilestone(state: RegionState, lines: ReportLine[], experience: ExpeditionExperience) {
  if (!experience.milestone || hasEarnedMemory(state, experience.milestone) || lines.some(line => line.experience?.milestone === experience.milestone)) return;
  // This line follows the same private mission transport as ordinary field results.
  lines.push({ category: 'experience', tone: 'info', priority: 60, title: experience.title, text: experience.result, zoneId: experience.zoneId, experience });
}
function milestoneMemory(state: RegionState, world: RegionWorld, milestone: EarnedMemoryKind, kind: ExperienceKind, zoneId: string,
  crew: readonly RegionSurvivor[], title: string, text: string, result: string, facts: ExpeditionExperience['facts']): ExpeditionExperience {
  const experience = make(state, world, kind, zoneId, crew, milestone, result, facts, kind === 'hq' ? 'hq' : undefined);
  experience.id = `memory:${milestone}:${state.day}`;
  experience.milestone = milestone;
  experience.title = title; experience.text = text; experience.helpTopic = 'milestones';
  experience.record = state.flags[MILESTONE_ORIGIN] === 'new' ? 'first' : 'first-recorded';
  delete experience.voice; // A milestone is not an invented first-action quote.
  return experience;
}
function completedHqDefenceMemory(state: RegionState, world: RegionWorld, zoneId: string, crew: readonly RegionSurvivor[], moduleId: string, result: string, lines: ReportLine[]) {
  if (!hasRecordedExperience(state, 'perimeter')) return;
  appendMilestone(state, lines, milestoneMemory(state, world, 'hq-defence', 'perimeter', zoneId, crew, 'Et vern å bygge videre på',
    'Det første perimeteret var en begynnelse. Nå har hovedkvarteret fått et ferdig forsvarsanlegg. Arbeidet gjør en forskjell, men noen må fortsatt holde oversikt over hva som trenger vedlikehold.',
    result, { completedHqDefence: true, moduleId }));
}
export interface OperationExperienceSnapshot {
  status: string; searched: number; health: Record<string, number>; stock: Stock; killed: number;
  gearIds: string[]; barricades: Record<string, number>; upgrades: string[]; modules: string[]; hadHq: boolean;
  controlledCount: number;
}
/** Capture immediately before a valid operation, after travel/cargo reservation. */
export function captureOperationExperience(state: RegionState, order: RegionOrder, killed: number): OperationExperienceSnapshot {
  const z = state.zones[order.zoneId];
  return { status: z.status, searched: z.searched, health: Object.fromEntries(order.survivorIds.map(id => [id, state.survivors.find(p => p.id === id)?.health ?? 0])),
    stock: { ...state.stock }, killed, gearIds: (state.gear?.items ?? []).map(i => i.id), barricades: { ...state.barricades }, upgrades: [...z.upgrades], modules: [...(state.hq?.modules ?? [])], hadHq: !!state.hq,
    controlledCount: Object.values(state.zones).filter(zone => zone.status === 'controlled').length };
}
/** Only outcomes of the operation that just ran. Neither creates nor publishes knowledge. */
export function recordOperationExperience(state: RegionState, world: RegionWorld, order: RegionOrder, before: OperationExperienceSnapshot,
  killed: number, lines: ReportLine[], lineStart: number, crew: readonly RegionSurvivor[]) {
  if (!crew.some(p => p.alive && p.health > 0 && !p.left)) return;
  const produced = lines.slice(lineStart), zone = state.zones[order.zoneId];
  const source = (category: string) => produced.find(l => l.facts?.action === category || l.category === category) ?? produced.at(-1);
  const add = (kind: ExperienceKind, result: string, facts: ExpeditionExperience['facts'] = {}, illustration?: Illustration) => append(state, lines, make(state, world, kind, order.zoneId, crew, order.id, result, facts, illustration));
  if (order.action === 'scout' && zone.intel?.day === state.day) add('scout', `Anslag: ${zone.intel.min}–${zone.intel.max} zombier.`, { minimum: zone.intel.min, maximum: zone.intel.max });
  if (order.action === 'search' && zone.searched > before.searched) {
    const recovered = Object.fromEntries(Object.entries(state.stock).filter(([id, amount]) => amount > (before.stock[id] ?? 0)).map(([id, amount]) => [id, amount - (before.stock[id] ?? 0)]));
    add('search', source('search')?.text ?? 'Søket er gjennomført.', { searchBefore: before.searched, searchAfter: zone.searched, ...recovered });
    const gear = (state.gear?.items ?? []).filter(item => !before.gearIds.includes(item.id) && item.provenance?.kind === 'search' && item.provenance.zoneId === order.zoneId);
    if (gear.length) add('gear', `Funnet: ${gear.map(item => GEAR_CATALOG[item.kind]?.name ?? item.kind).join(', ')}. Utstyret må følge laget fram til faktisk levering.`, { itemCount: gear.length, itemKinds: gear.map(item => item.kind).join(', ') });
  }
  const killedHere = Math.max(0, killed - before.killed), injured = crew.filter(p => p.health < before.health[p.id]).length;
  if (['clear', 'search', 'claim'].includes(order.action) && (killedHere > 0 || order.action === 'clear' && injured > 0)) add('combat', `${killedHere} zombier ble drept under oppdraget.${injured ? ` ${injured} i laget ble skadet.` : ''}`, { killed: killedHere, injuredCount: injured, ammoUsed: Math.max(0, (before.stock.ammo ?? 0) - (state.stock.ammo ?? 0)) });
  if (before.status !== 'controlled' && zone.status === 'controlled' && ['claim', 'assault'].includes(order.action)) {
    add('claim', 'Sonen er nå kontrollert av gruppen.', { controlled: true });
    const controlledCount = Object.values(state.zones).filter(zone => zone.status === 'controlled').length;
    if (before.controlledCount < 10 && controlledCount >= 10) appendMilestone(state, lines, milestoneMemory(state, world, 'ten-zones', 'claim', order.zoneId, crew,
      'Et større ansvar', 'Det er flere steder å vende tilbake til nå. Hver ny grense betyr også noen som må passe på, hente forsyninger og komme hjem. Gruppen må tenke lenger enn neste tur.',
      `${controlledCount} soner er nå under gruppens kontroll.`, { controlledCount }));
  }
  const newBarriers = Object.entries(state.barricades).filter(([id, durability]) => durability > (before.barricades[id] ?? 0)).length;
  const builtPost = zone.upgrades.some(id => ['watchpost', 'barricades'].includes(id) && !before.upgrades.includes(id));
  const builtModule = (state.hq?.modules ?? []).some(id => ['gate', 'watchtower', 'walls', 'overview'].includes(id) && !before.modules.includes(id));
  if (order.action === 'module' && builtModule && !before.modules.some(id => DEFENCE_MODULES.has(id))) {
    const moduleId = state.hq!.modules.find(id => DEFENCE_MODULES.has(id) && !before.modules.includes(id))!;
    const completion = produced.find(line => line.title.endsWith('er ferdig'));
    completedHqDefenceMemory(state, world, order.zoneId, crew, moduleId, completion ? `${completion.title}.` : 'Hovedkvarterets første forsvarsmodul er ferdig.', lines);
  }
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
  if (sourceId.startsWith('module:') && (state.hq?.modules.filter(id => DEFENCE_MODULES.has(id)).length ?? 0) === 1) {
    completedHqDefenceMemory(state, world, zoneId, [], sourceId.slice('module:'.length), result, lines);
  }
}
/** Called only around an actual checkPhase transition, never when loading a save. */
export function recordPhaseExperience(state: RegionState, world: RegionWorld, previousPhase: number, lines: ReportLine[]) {
  if (state.phase !== previousPhase + 1 || state.phase < 2 || state.phase > 5) return;
  const stories = {
    2: ['Mer enn en natt til', 'Det som begynte som et sted å skjule seg, har fått en hverdag. Nå må folk dele på arbeidet, ikke bare på bekymringen.'],
    3: ['Ingen kan huske alt', 'Det er ikke lenger nok at én person husker alt. Beskjeder må fram, ansvar må deles, og noen må følge opp det som ble avtalt.'],
    4: ['Ansvar over avstand', 'Kartet rommer flere oppgaver enn én gruppe kan rekke. Noe må planlegges på avstand, og menneskene som tar ansvar må kunne stole på hverandre.'],
    5: ['En hverdag å forsvare', 'Det finnes mer å tenke på enn neste døgn. Hva slags samfunn skal dette bli, og hva er gruppen villig til å gjøre for å holde det sammen?'],
  } as const;
  const [title, text] = stories[state.phase as keyof typeof stories];
  const crew = state.survivors.filter(person => { const position = crewPositionFor(state, person.id); return person.alive && !person.left && person.health > 0 && position?.kind === 'zone' && position.zoneId === state.homeZoneId; });
  appendMilestone(state, lines, milestoneMemory(state, world, `phase-${state.phase}` as EarnedMemoryKind, 'hq', state.homeZoneId, crew,
    title, text, `Gruppen har nådd fase ${state.phase}.`, { previousPhase, phase: state.phase }));
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
    if (experience.milestone) {
      const key = earnedMemoryMarker(experience.milestone);
      if (hasEarnedMemory(state, experience.milestone)) { delete line.experience; if (line.category === 'experience') discarded.add(line); }
      else {
        state.earnedMemories = [...recordedMemories(state).filter(memory => memory.milestone), experience].slice(-MEMORY_LIMIT);
        state.flags[key] = experience.id;
      }
      continue;
    }
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
