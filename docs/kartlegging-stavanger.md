# Kartlegging av Stavanger – forslag til områder etter Buøy

**Status: alt i dette dokumentet er [Åpent], unntatt de tre vedtakene i kapittel 0.1.** Det er et grunnlag for diskusjon, ikke vedtak. Ingenting her skal bygges før eieren har sagt ja, og det som blir vedtatt, flyttes inn i `docs/spilldesign.md`, regionens `places.ts` og atlaset (`src/regions/stavanger/atlas/`).

Merkene brukt i dokumentet:

- **[Åpent]**: et forslag eller spørsmål som eieren må ta stilling til.
- **[Sjekk]**: et faktum om det ekte stedet som ikke er bekreftet. Det må sjekkes før navnet eller beskrivelsen brukes.
- **[Problem]**: noe jeg ser kan gå galt med reglene slik de står i dag.

Kildene er OSM-dumpen i `data/osm.json` (byøyene, sentrum, Storhaug, Våland, Eiganes, Bjergsted og Tasta), regelheftet for stedsnavn (`docs/stedsnavn.md` på `regionpakke`), `src/regions/stavanger/places.ts` (Buøy), spilldesignet på `design-okonomi` og noen få nettsøk. Madla, Hillevåg, Hinna, Ullandhaug, Forus og Sandnes ligger **utenfor** dumpen (bbox 58,955–59,010 N, 5,69–5,81 Ø). Stedene der er derfor tatt fra kunnskap og nettsøk, og de fleste er merket [Sjekk].

Koordinatene (bredde, lengde) er hentet fra OSM-dumpen. De er tenkt som utgangspunkt for frøpunkter i `map.config.json`, ikke som ferdige verdier.

---

## 0. Kortversjonen

1. **Byøyene henger sammen i to kjeder, ikke som én ring.** Mot vest går veien fra Buøy over Pyntesund bru til Engøy, så over Engøy bru til Sølyst og Grasholmen, og Bybrua går videre til sentrum. Mot nord og øst går den fra Buøy via Nordkrysset til Hundvåg, så over Bjørnøybroen til Bjørnøy, over Skadesund bru til Roaldsøy og over Ormøybrua til Ormøy og Steinsøy. Ormøy og Steinsøy er en blindvei på land, men ligger bare noen hundre meter fra Buøy og Engøy over sjøen. Det gjør dem perfekte for mutasjonene Svømmere og Dykkere.
2. **De små øyene er for små til 6–8 sektorer hver.** Engøy, Sølyst og Grasholmen har til sammen rundt 400 boliger. Bjørnøy, Roaldsøy, Ormøy og Steinsøy er nesten bare eneboliger og naust. Derfor blir det to samleområder, **Vestøyene** og **Østøyene**, i stedet for sju miniområder (vedtatt, kapittel 0.1).
3. **Fasene kan følge de ekte bydelsgrensene.** Stavangers bydel Hundvåg er nettopp byøyene. Fase 4 «Bydel» kan da bety at hele den ekte bydelen er tatt, og det gir en naturlig bydelsbonus. Etterpå kommer Storhaug, Eiganes og Våland, Madla, Hillevåg og Hinna.
4. **HQ-kandidater og nøkkelsteder finnes**, men de er ujevnt fordelt. Sentrum har åtte apotek, mens Østøyene ikke har noe som helst. Regelen om høyst ett per område gjør at mange områder får null, og det synes jeg er riktig.
5. **SUS flyttet til Ullandhaug 16. november 2025.** Det gamle SUS på Våland har fortsatt psykiatri og poliklinikker. Spillet må velge hvilket sykehus som er HQ-kandidaten, eller om begge er det.
6. **Jeg fant ingen bekreftet jakt- eller våpenbutikk** på Forus eller i Sandnes. Nøkkelstedet «Jaktbutikken» trenger et ekte sted, ellers må det bli generisk.
7. **Tett mot spredt:** Jeg anbefaler at tett bebyggelse gir *forbruksvarer raskt, men som tar slutt*, og at spredt bebyggelse gir *produksjon som varer* (jorder, skog, fisk). I tillegg bør en sikkerhetsgaranti sørge for at det alltid finnes et område med trygg trussel innen rekkevidde. Detaljer står i kapittel 3.

### 0.1 Vedtatt av eieren

1. **De små øyene slås sammen** til to områder: **Vestøyene** (Engøy, Sølyst og Grasholmen) og **Østøyene** (Bjørnøy, Roaldsøy, Ormøy og Steinsøy).
2. **Trussel er relativ til fasen.** Sektorene har trussel 1–5 *innenfor sitt område*. Fasen ganger opp via `mods(s)` i fasetabellen, så en 3 i fase 5 er farligere enn en 3 i fase 2. Tallene i dette dokumentet skal leses slik.
3. **Avstand telles i områder**, i ringer rundt Buøy: ring 0 Buøy; ring 1 Vestøyene, Hundvåg og Østøyene; ring 2 Sentrum, Storhaug, Våland og Eiganes/Bjergsted; ring 3 Madla, Hillevåg, Ullandhaug/Hinna og Forus/Lura.

Vedtakene er skrevet inn i atlaset: skjemaet i `src/regions/stavanger/atlas/atlas.ts` har `ring` og relativ `threat`, og `vestoyene.json` er det første kurerte området. Se `src/regions/stavanger/atlas/README.md` for hvordan resten kureres.

---

## 1. Områdene

### Rekkefølge og faser [Åpent]

| # | Område | Består av | Fase | Innganger fra forrige område |
|---|---|---|---|---|
| 0 | **Buøy** | Buøy (ferdig kartlagt) | 1 | – |
| 1 | **Vestøyene** | Engøy, Sølyst, Grasholmen | 2 (bufferen mot Bybrua) | Pyntesund bru |
| 2 | **Hundvåg** | Hundvåg (Austbø, Skeie, Lunde, Husabø) | 3 | Nordkrysset, Hundvågtunnelen (indirekte) |
| 3 | **Østøyene** | Bjørnøy, Roaldsøy, Ormøy, Steinsøy | 3 | Bjørnøybroen |
| 4 | **Sentrum** | Vågen, Torget, Holmen, Straen, Lagård | 4 | Bybrua |
| 5 | **Storhaug** | Østre bydel, Lervig, Kjelvene, Varden, Badedammen | 4 | Bybrua (Bybrutunnelen), Haugesundsgata |
| 6 | **Våland** | Våland, Paradis, Kannik | 4 | Bergelandstunnelen, Hundvågtunnelen–E39 |
| 7 | **Eiganes og Bjergsted** | Eiganes, Bjergsted, Kampen, Mosvatnet | 4 | Sentrum via Løkkeveien |
| 8 | **Madla** | Madla, Revheim, Hafrsfjord, Kvernevik | 5 | Madlaveien |
| 9 | **Hillevåg** | Hillevåg, Mariero, Kvaleberg | 5 | Strømsbrua, Storhaugtunnelen, E39 |
| 10 | **Ullandhaug og Hinna** | Ullandhaug, Jåttå, Gausel | 5 | E39, Jærbanen |
| 11 | **Forus og Lura** | Forus, Lura (Sandnes) | 5 | E39, Forusbeen |
| – | **Sandnes** | sentrum av Sandnes | 5, som fraksjon | – |
| – | Tasta, Randaberg, Sola, Vassøy, Langøy | | utenfor eller i reserve | |

**Hvorfor fase 2 er Vestøyene og ikke Hundvåg:** I fase 2 er verbet *Flytte*. Du tar et HQ og får transport. Rosenberg ligger på Buøy, men Vestøyene er det eneste stedet du *må* gjennom for å komme til byen. Fase 2 kan derfor handle om å ta Rosenberg og sikre Bybrua-landingen. Hundvåg er stort nok til å være hovedmålet i fase 3. `ZONES.hundvag` har allerede `phase: 3`, så det stemmer med dagens data.

**[Åpent]** Er fase 2 bare Buøy pluss Rosenberg, eller Buøy, Rosenberg og Vestøyene? Spilldesignet sier ingenting om hvor stort fase 2-kartet er.

**Vedtatt (0.1):** Avstand telles i **områder**, ikke sektorer eller meter. Madla og Forus ligger 5–8 km fra Buøy, men bare tre ringer unna (se kapittel 3, modell C).

**Løst for atlaset:** `tools/fetch_atlas.sh` henter POI-er (ikke bygninger) for 58,84–59,02 N og 5,55–5,82 Ø med én spørring til `data/osm-atlas.json` (ca. 2,5 MB), og `tools/build_atlas.py` trekker ut kandidater per område. Kartgeometri for et større spillkart er fortsatt åpent.

### Hvordan trussel er satt

Buøy har trussel 1–2, og Rosenberg har 5. For senere områder har jeg brukt en **grunntrussel per område**, og deretter ±1 per sektor etter hvor tett den er bebygd. Nøkkelsteder og HQ-kandidater er alltid 4–5 (regelheftet, kapittel 3).

| Område | Grunntrussel |
|---|---|
| Vestøyene | 2 |
| Hundvåg, Østøyene | 2 |
| Sentrum, Storhaug | 3 |
| Våland, Eiganes og Bjergsted | 3 |
| Madla, Hillevåg | 3–4 |
| Ullandhaug, Hinna, Forus | 4 |

**Vedtatt (0.1): trusselen er relativ til fasen.** Tallene 1–5 gjelder innenfor området, og fasetabellens `mods(s)` ganger opp. Tabellen over og sektortabellene under ble skrevet før vedtaket, med fast skala. Når et område kureres i atlaset, skal tallene spres over hele 1–5 innenfor området, så det finnes trygge og farlige steder i hver fase.

---

### 1.0 Buøy (fase 1, ferdig)

Står i `places.ts`. Sju spillbare sektorer pluss Rosenberg Verft som HQ-kandidat. Portene er Nordporten (mot Hundvåg), Bybrusperringen (mot Engøy og Bybrua) og Rosenberg-gjerdet. Ingen nøkkelsted.

Merk at munningen til **Hundvågtunnelen** ligger *på Buøy* (ca. 58,987, 5,733, ved Nordkrysset og Rosenberg). Tunnelen går under Byfjorden til E39 og Eiganestunnelen ved Mosvatnet. Det er den raskeste veien fra byøyene til Våland, og en åpenbar port i fase 4. **[Åpent]** Skal tunnelen være stengt (vann, mørke, ras) fram til en quest åpner den? Det er en fin «vendepunkt»-kandidat (kapittel 8b i spilldesignet).

---

### 1.1 Vestøyene: Engøy, Sølyst og Grasholmen (fase 2)

**Hva det er:** Tre små øyer på rad mellom Buøy og Bybrua. Engøy har eneboliger, naust og industri på Klasaskjeret. Sølyst og Grasholmen har blokker (henholdsvis rundt 36 og 50 i OSM) og et lite gartneri. All trafikk fra sentrum til byøyene går over Bybrua og gjennom Vestøyene.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Brua** | Stavanger bybru, landingen på Grasholmen og Sølyst (58,978, 5,748) | sentrum og Storhaug |
| **Pyntesundbrua** (eller «Brua mot Buøy») | Pyntesund bru (58,983, 5,739) | Buøy, egen side |
| Sjøen | Vågen og Byfjorden | først med Svømmere |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `klasaskjeret` | Industriområdet | Klasaskjeret | industri | 2 | skrap, metall i fase 2, litt drivstoff |
| `engoy_bolig` | Boligfeltet | Engøy | bolig | 2 | litt av alt, kjellere, naboer å rekruttere |
| `engoyholmen` | Båthavna | Engøyholmen og naustene | kai | 2 | fisk, båter (transport i fase 2), tau og presenning |
| `solyst_blokk` | Blokkene nord | Sølyst | bolig | 3 | mange folk, mange zombier, mat i leilighetene |
| `grasholmen` | Blokkene sør | Grasholmen | bolig | 3 | som over, pluss utsikt over Vågen (speiding) |
| `solyst_park` | Parken | Sølyst idrettsplass og gartneriet | natur | 1 | litt mat (gartneriet), tre, åpent og oversiktlig |
| `bybrua` | Brufestet | Bybrua | industri | 3 | biler med drivstoff i køen, porten mot byen |

**Nøkkelsted:** ingen. **HQ-kandidat:** ingen.

**Kurert:** `src/regions/stavanger/atlas/vestoyene.json`. OSM viser bare et par blokker på Sølyst, men rundt femti på Grasholmen. Atlaset har derfor én «Blokkene» (Grasholmen), «Parken» på Sølyst (gartneriet og idrettsplassen), og Engøy er delt i «Boligfeltet» (eneboliger) og «Rekkehusene» (Engøy vest). Portene er «Brua mot byen» (Bybrua) og «Brua mot øya» (Pyntesund bru).

**Begrunnelse:** Vestøyene er en flaskehals, ikke et rikt område. Det spennende er porten: alt fra byen kommer over Bybrua. Den gir fase 2 en tydelig oppgave («hold brua») uten et nytt HQ.

**[Sjekk]** Engøyholmen kystkultursenter ligger på en holme ved Engøy. Er det greit å bruke det som «Båthavna», eller er naustene på selve Engøy bedre?

**[Problem]** «Blokkene nord» og «Blokkene sør» ligger på to ulike øyer. Regelheftet sier at retningen gjelder sett fra midten av området, og det fungerer, men spilleren tenker trolig «Sølyst» og «Grasholmen». Kanskje er kjennetegn bedre: «Blokkene ved brua» (Grasholmen) og «Blokkene ved banen» (Sølyst).

---

### 1.2 Hundvåg (fase 3)

**Hva det er:** Den store øya nord for Buøy, med rundt 1 600 eneboliger og tomannsboliger, 110 rekkehus og noen få blokker. Senteret ligger rett nord for Nordkrysset (Meny, Rema 1000, Apotek 1, Boots, Jernia, Sport 1, Match og Nille). Nord på øya (Lunde og Skeie) er det **mange jorder og gårdstun**, flere enn på noen annen byøy. Trollskogen ligger vest på øya, med tre bunkere i OSM. Under Lunde går **Ryfylketunnelen** (14 km) til Solbakk i Strand.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Sørporten** | Hundvåg ring sør, fra Nordkrysset | Buøy (din egen side, er Nordporten sett fra Buøy) |
| **Tunnelen** | Ryfylketunnelen, munningen ved Lunde (59,005, 5,740) | Ryfylke. Alt fra Strand og Hjelmeland. |
| **Bjørnøybrua** | Bjørnøybroen (58,996, 5,751) | Østøyene |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `hundvag_apotek` | Apoteket | Apotek 1 Hundvåg, Hundvåg senter | nøkkelsted (butikk) | 4 | mye medisin, sjeldne medisinkort. Jernia og Sport 1 ligger vegg i vegg (beskrivelse og funn) |
| `austbo` | Matbutikken | Extra Hundvåg, Austbø | butikk | 3 | mat, vann. Circle K Automat ved siden av |
| `esso_hundvag` | Bensinstasjonen | Esso Hundvåg | industri | 2 | drivstoff, snacks |
| `hundvag_skole` | Skolen | Hundvåg skole og Hundvåghallen | offentlig | 3 | mat (kantine), plass til mange, idrettsutstyr |
| `oyane` | Sykehjemmet | Øyane sykehjem og Øyane legesenter | offentlig | 3 | medisin, langsomme zombier, men mange |
| `skeie` | Boligfeltet | Skeie og Husabø | bolig | 2 | naboer, mange kjellere og garasjer |
| `lunde` | Jordene | Lunde og gårdene nord på øya | natur | 1 | lite i starten, matproduksjon fra fase 2–3 |
| `trollskogen` | Skogen | Trollskogen | natur | 2 | tre, vilt, skjul. Få zombier, men de er vanskelige å se |

**Nøkkelsted: Apoteket (Apotek 1 Hundvåg).** Det er det mest åpenbare nøkkelstedet på byøyene, og det er allerede nevnt i `ZONE_INFO.hundvag`. Boots Hundvåg ligger i samme senter. Jeg foreslår at det bare nevnes i beskrivelsen («Boots var tømt først. Folk stoler på Apotek 1.»), slik at det ikke blir to apotek.

**HQ-kandidat: Fortet? [Åpent]** OSM har tre bunkere i Trollskogen (58,998, 5,711–5,715). **[Sjekk]** hva de er. Er det rester av et tysk kystbatteri fra krigen, kan «Fortet i Trollskogen» bli HQ-kandidaten: lite plass, men tykke vegger. Hvis ikke, har Hundvåg ingen HQ-kandidat. Det er greit, fordi Rosenberg ligger rett ved.

**[Problem]** Apotek 1, Jernia, Sport 1, Meny og Esso ligger innenfor rundt 200 meter. Med Voronoi-deling blir ikke det tre sektorer. Enten blir «Senteret» én sektor (og da er nøkkelstedet og matbutikken samme sted), eller så må matbutikken flyttes til Extra på Austbø, slik jeg har gjort. **[Åpent]** Kan et nøkkelsted være et *funn inne i* en sektor i stedet for en egen sektor? Det ville løst mange slike tilfeller, særlig i sentrum.

**[Åpent]** Kiwi Øysenteret ved Skeie og Kiwi Hundvåg ved Lunde er to matbutikker til. Er Hundvåg for rik på mat? Jordene gjør det enda rikere. Jeg tror det er riktig: Hundvåg skal være «matfatet» på byøyene, men da må trusselen ved senteret være høy.

---

### 1.3 Østøyene: Bjørnøy, Roaldsøy, Ormøy og Steinsøy (fase 3)

**Hva det er:** En kjede av små, stille øyer med rundt 500 eneboliger og 140 naust. Det finnes nesten ingen butikker, ingen industri og én skole (Roaldsøy skole). Fra Steinsøy ferjekai går ferja til Vassøy, Langøy og Lindøy. Ormøy og Steinsøy er en blindvei på land, men ligger bare 300–500 meter fra Buøy og Engøy over sjøen.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Bjørnøybrua** | Bjørnøybroen | Hundvåg |
| **Ferjekaia** | Steinsøy ferjekai (58,987, 5,753) | Vassøy, Langøy og Ryfylke, med båt |
| Sjøen | Sundet mot Buøy og Engøy | Svømmere og Dykkere |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `bjornoy` | Boligfeltet | Bjørnøy | bolig | 1 | naboer, rolige hager |
| `skadesund` | Brufestet | Skadesund bru | industri | 1 | sperring, ellers lite |
| `roaldsoy_skole` | Skolen | Roaldsøy skole | offentlig | 2 | mat, plass til folk |
| `roaldsoy_naust` | Båthavna | naustene på Roaldsøy | kai | 2 | båter, fisk, drivstoff til påhengsmotorer |
| `ormoy` | Villaene | Ormøy | bolig | 2 | få folk, mye per hus, hager med frukt |
| `steinsoy` | Ferjekaia | Steinsøy ferjekai | kai | 3 | ferje og transport i fase 3, porten mot Ryfylke |
| `lundsvagen` | Svaberget | Lundsvågen og naturskolen | natur | 1 | fisk, vann med filter, lite skjul |

**Nøkkelsted:** ingen. **HQ-kandidat:** ingen på selve øyene.

**Begrunnelse:** Østøyene er motsatsen til sentrum. Det er lite å finne, men det er trygt, det er fisk og båter, og folk bor spredt. Her kan du rekruttere uten å slåss mye. Det er et godt svar på eierens spørsmål om tett og spredt (kapittel 3).

**[Åpent]** **Vassøy branndepot** (Rogaland brann og redning) ligger på Vassøy, én ferjetur unna. Det er sannsynligvis en garasje med en tilhenger. Skal det være en vits-HQ («Brannstasjonen» på Vassøy, som viser seg å være en garasje), eller et ordentlig HQ for et senere øyrike? Vassøy har også en skole, Joker og egne kaier.

**[Åpent]** Ormøy ligger 300 meter fra Buøy over vannet. Får zombiene Svømmere i fase 2, blir Østøyene en ny inngang til *Buøy*. Skal kartet tegne en sjøport mellom dem fra starten, eller skal den først dukke opp med mutasjonen?

---

### 1.4 Sentrum (fase 4)

**Hva det er:** Vågen, Torget, Domkirken, Breiavatnet, Holmen og Straen. Det er tettest i hele byen, med åtte apotek i OSM, kjøpesentre (Arkaden, Torgterrassen, Herbarium, Galleri4, Breitorget), Fiskepirterminalen og hurtigbåtene, Sølvberget og rådhuset. Politihuset ligger på Lagård, i sørkanten.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Brua** | Bybrua, fra Vestøyene | byøyene |
| **Tunnelen** | Bergelandstunnelen (58,966–58,970, 5,735–5,743) | Storhaug og Våland |
| **Vågen** | Skagenkaien og Strandkaien | sjøen, cruiseskip og Svømmere |
| **Sørporten** | Lagård, Kannik | Våland og Eiganes |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `vagen` | Kaia | Skagenkaien og Strandkaien | kai | 4 | båter, fisk, cruiseskipet (encounter) |
| `fiskepiren` | Ferjekaia | Fiskepirterminalen | kai | 3 | hurtigbåter (transport til Ryfylke), drivstoff |
| `torget` | Matbutikken | Fisketorget og Torget | butikk | 4 | mat, vann. Fisketorget er en vits i seg selv etter tre dager uten strøm. |
| `kirkegata` | Klesbutikken | Arkaden, Torgterrassen og Kirkegata | butikk | 4 | beskyttelse (jakker, støvler), litt sportsutstyr fra Intersport |
| `solvberget` | Biblioteket | Sølvberget | offentlig | 3 | kart, bøker (forskning), tech fra fase 2 |
| `domkirken` | Kirka | Stavanger domkirke | offentlig | 4 | mange som søkte tilflukt, overlevende eller ikke |
| `mediegarden` | Apoteket | Apotek 1 Mediegården | nøkkelsted | 5 | mye medisin. Clas Ohlson ligger i samme bygg. |
| `politihuset` | Politistasjonen (HQ-kandidat) | Stavanger politistasjon, Lagård | offentlig, låst | 5 | se kapittel 2 |

**Nøkkelsted: Apoteket (Apotek 1 Mediegården).** De sju andre apotekene nevnes som plyndret i beskrivelsen: «Vitusapotek Svanen er tømt. Noen har skrevet reseptnummeret sitt på døra.»

**HQ-kandidat: Politistasjonen (Lagård).** Se kapittel 2.

**[Problem]** Regelheftet sier at Kjøpesenteret er en HQ-kandidat. Sentrum har fem kjøpesentre. Med regelen om én HQ per område må de bli «Klesbutikken». Det er riktig for balansen, men det kan føles rart. Jeg har slått dem sammen til én handlegate.

**[Åpent]** Sentrum er så tett at 8 sektorer bare blir et utvalg. Kanskje bør sentrum være to områder: «Vågen» (kaiene, Torget, Holmen og Straen) og «Sentrum sør» (Breiavatnet, Kannik og Lagård).

---

### 1.5 Storhaug (fase 4)

**Hva det er:** Østre bydel. Gamle trehus i Kjelvene og Jammerdalen, nye blokker på Lervig brygge, Badedammen, Storhaugmarka og Varmen brannstasjon. Mest hus av alle områdene i dumpen: rundt 1 740 hus, 340 blokker og 180 rekkehus.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Brutunnelen** | Bybrutunnelen og Haugesundsgata (58,968, 5,748) | Bybrua og byøyene |
| **Tunnelen** | Storhaugtunnelen (sørenden ved 58,956, 5,748) | Hillevåg |
| **Strømsbrua** | Strømsbrua (58,955, 5,744) | Hillevåg og Paradis |
| Sjøen | Lervigkaia | Svømmere |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `stoperigarden` | Matbutikken | Extra Støperigården | butikk | 3 | mat, vann |
| `haugesundsgata` | Bensinstasjonen | Circle K Haugesundsgaten | industri | 3 | drivstoff, porten mot Bybrua |
| `lervig_brygge` | Blokkene | Lervig brygge | bolig | 4 | mange folk, heis, parkeringskjeller |
| `kjelvene` | Rekkehusene | Kjelvene og Jammerdalen | bolig | 3 | tett, mange naboer, få kjellere, trehus (brannfare) |
| `storhaug_skole` | Skolen | Storhaug skole og Lervig skole | offentlig | 3 | mat, plass |
| `storhaug_hall` | Idrettshallen | Storhaug idrettshall | offentlig | 3 | plass til mange, idrettsutstyr |
| `storhaugmarka` | Parken | Storhaugmarka og Kyviksmarka | natur | 2 | litt av alt, åpent, utsikt |
| `varmen` | Brannstasjonen (HQ-kandidat) | Varmen brannstasjon, Lervig | offentlig, låst | 5 | se kapittel 2 |

**Nøkkelsted:** ingen, med vilje. Apotek 1 Østre bydel og Støperigården apotek finnes, men sentrum er rett ved og har allerede et apotek. **[Åpent]** Skal regelen «høyst ett nøkkelsted» gjelde per område eller per avstandsring? Med to apotek 800 meter fra hverandre blir medisin billig i fase 4.

**HQ-kandidat: Brannstasjonen (Varmen).** Se kapittel 2.

**[Sjekk]** Varmen brannstasjon står i OSM ved 58,966, 5,760. Statsforvalteren ga løyve i 2021 til en ny brannstasjon i Lervig. Er det samme bygg, og er den i drift nå?

**[Åpent]** Trehusene i Storhaug er Europas største samling av trehus. Det kunne gitt en egen regel om brannfare: brannvåpen (mutasjonen *Flokk*, motspill *brann*) er effektive her, men risikoen er at hele bydelen tar fyr. Det er stats med konsekvenser, men det er en ny regel.

---

### 1.6 Våland (fase 4)

**Hva det er:** Vålandshaugen og Vålandsskogen, villaer, Paradis med Extra, Vitusapotek og Aleris sykehus, og det gamle SUS. Hetland gravlund og St. Johannes kirke ligger mot Storhaug.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Tunnelmunningen** | Hundvågtunnelen og Eiganestunnelen ved E39 (58,960, 5,727) | byøyene under fjorden, Madla og Forus |
| **Jernbanen** | Jærbanen ved Paradis stasjon | Hillevåg og Sandnes |
| **Strømsbrua** | Strømsbrua | Storhaug |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `valandsskogen` | Skogen | Vålandsskogen | natur | 2 | tre, skjul, få zombier |
| `paradis_mat` | Matbutikken | Extra Paradis | butikk | 3 | mat, vann |
| `paradis_apotek` | Apoteket | Vitusapotek Paradis og Aleris sykehus | nøkkelsted | 4 | medisin. Aleris gir sjeldne kort. |
| `valand_villa` | Villaene | Våland | bolig | 2 | få folk, mye per hus |
| `kannik` | Skolen | Kannik skole | offentlig | 3 | mat, plass |
| `st_johannes` | Kirka | St. Johannes kirke og Hetland gravlund | offentlig | 3 | tilfluktsrom, overlevende |
| `valand_tunnel` | Tunnelmunningen | E39 ved Mosvatnet | industri | 4 | biler, drivstoff, porten |
| `sus_valand` | Sykehuset (HQ-kandidat) | Stavanger universitetssjukehus, Våland | offentlig, låst | 5 | se kapittel 2 |

**[Åpent]** Paradis har *både* et apotek og et privatsykehus (Aleris). Er Aleris en del av nøkkelstedet, eller en egen offentlig sektor («Legesenteret»)?

---

### 1.7 Eiganes og Bjergsted (fase 4)

**Hva det er:** Byens fineste villastrøk (Eiganes), herregårdene Ledaal og Breidablikk, Mosvatnet, Konserthuset og Katedralskolen på Bjergsted, Kampen og Solvang sykehjem.

**Innganger:**

| Port | Ekte sted | Sperrer mot |
|---|---|---|
| **Vestporten** | Madlaveien ved Uno-X (58,962, 5,715) | Madla |
| **Nordporten** | Randabergveien ved Tasta (58,978, 5,702) | Tasta og Randaberg |
| Mot sentrum | Løkkeveien og Bjergsted | sentrum |

| Id (forslag) | Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|---|
| `eiganes_villa` | Villaene på høyden | Eiganes, Ledaal og Breidablikk | bolig | 3 | mye per hus, vinkjellere (mange kjellere), få folk |
| `mosvatnet` | Parken | Mosvatnet | natur | 2 | vann, fugler (mat), åpent |
| `bjergsted_mat` | Matbutikken | Extra og Rema 1000 Bjergsted | butikk | 3 | mat, vann |
| `bjergsted_apotek` | Apoteket | Apotek 1 Bjergsted | nøkkelsted | 4 | medisin |
| `katedralskolen` | Skolen | Stavanger katedralskole, Bjergsted | offentlig | 3 | mat, plass, lab (forskning?) |
| `konserthuset` | Konserthuset | Stavanger konserthus | offentlig | 3 | strøm (nødstrøm), plass. «Grieg på loop» står allerede i `ZONE_INFO`. |
| `solvang` | Sykehjemmet | Solvang | offentlig | 3 | medisin, mange langsomme zombier |
| `svilandsgata` | Bensinstasjonen | Tanken Svilandsgate | industri | 2 | drivstoff |

**HQ-kandidat:** ingen på listen. **[Åpent]** Konserthuset er stort, nytt og har nødstrøm. Skal det bli en ny HQ-type («Kulturhuset»), eller bare en vanlig offentlig sektor? Regelheftet har ikke Konserthuset som type. Jeg har brukt navnet, men det bryter regel 1 litt.

**[Problem]** Både Våland og Eiganes har et apotek som nøkkelsted, og sentrum har ett til. Det blir tre apotek innen 1,5 km i fase 4. Kanskje bør bare annenhvert område ha et nøkkelsted.

---

### 1.8 Madla (fase 5)

Utenfor OSM-dumpen. Fra kunnskap og ett nettsøk.

**Hva det er:** Madlaleiren (KNM Harald Haarfagre), Forsvarets største rekruttskole, med rundt 211 ansatte (stillingsannonse fra 2026). Hafrsfjord, Møllebukta, Sverd i fjell, Revheim og Madlamark. Jorder mot Sunde og Revheim. Kvernevik har blokker og en brannstasjon (nevnt i en stillingsannonse fra 2019).

**Innganger:** Madlaveien (fra Eiganes), Hafrsfjord bru (mot Sola) **[Sjekk]** og Kvernevikveien (mot Randaberg).

| Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|
| Matbutikken | Amfi Madla **[Sjekk navnet, kan ha blitt «Madla senter»]** | butikk | 4 | mat, vann |
| Jordene | Revheim og Sunde | natur | 2 | matproduksjon |
| Stranda | Møllebukta | natur | 2 | fisk, vann |
| Boligfeltet | Madlamark | bolig | 3 | naboer, kjellere |
| Blokkene | Kvernevik **[Sjekk]** | bolig | 4 | mange folk |
| Båthavna | Hafrsfjord og Sunde | kai | 3 | båter |
| Skolen | Madlamark skole **[Sjekk]** | offentlig | 3 | mat, plass |
| **Fortet (HQ-kandidat)** | Madlaleiren, KNM Harald Haarfagre | offentlig, låst | 5 | se kapittel 2 |

**[Åpent]** Kvernevik brannstasjon er en HQ-kandidat til, men Madla har allerede Fortet. Den kan bli en vanlig offentlig sektor eller utelates.

---

### 1.9 Hillevåg (fase 5)

Utenfor dumpen. Mest **[Sjekk]**.

**Hva det er:** Industri og næring langs Gandsfjorden, bilforhandlere langs Hillevågsveien, Mariero og Kvaleberg, Hillevåg torg og Jærbanen.

**Innganger:** Strømsbrua og Storhaugtunnelen (fra Storhaug og Paradis), E39 ved Mariero, Jærbanen.

| Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|
| Industriområdet | Hillevåg, mot Gandsfjorden | industri | 3 | skrap, metall |
| Bilforhandleren | Hillevågsveien **[Sjekk hvilke som finnes nå]** | industri | 3 | metall, drivstoff, kjøretøydeler |
| Byggvarehuset | **[Sjekk: Maxbo eller Byggmakker i Hillevåg?]** | butikk | 3 | tre, skrap, verktøy |
| Kaia | Hillevåg kai | kai | 3 | båter |
| Krysset | Mariero (E39) | industri | 4 | biler, porten |
| Boligfeltet | Kvaleberg | bolig | 3 | naboer |
| Matbutikken | Hillevåg torg **[Sjekk]** | butikk | 3 | mat |

**Nøkkelsted og HQ-kandidat:** ingen bekreftet. Hillevåg er «verkstedet» i byen: metall og kjøretøy, men lite mat.

---

### 1.10 Ullandhaug og Hinna (fase 5)

**Hva det er:** **Det nye SUS på Ullandhaug, som åpnet 16. november 2025** (Helse Stavanger). Universitetet i Stavanger, Ullandhaugtårnet og Jåttåvågen med stadion (Viking), blokker og Jåttåvågen stasjon.

| Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|
| Sykehuset (HQ-kandidat) | Stavanger universitetssjukehus, Ullandhaug | offentlig, låst | 5 | se kapittel 2 |
| Skolen | Universitetet i Stavanger | offentlig | 4 | tech, lab, forskning |
| Utsikten / tårnet | Ullandhaugtårnet | offentlig | 3 | speiding (ser hele Jæren) **[Åpent: ny type]** |
| Stadion | Viking stadion, Jåttåvågen **[Sjekk sponsornavnet]** | offentlig | 4 | plass til tusenvis, også zombier |
| Blokkene | Jåttå | bolig | 4 | mange folk |
| Jordene | Ullandhaug, rundt Jernaldergården | natur | 2 | mat |

---

### 1.11 Forus og Lura (fase 5)

**Hva det er:** Næringsområdet mellom Stavanger, Sandnes og Sola. Kontorbygg (Equinor-campusen), store varehus og **Kvadrat** på Lura, Norges største kjøpesenter utenfor Oslo.

| Navn | `real` | Type | Trussel | Gir |
|---|---|---|---|---|
| **Kjøpesenteret på Kvadrat (HQ-kandidat)** | Kvadrat, Lura | butikk, låst | 5 | se kapittel 2 |
| Interiørbutikken | IKEA Forus **[Sjekk]** | butikk | 4 | tre, tekstiler, improvisert beskyttelse, kjøttboller |
| Sportsbutikken | XXL Forus **[Sjekk]** | butikk | 4 | beskyttelse, litt våpen |
| Byggvarehuset | **[Sjekk: Maxbo eller Obs Bygg Forus]** | butikk | 3 | tre, skrap |
| Kontorene | Forus næringspark, Equinor **[Sjekk]** | industri | 4 | tech |
| Bilforhandleren | Forus | industri | 3 | metall, kjøretøy |
| **Jaktbutikken (nøkkelsted)** | **ikke funnet** | nøkkelsted | 5 | våpen, ammo |

**[Problem]** Jeg fant ingen bekreftet jakt- eller våpenbutikk på Forus, i Stavanger eller i Sandnes (to søk). Mulighetene er: (a) eieren vet om en, (b) XXL selger jaktvåpen og blir nøkkelstedet i stedet for Sportsbutikken **[Sjekk om XXL Forus har våpendisk]**, eller (c) «Jaktbutikken» blir generisk uten `real`. Uten et ekte sted mister nøkkelstedet krydderet.

---

### 1.12 Sandnes (fase 5, som fraksjon)

**[Åpent]** Sandnes bør ikke kartlegges som et vanlig område. Det bør være **fraksjonen** i fase 5: de andre overlevende, med egne ledere, handel og krig. Det passer rivaliseringen med Sandnes i `CLAUDE.md` perfekt, og det gir tørr humor uten slapstick. «Sandnes har sendt en delegasjon. De vil handle. De har med seg en Sandnes-sykkel og en uttalt mening om Viking.»

---

## 2. Nøkkelsteder og HQ-kandidater samlet

### Nøkkelsteder [Åpent]

| Område | Nøkkelsted | `real` | Begrunnelse |
|---|---|---|---|
| Buøy | – | – | Som i dag |
| Vestøyene | – | – | Et bufferområde, bør ikke være rikt |
| **Hundvåg** | Apoteket | Apotek 1 Hundvåg | Allerede nevnt i `ZONE_INFO`. Første store medisinkilde, og en grunn til å dra fra Buøy i fase 3. |
| Østøyene | – | – | Det stille området |
| **Sentrum** | Apoteket | Apotek 1 Mediegården | Byens mest sentrale apotek. Trussel 5, fordi sentrum er tett. |
| Storhaug | – | – | Ligger for nær sentrum |
| **Våland** | Apoteket | Vitusapotek Paradis og Aleris | Kan byttes ut med noe annet om det blir for mange apotek |
| **Eiganes** | Apoteket | Apotek 1 Bjergsted | Samme problem som over |
| **Forus** | Jaktbutikken | **ikke funnet** | Det eneste våpennøkkelstedet. Må ha et ekte sted. |

**[Problem]** Listen over nøkkelsteder er bare apotek og jaktbutikk. Det gir enten for mange apotek eller for mange tomme områder. **[Åpent]** Kan listen utvides med et par typer til, for eksempel:

- **Dyreklinikken** eller **Veterinæren:** dyremedisin, beroligende piler (*stille* våpen).
- **Dykkerbutikken:** våtdrakter og flasker, motspill mot Svømmere og Dykkere. Jæren Dykkersenter dukket opp i søket. **[Sjekk]** hvor det ligger.
- **Elektronikkbutikken** (Elkjøp): tech i fase 2+. OSM har Elkjøp i sentrum og på Tasta.
- **Lageret** (et grossistlager): mye mat én gang. Kandidat på Forus.

### HQ-kandidater [Åpent]

| Område | HQ-kandidat | `real` | Hvorfor | Skjulte verdier jeg ville gitt |
|---|---|---|---|---|
| Buøy | Rosenberg Verft | Rosenberg Verft | Som i dag | metall, kraner, kai, mange zombier i arbeidsklær |
| Hundvåg | Fortet? | Bunkerne i Trollskogen **[Sjekk]** | Tykke vegger, lite plass | forsvar høyt, kapasitet lav, ingen produksjon |
| Sentrum | **Politistasjonen** | Stavanger politistasjon, Lagård | Våpenlager, celler (lager), arrestbiler, samband | våpen og ammo (låst skap, krever Mekk), samband gir hendelseskort tidlig |
| Storhaug | **Brannstasjonen** | Varmen brannstasjon | Brannbiler (kjøretøy med vann og stige), aggregat, førstehjelp | kjøretøy, vann, *brann*-våpen (fakler, gass), lite mat |
| Våland | **Sykehuset (gamle SUS)** | SUS Våland | Medisin og lab, men fullt av pasienter | medisin og lab høyt, zombier svært mange, delvis tomt etter flyttingen |
| Madla | **Fortet** | Madlaleiren (KNM Harald Haarfagre) | Militærleir med gjerde, mat til rekrutter, sovesaler | forsvar og kapasitet høyt, våpen i hvelv, mange zombier i uniform |
| Ullandhaug | **Sykehuset (nye SUS)** | SUS Ullandhaug | Nytt, enormt, nødstrøm | strøm og medisin høyt, zombier ekstremt mange |
| Forus og Lura | **Kjøpesenteret på Kvadrat** | Kvadrat | Alt på ett sted, enorme lager | litt av alt i store mengder, men tømmes, og forsvaret er dårlig (glass) |

Hvorfor HQ-ene bør være forskjellige: hvert HQ bør ha én klar styrke og én klar svakhet, så valget blir reelt. Politistasjonen gir våpen, brannstasjonen gir kjøretøy og vann, sykehuset gir medisin og lab, fortet gir forsvar, kjøpesenteret gir alt litt og verftet gir metall. Hvilke verdier det er, er skjult (designprinsippet), men *profilen* kan spilleren gjette fra typen. Det er rykter, ikke speiderrapporter.

**[Åpent] To sykehus.** SUS flyttet til Ullandhaug 16. november 2025. Psykisk helsevern og mange poliklinikker ble igjen på Våland. Mulighetene:

- (a) Bare nye SUS er HQ-kandidat. Gamle SUS blir en vanlig offentlig sektor, «Legesenteret».
- (b) Begge er det. Gamle SUS er halvtomt (mindre medisin, færre zombier), og nye SUS er fullt.
- (c) Spillet foregår *før* flyttingen. Det er enklest å forklare, men datoen blir rar for en som bor der.

Jeg heller mot (b). Det gir en fin byttehandel: det trygge, halvtomme sykehuset nært, eller det fulle og farlige lenger unna.

**[Problem] Fase 2 og HQ-valget.** Spilldesignet sier at du tar *et* HQ i fase 2. I dag er Rosenberg den eneste kandidaten innen rekkevidde. Er det et valg da? Spilleren kunne fått velge mellom Rosenberg (nær, metall) og for eksempel Brannstasjonen på Storhaug (over Bybrua, kjøretøy) allerede i fase 2. Det er et ekte valg med en pris i avstand. Men da må fase 2-kartet nå til Storhaug.

---

## 3. Tett mot spredt bebyggelse

**Eierens spørsmål:** Hvordan unngår vi at alle velger områdene med høy bebyggelse, og kan det gi en umulig start?

### Hva dataene sier

Bygningstall fra OSM-dumpen, telt i en boks rundt hvert område (grovt):

| Område | Eneboliger og tomannsboliger | Rekkehus | Blokker | Butikker og næring |
|---|---|---|---|---|
| Buøy | ~360 | 2 | 13 | ~90 (mest verftet) |
| Vestøyene | ~400 | ~45 | ~90 | ~30 |
| Hundvåg | ~1 570 | ~110 | ~50 | ~20 |
| Østøyene | ~500 | ~30 | 1 | ~5 |
| Storhaug | ~2 100 | ~180 | ~400 | ~100 |
| Sentrum (Ledaal- og Sølyst-boksene) | ~800 | ~5 | ~280 | ~480 |

Forskjellen er enorm. Sentrum har rundt 20 ganger så mange næringsbygg som Hundvåg. Følger funnene bebyggelsen rett, vinner sentrum alltid, og det er det anti-målet «én strategi alltid vinner» advarer mot.

### Hvorfor «umulig start» er mindre farlig enn det høres ut

Fase 1 er alltid Buøy, så starten kan ikke bli umulig på grunn av bebyggelsen. Risikoen kommer i fase 3, når spilleren selv velger retning. Velger du sentrum og taper, er det ditt valg, og spilldesignet sier at det skal være lov. Problemet er hvis **det eneste fornuftige valget** er umulig, eller hvis seeden legger alle de trygge områdene bak et farlig.

### Modell A: Tetthet er en skyveknapp

Hvert område (og hver sektor) får en tetthet fra 1 til 5. Tettheten ganger opp alt samtidig:

| Tetthet | Funn | Zombier | Kjellere (skjulte) | Støy når dere rydder |
|---|---|---|---|---|
| 1 (Østøyene) | ×0,6 | ×0,5 | ×0,5 | lav |
| 3 (Hundvåg) | ×1,0 | ×1,0 | ×1,0 | middels |
| 5 (sentrum) | ×1,8 | ×2,2 | ×2,0 | høy, trekker fra nabosektorer |

Zombier og kjellere vokser *raskere* enn funnene. Tett gir mer, men koster forholdsvis mer.

- **Fordeler:** Enkelt. Bruker regler som allerede finnes (zombier per sektor, `hidden`, glemte kjellere). Lett å balansere med boten, fordi det bare er ett tall per område. Snoking får mer betydning i tette områder, og det er «stats med konsekvenser».
- **Ulemper:** Det er fortsatt bare én akse. Med godt utstyr og et sterkt crew vinner tett likevel, fordi zombiene er et problem du løser, mens funnene er gevinst. Valget blir «tett når vi er sterke, spredt når vi er svake», altså en stige, ikke et reelt valg.

### Modell B: Ulike ressursprofiler (tett tar slutt, spredt varer)

Tett og spredt gir **forskjellige ting**, ikke mer eller mindre av det samme.

| | Tett (sentrum, Storhaug, blokkene) | Spredt (Østøyene, jordene på Hundvåg, Madla) |
|---|---|---|
| Gir | forbruk: mat på boks, medisin, klær, tech | produksjon: jorder, skog, fisk, båter |
| Varer | tømmes (butikker har beholdning) | jevn strøm, vokser med HQ-oppgraderinger |
| Folk | mange zombier, få overlevende (de som var der, ble smittet) | få zombier, flere overlevende (spredt bebyggelse ga tid til å flykte) |
| Risiko | encounters, horder, kjellere | Jegere-mutasjonen (crew ute langt fra base), lange reiser |

Det støttes allerede av spilldesignet: «Mat blir vanskeligere å finne over tid» [Låst], «HQ må etter hvert produsere nok mat selv» [Låst] og «Jorder … Startstedet avgjør hvor lett det er».

- **Fordeler:** Et ekte valg som endrer seg over tid. Tidlig i en fase er tett bedre (rask gevinst). Sent er spredt bedre (det varer). En god spiller veksler: et raid inn i sentrum for medisin, men basen bygges mot jordene. Det gir også fraksjonen Sandnes noe å handle med. Rekruttering i spredte områder gjør at du får *folk* der, og det er det som mangler (spilldesignet: «Det som er knapt, er folk til å hente dem»).
- **Ulemper:** Krever produksjon fra HQ (fase 2+), som ikke er bygd. Vanskeligere å balansere, fordi verdien av et område avhenger av tidspunktet. Boten må lære seg å veksle, ellers sier simuleringen ingenting.

### Modell C: Sikkerhetsgaranti og avstandsring

En regel som verner mot den umulige starten uansett hvilken modell som velges:

1. **Avstand telles i områder, ikke meter** (vedtatt, kapittel 0.1). Ring 0 er Buøy, ring 1 er Vestøyene, Hundvåg og Østøyene, ring 2 er sentrum, Storhaug, Våland og Eiganes, og ring 3 er Madla, Hillevåg, Ullandhaug og Forus. Grunntrusselen følger ringen.
2. **Garantien:** Seed-tillegget (spilldesignet: «noen steder er bare verre») kan aldri gjøre *alle* områdene i neste ring verre enn ringen etter. Minst ett område i hver ring har trussel lik grunntrusselen eller lavere. Det sjekkes når seeden lages, deterministisk.
3. **Støy fra veksten (fase 4, «risiko ved å vokse for fort»):** Hvert tett område du holder, gir en fast mengde støy per natt til *alle* naboområder. Tre tette områder samtidig trekker horder. Spredte områder gir nesten ingen støy.

- **Fordeler:** Gjør umulige seeds svært sjeldne, uten å fjerne flaksen. Passer «Overraskende, men rettferdig». Avstand i områder er lett å forklare. Støyen gir fase 4 sin «vokser for fort»-risiko gratis.
- **Ulemper:** Garantien kan føles kunstig hvis spilleren merker den. Støyregelen er en ny mekanikk som må vurderes for alle fem fasene (fase 1 har bare ett område, så den gjør ingenting der, og det er greit).

### Anbefaling [Åpent]

**B som kjerne, C som sikkerhetsnett, og A sine multiplikatorer som verktøyet.**

- Bruk **B** til å gjøre tett og spredt til forskjellige ting, ikke bare mer eller mindre. Det er det eneste som gjør valget reelt over flere faser.
- Bruk tallene fra **A** innenfor B: tette sektorer har flere zombier og kjellere per funn. Det er allerede slik Buøy fungerer (skolen har 16 zombier og 4 skjulte, boligfeltet har 10 og 3).
- Bruk **C** (avstand i områder og garantien) så seeden aldri stenger alle trygge veier. Støyregelen kan vente til fase 4.

Konkret for kartet over: Østøyene og Hundvåg-jordene er de spredte valgene i fase 3. Sentrum og Storhaug er de tette i fase 4. Madla (jorder, fortet) og Forus (kjøpesenter, varehus) er det samme valget én ring lenger ut.

**[Problem]** Uten produksjon i HQ (fase 2+) er modell B bare halv. I fase 3 må spredte områder gi noe *nå*, ellers velger ingen dem. Forslag: overlevende å rekruttere. Spredte områder har flere naboer som kommer til porten (spilldesignet, fase 3: «rekruttering ved porten»).

**[Problem]** Asynkron multiplayer. Hvis flere spillere deler byen, og alle går mot sentrum, blir sentrum tomt fort. Det kan være bra (konkurranse) eller dumt (den første tar alt). Det må avgjøres før modell B låses.

---

## 4. Åpne spørsmål til eieren

Alle er [Åpent], unntatt 1, 4 og 5, som er vedtatt (kapittel 0.1). De viktigste står først.

1. ~~**Små øyer**~~ **Vedtatt (0.1):** Vestøyene og Østøyene er hvert sitt område.
2. **Fase 2-kartet:** Er det bare Buøy og Rosenberg, eller også Vestøyene, og kanskje Storhaug for å få et reelt HQ-valg?
3. **Tett mot spredt:** Liker du modell B (forbruk mot produksjon) med C som sikkerhetsnett? Eller er A (én skyveknapp) nok for nå?
4. ~~**Avstand**~~ **Vedtatt (0.1):** i områder, i ringer rundt Buøy.
5. ~~**Trusselskalaen**~~ **Vedtatt (0.1):** relativ til fasen, 1–5 innenfor området, `mods(s)` ganger opp.
6. **To sykehus:** Gamle SUS på Våland, nye SUS på Ullandhaug, eller begge? Når foregår spillet, før eller etter 16. november 2025?
7. **Jaktbutikken:** Vet du om en ekte jakt- eller våpenbutikk i Stavanger, Sandnes eller på Forus? Ellers: XXL, generisk eller noe annet?
8. **Nøkkelsted som funn:** Kan et nøkkelsted ligge *inne i* en sektor (Apoteket i senteret) i stedet for å være en egen sektor? Det løser Hundvåg senter og sentrum.
9. **Flere nøkkelstedstyper:** Dyreklinikken, Dykkerbutikken, Elektronikkbutikken, Lageret? Ellers blir det bare apotek.
10. **Nye stedstyper:** Konserthuset, Stadion, Tårnet og Jernbanen er ikke i regelheftet. Utvide heftet, eller tvinge dem inn i eksisterende typer?
11. **Hundvågtunnelen:** Åpen port fra start i fase 4, eller låst til en quest åpner den?
12. **Sjøporter:** Tegnes sjøen mellom Ormøy og Buøy som en port fra start, eller først med Svømmere?
13. **Sandnes:** Fraksjon i fase 5, ikke et område. Enig?
14. **Bydel som fase 4:** Skal fase 4-bonusen følge de ekte bydelsgrensene (Hundvåg, Storhaug, Eiganes og Våland, Madla, Hillevåg, Hinna, Tasta)?
15. **Trehusene på Storhaug:** Er en brannregel (brannvåpen er sterke, men bydelen kan ta fyr) verdt en ny mekanikk?
16. **OSM-utvidelse:** Er det greit å utvide bboxen og hente på nytt én gang, kanskje med én config per zoomnivå?

### Det som må sjekkes før navnene brukes [Sjekk]

- Bunkerne i Trollskogen på Hundvåg: hva de er, og om de har et navn.
- Varmen brannstasjon og den planlagte brannstasjonen i Lervig: samme bygg, i drift?
- Navnene på senteret på Madla, butikkene i Hillevåg og varehusene på Forus (IKEA, XXL, byggvarehus).
- Stadionnavnet i Jåttåvågen.
- Om Kvernevik har brannstasjon i dag (stillingsannonsen var fra 2019).
- Om Engøyholmen er riktig «båthavn» på Engøy. (Atlaset bruker foreløpig naustene på sørsiden av Engøy.)

---

## Kilder

- OpenStreetMap-dumpen `data/osm.json` (© OpenStreetMap-bidragsyterne, ODbL), lest lokalt.
- Helse Stavanger om SUS Ullandhaug og delt drift: [helse-stavanger.no/en/steder/ullandhaug](https://www.helse-stavanger.no/en/steder/ullandhaug/), [kommunikasjonsstrategi nytt sykehus og delt drift 2025–2026](https://helse-stavanger.no/4b12e0/siteassets/documents/strategidokumenter/kommunikasjonsstrategi-nytt-sykehus-og-delt-drift-2025-2026.pdf).
- Madlaleiren: [snl.no/Madlaleiren](https://snl.no/Madlaleiren), [stillingsannonse på finn.no](https://www.finn.no/job/ad/453950708).
- Lervig brannstasjon: [løyve fra Statsforvalteren](https://prep.statsforvalteren.no/siteassets/fm-rogaland/dokument-fmro/miljo/soknad-og-loyve/arbeid-i-sjo/loyve---stavanger-kommune---lervig-brannstasjon.pdf).
- Søk etter jakt- og våpenbutikk på Forus, i Stavanger og i Sandnes ga ingen treff (oktober 2026).
