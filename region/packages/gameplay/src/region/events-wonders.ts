/** Events that hand you a wonder, if you dare or are lucky, and the flights once the plane is yours. */
import { living, reach } from './engine';
import { addPeople, amount, event, give, hope, hurtPerson, need, pay, pickCrew, remember, schedule, zoneName, type EventDef } from './kit';
import { gainWonder, WONDERS, wonderZone } from './wonders';

const def = (id: string) => WONDERS.find(w => w.id === id)!;

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
        { id: 'board', label: 'Gå om bord og ta skipet', detail: `20 ammunisjon. ${fighters >= 2 ? 'Dere har folk som kan dette.' : 'Dere har få som kan slåss. Det blir farlig.'}`, disabled: need(s, { ammo: 20 }), tags: ['reckless'] },
        { id: 'signal', label: 'Signaler til dem på dekk 9', detail: 'Kanskje de kan åpne fra innsiden. Det tar tid, og lyset synes langt.' },
        { id: 'leave', label: 'La skipet ligge', detail: 'Et flytende likhus. Noen andre får prøve.' },
      ], { zoneId: zone, kicker: 'UNIKT STED', data: { zone, fighters } });
    },
    resolve: (s, w, c, rng, lines) => {
      const zone = String(s.event!.data!.zone), fighters = Number(s.event!.data!.fighters);
      if (c === 'leave') return;
      if (c === 'signal') { schedule(s, 3, 'cruiseSignal', { zone }); return; }
      pay(s, { ammo: 20 });
      for (const p of living(s).filter(x => x.skills.combat >= 3).slice(0, 3)) if (rng() < (fighters >= 2 ? .3 : .6)) hurtPerson(s, p, 15 + Math.floor(rng() * 20), lines, 'Trange korridorer på dekk 4.');
      gainWonder(s, w, 'cruise', lines, zone);
      addPeople(s, { adults: 6, children: 3 });
      hope(s, 6);
      lines.push({ tone: 'good', title: 'Ni overlevende fra dekk 9', text: 'Mannskap og passasjerer som barrikaderte seg i spa-avdelingen. De har levd på cocktailbær og vannflasker.' });
    },
  },
  {
    id: 'cruiseSignal', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, _rng, d) => event('Svar fra dekk 9', 'Om natta blinker en lommelykt tilbake. Morse, stavet feil. «KAPT HER. 9 IGJEN. LANDGANG I MORGEN 06.» Ved daggry senkes landgangen et stykke. Det kommer noe gående ned den.', [
      { id: 'go', label: 'Løp inn', detail: 'Kapteinen holder døra. Mindre kamp, men dere må være raske.' },
      { id: 'no', label: 'Det er for farlig', detail: 'Dere lar dem være.' },
    ], { zoneId: String(d?.zone ?? ''), data: { zone: String(d?.zone ?? '') }, kicker: 'UNIKT STED' }),
    resolve: (s, w, c, rng, lines) => {
      if (c !== 'go') { hope(s, -3); remember(s, 'Dere lot de overlevende på cruiseskipet være.'); return; }
      const p = pickCrew(s, rng);
      if (p && rng() < .35) hurtPerson(s, p, 20, lines, 'Noe kom ned landgangen samtidig.');
      gainWonder(s, w, 'cruise', lines, String(s.event!.data!.zone));
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
        { id: 'take', label: 'Gjør flyet til deres', detail: 'Det tar tid og deler å få det i lufta. Men da kan dere nå Bergen og Kristiansand.' },
        { id: 'strip', label: 'Ta ut drivstoffrester og deler', detail: '40 drivstoff og 15 deler nå. Flyet flyr aldri igjen.' },
      ], { zoneId: zone, kicker: 'UNIKT STED', data: { zone } });
    },
    resolve: (s, w, c, _rng, lines) => {
      if (c === 'strip') { give(s, 'fuel', 40); give(s, 'parts', 15); remember(s, 'Dere slaktet flyet på Sola for deler.'); return; }
      gainWonder(s, w, 'plane', lines, String(s.event!.data!.zone));
      schedule(s, 20, 'airlift');
    },
  },
  {
    id: 'airlift', weight: 1, chainOnly: true, when: s => !!s.wonders?.plane,
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
