// Kortkatalogen. Plassholderinnhold: mekanikken er det som gjelder.
import type { CardDef } from '../types';

const defs: CardDef[] = [
  // ---- Makeshift, nivå 1
  { id: 'k_ror', name: '20 mm K-rør', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'egg', durability: 9, range: 'naerkamp', text: 'Én meter gult trekkerør, ti spiker i den ene enden og elektrikertape i den andre. Alle naboene har ett. De snakker ikke om det.' },
  { id: 'kobein', name: 'Kobein fra Biltema', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'slag', craftable: false, durability: 10, range: 'naerkamp', text: 'Gjort for bildører. Fungerer overraskende bra på alt som ikke åpner seg.' },
  { id: 'baufil', name: 'Baufil', family: 'makeshift', slot: 'verktoy', level: 1, rarity: 'vanlig', durability: 12, text: 'Går gjennom rør, planker og naboens påskeharer.' },
  { id: 'tommestokk', name: 'Tommestokk og blyant', family: 'makeshift', slot: 'verktoy', level: 1, rarity: 'vanlig', durability: 10, text: 'Mål to ganger, kutt én gang. Zombiene venter ikke på nummer to.' },
  { id: 'sykkelhjelm', name: 'Sykkelhjelm', family: 'makeshift', slot: 'beskyttelse', level: 1, rarity: 'vanlig', weight: 'lett', durability: 8, text: 'Med refleks bak. Du blir i alle fall sett.' },
  { id: 'regnjakke', name: 'To regnjakker over hverandre', family: 'makeshift', slot: 'beskyttelse', level: 1, rarity: 'vanlig', weight: 'lett', durability: 8, text: 'Stavanger-uniformen. Stopper vind, vann og noen ganger tenner.' },
  // ---- Makeshift, nivå 2
  { id: 'spikerkolle', name: 'Spikerkølle', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'sjelden', weaponClass: 'egg', durability: 10, range: 'naerkamp', bonus: { muskler: 5 }, text: 'Planke, åtte spiker og dårlig samvittighet.' },
  { id: 'spikerpistol_obs', name: 'Spikerpistol fra Obs', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'sjelden', weaponClass: 'prosjektil', craftable: false, durability: 12, range: 'avstand', noise: 'normal', text: 'Ukens tilbud, i hvert fall for en av dere.' },
  { id: 'trampolinevest', name: 'Trampolinenett som vest', family: 'makeshift', slot: 'beskyttelse', level: 2, rarity: 'vanlig', weight: 'lett', craftable: false, durability: 10, text: 'Barnehagen på Buøy trenger den ikke lenger.' },
  { id: 'multiverktoy', name: 'Multiverktøy fra Biltema', family: 'makeshift', slot: 'verktoy', level: 2, rarity: 'vanlig', craftable: false, durability: 14, text: 'Elleve verktøy i ett. Ti av dem er en saks.' },
  // ---- Makeshift, nivå 3
  { id: 'kjedesag', name: 'Kjedesag uten bensin', family: 'makeshift', slot: 'vapen', level: 3, rarity: 'episk', weaponClass: 'slag', durability: 8, range: 'naerkamp', tags: ['gjennomslag'], bonus: { muskler: 8 }, text: 'Lyden er borte, men holdningen er der.' },
  { id: 'vernedress', name: 'Vernebukser og visir fra Obs', family: 'makeshift', slot: 'beskyttelse', level: 3, rarity: 'sjelden', weight: 'lett', craftable: false, durability: 12, text: 'Laget for skogsarbeid. Skogen er forøvrig full av dem.' },
  { id: 'sveiseapparat', name: 'Sveiseapparat', family: 'makeshift', slot: 'verktoy', level: 3, rarity: 'sjelden', durability: 14, bonus: { mekk: 6 }, text: 'Krever strøm, tålmodighet og bedre briller enn dem du har.' },
  // ---- Fra før, nivå 1
  { id: 'hockeykolle', name: 'Hockeykølle', family: 'for', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'slag', durability: 12, range: 'naerkamp', text: 'Stavanger Oilers-merke. Fortsatt mer treffsikker enn laget.' },
  { id: 'refleksvest', name: 'Refleksvest fra Statens vegvesen', family: 'for', slot: 'beskyttelse', level: 1, rarity: 'vanlig', weight: 'lett', durability: 10, text: 'Hjelper ikke mot bitt. Gir tillit hos gamle damer.' },
  { id: 'lommekniv', name: 'Lommekniv', family: 'for', slot: 'verktoy', level: 1, rarity: 'vanlig', durability: 14, text: 'Alle har en. Ingen finner den.' },
  // ---- Fra før, nivå 2
  { id: 'hagle_politibil', name: 'Hagle fra politibilen', family: 'for', slot: 'vapen', level: 2, rarity: 'sjelden', weaponClass: 'skytevapen', durability: 8, range: 'avstand', tags: ['spredning'], bonus: { muskler: 4 }, text: 'Betjenten trengte den ikke lenger. Han hadde dessuten en dårlig dag.' },
  { id: 'skinnjakke', name: 'Skinnjakke fra MC-butikken', family: 'for', slot: 'beskyttelse', level: 2, rarity: 'vanlig', weight: 'tung', durability: 12, text: 'Varm, tung og lukter av Hillevåg.' },
  { id: 'jernia_kasse', name: 'Verktøykasse fra Jernia', family: 'for', slot: 'verktoy', level: 2, rarity: 'vanlig', durability: 16, text: 'Aldri åpnet. Skruene sitter fremdeles på kortet.' },
  // ---- Fra før, nivå 3
  { id: 'armbrost', name: 'Armbrøst fra jaktbutikken', family: 'for', slot: 'vapen', level: 3, rarity: 'sjelden', weaponClass: 'prosjektil', durability: 10, range: 'avstand', tags: ['rekkevidde'], text: 'Stille, og ingen i Rogaland har hørt noe.' },
  { id: 'politivest', name: 'Skuddsikker vest', family: 'for', slot: 'beskyttelse', level: 3, rarity: 'episk', weight: 'tung', durability: 14, text: 'Skuddsikker. Biter er en grei bonus.' },
  { id: 'presisjonssett', name: 'Presisjonsverktøy fra Kleppestø', family: 'for', slot: 'verktoy', level: 3, rarity: 'sjelden', durability: 16, bonus: { mekk: 4, snoking: 3 }, text: 'Skrutrekkere for briller og for slikt som ikke skal åpnes.' },
  // ---- Våpenklasser og beskyttelse (kap. 9): nivå følger arbeid og materialer, sjeldenhet følger hvor spesielt materialet er
  // Egg
  { id: 'kjokkenkniv', name: 'Kjøkkenkniv', family: 'for', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'egg', durability: 9, range: 'naerkamp', text: 'Brødkniven, fordi den andre var i oppvaskmaskinen. Den står fortsatt på.' },
  { id: 'glasskar', name: 'Glasskår med tape', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'egg', durability: 7, range: 'naerkamp', text: 'Fra en verandadør i Hillevåg. Teipen er til deg, ikke til glasset.' },
  { id: 'planke_skruer', name: 'Planke med skruer', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'egg', durability: 9, range: 'naerkamp', text: 'Terrassebord med skruene stikkende ut. Etter ni år skulle den ha vært malt uansett.' },
  { id: 'skoyte_stang', name: 'Skøyte på stang', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'sjelden', weaponClass: 'egg', durability: 9, range: 'naerkamp', text: 'Størst effekt på is. Heldigvis er det nok av det i et Oilers-hjem.' },
  { id: 'slipt_staalror', name: 'Slipt stålrør', family: 'makeshift', slot: 'vapen', level: 3, rarity: 'sjelden', weaponClass: 'egg', durability: 8, range: 'naerkamp', tags: ['gjennomslag'], text: 'Et spyd, i praksis. Tre kvelder på slipemaskinen og et barn som lurte på hva du holdt på med.' },
  // Slag
  { id: 'hammer', name: 'Hammer', family: 'for', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'slag', durability: 14, range: 'naerkamp', text: 'Jernia har solgt tusen av dem. Ni hundre ligger i skuffer.' },
  { id: 'stekepanne', name: 'Stekepanne i støpejern', family: 'for', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'slag', durability: 16, range: 'naerkamp', text: 'Arvestykket fra svigermor. Aldri vasket med såpe, og ikke nå heller.' },
  { id: 'spade', name: 'Spade', family: 'for', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'slag', durability: 14, range: 'naerkamp', text: 'Laget for kompost. Brukes nå til nesten det samme.' },
  { id: 'balltre', name: 'Balltre', family: 'for', slot: 'vapen', level: 2, rarity: 'vanlig', weaponClass: 'slag', durability: 14, range: 'naerkamp', text: 'Fra et land der noen faktisk spiller baseball. Her har det stått bak døra siden 2009.' },
  { id: 'staalror', name: 'Stålrør med flens', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'vanlig', weaponClass: 'slag', durability: 16, range: 'naerkamp', text: 'Fra en rørlegger som aldri kom for å hente det. Tungt og sprøtt på samme tid.' },
  { id: 'brekkjern_v', name: 'Brekkjern', family: 'for', slot: 'vapen', level: 2, rarity: 'vanlig', weaponClass: 'slag', durability: 16, range: 'naerkamp', text: 'Våpen i dag, verktøy i morgen. Bytt det på kortet, ikke i kampen.' },
  { id: 'balltre_pigg', name: 'Balltre med piggtråd', family: 'makeshift', slot: 'vapen', level: 3, rarity: 'sjelden', weaponClass: 'slag', durability: 12, range: 'naerkamp', bonus: { nerver: 2 }, text: 'Piggtråden er fra en sau på Jæren som ikke lenger er opptatt av den.' },
  // Prosjektil
  { id: 'sprettert', name: 'Sprettert med muttere', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', weaponClass: 'prosjektil', durability: 8, range: 'avstand', text: 'M8-muttere i en lommeslå på en greinkløft. Stillere enn en måke, og mer treffsikker.' },
  { id: 'sprettert_stor', name: 'Stor sprettert med sykkelslange', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'vanlig', weaponClass: 'prosjektil', durability: 10, range: 'avstand', text: 'Gaffelen er sveiset, slangen er fra en Crescent. Nesten et våpen.' },
  { id: 'pvc_bue', name: 'Bue av PVC-rør', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'vanlig', weaponClass: 'prosjektil', durability: 10, range: 'avstand', tags: ['rekkevidde'], text: 'Fra rørleggerlageret. Pilene er bambus, og den siste kommer aldri tilbake.' },
  { id: 'harpun', name: 'Harpun fra fiskebutikken', family: 'for', slot: 'vapen', level: 3, rarity: 'sjelden', weaponClass: 'prosjektil', durability: 8, range: 'avstand', tags: ['rekkevidde'], text: 'Ment for torsk. Ingen har fortalt zombiene det.' },
  // Brann
  { id: 'molotov', name: 'Flaske med drivstoff og fille', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'sjelden', weaponClass: 'brann', durability: 4, range: 'avstand', tags: ['spredning'], text: 'Du kaster, den brenner. Naboen ber deg om å la være å gjøre det i kjelleren.' },
  // Motor
  { id: 'hekksaks', name: 'Elektrisk hekksaks', family: 'for', slot: 'vapen', level: 2, rarity: 'vanlig', weaponClass: 'motor', durability: 8, range: 'naerkamp', text: 'Ledningen er seks meter. Det er hele taktikken.' },
  { id: 'motorsag', name: 'Motorsag med bensin', family: 'for', slot: 'vapen', level: 3, rarity: 'sjelden', weaponClass: 'motor', durability: 6, range: 'naerkamp', tags: ['gjennomslag'], text: 'Lyden hører de i Sandnes. Det er sannsynligvis poenget.' },
  // Verktøy
  { id: 'brekkjern_t', name: 'Brekkjern', family: 'for', slot: 'verktoy', level: 2, rarity: 'vanlig', durability: 18, bonus: { snoking: 2 }, text: 'Åpner dører, skap og diskusjoner. Gir gjennomsøking en ekstra knekk.' },
  { id: 'drill', name: 'Drill med batteri', family: 'for', slot: 'verktoy', level: 2, rarity: 'vanlig', durability: 14, bonus: { mekk: 2 }, text: 'Batteriet holdt i åtte minutter før utbruddet. Nå holder det i åtte minutter til.' },
  // Beskyttelse
  { id: 'avispapir', name: 'Avispapir teipet under jakka', family: 'makeshift', slot: 'beskyttelse', level: 1, rarity: 'vanlig', weight: 'lett', durability: 6, text: 'Stavanger Aftenblad, lørdagsutgaven. Tykkere enn den pleide å være.' },
  { id: 'grytelokk', name: 'Grytelokk under klærne', family: 'makeshift', slot: 'beskyttelse', level: 1, rarity: 'vanlig', weight: 'lett', durability: 9, text: 'Passer akkurat over hjertet. Klirrer litt når du løper.' },
  { id: 'gaffa_rustning', name: 'Gaffateip-rustning', family: 'makeshift', slot: 'beskyttelse', level: 2, rarity: 'vanlig', weight: 'tung', durability: 10, text: 'Fire ruller, to kvelder og null mulighet til å gå på do.' },
  { id: 'dekk_gummi', name: 'Sykkeldekk og gummi', family: 'makeshift', slot: 'beskyttelse', level: 2, rarity: 'sjelden', weight: 'tung', durability: 12, text: 'Surret rundt armer og legger. Tenner får dårlig grep, og du lukter Biltema.' },
  { id: 'alpinhjelm', name: 'Alpinhjelm', family: 'for', slot: 'beskyttelse', level: 2, rarity: 'vanlig', weight: 'lett', durability: 12, text: 'Kjøpt til Geilo i 2017. Stavanger har bedre bakker nå.' },
  { id: 'mc_hjelm', name: 'Motorsykkelhjelm', family: 'for', slot: 'beskyttelse', level: 3, rarity: 'sjelden', weight: 'tung', durability: 16, text: 'Full face. Kinnstroppen sitter fortsatt rett, det samme gjør ikke han som eide den.' },
  { id: 'sveisemaske', name: 'Sveisemaske', family: 'for', slot: 'beskyttelse', level: 3, rarity: 'sjelden', weight: 'tung', craftable: false, durability: 14, bonus: { nerver: 2 }, text: 'Fra verkstedet på Hillevåg. Du ser ingenting, men heller ikke de.' },
  // ---- Unike
  { id: 'u_oks', name: 'Kaptein Tvedts øks', family: 'for', slot: 'vapen', level: 3, rarity: 'unik', weaponClass: 'egg', durability: 24, range: 'naerkamp', tags: ['gjennomslag'], bonus: { muskler: 8, nerver: 4 }, places: ['tommerodden', 'sorspissen'], text: 'Skoleskipet er borte, men øksa har overlevd tre kapteiner.' },
  { id: 'u_brann', name: 'Brannmannens vernedress', family: 'for', slot: 'beskyttelse', level: 3, rarity: 'unik', weight: 'tung', durability: 24, bonus: { kondis: 6 }, places: ['skolen', 'nordkrysset'], text: 'Tåler ild, vann og foreldremøter.' },
  { id: 'u_kiste', name: 'Bestefars verktøykiste', family: 'for', slot: 'verktoy', level: 3, rarity: 'unik', durability: 28, bonus: { mekk: 8, snoking: 4 }, places: ['obs', 'nordkrysset'], text: 'Alt står på riktig plass. Det er det skumleste ved den.' },
  { id: 'u_jaer', name: 'Armbrøst fra Jærmuseet', family: 'for', slot: 'vapen', level: 2, rarity: 'unik', weaponClass: 'prosjektil', durability: 22, range: 'avstand', tags: ['rekkevidde'], bonus: { snoking: 6 }, places: ['hjem', 'buoy_nord', 'skolen'], text: 'Utstilt som «middelalderen på Jæren». Funker like bra i dag.' },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
