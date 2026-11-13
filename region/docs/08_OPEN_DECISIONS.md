# Beslutningslogg – åpne produktvalg og defaults

Oppdatert 31.10.2026. **B = eksplisitt besluttet**, **H = anbefalt arbeidshypotese**, **Å = reelt åpent**. En agent skal ikke presentere en H som en brukerbeslutning.

## 1. Besluttet

| ID | Beslutning |
| --- | --- |
| B01 | Én dag per tur gjennom alle fem faser. |
| B02 | Co-op/PvE prioriteres over PvP. To spillere i samme verden må begge bekrefte neste tur. |
| B03 | Ekte kart og strategiske POI-er. Hundvåg/Buøy er første verden; Rosenberg er interessant HQ-mål. |
| B04 | L1/L2/L3; L3 omtrent 100×100 m som *veiledning*, men variable naturlige/strategiske polygoner. |
| B05 | Nye strategiske zoom-/ordrenivåer låses opp med progresjon; detaljzoom forblir tilgjengelig. |
| B06 | Både opprinnelige og senere overlevende kan kvalifisere seg som crew-ledere. Alle har en enkel identitet, kapasitet og behov. |
| B07 | Makroordre for et helt L2-område; trygg clearing-rute eller direkte risikabel prioritet mot POI. |
| B08 | Zombier vandrer semi-tilfeldig etter logiske regler, støy og forbindelser; ingen magiske spawns inne i sikre soner. |
| B09 | Perimeter, barrierer, vakter, naturlig forsvar og destruerbare/reparerbare broer/tunneler betyr noe. |
| B10 | Zombier kan mutere, også negativt. Research avslører og reduserer effekten; nye typer kan oppstå. |
| B11 | Scavenging av mat er begrenset; produksjon, vann, strøm, bolig, infrastruktur og gear begrenser vekst. |
| B12 | Moral og diplomati med harde, langsiktige konsekvenser er viktig. |
| B13 | Personer og territorier kan mistes; reservert kunnskap og infrastruktur gir raskere gjenoppbygging i *samme run*. |
| B14 | Sluttmål: kur eller stabilt, varig kontrollert samfunn; raskeste seier måles i dager. |

## 2. Åpne valg som kan blokkere en milepæl

| ID | Valg | Anbefalt default (H) | Må avklares før |
| --- | --- | --- | --- |
| Å01 | Starter alltid alle på Buøy, eller valgfri GPS/valgt posisjon? | Kuratert start på Buøy i MVP, senere varianter | M1/M3 |
| Å02 | Eksakte L1/L2/L3-polygoner og minimumsstørrelse | Kuraterte, variable soner; ingen hard 100m-rute | M1 |
| Å03 | Rekkefølge i turn resolution | Frys én eksplisitt pipeline i M2 | M2 |
| Å04 | Hvor mye ordre-/arbeidskapasitet per dag? | Handlinger begrenset av tilgjengelige personer/crew, ikke kunstig action points i MVP | M3 |
| Å05 | Combat: tap, skade, ammo, etterretning, retreat | Enkel seedet risikomodell, synlige estimater og mulig retrett | M3 |
| Å06 | Hva kreves av et fungerende HQ og et forsvarbart L2? | Skill gradvis HQ-drift fra sammenhengende L2-kontroll og vurder konkrete terskler gjennom spilling | M3.1/M4 |
| Å07 | Hva skjer ved total kollaps? | Game over hvis ingen levedyktig fraksjon gjenstår; delvis tap kan gjenoppbygges | M3 |
| Å08 | Hva skjer ved Ready og disconnect? | Sesjonen venter; begge kan gjenoppta og se locked state | M5 |
| Å09 | To spilleres territorium/fraksjon: separat eller felles? | Separate samfunn som kan samarbeide og koble forsyning/research | M5 |
| Å10 | Hvordan løses kolliderende ordre og byttehandel? | Simultant med fast prioritets-/konfliktregel og ingen fordel av klikkrekkefølge | M5 |

## 3. Åpne valg som bør utsettes

- Eksakt antall zombievarianter, mutasjonstempo og tradeoffs.
- Hvor mange crew leaders og mannskap som er optimalt på dag 200.
- Om ammo/medisin må ha egne underkategorier og detaljerte craftingkjeder.
- Nøyaktige mat-, vann-, befolknings- og byggkostnader.
- Hvor mange dager en god run bør vare og hvilken vanskelighetskurve som passer.
- Den endelige seiersformelen for Cure og Stability og eventuelle score-tiebreakers.
- Politisk modell for NPC-fraksjoner, lovverk, ledere som deserterer, handelsavtaler.
- PvP, raid, konkurrerende seiersmål, rangering på felles seed, anti-cheat utenfor MVP.
- Egne native-apps, desktop-wrapper eller mobil-først UX.

Disse er åpne med hensikt. Først må den grunnleggende spilleløkka være morsom.

## Eieravklaring 31.10.2026 – etter M0

- **B15:** Alternativ A og foreslått modularkitektur er godkjent. Kuratert Buøy-start i første slice; valgfri GPS/andre startsteder utsettes. Å01 er dermed avklart for første slice.
- **B16:** 12–20 L3 er veiledning. Naturlige og strategiske grenser prioriteres. Minst to L2 skal demonstrere hierarki og senere makrooperasjoner.
- **B17:** Rosenberg er strategisk HQ-kandidat med logisk adkomst, men trenger ikke være spillbart i M1.
- **B18:** GeoJSON først, PostGIS senere. WorldDefinition og GameState holdes adskilt. Utvidelse skal bevare eksisterende ID-er og ikke endre kartet under lagrede spill.
- **Å02:** Konkret geografiforslag er levert i `10_M1_GEOGRAPHY_REVIEW.md` og kartvisningen. Grensene er fortsatt ugodkjente. Etter siste eieravklaring kan M2 starte på syntetiske soner parallelt med geografikurateringen.

Begrunnelse: Eieren godkjente M0 og presiserte geografiomfang, versjonsstabilitet og nytt godkjenningspunkt før videre bygging. Forslåtte gater, sonestørrelser, POI-funksjoner og porttilgang i kartutkastet er fortsatt H, ikke nye B-beslutninger.

## 4. Designprinsipp for avgjørelser

Når et åpent valg må tas: Beskriv to realistiske alternativer, anslå kompleksitet og konsekvens for spilleropplevelse, velg laveste kompleksitet som lar konseptet testes, og loggfør beslutningen. Ikke fyll hull med vilkårlige features.

Eksempel: 100×100m er ikke et krav. Hvis 150–250m kuraterte polygoner gir bedre spill og ytelse, vis et kartutkast og be om godkjenning før masseproduksjon.

## 5. Foreløpig risikoregister

| Risiko | Konsekvens | Tiltak |
| --- | --- | --- |
| For mange L3-soner | Klikkarbeid, treg rendering og simuleringskost | Variable soner, aggregering, L2-makroordre |
| Uendelig zombieimport | Uoppnåelig regional seier | Loggførte reservoarer, avtagende press og endelige terskler |
| For stor snøballeffekt | Ingen utfordring etter dag 50 | Befolkning, vedlikehold, forsyningslinjer og spesialisering; ikke kunstig straff |
| For mye RNG | Urettferdig tap etter lange runs | Varsler, intel, betingede hendelser, mulighet til å reagere |
| UI full av røde overlays | Lav kartlesbarhet | Subtile semantiske lag og kontekststyrte paneler |
| For mange karakterer/items | Mikrostyring i senere faser | Navngitte ledere, aggregert crew, utstyrstemplater |
| Co-op dobbelt turn-resolve | Divergerende verdensstatus | Serverlås, idempotens, transaksjon |
| Ekte kart blir automatisk dårlig spillekart | Rare grenser, ubalanserte startsteder | Kuraterte soner og strategiske POI-er |
| Kart-/POI-lisenser og fliskost | Publiseringshindring/utgift | Avklar provider, ODbL, attribusjon tidlig |


## Eieravklaring 31.10.2026 – etter M1-prototypen

- **B19:** M1 godkjennes som teknisk/geografisk prototype; sonegrensene låses ikke. 03 beholdes som foreløpig start, Rosenberg som framtidig HQ-kandidat.
- **B20:** 03, 05 og 07 skal vurderes i større målestokk. 07 deles bare ved et strategisk begrunnet skille. 05 beholdes foreløpig mens faktisk passasjefunksjon undersøkes.
- **B21:** Kartutsnitt mot land er umodellert territorium, ikke permanent barriere. Ekstern zombiebevegelse skal senere belaste modellerte, endelige kilder.
- **B22:** Upubliserte M1-utkast kan korrigeres uten migreringssystem. Uforanderlighet gjelder publiserte verdensversjoner med lagrede spill.
- **B23:** M2 kan starte på syntetiske sonedata mens geografien kurateres. Zombie-/kampregler skal ikke bindes til foreløpige polygoner.

**H, ikke B:** Nærbildet viser 07A østlig adkomst og 07B vestlig kai, delt langs Tømmerodden med kyst-/industriforlengelser. Alternativet er ikke lagt inn som nye soner. ID 05 beholdes; visningsnavnet presiseres til Clipperveien/verftsadkomst fordi det faktiske krysset ligger der. Ingen fysisk port eller direkte HQ-inngang er bekreftet ved 05. Se `11_GEOGRAPHY_DETAIL_REVIEW.md`.


## Eieravklaring etter geografigjennomgangen – 31.10.2026

**Overstyring 05.11.2026:** Spilleren skal velge en startadresse. Adressen plasseres i den operative sonen som inneholder koordinatet. B25 sitt faste startvalg i 03 er erstattet. Geografieditoren bruker vanlig sonelås og geografivalidering ved endring av soner og POI-er. Buøy ring, Skipsbyggergata og Bangarvågsgata er førende hovedskiller i neste Buøy-utkast. Mindre gater kan brukes til videre oppdeling.

- **B24:** M1 er godkjent. Ryddige, forståelige og strategiske soneformer prioriteres foran presise eiendomsgrenser, gjerder og porter. Omtrentlig kyst, vann og hovedveier beholdes; flere geografiske undersøkelser utsettes til etter spilling.
- **B25:** 03 beholdes som start. 05 kan innlemmes i nabosone mens veikrysset beholdes i grafen; 07 kan deles uten dokumentert fysisk sperre. Rosenberg forblir framtidig HQ-kandidat uten krav om eksakt portverifisering nå.
- **Utført:** 05 innlemmet i 03; krysset er `poi-junction-005` på forbindelsen til 06. Østlig 07 beholder sin ID; vestlig kai er ny 14. Tidligere 05-ID gjenbrukes ikke. Kartet er fortsatt redigerbart før publiserte spill.
- **M2:** Headless motor ferdigstilt med deterministisk døgnflyt, støy/migrasjon, barrierer, endelig ekstern populasjon, ressursreservasjon og rapport/replay. Tall er H, ikke spillbalanse. Neste milepæl er M3, ikke flere kartvurderinger.

## Eieravklaring 31.10.2026 – M3

- **B26:** M3 prioriterer fire forskjellige overlevende, enkel kamp med mulige skader/dødsfall, separate Scout/Clear/Claim/Secure, End Day med forklarende rapport og lokal lagring. Første spillevurdering er 10–15 dager; ingen nye geografiske undersøkelser eller bred testinfrastruktur.
- **B27:** Første base kan være liten og midlertidig. Rosenberg beholdes som framtidig strategisk HQ. Prototypen bruker et anneks ved Buøy idrettsanlegg som første mål, uten å kreve overtakelse av hele verftet.
- **H – M3-regler:** Éndagsoppdrag med retur til leiren, fire faste startutstyr, enkel helse/utmattelse/erfaring og konfigurerbare kostnader/kampverdier. Dette er spillbare utgangstall, ikke ferdig balanse. Én liten forsynings-/tillitshendelse demonstrerer ettervirkning.
- **M3-avgrensning:** Solo kjører samme rene motor lokalt. Dagkontroll, låst lagringsskriving der Web Locks støttes og revisjonskontroll beskytter lokal flyt; serverautoritet og atomisk tospiller-Ready/Resolve er fortsatt framtidig arbeid. Dette endrer ikke co-op-målet.
- **Lagring:** Inkluderer dagsplan og et separat verdensøyeblikksbilde. Geografiens kildeutkast kan fortsatt justeres uten å endre verdenen under en eksisterende gjennomspilling. Ingen automatisk migrering av eldre regelversjoner.
- **Fase 1 etter dag 15:** [Designrevisjonen](17_PHASE1_DESIGN_REVISION.md) overstyrer eldre beskrivelser der de spriker. Kravene til HQ er foreløpig balansert med 20 effektive arbeidstimer og maksimalt åtte per døgn. Kartutkastet gjennomgås før en ny verdensversjon tas i bruk.

## Soner bygges av celler (06.11.2026)

**Besluttet av eier:** Sonegrenser tegnes ikke lenger for hånd. Kartet deles i celler fra tomter, veier og kyst, og hver celle tilhører én L3-sone. `world-zones/project.json` er kilden, og sonegeometri avledes ved eksport. Begrunnelse: håndtegnede polygoner ga mye pirking og dårlige grenser, og modellen må kunne vokse til hele Stavanger. Se [soneeditoren](20_ZONE_EDITOR.md).

## Soneinnhold og steder i soneeditoren (10.11.2026)

**Besluttet av eier:** Soneeditoren får en egen Innhold-del for sonetype, potensial, strategiske ressurser og steder. Steder har rolle etter skillet i den låste designen: HQ, utpost, strategisk anlegg og ressurssted, med fritekst HQ-profil. Feltene er valgfrie i `Zone` og `Poi` og brukes ikke av spillreglene ennå. Lister over typer og ressurser ligger i editoren og kan justeres. Balanseverdier settes ikke her.

## Ressurslag, HQ-typer og målt soneinnhold (10.11.2026)

**Besluttet av eier:** Ressurser deles i fire lag: forbruksvarer, materialer, strategiske komponenter og kapasiteter. Soner har *funn*, som tømmes, og *produksjon*, som kan hentes igjen og igjen. HQ-typen bestemmer hva stedet har fra start og én unik mulighet. Ingen HQ-type får en svakhet bare for typens skyld; svakheten er de fordelene stedet mangler. Fordelene måles fra kartet: boliger, jord, åpen mark, skog, kyst og vann rundt sonen. Strøm, samband, vei og vann er nett på L2-nivå som åpnes av strategiske anlegg. Katalogen ligger i `packages/world-data/data/content-catalog.json` og leses av både editoren og spillet. Avlingstall er hypoteser. Se [21_RESSURSER_OG_HQ.md](21_RESSURSER_OG_HQ.md).

## Hele Stavanger-regionen og L1 etter bydeler (10.11.2026)

**Besluttet av eier:** Kartet utvides til Randaberg, Sola med Tananger, byområdet i Sandnes til og med Hommersåk, Rennesøy, Finnøy og Talgje. Nye områder klippes langs kommune- og bydelsgrenser fra OpenStreetMap. L1 følger Stavangers bydeler og nabokommunene. En bydel eller kommune med mer enn 75 L3-soner deles i L1 på rundt 55 L3-soner. L2 holdes på 3–9 L3-soner. `region-001` beholdes som Hundvåg og Byøyene. Verktøy: `zoneexpand.py` og `zonetool.py regroup`.

## AR5, overtakelse, bruer og tunneler (10.11.2026)

**Gjennomført etter eiers ønske:**
- Jord, beite, skog, myr og fjell måles fra NIBIOs AR5. Husrom er ingen grense, fordi det finnes langt flere hus enn overlevende.
- Overtakelse anslås ut fra bygg, tidligere beboere og areal. Grensen mot land gir behovet for vakter.
- 32 navngitte bruer og tunneler er strategiske anlegg som kan holdes, sperres eller sprenges. Sprengstoff er en ny sjelden komponent.
- Felles oppstart med `Stavanger Z.cmd`.

**Åpent:** Om spillets fase 1 skal flyttes til editorverdenen. Se [22_SPILL_MED_SONEDATA.md](22_SPILL_MED_SONEDATA.md).

## Regionspillet blir hovedspillet (11.11.2026)

**Besluttet av eier:** Spillet flyttes til soneeditorens verden. Forsiden er nå regionspillet `region-0.1`, med L1–L3, steder, bruer og tunneler. Det har flere startområder, zombier som vandrer mot lyd, ukentlige hendelser, oppgraderinger av L3, L2 og HQ, og handel med NPC-grupper. Buøy-prototypen og lagringene dens ligger på `/fase1`. Regionspillet har egen lagringsnøkkel. Se [23_REGIONSPILL.md](23_REGIONSPILL.md).
