# v0.4 – fra system til levende spillopplevelse

## Mandat og baseline, 15.11.2026

Eierens nye oppdrag låser geografi og utsetter tallbalanse, men prioriterer historier, karakter, utforsking og visuelle hendelser. D29–D35 i beslutningsloggen gjelder. Leveransen bygges på `main 5a2bebe` (PR33). Remote er kontrollert; main og origin/main var like. Root og eldre arbeidskopier var rene. Ingen aktive andre agentarbeider var i gang ved oppstart.

Åpne historiske draft PR-er #12, #14–16, #18–19, #21–27 representerer den gamle stablede kjeden. Funksjonene deres er videreført i main gjennom senere integrasjons-PR-er; de skal ikke merges på nytt eller tolkes som nyeste utviklingsstatus. Ny isolert gren: `feat/v04-living-expeditions`, med automatisk deployment slått av.

[QA33](https://github.com/michaelalorentzen-ops/stavangerz/pull/33#issuecomment-6863654417) er lest: alle motor-/nettleserreiser og naturlig seier består. Seks lave funn gjelder små lagringsknapper, uklar rewind-advarsel, skjult lagringsinngang, nettleser-confirm, hardkodet Chromium og overlapp mellom to mobilkort. Disse rettes i samme leveranse; balanse-/seierstempo og fysisk GPU er ikke grunnlag for å endre tall her.

## Konkrete hull

- Eksisterende 117 hendelser dekker mange systemer, men daglig speiding/søk/kamp/etablering mangler et personlig, førstegangsvis lag med kontekst.
- Lokale undersøkelser er allerede deterministiske, endelige og fysisk rapporterte, men består av ett ordinært skapfunn og én Tor-historie.
- Illustrasjonene dekker intro, fire personer, faser, avslutninger og inventar. Seks unike anlegg og varierte feltmiljøer mangler bilder.
- Rapport, ZA-bok, kart, personlig gear og lagringssystem finnes og gjenbrukes. Eldre UX-klager er ikke automatisk aktuelle feil.

## Innholdskart for fem faser

| Fase | Overlevelse | Fremgang | Utforsking og personhistorier | Presentasjon / sannhetsgrunnlag |
| --- | --- | --- | --- | --- |
| 1 – utbruddet | Velg hvem som speider, søker, kjemper og hviler; reisen binder faktiske personer. | Første kontroll, holdbart perimeter og HQ; D25 beholdes. | Seks lokale feltsituasjoner og valgfrie historier for Ingrid, Marius, Leila og eksisterende Tor. | Første registrerte vellykkede handling har et kort, illustrert rapportminne med faktiske personer, sted og utfall. |
| 2 – etablering | Produksjon, ly og leirarbeid konkurrerer med feltarbeid. | Virkelige HQ-moduler, forsvar og fasekrav synliggjøres. | Personhistorier kan følges videre eller avsluttes til fordel for forsyninger. | Leirens scene følger oppnådd fase; ingen ny bygning eller produksjon påstås av bildet. |
| 3 – organisering | Fysisk forsyning og folk i felt; radio er kun kunnskap, aldri last. | Eksisterende forskning, nett og samband. | Flere kilder til kjente spor; videre undersøkelser konkurrerer med vedlikehold og reiser. | Samme rapportkontrakt gjennom faktisk hjemkomst/radio. Eksisterende hendelser og feltvalg beholdes. |
| 4 – utvidelse | Lokale lagre, binding av navngitte ledere og reelle transportlinjer. | Regionale HQ-er og faktiske milepæler; D28 beholdes. | Kuraterte illustrasjoner av seks unike anlegg, kun etter oppdagelse. | Kartfeedback ved synlige operasjoner, eksisterende L1/L2/L3 og modeller. Ingen kartomstrukturering. |
| 5 – fremtiden | Samfunnets faktiske stabilitet, diplomati og forskning avgjør fremtiden. | Eksisterende tre seiersveier og full epilog/krønike. | Historier kan stå uløste eller være mistet ved persondød; ingen blir nødvendig hovedquest. | Oppnådde hendelser og kapitler, ikke konstruerte premier. Naturlig seier er tidligere bevist; tempo balanseres senere. |

Dette er et innholdskart, ikke en ny obligatorisk oppdragskjede. Første implementerte dybde prioriterer 15–25 døgn; sent spill gjenbruker eksisterende systeminnhold og får de samme autoritative presentasjonsreglene. Nye senfase-historieløp ut over dette skal beskrives som videre arbeid hvis de ikke er gjennomført.

## Felles kontrakt og filansvar

`ReportLine.experience?` er et valgfritt, JSON-serialiserbart øyeblikksbilde: type, dag, sone, faktiske personer, resultat, kort fortellertekst/karakterstemme og semantisk illustrasjon/håndboktema. Det endrer ikke døgnmotorens rekkefølge, RNG, skade, forsyninger eller kapasitetskrav. Private rapportlinjer følger allerede det fysiske laget; førstegangsmarkører konsumeres først ved publisert rapport. Eldre saves omtales som første *registrerte* opplevelse.

- `expedition_truth`: kontrakt, autoritative motorhooks, determinisme/kompatibilitet.
- `living_stories`: eksisterende discovery-register og innholdskatalog; endelige valg/last og levende avsendere.
- `living_art`: seks miljøer og seks unike anlegg, faktisk lokale filer og proveniens.
- `experience_cards`: rapportkort, paginert feltjournal og kjente anleggsbilder.
- `expedition_feedback`: korte kartmarkeringer på aktive, offentlige avspillingsfaser.
- `qa33_polish`: lagringsdialog/atomisk backup og gjenbrukbar bekreftelse.
- Orkestrator: integrasjon, bok/hjelp, start/HUD, innholdskart, sammenhengende spillerreise, dokumentasjon og draft PR.

## Bakoverkompatibilitet og innholdsgrenser

Tilleggene er valgfrie: `ReportLine.experience?`, `RegionState.experiences?` (maksimalt åtte publiserte førstegangsminner), samt `DiscoveryEntry.storyId?`, `illustration?` og et eventuelt allerede kjent oppfølgingssted. `region-2` og lagringskonvolutten beholdes. Nye flagg bruker et eget `experience:`-navnerom. Førstegangsfunn i eldre kampanjer merkes som første *registrerte* opplevelse, og pågående gamle Tor-/skapløp leses uendret.

De seks lokale tekstfunnene gir ingen nye ressurser eller statsendringer. De tre nye personløpene gir valg gjennom eksisterende `DISCOVERY_WORK`-maler (arbeid, materialkostnad, endelig last eller håp/tillit), ikke nye beløp eller en endret lootkurve. Nye valg kan selvsagt gi andre kampanjeforløp; «uendret tallbalanse» betyr ikke at nye spillervalg skal være uten konsekvenser. Det er ikke lagt inn RNG-trekk for fortellertekst eller skrudd på hendelsesfrekvensen.

## Verifisering og faktisk spillerreise

Leveransen ligger i [draft PR #34](https://github.com/michaelalorentzen-ops/stavangerz/pull/34). Main og produksjon er ikke oppdatert. Dette er en gjennomarbeidet innholdsslice, ikke en erklæring om at hele spillet er ferdig eller balansert.

### Implementert

- Åtte faktiske førstegangsopplevelser med deltakere, karakterstemme, kort scene, autoritativt resultat og konteksthjelp. De ligger i rapporten og bevares i ZA-boka også etter at gamle dagsrapporter roteres ut.
- Seks endelige lokale situasjoner uten nye premier, og tre valgfrie personhistorier for Ingrid, Marius og Leila. Eksisterende Tor-/skapløp beholdes. Oppfølgingsstedet blir navngitt og lagret før spilleren velger å følge et nytt spor.
- Tolv integrerte WebP-filer: seks gjenbrukbare miljøer og seks unike Stavanger-anlegg. Manifest, kuratert stil og kilde-/filproveniens følger med. Bilder er dekorativ tolkning; de erstatter ikke kartdata eller gir tilgang til ukjente steder.
- Rapportkort, paginert feltjournal, feltguide med seks kategorier, kjente POI-scener og illustrerte anlegg. Én opplevelse eller ett sted om gangen begrenser tekstmengden. HQ-scenen følger faktisk oppnådd fase.
- Kartmarkeringer og eksisterende lyd ved publiserte førstegangsutfall; overtakelser bruker fortsatt eksisterende polygonanimasjon. Eksisterende lokale GLB-modeller beholdes.
- Alle seks lave QA33-funn er rettet: 44 px lagringsknapper, tydelig rewind med valgfri atomisk kopi, synlig «Last spill», arkiv først i menyen, egne bekreftelsesdialoger, Chromium-override og adskilte statuskort på mobil.

### Faktisk spillerreise: 17 døgn

Survival, seed 101, Lundsneset, Ingrid som hovedperson. Orkestratoren valgte oppdrag og hendelsesvalg underveis gjennom spillets faktiske nettlesergrensesnitt; ingen `botPlay`, ferdigkonstruerte fremdriftstilstander eller ressursendringer ble brukt. [Dagbok og offentlige rapporter](evidence/living-expeditions/actual-journey.json) registrerer alle 17 døgn.

| Rapportdag | Faktisk opplevelse / valg |
| --- | --- |
| 1 | Alle fire speider Hundvåg 2; alvorlig motstand utløser feltvalg. Videreføring gir første speiding, første POI og et Marius-spor. |
| 2 | Marius/Tor bekjemper zombier hjemme; Ingrid/Leila søker. Første kamp, forsyningssøk og kikkert. Ingrid finner et eget spor. |
| 3–4 | Overtakelse avvises korrekt ved bare 9 % gjennomsøkt. Testdriveren sendte deretter feilaktig et tomt døgn; dette er beholdt i dagboka. Driveren fikk etterpå en sperre mot å fortsette en avvist plan. Videre søk og undersøkelse åpner Ingrid-valget og Leilas spor. Leila skades faktisk. |
| 5–6 | Første overtakelse, første varige perimeter og HQ ved Lundsneset kystgård. Alle åtte førstegangsminnene er nå møtt. Ingrid velger videre undersøkelse framfor umiddelbar mat. En eksisterende stille-kveld-hendelse får sitt faktiske valg. |
| 7–9 | Hvile, medisinsk planlegging, vakttårn i to arbeidsdager, videre Marius-undersøkelse og Leila-undersøkelse. Eksisterende nådevalg og matcache. |
| 10–11 | Leila tar den endelige førstehjelpskassen og avslutter sitt spor. Ingrid speider Austbø. Marius fullfører historien ved å velge håp/tillit framfor arbeidssett. Nye butikk- og kystnotater. |
| 12–13 | Ingrid og Leila undersøker ved Meny Hundvåg; Ingrid velger deretter arbeidsutstyret. Nye skog-/bolignotater. Tre personløp er avsluttet med forskjellige utfall. |
| 14–15 | Tor skades i reell kamp i Hundvåg 2. Søkelaget trekkes ut ved feltvalget. En eksisterende radiostemme binder Ingrid og Marius i to døgn; Leila fisker og Tor hviler. Matproduksjon gir faktisk milepæl. |
| 16–17 | Radiohistorien åpner et nytt kjellerspor i Hundvåg 2; spilleren velger kartsporet framfor radioen. Et nytt verktøysett leveres fra søk. Alle fire kjemper deretter i naboområdet: 32 faktiske drap, 16 patroner. Førstegangsminnene gjentas ikke. |

Den lange reisen brukte redusert bevegelse, som med hensikt går direkte til rapporten. Kartavspilling med vanlig bevegelse er kontrollert separat gjennom et faktisk oppdrag. Cloud-miljøet ble avbrutt etter første døgn. Reisen ble gjenopptatt fra den eksakte eksporten av dette faktisk spilte døgnet. Presentasjonsrettinger ble integrert under reisen; lagrede historiske tekster ble ikke omskrevet. Skjermbildene av tidlige døgn viser derfor også tidligere formuleringer og Marius-historiens opprinnelige illustrasjonsvalg. Ingen tall ble endret for å hjelpe denne kampanjen.

Eksempler: [første tur](evidence/living-expeditions/actual-first-trip.png), [første søk med sluttpresentasjonen](evidence/living-expeditions/actual-first-search.png), [rapport dag 10](evidence/living-expeditions/actual-day10-report.png), [avsluttet personhistorie](evidence/living-expeditions/actual-person-story.png), [bevart minne på mobil](evidence/living-expeditions/actual-mobile-memory.png).

### Kontroller og avgrensninger

- TypeScript og produksjonsbygg består. Den samlede [funksjonsporten med 26 kontroller](evidence/living-expeditions/functional-gate.log) består, inkludert determinisme, privat rapportering, døde avsendere, radiokrav, checkpoint/reload, eldre saves, D25/D26/D27/D28 og permanent førstegangsarkiv etter 40 døgn.
- En separat referansekjøring over sju døgn gir eksakt lik mekanisk projeksjon mot motoren før innholdsarbeidet: [paritetsbevis](../scripts/evidence/living-expedition-numerical-parity.json). Nye historieutfall er egne spillervalg gjennom eksisterende arbeids-/lastmaler.
- Offisielle nettleserløp består: start 1280/1920/390, HUD åtte reelle døgn på PC og seks på mobil, begge oppdragsretninger, gear, HQ, bok, arkiv/reload, felt-/nattcheckpoint, fysisk forsyning, kart/GLB/context-loss og klarhet. [HUD](evidence/living-expeditions/official-hud-journey.json), [checkpoint](evidence/living-expeditions/checkpoints.json), [kart](evidence/living-expeditions/map-and-glb.json).
- Nye kort, alle seks anlegg med både arbeid/sted, lang historikk og alle bokkategorier består separate syntetiske layoutkontroller på 1280×800, 390×844 og PC med stor tekst. Dette viser plass/lesbarhet, ikke naturlig oppdagelse av alle seks anlegg. [Målte vinduer](evidence/living-expeditions/content-layout.json).
- [QA33-kontrollen](evidence/living-expeditions/qa33-ui.json) består på PC og mobil. Normal/stor mobiltekst har 12 px mellom eierskap og dagens råd; ingen native bekreftelser eller JavaScript-feil.
- Den faktiske dag-17-eksporten er separat åpnet og inspisert på PC og mobil: leir, åtte permanente minner, avsluttet Marius-løp med historikk og HQ. Navigasjon og nytt gjenopptak bevarer eksakt JSON-tilstand; ingen førstegangssekvens spilles ved lasting. Dette kan gjentas med `REGION_PLAYTEST_RESUME=<faktisk eksport> node --import tsx scripts/inspect-living-save-ui.ts` mot produksjonsbygget.
- En egen faktisk første speiding med vanlig bevegelse bekrefter kartresultatet under avspilling på PC og mobil: henholdsvis `(550,448,180,49)` og `(115,470,160,61)` innen viewport. En overlapping med avspillingskortet ble funnet og rettet: markeringen ligger under kartpunktet, over vanlige stedsnavn, og avvises hvis den ville dekke viktig HUD. Arkiv og eksakt reload gir ingen ny kartmarkering. [Målinger](evidence/living-expeditions/normal-motion-results.json). SwiftShader-opptakene kom etter at markeringen var borte; de brukes derfor ikke som bildebevis på animasjonen.
- React-gjennomgang er utført for berørte komponenter: egne komponentgrenser, offentlige snapshots som input, lukkede bildebaner, native dialog/fokus, merkede kontroller, paginering og opprydding i kartets lyttere/tidsur. Ingen nytt grafikkrammeverk eller nettverksavhengig historietjeneste.

### Funnet under spilling, og fortsatt arbeid

- **Rettet:** oppfølgingsdestinasjon var skjult før valg; bildevalget for nye personhistorier var for generisk; historisk dag trengte tydeligere etikett. Medisinsk forhåndsvisning forklarer nå eksisterende terskel under 80 helse og lokale syke. Den eksisterende muligheten til å bruke medisin på et ellers tomt behandlingsoppdrag er ikke endret; dette gjenstår som et konkret UX-/balansepunkt.
- **Rettet:** den gamle «Posten var tom»/«Den andre sjansen»-kjeden diktet opp en kamp, vannpost og heltedåd uten grunnlag, også når Marius var borte. Teksten beskriver nå det faktisk registrerte valget og virkningen. Antall tap i minnet følger faktisk befolkningsreduksjon; RNG, valg og konsekvenser er uendret. Allerede lagrede hendelsestekster beholdes.
- **Observert strategisk friksjon:** én båt kunne ikke brukes både på reise og fiske. Historiearbeid konkurrerte faktisk med mat, hvile og kamp. Ingrid-sporet kunne bli liggende mens et farligere område ble vurdert. Dette er fungerende valg, men tempoet er ikke ferdig vurdert.
- **Fortsatt å vurdere i eierens spilltest:** personløp krever flere separate dagsordre og reiser. Mengden administrasjon kan fortsatt føles tung. Nye vignetter er endelige og kan brukes opp tidlig ved konsentrert utforsking; vi lover ikke én ny historie hvert døgn i alle strategier eller startområder.
- Industriobservasjonen, Tor-løpets øvrige grener, persondød under nye spor og alle seks unike anlegg er scenario-/motortestet, ikke alle naturlig møtt i denne ene reisen. Nye omfattende personløp spesielt for fase 3–5 er ikke implementert; innholdskartet over og eksisterende 117 hendelser er grunnlaget videre.
- Tallbalanse, kampanjelengde og seierstempo er uttrykkelig utsatt. Denne reisen nådde fase 1, ikke en ny naturlig seier eller full regional ekspansjon. Kartet bruker eksisterende GLB-er; nye 3D-modeller er ikke laget i denne leveransen. Cloud-nettleseren bruker SwiftShader; ytelse på fysisk PC-GPU er fortsatt ikke målt.
- En 17-døgns faktisk UI-reise dokumenterer innhold og friksjon. Den beviser ikke at spillet er morsomt eller at alle spillerstrategier får riktig rytme. Mikkis neste spilltest skal fortsatt styre videre finpuss.

Ingen nye vesentlige produktvalg er nødvendig for denne slicen. Ingen merge eller deploy uten Mikkis godkjenning.
