/** Curated, finite follow-ups. Context uses reported history and actual local witnesses;
 * no random draws, hidden sites, inferred combat or new simulation fields. */
import type { RegionPoi, RegionState, RegionZone } from './types';
import type { DiscoveryIllustration } from './discovery-content';
export interface FieldContext {
  state: RegionState; zone: RegionZone; pois: readonly RegionPoi[]; witnesses: readonly string[]; source: string;
}
const reported = (c: FieldContext, id: string) => !!c.state.discoveries?.entries[id];
const has = (c: FieldContext, family: string) => reported(c, `local-${family}`);
const controlled = (c: FieldContext) => c.state.zones[c.zone.id]?.status === 'controlled';
export interface ReactiveObservation {
  id: string; title: string; illustration: DiscoveryIllustration;
  matches: (c: FieldContext) => boolean; text: (c: FieldContext) => string;
}
export const REACTIVE_OBSERVATIONS: readonly ReactiveObservation[] = [
  { id: 'shop-return', title: 'Denne gangen har de en liste', illustration: 'shop',
    matches: c => has(c, 'shop') && c.source === 'search' && c.pois.some(p => ['supermarket','mall','pharmacy'].includes(p.siteType ?? '')),
    text: () => 'Handlelista fra den første turen har fått en ny funksjon. Før laget går videre, sier alle hva de faktisk leter etter. De vil ikke bære hjem bare det som er lettest å finne. «Si fra når du finner det du kom for,» sier en av dem. «Så vi vet når vi kan gå hjem.»' },
  { id: 'industry-return', title: 'Hvem kan overta jobben?', illustration: 'industry',
    matches: c => has(c, 'industry') && (c.zone.measures?.industry ?? 0) > 0 && controlled(c),
    text: () => 'Etter at området kom under deres kontroll, ser laget annerledes på industrien. Ikke bare «hva kan vi ta?», men «hvem kan holde dette i gang hvis den flinkeste blir borte?» De bytter på å forklare hva de ser. De stanser ved det de ikke forstår, i stedet for å late som alle kan alt.' },
  { id: 'farm-hunger', title: 'Den siste kassa og neste sesong', illustration: 'farm',
    matches: c => has(c, 'farm') && (c.zone.measures?.farm ?? 0) > 0 && (c.state.stock.food ?? 0) < (c.state.stock.water ?? 0),
    text: () => 'Det er mindre mat enn vann på det rapporterte lageret. Ute ved jordbruksarealene blir samtalen konkret: hvem kan dere avse til varig matarbeid mens andre må finne noe å spise nå? Ingen av dem kan leve av en plan. Dyrkbar mark er en mulighet, ikke en ferdig avling.' },
  { id: 'coast-return', title: 'En vei hjem er også en plan', illustration: 'coast',
    matches: c => has(c, 'coast') && (c.zone.measures?.coastM ?? 0) > 0 && !!c.state.hq,
    text: () => 'Første gang ved vannet snakket de om å komme seg videre. Nå har de et hovedkvarter å komme tilbake til. Laget gjennomgår hvem som bærer lasten og hvor de skal møtes om de blir skilt. De skriver bare inn steder de allerede kjenner. Det er blitt viktigere å avtale hvor de skal tilbake enn hvor langt de kan dra.' },
  { id: 'forest-injury', title: 'Tempoet til den som går sist', illustration: 'forest',
    matches: c => has(c, 'forest') && (c.zone.measures?.forest ?? 0) > 0 && c.witnesses.some(id => c.state.survivors.some(p => p.id === id && p.health < 100)),
    text: c => { const p = c.state.survivors.find(p => c.witnesses.includes(p.id) && p.health < 100)!; return `${p.name} er fortsatt skadet. Mellom trærne avtaler laget å sjekke den som går sist før de fortsetter. «Ikke bare spør om jeg klarer å fortsette,» sier ${p.name}. «Spør om jeg klarer returen også.» Laget må fortsatt velge tid til hvile eller behandling.`; } },
  { id: 'residential-home', title: 'Nabolag, ikke bare søkefelt', illustration: 'residential',
    matches: c => has(c, 'residential') && (c.zone.measures?.homes ?? 0) > 0 && controlled(c),
    text: c => `Dere kontrollerer nå ${c.zone.name}. Mellom boligene snakker laget om forskjellen på å ha vært innom og å ha ansvar for et område. Hva er undersøkt, og hva gjenstår? De faktiske søketimene og kartet er fasiten. De har sluttet å omtale alle gatene som «der ute».` },
  { id: 'residential-perimeter', title: 'Innenfor og utenfor', illustration: 'residential',
    matches: c => has(c, 'residential') && (c.zone.measures?.homes ?? 0) > 0 && controlled(c) && Object.values(c.state.barricades).some(n => n > 0),
    text: () => 'Gruppen har bygget varige sperringer. På kartet peker laget ut hvor de faktisk står; en sperring et annet sted gjør ikke denne gata trygg. Ingen vil at noen skal gå ut med en trygghet kartet ikke lover. «Vis meg hvilken side du mener,» sier en av dem. Pekingen blir til en gjennomgang av de faktiske sperringene.' },
  { id: 'farm-settlement', title: 'Et sted å bli', illustration: 'farm',
    matches: c => has(c, 'farm') && !!c.state.hq && c.state.hq.zoneId === c.zone.id && c.pois.some(p => p.hqType === 'coastFarm'),
    text: () => 'Gården er blitt hovedkvarter. Laget blir stående ved arbeidsplassen og diskuterer hvem som skal være her når de andre går ut. Det er en annen samtale enn på den første turen: ikke bare hvor lenge maten rekker, men hva slags hverdag de vil bygge. Noen må være igjen når de andre drar. For første gang snakker de om det som en hverdag, ikke bare en ventetid.' },
];
export interface ReactiveChoiceStory {
  id: string; title: string; personId: 'tor' | 'leila' | 'marius'; illustration: DiscoveryIllustration;
  siteTypes: readonly string[]; matches: (c: FieldContext) => boolean;
  opening: string; choices: { id: string; label: string; detail: string }[];
}
/** These are fictional situations at a locally observed real POI, never factual claims about it. */
export const REACTIVE_CHOICE_STORIES: readonly ReactiveChoiceStory[] = [
  { id: 'field-workshop-sort', title: 'Skruer eller et helt sett?', personId: 'tor', illustration: 'industry',
    siteTypes: ['carRepair','hardware','industry','shipyard'], matches: c => c.source === 'search' && has(c, 'industry'),
    opening: 'Felthistorie: Tor har sortert et lite, endelig materialfunn under søket. «Løse deler hjelper oss med reparasjoner. Et sammensatt sett hjelper oss å bygge. Vi kan prioritere én av jobbene.» Han legger alternativene ved siden av hverandre og venter på svaret.',
    choices: [ { id: 'parts', label: 'Berg løse reservedeler', detail: '4 arbeidstimer. Berg seks reservedeler til reparasjoner. Byggesettet blir igjen.' }, { id: 'kit', label: 'Gjør klart et arbeidssett', detail: '4 arbeidstimer. Gjør klart fire deler og fire byggematerialer. De løse reservedelene blir igjen.' } ] },
  { id: 'field-care-priority', title: 'Det vi trenger til neste tur', personId: 'leila', illustration: 'shop',
    siteTypes: ['pharmacy','clinic','hospital'], matches: c => c.source === 'search' && c.witnesses.some(id => c.state.survivors.some(p => p.id === id && p.health < 100)),
    opening: 'Felthistorie: Etter søket skiller Leila mellom en liten medisineske og en rasjonskasse. En av dem som er med, er allerede skadet. «Vi må velge for neste tur, ikke late som skaden forsvinner fordi vi har funnet en eske.» Hun holder de to alternativene adskilt. Dere kan prioritere én forsyning; selve behandlingen må dere sette av tid til.',
    choices: [ { id: 'medical', label: 'Prioriter førstehjelp', detail: '4 arbeidstimer. Hent tre medisiner og to batterier. De skadde trenger fortsatt behandling.' }, { id: 'rations', label: 'Prioriter mat og vann', detail: '4 arbeidstimer. Hent seks mat og seks vann. Medisinesken blir igjen.' } ] },
  { id: 'field-home-debrief', title: 'Fortell dem som ble igjen', personId: 'marius', illustration: 'residential',
    siteTypes: ['school','supermarket','outdoorShop','marina','coastFarm'], matches: c => !!c.state.hq && has(c, 'residential') && Object.values(c.state.barricades).some(n => n > 0),
    opening: 'Marius vil ta en gjennomgang hjemme etter dagens observasjoner. «De som blir igjen, må få si hva de trenger å vite før vi går ut igjen.» Dette handler om gruppens faktiske arbeid og forsvar, ikke om et nytt funn eller en kamp. Dere kan sette av tid til samtalen, eller la dette valgfrie sporet ligge.',
    choices: [] },
];
export const reactiveChoiceStory = (id: string) => REACTIVE_CHOICE_STORIES.find(s => s.id === id);
