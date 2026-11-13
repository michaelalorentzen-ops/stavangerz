# v0.4 – situasjonsbasert HUD, kartobjekter og QA etter PR #27

Status: **under implementering og faktisk nettlesertest**, ikke ferdig. Gren `feat/v04-situational-hud`, baseline `2737333` / draft #27. Eieren avviste den visuelle ferdigvurderingen og ba orkestratoren bygge en ferdig spillopplevelse med uavhengig vurdering og headless-agenter. Tallbalansering er fortsatt separat. Ingen main-merge eller deploy er autorisert.

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
| F01 – forecast godkjenner last, resolver kaster | Blokkerende. Reprodusert Tananger202 dag95; samme kostnad, prospektive utstyr og avreiselast må valideres i én kontrakt. Offisiell 75-botkjøring skal fullføre uten ukastet unntak. |
| F02 – regionale titler/lukkeknapp overlapper | Kontrolleres på 1280 og 390 i den nye overlayen; korrigeres med faktisk element-/skjermbildebevis. |
| F03 – gammel rules-version | Aktiv regelversjon skal være v0.4; eldre saves skal fortsatt leses. |
| F04 – mobile kartkontroller overlapper | Ny HUD separerer bunnhandling, kartlag og kreditering. Måles og inspiseres i nettleser. |
| F05 – avkuttet Planlegg | Den gamle permanente arbeidskatalogen er erstattet av handlingsvalg og komponist. Bekreftelse må være synlig i alle testede størrelser. |
| S2 – startkort/hendelse uenige om flukt | Deler seedet initialtilstand og faktisk rute; ingen tuning av barrikade/fluktutfall. |
| S3 – anleggsadgang/cruise/vennskap | Skille botstrategi fra umulig crew-arbeid. D27 beholdes: vennskap gir eventuell tilgang, aldri gratis operativt anlegg. |
| S4 – feil landemerkeankre/oppslag | Kontroller faktiske koordinater og polygoninnehold; ingen endring av verdensgrenser eller eldre lagrede holdings. Navn på grov L3 og faktisk sted må ikke blandes. |
| S5 – tekst sier falt når zombier flyttes | Tekst/fakta skal beskrive faktisk fordrivelse og telle bare faktisk flyttede zombier; zombieledger bevares. |
| S8 og øvrig tallbalanse | Registrert, utsatt etter eierens tidligere instruks. Ikke forbedre bottall ved å endre krav eller gi gratis forsyninger. |

## Verifikasjon som gjenstår før sluttvurdering

- Ferdig produksjonsbygg og typekontroll på integrert slutt-head.
- Naturlig desktop-/mobilreise gjennom flere døgn med begge ordreveier, edit/cancel, gear, faktisk rapport og nøyaktig lagring.
- Kritiske felt-/nattvalg kan ikke omgås med Skip/Escape og beholdes ved reload.
- HQ/POI/ZA-bok/region-UI og fysiske leveranser gjennom de nye kontrollene, ikke bare gjennom motorkall.
- Lastkrasj og offisiell 75-kjøring; eksisterende motor-/save-/stedregresjoner.
- Sluttbilder vurderes mot den uavhengige vurderingen, ikke bare DOM-klikk. Mobil er Chromium touch-emulering; faktisk menneskelig langkampanje er ikke påstått utført.

`vercel.json` sperrer automatisk Git-deploy for både den gamle completion-grenen og denne reviewgrenen før første push. Ingen ekstern publisering skal brukes som snarvei til testing.
