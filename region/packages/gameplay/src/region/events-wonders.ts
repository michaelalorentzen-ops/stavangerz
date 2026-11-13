/** Events that hand you a wonder, if you dare or are lucky, and the flights once the plane is yours. */
import { living, reach } from './engine';
import { addPeople, amount, event, give, hope, hurtPerson, need, pay, pickCrew, remember, schedule, zoneName, type EventDef } from './kit';
import { gainWonder, WONDERS, wonderOperational, wonderZone } from './wonders';
import { crewPositionFor } from './location';
import { discoverySites, observeDiscoveries, transmitDiscoveryReports, type DiscoveryRegionState } from './discoveries';
import type { RegionState, RegionWorld } from './types';

const def = (id: string) => WONDERS.find(w => w.id === id)!;

/** Actual information sources. Inject the authoritative communications service;
 * importing this file must not invent another radio/range implementation.
 * Register with the regular event catalog alongside EVENTS_WONDERS.
 */
export function createDiscoveryEvents(connected: (state: RegionState, world: RegionWorld, crewIds: readonly string[]) => boolean): EventDef[] {
  const listeners = (s: RegionState) => living(s).filter(p => {
    const position = crewPositionFor(s, p.id);
    return position?.kind === 'zone' && [s.homeZoneId, s.hq?.zoneId].includes(position.zoneId);
  }).map(p => p.id);
  const rumorSite = (s: RegionState, w: RegionWorld) => {
    const sites = discoverySites(s, w), entries = (s as DiscoveryRegionState).discoveries?.entries ?? {};
    return !entries['emergency-cupboard'] ? sites.ordinary
      : !entries['tor-repair-notes'] && living(s).some(p => p.id === 'tor') ? sites.tor : undefined;
  };
  const privateReports = (s: RegionState) => [...((s as DiscoveryRegionState).discoveries?.pending ?? []), ...((s as DiscoveryRegionState).discoveries?.wonderObservations ?? [])];
  const radioReport = (s: RegionState, w: RegionWorld) => privateReports(s)
    .find(observation => observation.reporterIds.some(id => living(s).some(p => p.id === id)) && connected(s, w, observation.reporterIds));
  return [
    {
      id: 'localFieldRumor', weight: 3, once: true, phase: [1, 5],
      when: (s, w) => s.day >= 2 && listeners(s).length > 0 && !!rumorSite(s, w),
      make: (s, w) => {
        const site = rumorSite(s, w);
        if (!site) return null;
        return event('En som kjenner området', `En forbipasserende stanser ved leiren. Hun nevner ${site.name}: «Det var en lapp der, før folk dro. Jeg rakk aldri å se nærmere.» Det er et rykte, ikke en rapport om at stedet er trygt.`, [
          { id: 'listen', label: 'Noter ledetråden', detail: 'Stedet kan undersøkes med et eget oppdrag. Ingen vet hva som fortsatt finnes der.' },
          { id: 'pass', label: 'La ryktet ligge', detail: 'Dere trenger ikke følge hvert spor. Speiding eller søk kan fortsatt finne det senere.' },
        ], { kicker: 'LOKALT RYKTE', data: { poiId: site.id } });
      },
      resolve: (s, w, choice, _rng, lines) => {
        if (choice !== 'listen') return;
        const site = w.pois.find(p => p.id === s.event?.data?.poiId), reporterIds = listeners(s);
        if (!site || !reporterIds.length) return;
        observeDiscoveries(s, w, { source: 'rumor', zoneId: site.zoneId, reporterIds, delivery: 'returned' }, lines);
      },
    },
    {
      id: 'fieldRadioReport', weight: 2, good: true, once: true, phase: [1, 5],
      when: (s, w) => listeners(s).length > 0 && !!radioReport(s, w),
      make: (s, w) => {
        const observation = radioReport(s, w);
        if (!observation) return null;
        return event('Et feltnotat over radio', 'Et feltlag med fungerende samband vil sende et notat fra undersøkelsen. De er fortsatt ute. Det de sier kan skrives i boka nå, men last og utstyr må fortsatt fraktes hjem.', [
          { id: 'receive', label: 'Ta imot rapporten', detail: 'Bare det laget faktisk har observert blir kjent. Sambandet kontrolleres igjen.' },
          { id: 'wait', label: 'Vent til laget kommer hjem', detail: 'Notatet blir hos laget inntil en levende avsender rapporterer.' },
        ], { kicker: 'FAKTISK SAMBAND', data: { observationId: observation.id } });
      },
      resolve: (s, w, choice, _rng, lines) => {
        if (choice !== 'receive') return;
        const observation = privateReports(s).find(p => p.id === s.event?.data?.observationId);
        if (!observation) return;
        const verified = connected(s, w, observation.reporterIds);
        if (!verified) { lines.push({ tone: 'warn', title: 'Sambandet brøt sammen', text: 'Ingen nye feltnotater kom fram. Laget beholder notatet til hjemkomst eller et nytt fungerende samband.' }); return; }
        transmitDiscoveryReports(s, w, observation.reporterIds, verified, lines);
      },
    },
  ];
}

export const EVENTS_WONDERS: EventDef[] = [
  {
    id: 'cruiseShip', weight: 3, once: true, phase: [1, 3],
    when: (s, w) => {
      const zone = wonderZone(w, def('cruise'));
      return !!zone && !s.wonders?.cruise && (reach(s, w).has(zone) || (s.stock.boat ?? 0) >= 1) && s.day >= 3;
    },
    make: (s, w) => {
      const zone = wonderZone(w, def('cruise'))!;
      const fighters = living(s).filter(p => p.skills.combat >= 4).length;
      return event('Skipet ved Strandkaien', `Fra ${zoneName(w, zone)} ser dere det: et cruiseskip, tolv dekk høyt, fortøyd ved Strandkaien. Landgangen er heist. På dekk 9 vifter noen med et laken. På dekk 4 står vinduene fulle av ansikter som ikke vifter.`, [
        { id: 'board', label: 'Noter skipet som et anleggsoppdrag', detail: 'Ingen går om bord nå. Send et faktisk crew for å undersøke, sikre og klargjøre stedet.' },
        { id: 'signal', label: 'Be om mer informasjon', detail: 'Et svar kan gi en ledetråd senere. Selve adkomsten må undersøkes av crew.' },
        { id: 'leave', label: 'La skipet ligge', detail: 'Et flytende likhus. Noen andre får prøve.' },
      ], { zoneId: zone, kicker: 'UNIKT STED', data: { zone, fighters, installationFlow: 1 } });
    },
    resolve: (s, w, c, rng, lines) => {
      const zone = String(s.event!.data!.zone), fighters = Number(s.event!.data!.fighters);
      if (s.event?.data?.installationFlow === 1) {
        if (c === 'signal') schedule(s, 3, 'cruiseSignal', { zone, installationFlow: 1 });
        else if (c === 'board') gainWonder(s, w, 'cruise', lines, zone);
        return;
      }
      if (c === 'leave') return;
      if (c === 'signal') { schedule(s, 3, 'cruiseSignal', { zone }); return; }
      pay(s, { ammo: 20 });
      for (const p of living(s).filter(x => x.skills.combat >= 3).slice(0, 3)) if (rng() < (fighters >= 2 ? .3 : .6)) hurtPerson(s, p, 15 + Math.floor(rng() * 20), lines, 'Trange korridorer på dekk 4.');
      gainWonder(s, w, 'cruise', lines, zone, true);
      addPeople(s, { adults: 6, children: 3 });
      hope(s, 6);
      lines.push({ tone: 'good', title: 'Ni overlevende fra dekk 9', text: 'Mannskap og passasjerer som barrikaderte seg i spa-avdelingen. De har levd på cocktailbær og vannflasker.' });
    },
  },
  {
    id: 'cruiseSignal', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, _rng, d) => d?.installationFlow === 1 ? event('Svar fra dekk 9', 'Et nytt notat bekrefter at noen fortsatt holder de øvre dekkene. Et crew må selv undersøke landgangen før skipet kan tas i bruk.', [
      { id: 'go', label: 'Noter adkomsten', detail: 'Skipet blir et kjent anleggsoppdrag. Ingen umiddelbar effekt eller gratis ombordstigning.' },
      { id: 'no', label: 'La skipet ligge', detail: 'Informasjonen er for usikker til å følge opp nå.' },
    ], { zoneId: String(d?.zone ?? ''), data: { zone: String(d?.zone ?? ''), installationFlow: 1 }, kicker: 'UNIKT STED' }) : event('Svar fra dekk 9', 'Om natta blinker en lommelykt tilbake. Morse, stavet feil. «KAPT HER. 9 IGJEN. LANDGANG I MORGEN 06.» Ved daggry senkes landgangen et stykke. Det kommer noe gående ned den.', [
      { id: 'go', label: 'Løp inn', detail: 'Kapteinen holder døra. Mindre kamp, men dere må være raske.' },
      { id: 'no', label: 'Det er for farlig', detail: 'Dere lar dem være.' },
    ], { zoneId: String(d?.zone ?? ''), data: { zone: String(d?.zone ?? '') }, kicker: 'UNIKT STED' }),
    resolve: (s, w, c, rng, lines) => {
      if (s.event?.data?.installationFlow === 1) {
        if (c === 'go') gainWonder(s, w, 'cruise', lines, String(s.event!.data!.zone));
        return;
      }
      if (c !== 'go') { hope(s, -3); remember(s, 'Dere lot de overlevende på cruiseskipet være.'); return; }
      const p = pickCrew(s, rng);
      if (p && rng() < .35) hurtPerson(s, p, 20, lines, 'Noe kom ned landgangen samtidig.');
      gainWonder(s, w, 'cruise', lines, String(s.event!.data!.zone), true);
      addPeople(s, { adults: 7, children: 2 });
      hope(s, 8);
    },
  },
  {
    id: 'planeFound', weight: 3, once: true, phase: [2, 4],
    when: (s, w) => {
      const zone = wonderZone(w, def('plane'));
      if (!zone || s.wonders?.plane) return false;
      const airport = s.factions.find(f => f.id === 'airport' && !f.defeated);
      return s.zones[zone]?.status === 'controlled' || reach(s, w).has(zone) || (!!airport && airport.relation >= 40);
    },
    make: (s, w) => {
      const zone = wonderZone(w, def('plane'))!;
      const pilot = living(s).find(p => /soldat|politi/i.test(p.role));
      return event('Flyet på oppstillingsplassen', `Ved flystasjonen i ${zoneName(w, zone)} står et grått transportfly. Tankene er tomme, og ett hjul er punktert. Ellers ser det helt. ${pilot ? `${pilot.name} har sittet i et slikt før, bak i lasterommet. Det er ikke det samme som å fly det.` : 'Ingen av dere kan fly. Men noen der ute kan.'}`, [
        { id: 'take', label: 'Noter flyet som et anleggsoppdrag', detail: 'Send et faktisk crew til flyet. Undersøkelse, sikring og grunnklargjøring må skje før videre reparasjon.' },
        { id: 'strip', label: 'La flyet stå', detail: 'Ingen fjernberging eller gratis last. Vanlige feltoppdrag i området er fortsatt mulige.' },
      ], { zoneId: zone, kicker: 'UNIKT STED', data: { zone, installationFlow: 1 } });
    },
    resolve: (s, w, c, _rng, lines) => {
      if (s.event?.data?.installationFlow === 1) {
        if (c === 'take') gainWonder(s, w, 'plane', lines, String(s.event!.data!.zone));
        return;
      }
      if (c === 'strip') { give(s, 'fuel', 40); give(s, 'parts', 15); remember(s, 'Dere slaktet flyet på Sola for deler.'); return; }
      gainWonder(s, w, 'plane', lines, String(s.event!.data!.zone), true);
      schedule(s, 20, 'airlift');
    },
  },
  {
    id: 'airlift', weight: 1, chainOnly: true, when: s => !!s.wonders?.plane && wonderOperational(s.wonders.plane),
    make: s => {
      const level = s.wonders?.plane?.level ?? 0;
      if (level < 1) return event('Flyet venter', 'Flyet står fortsatt på bakken. Gjør det luftdyktig under Unike steder for å fly.', [{ id: 'ok', label: 'Senere', detail: '' }]);
      return event('En tur med flyet', 'Tankene er fulle nok til én tur. Radioen har hørt om leirer i Bergen og Kristiansand. Ingen vet hva som venter på rullebanene.', [
        { id: 'bergen', label: 'Bergen: hent folk', detail: '60 drivstoff. Leiren på Flesland vil sende folk ut av byen.', disabled: need(s, { fuel: 60 }) },
        { id: 'krs', label: 'Kristiansand: hent medisin', detail: '60 drivstoff. Sykehuset på Eg har et lager de vil bytte.', disabled: need(s, { fuel: 60 }) },
        { id: 'stay', label: 'Ikke nå', detail: 'Flyet står.' },
      ], { kicker: 'UNIKT STED' });
    },
    resolve: (s, _w, c, rng, lines) => {
      schedule(s, 18, 'airlift');
      if (c === 'ok' || c === 'stay') return;
      pay(s, { fuel: 60 });
      if (rng() < .1) { const p = pickCrew(s, rng); if (p) hurtPerson(s, p, 30, lines, 'Landingen gikk ikke bra.'); return; }
      if (c === 'bergen') { addPeople(s, { adults: 10, children: 4 }); hope(s, 6); lines.push({ tone: 'good', title: 'Fjorten fra Bergen', text: 'De sier det regner der også.' }); }
      if (c === 'krs') { give(s, 'medicine', 40); give(s, 'antibiotics', 6); hope(s, 3); lines.push({ tone: 'good', title: 'Medisin fra Kristiansand', text: 'Byttet mot løftet om at dere kommer tilbake.' }); }
      void amount;
    },
  },
];
