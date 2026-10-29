// Kortkatalogen. Plassholderinnhold: mekanikken er det som gjelder.
import type { CardDef } from '../types';

const defs: CardDef[] = [
  // ---- Makeshift, nivå 1
  { id: 'k_ror', name: '20 mm K-rør', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', durability: 12, text: 'Kobberrør fra baderommet. Tungt nok til at ingen spør hvorfor det drypper.' },
  { id: 'kobein', name: 'Kobein fra Biltema', family: 'makeshift', slot: 'vapen', level: 1, rarity: 'vanlig', durability: 10, text: 'Gjort for bildører. Fungerer overraskende bra på alt som ikke åpner seg.' },
  { id: 'baufil', name: 'Baufil', family: 'makeshift', slot: 'verktoy', level: 1, rarity: 'vanlig', durability: 12, text: 'Går gjennom rør, planker og naboens påskeharer.' },
  { id: 'tommestokk', name: 'Tommestokk og blyant', family: 'makeshift', slot: 'verktoy', level: 1, rarity: 'vanlig', durability: 10, text: 'Mål to ganger, kutt én gang. Zombiene venter ikke på nummer to.' },
  { id: 'sykkelhjelm', name: 'Sykkelhjelm', family: 'makeshift', slot: 'beskyttelse', level: 1, rarity: 'vanlig', durability: 8, text: 'Med refleks bak. Du blir i alle fall sett.' },
  { id: 'regnjakke', name: 'To regnjakker over hverandre', family: 'makeshift', slot: 'beskyttelse', level: 1, rarity: 'vanlig', durability: 8, text: 'Stavanger-uniformen. Stopper vind, vann og noen ganger tenner.' },
  // ---- Makeshift, nivå 2
  { id: 'spikerkolle', name: 'Spikerkølle', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'sjelden', durability: 10, bonus: { muskler: 5 }, text: 'Planke, åtte spiker og dårlig samvittighet.' },
  { id: 'spikerpistol_obs', name: 'Spikerpistol fra Obs', family: 'makeshift', slot: 'vapen', level: 2, rarity: 'sjelden', durability: 12, text: 'Ukens tilbud, i hvert fall for en av dere.' },
  { id: 'trampolinevest', name: 'Trampolinenett som vest', family: 'makeshift', slot: 'beskyttelse', level: 2, rarity: 'vanlig', durability: 10, text: 'Barnehagen på Buøy trenger den ikke lenger.' },
  { id: 'multiverktoy', name: 'Multiverktøy fra Biltema', family: 'makeshift', slot: 'verktoy', level: 2, rarity: 'vanlig', durability: 14, text: 'Elleve verktøy i ett. Ti av dem er en saks.' },
  // ---- Makeshift, nivå 3
  { id: 'kjedesag', name: 'Kjedesag uten bensin', family: 'makeshift', slot: 'vapen', level: 3, rarity: 'episk', durability: 8, bonus: { muskler: 8 }, text: 'Lyden er borte, men holdningen er der.' },
  { id: 'vernedress', name: 'Vernebukser og visir fra Obs', family: 'makeshift', slot: 'beskyttelse', level: 3, rarity: 'sjelden', durability: 12, text: 'Laget for skogsarbeid. Skogen er forøvrig full av dem.' },
  { id: 'sveiseapparat', name: 'Sveiseapparat', family: 'makeshift', slot: 'verktoy', level: 3, rarity: 'sjelden', durability: 14, bonus: { mekk: 6 }, text: 'Krever strøm, tålmodighet og bedre briller enn dem du har.' },
  // ---- Fra før, nivå 1
  { id: 'hockeykolle', name: 'Hockeykølle', family: 'for', slot: 'vapen', level: 1, rarity: 'vanlig', durability: 12, text: 'Stavanger Oilers-merke. Fortsatt mer treffsikker enn laget.' },
  { id: 'refleksvest', name: 'Refleksvest fra Statens vegvesen', family: 'for', slot: 'beskyttelse', level: 1, rarity: 'vanlig', durability: 10, text: 'Hjelper ikke mot bitt. Gir tillit hos gamle damer.' },
  { id: 'lommekniv', name: 'Lommekniv', family: 'for', slot: 'verktoy', level: 1, rarity: 'vanlig', durability: 14, text: 'Alle har en. Ingen finner den.' },
  // ---- Fra før, nivå 2
  { id: 'hagle_politibil', name: 'Hagle fra politibilen', family: 'for', slot: 'vapen', level: 2, rarity: 'sjelden', durability: 8, bonus: { muskler: 4 }, text: 'Betjenten trengte den ikke lenger. Han hadde dessuten en dårlig dag.' },
  { id: 'skinnjakke', name: 'Skinnjakke fra MC-butikken', family: 'for', slot: 'beskyttelse', level: 2, rarity: 'vanlig', durability: 12, text: 'Varm, tung og lukter av Hillevåg.' },
  { id: 'jernia_kasse', name: 'Verktøykasse fra Jernia', family: 'for', slot: 'verktoy', level: 2, rarity: 'vanlig', durability: 16, text: 'Aldri åpnet. Skruene sitter fremdeles på kortet.' },
  // ---- Fra før, nivå 3
  { id: 'armbrost', name: 'Armbrøst fra jaktbutikken', family: 'for', slot: 'vapen', level: 3, rarity: 'sjelden', durability: 10, quiet: true, text: 'Stille, og ingen i Rogaland har hørt noe.' },
  { id: 'politivest', name: 'Skuddsikker vest', family: 'for', slot: 'beskyttelse', level: 3, rarity: 'episk', durability: 14, text: 'Skuddsikker. Biter er en grei bonus.' },
  { id: 'presisjonssett', name: 'Presisjonsverktøy fra Kleppestø', family: 'for', slot: 'verktoy', level: 3, rarity: 'sjelden', durability: 16, bonus: { mekk: 4, snoking: 3 }, text: 'Skrutrekkere for briller og for slikt som ikke skal åpnes.' },
  // ---- Unike
  { id: 'u_oks', name: 'Kaptein Tvedts øks', family: 'for', slot: 'vapen', level: 3, rarity: 'unik', durability: 24, bonus: { muskler: 8, nerver: 4 }, places: ['tommerodden', 'sorspissen'], text: 'Skoleskipet er borte, men øksa har overlevd tre kapteiner.' },
  { id: 'u_brann', name: 'Brannmannens vernedress', family: 'for', slot: 'beskyttelse', level: 3, rarity: 'unik', durability: 24, bonus: { kondis: 6 }, places: ['skolen', 'nordkrysset'], text: 'Tåler ild, vann og foreldremøter.' },
  { id: 'u_kiste', name: 'Bestefars verktøykiste', family: 'for', slot: 'verktoy', level: 3, rarity: 'unik', durability: 28, bonus: { mekk: 8, snoking: 4 }, places: ['obs', 'nordkrysset'], text: 'Alt står på riktig plass. Det er det skumleste ved den.' },
  { id: 'u_jaer', name: 'Armbrøst fra Jærmuseet', family: 'for', slot: 'vapen', level: 2, rarity: 'unik', durability: 22, quiet: true, bonus: { snoking: 6 }, places: ['hjem', 'buoy_nord', 'skolen'], text: 'Utstilt som «middelalderen på Jæren». Funker like bra i dag.' },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
