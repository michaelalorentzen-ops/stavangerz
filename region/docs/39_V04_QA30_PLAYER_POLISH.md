# QA30 – spillerflyt, tilgjengelighet og faktisk framgang

Grunnlag: [QA30](https://github.com/michaelalorentzen-ops/stavangerz/pull/30#issuecomment-6855444820), testet `42b190a` og publisert som main `e986d58`. QA ga UX-snitt **4,55**, men K2 klikkflyt og K6 mobil fikk 4, K8 tilgjengelighet 3, K11 ytelse 4 og spillglede 3. Eieren ba om å forbedre områdene under 4,5. Ingen nye poeng er tildelt av utviklerne; ny uavhengig QA må vurdere effekten.

## Implementert

- **F01 / K2:** Mellomrom fungerer etter museklikk i HUD-en selv om knappen beholder fokus. Tastaturbruk via Tab beholder vanlig Space-aktivering av knapper. Tekstfelt, modalvalg, checkpoints, intro, targeting og avspilling beskyttes fortsatt.
- **F02:** Synlig Mellomrom-hint på døgnknappen, Enter/Mellomrom i tom-plan-bekreftelsen. Bekreftelsen og dagsplanen fokuserer primærhandlingen. Første tast åpner vanlig review/bekreftelse; en ny bevisst tast kan gjennomføre. Holdt tast med gjentatt keydown og første keyup kan ikke aktivere den nye primærknappen. Escape og avbryt beholdes.
- **Flere faktiske snarveier:** C mannskap, B ZA-bok, P plan, H HQ/leir, I innstillinger og Home leiren. De følger samme av/på-preferanse, felt-/dialogvern og spillregler som museinngangene.
- **F03 / K6:** Mobilens startknapp og frøvalg ligger fast nederst mens startsted velges. Ingen duplisert startknapp eller ulik valgt sone. PC-oppsettet og alle 17 startforslag beholdes.
- **K8:** Viktig sekundærtekst er normalt 12 px, enkelte tette mobile etiketter 11 px. Treffflater for knapper, select og summary er minst 44×44; start-radioenes små symboler har store, hele klikkbare kort. Tekststørrelsevalget øker faktisk tekst til 14/15 px og lagres separat fra kampanjen. Synlig tastaturfokus og reelle checkbox-treffflater er forbedret. HQ/bok/lager er komprimert gjennom mellomrom og oppsett, ikke ved å kutte innhold.
- **Spillglede / forståelse:** Rapporten viser kun opptjent framgang fra historiske rapportdata: aggregert søk før→etter, faktiske utstyrsfunn, HQ, nye spor, overtakelser og milepæler. Kritiske varsler går fortsatt foran feiring. En framgang som vises grafisk gjentas ikke som samme tekstrad. Rutineleveranser forblir i loggen. Rolig produksjon bruker faktiske produksjonstall; ingen oppdiktet XP, hvileeffekt eller belønning.
- **Lyd:** Originale stereopads, sparsom melodi, vindtekstur og egne kamp-, natt-, funn- og overtakelsessignaler. Resultatcue kommer fra faktisk rapport og røper ikke skjult risiko. Nattcue spilles ved faktisk nattavspilling, arkiv/restores gjentar ikke resultatlyder. Lyd starter etter brukerinput, følger volum 0 og stopper/frakobler kilder ved skjult fane og unmount. Ingen eksterne samples.
- **K11:** Migrasjonslaget bruker ikke lenger en evig 60 Hz-RAF ved oversiktszoom/skjult fane. Statiske figurankere og matriser gjenbrukes til kamera eller posisjon endres. Figurer og vanlige animasjoner beholdes.

## Kontroller og avgrensninger

Motor, verden, saveformat, D25–D28 og balanse er uendret. Rapportfremdrift leses fra rapporten, ikke dagens sone-/lagerverdier. Preferansen `textScale` er bakoverkompatibel og ligger i eksisterende separat preferanselagring.

Produksjonsbygg og TypeScript passerer. Naturlig spillerreise har passert åtte faktiske døgn på PC og seks på mobil med ordre, gear, HQ, rapportarkiv og eksakt save-reload. Den siste rapportjusteringen fjerner kun duplisert presentasjon; egne rapport-/vindusprøver kjøres etterpå. Integrert klarhetsprøve passerer 1280×800 og 390×844: historisk søkeframgang, uendrede rutinefiltre, flere snarveier, virkelig større tekst og persistens, primærfokus og to bevisste tastetrykk. PC-flater passer uten scroll. Sluttkontrollen passerer også med gjentatt keydown mens Mellomrom holdes: første slipp lar dialogen stå åpen, en ny bevisst tast starter ett døgn eller korrekt lagret checkpoint. Tab-bruk, felt og avslåtte snarveier beholder riktig atferd.

Avgrensede figur-/kartmålinger: samme dag-10-save, Chromium/SwiftShader 1280/390, fire sekunder oversiktszoom/Fare. Globale observerte RAF-callbacks falt 142→3 på PC og 146→1 mobil. Dette viser mindre bakgrunnsarbeid; det er **ikke** et mål på FPS på en fysisk GPU. Lydopptak fra nettleseren har ingen klipping/NaN og normaliseres ikke opp til et påstått profesjonelt miksenivå.

Senfase-HQ, alle ressursinnganger, fysisk forsyningslevering med to passasjerer og kartkontroller passerer PC/mobil. Kontrollene fanget dagskort over forstørrede mobile zoomknapper; kortet er flyttet til ledig plass under søk, og alle kart-/bunnkontroller mottar nå klikk i midten. Startflyten passerer 1280/1920/390, med synlig mobilstart og alle 17 forslag.

Balanse, seierstakt, kampanjepacing og måling på fysisk GPU gjenstår. Ingen lovnad om 4,5+ i hver kategori eller erklæring om at hele premium-ambisjonen er ferdig. QA skal vurdere faktisk opplevelse på nytt.


## Bevis

[Fast mobilstart](evidence/qa30-polish/mobile-start.png), [klikkbare mobile kartkontroller](evidence/qa30-polish/mobile-map.png), [større tekst](evidence/qa30-polish/settings-large.png), [historisk framgang](evidence/qa30-polish/report-progress.png), [integrerte interaksjons-/vindusmålinger](evidence/qa30-polish/interaction-results.json), [naturlige døgn](evidence/qa30-polish/journey-results.json), [senfasekontekster](evidence/qa30-polish/context-results.json), [startprøve](evidence/qa30-polish/start-results.json).

Avgrenset komponentaudit: [fonter og mål](evidence/qa30-polish/component-accessibility-audit.json). Nullfont på allerede skjulte/låste kapittelnavn er ikke lesbar tekst; UI viser låst markør. Mobilens lange HQ-/bokdetaljer kan scrolle vertikalt.

[Kartarbeid før](evidence/qa30-polish/map-work-baseline.json) / [etter](evidence/qa30-polish/map-work-candidate.json) og [originalt opptak fra nettleseren](evidence/qa30-polish/original-soundscape.webm). Opptaket er teknisk/kunstnerisk materiale for vurdering, ikke en påstått menneskelig lyttegodkjenning.
