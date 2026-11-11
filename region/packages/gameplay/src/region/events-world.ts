/**
 * The world outside the fence: boats, islands, quarantine camps, herds, tunnels, the hospital, the mall,
 * the cathedral, the airport and the fjords. Most of these are chains: a choice comes back days later.
 */
import type { EventChoice, RegionFaction, RegionLink, RegionState, RegionSurvivor, RegionWorld, ReportLine, Stock } from './types';
import { LAWS } from './systems';
import {
  moveZombies,
  addPeople, amount, borderZones, chance, coastalOwned, crewById, event, flag, give, hasLaw, hasTech, hope, hurtPerson, killPerson,
  loyalty, need, ownedZones, pay, pickCrew, pickOne, remember, removePeople, schedule, setFlag, takeShare, unrest, zoneName, zonesWith,
  type EventDef,
} from './kit';

// ------------------------------------------------------------------ local helpers

type Data = Record<string, string | number>;
type Skill = keyof RegionSurvivor['skills'];

const data = (s: RegionState): Data => s.event?.data ?? {};
const str = (d: Data | undefined, k: string) => String(d?.[k] ?? '');
const num = (d: Data | undefined, k: string) => Number(d?.[k] ?? 0);
const opt = (cond: boolean, c: EventChoice): EventChoice[] => (cond ? [c] : []);

const faction = (s: RegionState, id: string) => s.factions.find(f => f.id === id && !f.defeated);
const relate = (f: RegionFaction | undefined, n: number) => { if (f) f.relation = Math.max(-100, Math.min(100, f.relation + n)); };

const atCamp = (s: RegionState) => s.survivors.filter(p => p.alive && !(p.awayUntil && p.awayUntil > s.day));
/** The best n people at camp for a skill. */
const team = (s: RegionState, n: number, skill: Skill) => [...atCamp(s)].sort((a, b) => b.skills[skill] - a.skills[skill]).slice(0, n);
const sendAway = (s: RegionState, people: RegionSurvivor[], days: number) => { for (const p of people) p.awayUntil = s.day + days; };
const names = (people: (RegionSurvivor | undefined)[]) => people.filter(Boolean).map(p => p!.name).join(' og ') || 'Speiderne';
const noCrew = (s: RegionState, n = 1) => (atCamp(s).length >= n ? undefined : 'Ingen i crewet er ledige.');

/** Zones with a place of this kind that exist in the state. */
const placesOf = (s: RegionState, w: RegionWorld, kind: string) => zonesWith(w, kind).filter(id => !!s.zones[id]);
const placeName = (w: RegionWorld, zone: string, kind: string, fallback: string) =>
  w.pois.find(p => p.zoneId === zone && (p.hqType === kind || p.siteType === kind || p.facilityType === kind))?.name ?? fallback;
const nearSet = (s: RegionState, w: RegionWorld) => new Set([...ownedZones(s), ...borderZones(s, w)]);
/** Zombies move, they are not made: herds gather from around, and scattered ones drift to the neighbours. */
let worldRef: RegionWorld | undefined;
export const bindWorld = (w: RegionWorld) => { worldRef = w; };
const addZombies = (s: RegionState, zone: string, n: number) => { if (worldRef) moveZombies(s, worldRef, zone, n); };
const addLoot = (s: RegionState, zone: string, loot: Stock) => {
  const z = s.zones[zone];
  if (!z) return;
  for (const [id, n] of Object.entries(loot)) z.loot[id] = (z.loot[id] ?? 0) + n;
};
const fortify = (s: RegionState, n: number) => { for (const id of Object.keys(s.barricades)) s.barricades[id] = Math.max(0, s.barricades[id] + n); };
/** Links that touch what you hold or border, in an allowed state. */
const nearLinks = (s: RegionState, w: RegionWorld, ok: (state: string) => boolean, kind?: 'bridge' | 'tunnel') => {
  const near = nearSet(s, w);
  return w.links.filter(l => (!kind || l.kind === kind) && (near.has(l.a) || near.has(l.b)) && ok(s.chokepoints[l.id] ?? 'open'));
};
/** Which end of a link is yours (or closest to you), and which is the far side. */
const linkEnds = (s: RegionState, w: RegionWorld, l: RegionLink): [string, string] => {
  const owned = new Set(ownedZones(s));
  const near = nearSet(s, w);
  const mine = owned.has(l.a) ? l.a : owned.has(l.b) ? l.b : near.has(l.a) ? l.a : l.b;
  return [mine, mine === l.a ? l.b : l.a];
};
const fightPower = (s: RegionState, people: RegionSurvivor[]) =>
  people.reduce((n, p) => n + p.skills.combat, 0) + (hasTech(s, 'crossbows') ? 2 : 0) + (hasTech(s, 'armour') ? 2 : 0) + (hasTech(s, 'drill') ? 2 : 0);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ------------------------------------------------------------------ siege, shared by the first day and the following ones

function siegeAct(s: RegionState, w: RegionWorld, c: string, rng: () => number, lines: ReportLine[], zone: string, size: number) {
  if (c === 'sally') {
    pay(s, { ammo: 30 });
    const fighters = team(s, 3, 'combat');
    const share = clamp(.3 + fightPower(s, fighters) * .03, .3, .75);
    const killed = Math.round(size * share);
    addZombies(s, zone, -killed);
    for (const p of fighters) {
      if (chance(rng, hasTech(s, 'armour') ? .15 : .3)) hurtPerson(s, p, 25, lines, 'Utfallet gikk bra helt til de døde lukket seg rundt dem.');
    }
    if (!hasTech(s, 'armour') && fighters.length && chance(rng, .08)) killPerson(s, pickOne(rng, fighters), lines, 'Falt under utfallet mot beleiringen.');
    hope(s, 4);
    lines.push({ tone: 'good', title: `Om lag ${killed} falt`, text: `Utfallet åpnet sperringen mot ${zoneName(w, zone)}. Resten trekker seg bort, foreløpig.`, zoneId: zone });
    return;
  }
  if (c === 'lure') {
    pay(s, { fuel: hasTech(s, 'decoys') ? 3 : 8 });
    const other = borderZones(s, w).filter(id => id !== zone);
    const moved = Math.round(s.zones[zone].zombies * .7);
    addZombies(s, zone, -moved);
    if (other.length) addZombies(s, pickOne(rng, other), moved * .6);
    lines.push({ tone: 'good', title: 'De fulgte lyden', text: `En bil med fastlåst horn ble kjørt ut av ${zoneName(w, zone)}. Flokken fulgte etter den som måker etter en fiskebåt.`, zoneId: zone });
    return;
  }
  if (c === 'fire') {
    pay(s, { fuel: 15 });
    addZombies(s, zone, -Math.round(s.zones[zone].zombies * .6));
    s.zones[zone].loot = {};
    hope(s, -3);
    if (chance(rng, .25)) {
      const lost = takeShare(s, 'building', .2);
      lines.push({ tone: 'bad', title: 'Brannen slo over', text: `Vinden snudde. Dere mistet ${lost} byggemateriale før dere fikk slukket.` });
    } else lines.push({ tone: 'warn', title: `${zoneName(w, zone)} brenner`, text: 'Røyken står over sperringen hele natta. Det som var å hente der, er borte.', zoneId: zone });
  }
}

// ------------------------------------------------------------------ the events

export const EVENTS_WORLD: EventDef[] = [
  // ---------------------------------------------------------------- 1. a boat of sick refugees
  {
    id: 'sickBoat', weight: 3, once: true, phase: [1, 3],
    when: (s, w) => coastalOwned(s, w).length > 0,
    make: (s, w, rng) => {
      const zone = pickOne(rng, coastalOwned(s, w));
      const from = pickOne(rng, ['Tau', 'Jørpeland', 'Fogn', 'Hjelmeland', 'Ombo']);
      const adults = 4 + Math.floor(rng() * 5), children = 1 + Math.floor(rng() * 4), sick = 2 + Math.floor(rng() * 4);
      return event('En båt med syke', `En gammel sjark legger seg utenfor ${zoneName(w, zone)}. Om bord er ${adults + children} mennesker fra ${from}. Flere har høy feber og hoster. «Vi er ikke bitt», roper en kvinne fra rekka. «Det er vannet. Vi har drukket av bekken i ti dager.»`, [
        { id: 'take', label: 'Ta dem i land', detail: `${adults} voksne og ${children} barn, ${sick} av dem syke.${hasTech(s, 'hygiene') ? '' : ' Uten kokt vann kan det spre seg.'}`, tags: ['charity', 'merciful'] },
        { id: 'quarantine', label: 'Karantene om bord', detail: '15 mat og 15 vann ut til båten. Dere ser an om fem dager.', disabled: need(s, { food: 15, water: 15 }), tags: ['merciful'] },
        { id: 'away', label: 'Vis dem bort', detail: 'De kommer seg kanskje videre. Kanskje husker de dere.', tags: ['harsh'] },
      ], { zoneId: zone, data: { zone, from, adults, children, sick } });
    },
    resolve: (s, w, c, rng, lines) => {
      const d = data(s);
      if (c === 'take') {
        addPeople(s, { adults: num(d, 'adults'), children: num(d, 'children'), sick: num(d, 'sick') + (hasTech(s, 'hygiene') ? 0 : 3) });
        hope(s, 4); unrest(s, 5);
        remember(s, `Dere tok i land en båt med syke fra ${str(d, 'from')}.`);
      }
      if (c === 'quarantine') {
        pay(s, { food: 15, water: 15 });
        schedule(s, 5, 'sickBoatQuarantine', d);
        lines.push({ tone: 'info', title: 'Båten ligger for anker', text: `Sjarken ligger ute på vågen ved ${zoneName(w, str(d, 'zone'))}. Om kvelden hører dere hosten over vannet.` });
      }
      if (c === 'away') {
        hope(s, -4);
        setFlag(s, 'sickBoat', 'away');
        schedule(s, 10 + Math.floor(rng() * 8), 'sickBoatReturn', d);
        remember(s, `Dere viste bort en båt med syke fra ${str(d, 'from')}.`);
      }
    },
  },
  {
    id: 'sickBoatQuarantine', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, rng, d) => {
      const adults = num(d, 'adults'), children = num(d, 'children');
      const died = Math.min(adults + children - 1, 1 + Math.floor(rng() * 3));
      const second = num(d, 'second') > 0;
      const left = adults + children - died;
      return event('Karantenen er over', `${second ? 'Ni' : 'Fem'} dager er gått. ${died} av dem på båten fra ${str(d, 'from')} er døde og senket i fjorden, pakket i seil. De ${left} som er igjen, har ikke hatt feber på to døgn.`, [
        { id: 'land', label: 'La alle komme i land', detail: `${left} flere. Ingen er syke lenger.`, tags: ['merciful', 'charity'] },
        { id: 'adults', label: 'Bare de voksne', detail: 'Barna blir igjen på båten med det dere kan avse.', tags: ['cruel', 'children'] },
        ...opt(!second, { id: 'more', label: 'Fire dager til', detail: '10 mat og 10 vann. Bedre føre var.', disabled: need(s, { food: 10, water: 10 }) }),
      ], { zoneId: str(d, 'zone'), data: { ...d, died } });
    },
    resolve: (s, _w, c) => {
      const d = data(s);
      let adults = num(d, 'adults'), children = num(d, 'children');
      let died = num(d, 'died');
      const fromChildren = Math.min(children, Math.floor(died / 2)); children -= fromChildren; died -= fromChildren; adults = Math.max(0, adults - died);
      if (c === 'land') { addPeople(s, { adults, children }); hope(s, 5); remember(s, `Dere tok i land de overlevende fra båten fra ${str(d, 'from')}.`); }
      if (c === 'adults') { addPeople(s, { adults }); hope(s, -8); remember(s, `Dere tok i land de voksne fra ${str(d, 'from')} og lot barna bli igjen på båten.`); }
      if (c === 'more') { pay(s, { food: 10, water: 10 }); schedule(s, 4, 'sickBoatQuarantine', { ...d, second: 1 }); }
    },
  },
  {
    id: 'sickBoatReturn', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, _rng, d) => {
      const zone = coastalOwned(s, w)[0] ?? str(d, 'zone');
      const talk = hasTech(s, 'crystalRadio') || hasTech(s, 'intel');
      return event('Sjarken er tilbake', `Båten fra ${str(d, 'from')} er tilbake utenfor ${zoneName(w, zone)}. Nå er de tre båter, og mennene i baugen har gevær. De som overlevde feberen, har ikke glemt hvem som snudde dem. «Vi tar det vi trenger. Dere kan gi det, eller vi kan hente det.»`, [
        { id: 'fight', label: 'Forsvar kaia', detail: '20 ammunisjon. De har mistet mye. Det har ikke dere.', disabled: need(s, { ammo: 20 }), tags: ['harsh'] },
        { id: 'pay', label: 'Gi dem mat', detail: '35 mat, og de drar.', disabled: need(s, { food: 35 }) },
        ...opt(talk, { id: 'talk', label: 'Kall dem opp på radioen', detail: 'Be om unnskyldning, og tilby plass. Det kan snu dem.', tags: ['merciful'] }),
        { id: 'hide', label: 'Gjem dere og la dem ta', detail: 'De plyndrer lageret ved sjøen.' },
      ], { zoneId: zone, data: { ...d, zone } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const d = data(s);
      if (c === 'fight') {
        pay(s, { ammo: 20 });
        const p = pickCrew(s, rng, x => x.skills.combat >= 2);
        if (p && chance(rng, .4)) hurtPerson(s, p, 30, lines, 'Et skudd fra båtene traff over kaikanten.');
        hope(s, -3);
        lines.push({ tone: 'warn', title: 'Båtene snudde', text: 'To av dem kom seg ut av vågen. Den tredje driver tom mot land.' });
        give(s, 'boat', 1);
        remember(s, `Dere skjøt mot folket fra ${str(d, 'from')} da de kom tilbake.`);
      }
      if (c === 'pay') { pay(s, { food: 35 }); hope(s, -2); }
      if (c === 'talk') {
        if (chance(rng, .65)) {
          addPeople(s, { adults: Math.max(2, num(d, 'adults') - 1), children: 1 });
          hope(s, 6); unrest(s, 3);
          lines.push({ tone: 'good', title: 'De la til', text: 'Det tok en time på radioen. Så kastet de geværene i land først.' });
          remember(s, `Folket fra ${str(d, 'from')} kom tilbake, og dere fikk dem til å bli.`);
        } else {
          const food = takeShare(s, 'food', .15);
          lines.push({ tone: 'bad', title: 'De hørte ikke', text: `Mens dere snakket, gikk de i land et annet sted. ${food} mat er borte.` });
        }
      }
      if (c === 'hide') {
        const food = takeShare(s, 'food', .2), fuel = takeShare(s, 'fuel', .2);
        if (amount(s, 'boat') >= 1 && chance(rng, .5)) give(s, 'boat', -1);
        hope(s, -6); unrest(s, 4);
        lines.push({ tone: 'bad', title: 'Plyndret', text: `De tok ${food} mat og ${fuel} drivstoff. Ingen sa noe mens det skjedde.` });
      }
    },
  },

  // ---------------------------------------------------------------- 2. the sanctuary on Kvitsøy
  {
    id: 'sanctuaryBroadcast', weight: 2, once: true, phase: [2, 4],
    when: (s, w) => coastalOwned(s, w).length > 0 && s.population.adults >= 4,
    make: (s, _w, rng) => {
      const keen = Math.min(s.population.adults - 1, 3 + Math.floor(rng() * 4));
      return event('Fristaden', `Hver hele time, på samme frekvens: «Dette er Fristaden Kvitsøy. Vi har mat, strøm og en mur av hav. Ingen døde kommer over sjøen. Alle er velkomne. Kom til kaia i Ystabøhamn.» ${keen} av folket deres har begynt å pakke.`, [
        { id: 'scout', label: 'Send en speider først', detail: 'En båt og den beste speideren, borte i fire dager.', disabled: need(s, { boat: 1 }) ?? noCrew(s) },
        ...opt(hasTech(s, 'intel'), { id: 'listen', label: 'La lytteposten høre etter', detail: 'Etterretningen lytter på det de sier når de tror ingen hører.' }),
        { id: 'send', label: 'La de som vil, dra', detail: `${keen} voksne forlater dere for et bedre liv.` },
        { id: 'ignore', label: 'Slå av radioen', detail: 'Ingen drar. Noen blir sure.', tags: ['harsh'] },
      ], { data: { keen } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const keen = num(data(s), 'keen');
      if (c === 'scout') {
        const p = team(s, 1, 'scouting')[0];
        if (p) { sendAway(s, [p], 4); lines.push({ tone: 'info', title: `${p.name} drar mot Kvitsøy`, text: 'Med båten, en kikkert og ordre om ikke å gå i land.' }); }
        schedule(s, 4, 'sanctuaryNews', { mode: 'scout', who: p?.id ?? '', sent: 0 });
      }
      if (c === 'listen') schedule(s, 2, 'sanctuaryNews', { mode: 'intel', sent: 0 });
      if (c === 'send') {
        const sent = removePeople(s, 'adults', keen);
        setFlag(s, 'sanctuarySent', sent);
        hope(s, 2);
        schedule(s, 8 + Math.floor(rng() * 4), 'sanctuaryNews', { mode: 'escapee', sent });
        remember(s, `${sent} av folket deres dro til Fristaden på Kvitsøy.`);
      }
      if (c === 'ignore') { unrest(s, 4); hope(s, -2); }
    },
  },
  {
    id: 'sanctuaryNews', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const mode = str(d, 'mode'), sent = num(d, 'sent');
      const p = crewById(s, d?.who);
      const text = mode === 'scout'
        ? `${p?.name ?? 'Speideren'} er tilbake fra Kvitsøy. Fristaden finnes, og den har mat. Den har også et gjerde som vender innover, vakter med gevær og folk som renser fisk fra fem om morgenen til ti om kvelden. De som kom etter invitasjonen, har ikke fått dra igjen. Den som nekter å jobbe, får ikke mat.`
        : mode === 'intel'
          ? 'Lytteposten har fanget opp en annen kanal fra øya. Der snakker de om «leveranser», «arbeidskraft» og hvor mange som har «sluttet». Invitasjonen er et garn, og Fristaden er en arbeidsleir.'
          : `En mann i våte klær kommer til sperringen. Han var en av de ${sent} som dro til Kvitsøy. «De tok alt vi hadde på kaia. Så jobber du. De som prøver å stikke av, blir hentet.» Han rodde i to netter for å komme hit.`;
      return event('Sannheten om Fristaden', text, [
        { id: 'rescue', label: 'Planlegg en redning', detail: 'Om fire dager: båt, ammunisjon og de beste dere har.', tags: ['merciful'] },
        { id: 'warn', label: 'Kringkast sannheten', detail: 'Færre går i garnet. Fristaden vet hvem som sa det.', disabled: hasTech(s, 'crystalRadio') || amount(s, 'radio') >= 1 ? undefined : 'Dere har ingen sender.' },
        { id: 'deal', label: 'Handle med dem likevel', detail: 'Fisk for drivstoff, og ingen spørsmål. 15 drivstoff for 40 mat.', disabled: need(s, { fuel: 15 }), tags: ['harsh'] },
        { id: 'forget', label: 'Det er ikke vårt problem', detail: 'Dere har nok med deres egne.', tags: ['harsh'] },
      ], { data: { mode, sent } });
    },
    resolve: (s, _w, c, _rng, lines) => {
      const d = data(s);
      if (str(d, 'mode') === 'escapee') addPeople(s, { adults: 1 });
      setFlag(s, 'sanctuary', 'known');
      if (c === 'rescue') { schedule(s, 4, 'sanctuaryRescue', { sent: num(d, 'sent') }); hope(s, 2); }
      if (c === 'warn') { hope(s, 4); setFlag(s, 'sanctuaryWarned', 1); lines.push({ tone: 'good', title: 'Ordet går', text: 'Kvelden etter blir invitasjonen fra Kvitsøy sendt én gang til. Så blir det stille.' }); }
      if (c === 'deal') { pay(s, { fuel: 15 }); give(s, 'food', 40); hope(s, -4); remember(s, 'Dere handlet med Fristaden, selv om dere visste.'); }
      if (c === 'forget') { hope(s, num(d, 'sent') ? -8 : -3); }
    },
  },
  {
    id: 'sanctuaryRescue', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const sent = num(d, 'sent');
      return event('Natt over Kvitsøy', `Vaktene på Fristaden er seks, kanskje åtte. De sover i det gamle fyrvokterhuset. I fiskebruket ligger om lag tjue arbeidere på madrasser${sent ? `, blant dem ${sent} av deres egne` : ''}. Sjøen er rolig, og det regner, som det pleier. Det skjuler lyden av årene.`, [
        { id: 'raid', label: 'Gå i land i mørket', detail: 'En båt og 25 ammunisjon. De tre beste kjemper.', disabled: need(s, { boat: 1, ammo: 25 }) ?? noCrew(s, 2), tags: ['reckless'] },
        { id: 'buy', label: 'Kjøp dem fri', detail: `25 drivstoff og 20 ammunisjon for ${sent ? 'deres egne' : 'seks arbeidere'}. Resten blir.`, disabled: need(s, { fuel: 25, ammo: 20 }) },
        { id: 'abandon', label: 'Snu båten', detail: 'Det er for mange vakter.', tags: ['harsh'] },
      ], { data: { sent } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const sent = num(data(s), 'sent');
      if (c === 'raid') {
        pay(s, { ammo: 25 });
        const fighters = team(s, 3, 'combat');
        const ok = chance(rng, clamp(.35 + fightPower(s, fighters) * .035, .25, .9));
        if (ok) {
          const freed = 10 + Math.floor(rng() * 8) + sent;
          addPeople(s, { adults: freed - 2, children: 2 });
          give(s, 'food', 40); give(s, 'salt', 6);
          hope(s, 12);
          lines.push({ tone: 'good', title: `${freed} er fri`, text: 'Vaktene våknet for sent. Dere tok med arbeiderne, saltet og lenkene, som ble kastet i sjøen.' });
          remember(s, `Dere slo til mot Fristaden på Kvitsøy og befridde ${freed} mennesker.`);
          setFlag(s, 'sanctuary', 'freed');
        } else {
          const hit = fighters[Math.floor(rng() * fighters.length)];
          if (hit && chance(rng, .5)) killPerson(s, hit, lines, 'Falt i fjæra på Kvitsøy.');
          else if (hit) hurtPerson(s, hit, 35, lines, 'En vakt var våken.');
          addPeople(s, { adults: 2 });
          hope(s, -6);
          lines.push({ tone: 'bad', title: 'Det gikk galt', text: 'Lyskasteren på fyret fant båten. Dere fikk med to arbeidere før dere måtte snu.' });
          setFlag(s, 'sanctuary', 'failed');
        }
      }
      if (c === 'buy') {
        pay(s, { fuel: 25, ammo: 20 });
        addPeople(s, { adults: sent || 6 });
        hope(s, 3);
        remember(s, 'Dere kjøpte mennesker fri fra Fristaden. Prisen var drivstoff og patroner.');
      }
      if (c === 'abandon') { hope(s, sent ? -10 : -5); remember(s, 'Dere snudde båten utenfor Kvitsøy.'); }
    },
  },

  // ---------------------------------------------------------------- 3. the military quarantine zone, and 4. the resistance inside
  {
    id: 'quarantineZone', weight: 3, once: true, phase: [2, 4],
    when: (s, w) => !!(faction(s, 'garrison')?.zoneId ?? placesOf(s, w, 'military')[0]),
    make: (s, w, rng) => {
      const zone = faction(s, 'garrison')?.zoneId ?? pickOne(rng, placesOf(s, w, 'military'));
      const name = placeName(w, zone, 'military', zoneName(w, zone));
      return event('Karantenesonen', `Rundt ${name} står nye gjerder og skilt: KARANTENESONE. ADGANG FORBUDT. DET SKYTES UTEN VARSEL. Da dere kom nærmere enn to hundre meter, smalt et skudd i asfalten foran dere. Bak gjerdet står folk i kø foran et hvitt telt. Mange av dem er sivile.`, [
        { id: 'talk', label: 'Rop over gjerdet og tilby handel', detail: '25 mat for 40 ammunisjon, om de vil.', disabled: need(s, { food: 25 }) },
        { id: 'steal', label: 'Stjel fra lageret om natta', detail: 'De to beste speiderne. Ammunisjon og medisin, eller kuler i ryggen.', disabled: noCrew(s, 2), tags: ['reckless'] },
        { id: 'ignore', label: 'Hold avstand', detail: 'De skyter. Dere går.' },
      ], { zoneId: zone, data: { zone, name } });
    },
    resolve: (s, w, c, rng, lines) => {
      const d = data(s);
      const zone = str(d, 'zone');
      const garrison = faction(s, 'garrison');
      if (garrison) garrison.known = true;
      if (c === 'talk') {
        pay(s, { food: 25 }); give(s, 'ammo', 40); relate(garrison, 10);
        lines.push({ tone: 'good', title: 'Byttet gikk', text: 'En sersjant med munnbind tok imot maten med hansker. Ammunisjonen kom over gjerdet i en sekk.' });
      }
      if (c === 'steal') {
        const pair = team(s, 2, 'scouting');
        const ok = chance(rng, clamp(.45 + pair.reduce((n, p) => n + p.skills.scouting, 0) * .04, .3, .85));
        if (ok) {
          give(s, 'ammo', 45); give(s, 'medicine', 6); give(s, 'explosives', 2);
          lines.push({ tone: 'good', title: 'Inn og ut', text: `${names(pair)} kom seg inn under gjerdet og ut igjen med fulle sekker.` });
        } else {
          const p = pair[0];
          if (p) hurtPerson(s, p, 30, lines, 'Vaktene skjøt etter dem i lyset fra flombelysningen.');
          relate(garrison, -20);
          lines.push({ tone: 'bad', title: 'Oppdaget', text: 'De kom seg unna, tomhendte. Leiren vet nå at dere finnes.' });
        }
      }
      setFlag(s, 'qz', c);
      if (c !== 'ignore') schedule(s, 5 + Math.floor(rng() * 3), 'quarantineResistance', { zone, name: str(d, 'name') });
      schedule(s, 15 + Math.floor(rng() * 7), 'quarantineFall', { zone, name: str(d, 'name') });
      void w;
    },
  },
  {
    id: 'quarantineResistance', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => event('En lapp ved sperringen', `En lapp er festet til sperringen med en strips. Den er skrevet med blyant: «Vi er tjue vernepliktige i ${str(d, 'name')}. Kommandanten skyter alle som hoster. I forrige uke var det en gutt på ni. Vi trenger våpen, og et sted å gå etterpå. Heng et hvitt laken ut om dere er med.»`, [
      { id: 'arm', label: 'Heng ut lakenet og send patroner', detail: '30 ammunisjon smugles inn med søppelbilen.', disabled: need(s, { ammo: 30 }), tags: ['merciful', 'reckless'] },
      { id: 'shelter', label: 'Lov dem ly, ikke våpen', detail: 'De må klare kuppet selv.' },
      { id: 'betray', label: 'Gi lappen til kommandanten', detail: 'Han vil være takknemlig. De tjue vil ikke være noe lenger.', tags: ['betrayal', 'cruel'] },
      { id: 'ignore', label: 'Brenn lappen', detail: 'Dette er ikke deres krig.' },
    ], { zoneId: str(d, 'zone'), data: { ...d } }),
    resolve: (s, _w, c, _rng, lines) => {
      const garrison = faction(s, 'garrison');
      if (c === 'arm') { pay(s, { ammo: 30 }); setFlag(s, 'qzRes', 'armed'); hope(s, 2); }
      if (c === 'shelter') setFlag(s, 'qzRes', 'promised');
      if (c === 'betray') {
        setFlag(s, 'qzRes', 'betrayed');
        relate(garrison, 25); give(s, 'ammo', 30); hope(s, -6);
        lines.push({ tone: 'bad', title: 'Seks skudd ved daggry', text: 'Kommandanten sendte en kasse patroner og en takk. Om morgenen hørte dere skuddene.' });
        remember(s, 'Dere ga de vernepliktige i karantenesonen til kommandanten.');
      }
      if (c === 'ignore') setFlag(s, 'qzRes', 'ignored');
    },
  },
  {
    id: 'quarantineFall', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, rng, d) => {
      const res = String(flag(s, 'qzRes') ?? '');
      const name = str(d, 'name');
      let outcome: 'mutiny' | 'deserters' | 'collapse';
      if (res === 'armed') outcome = chance(rng, .7) ? 'mutiny' : 'collapse';
      else if (res === 'promised') outcome = chance(rng, .5) ? 'deserters' : 'collapse';
      else outcome = chance(rng, .4) ? 'deserters' : 'collapse';
      const target = borderZones(s, w).length ? pickOne(rng, borderZones(s, w)) : str(d, 'zone');
      const herd = 120 + Math.floor(rng() * 100);
      if (outcome === 'mutiny') return event('De holdt ord', `Kommandanten i ${name} er avsatt. Tolv av de vernepliktige står ved sperringen deres med rifler over skulderen og et hvitt laken bundet til antennen på en lastebil. «Dere sendte patroner da ingen andre gjorde det. Leiren er vår nå. Hva vil dere at vi gjør?»`, [
        { id: 'join', label: 'Bli med oss', detail: '12 soldater med våpen flytter inn.', tags: ['charity'] },
        { id: 'ally', label: 'Hold leiren, og vær våre venner', detail: 'Garnisonen blir en alliert, og deler ammunisjon.' },
      ], { zoneId: str(d, 'zone'), data: { ...d, outcome } });
      if (outcome === 'deserters') return event('Desertører', `Sju soldater i våte uniformer kommer til sperringen med hendene over hodet. De har rifler på ryggen og en ammunisjonskasse mellom seg. «${name} faller. Kommandanten har mistet vettet. Vi går ikke tilbake.»`, [
        { id: 'admit', label: 'Slipp dem inn med våpnene', detail: '7 trente voksne, og en kasse ammunisjon.', tags: ['charity'] },
        { id: 'disarm', label: 'Ta våpnene, så slipp dem inn', detail: 'Mer ammunisjon til dere. De glemmer ikke ydmykelsen.', tags: ['harsh'] },
        { id: 'away', label: 'Send dem videre', detail: 'Desertører er desertører.', tags: ['harsh'] },
      ], { zoneId: str(d, 'zone'), data: { ...d, outcome } });
      return event('Karantenesonen faller', `Skytingen i ${name} stilnet i natt. I morgentåka kommer de ut gjennom hullene i gjerdet: pasientene fra teltene, vaktene og alle de andre. Om lag ${herd}, på vei mot ${zoneName(w, target)}. Bak dem står våpenlageret ubevoktet.`, [
        { id: 'brace', label: 'Forsterk sperringene', detail: '8 byggemateriale. De kommer, men dere er klare.', disabled: need(s, { building: 8 }) },
        { id: 'lure', label: 'Lokk dem tilbake inn i leiren', detail: `${hasTech(s, 'decoys') ? '2' : '6'} drivstoff til sirener ved porten.`, disabled: need(s, { fuel: hasTech(s, 'decoys') ? 2 : 6 }) },
        { id: 'wait', label: 'La dem komme', detail: 'Lageret i leiren venter når de har gått forbi.', tags: ['reckless'] },
      ], { zoneId: target, data: { ...d, outcome, target, herd } });
    },
    resolve: (s, w, c, _rng, lines) => {
      const d = data(s);
      const zone = str(d, 'zone');
      const garrison = faction(s, 'garrison');
      if (c === 'join') {
        addPeople(s, { adults: 12 }); give(s, 'ammo', 50); relate(garrison, 30); hope(s, 8); unrest(s, 3);
        remember(s, `De vernepliktige fra ${str(d, 'name')} tok leiren og kom til dere.`);
      }
      if (c === 'ally') {
        relate(garrison, 45); give(s, 'ammo', 30); hope(s, 6);
        if (garrison) garrison.known = true;
        remember(s, `Garnisonen i ${str(d, 'name')} har ny ledelse, og den er på deres side.`);
      }
      if (c === 'admit') { addPeople(s, { adults: 7 }); give(s, 'ammo', 30); unrest(s, 2); hope(s, 3); }
      if (c === 'disarm') { addPeople(s, { adults: 7 }); give(s, 'ammo', 60); unrest(s, 7); hope(s, -2); }
      if (c === 'away') hope(s, -3);
      if (str(d, 'outcome') !== 'collapse') return;
      const target = str(d, 'target'), herd = num(d, 'herd');
      addLoot(s, zone, { ammo: 80, explosives: 4, medicine: 10, fuel: 20 });
      relate(garrison, -50);
      if (c === 'brace') { pay(s, { building: 8 }); fortify(s, 6); addZombies(s, target, herd); }
      if (c === 'lure') { pay(s, { fuel: hasTech(s, 'decoys') ? 2 : 6 }); addZombies(s, zone, herd * .7); addZombies(s, target, herd * .3); }
      if (c === 'wait') addZombies(s, target, herd);
      lines.push({ tone: 'warn', title: 'Leiren står tom', text: `Våpenlageret i ${zoneName(w, zone)} er ubevoktet. Det som går der nå, bærer ikke våpen.`, zoneId: zone });
      remember(s, `Karantenesonen i ${str(d, 'name')} falt.`);
    },
  },

  // ---------------------------------------------------------------- 5. the couple on the fjord farm
  {
    id: 'fjordCouple', weight: 2, once: true, phase: [2, 5],
    when: (s, w) => placesOf(s, w, 'coastFarm').some(id => !s.zones[id].owner && s.zones[id].status !== 'controlled'),
    make: (s, w, rng) => {
      const options = placesOf(s, w, 'coastFarm').filter(id => !s.zones[id].owner && s.zones[id].status !== 'controlled');
      const near = nearSet(s, w);
      const zone = pickOne(rng, options.filter(id => near.has(id)).length ? options.filter(id => near.has(id)) : options);
      return event('Paret på kystgården', `På gården på ${zoneName(w, zone)} bor et eldre par som om ingenting har hendt. Sauene går på beite, og det ryker fra pipa. Mannen står i døra med hagla. Kona forteller at kjelleren er full av poteter, spekeskinke og sild i lake, og at de klarer seg fint, takk. De har vært gjennom verre vintre.`, [
        { id: 'trade', label: 'Bytt med dem', detail: '4 medisin for 35 mat og 4 salt. Og et vennskap.', disabled: need(s, { medicine: 4 }) },
        { id: 'invite', label: 'Be dem bli med dere', detail: 'De er gamle, men kjelleren følger med. De sier trolig nei.', tags: ['charity'] },
        { id: 'take', label: 'Ta kjelleren', detail: 'Mye mat. Hagla er ladd.', tags: ['cruel'] },
        { id: 'leave', label: 'Ønsk dem lykke til', detail: 'Noen klarer seg.' },
      ], { zoneId: zone, data: { zone } });
    },
    resolve: (s, w, c, rng, lines) => {
      const zone = str(data(s), 'zone');
      if (c === 'trade') { pay(s, { medicine: 4 }); give(s, 'food', 35); give(s, 'salt', 4); setFlag(s, 'couple', 'friends'); schedule(s, 12, 'coupleReturn', { zone }); hope(s, 2); }
      if (c === 'invite') {
        if (chance(rng, s.morale > 60 ? .45 : .25)) {
          addPeople(s, { elderly: 2 }); give(s, 'food', 50); give(s, 'salt', 4); hope(s, 4);
          lines.push({ tone: 'good', title: 'De ble med', text: 'Kona pakket kjelleren i trillebårer. Mannen tok med hagla og sauene.' });
        } else {
          setFlag(s, 'couple', 'friends'); schedule(s, 12, 'coupleReturn', { zone });
          lines.push({ tone: 'info', title: 'Nei takk', text: 'De ga dere en spekeskinke og ba dere komme igjen.' }); give(s, 'food', 8);
        }
      }
      if (c === 'take') {
        give(s, 'food', 70); give(s, 'salt', 8); hope(s, -8); unrest(s, 3);
        const p = pickCrew(s, rng);
        if (p && chance(rng, .5)) hurtPerson(s, p, 35, lines, 'Hagla gikk av i døråpningen.');
        setFlag(s, 'couple', 'robbed');
        remember(s, `Dere tok kjelleren fra det gamle paret på ${zoneName(w, zone)}.`);
      }
      if (c === 'leave') hope(s, 1);
    },
  },
  {
    id: 'coupleReturn', weight: 1, chainOnly: true, when: s => flag(s, 'couple') === 'friends',
    make: (s, w, _rng, d) => event('Kona fra kystgården', `Kona fra ${zoneName(w, d?.zone)} står ved sperringen i oljehyre. Mannen falt i fjøset for fire dager siden og får ikke beveget venstre side. «Jeg klarer ikke gården alene. Og jeg klarer ikke ham alene.»`, [
      { id: 'bring', label: 'Hent dem begge hit', detail: 'To eldre som ikke kan jobbe, men hele kjelleren og sauene følger med.', tags: ['merciful', 'charity'] },
      { id: 'treat', label: 'Send noen med medisin', detail: '5 medisin og en fra crewet i tre dager. De blir på gården.', disabled: need(s, { medicine: 5 }) ?? noCrew(s) },
      { id: 'no', label: 'Dere kan ikke hjelpe', detail: 'Hun går hjem alene.', tags: ['harsh'] },
    ], { zoneId: str(d, 'zone'), data: { zone: str(d, 'zone') } }),
    resolve: (s, _w, c, _rng, lines) => {
      if (c === 'bring') { addPeople(s, { elderly: 2 }); give(s, 'food', 60); give(s, 'salt', 5); hope(s, 4); remember(s, 'Det gamle paret fra kystgården bor hos dere nå.'); }
      if (c === 'treat') {
        pay(s, { medicine: 5 });
        const p = team(s, 1, 'medical')[0];
        if (p) sendAway(s, [p], 3);
        give(s, 'food', 30); give(s, 'salt', 6); hope(s, 3);
        lines.push({ tone: 'good', title: 'Betalt på forskudd', text: 'Hun insisterte. Tre tønner sild og en sekk salt sto ved porten neste morgen.' });
      }
      if (c === 'no') { hope(s, -3); setFlag(s, 'couple', 'alone'); }
    },
  },

  // ---------------------------------------------------------------- 6. the siege
  {
    id: 'siege', weight: 2, phase: [3, 5],
    when: (s, w) => !!s.hq && borderZones(s, w).length > 0,
    make: (s, w, rng) => {
      const around = borderZones(s, w);
      if (!around.length) return null;
      const zone = pickOne(rng, around);
      const size = Math.min(400, Math.round(150 + rng() * 150 + s.day * .5));
      return event('Beleiret', `Om lag ${size} zombier har samlet seg i ${zoneName(w, zone)}, rett utenfor sperringen. De går ikke videre. De står. Om natta hører dere dem lene seg mot gjerdet. Ingen kommer seg ut for å sanke, fiske eller hente vann.`, [
        { id: 'wait', label: 'Vent dem ut', detail: '20 mat og 20 vann går med. De går kanskje av seg selv.', tags: ['harsh'] },
        { id: 'sally', label: 'Gjør utfall', detail: '30 ammunisjon. De tre beste går ut. Mange faller, kanskje noen av deres.', disabled: need(s, { ammo: 30 }) ?? noCrew(s, 2), tags: ['reckless'] },
        { id: 'lure', label: 'Lokk dem bort med et horn', detail: `${hasTech(s, 'decoys') ? 3 : 8} drivstoff til en bil med fastlåst horn.`, disabled: need(s, { fuel: hasTech(s, 'decoys') ? 3 : 8 }) },
        { id: 'fire', label: 'Sett fyr på bydelen', detail: '15 drivstoff. Det brenner godt, også det som var å hente der.', disabled: need(s, { fuel: 15 }), tags: ['reckless'] },
      ], { zoneId: zone, data: { zone, size, round: 1 } });
    },
    resolve: (s, w, c, rng, lines) => {
      const d = data(s);
      const zone = str(d, 'zone'), size = num(d, 'size');
      addZombies(s, zone, size);
      if (c === 'wait') {
        give(s, 'food', -20); give(s, 'water', -20); hope(s, -4); unrest(s, 3);
        schedule(s, 3, 'siegeDay', { zone, size, round: 1 });
        return;
      }
      siegeAct(s, w, c, rng, lines, zone, size);
    },
  },
  {
    id: 'siegeDay', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, _rng, d) => {
      const zone = str(d, 'zone');
      const left = s.zones[zone]?.zombies ?? 0;
      const round = num(d, 'round');
      if (left < Math.max(25, num(d, 'size') * .3)) return event('Beleiringen er over', `De fleste har trukket videre fra ${zoneName(w, zone)}. Om lag ${left} står igjen og glaner. Folk går ut og puster for første gang på ${round * 3} dager.`, [
        { id: 'over', label: 'Endelig', detail: 'Håpet stiger.' }], { zoneId: zone, data: { zone, size: left, round, over: 1 } });
      return event('Beleiringen fortsetter', `Dag ${round * 3 + 1}. De er der fortsatt, om lag ${left}, i ${zoneName(w, zone)}. Folk krangler om vannet, og barna har sluttet å spørre når de får gå ut. ${round >= 2 ? 'Gjerdet på østsida har begynt å gi etter.' : ''}`, [
        { id: 'wait', label: 'Vent litt til', detail: '20 mat og 20 vann. Kanskje går de nå.', tags: ['harsh'] },
        { id: 'sally', label: 'Gjør utfall', detail: '30 ammunisjon. De tre beste går ut.', disabled: need(s, { ammo: 30 }) ?? noCrew(s, 2), tags: ['reckless'] },
        { id: 'lure', label: 'Lokk dem bort', detail: `${hasTech(s, 'decoys') ? 3 : 8} drivstoff.`, disabled: need(s, { fuel: hasTech(s, 'decoys') ? 3 : 8 }) },
      ], { zoneId: zone, data: { zone, size: left, round } });
    },
    resolve: (s, w, c, rng, lines) => {
      const d = data(s);
      const zone = str(d, 'zone'), size = num(d, 'size'), round = num(d, 'round');
      if (c === 'over') { hope(s, 6); unrest(s, -3); return; }
      if (c !== 'wait') { siegeAct(s, w, c, rng, lines, zone, size); return; }
      give(s, 'food', -20); give(s, 'water', -20); hope(s, -4); unrest(s, 4);
      if (chance(rng, .55)) {
        addZombies(s, zone, -Math.round(size * .7));
        hope(s, 6);
        lines.push({ tone: 'good', title: 'De gikk', text: 'En morgen var de bare borte, en lang rekke på vei mot noe de hørte langt unna.' });
      } else if (round >= 2) {
        fortify(s, -8);
        const p = pickCrew(s, rng);
        if (p) hurtPerson(s, p, 30, lines, 'Gjerdet ga etter i natt, og det ble kamp ved hullet.');
        addZombies(s, zone, -Math.round(size * .3));
      } else schedule(s, 3, 'siegeDay', { zone, size, round: round + 1 });
    },
  },

  // ---------------------------------------------------------------- 7. a herd crossing a bridge or tunnel
  {
    id: 'herdCrossing', weight: 3, phase: [2, 5],
    when: (s, w) => nearLinks(s, w, st => st === 'open' || st === 'held' || st === 'blocked').length > 0,
    make: (s, w, rng) => {
      const link = pickOne(rng, nearLinks(s, w, st => st === 'open' || st === 'held' || st === 'blocked'));
      const [mine, far] = linkEnds(s, w, link);
      const size = Math.round(120 + rng() * 180 + s.day * .4);
      const where = link.kind === 'bridge' ? `over ${link.name}` : `gjennom ${link.name}`;
      return event(`Hordene ${link.kind === 'bridge' ? 'på brua' : 'i tunnelen'}`, `Speiderne så dem i skumringen: en tett strøm av døde på vei ${where}, fra ${zoneName(w, far)} mot ${zoneName(w, mine)}. Om lag ${size}. Med denne farten er de over i morgen tidlig.`, [
        { id: 'evacuate', label: `Evakuer ${zoneName(w, mine)}`, detail: 'Folk og det dere rekker, trekkes bakover. Noe blir igjen.' },
        { id: 'block', label: 'Sperr den', detail: '10 byggemateriale. De fleste stopper. Noen kommer seg forbi.', disabled: need(s, { building: 10 }) },
        { id: 'blow', label: 'Spreng den', detail: `2 sprengstoff. Ingen kommer over, aldri igjen${hasTech(s, 'bridgeRepair') ? ', med mindre dere bygger på nytt' : ''}.`, disabled: need(s, { explosives: 2 }) },
        { id: 'nothing', label: 'Håp at de snur', detail: 'Det gjør de sjelden.', tags: ['reckless'] },
      ], { zoneId: mine, data: { link: link.id, name: link.name, mine, far, size } });
    },
    resolve: (s, w, c, _rng, lines) => {
      const d = data(s);
      const link = str(d, 'link'), mine = str(d, 'mine'), far = str(d, 'far'), size = num(d, 'size');
      if (c === 'evacuate') {
        addZombies(s, mine, size);
        const food = s.zones[mine]?.status === 'controlled' ? takeShare(s, 'food', .1) : 0;
        hope(s, -4);
        lines.push({ tone: 'warn', title: `${zoneName(w, mine)} er tømt`, text: `Alle kom seg unna.${food ? ` ${food} mat ble igjen i hastverket.` : ''}`, zoneId: mine });
      }
      if (c === 'block') {
        pay(s, { building: 10 });
        s.chokepoints[link] = 'blocked';
        addZombies(s, mine, size * .25); addZombies(s, far, size * .75);
      }
      if (c === 'blow') {
        pay(s, { explosives: 2 });
        s.chokepoints[link] = 'blown';
        delete s.barricades[link];
        addZombies(s, far, size * .8);
        hope(s, -2);
        remember(s, `Dere sprengte ${str(d, 'name')} for å stoppe en horde.`);
        lines.push({ tone: 'good', title: `${str(d, 'name')} er borte`, text: 'Smellet hørtes til Sandnes. Det er første gang på lenge at noe herfra har imponert dem.' });
      }
      if (c === 'nothing') addZombies(s, mine, size);
    },
  },

  // ---------------------------------------------------------------- 8. the dark hospital
  {
    id: 'darkHospital', weight: 3, once: true, phase: [1, 3],
    when: (s, w) => placesOf(s, w, 'hospital').length > 0 && s.day >= 3,
    make: (s, w) => {
      const zone = placesOf(s, w, 'hospital')[0];
      const camp = faction(s, 'hospital');
      return event('Den mørke fløyen', `${camp ? 'SUS-leiren holder den nye delen av sykehuset. Den gamle fløyen har de gitt opp.' : 'Stavanger universitetssjukehus står mørkt.'} I tredje etasje banker noen på en kodelåst dør. En kirurg og tre sykepleiere har sperret seg inne på medisinlageret. Mellom dem og trappa ligger to sengeposter med smittede, som ble låst inne den første natta.`, [
        { id: 'raid', label: 'Tøm lageret og gå', detail: 'Medisin og antibiotika. Personalet blir igjen. Noen kan bli bitt.', disabled: noCrew(s), tags: ['harsh', 'reckless'] },
        { id: 'free', label: 'Hent ut personalet', detail: 'De to beste går inn gjennom sengepostene. Borte i to dager.', disabled: noCrew(s, 2), tags: ['merciful'] },
        { id: 'seal', label: 'Sveis igjen sengepostene', detail: '8 byggemateriale. Personalet kan gå ut selv, når de tør.', disabled: need(s, { building: 8 }) },
        { id: 'burn', label: 'Brenn fløyen', detail: '12 drivstoff. Ingen smitte igjen. Ingen leger heller.', disabled: need(s, { fuel: 12 }), tags: ['cruel'] },
      ], { zoneId: zone, data: { zone } });
    },
    resolve: (s, w, c, rng, lines) => {
      const zone = str(data(s), 'zone');
      if (c === 'raid') {
        give(s, 'medicine', 14); give(s, 'antibiotics', 3); hope(s, -4);
        const p = pickCrew(s, rng);
        if (p && chance(rng, .35)) { p.bitten = s.day + 2; lines.push({ tone: 'bad', title: `${p.name} ble bitt`, text: 'En av dørene på sengeposten var ikke låst likevel.' }); }
        remember(s, 'Dere tømte medisinlageret på SUS og lot personalet bli igjen.');
      }
      if (c === 'free') {
        const pair = team(s, 2, 'combat');
        sendAway(s, pair, 2);
        schedule(s, 2, 'hospitalRescue', { zone, mode: 'free', a: pair[0]?.id ?? '', b: pair[1]?.id ?? '' });
      }
      if (c === 'seal') { pay(s, { building: 8 }); hope(s, 1); schedule(s, 4, 'hospitalRescue', { zone, mode: 'sealed' }); }
      if (c === 'burn') {
        pay(s, { fuel: 12 });
        addZombies(s, zone, -Math.round((s.zones[zone]?.zombies ?? 0) * .8));
        hope(s, -12); unrest(s, 4);
        relate(faction(s, 'hospital'), -30);
        remember(s, `Dere brente den gamle fløyen på SUS i ${zoneName(w, zone)}, med alle som var der.`);
      }
    },
  },
  {
    id: 'hospitalRescue', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, rng, d) => {
      const zone = str(d, 'zone');
      if (str(d, 'mode') === 'sealed') return event('To fra sykehuset', `To av sykepleierne fra SUS står ved sperringen med hver sin kasse medisin. Kirurgen ble igjen. Han ville ikke forlate pasientene, sa han, selv om pasientene ikke lenger var pasienter.`, [
        { id: 'admit', label: 'Ta dem inn', detail: '2 sykepleiere og 6 medisin.', tags: ['merciful'] },
        { id: 'away', label: 'Send dem videre', detail: 'Dere har ikke plass.', tags: ['harsh'] },
      ], { zoneId: zone, data: { ...d } });
      const a = crewById(s, d?.a), b = crewById(s, d?.b);
      const bitten = chance(rng, hasTech(s, 'fieldSurgery') ? .2 : .35);
      return event(bitten ? 'Ut av sengeposten, nesten' : 'Personalet er ute', bitten
        ? `${names([a, b])} kom seg gjennom sengepostene og ut med kirurgen og sykepleierne. I trappa ble den yngste sykepleieren bitt i underarmen. Kirurgen har allerede funnet fram sagen.`
        : `${names([a, b])} kom seg gjennom sengepostene i ${zoneName(w, zone)} med lommelykter og tape over ermene. Kirurgen og tre sykepleiere er med, og så mye medisin de kunne bære.`, bitten ? [
        { id: 'amputate', label: 'La kirurgen amputere', detail: hasTech(s, 'fieldSurgery') ? 'Feltkirurgien gir henne en god sjanse.' : '4 medisin. Det er en sjanse.', disabled: hasTech(s, 'fieldSurgery') ? undefined : need(s, { medicine: 4 }), tags: ['merciful'] },
        { id: 'leaveHer', label: 'La henne bli igjen', detail: 'Det er tryggest. Kirurgen vil aldri tilgi det.', tags: ['cruel'] },
      ] : [
        { id: 'welcome', label: 'Ta dem med hjem', detail: '4 helsearbeidere og 10 medisin.', tags: ['charity'] },
        ...opt(!!faction(s, 'hospital'), { id: 'camp', label: 'Følg dem til SUS-leiren', detail: 'De blir hos sine egne. Leiren husker hvem som hjalp.' }),
      ], { zoneId: zone, data: { ...d, bitten: bitten ? 1 : 0 } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'admit') { addPeople(s, { adults: 2 }); give(s, 'medicine', 6); hope(s, 3); }
      if (c === 'away') hope(s, -4);
      if (c === 'welcome') { addPeople(s, { adults: 4 }); give(s, 'medicine', 10); give(s, 'antibiotics', 2); hope(s, 6); remember(s, 'Dere hentet en kirurg og tre sykepleiere ut av SUS.'); }
      if (c === 'camp') { relate(faction(s, 'hospital'), 30); give(s, 'medicine', 6); hope(s, 4); const f = faction(s, 'hospital'); if (f) f.known = true; }
      if (c === 'amputate') {
        if (!hasTech(s, 'fieldSurgery')) pay(s, { medicine: 4 });
        const ok = chance(rng, hasTech(s, 'fieldSurgery') ? .85 : .55);
        addPeople(s, { adults: ok ? 4 : 3 }); give(s, 'medicine', 8); hope(s, ok ? 5 : 1);
        lines.push(ok ? { tone: 'good', title: 'Hun klarte seg', text: 'Kirurgen sydde i lyset fra en hodelykt. Hun mangler en hånd, men feberen kom aldri.' }
          : { tone: 'bad', title: 'For sent', text: 'Kirurgen gjorde det han kunne. Det var ikke nok.' });
      }
      if (c === 'leaveHer') {
        addPeople(s, { adults: 3 }); give(s, 'medicine', 8); hope(s, -6);
        const surgeonUpset = pickCrew(s, rng, p => (p.traits ?? []).includes('kind'));
        if (surgeonUpset) loyalty(surgeonUpset, -6);
      }
    },
  },

  // ---------------------------------------------------------------- 9. the mall held by a rival group
  {
    id: 'mallHolders', weight: 2, phase: [2, 4],
    when: (s, w) => !!faction(s, 'traders') || placesOf(s, w, 'mall').some(id => s.zones[id].status !== 'controlled'),
    make: (s, w, rng) => {
      const f = faction(s, 'traders');
      const zone = f?.zoneId ?? pickOne(rng, placesOf(s, w, 'mall').filter(id => s.zones[id].status !== 'controlled'));
      const mall = placeName(w, zone, 'mall', 'kjøpesenteret');
      const group = f && f.known ? f.name.split(' (')[0] : 'En gruppe';
      return event('Senteret', `${group} har gjort ${mall} om til en festning. Gjennom glasset ser dere paller med hermetikk, ris og pasta, stablet til taket i det gamle varemottaket. Vaktene på taket har armbrøster. Det er mer mat der inne enn dere har sett på et år.`, [
        { id: 'share', label: 'Foreslå et bytte', detail: '15 ammunisjon for 45 mat.', disabled: need(s, { ammo: 15 }) },
        { id: 'take', label: 'Krev en andel', detail: 'Vis våpnene og krev mat. Det kan gå. Det glemmer de ikke.', disabled: noCrew(s, 2), tags: ['harsh'] },
        { id: 'night', label: 'Bryt inn om natta', detail: 'De to beste speiderne, borte i ett døgn.', disabled: noCrew(s, 2), tags: ['reckless', 'betrayal'] },
        { id: 'leave', label: 'La dem være', detail: 'Ingen fiender i dag.' },
      ], { zoneId: zone, data: { zone, mall } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const d = data(s);
      const f = faction(s, 'traders');
      if (f) f.known = true;
      if (c === 'share') { pay(s, { ammo: 15 }); give(s, 'food', 45); relate(f, 10); }
      if (c === 'take') {
        const power = fightPower(s, team(s, 3, 'combat'));
        if (chance(rng, clamp(.3 + power * .03, .25, .8))) {
          give(s, 'food', 60); relate(f, -35); hope(s, -2);
          lines.push({ tone: 'warn', title: 'De ga etter', text: 'Seks paller ble trillet ut. Ingen på taket senket armbrøstene.' });
        } else {
          const p = pickCrew(s, rng, x => x.skills.combat >= 2) ?? pickCrew(s, rng);
          if (p) hurtPerson(s, p, 30, lines, 'En armbrøstpil fra taket.');
          relate(f, -25); hope(s, -3);
        }
      }
      if (c === 'night') {
        const pair = team(s, 2, 'scouting');
        sendAway(s, pair, 1);
        schedule(s, 1, 'mallRaid', { ...d, a: pair[0]?.id ?? '', b: pair[1]?.id ?? '' });
      }
    },
  },
  {
    id: 'mallRaid', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const a = crewById(s, d?.a), b = crewById(s, d?.b);
      const ok = chance(rng, clamp(.45 + ((a?.skills.scouting ?? 0) + (b?.skills.scouting ?? 0)) * .04, .3, .85));
      if (ok) return event('I varemottaket', `${names([a, b])} kom seg inn gjennom ventilasjonen på ${str(d, 'mall')}. Lageret var der. Det var barna også: ni unger som sov på pallene, med en lommelykt som var gått tom. De holder vakt over maten fordi ingen tror at noen vil stjele fra barn.`, [
        { id: 'all', label: 'Ta alt dere kan bære', detail: '80 mat. Barna våkner.', tags: ['cruel', 'children'] },
        { id: 'half', label: 'Ta litt, og gå stille', detail: '35 mat. Kanskje merker de det ikke.', tags: ['merciful'] },
        { id: 'nothing', label: 'Gå tomhendt', detail: 'Ingen så dere.' },
      ], { zoneId: str(d, 'zone'), data: { ...d, ok: 1 } });
      return event('Oppdaget', `Alarmen på ${str(d, 'mall')} gikk på batteri. ${names([a, b])} kom seg ut, men en armbrøstpil traff, og de der inne så hvem dere var.`, [
        { id: 'apologise', label: 'Send mat og en unnskyldning', detail: '20 mat.', disabled: need(s, { food: 20 }) },
        { id: 'deny', label: 'Nekt for alt', detail: 'De vet. Dere vet at de vet.', tags: ['betrayal'] },
      ], { zoneId: str(d, 'zone'), data: { ...d, ok: 0 } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const d = data(s);
      const f = faction(s, 'traders');
      if (!num(d, 'ok')) {
        const hit = crewById(s, pickOne(rng, [d.a, d.b]));
        if (hit) hurtPerson(s, hit, 25, lines, 'Pila satt i skulderen.');
      }
      if (c === 'all') { give(s, 'food', 80); relate(f, -40); hope(s, -6); remember(s, 'Dere tok maten fra barna som voktet lageret på senteret.'); }
      if (c === 'half') { give(s, 'food', 35); relate(f, -10); }
      if (c === 'nothing') hope(s, 2);
      if (c === 'apologise') { pay(s, { food: 20 }); relate(f, -5); }
      if (c === 'deny') { relate(f, -35); unrest(s, 2); }
    },
  },

  // ---------------------------------------------------------------- 10. the priest at the cathedral
  {
    id: 'cathedralPriest', weight: 2, once: true, phase: [2, 4],
    when: (s, w) => placesOf(s, w, 'refuge').length > 0,
    make: (s, w) => {
      const zone = placesOf(s, w, 'refuge')[0];
      return event('Presten i Domkirken', `I Domkirken har tjue mennesker søkt ly. De ledes av en prest med én regel: ingen vold innenfor murene, heller ikke mot de døde. «De var noens barn», sier han. De har sunget for å holde motet oppe og spist det siste av nattverdsbrødet. Nå spør han om de kan komme til dere.`, [
        { id: 'admit', label: 'Ta imot dem', detail: '10 voksne, 5 barn og 5 eldre, og presten med sine regler.', tags: ['charity', 'faith'] },
        { id: 'terms', label: 'Bare på våre vilkår', detail: 'De som godtar lovene deres, kommer. Presten blir igjen.', tags: ['harsh'] },
        { id: 'supply', label: 'Gi dem mat i kirken', detail: '25 mat. De blir der de er.', disabled: need(s, { food: 25 }), tags: ['charity'] },
        { id: 'refuse', label: 'Si nei', detail: 'Dere har nok munner.' },
      ], { zoneId: zone, data: { zone } });
    },
    resolve: (s, _w, c, rng) => {
      const church = faction(s, 'church');
      if (church) church.known = true;
      if (c === 'admit') { addPeople(s, { adults: 10, children: 5, elderly: 5 }); hope(s, 6); unrest(s, 3); setFlag(s, 'priest', 'in'); schedule(s, 9 + Math.floor(rng() * 4), 'priestConflict'); remember(s, 'Presten fra Domkirken og flokken hans flyttet inn.'); }
      if (c === 'terms') { addPeople(s, { adults: 6, children: 3 }); hope(s, -2); relate(church, -10); }
      if (c === 'supply') { pay(s, { food: 25 }); hope(s, 3); relate(church, 15); }
      if (c === 'refuse') hope(s, -3);
    },
  },
  {
    id: 'priestConflict', weight: 1, chainOnly: true, when: s => flag(s, 'priest') === 'in',
    make: s => {
      const harsh = ['punishDeath', 'bittenMercy', 'punishExile', 'punishStocks', 'childLabour', 'closedGates', 'militia', 'strongman'].find(id => hasLaw(s, id));
      const law = LAWS.find(l => l.id === harsh);
      const text = law
        ? `Presten står på en kasse foran matkøen og kaller loven om ${law.name.toLowerCase()} for synd. Folket hans nekter å følge den, og flere av deres egne har begynt å lytte. «Dere kan ikke overleve ved å bli det dere flykter fra.»`
        : 'Flokken fra Domkirken nekter å ta vakter der det skal drepes. De døde er fortsatt noens barn, sier presten. Resten av leiren har begynt å telle hvem som står på muren, og hvem som ikke gjør det.';
      return event('Presten og loven', text, [
        { id: 'yield', label: law ? `Opphev loven om ${law.name.toLowerCase()}` : 'Frita dem for vakt', detail: law ? 'Presten får viljen sin. Noen vil kalle det svakhet.' : 'De andre tar vaktene deres. Det blir murring.', tags: ['faith', 'merciful'] },
        { id: 'pulpit', label: 'Gi ham søndagen, ikke loven', detail: 'Han får preke. Loven står. Det holder en stund.', tags: ['faith'] },
        { id: 'overrule', label: 'Loven gjelder alle', detail: 'Noen av hans folk vil gå.', tags: ['harsh'] },
        { id: 'exile', label: 'Send presten ut porten', detail: 'Han og de nærmeste går. Det blir stille, og kaldere.', tags: ['harsh', 'cruel'] },
      ], { data: { law: harsh ?? '' } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const law = str(data(s), 'law');
      if (c === 'yield') {
        if (law) { s.laws = s.laws.filter(l => l !== law); lines.push({ tone: 'info', title: 'Loven er opphevet', text: 'Presten takket ikke. Han bare nikket, som om det var selvsagt.' }); hope(s, 4); unrest(s, -2); }
        else { hope(s, 3); unrest(s, 5); }
        setFlag(s, 'priest', 'heard');
      }
      if (c === 'pulpit') {
        hope(s, 5); unrest(s, -2);
        if (chance(rng, .4)) schedule(s, 14, 'priestConflict');
        else setFlag(s, 'priest', 'heard');
      }
      if (c === 'overrule') {
        unrest(s, 6); hope(s, -3);
        if (chance(rng, .5)) { const gone = removePeople(s, 'adults', 4); lines.push({ tone: 'bad', title: `${gone} gikk`, text: 'De tok med seg en sekk mat og en salmebok.' }); give(s, 'food', -8); }
        setFlag(s, 'priest', 'overruled');
      }
      if (c === 'exile') {
        removePeople(s, 'adults', 3); removePeople(s, 'elderly', 2);
        hope(s, -7); unrest(s, -4);
        setFlag(s, 'priest', 'exiled');
        remember(s, 'Dere sendte presten fra Domkirken ut porten.');
      }
    },
  },

  // ---------------------------------------------------------------- 11. the oil-industry supply ship
  {
    id: 'supplyShip', weight: 2, once: true, phase: [3, 5],
    when: (s, w) => coastalOwned(s, w).length > 0,
    make: (s, w, rng) => {
      const zone = pickOne(rng, coastalOwned(s, w));
      return event('Forsyningsskipet', `Et oransje forsyningsskip glir inn mot ${zoneName(w, zone)} med lanternene tent. «Havbris», fra et felt langt ute i Nordsjøen. Tankene er halvfulle av marin diesel. Om bord er ti mann og to ingeniører som har holdt alt i gang i ukevis, mens radioen ble stillere og stillere. De har ikke mer mat. De ber om kai, mat og trygghet, i den rekkefølgen.`, [
        { id: 'welcome', label: 'Gi dem kai og mat', detail: '40 mat. 10 sjøfolk, 2 ingeniører og 80 drivstoff.', disabled: need(s, { food: 40 }), tags: ['charity'] },
        { id: 'trade', label: 'Handle, og la dem seile', detail: '20 mat og 5 medisin for 50 drivstoff og 4 deler.', disabled: need(s, { food: 20, medicine: 5 }) },
        { id: 'seize', label: 'Ta skipet', detail: 'Mye drivstoff og en motor. De er tolv, og ikke alle er sjøsyke.', disabled: noCrew(s, 2), tags: ['cruel', 'betrayal'] },
        { id: 'wave', label: 'Vink dem videre', detail: 'Ingen fremmede.' },
      ], { zoneId: zone, data: { zone } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'welcome') {
        pay(s, { food: 40 }); give(s, 'fuel', 80); addPeople(s, { adults: 12 }); hope(s, 6);
        schedule(s, 8, 'shipEngineers');
        remember(s, '«Havbris» la til kai hos dere, med diesel og ingeniører.');
      }
      if (c === 'trade') { pay(s, { food: 20, medicine: 5 }); give(s, 'fuel', 50); give(s, 'parts', 4); }
      if (c === 'seize') {
        give(s, 'fuel', 120); give(s, 'engine', 1); hope(s, -8); unrest(s, 3);
        const p = pickCrew(s, rng, x => x.skills.combat >= 2) ?? pickCrew(s, rng);
        if (p && chance(rng, .2)) killPerson(s, p, lines, 'Stukket ned på dekket av «Havbris».');
        else if (p && chance(rng, .5)) hurtPerson(s, p, 30, lines, 'Slagsmål på dekk.');
        remember(s, 'Dere tok forsyningsskipet «Havbris» fra mannskapet og satte dem i livbåtene.');
      }
      if (c === 'wave') hope(s, -1);
    },
  },
  {
    id: 'shipEngineers', weight: 1, chainOnly: true, when: () => true,
    make: s => event('Ingeniørene har en plan', 'Ingeniørene fra «Havbris» har tegnet på baksiden av et sjøkart. Skipsgeneratoren kan gi strøm til hele leiren, om dere legger en kabel i land. Eller de kan fylle tankene og seile mot Shetland for å se om noen lever der. «Vi drar ikke uten lov», sier den ene. Den andre sier ingenting.', [
      { id: 'power', label: 'Legg kabelen', detail: '6 deler og 10 metall. To generatorer og elektronikk fra skipet.', disabled: need(s, { parts: 6, metal: 10 }) },
      { id: 'sail', label: 'La dem seile', detail: 'Fire av sjøfolkene og skipet drar. Kanskje kommer de tilbake med nyheter.', tags: ['merciful'] },
      { id: 'keep', label: 'Skipet blir', detail: 'Dieselen trengs her. Ingeniørene blir sure.', tags: ['harsh'] },
    ]),
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'power') { pay(s, { parts: 6, metal: 10 }); give(s, 'generator', 2); give(s, 'electronics', 6); hope(s, 5); remember(s, 'Leiren fikk strøm fra skipsgeneratoren på «Havbris».'); }
      if (c === 'sail') {
        removePeople(s, 'adults', 4); hope(s, 3);
        if (chance(rng, .5)) { give(s, 'radio', 1); lines.push({ tone: 'info', title: 'Et siste anrop', text: 'Før «Havbris» forsvant i disen, la de igjen et VHF-sett på kaia.' }); }
      }
      if (c === 'keep') { give(s, 'fuel', 30); unrest(s, 6); hope(s, -2); }
    },
  },

  // ---------------------------------------------------------------- 12. the tunnel full of stalled cars
  {
    id: 'tunnelCars', weight: 2, phase: [1, 4],
    when: (s, w) => w.links.some(l => l.kind === 'tunnel' && l.lengthM > 400 && !['flooded', 'blown'].includes(s.chokepoints[l.id] ?? 'open')),
    make: (s, w, rng) => {
      const near = nearLinks(s, w, st => st !== 'flooded' && st !== 'blown', 'tunnel').filter(l => l.lengthM > 400);
      const all = w.links.filter(l => l.kind === 'tunnel' && l.lengthM > 400 && !['flooded', 'blown'].includes(s.chokepoints[l.id] ?? 'open'));
      const link = pickOne(rng, near.length ? near : all);
      const [mine] = linkEnds(s, w, link);
      const size = 40 + Math.floor(rng() * 50);
      return event(`Bilene i ${link.name}`, `${link.name} er full av biler som stoppet den første dagen. Bagasjerom med kofferter, matposer og fulle tanker. Men lyktene viser også at bilene ikke er tomme. Om lag ${size} døde står tett mellom dem i mørket, og venter på lyd.`, [
        { id: 'quiet', label: 'Snik dere inn', detail: `De to beste speiderne, stille.${hasTech(s, 'crossbows') ? ' Armbrøstene hjelper.' : ''} Mat, drivstoff og deler, om det går.`, disabled: noCrew(s, 2), tags: ['reckless'] },
        { id: 'lure', label: 'Lokk dem ut først', detail: `${hasTech(s, 'decoys') ? 3 : 8} drivstoff til en alarm ved munningen. De ender i ${zoneName(w, mine)}.`, disabled: need(s, { fuel: hasTech(s, 'decoys') ? 3 : 8 }) },
        { id: 'seal', label: 'Steng tunnelen', detail: '8 byggemateriale. De blir der inne.', disabled: need(s, { building: 8 }) },
        { id: 'leave', label: 'La den være', detail: 'Ikke verdt det.' },
      ], { zoneId: mine, data: { link: link.id, name: link.name, mine, size } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const d = data(s);
      const link = str(d, 'link'), mine = str(d, 'mine');
      if (c === 'quiet') {
        const pair = team(s, 2, 'scouting');
        const ok = chance(rng, clamp(.5 + (hasTech(s, 'crossbows') ? .15 : 0) + pair.reduce((n, p) => n + p.skills.scouting, 0) * .03, .3, .9));
        if (ok) {
          give(s, 'food', 25); give(s, 'fuel', 25); give(s, 'parts', 5); give(s, 'medicine', 3);
          schedule(s, 3, 'tunnelDeep', { ...d });
          lines.push({ tone: 'good', title: 'Bagasjerom for bagasjerom', text: `${names(pair)} brukte seks timer på tjue meter. Lengre inne skimtet de en tankbil.` });
        } else {
          give(s, 'food', 10); give(s, 'fuel', 10);
          const p = pair[Math.floor(rng() * pair.length)];
          if (p) { p.bitten = s.day + 2; lines.push({ tone: 'bad', title: `${p.name} ble bitt`, text: 'En bildør gikk opp av seg selv.' }); }
        }
      }
      if (c === 'lure') {
        pay(s, { fuel: hasTech(s, 'decoys') ? 3 : 8 });
        addZombies(s, mine, num(d, 'size'));
        give(s, 'food', 25); give(s, 'fuel', 30); give(s, 'parts', 5);
        schedule(s, 3, 'tunnelDeep', { ...d });
      }
      if (c === 'seal') { pay(s, { building: 8 }); s.chokepoints[link] = 'blocked'; }
    },
  },
  {
    id: 'tunnelDeep', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const link = str(d, 'link');
      if (['flooded', 'blown'].includes(s.chokepoints[link] ?? 'open')) return null;
      return event('Tankbilen', `Midt i ${str(d, 'name')} står en tankbil, nesten full av diesel. Men en pumpe lager lyd, og lyd i en tunnel går langt. Det som fortsatt står i mørket lenger inne, vil høre det.`, [
        { id: 'pump', label: 'Pump den tom', detail: '2 deler til slanger og pumpe. 70 drivstoff. Det blir bråk.', disabled: need(s, { parts: 2 }) ?? noCrew(s, 2), tags: ['reckless'] },
        { id: 'blow', label: 'Tenn på den', detail: 'Tunnelen stenges for godt, og alt der inne brenner.', tags: ['reckless'] },
        { id: 'leave', label: 'La den stå', detail: 'Den går ingen steder.' },
      ], { data: { ...d } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const d = data(s);
      if (c === 'pump') {
        pay(s, { parts: 2 }); give(s, 'fuel', 70);
        if (chance(rng, .4)) {
          const p = pickCrew(s, rng);
          if (p) hurtPerson(s, p, 25, lines, 'De kom ut av mørket før tanken var tom.');
          addZombies(s, str(d, 'mine'), 30);
        }
      }
      if (c === 'blow') {
        s.chokepoints[str(d, 'link')] = 'blown';
        delete s.barricades[str(d, 'link')];
        hope(s, 2);
        remember(s, `Dere satte fyr på en tankbil i ${str(d, 'name')}. Tunnelen er stengt for godt.`);
      }
    },
  },

  // ---------------------------------------------------------------- 13. the radio voice at seven
  {
    id: 'radioHour', weight: 2, once: true, phase: [1, 5],
    when: s => s.day >= 5,
    make: (s, w, rng) => {
      const truth = pickOne(rng, ['survivor', 'trap', 'recording']);
      const options = borderZones(s, w);
      const zone = options.length ? pickOne(rng, options) : s.homeZoneId;
      const sees = hasTech(s, 'intel');
      const hint = truth === 'survivor' ? 'Lytteposten mener stemmen er ekte. Hun svarer på vær som endrer seg.'
        : truth === 'trap' ? 'Lytteposten har hørt menn snakke på samme frekvens rett etterpå. De teller hvem som kommer.'
          : 'Lytteposten har målt pausene. De er like lange hver kveld, på sekundet.';
      const canAnswer = hasTech(s, 'crystalRadio') || amount(s, 'radio') >= 1;
      return event('Stemmen klokka sju', `Hver kveld klokka sju kommer den samme stemmen på kanal 16: en kvinne som sier at hun er i ${zoneName(w, zone)}, at hun har mat å dele og at hun er alene. Samme ord. Samme pauser. I går lo hun på samme sted som forrige gang.${sees ? ` ${hint}` : ''}`, [
        { id: 'go', label: 'Send to dit', detail: 'De to beste speiderne, borte i to dager.', disabled: noCrew(s, 2), tags: ['reckless'] },
        ...opt(canAnswer, { id: 'answer', label: 'Svar henne', detail: 'Hun får vite at dere finnes. Det gjør alle andre som lytter også.' }),
        { id: 'ignore', label: 'Skru ned', detail: 'Klokka sju blir aldri helt den samme.' },
      ], { zoneId: zone, data: { truth, zone } });
    },
    resolve: (s, _w, c) => {
      const d = data(s);
      if (c === 'go') {
        const pair = team(s, 2, 'scouting');
        sendAway(s, pair, 2);
        schedule(s, 2, 'radioHourFound', { ...d, mode: 'go', a: pair[0]?.id ?? '', b: pair[1]?.id ?? '' });
      }
      if (c === 'answer') schedule(s, 2, 'radioHourFound', { ...d, mode: 'answer' });
      if (c === 'ignore') hope(s, -1);
    },
  },
  {
    id: 'radioHourFound', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, rng, d) => {
      const truth = str(d, 'truth'), mode = str(d, 'mode'), zone = str(d, 'zone');
      const who = names([crewById(s, d?.a), crewById(s, d?.b)]);
      if (truth === 'survivor') return event('Hun var ekte', mode === 'go'
        ? `${who} fant henne på et loft i ${zoneName(w, zone)}, med to barn og en fryseboks hun har holdt kald med et solcellepanel på taket. Hun har lest opp den samme meldingen fra en lapp i fem uker, for ikke å begynne å gråte.`
        : 'Hun svarte med en gang, og så ble det stille lenge. To dager senere står hun ved sperringen med to barn og en kjelke full av frossenmat.', [
        { id: 'bring', label: 'Ta dem med', detail: 'En voksen, to barn, mat og et solcellepanel.', tags: ['charity'] },
        { id: 'stay', label: 'La henne bli, og hold kontakten', detail: 'Hun foretrekker loftet sitt. Klokka sju betyr noe nå.' },
      ], { zoneId: zone, data: { ...d } });
      if (truth === 'trap') {
        const base = mode === 'go' ? `${who} kom til adressen. Døra var åpen, og radioen sto på. Så kom mennene ut fra trappeoppgangen.` : 'Det var ikke henne som svarte. Det var en mann som sa takk for posisjonen. I natt sto fire mann med lommelykter utenfor sperringen deres.';
        return event('Det var et garn', `${base} «Vi vil ikke skade noen. Vi vil bare ha det dere har.»`, [
          { id: 'fight', label: 'Slåss', detail: '15 ammunisjon. Kanskje får dere deres lager også.', disabled: need(s, { ammo: 15 }), tags: ['reckless'] },
          { id: 'yield', label: 'Gi dem det de vil ha', detail: 'Dere mister en del av ammunisjonen og drivstoffet. Ingen blir skadet.' },
        ], { zoneId: zone, data: { ...d } });
      }
      const cache = pickOne(rng, [zone, ...borderZones(s, w)]);
      return event('Et opptak', `Stemmen kommer fra en båndspiller koblet til en radio på et kjøkkenbord i ${zoneName(w, zone)}. Kvinnen har vært borte lenge. Ved siden av ligger et kart med et kryss: en kjeller i ${zoneName(w, cache)}, «til den som kommer».`, [
        { id: 'mark', label: 'Merk kjelleren på kartet', detail: 'Et lager å hente når dere når fram.' },
        { id: 'gear', label: 'Ta med radioen', detail: 'Radioutstyr og batterier, og la meldingen dø.' },
      ], { zoneId: cache, data: { ...d, cache } });
    },
    resolve: (s, w, c, rng, lines) => {
      const d = data(s);
      if (c === 'bring') { addPeople(s, { adults: 1, children: 2 }); give(s, 'food', 15); give(s, 'solar', 1); hope(s, 5); remember(s, 'Stemmen klokka sju bor hos dere nå.'); }
      if (c === 'stay') { hope(s, 4); setFlag(s, 'radioFriend', str(d, 'zone')); }
      if (c === 'fight') {
        pay(s, { ammo: 15 });
        const p = pickCrew(s, rng, x => x.skills.combat >= 2) ?? pickCrew(s, rng);
        if (p && chance(rng, .45)) hurtPerson(s, p, 30, lines, 'Skuddvekslingen i trappeoppgangen.');
        if (chance(rng, .6)) { give(s, 'food', 25); give(s, 'ammo', 25); lines.push({ tone: 'good', title: 'Deres lager', text: 'De hadde et lager i kjelleren under. Nå er det deres.' }); }
      }
      if (c === 'yield') { takeShare(s, 'ammo', .25); takeShare(s, 'fuel', .2); hope(s, -4); }
      if (c === 'mark') {
        const cache = str(d, 'cache');
        addLoot(s, cache, { food: 40, medicine: 6, ammo: 30, batteries: 4 });
        lines.push({ tone: 'good', title: 'Et kryss på kartet', text: `Kjelleren i ${zoneName(w, cache)} venter på dere.`, zoneId: cache });
      }
      if (c === 'gear') { give(s, 'radio', 1); give(s, 'batteries', 4); }
    },
  },

  // ---------------------------------------------------------------- 14. the Lyse hydro plant
  {
    id: 'lyseHydro', weight: 2, once: true, phase: [3, 5],
    when: (s, w) => coastalOwned(s, w).length > 0 && atCamp(s).length >= 3,
    make: s => event('Lysene i Lysebotn', 'En fisker fra Forsand sier at lysene fortsatt brenner i Lysebotn. Kraftstasjonen inne i fjellet går av seg selv, sier han, så lenge ingen rører den. Er det sant, finnes det strøm, turbindeler og kanskje folk som kan noe. Det er en lang tur inn Lysefjorden, under Preikestolen, der ingen turister lenger tar bilder.', [
      { id: 'expedition', label: 'Send en ekspedisjon', detail: `En båt, 20 drivstoff og to fra crewet, borte i ${hasTech(s, 'ferry') ? 6 : 8} dager.`, disabled: need(s, { boat: 1, fuel: 20 }) ?? noCrew(s, 3), tags: ['reckless'] },
      { id: 'fisher', label: 'Betal fiskeren for å se etter', detail: '15 mat. Han lover å komme tilbake.', disabled: need(s, { food: 15 }) },
      { id: 'no', label: 'Det er bare et rykte', detail: 'Lysebotn er langt unna.' },
    ]),
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'expedition') {
        pay(s, { fuel: 20 });
        const pair = [team(s, 1, 'craft')[0], team(s, 2, 'combat').find(p => p.id !== team(s, 1, 'craft')[0]?.id)].filter((p): p is RegionSurvivor => !!p);
        const days = hasTech(s, 'ferry') ? 6 : 8;
        sendAway(s, pair, days);
        const roll = rng();
        const lostRisk = .25 - (hasTech(s, 'armour') ? .08 : 0) - (hasTech(s, 'ferry') ? .05 : 0);
        const outcome = roll < lostRisk ? 'lost' : roll < lostRisk + .3 ? 'people' : 'power';
        schedule(s, days, 'lyseReturn', { outcome, a: pair[0]?.id ?? '', b: pair[1]?.id ?? '' });
        lines.push({ tone: 'info', title: 'Inn Lysefjorden', text: `${names(pair)} gikk fra kaia i morgengråtten.` });
      }
      if (c === 'fisher') {
        pay(s, { food: 15 });
        if (chance(rng, .5)) schedule(s, 6, 'lyseReturn', { outcome: 'fisher' });
        else lines.push({ tone: 'warn', title: 'Fiskeren dro', text: 'Han tok maten og sa han skulle komme tilbake. Det sier alle.' });
      }
    },
  },
  {
    id: 'lyseReturn', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const outcome = str(d, 'outcome');
      const a = crewById(s, d?.a), b = crewById(s, d?.b);
      if (outcome === 'fisher') return event('Fiskeren kom tilbake', 'Fiskeren fra Forsand holdt ord. Stasjonen går, sier han, og to maskinister bor der inne. De vil bytte. De har reservedeler og batterier, og de vil ha mat.', [
        { id: 'trade', label: 'Send mat med ham', detail: '30 mat for batterier, elektronikk og et vennskap.', disabled: need(s, { food: 30 }) },
        { id: 'no', label: 'Ikke nå', detail: 'Kanskje senere.' },
      ], { data: { ...d } });
      if (outcome === 'power') return event('Det var sant', `${names([a, b])} er tilbake fra Lysebotn. Turbinene går. To maskinister har holdt stasjonen i gang i månedsvis, alene i fjellet, med hermetikk og kortstokk. De har mer reservedeler enn de trenger, og mer strøm enn de kan bruke.`, [
        { id: 'parts', label: 'Ta med det de kan avse', detail: 'Generatorer, elektronikk og deler.' },
        { id: 'machinist', label: 'Få den ene til å bli med', detail: 'En som kan få strøm til å virke, og et aggregat.', tags: ['charity'] },
      ], { data: { ...d } });
      if (outcome === 'people') return event('Ingen strøm, men folk', `${names([a, b])} fant ingen strøm i Lysebotn. Turbinen er død. Men på den gamle turisthytta har tolv mennesker overlevd på tørrfisk og regnvann. De har ventet på en båt.`, [
        { id: 'bring', label: 'Hent dem', detail: '8 voksne og 4 barn. Flere munner, flere hender.', tags: ['charity'] },
        { id: 'supply', label: 'Gi dem mat og la dem bli', detail: '20 mat sendes inn neste gang.', disabled: need(s, { food: 20 }) },
      ], { data: { ...d } });
      const victim = [a, b].filter((p): p is RegionSurvivor => !!p);
      const lost = victim.length ? pickOne(rng, victim) : undefined;
      return event('Fjorden tok en', `Bare ${victim.filter(p => p !== lost).map(p => p.name).join('') || 'båten'} kom tilbake fra Lysebotn. Ved kaia under fjellet var det for mange av dem. ${lost ? `${lost.name} holdt dem unna mens den andre fikk løs båten.` : ''}`, [
        { id: 'mourn', label: 'Sørg', detail: 'Tenn et lys ved kaia.', tags: ['faith'] },
        { id: 'search', label: 'Send en båt tilbake', detail: '10 drivstoff. Kanskje lever de.', disabled: need(s, { fuel: 10 }), tags: ['reckless'] },
      ], { data: { ...d, lost: lost?.id ?? '' } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const d = data(s);
      if (c === 'trade') { pay(s, { food: 30 }); give(s, 'batteries', 12); give(s, 'electronics', 4); setFlag(s, 'lyse', 'trade'); hope(s, 3); }
      if (c === 'parts') { give(s, 'generator', 2); give(s, 'electronics', 8); give(s, 'parts', 6); hope(s, 8); setFlag(s, 'lyse', 'ally'); remember(s, 'Kraftstasjonen i Lysebotn går fortsatt, og maskinistene der er venner av dere.'); }
      if (c === 'machinist') { addPeople(s, { adults: 1 }); give(s, 'generator', 1); give(s, 'electronics', 4); hope(s, 6); setFlag(s, 'lyse', 'machinist'); }
      if (c === 'bring') { addPeople(s, { adults: 8, children: 4 }); hope(s, 6); unrest(s, 3); remember(s, 'Dere hentet tolv mennesker fra turisthytta i Lysebotn.'); }
      if (c === 'supply') { pay(s, { food: 20 }); hope(s, 2); }
      const lost = crewById(s, d.lost);
      if (c === 'mourn' && lost) { killPerson(s, lost, lines, 'Ble igjen ved kaia i Lysebotn.'); hope(s, 2); }
      if (c === 'search' && lost) {
        pay(s, { fuel: 10 });
        if (chance(rng, .4)) { hurtPerson(s, lost, 40, lines, 'Funnet i en båtnaust i Lysebotn, uttørket, men i live.'); hope(s, 6); }
        else killPerson(s, lost, lines, 'Båten fant bare sekken ved kaia i Lysebotn.');
      }
    },
  },

  // ---------------------------------------------------------------- 15. the trawler
  {
    id: 'trawler', weight: 2, good: true, phase: [2, 5],
    when: (s, w) => coastalOwned(s, w).length > 0,
    make: (s, w, rng) => {
      const zone = pickOne(rng, coastalOwned(s, w));
      const saltCost = hasTech(s, 'saltDry') ? 3 : 8;
      const buyer = ['farmers', 'traders', 'church'].map(id => faction(s, id)).find(f => f?.known);
      return event('Tråleren', `En tråler driver inn mot ${zoneName(w, zone)} med motoren død og ingen om bord. Lasterommet er fullt av sild på is som snart er smeltet. Måkene har allerede funnet den, og de er ikke flere enn at dere kan slå dem.`, [
        { id: 'salt', label: 'Salt den ned', detail: `${saltCost} salt og to dagers arbeid. Mat som varer.`, disabled: need(s, { salt: saltCost }) },
        { id: 'feast', label: 'Sildefest', detail: 'Alle spiser seg mette i kveld. Resten råtner.', tags: ['charity'] },
        ...opt(!!buyer, { id: 'trade', label: `Selg den til ${buyer?.name.split(' (')[0] ?? 'naboene'}`, detail: 'Drivstoff og et godt forhold.' }),
        { id: 'boat', label: 'Reparer tråleren', detail: '4 deler. En båt, og fisken dere rekker å spise.', disabled: need(s, { parts: 4 }) },
      ], { zoneId: zone, data: { zone, saltCost, buyer: buyer?.id ?? '' } });
    },
    resolve: (s, _w, c) => {
      const d = data(s);
      if (c === 'salt') { pay(s, { salt: num(d, 'saltCost') }); schedule(s, 2, 'trawlerSalted'); }
      if (c === 'feast') { give(s, 'food', 30); hope(s, 8); unrest(s, -5); }
      if (c === 'trade') { const f = faction(s, str(d, 'buyer')); relate(f, 15); give(s, 'fuel', 20); give(s, 'salt', 3); }
      if (c === 'boat') { pay(s, { parts: 4 }); give(s, 'boat', 1); give(s, 'food', 20); }
    },
  },
  {
    id: 'trawlerSalted', weight: 1, chainOnly: true, when: () => true,
    make: () => event('Tønner med sild', 'To dager med salt i hendene og sild til albuene. Tjue tønner står i skyggen. Det lukter som en julimarked på Torget, før alt.', [
      { id: 'store', label: 'Inn på lageret', detail: '80 mat som holder.' },
      { id: 'share', label: 'Del ut noe med en gang', detail: '55 mat, og en kveld folk husker.', tags: ['charity'] },
    ]),
    resolve: (s, _w, c) => {
      if (c === 'store') give(s, 'food', 80);
      if (c === 'share') { give(s, 'food', 55); hope(s, 5); }
    },
  },

  // ---------------------------------------------------------------- 16. the refugee camp at Sola
  {
    id: 'solaCamp', weight: 2, once: true, phase: [2, 4],
    when: (s, w) => placesOf(s, w, 'airport').length > 0,
    make: (s, w) => {
      const zone = placesOf(s, w, 'airport')[0];
      const crew = faction(s, 'airport');
      return event('Leiren på Sola', `I avgangshallen på Sola bor nesten seksti mennesker mellom bagasjebåndene. ${crew ? 'Bakkemannskapet holder drivstofflageret og slipper dem ikke inn der. ' : ''}Lederen deres, en tidligere flygeleder, har gått hele veien for å komme med et tilbud. «Mat for en uke. Eller hender. Vi kan bære, grave og bygge. Bare gi oss noe å spise.»`, [
        { id: 'food', label: 'Send mat', detail: '40 mat. De klarer seg en uke til.', disabled: need(s, { food: 40 }), tags: ['charity'] },
        { id: 'labour', label: 'Ta imot arbeidsfolk', detail: '10 voksne arbeider for kost i to uker.' },
        { id: 'refuse', label: 'Dere har ikke nok selv', detail: 'Hun går tilbake tomhendt.', tags: ['harsh'] },
      ], { zoneId: zone, data: { zone } });
    },
    resolve: (s, _w, c, rng) => {
      const d = data(s);
      const crew = faction(s, 'airport');
      if (c === 'food') { pay(s, { food: 40 }); hope(s, 5); relate(crew, 10); schedule(s, 10, 'solaCampThanks', d); }
      if (c === 'labour') { addPeople(s, { adults: 10 }); schedule(s, 14, 'solaLabourEnd', d); }
      if (c === 'refuse') { hope(s, -4); schedule(s, 7 + Math.floor(rng() * 4), 'solaCampFall', d); }
    },
  },
  {
    id: 'solaCampThanks', weight: 1, chainOnly: true, when: () => true,
    make: (_s, _w, _rng, d) => event('Takk fra Sola', 'Flygelederen er tilbake, med en trillebår full av jetdrivstoff på kanner som noen i bakkemannskapet ga henne. Hun har også med seg fem barn. «De er foreldreløse. Hos oss har de ingenting. Hos dere har de en sjanse.»', [
      { id: 'take', label: 'Ta imot barna', detail: '5 barn og 25 drivstoff.', tags: ['charity', 'merciful'] },
      { id: 'fuel', label: 'Bare drivstoffet', detail: 'Barna går tilbake med henne.', tags: ['harsh'] },
    ], { data: { ...d } }),
    resolve: (s, _w, c) => {
      give(s, 'fuel', 25);
      if (c === 'take') { addPeople(s, { children: 5 }); hope(s, 4); }
      if (c === 'fuel') hope(s, -3);
    },
  },
  {
    id: 'solaLabourEnd', weight: 1, chainOnly: true, when: () => true,
    make: s => event('To uker er gått', 'Arbeiderne fra Sola har gravd grøfter, båret sandsekker og reist gjerder i regnet uten å klage mer enn vanlig. Avtalen er ute. De fleste vil bli.', [
      { id: 'keep', label: 'De kan bli', detail: 'Ti flere for godt.', tags: ['charity'] },
      { id: 'some', label: 'Behold de fire beste', detail: 'Seks går tilbake til Sola.', tags: ['harsh'] },
      { id: 'send', label: 'Send dem hjem med lønn', detail: '15 mat i lønn. Alle ti går.', disabled: need(s, { food: 15 }) },
    ]),
    resolve: (s, _w, c) => {
      give(s, 'building', 15);
      if (c === 'keep') { hope(s, 3); unrest(s, 3); }
      if (c === 'some') { removePeople(s, 'adults', 6); hope(s, -2); }
      if (c === 'send') { removePeople(s, 'adults', 10); give(s, 'food', -15); hope(s, 1); }
    },
  },
  {
    id: 'solaCampFall', weight: 1, chainOnly: true, when: () => true,
    make: (_s, w, _rng, d) => event('Røyk over Sola', `Røyken fra Sola har stått hele dagen. Om kvelden kommer sju mennesker gående. De er alt som er igjen av leiren i avgangshallen. Flygelederen er ikke blant dem.`, [
      { id: 'admit', label: 'Ta dem inn', detail: '5 voksne og 2 barn.', tags: ['merciful'] },
      { id: 'away', label: 'Avvis dem', detail: 'Ikke nå heller.', tags: ['cruel'] },
    ], { zoneId: str(d, 'zone'), data: { ...d, where: zoneName(w, str(d, 'zone')) } }),
    resolve: (s, _w, c) => {
      const zone = str(data(s), 'zone');
      addZombies(s, zone, 60);
      if (c === 'admit') { addPeople(s, { adults: 5, children: 2 }); hope(s, 2); remember(s, 'Leiren på Sola falt. Sju kom seg til dere.'); }
      if (c === 'away') { hope(s, -6); remember(s, 'Leiren på Sola falt, og dere avviste de sju som kom.'); }
    },
  },
];
