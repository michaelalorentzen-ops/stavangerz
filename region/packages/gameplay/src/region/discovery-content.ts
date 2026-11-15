/** Curated fiction attached only to actual reported places. No rules or reward amounts live here. */
import type { RegionPoi, RegionZone } from './types';

export type DiscoveryIllustration = 'residential' | 'shop' | 'industry' | 'coast' | 'forest' | 'farm';
export interface LocalObservation {
  id: string; title: string; illustration: DiscoveryIllustration;
  matches: (zone: RegionZone, pois: readonly RegionPoi[]) => boolean;
  text: string;
}
/** Once each, not one cache per zone. These observations create no stock, enemies or stat changes. */
export const LOCAL_OBSERVATIONS: readonly LocalObservation[] = [
  { id: 'shop', title: 'Skiftet som aldri tok slutt', illustration: 'shop',
    matches: (_zone, pois) => pois.some(p => ['supermarket', 'mall', 'pharmacy'].includes(p.siteType ?? '')),
    text: 'En håndskrevet handleliste har havnet mellom to hyller: melk, brød, bursdagslys. Laget blir stående litt før de går videre. Det som var en vanlig handletur, ble aldri ferdig. Lista blir med i feltboka; det er fortsatt det faktiske søket som avgjør hva de får med seg hjem.' },
  { id: 'industry', title: 'En arbeidsdag på pause', illustration: 'industry',
    matches: (zone, pois) => (zone.measures?.industry ?? 0) > 0 || pois.some(p => ['carRepair', 'hardware', 'industry', 'shipyard'].includes(p.siteType ?? p.hqType ?? '')),
    text: 'Ved en pauseplass ligger et par arbeidshansker. Én er vrengt. Noen har skrevet «tilbake etter lunsj» på en pappbit. Laget tar en pause selv og fordeler hvem som bærer hva. Et verksted kan være verdifullt, men ingenting hjelper leiren før det er undersøkt og fraktet dit.' },
  { id: 'farm', title: 'Det som kan vokse videre', illustration: 'farm',
    matches: (zone, pois) => (zone.measures?.farm ?? 0) > 0 || pois.some(p => p.hqType === 'coastFarm' || p.siteType === 'greenhouse'),
    text: 'En tom frøpose har falmet i et vindu. På baksiden står en kort påminnelse om å vanne. Laget begynner å snakke om mat som kan komme igjen, i stedet for enda en kasse som tømmes. Ingen har startet dyrkingen her ennå. Det krever arbeid, folk og et sted dere kan holde.' },
  { id: 'coast', title: 'Fortøyningen', illustration: 'coast',
    matches: (zone, pois) => (zone.measures?.coastM ?? 0) > 0 || pois.some(p => ['marina', 'ferry'].includes(p.siteType ?? '')),
    text: 'Et løst tau slår mot en stolpe ved vannet. Lyden er liten, men alle stanser. Når de går videre, har laget skrevet tre spørsmål i margen: hvor kan vi legge til, hva kan vi bære, og hvordan kommer vi hjem? Kysten gir muligheter. En brukbar båt må fortsatt finnes og klargjøres.' },
  { id: 'forest', title: 'Mellom trærne', illustration: 'forest',
    matches: zone => (zone.measures?.forest ?? 0) > 0,
    text: 'Trærne gjør det vanskelig å holde øyekontakt. Laget stanser og avtaler et lavt signal før de fortsetter. En hånd opp. Vent. Kom nærmere. De teller folk på nytt. Stillheten kan føles trygg, men de lar dagens speiderrapport avgjøre hva de faktisk vet om faren.' },
  { id: 'residential', title: 'Noens vanlige morgen', illustration: 'residential',
    matches: zone => (zone.measures?.homes ?? 0) > 0,
    text: 'En sko ved en terskel blir stående i feltboka. Noen tenker på sin egen gang hjemme. Ingen sier det høyt. Laget teller hvilke deler av boligområdet de allerede har undersøkt, og hva som må vente. Bak hver dør kan det ligge en vanlig morgen som stoppet opp.' },
];

export interface PersonDiscoveryStory {
  id: string; personId: 'ingrid' | 'leila' | 'marius'; title: string; illustration: DiscoveryIllustration;
  siteTypes: readonly string[];
  clue: string; investigation: string; followLabel: string; followDetail: string;
  stopLabel: string; stopDetail: string; stopCargo: 'ordinaryFood' | 'ordinaryMedical' | 'salvage';
  followup: string; finish: string; shareLabel: string; shareDetail: string; supplyLabel: string; supplyDetail: string;
}
/** Existing Tor chain is deliberately not rewritten; these are separate optional paths. */
export const PERSON_DISCOVERY_STORIES: readonly PersonDiscoveryStory[] = [
  {
    id: 'ingrid-route-notes', personId: 'ingrid', title: 'Strekene i margen', illustration: 'residential',
    siteTypes: ['school', 'supermarket', 'outdoorShop'],
    clue: 'Ingrid legger merke til en brettet lapp med piler i margen. «Noen prøvde å holde orden mens alle andre løp.» Hun vil undersøke den selv. Foreløpig er det bare streker; dere vet ikke hvor de fører.',
    investigation: 'Ingrid sammenligner lappen med stedene laget kjenner. Hun setter spørsmålstegn ved flere av pilene. Ved siden av ligger en liten forsyningskasse. Dere kan ta den nå, eller bruke mer tid på notatene. «Jeg vil at de andre også skal kunne lese det vi faktisk vet.»',
    followLabel: 'Følg Ingrids notater videre', followDetail: 'Ingen forsyning nå. Ingrid må bruke et nytt oppdrag på et kjent sted; dere kan når som helst la sporet ligge.',
    stopLabel: 'Ta rasjonene og gå videre', stopDetail: 'Ta rasjonene og vannet som fysisk last. Notatene legges bort, og sporet avsluttes.', stopCargo: 'ordinaryFood',
    followup: 'Ingrid har tatt vare på notatene. Neste arbeid er å gå gjennom dem ved det avtalte stedet, der laget allerede kjenner omgivelsene. «Det hjelper ikke at bare jeg forstår mine egne streker.»',
    finish: 'Ingrid har ordnet notatene og gjort klart en gjennomgang. Under arbeidet har hun også berget et lite arbeidssett. «Vi skal ikke være avhengige av at jeg går først hver gang.» Dere kan prioritere erfaringen som binder laget sammen, eller utstyret dere trenger til neste jobb.',
    shareLabel: 'La Ingrid gå gjennom det med gruppen', shareDetail: 'Øk håpet i leiren og Ingrids tillit. Arbeidssettet blir igjen.',
    supplyLabel: 'Prioriter det bergede arbeidsutstyret', supplyDetail: 'Ta delene og materialene som fysisk last. Ingen felles gjennomgang denne gangen.',
  },
  {
    id: 'leila-care-notes', personId: 'leila', title: 'Navn uten svar', illustration: 'shop',
    siteTypes: ['pharmacy', 'clinic', 'hospital', 'school'],
    clue: 'Leila finner en slitt oppslagsside i en mappe. Noen har skrevet navn, andre har bare satt en strek. «Vi vet ikke hva som hendte med dem.» Hun vil lese videre, men ber de andre om å vente med å trekke slutninger.',
    investigation: 'Mellom navnene står små påminnelser: husk vann, spør igjen, sett deg ned hos den som er redd. Leila leser en av dem to ganger. En førstehjelpskasse kan tas med nå. Ellers kan hun bruke mer tid på notatene og ta en samtale med gruppen om hvordan de passer på hverandre.',
    followLabel: 'La Leila følge notatene videre', followDetail: 'Ingen medisin nå. Et nytt oppdrag på et kjent sted kreves før dere tar neste valg.',
    stopLabel: 'Ta førstehjelpskassen og avslutt', stopDetail: 'Ta medisinen og batteriene som fysisk last. Dere avslutter sporet her.', stopCargo: 'ordinaryMedical',
    followup: 'Leila tok vare på mappen. Ved neste undersøkelse vil hun sortere de enkle rådene fra alt de ikke vet. «Jeg vil at dette skal bli mer enn en liste over dem vi ikke kunne hjelpe.»',
    finish: 'Leila har gjort notatene til en samtale om hva folk trenger før de ber om hjelp. «Jeg kan ikke love at alle klarer seg. Men vi kan love å følge med.» Det praktiske arbeidet ga også et lite sett med deler og materialer. Dere må velge hva dere prioriterer.',
    shareLabel: 'La Leila holde samtalen med gruppen', shareDetail: 'Øk håpet i leiren og Leilas tillit. Arbeidssettet blir igjen; dette erstatter ikke medisinsk behandling.',
    supplyLabel: 'Behold arbeidssettet til senere', supplyDetail: 'Ta delene og materialene som fysisk last. Samtalen med gruppen blir lagt bort.',
  },
  {
    id: 'marius-return-notes', personId: 'marius', title: 'Det siste punktet på lista', illustration: 'forest',
    siteTypes: ['outdoorShop', 'shootingRange', 'marina', 'hardware', 'coastFarm'],
    clue: 'Marius stanser ved en sjekkliste med bare tre punkter. Det siste er understreket: «Tell alle på vei hjem.» Han sier lite, men ber om å få undersøke resten selv.',
    investigation: 'Lista handler om ansvar når folk går ut sammen. Marius vil ikke bruke den som en fortelling om noen han ikke kjenner. Det er også brukbare reservedeler å berge. Dere kan ta delene og avslutte, eller la ham prøve å gjøre lista til en felles vane.',
    followLabel: 'La Marius arbeide videre med lista', followDetail: 'La delene stå. Marius trenger et nytt oppdrag på et kjent sted før han kan legge fram sitt forslag.',
    stopLabel: 'Berg reservedelene og avslutt', stopDetail: 'Ta reservedelene som fysisk last. Lista blir lagt bort, og sporet avsluttes.', stopCargo: 'salvage',
    followup: 'Marius har tatt lista med videre. Ved det kjente samlingsstedet vil han arbeide med den før han sier mer. «Hvis vi skal fortsette å gå ut sammen, må alle få komme til orde om veien hjem.»',
    finish: 'Marius legger lista på bordet. «Det første er å komme fram. Det andre er å komme hjem. Det tredje er å vite hvem vi mangler.» Arbeidet har også gitt et lite praktisk sett. Dere må velge hva dere prioriterer.',
    shareLabel: 'La Marius ta gjennomgangen med gruppen', shareDetail: 'Øk håpet i leiren og Marius sin tillit. Det praktiske settet blir igjen.',
    supplyLabel: 'Ta vare på arbeidssettet', supplyDetail: 'Ta delene og materialene som fysisk last. Ingen felles gjennomgang denne gangen.',
  },
];
export const personDiscoveryStory = (id?: string) => PERSON_DISCOVERY_STORIES.find(story => story.id === id);
