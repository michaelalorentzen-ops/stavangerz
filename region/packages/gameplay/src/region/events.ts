/**
 * Things that happen. About once a week a bigger event, sometimes a small surprise, and chains that come back days later.
 * What can happen depends on the phase, what you hold, your laws and what you chose before.
 */
import type { EventChoice, PendingEvent, RegionState, RegionWorld, ReportLine } from './types';
import { living, random, recruit } from './engine';
import { R } from './rules';
import { confiscateGearWeapon, settleGearReturns } from './gear';
import { REACTIONS, TRAIT_NAMES } from './systems';
import {
  addPeople, amount, borderZones, moveZombies, chance, coastalOwned, crewById, event, farmOwned, give, hasLaw, hasModule, hasTech, hope, killPerson,
  leaves, loyalty, need, pay, pickCrew, pickOne, remember, schedule, seasonName, setFlag, totalPeople, unrest, zoneName,
  type EventDef,
} from './kit';
import { indexWorld, escapeRoute } from './engine';
import { EVENTS_PEOPLE } from './events-people';
import { EVENTS_WORLD, bindWorld } from './events-world';
import { EVENTS_FACTIONS } from './events-factions';
import { enforceAvatarFate, advanceCampaignCommit } from './campaign';
import { registerLegacyAbsences } from './mobility';
import { communicationsStatus } from './communications';
import { EVENTS_WONDERS, createDiscoveryEvents } from './events-wonders';

const CORE: EventDef[] = [
  {
    id: 'refugees', weight: 4, good: true, phase: [1, 5], when: s => s.laws.every(l => l !== 'closedGates'),
    make: (s, _w, rng) => {
      const adults = 1 + Math.floor(rng() * 3), children = Math.floor(rng() * 3), elderly = rng() < .3 ? 1 : 0;
      const n = adults + children + elderly;
      const useful = hasLaw(s, 'usefulOnly');
      const choices: EventChoice[] = [{ id: 'admit', label: 'Slipp alle inn', detail: `${n} flere munner. ${adults} kan jobbe.`, tags: ['charity'] }];
      if (useful || children + elderly) choices.push({ id: 'adults', label: 'Bare de voksne', detail: 'Barna og de gamle må klare seg selv.', tags: ['cruel', 'children'] });
      choices.push({ id: 'help', label: 'Gi dem mat og send dem videre', detail: '6 mat og 6 vann.', disabled: need(s, { food: 6, water: 6 }), tags: ['merciful'] },
        { id: 'refuse', label: 'Avvis dem', detail: 'Dere sparer forsyningene. Noen vil ikke like det.', tags: ['harsh'] });
      return event('Folk ved sperringen', `${n} mennesker står ved sperringen: ${adults} voksne${children ? `, ${children} barn` : ''}${elderly ? ' og en gammel mann' : ''}. De har gått fra ${pickOne(rng, ['Hinna', 'Tjensvoll', 'Våland', 'Hillevåg', 'Madla', 'Gausel'])} og har ingenting med seg.`, choices, { data: { adults, children, elderly } });
    },
    resolve: (s, _w, c) => {
      const d = s.event!.data!;
      if (c === 'admit') { addPeople(s, { adults: Number(d.adults), children: Number(d.children), elderly: Number(d.elderly) }); hope(s, 3); }
      if (c === 'adults') { addPeople(s, { adults: Number(d.adults) }); hope(s, -4); remember(s, 'Dere slapp inn de voksne og lot barna stå igjen ved sperringen.'); }
      if (c === 'help') { pay(s, { food: 6, water: 6 }); hope(s, 2); }
      if (c === 'refuse') hope(s, -3);
    },
  },
  {
    // The owner's own example: a kindergarten in a shelter. Every answer costs something.
    id: 'kindergarten', weight: 5, once: true, phase: [1, 3], when: s => s.day >= 4 && s.population.children < 10,
    make: (s, w, rng) => {
      const zone = pickOne(rng, borderZones(s, w).length ? borderZones(s, w) : [s.homeZoneId]);
      return event('Barnehagen i bomberommet', `Under en barnehage i ${zoneName(w, zone)} finner dere et tilfluktsrom. Tre voksne og tjue barn har sittet der siden første dag. Maten er slutt. En av de voksne er elektriker, en er sykepleier. Barna er mellom to og seks år.`, [
        { id: 'all', label: 'Ta med alle', detail: '3 voksne og 20 barn. Tjue munner som ikke kan jobbe på mange år.', tags: ['merciful', 'charity'] },
        { id: 'adults', label: 'Ta med de voksne', detail: 'Dere trenger elektrikeren og sykepleieren. Barna blir igjen med maten dere kan avse.', tags: ['cruel', 'children'] },
        { id: 'supply', label: 'Gi dem mat og la dem bli', detail: '20 mat og 20 vann. Dere kommer tilbake.', disabled: need(s, { food: 20, water: 20 }), tags: ['charity'] },
        { id: 'leave', label: 'Gå videre', detail: 'Dere kan ikke redde alle.', tags: ['cruel', 'children'] },
      ], { zoneId: zone, data: { zone } });
    },
    resolve: (s, w, c, _rng, lines) => {
      const zone = String(s.event!.data!.zone);
      if (c === 'all') {
        addPeople(s, { adults: 3, children: 20 }); hope(s, 8); unrest(s, 6);
        remember(s, `Dere tok med tjue barnehagebarn fra ${zoneName(w, zone)}.`);
        setFlag(s, 'kindergarten', 'saved');
      }
      if (c === 'adults') {
        addPeople(s, { adults: 3 }); hope(s, -14); unrest(s, 4);
        remember(s, `Dere tok med de tre voksne og lot tjue barn bli igjen i ${zoneName(w, zone)}.`);
        setFlag(s, 'kindergarten', 'abandoned');
        schedule(s, 6, 'kindergartenEcho', { zone });
        lines.push({ tone: 'bad', title: 'Ingen sier noe på vei hjem', text: 'En av de voksne gråter hele veien.' });
      }
      if (c === 'supply') { pay(s, { food: 20, water: 20 }); hope(s, 3); setFlag(s, 'kindergarten', 'supplied'); schedule(s, 8, 'kindergartenReturn', { zone }); }
      if (c === 'leave') { hope(s, -8); setFlag(s, 'kindergarten', 'left'); remember(s, `Dere gikk fra barnehagen i ${zoneName(w, zone)}.`); }
    },
  },
  {
    id: 'kindergartenEcho', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, _rng, data) => {
      const nurse = s.population.adults > 0;
      return event('Sykepleieren', `Sykepleieren fra barnehagen i ${zoneName(w, data?.zone)} har ikke sagt et ord på seks dager. I natt var hun borte. Hun tok med seg medisin og mat, og gikk tilbake for å finne barna.`, [
        { id: 'follow', label: 'Send noen etter henne', detail: 'To fra crewet går i morgen. Det kan finnes barn i live.', tags: ['merciful', 'children'] },
        { id: 'let', label: 'La henne gå', detail: 'Hun valgte selv.', tags: ['harsh'] },
      ], { data: { zone: String(data?.zone ?? ''), nurse: nurse ? 1 : 0 } });
    },
    resolve: (s, w, c, rng, lines) => {
      if (s.population.adults > 0) s.population.adults -= 1;
      give(s, 'medicine', -4); give(s, 'food', -8);
      if (c === 'follow') {
        const found = Math.floor(rng() * 8);
        if (found) { addPeople(s, { adults: 1, children: found }); hope(s, 6); lines.push({ tone: 'good', title: `${found} barn i live`, text: `Hun hadde holdt dem samlet i ${zoneName(w, s.event!.data!.zone)}. Dere tar dem med hjem.` }); remember(s, `Dere hentet ${found} av barnehagebarna likevel.`); }
        else { hope(s, -6); lines.push({ tone: 'bad', title: 'For sent', text: 'Rommet var tomt. Det var ikke tomt for zombier.' }); const p = pickCrew(s, rng); if (p) p.health -= 20; }
      } else hope(s, -3);
    },
  },
  {
    id: 'kindergartenReturn', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, _rng, data) => event('Tilbake til bomberommet', `Maten dere la igjen i ${zoneName(w, data?.zone)} er spist opp. De tre voksne har holdt barna i live, men de klarer ikke en uke til.`, [
      { id: 'all', label: 'Ta dem med nå', detail: '3 voksne og 18 barn. To av barna klarte seg ikke.', tags: ['merciful', 'charity'] },
      { id: 'supply', label: 'Mer mat', detail: '25 mat og 20 vann. Dere skyver valget foran dere.', disabled: need(s, { food: 25, water: 20 }), tags: ['charity'] },
      { id: 'leave', label: 'Det får være nok', detail: 'Dere har gjort det dere kunne.', tags: ['cruel', 'children'] },
    ], { data: { zone: String(data?.zone ?? '') } }),
    resolve: (s, _w, c) => {
      if (c === 'all') { addPeople(s, { adults: 3, children: 18 }); hope(s, 5); unrest(s, 5); }
      if (c === 'supply') { pay(s, { food: 25, water: 20 }); schedule(s, 10, 'kindergartenReturn', s.event!.data); }
      if (c === 'leave') { hope(s, -10); remember(s, 'Dere sluttet å bringe mat til barnehagen.'); }
    },
  },
  {
    id: 'cache', weight: 3, good: true, when: () => true,
    make: (_s, _w, rng) => {
      const kinds: [string, number][] = [['food', 25], ['medicine', 8], ['ammo', 40], ['fuel', 20], ['building', 25], ['batteries', 8]];
      const [id, n] = pickOne(rng, kinds);
      return event('Et skjult lager', `Noen har tegnet et kart på en vegg. Det viser et lager med ${id === 'food' ? 'mat' : id === 'ammo' ? 'ammunisjon' : id === 'fuel' ? 'diesel' : 'utstyr'}. Det kan være en felle.`, [
        { id: 'go', label: 'Hent det', detail: 'En liten risiko for skader.', tags: ['reckless'] },
        { id: 'skip', label: 'La det ligge', detail: 'Ingen risiko.' }], { data: { id, n } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c !== 'go') return;
      give(s, String(s.event!.data!.id), Number(s.event!.data!.n));
      if (rng() < .3) { const v = pickCrew(s, rng); if (v) { v.health -= 15; lines.push({ tone: 'bad', title: `${v.name} ble skadet`, text: 'Lageret var ikke tomt for zombier.' }); } }
    },
  },
  {
    id: 'storm', weight: 3, when: (s, w) => coastalOwned(s, w).length > 0 && ['Høst', 'Vinter'].includes(seasonName(s)),
    make: s => event('Storm fra havet', 'Sørvesten river i alt som er løst. Sperringene ved sjøen og båtene er utsatt. Måkene har gjemt seg, og det sier sitt.', [
      { id: 'secure', label: 'Sikre båter og sperringer', detail: '6 byggemateriale, ingen skade.', disabled: need(s, { building: 6 }) },
      { id: 'ride', label: 'Vent den ut', detail: 'Sperringer svekkes, og en båt kan gå tapt.' }]),
    resolve: (s, _w, c, rng) => {
      if (c === 'secure') { give(s, 'building', -6); return; }
      for (const id of Object.keys(s.barricades)) s.barricades[id] = Math.max(0, s.barricades[id] - 4);
      if (amount(s, 'boat') >= 1 && rng() < .5) give(s, 'boat', -1);
    },
  },
  {
    id: 'horde', weight: 4, when: (s, w) => borderZones(s, w).length > 0,
    make: (s, w, rng) => {
      const near = borderZones(s, w);
      const target = pickOne(rng, near);
      const herd = s.mutations.some(m => m.id === 'herd') ? 1.5 : 1;
      const size = Math.round((25 + rng() * 40 + s.day * .8) * herd * [0, .7, 1, 1.3, 1.6, 1.2][s.phase]);
      return event('En horde på vandring', `Om lag ${size} zombier driver mot ${zoneName(w, target)}, rett ved grensen deres.${hasTech(s, 'intel') ? ' Lytteposten varslet i god tid.' : ''}`, [
        { id: 'lure', label: 'Lokk dem bort med støy', detail: `${hasTech(s, 'decoys') ? '2' : '6'} drivstoff til en bil med alarm som kjøres langt bort.`, disabled: need(s, { fuel: hasTech(s, 'decoys') ? 2 : 6 }) },
        { id: 'brace', label: 'Forbered dere', detail: 'Sperringene forsterkes for 6 byggemateriale.', disabled: need(s, { building: 6 }) },
        { id: 'ignore', label: 'Gjør ingenting', detail: 'Håp at de går forbi.', tags: ['reckless'] }], { zoneId: target, data: { target, size } });
    },
    resolve: (s, _w, c, _rng, lines) => {
      const target = String(s.event!.data!.target), size = Number(s.event!.data!.size);
      if (c === 'lure') { give(s, 'fuel', hasTech(s, 'decoys') ? -2 : -6); moveZombies(s, _w, target, Math.round(size * .2)); return; }
      const came = moveZombies(s, _w, target, size);
      if (came < size * .5) lines.push({ tone: 'info', title: 'Horden var mindre enn fryktet', text: `Om lag ${came} kom. Det er ikke så mange døde igjen i nærheten.` });
      if (c === 'brace') { give(s, 'building', -6); for (const id of Object.keys(s.barricades)) s.barricades[id] += 6; }
    },
  },
  {
    id: 'sickness', weight: 2, when: s => totalPeople(s) >= 3 && !Object.values(s.networks).some(n => n.includes('water')),
    make: (s, _w, rng) => {
      const v = pickCrew(s, rng);
      if (!v) return null;
      return event(`${v.name} er syk`, `Feber og frysninger. ${hasTech(s, 'hygiene') ? 'Dere koker vannet, men noe har sluppet gjennom.' : 'Det kommer trolig fra vannet.'} Uten behandling kan det bli alvorlig.`, [
        { id: 'antibiotics', label: 'Gi antibiotika', detail: 'Sikker bedring.', disabled: need(s, { antibiotics: 1 }) },
        { id: 'medicine', label: 'Gi medisin og hvile', detail: '4 medisin. Trolig bra.', disabled: need(s, { medicine: 4 }) },
        { id: 'wait', label: 'Vent og se', detail: 'Kan gå bra. Kan gå svært galt.', tags: ['reckless'] }], { data: { who: v.id } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const v = crewById(s, s.event!.data!.who);
      if (!v) return;
      if (c === 'antibiotics') { give(s, 'antibiotics', -1); return; }
      if (c === 'medicine') { give(s, 'medicine', -4); v.health -= rng() < .2 ? 20 : 5; return; }
      const harm = rng() < .35 ? 70 : 25;
      v.health -= harm;
      lines.push({ tone: 'bad', title: `${v.name} ble verre`, text: 'Feberen tok hardt.' });
    },
  },
  {
    id: 'tunnelFlood', weight: 3, when: (s, w) => w.links.some(l => l.kind === 'tunnel' && l.lengthM > 2500 && s.chokepoints[l.id] !== 'flooded' && s.chokepoints[l.id] !== 'blown' && [l.a, l.b].some(id => s.zones[id]?.status === 'controlled' || borderZones(s, w).includes(id))),
    make: (s, w, rng) => {
      const near = new Set([...borderZones(s, w), ...Object.keys(s.zones).filter(id => s.zones[id].status === 'controlled')]);
      const options = w.links.filter(l => l.kind === 'tunnel' && l.lengthM > 2500 && !['flooded', 'blown'].includes(s.chokepoints[l.id]) && (near.has(l.a) || near.has(l.b)));
      if (!options.length) return null;
      const link = pickOne(rng, options);
      const index = indexWorld(w);
      const powered = [link.a, link.b].some(id => (s.networks[index.byId.get(id)?.parentId ?? ''] ?? []).includes('power'));
      if (powered) return null;
      return event(`${link.name} tar inn vann`, 'Uten strøm går pumpene i de undersjøiske tunnelene tom for diesel. Snart står tunnelen under vann for godt.', [
        { id: 'pump', label: 'Kjør pumpene på aggregat', detail: 'Et aggregat og 12 drivstoff holder den åpen en stund.', disabled: need(s, { generator: 1, fuel: 12 }) },
        { id: 'let', label: 'La den gå', detail: 'Tunnelen er stengt for alle, også zombier.' }], { data: { link: link.id } });
    },
    resolve: (s, _w, c) => {
      const link = String(s.event!.data!.link);
      if (c === 'pump') { give(s, 'fuel', -12); return; }
      s.chokepoints[link] = 'flooded';
      delete s.barricades[link];
    },
  },
  {
    id: 'harvest', weight: 3, good: true, when: (s, w) => farmOwned(s, w).length > 0 && seasonName(s) === 'Høst',
    make: () => event('Kornet står modent', 'Jordene dere eier gir mer enn ventet. Men det må tas inn før regnet. Og det kommer alltid regn.', [
      { id: 'all', label: 'Alle mann på jordet', detail: 'Mye mat, men alle blir slitne.' },
      { id: 'some', label: 'Ta det som går', detail: 'Litt mat, ingen utmattelse.' }]),
    resolve: (s, w, c) => {
      const ha = farmOwned(s, w).reduce((n, id) => n + (indexWorld(w).byId.get(id)?.measures?.farm ?? 0) / 1e4, 0);
      if (c === 'all') { give(s, 'food', Math.round(Math.min(220, ha * 12 + s.population.adults * 3))); for (const v of living(s)) v.fatigue = Math.min(100, v.fatigue + 40); }
      else give(s, 'food', Math.round(Math.min(60, ha * 4)));
    },
  },
  {
    id: 'goodFishing', weight: 2, good: true, when: (s, w) => coastalOwned(s, w).length > 0 && amount(s, 'boat') >= 1 && seasonName(s) !== 'Vinter',
    make: () => event('Makrellen er her', 'Fjorden koker av fisk. Én dag med båten kan gi mye.', [
      { id: 'go', label: 'Ut med båten', detail: 'Mye fisk. Salt gjør at den holder.' }, { id: 'no', label: 'Ikke nå', detail: '' }]),
    resolve: (s, _w, c) => { if (c === 'go') give(s, 'food', amount(s, 'salt') >= 3 || hasTech(s, 'saltDry') ? 50 : 30); },
  },
  {
    id: 'car', weight: 2, good: true, phase: [1, 3], when: () => true,
    make: () => event('En bil med full tank', 'Noen har parkert en bil med full tank og verktøy i bagasjerommet ved grensen.', [
      { id: 'take', label: 'Tapp den og ta verktøyet', detail: '15 drivstoff og 3 deler.' }, { id: 'no', label: 'La den stå', detail: '' }]),
    resolve: (s, _w, c) => { if (c === 'take') { give(s, 'fuel', 15); give(s, 'parts', 3); } },
  },
  {
    id: 'fire', weight: 2, when: s => !!s.hq && seasonName(s) === 'Sommer',
    make: s => event('Brann i lageret', 'En glo fra kokeplassen har tent på kartonger. Det brenner.', [
      { id: 'water', label: 'Slukk med vann', detail: '15 vann.', disabled: need(s, { water: 15 }) },
      { id: 'save', label: 'Redd det dere kan', detail: 'Byggemateriale og mat går tapt.' }]),
    resolve: (s, _w, c) => {
      if (c === 'water') { give(s, 'water', -15); return; }
      give(s, 'building', -Math.round(amount(s, 'building') * .4)); give(s, 'food', -Math.round(amount(s, 'food') * .2));
    },
  },
  {
    id: 'rats', weight: 2, when: s => amount(s, 'food') > 80 && !hasModule(s, 'depot'),
    make: () => event('Rotter i maten', 'Lageret er fullt av spor. Uten et skikkelig lager forsvinner maten.', [
      { id: 'clean', label: 'Rydd og tett lageret', detail: '4 byggemateriale. Lite tap.' }, { id: 'accept', label: 'Godta tapet', detail: 'En del av maten er ødelagt.' }]),
    resolve: (s, _w, c) => {
      if (c === 'clean' && amount(s, 'building') >= 4) { give(s, 'building', -4); give(s, 'food', -5); }
      else give(s, 'food', -Math.round(amount(s, 'food') * .2));
    },
  },
  {
    id: 'radio', weight: 2, good: true, when: s => s.factions.some(f => !f.known && !f.hostile),
    make: (s, _w, rng) => {
      const f = pickOne(rng, s.factions.filter(x => !x.known && !x.hostile));
      return event('Stemmer på radioen', `En gammel radio knitrer. Noen kaller seg ${f.name} og leter etter andre.`, [
        { id: 'answer', label: 'Svar', detail: 'Dere får kontakt.' }, { id: 'silent', label: 'Hold dere skjult', detail: 'Ingen vet hvor dere er.' }], { factionId: f.id });
    },
    resolve: (s, _w, c) => { const f = s.factions.find(x => x.id === s.event!.factionId); if (f && c === 'answer') f.known = true; },
  },
  {
    id: 'winter', weight: 3, when: s => seasonName(s) === 'Vinter' && amount(s, 'fuel') < totalPeople(s) * 3,
    make: () => event('Kulda biter', 'Det er minusgrader om natta, og vinden står rett inn fra havet. Uten varme blir folk syke.', [
      { id: 'burn', label: 'Brenn møbler og materialer', detail: '10 byggemateriale gir varme en stund.' },
      { id: 'elderly', label: 'Gi de gamle og barna varmen først', detail: 'De voksne fryser. Noen blir syke.', tags: ['merciful'] },
      { id: 'endure', label: 'Hold ut', detail: 'Helse og håp synker. De svakeste kan dø.', tags: ['harsh'] }]),
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'burn' && amount(s, 'building') >= 10) { give(s, 'building', -10); give(s, 'fuel', 6); return; }
      if (c === 'elderly') { s.population.sick += Math.ceil(s.population.adults * .15); hope(s, -1); return; }
      for (const v of living(s)) v.health -= 8;
      hope(s, -5);
      const lost = Math.min(s.population.elderly, Math.ceil(s.population.elderly * .2 * rng()));
      if (lost) { s.population.elderly -= lost; lines.push({ tone: 'bad', title: `${lost} eldre døde i kulda`, text: 'De fant dem om morgenen.' }); }
    },
  },
  {
    id: 'quiet', weight: 2, good: true, when: s => s.morale < 80,
    make: () => event('En stille kveld', 'Ingen lyder fra gata, bare regnet. Noen finner en gitar og kan to sanger. Begge er av Vamp.', [{ id: 'ok', label: 'Nyt det', detail: 'Håpet stiger.' }]),
    resolve: s => { hope(s, 6); unrest(s, -3); },
  },
  {
    // Day 0 in a dense centre: the first choice is how to get out.
    id: 'escape', weight: 1, chainOnly: true, when: () => true,
    make: (s, w) => {
      const index = indexWorld(w);
      const here = s.zones[s.homeZoneId].zombies;
      const calm = escapeRoute(s, w)?.zoneId;
      if (!calm) return null;
      const coast = index.coastal.has(s.homeZoneId);
      return event('Den første natta', `Det er om lag ${here} døde i gatene rundt dere i ${zoneName(w, s.homeZoneId)}. Dere kan ikke rydde dette med fire personer. En mulig vei ut går mot ${zoneName(w, calm)}, men også der venter det døde.`, [
        { id: 'run', label: `Bryt ut mot ${zoneName(w, calm)}`, detail: `Om lag ${s.zones[calm].zombies} døde der. Dere får med det meste. Noen kan bli skadet.` },
        { id: 'hole', label: 'Barrikader dere inne', detail: 'Bruk alt byggemateriale på dører og trapper. Bråket trekker til flere. Et rolig sted holder, et tett sted blir en beleiring.' },
        ...(coast ? [{ id: 'boat', label: 'Ta en båt fra kaia', detail: 'Stille ut på fjorden og i land et roligere sted. Mye må bli igjen.' }] : []),
      ], { kicker: 'DAG 0', data: { calm } });
    },
    resolve: (s, w, c, rng, lines) => {
      const index = indexWorld(w);
      const move = (to: string, keep: number) => {
        for (const [id, n] of Object.entries(s.stock)) { const k = Math.floor(n * keep); s.zones[s.homeZoneId].loot[id] = (s.zones[s.homeZoneId].loot[id] ?? 0) + n - k; s.stock[id] = k; }
        s.homeZoneId = to;
        s.zones[to].status = 'scouted';
        s.zones[to].intel = { min: s.zones[to].zombies, max: s.zones[to].zombies + 2, day: s.day };
        remember(s, `Dere flyktet til ${zoneName(w, to)} den første natta.`);
      };
      if (c === 'run') {
        move(String(s.event!.data!.calm), .85);
        hope(s, 4);
        for (const p of living(s)) if (rng() < .3) { p.health -= 8 + Math.floor(rng() * 15); lines.push({ tone: 'bad', title: `${p.name} ble skadet på flukten`, text: 'Gatene var ikke tomme.' }); }
      }
      if (c === 'hole') {
        const z = s.zones[s.homeZoneId];
        give(s, 'building', -amount(s, 'building'));
        // Hammering and shouting draws the neighbours' dead too. In a quiet place it works; in a dense one it is a siege.
        z.zombies = Math.round(z.zombies * .9);
        moveZombies(s, w, s.homeZoneId, Math.round(z.zombies * .15));
        for (const a of index.adjacent.get(s.homeZoneId) ?? []) if (a.kind === 'land') { s.barricades[a.connId] = 10; s.barricadeTier[a.connId] = 1; }
      }
      if (c === 'boat') {
        const here = index.byId.get(s.homeZoneId)!.at!;
        const options = [...index.coastal].filter(id => id !== s.homeZoneId && !s.zones[id].owner)
          .map(id => ({ id, d: Math.hypot((index.byId.get(id)!.at![0] - here[0]) * 57.4, (index.byId.get(id)!.at![1] - here[1]) * 111.2) }))
          .filter(o => o.d <= 4).sort((a, b) => s.zones[a.id].zombies - s.zones[b.id].zombies);
        if (options[0]) move(options[0].id, .45);
        give(s, 'boat', 1);
      }
    },
  },
  {
    id: 'mutiny', weight: 1, chainOnly: true, when: () => true,
    make: s => event('Mytteri brygger', `Folk samles i små grupper og tier når du kommer. Uroen er ${Math.round(s.discontent)} av 100. Når den når 100, er det ikke du som leder lenger.`, [
      { id: 'concede', label: 'Opphev de harde lovene', detail: 'Lover om straff, rasjoner, porten og arbeid som folk hater, forsvinner.', tags: ['merciful'] },
      { id: 'feast', label: 'Felles festmåltid', detail: `${Math.ceil(totalPeople(s) * 1.5)} mat. Det kjøper litt tid.`, disabled: need(s, { food: Math.ceil(totalPeople(s) * 1.5) }) },
      { id: 'crush', label: 'Slå ned på det', detail: 'Arrester lederne. Ro i dag, frykt i morgen.', tags: ['harsh', 'cruel'] },
      { id: 'wait', label: 'Vent', detail: 'Kanskje det går over.', tags: ['reckless'] },
    ]),
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'concede') {
        const harsh = ['rationReduced', 'rationWorkers', 'rationHalf', 'longShifts', 'childLabour', 'punishExile', 'punishStocks', 'punishDeath', 'closedGates', 'usefulOnly', 'curfew', 'strongman', 'militia', 'bittenMercy'];
        s.laws = s.laws.filter(l => !harsh.includes(l));
        unrest(s, -25); hope(s, 3);
      }
      if (c === 'feast') { give(s, 'food', -Math.ceil(totalPeople(s) * 1.5)); unrest(s, -15); hope(s, 4); }
      if (c === 'crush') {
        unrest(s, -30); hope(s, -12);
        const disloyal = living(s).filter(p => (p.loyalty ?? 60) < 35).sort((a, b) => (a.loyalty ?? 60) - (b.loyalty ?? 60))[0];
        if (disloyal && rng() < .6) leaves(s, disloyal, lines, 'Arrestert som en av lederne og jaget ut porten.');
        else if (s.population.adults) { s.population.adults -= 1; lines.push({ tone: 'bad', title: 'En av lederne døde i arresten', text: 'Ingen spør hvordan.' }); }
        remember(s, 'Dere slo ned et mytteri.');
      }
      if (c === 'wait') unrest(s, 5);
    },
  },
  {
    id: 'desertion', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, data) => {
      const p = crewById(s, data?.who);
      if (!p) return null;
      return event(`${p.name} vil gå`, `${p.name} har pakket sekken. «Jeg kjenner ikke igjen denne gruppa lenger. Jeg tar med meg det jeg trenger og går.»`, [
        { id: 'let', label: 'La dem gå med det de har tatt', detail: 'Dere mister en person og litt forsyninger.' },
        { id: 'talk', label: 'Snakk med dem', detail: 'Lov at ting skal bli annerledes. Det koster litt håp hvis du ikke holder det.' },
        { id: 'stop', label: 'Stopp dem med makt', detail: 'De blir. Ingen glemmer det.', tags: ['harsh'] },
      ], { data: { who: p.id } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const p = crewById(s, s.event!.data!.who);
      if (!p) return;
      if (c === 'let') leaves(s, p, lines, 'Gikk med en sekk mat og en lommelykt.', { food: Math.min(10, amount(s, 'food')), medicine: Math.min(2, amount(s, 'medicine')) });
      if (c === 'talk') { if (rng() < .6) loyalty(p, 30); else leaves(s, p, lines, 'Ordene hjalp ikke.'); }
      if (c === 'stop') { loyalty(p, 10); unrest(s, 8); hope(s, -4); }
    },
  },
];

const EVENTS: EventDef[] = [...CORE, ...EVENTS_PEOPLE, ...EVENTS_WORLD, ...EVENTS_FACTIONS, ...EVENTS_WONDERS, ...createDiscoveryEvents((s, w, ids) => communicationsStatus(s, w, ids).connected)];
export const EVENT_IDS = EVENTS.map(e => e.id);

function eligible(def: EventDef, state: RegionState, world: RegionWorld) {
  if (def.chainOnly) return false;
  if (def.phase && (state.phase < def.phase[0] || state.phase > def.phase[1])) return false;
  if (def.once && state.counters[`event:${def.id}`]) return false;
  try { return def.when(state, world); } catch { return false; }
}
function build(def: EventDef, state: RegionState, world: RegionWorld, rng: () => number, data?: Record<string, string | number>): PendingEvent | undefined {
  bindWorld(world);
  let made: Omit<PendingEvent, 'id'> | null = null;
  try { made = def.make(state, world, rng, data); } catch { made = null; }
  if (!made || !made.choices.length) return undefined;
  return { id: def.id, ...made, voices: [...(made.voices ?? []), ...voices(state, made.choices)] };
}
/** Who in the crew will care, said before the choice. Only strong reactions are shown. */
function voices(state: RegionState, choices: PendingEvent['choices']) {
  const out: string[] = [];
  for (const p of living(state)) for (const trait of p.traits ?? []) {
    const hated = choices.filter(c => (c.tags ?? []).some(t => (REACTIONS[trait][t] ?? 0) <= -8));
    if (hated.length && out.length < 3) out.push(`${p.name} (${TRAIT_NAMES[trait].toLowerCase()}) kommer ikke til å tilgi «${hated[0].label.toLowerCase()}».`);
  }
  return [...new Set(out)];
}

export function pickEvent(state: RegionState, world: RegionWorld, rng: () => number): PendingEvent | undefined {
  // Chains first: something you chose before comes back.
  const due = state.scheduled.filter(x => x.day <= state.day).sort((a, b) => a.day - b.day);
  for (const item of due) {
    state.scheduled.splice(state.scheduled.indexOf(item), 1);
    const def = EVENTS.find(e => e.id === item.id);
    if (!def) continue;
    const made = build(def, state, world, rng, item.data);
    if (made) return made;
  }
  const weekly = state.day > 0 && state.day % R.eventEveryDays === 0;
  const minor = rng() < R.minorEventChance * (state.phase >= 3 ? 1.5 : 1);
  if (!weekly && !minor) return undefined;
  const pool = EVENTS.filter(e => eligible(e, state, world) && (weekly || e.good || (state.phase >= 3 && rng() < .3)));
  for (let tries = 0; tries < 8 && pool.length; tries++) {
    const total = pool.reduce((n, e) => n + e.weight, 0);
    let roll = rng() * total;
    const pick = pool.find(e => (roll -= e.weight) < 0) ?? pool[0];
    const made = build(pick, state, world, rng);
    if (made) return made;
    pool.splice(pool.indexOf(pick), 1);
  }
  return undefined;
}
/** For tests and the QA bot: make a specific event now, if it can happen. */
export function forceEvent(state: RegionState, world: RegionWorld, id: string, data?: Record<string, string | number>) {
  const def = EVENTS.find(e => e.id === id);
  return def ? build(def, state, world, random(state.seed, state.day, `force:${id}`), data) : undefined;
}

export function resolveEvent(state0: RegionState, world: RegionWorld, choiceId: string): { state: RegionState; lines: ReportLine[] } {
  const state = JSON.parse(JSON.stringify(state0)) as RegionState;
  const ev = state.event;
  if (!ev) throw new Error('Ingen hendelse venter.');
  const choice = ev.choices.find(c => c.id === choiceId);
  if (!choice) throw new Error('Ukjent valg.');
  if (choice.disabled) throw new Error(choice.disabled);
  const def = EVENTS.find(e => e.id === ev.id)!;
  const lines: ReportLine[] = [];
  bindWorld(world);
  const previousWeapons = new Map(state.survivors.map(p => [p.id, p.weapon]));
  def.resolve(state, world, choiceId, random(state.seed, state.day, `choice:${ev.id}`), lines);
  registerLegacyAbsences(state);
  // Legacy events still own disarmament, including melee-base people carrying a found gun.
  for (const person of state.survivors) if (previousWeapons.get(person.id) !== person.weapon && person.weapon === 'melee'
    || ev.id === 'coward' && choiceId === 'shame' && person.id === String(ev.data?.who)) confiscateGearWeapon(state, person.id);
  // The crew remembers what kind of leader you are.
  for (const p of living(state)) for (const trait of p.traits ?? []) for (const tag of choice.tags ?? []) {
    const r = REACTIONS[trait][tag] ?? 0;
    if (r) loyalty(p, r);
  }
  for (const p of living(state)) if ((p.loyalty ?? 60) < 15 && !state.scheduled.some(x => x.id === 'desertion' && x.data?.who === p.id)) schedule(state, 1 + Math.floor(random(state.seed, state.day, p.id)() * 3), 'desertion', { who: p.id });
  state.morale = Math.max(0, Math.min(100, state.morale));
  for (const p of state.survivors) if (p.alive && p.health <= 0) killPerson(state, p, lines, 'Skadene ble for store.');
  settleGearReturns(state, lines);
  lines.unshift({ tone: 'info', title: ev.title, text: `Dere valgte: ${choice.label}.` });
  delete state.event;
  state.counters.events = (state.counters.events ?? 0) + 1;
  state.counters[`event:${ev.id}`] = (state.counters[`event:${ev.id}`] ?? 0) + 1;
  const last = state.reports.at(-1);
  if (last) last.lines.push(...lines);
  enforceAvatarFate(state);
  advanceCampaignCommit(state, `event:${ev.id}:${choiceId}`);
  void recruit; void chance;
  return { state, lines };
}
