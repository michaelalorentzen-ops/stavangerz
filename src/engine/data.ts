// Statiske spilldata: sektorer, sperringer, egenskaper og naboer i fase 1.
import type { Flag, GateId, MapSectorId, PhaseId, ResKey, Resources, SectorId, SectorKind, StatKey, Stats, TraitId } from './types';

export interface SectorDef {
  name: string;
  short: string;
  desc: string;
  kind: SectorKind;
  /** 1–5, styrer hvor seige zombiene er og hvor farlig det er å rydde */
  threat: 1 | 2 | 3 | 4 | 5;
  /** boliger sektoren gir når den er bosatt */
  capacity: number;
  /** hva Sanke gir per dag */
  yield: Partial<Resources>;
  z: number;
  hidden: number;
  loot: Resources;
  /** funn når halve sektoren er gjennomsøkt */
  special?: { text: string; res?: Partial<Resources>; card?: string; flag?: Flag; moral?: number };
  locked?: boolean;
}

export interface GateDef {
  name: string;
  desc: string;
  /** sektoren som må være klarert før det kan bygges, og som får inntrengerne */
  sector: SectorId;
  /** posisjon på kartet */
  x: number;
  y: number;
  /** grunnsjanse for gjennombrudd om natta */
  base: number;
}

export interface NeighborDef {
  id: string;
  name: string;
  age: number;
  role: string;
  trait: TraitId;
  stats: Stats;
  quip: string;
}

export const STATS: StatKey[] = ['muskler', 'kondis', 'snoking', 'nerver', 'mekk', 'prat'];
export const STAT_LABEL: Record<StatKey, string> = { muskler: 'Muskler', kondis: 'Kondis', snoking: 'Snoking', nerver: 'Nerver', mekk: 'Mekk', prat: 'Prat' };
export const STAT_HINT: Record<StatKey, string> = {
  muskler: 'Slå hardt, bære mye',
  kondis: 'Løpe fra ting, unngå bitt',
  snoking: 'Finne ting, se kjellere',
  nerver: 'Holde hodet kaldt',
  mekk: 'Bygge, fikse, sveise',
  prat: 'Overtale, rekruttere, handle',
};
export const RES: ResKey[] = ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'strom', 'drivstoff'];
export const RES_LABEL: Record<ResKey, string> = { mat: 'Mat', vann: 'Vann', medisin: 'Medisin', tre: 'Tre', skrap: 'Skrap', metall: 'Metall', strom: 'Strøm', drivstoff: 'Drivstoff' };
/** ressursene som alltid vises i toppfeltet i hver fase (andre vises når de er over 0) */
export const PHASE_RES: Record<PhaseId, ResKey[]> = {
  1: ['mat', 'vann', 'medisin', 'tre', 'skrap'],
  2: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'drivstoff'],
  3: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'drivstoff'],
  4: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'strom', 'drivstoff'],
  5: ['mat', 'vann', 'medisin', 'tre', 'skrap', 'metall', 'strom', 'drivstoff'],
};

export const HEALTH_LABEL = ['Bitt', 'Ille ute', 'Skrapt opp', 'Frisk'];

export const SECTORS: Record<MapSectorId, SectorDef> = {
  hjem: {
    name: 'Hjemme', short: 'Hjemme',
    kind: 'hjem', threat: 1, capacity: 6, yield: { vann: 2 },
    desc: 'Rekkehuset ditt ved motorveien. Kaffetrakteren virker fortsatt. Naboen gjør ikke det.',
    z: 4, hidden: 1,
    loot: { mat: 10, vann: 12, medisin: 1, tre: 1, skrap: 2, metall: 0, strom: 0, drivstoff: 0 },
    special: { text: 'Naboens fryseboks: 6 kilo elgkjøttdeig og en pose isbiter fra 2019.', res: { mat: 6 } },
  },
  tommerodden: {
    name: 'Tømmerodden', short: 'Tømmerodden',
    kind: 'kai', threat: 2, capacity: 2, yield: { mat: 3 },
    desc: 'SOTS sikkerhetssenter og Skoleskipet Gann. Folk her har kurs i å overleve. Kurset dekket ikke dette.',
    z: 9, hidden: 3,
    loot: { mat: 6, vann: 6, medisin: 7, tre: 2, skrap: 2, metall: 0, strom: 0, drivstoff: 3 },
    special: { text: 'Skoleskipet Gann ligger fortøyd med fulle tanker. Noter deg det til fase 2. Dere tar med førstehjelpsskapet.', res: { medisin: 4 }, flag: 'gann' },
  },
  obs: {
    name: 'Obs Bygg Buøy', short: 'Obs Bygg',
    kind: 'butikk', threat: 2, capacity: 0, yield: { skrap: 1 },
    desc: 'Ukens tilbud: alt. Gangene er fulle av spikerpistoler, presenning og zombier i arbeidsklær.',
    z: 11, hidden: 3,
    loot: { mat: 4, vann: 4, medisin: 0, tre: 8, skrap: 12, metall: 0, strom: 0, drivstoff: 2 },
    special: { text: 'Verktøyavdelingen er urørt. En spikerpistol havner på lageret. Ukens tilbud, tilsynelatende.', card: 'spikerpistol_obs' },
  },
  nordkrysset: {
    name: 'Nordkrysset', short: 'Nordkrysset',
    kind: 'industri', threat: 2, capacity: 0, yield: { skrap: 2, drivstoff: 1 },
    desc: 'Rundkjøringene mot Hundvåg. Rushtidskø fra helvete, bokstavelig talt. Mange biler med full tank.',
    z: 14, hidden: 3,
    loot: { mat: 6, vann: 6, medisin: 2, tre: 1, skrap: 2, metall: 0, strom: 0, drivstoff: 12 },
    special: { text: 'En politibil står i grøfta. Bagasjerommet har en hagle og en eske patroner. Betjenten trenger dem ikke lenger.', card: 'hagle_politibil' },
  },
  buoy_nord: {
    name: 'Buøy nord', short: 'Buøy nord',
    kind: 'bolig', threat: 1, capacity: 6, yield: { mat: 1, vann: 1, tre: 1 },
    desc: 'Eneboliger, barnehage og trampoliner. Rolig nabolag. Var det.',
    z: 10, hidden: 3,
    loot: { mat: 20, vann: 16, medisin: 3, tre: 2, skrap: 2, metall: 0, strom: 0, drivstoff: 2 },
    special: { text: 'En garasje med aggregat og hele Biltema-katalogen. Befesting går raskere fra nå.', flag: 'aggregat' },
  },
  skolen: {
    name: 'Buøy skole', short: 'Skolen',
    kind: 'offentlig', threat: 2, capacity: 8, yield: { mat: 1, medisin: 1 },
    desc: 'Det var foreldremøte i går kveld. Mange ble igjen. Kantina har frysevafler.',
    z: 16, hidden: 4,
    loot: { mat: 26, vann: 14, medisin: 3, tre: 1, skrap: 2, metall: 0, strom: 0, drivstoff: 0 },
    special: { text: 'Kantina: 300 frysevafler og en spann syltetøy. Moralen stiger merkbart.', res: { mat: 6 }, moral: 15 },
  },
  sorspissen: {
    name: 'Sørspissen', short: 'Sørspissen',
    kind: 'industri', threat: 2, capacity: 0, yield: { skrap: 2 },
    desc: 'Rundkjøringen ved Bybrua. Herfra kommer alt som vil inn fra byen.',
    z: 12, hidden: 3,
    loot: { mat: 8, vann: 6, medisin: 1, tre: 2, skrap: 3, metall: 0, strom: 0, drivstoff: 6 },
    special: { text: 'En Kolumbus-buss står parkert med nøkkelen i. Rute 6, Hundvåg via sentrum. Transport til fase 2 er sikret.', flag: 'buss' },
  },
  rosenberg: {
    name: 'Rosenberg Verft', short: 'Rosenberg',
    kind: 'industri', threat: 5, capacity: 0, yield: {},
    desc: 'Kraner, stål og kaier. Perfekt HQ. Problemet er at hele morgenskiftet fortsatt er på jobb.',
    z: 0, hidden: 0, loot: { mat: 0, vann: 0, medisin: 0, tre: 0, skrap: 0, metall: 0, strom: 0, drivstoff: 0 },
    locked: true,
  },
};
export const PLAYABLE: SectorId[] = ['hjem', 'tommerodden', 'obs', 'nordkrysset', 'buoy_nord', 'skolen', 'sorspissen'];

export const GATES: Record<GateId, GateDef> = {
  nord: { name: 'Nordporten', desc: 'Sperring mot Hundvåg. Alt som går, kjører eller sjangler fra nord kommer hit.', sector: 'nordkrysset', x: 1790, y: 1605, base: 0.35 },
  sor: { name: 'Bybrusperringen', desc: 'Sperring over Bybrua-avkjøringen. Byen er full av folk som ikke lenger er folk.', sector: 'sorspissen', x: 2245, y: 2492, base: 0.4 },
  ros: { name: 'Rosenberg-gjerdet', desc: 'Verftsgjerdet holder hordene på Rosenberg inne. Det er bygd for å stoppe tyver, ikke dette.', sector: 'hjem', x: 1985, y: 2265, base: 0.35 },
};
export const GATE_STEPS = [0, 6, 14, 24];

export const ZONE_INFO: Record<string, string> = {
  hundvag: 'Meny, Apotek 1, Jernia og Dolly Dimples. Rykter om mye mat, mange zombier og et borettslag som fortsatt holder årsmøte.',
  engoy: 'Engøy. Stille. For stille. Noen har skrevet «IKKE KOM» på et laken.',
  solyst: 'Sølyst. Båthavn og villaer. Noen fyrer opp grillen hver kveld klokka seks.',
  grasholmen: 'Grasholmen. Liten, men med utsikt over hele Vågen.',
  bjornoy: 'Bjørnøy. Ingen bjørner. Det er bekreftet.',
  roaldsoy: 'Roaldsøy. Skole og eneboliger. Lys i vinduene om natta.',
  ormoy: 'Ormøy. Smale veier, mange hager, kort vei til sjøen.',
  steinsoy: 'Steinsøy. Ferjekaien. Den som har båt har makt.',
  bjergsted: 'Bjergsted og fastlandet. Konserthuset spiller fortsatt Grieg på loop.',
};

export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  lokalkjent: { name: 'Lokalkjent', desc: 'Vet hvor alt er på Buøy. +2 når du leter.' },
  filmnerd: { name: 'Har sett alle zombiefilmene', desc: '+10 Nerver. Sier «sikt mot hodet» ved enhver anledning.' },
  dugnad: { name: 'Fast inventar på dugnad', desc: '+2 når du befester. Har alltid med egen drill.' },
  hms: { name: 'HMS-ansvarlig', desc: 'Befestninger blir solide (+2), men fyller ut avviksskjema etter hver kamp.' },
  nattevakt: { name: 'Nattevakt på SUS', desc: 'Lapper sammen crewet. Hviledager helbreder alltid, og sparer ofte medisin.' },
  sveiser: { name: 'Sveiser på Rosenberg', desc: '+3 når du befester. Kjenner verftet ut og inn (fase 2).' },
  russ: { name: 'Russ 2026', desc: 'Løper fort og redd. Har ingen respekt for noe, inkludert zombier.' },
  regneark: { name: 'Regnearket', desc: 'Oljeingeniør. Viser den ekte sikkerhetsprosenten etter klarering.' },
  hv: { name: 'Heimevernet', desc: '+2 i kamp. Forteller om øvelse Cold Response hver kveld.' },
  buss: { name: 'Kolumbus-sjåfør', desc: 'Kan kjøre hva som helst gjennom hva som helst (fase 2). +10 Kondis på oppdrag.' },
  los: { name: 'Pensjonert los', desc: 'Kjenner hvert skjær. Ser ting andre overser: +0,1 til å finne skjulte zombier.' },
  kokk: { name: 'Kokk på Fisketorget', desc: 'Får mat til å strekke lenger. Crewet bruker 1 porsjon mindre mat per dag.' },
};
export const SELF_TRAITS: TraitId[] = ['lokalkjent', 'filmnerd', 'dugnad'];

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
