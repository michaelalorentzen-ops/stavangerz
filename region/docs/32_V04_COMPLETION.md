# v0.4 – funksjonell ferdigstillelse, balanse utsatt

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

Status er **pågår**, ikke ferdig.

- [ ] D01/D02: operasjoner, reise, obligatoriske felt-/nattvalg og fortsett/skip bruker samme autoritative, serialiserbare flyt.
- [ ] D03/D04: faktisk hovedperson, vedvarende posisjoner, oppdrag/områdeansvar og retur; ingen fysisk dobbelttildeling.
- [ ] D24: feltleder handler normalt selv; opt-in eskalering krever virkelig radio/forbindelse; egne kritiske møter krever spillerens valg.
- [ ] D05–07: L1/L2/L3-inspeksjon, grupperte faktiske crew, avgrenset kartbevegelse og ærlig territoriell kontroll.
- [ ] D08/D20: strukturert rapport, viktige avvik, faseadaptivt grensesnitt og tilgjengelig historikk.
- [ ] D09–12/D26: eksisterende utstyr videreføres med fysisk forsyning, avbestilling og retur også over flere døgn.
- [ ] D13–15: POI-status, alternativ oppdagelse, valgfri personhistorie og kunnskap etter faktisk rapportering.
- [ ] D16/D25: fasekapasitet virker; ingen ny ventetimer eller tvungen historiekjede.
- [ ] D17: de eksisterende avslutningene avledes av samfunnet og får tilstandsbasert epilog.
- [ ] D18/D19: faktisk regional administrasjon, lokale begrensninger, mandat/leder og strategiske spillervalg.
- [ ] D21/D22: tre fungerende grader, separat Hardcore, korrekt hovedpersondød/etterfølger og lagringspolicy.
- [ ] Legacy `region-2`, determinisme, ett oppgjør per døgn, finitte zombier/loot og konservasjon av utstyr/folk/lager er testet.
- [ ] Reell nettleserreise på desktop/mobil dekker ny spillstart, flere døgn, forsyning, feltvalg, POI, kampanjevalg og senfaseadministrasjon.
- [ ] Alle resultater har konkrete scenarier, tester og commits/draft PR-er; ingen main-merge/deploy.

## Beslutninger og balansering

D01–D26 beholdes; D27/D28 er godkjent 13.11.2026. Ingen åpne valg omklassifiseres til LÅST uten svar fra Mikki.

O06 og O09/O10 er godkjent av eieren: eksplisitte anleggsoppdrag med bevarte legacy-effekter og regional ledelse/lokallager/mandat/fysisk forsyning. Implementeringen går videre under D27/D28.

Øvrige numeriske detaljer prøves som konfigurerte hypoteser. Eksisterende kapittelnavn, anonym feltbokstemme og tre avslutningsveier beholdes; oppgaven brukes ikke til å innføre nye store kanoniske mål eller en ny verdensmodell. Balansetuning og endelig vanskelighetskalibrering er utsatt, funksjonelle forskjeller er ikke utsatt.
