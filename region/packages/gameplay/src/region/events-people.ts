/**
 * Life inside the camp: theft, crime, sickness, faith, feasts and the people who want your chair.
 * Most of these are chains. The first step looks small; the bill comes later.
 */
import { gearWeapon } from './gear';
import type { EventChoice, RegionState, RegionSurvivor, ReportLine, Stance } from './types';
import {
  addPeople, amount, crewById, event, farmOwned, give, hasLaw, hasModule, hasTech, homeName, hope, hurtPerson, killPerson, leaves,
  loyalty, need, pay, pickCrew, pickOne, remember, removePeople, schedule, setFlag, flag, takeShare, totalPeople, unrest, zoneName,
  type EventDef,
} from './kit';

// ------------------------------------------------------------------ local helpers

const data = (s: RegionState) => s.event?.data ?? {};
const num = (s: RegionState, k: string) => Number(data(s)[k] ?? 0);
const str = (s: RegionState, k: string) => String(data(s)[k] ?? '');
const crewHere = (s: RegionState) => s.survivors.filter(p => p.alive && !p.left);
const list = (...xs: (EventChoice | false | 0 | '' | null | undefined)[]) => xs.filter(Boolean) as EventChoice[];
const home = (s: RegionState) => s.zones[s.homeZoneId];
const knownFactions = (s: RegionState) => s.factions.filter(f => f.known && !f.defeated);
const rationLaw = (s: RegionState) => ['rationHalf', 'rationReduced', 'rationWorkers'].find(id => hasLaw(s, id));
const days = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));

const MEN = ['Rune', 'Geir', 'Kjetil', 'Odd Arne', 'Svein', 'Tormod', 'Arild', 'Stian', 'Bjarte', 'Egil', 'Leif', 'Trond'];
const WOMEN = ['Solveig', 'Randi', 'Gunn', 'Ingunn', 'Marit', 'Torill', 'Synnøve', 'Hege', 'Bente', 'Anne Lise', 'Kari', 'Liv'];
const PLACES = ['Hinna', 'Tjensvoll', 'Våland', 'Hillevåg', 'Madla', 'Gausel', 'Tasta', 'Kvernevik', 'Hundvåg', 'Eiganes'];

const PUNISH_IDS = ['punishDeath', 'punishExile', 'punishStocks', 'punishLabour'];
const punishLaw = (s: RegionState) => PUNISH_IDS.find(id => hasLaw(s, id));
/** A note for the event text when there is no law to lean on. */
const noLawNote = (s: RegionState) => punishLaw(s) ? '' : ' Dere har ingen straffelov. Hva du enn bestemmer, er det din dom alene.';
/** Making it up as you go costs more than pointing at a written rule. */
const improvised = (s: RegionState, n = 4) => { if (!punishLaw(s)) unrest(s, n); };

/** "Døm etter loven", if a law covers the crime. Death is only for grave crimes. */
function lawChoice(s: RegionState, grave: boolean, who: string): EventChoice | undefined {
  const law = punishLaw(s);
  if (!law || (law === 'punishDeath' && !grave)) return undefined;
  const t: Record<string, [string, string, Stance[]]> = {
    punishLabour: ['straffearbeid', `${who} jobber under vakt til skylden er betalt. Lite drama.`, []],
    punishExile: ['forvisning', `${who} sendes ut porten. Loven er klar, porten er tung.`, ['harsh']],
    punishStocks: ['gapestokk', `${who} står en dag foran alle. Folk ser hva som skjer.`, ['harsh']],
    punishDeath: ['dødsstraff', `${who} henrettes i morgen tidlig. Loven sier det.`, ['cruel']],
  };
  const [name, detail, tags] = t[law];
  return { id: 'law', label: `Døm etter loven: ${name}`, detail, tags };
}
/** Carry out the active punishment law on a counted adult or a named crew member. */
function applyLaw(s: RegionState, lines: ReportLine[], target: RegionSurvivor | undefined, name: string) {
  const law = punishLaw(s);
  if (law === 'punishLabour') {
    unrest(s, -2); hope(s, -1);
    if (target) loyalty(target, -10);
    lines.push({ tone: 'info', title: 'Straffearbeid', text: `${name} graver grøfter og bærer vann under vakt. Folk nikker. Ingen jubler.` });
  }
  if (law === 'punishExile') {
    hope(s, -3); unrest(s, -2);
    if (target) leaves(s, target, lines, 'Forvist etter loven.');
    else { removePeople(s, 'adults', 1); lines.push({ tone: 'bad', title: 'Forvist', text: `${name} gikk ut porten med en flaske vann. Ingen så etter.` }); }
  }
  if (law === 'punishStocks') {
    hope(s, -2); unrest(s, -3);
    if (target) loyalty(target, -25);
    lines.push({ tone: 'info', title: 'Gapestokken', text: `${name} sto i regnet fra morgen til kveld. Barna fikk ikke lov til å se, men de så.` });
  }
  if (law === 'punishDeath') {
    hope(s, -6); unrest(s, -5);
    if (target) killPerson(s, target, lines, 'Henrettet etter loven.');
    else { removePeople(s, 'adults', 1); lines.push({ tone: 'bad', title: 'Henrettet', text: `${name} ble henrettet ved muren i grålysningen. Det tok ett skudd.` }); }
  }
  remember(s, `${name} ble dømt etter loven (${law}).`);
}
/** The dead are handled by the law of the dead, if there is one. */
function funeral(s: RegionState, lines: ReportLine[], who: string) {
  if (hasLaw(s, 'buryDead')) { hope(s, 2); lines.push({ tone: 'info', title: 'En grav til', text: `${who} fikk en grav og et navn på et kors av lekter.` }); }
  else if (hasLaw(s, 'burnDead')) { give(s, 'fuel', -1); lines.push({ tone: 'info', title: 'Bålet', text: `${who} ble brent bak muren. Røyken la seg over leiren hele kvelden.` }); }
}

// ------------------------------------------------------------------ events

export const EVENTS_PEOPLE: EventDef[] = [
  // 1. Theft from the stores. The thief is someone you would have fed anyway.
  {
    id: 'storeTheft', weight: 3, phase: [2, 5],
    when: s => s.population.adults >= 5 && s.population.children >= 2 && amount(s, 'food') >= 30,
    make: (s, _w, rng) => {
      const n = Math.min(amount(s, 'food'), 8 + Math.floor(rng() * 10));
      return event('Lageret er lettere', `Om morgenen mangler ${n} mat fra lageret. Låsen er hel, og ingen har sett noe. Noen har nøkkel, eller noen har små nok hender til å komme gjennom luftelukene.${noLawNote(s)}`, [
        { id: 'search', label: 'Ransak alle soveplassene', detail: 'Alle blir mistenkt. Det blir dårlig stemning.', tags: ['harsh'] },
        { id: 'guard', label: 'Sett nattevakt på lageret', detail: 'En vakt mindre ved sperringen. Ingen blir anklaget.' },
        { id: 'collective', label: 'Kutt alles rasjon til tyven melder seg', detail: 'Alle betaler for én. Folk kommer til å snakke.', tags: ['harsh'] },
        { id: 'let', label: 'La det ligge', detail: 'Kanskje det var en gang. Kanskje ikke.' },
      ], { data: { n } });
    },
    resolve: (s, _w, c, rng) => {
      const n = num(s, 'n');
      give(s, 'food', -n);
      if (c === 'search') { unrest(s, 6); hope(s, -3); schedule(s, days(rng, 6, 11), 'storeTheftTruth', { n, how: 'search' }); }
      if (c === 'guard') { schedule(s, days(rng, 4, 8), 'storeTheftTruth', { n, how: 'guard' }); }
      if (c === 'collective') { unrest(s, 8); hope(s, -4); give(s, 'food', Math.round(n / 2)); schedule(s, days(rng, 3, 5), 'storeTheftTruth', { n, how: 'collective' }); }
      if (c === 'let') { unrest(s, 3); schedule(s, days(rng, 7, 12), 'storeTheftTruth', { n, how: 'let' }); }
    },
  },
  {
    id: 'storeTheftTruth', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const how = String(d?.how ?? 'let');
      const mother = rng() < .6;
      const name = mother ? pickOne(rng, WOMEN) : pickOne(rng, MEN);
      const kids = 2 + Math.floor(rng() * 3);
      const who = mother
        ? `${name}, som kom fra ${pickOne(rng, PLACES)} med ${kids} barn og ingen mann. Den minste har vært syk i to uker og spiser ikke det de andre spiser.`
        : `${name}, en bestefar på sytti med ${kids} barnebarn. Han har gitt dem sin egen rasjon i en måned og har begynt å ta litt ekstra for å holde seg på beina.`;
      const intro: Record<string, string> = {
        search: 'Ransakingen fant ingenting. Det var ikke under madrassene. Det var i magene til noen barn.',
        guard: 'Nattevakten tok tyven på fersk gjerning, med en pose havregryn under jakka.',
        collective: 'Etter tre dager med kuttede rasjoner meldte tyven seg selv. Det gikk ikke an å se på at andre betalte.',
        let: `Det har forsvunnet mer siden sist. I natt fulgte en av vaktene sporene i mjølet.`,
      };
      return event('Tyven', `${intro[how] ?? intro.let} Det var ${who}${noLawNote(s)}`, list(
        lawChoice(s, false, name),
        { id: 'forgive', label: 'Tilgi, og gi familien en ekstra porsjon', detail: '5 mat. Noen vil spørre hvorfor tyver får mer.', disabled: need(s, { food: 5 }), tags: ['merciful', 'charity'] },
        { id: 'work', label: 'La det jobbes inn igjen, uten oppstyr', detail: 'En mild dom. Ingen lov står bak den.' },
        { id: 'exile', label: 'Send hele familien ut porten', detail: 'En tyv er en tyv. Barna må følge med.', tags: ['cruel', 'children'] },
      ), { data: { n: Number(d?.n ?? 0), name, kids, mother: mother ? 1 : 0, how } });
    },
    resolve: (s, _w, c, _rng, lines) => {
      const name = str(s, 'name'), kids = num(s, 'kids');
      if (c === 'law') applyLaw(s, lines, undefined, name);
      if (c === 'forgive') { pay(s, { food: 5 }); hope(s, 4); unrest(s, 5); remember(s, `${name} stjal mat til barna sine, og dere ga familien mer.`); }
      if (c === 'work') { unrest(s, 2); improvised(s, 3); }
      if (c === 'exile') {
        removePeople(s, 'children', kids);
        if (num(s, 'mother')) removePeople(s, 'adults', 1); else if (!removePeople(s, 'elderly', 1)) removePeople(s, 'adults', 1);
        hope(s, -10); unrest(s, -2); improvised(s, 3);
        remember(s, `Dere sendte ${name} og ${kids} barn ut porten for et par poser mat.`);
        lines.push({ tone: 'bad', title: 'Porten lukkes', text: `Det minste barnet gråt ikke. Det var det verste, sier vaktene.` });
      }
      if (str(s, 'how') === 'collective' && c !== 'forgive') unrest(s, 3);
    },
  },

  // 2. A killing inside the camp.
  {
    id: 'campKilling', weight: 2, phase: [2, 5], when: s => s.population.adults >= 8,
    make: (s, _w, rng) => {
      const victim = pickOne(rng, MEN), killer = pickOne(rng, MEN.filter(n => n !== victim));
      const selfDefence = rng() < .5 ? 1 : 0;
      return event('Et drap i leiren', `${victim} ble funnet bak latrinene i morges. ${killer} har ikke prøvd å skjule noe. De kranglet om en soveplass nær ovnen. ${selfDefence ? 'To vitner sier at det var ' + victim + ' som slo først, og med en jernstang.' : 'Ingen så hvem som begynte. ' + killer + ' sier at han ble truet.'} ${victim} har en bror i leiren.${noLawNote(s)}`, list(
        lawChoice(s, true, killer),
        { id: 'acquit', label: 'Frikjenn ham. Det var selvforsvar.', detail: selfDefence ? 'Vitnene støtter det. Broren gjør ikke.' : 'Ingen kan bevise noe. Broren vil ikke godta det.', tags: ['merciful'] },
        !hasLaw(s, 'punishExile') && { id: 'exile', label: 'Send ham ut porten', detail: 'Ingen dom, bare et farvel. Han kjenner leiren godt.', tags: ['harsh'] },
        !hasLaw(s, 'punishDeath') && { id: 'hang', label: 'Henrett ham uten lov', detail: 'Rask rettferdighet. Ingen lov står bak den.', tags: ['cruel'] },
      ), { data: { victim, killer, selfDefence } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const victim = str(s, 'victim'), killer = str(s, 'killer');
      removePeople(s, 'adults', 1);
      funeral(s, lines, victim);
      if (c === 'law') { applyLaw(s, lines, undefined, killer); if (hasLaw(s, 'punishLabour') || hasLaw(s, 'punishStocks')) schedule(s, days(rng, 7, 11), 'killingFeud', { victim, killer }); }
      if (c === 'acquit') { hope(s, num(s, 'selfDefence') ? 1 : -2); unrest(s, num(s, 'selfDefence') ? 2 : 6); schedule(s, days(rng, 6, 10), 'killingFeud', { victim, killer }); }
      if (c === 'exile') { removePeople(s, 'adults', 1); hope(s, -2); improvised(s); schedule(s, days(rng, 10, 16), 'killingReturn', { killer }); }
      if (c === 'hang') {
        removePeople(s, 'adults', 1); hope(s, -10); unrest(s, 4); improvised(s, 6);
        setFlag(s, 'lynching', s.day);
        remember(s, `Dere henret ${killer} uten lov og dom, dagen etter drapet på ${victim}.`);
        lines.push({ tone: 'bad', title: 'Ved muren', text: 'Folk sto og så på. Etterpå gikk de hjem uten å si noe. Neste gang vet de hvordan det gjøres.' });
      }
    },
  },
  {
    id: 'killingFeud', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      if (s.population.adults < 2) return null;
      const victim = String(d?.victim ?? 'den døde'), killer = String(d?.killer ?? 'drapsmannen');
      return event('Broren', `Broren til ${victim} har ikke sagt et ord på ei uke. I kveld sto han utenfor teltet til ${killer} med en kniv i lomma. Vakten stoppet ham, denne gangen. «Dere ga meg ingen rettferdighet. Da tar jeg den selv.»`, list(
        { id: 'talk', label: 'Snakk med ham, og gi ham en plass langt fra ' + killer, detail: 'Ord og avstand. Det holder kanskje.', tags: ['merciful'] },
        { id: 'exile', label: 'Send broren ut', detail: 'En trussel er en trussel.', tags: ['harsh'] },
        { id: 'let', label: 'La dem gjøre det opp seg imellom', detail: 'Det er ikke lederens sak.', tags: ['reckless'] },
      ), { data: { victim, killer } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const killer = str(s, 'killer');
      if (c === 'talk') { if (rng() < .65) { hope(s, 2); unrest(s, -2); } else { removePeople(s, 'adults', 1); unrest(s, 6); lines.push({ tone: 'bad', title: 'Det holdt ikke', text: `Tre netter senere ble ${killer} funnet ved gjerdet. Broren var borte.` }); removePeople(s, 'adults', 1); } }
      if (c === 'exile') { removePeople(s, 'adults', 1); hope(s, -3); unrest(s, 2); improvised(s); }
      if (c === 'let') {
        removePeople(s, 'adults', 2); unrest(s, 10); hope(s, -6);
        remember(s, 'Et drap ble til to. Lederen så en annen vei.');
        lines.push({ tone: 'bad', title: 'To til', text: `${killer} er død. Broren ble skadet i slagsmålet og døde av infeksjonen.` });
      }
    },
  },
  {
    id: 'killingReturn', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const killer = String(d?.killer ?? 'Han');
      return event('Han er tilbake', `${killer} står ved sperringen. Han er tynn og har en sekk med 15 mat han har funnet i en hytte. «Jeg vet hva jeg gjorde. Jeg ber ikke om tilgivelse. Jeg ber om å få jobbe.»`, [
        { id: 'admit', label: 'Slipp ham inn', detail: 'En arbeider og en sekk mat. Noen vil reagere.', tags: ['merciful'] },
        { id: 'take', label: 'Ta maten og send ham bort', detail: 'Dere trenger maten mer enn ham.', tags: ['cruel', 'betrayal'] },
        { id: 'refuse', label: 'Avvis ham', detail: 'Det som ble sagt, står.' },
      ], { data: { killer } });
    },
    resolve: (s, _w, c) => {
      if (c === 'admit') { addPeople(s, { adults: 1 }); give(s, 'food', 15); unrest(s, 6); hope(s, 1); }
      if (c === 'take') { give(s, 'food', 15); hope(s, -4); }
      if (c === 'refuse') hope(s, -1);
    },
  },

  // 3. An accusation of overgrep against a popular guard.
  {
    id: 'guardAccusation', weight: 2, phase: [2, 5], when: s => s.population.adults >= 8,
    make: (s, _w, rng) => {
      const guard = pickOne(rng, MEN);
      return event('En anklage mot vakten', `En kvinne som kom inn i forrige måned, ber om å få snakke med deg alene. Hun sier at ${guard} begikk overgrep mot henne i vaktbua for fire netter siden. ${guard} benekter alt. Han sier hun lyver fordi han nektet henne ekstra rasjon. Ingen andre var der. ${guard} har stått i porten hver natt siden første uke, og folk stoler på ham.${noLawNote(s)}`, list(
        { id: 'investigate', label: `Ta ${guard} av vakt mens det undersøkes`, detail: 'Porten blir svakere en stund. Vaktene liker det ikke.' },
        lawChoice(s, true, guard),
        !punishLaw(s) && { id: 'believe', label: 'Tro henne. Send ham ut.', detail: 'Uten lov og uten bevis. Vaktene vil reagere.', tags: ['harsh'] },
        { id: 'move', label: 'Flytt henne til en annen brakke', detail: 'Ingen dom, bare avstand. Hun får ikke svar.' },
        { id: 'dismiss', label: 'Ord mot ord. Han blir i porten.', detail: 'Orden først. Hun må leve med det.', tags: ['harsh'] },
      ), { data: { guard } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const guard = str(s, 'guard');
      if (c === 'investigate') { unrest(s, 4); schedule(s, days(rng, 3, 5), 'guardAccusationTruth', { guard }); lines.push({ tone: 'warn', title: 'Porten er tynnere', text: `Vaktene tar ${guard} sine skift uten å si noe. De ser på deg på en ny måte.` }); }
      if (c === 'law') { applyLaw(s, lines, undefined, guard); unrest(s, 6); hope(s, 3); setFlag(s, 'accusation', 'believed'); }
      if (c === 'believe') { removePeople(s, 'adults', 1); unrest(s, 9); hope(s, 3); improvised(s); setFlag(s, 'accusation', 'believed'); remember(s, `Dere trodde kvinnen og sendte vakten ${guard} ut porten.`); }
      if (c === 'move') { hope(s, -3); schedule(s, days(rng, 12, 18), 'guardAccusationAgain', { guard, chance: .5 }); }
      if (c === 'dismiss') { hope(s, -6); unrest(s, -2); setFlag(s, 'accusation', 'dismissed'); schedule(s, days(rng, 8, 14), 'guardAccusationAgain', { guard, chance: .8 }); }
    },
  },
  {
    id: 'guardAccusationTruth', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const guard = String(d?.guard ?? 'vakten');
      const more = rng() < .55 ? 1 : 0;
      const text = more
        ? `Etter at ${guard} ble tatt av vakt, kom en annen kvinne til deg. Det var i sommer, sier hun. Hun turte ikke si noe mens han sto i porten. Nå er det to som forteller det samme.`
        : `Dere har spurt alle dere kunne. Ingen så noe, ingen hørte noe. ${guard} sier han er uskyldig og vil tilbake i porten. Kvinnen står ved det hun sa.`;
      return event('Undersøkelsen', text + noLawNote(s), list(
        lawChoice(s, true, guard),
        !punishLaw(s) && { id: 'exile', label: `Send ${guard} ut porten`, detail: more ? 'To stemmer veier tyngre enn én.' : 'Uten bevis. Ikke alle vil godta det.', tags: ['harsh'] },
        { id: 'away', label: `${guard} kommer aldri tilbake i porten`, detail: 'Han blir, men uten makt. Ingen er helt fornøyd.' },
        !more && { id: 'reinstate', label: `Sett ${guard} tilbake i porten`, detail: 'Vaktene får ham tilbake. Hun får ingenting.', tags: ['harsh'] },
      ), { data: { guard, more } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const guard = str(s, 'guard'), more = num(s, 'more');
      if (c === 'law') { applyLaw(s, lines, undefined, guard); unrest(s, more ? 2 : 6); hope(s, more ? 5 : 1); }
      if (c === 'exile') { removePeople(s, 'adults', 1); unrest(s, more ? 3 : 8); hope(s, more ? 4 : 0); improvised(s); }
      if (c === 'away') { unrest(s, 3); hope(s, more ? -2 : 1); }
      if (c === 'reinstate') { unrest(s, -3); hope(s, -5); schedule(s, days(rng, 10, 16), 'guardAccusationAgain', { guard, chance: .6 }); }
      remember(s, `Saken mot vakten ${guard} ble avgjort.`);
    },
  },
  {
    id: 'guardAccusationAgain', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      if (rng() > Number(d?.chance ?? .5) || s.population.adults < 2) return null;
      const guard = String(d?.guard ?? 'vakten');
      return event('Det samme navnet', `En ung kvinne som sover i brakka ved porten, har fortalt søsteren sin om ${guard}. Det er det samme navnet som forrige gang. Kvinnen som kom til deg først, har pakket og gått. Hun la igjen en lapp: «Jeg sa det til deg.»${noLawNote(s)}`, list(
        lawChoice(s, true, guard),
        !punishLaw(s) && { id: 'exile', label: `Send ${guard} ut nå`, detail: 'For sent for én av dem.', tags: ['harsh'] },
        { id: 'protect', label: 'Hold ham borte fra folk og vent', detail: 'Du har tatt feil før. Alle vet det.', tags: ['betrayal'] },
      ), { data: { guard } });
    },
    resolve: (s, _w, c, _rng, lines) => {
      const guard = str(s, 'guard');
      removePeople(s, 'adults', 1);
      hope(s, -6); unrest(s, 6);
      remember(s, `Dere trodde ikke den første som anklaget ${guard}. Så kom det en til.`);
      if (c === 'law') applyLaw(s, lines, undefined, guard);
      if (c === 'exile') { removePeople(s, 'adults', 1); improvised(s); }
      if (c === 'protect') { hope(s, -6); unrest(s, 8); lines.push({ tone: 'bad', title: 'Mødrene snakker', text: 'Folk holder hverandre inne om kvelden. De stoler ikke på porten, og de stoler ikke på deg.' }); }
    },
  },

  // 4. A bitten child, and a parent who will not let go.
  {
    id: 'bittenChild', weight: 2, phase: [1, 5], when: s => s.population.children >= 1 && s.population.adults >= 1,
    make: (s, _w, rng) => {
      const arm = rng() < .6 ? 1 : 0;
      const parent = rng() < .5 ? 'faren' : 'moren';
      const lawText = hasLaw(s, 'bittenMercy') ? ' Loven sier at bitte skal avlives straks.' : hasLaw(s, 'bittenQuarantine') ? ' Loven sier karantene under vakt.' : '';
      return event('Barnet er bitt', `En gutt på seks lekte for nær gjerdet. Bittet er ${arm ? 'på underarmen' : 'i skulderen'}. Nå sitter ${parent} med ham i redskapsboden og holder døra igjen. «Ingen tar ham. Han har bare feber.»${lawText}`, list(
        arm && hasTech(s, 'fieldSurgery') && { id: 'amputate', label: 'Amputer armen', detail: '5 medisin. Feltkirurgi gir ham en sjanse.', disabled: need(s, { medicine: 5 }), tags: ['merciful'] },
        hasLaw(s, 'bittenMercy') && { id: 'mercy', label: 'Følg loven: barmhjertig avliving', detail: 'Det skal gjøres skånsomt. Forelderen må holdes unna.', tags: ['cruel', 'children'] },
        hasLaw(s, 'bittenQuarantine') && { id: 'quarantine', label: 'Følg loven: karantene under vakt', detail: 'Barnet alene bak låst dør i to døgn. Forelderen utenfor.', tags: ['harsh'] },
        !hasLaw(s, 'bittenMercy') && { id: 'force', label: 'Ta barnet fra forelderen', detail: 'Det må gjøres før det er for sent. Ingen glemmer hvordan.', tags: ['cruel', 'children'] },
        { id: 'stay', label: 'La forelderen bli hos barnet', detail: hasLaw(s, 'bittenMercy') ? 'Låst bod og vakt utenfor. Du bryter din egen lov.' : 'Låst bod og vakt utenfor. Det kan gå galt.', tags: ['merciful', 'reckless'] },
      ), { data: { arm, parent } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const parent = str(s, 'parent');
      if (c === 'amputate') {
        pay(s, { medicine: 5 });
        if (rng() < .65) { hope(s, 6); lines.push({ tone: 'good', title: 'Han lever', text: 'Feberen slapp på tredje dag. Han spør etter armen sin, og ingen vet hva de skal svare.' }); remember(s, 'Et bitt barn ble reddet med amputasjon.'); }
        else { removePeople(s, 'children', 1); hope(s, -6); lines.push({ tone: 'bad', title: 'For sent', text: 'Smitten var allerede i blodet. Dere gjorde det dere kunne.' }); funeral(s, lines, 'Gutten'); }
      }
      if (c === 'mercy') { removePeople(s, 'children', 1); hope(s, -6); unrest(s, -1); funeral(s, lines, 'Gutten'); schedule(s, days(rng, 6, 10), 'bittenChildParent', { parent }); }
      if (c === 'quarantine') {
        if (rng() < .15) { hope(s, 8); lines.push({ tone: 'good', title: 'Det var ikke gjennom', text: 'Bittet hadde ikke gått gjennom jakka. Etter to døgn åpnet vakten døra til en sulten gutt.' }); }
        else { removePeople(s, 'children', 1); hope(s, -5); unrest(s, 2); funeral(s, lines, 'Gutten'); schedule(s, days(rng, 8, 12), 'bittenChildParent', { parent }); }
      }
      if (c === 'force') { removePeople(s, 'children', 1); hope(s, -8); unrest(s, 5); funeral(s, lines, 'Gutten'); schedule(s, days(rng, 6, 10), 'bittenChildParent', { parent }); remember(s, `Dere tok et bitt barn fra ${parent} med makt.`); }
      if (c === 'stay') { if (hasLaw(s, 'bittenMercy')) unrest(s, 5); schedule(s, 2, 'bittenChildNight', { parent }); }
    },
  },
  {
    id: 'bittenChildNight', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const parent = String(d?.parent ?? 'forelderen');
      const bitten = rng() < .7 ? 1 : 0;
      return event('Boden', bitten
        ? `Om morgenen er det stille i boden. Gutten har vendt. ${parent[0].toUpperCase() + parent.slice(1)} holdt ham til det siste, og har et bitt i hånda. Døra er fortsatt låst innenfra.`
        : `Gutten vendte i natt. ${parent[0].toUpperCase() + parent.slice(1)} kom seg ut og låste døra etter seg, og sitter nå på trappa uten å si noe.`, list(
        bitten && hasTech(s, 'fieldSurgery') && { id: 'amputate', label: `Amputer hånda til ${parent}`, detail: '5 medisin. Kanskje i tide.', disabled: need(s, { medicine: 5 }), tags: ['merciful'] },
        { id: 'end', label: 'Gjør det som må gjøres', detail: bitten ? 'Både barnet og den voksne.' : 'Det som er i boden, skal ikke ut.', tags: bitten ? ['harsh'] : [] },
        bitten && { id: 'gate', label: 'La forelderen gå ut porten selv', detail: 'Et siste valg. Det vil være noe der ute etterpå.', tags: ['merciful', 'reckless'] },
      ), { data: { parent, bitten } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const bitten = num(s, 'bitten');
      removePeople(s, 'children', 1);
      hope(s, -6);
      if (c === 'amputate') { pay(s, { medicine: 5 }); if (rng() < .6) { hope(s, 2); lines.push({ tone: 'info', title: 'Forelderen lever', text: 'Med én hånd og uten barn.' }); } else { removePeople(s, 'adults', 1); hope(s, -3); } }
      if (c === 'end') { if (bitten) removePeople(s, 'adults', 1); hope(s, -2); lines.push({ tone: 'bad', title: 'Boden er tom', text: 'Ingen bruker den lenger. Noen har spikret døra igjen.' }); }
      if (c === 'gate') { removePeople(s, 'adults', 1); s.zones[s.homeZoneId].zombies += 1; lines.push({ tone: 'warn', title: 'Utenfor porten', text: 'To dager senere står det en skikkelse ved sperringa om natta. Vaktene vet hvem det var.' }); }
      remember(s, 'Et barn vendte i redskapsboden. Forelderen fikk bli hos ham.');
    },
  },
  {
    id: 'bittenChildParent', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      if (s.population.adults < 1) return null;
      const parent = String(d?.parent ?? 'forelderen');
      return event('Den som ble igjen', `${parent[0].toUpperCase() + parent.slice(1)} til gutten som ble bitt, har ikke jobbet siden. I dag sto ${parent} ved porten med en sekk og sa at det ikke er noe her lenger.`, list(
        { id: 'go', label: 'La dem gå', detail: 'Det er deres valg. Ingen holdes her med makt.' },
        { id: 'children', label: 'Gi dem ansvar for de minste barna', detail: 'Noe å stå opp for. Det kan gå begge veier.', tags: ['merciful'] },
        { id: 'hold', label: 'Hold dem inne under oppsyn', detail: 'Du mister ikke en arbeider til.', tags: ['harsh'] },
      ), { data: { parent } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'go') { removePeople(s, 'adults', 1); hope(s, -3); }
      if (c === 'children') { if (rng() < .6) { hope(s, 4); lines.push({ tone: 'good', title: 'Barnehagen i gymsalen', text: 'De minste har fått en voksen som synger for dem om kvelden. Sangen er trist, men barna sover.' }); } else { removePeople(s, 'adults', 1); hope(s, -4); lines.push({ tone: 'bad', title: 'En morgen var sengen tom', text: 'Sekken var borte, og porten sto på gløtt.' }); } }
      if (c === 'hold') { unrest(s, 5); hope(s, -2); }
    },
  },

  // 5. A family hiding infected relatives at a farm you take over.
  {
    id: 'farmBarn', weight: 2, phase: [2, 5], when: (s, w) => farmOwned(s, w).length > 0 && !flag(s, 'farmBarnDone'),
    make: (s, w, rng) => {
      const zone = pickOne(rng, farmOwned(s, w));
      const n = 1 + Math.floor(rng() * 3);
      return event('Låven', `Familien på gården i ${zoneName(w, zone)} har klart seg alene siden starten: to voksne, et barn og en bestemor. Nå er jorda deres. Om natta hører vaktene noe i låven. Familien sier det er sauene. Det er ikke sauene. Det er ${n === 1 ? 'sønnen' : n === 2 ? 'sønnen og kona hans' : 'sønnen, kona og bestefaren'}, lenket fast i båsene.`, list(
        { id: 'end', label: 'Avliv dem nå', detail: 'Familien får se på. De blir, men de glemmer ikke.', tags: ['harsh'] },
        { id: 'family', label: 'La familien gjøre det selv, og begrave dem', detail: 'Det tar en dag. Det må gjøres riktig.', tags: ['merciful', 'faith'] },
        { id: 'keep', label: 'La låven stå låst', detail: 'Familien stoler på dere. Lenker holder ikke evig.', tags: ['merciful', 'reckless'] },
        hasTech(s, 'zombieStudy') && { id: 'study', label: 'Ta dem med til studier', detail: 'Levende prøver er verdt mye. Familien vil hate dere.', tags: ['cruel'] },
        { id: 'evict', label: 'Kast ut familien og brenn låven', detail: 'Gården er deres nå. Ingen risiko.', tags: ['cruel', 'children'] },
      ), { zoneId: zone, data: { zone, n } });
    },
    resolve: (s, w, c, rng, lines) => {
      const zone = str(s, 'zone'), n = num(s, 'n');
      setFlag(s, 'farmBarnDone', s.day);
      if (c !== 'evict') addPeople(s, { adults: 2, children: 1, elderly: 1 });
      if (c === 'end') { hope(s, -2); unrest(s, 3); setFlag(s, 'farmFamily', 'bitter'); }
      if (c === 'family') { hope(s, 2); for (const p of crewHere(s)) p.fatigue = Math.min(100, p.fatigue + 5); }
      if (c === 'keep') { hope(s, 2); schedule(s, days(rng, 5, 12), 'farmBarnBreak', { zone, n }); }
      if (c === 'study') { give(s, 'samples', n); unrest(s, 6); hope(s, -3); setFlag(s, 'farmFamily', 'bitter'); remember(s, `Dere tok familiens døde fra låven i ${zoneName(w, zone)} til forsøk.`); }
      if (c === 'evict') { give(s, 'fuel', -2); hope(s, -6); remember(s, `Dere kastet en familie ut fra gården i ${zoneName(w, zone)}.`); lines.push({ tone: 'bad', title: 'Låven brenner', text: 'Bestemoren snudde seg ikke. Barnet gjorde det hele veien ned bakken.' }); }
    },
  },
  {
    id: 'farmBarnBreak', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, rng, d) => {
      const zone = String(d?.zone ?? s.homeZoneId), n = Number(d?.n ?? 1) + Math.floor(rng() * 3);
      if (!s.zones[zone]) return null;
      return event('Låvedøra står åpen', `En lenke var rustet gjennom. I natt kom de ut av låven i ${zoneName(w, zone)}, og flere har fulgt lyden. Bestemoren var i fjøset da det skjedde.`, list(
        { id: 'clear', label: 'Send crewet inn nå', detail: 'Ryddes før det sprer seg. Noen kan bli skadet.', tags: ['reckless'] },
        { id: 'board', label: 'Barrikader gårdstunet', detail: '6 byggemateriale. De blir der inne en stund.', disabled: need(s, { building: 6 }) },
        { id: 'wait', label: 'Trekk folk tilbake og vent', detail: 'Jorda står uten folk. Det som er der, blir der.' },
      ), { zoneId: zone, data: { zone, n } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const zone = str(s, 'zone'), n = num(s, 'n');
      removePeople(s, 'elderly', 1);
      hope(s, -4);
      if (c === 'clear') { const p = pickCrew(s, rng); if (p && rng() < .45) hurtPerson(s, p, 20, lines, 'En av dem kom ut av høyloftet bak ryggen.'); }
      if (c === 'board') { pay(s, { building: 6 }); s.zones[zone].zombies += Math.ceil(n / 2); }
      if (c === 'wait') { s.zones[zone].zombies += n; unrest(s, 3); }
      remember(s, 'Låven på gården holdt ikke.');
    },
  },

  // 6. A hoarder with a private stash.
  {
    id: 'hoarder', weight: 2, phase: [2, 5], when: s => s.population.elderly >= 1 && s.population.adults >= 5,
    make: (s, _w, rng) => {
      const name = pickOne(rng, MEN);
      const food = 20 + Math.floor(rng() * 20), medicine = 3 + Math.floor(rng() * 5);
      return event('Under gulvplankene', `${name} er syttifire og drev en kolonial på ${pickOne(rng, PLACES)} i førti år. Han har sovet på samme madrass siden han kom. Under den, og under gulvet, har han ${food} mat og ${medicine} medisin. «Jeg handlet da dere andre sto i kø for å kjøpe pizza. Det er mitt.»${noLawNote(s)}`, list(
        { id: 'take', label: 'Beslaglegg alt', detail: 'Alt går til fellesskapet. Han blir ydmyket.', tags: ['harsh'] },
        lawChoice(s, false, name),
        { id: 'share', label: 'Halvparten til fellesskapet, resten er hans', detail: 'En avtale. Han beholder nok til å handle med.' },
        { id: 'leave', label: 'La ham beholde det', detail: 'Det var hans før alt dette. Andre vil merke seg det.', tags: ['merciful'] },
      ), { data: { name, food, medicine } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name'), food = num(s, 'food'), medicine = num(s, 'medicine');
      if (c === 'take') { give(s, 'food', food); give(s, 'medicine', medicine); unrest(s, -2); hope(s, -2); remember(s, `Dere tok lageret til ${name}.`); }
      if (c === 'law') { give(s, 'food', food); give(s, 'medicine', medicine); applyLaw(s, lines, undefined, name); }
      if (c === 'share') { give(s, 'food', Math.round(food / 2)); give(s, 'medicine', Math.round(medicine / 2)); unrest(s, 2); schedule(s, days(rng, 6, 10), 'hoarderTrade', { name }); }
      if (c === 'leave') { unrest(s, 5); schedule(s, days(rng, 5, 9), 'hoarderTrade', { name }); }
    },
  },
  {
    id: 'hoarderTrade', weight: 1, chainOnly: true, when: () => true,
    make: (_s, _w, _rng, d) => {
      const name = String(d?.name ?? 'Den gamle');
      return event('Kø utenfor brakka', `Om kvelden står folk i kø hos ${name}. Han bytter medisin mot rasjoner, tobakk og tjenester. Han tar godt betalt, men han ga også smertestillende til en gutt med brukket arm uten å ta en krone. Folk har begynt å kalle ham Rema.`, [
        { id: 'stop', label: 'Stopp handelen og ta resten', detail: 'Ingen markeder utenfor fellesskapet.', tags: ['harsh'] },
        { id: 'allow', label: 'La byttehandelen gå', detail: 'Folk får det de trenger. De rike blir rikere.' },
        { id: 'hire', label: 'Gjør ham til lagersjef', detail: 'Han kan dette bedre enn noen. Kanskje for godt.' },
      ], { data: { name } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name');
      if (c === 'stop') { give(s, 'food', 8); give(s, 'medicine', 2); unrest(s, 4); hope(s, -2); }
      if (c === 'allow') { hope(s, 3); unrest(s, 4); setFlag(s, 'blackMarket', s.day); }
      if (c === 'hire') {
        if (rng() < .7) { give(s, 'food', 10); unrest(s, -3); lines.push({ tone: 'good', title: 'Orden i hyllene', text: `${name} teller alt to ganger og vet hva som går ut på dato. Svinnet går ned.` }); }
        else { give(s, 'food', -12); unrest(s, 5); lines.push({ tone: 'bad', title: 'Gamle vaner', text: `Det mangler varer. ${name} sier det er rotter. Rottene har pene håndskrift.` }); }
      }
    },
  },

  // 7. Insulin for a diabetic child, and no cold chain.
  {
    id: 'insulin', weight: 2, once: true, phase: [2, 5], when: s => s.population.children >= 2,
    make: (s, _w, rng) => {
      const place = pickOne(rng, PLACES);
      const trade = knownFactions(s).find(f => !f.hostile);
      return event('Insulin', `En jente på ni har diabetes type 1. Moren har holdt insulinet kaldt i bekken bak leiren. Det er tre penner igjen, og bekken er ikke kald nok lenger. Uten insulin har hun en uke, kanskje to.`, list(
        { id: 'raid', label: `Send to fra crewet til apoteket på ${place}`, detail: 'En dag ute. Det kan være tomt, og det er ikke trygt.', tags: ['reckless'] },
        (hasTech(s, 'generators') || hasModule(s, 'power')) && { id: 'fridge', label: 'Kjør et kjøleskap på aggregatet', detail: '8 drivstoff. Det som er igjen, holder lenger.', disabled: need(s, { fuel: 8 }) },
        trade && { id: 'trade', label: `Bytt medisin mot insulin hos ${trade.name}`, detail: '6 medisin. De har kanskje noe.', disabled: need(s, { medicine: 6 }) },
        { id: 'nothing', label: 'Det finnes ikke mer', detail: 'Dere kan ikke sende folk ut for én.', tags: ['children'] },
      ), { data: { place, faction: trade?.id ?? '' } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'raid') {
        const a = pickCrew(s, rng), b = pickCrew(s, rng, p => p !== a);
        for (const p of [a, b]) if (p && rng() < .3) hurtPerson(s, p, 20, lines, `Apoteket på ${str(s, 'place')} var ikke tomt.`);
        if (rng() < .65) { hope(s, 5); lines.push({ tone: 'good', title: 'Insulin', text: 'Fire esker, varme, men brukbare en stund til.' }); schedule(s, days(rng, 18, 25), 'insulinAgain', {}); }
        else { hope(s, -2); lines.push({ tone: 'bad', title: 'Hyllene var tomme', text: 'Noen hadde vært der før dem.' }); schedule(s, days(rng, 5, 8), 'insulinAgain', {}); }
      }
      if (c === 'fridge') { pay(s, { fuel: 8 }); hope(s, 2); schedule(s, days(rng, 10, 14), 'insulinAgain', {}); }
      if (c === 'trade') {
        pay(s, { medicine: 6 });
        const f = s.factions.find(x => x.id === str(s, 'faction'));
        if (f) f.relation += 5;
        hope(s, 4); schedule(s, days(rng, 20, 28), 'insulinAgain', {});
      }
      if (c === 'nothing') { hope(s, -3); schedule(s, days(rng, 6, 9), 'insulinEnd', {}); }
    },
  },
  {
    id: 'insulinAgain', weight: 1, chainOnly: true, when: () => true,
    make: s => {
      if (s.population.children < 1) return null;
      const hospital = s.factions.find(f => f.id === 'hospital' && f.known && !f.hostile && !f.defeated);
      return event('Igjen', 'Insulinet er nesten brukt opp igjen. Moren har talt pennene hver kveld. Hun vet hva tallene betyr, og nå vet du det også.', list(
        hasTech(s, 'coldStore') && { id: 'cold', label: 'Kjølelageret: lag et fast sted for insulin', detail: 'Med kjøling holder et funn lenge. 4 medisin.', disabled: need(s, { medicine: 4 }) },
        { id: 'raid', label: 'Send et lag til igjen', detail: 'Lenger ut denne gangen. Mer risiko.', tags: ['reckless'] },
        hospital && { id: 'hospital', label: `La mor og datter gå til ${hospital.name}`, detail: 'De har kjøling der. Dere ser dem kanskje ikke igjen.', tags: ['merciful'] },
        { id: 'nothing', label: 'Det får være nok', detail: 'Hver tur koster. Moren vil forstå. Eller ikke.', tags: ['children'] },
      ), { data: { hospital: hospital?.id ?? '' } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (c === 'cold') { pay(s, { medicine: 4 }); hope(s, 5); setFlag(s, 'insulinSolved', s.day); remember(s, 'Dere fant en måte å holde insulinet kaldt på for godt.'); }
      if (c === 'raid') {
        const p = pickCrew(s, rng);
        if (p && rng() < .45) hurtPerson(s, p, 30, lines, 'Turen gikk gjennom et område ingen hadde ryddet.');
        if (rng() < .5) { hope(s, 3); schedule(s, days(rng, 18, 25), 'insulinAgain', {}); } else schedule(s, days(rng, 5, 8), 'insulinEnd', {});
      }
      if (c === 'hospital') { removePeople(s, 'children', 1); removePeople(s, 'adults', 1); hope(s, 1); lines.push({ tone: 'info', title: 'Avskjed ved porten', text: 'Jenta vinket hele veien til svingen.' }); }
      if (c === 'nothing') { hope(s, -3); schedule(s, days(rng, 5, 8), 'insulinEnd', {}); }
    },
  },
  {
    id: 'insulinEnd', weight: 1, chainOnly: true, when: () => true,
    make: s => {
      if (s.population.children < 1) return null;
      return event('Jenta', 'Jenta sovnet i går kveld og våknet ikke. Moren sitter fortsatt ved sengen. Hun har ikke sagt et vondt ord til noen, og det er nesten verre.', list(
        { id: 'memorial', label: 'Hold en minnestund for hele leiren', detail: '5 mat til et måltid etterpå.', disabled: need(s, { food: 5 }), tags: ['faith'] },
        { id: 'quiet', label: 'La familien sørge i fred', detail: 'Arbeidet går videre.' },
      ));
    },
    resolve: (s, _w, c, _rng, lines) => {
      removePeople(s, 'children', 1);
      hope(s, -6);
      funeral(s, lines, 'Jenta');
      if (c === 'memorial') { pay(s, { food: 5 }); hope(s, 4); unrest(s, -3); }
      remember(s, 'En jente med diabetes døde da insulinet tok slutt.');
    },
  },

  // 8. A preacher gains followers. It can grow into a cult and a split.
  {
    id: 'preacher', weight: 2, once: true, phase: [2, 5], when: s => s.population.adults >= 10,
    make: (s, _w, rng) => {
      const name = pickOne(rng, MEN);
      return event('Predikanten', `${name} var kateket på ${pickOne(rng, PLACES)} før alt dette. Nå samler han folk ved bålet hver kveld. Han kaller de døde «de hjemsøkte» og sier at det finnes en vei gjennom dette for dem som tror. Førti stoler er for få. Folk står i regnet for å høre.${hasLaw(s, 'faithRule') ? ' Menigheten har allerede en prest. Den har ikke en profet.' : ''}`, [
        { id: 'support', label: 'Gi ham et telt og din velsignelse', detail: 'Folk trenger noe å tro på. Han trenger kanskje mer.', tags: ['faith'] },
        { id: 'ignore', label: 'La ham holde på', detail: 'Ord er gratis. Foreløpig.' },
        { id: 'forbid', label: 'Forby møtene', detail: 'Ingen samlinger uten tillatelse. Troende vil ikke like det.', tags: ['harsh'] },
      ], { data: { name } });
    },
    resolve: (s, _w, c, rng) => {
      const name = str(s, 'name');
      if (c === 'support') { hope(s, 6); unrest(s, -3); schedule(s, days(rng, 9, 13), 'preacherFlock', { name, mode: 'support' }); }
      if (c === 'ignore') { hope(s, 2); schedule(s, days(rng, 10, 14), 'preacherFlock', { name, mode: 'ignore' }); }
      if (c === 'forbid') { unrest(s, 6); hope(s, -2); schedule(s, days(rng, 8, 12), 'preacherSplit', { name, mode: 'underground' }); }
    },
  },
  {
    id: 'preacherFlock', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const name = String(d?.name ?? 'Predikanten');
      const k = Math.max(3, Math.round(s.population.adults * .25));
      return event('Flokken', `${name} har nå ${k} faste følgere. De bærer et hvitt bånd rundt armen. I dag kom han med krav: en tiendedel av maten til «de trofaste», og at bitte skal føres til ham for bønn i stedet for ${hasLaw(s, 'bittenMercy') ? 'til avliving' : 'til karantene'}.${hasLaw(s, 'burnDead') ? ' Og at likbrenningen skal stanse.' : ''}`, list(
        { id: 'seat', label: 'Gi ham en plass ved bordet', detail: 'Han får makt. Du får ro, en stund.', tags: ['faith'] },
        { id: 'tithe', label: 'Gi tienden, men ikke de bitte', detail: '10 mat. Ingen makt, bare brød.', disabled: need(s, { food: 10 }), tags: ['faith'] },
        { id: 'refuse', label: 'Nekt alt', detail: 'Leiren har én ledelse. Følgerne vil reagere.', tags: ['harsh'] },
        { id: 'exile', label: 'Send ham ut porten', detail: 'Han går ikke alene.', tags: ['cruel'] },
      ), { data: { name, k } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name'), k = num(s, 'k');
      if (c === 'seat') { hope(s, 5); unrest(s, -4); setFlag(s, 'cult', s.day); schedule(s, days(rng, 10, 14), 'preacherSplit', { name, mode: 'power', k }); }
      if (c === 'tithe') { pay(s, { food: 10 }); hope(s, 2); schedule(s, days(rng, 12, 16), 'preacherSplit', { name, mode: 'tithe', k }); }
      if (c === 'refuse') { unrest(s, 7); schedule(s, days(rng, 7, 10), 'preacherSplit', { name, mode: 'underground', k }); }
      if (c === 'exile') {
        const go = Math.round(k / 2);
        removePeople(s, 'adults', 1 + go); removePeople(s, 'children', Math.round(go / 2));
        hope(s, -6); unrest(s, 5);
        remember(s, `Dere forviste predikanten ${name}. ${go} fulgte ham.`);
        lines.push({ tone: 'bad', title: 'Hvite bånd i regnet', text: `${go} voksne gikk med ham, med barna sine. De sang mens de gikk.` });
      }
    },
  },
  {
    id: 'preacherSplit', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const name = String(d?.name ?? 'Predikanten'), mode = String(d?.mode ?? 'tithe');
      const k = Math.min(s.population.adults - 1, Number(d?.k ?? Math.max(3, Math.round(s.population.adults * .25))));
      if (k < 2) return null;
      if (mode === 'power') {
        return event('Bønn for de bitte', `${name} har gjemt en bitt mann i bedehusteltet i tre dager for å «be ham tilbake». I natt vendte han. To av de trofaste ble bitt før vaktene kom. ${name} sier det var deres tro som sviktet, ikke hans.`, list(
          { id: 'break', label: `Fjern ${name} fra all makt`, detail: 'Følgerne kommer til å velge mellom ham og dere.', tags: ['harsh'] },
          { id: 'exile', label: `Send ${name} og de som vil, ut`, detail: 'De tar sin del av lageret.' },
          { id: 'forgive', label: 'Dette skjer ikke igjen. Han blir.', detail: 'Troen holder leiren sammen. Prisen sto i teltet i natt.', tags: ['faith', 'reckless'] },
        ), { data: { name, k, mode } });
      }
      return event('Den nye menigheten', `${mode === 'underground' ? 'Møtene fortsatte i kjelleren. ' : ''}${name} har kunngjort at de trofaste skal bryte ut og grunnlegge en egen menighet på en gård utenfor grensen. ${k} voksne og barna deres vil følge ham. De vil ha sin del av lageret.`, list(
        { id: 'share', label: 'La dem gå med sin del', detail: 'Mat, vann og noe ammunisjon. Det blir stille her.', tags: ['merciful'] },
        { id: 'nothing', label: 'La dem gå uten noe', detail: 'Lageret er leirens. De som går, går tomhendte.', tags: ['harsh', 'children'] },
        { id: 'stop', label: `Arrester ${name}`, detail: 'Uten ham er det ingen menighet. Kanskje.', tags: ['cruel'] },
      ), { data: { name, k, mode } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name'), k = num(s, 'k'), mode = str(s, 'mode');
      if (mode === 'power') {
        removePeople(s, 'adults', 1); s.population.sick += 1; home(s).zombies += 1; hope(s, -5);
        if (c === 'break') { unrest(s, 8); schedule(s, days(rng, 6, 9), 'preacherSplit', { name, mode: 'underground', k }); }
        if (c === 'exile') { removePeople(s, 'adults', k); removePeople(s, 'children', Math.round(k / 2)); takeShare(s, 'food', .15); takeShare(s, 'water', .15); hope(s, -4); remember(s, `Predikanten ${name} og ${k} trofaste forlot leiren.`); }
        if (c === 'forgive') { hope(s, 2); unrest(s, 4); setFlag(s, 'cult', s.day); }
        return;
      }
      if (c === 'share' || c === 'nothing') {
        removePeople(s, 'adults', k); removePeople(s, 'children', Math.round(k / 2));
        if (c === 'share') { takeShare(s, 'food', .2); takeShare(s, 'water', .2); takeShare(s, 'ammo', .1); hope(s, -3); }
        else { hope(s, -6); unrest(s, 4); }
        setFlag(s, 'cultCamp', name);
        remember(s, `${name} grunnla sin egen menighet. ${k} voksne fulgte ham ut.`);
        lines.push({ tone: 'bad', title: 'Tomme senger', text: `${k} voksne og barna deres gikk i samlet tropp. Hvite bånd på armene, og salmer ingen her kjente.` });
      }
      if (c === 'stop') {
        unrest(s, 12); hope(s, -6);
        if (rng() < .4) { removePeople(s, 'adults', Math.round(k / 2)); lines.push({ tone: 'bad', title: 'De gikk likevel', text: 'Halvparten av følgerne forsvant om natta, uten ham.' }); }
        setFlag(s, 'preacherJailed', s.day);
        remember(s, `Dere arresterte predikanten ${name}.`);
      }
    },
  },

  // 9. A birth in the camp.
  {
    id: 'birth', weight: 2, phase: [2, 5], when: s => s.population.adults >= 6,
    make: (s, _w, rng) => {
      const medic = crewHere(s).reduce((m, p) => Math.max(m, p.skills.medical), 0);
      const name = pickOne(rng, WOMEN);
      return event('Fødselen', `${name} har hatt rier siden i natt, og det går ikke som det skal. ${medic >= 3 ? 'Dere har noen som har sett dette før.' : 'Ingen i leiren har gjort dette før, bortsett fra en pensjonert tannlege som sier at det er «omtrent det samme».'}`, [
        { id: 'medicine', label: 'Gi henne det beste dere har', detail: '4 medisin. Det øker sjansene.', disabled: need(s, { medicine: 4 }) },
        { id: 'none', label: 'Klar dere uten medisin', detail: 'Folk har født før det fantes apotek.', tags: ['reckless'] },
      ], { data: { name, medic } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name'), medic = num(s, 'medic');
      let risk = c === 'medicine' ? .08 : .25;
      if (medic >= 3) risk /= 2;
      if (c === 'medicine') pay(s, { medicine: 4 });
      const childLives = rng() > risk / 2, motherLives = rng() > risk;
      if (childLives) addPeople(s, { children: 1 });
      if (!motherLives) { removePeople(s, 'adults', 1); hope(s, -6); funeral(s, lines, name); lines.push({ tone: 'bad', title: `${name} døde`, text: childLives ? 'Barnet lever. Tre kvinner har allerede sagt at de skal ta seg av det.' : 'Ingen av dem klarte det.' }); }
      if (motherLives && childLives) { hope(s, 8); unrest(s, -3); lines.push({ tone: 'good', title: 'Et barn er født', text: 'Hele leiren hørte det første skriket. Noen klappet. Noen gråt.' }); schedule(s, days(rng, 2, 4), 'birthName', { name }); }
      if (motherLives && !childLives) { hope(s, -5); lines.push({ tone: 'bad', title: 'Barnet klarte seg ikke', text: `${name} lever. Hun har ikke spurt om noe.` }); }
    },
  },
  {
    id: 'birthName', weight: 1, chainOnly: true, good: true, when: () => true,
    make: (_s, _w, _rng, d) => {
      const name = String(d?.name ?? 'Moren');
      return event('Et navn', `${name} og barnet har det bra. Hun spør om lederen vil gi barnet et navn. Halve leiren har meninger, og de fleste av dem er fotballag.`, [
        { id: 'leader', label: 'Gi barnet ditt eget navn', detail: 'Et tegn på hvem som leder. Ikke alle vil like det.' },
        { id: 'hope', label: 'Kall henne Håp', detail: 'Litt mye, kanskje. Men folk trenger det.' },
        { id: 'parents', label: 'La moren velge', detail: 'Hun har allerede bestemt seg for Viking.' },
      ], { data: { name } });
    },
    resolve: (s, _w, c) => {
      if (c === 'leader') { hope(s, 2); unrest(s, 1); remember(s, 'Et barn i leiren fikk lederens navn.'); }
      if (c === 'hope') { hope(s, 5); remember(s, 'Et barn ble født i leiren og fikk navnet Håp.'); }
      if (c === 'parents') { hope(s, 3); unrest(s, -2); }
    },
  },

  // 10. A wedding feast that eats the stores.
  {
    id: 'wedding', weight: 2, phase: [2, 5], when: s => s.population.adults >= 8 && amount(s, 'food') >= 40,
    make: (s, _w, rng) => {
      const a = pickOne(rng, MEN), b = pickOne(rng, WOMEN);
      const rations = rationLaw(s);
      return event('Bryllup', `${a} og ${b} vil gifte seg. De ber ikke om mye: et måltid for alle, litt musikk og en kveld uten vakthold rundt bålet.${rations ? ' Leiren går på rasjoner. Det vet de.' : ''}`, [
        { id: 'feast', label: 'Gi dem et skikkelig gilde', detail: '25 mat og 2 drivstoff til grillen. Det blir snakket om lenge.', disabled: need(s, { food: 25, fuel: 2 }) },
        { id: 'modest', label: 'Et enkelt måltid', detail: '8 mat. Ingen fest, men ingen nei.', disabled: need(s, { food: 8 }) },
        { id: 'no', label: 'Ikke nå', detail: 'De kan gifte seg. Maten blir på lageret.', tags: ['harsh'] },
      ], { data: { a, b, rations: rations ? 1 : 0 } });
    },
    resolve: (s, _w, c, rng) => {
      const a = str(s, 'a'), b = str(s, 'b');
      if (c === 'feast') {
        pay(s, { food: 25, fuel: 2 }); hope(s, 10); unrest(s, -6);
        remember(s, `${a} og ${b} giftet seg, og hele leiren spiste seg mett.`);
        if (num(s, 'rations') || amount(s, 'food') < totalPeople(s) * 4) schedule(s, days(rng, 4, 6), 'weddingBill', { a, b });
      }
      if (c === 'modest') { pay(s, { food: 8 }); hope(s, 4); unrest(s, -2); }
      if (c === 'no') { hope(s, -4); }
    },
  },
  {
    id: 'weddingBill', weight: 1, chainOnly: true, when: () => true,
    make: s => event('Etter gildet', `Festen var fin. Nå er det ${rationLaw(s) ? 'rasjonene som snakker' : 'lageret som snakker'}. Noen har regnet ut hvor mange dager med mat som gikk opp i røyk over grillen, og tallet står skrevet med kritt på lagerdøra.`, list(
      { id: 'extra', label: 'Gi alle en ekstra rasjon', detail: '15 mat. Rettferdig, men dyrt.', disabled: need(s, { food: 15 }), tags: ['charity'] },
      { id: 'worth', label: 'Stå for det. Det var verdt det.', detail: 'Noen er enige. Mange er sultne.' },
      { id: 'scrub', label: 'Vask bort krittet og finn den som skrev', detail: 'Ro og orden.', tags: ['harsh'] },
    )),
    resolve: (s, _w, c) => {
      if (c === 'extra') { pay(s, { food: 15 }); unrest(s, -6); }
      if (c === 'worth') { hope(s, 2); unrest(s, 7); }
      if (c === 'scrub') { unrest(s, 9); hope(s, -3); improvised(s, 2); }
    },
  },

  // 11. A still: brawls, a black market, or disinfectant.
  {
    id: 'still', weight: 2, phase: [2, 5], when: s => s.population.adults >= 8 && amount(s, 'food') >= 15,
    make: (s, _w, rng) => {
      const name = pickOne(rng, MEN);
      return event('Brenneriet', `Bak naustet har ${name} bygd et brennevinsapparat av en melkespann og en bilradiator. Det går med poteter og sukker fra lageret. Resultatet smaker som det lukter, og det lukter som Forus en varm dag. Folk er lykkeligere om kvelden enn de har vært på lenge.`, list(
        { id: 'smash', label: 'Knus apparatet', detail: 'Ingen fyll i leiren. Mange blir sure.', tags: ['harsh'] },
        { id: 'allow', label: 'La ham holde på', detail: 'Litt mat går med. Kveldene blir lysere.' },
        { id: 'take', label: 'Ta over brenneriet til sårvask', detail: `5 mat. Sprit blir medisin${hasTech(s, 'spirit') ? ', og dere vet hvordan' : ''}.`, disabled: need(s, { food: 5 }) },
      ), { data: { name } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name');
      if (c === 'smash') { unrest(s, 5); hope(s, -3); }
      if (c === 'allow') { give(s, 'food', -6); hope(s, 5); schedule(s, days(rng, 5, 8), 'stillBrawl', { name }); }
      if (c === 'take') {
        pay(s, { food: 5 }); give(s, 'medicine', hasTech(s, 'spirit') ? 6 : 3); unrest(s, 2);
        lines.push({ tone: 'good', title: 'Sprit til sårene', text: `${name} protesterte, men ble med som brennmester. Han smaker fortsatt på hver omgang, «for kvalitetens skyld».` });
      }
    },
  },
  {
    id: 'stillBrawl', weight: 1, chainOnly: true, when: () => true,
    make: (_s, _w, _rng, d) => {
      const name = String(d?.name ?? 'Brenneren');
      return event('Slagsmål ved bålet', `Fredag kveld ble det slagsmål ved bålet. Ett brukket kjevebein, en vakt med kutt i hånda, og en mann som sov i porten i stedet for å stå der. Alle hadde vært hos ${name}.`, [
        { id: 'stop', label: 'Steng brenneriet nå', detail: 'For sent for kjevebeinet. Folk vil savne det.', tags: ['harsh'] },
        { id: 'ration', label: 'Ett glass per voksen, bare lørdag', detail: 'Regler for fyll. Det vil bli jukset.' },
        { id: 'ignore', label: 'Gutter er gutter', detail: 'Det går over.', tags: ['reckless'] },
      ], { data: { name } });
    },
    resolve: (s, _w, c, rng) => {
      const name = str(s, 'name');
      s.population.sick += 2;
      if (c === 'stop') { unrest(s, 5); hope(s, -2); }
      if (c === 'ration') { hope(s, 2); unrest(s, hasTech(s, 'rationCards') ? -2 : 2); if (rng() < (hasTech(s, 'rationCards') ? .2 : .5)) schedule(s, days(rng, 6, 10), 'stillMarket', { name }); }
      if (c === 'ignore') { unrest(s, 3); schedule(s, days(rng, 5, 9), 'stillMarket', { name }); }
    },
  },
  {
    id: 'stillMarket', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const name = String(d?.name ?? 'Brenneren');
      const ammo = Math.min(amount(s, 'ammo'), 15 + Math.floor(rng() * 20));
      const buyer = pickOne(rng, [...knownFactions(s), undefined]);
      return event('Svartebørsen', `Vaktene har oppdaget at ${ammo} patroner mangler. De har gått ut porten i bytte mot sukker, tobakk og flere melkespann. Kjøperne er ${buyer ? buyer.name : 'noen fra Sandnes, som vanlig'}. Selgeren er ${name}.${noLawNote(s)}`, list(
        lawChoice(s, false, name),
        !punishLaw(s) && { id: 'punish', label: `Ta ${name} og knus apparatet`, detail: 'Ammunisjonen er borte uansett.', tags: ['harsh'] },
        buyer && { id: 'demand', label: `Krev patronene tilbake fra ${buyer.name}`, detail: 'De vil ikke like tonen.' },
        { id: 'take', label: 'Ta over brenneriet og lag sårsprit', detail: 'Han jobber for leiren nå. Under oppsyn.' },
      ), { data: { name, ammo, buyer: buyer?.id ?? '' } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const name = str(s, 'name'), ammo = num(s, 'ammo');
      give(s, 'ammo', -ammo);
      if (c === 'law') applyLaw(s, lines, undefined, name);
      if (c === 'punish') { unrest(s, 3); improvised(s); }
      if (c === 'demand') { const f = s.factions.find(x => x.id === str(s, 'buyer')); if (f) { f.relation -= 10; if (rng() < .5) give(s, 'ammo', Math.round(ammo / 2)); } }
      if (c === 'take') { give(s, 'medicine', 3); unrest(s, 2); }
      remember(s, `${name} solgte ammunisjon for sukker.`);
    },
  },

  // 12. A crew member who fled during an attack.
  {
    id: 'coward', weight: 2, phase: [1, 5], when: s => crewHere(s).length >= 3,
    make: (s, _w, rng) => {
      const p = pickCrew(s, rng);
      if (!p) return null;
      return event('Posten var tom', `Da de kom over sperringa i natt, forlot ${p.name} posten sin og løp. To andre måtte holde åpningen alene til det ble lyst. Ingen døde. Alle vet hvem som løp.${noLawNote(s)}`, list(
        lawChoice(s, false, p.name),
        { id: 'shame', label: `Ta våpenet fra ${p.name} foran alle`, detail: 'Nærkampvåpen og latrinevakt. En lærepenge.', tags: ['harsh'] },
        { id: 'chance', label: 'Gi en ny sjanse', detail: 'Alle blir redde. Noen andre vil spørre om det samme.', tags: ['merciful'] },
        { id: 'expel', label: `Send ${p.name} ut`, detail: 'Den som ikke holder porten, får ikke bo bak den.', tags: ['cruel'] },
      ), { data: { who: p.id } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const p = crewById(s, str(s, 'who'));
      if (!p) return;
      if (c === 'law') applyLaw(s, lines, p, p.name);
      if (c === 'shame') { p.weapon = 'melee'; loyalty(p, -25); unrest(s, -3); hope(s, -1); }
      if (c === 'chance') { loyalty(p, 12); unrest(s, 3); schedule(s, days(rng, 7, 14), 'cowardAgain', { who: p.id }); }
      if (c === 'expel') { leaves(s, p, lines, 'Sendt ut for å ha forlatt posten.'); hope(s, -3); improvised(s, 2); }
    },
  },
  {
    id: 'cowardAgain', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const p = crewById(s, d?.who);
      if (!p) return null;
      const good = rng() < .55 ? 1 : 0;
      return event(good ? 'Den andre sjansen' : 'Igjen', good
        ? `Da sperringa ved vannposten falt i går, var det ${p.name} som sto igjen og holdt mens barna ble båret inn. Ingen spør lenger hvem som løp sist.`
        : `${p.name} løp igjen. Denne gangen var det ingen som holdt åpningen. To voksne fra leiren rakk ikke inn.${noLawNote(s)}`, good
        ? [
          { id: 'honour', label: `Hedre ${p.name} ved bålet`, detail: 'Folk trenger å se at nye sjanser virker.', tags: ['merciful'] },
          { id: 'quiet', label: 'Ingenting å snakke om', detail: 'Det var jobben.' },
        ]
        : list(
          lawChoice(s, true, p.name),
          { id: 'expel', label: `Send ${p.name} ut`, detail: 'Du ga en sjanse. Den kostet to liv.', tags: ['harsh'] },
          { id: 'keep', label: `Behold ${p.name} borte fra porten`, detail: 'Ikke alle er laget for dette. Folk vil mene noe om det.', tags: ['merciful'] },
        ), { data: { who: p.id, good } });
    },
    resolve: (s, _w, c, _rng, lines) => {
      const p = crewById(s, str(s, 'who'));
      if (num(s, 'good')) { if (p) loyalty(p, c === 'honour' ? 15 : 5); hope(s, c === 'honour' ? 6 : 2); return; }
      removePeople(s, 'adults', 2); hope(s, -6); unrest(s, 6);
      remember(s, 'Den andre sjansen kostet to liv.');
      if (!p) return;
      if (c === 'law') applyLaw(s, lines, p, p.name);
      if (c === 'expel') leaves(s, p, lines, 'Sendt ut etter å ha forlatt posten to ganger.');
      if (c === 'keep') { unrest(s, 6); loyalty(p, 5); }
    },
  },

  // 13. A charismatic crew member challenges your leadership.
  {
    id: 'challenger', weight: 2, once: true, phase: [3, 5], when: s => crewHere(s).length >= 4 && s.population.adults >= 10,
    make: (s, _w, rng) => {
      const options = crewHere(s).filter(p => !(p.awayUntil && p.awayUntil > s.day)).sort((a, b) => (a.loyalty ?? 60) - (b.loyalty ?? 60));
      const p = options[0] && rng() < .7 ? options[0] : pickCrew(s, rng);
      if (!p) return null;
      return event('Et spørsmål på kveldsmøtet', `På kveldsmøtet reiste ${p.name} seg og spurte, høyt nok til at alle hørte det, hvorfor lageret er låst for dem som jobber og åpent for dem som bestemmer. Det ble stille. Så klappet noen. Så klappet flere.`, [
        { id: 'promote', label: `Gi ${p.name} ansvar for porten og rasjonene`, detail: 'Gjør kritikeren til en del av ledelsen. Det gir en plattform.' },
        { id: 'talk', label: `Snakk med ${p.name} alene`, detail: 'Kanskje det er noe i det. Kanskje ikke.' },
        { id: 'shut', label: `Sett ${p.name} på plass foran alle`, detail: 'Ingen stiller spørsmål ved ledelsen på møtet.', tags: ['harsh'] },
        { id: 'ignore', label: 'Svar med tall og gå videre', detail: 'Et spørsmål er bare et spørsmål.' },
      ], { data: { who: p.id } });
    },
    resolve: (s, _w, c, rng) => {
      const p = crewById(s, str(s, 'who'));
      if (!p) return;
      if (c === 'promote') { loyalty(p, 15); unrest(s, -5); schedule(s, days(rng, 10, 14), 'challengerRally', { who: p.id, mode: 'inside' }); }
      if (c === 'talk') { loyalty(p, 6); if (rng() < .5) { unrest(s, -3); setFlag(s, 'challengerSettled', s.day); } else schedule(s, days(rng, 9, 13), 'challengerRally', { who: p.id, mode: 'ignored' }); }
      if (c === 'shut') { loyalty(p, -20); unrest(s, 4); schedule(s, days(rng, 5, 8), 'challengerRally', { who: p.id, mode: 'humiliated' }); }
      if (c === 'ignore') { unrest(s, 2); schedule(s, days(rng, 7, 10), 'challengerRally', { who: p.id, mode: 'ignored' }); }
    },
  },
  {
    id: 'challengerRally', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const p = crewById(s, d?.who);
      if (!p) return null;
      const mode = String(d?.mode ?? 'ignored');
      const k = Math.max(3, Math.round(s.population.adults * (mode === 'humiliated' ? .35 : .25)));
      const intro: Record<string, string> = {
        inside: `${p.name} har styrt porten og rasjonene godt. Kanskje for godt. Vaktene svarer nå til ${p.name}, ikke til deg, og rasjonslistene har fått en ny rekkefølge.`,
        humiliated: `${p.name} har ikke glemt kveldsmøtet. Hver kveld samles folk i verkstedet, og samtalene stopper når du kommer inn.`,
        ignored: `Spørsmålet fra kveldsmøtet ble ikke borte. ${p.name} har fått mange venner siden.`,
      };
      return event('Utfordreren', `${intro[mode] ?? intro.ignored} I dag kom ${p.name} med ${k} voksne bak seg og et krav: ledelsen skal deles, eller så skal den byttes ut.`, list(
        s.phase >= 3 && !hasLaw(s, 'council') && { id: 'council', label: 'Innfør et råd, med ' + p.name + ' i det', detail: 'Makten deles. Tregere beslutninger, roligere leir.' },
        { id: 'arrest', label: `Arrester ${p.name}`, detail: 'Det kan stoppe det. Eller tenne det.', tags: ['harsh'] },
        { id: 'leave', label: `Be ${p.name} ta sine folk og gå`, detail: 'Leiren deles i to. De vil ha sin del.' },
        { id: 'nothing', label: 'Vent dem ut', detail: 'Folk blir lei. Vanligvis.', tags: ['reckless'] },
      ), { data: { who: p.id, k, mode } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const p = crewById(s, str(s, 'who')), k = num(s, 'k');
      if (!p) return;
      if (c === 'council') {
        s.laws = s.laws.filter(id => !['council', 'strongman', 'faithRule', 'militia'].includes(id));
        s.laws.push('council');
        loyalty(p, 20); unrest(s, -10); hope(s, 3);
        remember(s, `${p.name} tvang fram et råd. Du sitter i det, men ikke alene.`);
      }
      if (c === 'arrest') { unrest(s, 12); hope(s, -5); loyalty(p, -40); schedule(s, days(rng, 3, 5), 'challengerCoup', { who: p.id, k, mode: 'arrest' }); }
      if (c === 'leave') {
        removePeople(s, 'adults', k); removePeople(s, 'children', Math.round(k / 3));
        takeShare(s, 'food', .2); takeShare(s, 'water', .2); takeShare(s, 'ammo', .2);
        setFlag(s, 'rivalCamp', p.name);
        leaves(s, p, lines, `Gikk med ${k} voksne for å starte en egen leir.`);
        hope(s, -6); unrest(s, -8);
        schedule(s, days(rng, 12, 18), 'challengerCamp', { name: p.name, k });
      }
      if (c === 'nothing') { unrest(s, 6); schedule(s, days(rng, 4, 7), 'challengerCoup', { who: p.id, k, mode: 'coup' }); }
    },
  },
  {
    id: 'challengerCoup', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const p = crewById(s, d?.who);
      if (!p) return null;
      const k = Math.min(s.population.adults, Number(d?.k ?? 3));
      return event('Natt ved lageret', `${d?.mode === 'arrest' ? `Vennene til ${p.name} brøt opp låsen på arresten i natt.` : `${p.name} har bestemt seg.`} Nå står ${p.name} og ${k} væpnede ved lageret. Resten av leiren står i dørene og ser på. Ingen vet hvem de står sammen med før det smeller.`, [
        { id: 'fight', label: 'Slå ned kuppet', detail: 'Crewet mot dem. Det blir blod.', tags: ['cruel'] },
        { id: 'deal', label: 'La dem gå med en tredjedel', detail: 'Ingen dør i natt. Lageret blir mindre.' },
        { id: 'step', label: 'Gå av', detail: 'Du gir fra deg ledelsen. Leiren velger en ny.' },
      ], { data: { who: p.id, k } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const p = crewById(s, str(s, 'who')), k = num(s, 'k');
      if (!p) return;
      if (c === 'fight') {
        const strength = crewHere(s).filter(x => x !== p).reduce((n, x) => n + x.skills.combat, 0);
        const won = rng() < Math.min(.85, .35 + strength * .04);
        const victim = pickCrew(s, rng, x => x !== p);
        if (victim && rng() < .5) hurtPerson(s, victim, 35, lines, 'Skutt i låret under kuppet.');
        removePeople(s, 'adults', Math.ceil(k / 2));
        if (won) { killPerson(s, p, lines, 'Falt under kuppforsøket.'); unrest(s, -15); hope(s, -8); remember(s, `Kuppet ble slått ned. ${p.name} døde ved lageret.`); }
        else { leaves(s, p, lines, 'Tok med seg sine og det de kunne bære.', { food: Math.round(amount(s, 'food') * .3), ammo: Math.round(amount(s, 'ammo') * .3) }); removePeople(s, 'adults', Math.floor(k / 2)); hope(s, -10); setFlag(s, 'rivalCamp', p.name); remember(s, `${p.name} slapp unna etter kuppforsøket, med en tredjedel av lageret.`); }
      }
      if (c === 'deal') {
        takeShare(s, 'food', .33); takeShare(s, 'water', .33); takeShare(s, 'ammo', .33); takeShare(s, 'medicine', .33);
        removePeople(s, 'adults', k);
        leaves(s, p, lines, `Gikk med ${k} voksne og en tredjedel av lageret.`);
        setFlag(s, 'rivalCamp', p.name);
        hope(s, -6); unrest(s, -10);
        schedule(s, days(rng, 12, 18), 'challengerCamp', { name: p.name, k });
      }
      if (c === 'step') { remember(s, `Du ga fra deg ledelsen da ${p.name} sto ved lageret.`); unrest(s, 100); }
    },
  },
  {
    id: 'challengerCamp', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng, d) => {
      const name = String(d?.name ?? 'De som gikk');
      const hungry = rng() < .5 ? 1 : 0;
      return event('Den andre leiren', hungry
        ? `${name} sin leir har ikke klart seg. Tre av dem som gikk, står ved sperringa og vil tilbake. De sier at ${name} raser, men at det ikke er mat igjen å rase over.`
        : `${name} sender bud: den nye leiren har fisk og vil ha ammunisjon. Prisen er grei. Tonen er det ikke.`, hungry
        ? [
          { id: 'admit', label: 'Ta dem inn igjen', detail: 'Tre arbeidere. Andre vil lure på hva lojalitet betyr.', tags: ['merciful'] },
          { id: 'refuse', label: 'De valgte selv', detail: 'Porten er stengt for dem.', tags: ['harsh'] },
        ]
        : [
          { id: 'trade', label: 'Bytt 15 ammunisjon mot 30 fisk', detail: 'En handel med folk som tok fra dere.', disabled: need(s, { ammo: 15 }) },
          { id: 'refuse', label: 'Ingen handel med dem', detail: 'De husker det.' },
        ], { data: { hungry } });
    },
    resolve: (s, _w, c) => {
      if (num(s, 'hungry')) { if (c === 'admit') { addPeople(s, { adults: 3 }); unrest(s, 3); hope(s, 3); } else hope(s, -2); return; }
      if (c === 'trade') { pay(s, { ammo: 15 }); give(s, 'food', 30); } else unrest(s, -1);
    },
  },

  // 14. Dysentery and a quarantine dilemma.
  {
    id: 'dysentery', weight: 2, phase: [2, 5], when: s => totalPeople(s) >= 15 && s.population.sick < totalPeople(s) * .3,
    make: (s, _w, _rng) => {
      const n = Math.max(2, Math.ceil(totalPeople(s) * (hasTech(s, 'hygiene') ? .04 : .09)));
      return event('Blodgang', `${n} er syke med magesyke og blod i avføringen. Det startet i teltene nærmest latrinene.${hasTech(s, 'hygiene') ? ' Dere koker vannet, men noen har drukket fra tønna likevel.' : ' Vannet er ikke kokt. Det har aldri vært kokt.'} De gamle og de minste tåler minst.`, list(
        { id: 'isolate', label: 'Isoler de syke i gymsalen', detail: '10 vann. Familier skilles. Smitten stopper.', disabled: need(s, { water: 10 }), tags: ['harsh'] },
        { id: 'families', label: 'Isoler hele familiene sammen', detail: '20 vann. Færre i arbeid, men ingen skilles.', disabled: need(s, { water: 20 }), tags: ['merciful'] },
        { id: 'boil', label: 'Kok alt vannet, ingen karantene', detail: '6 drivstoff. Hjelper hvis det var vannet.', disabled: need(s, { fuel: 6 }) },
        { id: 'nothing', label: 'Folk får passe seg selv', detail: 'Ingen kostnad nå.', tags: ['reckless'] },
      ), { data: { n } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const n = num(s, 'n');
      addPeople(s, { sick: n });
      if (c === 'isolate') { pay(s, { water: 10 }); hope(s, -3); schedule(s, days(rng, 3, 5), 'dysenteryBreach', { n }); }
      if (c === 'families') { pay(s, { water: 20 }); unrest(s, 3); if (removePeople(s, 'elderly', rng() < .4 ? 1 : 0)) lines.push({ tone: 'bad', title: 'En gammel døde', text: 'Hun hadde ikke krefter til å drikke nok.' }); }
      if (c === 'boil') { pay(s, { fuel: 6 }); if (rng() < (hasTech(s, 'hygiene') ? .8 : .5)) lines.push({ tone: 'good', title: 'Det var vannet', text: 'Ingen nye syke etter to dager.' }); else schedule(s, days(rng, 3, 4), 'dysenterySpread', { n }); }
      if (c === 'nothing') schedule(s, days(rng, 3, 4), 'dysenterySpread', { n });
    },
  },
  {
    id: 'dysenteryBreach', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, rng) => {
      if (s.population.adults < 1) return null;
      const name = pickOne(rng, WOMEN);
      return event('Gjennom vinduet', `${name} klatret inn gjennom et vindu i gymsalen i natt for å være hos datteren sin, som er syk. Vakten så det og lot henne gå. Nå ber han deg avgjøre det.`, [
        { id: 'stay', label: 'La henne bli der inne', detail: 'Én til i karantene. Mor og barn sammen.', tags: ['merciful'] },
        { id: 'out', label: 'Hent henne ut og isoler henne for seg selv', detail: 'Reglene gjelder alle.', tags: ['harsh', 'children'] },
        { id: 'guard', label: 'La henne bli, men straff vakten', detail: 'Han sviktet. Det skal ikke skje igjen.', tags: ['harsh'] },
      ], { data: { name } });
    },
    resolve: (s, _w, c) => {
      addPeople(s, { sick: 1 });
      if (c === 'stay') { hope(s, 3); unrest(s, 1); }
      if (c === 'out') { hope(s, -4); unrest(s, -2); }
      if (c === 'guard') { unrest(s, 4); improvised(s, 2); }
    },
  },
  {
    id: 'dysenterySpread', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const n = Number(d?.n ?? 2);
      return event('Det sprer seg', `Nå er det ${n * 3} syke. Latrinene renner over, og folk har sluttet å vaske hendene fordi det ikke er vann å vaske dem i. De gamle ligger stille.`, list(
        { id: 'late', label: 'Karantene nå, selv om det er sent', detail: '15 vann. Bedre sent enn aldri.', disabled: need(s, { water: 15 }), tags: ['harsh'] },
        { id: 'medicine', label: 'Bruk medisinen', detail: '8 medisin. Det redder de svakeste.', disabled: need(s, { medicine: 8 }) },
        { id: 'pray', label: 'Samle folk til bønn', detail: 'Det koster ingenting. Noen tror det hjelper.', tags: ['faith', 'reckless'] },
      ), { data: { n } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const n = num(s, 'n');
      addPeople(s, { sick: n * 2 });
      let elders = Math.ceil(s.population.elderly * (c === 'medicine' ? .03 : c === 'late' ? .08 : .15));
      let kids = c === 'medicine' ? 0 : rng() < .4 ? 1 : 0;
      elders = removePeople(s, 'elderly', elders); kids = removePeople(s, 'children', kids);
      if (c === 'late') pay(s, { water: 15 });
      if (c === 'medicine') pay(s, { medicine: 8 });
      if (c === 'pray') { s.population.sick += n; hope(s, 2); }
      if (elders + kids) { hope(s, -3 - 2 * (elders + kids)); funeral(s, lines, `${elders + kids} som døde av blodgang`); lines.push({ tone: 'bad', title: `${elders + kids} døde`, text: `${elders} eldre${kids ? ' og et barn' : ''}. Det startet med en tønne vann.` }); }
      remember(s, 'Blodgangen gikk gjennom leiren.');
    },
  },

  // 15. A ration revolt, only under a rations law.
  {
    id: 'rationRevolt', weight: 3, phase: [2, 5], when: s => !!rationLaw(s) && s.population.adults >= 10,
    make: (s, _w, rng) => {
      const k = Math.round(s.population.adults * (.25 + rng() * .2));
      const law = rationLaw(s);
      const what = law === 'rationHalf' ? 'halve rasjoner' : law === 'rationWorkers' ? 'at barna og de gamle får mindre' : 'reduserte rasjoner';
      return event('Folk ved lagerdøra', `${k} voksne står ved lagerdøra. De har fått nok av ${what}. «Vi jobber, vi sulter, og dere teller.» Noen har med seg spader. Vaktene ser på deg.${noLawNote(s)}`, list(
        { id: 'open', label: 'Åpne lageret for én dag', detail: `${k * 2} mat. Ro i dag, men neste gang kommer de raskere.`, disabled: need(s, { food: k * 2 }), tags: ['charity'] },
        hasTech(s, 'rationCards') && { id: 'books', label: 'Legg fram regnskapet', detail: 'Rasjonskortene viser at alle får det samme. Kanskje det holder.' },
        { id: 'repeal', label: 'Opphev rasjoneringen', detail: 'Folk blir mette. Maten varer kortere.' },
        lawChoice(s, false, 'De som leder an'),
        { id: 'firm', label: 'Stå fast. Vaktene holder døra.', detail: 'Det kan bli slag.', tags: ['harsh'] },
      ), { data: { k, law: law ?? '' } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const k = num(s, 'k');
      if (c === 'open') { pay(s, { food: k * 2 }); unrest(s, -10); hope(s, 3); setFlag(s, 'rationGiven', s.day); }
      if (c === 'books') { unrest(s, -8); hope(s, 2); }
      if (c === 'repeal') { s.laws = s.laws.filter(id => id !== str(s, 'law')); unrest(s, -12); hope(s, 4); remember(s, 'Rasjoneringen ble opphevet etter et opprør ved lageret.'); }
      if (c === 'law') { applyLaw(s, lines, undefined, 'Lederen for opprøret'); unrest(s, 4); schedule(s, days(rng, 5, 8), 'rationRevoltAfter', { mode: 'law', k }); }
      if (c === 'firm') {
        unrest(s, 6); hope(s, -4);
        if (rng() < .4) { const p = pickCrew(s, rng); if (p) hurtPerson(s, p, 15, lines, 'Et spadeskaft over skulderen ved lagerdøra.'); s.population.sick += 2; }
        schedule(s, days(rng, 4, 7), 'rationRevoltAfter', { mode: 'firm', k });
      }
    },
  },
  {
    id: 'rationRevoltAfter', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const mode = String(d?.mode ?? 'firm');
      return event(mode === 'firm' ? 'Røyk fra lageret' : 'Familiene', mode === 'firm'
        ? 'Noen tente på bakveggen av lageret i natt. Vaktene fikk slukket, men en del av maten er brent eller ødelagt av vann. Ingen har sett noe. Alle vet noe.'
        : 'Familiene til dem som ble dømt etter opprøret, nekter å gå på jordet. «Dere kan straffe oss også. Da har dere ingen igjen til å høste.»', [
        { id: 'hunt', label: 'Finn de skyldige', detail: 'Avhør og trusler. Det blir ikke bedre stemning.', tags: ['harsh'] },
        { id: 'meet', label: 'Kall inn til åpent møte om maten', detail: 'Folk får si sin mening. Du må høre den.' },
        { id: 'extra', label: 'Gi alle en ekstra rasjon og gå videre', detail: '12 mat. Det kjøper ro.', disabled: need(s, { food: 12 }), tags: ['charity'] },
      ], { data: { mode } });
    },
    resolve: (s, _w, c, rng) => {
      if (str(s, 'mode') === 'firm') { takeShare(s, 'food', .15); give(s, 'building', -4); }
      else { for (const p of crewHere(s)) p.fatigue = Math.min(100, p.fatigue + 10); }
      if (c === 'hunt') { unrest(s, 8); hope(s, -3); if (rng() < .5) removePeople(s, 'adults', 1); improvised(s, 2); }
      if (c === 'meet') { unrest(s, -6); hope(s, 1); }
      if (c === 'extra') { pay(s, { food: 12 }); unrest(s, -8); }
    },
  },

  // 16. The old offer to leave so the children can eat.
  {
    id: 'eldersLeave', weight: 3, once: true, phase: [2, 5],
    when: s => s.population.elderly >= 3 && s.population.children >= 3 && amount(s, 'food') < totalPeople(s) * 5,
    make: (s, w, rng) => {
      const k = Math.min(s.population.elderly, 2 + Math.floor(rng() * 4));
      const name = pickOne(rng, WOMEN);
      const outpost = Object.keys(s.zones).find(id => s.zones[id].status === 'controlled' && id !== s.homeZoneId);
      return event('De gamle', `${name} er åttito og har bodd i ${pickOne(rng, PLACES)} hele livet. På kveldsmøtet ber hun om ordet. Hun og ${k - 1} andre har snakket sammen. «Vi har levd livene våre. Barna har ikke begynt på sine. Vi går i morgen tidlig, mens vi ennå kan gå selv. Vi ber bare om at noen følger oss til svingen.»`, list(
        { id: 'refuse', label: 'Nei. Ingen går ut porten for å spare mat.', detail: 'Alle får litt mindre. Det vil merkes.', tags: ['merciful'] },
        outpost && { id: 'outpost', label: `Gi dem et eget sted i ${zoneName(w, outpost)}`, detail: '10 mat og 6 byggemateriale. De fisker og passer seg selv.', disabled: need(s, { food: 10, building: 6 }), tags: ['merciful'] },
        { id: 'accept', label: 'Godta tilbudet, med verdighet', detail: 'Et måltid, en sang og et følge til svingen.', tags: ['harsh'] },
      ), { data: { k, name, outpost: outpost ?? '' } });
    },
    resolve: (s, w, c, rng, lines) => {
      const k = num(s, 'k'), name = str(s, 'name');
      if (c === 'refuse') { hope(s, 6); unrest(s, 3); for (const p of crewHere(s)) p.health -= 2; setFlag(s, 'eldersStayed', s.day); remember(s, `De gamle ville gå for å spare mat. Dere sa nei.`); }
      if (c === 'outpost') {
        pay(s, { food: 10, building: 6 });
        removePeople(s, 'elderly', k); hope(s, 2);
        remember(s, `${k} eldre flyttet til ${zoneName(w, str(s, 'outpost'))} for å klare seg selv.`);
        schedule(s, days(rng, 8, 14), 'eldersNews', { k, name, mode: 'outpost', zone: str(s, 'outpost') });
      }
      if (c === 'accept') {
        removePeople(s, 'elderly', k); hope(s, -10); unrest(s, -2);
        remember(s, `${name} og ${k - 1} andre eldre gikk ut porten for at barna skulle få mat.`);
        lines.push({ tone: 'bad', title: 'Til svingen', text: 'Hele leiren sto langs veien. Ingen sang til slutt, selv om de hadde lovet det.' });
        schedule(s, days(rng, 6, 9), 'eldersNews', { k, name, mode: 'left' });
      }
    },
  },
  {
    id: 'eldersNews', weight: 1, chainOnly: true, when: () => true,
    make: (s, w, rng, d) => {
      const k = Number(d?.k ?? 3), name = String(d?.name ?? 'Hun'), mode = String(d?.mode ?? 'left');
      if (mode === 'outpost') {
        const ok = rng() < .65 ? 1 : 0;
        return event(ok ? 'Fisk fra de gamle' : 'Stille i ' + zoneName(w, d?.zone), ok
          ? `En båt kommer inn med tørket fisk og en lapp fra ${name}: «Det går bra her. Torsken er dummere enn zombiene. Send barna en hilsen.»`
          : `Ingen har hørt fra de gamle i ${zoneName(w, d?.zone)} på fire dager. En patrulje fant døra brutt opp.`, ok
          ? [{ id: 'read', label: 'Les lappen høyt ved bålet', detail: 'Folk trenger det.' }]
          : [
            { id: 'search', label: 'Let etter dem', detail: 'To fra crewet. Det kan være noen i live.', tags: ['merciful', 'reckless'] },
            { id: 'mourn', label: 'Hold en minnestund', detail: 'Dere vet hva som skjedde.' },
          ], { data: { k, ok, mode } });
      }
      const found = rng() < .3 ? 1 : 0;
      return event(found ? 'I naustet' : 'Esken under sengen', found
        ? `En patrulje fant to av de gamle i et naust ved sjøen, avmagret, men i live. ${name} var ikke blant dem. De vil ikke komme tilbake. «Vi gikk for barnas skyld. Det gjelder fortsatt.»`
        : `Barna fant en eske under sengen til ${name}. Strikkede votter, én for hvert barn i leiren, og en lapp med navnene deres.`, found
        ? [
          { id: 'bring', label: 'Hent dem hjem likevel', detail: 'To munner til. Ingen vil si nei.', tags: ['merciful'] },
          { id: 'supply', label: 'La dem være, men gi dem mat', detail: '8 mat. Deres valg, deres naust.', disabled: need(s, { food: 8 }), tags: ['charity'] },
        ]
        : [
          { id: 'give', label: 'Del ut vottene ved bålet', detail: 'Alle skal vite hvem de var fra.' },
          { id: 'stone', label: 'Reis en minnestein ved porten', detail: '2 byggemateriale. Navnene deres, hogd i stein.', disabled: need(s, { building: 2 }), tags: ['faith'] },
        ], { data: { k, found, mode } });
    },
    resolve: (s, _w, c, rng, lines) => {
      if (str(s, 'mode') === 'outpost') {
        if (num(s, 'ok')) { give(s, 'food', 15); hope(s, 6); return; }
        hope(s, -6);
        if (c === 'search') { const p = pickCrew(s, rng); if (p && rng() < .35) hurtPerson(s, p, 20, lines, 'Huset var ikke tomt.'); if (rng() < .4) { addPeople(s, { elderly: 1 }); lines.push({ tone: 'good', title: 'Én i live', text: 'Gjemt på loftet i tre dager, med en fiskestang som eneste våpen.' }); } }
        remember(s, 'De gamle på utposten ble tatt.');
        return;
      }
      if (num(s, 'found')) { if (c === 'bring') { addPeople(s, { elderly: 2 }); hope(s, 4); } else { pay(s, { food: 8 }); hope(s, 3); } return; }
      if (c === 'give') hope(s, 5);
      if (c === 'stone') { pay(s, { building: 2 }); hope(s, 6); remember(s, 'En minnestein ved porten bærer navnene til de gamle som gikk.'); }
    },
  },

  // 17. A spy informing another group about your stores.
  {
    id: 'spy', weight: 2, phase: [3, 5], when: s => knownFactions(s).length > 0 && s.population.adults >= 10,
    make: (s, _w, rng) => {
      const f = pickOne(rng, knownFactions(s));
      const name = pickOne(rng, MEN);
      return event('Den hjelpsomme', `${name} kom for tre uker siden. Han er blid, jobber hardt og har meldt seg til lagervakt hver uke. En av barna sier at han sitter med en radio bak naustet om natta. Han sier selv at han prøver å nå søsteren sin.${hasTech(s, 'intel') ? ' Lytteposten har fanget opp en sending på den frekvensen han bruker.' : ''}`, [
        { id: 'watch', label: 'Hold øye med ham', detail: 'La ham tro han er trygg. Det tar noen dager.' },
        { id: 'confront', label: 'Konfronter ham nå', detail: hasTech(s, 'intel') ? 'Dere har sendingen. Det holder.' : 'Uten bevis. Han kan være uskyldig.' },
        { id: 'ignore', label: 'Det er ikke forbudt å ha radio', detail: 'Folk har lov til å savne familien.' },
      ], { data: { faction: f.id, name } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const faction = str(s, 'faction'), name = str(s, 'name');
      if (c === 'watch') schedule(s, days(rng, 4, 6), 'spyCaught', { faction, name });
      if (c === 'confront') {
        if (hasTech(s, 'intel') || rng() < .4) schedule(s, 1, 'spyCaught', { faction, name });
        else if (rng() < .5) { hope(s, -3); unrest(s, 3); lines.push({ tone: 'warn', title: 'Han hadde en søster', text: `${name} fikk faktisk kontakt med søsteren sin på radioen i kveld. Han har ikke sagt et ord til noen siden.` }); }
        else { removePeople(s, 'adults', 1); lines.push({ tone: 'bad', title: 'Han er borte', text: `${name} forsvant om natta. Med seg tok han en håndtegnet oversikt over lageret.` }); schedule(s, days(rng, 3, 5), 'spyRaid', { faction }); }
      }
      if (c === 'ignore') schedule(s, days(rng, 8, 12), 'spyRaid', { faction });
    },
  },
  {
    id: 'spyCaught', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const f = s.factions.find(x => x.id === d?.faction);
      if (!f) return null;
      const name = String(d?.name ?? 'Han');
      return event('Rapportene', `Dere tok ${name} med radioen i hånda. Han har sendt ${f.name} oversikter over lageret, vaktskiftene og hvor mange våpen dere har. Han gråter ikke. «De har dattera mi. Hun er elleve. De sa at de lot henne være i fred så lenge tallene stemte.»${noLawNote(s)}`, list(
        lawChoice(s, true, name),
        { id: 'turn', label: 'La ham sende falske tall', detail: `${f.name} får vite det dere vil. Så lenge de tror ham.` },
        { id: 'release', label: 'La ham gå til datteren', detail: 'Han tar med seg det han vet.', tags: ['merciful'] },
        { id: 'handover', label: `Gi ham til ${f.name} og krev en forklaring`, detail: 'De får tilbake sin mann. Han får ingenting.', tags: ['betrayal'] },
      ), { factionId: f.id, data: { faction: f.id, name } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const f = s.factions.find(x => x.id === str(s, 'faction')), name = str(s, 'name');
      if (c === 'law') { applyLaw(s, lines, undefined, name); if (f) f.relation -= 5; }
      if (c === 'turn') {
        setFlag(s, 'spyTurned', f?.id ?? '');
        if (rng() < .7) { hope(s, 2); lines.push({ tone: 'good', title: 'Falske tall', text: `${f?.name ?? 'De andre'} tror nå at lageret er halvtomt og vaktene dobbelt så mange.` }); }
        else { removePeople(s, 'adults', 1); lines.push({ tone: 'bad', title: 'De gjennomskuet det', text: `${name} sluttet å svare på radioen. Ei uke senere kom han ikke tilbake fra jordet.` }); schedule(s, days(rng, 3, 6), 'spyRaid', { faction: f?.id ?? '' }); }
      }
      if (c === 'release') { removePeople(s, 'adults', 1); hope(s, 2); if (f) f.relation -= 3; schedule(s, days(rng, 8, 14), 'spyRaid', { faction: f?.id ?? '', weak: 1 }); }
      if (c === 'handover') { removePeople(s, 'adults', 1); if (f) f.relation += 8; hope(s, -5); remember(s, `Dere overlot ${name} til ${f?.name ?? 'dem han spionerte for'}. Datteren hans var der.`); }
    },
  },
  {
    id: 'spyRaid', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const f = s.factions.find(x => x.id === d?.faction && !x.defeated);
      if (!f) return null;
      const weak = Number(d?.weak ?? 0);
      return event(`${f.name} vet hvor de skal lete`, `${f.name} kom i grålysningen, rett til den bakre døra på lageret, i vaktskiftet, på det eneste stedet sperringa er lav. Noen har fortalt dem alt.${weak ? ' Men tallene de har, er gamle.' : ''}`, [
        { id: 'fight', label: 'Kjemp', detail: 'Crewet til lageret. Noen kan bli skadet.', tags: ['reckless'] },
        { id: 'give', label: 'La dem ta det de kom for', detail: 'Ingen dør. Lageret blir mye lettere.' },
        { id: 'move', label: 'Flytt det viktigste i hui og hast', detail: '4 byggemateriale til nye skjul. Noe går tapt uansett.', disabled: need(s, { building: 4 }) },
      ], { factionId: f.id, data: { faction: f.id, weak } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const f = s.factions.find(x => x.id === str(s, 'faction'));
      const m = num(s, 'weak') ? .5 : 1;
      if (f) f.relation -= 10;
      if (c === 'fight') {
        takeShare(s, 'food', .08 * m); takeShare(s, 'ammo', .15);
        const p = pickCrew(s, rng); if (p && rng() < .6) hurtPerson(s, p, 25, lines, `Skadet i kampen ved lageret mot ${f?.name ?? 'raiderne'}.`);
      }
      if (c === 'give') { takeShare(s, 'food', .25 * m); takeShare(s, 'medicine', .3 * m); takeShare(s, 'ammo', .2 * m); hope(s, -6); }
      if (c === 'move') { pay(s, { building: 4 }); takeShare(s, 'food', .1 * m); takeShare(s, 'medicine', .1 * m); }
      remember(s, `${f?.name ?? 'En annen gruppe'} plyndret lageret med hjelp fra en informant.`);
    },
  },

  // 18. A guard who shot an unarmed man at the gate.
  {
    id: 'gateShooting', weight: 2, phase: [2, 5], when: s => crewHere(s).some(p => gearWeapon(s, p) !== 'melee'),
    make: (s, w, rng) => {
      const p = pickCrew(s, rng, x => gearWeapon(s, x) !== 'melee');
      if (!p) return null;
      const deaf = rng() < .4 ? 1 : 0;
      return event('Skuddet ved porten', `Rett før midnatt skjøt ${p.name} en mann ved porten i ${homeName(s, w)}. Han hadde ikke våpen. Han hadde en gutt på sju med seg, og gutten sitter nå i vaktbua og sier ingenting. ${p.name} sier mannen ikke stoppet da det ble ropt. ${deaf ? 'Gutten har skrevet på en lapp at faren var døv.' : 'Det regnet og var mørkt, og ingen andre hørte ropet.'}${noLawNote(s)}`, list(
        lawChoice(s, true, p.name),
        { id: 'back', label: `Stå bak ${p.name}`, detail: 'En vakt som nøler, er en død vakt. Det vil mange si.', tags: ['harsh'] },
        { id: 'remove', label: `Ta ${p.name} av porten`, detail: 'Ingen straff, men ingen tillit heller.' },
        { id: 'boy', label: 'Ta deg av gutten først. Resten kan vente.', detail: 'Han blir hos dere. Spørsmålet om skuddet gjør ikke det.', tags: ['merciful'] },
      ), { data: { who: p.id, deaf } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const p = crewById(s, str(s, 'who'));
      addPeople(s, { children: 1 });
      if (!p) return;
      if (c === 'law') { applyLaw(s, lines, p, p.name); hope(s, 2); schedule(s, days(rng, 6, 10), 'gateShootingKin', { who: p.id, backed: 0 }); }
      if (c === 'back') { loyalty(p, 10); hope(s, -5); unrest(s, -2); setFlag(s, 'gateTrigger', s.day); schedule(s, days(rng, 6, 10), 'gateShootingKin', { who: p.id, backed: 1 }); }
      if (c === 'remove') { loyalty(p, -12); unrest(s, 2); schedule(s, days(rng, 6, 10), 'gateShootingKin', { who: p.id, backed: 0 }); }
      if (c === 'boy') { hope(s, 3); unrest(s, 3); schedule(s, days(rng, 5, 8), 'gateShootingKin', { who: p.id, backed: 1 }); }
      remember(s, `${p.name} skjøt en ubevæpnet mann ved porten. ${num(s, 'deaf') ? 'Han var døv.' : ''}`);
    },
  },
  {
    id: 'gateShootingKin', weight: 1, chainOnly: true, when: () => true,
    make: (s, _w, _rng, d) => {
      const p = crewById(s, d?.who);
      const backed = Number(d?.backed ?? 0);
      const who = p ? p.name : 'den som skjøt';
      return event('Familien ved porten', `Fem mennesker står ved porten med hvite filler på stokker. Det er søsteren til mannen som ble skutt, og folk fra gården de bodde på. De vil ha gutten. ${backed && p ? `Og de vil ha ${who}.` : 'Og de vil ha bot.'}`, list(
        { id: 'pay', label: 'Betal bot og gi dem gutten', detail: '20 mat og 4 medisin. Kanskje blir det fred.', disabled: need(s, { food: 20, medicine: 4 }), tags: ['merciful'] },
        { id: 'boy', label: 'Gi dem gutten, ingenting mer', detail: 'Han hører til hos sine.' },
        backed === 1 && !!p && { id: 'handover', label: `Overlat ${who} til dem`, detail: 'De lover en rettferdig dom. Du vet ikke hva det betyr for dem.', tags: ['betrayal'] },
        { id: 'chase', label: 'Jag dem bort', detail: 'Ingen forhandler med porten. Gutten blir.', tags: ['harsh', 'children'] },
      ), { data: { who: p?.id ?? '', backed } });
    },
    resolve: (s, _w, c, rng, lines) => {
      const p = crewById(s, str(s, 'who'));
      if (c !== 'chase') removePeople(s, 'children', 1);
      if (c === 'pay') { pay(s, { food: 20, medicine: 4 }); hope(s, 4); if (rng() < .5) { addPeople(s, { adults: 2 }); lines.push({ tone: 'good', title: 'To ble igjen', text: 'To av dem ba om å få bli. De kunne ikke tilgi, men de kunne jobbe.' }); } }
      if (c === 'boy') { hope(s, 1); if (rng() < .4) { give(s, 'food', -10); lines.push({ tone: 'bad', title: 'Svinn ved gjerdet', text: 'Et hull i gjerdet ved potetåkeren. Noen har tatt sin egen bot.' }); } }
      if (c === 'handover' && p) { leaves(s, p, lines, `Overlatt til familien til mannen som ble skutt.`); hope(s, -4); for (const x of crewHere(s)) if ((x.traits ?? []).includes('hard')) loyalty(x, -6); remember(s, `Dere overlot ${p.name} til familien til den døde.`); }
      if (c === 'chase') { hope(s, -5); unrest(s, 2); setFlag(s, 'gateFeud', s.day); if (rng() < .5) { takeShare(s, 'food', .1); lines.push({ tone: 'bad', title: 'De kom tilbake om natta', text: 'Ingen ble skadet. Lageret ble lettere.' }); } }
    },
  },
];
