# Codex orchestration rules – Stavanger Z

Dette er arbeidsinstruks for agenter i StavangerZ-repoet. Følg brukerens konkrete nye instrukser dersom de avviker.

## Gjeldende oppdrag: region v0.4 (12.11.2026)

**Gjelder bare regionspillet i `region/`. Ingen agent skal tolke v0.4 som tillatelse til å skrive om det eldre Buøy-spillet.**

1. Les først `docs/27_V04_MASTER_SPEC.md`, så `docs/28_V04_DECISIONS.md` og `docs/29_V04_IMPLEMENTATION.md`. Les deretter relevant v0.3-dokumentasjon og kode. De nye dokumentene har forrang ved produktkonflikt; eksisterende kode beskriver bare det som faktisk er bygget.
2. Bruk **orkestrator + avgrensede arbeidspakker**. Én ansvarlig orkestrator holder beslutningslogg, avhengigheter, status og integrering. Andre agenter eier disjunkte filområder/branches. Ikke la to agenter samtidig skrive i samme filer.
3. `LÅST` i `28_V04_DECISIONS.md` er eierens produktbeslutning. Arbeidende agenter kan foreslå avvik, men **skal ikke endre eller omklassifisere** den. `ÅPEN` eskaleres bare hvis den blokkerer aktuell arbeidspakke; samle spørsmål gjennom orkestrator i stedet for å avbryte eieren for hver liten detalj.
4. Ingen «agent swarm» før motorens tilstands-/ordrekontrakter er stabile. Prioriter M0 → M1 → M2 i `29_V04_IMPLEMENTATION.md`; regional styring i fase 4/5 er senere leveranse. Hver milepæl skal gi demonstrerbar forbedring.
5. Før merge: relevante type-/motor-/botkontroller, en visbar brukerflyt, vurdering av savekompatibilitet og kontroll mot akseptanse i v0.4-spesifikasjonen. Orkestratoren oppsummerer **ferdig / verifisert / mangler / risiko / nødvendige valg**.
6. Ikke push, merge eller deploy automatisert kun fordi en underagent ble ferdig. Følg eierens autorisasjon og repositoryets normale reviewrutiner. Bevar dirty worktree og øvrige brukerendringer.

De eldre instruksjonene nedenfor gjelder der de ikke kolliderer med v0.4-kontrakten.

## Oppdrag og kontroll

- Gjør produktvisjonen i README og docs til en sammenhengende, spillbar implementasjon. Hold designvalg og faktiske kodeendringer adskilt.
- **Bygg ikke hele spillet på én gang.** For v0.4: følg milepælene i `docs/29_V04_IMPLEMENTATION.md`. For eldre prototypearbeid: `docs/07_DELIVERY_PLAN.md`. Stopp ved milepælsgrensen for kort oppsummering, avvik og beslutninger.
- Be om godkjenning når et åpent produktvalg har stor påvirkning på gameplay, verdensmodell, datamodell eller antall arbeidsuker. Mindre detaljer kan avgjøres med dokumenterte antakelser.
- Ikke overskriv, slett, migrer eller refaktorer et eksisterende spill/repo uten uttrykkelig klarsignal. Start helst i nytt repo. Eksisterende skjermbilder er inspirasjon, ikke autoritativ spesifikasjon.
- Ikke deploy eller kjøp kart-/driftstjenester uten tillatelse.

## Orkestrering

- Start med en kort repo- og miljøgjennomgang. Noter eksisterende versjoner og tilgjengelige avhengigheter. Foreslå nødvendige endringer.
- Del arbeid i klart avgrensede leveranser: (1) verdensdata og kart, (2) ren simulering, (3) UI/UX, (4) autoritativ turflyt, (5) enkel gjennomspilling. De kan analyseres parallelt hvis flere agenter er tilgjengelige, men samme filer skal ha én eier om gangen.
- Ikke opprett agenter bare for å produsere tekst eller tester. Bruk parallellisering bare der ansvarsgrensene er tydelige.
- Før sammenslåing: kjør relevante smale kontroller, demonstrer brukerflyt, og sjekk at koden fortsatt samsvarer med B/H/Å i README.
- Lever et kort statusnotat ved hver milepæl: fungerer / mangler / risiko / beslutning / neste steg. Ikke lange PR-oppsummeringer uten verdi.
- Endre dokumentene samtidig når en vesentlig regel endres. Legg viktige beslutninger i `docs/08_OPEN_DECISIONS.md` med dato og begrunnelse.

## Ufravikelige designprinsipper

1. **Én dag per tur** i hele spillet. Begge spillere låser ordre før en felles dag simuleres.
2. **Én autoritativ simulering**, ikke gameplay-logikk spredt i React-komponenter eller klientkall.
3. **Geografi er grunnmur:** L1/L2/L3 er nestede geografiske områder; zoom gir nye kommandomuligheter, ikke nye verdener. POI-er og HQ er egne objekter.
4. **Zombiepopulasjon er regnskapsførbar:** Ingen skjult uendelig spawning. Flytting bevarer antall; nye infeksjoner, import, død og migrasjon loggføres.
5. **Samme personer lever videre:** De navngitte overlevende fra fase 1 blir crew leaders i fase 2. Resten av befolkningen er aggregert.
6. **Strategisk friksjon:** Utvidelse koster mat, vann, personell, gear, transport, vedlikehold og risiko.
7. **Beslutninger har ettervirkninger:** Diplomati og moralske valg skal påvirke tillit, relasjoner, forsyninger og fraksjoner, ikke en enkel good/evil-meter.
8. **Kartet er hovedgrensesnittet:** Stilretning mørk taktisk kommandosentral, lesbart med progressive paneler og lite støy.

## Teknisk disiplin – praktisk, ikke seremoniell

- Først et lite vertikalt utsnitt. Velg en enkel datamodell som kan utvides; ikke bygg mikrotjenester eller plugin-plattform for hypotetiske behov.
- Lag ren deterministisk funksjon for turbehandling med seedet RNG og eksplisitte input/output. Lagring og rendering skal være adaptere.
- Gjør turbehandling idempotent og transaksjonell; serveren er autoritativ. Ikke stol på klientens kamp- eller ressursresultat.
- Ha tre automatiske kontroller i starten: (a) samme seed + ordre gir samme utfall; (b) zombier og ressurser får ikke utilsiktet skapes/forsvinne; (c) en tur løses maks én gang når begge er Ready. Legg til tester kun for faktiske bugs eller risikable regler.
- Ha én manuell ende-til-ende-spilltest som demonstrerer kjerneløkken; ikke bygg en massiv E2E-/snapshot-/testmatrise.
- Hold konfigurerbare tall (balanse, trait-vekter, kostnader) utenfor komponentlogikk.

## Definisjon på ferdig for første slice

- Én spiller kan starte på dag 0 i et begrenset område, gi ordre, avslutte dagen og forstå resultatet.
- Zombier flytter seg plausibelt mellom tilgrensende områder, lar seg spore og påvirkes av forsvar/støy.
- Spilleren kan speide, rydde, overta og sikre soner, besøke POI-er, bruke utstyr og etablere HQ.
- Ressursmangel, utmattelse og tap har konsekvenser, men spilleren har mulighet til å hente seg inn.
- Kart, UI og turmotor bruker samme tilstand; simuleringsmotoren virker uten frontend.
- To-spiller-protokollen er designet; den trenger ikke være ferdig i den første spillbare solo-slicen.
