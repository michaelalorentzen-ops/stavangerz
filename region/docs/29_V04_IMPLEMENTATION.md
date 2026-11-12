# StavangerZ v0.4 – orkestrator og implementeringsplan

**Status 12.11.2026:** M0 er dokumentert. M1-motor og UI er implementert i **draft-PR-er**, men ikke merget eller deployet.  
**Mål:** Lever v0.4 i verifiserbare, spillbare trinn uten å miste oversikt over eierens låste valg.

Les i denne rekkefølgen:

1. `AGENTS.md` i `region/` (arbeidsmandat, sikkerhet, felles prinsipper).
2. `docs/27_V04_MASTER_SPEC.md` (produktkrav og akseptanse).
3. `docs/28_V04_DECISIONS.md` (låste og åpne valg).
4. Dette dokumentet (rekkefølge, eierskap, test- og merge-gates).
5. `docs/26_V03.md` + eksisterende kode (faktisk baseline, **ikke** normativ v0.4-design).

## A. Orkestratorens kontrakt

**Én orkestrator** har ansvar for å bevare produktintensjonen, koordinere avhengigheter, holde oppgavelisten korrekt, samle blokkerende spørsmål og kontrollere integrasjonen. Arbeidende agenter kan skrive og teste innenfor sitt tildelte område, men får **ikke** gjøre egne, irreversible produktvalg.

En orkestrator er en **arbeidsrolle i en aktiv økt/CI-prosess**, ikke et løfte om at agenter kjører videre etter at chatten lukkes. Fremdrift og uavklarte valg må derfor finnes i repo/PR, ikke bare i agentens minne.

### Arbeidsløype

1. **Oppstart:** inspiser branch, dirty worktree, åpne PR-er, relevante kontrakter og siste verifiserte milepæl. Ikke overskriv andres endringer.
2. **Avhengigheter:** velg den minste leveransen som skaper en spillbar forbedring. Registrer hvilke typer og API-er andre agenter trenger.
3. **Delegering:** én eier per filgruppe. Separate branches/worktrees/PR-er ved parallelt arbeid; ingen parallelle skrivinger i samme delte filer.
4. **Utførelse:** agenter viser endret atferd, ikke bare ny kode. Nye antakelser merkes `HYPOTESE`; åpne produktspørsmål sendes til orkestrator.
5. **Kontroll:** kjør relevante testscripts, inspiser diffs og kontroller master spec. Ikke skjul manglende tester eller uavklarte regler.
6. **Integrasjon:** merge i avhengighetsrekkefølge etter godkjent review. Rebase/oppdater andre arbeidspakker på autoritative kontrakter.
7. **Status:** loggfør hva som virker, hva som mangler, risiko og **maksimalt noen få** reelt blokkerende spørsmål. Ingen kontinuerlig rapportering fra hver agent direkte til Mikki.

### Eskaleringskriterier

Orkestratoren spør eieren når det gjelder:

- Brudd eller endring av en **LÅST** regel i beslutningsloggen.
- Uavklart valg som påvirker saveformat, verdensmodell, grunnløkken, personlig dødelighet, styringsform eller milepælens omfang.
- Vesentlig økning i tids-/kostnadsomfang eller arbeid som krever data-/tjenestemigrering, publisering eller ny myndighet.

Et spørsmål skal oppsummere **A/B**, anbefaling, konsekvenser og hvilke arbeidsstrømmer som er blokkert. Ikke stans andre uavhengige oppgaver mens eieren svarer. Endre aldri `ÅPEN` til `LÅST` uten eierens eksplisitte beslutning.

## B. Referansebaseline og teknisk risiko

| Tema | v0.3-baseline / risiko | v0.4-konsekvens |
| --- | --- | --- |
| Verdensdata | 663 L3, omtrent 110 L2 og 16 L1 i tidligere inventar; faktisk JSON har forrang | Bevar stabile ID-er; tving ikke omredigering av soner som del av UI-arbeid. |
| Motor | Døgnsimulering og headless-bot finnes | Utvid deterministisk motor; ikke legg spillregler i React. |
| Folk | Named crew + aggregert befolkning, begrenset vedvarende geografisk crew-posisjon | Trenger eksplisitt posisjon, reise, hjemkomst, oppdrag og områdeansvar. |
| Døgn | Nåværende ordre løses sekvensielt | Definer tidsfaser, ressurskonflikter og lagringsbare pausepunkter. |
| Utstyr | Eksisterende inventar er ikke fullt reservasjons-/transportregnskap | Nye kontrakter for `available/reserved/carried/in_transit/stored`. |
| Progressjon | Fase 2 kan nås svært tidlig i bot-test | Kapasitetsgates og visbar progresjonsoversikt. |
| Hendelser | ~115 hendelser med eksisterende valg og kjeder | Klassifiser blokkering/delegering, fasevikt og posisjonskrav. |
| POI | Seks unike wonders, flere automatisk knyttet til sonetakning | Avklar overgang til oppdaget/sikret/operativt POI. |
| Kart | Eget lokalt OSM-baserte kart, 3D-bygg, tåkekrig | Bevar offline kart; viewport-/zoomstyrt animasjon. |
| Lagring | LocalStorage, versjonert eksisterende region-save | Planlegg saveversjon/migrering eksplisitt før tilstandsendring. |

Ikke bruk gamle tall som akseptkriterier uten en ny produktbeslutning. `region/pnpm-workspace.yaml` og andre allerede endrede filer i worktree er **brukerarbeid** og må bevares.

## C. Implementeringsrekkefølge og ansvarsgrenser

Hver oppgave har ID for PR/issue og kan splittes etter behov. Alle ID-er er **foreslåtte arbeidspakker**, ikke automatisk opprettede GitHub-issues.

| ID | Leveranse | Primære filer/moduler | Avhengighet | Verifisering |
| --- | --- | --- | --- | --- |
| V04-00 | Baseline, kontroll av nåværende tester og reproduksjon av kjente avvik | `scripts/`, dokumentasjon | Ingen | Eksisterende bot, hendelser, typecheck; skriftlig risikobilde |
| V04-01 | Felles tids-/lokasjons-/oppdragskontrakter, saveversjonsplan | `packages/gameplay` og `packages/simulation-core` | 00 | Serialiserbar tilstand, stabile ID-er, eksplisitt reise/area duty |
| V04-02 | Døgnets plan → dag/natt → pausesjekkpunkt → fortsett/skip | Simuleringsmotor og smale adaptere | 01, O04 | Samme seed/ordre/valg ved pause/skip, maks én dagsløsning |
| V04-03 | Kartbevegelser, sonefyll og zoomavhengig visning | MapLibre/UI-kartlag | 01, 02 | Bare synlige bevegelser, polygonklipping, ingen feil L1-eierfarge |
| V04-04 | Dagsrapport, oppmerksomhetsprioritet og faseadaptiv HUD | UI + strukturerte simhendelser | 02 | Kritiske varsel synlige, skip omgår ikke valg, rapport kan gjenåpnes |
| V04-05 | Navngitte personers geografi og manuell/auto gear-reservasjon | Game types, gear-regler, planlegger-UI | 01, O05 | Første reservasjon vinner; release/kansellering; ingen utstyrsduplikat |
| V04-06 | Returnering, forsyningsoppdrag og lokale lagre | Motor, logistikk, UI | 05 | Utstyr tilgjengelig først etter faktisk levering; reisetid og risiko |
| V04-07 | ZA-bok med kapitler, grunnregler og observasjon/research | Data/innhold, UI, simulert innsikt | 02 | Fase-lås og tåkekrig; ingen magisk kunnskap fra døde speidere |
| V04-08 | POI-tilstand, spor og én håndlaget sidehistorie som vertikal slice | POI-system, events, art-asset-kobling | 07, O06 | Alternativ oppdagelse, valgfritt for faseprogresjon, gjenopptakbare valg |
| V04-09 | Kapasitetsbaserte fasegates, unlock-dialog og vanskelighets-/HC-regler | Game rules, UI, lagring | 02, 07, O01/02/11 | Ingen automatisk fase 2 fra én sone; successor vs HC game over |
| V04-10 | Region-HQ, lokale budsjetter, guvernører og delegasjonsmandat | Game model, motor, regional UI | 06, 09, O09/10 | Lokal lagerbegrensning, delegerte ordre, lederbytte og avvik |
| V04-11 | Ekte fase-1-spillslice med feedback, tempo, visuell kvalitet | Tverrmodulær integrasjon | 03–09 | Manual test fra dag 1 over flere dager, dokumenterte forbedringer |
| V04-12 | Balanse og regresjon på tvers av faser | Tester/bot, dokumentasjon og små fikser | 09–11 | Determinisme, ressursregnskap, flere seeds, tre grader, UI-test |

**Praktisk organisering:** V04-01/02 er en seriell motorgrunnmur. Først **etter** at kontrakten er stabil, kan kart (03), rapport/UI (04) og gear (05) jobbes relativt uavhengig. ZA-bok (07) kan bygges rundt en låst observasjonskontrakt. Regionstyring (10) er **sist** blant de store systemene, selv om designet er avtalt nå.

**Konfliktregel:** Om to oppgaver trenger samme type eller reducer, utnevn én kontrakteier og lag en liten integrasjons-PR først. Agenter har lov til å returnere med blokkert status; ikke gjør skyggeimplementasjoner av samme motorlogikk.

### Kontrollert M0-baseline, 12.11.2026

- **TypeScript:** `./node_modules/.bin/tsc --noEmit` fra `region/`: OK.
- **Hendelser:** `node --import tsx scripts/region-events.ts`: 115 registrerte, 111 bygget på 15 scenarioer; samtlige prøvde valg løste seg. Fire hendelser krever spesielle betingelser og ble ikke bygd i denne runden (`spyCaught`, `spyRaid`, `allyDelivery`, `groupDemand`).
- **Bot:** `node --import tsx scripts/region-bot.ts 30 1 0`: 17 starter, 15 overlevde etter 30 dager; **alle 17 nådde fase 2**, selv om snittet bare var 2,1 soner etter 30 dager. Dette understøtter behovet for fase-1-revisjon, men fastsetter ikke endelige krav.
- **Verktøyavvik:** vanlige `pnpm typecheck` og `pnpm region:events` ble stanset **før** testing av pnpm sin `ERR_PNPM_IGNORED_BUILDS` for `esbuild`. Worktree hadde allerede en ikke-committet endring i `region/pnpm-workspace.yaml` med en uavklart `allowBuilds`-verdi. Filen er ikke endret som del av v0.4. Direkte eksisterende binærverktøy ble brukt for baselinen; årsaken bør håndteres av konfigurasjonseier før senere PR-gates kjøres via `pnpm`.
- **Scope:** Dette var en lesende M0-kontroll av v0.3. Ingen gameplaykode, saveformat eller deployment ble endret.

## D. Milepælporter

### M0 – spesifikasjon og baseline

- Master spec, beslutningslogg, orkestratorinstruks og arbeidsliste er tilgjengelige i repoet.
- Eksisterende v0.3-brukerarbeid er urørt; baseline-tester og known issues oppsummert.
- **Denne leveransen består av dokumentasjon, ikke en spillbar v0.4.**
- Lokal dokumentasjon og baseline-verifisering er gjennomført 12.11.2026. Fjern PR-/review-gaten først etter eierens gjennomgang.

### M1 – ett sammenhengende døgn

- Spiller planlegger ved 07, ser rask tidsanimert fremgang og får rapport neste 07.
- Posisjonsavhengig beslutning stopper simuleringen, kan ikke skippes og overlever reload.
- Kart og rapport viser samme sannhet, uten å teleportere crew.

**M1 status 12.11 (draft, ikke godkjent):** #16 gir autoritativ døgnjournal, #18 et reelt JSON-lagringsbart pausepunkt ved kritisk HQ-nattangrep og #19 samler kartavspilling, dagsrapport, eksplisitt hovedpersonvalg og gjenopptakbar dialog. #19 samler også rapportarbeid fra #15. TypeScript, produksjonsbygg, checkpoint-/replay-/claim-/location-regresjon, hendelsestest og 17 botløp er grønne. Direkte klikkbasert nettleser-QA er fortsatt en egen gate; lokal headless Chromium ble blokkert av miljøets prosessrettigheter. Radioeskalering for bortelag, full animert gjenopptakelse etter checkpoint og komplett per-fase kartverdireplay er ikke del av denne slicen.

### M2 – meningsfull fase-1-loop

- Fire overlevende med gjenkjennelig identitet, gear-forslag og faktisk oppdragsutstyr.
- Flere typer aktivitet/POI, tydelig takeover-feedback, relevante økonomi-/forsvarsvalg.
- Spilltest viser at fase 1 har meningsfulle daglige valg; oppnådde milepæler, ikke kunstig dag-venting, styrer fase 2.

**V04-09 status 12.11 (draft, ikke balansegodkjent):** D25/O01 er avklart. #21 legger kapasitetssjekk (HQ, 3 sammenhengende L3, varig forsvar, 3 døgn mat/vann) og isolerte regresjoner; #22 viser hver delforutsetning i mål-dialogen. Tallene er **H08-hypoteser**, ikke låst fasit. En egen diagnostisk #23 prioriterer HQ-fronten for boten, men øker bare overganger innen dag 40 fra 2/17 til 3/17. Det skyldes at boten fortsatt avviser for farlige HQ-naboer, bruker crew på andre nødvendigheter og ender med spredte soner. Manuell fase-1-spilltest og videre kalibrering er nødvendig før M2 kan godkjennes; ikke senk menneskekravet bare for å få et pent bottall.

### M3 – veiviser, samfunn og valg

- ZA-boka håndterer kapittel-lås, oppslagsverk og research-utfylte sider.
- Minst én kort POI-hendelse og én flerdelt, valgbar sidehistorie med lokal oppdagelse.
- Tre vanskelighetsgrader og Hardcore-regel fungerer i motor og lagring.

### M4 – regional delegasjon og sluttspillgrunnlag

- Regionale HQ-er, guvernørmandat, lokale lagre og delegert drift finnes i en testbar prototype.
- Fase 4/5 håndterer mange soner/folk uten uendelig manuell oppdragsplanlegging.
- Ingen automatisk egen fraksjons-/diplomatimotor for hver guvernør.

### M5 – balanse/QA og eierens gjennomspilling

- Reproduserbare bot-kjøringer og scenario-/UI-tester, spesielt sult, karakterdød, radiotap, utdatert intel og logistikk.
- Sammenlign valg/utfall mellom Story, Survival og Realistic; juster tall uten å endre prinsippene.
- Dokumenter friksjon, kjedsomhet, overbelastning og gjenopprettingsmuligheter fra faktisk menneskelig spilling.

## E. Ferdigdefinisjon for hver PR

En implementerings-PR må ha:

1. **Kobling til V04-ID** og relevante D/O-ID-er.
2. **Avgrenset endring** og liste over API-/saveendringer samt berørte eldre regler.
3. **Faktisk demonstrasjon:** et scenario eller en beskrivelse av opplevelsen, ikke kun «kompilerer».
4. **Testing:** `pnpm typecheck` og relevante `pnpm check:simulation`, `pnpm check:gameplay`, `pnpm region:events`, `pnpm region:bot`, `pnpm build` fra `region/`, når passende. Ikke krav om alle for hver dokumentasjonsendring.
5. **Invarianter:** dokumenter eventuell risiko for dobbel dag, utstyrsduplikat, feil zombie-/ressursregnskap eller tap av saves.
6. **Kontroll mot master spec**, og oppdatert beslutningslogg for ny eierbeslutning.
7. **Merge først når avhengigheter er klare og relevante reviewer-/testkrav er oppfylt.** Ingen automatisk deployment eller main-merge uten særskilt mandat.

## F. Rapport til eieren

Hold hver milepælrapport kort:

```text
Milepæl: Mx / V04-xx
Ferdig: [testbar funksjonalitet]
Verifisert: [kommando/test/scenario og resultat]
Mangler: [konkret]
Risiko: [konkret]
Spørsmål til Mikki: [maksimalt få, kun blokkerende; A/B + anbefaling]
Neste arbeidspakke: [ID og eier]
```

**Videre etter M1:** O01 er låst som D25: fase 2 skal tillate defensibel kjerne som alternativ til hele L2. V04-09 kan bygges som en avgrenset kapasitetstest med eksplisitt hypotesemerket balanse og synlig progresjon. O05 blokkerer fremdeles endelig gear-regnskap. Grunnpolicy for eskalering O04 er avklart som D24. Ikke tildel V04-10 til en parallell agent før lokale posisjoner, lager og ordre er stabile.


## Gjenopptatt orkestrering 12.11.2026

Se [samlet spillteststatus](30_V04_PLAYTEST_STATUS.md) for gjenopprettet PR-/branch-baseline, faktisk implementasjon, verifiserte spillerreiser og gjenværende arbeid. `feat/v04-phase-one-playtest` samler videre UI-arbeid fra `da16b82`; bildepakken ligger separat i draft #24. Verken M2, M3 eller hele v0.4 er erklært ferdig.

O05 er delvis avklart som **D26** av Mikki i denne økten: våpen, beskyttelse, oppdragsverktøy, auto-equip, manuelle låser og faktisk reservasjon/retur bygges. Motor/regnskap og utstyrspanel er levert med disjunkt filansvar på `feat/v04-personal-gear`; [integrert gear- og spillteststatus](31_V04_GEAR_PLAYTEST.md) beskriver resultat og begrensninger. Nye tall og ett slot per kategori prøves som hypoteser. Ingen automatisk merge/deploy.
