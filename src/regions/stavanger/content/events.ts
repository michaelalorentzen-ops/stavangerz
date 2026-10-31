// Hendelseskort for Stavanger. Reglene for hvordan de trekkes og løses står i engine/events.ts.
import { AREA, GATES, LANDMARKS, PLAYABLE, SECTORS, ZONES } from '../places';
import { NEIGHBORS } from '../people';
import { addNeighbor, canRecruit, injure, leaveForGood } from '../../../engine/crew';
import { addGateWork, GATE_IDS } from '../../../engine/engine';
import { GATE_STEPS } from '../../../engine/data';
import { newCard } from '../../../engine/cards';
import { pick, rand } from '../../../engine/rng';
import { isSafe, raiseSearched } from '../../../engine/sectors';
import { acceptQuest, unlockTokt } from '../../../engine/tokt';
import { best, type EventDef } from '../../../engine/events';
import { bestOf, checkOddsFor } from '../../../engine/skills';
import { nameAs } from '../../../engine/crew';
import { canRecruitStranger, STRANGER_BASE, recruitStranger, stranger, strangerIntro, strangerName } from './survivors';
import type { CrewMember, GameState, GateId, ResKey, SectorId, StatKey } from '../../../engine/types';

const recruitable = (s: GameState) => NEIGHBORS.filter((n) => !s.crew.some((c) => c.id === n.id) && !s.flags[`gone_${n.id}`]);

/** Taper opptil n av en ressurs og returnerer det som faktisk gikk tapt. */
const lose = (s: GameState, k: ResKey, n: number): number => { const l = Math.min(n, s.res[k]); s.res[k] -= l; return l; };
/** «−4 vann, −2 tre» for det som gikk tapt. Ressurser som var tomme nevnes ikke. */
const lost = (parts: [number, ResKey][]): string => parts.filter(([n]) => n > 0).map(([n, k]) => `−${n} ${k}`).join(', ') || 'ingenting å miste';
/**
 * Grunnsjansen (checkBase) for de fristende valgene der det gode utfallet er et langskudd. Sjekken er selve
 * langskuddet, så ordet ved valget («dårlig sjanse») gjelder det gode utfallet, og «Lyktes» betyr at det gikk bra.
 * Bommer den, avgjør en vanlig sjekk i samme ferdighet om det går greit eller galt (se `softMiss`).
 */
const LONG_SHOT_BASE = -0.25;
/** Når langskuddet bommer: en vanlig sjekk blant `crew` avgjør om det likevel går greit. */
const softMiss = (s: GameState, k: StatKey, crew: CrewMember[] = s.crew) => rand(s) < checkOddsFor(crew, k);
/** Gir en tilfeldig person ett skadetrinn (eller bitt, hvis hun er nede på siste) og returnerer teksten. */
function hurtOne(s: GameState, c: CrewMember, why: string): string {
  const lines: string[] = [];
  injure(s, c, why, (t) => lines.push(t), 'natt', 'stash');
  return lines.join(' ');
}
/** Alle unntatt lederen: de som kan forlate crewet. */
const others = (s: GameState) => s.crew.filter((c) => !c.me);
/** Dagens kandidat blant de andre. Avhenger bare av dagen, så teksten og valget peker på samme person. */
const kin = (s: GameState, shift = 0): CrewMember => { const o = others(s); return o[(s.day + shift) % o.length]; };
/** De som kan løpe etter den som har lagt igjen lappen: alle unntatt den som drar. */
const chasers = (s: GameState): CrewMember[] => { const n = kin(s, 1); return s.crew.filter((c) => c !== n); };
/** Fase 1 fra en bestemt dag. Brukes av hendelsene som skal holde de sene dagene i gang. */
const late = (s: GameState, day: number) => s.phase === 1 && s.day >= day;
/** Antall fase 1-sektorer som er trygge. */
const safeCount = (s: GameState) => PLAYABLE.filter((id) => isSafe(s.sectors[id])).length;
/** Sektoren med flest gjemte zombier. Teksten og valget peker på samme sted. */
const cellar = (s: GameState): SectorId | undefined =>
  PLAYABLE.filter((id) => s.sectors[id].hidden > 0).sort((a, b) => s.sectors[b].hidden - s.sectors[a].hidden)[0];
/** Porten med mest arbeid over nivået den har nådd. Stormen kan ta det arbeidet, men aldri et nivå. */
const exposedGate = (s: GameState): GateId | undefined => {
  const excess = (id: GateId) => s.gates[id].work - GATE_STEPS[s.gates[id].level];
  return GATE_IDS.filter((id) => s.gates[id].level < 3 && excess(id) >= 4).sort((a, b) => excess(b) - excess(a))[0];
};
/** Porten med minst arbeid. Dit går hjelpen. */
const weakestGate = (s: GameState): GateId => [...GATE_IDS].sort((a, b) => s.gates[a].work - s.gates[b].work)[0];

export const INTRO: EventDef = {
  id: 'intro', title: 'Tirsdag 07:42',
  channel: 'NRK P1 Rogaland',
  text: () => `«…${LANDMARKS.bybrua} er stengt i begge retninger etter det politiet kaller en «uavklart hendelse». Trafikanter bes unngå området og ikke la seg bite av andre trafikanter. Vi går over til været: regn.»\n\nNoen banker på døra. Rytmisk. Ikke på en hyggelig måte.`,
  choices: [
    { label: 'Barrikader døra med sofaen', run: (s) => { s.res.tre += 2; s.moral += 5; return 'Sofaen fra Bohus holder. Den var verdt hver krone. Dere finner også litt planker i boden.'; } },
    { label: 'Se ut av vinduet først', run: (s) => { s.sectors.hjem.seen = true; s.sectors.obs.seen = true; s.sectors.buoy_nord.seen = true; return `Du ser naboen Svein stå i hagen og tygge på en hekk. Du får god oversikt over ${SECTORS.hjem.short}, ${SECTORS.obs.short} og ${SECTORS.buoy_nord.short}.`; } },
    // Kjell kan allerede stå i stua: da ringer ingen ham
    { label: 'Ring Kjell i borettslaget', when: (s) => !s.crew.some((c) => c.id === 'kjell'), run: (s) => { s.moral += 10; return 'Kjell tar telefonen før første ring er ferdig. «Dette må tas opp på årsmøtet.» Det er så normalt at alle roer seg ned. Moralen stiger.'; } },
    { label: 'Spør Kjell hva borettslaget gjør', when: (s) => s.crew.some((c) => c.id === 'kjell'), run: (s) => { s.moral += 10; return 'Kjell blar i vedtektene. «Dette må tas opp på årsmøtet.» Det er så normalt at alle i stua roer seg ned. Moralen stiger.'; } },
  ],
};

export const EVENTS: EventDef[] = [
  {
    id: 'tesla', title: 'Teslaen',
    text: (s) => `${strangerIntro(s, 'tesla', 'En overlevende i dunvest')} banker på. Teslaen har vært hjem og kontor siden utbruddet, og nå er batteriet nesten tomt. «Bare nok til å komme meg til ${LANDMARKS.forus}.» Det er zombier i baksetet.`,
    choices: [
      { label: 'Si nei', run: () => `Teslaen rygger ut og kjører inn i ${SECTORS.obs.real}. Dere hører alarmen i en time (ingenting).` },
      { label: 'Overtal sjåføren til å gi fra seg bilen', check: 'prat', run: (s, ok) => { const n = strangerName(s, 'tesla', 'Sjåføren'); if (ok) { s.res.drivstoff += 4; s.res.skrap += 3; s.res.mat += 2; return `${n} gir dere bilen mot at dere sier det er «en ekte fremtidsbil». Dere tapper alt brukbart og tar med niste fra hanskerommet (+4 drivstoff, +3 skrap, +2 mat).`; } s.moral -= 3; return `${n} blir fornærmet og kjører. Zombiene i baksetet vinker (−3 moral).`; } },
      { label: 'Tilby en seng og en plass i crewet', check: 'prat', checkBase: STRANGER_BASE, when: (s) => canRecruitStranger(s, 'tesla'), run: (s, ok) => recruitStranger(s, 'tesla', ok, (n) => `«Jeg klarer meg selv», sier ${n}, og kjører. Zombiene i baksetet ser ikke enige ut (ingenting).`) },
    ],
  },
  {
    id: 'russebuss', title: 'Russebussen',
    when: (s) => s.day >= 3,
    text: () => `En russebuss med navnet «APOKALYPSE 2026» står med motoren i gang ved ${LANDMARKS.bybrua}. Bassen dunker. Den trekker alle zombiene i nærheten til seg.`,
    choices: [
      { label: 'La den spille. Zombiene går dit.', run: (s) => { s.sectors.sorspissen.z = Math.max(0, s.sectors.sorspissen.z - 3); return `Zombiene samles rundt bussen. ${SECTORS.sorspissen.short} blir litt tryggere, og ingen trenger å høre «Hvitt Konfekt» igjen.`; } },
      { label: 'Plyndre bussen', check: 'kondis', run: (s, ok) => { if (ok) { s.res.mat += 5; s.res.vann += 6; return 'Dere løper inn og ut. Byttet: energidrikk, pølser og en Tine-melk av ukjent alder.'; } const c = best(s, 'kondis'); c.hp = Math.max(1, c.hp - 1); return `${c.name} snublet i en russelue og ble skadet på vei ut.`; } },
    ],
  },
  {
    id: 'maaker', title: 'Måkene',
    text: () => `En flokk ${AREA.city}-måker har funnet matlageret. De er ikke redde for zombier. De er ikke redde for noe.`,
    choices: [
      { label: 'Forsvar maten', check: 'muskler', run: (s, ok) => { if (ok) return 'Måkene trekker seg tilbake. For nå. De vil huske dette.'; s.res.mat = Math.max(0, s.res.mat - 4); return 'Måkene vinner. De tar fire porsjoner og en pølse ut av hånda di.'; } },
      { label: 'Gi dem litt, de har det også tøft', run: (s) => { s.res.mat = Math.max(0, s.res.mat - 2); s.moral += 4; return 'En måke ser takknemlig ut. Kanskje. Det er vanskelig å si med måker.'; } },
    ],
  },
  {
    id: 'hurtigbat', title: 'Hurtigbåten',
    when: (s) => recruitable(s).length > 0,
    text: (s) => { const n = recruitable(s)[0]; return `En Kolumbus-hurtigbåt driver forbi ${SECTORS.tommerodden.real} uten fører. Én person står på dekk og vinker: ${n.name} (${n.age}), ${n.role.toLowerCase()}. «${n.quip}»`; },
    choices: [
      { label: 'Hent personen i land', check: 'kondis', run: (s, ok) => { const n = recruitable(s)[0]; if (!canRecruit(s)) { s.flags[`gone_${n.id}`] = true; return `${n.name} står klar på kaia, men det er ikke plass til flere. Dere har ikke senger til ${s.crew.length + 1}. Båten fortsetter mot Tau.`; } if (ok) { addNeighbor(s, n.id); return `${n.name} er med i crewet. Neste gang dere ser hurtigbåten, kjører den mot Tau.`; } s.flags[`gone_${n.id}`] = true; return `Dere når ikke fram. ${n.name} vinker tappert mens båten forsvinner mot Tau.`; } },
      { label: 'Vi har nok munner å mette', run: (s) => { const n = recruitable(s)[0]; s.flags[`gone_${n.id}`] = true; s.moral -= 4; return 'Båten forsvinner i regnet. Det føles feil.'; } },
    ],
  },
  {
    id: 'sandnes', title: 'Nødsending',
    text: () => `«Dette er nødsendingen fra Fylkeshuset. ${LANDMARKS.sandnes} har erklært seg selvstendig. Vi gjentar: ${LANDMARKS.sandnes} har erklært seg selvstendig.»\n\nIngen i crewet merker noen forskjell.`,
    choices: [
      { label: 'Skru av radioen', run: (s) => { s.moral += 3; return 'Det blir stille. Bare regn og fjern stønning. Hjemmekoselig.'; } },
      { label: 'Lytt videre etter tips', check: 'snoking', run: (s, ok) => { if (ok) { for (const id of PLAYABLE) { s.sectors[id].seen = true; s.sectors[id].scouted = true; } return `Mellom linjene får dere vite mye om ${AREA.name}. Alle sektorer er nå speidet.`; } return 'Resten av sendingen er værmelding. Regn.'; } },
    ],
  },
  {
    id: 'joggezombie', title: 'Joggezombien',
    when: (s) => s.day >= 2,
    text: () => `En zombie i Helly Hansen-tights løper i jevnt tempo rundt ${AREA.name}. Den har en Garmin. Den har aldri tatt hviledag og har ikke tenkt å begynne nå.`,
    choices: [
      { label: 'Legg en felle', check: 'mekk', run: (s, ok) => { if (ok) { s.res.medisin += 2; return 'Den løper rett inn i en presenning. Lommene inneholder Paracet og gel-poser. Personlig rekord: avsluttet.'; } return 'Den hopper over fella uten å miste tempo. Imponerende, egentlig.'; } },
      { label: 'Ignorer den', run: (s) => { s.moral -= 2; return 'Den løper forbi vinduet hver morgen klokka seks. Det tar på psyken.'; } },
    ],
  },
  {
    id: 'sirene', title: 'Skiftsirenen',
    text: () => `Klokka 07:00 går skiftsirenen ${SECTORS.rosenberg.at} av, på timer som vanlig. Alle zombier på vestsiden snur seg mot verftet.`,
    choices: [
      { label: 'Utnytt det: angrip mens de er distrahert', run: (s) => { let n = 0; for (const id of ['obs', 'tommerodden', 'hjem'] as const) { const k = Math.min(s.sectors[id].z, 2); s.sectors[id].z -= k; n += k; } s.stats.kills += n; return n > 0 ? `Dere tar ${n} ${n === 1 ? 'zombie' : 'zombier'} bakfra. Sirenen er den beste kollegaen dere har hatt.` : 'Sektorene var allerede ryddet, så det ble bare en rolig spasertur forbi verftet. Sirenen får ingen å tro på seg.'; } },
      { label: 'Forsterk gjerdet mens de samles', run: (s) => { addGateWork(s, 'ros', 4); return `Dere bruker roen til å forsterke ${GATES.ros.name}.`; } },
    ],
  },
  {
    id: 'arsmote', title: 'Ekstraordinært årsmøte',
    when: (s) => s.crew.some((c) => c.trait === 'hms'),
    text: () => 'Kjell har kalt inn til ekstraordinært årsmøte. Det er bare dere igjen i borettslaget, men vedtektene er tydelige. Sak 1: Zombier. Sak 2: Hvem som har parkert på gjesteplassen.',
    choices: [
      { label: 'Delta på møtet', run: (s) => { s.moral += 8; s.res.mat += 2; return 'Møtet varer i tre timer. Vedtak: zombier er ikke tillatt i fellesarealene. Crewet føler seg tryggere, og kaka etter sak 2 er det eneste som blir spist opp.'; } },
      { label: 'Send fullmakt og jobb videre', run: (s) => { s.res.skrap += 3; s.moral -= 3; return 'Kjell er skuffet, men dere finner skrap i sykkelboden mens resten av crewet sitter i møte.'; } },
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
    text: () => `En gjeng i oransje kjeledresser kommer gående fra ${SECTORS.tommerodden.real}. De kom i land med livbåten fra en rigg i ${LANDMARKS.nordsjoen} da helikopteret sluttet å komme, og de har holdt seg samlet siden. De har turnusmat, verktøy og en HMS-perm.`,
    choices: [
      { label: 'Bytt til dere utstyr', check: 'prat', run: (s, ok) => { if (ok) { s.res.skrap += 4; s.res.drivstoff += 3; s.res.mat += 3; s.moral += 4; return 'De vil bare ha rykter om hvor det er trygt. Dere gir dem alle dere har, og de gir dere verktøy og turnusmat (+4 skrap, +3 drivstoff, +3 mat, +4 moral).'; } return '«Vi må ta det opp med verneombudet.» De går videre for å finne en kaffemaskin (ingenting).'; } },
      { label: 'Be dem om hjelp til gjerdet', run: (s) => { addGateWork(s, 'ros', 5); return `De bygger på ${GATES.ros.name} i én dag, med full sikkerhetsbrief først (+5 arbeid på ${GATES.ros.name}).`; } },
      { label: 'Krev det de bærer på', check: 'muskler', run: (s, ok) => {
        s.moral -= 3;
        if (ok) { s.res.skrap += 5; s.res.mat += 5; return `De er flere, men dere er sintere. De legger fra seg sekkene og går (+5 skrap, +5 mat, −3 moral).`; }
        const c = best(s, 'muskler'); return `De har stått sammen på en rigg i tre uker, og det merkes. ${hurtOne(s, c, 'i krangelen med riggfolket')} (−3 moral).`;
      } },
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
    text: (s) => `En seilbåt glir inn mot kaia ved ${SECTORS.sorspissen.real}. Ved roret står ${strangerIntro(s, 'seilbat', 'en overlevende')} som har bodd om bord siden utbruddet. «Har dere drivstoff? Jeg har hermetikk!»`,
    choices: [
      { label: 'Bytt 3 drivstoff mot mat', when: (s) => s.res.drivstoff >= 3, run: (s) => { s.res.drivstoff -= 3; s.res.mat += 10; return 'Handel gjennomført. Seilbåten setter kurs mot Kvitsøy, og dere får et lykke til over rekka (−3 drivstoff, +10 mat).'; } },
      { label: 'Prut', check: 'prat', run: (s, ok) => { if (ok) { s.res.mat += 6; return 'Dere får seks hermetikkbokser, bare fordi du minner om en nevø som ble igjen på land (+6 mat).'; } return 'Seilbåten legger fra igjen. Noen mumler om «byfolk» (ingenting).'; } },
      { label: 'Be vedkommende bli igjen på land', check: 'prat', checkBase: STRANGER_BASE, when: (s) => canRecruitStranger(s, 'seilbat'), run: (s, ok) => recruitStranger(s, 'seilbat', ok, (n) => `${n} ser på dere, så på sjøen, og velger sjøen. Den har i hvert fall ikke tenner (ingenting).`) },
      { label: 'Vink farvel', run: () => 'Seilbåten forsvinner mot horisonten. Dere ser aldri hvordan det går (ingenting).' },
    ],
  },
  {
    id: 'ryfast', title: 'Lyder fra tunnelen',
    when: (s) => s.day >= 6,
    text: () => `Det kommer lyder fra ${LANDMARKS.hundvagtunnelen}. Skraping. Stønning. Og så noen som synger «Mitt hjerte er i ${AREA.city}».`,
    choices: [
      { label: `Forsterk ${GATES.nord.name}`, run: (s) => { addGateWork(s, 'nord', 3); return `Dere bruker natta på å forsterke ${GATES.nord.name}. Sangen stopper rundt fire.`; } },
      { label: 'Undersøk', check: 'nerver', run: (s, ok) => { if (ok) { s.res.drivstoff += 6; return 'Det var en zombie med Bluetooth-høyttaler. Bak ham står en tankbil med diesel.'; } s.sectors.nordkrysset.z += 3; return `Det var ikke én zombie. Tre av dem følger dere tilbake til ${SECTORS.nordkrysset.short}.`; } },
    ],
  },
  {
    id: 'vaffel', title: 'Foreldrekomiteen',
    when: (s) => s.sectors.skolen.z === 0,
    text: () => `På ${SECTORS.skolen.real} finner dere FAU-lista over hvem som skulle bake til 17. mai. Halvparten har krysset seg av.`,
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
  {
    id: 'fryseboks', title: 'Kjølebilen',
    text: () => `En kjølebil står parkert med aggregatet fortsatt i gang. Bak i lasten ligger frossen laks i kasser merket «Norge, i all slags vær». Sjåføren er ikke å se. Kjøreruta hans gikk uansett aldri forbi ${AREA.city}.`,
    choices: [
      { label: 'Ta med hele lasten hjem', run: (s) => { s.res.mat += 8; s.moral += 3; return 'Laks til alle. Det blir fiskesuppe, fiskegrateng og fiskekaker, uansett hvilken dag det er (+8 mat).'; } },
      { label: 'Ta halvparten og rygg bilen foran gjerdet', run: (s) => { s.res.mat += 4; s.sectors.hjem.control = Math.min(100, s.sectors.hjem.control + 5); return 'Dere tar det dere rekker å bære og rygger kjølebilen foran gjerdet (+4 mat). Den står bedre som vegg enn som matlager, og laksen tiner i takt med at aggregatet går tomt.'; } },
    ],
  },
  {
    id: 'garasjesalg', title: 'Garasjesalget',
    when: (s) => s.day >= 2,
    text: () => `Noen har satt opp et skilt ${AREA.at}: «GARASJESALG – alt må vekk – kun kontant». Bordet står der fortsatt. Det gjør også en kasse med verktøy ingen har kommet for å hente.`,
    choices: [
      { label: 'Ta kassa og legg igjen en lapp', run: (s) => { const k = newCard(s, 'jernia_kasse'); s.stash.push(k); return 'Dere legger igjen en lapp med «mange takk, vi skylder deg en kasse». Verktøykassa fra Jernia havner på lageret.'; } },
      { label: 'Gå gjennom resten av bordet', check: 'snoking', run: (s, ok) => { if (ok) { s.res.skrap += 3; s.res.tre += 2; return 'Under duken ligger planker og en kasse med skruer. Prisen var uansett «kom med bud».'; } return 'Bare barneklær og en stekepanne uten skaft. Kontant, selvfølgelig.'; } },
    ],
  },
  {
    id: 'ryktet', title: 'Rykter ved bussholdeplassen',
    when: (s) => s.day >= 3 && s.sectors.obs.control < 100,
    text: () => `Noen har skrevet med tusj på ruta ved bussholdeplassen: «${SECTORS.obs.real}: tomt for folk, fullt av hermetikk». Det er stavet riktig, så det er i hvert fall ikke noen fra ${LANDMARKS.sandnes}.`,
    choices: [
      { label: 'Gå dit og sjekk', check: 'snoking', run: (s, ok) => { if (ok) { s.sectors.obs.seen = true; raiseSearched(s.sectors.obs, 10); s.res.mat += 3; return 'Tre bokser pasta og en uåpnet pose Grandiosa. Dere finner også ut hvor lagerinngangen er.'; } s.sectors.obs.control = Math.max(0, s.sectors.obs.control - 5); return 'Rykter er rykter. Og noen har vært der før dere.'; } },
      { label: 'Visk ut teksten', run: (s) => { s.moral += 2; return 'De andre gjengene leser også ruter. Ikke denne. Moralen hever seg litt.'; } },
    ],
  },
  {
    id: 'sos_kran', title: 'SOS fra kranføreren',
    channel: 'Kanal 16 · kortbølge',
    when: (s) => s.day >= 6 && !s.quests.some((q) => q.id === 'sos_kran'),
    text: () => `«Er det noen der? Dette er Roger, jeg sitter i kranen ${SECTORS.rosenberg.at}. Jeg har kaffe til to dager og en hord under meg som ser oppover. Jeg har meldt avvik, men ingen svarer.»`,
    choices: [
      { label: 'Vi kommer', run: (s) => { acceptQuest(s, 'sos_kran'); return `Roger sier han skal holde ut. Han har tross alt hatt verre mandager. Et tokt til ${GATES.ros.name} er nå mulig.`; } },
      { label: 'Beklager, vi har fullt opp', run: (s) => { s.moral -= 3; return 'Stillhet på kanalen. Så: «Skjønner. Jeg skal se om jeg får inn et avviksskjema.» Det kjennes ikke bra.'; } },
    ],
  },
  // ---- Tokt som låses opp
  {
    id: 'medisinskapet', title: 'Medisinskapet er tomt',
    when: (s) => !s.toktsOpen.includes('apotek'),
    urgent: (s) => s.crew.some((c) => c.hp < 3) || s.day >= 6,
    text: (s) => {
      const hurt = s.crew.find((c) => c.hp < 3);
      return `${hurt ? `${hurt.name} trenger plaster, smertestillende og noe som ikke er gaffateip.` : 'Noen åpner medisinskapet for å se hva dere har.'} Skapet inneholder en tom eske Paracet og et termometer uten batteri. Nærmeste apotek er på senteret ${ZONES.hundvag.at}.`;
    },
    choices: [
      { label: 'Merk apoteket på kartet', run: (s) => { unlockTokt(s, 'apotek'); return `Et tokt til apoteket ${ZONES.hundvag.at} er nå mulig, gjennom ${GATES.nord.name}. Ingen har vært der siden utbruddet, så første tur bør gå greit.`; } },
    ],
  },
  {
    id: 'bybrua_rykte', title: `Bilkøen på ${LANDMARKS.bybrua}`,
    channel: 'Kanal 16 · kortbølge',
    when: (s) => s.day >= 8 && !s.toktsOpen.includes('bybrua'),
    text: () => `En stemme på radioen: «Køen på ${LANDMARKS.bybrua} står der fortsatt. Hundre biler med full tank og hyttebagasje. Og noen av dem er ikke tomme for folk, om dere skjønner.»`,
    choices: [
      { label: 'Merk køen på kartet', run: (s) => { unlockTokt(s, 'bybrua'); return `Et tokt til køen på ${LANDMARKS.bybrua} er nå mulig, gjennom ${GATES.sor.name}. Drivstoff, metall og bildeler. Og noen som kanskje lever.`; } },
    ],
  },
  // ---- Dårlige valg: hendelser der det handler om hva dere har råd til å miste
  {
    id: 'stormflo', title: 'Stormflo i lagerrommet',
    when: (s) => s.res.mat + s.res.vann >= 8,
    text: () => `Storm fra sørvest og høyvann samtidig. Sjøen presser opp gjennom sluket i kjellerboden ${SECTORS.hjem.at}, der lageret står. Det er ikke uvanlig i ${AREA.city}. Det uvanlige er at det tar med seg hermetikken.`,
    choices: [
      { label: 'Bær maten opp først', run: (s) => { const v = lose(s, 'vann', 4), t = lose(s, 'tre', 2); return `Maten kommer opp tørr. Vannkannene og plankene tar sjøvann og blir stående (${lost([[v, 'vann'], [t, 'tre']])}).`; } },
      { label: 'Redd vannkannene og plankene', run: (s) => { const m = lose(s, 'mat', 5); return `Kannene og plankene kommer opp. Hermetikken flyter ut sluket, og etikettene følger med (${lost([[m, 'mat']])}).`; } },
      { label: 'Ikke vær hero for noen bokser', run: (s) => { const m = lose(s, 'mat', 2), v = lose(s, 'vann', 2); s.moral -= 4; return `Ingen våter seg. Sjøen tar det den rekker, og alle ser på mens den gjør det (${lost([[m, 'mat'], [v, 'vann']])}, −4 moral).`; } },
    ],
  },
  {
    id: 'rotter', title: 'Rotter i maten',
    when: (s) => s.res.mat >= 6,
    text: () => 'Noe har gnagd gjennom sekkene i spiskammeret. Sporene er små og tallrike. Måkene er altså ikke den eneste konkurransen om maten.',
    choices: [
      { label: 'Kast alt som er gnagd på', run: (s) => { const m = lose(s, 'mat', 5); return `Det meste er gnagd. Resten lukter rotte (${lost([[m, 'mat']])}).`; } },
      { label: 'Kok det grundig og spis det', run: (s) => { const m = lose(s, 'mat', 2), md = lose(s, 'medisin', 1); s.moral -= 5; return `Det smaker som det ser ut. Natta går med på do og på Imodium (${lost([[m, 'mat'], [md, 'medisin']])}, −5 moral).`; } },
      { label: 'Sett ut feller og vent', run: (s) => { const m = lose(s, 'mat', 3), sk = lose(s, 'skrap', 1); s.moral -= 2; return `Fellene fanger fem rotter og en skosåle. Resten av rottene har allerede spist (${lost([[m, 'mat'], [sk, 'skrap']])}, −2 moral).`; } },
    ],
  },
  {
    id: 'stearinlys', title: 'Stearinlyset',
    when: (s) => s.day >= 2,
    text: () => 'Et stearinlys står for nært gardinene i stua. Røykvarsleren virker ikke, og det er kanskje like greit. Plutselig lukter hele huset av nylon.',
    choices: [
      { label: 'Slukk med drikkevann', run: (s) => { const v = lose(s, 'vann', 4); s.moral -= 2; return `Ilden dør, og det gjør vannet også. Gardinene er hele, bortsett fra det de har vært (${lost([[v, 'vann']])}, −2 moral).`; } },
      { label: 'Slå flammene ut med hendene', run: (s) => { const c = pick(s, s.crew), t = lose(s, 'tre', 1); return `Det virker. Det gjør også vondt. ${hurtOne(s, c, 'da gardinene tok fyr')} (${lost([[t, 'tre']])}).`; } },
      { label: 'La gardinene gå og redd det som kan reddes', run: (s) => { const t = lose(s, 'tre', 4), sk = lose(s, 'skrap', 2); s.moral -= 3; return `Gardinene, karmen og halve vindusbenken blir til aske. Det er faktisk det varmeste det har vært i huset siden i går (${lost([[t, 'tre'], [sk, 'skrap']])}, −3 moral).`; } },
    ],
  },
  {
    id: 'siste_sjokolade', title: 'Den siste Kvikk Lunsjen',
    when: (s) => s.day >= 3 && s.crew.length >= 3,
    text: () => 'Det ligger én Kvikk Lunsj igjen i kjøkkenskuffen. To av dere har sett den. Alle har sett at de to har sett den.',
    choices: [
      { label: 'Grip inn mellom dem', check: 'muskler', run: (s, ok) => { if (ok) { s.moral -= 2; return 'Dere får dem fra hverandre uten blod. Ingen snakker sammen resten av dagen (−2 moral).'; } const c = pick(s, s.crew); s.moral -= 4; return `Du havner midt i det. Én skal ha en albue, og ingen av dem husker hvem. ${hurtOne(s, c, 'i slagsmålet om sjokoladen')} (−4 moral).`; } },
      { label: 'Del den i fem biter og minn alle om at dere er voksne', run: (s) => { s.moral -= 5; return 'Alle får en bit på størrelse med et frimerke. Det er verre enn ingenting (−5 moral).'; } },
      { label: 'Spis den selv, foran alle', run: (s) => { s.moral -= 10; return 'Den er god. Det er det eneste som er godt i hele rommet (−10 moral).'; } },
    ],
  },
  {
    id: 'torrfisk', title: 'Tørrfisken',
    when: (s) => s.res.mat >= 5,
    text: () => `Tørrfisken henger på snora bak huset, slik den har gjort siden før ${AREA.city} hadde bro. En flokk måker har fått øye på den. Det er ikke en misforståelse.`,
    choices: [
      { label: 'Jag dem bort', check: 'kondis', run: (s, ok) => { if (ok) { const m = lose(s, 'mat', 2); return `Du løper rundt huset med en kost og skriker. Måkene tar to fisker og et verdig tilbaketog (${lost([[m, 'mat']])}).`; } const m = lose(s, 'mat', 6); s.moral -= 2; return `Du snubler i snora. Måkene tar resten med seg opp på taket, og ser ned på deg mens de spiser (${lost([[m, 'mat']])}, −2 moral).`; } },
      { label: 'Ta den ned og spis den halvtørr', run: (s) => { const v = lose(s, 'vann', 3); s.moral -= 4; return `Halvtørr tørrfisk er en erfaring. Resten av dagen går med på å drikke (${lost([[v, 'vann']])}, −4 moral).`; } },
    ],
  },
  {
    id: 'kartet', title: 'Kartet',
    when: (s) => s.day >= 4 && s.res.mat >= 4,
    text: () => `En mann i fiskerlue står ved gjerdet med et rynket kart. «Lager. Full kjeller. På andre siden av ${LANDMARKS.bybrua}. Fire bokser, så er det ditt.» Han har et ansikt man ikke har lyst til å stole på, og en venn som holder øye med dere.`,
    choices: [
      { label: 'Kjøp kartet for fire bokser mat', check: 'snoking', checkBase: LONG_SHOT_BASE, when: (s) => s.res.mat >= 4, run: (s, ok) => {
        s.res.mat -= 4;
        if (ok) { s.res.mat += 14; s.res.medisin += 3; return 'Lageret finnes. Kjelleren er full av hermetikk, og kartet var faktisk riktig, noe som aldri har hendt før (netto +10 mat, +3 medisin).'; }
        if (softMiss(s, 'snoking')) return 'Kartet viser til et utleveringssted som har vært tomt siden i fjor. Håndskriften er tegnet av en åtteåring (−4 mat).';
        s.sectors.sorspissen.z += 3; s.moral -= 4;
        return `Kartet var bare et lokkemiddel. Vennen hans følger dere hjem, og tre andre følger vennen hans ${SECTORS.sorspissen.at} (−4 mat, +3 zombier ${SECTORS.sorspissen.at}, −4 moral).`;
      } },
      { label: 'Ta kartet fra dem', check: 'muskler', run: (s, ok) => {
        s.moral -= 2;
        if (ok) { s.res.mat += 3; return 'De slipper kartet og sekken og forsvinner mot brua. Kartet viser en barnehage. Sekken har tre bokser (+3 mat, −2 moral).'; }
        const c = best(s, 'muskler'); return `Vennen hans hadde en kniv. ${hurtOne(s, c, 'i basketaket ved gjerdet')} (−2 moral).`;
      } },
      { label: 'Jag dem vekk', run: (s) => { s.moral -= 2; return 'De går, uten å se seg tilbake. Alle hadde håpet litt, og det bør nevnes (−2 moral).'; } },
    ],
  },
  {
    id: 'apotekruta', title: 'Apotekhylla',
    when: (s) => s.day >= 3 && !s.toktsDone.includes('apotek'), // etter toktet er hylla tømt
    text: () => `Tvers over sundet, ${ZONES.hundvag.at}, ligger Apotek 1 med lyset på. Bak glasset står en hel hylle med medisin, og en alarm som fortsatt blinker. Noen har nok tenkt det samme før dere.`,
    choices: [
      { label: 'Knus ruta og ta hyllene', check: 'nerver', checkBase: LONG_SHOT_BASE, run: (s, ok) => {
        if (ok) { s.res.medisin += 5; return 'Alarmen er bare en lampe. Hyllene er urørte: smertestillende, plaster og noe som heter Furix (+5 medisin).'; }
        const soft = softMiss(s, 'nerver');
        s.sectors.nordkrysset.z += soft ? 2 : 4;
        if (soft) { s.res.medisin += 1; return `Ruta går, men hyllene er tomme bortsett fra en pakke plaster. Alarmen trekker ${SECTORS.nordkrysset.at} (+1 medisin, +2 zombier ${SECTORS.nordkrysset.at}).`; }
        const c = pick(s, s.crew); s.moral -= 5;
        return `Glasset er tykkere enn det ser ut. Alarmen går, og flere kommer enn dere hadde regnet med. ${hurtOne(s, c, 'ved apoteket')} (+4 zombier ${SECTORS.nordkrysset.at}, −5 moral).`;
      } },
      { label: 'La det ligge', run: (s) => { s.moral -= 3; return 'Det er smart. Det føles ikke sånn. Alle vet hva som ligger der, og alle vet hvor lite plaster dere har igjen (−3 moral).'; } },
    ],
  },
  {
    id: 'bitt_bror', title: 'Broren ved porten',
    when: (s) => s.crew.length >= 3 && others(s).length > 0,
    text: (s) => { const n = kin(s); return `${n.name}s bror står ved porten. Han har gått hele veien fra fastlandet, og har et bitt i leggen, pakket inn i dagens Rogalands Avis. «Det er bare en skramme», sier han. Det er det aldri.`; },
    choices: [
      { label: 'Avvis ham ved porten', run: (s) => { const n = kin(s); s.moral -= 8; return `Han går. ${n.name} står ved vinduet lenge etterpå og snakker ikke med noen på to dager (−8 moral).`; } },
      { label: 'La ham sove i skuret', run: (s) => { const c = pick(s, s.crew); s.moral -= 4; return `Han er stille til klokka tre. Så er han ikke det. ${hurtOne(s, c, 'da broren snudde i skuret')} (−4 moral).`; } },
      { label: 'La familien gå sammen', when: (s) => s.crew.length >= 3, run: (s) => { const n = kin(s); leaveForGood(s, n); s.moral -= 6; return `${n.name} pakker sekken, tar broren under armen og går mot fastlandet. Utstyret blir igjen på lageret, men det er ikke utstyret dere kommer til å savne (${n.name} er borte for godt, −6 moral).`; } },
    ],
  },
  {
    id: 'lappen', title: 'Lappen på kjøkkenbordet',
    when: (s) => s.day >= 5 && s.moral < 55 && s.crew.length >= 3 && others(s).length > 1,
    text: (s) => { const n = kin(s, 1); return `På kjøkkenbordet ligger en lapp fra ${n.name}: «Drar til familien i ${LANDMARKS.sandnes}. Takk for alt. Beklager.» Det må stå dårlig til når folk heller vil til ${LANDMARKS.sandnes}.`; },
    choices: [
      { label: 'La vedkommende gå', run: (s) => { const n = kin(s, 1); leaveForGood(s, n); const m = lose(s, 'mat', 3); s.moral -= 6; return `${n.name} tar med seg niste og et fornuftig sett klær. Utstyret blir igjen på lageret (${n.name} er borte for godt, ${lost([[m, 'mat']])}, −6 moral).`; } },
      // den som drar, kan ikke løpe etter seg selv
      { label: 'Løp etter og snakk fornuft', check: 'kondis', checkBase: LONG_SHOT_BASE + 0.05, by: chasers, run: (s, ok) => {
        const n = kin(s, 1), c = bestOf(chasers(s), 'kondis');
        if (ok) { const m = lose(s, 'mat', 2); s.moral -= 2; return `${n.name} snur ved bommen og kommer med tilbake. Ingen sier noe om det på middagen (${lost([[m, 'mat']])}, −2 moral).`; }
        const soft = softMiss(s, 'kondis', chasers(s));
        leaveForGood(s, n);
        if (soft) { const m = lose(s, 'mat', 3); s.moral -= 6; return `${nameAs(c)} tar igjen ${n.name}, men svaret er ikke til å misforstå. ${n.name} går videre (${n.name} er borte for godt, ${lost([[m, 'mat']])}, −6 moral).`; }
        s.moral -= 8;
        return `${nameAs(c)} mister fotfestet på tangen, og ${n.name} går videre uten å se seg tilbake. ${hurtOne(s, c, 'på jakt etter en som ikke ville bli funnet')} (${n.name} er borte for godt, −8 moral).`;
      } },
    ],
  },
  // ---- Sene hendelser i fase 1. De fleste kommer først etter dag 20–40, så en lang runde ikke går tom.
  // Innsatsen er større enn i de tidlige: et godt kort kan redde en uke, et vondt kan koste en.
  // ---- Gode
  {
    id: 'nodslipp', title: 'Nødslippet',
    when: (s) => late(s, 20),
    text: () => `Et transportfly fra Sola går lavt over byøyene og slipper paller i fallskjerm. De fleste havner i Byfjorden. Én lander på taket av ${SECTORS.skolen.real}, og måkene har allerede sett den.`,
    choices: [
      { label: 'Løp og hent pallen før måkene', check: 'kondis', run: (s, ok) => {
        if (ok) { s.res.mat += 9; s.res.vann += 5; s.res.medisin += 1; return 'Dere er først. Pallen er full av feltrasjoner, vannflasker og en eske Paracet med Forsvarets logo (+9 mat, +5 vann, +1 medisin).'; }
        s.res.mat += 5; s.sectors.skolen.z += 3;
        return `Dere kommer fram samtidig med alle andre. Dere får med en kartong, og tre zombier følger lyden av fallskjermen ${SECTORS.skolen.at} (+5 mat, +3 zombier ${SECTORS.skolen.at}).`;
      } },
      { label: 'Hent resten i morgen, når det er stille', run: (s) => { s.res.mat += 5; s.res.vann += 3; return 'Når dere kommer, har måkene åpnet halve pallen og spist det som var godt. Resten er tørrmat med smak av ingenting (+5 mat, +3 vann).'; } },
    ],
  },
  {
    id: 'sjarken', title: 'Sjarken',
    when: (s) => late(s, 25),
    text: (s) => `En sjark legger til ved ${SECTORS.tommerodden.real}. Om bord er ${strangerIntro(s, 'sjark', 'en overlevende')} som har fisket alene siden utbruddet og fylt lasterommet med torsk og sei. «Kontant går ikke lenger. Diesel går.»`,
    choices: [
      { label: 'Bytt 3 drivstoff mot fisk', when: (s) => s.res.drivstoff >= 3, run: (s) => { s.res.drivstoff -= 3; s.res.mat += 10; return 'Dere får to fiskekasser og beskjed om at dere er de første kundene som ikke har prøvd å bite (−3 drivstoff, +10 mat).'; } },
      { label: 'Bytt 4 skrap mot fisk', when: (s) => s.res.skrap >= 4, run: (s) => { s.res.skrap -= 4; s.res.mat += 7; return 'Garnet trenger nye lodd. Dere trenger middag. Det er en god avtale for begge (−4 skrap, +7 mat).'; } },
      { label: 'Prut med lokalpatriotisme', check: 'prat', run: (s, ok) => { if (ok) { s.res.mat += 6; return `Dere snakker om Viking, om ${LANDMARKS.sandnes} og om hvordan det var før. Dere får en kasse sei gratis (+6 mat).`; } return 'Det viser seg at sjarken holder med Bryne. Samtalen er over (ingenting).'; } },
      { label: 'Tilby en plass i crewet', check: 'prat', checkBase: STRANGER_BASE, when: (s) => canRecruitStranger(s, 'sjark'), run: (s, ok) => recruitStranger(s, 'sjark', ok, (n) => `${n} ser på huset, på gjerdet og på dere. «Fisken klager aldri», og sjarken legger fra (ingenting).`) },
    ],
  },
  {
    id: 'konfirmasjon', title: 'Konfirmasjonsbuffeten',
    when: (s) => late(s, 12),
    text: () => `I et hus på ${SECTORS.buoy_nord.real} skulle det vært konfirmasjon søndagen etter utbruddet. Aggregatet i garasjen har holdt kjøleskapet i gang. Kransekaka står der fortsatt, sammen med spekemat, rømmegrøt og en gjesteliste med 40 navn, ingen av dem levende.`,
    choices: [
      { label: 'Bær alt hjem', run: (s) => { s.res.mat += 7; s.moral += 6; return 'Dere spiser kransekake til frokost. Ingen sier noe om det (+7 mat, +6 moral).'; } },
      { label: 'Del med gjengen i blokkene', run: (s) => { s.res.mat += 4; s.moral += 14; return 'Seks stykker fra gjengen på andre siden kommer over med en gitar og en flaske. Noen holder tale. Det er den beste kvelden siden utbruddet, og ingen prøver seg (+4 mat, +14 moral).'; } },
    ],
  },
  {
    id: 'vannverket', title: 'Det kommer vann i springen',
    when: (s) => late(s, 28),
    text: () => 'Kranene hoster, og så kommer det vann. Noen hos IVAR har holdt et pumpeanlegg i gang, alene, og tar det alvorlig. Ingen vet hvor lenge det varer.',
    choices: [
      { label: 'Fyll alt dere har', run: (s) => { s.res.vann += 9; return 'Badekaret, bøttene og alle tomme flasker. Trykket forsvinner etter to timer (+9 vann).'; } },
      { label: 'Koble opp tanken i garasjen', check: 'mekk', run: (s, ok) => {
        if (ok) { s.res.vann += 16; return 'Slangen holder, og tanken fylles helt før trykket blir borte (+16 vann).'; }
        const sk = lose(s, 'skrap', 2); s.res.vann += 6;
        return `Koblingen sprekker, og halve kjelleren får vann i stedet for tanken. Dere redder noen bøtter (+6 vann, ${lost([[sk, 'skrap']])}).`;
      } },
    ],
  },
  {
    id: 'dugnaden', title: 'Dugnaden',
    when: (s) => late(s, 15) && s.crew.length <= 3,
    text: () => `En robåt kommer over sundet fra ${ZONES.engoy.name}. Fire overlevende fra gjengen der ute, med planker, en drill og en termos. «Vi har hørt at dere er få», sier en av dem. «Det er dugnad. Det er alltid dugnad.»`,
    choices: [
      { label: 'Be dem bygge på porten', run: (s) => { const g = weakestGate(s); addGateWork(s, g, 8); s.res.tre += 4; return `De jobber til det mørkner og lar plankene som ble til overs ligge igjen (+8 arbeid på ${GATES[g].name}, +4 tre).`; } },
      { label: 'Be dem om mat i stedet', run: (s) => { s.res.mat += 6; s.res.vann += 2; return `De har med seg mer i båten enn dere hadde turt å spørre om. Vafler fra ${ZONES.engoy.name}, selvfølgelig (+6 mat, +2 vann).`; } },
    ],
  },
  {
    id: 'oppholdsvaer', title: 'Oppholdsvær',
    when: (s) => late(s, 10),
    text: () => `Det har sluttet å regne. Sola skinner over ${AREA.city}, og ingen i crewet vet helt hvordan de skal oppføre seg.`,
    choices: [
      { label: 'Ta fri og sitt i sola', run: (s) => { s.moral += 12; return 'Noen tar fram en campingstol. Noen sovner. Zombiene ser like forvirret ut som dere (+12 moral).'; } },
      { label: 'Tørk ved og klær mens det varer', run: (s) => { s.res.tre += 4; s.moral += 4; return 'Plankene som lå i regnet blir brukbare igjen. Det regner igjen klokka fire, som forventet (+4 tre, +4 moral).'; } },
    ],
  },
  {
    id: 'grossist_rykte', title: `Lageret på ${LANDMARKS.forus}`,
    channel: 'Kanal 16 · kortbølge',
    when: (s) => s.phase === 1 && !s.toktsOpen.includes('grossist') && (s.day >= 30 || (s.day >= 18 && safeCount(s) >= 5)),
    text: () => `En sliten stemme på radioen: «Til alle som hører: grossistlageret på ${LANDMARKS.forus} står urørt. Paller med hermetikk, mel og tørrfisk. Vi kom oss ikke inn, for halve ${LANDMARKS.sandnes} står utenfor. Men dere er kanskje flere enn oss.»`,
    choices: [
      { label: 'Merk lageret på kartet', run: (s) => { unlockTokt(s, 'grossist'); return `Et tokt til grossistlageret på ${LANDMARKS.forus} er nå mulig, gjennom ${GATES.sor.name}. Det er langt, det er farlig, og det er mer mat enn dere har sett på en måned.`; } },
    ],
  },
  // ---- Vonde
  {
    id: 'fryseren', title: 'Fryseren gir opp',
    when: (s) => late(s, 20) && s.res.mat >= 15,
    text: () => 'Fryseboksen i garasjen har sluttet å surre. Lokket er varmt. Inni ligger elgkjøtt, fiskekaker og alt dere har spart på.',
    choices: [
      { label: 'Spis det som tiner, i dag', run: (s) => { const m = lose(s, 'mat', 6); s.moral += 4; return `Det blir fest, med mer kjøtt enn noen klarer. Resten går til måkene (${lost([[m, 'mat']])}, +4 moral).`; } },
      { label: 'Salt det ned med sjøvann', check: 'mekk', run: (s, ok) => {
        if (ok) { const m = lose(s, 'mat', 2); return `Det blir saltkjøtt, slik oldemor lagde det. Nesten alt holder (${lost([[m, 'mat']])}).`; }
        const m = lose(s, 'mat', 8); s.moral -= 3;
        return `Det blir for lite salt og for mye sjø. Etter tre dager lukter hele garasjen (${lost([[m, 'mat']])}, −3 moral).`;
      } },
    ],
  },
  {
    id: 'omgangssyke', title: 'Omgangssyken',
    when: (s) => late(s, 15) && s.crew.length >= 4,
    text: () => 'Først var det én. Så var det tre. Nå står det kø utenfor do, og den som står sist, ser ikke bra ut.',
    choices: [
      { label: 'Bruk medisinen', when: (s) => s.res.medisin >= 2, run: (s) => { const md = lose(s, 'medisin', 2), v = lose(s, 'vann', 2); return `Imodium og Paracet til alle som spør. Det går over på to dager (${lost([[md, 'medisin'], [v, 'vann']])}).`; } },
      { label: 'Drikk vann og vent', run: (s) => { const v = lose(s, 'vann', 6); s.moral -= 6; return `Det går over. Det tar en uke, og det er en lang uke (${lost([[v, 'vann']])}, −6 moral).`; } },
      { label: 'Isoler de syke i boden', run: (s) => { const c = kin(s), v = lose(s, 'vann', 2); s.moral -= 3; return `De andre slipper unna. ${c.name} gjør ikke det. ${hurtOne(s, c, 'av omgangssyken')} (${lost([[v, 'vann']])}, −3 moral).`; } },
    ],
  },
  {
    id: 'stormen', title: 'Høststormen',
    when: (s) => late(s, 20) && !!exposedGate(s),
    text: (s) => `Stormen kommer inn fra ${LANDMARKS.nordsjoen} med full kraft. Vinden river i det dere har bygd på ${GATES[exposedGate(s)!].name}, og plankene begynner å løsne én etter én.`,
    choices: [
      { label: 'Spikre fast med alt dere har', when: (s) => s.res.tre >= 4, run: (s) => { const t = lose(s, 'tre', 4); s.moral -= 2; return `Dere står ute hele natta og spikrer. Porten holder, og plankene på lageret er brukt opp (${lost([[t, 'tre']])}, −2 moral).`; } },
      { label: 'Gå inn og vent det ut', run: (s) => { const g = exposedGate(s)!, n = Math.min(8, s.gates[g].work - GATE_STEPS[s.gates[g].level]); s.gates[g].work -= n; s.moral -= 2; return `Om morgenen ligger halve forsterkningen spredt utover veien. Nivået holder, men arbeidet må gjøres på nytt (−${n} arbeid på ${GATES[g].name}, −2 moral).`; } },
    ],
  },
  {
    id: 'tyveriet', title: 'Noen har vært i lageret',
    when: (s) => late(s, 22) && s.res.mat >= 8 && s.res.vann >= 6,
    text: () => 'Døra til lageret står på gløtt. Noen fra en annen gjeng har vært her i natt, og de visste hva de lette etter. Det er gjørmespor i gangen, og de går mot sjøen.',
    choices: [
      { label: 'La det gå', run: (s) => { const m = lose(s, 'mat', 6), v = lose(s, 'vann', 4); s.moral -= 2; return `Dere setter en ny lås på døra. Det er det dere kan gjøre (${lost([[m, 'mat'], [v, 'vann']])}, −2 moral).`; } },
      { label: 'Følg sporene', check: 'snoking', run: (s, ok) => {
        if (ok) { s.res.mat += 4; s.moral += 3; return 'Sporene ender i et naust. Tyvene er borte, men de har lagt igjen både det de tok og sitt eget (+4 mat, +3 moral).'; }
        const m = lose(s, 'mat', 6), v = lose(s, 'vann', 4), c = best(s, 'snoking');
        return `Sporene ender i sjøen. Noe venter i naustet, og det er ikke tyvene. ${hurtOne(s, c, 'i naustet')} (${lost([[m, 'mat'], [v, 'vann']])}).`;
      } },
    ],
  },
  {
    id: 'sandnesradio', title: `Radio ${LANDMARKS.sandnes}`,
    channel: 'Kanal 16 · kortbølge',
    when: (s) => late(s, 12),
    text: () => `En ny stasjon på kanal 16: «Dette er Radio ${LANDMARKS.sandnes}. Vi har strøm, vi har mat, og vi har sol. ${AREA.city} er tapt. Det var det kanskje alltid.» Hele crewet står rundt radioen.`,
    choices: [
      { label: 'Skru av', run: (s) => { s.moral -= 5; return 'Det blir stille. Ingen sier det, men alle lurer på om de har sol (−5 moral).'; } },
      { label: 'Svar dem på kanalen', check: 'prat', run: (s, ok) => {
        if (ok) { s.moral += 10; return `Du minner dem om at ${LANDMARKS.sandnes} har Kvadrat og ingenting annet. Det blir stille på kanalen. Crewet jubler (+10 moral).`; }
        s.moral -= 10; return 'De har bedre argumenter. Og bedre vær. Det er det verste (−10 moral).';
      } },
    ],
  },
  {
    id: 'bolgen', title: `Bølgen over ${LANDMARKS.bybrua}`,
    when: (s) => late(s, 40),
    text: () => `Om morgenen ser dere dem: en lang rekke som sjangler over ${LANDMARKS.bybrua}, tett i tett. Sentrum er tomt for levende, og det som er igjen, har begynt å lete andre steder.`,
    choices: [
      { label: `Møt dem ved ${GATES.sor.name}`, check: 'muskler', run: (s, ok) => {
        if (ok) { s.stats.kills += 6; s.res.skrap += 3; return 'Brua er smal, og dere tar dem én etter én. Seks av dem kommer aldri over, og de hadde nøkkelknipper og verktøy i lommene (6 zombier tatt, +3 skrap).'; }
        const c = best(s, 'muskler'); s.sectors.sorspissen.z += 4;
        return `Det er for mange. Dere trekker dere tilbake, og fire kommer seg forbi. ${hurtOne(s, c, 'ved sperringen')} (+4 zombier ${SECTORS.sorspissen.at}).`;
      } },
      { label: `Lokk dem mot ${SECTORS.rosenberg.short} med bilhorn`, when: (s) => s.res.drivstoff >= 3, run: (s) => { s.res.drivstoff -= 3; s.sectors.rosenberg.z += 6; return `Bilen står med hornet i gang ved verftsgjerdet til tanken er tom. Hele rekka snur. Det blir et problem senere (−3 drivstoff, +6 zombier ${SECTORS.rosenberg.at}).`; } },
      { label: 'Steng og vent', run: (s) => { const sec = s.sectors.sorspissen; sec.z += 6; sec.control = Math.max(0, sec.control - 15); s.moral -= 3; return `Dere sitter stille med lyset av. De fleste går forbi. Seks gjør det ikke (+6 zombier ${SECTORS.sorspissen.at}, −15 kontroll der, −3 moral).`; } },
    ],
  },
  {
    id: 'gryta', title: 'Køen ved gryta',
    when: (s) => late(s, 15) && s.crew.length >= 6,
    text: () => 'Gryta er like stor som før. Crewet er ikke det. Noen har begynt å stille seg i kø en halvtime før middag, og noen har begynt å telle hvem som jobbet i dag.',
    choices: [
      { label: 'Dobbel porsjon til alle i kveld', run: (s) => { const m = lose(s, 'mat', 8); s.moral += 4; return `Alle blir mette, for én kveld. Det løser ingenting, men det er hyggelig (${lost([[m, 'mat']])}, +4 moral).`; } },
      { label: 'Halve porsjoner resten av uka', run: (s) => { s.moral -= 8; return 'Ingen sulter. Alle er sultne. Det er ikke det samme, men det kjennes sånn (−8 moral).'; } },
      { label: 'Den som ikke jobber, spiser ikke', check: 'prat', run: (s, ok) => {
        if (ok) { s.moral += 2; return 'Du holder en tale om dugnadsånd. Det virker, mot alle odds (+2 moral).'; }
        const m = lose(s, 'mat', 3); s.moral -= 12;
        return `Talen går dårlig. Noen spiser ute i garasjen i protest, og noen tar med seg mer enn sin del (${lost([[m, 'mat']])}, −12 moral).`;
      } },
    ],
  },
  // ---- Sjansespill: sjekken avgjør et stort utslag
  {
    id: 'naustet', title: 'Den som bor i naustet',
    when: (s) => late(s, 30) && !!stranger(s, 'naust'),
    text: (s) => { const n = stranger(s, 'naust')!; return `I et naust ved ${SECTORS.tommerodden.real} har noen bodd alene i en måned. ${n.name} (${n.age}), ${n.role.toLowerCase()}, står i døra med en båtshake og stoler ikke på noen. «${n.quip}»`; },
    choices: [
      { label: 'Overtal vedkommende til å bli med', check: 'prat', checkBase: STRANGER_BASE, when: (s) => canRecruit(s), run: (s, ok) => recruitStranger(s, 'naust', ok, (n) => `Du sier noe feil. Du vet ikke hva. ${n} lukker døra, og bak den hører dere båtshaken bli satt på plass (ingenting).`) },
      { label: 'Bytt: fire bokser mot det som henger i naustet', when: (s) => s.res.mat >= 4, run: (s) => { s.res.mat -= 4; s.res.tre += 4; s.res.skrap += 4; return 'Du får årer, tauverk, en kasse med skruer og tørre planker fra hems. Alle er fornøyde (−4 mat, +4 tre, +4 skrap).'; } },
      { label: 'Gi mat og la vedkommende være', when: (s) => s.res.mat >= 2, run: (s) => { s.res.mat -= 2; s.moral += 5; return 'Dere setter to bokser utenfor døra og går. Neste morgen henger det en tørket sei på gjerdet deres. Det føles riktig (−2 mat, +5 moral).'; } },
      { label: 'La naustet være', run: () => 'Dere går. Båtshaken følger dere med blikket (ingenting).' },
    ],
  },
  {
    id: 'kjellerdora', title: 'Noe banker i kjelleren',
    when: (s) => late(s, 25) && !!cellar(s),
    text: (s) => `Fra en kjeller ${SECTORS[cellar(s)!].realAt} kommer det banking. Jevnt, tålmodig, hele natta. Døra er av stål, og den holder. Foreløpig.`,
    choices: [
      { label: 'Gå ned med lommelykt', check: 'nerver', run: (s, ok) => {
        const id = cellar(s)!, sec = s.sectors[id];
        if (ok) { const n = sec.hidden; sec.hidden = 0; s.stats.kills += n; raiseSearched(sec, 10); return `Det er trangt, mørkt og over på fem minutter. Kjelleren er tom etterpå (${n} gjemte zombier tatt ${SECTORS[id].at}).`; }
        const c = best(s, 'nerver'); sec.hidden += 2;
        return `Lommelykta slukner på nederste trinn. ${hurtOne(s, c, 'i kjelleren')} Bankingen har fått selskap (+2 gjemte zombier ${SECTORS[id].at}).`;
      } },
      { label: 'Spikre igjen døra', run: (s) => { const id = cellar(s)!, sec = s.sectors[id], t = lose(s, 'tre', 2); sec.control = Math.min(100, sec.control + 10); return `Dere spikrer planker over døra og maler «IKKE ÅPNE» på dem. Bankingen fortsetter, men lenger unna (${lost([[t, 'tre']])}, +10 kontroll ${SECTORS[id].at}).`; } },
    ],
  },
  {
    id: 'containeren', title: 'Containeren',
    when: (s) => late(s, 18),
    text: () => `Stormen har lagt en container på land ved ${SECTORS.tommerodden.real}. Den er plombert, merket «Rotterdam – ${AREA.city}», og den lager lyder når det blåser. Bare når det blåser, håper dere.`,
    choices: [
      { label: 'Bryt opp plomben', check: 'mekk', run: (s, ok) => {
        if (ok && rand(s) < 0.5) { s.res.mat += 11; s.res.vann += 4; return 'Containeren er full av nederlandsk ost, kjeks og flaskevann. Noen i Rotterdam har vært optimistiske på vegne av dere (+11 mat, +4 vann).'; }
        if (ok) { s.res.tre += 5; s.res.skrap += 4; return 'Flatpakkede møbler fra et svensk varehus. Ingen bruksanvisning trengs: det blir planker og skruer (+5 tre, +4 skrap).'; }
        const c = best(s, 'mekk'); return `Døra åpner seg brått, og lydene var ikke vinden. ${hurtOne(s, c, 'ved containeren')} Det som var inni, er borte i regnet (ingenting å hente).`;
      } },
      { label: `Slep den foran ${GATES.sor.name}`, run: (s) => { addGateWork(s, 'sor', 6); return `Med bil, tau og mye banning står containeren til slutt på tvers av veien. Uåpnet. Noen må leve med det (+6 arbeid på ${GATES.sor.name}).`; } },
    ],
  },
  {
    id: 'pokerkveld', title: 'Pokerkvelden',
    when: (s) => late(s, 20) && s.crew.length >= 3,
    text: () => `En gjeng fra ${ZONES.hundvag.name} roper over sundet ved ${GATES.nord.name}. De har en kortstokk, en flaske Linje og et forslag: poker, med mat som innsats. «Seks bokser. Vi har sett at dere har.»`,
    choices: [
      { label: 'Sats seks bokser', check: 'nerver', when: (s) => s.res.mat >= 6, run: (s, ok) => {
        if (ok) { s.res.mat += 6; s.res.medisin += 1; s.moral += 3; return 'Du sitter med et par femmere og et ansikt av stein. De legger seg. Potten er deres, og de kaster med en eske plaster av ren respekt (+6 mat, +1 medisin, +3 moral).'; }
        s.res.mat -= 6; s.moral -= 3; return `Du blinker. De ser det. Seks bokser ror over sundet mot ${ZONES.hundvag.name} (−6 mat, −3 moral).`;
      } },
      { label: 'Spill om fyrstikker', run: (s) => { s.moral += 5; return 'Ingen vinner noe, og alle har det morsomt. Det er det nærmeste en vanlig fredag dere har kommet (+5 moral).'; } },
    ],
  },
  {
    id: 'tilfluktsrommet', title: 'Tilfluktsrommet',
    when: (s) => late(s, 35),
    text: () => `Under ${SECTORS.skolen.real} skal det være et tilfluktsrom fra den kalde krigen. Ingen har sett nøkkelen siden 1987. Det står på et skilt, i hvert fall, og skiltet er det eneste som er vedlikeholdt.`,
    choices: [
      { label: 'Let etter inngangen', check: 'snoking', run: (s, ok) => {
        if (ok) { s.res.mat += 8; s.res.vann += 6; s.res.medisin += 2; return 'Bak en hylle med gymmatter er døra. Inni står Sivilforsvarets lager, uåpnet siden Gorbatsjov (+8 mat, +6 vann, +2 medisin).'; }
        s.res.vann += 3; s.moral -= 2; return 'Dere finner bare en bod med vannkanner fra 1991 og en plakat om jodtabletter (+3 vann, −2 moral).';
      } },
      { label: 'Spør Kjell. Han sitter i alle styrer.', when: (s) => s.crew.some((c) => c.id === 'kjell'), run: (s) => { s.res.mat += 6; s.res.vann += 6; s.res.medisin += 1; return 'Kjell har nøkkelen. Han har hatt den hele tiden, i en konvolutt merket «Beredskap». Han har bare ikke fått spørsmålet (+6 mat, +6 vann, +1 medisin).'; } },
    ],
  },
];

