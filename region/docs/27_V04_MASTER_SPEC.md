# StavangerZ v0.4 – produktspesifikasjon

**Status:** designgrunnlag godkjent på prinsippnivå 12.11.2026. M1 finnes i draft-PR-er, men er ikke merget eller deployet.  
**Produkt:** regionspillet under `region/`, videreføring av `regionspill-v0.3`.  
**Eier:** Mikki. **Teknisk leveranse:** orkestrert, trinnvis implementering med tester og godkjenning.

## 0. Autoritet, omfang og begreper

Dette er kilden til v0.4-designet. Ved motstrid om v0.4 gjelder denne spesifikasjonen før eldre `24_V02_DESIGN.md`, `26_V03.md` og fase-1-dokumentene. Dokumentene for v0.1–0.3 beholdes som historikk og som beskrivelser av eksisterende kode. `28_V04_DECISIONS.md` skiller låst design fra åpne detaljer; `29_V04_IMPLEMENTATION.md` styrer leveransene.

**Låst prinsipp** betyr at agenten skal implementere etter intensjonen uten å omdefinere den. **Åpent** betyr at det trengs et produktvalg eller spilltesting før endelig regel. Tall og eksempelverdier i dette dokumentet er **ikke** balanserte verdier med mindre annet er eksplisitt sagt.

Bevar eksisterende regionspill, kartdata, hendelser, forskning, lagringer og modeller der det er mulig. v0.4 er en iterativ revisjon, ikke en ny spillmotor eller automatisk omskriving av det eldre Buøy-spillet. Ingen deployment, migrering av brukerdata eller merge til hovedgren uten separat kontroll.

## 1. Spillerløftet

StavangerZ er et geografisk, turbasert zombie- og samfunnsspill. Reisen går fra et lite, personlig overlevelsescrew gjennom HQ, organisering og ekspansjon til styring av Stavanger. Spillet må gi tre parallelle grunner til å spille én dag til: **overlevelse, fremgang og nysgjerrighet**. Spilleren skal se at handlingene påvirker kartet, personer, ressurser og samfunnet. Flere strategier skal fungere; ingen rigid, skjult «riktig» løsning.

### 1.1 Faser

| Fase | Opplevelse | Hovedfokus i UI | Grad av delegering |
| --- | --- | --- | --- |
| 1: Overlev | Fire overlevende, nærområder, loot, risiko, personlig historie | Navngitte personer, helse, mat/vann, konkrete L3-soner og funn | Direkte ledelse, lite automatikk |
| 2: Etabler | Permanent HQ, trygghet, produktivitet og vakthold | HQ, forsvar, arbeid, produksjon | Rutinestyring, begynnende oppdragsautomatisering |
| 3: Organiser | Crew-ledere, radio, samarbeid, ekspansjon | Oppdrag, forsyninger, samband, fraksjoner | Delegert feltarbeid etter stående instrukser |
| 4: Utvid | Regioner, underordnede ledere og strategiske forbindelser | L1-ledere, regionale lagre, risiko og produksjon | Regionale guvernører med mandat |
| 5: Fremtiden | Styringsform, storstrategi, fraksjoner og flere mulige avslutninger | Samfunnsstabilitet, regioner, kriser og strategiske mål | Høy grad av selvstendig regional drift |

Dette er **designretning**, ikke endelige fasenavn eller eksakte opplåsingskrav. Brukeren har ønsket at fase 1 skal være en lang og meningsfull spillopplevelse, ikke overgang etter få dager. Varighet skal oppstå av innhold og kapasitetskrav, ikke en kunstig ventetimer.

## 2. Døgnflyt og beslutninger (låst)

1. Ett trekk representerer **07:00 til 07:00 neste dag**.
2. Klokken 07:00 planlegges oppdrag, arbeidsfordeling og ordrer. Oppdrag reserverer nødvendig kapasitet/utstyr før simuleringen.
3. **07:00–22:00** er vinduet for planlagte operasjoner, reise, utforsking, bygging og kontakt. Dette betyr **ikke** at alle arbeider 15 timer; arbeidstid, reise, overtid og utmattelse har egne regler. En normal arbeidsdag rundt åtte timer er bare en ubalansert hypotese.
4. **22:00–07:00** er primært nattfasen: zombievandring, press mot forsvarsverk, vakthold, angrep og nattlige hendelser. Operasjoner kan pågå over natten hvis det er logisk og tillatt.
5. Klokken animeres raskt som *presentasjon*. Spillet simulerer **ikke** kontinuerlig minuttfysikk. Hendelser får simulerte tidspunkt og posisjoner slik at opplevelsen er troverdig.
6. Standard er rask avspilling. **Skip** hopper over visuelle overganger, men aldri obligatoriske spillerbeslutninger. En kritisk hendelse pauser, valget lagres, og samme døgn fortsetter deterministisk etterpå.
7. Ordrene behandles som en samlet dagsplan. Motoren må definere en eksplisitt, deterministisk rekkefølge for konflikter, bevegelse, ressursreservasjon, møter, kamp, hjemkomst, nattpress og regnskapsføring. UI-rekkefølgen må ikke utilsiktet avgjøre utfallet, med unntak av regler som **bevisst** gir prioritet til ordretidspunkt (f.eks. gear-reservasjon).
8. Folk som er ute på tokt, er fysisk borte fra HQ og kan ikke samtidig forsvare det. De kan bli forsinket eller overnatte ute. Fast vakthold er bundet til forsvarssonen.

### 2.1 Hvem tar avgjørelsen?

Skill mellom **spilleren** (strategisk beslutningstaker), **hovedpersonen** (fysisk, sårbar avatar) og **samfunnets leder** (politisk rolle, som kan være en annen person). Hovedpersonen kan bli på HQ og være tryggere, eller dra ut og styre møter direkte med høyere risiko.

- Når hovedpersonen selv møter en situasjon, er det spilleren som tar valget.
- Andre crew tar ordinære feltbeslutninger selv etter oppdragets mandat, ledertrekk og stående ordre.
- **Standard for bortelag er delegert avgjørelse:** Feltlederen følger oppdragets mandat og stående instrukser, også når samband virker. Spilleren kan ved oppdragsplanlegging aktivere «Kontakt meg ved kritiske hendelser»; bare da kan større hendelser eskaleres til spilleren gjennom faktisk fungerende samband/rekkevidde.
- Hendelser som hovedpersonen personlig møter, og kritisk forsvar der hovedpersonen faktisk er til stede, kan alltid kreve spillervalg. Uten forbindelse må bortelagets leder handle selv, ikke vente på et magisk popupvindu hos spilleren.
- Mennesker bor og arbeider i faktiske områder; vaktlag som **holder et helt L2-område** kan ha områdedekning uten en oppdiktet punktposisjon i én bestemt L3.
- I vanlige vanskelighetsgrader kan samfunnet fortsette med en etterfølger hvis hovedpersonen dør. Politikksystem, stedfortreder og valg/styreform påvirker overgangen.

Kritiske hendelser skal være sjeldnere og mer selektive i senere faser. Ikke hundre beslutningspopups per dag.

## 3. Kart, lokasjon og animasjoner (låst)

### 3.1 Lokasjon og zoom

- Behold den faktiske geografiske modellen L1 → L2 → L3. Alle nivåer kan inspiseres i alle faser.
- Et crew på et konkret oppdrag har en reell, vedvarende posisjon/reise på relevant L3-nivå. Ved utzooming grupperes visningen i forelder-L2 eller L1. Ikke animer L3-bevegelser som ikke er synlige i aktuell zoom/viewport.
- Vaktlag som dekker hele L2 eller L3 er **områdeplasserte** og vises som vakt-/perimeterdekning, ikke som fysisk personikon på en tilfeldig L3.
- Vis relevante bevegelser, brudd, kamper og sonetap lokalt. Kamera står som standard stille; varsler gir mulighet til å hoppe til stedet.
- Tåkekrig skjuler ukjent tilstand og POI-er. Den kjente geografien kan fortsatt gi lokalkjente spillere en fordel: veier, bygninger og terreng må ikke late som om de er ukjente, mens beboere, zombier, loot og aktive steder må oppdages.

### 3.2 Grafisk feedback

- Kartet forblir lesbart: **svake eierskapsflater og tydelige grenser** over veier og bygninger.
- Overtakelse: en myk «væske-/flood fill»-effekt som sprer seg fra inntrengningspunktet, **klippet til den faktiske sonepolygonen**. Tap kan animeres som en motsatt/mørkere trusselstrøm fra bruddet.
- En foreldresone L1/L2 får ikke visuelt full kontroll bare fordi enkelte undersonepolygoner er tatt. Aggregert kontroll må være ærlig.
- Prioriter kartfeedback, flyt og lesbarhet før avansert 3D.
- Zoomavhengige HQ, bygg, vaktposter, båter, biler og perimeter kan i senere steg være ikoner, 2.5D eller enkle low-poly-objekter. Rendering begrenses etter zoom og viewport, med ytelsesbudsjett og enkel fallback.
- Gjenbruk visuelle miljøfamilier. Ingen produksjon av 663 unike sonebilder. Kuraterte, gjenkjennelige landemerker og spesielle POI-er kan ha egne bilder.

## 4. Dagsrapport og signaler (låst)

Rapporten åpnes etter døgnet, er rask å lukke og kan finnes igjen. Den gir **én tydelig hovedoverskrift** basert på dagens største endring. En diffus, gjenbrukbar illustrasjon kan velges ut fra viktig hendelse (sonetap, overtakelse, dødsfall, ny bygning eller POI), men er ikke påkrevd hver dag.

- Nøkkelressurser animeres med nettoendring og faktisk beholdning. **Dager til tomt lager**, forventet forbruk og faregrense er viktigere enn ren pluss/minus.
- Funn rangeres etter **alvorlighet, relevans, fase og nyhetsverdi**. Kritiske funn forsvinner ikke fordi de heter «speiderrapport».
- Rutinebeskjeder som «speiderrapport klar» eller «kamp rapportert» kan være én linje med lenke til egne detaljer. I fase 1 kan samme rapport være hovedsaken.
- Alle kritiske og uleste funn er tilgjengelige etter at dagsrapporten lukkes.
- Rapportsammendrag bygges av **strukturert simuleringsdata**. Ikke kall LLM for å fortelle hva som skjedde i hver tur.
- Ved faseskifte får spilleren en kort historie om oppnådde milepæler, nye muligheter og neste hovedmål.

## 5. Personer, posisjon og utstyr (låst)

Det finnes tre skalanivåer: fysisk hovedperson; navngitte crew-/regionledere med vedvarende identitet, ferdigheter, utstyr og historie; aggregert befolkning som kan få nye ledere. Portretter er **faste og gjenkjennelige** med synlige utstyrskort, ikke krav om dynamisk gjengivelse av alt på karakterbildet.

### 5.1 Utstyrsklasser

**D26, avklart 12.11.2026:** Første implementering bruker våpen, beskyttelse og oppdragsverktøy som de tre personlige kategoriene, med auto-equip og manuelle låser. Eksakt antall plasser, effekttall og utstyrsloot testes som hypoteser.

- **Personlig gear:** våpen, beskyttelse og andre persistente karaktervalg.
- **Oppdragsutstyr:** brekkjern, lommelykt, kikkert, spesialverktøy. Foreslås etter faktisk aktivitet.
- **Tildelt/felles utstyr og infrastruktur:** radio, kjøretøy, generatorer og forsvarssystemer. En walkie er ikke nødvendigvis et manuelt «equip-slot», men må finnes fysisk og kunne fungere.
- Utstyr er ikke en monoton bonus: lommelykt hjelper søk og orientering, men lys kan avsløre laget; tunge våpen/utstyr kan påvirke støy, fart eller belastning.

### 5.2 Auto equip

1. Ved oppdragsplanlegging er **Auto equip PÅ som standard**.
2. Crewwidgeten viser valgt gear. Klikk åpner manuell redigering. Et manuelt låst valg beholdes mens automatikken kan fylle andre plasser; hele togglen kan slås AV.
3. «Best» betyr **best egnet til oppdraget**, innenfor tilgjengelig lager, kapasitet og eksplisitte manuelle låser.
4. Utstyret **reserveres når oppdraget settes opp**. Første reserverte oppdrag får førstevalget; resten får det som er igjen. Endring/kansellering må frigjøre eller oppdatere reservering uten duplisering.
5. Utstyret følger personene fysisk. Midlertidig oppdragsutstyr blir tilgjengelig i HQ-lageret **først når personen faktisk kommer tilbake og leverer det**. Utstyr kan ikke teleporteres fra HQ til feltet.
6. Langvarige oppdrag og poster kan forsynes ved at laget returnerer eller ved et separat transport-/forsyningsoppdrag med faktisk reisetid, tilgjengelige transportressurser og risiko. Navnløse bud trenger ikke full personprofil; de representerer likevel faktisk bundet arbeidskraft/transport.
7. Etter hvert kan en HQ-logistikkansvarlig automatisere omutrustning, lagerfordeling og forsyninger etter mandat, uten å overstyre reserverte/personlig låste gjenstander.

Tidlig loot må kjennes personlig og viktig. Etter hvert skal bedre lager og logistikk redusere behovet for å min/maxe hver crew-leder. Spilleren kan fortsatt detaljstyre egen avatar og spesialutstyr.

## 6. ZA-bok, utforsking, POI og historier (låst prinsipp)

**ZA-boka** er et internt grensesnitt med tre deler:

1. **Fem kapitler**, ett per fase, med overordnede råd og mål. Kapittel 2 åpnes i fase 2 osv. Boka er **ikke** en liste med pålagte oppdrag, og den kan være ufullstendig eller gi råd spilleren bevisst ignorerer.
2. **Spillerhåndbok/oppslagsverk** med tilgjengelig grunninformasjon om soner, POI, ressurser, gear, oppdrag og UI. Spilleren må kunne forstå grunnregler før relevante mekanikker tas i bruk, selv om senere kapitler er låst.
3. **Feltguide/oppdagelser** som fylles via observasjon, undersøkelser, research og rapporter. For eksempel ukjent zombietype → observert atferd → undersøkt svakhet/mottiltak. Ikke avslør informasjon om uutforskede steder eller hemmelige mekanikker uten spillgrunnlag.

Generell kunnskap om hvordan spillet fungerer er forskjellig fra **operativ etterretning** om et bestemt område. Informasjon som bare et dødt, hjemvendt aldri rapporterende speiderlag kjente, skal ikke automatisk dukke opp i boka.

### 6.1 Oppdagelse og sidehistorier

- Standardkjede: **ledetråd → undersøkelse → oppdagelse → valg → konsekvens**. Hendelser kan være korte eller gå over flere dager.
- Samme oppdrag kan oppdages gjennom speiding, dokument, rykte, radio eller eget initiativ; ingen obligatorisk markørkjede A–B–C for hvert funn.
- Tre innholdstyper: historieintegrert tutorial; **åpen** overordnet samfunnshistorie; valgfrie sidehistorier som gir dybde, lokale mysterier og konsekvenser.
- Noen historier er bundet til **spesifikke levende personer** og kan forsvinne permanent hvis personen dør eller aldri rekrutteres. Slike historier er valgfrie og må ikke være den eneste veien til nødvendig progresjon.
- Belønninger kan være folk, informasjon, unik produksjonsmulighet, strategisk passasje, spesialutstyr, forskning eller narrativ avslutning. Ikke alle spor gir en stor premie.
- Bruk virkelige, offentlig dokumenterte steder korrekt. Skjulte rom, bunkere og lignende som ikke er verifisert, behandles som fiksjon, ikke som påstander om reelle hemmelige anlegg.

### 6.2 Sonekategorier og POI

| Kategori | Formål | Behandling |
| --- | --- | --- |
| Ordinær L3 | Geografisk fremgang og grunnressurser | Speid, rydd, overta, sikre; variasjon etter terreng/bebyggelse |
| Vanlig POI | Loot, en lokal hendelse eller brukbar fasilitet | Kort møte/risiko, ikke full separat historie |
| Unikt POI | Landemerke, strategisk anlegg eller nøkkel til fortelling | Kuratert scenario, flere mulige trinn/valg, varig unik effekt |

Å **eie sonen** og å **undersøke, sikre eller få anlegget i drift** er ulike tilstander. Eksisterende v0.3-wonders beholdes, men deres nåværende automatiske overtakelse kan trenge ny, eksplisitt overgangsregel. Ikke skriv om alle unike POI-er før en slik regel er godkjent.

## 7. Faseprogresjon og flere avslutninger (låst prinsipp)

- Et faseskifte skjer fordi samfunnet har **faktisk kapasitet**, ikke fordi spilleren har fulgt bokas oppskrift eller ventet et bestemt antall dager.
- Et kriterium må kunne oppfylles med ulike virkemidler (f.eks. bærekraftig vannforsyning fra ulike anlegg). Unngå tvungne, spesifikke bygg/quests der en alternativ strategi burde fungere.
- Fase 1 → 2 skal kreve meningsfull etablering: operativt HQ, et defensibelt sammenhengende kjerneområde og tilstrekkelig mat, vann og vakthold. **Hele hjemmets L2 er ikke et absolutt krav**; et reelt forsvarbart kjerneområde er en likeverdig vei (D25). Å ta hele L2 skal fortsatt gi en tydelig geografisk prestasjon. Eksakte terskler er balansehypoteser. v0.3s raske fase-2-overgang fra én sone er ikke ønsket.
- Spilleren skal se **hvilke kapasiteter som mangler** før neste fase, selv om neste ZA-kapittel er låst.
- Systemer introduseres gjennom fasehendelser og fortelling, uten en meny med alle fremtidige funksjoner på dag 1.
- Hovedhistorien om samfunnets fremtid er åpen. Forskning på årsak/kur og valgfri lore kan avsløres gradvis, men skal ikke være obligatorisk for å lykkes.
- Slutten(e) utledes av **verdensstatus og spillervalg over tid**: overlevelse, styreform, relasjoner, forskning, stabilitet og kontroll. Ikke bare et enkelt avsluttende «velg ending»-popupvindu. Antall, nøyaktige terskler og sluttscener er åpne.

## 8. Automatisering, politikk og regional ledelse (låst prinsipp)

Grunnregel: spilleren styrer flere mennesker etter hvert, men skal administrere **færre rutinebeslutninger per person**.

1. **Rutinedrift** (mat, enkle reparasjoner, vakthold, lager) kan i høy grad automatiseres.
2. **Operative oppgaver** (speiding, sikring, forsyninger, feltutstyr) kan delegeres etter mandat og risikogrense.
3. **Strategi** (territoriell prioritet, diplomati, styreform, alvorlige moralvalg) forblir som utgangspunkt hos spilleren, med varierende delegeringsmandat.

### 8.1 Regionalt hierarki i fase 4–5

- Kontrollert L1 kan få en **navngitt regional leder** med **regionalt HQ** på faktisk geografisk plassering. Under lederen ligger crew-ledere og lokal arbeidskraft.
- Lederne er **underlagt samme samfunn og én eierstatus**, ikke nye uavhengige NPC-fraksjoner med separat diplomati. Unntak/opprør er mulig senere, men ikke krav i første v0.4-leveranse.
- Spilleren tildeler oppstartsressurser, folk, mandat og prioritet; enkle pakker (forsvar, balanse, vekst) kan foreslås, og mengder kan justeres. Pakkenes illustrerte tall er **ikke** balansefasit.
- Lokal produksjon, lager, mat, vaktstyrke og transport har **fysisk lokasjon**. Felles politisk eierskap betyr ikke gratis global lagerdeling. Forsyningslinjer/veier/båter er viktige.
- Regional leder velger detaljer innenfor mandat, og rapporterer **avvik og kritiske beslutninger** i stedet for alle daglige aktiviteter.
- Styreformen påvirker mandat, autonomi, ansvar og hvordan ledere velges/erstattes. En streng ledelsesform og et råd er ulike strategiske opplegg uten én automatisk overlegen løsning.
- Personlighet, kompetanse, lojalitet og død påvirker regionens resultat. Bytte av leder må ha gjennomtenkte konsekvenser, men eksakte tall er åpne.
- Region-HQ må være et reelt senter; det er **ikke** bestemt at hver region må bygge alle hoved-HQ-moduler på nytt.

## 9. Informasjonshierarki og UX (låst)

**Ett gjenkjennelig hovedgrensesnitt** gjennom alle faser, der synlige moduler og detaljer skifter etter behov. Kartet er primærflaten.

| Nivå | Innhold |
| --- | --- |
| Alltid | Dag/klokke, kritisk ressursutholdenhet og trusler, krav om handling, kontekst for valgt fase |
| Kontekst ved kartvalg | Person, lag, L3/L2/L1, POI, bygg eller leder med relevante handlinger |
| Dypere visning | ZA-bok, forskning, hele lageret, logistikk, politikk, oppdragshistorikk og detaljrapporter |

- Nederste **handlingslinje** viser **uavklarte oppgaver og avvik**, ikke alle planlagte ordre. Full dagsplan er tilgjengelig separat.
- Spilleren må kunne se hva som krever beslutning **nå**, uten å grave i menyer.
- Fase 1 fremhever navngitte personer, ledige crew, sult og nære trusler. Fase 5 fremhever regional risiko, kritiske flaskehalser, politikk og større konflikter; rutineforhold aggregeres.
- Spilleren kan feste utvalgt informasjon/personer som fortsatt betyr noe for dem på tvers av fasene. Fast, begrenset skjermplass skal ikke fylles av 100 varsler.
- Desktop bruker kontekstpanel; mobil kan bruke bottom sheets. Grunnstruktur og knapp for å starte/avslutte dagen forblir gjenkjennelig.
- Nedskalering av informasjon er ikke tap av historikk; alle rapporter skal være tilgjengelige ved behov.
- Kartkamera endrer ikke posisjon automatisk for hvert event.

## 10. Vanskelighetsgrader, konsekvenser og spillglede (låst prinsipp)

Tre vanskelighetsgrader: **Story** (tilgivende, ekstra hjelp/hint og sjanser), **Survival** (standard; balansert og mulig å hente seg inn), **Realistic** (knappe ressurser, harde skader og logistiske følger, mer usikker etterretning). Ikke gjør «Realistic» til en langdryg HP-multiplikator; endre beslutningsrisiko og ressurspress innenfor felles simuleringsregler. Historiske eller fysiske «realistisk»-påstander er ikke en garanti for nøyaktig realisme.

**Hardcore** er en separat toggle som kan kombineres med alle tre. Én aktiv lagring/ingen omspilling av tidligere valg; hovedpersonens død avslutter gjennomspillingen. Uten Hardcore kan samfunnet fortsette under en etterfølger. Eksakte lagrings-/krasjbeskyttelsesregler, tilgjengelighet på eldre saves og antijuks er åpne implementasjonsdetaljer.

Tilfeldighet må være **varslet og lesbar**: spilleren kjenner risikoens natur, ikke nødvendigvis eksakt utfall. Dårlige valg kan koste liv, tid, HQ og territorium; Story kan tilby diegetisk hjelp fra personer/ressurser og tydeligere ZA-bok-råd. I Survival bør nederlag normalt kunne håndteres gjennom nye prioriteringer, ikke nødvendigvis koste et ti-timers gjennomspill uten forvarsel.

Forleng **ikke** fase 1 ved å repetere samme speid–rydd–loot–sikre-løkke flere hundre ganger. Veksle mellom meningsfullt utstyr, nye personer, HQ-fremskritt, lokale gåter, tydelige territoriegevinster, kortsiktige kriser og større oppdagelser.

## 11. Kvalitetskrav før implementering kan godtas

### 11.1 Motor og tilstand

- Samme seed, innledende tilstand, ordre og valgte hendelsesutfall gir **identisk resultat**, også ved pause/fortsett og skip.
- Ressurser, folk, zombier og utstyr kan ikke oppstå, forsvinne eller dobbeltallokeres uten en eksplisitt, loggført årsak.
- Hendelseskø og checkpoints overlever lagring/lasting uten dobbel løsning av en dag.
- Crew og utstyr følger faktisk oppdrags- og transporttilstand. Ikke tidsreise eller teleport mellom HQ-er.
- Vanlig spill kan fortsette under ny leder; Hardcore stopper på avatar-død.
- Vaktlag i områdeansvar vises ikke med falsk presis posisjon.
- Kartets aggregerte sonestatus avspeiler L3-utfall korrekt.

### 11.2 Produkt og UX

- Ny spiller kan forstå hva de skal gjøre i starten uten å lese en ekstern wiki.
- Ved hver dagsrapport kan spilleren se **hva som endret seg**, hva som haster og hvor detaljene finnes.
- Kritiske hendelser kan aldri omgås med skip; rutinehendelser skal ikke blokkere senfase-spill.
- Hovedskjermen viser ikke informasjon fra fremtidige kapitler eller uutforskede steder.
- Vellykket overtakelse, tap og geografisk bevegelse har forståelig feedback på riktig zoom.
- Flere strategier testes. Både forsiktig, utforskende og aggressivt spill bør kunne være meningsfulle uten ett klart dominert valg.
- Story gir hjelp ved langvarig krise; Realistic skaper merkbart mer risiko. Test faktisk forskjell med sammenlignbare seeds.

### 11.3 Særlig v0.3-regresjon

- Tidligere QA-observasjon: i en 30-dagers replay nådde noen starter fase 2 allerede dag 4 fra én sone med fire personer. Dette **skal ikke stå som korrekt v0.4-opplevelse**.
- Sjekk at `claim` ikke lar en sone overtas ved å stole på utdatert intel dersom levende zombier fortsatt hindrer overtakelse. Dette er et observert QA-risikopunkt som krever reproduksjon i aktuell kode før feilretting.
- Eksisterende 115 hendelser, 38 forskningsemner og seks unike steder må klassifiseres mot ny fasedesign, ikke ukritisk kastes eller antas ferdige.

## 12. Gjennomføring

Følg [29_V04_IMPLEMENTATION.md](29_V04_IMPLEMENTATION.md). Arbeid i vertikale, verifiserbare leveranser, ikke en total omskriving. Først: motorens dag/posisjon/ordre-kontrakt og et spillbart fase-1-utsnitt med relevant kartfeedback, rapport og utstyr. Så: ZA-bok/POI, fasegating og langsiktig delegasjon. Regional styring i fase 4–5 implementeres etter at grunnsystemene er stabile. Balansering er kontinuerlig, med en avsluttende tverrfase-runde.

Spør eier **samlet og kun når et åpent valg blokkerer arbeid**. Ikke gjør nye låste produktbeslutninger på vegne av eier.


## Eieravklaring 13.11.2026: funksjonell ferdigstillelse

Mikki ønsker hele v0.4 ferdigstilt; tallbalansering tas senere. D25 gjelder fortsatt faseprogresjon. D27 presiserer landemerker: nye funn krever eksplisitte crew-oppdrag gjennom oppdaget, undersøkt/sikret og operativt. Allerede aktive landemerker i gamle saves beholder effekt. D28 presiserer regional styring: kontrollert sone, navngitt lokal leder, fysisk lokallager, budsjett og forsvar/balanse/vekst. Rutiner delegeres; krig, diplomati og lover er spillervalg. Folk og forsyninger må transporteres. Se beslutningsloggen for eierens konkrete svar og hvilke tall som fortsatt er hypoteser.
