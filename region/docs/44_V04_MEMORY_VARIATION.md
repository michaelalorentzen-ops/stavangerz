# QA34 runde 2 – variasjon, personer og videre minner

## Mandat og baseline

[QA34 runde 2](https://github.com/michaelalorentzen-ops/stavangerz/pull/34#issuecomment-6904278053) dekker `ea14093` og løfter ekstern UX-vurdering til 4,91. Runde 1 sine seks funn er lukket eller delvis lukket; runde 2 etterlyser særlig mer bildevariasjon og minner etter førstegangene. Mikki presiserte at flere bilder er ønsket for variasjon og personlighet. Dette er registrert som D36; D29–D35 gjelder fortsatt. QA sitt forslag om numerisk seierstempo er ikke vedtatt.

## Implementert

- **Tolv nye integrerte WebP-filer.** Speiding, POI, overtakelse og perimeter har hvert sitt motiv. Kamp har egne gårds-, kyst-, skog- og industrimotiver; eksisterende bymotiv beholdes for bolig-/butikkmiljø. Valget bruker den allerede lagrede miljønøkkelen, ikke dagens skjulte kartdata. De åtte førstegangsminnene får dermed åtte ulike motiver også på gårdsstart.
- **Fire personmotiver i feltjournalen.** Ingrid, Leila, Marius og Tor er tegnet med sine eksisterende portretter som identitetsreferanse, rundt sine faktiske historietemaer. Ansiktene er kontrollert i både PC-utsnitt og mobilbanner. Motivet illustrerer det kjente sporet, uten å påstå et valgt utfall, skade, belønning, et bestemt bygg eller at en person fortsatt lever. Lokale vignetter beholder miljøbildene.
- **Minner etter førstegangene.** Første fullførte HQ-forsvarsmodul etter et tidligere publisert perimeter, faktisk overgang til fase 2–5 og overgangen til ti kontrollerte soner gir seks endelige minnetyper. De beskriver oppnådd fremgang uten ekstra belønning, RNG-trekk eller endrede fasekrav. Bokas «Våre minner» samler de første turene og senere steg.
- **Synlig etterspill.** Den negative varianten av `cowardAgain` heter «Splittet». Etter faktisk avgang får rapporten en linje med korrekt antall voksne som dro. Ved null avgang beskrives bare protesten og svekket tillit. Ingen oppdiktet plassering av Marius; samme valg, RNG og virkninger.
- **Feltjournal med tastatur.** Standard er J, og handlingen kan omdefineres. En gyldig eldre tastekonfigurasjon bevares; hvis J allerede er brukt, får journalen en stabil ledig tast. Modaler, tekstfelt, deaktivert tastatur og gjentatte tastetrykk følger eksisterende sperrer.
- **Lesbart sitatnavn på mobil.** Navnet i bokas sitat følger tekstpreferansen og er minst 12 px på mobil.

Motivene er lokale filer i `art/experiences/` og `art/stories/`, totalt 1 984 082 byte denne runden. [Handlings-/miljøproveniens](../apps/game-client/public/art/experiences/variation-provenance.json) og [personproveniens](../apps/game-client/public/art/stories/story-provenance.json) registrerer referanser, kilder, redigeringer og filhash. Originalportrettene er uendret. Manifestet har 47 bilde-/atlasfiler. Filene lastes når relevante kort åpnes; det er ingen ny grafikkmotor eller obligatorisk forhåndslasting av hele bildebiblioteket.

## Kontrakt og kompatibilitet

`ExpeditionExperience.milestone?` og `RegionState.earnedMemories?` er valgfrie tillegg. Det nye arkivet har plass til maksimalt tolv opptjente minner, mens katalogen nå har seks. De opprinnelige åtte beholdes i sitt eget arkiv og påvirkes ikke. `recordedExperiences` betyr fortsatt de opprinnelige førstegangene; `recordedMemories` kombinerer offentlige minner kronologisk.

En egen origin-markør skiller nye kampanjer fra eldre PR34-saves. Eksisterende ti soner, fase eller forsvarsmodul blir ikke omgjort til en ny historisk prestasjon ved lasting. Fremtidige nye milepæler i eldre saves merkes som første registrerte. Feltprestasjoner følger eksisterende privat rapporttransport og konsumeres først ved offentlig rapport. Døde eller uavleverte avsendere gir ingen kunnskap. Fasekort følger en faktisk faseendring. De nye milepælene brukes ikke som førstegangsmarkeringer på kartet.

Det er ikke lagt inn et minne om tap eller en stille natt: disse krever en sterkere felles hendelses-/nattkontrakt før de kan beskrives sikkert. Savekonvolutten og `region-2` er uendret; historiske fakta og tekster omskrives ikke.

## Verifisering

- [Produksjonsbygg/TypeScript](evidence/qa34-variation/build.log), diffkontroll og [funksjonsporten med 27 kontroller](evidence/qa34-variation/functional-gate.log) består. Den nye minnekontrollen dekker alle seks nøkler, virkelig ferdigstillelse, tiende overtakelse, faseovergang, duplikater, reload, privat/død avsender, eldre saves og 41-døgns arkivrotasjon uten tap av de åtte førstegangene.
- [Numerisk referanseparitet](evidence/qa34-variation/numerical-parity.log) mot uendret `ea14093` består for ferdig forsvarsmodul, tiende overtakelse og faseovergang: samme mekaniske tilstand uten presentasjonsfeltene. Ingen balanseringstall eller RNG-trekk er lagt til.
- [Den faktiske dag-17-lagringen](evidence/qa34-variation/actual-save17.json) er åpnet på PC og mobil: åtte ulike motiver for åtte førsteganger, alle bilder lastes, korrekt kampmiljø, minst 12 px på sitatnavn, J åpner journalen og avbryter ikke den åpne boka. Alle tre avsluttede personhistorier er inspisert med nye motiver. Navigasjon og reload bevarer eksakt JSON-tilstand. Historiske minner er ikke regenerert.
- [Ny faktisk åtte-døgnsreise](evidence/qa34-variation/actual-earned-journey.json): Survival, seed 101, Lundsneset, Ingrid som hovedperson, orkestratoren velger gjennom faktisk UI uten botplanlegging eller ressursredigering. Fire speider, søker, bekjemper zombier og tar kontroll; Amina blir faktisk reddet og brukes som femte medlem. HQ og perimeter etableres. Vakttårnet fullføres av Tor/Marius på operasjonsdag 6 og gir det niende minnet i rapport dag 7. På neste døgn beholdes akkurat ett opptjent minne; det repeteres ikke. Leilas spor undersøkes videre. En cache velges bort. Et allerede fullsikret perimeter avvises korrekt før planen endres. Eksakt reload består, ingen JavaScript-feil.
- [Den nye dag-8-lagringen](evidence/qa34-variation/earned-save8.json) er separat inspisert på PC/mobil: ni varige minner i boka, riktig «Et steg videre»-kort i rapportarkivet og eksakt gjenopptak. Dette er en ny åtte-døgnsreise, ikke en fortsettelse av den tidligere 17-døgnskampanjen.
- [Innholdslayout](evidence/qa34-variation/content-layout.json) består på 1280×800, 390×844 og med stor PC-tekst: åtte kort, journal med Tor-motiv/historikk, alle seks anlegg og bokkategorier; ingen PC-scroll. Bilder dekodes eksplisitt i kontrollen. Fremtidige fasekort og tiende sone er motor-/scenariotestet; de er ikke naturlig nådd i denne nye reisen.
- [Tasteinnstillinger](evidence/qa34-variation/shortcut-settings.json) består på PC/mobil med normal/stor tekst: alle åtte handlinger får plass uten scrolling. Gyldig gammel J-binding beholdes og journalen får O; konflikt, modifikatorer, avbrutt omdefinering, ny binding, reload og eksplisitt tilbakestilling er kontrollert uten tap av øvrige preferanser. Eksisterende integrert lagrings-/tastaturreise består også.
- [Protestscenario](evidence/qa34-variation/public-protest.json) på PC/mobil: en tydelig syntetisk hendelsesfixture med fire voksne gir tittelen «Splittet». Faktisk UI-valg reduserer antallet til to, og «2 voksne forlot gruppen» blir synlig i dagsrapporten. Dette er scenariotest, ikke en hendelse som naturlig inntraff i den nye åtte-døgnsreisen. De 72 direkte sammenligningene av hendelsesvalg mot `ea14093` beholder RNG og virkninger.

Skjermbilder: [gårdsmiljø ved faktisk kampminne](evidence/qa34-variation/farm-combat-memory.png), [Marius i mobiljournalen](evidence/qa34-variation/marius-journal-mobile.png), [faktisk opptjent HQ-minne](evidence/qa34-variation/earned-hq-report.png), [protestutfall i UI-fixture](evidence/qa34-variation/fixture-departures-report.png). Den eksterne [QA-kilden](evidence/qa34-variation/qa-source.md) er bevart fordi GitHub-kommentaren redigeres mellom rundene.

Den tidligere faktiske 17-døgnsreisen fra [42](42_V04_LIVING_EXPERIENCE.md) og polish fra [43](43_V04_QA34_POLISH.md) er fortsatt baseline. Ingen av kontrollene erklærer spillglede eller en ny ekstern QA-score. Cloud-nettleseren bruker SwiftShader.

## Gjenstående

Fysisk GPU-måling, tallbalanse og seierstempo er fortsatt utsatt. De seks opptjente minnetypene er endelige fremgangspunkter; ingen ny fortelling hver dag eller bestemt spillglede garanteres. Mer særskilt senfaseinnhold og mengden daglig administrasjon må fortsatt vurderes i spilltest. Nye personmotiver dekker de fire opprinnelige hovedpersonene; egne illustrerte portretter for senere rekrutter er ikke lagt til. Ingen merge eller deployment uten ny godkjenning.
