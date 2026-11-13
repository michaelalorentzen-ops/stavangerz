/** Playtest numbers for the region game. Hypotheses to balance, kept out of the engine and the UI. */
import type { ActionId, RegionSurvivor, Weapon } from './types';

export const REGION_RULES_VERSION = 'region-0.4';
export const SAVE_KEY_REGION = 'stavanger-z.region.v2';

export const R = {
  workHours: 8,
  hopHours: 1,
  reachHops: 3,
  carryPerPerson: 30,
  /** Day 0 is 1 April. */
  startMonth: 3,
  zombieShare: .12,
  residentFloorM2: 55,
  migration: { mobilityRate: .035, noiseWeight: .5, attemptsPerDurability: 3 },
  borderMetersPerCapacity: 120,
  linkCapacity: { bridge: 6, tunnel: 8 },
  baseDefense: 4,
  claimMaxZombies: 3,
  claimMinSearched: .1,
  searchFloorM2PerHour: 150,
  otherBuildingHours: 2,
  injuryPerExcessZombie: 3,
  barricadeDurability: 12,
  blockDurability: 30,
  fortifyCost: { building: 3 },
  blockCost: { building: 8 },
  blowCost: { explosives: 2 },
  startStock: { food: 40, water: 40, medicine: 6, fuel: 10, ammo: 30, building: 12, parts: 4, batteries: 4 } as Record<string, number>,
  dailyFood: 1, dailyWater: 1,
  winterFuelPerPerson: .25,
  morale: { start: 62, hunger: -6, thirst: -8, death: -14, recruit: 3, power: 1, idleRecovery: 1 },
  recruitChancePerSearchHour: .006,
  eventEveryDays: 7, minorEventChance: .08,
  boatReachKm: 3,
  ferryReachKm: 8,
  /** Share of its dead the start zone keeps on day 0. Dense centres stay deadly. */
  startZombieShare: .3,
  crewCap: 12,
  samplesPerKills: 12,
};

export const WEAPONS: Record<Weapon, { kills: number; ammo: number; noise: number; label: string }> = {
  melee: { kills: 2.2, ammo: 0, noise: 1, label: 'Nærkampvåpen' },
  pistol: { kills: 3.2, ammo: .6, noise: 3, label: 'Pistol' },
  shotgun: { kills: 4.2, ammo: .8, noise: 5, label: 'Hagle' },
  rifle: { kills: 3.8, ammo: .7, noise: 6, label: 'Jaktrifle' },
};

export const ACTIONS: Record<ActionId, { label: string; help: string; noise: number }> = {
  travel: { label: 'Reis og bli', help: 'Reis langs en faktisk åpen rute. Lag og utstyr blir på målet.', noise: 0 },
  return: { label: 'Returner / omdiriger', help: 'Hent et stasjonert lag tilbake langs en fysisk rute.', noise: 0 },
  retrieve: { label: 'Hent fra depot', help: 'Hent lagrede ressurser og utstyr med faktisk bærekapasitet.', noise: 0 },
  supply: { label: 'Lever forsyninger', help: 'Reserver last ved avreise og lever den fysisk til et lokalt depot.', noise: 0 },
  areaGuard: { label: 'Områdevakt', help: 'Reis til et kontrollert område og hold perimeteren over flere døgn.', noise: 0 },
  investigate: { label: 'Undersøk spor', help: 'Undersøk et oppdaget lokalt spor.', noise: 0 },
  discoveryChoice: { label: 'Følg opp funn', help: 'Gjennomfør et valg ved et undersøkt sted.', noise: 0 },
  scout: { label: 'Speid', help: 'Se hvor mange zombier som er der, og hva som kan finnes. Lite støy.', noise: 0 },
  clear: { label: 'Rydd', help: 'Drep zombier. Skytevåpen dreper flere, men bruker ammunisjon og lager støy som trekker andre til.', noise: 1 },
  search: { label: 'Søk', help: 'Gå gjennom bygg og hent det som finnes. Kan gi nye overlevende.', noise: 1 },
  claim: { label: 'Overta', help: 'Gjør sonen til deres. Krever at den er nesten tom for zombier.', noise: 0 },
  fortify: { label: 'Sperr grensene', help: 'Bygg sperringer mot nabosoner dere ikke eier. Zombier må slite dem ned for å komme inn.', noise: 1 },
  build: { label: 'Bygg ut', help: 'Bygg en oppgradering i sonen.', noise: 1 },
  establishHq: { label: 'Etabler HQ', help: 'Gjør sonen til hovedkvarter. Folk bor her, og moduler kan bygges.', noise: 0 },
  module: { label: 'Bygg HQ-modul', help: 'Bygg en modul i hovedkvarteret.', noise: 1 },
  network: { label: 'Bygg nett', help: 'Bygg strøm, samband, veier eller vann for hele L2-området.', noise: 1 },
  guard: { label: 'Hold vakt', help: 'Ekstra forsvar i sonen i natt.', noise: 0 },
  hold: { label: 'Hold forbindelsen', help: 'Vakter på brua eller i tunnelen. Zombier stoppes, dere kan passere.', noise: 0 },
  block: { label: 'Sperr forbindelsen', help: 'Barrikade på brua eller i tunnelen. Kan rives igjen.', noise: 1 },
  blow: { label: 'Spreng', help: 'Forbindelsen er borte for alle. En tunnel kan ikke åpnes igjen.', noise: 8 },
  farm: { label: 'Dyrk', help: 'Arbeid på jorda. Avlingen avhenger av årstid og hvor mye jord sonen har.', noise: 0 },
  fish: { label: 'Fisk', help: 'Fisk fra båt. Krever båt og kyst.', noise: 0 },
  rest: { label: 'Hvil', help: 'Mindre utmattelse og litt bedre helse.', noise: 0 },
  heal: { label: 'Behandle', help: 'Bruk medisin på skadde. Medisinsk kompetanse hjelper mye.', noise: 0 },
  craft: { label: 'Lag', help: 'Lag noe i HQ-et med riktige moduler.', noise: 1 },
  research: { label: 'Forsk', help: 'Arbeid med forskningsprosjektet i HQ. Håndverk og medisin teller.', noise: 0 },
  relocate: { label: 'Flytt leiren hit', help: 'Hele gruppen flytter. Det dere ikke kan bære, blir igjen. Bare før dere har et HQ.', noise: 2 },
  assault: { label: 'Angrip gruppen', help: 'Tokt mot en annen gruppes base. Vinner dere, er basen og lageret deres.', noise: 6 },
  repair: { label: 'Reparer brua', help: 'Bygg opp en sprengt bru igjen.', noise: 2 },
  wonder: { label: 'Bygg ut det unike stedet', help: 'Arbeid på neste nivå. Byggelaget hjelper til når arbeidet er i gang.', noise: 1 },
};

/** Costs and hours for L3 upgrades from the catalog. */
export const UPGRADE_COST: Record<string, { cost: Record<string, number>; hours: number; daily?: Record<string, number>; defense?: number }> = {
  greenhouse: { cost: { building: 10, parts: 2 }, hours: 24, daily: { food: 3 } },
  field: { cost: { parts: 2 }, hours: 16 },
  demolishField: { cost: {}, hours: 24 },
  salvage: { cost: {}, hours: 20 },
  fishing: { cost: { building: 6 }, hours: 12 },
  solarPark: { cost: { solar: 4, batteries: 4, electronics: 2 }, hours: 16 },
  rainwater: { cost: { building: 4 }, hours: 8, daily: { water: 5 } },
  barricades: { cost: { building: 6 }, hours: 10 },
  watchpost: { cost: { building: 5 }, hours: 8, defense: 6 },
  saltworks: { cost: { metal: 4, building: 4 }, hours: 16, daily: { salt: 1 } },
};

export const MODULE_COST: Record<string, { cost: Record<string, number>; hours: number; defense?: number; daily?: Record<string, number> }> = {
  kitchen: { cost: { building: 6, parts: 2 }, hours: 12 },
  medbay: { cost: { building: 6, medicine: 4 }, hours: 12 },
  gate: { cost: { building: 8, metal: 4 }, hours: 12, defense: 4 },
  workshop: { cost: { building: 8, parts: 4 }, hours: 16 },
  heavyWorkshop: { cost: { metal: 12, parts: 8, generator: 1 }, hours: 32 },
  ammoLab: { cost: { metal: 4, parts: 4 }, hours: 16 },
  housing: { cost: { building: 14 }, hours: 20 },
  greenhouse: { cost: { building: 10, parts: 2 }, hours: 20, daily: { food: 4 } },
  watchtower: { cost: { building: 8 }, hours: 12, defense: 8 },
  training: { cost: { building: 6, ammo: 10 }, hours: 12 },
  lab: { cost: { electronics: 6, medicine: 10, generator: 1 }, hours: 32 },
  saltworks: { cost: { metal: 4, building: 4 }, hours: 16, daily: { salt: 2 } },
  classroom: { cost: { building: 6 }, hours: 10 },
  refuge: { cost: { building: 10, food: 10 }, hours: 16 },
  radioRoom: { cost: { radio: 1, batteries: 4, electronics: 2 }, hours: 10 },
  depot: { cost: { building: 10 }, hours: 14 },
  dock: { cost: { building: 8 }, hours: 12 },
  overview: { cost: { building: 6 }, hours: 10, defense: 3 },
  walls: { cost: { building: 16, metal: 4 }, hours: 24, defense: 12 },
  rooftop: { cost: { building: 10, parts: 2 }, hours: 16, daily: { food: 4 } },
};

export const NETWORK_COST: Record<string, { cost: Record<string, number>; hours: number; needs: string; facility?: string[] }> = {
  power: { cost: { solar: 6, batteries: 6, parts: 4 }, hours: 24, needs: 'Trafostasjon i området og solceller og batterier', facility: ['substation', 'incinerator'] },
  comms: { cost: { radio: 1, batteries: 2, electronics: 4 }, hours: 12, needs: 'Sambandstårn i området, eller radiorom i HQ', facility: ['commsTower'] },
  roads: { cost: { building: 12, fuel: 6 }, hours: 24, needs: 'Ryddede veier gjennom området' },
  water: { cost: { parts: 6, building: 6 }, hours: 20, needs: 'Vannverk eller vanntårn i området', facility: ['waterworks', 'waterTower', 'wastewater'] },
};

/** Rough worth of one unit, for trade. */
export const VALUE: Record<string, number> = {
  food: 1, water: .6, medicine: 4, fuel: 2, ammo: 1.5, building: .8, metal: 1.5, parts: 2, electronics: 3, salt: 1.2,
  batteries: 3, solar: 12, generator: 18, antibiotics: 14, primers: 2, radio: 12, engine: 20, boat: 35, printer: 50, explosives: 8,
};

/** Loot per zone: per home, and per kind of place. */
export const LOOT_PER_HOME: Record<string, number> = { food: 1.5, water: 1.2, medicine: .3, fuel: 1.2, building: 1.5, parts: .5, batteries: .3, electronics: .2, salt: .2 };
export const LOOT_PER_SITE: Record<string, Record<string, number>> = {
  supermarket: { food: 90, water: 70, salt: 12, batteries: 10 }, pharmacy: { medicine: 45, antibiotics: 4 },
  clinic: { medicine: 20, antibiotics: 1 }, gunShop: { ammo: 120, primers: 25 }, outdoorShop: { ammo: 40, primers: 6, boat: 1, batteries: 8 },
  shootingRange: { ammo: 60, primers: 12 }, hardware: { building: 80, parts: 20, generator: 2, solar: 3, salt: 6 },
  electronics: { electronics: 40, batteries: 20, radio: 2, printer: 1 }, carRepair: { parts: 40, engine: 1, fuel: 20 },
  fuelStation: { fuel: 150, food: 15 }, solarRoof: { solar: 10, batteries: 6 }, marina: { boat: 4, engine: 2, fuel: 20 },
  warehouse: { building: 40, parts: 15 }, school: { printer: 1, electronics: 10, food: 20, medicine: 4 },
  quarry: { explosives: 8, building: 40, fuel: 20 }, industry: { metal: 40, parts: 20 },
  military: { ammo: 400, primers: 60, explosives: 12, radio: 3, fuel: 80, medicine: 30 }, hospital: { medicine: 200, antibiotics: 40, generator: 2 },
  mall: { food: 250, water: 150, salt: 20, electronics: 30, batteries: 30 }, shipyard: { metal: 200, parts: 60, engine: 3, building: 60 },
  airport: { fuel: 400, parts: 40, radio: 2, electronics: 20 }, police: { ammo: 80, primers: 10, radio: 2 },
  fireStation: { fuel: 40, medicine: 15, engine: 1 }, landfill: { metal: 80, parts: 30, building: 60 },
  fuelDepot: { fuel: 300 }, harbour: { boat: 3, engine: 2, fuel: 40 }, ferry: { boat: 1, fuel: 30 },
};

export const START_CREW: Omit<RegionSurvivor, 'joinedDay'>[] = [
  { id: 'ingrid', name: 'Ingrid', role: 'Speider', about: 'Lokalkjent og rask.', traits: ['suspicious'], loyalty: 70, skills: { combat: 3, scouting: 6, craft: 1, medical: 1 }, weapon: 'pistol', health: 100, fatigue: 0, alive: true },
  { id: 'marius', name: 'Marius', role: 'Jeger', about: 'Rolig under press, men rifla høres langt.', traits: ['hard'], loyalty: 65, skills: { combat: 6, scouting: 2, craft: 1, medical: 1 }, weapon: 'rifle', health: 100, fatigue: 0, alive: true },
  { id: 'leila', name: 'Leila', role: 'Sykepleier', about: 'Holder folk på beina.', traits: ['kind', 'parent'], loyalty: 70, skills: { combat: 1, scouting: 2, craft: 1, medical: 6 }, weapon: 'melee', health: 100, fatigue: 0, alive: true },
  { id: 'tor', name: 'Tor', role: 'Mekaniker', about: 'Får ting til å holde en natt til.', traits: ['loner'], loyalty: 60, skills: { combat: 3, scouting: 1, craft: 6, medical: 1 }, weapon: 'melee', health: 100, fatigue: 0, alive: true },
];
export const RECRUIT_POOL: Omit<RegionSurvivor, 'joinedDay' | 'id'>[] = [
  { name: 'Sunniva', role: 'Bonde', about: 'Vet hva som gror her.', traits: ['parent'], loyalty: 55, skills: { combat: 2, scouting: 2, craft: 3, medical: 1 }, weapon: 'melee', health: 85, fatigue: 0, alive: true },
  { name: 'Kenneth', role: 'Elektriker', about: 'Kan få strøm i et hus igjen.', traits: ['hard'], loyalty: 55, skills: { combat: 2, scouting: 1, craft: 5, medical: 1 }, weapon: 'melee', health: 90, fatigue: 0, alive: true },
  { name: 'Amina', role: 'Lege', about: 'Jobbet på SUS til siste dag.', traits: ['kind'], loyalty: 55, skills: { combat: 1, scouting: 2, craft: 1, medical: 7 }, weapon: 'melee', health: 80, fatigue: 0, alive: true },
  { name: 'Ola', role: 'Fisker', about: 'Har egen båt et sted i Vågen.', traits: ['devout'], loyalty: 55, skills: { combat: 3, scouting: 3, craft: 3, medical: 1 }, weapon: 'shotgun', health: 95, fatigue: 0, alive: true },
  { name: 'Hanne', role: 'Politi', about: 'Har fortsatt tjenestevåpenet.', traits: ['suspicious', 'hard'], loyalty: 55, skills: { combat: 6, scouting: 3, craft: 1, medical: 2 }, weapon: 'pistol', health: 90, fatigue: 0, alive: true },
  { name: 'Erik', role: 'Snekker', about: 'Bygger raskere enn han snakker.', traits: ['parent'], loyalty: 55, skills: { combat: 3, scouting: 1, craft: 6, medical: 1 }, weapon: 'melee', health: 95, fatigue: 0, alive: true },
  { name: 'Mia', role: 'Student', about: 'Lærer fort og klatrer overalt.', traits: ['kind'], loyalty: 55, skills: { combat: 2, scouting: 5, craft: 2, medical: 2 }, weapon: 'melee', health: 100, fatigue: 0, alive: true },
  { name: 'Rune', role: 'Soldat', about: 'Kom seg ut fra Madlaleiren.', traits: ['hard'], loyalty: 55, skills: { combat: 7, scouting: 3, craft: 2, medical: 2 }, weapon: 'rifle', health: 75, fatigue: 0, alive: true },
  { name: 'Grete', role: 'Pensjonist', about: 'Husker hvordan man sylter og salter.', traits: ['devout', 'kind'], loyalty: 55, skills: { combat: 0, scouting: 1, craft: 3, medical: 3 }, weapon: 'melee', health: 70, fatigue: 0, alive: true },
  { name: 'Jonas', role: 'Mekaniker', about: 'Har kjørt traktor siden han var tolv.', traits: ['loner'], loyalty: 55, skills: { combat: 3, scouting: 2, craft: 5, medical: 1 }, weapon: 'melee', health: 95, fatigue: 0, alive: true },
];

/** NPC groups, placed at the first HQ candidate of the listed type that is not too close to the player's start. */
export const FACTIONS = [
  { id: 'garrison', name: 'Garnisonen', hqType: 'military', about: 'Soldater og vernepliktige som holder leiren.', offers: ['ammo', 'primers', 'explosives', 'radio'], wants: ['food', 'medicine', 'fuel'] },
  { id: 'hospital', name: 'SUS-leiren', hqType: 'hospital', about: 'Helsepersonell og pasienter som ikke kunne flyttes.', offers: ['medicine', 'antibiotics'], wants: ['food', 'fuel', 'batteries'] },
  { id: 'yard', name: 'Verftsfolket', hqType: 'shipyard', about: 'Sveisere og mekanikere på verftet.', offers: ['metal', 'parts', 'engine'], wants: ['food', 'medicine'] },
  { id: 'airport', name: 'Flyplassen', hqType: 'airport', about: 'Bakkemannskap med drivstofflageret.', offers: ['fuel', 'parts', 'electronics'], wants: ['food', 'ammo'] },
  { id: 'traders', name: 'Handelslaget', hqType: 'mall', about: 'Butikkansatte som gjorde senteret til marked.', offers: ['food', 'salt', 'batteries', 'electronics'], wants: ['ammo', 'medicine', 'fuel'] },
  { id: 'farmers', name: 'Øybøndene', hqType: 'coastFarm', about: 'Bønder og fiskere som klarer seg selv.', offers: ['food', 'salt', 'boat'], wants: ['fuel', 'ammo', 'parts', 'medicine'] },
  { id: 'church', name: 'Domkirkesamfunnet', hqType: 'refuge', about: 'Folk som søkte ly og ble.', offers: ['food'], wants: ['food', 'medicine', 'building'] },
  // Two that are dangerous. The gang says what it wants. The fellowship smiles.
  { id: 'gang', name: 'Gjengen', hqType: 'mall', about: 'Bevæpnede menn som tar det de vil ha. De kaller det beskyttelse.', offers: ['ammo', 'fuel'], wants: ['food', 'medicine'], hostile: true, minHops: 6 },
  { id: 'fellowship', name: 'Fellesskapet', hqType: 'school', about: 'Smilende folk med rene klær og mye mat. De sier alle er velkomne.', offers: ['food', 'medicine'], wants: ['ammo', 'fuel', 'parts'], masked: true, minHops: 5 },
] as { id: string; name: string; hqType: string; about: string; offers: string[]; wants: string[]; hostile?: boolean; masked?: boolean; minHops?: number }[];

export const SEASONS = [
  { months: [11, 0, 1], name: 'Vinter', farm: .1 },
  { months: [2, 3, 4], name: 'Vår', farm: .5 },
  { months: [5, 6, 7], name: 'Sommer', farm: 1.1 },
  { months: [8, 9, 10], name: 'Høst', farm: 1.4 },
];

export const MILESTONES: { id: string; title: string; text: string }[] = [
  { id: 'claimStart', title: 'Et trygt sted', text: 'Ta over en sone.' },
  { id: 'hq', title: 'Hovedkvarter', text: 'Etabler et HQ i en sone dere eier.' },
  { id: 'food', title: 'Mat som kommer igjen', text: 'Produser mat: dyrk, fisk eller bygg drivhus.' },
  { id: 'fiveZones', title: 'Et lite rike', text: 'Eie fem soner.' },
  { id: 'contact', title: 'Ikke alene', text: 'Få kontakt med en annen gruppe.' },
  { id: 'trade', title: 'Byttehandel', text: 'Gjennomfør en handel.' },
  { id: 'district', title: 'Et helt område', text: 'Eie alle L3-sonene i ett L2-område.' },
  { id: 'network', title: 'Infrastruktur', text: 'Bygg et nett i et L2-område.' },
  { id: 'day60', title: 'To måneder', text: 'Overlev 60 dager.' },
];
