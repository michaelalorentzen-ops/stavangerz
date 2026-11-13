# Stavanger Z – låste spilldesignbeslutninger

**Versjon:** 0.1  
**Dato:** 2. november 2026  
**Status:** Produktretning godkjent av Mikki. Balanse, konkrete verdier og detaljerte regler er ikke låst.  
**Formål:** Styrende beslutningslogg for videre game design og Codex-arbeid etter M3.

> **Instruks til utviklingsagenten:** Dette dokumentet er produktfasit for punktene merket **LÅST**. Dersom eldre dokumenter beskriver en annen spillopplevelse, skal uenigheten synliggjøres og løses med dette dokumentet som utgangspunkt. Ikke tolk godkjenningen som bestilling på å implementere alt samtidig. Kartdata og eksisterende spilltilstand skal ikke brytes uten eksplisitt plan og godkjenning. Bruk målrettet verifikasjon og faktisk spilling, ikke omfattende tester av hver eneste feature.

## 1. Spillidentitet og spillerløfte

**LÅST**

- Stavanger Z er et geografisk, turbasert survivalstrategispill om å føre en liten gruppe gjennom en zombieapokalypse og gradvis bygge et bærekraftig samfunn.
- Hver tur representerer ett døgn gjennom hele spillet, også i senere faser. Arbeid og reiser kan gå over flere døgn.
- Kombinasjonen av overlevelse, strategi, baseutvikling, ekspedisjoner og ansvar for enkeltmennesker skal finnes i alle faser. Detaljstyringen avtar naturlig når større crew kan ledes og oppgaver delegeres.
- Spillerens ønskede følelser: sårbarhet og usikkerhet i starten, tilknytning til personer, strategisk mestring, meningsfulle tap, fristelse til ekspansjon, vanskelige moralske valg og gradvis håp.
- Ønskede sammenligningspunkter: Fallout Shelter (base + mennesker + ekspedisjoner), Risk (territorier og overstrekk), Civilization (ressurs-/strategiske muligheter), Planet Zoo (forståelig belastning på forsvar), Dead of Winter (situasjonsavhengige vanskelige hendelser). Dette er referanser, ikke funksjonskopier.
- Kjerneløkken: **observere → vurdere → prioritere → bruke begrenset kapasitet → få konsekvenser → tilpasse planen**. Det skal finnes reelle alternativer til en fast Speid → Rydd → Overta → Sikre-sjekkliste.

## 2. Faser og geografisk skala

**LÅST**

- Geografihierarki: **L3 = små taktiske soner**, **L2 = større sammenhengende distrikter**, **L1 = region**. Størrelsen tilpasses virkelige veier, land, vann, naturlige grenser og interessante strategiske valg; om lag 100 × 100 meter for L3 er veiledende, ikke et krav.
- Fase 1 er en betydelig del av spillet, ment å kunne vare flere timer. Man starter med omtrent fire navngitte overlevende. Målet er å etablere en fungerende HQ og kontrollere et sammenhengende L2-område med en forsvarbar perimeter.
- En L2 trenger **ikke** at absolutt alle bygninger er gjennomsøkt eller at alle fremtidige risikoer er eliminert. Kontroll, fullstendig gjennomsøking, forsyningsstatus og sikkerhet er ulike tilstander.
- HQ kan etableres *før* resten av L2 er under kontroll og skal gi relevante fordeler i fase 1. Utviklingen fra tilfluktssted via operasjonsbase til HQ bør være gradvis; erobring av en stor bygning er ikke det samme som full drift av hele anlegget.
- Fase 2 bygger videre på samme mennesker og samme simuleringsregler: spilleren organiserer crew med ledere, gir L2-makroordre, utvikler HQ og infrastruktur og kan zoome inn ved behov.
- Fase 3 vektlegger videre ekspansjon, handel, fraksjoner, diplomati, etiske valg og samfunnsdrift. Fase 4–5 er større regional kontroll, forskning, gjenoppbygging og veier til varig seier. Sluttmål omfatter kur eller stabilt, trygt samfunn som kan leve med eller holde smitten ute; hurtig fullføring kan være en konkurranse-/score-akse.
- Primærverdenen er **håndkuratert Stavanger/Rogaland**. Generiske simuleringsmekanikker og POI-arketyper skal være portable til andre byer senere; dette er ingen forpliktelse til å generere andre byer nå.
- Samarbeidsspill er et langsiktig produktmål; to aktive spillere skal begge godkjenne neste tur. PvP er sekundært, ikke hovedbalansemålet.

## 3. Introduksjon og spilleropplæring

**LÅST**

- Start i umiddelbar etterkant av et utbrudd. En kort, troverdig introduksjon forklarer hvorfor de første overlevende er samlet og midlertidig skjermet mens omgivelsene er i kaos.
- Et fiktivt **ZA Survival Handbook** finnes i verden og introduserer råd som å være stille, få oversikt, sikre nærmiljøet og finne utstyr. Boka fungerer som diegetisk, kapittelbasert opplæring og senere oppslagsverk.
- Spillet forklarer hvordan systemene virker, men lar spilleren oppdage hvilke strategier som er best. Boka kan være ufullstendig eller inneholde antakelser som senere må revurderes.
- Første 3–4 turer skal være langsomme nok til å skape forståelse og tilknytning, men ikke et låst klikk-for-klikk-forløp. Erfaren spiller skal kunne velge snarveier og ta risiko.
- Tidlige aktiviteter: utvendig rydding, undersøke hus for smittede/overlevende/forsyninger, etablere vakthold og enkle sperringer, deretter utvide til nabosoner og strategiske POI-er.
- Valgfritt lokalt startpunkt kan vurderes for fremtiden. Brukers faktiske hjemmeadresse skal ikke automatisk eksponeres for andre spillere; beboere og innhold i virkelige hus må være fiksjonalisert.

## 4. Arbeid og clearing – samme grunnregler i alle faser

**LÅST**

- Spilleren skal **ikke** manuelt gå inn i hvert hus. Opplevelsen skal være at gjengen gjør dette, mens motoren beregner fremdrift gjennom arbeidskapasitet per døgn.
- Et hus/boenhet representerer en omtrentlig arbeidsmengde. Beregningen må skille mellom enebolig, rekkehus, større boligbygg og andre bygningskategorier når datakvaliteten tillater det. Arbeidstimer, tilkomst, utstyr, kompetanse, gruppestørrelse, trussel og tretthet kan påvirke effektiviteten.
- «Én person bruker omtrent én time på ett vanlig hus uten modifikatorer» er **illustrativt balansemål**, ikke låst hastighet. Flere personer øker kapasiteten, men gruppearbeid er ikke nødvendigvis helt lineært.
- Spiller skal kunne velge å holde gruppen samlet (tryggere/saktere) eller spre den (raskere/mer risiko). Én person kan forsøke et farlig oppdrag, men risikobildet må kommuniseres.
- Soneprogresjon skiller minst mellom: ukjent/rekognosert, utvendig ryddet, innvendig undersøkt, kontrollert og sikret. Disse tilstandene skal ikke forveksles med hverandre.
- Mulige ordrer: raskt raid mot POI, gate-/ruteklaring, overfladisk søk, grundig bygningssøk, overtakelse og defensiv sikring. Alt trenger ikke gjøres for alle soner.
- Arbeidsfremdrift bevares over flere døgn. Nær base kan gruppen normalt returnere ved dagens slutt; lengre ekspedisjoner kan kreve leir/overnatting. Leir gir mulig eksponering, men ikke automatisk dramatisk hendelse. Ved hendelser kan «crossroads»-lignende valg oppstå når de er situasjonsrelevante.
- Når crew-ledere senere leder oppdrag, bruker motoren de samme reglene, men lederen velger løpende gjennomføring innenfor spillerens overordnede instruksjoner og prioriteringer.

## 5. Zombieverden, migrasjon og forsvar

**LÅST**

- L3 eier zombiepopulasjonen. L2 og L1 aggregerer; det finnes ingen ekstra usynlige zombiepopulasjoner på høyere nivå. Smittede kan flytte seg mellom tilstøtende områder etter forståelige forhold: tilgang, lyd, hindringer, miljø og hendelser.
- Trusselen oppstår hovedsakelig fra eksisterende populasjoner og definerte eksterne reservoarer, ikke fra vilkårlig spawning av en horde i et trygt område. Sjeldne hendelser som smittede som driver i land kan forekomme med tydelig verdenslogikk.
- Forsvar modelleres primært langs **utsatte grenser/passasjer**, ikke med et obligatorisk menneske plassert i hver L3-sone. Interne grenser mellom sikre, sammenhengende soner krever vanligvis ikke samme kapasitet.
- Patrulje- og overvåkningskapasitet påvirkes av personell, kompetanse, utstyr, mobilitet, siktlinjer, veiforhold, barrierer og infeksjonstrykk. En person eller et crew kan dekke flere soner når forholdene tillater det.
- Barrierer, naturlige hindringer og vakthold skal **frigjøre arbeidskapasitet** ved å redusere behovet for aktiv patruljering. Vedlikehold må gjenspeiles i daglig arbeid/materialforbruk, men ikke bli tvungne, gjentatte klikk på hver sperring.
- Spilleren ser forståelig forbruk, inntekt, eksponering, buffer og varsler. Risiko bør avhenge av situasjonen, ikke bare en konstant prosent. «Helt sikker» skal brukes restriktivt; lave risikonivåer kan akkumulere over mange døgn.
- Ved overstrekk kan en L3 eller deler av en L2 tapes. Retrett, avbrutte oppdrag, forsterkning, lokking og kamp er mulige reaksjoner. Tidligere rekognosering og gjenværende infrastruktur gjør gjenerobring lettere enn første erobring.
- Etter hvert utvikler zombier seg delvis uforutsigbart og kan få både fordeler og ulemper. Forskning gir varsler, forståelse og mottiltak; det skal ikke være en enkel, lineær skadebonus.

## 6. Rekruttering, personer og moral

**LÅST**

- **Spilleren har veto over hvert eneste menneske som tas inn.** Ingen rekrutteres automatisk bare fordi en dagsgrense eller HQ-terskel er nådd. Eventuelle ankomster kan settes på vent mens spilleren vurderer dem.
- Hvert menneske har minst en forståelig profil: navn/identitet, behov, relevant kompetanse/kapasitet og eventuelle relasjoner eller særtrekk. De er ikke anonyme produksjonsenheter selv om de ikke har håndskrevet quest.
- Noen overlevende skal være en **ren eller klar netto ressursbelastning i fase 1 og 2**. Eksempel: to eldre som trenger pleie og et lite barn. Spillet skal ikke tildele alle en kunstig skjult nytteverdi for å kompensere.
- Å ta dem inn, avvise dem, hjelpe begrenset eller utsette avgjørelsen kan gi forskjellige og situasjonsavhengige konsekvenser. Ikke alle valg må alltid tilbys.
- Moral er ikke bare én universell karma-måler. Personlige verdier, relasjoner, lojalitet, gruppens trygghet og rykter mellom fraksjoner påvirkes av valg. To overlevende kan reagere motsatt på samme beslutning.
- Vanskelig RNG kan kreve ny strategi og reelle offer, men ordinære spill skal som hovedregel beholde mulige veier videre; hardcore kan være ubarmhjertig. Verken garantert seier eller tilfeldig fastlåsing er ønskelig som standard.
- Rekrutteringskilder: overlevende i bygninger, aktivt søk, radiosignaler, tilflyttere, flyktninger og kontakt med andre grupper. HQ kan aktivere signaler/beacon/banner; dette øker synlighet og potensielle ankomster, men også risiko fra fiendtlige aktører. Tilførsel må være forankret i befolkning/omverden, ikke en uendelig lokal generator.
- **Vanlige overlevende kan utvikle seg til crew leaders** gjennom erfaring og egnethet. De opprinnelige fire følger med som mulige ledere. Omtrent 30–40 håndlagde spesialkarakterer over hele spillverdenen er et innholdsmål, ikke en eksklusiv lederklasse eller et løfte om 40 i første leveranse.
- Håndlagde karakterer kan ha egne historier, evner, personlige oppdrag, konflikter og moralske særtrekk. Vanlige mennesker kan fortsatt bli viktige for spillerens historie.
- Sent i fase 1 er rundt 12–15 overlevende en **balansehypotese**, ikke en automatisk befolkningskurve. Flere mennesker øker produksjon, forsvar og muligheter, men krever mat, vann, bolig, utstyr og eventuelt pleie. Barn født etter utbruddet hører hjemme i lengre samfunnsprogresjon, ikke som umiddelbar arbeidskraft.

## 7. Ressurser, loot og økonomi

**LÅST**

- Økonomien skal ha Civ-lignende lag: sentrale forbruksvarer; vanlige byggematerialer; sjeldne strategiske deler og gjenstander; kompetanse; produksjonskapasitet; og eventuelle samfunns-/handelsverdier.
- Det kan finnes mange hundre *loot-gjenstander*, men spilleren skal ikke administrere hundrevis av daglige ressursmålere. De fleste kan brukes, repareres, selges, demonteres eller inngå i noen få forståelige materialkategorier.
- Ressurser må gi et faktisk valg eller åpne en meningsfull handling. Noen forbrukes (mat, medisin, drivstoff), noen er utstyr (generator, radio, batteri), og noen er vedvarende **kapasiteter** (verksted, vanntilførsel, kommunikasjon, strøm, kompetanse).
- Loot fra bygninger er primært endelig. Gjennomsøkt hus refylles ikke automatisk. POI-er kan ha gjentatt bruk gjennom produksjon, logistikk, forsvar, handel, hendelser eller infrastruktur selv etter at lageret er tømt.
- Verdi bestemmes av lokasjon og plausibelt innhold, ikke automatisk «høy zombiefare = høy loot-tier». Vanskelige steder kan ha dårlig utbytte; tidlige uvanlig gode funn er mulig, men støttes av naturlige begrensninger i ammunisjon, støy, transport, reparasjon og vedlikehold.
- Produksjon krever relevant kombinasjon av materialer/deler, kompetanse og anlegg, eventuelt strøm. Ny teknologi gir først og fremst nye **muligheter**, ikke magiske nivåbonuser til eksisterende våpen.
- Eksempel på progresjon: improviserte barrikader og reparerte sykler → organisert verksted, radiosamband, vannrensing og forsterkninger → industriproduksjon og spesialkjøretøy → regional infrastruktur og handel.
- Moderne 2026-teknologi skal ha plass: 3D-printere, elbiler, båter, busser, batterier, solcellepaneler, radio og mulig satellittkommunikasjon. Teknologi må være morsom, men plausibelt avhengig av deler, strøm, kunnskap og drift. En pansret Kolumbus-buss kan bli en kraftig sen oppgradering med reelle kostnader og begrensninger.
- Kraft, vann, kommunikasjonsrekkevidde og tilgjengelig transport skal i relevante tilfeller være **kapasiteter/nettverk**, ikke bare lagerressurser. Satellittnettverk kan være et sjeldent, spesielt mål, men «hack tårnet og få Starlink» er ikke et faktum og må eventuelt fiksjonaliseres tydelig.

## 8. Arealbruk, HQ og strategiske anlegg

**LÅST**

- Hver L3-sone kan ha naturlig kapasitet/potensial for boliger, dyrking, skog, industri, transport og forsvar. Ikke alle soner bør kunne gjøre alt.
- Spilleren bestemmer bruk: bevare og sikre boliger, gjøre om noe til jordbruk/verksted, demontere bygninger for materialer, etablere forsvarsverk osv. Areal og arbeidskraft er begrensninger; rivning reduserer fremtidig bolig- eller funksjonskapasitet.
- Klargjøring av boliger representeres av et aggregert arbeid + materialkostnad (for eksempel sikring av vinduer og innganger). Ikke detaljerte vindu-for-vindu-oppgaver.
- Det skal finnes **ulike HQ-profiler**, ikke ett objektivt beste sted. Mulige Stavanger-kandidater for videre vurdering: Rosenberg, Kuppelhallen, tidligere sykehus, K8, Stavanger Forum/DNB Arena, kjøpesentre som Madla Amfi/Kvadrat/Kilden, skoler og andre større bygg. Faktisk geografi, innganger, potensial og balanse skal kurateres, ikke oppdiktede fakta om hvert bygg.
- Skille: **HQ** (samfunnsledelse og bosetting), **outpost** (lokal operasjonsbase), **strategisk anlegg** (spesifikk funksjon) og **ressurssted** (produksjon/tilgang). Et viktig anlegg trenger ikke være et godt sted å bo.
- Unike strategiske POI-er kan representere verft, havn, vanninfrastruktur, Ullandhaug/kommunikasjon, medisinske miljøer, kraft, større industri og militære steder. Ekte kart brukes som ramme; interiører, risiko, personer, lager og adgang i spillet kan være fiksjonalisert.
- Kontroll over nødvendig infrastruktur skal skape motiv for videre ekspansjon: vann, strøm, transport og kommunikasjon kan kreve mer enn ett anlegg og sammenhengende ruter.

## 9. Oppdrag, hendelser og fortelling

**LÅST**

- Bruk en kombinasjon av spillerstyrte mål, oppdrag fra personer/fraksjoner, situasjonsbetingede hendelser og noen håndskrevne historiebuer. Ikke en rigid oppdragskjede som alle må følge.
- Hendelser skal primært oppstå fra verdenssituasjonen: støy kan trekke zombier, matmangel kan utløse konflikt, svake sperringer kan varsle et kommende brudd, radiosignal kan trekke folk og trusler. Tilfeldighet bestemmer variasjon innen forståelige regler.
- Spiller skal få synlig årsak/virkning og varsler i tide til meningsfulle mottiltak. Moralske valg skal være vanskelige uten å gi en entydig «god» belønning hver gang.
- Første dager introduserer mekanikker når spilleren faktisk trenger dem; senere oppdrag og systemer skalerer fra enkeltpersoner og L3 til crew, L2 og større regioner.

## 10. Spillgrensesnitt og opplevelse

**LÅST**

- Kartet er sentralt. Spilleren skal se hvilken sone som kontrolleres, hva som er kjent versus anslått, hvilke ruter som er åpne, hvem som arbeider hvor, hva som presses av zombier og hva som er igjen av arbeids-/forsvarskapasitet.
- L3 kan detaljstyres; på høyere nivå kan spilleren gi prioriterte makroordre. Zoomnivåer og styringsform skal støtte faseovergangen, ikke tvinge konstant mikrostyring.
- Daglig rapport må fortelle en konkret historie om **arbeid, funn, reiser, trusselendring, skader, forbruk og konsekvenser**, med forståelig kobling til de valgene spilleren tok.
- Grensesnittet skal vise forventet arbeidstid, reise, risiko, tilgjengelige ressurser, netto produksjon/forbruk og beredskap med tilstrekkelig presisjon til at spilleren kan planlegge. Usikre intel-estimater skal markeres som usikre.

## 11. Bevisst åpne spørsmål – ikke lås tall uten spilling

**ÅPENT / BALANSEHYPO­TESER**

1. Eksakt arbeidstimer/døgn, tid per boenhet, lineær/ikke-lineær gruppemultiplikator og kamp-/støyeffekter.
2. Eksakte krav til «L2 trygg» ved faseovergang, minstekrav til HQ, hvor mye usikret innside kan gjenstå og eksakt fase-1-varighet.
3. Hvor ofte rekrutter kan finnes, totale tilgjengelige populasjoner, sjanse for hendelser, tempo i vekst og antall personligheter som krever håndskrevet innhold.
4. Stat-/skillsett, progresjon, hvordan vanlig overlevende kvalifiserer til crew leader, og spesialkarakterenes evner.
5. Eksakte ressurskategorier, produksjonsoppskrifter, tier-navn, egenskaper og priser; lag en liten vertikal progresjonskjede før bred katalog.
6. Sperringsslitasje, vaktholdseffektivitet, risiko ved leir og forsyninger og varslingstid ved forestående brudd.
7. Konkrete HQ-bonuser og unik POI-effekt per virkelig lokalitet. Geografiske polygoner, tilgang og grenser må gjennom separat kartvurdering.
8. Den konkrete fortellingen og karakterlista, særlig hvilke håndlagde karakterer som finnes i første spillbare L2.
9. Co-op-implementering, synlighet, reconnect og serverlås (produktkravet om begge Ready er beholdt, men ikke del av neste designarbeid).

## 12. Neste arbeid – eksplisitt anbefalt rekkefølge

**BESLUTTET ARBEIDSRETNING, ikke implementasjonsgodkjenning for alle fremtidige faser**

1. Oppdater eksisterende GDD/plan så de ikke motsier disse produktprinsippene. Marker de gamle M3-forenklingene som prototype, ikke permanent design.
2. Lag **Player Journey for første 15 dager**, med flere mulige utfall, tydelige læringspunkter og minst noen ekte prioriteringsvalg.
3. Spesifiser den lille **fase-1-kjerneløkken**: arbeidskapasitet, utvendig/innvendig søk, raid, overtakelse, forsvar, enkel loot, én rekrutteringsbeslutning med varige relasjonskonsekvenser.
4. Spesifiser **én sammenhengende ressurs- og produksjonskjede** som viser forskjellen mellom forbruksvare, materialer, spesialutstyr og produksjonskapasitet.
5. Juster og prøvespill M3/M4-slicen før kataloger med hundrevis av gjenstander, flere HQ-er, hele Stavanger, komplekst samfunn eller co-op bygges.

### Beslutningskriterium for nye features

En ny mekanikk eller ressurs beholdes bare hvis den **løser et reelt problem, åpner en ny strategi, skaper et meningsfullt valg eller styrker den ønskede spilleropplevelsen**. «Flere tellere» er ikke et mål.

### Endringskontroll

Nye forslag som endrer et **LÅST** punkt skal legges fram som eksplisitte produktendringer med begrunnelse og konsekvens, ikke gjennomføres stille av en agent. Tall og regler merket **ÅPENT** justeres gjennom dokumenterte små spilltester.
