# QA34 – tydeligere minner og bedre lesbarhet

Oppfølgingen etter QA-runde 2 og Mikkis ønske om flere bilder finnes i [44_V04_MEMORY_VARIATION.md](44_V04_MEMORY_VARIATION.md).

## Baseline og ramme

[QA runde 1 på PR34](https://github.com/michaelalorentzen-ops/stavangerz/pull/34#issuecomment-6904278053) dekker `913b458` og bekrefter at alle seks funn fra QA33 er lukket. Alle tekniske kontroller består; verdensdata og tallbalanse er verifisert uendret. QA gir UX 4,73 og finner seks nye lave avvik. Dette notatet gjelder oppfølgingen på samme draft PR; ingen merge eller deploy er godkjent.

QA sin anbefaling om seier nærmere dag 50 er ikke vedtatt. D32 om utsatt tallbalansering gjelder fortsatt. Måling på fysisk GPU kan ikke erstattes av cloud-nettleserens SwiftShader-resultater.

## Implementert

| QA-funn | Endring |
| --- | --- |
| F01: liten tekst og avkuttet kartresultat | Ny kortmetadata er minst 11 px på PC og 12 px på mobil; stor tekst skalerer videre. Kartresultatet viser handling og fullstendig, allerede kjent stedsnavn. Hele utfallet ligger fortsatt i rapporten. Ingen linjeklipping. |
| F02: sju like fjøsbilder | Tre nye håndplukkede WebP-motiver skiller kamp, forsyningssøk og inspeksjon av utstyr. Rapporten og ZA-boka bruker samme lukkede resolver. Geografiske handlinger beholder rapportens miljøfamilie; bildene tilfører ingen skader, fiender, utstyrsmengder eller bestemte bygninger. |
| F03: førsteganger skjult på skadedager | Når Viktigst er åpen, blir den eksisterende opplevelsesfanen en fremhevet knapp med «N nye minner». Den tar ikke en ny rad. Kritiske varsler beholder standardfanen og rekkefølgen; minneknappen åpner kortene. |
| F04: journalen vanskelig å finne | Fast «Feltjournal»-knapp med eget ikon i HUD-en. Telleren bruker bare publiserte, åpne spor; uavleverte feltobservasjoner telles ikke. Meny-, POI- og bokinnganger beholdes. |
| F05: byråkratisk etterspill | Striden om den nye sjansen kan få 0–2 voksne til å forlate gruppen i protest. Antallet følger eksisterende `removePeople`, som reduserer aggregert befolkning uten dødsteller. Navngitt lovstraff beholdes. Samme valg, RNG, håp, uro, tillit og personantall som før. Bare nye hendelser og minner får den nye teksten. |
| F06: ugyldig ARIA på arbeidsfordelingen | Den navngitte `.hq-work-bar` har `role="group"`. Fordelingen representerer flere jobber, ikke én fremdriftsprosent. |

De nye motivene er faktiske filer under `public/art/experiences/`: totalt 476 802 byte, 1280×720, med kilde-/filhash og bevart original i [proveniens](../apps/game-client/public/art/experiences/provenance.json). Manifestet inneholder nå 35 illustrasjons-/atlasfiler. Ingen historiske spillfakta eller lagrede miljønøkler omskrives ved nytt bildevalg.

## Verifisering

- [Produksjonsbygg og TypeScript](evidence/qa34-polish/build.log) består. [Samlet funksjonsport](evidence/qa34-polish/functional-gate.log) med 26 kontroller består, inkludert alle eksisterende hendelsesvalg, lagring, determinisme, kampanje, gear og fysisk rapportering.
- [Integrert innholdstest](evidence/qa34-polish/content-layout.json): 1280×800, 390×844 og stor PC-tekst. Åtte kort, journal/historikk, alle seks anlegg og bokkategorier består. Metadata er målt til minst 11/12 px. HUD-telleren er 1 for ett offentlig åpent spor selv om en ekstra privat observasjon ligger i save.
- [Tett rapportfixture](evidence/qa34-polish/dense-report-layout.json): tre skade-/farevarsler, to fremgangspunkter og åtte nye minner, med normal/stor tekst på PC og mobil. Viktigst og skadeprioritet beholdes; minneknappen åpner kortene. PC-vinduene er henholdsvis 737/737 og 749/749 px uten intern scrolling. Den tettpakkede mobilprøven har 16/39 px vertikal scrolling; ingen horisontal scrolling. Dette er en layoutprøve, ikke en faktisk skadedag.
- [Faktisk dag-17-save](evidence/qa34-polish/actual-save.json) er åpnet uten endringer på PC og mobil: åtte minner bruker nå fem ulike bilder, alle bilder lastes, HUD-knappen er synlig, journal/historikk fungerer, og HQ-rollen er `group`. Navigasjon og nytt gjenopptak bevarer eksakt JSON-tilstand. Dette er inspeksjon av den tidligere faktiske reisen, ikke en ny 17-døgnskampanje.
- [Faktisk første speiding](evidence/qa34-polish/live-map.json), ny kampanje via UI på PC/mobil med vanlig animasjon: hele «Lundsneset» vises, fontene er minst 11/12 px, ingen klipping, ingen HUD-overlapp og ingen gjentakelse i rapportarkivet. Målt under levende avspilling; vi bruker ikke sene SwiftShader-skjermbilder som bildebevis på animasjonen. Kan gjentas med `pnpm check:region-cues-ui`.
- [Fase-4-konteksttest](evidence/qa34-polish/phase4-contexts.json) på PC og mobil består: fem HQ-faner, POI, regionalt panel og faktisk fysisk forsyning med passasjerer. Dette er et avgrenset scenario, ikke naturlig faseprogresjon.

Visuelle eksempler: [faktisk bevart kampminne](evidence/qa34-polish/actual-combat-memory.png), [utstyr på mobil](evidence/qa34-polish/actual-gear-mobile.png), [fast feltjournal i HUD](evidence/qa34-polish/actual-journal-hud.png), [syntetisk stressrapport med prioriterte varsler og minneknapp](evidence/qa34-polish/fixture-injury-and-memories.png).

Den tidligere faktiske 17-døgnsreisen beholdes i [42](42_V04_LIVING_EXPERIENCE.md). Scenario- og layoutprøver beviser ikke spillglede. HQ-fiksen er kontrollert som gyldig rolle i faktisk DOM; full ny ekstern axe-runde er ikke kjørt av orkestratoren.

## Fortsatt arbeid

Tallbalanse, seierstempo og fysisk GPU-måling gjenstår. Mer særskilt innhold for sene faser og mengden daglig administrasjon er fortsatt spilltestpunkter fra forrige leveranse. Ingen ny QA-score eller ferdig spillglede erklæres av utvikleren.
