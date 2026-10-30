// Stavanger, fase 1: Buøy. Alle steder, porter og soner er definert her, og resten av spillet
// henter navnene herfra via id. Bytt navn her, så endres det overalt.
import type { GateDef, SectorDef } from '../../engine/data';
import type { GateId, MapSectorId, SectorId, ZoneId } from './ids';

export const SECTORS: Record<MapSectorId, SectorDef> = {
  hjem: {
    name: 'Hjemme', short: 'Hjemme', at: 'hjemme', real: 'Hjemme', realAt: 'hjemme',
    kind: 'hjem', threat: 1, capacity: 6, yield: { vann: 2 },
    desc: 'Rekkehuset ditt ved motorveien. Kaffetrakteren virker fortsatt. Naboen gjør ikke det.',
    z: 4, hidden: 1,
    loot: { mat: 10, vann: 12, medisin: 1, tre: 1, skrap: 2, metall: 0, strom: 0, drivstoff: 0 },
    special: { text: 'Naboens fryseboks: 6 kilo elgkjøttdeig og en pose isbiter fra 2019.', res: { mat: 6 } },
  },
  tommerodden: {
    name: 'Kaia', short: 'Kaia', at: 'på kaia', real: 'Tømmerodden', realAt: 'på Tømmerodden',
    kind: 'kai', threat: 2, capacity: 2, yield: { mat: 4 },
    desc: 'SOTS sikkerhetssenter og Skoleskipet Gann. Folk her har kurs i å overleve. Kurset dekket ikke dette.',
    z: 9, hidden: 3,
    loot: { mat: 6, vann: 6, medisin: 7, tre: 2, skrap: 2, metall: 0, strom: 0, drivstoff: 3 },
    special: { text: 'Skoleskipet Gann ligger fortøyd med fulle tanker. Noter deg det til fase 2. Dere tar med førstehjelpsskapet.', res: { medisin: 4 }, flag: 'gann' },
  },
  obs: {
    name: 'Byggvarehuset', short: 'Byggvarehuset', at: 'på byggvarehuset', real: 'Obs Bygg', realAt: 'på Obs Bygg',
    kind: 'butikk', threat: 2, capacity: 0, yield: { skrap: 1 },
    desc: 'Ukens tilbud: alt. Gangene er fulle av spikerpistoler, presenning og zombier i arbeidsklær.',
    z: 11, hidden: 3,
    loot: { mat: 4, vann: 4, medisin: 0, tre: 8, skrap: 12, metall: 0, strom: 0, drivstoff: 2 },
    special: { text: 'Verktøyavdelingen er urørt. En spikerpistol havner på lageret. Ukens tilbud, tilsynelatende.', card: 'spikerpistol_obs' },
  },
  nordkrysset: {
    name: 'Krysset', short: 'Krysset', at: 'i krysset', real: 'Nordkrysset', realAt: 'i Nordkrysset',
    kind: 'industri', threat: 2, capacity: 0, yield: { skrap: 2, drivstoff: 1 },
    desc: 'Rundkjøringene mot Hundvåg. Rushtidskø fra helvete, bokstavelig talt. Mange biler med full tank.',
    z: 14, hidden: 3,
    loot: { mat: 6, vann: 6, medisin: 2, tre: 1, skrap: 2, metall: 0, strom: 0, drivstoff: 12 },
    special: { text: 'En politibil står i grøfta. Bagasjerommet har en hagle og en eske patroner. Betjenten trenger dem ikke lenger.', card: 'hagle_politibil' },
  },
  buoy_nord: {
    name: 'Boligfeltet', short: 'Boligfeltet', at: 'i boligfeltet', real: 'Buøy nord', realAt: 'på Buøy nord',
    kind: 'bolig', threat: 1, capacity: 6, yield: { mat: 1, vann: 1, tre: 1 },
    desc: 'Eneboliger, barnehage og trampoliner. Rolig nabolag. Var det.',
    z: 10, hidden: 3,
    loot: { mat: 20, vann: 16, medisin: 3, tre: 2, skrap: 2, metall: 0, strom: 0, drivstoff: 2 },
    special: { text: 'En garasje med aggregat og hele Biltema-katalogen. Befesting går raskere fra nå.', flag: 'aggregat' },
  },
  skolen: {
    name: 'Skolen', short: 'Skolen', at: 'på skolen', real: 'Buøy skole', realAt: 'på Buøy skole',
    kind: 'offentlig', threat: 2, capacity: 8, yield: { mat: 1, medisin: 1 },
    desc: 'Det var foreldremøte i går kveld. Mange ble igjen. Kantina har frysevafler.',
    z: 16, hidden: 4,
    loot: { mat: 26, vann: 14, medisin: 3, tre: 1, skrap: 2, metall: 0, strom: 0, drivstoff: 0 },
    special: { text: 'Kantina: 300 frysevafler og en spann syltetøy. Moralen stiger merkbart.', res: { mat: 6 }, moral: 15 },
  },
  sorspissen: {
    name: 'Industriområdet', short: 'Industriområdet', at: 'på industriområdet', real: 'Sørspissen', realAt: 'på Sørspissen',
    kind: 'industri', threat: 2, capacity: 0, yield: { skrap: 2 },
    desc: 'Rundkjøringen ved Bybrua. Herfra kommer alt som vil inn fra byen.',
    z: 12, hidden: 3,
    loot: { mat: 8, vann: 6, medisin: 1, tre: 2, skrap: 3, metall: 0, strom: 0, drivstoff: 6 },
    special: { text: 'En Kolumbus-buss står parkert med nøkkelen i. Rute 6, Hundvåg via sentrum. Transport til fase 2 er sikret.', flag: 'buss' },
  },
  rosenberg: {
    name: 'Rosenberg Verft', short: 'Rosenberg', at: 'på Rosenberg', real: 'Rosenberg Verft', realAt: 'på Rosenberg',
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
  ros: { spills: ['hjem', 'obs', 'tommerodden', 'sorspissen'], name: 'Rosenberg-gjerdet', desc: 'Verftsgjerdet holder hordene på Rosenberg inne. Det er bygd for å stoppe tyver, ikke dette.', sector: 'hjem', x: 1985, y: 2265, base: 0.35 },
};
export const ZONE_INFO: Partial<Record<ZoneId, string>> = {
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


/** Sonene utenfor fase 1-området. Formen på kartet bygges fra map.config.json. */
export const ZONES: Record<ZoneId, { name: string; at: string }> = {
  hundvag: { name: 'Hundvåg', at: 'på Hundvåg' },
  engoy: { name: 'Engøy', at: 'på Engøy' },
  solyst: { name: 'Sølyst', at: 'på Sølyst' },
  grasholmen: { name: 'Grasholmen', at: 'på Grasholmen' },
  bjornoy: { name: 'Bjørnøy', at: 'på Bjørnøy' },
  roaldsoy: { name: 'Roaldsøy', at: 'på Roaldsøy' },
  ormoy: { name: 'Ormøy', at: 'på Ormøy' },
  steinsoy: { name: 'Steinsøy', at: 'på Steinsøy' },
  sentrum: { name: 'Sentrum', at: 'i sentrum' },
  bjergsted: { name: 'Bjergsted', at: 'på Bjergsted' },
};

/** Området fase 1 foregår i, og byen rundt */
export const AREA = {
  name: 'Buøy', at: 'på Buøy',
  city: 'Stavanger',
  /** bydelen området hører til, uten ordet «bydel» */
  district: 'Hundvåg',
  coords: '58°59′N 5°43′Ø',
};

/** Kjente steder som nevnes i tekstene, men som ikke er sektorer eller soner */
export const LANDMARKS = {
  bybrua: 'Bybrua',
  hundvagtunnelen: 'Hundvågtunnelen',
  sandnes: 'Sandnes',
  nordsjoen: 'Nordsjøen',
} as const;
