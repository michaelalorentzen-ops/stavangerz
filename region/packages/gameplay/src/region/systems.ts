/**
 * Data for the deeper systems in v0.2: phases, laws, research, zombie mutations, perimeter tiers and traits.
 * Numbers are hypotheses to balance. The engine reads them; nothing here runs logic.
 */
import type { Stance, Trait, WorkId } from './types';

// ------------------------------------------------------------------ phases

export interface PhaseDef {
  id: number; name: string; intro: string;
  goals: { id: string; text: string }[];
  /** Difficulty knobs for this phase. */
  mods: { mobility: number; noise: number; horde: number; raid: number; rot: number; lootFind: number };
  unlocks: string[];
}
/** HYPOTESE H08: early capacity gate, deliberately tuneable after playtesting. */
export const PHASE_ONE_CAPACITY = {
  connectedL3: 3,
  supplyDays: 3,
  barrierDurability: 5,
} as const;
export const PHASES: PhaseDef[] = [
  { id: 1, name: 'Utbruddet', intro: 'Strømmen er borte, telefonene er døde, og ropene fra gata har stilnet. Det som gjelder nå, er å finne et sted dere kan holde.',
    goals: [
      { id: 'hq', text: 'Etabler et HQ i en kontrollert sone.' },
      { id: 'phaseOneCore', text: 'Sikre et sammenhengende kjerneområde rundt HQ (eller hele L2).' },
      { id: 'phaseOneDefense', text: 'Sperr en utsatt grense eller bygg varig forsvar (hele L2 teller også).' },
      { id: 'phaseOneSupplies', text: 'Sørg for minst tre døgn med mat- og vannkapasitet.' },
    ],
    mods: { mobility: 1, noise: 1, horde: .7, raid: 0, rot: 0, lootFind: 1 }, unlocks: [] },
  { id: 2, name: 'Hovedkvarteret', intro: 'Dere har et sted. Nå kommer folk. Noen ber om hjelp, noen vil ha det dere har. Unntakstilstanden er deres å forvalte.',
    goals: [{ id: 'zones6', text: 'Eie seks soner.' }, { id: 'modules3', text: 'Bygg to HQ-moduler.' }, { id: 'pop12', text: 'Bli minst tolv personer.' }],
    mods: { mobility: 1.1, noise: 1.1, horde: 1, raid: .6, rot: 0, lootFind: .9 }, unlocks: ['Lover', 'Forskning', 'Arbeidsfordeling'] },
  { id: 3, name: 'Ekspansjon', intro: 'Hyllene i nabolaget er tomme. Det dere spiser fra nå, må dere dyrke, fiske eller bytte til dere. Og zombiene har forandret seg.',
    goals: [{ id: 'district', text: 'Eie et helt L2-område.' }, { id: 'pop30', text: 'Bli minst 30 personer.' }, { id: 'tech6', text: 'Fullfør seks forskningsprosjekter.' }],
    mods: { mobility: 1.2, noise: 1.2, horde: 1.3, raid: 1, rot: 0, lootFind: .75 }, unlocks: ['Styreform', 'Tokt mot grupper'] },
  { id: 4, name: 'Bydelen', intro: 'Dere styrer mer enn et nabolag. Det gjør dere til et mål, for zombier og for alle som heller vil ta enn å dyrke.',
    goals: [{ id: 'districts3', text: 'Eie tre hele L2-områder.' }, { id: 'network', text: 'Bygg et nett i et L2-område.' }, { id: 'pop50', text: 'Bli minst 50 personer.' }],
    mods: { mobility: 1.25, noise: 1.25, horde: 1.6, raid: 1.4, rot: .002, lootFind: .6 }, unlocks: ['Bru-reparasjon'] },
  { id: 5, name: 'Fraksjonene', intro: 'De døde begynner å råtne bort. Det som står igjen, er de levende og hva de vil med hverandre.',
    goals: [{ id: 'win', text: 'Vinn: 30 dager med stabilitet, en kur, eller hele regionen samlet.' }],
    mods: { mobility: 1.1, noise: 1.2, horde: 1.2, raid: 1.6, rot: .01, lootFind: .5 }, unlocks: ['Seier'] },
];

// ------------------------------------------------------------------ laws

export interface LawEffect {
  accidents?: number; sickMult?: number;
  hope?: number; discontent?: number; foodMult?: number; dependentFood?: number; workMult?: number; childWork?: number; childResearch?: number;
  crime?: number; refugees?: number; lawCooldown?: number; guardMult?: number; researchMult?: number; healthPerDay?: number; fatigue?: number;
}
export interface LawDef { id: string; group: string; phase: number; name: string; text: string; effect: LawEffect; tags?: Stance[]; needsTech?: string }
export const LAW_GROUPS: Record<string, string> = {
  rations: 'Rasjonering', work: 'Arbeid', children: 'Barna', punish: 'Straff', bitten: 'De bitte', dead: 'De døde', gates: 'Porten', order: 'Ro og orden', gov: 'Styreform',
};
export const LAWS: LawDef[] = [
  { id: 'rationReduced', group: 'rations', phase: 2, name: 'Reduserte rasjoner', text: 'Alle får tre firedeler. Folk blir svakere og surere, men maten varer lenger.', effect: { foodMult: .75, hope: -5, discontent: 6, healthPerDay: -.4, sickMult: 1.3 } },
  { id: 'rationWorkers', group: 'rations', phase: 2, name: 'Arbeidere først', text: 'De som jobber, får full rasjon. Barn og eldre får mindre.', effect: { dependentFood: .6, hope: -4, discontent: 3 }, tags: ['harsh'] },
  { id: 'rationHalf', group: 'rations', phase: 2, name: 'Halve rasjoner', text: 'Nødtiltak. Alle får halvparten. Ingen holder ut dette lenge.', effect: { foodMult: .5, hope: -12, discontent: 12, healthPerDay: -1.5, sickMult: 1.8 }, tags: ['harsh'] },
  { id: 'longShifts', group: 'work', phase: 2, name: 'Lange skift', text: 'Tolv timer om dagen. Mer blir gjort, og flere gjør feil.', effect: { workMult: 1.3, discontent: 8, fatigue: 6, hope: -3, accidents: .006, sickMult: 1.5 }, tags: ['harsh'] },
  { id: 'restDay', group: 'work', phase: 2, name: 'Fast hviledag', text: 'Søndag er fri. Litt mindre blir gjort.', effect: { workMult: .9, hope: 4, discontent: -3 } },
  { id: 'childLabour', group: 'children', phase: 2, name: 'Barnearbeid', text: 'Barn fra tolv år jobber på jordet og ved garnene.', effect: { childWork: .5, hope: -10, discontent: 4, sickMult: 1.15 }, tags: ['harsh', 'children'] },
  { id: 'childSchool', group: 'children', phase: 2, name: 'Skole for barna', text: 'Barna lærer. Noen av dem hjelper til med forskningen.', effect: { childResearch: .25, hope: 5 }, needsTech: 'school' },
  { id: 'punishLabour', group: 'punish', phase: 2, name: 'Straffearbeid', text: 'Den som stjeler, jobber det inn igjen.', effect: { crime: .8, discontent: -1 } },
  { id: 'punishExile', group: 'punish', phase: 2, name: 'Forvisning', text: 'Den som bryter loven, sendes ut porten.', effect: { crime: .6, hope: -2 }, tags: ['harsh'] },
  { id: 'punishStocks', group: 'punish', phase: 2, name: 'Gapestokk', text: 'Offentlig skam. Folk ser hva som skjer med tyver.', effect: { crime: .7, hope: -3, discontent: -2 }, tags: ['harsh'] },
  { id: 'punishDeath', group: 'punish', phase: 3, name: 'Dødsstraff', text: 'For drap, overgrep og forræderi. Ingen tar sjanser lenger.', effect: { crime: .35, hope: -8, discontent: -6 }, tags: ['cruel'] },
  { id: 'bittenQuarantine', group: 'bitten', phase: 2, name: 'Karantene for bitte', text: 'Bitte isoleres under vakt i to døgn. Noen klarer seg med amputasjon.', effect: { hope: 2 }, tags: ['merciful'] },
  { id: 'bittenMercy', group: 'bitten', phase: 2, name: 'Barmhjertig avliving', text: 'Bitte avlives straks, med verdighet. Ingen utbrudd innenfra.', effect: { hope: -5, discontent: -2 }, tags: ['cruel'] },
  { id: 'burnDead', group: 'dead', phase: 2, name: 'Likbrenning', text: 'Alle døde brennes. Det koster drivstoff, men ingen sykdom.', effect: { hope: -2 } },
  { id: 'buryDead', group: 'dead', phase: 2, name: 'Gravlegging', text: 'De døde får en grav og et navn. Folk trenger det.', effect: { hope: 4 }, tags: ['faith'] },
  { id: 'openGates', group: 'gates', phase: 2, name: 'Åpen port', text: 'Alle som kommer, slippes inn. Flere hender og flere munner.', effect: { refugees: 2, hope: 4, discontent: 3 }, tags: ['charity'] },
  { id: 'usefulOnly', group: 'gates', phase: 2, name: 'Bare nyttige', text: 'Bare voksne med noe å bidra med slippes inn.', effect: { refugees: .8, hope: -4 }, tags: ['harsh'] },
  { id: 'closedGates', group: 'gates', phase: 2, name: 'Stengt port', text: 'Ingen slippes inn. Dere klarer dere selv.', effect: { refugees: 0, hope: -6, discontent: -2 }, tags: ['cruel'] },
  { id: 'curfew', group: 'order', phase: 2, name: 'Portforbud', text: 'Ingen ute etter mørkets frembrudd uten vaktliste.', effect: { crime: .7, discontent: 3, guardMult: 1.1 } },
  { id: 'propaganda', group: 'order', phase: 3, name: 'Kveldsmøter', text: 'Hver kveld forteller dere hva som går bra. Noen tror på det.', effect: { hope: 5, discontent: 2 } },
  { id: 'council', group: 'gov', phase: 3, name: 'Råd', text: 'Fem valgte bestemmer sammen med deg. Tregere, men folk føler seg hørt.', effect: { discontent: -8, lawCooldown: 9 } },
  { id: 'strongman', group: 'gov', phase: 3, name: 'Sterk leder', text: 'Du bestemmer. Lovene kommer raskt, og ingen stemmer.', effect: { discontent: 5, crime: .8, lawCooldown: 2, hope: -3 }, tags: ['harsh'] },
  { id: 'faithRule', group: 'gov', phase: 3, name: 'Menighet', text: 'Fellesskapet samles rundt troen. Håpet holder, tvilen får mindre plass.', effect: { hope: 8, discontent: -4, researchMult: .85 }, tags: ['faith'] },
  { id: 'militia', group: 'gov', phase: 3, name: 'Vernepliktig milits', text: 'Alle voksne har vaktplikt. Forsvaret er sterkt, arbeidet går tregere.', effect: { guardMult: 1.6, workMult: .9, discontent: 3 } },
];
export const LAW_COOLDOWN = 5;

// ------------------------------------------------------------------ research

export type Branch = 'defense' | 'food' | 'medicine' | 'tech' | 'society' | 'weapons';
export const BRANCHES: Record<Branch, string> = { defense: 'Forsvar', food: 'Mat', medicine: 'Medisin', tech: 'Teknikk', society: 'Samfunn', weapons: 'Våpen' };
export interface TechDef {
  id: string; branch: Branch; phase: number; name: string; text: string; points: number;
  cost: Record<string, number>; requires?: string[]; needsModule?: string; needsNetwork?: string;
}
export const TECHS: TechDef[] = [
  // Defense: the perimeter grows from planks to steel.
  { id: 'carWall', branch: 'defense', phase: 2, name: 'Bilvraksperringer', text: 'Sperringer av vrak og tilhengere. Holder om lag dobbelt så lenge som planker.', points: 30, cost: { fuel: 8, parts: 3 } },
  { id: 'spikes', branch: 'defense', phase: 2, name: 'Spisse påler og feller', text: 'Zombier som angriper en sperring, spiddes. Sperrede grenser dreper litt hver natt.', points: 25, cost: { building: 10 } },
  { id: 'watchRoutine', branch: 'defense', phase: 2, name: 'Vaktrutiner', text: 'Skift, signaler og lister. Vakter er 40 % mer effektive.', points: 25, cost: {} },
  { id: 'containers', branch: 'defense', phase: 3, name: 'Containere og sviller', text: 'Havnecontainere stablet to i høyden. Holder fire ganger så lenge som planker.', points: 60, cost: { metal: 20, fuel: 10 }, requires: ['carWall'] },
  { id: 'decoys', branch: 'defense', phase: 3, name: 'Lokkelyd', text: 'Batteridrevne alarmer langt fra leiren. Leiren lager 40 % mindre lyd.', points: 40, cost: { electronics: 4, batteries: 4 } },
  { id: 'steelFence', branch: 'defense', phase: 4, name: 'Dobbelt stålgjerde', text: 'To gjerder med dødsone imellom og utkikksposter. Nesten ingenting kommer gjennom.', points: 110, cost: { metal: 40, parts: 10 }, requires: ['containers'] },
  // Food: from salting to cold storage.
  { id: 'saltDry', branch: 'food', phase: 2, name: 'Salting og tørking', text: 'Klippfisk og spekemat. Halverer svinnet, og fisket gir mer.', points: 25, cost: { salt: 4 } },
  { id: 'rotation', branch: 'food', phase: 2, name: 'Vekstskifte og såkorn', text: 'Ta vare på såkornet og bytt vekster. Jorda gir 30 % mer.', points: 35, cost: {} },
  { id: 'livestock', branch: 'food', phase: 3, name: 'Husdyr på beite', text: 'Sauer og kyr fra gårdene. Beite blir matjord.', points: 45, cost: { food: 20 }, requires: ['rotation'] },
  { id: 'rootCellar', branch: 'food', phase: 3, name: 'Jordkjeller', text: 'Kaldt og mørkt lager. Mindre svinn, og poteter som holder vinteren.', points: 35, cost: { building: 15 } },
  { id: 'fishery', branch: 'food', phase: 3, name: 'Garn og fiskebruk', text: 'Garn, teiner og et sted å sløye. Fisket gir 50 % mer, og hver båt tar flere fiskere.', points: 40, cost: { metal: 6, building: 6 }, requires: ['saltDry'] },
  { id: 'coldStore', branch: 'food', phase: 4, name: 'Kjølelager', text: 'Fryserom på strøm. Nesten ingenting råtner.', points: 70, cost: { electronics: 8, parts: 6 }, requires: ['rootCellar'], needsNetwork: 'power' },
  { id: 'hydroponics', branch: 'food', phase: 4, name: 'Lysdyrking', text: 'Drivhus med lys og pumper. Dobbel avling, også om vinteren.', points: 80, cost: { electronics: 10, solar: 4 }, requires: ['rotation'] },
  // Medicine: from boiled water to a cure.
  { id: 'hygiene', branch: 'medicine', phase: 2, name: 'Kokt vann og hygiene', text: 'Halverer sykdom og smitte i leiren.', points: 20, cost: { fuel: 4 } },
  { id: 'spirit', branch: 'medicine', phase: 2, name: 'Destillert sprit', text: 'Hjemmebrent til sårvask. Lag medisin av mat i HQ.', points: 30, cost: { food: 15, metal: 4 } },
  { id: 'fieldSurgery', branch: 'medicine', phase: 2, name: 'Feltkirurgi', text: 'Bedre behandling, og bitte kan reddes med amputasjon.', points: 35, cost: { medicine: 6 } },
  { id: 'zombieStudy', branch: 'medicine', phase: 2, name: 'Zombiestudier', text: 'Prøver fra de døde. Avslører mutasjonene, og kjente mutasjoner rammer halvt så hardt.', points: 30, cost: { samples: 3 } },
  { id: 'herbal', branch: 'medicine', phase: 3, name: 'Urtemedisin', text: 'Ryllik, timian og pil. Jorda gir litt medisin hver dag.', points: 35, cost: {}, requires: ['hygiene'] },
  { id: 'penicillin', branch: 'medicine', phase: 4, name: 'Penicillinkultur', text: 'Mugg, sukker og tålmodighet. Lag antibiotika uten elektronikk.', points: 90, cost: { medicine: 10 }, requires: ['spirit'], needsModule: 'lab' },
  { id: 'cure', branch: 'medicine', phase: 5, name: 'Vaksineforsøket', text: 'Hvis noen kan finne en kur, er det her. Det vil koste alt.', points: 300, cost: { samples: 20, antibiotics: 10, electronics: 20 }, requires: ['zombieStudy', 'penicillin'], needsModule: 'lab' },
  // Technology: power, fuel and parts again.
  { id: 'generators', branch: 'tech', phase: 2, name: 'Aggregatdrift', text: 'Et aggregat gir HQ strøm for 2 drivstoff om dagen.', points: 25, cost: { parts: 4 } },
  { id: 'woodGas', branch: 'tech', phase: 3, name: 'Vedgass', text: 'Bilmotorer på ved. Lag drivstoff av byggemateriale, og vinteren krever mindre.', points: 45, cost: { metal: 6, parts: 6 } },
  { id: 'solarGrid', branch: 'tech', phase: 3, name: 'Solcellenett', text: 'Strømnett uten trafostasjon, og halv pris på strømnett.', points: 50, cost: { electronics: 6 }, requires: ['generators'] },
  { id: 'biogas', branch: 'tech', phase: 4, name: 'Biogass', text: 'Møkk og fiskeslo blir gass. Drivstoff hver dag når jorda er i drift.', points: 70, cost: { metal: 10, parts: 6 }, requires: ['woodGas'] },
  { id: 'printing', branch: 'tech', phase: 4, name: '3D-printede reservedeler', text: 'Med en printer og strøm lager dere mekaniske deler.', points: 60, cost: { printer: 1, electronics: 4 }, requires: ['generators'] },
  { id: 'bridgeRepair', branch: 'tech', phase: 4, name: 'Brubygging', text: 'Stål, sveis og stillas. Sprengte bruer kan bygges opp igjen.', points: 80, cost: { metal: 20 }, requires: ['woodGas'] },
  // Society: radio, ration cards, school and intelligence.
  { id: 'crystalRadio', branch: 'society', phase: 2, name: 'Krystallradio', text: 'En spole, en diode og en lang ledning. Dere hører de andre gruppene.', points: 20, cost: { electronics: 2 } },
  { id: 'rationCards', branch: 'society', phase: 2, name: 'Rasjonskort og vaktlister', text: 'Rettferdig fordeling. Harde lover gir halvt så mye uro.', points: 25, cost: {} },
  { id: 'school', branch: 'society', phase: 3, name: 'Skole', text: 'Gjør det mulig å la barna gå på skole. De lærer, og håpet stiger.', points: 30, cost: { building: 8 } },
  { id: 'intel', branch: 'society', phase: 3, name: 'Etterretning', text: 'Lyttepost og informanter. Dere ser hva gruppene egentlig vil, og hordene før de kommer.', points: 50, cost: { radio: 1 }, requires: ['crystalRadio'] },
  { id: 'ferry', branch: 'society', phase: 3, name: 'Fergerute', text: 'Fast båtrute. Båtene når 8 km i stedet for 3.', points: 45, cost: { boat: 1, engine: 1 } },
  { id: 'charter', branch: 'society', phase: 4, name: 'Forfatning', text: 'Skrevne regler alle kjenner. Uroen synker for godt.', points: 70, cost: {}, requires: ['rationCards'] },
  // Weapons: quieter and harder.
  { id: 'forgedMelee', branch: 'weapons', phase: 2, name: 'Smidde nærkampvåpen', text: 'Stålrør, armeringsjern og øks. Nærkamp dreper 30 % mer.', points: 25, cost: { metal: 8 } },
  { id: 'reloading', branch: 'weapons', phase: 2, name: 'Omlading', text: 'Lad patroner på nytt med tennhetter, også uten ammoverksted.', points: 30, cost: { metal: 4 } },
  { id: 'crossbows', branch: 'weapons', phase: 3, name: 'Armbrøst og buer', text: 'Stille våpen. Rydding lager halvparten så mye lyd og dreper mer.', points: 40, cost: { parts: 6, metal: 6 }, requires: ['forgedMelee'] },
  { id: 'armour', branch: 'weapons', phase: 3, name: 'Plater og lær', text: 'Bittsikre ermer og hjelmer. 40 % færre skader.', points: 45, cost: { metal: 15 } },
  { id: 'explosivesCraft', branch: 'weapons', phase: 4, name: 'Hjemmelaget sprengstoff', text: 'Kunstgjødsel og diesel. Lag sprengstoff i HQ.', points: 60, cost: { fuel: 10 }, requires: ['reloading'] },
  { id: 'drill', branch: 'weapons', phase: 4, name: 'Drill og taktikk', text: 'Øvde lag. Vakter 50 % sterkere, og tokt mot grupper går bedre.', points: 70, cost: { ammo: 60 }, requires: ['armour'] },
];
/** Each HQ type makes one branch cheaper and lets it run one phase ahead. */
export const HQ_BRANCH: Record<string, { branch: Branch; text: string }> = {
  military: { branch: 'weapons', text: 'Våpen: billigere og en fase tidligere.' },
  prison: { branch: 'defense', text: 'Forsvar: billigere og en fase tidligere.' },
  shipyard: { branch: 'defense', text: 'Forsvar: stål og containere en fase tidligere, og billigere.' },
  airport: { branch: 'tech', text: 'Teknikk: billigere og en fase tidligere.' },
  hospital: { branch: 'medicine', text: 'Medisin: billigere og en fase tidligere.' },
  school: { branch: 'society', text: 'Samfunn: billigere og en fase tidligere.' },
  refuge: { branch: 'society', text: 'Samfunn: billigere og en fase tidligere. Håpet holder bedre.' },
  coastFarm: { branch: 'food', text: 'Mat: billigere og en fase tidligere.' },
  mall: { branch: 'food', text: 'Mat: billigere og en fase tidligere. Handel gir mer.' },
};
export const SPECIAL_DISCOUNT = .6;

// ------------------------------------------------------------------ perimeter tiers

export const TIERS = [
  { tier: 1, name: 'Planker og piggtråd', durability: 10, cost: { building: 3 }, tech: '' },
  { tier: 2, name: 'Bilvrak', durability: 22, cost: { building: 3, fuel: 2 }, tech: 'carWall' },
  { tier: 3, name: 'Containere', durability: 45, cost: { metal: 4, building: 2 }, tech: 'containers' },
  { tier: 4, name: 'Dobbelt stålgjerde', durability: 90, cost: { metal: 7, parts: 2 }, tech: 'steelFence' },
];

// ------------------------------------------------------------------ mutations

export interface MutationDef { id: string; name: string; text: string; report: string }
export const MUTATIONS: MutationDef[] = [
  { id: 'runners', name: 'Løpere', text: 'Zombiene beveger seg raskere mellom soner.', report: 'Mutasjon Z12-L1 på OPH3S-genet er påvist. De løper.' },
  { id: 'hearing', name: 'Skarp hørsel', text: 'Lyd trekker dem lenger og sterkere.', report: 'Mutasjon Z07-H2 er påvist. Øresneglene er forstørret. De hører dere.' },
  { id: 'tough', name: 'Seig hud', text: 'De tåler mer. Dere dreper færre per dag.', report: 'Mutasjon Z31-K4 er påvist. Huden er fortykket som skinn.' },
  { id: 'climbers', name: 'Klatrere', text: 'Sperringer slites raskere ned.', report: 'Mutasjon Z19-C3 er påvist. Neglene vokser. De klatrer.' },
  { id: 'herd', name: 'Flokkdyr', text: 'Hordene blir større.', report: 'Mutasjon Z02-F8 er påvist. De holder sammen. De venter på hverandre.' },
  { id: 'diggers', name: 'Gravere', text: 'Noen kommer seg forbi forsvaret om natta.', report: 'Mutasjon Z44-G1 er påvist. De graver seg inn under gjerder.' },
];

// ------------------------------------------------------------------ people

export const TRAIT_NAMES: Record<Trait, string> = { kind: 'Snill', hard: 'Hard', devout: 'Troende', suspicious: 'Mistenksom', parent: 'Forelder', loner: 'Einstøing' };
/** How each trait reacts to a stance: loyalty change. */
export const REACTIONS: Record<Trait, Partial<Record<Stance, number>>> = {
  kind: { cruel: -14, merciful: 6, charity: 4, harsh: -4, betrayal: -8 },
  hard: { merciful: -5, charity: -4, harsh: 5, cruel: 2, reckless: -4 },
  devout: { cruel: -10, faith: 8, merciful: 4, betrayal: -6 },
  suspicious: { charity: -3, betrayal: 2 },
  parent: { children: -16, merciful: 3 },
  loner: { charity: -2, reckless: 3 },
};
export const POP = {
  food: { adult: 1, child: .6, elderly: .8 },
  /** What one worker gives per day. */
  work: { clearKills: .9, farmFood: 3.2, fishFood: 2.4, fishersPerBoat: 3, scavengeHours: 5, guard: 2.5, buildHours: 4, research: 1 },
  /** Sheltered places: base camp, HQ, housing and homes in held zones. */
  shelter: { base: 12, housing: 15, refuge: 20, perZoneHomes: .6, perZoneMax: 25 },
  sickPerDay: .004,
  crimeBase: .01,
};
export const WORK_NAMES: Record<WorkId, string> = { farm: 'Jordbruk', fish: 'Fiske', scavenge: 'Sanking', clear: 'Ryddelag', guard: 'Vakt', build: 'Bygging og vedlikehold', research: 'Forskning' };
