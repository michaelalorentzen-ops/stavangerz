/** Finite, optional field stories. All details are fictional; POI names/IDs come from world data.
 * Engine calls these hooks only after travel and risk. Knowledge requires a living
 * reporter; material rewards are returned as physical cargo, never global stock.
 */
import type { RegionPoi, RegionState, RegionWorld, ReportLine, Stock } from './types';
import { crewPositionFor } from './location';

export type DiscoverySource = 'scout' | 'search' | 'rumor' | 'radio';
export type DiscoveryDelivery = 'none' | 'returned' | 'radio';
export type DiscoveryStatus = 'clue' | 'choice' | 'followup' | 'resolved' | 'lost';
export interface DiscoveryNote { id: string; day: number; text: string }
export interface DiscoveryEntry {
  id: string; kind: 'ordinary' | 'tor'; title: string; poiId: string; poiName: string;
  zoneId: string; status: DiscoveryStatus; step: number; revision: number;
  discoveredDay: number; sources: DiscoverySource[]; notes: DiscoveryNote[];
  choices: { id: string; label: string; detail: string }[];
  chosen?: string[]; boundPersonId?: string;
}
export interface DiscoveryObservation {
  id: string; reporterIds: string[]; day: number; entry: DiscoveryEntry;
  morale?: number; loyalty?: number;
}
export interface DiscoveryState {
  version: 1;
  /** Public knowledge only. Never render pending field observations. */
  entries: Record<string, DiscoveryEntry>;
  pending: DiscoveryObservation[];
  /** Finite work/reward receipts survive failed return and prevent cache respawn. */
  receipts: string[];
}
export type DiscoveryRegionState = RegionState & { discoveries?: DiscoveryState };
export interface DiscoveryEvidence {
  source: DiscoverySource; zoneId: string; reporterIds: string[];
  delivery: DiscoveryDelivery;
  /** Set by the authoritative communications hook after actual binding/range checks. */
  radioVerified?: boolean;
}
export interface DiscoveryWork {
  zoneId: string; target: string; crewIds: string[]; kind: 'investigate' | 'choice'; hours: number;
  delivery: DiscoveryDelivery; radioVerified?: boolean;
}
export interface DiscoveryOrderPreview { ok: boolean; reason?: string; hours: number; cost: Stock }
export const DISCOVERY_WORK = {
  ordinaryHours: 4, torHours: 6, followupHours: 8,
  ordinaryFood: { food: 6, water: 6 }, ordinaryMedical: { medicine: 3, batteries: 2 },
  salvage: { parts: 6 }, finishedKit: { parts: 4, building: 4 },
  followupCost: { parts: 2 },
} as const;

function alive(state: RegionState, id: string) { return state.survivors.some(p => p.id === id && p.alive && p.health > 0 && !p.left); }
function home(state: RegionState, id: string) {
  const p = crewPositionFor(state, id);
  return p?.kind === 'zone' && (p.zoneId === state.homeZoneId || p.zoneId === state.hq?.zoneId);
}
function registry(state: DiscoveryRegionState): DiscoveryState {
  return state.discoveries ??= { version: 1, entries: {}, pending: [], receipts: [] };
}
function line(lines: ReportLine[], entry: DiscoveryEntry, title: string, text: string, tone: ReportLine['tone'] = 'info') {
  const tagged: ReportLine & { category: 'discovery'; discoveryId: string; eventId: string } = {
    tone, title, text, zoneId: entry.zoneId, category: 'discovery', discoveryId: entry.id,
    eventId: `discovery:${entry.id}:${entry.revision}`,
  };
  lines.push(tagged);
}
function note(entry: DiscoveryEntry, day: number, text: string) {
  const id = `${entry.id}:${entry.revision}`;
  if (!entry.notes.some(n => n.id === id)) entry.notes.push({ id, day, text });
}
function nearest(world: RegionWorld, state: RegionState, pred: (poi: RegionPoi) => boolean) {
  const at = world.zones.find(z => z.id === state.startZoneId)?.at;
  return world.pois.filter(pred).sort((a, b) => {
    const distance = (p: RegionPoi) => at ? Math.hypot((p.at[0] - at[0]) * .52, p.at[1] - at[1]) : 0;
    return distance(a) - distance(b) || a.id.localeCompare(b.id);
  })[0];
}
/** Stable attachment to existing real named POIs, without changing world data. */
export function discoverySites(state: RegionState, world: RegionWorld) {
  return {
    ordinary: nearest(world, state, p => ['supermarket', 'school', 'pharmacy'].includes(p.siteType ?? '')),
    tor: nearest(world, state, p => p.siteType === 'carRepair'),
  };
}
function clue(state: RegionState, poi: RegionPoi, kind: DiscoveryEntry['kind'], source: DiscoverySource): DiscoveryEntry {
  const entry: DiscoveryEntry = {
    id: kind === 'tor' ? 'tor-repair-notes' : 'emergency-cupboard', kind,
    title: kind === 'tor' ? 'Det som kan holde' : 'Lappen ved nødutgangen',
    poiId: poi.id, poiName: poi.name, zoneId: poi.zoneId, status: 'clue', step: 0, revision: 0,
    discoveredDay: state.day, sources: [source], notes: [], choices: [],
    ...(kind === 'tor' ? { boundPersonId: 'tor' } : {}),
  };
  note(entry, state.day, kind === 'tor'
    ? `Et notat fra ${poi.name} beskriver en uferdig reparasjon. Tor mener tegningen kan brukes til noe her. Han må selv undersøke det.`
    : `En lapp ved ${poi.name} nevner et lite nødskap som ble oversett under evakueringen. Ingen har undersøkt om innholdet fortsatt er der.`);
  return entry;
}
function publish(state: DiscoveryRegionState, observation: DiscoveryObservation, lines: ReportLine[]) {
  const r = registry(state), entry = observation.entry, old = r.entries[entry.id];
  if (old && old.revision >= entry.revision) {
    old.sources = [...new Set([...old.sources, ...entry.sources])];
    return;
  }
  if (old?.status === 'lost') return;
  r.entries[entry.id] = { ...structuredClone(entry), sources: [...new Set([...(old?.sources ?? []), ...entry.sources])] };
  if (observation.morale) state.morale = Math.max(0, Math.min(100, state.morale + observation.morale));
  if (observation.loyalty && alive(state, 'tor')) {
    const tor = state.survivors.find(p => p.id === 'tor')!;
    tor.loyalty = Math.max(0, Math.min(100, (tor.loyalty ?? 60) + observation.loyalty));
  }
  const latest = entry.notes.at(-1)!;
  line(lines, entry, entry.status === 'resolved' ? `Avsluttet: ${entry.title}` : `Feltnotat: ${entry.title}`, latest.text, entry.status === 'resolved' ? 'good' : 'info');
  if (!state.memory.some(m => m.text === latest.text)) state.memory.push({ day: state.day, text: latest.text });
}
function receive(state: DiscoveryRegionState, observation: DiscoveryObservation, evidence: Pick<DiscoveryEvidence, 'delivery' | 'radioVerified'>, lines: ReportLine[]) {
  const livingReporters = observation.reporterIds.filter(id => alive(state, id));
  if (!livingReporters.length) return;
  const delivered = evidence.delivery === 'returned' && livingReporters.some(id => home(state, id))
    || evidence.delivery === 'radio' && evidence.radioVerified === true;
  if (delivered) {
    if (evidence.delivery === 'radio') observation.entry.sources = [...new Set([...observation.entry.sources, 'radio' as const])];
    publish(state, observation, lines);
  }
  else {
    const existing = registry(state).pending.find(p => p.id === observation.id);
    if (existing) existing.reporterIds = [...new Set([...existing.reporterIds, ...observation.reporterIds])];
    else registry(state).pending.push(observation);
  }
}
/** Observe locally after successful scout/search, or from a real rumor/radio source. */
export function observeDiscoveries(state: DiscoveryRegionState, world: RegionWorld, evidence: DiscoveryEvidence, lines: ReportLine[]) {
  if (!evidence.reporterIds.some(id => alive(state, id))) return;
  const sites = discoverySites(state, world);
  for (const kind of ['ordinary', 'tor'] as const) {
    const poi = sites[kind];
    if (!poi || poi.zoneId !== evidence.zoneId || kind === 'tor' && !alive(state, 'tor')) continue;
    const entry = clue(state, poi, kind, evidence.source), r = registry(state);
    if (r.entries[entry.id]) {
      // A new evidence source is knowledge too; it follows the same delivery gate.
      const known = structuredClone(r.entries[entry.id]);
      known.sources = [...new Set([...known.sources, evidence.source])];
      receive(state, { id: `${entry.id}:source:${evidence.source}`, day: state.day, reporterIds: [...evidence.reporterIds], entry: known }, evidence, lines);
      continue;
    }
    receive(state, { id: `${entry.id}:clue:${evidence.source}`, day: state.day, reporterIds: [...evidence.reporterIds], entry }, evidence, lines);
  }
}
/** Invoke only at real arrival. Pending observations remain private while away. */
export function deliverDiscoveryReports(state: DiscoveryRegionState, _world: RegionWorld, lines: ReportLine[]) {
  if (!state.discoveries) return;
  const waiting: DiscoveryObservation[] = [];
  for (const observation of state.discoveries.pending) {
    const livingReporters = observation.reporterIds.filter(id => alive(state, id));
    if (livingReporters.some(id => home(state, id))) publish(state, observation, lines);
    else if (livingReporters.length) waiting.push(observation);
  }
  state.discoveries.pending = waiting;
}
/** Existing field observations can be transmitted only through a verified live connection.
 * Caller's communications service checks actual radio carrier, batteries and range.
 * This function deliberately never reads, moves or credits mission cargo.
 */
export function transmitDiscoveryReports(state: DiscoveryRegionState, _world: RegionWorld, crewIds: readonly string[], radioVerified: boolean, lines: ReportLine[]) {
  if (!radioVerified || !state.discoveries) return;
  const senders = new Set(crewIds.filter(id => alive(state, id)));
  state.discoveries.pending = state.discoveries.pending.filter(observation => {
    if (!observation.reporterIds.some(id => senders.has(id))) return true;
    const transmitted = structuredClone(observation);
    transmitted.entry.sources = [...new Set([...transmitted.entry.sources, 'radio' as const])];
    publish(state, transmitted, lines);
    return false;
  });
}
/** Called after death/desertion; never creates public knowledge from a dead crew. */
export function maintainDiscoveries(state: DiscoveryRegionState, lines: ReportLine[]) {
  const r = state.discoveries;
  if (!r) return;
  r.pending = r.pending.filter(p => p.reporterIds.some(id => alive(state, id)));
  for (const entry of Object.values(r.entries)) if (entry.boundPersonId && !alive(state, entry.boundPersonId) && !['resolved', 'lost'].includes(entry.status)) {
    entry.status = 'lost'; entry.revision++; entry.choices = [];
    note(entry, state.day, 'Tor kan ikke lenger følge sporet. Det som allerede er rapportert, blir stående i feltboka. Historien er valgfri; andre oppdrag og all vanlig progresjon er fortsatt tilgjengelig.');
    line(lines, entry, 'Et spor blir liggende', entry.notes.at(-1)!.text, 'warn');
  }
}
function parseTarget(target: string) { const [id, choiceId] = target.split(':'); return { id, choiceId }; }
/** Pure. The engine adds travel, fatigue, resource availability and actual threat. */
export function discoveryOrderPreview(state: DiscoveryRegionState, _world: RegionWorld, zoneId: string, target: string, crewIds: string[], kind: DiscoveryWork['kind']): DiscoveryOrderPreview {
  const { id, choiceId } = parseTarget(target), entry = state.discoveries?.entries[id];
  const no = (reason: string): DiscoveryOrderPreview => ({ ok: false, reason, hours: 0, cost: {} });
  if (!entry) return no('Ingen rapportert ledetråd. Speid, søk eller undersøk et faktisk rykte først.');
  if (['resolved', 'lost'].includes(entry.status)) return no('Dette sporet er avsluttet.');
  if (state.discoveries?.pending.some(p => p.entry.id === id && p.entry.revision > entry.revision)) return no('Laget har ikke rapportert resultatet ennå.');
  if (zoneId !== entry.zoneId) return no('Oppdraget må utføres der sporet finnes.');
  if (!crewIds.length || !crewIds.every(id => alive(state, id))) return no('Velg et levende lag.');
  if (entry.boundPersonId && !crewIds.includes(entry.boundPersonId)) return no('Tor må være med på sitt eget spor.');
  if (kind === 'investigate' && !['clue', 'followup'].includes(entry.status)) return no('Undersøkelsen er ferdig; velg hvordan dere vil følge opp.');
  if (kind === 'choice' && (entry.status !== 'choice' || !entry.choices.some(c => c.id === choiceId))) return no('Dette valget finnes ikke i den rapporterte oppdagelsen.');
  return { ok: true, hours: entry.kind === 'ordinary' ? DISCOVERY_WORK.ordinaryHours : entry.step >= 2 ? DISCOVERY_WORK.followupHours : DISCOVERY_WORK.torHours,
    cost: kind === 'investigate' && entry.kind === 'tor' && entry.step === 2 ? { ...DISCOVERY_WORK.followupCost } : {} };
}
/** Apply an actual successful field work slice. No mutation when insufficient hours.
 * The caller pays preview.cost once and puts cargo into the physical mission load.
 */
export function executeDiscoveryOrder(state: DiscoveryRegionState, world: RegionWorld, work: DiscoveryWork, lines: ReportLine[]): { cargo: Stock; completed: boolean } {
  const preview = discoveryOrderPreview(state, world, work.zoneId, work.target, work.crewIds, work.kind);
  if (!preview.ok) return { cargo: {}, completed: false };
  const { id, choiceId } = parseTarget(work.target), r = registry(state), entry = structuredClone(r.entries[id]);
  if (work.hours < preview.hours) {
    line(lines, entry, 'Sporet må vente', `Laget trenger ${preview.hours} arbeidstimer på stedet. Reise og utmattelse lot ikke undersøkelsen bli ferdig.`, 'warn');
    return { cargo: {}, completed: false };
  }
  const receipt = `${entry.id}:${entry.revision}:${work.kind}:${choiceId ?? ''}`;
  let cargo: Stock = {}, morale = 0, loyalty = 0;
  entry.revision++;
  if (work.kind === 'investigate') {
    entry.status = 'choice';
    if (entry.kind === 'ordinary') {
      entry.step = 1;
      entry.choices = [
        { id: 'rations', label: 'Hent rasjoner og vann', detail: 'En liten, endelig forsyning til leiren. Dere lar medisinesken stå.' },
        { id: 'medical', label: 'Hent førstehjelp og batterier', detail: 'Ta med det knappe medisinske utstyret. Matkassen blir igjen.' },
      ];
      note(entry, state.day, `Nødskapet ved ${entry.poiName} er fortsatt lukket. Bak døra står rasjoner og en førstehjelpseske. Laget kan bære én av kassene uten å utvide oppdraget.`);
    } else if (entry.step === 0) {
      entry.step = 1;
      entry.choices = [
        { id: 'restore', label: 'Ta tegningen med tilbake', detail: 'Følg reparasjonen videre i leiren med Tor. Et nytt arbeidsoppdrag kreves.' },
        { id: 'scrap', label: 'Berg delene og avslutt', detail: 'Ta brukbare deler nå. Tor ville heller prøvd å reparere.' },
      ];
      note(entry, state.day, `Tor finner en uferdig mekanisk regulering ved ${entry.poiName}. Tegningen viser hvordan små reservedeler kan holde en enkel pumpe i gang. Dette er en oppdiktet fortelling i spillet, ikke et virkelig skjult anlegg.`);
    } else {
      entry.step = 3;
      entry.choices = [
        { id: 'teach', label: 'La Tor lære det bort', detail: 'Styrk samhold og Tors tillit. Reparasjonen blir en felles erfaring.' },
        { id: 'kit', label: 'Behold delene som reparasjonssett', detail: 'Ta vare på delene og materialene til senere bygging.' },
      ];
      note(entry, state.day, 'Tor får reguleringen til å gå rundt på arbeidsbordet. Han har skrevet fremgangsmåten på baksiden av tegningen. Ingen unik bygning eller nødvendig progresjon er låst til forsøket.');
    }
  } else {
    entry.chosen = [...(entry.chosen ?? []), choiceId!]; entry.choices = [];
    if (entry.kind === 'ordinary') {
      cargo = { ...(choiceId === 'rations' ? DISCOVERY_WORK.ordinaryFood : DISCOVERY_WORK.ordinaryMedical) };
      entry.status = 'resolved';
      note(entry, state.day, `Laget valgte ${choiceId === 'rations' ? 'rasjonene og vannet' : 'førstehjelpen og batteriene'} ved ${entry.poiName}. Den andre kassen ble stående. Funnet er endelig; samme skap fylles ikke opp igjen.`);
    } else if (choiceId === 'restore') {
      entry.status = 'followup'; entry.step = 2;
      entry.zoneId = state.hq?.zoneId ?? state.homeZoneId;
      note(entry, state.day, 'Tor tok tegningen med til leiren. Neste steg er et eget arbeidsoppdrag der: Tor trenger to deler og tid ved arbeidsbordet. Dere kan la sporet ligge så lenge dere vil.');
    } else {
      entry.status = 'resolved';
      if (choiceId === 'scrap') { cargo = { ...DISCOVERY_WORK.salvage }; loyalty = -4; }
      if (choiceId === 'kit') cargo = { ...DISCOVERY_WORK.finishedKit };
      if (choiceId === 'teach') { morale = 5; loyalty = 5; }
      note(entry, state.day, choiceId === 'scrap' ? 'Tor berget delene. Forsøket ble avsluttet før reguleringen ble reparert.'
        : choiceId === 'kit' ? 'Dere beholdt reguleringen og materialene som et endelig reparasjonssett. Tor er ferdig med forsøket.'
          : 'Tor viste de andre hvordan reparasjonen virker. Forsøket ble en felles erfaring og ga litt nytt håp.');
    }
  }
  // Physical resources are obtained once even when nobody survives to tell the story.
  if (r.receipts.includes(receipt)) { cargo = {}; morale = loyalty = 0; }
  else r.receipts.push(receipt);
  receive(state, { id: receipt, reporterIds: [...work.crewIds], day: state.day, entry, morale, loyalty }, work, lines);
  return { cargo, completed: true };
}
/** Public projection, safe for map, ZA book and journal. Does not mutate legacy saves. */
export function visibleDiscoveries(state: DiscoveryRegionState, zoneId?: string): DiscoveryEntry[] {
  return Object.values(state.discoveries?.entries ?? {}).filter(e => !zoneId || e.zoneId === zoneId)
    .sort((a, b) => b.discoveredDay - a.discoveredDay || a.id.localeCompare(b.id));
}
