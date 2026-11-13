# v0.4 – historisk funksjonsleveranse fra PR #27

> **Revurdert etter eiers gjennomgang 13.11.2026:** Den tidligere ferdigvurderingen nedenfor var for vid. UI/visuell spillopplevelse er ikke godkjent, og uavhengig QA av commit2737333 fant også F01 (lastkrasj). Ny leveranse må bestå både HUD-revisjon og QA-funn før den kan kalles klar. Se [33](33_V04_INDEPENDENT_UX_REVIEW.md) og [35](35_V04_HUD_AND_QA.md). Resten av notatet dokumenterer hva som faktisk ble levert og testet da.

Oppdrag 13.11.2026: Mikki ønsker resten av v0.4 implementert. Tallbalansering kan vente. Dette omfatter hele 27-spesifikasjonen, også regional drift og eksisterende avslutningsveier, ikke bare den tidligere fase-1-slicen. Tidligere forbud mot main-merge/deploy gjelder fortsatt.

Baseline: `feat/v04-personal-gear` / `0cedd86`, draft #26. Ingen lokale brukerendringer ved oppstart. Integrasjonsgren: `feat/v04-completion`.

## Arbeid og eierskap

| Pakke | Ansvar | Filer | Akseptanse |
| --- | --- | --- | --- |
| Fysisk operasjon | core-agent | engine/types/location/gear/rules/kit, mobility/communications | Faktiske reiser/returer, depothenting, forsyning, områdevakt, lagringsbare feltvalg og D24. Ingen teleport eller dobbelt regnskap. |
| Kampanje | campaign-agent | campaign/progress/saveadapter, kontrollkomponent | Story/Survival/Realistic, separat Hardcore, normal etterfølger, krasjtrygg enkeltlagring og strukturerte eksisterende avslutninger. |
| Oppdagelse | discovery-agent | discoveries/wonders/events-wonders, POI-journal | Ledetråd→undersøkelse→valg→konsekvens, kort POI-møte og personbundet flerdagershistorie; ingen obligatorisk historie eller hemmelig kunnskap fra døde lag. |
| Administrasjon | regional-agent | administration/economy/society, regionkomponent | Navngitt leder, faktisk regionalt depot/befolkning/arbeid, mandat, begrenset rutineautonomi og oppfølging ved død/underskudd. |
| Integrasjon og presentasjon | orkestrator | region-game/CSS, operativt kart, dokumentasjon, felles QA | Hele reisen i faktisk UI på desktop/mobil, ærlig kart i alle zoomnivåer, gjenopptakbare valg og tilgjengelige kontroller. |

Én eier for engine/types. Øvrige pakker sender typer og rene hooks dit; de lager ikke egne døgnmotorer. Regionalt depot bruker samme fysiske lagerkontrakt som forsyningsoppdrag. Befolkningen må ikke dobbelttelles mellom empiretotal, lokalt arbeid og navngitte personer.

## Kravliste før «ferdig unntatt balanse»

Funksjonell v0.4 er implementert og kontrollene nedenfor består. Kandidaten er klar for eierspilltest; tallbalansering og langspilling er fortsatt utsatt, og ingen balanse er eiergodkjent.

- [x] D01/D02: operasjoner, reise, obligatoriske felt-/nattvalg og fortsett/skip bruker samme autoritative, serialiserbare flyt.
- [x] D03/D04: faktisk hovedperson, vedvarende posisjoner, oppdrag/områdeansvar og retur; ingen fysisk dobbelttildeling.
- [x] D24: feltleder handler normalt selv; opt-in eskalering krever virkelig radio/forbindelse; egne kritiske møter krever spillerens valg.
- [x] D05–07: L1/L2/L3-inspeksjon, grupperte faktiske crew, avgrenset kartbevegelse og ærlig territoriell kontroll.
- [x] D08/D20: strukturert rapport, viktige avvik, faseadaptivt grensesnitt og tilgjengelig historikk.
- [x] D09–12/D26: eksisterende utstyr videreføres med fysisk forsyning, avbestilling og retur også over flere døgn.
- [x] D13–15: POI-status, alternativ oppdagelse, valgfri personhistorie og kunnskap etter faktisk rapportering.
- [x] D16/D25: fasekapasitet virker; ingen ny ventetimer eller tvungen historiekjede.
- [x] D17: de eksisterende avslutningene avledes av samfunnet og får tilstandsbasert epilog.
- [x] D18/D19: faktisk regional administrasjon, lokale begrensninger, mandat/leder og strategiske spillervalg.
- [x] D21/D22: tre fungerende grader, separat Hardcore, korrekt hovedpersondød/etterfølger og lagringspolicy.
- [x] Legacy `region-2`, determinisme, ett oppgjør per døgn, finitte zombier/loot og konservasjon av utstyr/folk/lager er testet.
- [x] Reell nettleserreise på desktop/mobil dekker ny spillstart, flere døgn, forsyning, feltvalg, POI, kampanjevalg og senfaseadministrasjon.
- [x] Alle resultater har konkrete scenarier, tester og commits/draft PR-er; ingen main-merge/deploy.

## Beslutninger og balansering

D01–D26 beholdes; D27/D28 er godkjent 13.11.2026. Ingen åpne valg omklassifiseres til LÅST uten svar fra Mikki.

O06 og O09/O10 er godkjent av eieren: eksplisitte anleggsoppdrag med bevarte legacy-effekter og regional ledelse/lokallager/mandat/fysisk forsyning. Implementeringen går videre under D27/D28.

Øvrige numeriske detaljer prøves som konfigurerte hypoteser. Eksisterende kapittelnavn, anonym feltbokstemme og tre avslutningsveier beholdes; oppgaven brukes ikke til å innføre nye store kanoniske mål eller en ny verdensmodell. Balansetuning og endelig vanskelighetskalibrering er utsatt, funksjonelle forskjeller er ikke utsatt.


## Implementert

- Fysiske L3-ruter, sjøtransport med reell båtreservasjon, oppdrag over flere døgn, tilbakekalling/alternativt retursted, depothenting, forsyningslast, løst gear og passasjerer. Last, folk og lokalt forbruk følger samme motorregnskap.
- Hovedpersonens feltmøter og kritiske HQ-netter kan pause og gjenopptas fra JSON. Radioeskalering krever både opt-in, faktisk utstyr/strøm, rekkevidde og bemannet HQ. Andre feltledere følger mandatet.
- Story/Survival/Realistic er funksjonelt forskjellige profiler. Hardcore er separat; fysisk avatar forblir samme person også på reise. Normal modus tilbyr eksplisitt etterfølger. Atomisk state/kvittering lagres før UI-overgangen; avvist/feilet lagring beholder forrige checkpoint.
- Oppdagelser har private feltnotater, rapportering ved levende hjemkomst/verifisert radio, fire alternative kilder, en kort lokal valghistorie og en valgfri Tor-kjede med to grener. Persondød kan lukke sporet uten å blokkere vanlig progresjon.
- Alle seks unike anlegg krever egne crew-trinn for undersøkelse/sikring og drift før nye effekter aktiveres. Gamle aktive anlegg og allerede lagrede hendelsesløfter bevares.
- Regionale HQ-er har navngitt lokal leder, lokale innbyggere, endelig lager, forsvar/balanse/vekst, produksjon, sanking, bygging, vaktbudsjett og avvik. Nye ledere bekreftes aktivt ved tap. Strategiske lover/diplomati/krig forblir spillervalg.
- L1/L2/L3-inspeksjon, faktiske crew-/områdeplasseringer, synlige ruter, avgrensede og kollisjonsskjermede kartetiketter, reelle faseøyeblikk i avspilling og inntil tre valgte infokort. Faste kort er UI-preferanser og endrer ikke kampanjens historikk.
- Oppdatert ZA-bok/feltjournal, åpne saker i handlingslinjen, rapportarkiv og samlet innsyn i lager/gear. 18 lokale WebP-bilder inkluderer de fire portrettene, intro, rapportmotiver, fase 2–5 og seier/tap.
- De tre eksisterende seiersveiene får epiloger fra faktisk samfunn, forskning og krønike. Hardcore-død viser permanent tap, og arver aldri en seiersfortelling.

## Verifisert

| Kontroll | Resultat og grense |
| --- | --- |
| TypeScript og produksjonsbygg | Bestått på integrasjonen; alle Next-ruter bygges. |
| `pnpm check:v04` | 16 motor-/lagrings-/regresjonsskript. Inkluderer eksisterende eldre spillkontroller; alle består. |
| Naturlig desktopreise | Chromium 1440×1000, åtte gjennomførte døgn fra vanlig start, full intro, avatar, utstyr/låser/loot, søk/rydding/overtakelse/HQ/arbeid, avspilling/skip, rapportarkiv og eksakt reload. |
| Naturlig mobilreise | Chromium touch 390×844, seks gjennomførte døgn med samme kjerneløkke, faktisk kartberøring, dialoger og lagring. Ingen horisontal side-overflow. |
| Kritiske valg | Faktiske natt- og feltcheckpoints, Escape/skip kan ikke omgå valg. Reload før/etter, eksakt sammenligning med deterministisk fortsettelse og engangs ammunisjonsbruk. |
| Utvidet regional nettleserreise | Etablert HQ, valgt mandat, sendt faktisk mat/vann og to voksne med samlet crew, frigjort en lokal innbygger uten teleport, L2-inspeksjon og eksakt reload. |
| Oppdagelser/anlegg i nettleser | Full lokal POI-historie over to døgn, og katedral undersøkt/sikret deretter satt i drift med separate crew-oppdrag over to døgn. |
| D25 i nettleser | Klar kjerne på tre soner går til fase 2 i faktisk døgnflyt; fasekort og bokkapittel 2 blir tilgjengelige på mobil. Dette er en erklært kapasitet-fixture, ikke en vanlig dag-1-gjennomspilling. |
| Faste infokort | Valgt Tor-kort vises i kartet og beholdes ved reload uten å endre kampanjetilstanden. Kort er begrenset til tre, kan løsnes og gjelder gjennom fasene. |
| Moduser/epiloger | Reelt Realistic+Hardcore-valg på mobil. Alle tre seiersgater og avatardød testes i motor; seiers-/tapsskjerm testes i nettleser. |
| Hendelser | 117 registrerte, 112 bygget på 16 bottilstander; alle tilgjengelige valg løses. Fem spesialhendelser mangler i denne generelle prøven; den nye radiohendelsen har i tillegg egne faktiske EventDef-scenarioer. |
| Bilder | Lokalt manifest og alle 18 filer kontrollert. Nye motiver er inspisert, ingen eksterne kart-/bildetjenester er påkrevd. |

De sene nettleserscenarioene bruker tydelig navngitte fixtures for å nå regional drift, feltcheckpoint, anlegg og avslutninger uten å late som en kort naturlig gjennomspilling dekker hele kampanjen. Rå skjermbilder/journaler ligger ignorert under `region/artifacts/v04-final-*`.

Nettleser-/integrasjonsfeil rettet under prøven: klikkblokkerende områdeetiketter, nye rekrutter uten kanonisk plassering, fjernallokerte folk som kunne blitt promotert ved feil HQ, og sammenblanding av reiseavstand med territoriell claim-/leirflyttingsgrense. Hver motorfeil har en konkret regresjon.

## Fortsatt å gjøre

Tallbalansering og langvarig menneskelig spilltest er utsatt etter Mikkis instruks. Mat/vann, ammunisjon, bærekapasitet/reisetid, vanskelighetsprofiler, anleggskostnader, forskning og terskler mellom fasene skal tunes gjennom faktisk spilling. Det er ikke utført en sammenhengende menneskelig kampanje fra fase 1 til alle tre seire; senfasene er kontrollert med motor- og nettleserscenarioer. Mobilvisning er testet med Chromium touch-emulering, ikke en fysisk telefon.

Nye kanoniske kapittelnavn, fortelleridentitet eller flere seiersveier er ikke valgt på eierens vegne. Eksisterende rammer er ferdigstilt. Håndheving mot eksterne devtools/filmanipulasjon er ikke en del av lokal Hardcore-lagring.

## Gren, review og kjøring

Draft [#27](https://github.com/michaelalorentzen-ops/stavangerz/pull/27), `feat/v04-completion`, basert på `feat/v04-personal-gear` / #26. Den følger den eksisterende draft-stakken; ingen main-merge er utført. Verdensdata og Buøy-spillkode er bevart.

Kjør fra `region/` med pnpm-versjonen i `packageManager` (10.17.1): `pnpm dev`, eller `pnpm build` etterfulgt av `pnpm start`. Funksjonskontroll: `pnpm check:v04`. Mot en kjørende produksjonsserver: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm check:region-ui` og `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm check:region-completion-ui`.

Første autoriserte draft-push utløste repoets eksisterende Vercel-integrasjon og laget en automatisk PR-preview av commit `7bc8d3c`. Ingen manuell deploy, produksjonspromotering eller main-merge er utført. For å respektere instruksen om ingen deploy er `vercel.json` lagt til med `git.deploymentEnabled["feat/v04-completion"] = false`; øvrige grener/prosjekter endres ikke. Den automatiske previewen er ikke sluttkandidaten og skal ikke brukes som bevis på denne testingen.

### Skjermbilder fra den faktiske testen

- [L2-kart med fysisk crew og fast Tor-kort](evidence/v04-district-and-pinned-crew.png).
- [Mobil faseovergang etter D25](evidence/v04-mobile-phase-two.png).
- [Mobil feltjournal etter et avsluttet POI-valg](evidence/v04-mobile-completed-story.png).

Siste utvidede nettleserkjøring: **7 scenariogrupper består**, ingen nettleserfeil. Produksjonsbygget inkluderer rekrutt-, claim-/relocate- og kartrettingene. De naturlige reisene ble kjørt før de siste avgrensede rettingene; disse har egne motorregresjoner, og siste browserkjøring kontrollerer blant annet en faktisk ny rekrutt, kartklikk og lagring.
