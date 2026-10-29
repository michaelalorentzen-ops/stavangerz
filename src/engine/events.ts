// Hendelseskort. when(s) avgjør om et kort kan trekkes, choices[].run(s, ok)
// endrer tilstanden og returnerer teksten som vises etterpå. check er en
// stat-sjekk mot crewets beste på den staten.
import { NEIGHBORS, PLAYABLE } from './data';
import { addNeighbor, canRecruit } from './crew';
import { addGateWork, checkEnd, validateTasks } from './engine';
import { mods } from './phases';
import { clamp, pick, rand } from './rng';
import { bestOf, checkOddsFor } from './skills';
import type { CrewMember, GameState, StatKey } from './types';

export interface ChoiceDef {
  label: string;
  check?: StatKey;
  when?: (s: GameState) => boolean;
  run: (s: GameState, ok: boolean) => string;
}
export interface EventDef {
  id: string;
  title: string;
  channel?: string;
  when?: (s: GameState) => boolean;
  text: (s: GameState) => string;
  choices: ChoiceDef[];
}

export const best = (s: GameState, k: StatKey): CrewMember => bestOf(s.crew, k);
export const checkOdds = (s: GameState, k: StatKey, base = 0.25): number => checkOddsFor(s.crew, k, base);
const roll = (s: GameState, k: StatKey) => rand(s) < checkOdds(s, k);
const recruitable = (s: GameState) => NEIGHBORS.filter((n) => !s.crew.some((c) => c.id === n.id) && !s.flags[`gone_${n.id}`]);

export const INTRO: EventDef = {
  id: 'intro', title: 'Tirsdag 07:42',
  channel: 'NRK P1 Rogaland',
  text: () => '«…Bybrua er stengt i begge retninger etter det politiet kaller en «uavklart hendelse». Trafikanter bes unngå området og ikke la seg bite av andre trafikanter. Vi går over til været: regn.»\n\nNoen banker på døra. Rytmisk. Ikke på en hyggelig måte.',
  choices: [
    { label: 'Barrikader døra med sofaen', run: (s) => { s.res.tre += 2; s.moral += 5; return 'Sofaen fra Bohus holder. Den var verdt hver krone. Dere finner også litt planker i boden.'; } },
    { label: 'Se ut av vinduet først', run: (s) => { s.sectors.hjem.seen = true; s.sectors.obs.seen = true; s.sectors.buoy_nord.seen = true; return 'Du ser naboen Svein stå i hagen og tygge på en hekk. Du får god oversikt over Hjemme, Obs Bygg og Buøy nord.'; } },
    { label: 'Ring Kjell i borettslaget', run: (s) => { s.moral += 10; return '«Dette må tas opp på årsmøtet», sier Kjell. Det er så normalt at alle roer seg ned. Moralen stiger.'; } },
  ],
};

export const EVENTS: EventDef[] = [
  {
    id: 'tesla', title: 'Naboen med Tesla',
    text: () => 'En mann i dunvest banker på. Han vil lade Teslaen sin på aggregatet deres. «Jeg skal bare til Forus», sier han. Det er zombier i baksetet hans.',
    choices: [
      { label: 'Si nei', run: () => 'Han rygger ut og kjører inn i Obs Bygg. Dere hører alarmen i en time.' },
      { label: 'Overtal ham til å gi fra seg bilen', check: 'prat', run: (s, ok) => { if (ok) { s.res.drivstoff += 4; s.res.skrap += 3; return 'Han gir dere bilen mot at dere sier han kjører «en ekte fremtidsbil». Dere tapper alt brukbart.'; } s.moral -= 3; return 'Han blir fornærmet og kjører. Zombiene i baksetet vinker.'; } },
    ],
  },
  {
    id: 'russebuss', title: 'Russebussen',
    when: (s) => s.day >= 3,
    text: () => 'En russebuss med navnet «APOKALYPSE 2026» står med motoren i gang ved Bybrua. Bassen dunker. Den trekker alle zombiene i nærheten til seg.',
    choices: [
      { label: 'La den spille. Zombiene går dit.', run: (s) => { s.sectors.sorspissen.z = Math.max(0, s.sectors.sorspissen.z - 3); return 'Zombiene samles rundt bussen. Sørspissen blir litt tryggere, og ingen trenger å høre «Hvitt Konfekt» igjen.'; } },
      { label: 'Plyndre bussen', check: 'kondis', run: (s, ok) => { if (ok) { s.res.mat += 5; s.res.vann += 6; return 'Dere løper inn og ut. Byttet: energidrikk, pølser og en Tine-melk av ukjent alder.'; } const c = best(s, 'kondis'); c.hp = Math.max(1, c.hp - 1); return `${c.name} snublet i en russelue og ble skadet på vei ut.`; } },
    ],
  },
  {
    id: 'maaker', title: 'Måkene',
    text: () => 'En flokk Stavanger-måker har funnet matlageret. De er ikke redde for zombier. De er ikke redde for noe.',
    choices: [
      { label: 'Forsvar maten', check: 'muskler', run: (s, ok) => { if (ok) return 'Måkene trekker seg tilbake. For nå. De vil huske dette.'; s.res.mat = Math.max(0, s.res.mat - 4); return 'Måkene vinner. De tar fire porsjoner og en pølse ut av hånda di.'; } },
      { label: 'Gi dem litt, de har det også tøft', run: (s) => { s.res.mat = Math.max(0, s.res.mat - 2); s.moral += 4; return 'En måke ser takknemlig ut. Kanskje. Det er vanskelig å si med måker.'; } },
    ],
  },
  {
    id: 'hurtigbat', title: 'Hurtigbåten',
    when: (s) => recruitable(s).length > 0,
    text: (s) => { const n = recruitable(s)[0]; return `En Kolumbus-hurtigbåt driver forbi Tømmerodden uten fører. Én person står på dekk og vinker: ${n.name} (${n.age}), ${n.role.toLowerCase()}. «${n.quip}»`; },
    choices: [
      { label: 'Hent personen i land', check: 'kondis', run: (s, ok) => { const n = recruitable(s)[0]; if (!canRecruit(s)) return `${n.name} står klar på kaia, men det er ikke plass til flere. Dere har ikke senger til ${s.crew.length + 1}. Båten fortsetter mot Tau.`; if (ok) { addNeighbor(s, n.id); return `${n.name} er med i crewet. Neste gang dere ser hurtigbåten, kjører den mot Tau.`; } s.flags[`gone_${n.id}`] = true; return `Dere når ikke fram. ${n.name} vinker tappert mens båten forsvinner mot Tau.`; } },
      { label: 'Vi har nok munner å mette', run: (s) => { const n = recruitable(s)[0]; s.flags[`gone_${n.id}`] = true; s.moral -= 4; return 'Båten forsvinner i regnet. Det føles feil.'; } },
    ],
  },
  {
    id: 'sandnes', title: 'Nødsending',
    text: () => '«Dette er nødsendingen fra Fylkeshuset. Sandnes har erklært seg selvstendig. Vi gjentar: Sandnes har erklært seg selvstendig.»\n\nIngen i crewet merker noen forskjell.',
    choices: [
      { label: 'Skru av radioen', run: (s) => { s.moral += 3; return 'Det blir stille. Bare regn og fjern stønning. Hjemmekoselig.'; } },
      { label: 'Lytt videre etter tips', check: 'snoking', run: (s, ok) => { if (ok) { for (const id of PLAYABLE) { s.sectors[id].seen = true; s.sectors[id].scouted = true; } return 'Mellom linjene får dere vite mye om Buøy. Alle sektorer er nå speidet.'; } return 'Resten av sendingen er værmelding. Regn.'; } },
    ],
  },
  {
    id: 'joggezombie', title: 'Joggezombien',
    when: (s) => s.day >= 2,
    text: () => 'En zombie i Helly Hansen-tights løper i jevnt tempo rundt Buøy. Den har en Garmin. Den har aldri tatt hviledag og har ikke tenkt å begynne nå.',
    choices: [
      { label: 'Legg en felle', check: 'mekk', run: (s, ok) => { if (ok) { s.res.medisin += 2; return 'Den løper rett inn i en presenning. Lommene inneholder Paracet og gel-poser. Personlig rekord: avsluttet.'; } return 'Den hopper over fella uten å miste tempo. Imponerende, egentlig.'; } },
      { label: 'Ignorer den', run: (s) => { s.moral -= 2; return 'Den løper forbi vinduet hver morgen klokka seks. Det tar på psyken.'; } },
    ],
  },
  {
    id: 'sirene', title: 'Skiftsirenen',
    text: () => 'Klokka 07:00 går skiftsirenen på Rosenberg av, på timer som vanlig. Alle zombier på vestsiden snur seg mot verftet.',
    choices: [
      { label: 'Utnytt det: angrip mens de er distrahert', run: (s) => { let n = 0; for (const id of ['obs', 'tommerodden', 'hjem'] as const) { const k = Math.min(s.sectors[id].z, 2); s.sectors[id].z -= k; n += k; } s.stats.kills += n; return `Dere tar ${n} zombier bakfra. Sirenen er den beste kollegaen dere har hatt.`; } },
      { label: 'Forsterk gjerdet mens de samles', run: (s) => { addGateWork(s, 'ros', 4); return 'Dere bruker roen til å forsterke Rosenberg-gjerdet.'; } },
    ],
  },
  {
    id: 'arsmote', title: 'Ekstraordinært årsmøte',
    when: (s) => s.crew.some((c) => c.trait === 'hms'),
    text: () => 'Kjell har kalt inn til ekstraordinært årsmøte. Sak 1: Zombier. Sak 2: Hvem som har parkert på gjesteplassen.',
    choices: [
      { label: 'Delta på møtet', run: (s) => { s.moral += 8; return 'Møtet varer i tre timer. Vedtak: zombier er ikke tillatt i fellesarealene. Alle føler seg tryggere.'; } },
      { label: 'Send fullmakt og jobb videre', run: (s) => { s.res.skrap += 3; s.moral -= 3; return 'Kjell er skuffet, men dere finner skrap i sykkelboden mens alle andre sitter i møte.'; } },
    ],
  },
  {
    id: 'katt', title: 'Katten',
    text: () => 'En feit, oransje katt sitter på trappa. Den har tydeligvis klart seg utmerket. Den ser på deg som om du skylder den penger.',
    choices: [
      { label: 'Adopter katten', run: (s) => { s.moral += 10; s.res.mat = Math.max(0, s.res.mat - 1); s.flags.katt = true; return 'Katten heter nå Kaptein Kjeks. Den varsler før zombier kommer. Det tror dere i hvert fall.'; } },
      { label: 'La katten være', run: () => 'Katten går. Den kommer tilbake i morgen. Den har allerede adoptert dere.' },
    ],
  },
  {
    id: 'oljeskift', title: 'Oljefolk på avveie',
    when: (s) => s.day >= 4,
    text: () => 'En gruppe i oransje kjeledresser kommer gående fra Tømmerodden. De har nettopp kommet fra en tre ukers turnus i Nordsjøen og vet ingenting om noe.',
    choices: [
      { label: 'Forklar situasjonen', check: 'prat', run: (s, ok) => { if (ok) { s.res.skrap += 4; s.res.drivstoff += 3; s.moral += 4; return 'De tar det overraskende pent, gir dere utstyret sitt og drar for å finne familiene sine.'; } return '«Er dette en sikkerhetsøvelse?» De går videre for å finne en kaffemaskin.'; } },
      { label: 'Be dem om hjelp til gjerdet', run: (s) => { addGateWork(s, 'ros', 5); return 'De bygger på gjerdet i én dag, med full sikkerhetsbrief først.'; } },
    ],
  },
  {
    id: 'kaffe', title: 'Kaffekrisen',
    when: (s) => s.day >= 5,
    text: () => 'Kaffen er tom. Crewet stirrer på deg. Dette er det farligste øyeblikket så langt.',
    choices: [
      { label: 'Raid nærmeste kiosk', check: 'kondis', run: (s, ok) => { if (ok) { s.moral += 12; return 'To kilo Friele. Moralen er reddet. Sivilisasjonen består.'; } const c = best(s, 'kondis'); c.hp = Math.max(1, c.hp - 1); s.moral -= 5; return `${c.name} kom tilbake med te. Og en skade. Mest te.`; } },
      { label: 'Rasjoner det som er igjen av grut', run: (s) => { s.moral -= 8; return 'Grutkaffe nummer tre. Ingen sier noe. Alle tenker det.'; } },
    ],
  },
  {
    id: 'dronningen', title: 'Seilbåten',
    when: (s) => s.day >= 3,
    text: () => 'En seilbåt glir inn mot kaia ved Sørspissen. Rorsmannen roper: «Har dere drivstoff? Jeg har hermetikk!»',
    choices: [
      { label: 'Bytt 3 drivstoff mot mat', when: (s) => s.res.drivstoff >= 3, run: (s) => { s.res.drivstoff -= 3; s.res.mat += 10; return 'Handel gjennomført. Han seiler mot Kvitsøy og ønsker dere lykke til.'; } },
      { label: 'Prut', check: 'prat', run: (s, ok) => { if (ok) { s.res.mat += 6; return 'Han gir dere seks hermetikkbokser bare fordi du minner ham om nevøen hans.'; } return 'Han seiler videre og mumler noe om «byfolk».'; } },
      { label: 'Vink farvel', run: () => 'Han seiler mot horisonten. Dere ser aldri hvordan det går med ham.' },
    ],
  },
  {
    id: 'ryfast', title: 'Lyder fra tunnelen',
    when: (s) => s.day >= 6,
    text: () => 'Det kommer lyder fra Hundvågtunnelen. Skraping. Stønning. Og så noen som synger «Mitt hjerte er i Stavanger».',
    choices: [
      { label: 'Forsterk Nordporten', run: (s) => { addGateWork(s, 'nord', 3); return 'Dere bruker natta på å forsterke Nordporten. Sangen stopper rundt fire.'; } },
      { label: 'Undersøk', check: 'nerver', run: (s, ok) => { if (ok) { s.res.drivstoff += 6; return 'Det var en zombie med Bluetooth-høyttaler. Bak ham står en tankbil med diesel.'; } s.sectors.nordkrysset.z += 3; return 'Det var ikke én zombie. Tre av dem følger dere tilbake til Nordkrysset.'; } },
    ],
  },
  {
    id: 'vaffel', title: 'Foreldrekomiteen',
    when: (s) => s.sectors.skolen.z === 0,
    text: () => 'På Buøy skole finner dere FAU-lista over hvem som skulle bake til 17. mai. Halvparten har krysset seg av.',
    choices: [
      { label: 'Les den høyt med NRK-stemme', run: (s) => { s.moral += 6; return 'Det er dumt. Alle ler likevel.'; } },
      { label: 'Sjekk skapene til de som ikke krysset av', check: 'snoking', run: (s, ok) => { if (ok) { s.res.mat += 6; s.res.medisin += 1; return 'De som ikke hadde bakt, hadde kjøpt ferdigkake. Mange av dem.'; } return 'Bare tomme Tupperware-bokser. Lokkene mangler.'; } },
    ],
  },
  {
    id: 'svein', title: 'Svein i hekken',
    when: (s) => s.day >= 2 && !s.flags.svein,
    text: () => 'Naboen Svein står fortsatt i hagen og tygger på hekken. Han var alltid opptatt av hekken. Nå er han bokstavelig talt opptatt av den.',
    choices: [
      { label: 'Gjør det nødvendige', check: 'nerver', run: (s, ok) => { s.flags.svein = true; if (ok) { s.res.tre += 2; return 'Det er gjort. Dere låner hekksaksen hans. Han hadde ikke noe imot det.'; } s.moral -= 6; return 'Ingen klarer det. Til slutt gjør Svein det selv ved å gå inn i bassenget.'; } },
      { label: 'La Svein klippe hekken', run: (s) => { s.flags.svein = true; s.moral += 2; return 'Hekken har aldri vært penere. Respekt, Svein.'; } },
    ],
  },
];

export function drawEvent(s: GameState): EventDef | null {
  const pool = EVENTS.filter((e) => !s.seenEvents.includes(e.id) && (!e.when || e.when(s)));
  if (!pool.length || rand(s) > mods(s).eventChance) return null;
  const e = pick(s, pool);
  s.seenEvents.push(e.id);
  return e;
}

export function runChoice(s: GameState, ch: ChoiceDef): { ok: boolean; text: string } {
  const ok = ch.check ? roll(s, ch.check) : true;
  const text = ch.run(s, ok);
  s.moral = clamp(s.moral, 0, 100);
  validateTasks(s);
  checkEnd(s);
  return { ok, text };
}
