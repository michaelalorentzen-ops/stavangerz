# QA29 – feilrettelser og spillerkontroller

Grunnlag: [Stavanger Z QA – runde 1](https://github.com/michaelalorentzen-ops/stavangerz/pull/29#issuecomment-6854035864), testet `1222183`, publisert via main `069c370`. QA fant reelle presentasjonsfeil selv om tekniske kontroller var grønne. Denne revisjonen endrer ikke motor, verden, faseporter, saves eller tallbalanse.

## Funn

- **F01:** Smale ressursstriper har en eksplisitt «Alle»-knapp. Oversikten viser alle tilgjengelige ressurser, inkludert fase-2-materialer og mennesker, med reelle antall og inngang til lager/arbeid. Ingen skjult ressurs uten inngang. Mat/vann beholder rater i hovedstripen.
- **F02:** «Leveransen er fremme» og «Lokalt depot fylt» behandles som rutine sammen med utstyrsretur. De beholdes i full logg. Feil/advarsler filtreres ikke bort som rutine. Stedfestede farer og faktiske oppdragsresultater prioriteres fortsatt.
- **F03:** HQ-faner venstrejusteres og brytes til flere rader på mobil. Første fanes tekst skyves ikke utenfor klippflaten. Alle fem faner beholdes.
- **F04:** Startoppsett er en egen komponent. Spillestiler og Hardcore kommer før seks paginerte startforslag; alle 17 beholdes. Startkart viser lastestatus inntil første ferdige maling, har feiltilstand og følger endret størrelse. På 1280×800 passer oppsett, forslag og startknapp uten PC-scroll.
- **Testportabilitet:** Klarhetstesten og den nye starttesten bruker eksplisitt `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, installert system-Chromium hvis den finnes, ellers Playwrights Chromium. Ingen krav om `/usr/bin/chromium`.

## Kontroller fra QA-forslag S5

Egen innstillingsdialog med hovedvolum, musikk, effekter, redusert bevegelse og hurtigtaster. Preferansene har separat lokal nøkkel `stavanger-z.preferences.v1` og berører ikke kampanjesave.

Original, lavmælt WebAudio-stemning og korte signaler ved akseptert ordre, døgnutfall og hendelse. Ingen nedlastede lyder eller eksterne musikkrettigheter. AudioContext opprettes først ved betrodd brukerinput, pauses i skjult fane og ryddes når spillet avsluttes. Volum 0 gir stillhet. Dette er første lydlag, ikke en ferdig produsert lydpakke.

Mellomrom åpner samme dagsplan/bekreftelse som døgnknappen. Tast gjentas ikke, tekstfelt/knapper beholder vanlig tastaturatferd, åpne dialoger/hendelser/checkpoints/intro/avspilling blokkerer snarveien. Hurtigtaster kan slås av; Escape beholdes. Redusert bevegelse påvirker døgnreplay, kamera, migrasjonsstreker, soneeffekter og figuranimasjoner, i tillegg til CSS-overganger.

## Verifisering

Produksjonsbygg og TypeScript passerer. Integrert `check:region-start-ui` passerer 1280×800, 1920×1080 og 390×844: alle 17 forslag, lastet kart og faktisk Story+Hardcore-kampanje. `check:region-completion-ui` passerer 1280/390 med alle fase-4-ressurser tilgjengelige, uklippede HQ-faner og faktisk levering av last og to mennesker. `check:region-clarity-ui` passerer 1280/390 med rutineleveranser skjult i sammendrag og beholdt i logg, trygg Mellomrom, deaktivering av hurtigtast, reelt volumvalg og persistens etter reload. Ingen sidefeil, ingen horisontalt overløp; alle målte PC-flater passer uten scroll.

Naturlig `check:region-ui` passerer åtte faktiske døgn på PC og seks på mobil: begge ordreganger, rediger/avbryt, gear, HQ, rapportarkiv og eksakt save-reload. Sluttkontrollen fanget manglende oppfølging av endret systemvalg for redusert bevegelse; dette er rettet og reisen kjørt på nytt. Tidligere QA sine 75-botresultater beskriver samme uendrede motor; ny botbalanse er ikke hevdet forbedret.

## Fortsatt ikke erklært ferdig

Tallbalanse, seierstakt og sult er utsatt av eieren. QA sine øvrige premium-gap rundt større lydproduksjon, flere lagringsslott, kunstnerisk variasjon, all småtypografi og målt ytelse på fysisk maskinvare er ikke lukket av disse rettelsene. Eksisterende nedlasting av save beholdes.


## Bevis

[Start 1280×800](evidence/qa29-fixes/start-1280.png), [mobilressurser](evidence/qa29-fixes/resources-390.png), [uklippede HQ-faner](evidence/qa29-fixes/hq-tabs-390.png), [rapport](evidence/qa29-fixes/report-1280.png), [innstillinger](evidence/qa29-fixes/settings-1280.png), [startmålinger](evidence/qa29-fixes/start-results.json), [siste interaksjons- og vindusmålinger](evidence/qa29-fixes/interaction-results.json) og [naturlig reise](evidence/qa29-fixes/journey-results.json). Fixture-ressurser er deklarerte testdata; den naturlige reisen simulerer faktiske døgn fra ny start.
