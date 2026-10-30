// Naboene som kan bli med i crewet. De er herfra, og det merkes.
import type { NeighborDef } from '../../engine/data';

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
];
export const START_NEIGHBORS = ['kjell', 'mona', 'arild', 'sondre', 'ingrid', 'toregil', 'leah', 'bjarne'];
