/**
 * Wonders: unique places that can become yours by luck, by the right choice or because you hold the right ground.
 * They are always good, but how good depends on where you are: a cruise ship is a town for a crowded camp,
 * and only a nice extra for a group that already holds half of Hillevåg.
 */
import type { RegionState, RegionWorld, ReportLine } from './types';
import { controlled, indexWorld } from './engine';
import { R } from './rules';

export interface WonderInstallation {
  version: 1;
  status: 'discovered' | 'secured' | 'operational';
  /** Which stage was paid; durable across partial work, loss, reload and retry. */
  paidFor?: string;
}
export type WonderHolding = { level: number; zoneId: string; progress: number; installation?: WonderInstallation };
export const wonderHolding = (state: RegionState, id: string): WonderHolding | undefined => state.wonders?.[id];
/** Missing metadata is the explicit compatibility rule: old active sites stay active. */
export const wonderOperational = (holding: WonderHolding): boolean => !holding.installation || holding.installation.status === 'operational';
export const wonderStatus = (holding: WonderHolding) => holding.installation?.status ?? 'operational';

/** D27 implementation values: finite crew work/cost hypotheses, not final balance. */
export const WONDER_INSTALLATIONS: Record<string, { survey: { hours: number; cost: Record<string, number> }; operate: { hours: number; cost: Record<string, number> } }> = {
  cruise: { survey: { hours: 12, cost: { ammo: 6 } }, operate: { hours: 16, cost: { building: 6, parts: 2 } } },
  utstein: { survey: { hours: 8, cost: {} }, operate: { hours: 12, cost: { building: 6 } } },
  tower: { survey: { hours: 8, cost: { parts: 1 } }, operate: { hours: 12, cost: { parts: 2, batteries: 2 } } },
  plane: { survey: { hours: 12, cost: { parts: 2 } }, operate: { hours: 16, cost: { parts: 4 } } },
  cathedral: { survey: { hours: 8, cost: { building: 1 } }, operate: { hours: 8, cost: { building: 4 } } },
  arena: { survey: { hours: 16, cost: { ammo: 4 } }, operate: { hours: 16, cost: { building: 8 } } },
};

export interface WonderEffect {
  shelter?: number; hope?: number; defense?: number; food?: number; medicine?: number; fuel?: number;
  research?: number; trade?: number; spoil?: number; contact?: boolean; warn?: boolean; workers?: number;
}
export interface WonderLevel { name: string; text: string; cost: Record<string, number>; hours: number; effect: WonderEffect }
export interface WonderDef {
  id: string; name: string; about: string;
  /** Where it is: a POI id, or a point (nearest coastal or any L3 zone). */
  poi?: string; at?: [number, number]; coastal?: boolean;
  /** How it is found: holding the zone, or an event that offers it. */
  found: 'claim' | 'event';
  requires: string;
  levels: WonderLevel[];
}

export const WONDERS: WonderDef[] = [
  {
    id: 'cruise', name: 'Cruiseskipet i Vågen', at: [5.7305, 58.9735], coastal: true, found: 'event',
    about: 'Et cruiseskip med plass til fire tusen ligger fortøyd ved Strandkaien. Noen dekk er fulle av døde, andre er låst innenfra.',
    requires: 'Funnet gjennom en hendelse. Krever crew som tør å rydde dekk, og senere slepebåt eller verft.',
    levels: [
      { name: 'Fortøyd', text: 'Dere har kontroll på landgangen og de øverste dekkene.', cost: {}, hours: 0, effect: { shelter: 40, hope: 2 } },
      { name: 'Dekk for dekk', text: 'Alle dekk er ryddet. Lugarer, kjøkken og et lite sykehus.', cost: { ammo: 40, building: 20 }, hours: 60, effect: { shelter: 160, hope: 4, medicine: .5 } },
      { name: 'Slept til verftet', text: 'Skipet ligger i dokk, med sveisere og strøm fra land. Verkstedene om bord er i drift.', cost: { fuel: 80, parts: 20, engine: 1 }, hours: 80, effect: { shelter: 260, hope: 6, medicine: 1, research: .15, workers: 15 } },
      { name: 'Flytende by', text: 'Et samfunn på åtte dekk, med skole, marked og en kaptein som vil bli hørt.', cost: { building: 60, electronics: 20, metal: 30 }, hours: 120, effect: { shelter: 400, hope: 8, medicine: 1.5, research: .25, trade: .15, workers: 30 } },
    ],
  },
  {
    id: 'utstein', name: 'Utstein kloster', at: [5.6146, 59.0428], found: 'claim',
    about: 'Norges best bevarte middelalderkloster, på en holme med én vei inn. Murene har stått i 750 år.',
    requires: 'Ta over sonen. Krever båt eller bru til Mosterøy.',
    levels: [
      { name: 'Klosteret', text: 'Tykke murer og ett inngangsparti.', cost: {}, hours: 0, effect: { defense: 12, hope: 2 } },
      { name: 'Murene reparert', text: 'Portene er nye, og vaktgangen går rundt hele anlegget.', cost: { building: 30, metal: 10 }, hours: 50, effect: { defense: 30, hope: 4, shelter: 30 } },
      { name: 'Klosterhagen', text: 'Urter, grønnsaker og bier, som munkene hadde det.', cost: { food: 20, building: 10 }, hours: 40, effect: { defense: 30, hope: 5, shelter: 30, food: 8, medicine: 1 } },
      { name: 'Tilflukt', text: 'Et sted folk drar for å komme seg. Håpet har en adresse.', cost: { building: 40 }, hours: 60, effect: { defense: 35, hope: 9, shelter: 60, food: 8, medicine: 1.5 } },
    ],
  },
  {
    id: 'tower', name: 'Ullandhaugtårnet', poi: 'poi-027', found: 'claim',
    about: 'Telemasten på toppen av Ullandhaug ser hele Jæren. Med strøm kan den nå hver radio i regionen.',
    requires: 'Ta over sonen med tårnet.',
    levels: [
      { name: 'Utsiktspunktet', text: 'Fra toppen ser dere horder lenge før de kommer.', cost: {}, hours: 0, effect: { warn: true } },
      { name: 'Nødsender', text: 'Et aggregat og en sender. Alle grupper i regionen hører dere.', cost: { generator: 1, electronics: 6, batteries: 6 }, hours: 30, effect: { warn: true, contact: true, hope: 2 } },
      { name: 'Kringkasting', text: '«Dette er Stavanger.» Hver kveld klokka sju. Folk kommer fordi de hører dere.', cost: { electronics: 10, radio: 1 }, hours: 40, effect: { warn: true, contact: true, hope: 6, trade: .1 } },
      { name: 'Regionalt samband', text: 'Faste frekvenser, koder og avtaler. Handel og hjelp går raskere.', cost: { electronics: 20, solar: 6 }, hours: 60, effect: { warn: true, contact: true, hope: 7, trade: .25, research: .05 } },
    ],
  },
  {
    id: 'plane', name: 'Hercules-flyet på Sola', poi: 'poi-452', found: 'event',
    about: 'Et transportfly står på oppstillingsplassen ved flystasjonen. Tankene er tomme og ett hjul er punktert.',
    requires: 'Funnet gjennom en hendelse når dere eier eller er venner med noen på Sola.',
    levels: [
      { name: 'Står på bakken', text: 'Flyet er deres. Det trenger deler, drivstoff og noen som kan fly.', cost: {}, hours: 0, effect: { hope: 2 } },
      { name: 'Luftdyktig', text: 'Nye dekk, reparert hydraulikk og fulle tanker. Det kan fly én tur av gangen.', cost: { parts: 30, engine: 2, fuel: 120 }, hours: 70, effect: { hope: 4 } },
      { name: 'Luftbro', text: 'Fast flyging til Bergen og Kristiansand. Folk og medisin kommer inn.', cost: { fuel: 150, electronics: 10 }, hours: 60, effect: { hope: 6, medicine: 2, workers: 10, trade: .1 } },
    ],
  },
  {
    id: 'cathedral', name: 'Domkirken', poi: 'poi-030', found: 'claim',
    about: 'Norges eldste katedral. Klokkene har ikke ringt siden natt til 1. april.',
    requires: 'Ta over sonen, eller vær venner med dem som holder den.',
    levels: [
      { name: 'Kirkerommet', text: 'Stille, kaldt og tørt.', cost: {}, hours: 0, effect: { hope: 4, shelter: 30 } },
      { name: 'Klokkene ringer', text: 'Hver søndag. Det høres til Hundvåg. Det høres for zombiene også.', cost: { building: 10 }, hours: 20, effect: { hope: 9, shelter: 30 } },
      { name: 'Asyl', text: 'Kongsgård og kirken huser dem som ikke har noe annet sted.', cost: { building: 30, food: 30 }, hours: 50, effect: { hope: 10, shelter: 120 } },
      { name: 'Katedralskolen', text: 'Skolen fra 1100-tallet åpner igjen.', cost: { building: 20, electronics: 4 }, hours: 40, effect: { hope: 12, shelter: 120, research: .15 } },
    ],
  },
  {
    id: 'arena', name: 'Arenaen i Jåttåvågen', at: [5.7363, 58.9136], found: 'claim',
    about: 'Fotballarenaen og hallene rundt har tak, toaletter og plass til tusenvis. Det var en evakueringsplass. Det gikk ikke bra.',
    requires: 'Ta over sonen. Den er stor, og tribunene var fulle.',
    levels: [
      { name: 'Tribunene', text: 'Ryddet, men det lukter fortsatt.', cost: {}, hours: 0, effect: { shelter: 80 } },
      { name: 'Hallen ryddet', text: 'Senger på banen og kjøkken i kiosken.', cost: { building: 30 }, hours: 50, effect: { shelter: 200, hope: 2 } },
      { name: 'Lagerhallen', text: 'Kalde, tørre rom under tribunen. Maten holder seg.', cost: { building: 20, metal: 10 }, hours: 40, effect: { shelter: 200, hope: 2, spoil: .3 } },
      { name: 'Markedsplassen', text: 'Hver lørdag kommer folk fra hele regionen for å bytte.', cost: { building: 30, food: 40 }, hours: 50, effect: { shelter: 220, hope: 5, spoil: .3, trade: .2 } },
    ],
  },
];

/** The zone each wonder belongs to in this world. */
export function wonderZone(world: RegionWorld, def: WonderDef): string | undefined {
  const index = indexWorld(world);
  if (def.poi) return world.pois.find(p => p.id === def.poi)?.zoneId;
  if (!def.at) return undefined;
  const dist = (a: [number, number]) => Math.hypot((a[0] - def.at![0]) * 57.4, (a[1] - def.at![1]) * 111.2);
  return index.l3.filter(z => z.at && (!def.coastal || index.coastal.has(z.id))).sort((a, b) => dist(a.at!) - dist(b.at!))[0]?.id;
}

export const wonderState = (state: RegionState) => (state.wonders ??= {});
export const knownWonders = (state: RegionState): [string, WonderHolding][] => Object.entries(state.wonders ?? {});
export const ownedWonders = (state: RegionState) => knownWonders(state).filter(([, w]) => w.level >= 0 && wonderOperational(w));

/** Combined effect of all wonders you hold, at their level. A wonder in a zone you lost gives nothing. */
export function wonderEffects(state: RegionState): Required<WonderEffect> {
  const sum: Required<WonderEffect> = { shelter: 0, hope: 0, defense: 0, food: 0, medicine: 0, fuel: 0, research: 0, trade: 0, spoil: 0, contact: false, warn: false, workers: 0 };
  for (const [id, w] of ownedWonders(state)) {
    const def = WONDERS.find(d => d.id === id);
    if (def?.found === 'claim' && state.zones[w.zoneId]?.status !== 'controlled') continue;
    const e = def?.levels[w.level]?.effect;
    if (!e) continue;
    for (const k of Object.keys(sum) as (keyof WonderEffect)[]) {
      const v = e[k];
      if (typeof v === 'number') (sum[k] as number) += v;
      else if (v) (sum[k] as boolean) = true;
    }
  }
  sum.spoil = Math.min(.6, sum.spoil);
  return sum;
}

/** D27: a claim/event gives a known site, never free operating effects.
 * legacyActive is only for resolving an already persisted pre-D27 event promise.
 */
export function gainWonder(state: RegionState, world: RegionWorld, id: string, lines: ReportLine[], zoneId?: string, legacyActive = false) {
  const def = WONDERS.find(d => d.id === id);
  if (!def || state.wonders?.[id]) return;
  const zone = zoneId ?? wonderZone(world, def);
  if (!zone) return;
  const holding: WonderHolding = { level: 0, zoneId: zone, progress: 0, ...(!legacyActive ? { installation: { version: 1 as const, status: 'discovered' as const } } : {}) };
  wonderState(state)[id] = holding;
  lines.push({ tone: legacyActive ? 'good' : 'info', title: `Unikt sted: ${def.name}`, text: legacyActive ? `${def.about} ${def.levels[0].text}` : `${def.about} Stedet er oppdaget. Et faktisk crew må undersøke og sikre det, og deretter gjøre det operativt. Ingen anleggseffekter er aktive ennå.`, zoneId: zone });
  state.memory.push({ day: state.day, text: legacyActive ? `${def.name} ble deres.` : `${def.name} er oppdaget, men ikke satt i drift.` });
}
/** Wonders found by holding ground: check the zones you hold. */
export function discoverWonders(state: RegionState, world: RegionWorld, lines: ReportLine[]) {
  const owned = new Set(controlled(state));
  for (const def of WONDERS) if (def.found === 'claim' && !state.wonders?.[def.id]) {
    const zone = wonderZone(world, def);
    if (zone && owned.has(zone)) gainWonder(state, world, def.id, lines, zone);
  }
}
export function nextWonderLevel(state: RegionState, id: string) {
  const w = wonderHolding(state, id);
  const def = WONDERS.find(d => d.id === id);
  if (!w || !def) return undefined;
  const initial = WONDER_INSTALLATIONS[id];
  if (w.installation?.status === 'discovered' && initial) return {
    name: 'Undersøk og sikre', text: 'Et crew må selv undersøke adkomsten og sikre anlegget. Sonetakning alene gjør det ikke operativt.',
    hours: initial.survey.hours, cost: initial.survey.cost, effect: {},
  } satisfies WonderLevel;
  if (w.installation?.status === 'secured' && initial) return {
    name: 'Gjør anlegget operativt', text: `Et nytt crew-oppdrag klargjør anlegget for «${def.levels[0].name}». Først da blir grunnvirkningene aktive.`,
    hours: initial.operate.hours, cost: initial.operate.cost, effect: def.levels[0].effect,
  } satisfies WonderLevel;
  return def.levels[w.level + 1];
}
export function wonderWorkCost(state: RegionState, id: string): Record<string, number> {
  const holding = wonderHolding(state, id), next = nextWonderLevel(state, id);
  if (!holding || !next || holding.progress > 0) return {};
  const stage = holding.installation?.status;
  return stage && stage !== 'operational' && holding.installation?.paidFor === stage ? {} : { ...next.cost };
}
/** Adds installation-specific validation to ordinary mission reach/position checks. */
export function wonderOrderError(state: RegionState, id: string, zoneId: string): string | undefined {
  const holding = wonderHolding(state, id);
  if (!holding) return 'Stedet er ikke rapportert oppdaget.';
  if (holding.zoneId !== zoneId) return 'Anleggsoppdraget må utføres der stedet faktisk er.';
  const zone = state.zones[zoneId];
  if (!zone) return 'Sonen finnes ikke i lagringen.';
  if (!wonderOperational(holding) && zone.status !== 'controlled' && (!zone.intel || zone.intel.day < state.day - 3 || zone.intel.max > R.claimMaxZombies)) {
    return 'Undersøk og rydd adkomsten først. Sonen må være kontrollert eller ha fersk etterretning om en nesten tom adkomst.';
  }
}
/** Work on the next level. Returns a report line when something happens. */
export function workOnWonder(state: RegionState, id: string, hours: number, lines: ReportLine[], pay: (cost: Record<string, number>) => void, source: 'crew' | 'population' = 'crew') {
  const w = wonderHolding(state, id);
  const def = WONDERS.find(d => d.id === id);
  const next = nextWonderLevel(state, id);
  if (!w || !def || !next) return;
  if (!Number.isFinite(hours) || hours <= 0) return;
  if (!wonderOperational(w)) {
    if (source !== 'crew') return;
    if ((state.zones[w.zoneId]?.zombies ?? Infinity) > R.claimMaxZombies) {
      lines.push({ tone: 'warn', title: `${def.name}: arbeidet stanset`, text: 'Adkomsten er ikke trygg nok. Et anleggsoppdrag fjerner ikke en horde eller erstatter rydding.', zoneId: w.zoneId });
      return;
    }
    const stage = w.installation!.status;
    if (w.installation!.paidFor !== stage) { pay(next.cost); w.installation!.paidFor = stage; }
    w.progress += hours;
    if (w.progress < next.hours) {
      lines.push({ tone: 'info', title: `${def.name}: ${next.name}`, text: `${Math.round(w.progress)} av ${next.hours} arbeidstimer utført av crew på stedet.`, zoneId: w.zoneId });
      return;
    }
    w.progress = 0;
    w.installation!.status = stage === 'discovered' ? 'secured' : 'operational';
    delete w.installation!.paidFor;
    const operational = w.installation!.status === 'operational';
    if (operational) state.population.adults += def.levels[0].effect.workers ?? 0;
    if (operational && id === 'plane' && !state.scheduled.some(event => event.id === 'airlift')) state.scheduled.push({ id: 'airlift', day: state.day + 20 });
    const text = operational ? `${def.name} er operativt: ${def.levels[0].text}` : `${def.name} er undersøkt og sikret. Et nytt anleggsoppdrag må klargjøre grunnfunksjonen før stedet gir effekter.`;
    lines.push({ tone: 'good', title: operational ? `${def.name} satt i drift` : `${def.name} undersøkt og sikret`, text, zoneId: w.zoneId });
    state.memory.push({ day: state.day, text });
    return;
  }
  if (!w.progress) pay(next.cost);
  w.progress = (w.progress || 0) + hours;
  if (w.progress >= next.hours) {
    const before = def.levels[w.level].effect.workers ?? 0;
    w.level += 1; w.progress = 0;
    state.population.adults += Math.max(0, (next.effect.workers ?? 0) - before);
    lines.push({ tone: 'good', title: `${def.name}: ${next.name}`, text: next.text, zoneId: w.zoneId });
    state.memory.push({ day: state.day, text: `${def.name}: ${next.name}.` });
  } else lines.push({ tone: 'info', title: `Arbeid på ${def.name}`, text: `${Math.round(w.progress)} av ${next.hours} timer mot «${next.name}».`, zoneId: w.zoneId });
}
