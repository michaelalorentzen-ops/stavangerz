# v0.4 – situasjonsbasert HUD, kartobjekter og QA etter PR #27

Status: **implementert og teknisk verifisert; klar for eierens spilltest**. Draft [PR #28](https://github.com/michaelalorentzen-ops/stavangerz/pull/28). Gren `feat/v04-situational-hud`, baseline `2737333` / draft #27. Eieren avviste den visuelle ferdigvurderingen og ba orkestratoren bygge en ferdig spillopplevelse med uavhengig vurdering og headless-agenter. Tallbalansering er fortsatt separat. Ingen main-merge eller deploy er autorisert.

## Uavhengig vurdering

Agenten fikk baseline, spillerløftet og eksisterende spesifikasjon/skjermbilder, uten samtalens konkrete HUD-forslag. [Original vurdering](33_V04_INDEPENDENT_UX_REVIEW.md) skiller observasjoner fra forslag. Dette er ekspertgjennomgang, ikke nybegynnerdata.

Hovedfunn: dagens faktiske behov drukner i personkort og arbeidskatalog; vesentlig reise/retur/mandat kommer etter ordrelegging; fase 4 viser fortsatt fase-1-administrasjon; stedets kontekst forsvinner ved scrolling. Etter første nye screenshot-runde krevde samme reviewer også synlige plan-konsekvenser ved bekreftelse, leirnavn, skille mellom valgt/egen sone og kartkontroller uten overlapp.

## Implementert arkitektur

- Kartet fyller arbeidsflaten. Kompakt ressurs-/dag-/faselinje og en ikonrekke er faste; innholdspaneler er lukket ved oppstart.
- Én kontekst av gangen: mannskap, L1/L2/L3 eller et faktisk kjent POI. Person, ZA-bok, HQ og samlet plan bruker større overlays. Ingen endring av det autoritative døgn-/save-regnskapet for å flytte paneler.
- Person → oppdrag → kartmål og sted → handling → folk går til samme komponist. Auto-utstyr, fysiske ruter, retur, reservert last og planlagt nattbemanning vises før bekreftelse. Avbryt/rediger bruker samme kanoniske reservasjonsrekkefølge.
- Navngitte folk har store faste portretter, faktisk utstyr og plassering i personkortet. Ukjent/bundet plassering er ikke et nytt oppdragssted. Mer informasjon foldes etter behov.
- L1/L2/L3 har ærlig delkontroll; styring av HQ, arbeid, forskning, regioner og rapporthistorikk beholdes i dypere visninger.
- Lokale Blender-GLB-er og faktisk Three.js/MapLibre-rendering. Se [modellpakke og verifikasjon](34_V04_WORLD_ASSETS.md). Fire crew, zombie-representant, HQ, barrikade, båt og forsyninger. Faktiske Idle/Walk/Guard-klipp; ingen simulert individuell zombieposisjon eller oppdiktet crew-punkt for områdevakt.
- Symbolske modeller begrenses av zoom/viewport og et objektbudsjett; SVG-fallback ved lav kapasitet/tapt WebGL-kontekst. HQ-huset vises først når HQ faktisk finnes. Bevegelser følger registrerte posisjoner/ruter, og kamera flyttes ved brukerhandling.

## Eierskap

Root eier hovedflyt, HUD/CSS, målvalg, integrasjon og sluttverifikasjon. Kartagent eier ekstrahert MapLibre-komponent/renderlag, modellagent bare Blender/assets, detaljagent bare person-/POI-/HQ-komponenter, ordreagent komponist/dagsplan. QA-kjerneagent eier motor/vekt/initialisering; QA-historieagent eier wonders/hendelsesfiler. Samme fil skrives ikke av to agenter samtidig.

## QA-runde 1 av PR #27 er en leveransegate

Kilde: [Grok QA-kommentar](https://github.com/michaelalorentzen-ops/stavangerz/pull/27#issuecomment-6848402112), testet `2737333`. Root har lest hele kommentaren. Eksterne rapport-/bildefiler som kommentaren nevner er ikke mottatt i dette workspace; relevante problemer reproduseres her.

| Funn | Behandling |
| --- | --- |
| F01 – forecast godkjenner last, resolver kaster | Rettet og regresjonstestet: kostnad, prospektivt utstyr og avreiselast valideres sammen. Radio og leverings-/transportbåter reserveres fysisk. 75 botspill fullført uten unntak; Tananger202/303 begge dag150. Se kandidatavgrensning nedenfor. |
| F02 – regionale titler/lukkeknapp overlapper | Rettet og verifisert på1280/390 med faktiske tekst-ranges mot lukk; også lang POI-tittel er rettet. |
| F03 – gammel rules-version | Rettet til region-0.4 for nye spill. Eldre versjonsfelt/saves leses fortsatt; regresjon grønn. |
| F04 – mobile kartkontroller overlapper | Rettet. Faktisk måling1280/390: ingen overlapp eller blokkerte knapper; mobile kart-/døgnknapper44×44. Lukket søk nullstiller arvet sidebarhøyde. |
| F05 – avkuttet Planlegg | Erstattet med handlingsvalg og fast bekreftelsesrad. Komponist/dagsplan er verifisert gjennom naturlige desktop-/mobilreiser. |
| S2 – startkort/hendelse uenige om flukt | Rettet: valgt startkort deler seedet initialtilstand og faktisk rute med flukthendelsen. Alle andre kartsoner bruker fortsatt billig overslag. Ingen tuning av barrikade/fluktutfall. |
| S3 – anleggsadgang/cruise/vennskap | Rettet reell fraksjonssperre og manglende zombieintel ved fraksjonsspeiding. Faktiske crew-døgn går discovered→secured→operational for alliert domkirke og separat cruiseskip. D27 beholdes; ingen gratis drift. |
| S4 – feil landemerkeankre/oppslag | Rettet med Kartverket-punkter og polygoninnehold/hull. Verdensgrenser og eldre holdings beholdes. Eksisterende grove L3-navn stemmer fortsatt ikke med dagligtalens Mosterøy/Jåttåvågen; se docs34_PR27_STORY_QA.md. |
| S5 – tekst sier falt når zombier flyttes | Rettet: beskriver faktisk fordrivelse, inkludert null når ingen lovlig mottakersone finnes. Zombieledger beholdes og er regresjonstestet. |
| S8 og øvrig tallbalanse | Registrert, utsatt etter eierens tidligere instruks. Ikke forbedre bottall ved å endre krav eller gi gratis forsyninger. |

## Sluttkontroll

Produksjonsbygg, motorgate, naturlige desktop-/mobilreiser, obligatoriske felt-/nattvalg og kart/fallback er verifisert. Regional-/POI-/forsyningskontekstene passerer i begge bredder etter de siste mobilrettelsene. Se resultatene under; ingen menneskelig langkampanje er påstått utført.

`vercel.json` sperrer automatisk Git-deploy for både den gamle completion-grenen og denne reviewgrenen før første push. Ingen ekstern publisering skal brukes som snarvei til testing.

## Verifisert på integrert produksjonsbygg

- TypeScript og produksjonsbygg grønt. Samlet `check:v04` kjører nå 18 tester, inkludert faktisk 29→31kg-utstyrslast, radio/transportbåt, savekompatibilitet, eksplisitt anleggsarbeid, zombieledger og stedskilder. Hendelser:117 registrerte,112 bygget over16 tilstander; de fem spesielle hendelsene krever egne situasjoner, ikke påstått generelt dekket.
- `check:region-ui`: naturlig start med seed101, fire introtrinn og hovedpersonvalg; desktop1600×1000 gjennom8 døgn og mobil390×844 gjennom6. Ingen state-injeksjon. Begge ordreveier, rediger/fjern, auto-equip, HQ, bok, historisk dagsrapport og eksakt save/reload passerer. Kartstart bruker vanlig bevegelse; etter kartbildet brukes redusert bevegelse for resten av reisen i SwiftShader. Dette er testverktøyets valg, ikke en endring av spillerens standard.
- `check:region-checkpoints-ui`: erklærte Hardcore-fixtures for reell felt-/nattpause. Med vanlig bevegelse finnes ingen Skip, Escape kan ikke lukke, døgnet er låst. Eksakt reload før/etter valg, deterministisk continuation og nattammo40→35 én gang passerer.
- `check:region-map-ui`: fire faktiske crew-GLB-er på riktig kartnivå, klikkbare kjente POI-er, ingen punktfigur for ukjent/områdevakt, L2-aggregering, WebGL-tap→SVG→gjenopprettede GLB-er. Ingen JavaScript-feil.
- `check:region-completion-ui`: erklært fase4-fixture, faktiske HQ-faner, POI-overlay, regionalt HQ og fysisk leveranse12mat/12vann/to voksne gjennom planlegger og ett døgn. Begge bredder1280/390 passerer etter rettelsene nedenfor.
- Offisiell `region:bot 150 3 8`:75 spill,48 overlevende,0 seire, fasefordeling40/11/13/10/1, ingen kastet feil. Kjøringen lastet F01/S2/versjon/rutecache før siste S3-hook og egen leveringsbåtvalidering; derfor er dette stabilitetsbevis for lastkrasj-kandidaten, ikke en ny75-kjøring av eksakt slutt-head. De siste tilleggene har egne reelle endDay-/båtregresjoner i den grønne integrerte gaten. Ingen balansetuning.

Testresultater lagres i [evidence/v04-hud](evidence/v04-hud). Tidligere mislykkede utviklingskjøringer holdes som lokale artifacts; bare eksplisitt beståtte resultater brukes som sluttbevis.

## Konkrete feil funnet i slutt-QA

Mobilens regionale overskrift og en lang POI-tittel traff lukk. POI-headeren har nå en gridkolonne som kan bryte teksten og plass til lukk. Regionaloverskriften arvet en horisontal toolbar; tekst traff lukk. Den har nå vertikal flyt og reservert plass til44px lukk. Lukket søk arvet `bottom` fra gammel sidebar og dekket et høyt kartfelt; ankeret nullstilles. Kartknapper får44×44 på mobil; tegnforklaring, kreditering, råd og kartkontroller har egne høyder. Faktiske tekst-ranges, mål og pekeradgang er bekreftet i det nye produksjonsbygget på1280/390.

## Avgrensning før eierens spilltest

Balanse/tuning, særlig vannøkonomi, rasjonering/barnearbeid og sen botprogresjon, er utsatt etter instruks. Det gjenstår menneskelig vurdering av lesbarhet, underholdning og langkampanjens rytme; automatiserte klikk og ekspertvurdering erstatter ikke dette. Modellene er en første original low-poly-pakke, ikke en ferdig karakterkunstproduksjon. Faktisk mobilmaskinvare og alle GPU-er er ikke testet; Chromium touch390 er testgrunnlaget. Verdensdata og gamle lagrede stedstilknytninger er ikke omtegnet for å samsvare med dagligtalens stedsnavn.
