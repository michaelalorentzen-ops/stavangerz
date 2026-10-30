// Naboene som kan bli med i crewet. De er herfra, og det merkes.
import type { NeighborDef } from '../../engine/data';
import type { TraitId } from '../../engine/types';
import { AREA, LANDMARKS, SECTORS } from './places';

export const NEIGHBORS: NeighborDef[] = [
  { id: 'kjell', name: 'Kjell', age: 64, role: 'Styreleder i borettslaget', trait: 'hms', stats: { muskler: 18, kondis: 18, snoking: 38, nerver: 38, mekk: 38, prat: 58 }, quip: 'Har allerede kalt inn til ekstraordinært årsmøte.' },
  { id: 'mona', name: 'Mona', age: 41, role: 'Sykepleier', trait: 'nattevakt', stats: { muskler: 28, kondis: 38, snoking: 38, nerver: 58, mekk: 18, prat: 38 }, quip: 'Har sett verre på legevakta en lørdag.' },
  { id: 'arild', name: 'Arild', age: 52, role: 'Sveiser', trait: 'sveiser', stats: { muskler: 48, kondis: 28, snoking: 28, nerver: 38, mekk: 58, prat: 18 }, quip: 'Sier ingenting. Sveiser bare.' },
  { id: 'sondre', name: 'Sondre', age: 19, role: 'Russ', trait: 'russ', stats: { muskler: 38, kondis: 58, snoking: 28, nerver: 28, mekk: 18, prat: 38 }, quip: 'Russebussen het «Apokalypse 2026». Ironisk nok.' },
  { id: 'ingrid', name: 'Ingrid', age: 33, role: 'Oljeingeniør', trait: 'regneark', stats: { muskler: 28, kondis: 38, snoking: 48, nerver: 38, mekk: 48, prat: 28 }, quip: 'Har laget et regneark over overlevelsessannsynlighet. Det er ikke oppmuntrende.' },
  { id: 'toregil', name: 'Tor-Egil', age: 47, role: 'Heimevernet', trait: 'hv', stats: { muskler: 48, kondis: 38, snoking: 28, nerver: 48, mekk: 28, prat: 18 }, quip: 'Har ventet på denne dagen i 25 år.' },
  { id: 'leah', name: 'Leah', age: 28, role: 'Bussjåfør', trait: 'buss', stats: { muskler: 38, kondis: 38, snoking: 38, nerver: 48, mekk: 38, prat: 28 }, quip: 'Har kjørt nattbussen fra Skagen. Dette er bare en vanlig fredag.' },
  { id: 'bjarne', name: 'Bjarne', age: 71, role: 'Los', trait: 'los', stats: { muskler: 18, kondis: 18, snoking: 58, nerver: 58, mekk: 38, prat: 38 }, quip: 'Kaller zombiene «turistene».' },
  { id: 'gunn', name: 'Gunn', age: 58, role: 'Kokk', trait: 'kokk', stats: { muskler: 38, kondis: 28, snoking: 38, nerver: 38, mekk: 28, prat: 48 }, quip: 'Kan lage fiskesuppe av ingenting. Har gjort det før.' },
  { id: 'roger', name: 'Roger', age: 58, role: 'Kranfører', trait: 'sveiser', stats: { muskler: 38, kondis: 28, snoking: 28, nerver: 58, mekk: 58, prat: 28 }, quip: 'Jeg har meldt avvik på hele apokalypsen.', special: true },
];
export const START_NEIGHBORS = ['kjell', 'mona', 'arild', 'sondre', 'ingrid', 'toregil', 'leah', 'bjarne'];

/** Hva hver egenskap heter og gjør. Effekten står i motoren; teksten er lokal. */
export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  lokalkjent: { name: 'Lokalkjent', desc: `Vet hvor alt er ${AREA.at}. +2 når du leter.` },
  filmnerd: { name: 'Har sett alle zombiefilmene', desc: '+10 Nerver. Sier «sikt mot hodet» ved enhver anledning.' },
  dugnad: { name: 'Fast inventar på dugnad', desc: '+2 når du befester. Har alltid med egen drill.' },
  hms: { name: 'HMS-ansvarlig', desc: 'Befestninger blir solide (+2), men fyller ut avviksskjema etter hver kamp.' },
  nattevakt: { name: `Nattevakt på ${LANDMARKS.sus}`, desc: 'Lapper sammen crewet. Hviledager helbreder alltid, og sparer ofte medisin.' },
  sveiser: { name: `Sveiser ${SECTORS.rosenberg.at}`, desc: '+3 når du befester. Kjenner verftet ut og inn (fase 2).' },
  russ: { name: 'Russ 2026', desc: 'Løper fort og redd. Har ingen respekt for noe, inkludert zombier.' },
  regneark: { name: 'Regnearket', desc: `Oljeingeniør. Har regneark over alle kjellere ${AREA.at}, og viser det eksakte antallet gjemte zombier.` },
  hv: { name: 'Heimevernet', desc: '+2 i kamp. Forteller om øvelse Cold Response hver kveld.' },
  buss: { name: 'Kolumbus-sjåfør', desc: 'Kan kjøre hva som helst gjennom hva som helst (fase 2). +10 Kondis på oppdrag.' },
  los: { name: 'Pensjonert los', desc: 'Kjenner hvert skjær. Ser ting andre overser: +0,1 til å finne skjulte zombier.' },
  kokk: { name: 'Kokk på Fisketorget', desc: 'Får mat til å strekke lenger. Crewet bruker 1 porsjon mindre mat per dag.' },
};
export const SELF_TRAITS: TraitId[] = ['lokalkjent', 'filmnerd', 'dugnad'];
