# Stavanger Z – spilldesign

Dette er sannheten for hva spillet er. Motoren og innholdet bygges etter dette dokumentet, ikke omvendt. Når en playtest viser at noe er feil, endrer vi dokumentet først og koden etterpå.

Hver regel er merket med hvor sikker den er:

- **[Låst]**: bestemt, bygg etter det.
- **[Forslag]**: beste gjetning. Bygg etter det, men vær forberedt på at det endres etter playtest.
- **[Åpent]**: ikke bestemt. Ikke bygg noe som låser det.

Kodearkitekturen (deterministisk motor, ferdigbygd kart, ingen sanntid) står i `CLAUDE.md` og gjelder fortsatt.

---

## 1. Hva spillet er

**[Låst]** Et turbasert overlevelses- og oppbyggingsspill på et ekte, stilisert kart over Stavanger og Sandnes. Det skal føles som et brettspill på skjerm: utstyr og hendelser er kort, sjansene er synlige og humoren er lokal.

**Kjernefølelsen [Låst]:** Hver runde er en historie dere ikke kunne forutsi, men som dere vant fordi dere tok gode valg under press. Det beste øyeblikket er når dere så vidt kommer hjem fra et tokt med lite liv og nesten alt brukt opp.

**Inspirasjon [Låst]:**

- **Plague Inc:** zombiene muterer tilfeldig, og mestring måles i hvor raskt du klarer det.
- **Dead of Winter:** hendelser og kriser som tvinger fram vonde valg.
- **Civilization:** byen vokser, du zoomer ut fra gate til region, og du har et forskningstre.
- **Base building:** perimeter og HQ som oppgraderes.
- **Fallout Shelter:** folk med våpen, rustning, nivå og trening, og et kortbibliotek du styrer utstyret fra.

### Søyler

Hver ny mekanikk må tjene minst én av søylene.

1. **Overraskende, men rettferdig.** Seeden setter opp et unikt scenario: hvor unike ting ligger, hvordan zombiene muterer og hvilke hendelser som er i bunken. Sjansene for det du gjør vises alltid. Når du taper, skal du skjønne hvorfor.
2. **Knapphet som tvinger valg.** Det skjer noe nesten hver dag, og ressursene kommer jevnt. Likevel er det aldri nok til alt. Spørsmålet er «hva prioriterer vi?», ikke «sulter vi?».
3. **Ut av leiren.** Quests, tokt og unike funn trekker deg bort fra trygg grunn. Det er der risikoen og belønningen ligger.
4. **Fra pjokk til statsleder.** Du starter med en baufil og et 20 mm K-rør utenfor huset ditt. Du ender med å styre bydeler gjennom ledere. Fokuset zoomer ut, men du kan alltid ta med kjernecrewet ditt og rydde opp selv.
5. **Mestring måles i tid.** Målet er å fullføre fasene raskest mulig. Seire låser opp vanskelighetsgrader og nytt innhold.

### Ikke-mål

- Ingen sanntid, ingen action-kamp og ingen bil-tuning i Forza-stil.
- Ingen mikrostyring i fase 4–5 som spilleren ikke selv har valgt.
- Turene skal ikke være lange som regel. Fem minutter på en viktig tur er greit, men vanlige turer skal være raske. Målet **[Forslag]** er 3–6 reelle beslutninger per tur i alle faser.

### Anti-mål

Spillet har feilet, selv om det virker, hvis:

- én strategi alltid vinner,
- tilfeldighet føles urettferdig eller usynlig,
- fase 3–5 blir et regneark,
- humoren blir slapstick i stedet for tørr og lokal.

---

## 2. Rytmen

**Dagen [Låst]:**

1. **Planlegg:** gi hver person (senere hver leder) en oppgave. Ta valg på ventende encounters.
2. **Dagen løses:** rydding, leting, bygging, tokt.
3. **Natta:** angrep på perimeteren og utbrudd fra skjulte zombier.
4. **Hendelseskort:** sambandet, ofte med et valg. Kortet trekkes når dagen er løst og venter i spilltilstanden til du har valgt, også om siden lastes på nytt. Neste dag kan ikke starte før hendelsen og encounters er avgjort, og utfallet (valget og hva som endret seg) står i loggen for dagen.

**Fasene [Forslag].** Hver fase har sitt eget kjerneverb. Det fasen før handlet om, kan falle bort.

| Fase | Verb | Du styrer | Låses opp |
|---|---|---|---|
| 1 Utbruddet | Sikre | Hver person | Rydding, perimeter, vakt, tokt |
| 2 Hovedkvarter | Flytte | Kjernecrew og kjøretøy | Kjøretøy, HQ med skjulte verdier, forskningslab, roller |
| 3 Ekspansjon | Lede | Crew-ledere med egne crew | Ledere, rekruttering, stemning i basen |
| 4 Bydel | Forvalte | Bydeler og poster | Budsjett, guvernører, styreform |
| 5 Fraksjoner | Forhandle | Politikk | Handel, krig, diplomati |

**Faseskifte [Låst]:**
- Fasemålet må nås før du kan gå videre.
- Når målet er nådd, velger du selv når fasen avsluttes. Du kan bli værende og bygge deg sterkere først.
- **Nedtelling etter målet [Bygget]:** når fasemålet er nådd, har du 10 dager (`graceDays`) på å farme, bygge lager og gjøre deg klar. Du kan gå videre når du vil, og når de 10 dagene har gått, går du over av deg selv. Rekorden teller dagene til målet, så den som jakter rekord, går rett videre, mens den som vil ha lager, bruker dagene.
- **Fristen før målet** er et sikkerhetsnett, ikke tempoet: 90 dager i fase 1 (`turnCap`). Tempoet kommer av målet selv. Hva som skjer hvis målet ikke er nådd ved fristen, avhenger av vanskelighetsgraden (kapittel 6, «Vanskelighet»): på normal og hard må du videre likevel, med en pris, og på brutal er runden tapt. Spillet viser derfor «Frist for fasemålet» før målet er nådd, og «Fase 2 om» med dagene som er igjen etterpå.
- Prisen for å nøle er tid, fordi poengsummen er antall dager. Zombiene muterer ikke mens du venter.

---

## 3. Folk

### Ferdigheter

**[Forslag]** Seks ferdigheter, som i dag:

| Ferdighet | Brukes til |
|---|---|
| Muskler | Kamp og bæring |
| Kondis | Tokt, avstand og flukt |
| Snoking | Leting og å finne skjulte zombier |
| Nerver | Vakt, kriser og stress |
| Mekk | Bygging, utstyr, kjøretøy og forskning |
| Prat | Rekruttering, moral og diplomati |

**Skala [Låst]:** 1–100 internt. Spilleren ser en stolpe og et nivånavn, ikke tallet. Nivånavnene er for eksempel Elendig, Grei, God og Rå **[Forslag]**. De fleste starter dårlig. Ferdighetene øker med:

- **Erfaring:** å gjøre oppgaven.
- **Trening:** en egen oppgave.
- **Utstyr:** kortene.
- **Nivå:** se under.

**Nivå [Forslag]:** Hver person samler erfaring fra alt de gjør, og går opp i nivå (1–20). Hvert nivå over 1 gir +2 i alle ferdigheter, og hvert nivå tar litt lenger tid enn det forrige (nivå n krever 6 · n(n−1)/2 erfaring). Nivået vises på personen, og opprykk meldes i loggen. Det er de som har overlevd lengst, som blir crew-ledere og får roller i HQ senere.

Det skal kjennes: mot slutten av en fase er crewet raskere til å rydde, drepe og lete, og du er på toppen av haugen. Så kommer neste fase med mutasjoner og høyere vanskelighet, og du er en pusling igjen. Skaleringen må være forsiktig, så ingen blir urørlige. Bonusen per nivå er en vanskelighetsknott som kan justeres.

Sjansen for et vanlig utfall regnes ut fra ferdighet pluss utstyr mot sektorens trusselnivå. Sjansen vises alltid før du velger.

### Egenskaper

Hver person har én eller to egenskaper (traits) som endrer reglene litt. Kokken bruker mindre mat. Stavangerkjenneren finner snarveier.

### Død

**[Låst]** Folk kan dø, også deg selv. Spillet fortsetter så lenge noen i crewet lever.

**[Forslag]** Hvis du dør, velger du en av de gjenlevende som ny hovedperson.

**[Låst]** Utstyret til den døde forsvinner ikke:

- Dør vedkommende hjemme, havner utstyret på lageret.
- Dør vedkommende ute, ligger utstyret igjen i sektoren og kan hentes på et nytt tokt.

---

## 4. Oppgaver

En person har én oppgave per dag. Oppgaver låses opp per fase **[Forslag]**. Alle bruker reisetid til målet (se kapittel 7).

| Oppgave | Fra fase | Kort forklart |
|---|---|---|
| Hvile | 1 | Gir liv og nerver tilbake |
| Rydde | 1 | Dreper zombier, gjennomsøker og tar med funn, alt på én gang |
| Vakt | 1 | Står på en perimeterport, eller holder kontroll på en sektor |
| Bygge | 1 | Forsterker perimeteren, senere basen |
| Sanke | 1 | Henter ressursen sektoren er kjent for |
| Speide | 1 | Avslører trusselnivå og funn i en sektor, uten kamp |
| Lete etter overlevende | 1 | Kan gi nye folk, eller kan gi bråk |
| Trene | 1 | Gir erfaring i én ferdighet |
| Lage utstyr | 1 | Gjør materialer om til makeshift våpen og rustning |
| Pleie | 1 | Helbreder raskere enn hvile. Hver pleier tar seg av opptil to som hviler, de dårligste først, med 60 % sjanse hver (`PLEIE_PATIENTS`, `PLEIE_HEAL`). Resten bruker medisin eller sofaen. En nattevakt i crewet gir 70 % på sofaen (`NATTEVAKT_HEAL`), ikke en garanti |
| Tokt | 1 | Ekspedisjon over flere dager til et fjernt mål (se kapittel 8) |
| Forske | 2 | Undersøker zombieprøver i laben (se kapittel 6) |
| Veirydding | 2 | Gir kortere reisetid permanent på en rute |
| Kjøre / transport | 2 | Bruker kjøretøy og drivstoff eller strøm |
| Holde ro | 3 | Holder moralen og stemningen oppe i en base |
| Spionasje | 3 | Fanger opp murring og opprør, senere fraksjoner |
| Handle / diplomati | 5 | Byttehandel og avtaler med fraksjoner |

**Automatisering:** Ferdig speiding går over i Rydde (hvis det er zombier igjen) ellers Sanke, og ferdig rydding i Sanke eller Holde vakt, i samme sektor og bare hvis ordren er gyldig. Ellers hviler personen. Loggen sier det kort («Mona fortsetter med å sanke Kaia»). I Crew-fanen kan spilleren lagre dagens fordeling som en navngitt plan (høyst seks, i spilltilstanden, så de følger lagringen) og bruke den med ett klikk, og «Som i går» setter alle tilbake til forrige dags oppdrag. Planer og «Som i går» setter bare oppdraget, og ugyldige ordre hoppes over med beskjed. Ingen av delene bruker tilfeldighet.

**[Låst]** Klarering og finsjekk blir én oppgave: **Rydde**. Du sjekker og tar med deg det du finner samtidig. Den gamle «Lete» blir **Sanke**.

---

## 5. Sektorer

### Hva en sektor er

**[Låst]** Det skal stå tydelig på kartet hva hver sektor er og hva den er god for.

**[Forslag]** Hver sektor har en type og en profil:

| Type | Gir | Eksempel på Buøy |
|---|---|---|
| Hjem / base | Plass til folk, lager | Hjemme |
| Butikk / lager | Mat, verktøy, materialer (tømmes over tid) | Obs Bygg |
| Industri | Metall, skrap, kanskje strøm | Sørspissen |
| Boligfelt | Overlevende å rekruttere, litt av alt | Buøy nord |
| Natur / park | Tre og litt mat | — |
| Kai / sjø | Fisk og båter | Tømmerodden |
| Offentlig | Medisin og spesielle funn | Skolen |

Kartet viser ikonene for hva sektoren gir, også før den er speidet.

**Oversiktskart over hele byen [Bygget]:** Kartet har tre visninger: Buøy, byøyene og hele Stavanger, fra byøyene i nord til Forus og Lura i sør og Madla og Hafrsfjord i vest. Bykartet er bare oversikt. Det viser kystlinje og hovedveier uten bygninger, og fastlandet er delt i ukjente soner i tåke etter atlasets områder: Sentrum, Storhaug, Våland, Eiganes og Bjergsted, Madla, Hillevåg, Ullandhaug og Hinna, og Forus og Lura. Det finnes ingen sektorer eller regler der ennå. Fastlandssonene står bare som «Ukjent», fordi **fasene for dem fortsatt er [Åpent]** (se `docs/kartlegging-stavanger.md`). Hundvåg står fortsatt som fase 3.

**Bosetting [Låst]:** En sektor kan være bosatt eller ubebodd, og den har en kapasitet for hvor mange den kan huse. Da vet du hvor mange du har plass til etter hvert.

**[Åpent]** Om en sektor kan fikses opp for å huse flere, og hva det koster.

### Tre verdier samtidig

**[Låst]** En sektor har ikke ett trinn på en stige. Den har flere verdier som gjelder samtidig. En sektor kan være 100 % gjennomsøkt og likevel infisert igjen.

**[Forslag]** Hver sektor har tre verdier, og alle tre vises:

| Verdi | Hva den betyr | Går opp med | Går ned med |
|---|---|---|---|
| **Infisering** | Hvor mange zombier det er, synlige og skjulte | Natt, streif inn, utbrudd fra kjellere, tid uten kontroll | Rydding |
| **Gjennomsøkt** (0–100 %) | Hvor godt vi kjenner sektoren og hvor mye som er tatt med | Rydding, speiding | Tid uten kontroll |
| **Kontroll** (0–100 %) | Hvor godt vi holder den nå | Vakt, perimeter, folk som bor der | Tid uten folk, angrep |

**Forfall [Låst]:** Jo lenger en sektor er uten vår kontroll, jo mer synker verdiene og jo mer stiger infiseringen.

**Trygg sektor [Forslag]:** En sektor er trygg når den er 100 % gjennomsøkt, uten zombier og med høy kontroll. Da finnes det ingen skjulte zombier der. Den holder seg trygg så lenge kontrollen holdes oppe.

God Snoking gir raskere og sikrere søk. Dårlig Snoking gir flere glemte kjellere, som er prinsippet om at stats skal gi konsekvenser.

**Glemte kjellere [Forslag]:** Skjulte zombier kan bryte ut om natta, men bare i sektorer der ingen fra crewet var den dagen. Er noen der og rydder eller sanker, hører de det. Vakt og befesting teller i sektoren porten ligger i. Hvile, trening, laging og pleie skjer hjemme, så da er noen hjemme.

### Perimeteren

**[Låst]** Perimeteren har porter som oppgraderes. Personer på vakt hjelper om natta.

**[Forslag]**
- En port på maks nivå med vakt holder normale netter.
- Bare hendelseskort og spesielle mutasjoner kan bryte den (for eksempel dykkere hvis porten vender mot sjøen).
- Sektorer innenfor en perimeter på maks nivå mister ikke kontroll.

### Trusselnivå og avstand

**[Låst]** Zombier langt fra HQ eller startpunktet er sterkere. De har høyere verdier, ikke flere mutasjoner.

**[Forslag]** Hver sektor har et skjult trusselnivå fra 1 til 5. Det øker med:
- avstanden fra HQ eller startsonen,
- fasen,
- et seed-tillegg (noen steder er bare verre).

Trusselnivået styrer:
- hvor sterke zombiene og encounters er,
- hvor mange zombier sektoren har,
- hvor godt utstyr som kan finnes der (se kapittel 9).

**Speide** avslører nivået før du går inn.

### Encounters

**[Forslag]** Rydding og tokt kan utløse et encounter: et kort med en situasjon og to–tre valg, der ett alltid er **trekk ut**. Å trekke seg ut koster noe, som en skadet person eller tapt utstyr, men redder resten.

**Når valget tas [Forslag]:**
- Et encounter oppstår når dagen løses. Det blir liggende som *ventende* til neste planlegging, der spilleren velger.
- `resolveDay()` forblir ett steg med ordre inn og resultat ut. Det trengs for asynkron multiplayer.
- Høyst ett encounter per gruppe per dag, og høyst to per tur totalt.

**Stedet [Forslag]:** Hvert kort sier hvor det kan skje: hvilke sektortyper (hjem, bolig, kai, butikk, industri, offentlig) og om det kan skje på tokt. Det blir ingen heis i rekkehuset. De fire sist trukne kortene trekkes ikke igjen før andre har vært innom.

**Innsatsen vises [Bygget]:** Før du velger, viser hvert valg hvilken ferdighet som sjekkes, hvem som prøver, sjansen i ord («god sjanse» fra 70 %, «usikkert» fra 40 %, ellers «dårlig sjanse») og hva det kan gi eller koste, uten tall: «kan gi medisin», «kan koste mat · kan gi skade». Retningen og risikoen ser du, de nøyaktige tallene ikke. Etterpå vises nøyaktig hva som endret seg, for eksempel «+1 medisin» eller «−2 mat». Det samme gjelder hendelser som måkene. Alt som teller for fasemålet skal vises, også portarbeid, nye i crewet, oppdrag, speidede sektorer, kontroll og gjennomsøkt. Motoren regner fortsatt ut de eksakte tallene (boten bruker dem); bare visningen gjør dem om til ord.

---

## 6. Zombiene muterer

**[Låst]** Inspirert av Plague Inc. Zombiene får nye mutasjoner, tilfeldig per seed. Rytmen skal være «nå har vi kontroll» etterfulgt av «wow, nå ble det vanskelig igjen».

**[Låst]** Mutasjoner skjer **bare ved faseskifte**. Fase 1 har ingen mutasjoner.

**[Forslag]** Ved hvert faseskifte får zombiene et tilfeldig antall mutasjonspoeng. Poengene kjøpes inn i en matrise med fire grener, vektet av seeden. Evnene i en gren kommer i rekkefølge, for eksempel løpere før hoppere før dykkere. Hver mutasjon har minst ett motspill.

| Gren | Eksempler |
|---|---|
| Bevegelse | Løper raskere, hopper over sperringer, svømmer, går under vann |
| Sanser | Hører støy, lukter mat |
| Kropp | Seigere, pansret hud, giftig bitt |
| Atferd | Smartere, flokk, graver i kjellere, går etter den som gjør mest skade, går etter den med minst liv |

### Forskning

**[Låst]** Du vet ikke hvilke mutasjoner zombiene har fått før du har forsket på dem. Forskning går slik:

1. Crewet som rydder, tar med zombieprøver hjem.
2. Prøvene undersøkes i forskningslaben. Det tar et antall turer.
3. Når forskningen er ferdig, får du en melding i tørr, pseudovitenskapelig stil: «Mutasjon Z12-J1 på OPH3S-genet er påvist. Zombiene har blitt smartere.»
4. En kjent mutasjon gir mindre straff enn en ukjent. Noen mutasjoner er bare nyttig å vite om, for eksempel at zombiene går etter den med minst liv.

**[Låst]** Mekanikken holdes enkel: prøver inn, vent, oppdagelse ut.

**[Forslag]**
- Laben bygges i HQ i fase 2. Fase 1 har ingen mutasjoner å forske på.
- Ny forskning låser opp mottiltak i et forskningstre, for eksempel bedre våpen, sjøsperringer og lokkemat.
- **Zombierapporten** viser matrisen. Den fylles ut etter hvert som dere oppdager mutasjoner.

### Forskningstre

**[Låst]** Det skal være et forskningstre.

**[Åpent]** Hvor stort det er, hva som ligger i det utover mottiltak mot mutasjoner, og om fase 1 har noe av det.

### Vanskelighet

**[Forslag]**
- Vanskelighetsgraden styrer hvor mange mutasjonspoeng zombiene får og hvor sterke de er.
- Noen seeds kan være brutale. Det er lov.
- Seeden kan deles som en kode, så et umulig kart blir en utfordring mellom venner.

**Vanskelighetsgrader [Forslag]:** Spilleren velger ved ny runde (`GameState.difficulty`, standard normal). Gradene er ganger på fasetabellen (`DIFFICULTY` i `phases.ts`, lest av `mods(s)`), så tallene fortsatt bare ligger i `phases.ts`. Normal er 1 overalt, så balansen i kapittel 11 gjelder normal. Lagringer uten grad blir normal: tallene er de samme som før, mens brutal ville gjort zombiene sterkere midt i en runde.

| Grad | Zombiene og økonomien | Når fristen går ut uten at fasemålet er nådd |
|---|---|---|
| Normal (standard) | som fasetabellen | Du må videre likevel, med en pris: sektorer som ikke er trygge faller (halvparten av startzombiene kommer tilbake, kontrollen er borte), moralen synker 15, og zombiene får 1 ekstra mutasjonspoeng ved faseskiftet. |
| Hard | +5 % antall, −10 % drap, +20 % skaderisiko, raskere nattepress (×1,3), kjellerutbrudd ×2 og zombier som siver inn ×1,8. Økonomi: −15 % loot, sanking og regn, 1,5 × råte på lageret | Som normal, men prisen er høyere: hele startantallet kommer tilbake, moralen synker 30, og 2 ekstra mutasjonspoeng. |
| Brutal | +10 % antall, −13 % drap, +30 % skaderisiko, nattepress ×1,35, kjellerutbrudd ×2,4 og zombier som siver inn ×2,3. Økonomi: −25 % loot og regn, −20 % sanking, dobbel råte | Runden er tapt (`over = 'timeout'`). |

**Hvorfor økonomien og kjellerne (runde 6):** Før var hard bare zombieknotter, og boten vant 92 % på hard mot 96 % på normal. Antall zombier og drap slår hardest ut i fase 2 (verftet er stort), så hard og brutal holder dem moderate og legger presset der fase 1 kjennes: glemte kjellere, zombier som siver inn, raskere nattepress og mindre å leve av (`lootMult`, `yieldMult`, `rainChance`, `stashRot`). Mål for fase 1 med standardcrewet: hard 75–85 % seier, brutal 55–70 %. `tests/balance.test.ts` har et eget, raskt tilfelle for hard (100 runder, standardcrewet, 70–88 %).

| Simulering, 300 runder, standardcrew | Fase 1 før → nå | Fase 2 før → nå (av de som kom dit) |
|---|---|---|
| Normal | 96 % → 94 % (median 27 dager) | 91 % → 89 % (median 27 → 30 dager) |
| Hard | 92 % → 78 % | 61 % → 41 % |
| Brutal | 87 % → 59 % | 25 % → 15 % |

Med nedtellingen og portnivå 3 i målet (30.10) ble fase 1 lengre (se «Lengre fase 1» i kapittel 11). 300 runder: normal 87–95 % per kombinasjon (median 43–47 dager, p10 36–40, p90 52–56), hard 80 % og brutal 63 % (median 46 og 48). Under 0,5 sultedager per runde på normal. Fase 2 på normal: 88 %, median 33 dager i fasen.

Runder som fristen tvang over i fase 2, taper der nesten alltid, så fase 2-tallet på hard er lavt også fordi flere kommer dit tvunget.

Prisen ved fristen er også data i `DIFFICULTY` (`deadline`). Ventende encounters forsvinner og tokt kommer hjem, som når fristen treffer etter nådd mål. Er målet nådd ved fristen, vinner du på alle grader. Spillet viser graden ved siden av dagen (ikke på normal), og fristlinjen forklarer hva som skjer. Simuleringen (`npm run sim -- 300 --hard` / `--brutal`) teller «mål nådd før fristen» som seier.

**Rekorder og opplåsing [Bygget].** Poengsummen er dager brukt på fasen (`dag − phaseStartDay`), færre er bedre. Bare en fase som er vunnet teller, ikke en som fristen tvang videre. Nettleseren lagrer beste dager for fase 1 og fase 2 per vanskelighetsgrad og per startcrew (tre naboer, uavhengig av rekkefølge) i `localStorage`, innpakket i try/catch, så spillet virker uten. Rekordlisten vises på tittelskjermen, og «Ny rekord!» vises ved fase-overgangen og på seierskjermen. Hard låses opp når fase 1 er vunnet på Normal, Brutal når den er vunnet på Hard. Låste valg vises med hva som låser dem opp. Reglene er den rene funksjonen `recordRun` i `src/ui/records.ts` (ingen spillregler, bare UI). Seed-koden (base 36) står på sluttskjermene, og kan skrives inn på tittelskjermen for å spille samme by.

**[Låst]** All vanskelighet hentes fra fasetabellen i `src/engine/phases.ts` via `mods(s)`.

---

## 7. Ressurser, reise og kjøretøy

### Ressurser

**[Forslag]** Det finnes to slags ressurser.

**Forbruk:**
- **Mat**
- **Vann**
- **Medisin**
- **Strøm**
- **Drivstoff**

**Materialer:**
- **Tre** til bygging og brensel
- **Skrap** til makeshift utstyr og enkle sperringer
- **Metall** til gode sperringer, kjøretøy og våpen

**[Forslag]** Fase 1 bruker mat, vann, medisin, tre og skrap. Strøm, drivstoff og metall kommer gradvis.

**[Låst]** Vanligvis har du ikke nok ressurser til å gjøre alt. Ressursene må fordeles mellom:
- å oppgradere HQ,
- å oppgradere områdene dine,
- forsvar,
- angrep og tokt.

Beslutninger må tas. Seeden og startstedet kan gi griseflaks eller motgang. Det er en del av spillet.

**[Låst]** Ressursene skal komme oftere enn i dag. Fra playtesten: det gikk tomt for mat på Buøy.

**Sult [Forslag]:** En dag uten nok mat eller vann koster moral, og hver person kan miste 1 helse (`starveInjury` i fasetabellen). Den som allerede er på siste helse, kan dø av det. Sult skal merkes, men god planlegging gjør at den sjelden skjer.

**Ved [Bygget, runde 6]:** Fra fase 2 går det tre til ovnen hver dag (`heatPerCrew` i fasetabellen, rundet opp: 1 tre for opptil 8 personer). Toppfeltet viser veden ved siden av mat og vann: forbruk per dag og hvor mange dager den holder, rødt under 3. Mangler veden, står det én linje i loggen den dagen, og moralen synker 3 (`COLD_MORAL`). Tre sankes i boligfeltet; boten sanker tre når veden holder under fire dager.

**Moral [Bygget, runde 6]:** Moralen (0–100) går opp 2 hver natt og ned av død (−15), sult (−10/−12), kulde (−3), gjennombrudd og kjellerutbrudd. Den har nå konsekvenser begge veier (regelkonstanter i `skills.ts` og `engine.ts`, sjansen i fasetabellen):
- **80 eller mer:** alle jobber 5 % bedre (kamp, søk og bygging). Toppfeltet viser ▲.
- **Under 50:** −10 %. **Under 25:** −25 % (som før).
- **Under 20:** hver natt kan én i crewet pakke sekken og dra for godt (`desertChance` i fasetabellen: 0,08 i fase 1, 0,18 i fase 2, stigende til 0,25 i fase 5). Aldri lederen, aldri noen som er ute på tokt, og ingen drar når crewet er 3 eller færre. Personen får `gone_`-flagget (kommer aldri tilbake), og utstyret blir liggende på lageret. Toppfeltet viser ▼ og et varsel.
Fase 3–5 (crew-ledere med egen moral, bydeler, fraksjoner) kan bruke samme knott: lav moral i et crew betyr folk som forsvinner, ikke bare et tall.

**[Låst]** Mat blir vanskeligere å finne over tid, fordi alt er plyndret eller råttent. HQ må etter hvert produsere nok mat selv og oppgraderes for å holde tritt.

**[Forslag]**
- Butikker og lagre har en begrenset beholdning som tømmes.
- Fisk, hager og natur gir en jevn, men liten strøm av mat.
- Fra fase 2 overtar HQ-produksjonen gradvis.

**Drivstoff og strøm [Låst]:** Drivstoff er knapt. En elbil er kremen, fordi strøm kan produseres.

**Ammo [Låst]:**
- Vanlig ammo 3D-printes.
- Sjelden og spesiell ammo kan bare finnes.

**[Åpent]** 3D-printeren kan være det du trenger for å oppgradere produksjonen av ammo, altså en produksjonsoppgradering og ikke et gullfunn.

**[Forslag]** Ammo finnes ikke i fase 1 før dere har funnet skytevåpen.

### Reise

**[Forslag]** Hver sektor har en reiseavstand i dager fra basen.
- Nabosektorer koster 0 dager. Hele Buøy er nabo i fase 1.
- Lenger unna koster det dager å gå. Med kjøretøy koster det drivstoff eller strøm i stedet for dager.
- **Veirydding** halverer reisetiden på en rute permanent.
- Rydding langt unna gir dårligere utbytte, fordi en del tid går med til å komme dit.

### Kjøretøy

**[Forslag]** Kjøretøy kommer i fase 2, men kan finnes på slutten av fase 1 (Kolumbus-bussen, skoleskipet Gann).

Et kjøretøy er et kort med:
- type (bil, elbil, buss, båt),
- plasser (hvor mange som får plass),
- forbruk,
- tre oppgraderingsspor: pansring, last og motor.

Oppgraderinger lages av materialer med Mekk. Ingen detaljert tuning.

---

## 8. Tokt og quests

**[Låst]** Quests skal trekke deg ut av leiren.

**Quest [Forslag]:** kommer via sambandet eller et hendelseskort. Den har:
- et mål på kartet,
- en frist,
- en belønning (unikt utstyr, ny person, kjøretøydel, produksjonsutstyr).

**Tokt [Forslag]:** en gruppe drar ut i flere dager. Hver dag på toktet trekkes et encounterkort. Etter hvert kort, ved neste planlegging, velger dere:
- **fortsett** (mer belønning, mer risiko), eller
- **snu** (beholder det dere har).

Et tokt skal gi mer per dag enn å sanke hjemme: mer bytte, dobbel sjanse for kort og en belønning når det fullføres **[Forslag]**.

Toktgruppa har bare med seg det de bærer. Skader og brukt utstyr akkumuleres. Det er her «så vidt kom vi oss hjem» skal skje.

---

## 9. Utstyr

**[Låst]** Utstyr er kort med brettspillfølelse: navn, bilde eller ikon, verdier og en tørr Stavanger-tekst.

**[Låst]** Det finnes to familier:
- **Makeshift:** spesiallaget etter apokalypsen, ofte morsomme og spesielle.
- **Fra før:** sjeldne ting fra tiden før utbruddet.

Begge følger en basisverdi for sitt nivå.

**[Låst]** Nivået på det du finner, styres av hvor farlig stedet er, ikke av fasen. Risiko lønner seg: et tokt til et farlig sted i fase 1 kan gi utstyr over det du ellers har.

**Kortet [Forslag]:**

| Felt | Eksempel |
|---|---|
| Navn | 20 mm K-rør med gaffatape |
| Familie | Makeshift eller fra før |
| Spor | Våpen, beskyttelse, verktøy eller ammo |
| Nivå | 1–5. Basisverdien kommer fra nivået |
| Sjeldenhet | Vanlig, sjelden, episk eller unik |
| Bonus | En liten ekstra effekt, for eksempel +Snoking eller stille |
| Ferdighetspoeng | Fra sporet, ganger nivået (se under) |
| Holdbarhet | Antall bruk før det ryker. Makeshift ryker fort, ting fra før holder |
| Tekst | «Funnet bak Obs Bygg. Fortsatt med prislapp.» |

**Våpenegenskaper [Låst]:** Ingen DPS eller angrepshastighet. Våpen har noen få egenskaper som endrer *hva* du gjør:
- **Nærkamp eller avstand:** avstand gir lavere skaderisiko.
- **Støy:** stille, normal eller bråk. Bråk trekker zombier til sektoren. Stille gjør knipe mindre sannsynlig.
- **Spesialtagger:**
  - *gjennomslag* er godt mot seige og pansrede,
  - *spredning* er godt mot store grupper,
  - *rekkevidde* er godt på vakt.

Taggene kobles mot mutasjoner og forskning, og encounter-kort kan sjekke dem.

**Hva sporet gir [Forslag], i Fallout Shelter-stil:** Hvert kort gir ferdighetspoeng etter sporet, ganger kortets nivå, pluss kortets egen bonus. Poengene vises på kortet og som en grønn forlengelse av ferdighetsstolpen.

| Spor | Poeng per nivå | I tillegg |
|---|---|---|
| Våpen | +3 Muskler, +2 Prat | Kampkraft ×1,0–1,8 etter nivå (×0,8 uten våpen) |
| Beskyttelse | +3 Kondis, +2 Nerver | Skaderisiko −10 % per nivå |
| Verktøy | +3 Mekk, +2 Snoking | Søk og bygging +10 % per nivå |

Kampkraften fantes fra før og bygger på Muskler. Poengene gjør at utstyr også teller i encounter-sjekker, som bare ser på ferdighetene.

**Spor [Forslag]:** Hver person har tre spor: ett våpen, én beskyttelse og ett verktøy. Ammo hører til våpenet.

**Nivåtak [Låst]:** Trusselnivå og kortnivå bruker samme skala, 1–5. Et kort som finnes i en sektor, har maks nivå lik sektorens trusselnivå. Det finnes ikke et eget tak per fase.

**[Forslag]** På Buøy er trusselnivået 1–2.

**Unike kort [Forslag]:** Unike kort plasseres av seeden på bestemte steder. Hagla på Obs Bygg finnes ikke i hver runde. Unike kort kan være ett nivå over sektorens trusselnivå. De er toppen av belønningen for å ta risiko.

**Kortbiblioteket [Låst]:** Lageret er et bibliotek som er lett å sortere, for eksempel etter spor, nivå, sjeldenhet og holdbarhet. Du kan sette favoritt på kortene du liker best.

**Like kort stables [Låst]:** Har du 15 avsagde hagler, ligger de på samme plass i biblioteket med «×15». Der ser du verdiene og holdbarheten til kopiene.

**Demontering [Forslag]:** Kort kan demonteres til materialer, og demonteringsverdien vises på kortet. Makeshift gir nivå + 1 skrap, og ting fra før gir nivå × 2 + 1. Unike kort gir dobbelt. Favoritter kan ikke demonteres ved et uhell.

**Verktøy [Låst]:** Verktøy er et tillegg som gir en ekstra buff til det personen faktisk driver med.

**Fordeling:** Du gir kort til folk i crewet (fase 1–2) eller til ledere (fase 3–4). En våpensmed kan ta over fordelingen i senere faser.

**Innhold [Låst]:** Spilleren definerer et lite sett eksempelkort som setter tonen og nivået. En agent lager resten etter samme mønster.

### Våpenklasser og vekt – bygget

Hvert våpenkort har `weaponClass` (slag, egg, prosjektil, skytevåpen, brann, motor), hver beskyttelse har `weight` (lett eller tung), og kort med bestemt opphav («fra Obs») har `craftable: false` og lages aldri med Lage utstyr.

- **Støy** hentes fra klassen hvis kortet ikke setter sin egen: prosjektil er stille, skytevåpen og motor bråker, resten er normale (`CLASS_NOISE`).
- **Holdbarhet** settes per kort i dataene: egg slites raskere enn slag (typisk 8–10 mot 14–16), brann er engangs.
- **Tung beskyttelse** ganger skaderisikoen med 0,9 (`HEAVY_ARMOR_MULT`) og trekker 4 Kondis (`HEAVY_KONDIS_PENALTY`) fra kortets poeng. Lett har ingen av delene.
- **Bunnen:** `k_ror` er trekkerøret: egg, nivå 1, vanlig.
- Klassen og vekten vises som en chip på kortet. Katalogen har 10 slag, 8 egg, 7 prosjektil, 1 skytevåpen, 1 brann og 2 motor, og 8 lette og 7 tunge beskyttelser. Brekkjernet er to kort: `brekkjern_v` (våpen) og `brekkjern_t` (verktøy).
- Ennå ikke bygd: ammo, at brann brenner opp funn, at motorvåpen bruker drivstoff, og at forskning låser opp motspillene.

---

## 9b. Fase 2-start i betaen [Bygget, avtalt 30.10]

Betaen har med starten av fase 2. Avgjort med eieren: bare Rosenberg som HQ, Buøy holdes og forfaller sakte, og rollene i HQ er faste poster.

**Overgangen:** Når fase 1 avsluttes (målet nådd, eller fristen på normal/hard), muterer zombiene, og Rosenberg Verft åpnes. Gjerdet har holdt horden inne. Nå skal dere inn.

**Rosenberg som sektor:** Verftet blir en vanlig sektor fra fase 2 (`opensInPhase: 2`), med trussel 5, en stor horde, mange gjemte zombier og mye å finne (metall, skrap, drivstoff, mat i kantina). Det tas på samme måte som sektorene på Buøy: rydde, gjennomsøke og holde kontroll. Transport trengs ikke, fordi verftet ligger rett bak gjerdet.

**Skjulte verdier:** Verftet har fire anlegg, og tilstanden til hvert (god, middels eller ødelagt) er trukket av seeden og skjult:
- **Verkstedhallen:** Lage utstyr gir ett nivå høyere, og utstyr kan repareres.
- **Kantina:** gir mat hver dag.
- **Kontorbygget:** Trene gir 50 % mer erfaring. Plass til laben senere (fase 2–3).
- **Kaia:** fisk, 1 mat per dag (2 med Skoleskipet Gann). Tokt over vann senere.
Speiding og gjennomsøking gir rykter («Kantina ser ut til å ha tak»). Den sanne tilstanden vises når verftet er tatt.

**HQ tatt:** Når Rosenberg er trygg, er HQ-et tatt. Det gir senger, og postene åpnes. Et anlegg settes i stand med oppdraget «Sette i stand», som koster materialer. Et anlegg i god stand er billigere.

**Faste poster:** En person settes på en post og blir der. Personen gjør ikke dagsoppdrag, men gir en fast bonus etter ferdigheten sin:
- **Sikkerhetssjef** (Nerver): sterkere vakt om natta ved alle porter.
- **Byggeleder** (Mekk): mer arbeid per befesting og istandsetting.
- **Kokk** (Prat): mindre forbruk av mat.
Det er et valg: en god arbeider i en post er en arbeider mindre ute.

**Buøy:** Sektorene dere har tatt, holder seg trygge en stund, men kontrollen forfaller sakte. Portene må fortsatt holdes om natta.

**Fasemålet i fase 2 (betaen):** Rosenberg er trygg, og minst ett anlegg er satt i stand. Etter det: «Fortsettelse følger» (fase 3 er ikke bygd).

**Transport [Bygget, runde 6]:** Kolumbus-bussen (flagget `buss`, funnet på industriområdet) gjør at tokt tar én dag mindre fra fase 2 (`toktDays`, aldri under én dag). Skoleskipet Gann (flagget `gann`, funnet på kaia) går ut med garn fra verftskaia når kaia er satt i stand, og gir 1 mat ekstra per dag. Fase 3–5: bussen er naturlig transport til naboområdene, og Gann et utgangspunkt for tokt over vann.

**[Åpent]** Hvor sterk horden og bonusene skal være, settes med simulering.

### Slik er det bygd

- **Sektorer per fase:** `SectorDef.opensInPhase`. Verftet (`rosenberg`) er en vanlig sektor i tilstanden fra start, men låst til fase 2. Alle regler løkker over `activeSectors(s)`. Fase 1-målet gjelder bare fase 1-sektorene. Når en fase starter (`nextPhase`), åpnes fasens sektorer med zombier ganget med fasens `zombieMult` (med vanskelighet og mutasjoner), og overgangen logges. Gamle lagringer får verftet og HQ-et lagt til, og en vunnet fase 1 fra før fase 2 fantes blir et nådd mål, så fase 2 kan startes.
- **Verftet:** trussel 5, 100 zombier og 28 gjemte (×1,7 i fase 2 = rundt 170 og 48), 8 senger, mye metall, skrap og drivstoff, litt mat (20 før `lootMult`). Sanke gir metall, skrap og drivstoff. Funnet ved 50 %: stål og diesel i lagerhallen, og bedriftshelsetjenestens skap (6 medisin).
- **Anleggene** (`src/engine/hq.ts`, tekster i `places.ts`): tilstanden trekkes fra seeden med en egen tallrekke (god 30 %, middels 40 %, ødelagt 30 %), så fase 1 er helt lik som før. Speiding av verftet gir alltid ett rykte, og gjennomsøking gir et rykte med 50 % sjanse. Et rykte stemmer i 75 % av tilfellene; med en sveiser i crewet stemmer det alltid. Når verftet er trygt i fase 2, er HQ-et tatt, og den sanne tilstanden vises.
- **Sette i stand** (`istand`): arbeid etter buildPower til 50 (god), 80 (middels) eller 120 (ødelagt), 1 metall eller skrap per 3 arbeid. Tåler høyst 2 streifere på verftet (`ISTAND_STRAGGLERS`, som `GATE_STRAGGLERS` for porter): gruppa tar dem først, med samme regel og skaderisiko som laget ved porten. Før stengte ett mislykket encounter (+1 zombie) istandsettingen.
- **Rosenberg-gjerdet etter HQ-et:** porten har `holds: 'rosenberg'`. Når HQ-et er tatt, er verftet deres, og gjerdet slipper ikke inn noe om natta lenger (`gateQuiet`). Porten kan fortsatt befestes og voktes, men det trengs ikke. Panelet sier det.
- **Effekter:** verkstedhallen gir Lage utstyr ett nivå høyere (høyst 3) og oppdraget Reparere (full holdbarhet for 2 skrap per kort, 1 kort pluss 1 per 30 Mekk per dag). Kantina gir 3 mat per dag. Kontorbygget gir 1,5 × erfaring av Trene (`KONTOR_TRAIN`). Kaia gir 1 mat per dag, 2 med Gann (`KAI_FOOD`, `GANN_FOOD`). Mat fra anleggene står i én logglinje og i postkortet. Tallene er regelkonstanter i `hq.ts` og `tokt.ts`, tekstene i regionpakken (`places.ts` og `content/texts.ts`).
- **Poster** (oppgaven `post`, en per post, blir der fra dag til dag): sikkerhetssjef gir 0,8 vaktkraft per 10 Nerver ved hver port om natta, også uten vakter; byggeleder +6 % arbeid per 10 Mekk på befesting og istandsetting; kokk −5 % mat per 10 Prat (høyst −40 %). Bonusene er regelkonstanter i `hq.ts`, ikke i fasetabellen: de sier hva crewet får til, ikke hvor sterke zombiene er.
- **Nattepresset regnes fra fasestarten:** sjansen for gjennombrudd vokser med `phaseDay(s) × nightGrowth` og størrelsen med `phaseDay(s) / breachDays`, der `phaseDay` er dagen i fasen (1 på første dag). Før vokste det med dagen i runden, så fase 2 startet med presset fra fase 1 oppå sin egen `nightBase` og endte nær taket. Fase 1 starter på dag 1, så der er tallene helt like (simuleringen gir byte-identisk utskrift). `nightBase` og `breachDays` for fase 3–5 er justert for dette, men ikke simulert.
- **Buøy i fase 2:** knotten `heldDecay` i fasetabellen (fase 2: 1, fase 3: 1,5, fase 4–5: 2) er kontrollen sektorer fra en tidligere fase mister per dag uten folk, mot `controlDecay` for de nye. Portene virker som før.
- **Fasemålet:** verftet trygt og minst ett anlegg i stand. Fase 2 er siste bygde fase (`BUILT_PHASES`), så å avslutte den gir seier: «Fortsettelse følger». Fristen er fasetabellens 60 dager; går den ut uten mål, er runden tapt på alle grader, fordi det ikke finnes en fase 3 å tvinges over i.

### Tall fra simuleringen (300 runder, normal)

Fase 1 er uendret: standardcrewet vinner 95 % med median 27 dager, kombinasjonene 89–96 % med median 28–29 (byte-identisk med før endringene).

Boten spiller videre i fase 2 (`npm run sim -- 300 --fase2`): den rydder verftet med fire når minst tre er friske, gjennomsøker det med en gang horden er borte, rydder portsektorene på Buøy før resten, sanker mat før kamp, setter folk på poster, leter etter overlevende til seks når det er mat nok, og setter i stand anlegget som er billigst å gjøre ferdig.

| Crew | Seier i fase 2 før → nå | Median dager i fase 2 før → nå | Crew mistet per runde (hele runden) før → nå |
|---|---|---|---|
| Standard (Arild, Mona, Tor-Egil) | 76 % → 88 % | 16 → 26 | 1,77 → 0,79 |
| Kombinasjon 1 | 65 % → 77 % | 19 → 31 | 2,30 → 1,04 |
| Kombinasjon 2 | 77 % → 82 % | 17 → 27 | 1,74 → 0,96 |
| Kombinasjon 3 | 62 % → 76 % | 18 → 29 | 2,47 → 1,19 |
| Kombinasjon 4 | 64 % → 74 % | 18 → 28 | 2,59 → 1,47 |

**Mål for fase 2 [Forslag]:** standardcrewet vinner 80–92 %, kombinasjonene minst 72 %, median 22–40 dager i fase 2, og sultespiraler er ikke hovedgrunnen til tap. `tests/balance-fase2*.test.ts` (80 runder per crew, tre filer som kjører i parallell) feiler hvis dette glipper. En sultespiral er minst tre sultedager i fase 2 som begynte før dag 30 i fasen; under en tredel av tapene får være slike.

**Endringer i balansen (30.10), og hvorfor:**
- **Nattepresset fra fasestarten** (se over). Det tok bort hovedgrunnen til at rundene ble tosidige: med dagen i runden var portene nær taket fra midten av fase 2, og Buøy raste sammen mens crewet var på verftet. Fase 2 har `nightBase` 0,05 (en natt i starten av fase 2 er omtrent like farlig som slutten av fase 1) og `breachDays` 6, så gjennombruddene vokser saktere i størrelse.
- **Større horde, litt mindre skade per trussel:** verftet har 100 zombier i stedet for 52. Det er det som gjør fasen lengre. `THREAT_INJURY` er 1,45 for trussel 4 og 1,55 for trussel 5 (før 1,6 og 1,9). Risikoen i Rydde når fortsatt taket (45 %) mens horden er stor, men faller under det når en gruppe på fire har tynnet den til rundt 15–20. Verftet er fortsatt det farligste stedet i spillet.
- **Mat og vann i fase 2:** `yieldMult` 0,95 (havet ved kaia er ikke plyndret, selv om butikkene er det), `rainChance` 0,4 (Stavanger-høst), og kantina på verftet har mat 20 i stedet for 14 å finne. Kantina gir fortsatt bare mat hver dag når den er satt i stand. Medisin var flaskehalsen i kampen om verftet, så bedriftshelsetjenesten gir 6 medisin i funnet ved 50 %.
- **Boten:** rettet fire åpenbart dumme valg i fase 2. Den hvilte folk med 1 i liv på tom mage (hvile virker ikke da), sanket mat der det nesten ikke er mat når et par streifere sto i den beste matsektoren, rekrutterte flere munner mens maten var tom, og lot verftets kjellere stå usjekket når horden var borte, så de brøt ut igjen. Den rydder også portsektorene før resten av Buøy. Den er fortsatt enkel: ingen vakt ved portene mens den angriper, og den velger anlegg etter pris, ikke nytte.
- **Prøvd og forkastet:** mer arbeid i anleggene (istandsetting 150–260) gjorde fasen bare to dager lengre, men tapte runder der HQ-et var tatt og materialene tok slutt.

Tapene nå: omtrent to av tre er tidsfristen uten at verftet er tatt, fordi kampen trekker ut og medisinen tar slutt. Runder som ble tvunget over av fristen i fase 1, kommer inn med halve Buøy infisert igjen og taper nesten alltid. Sult kommer i tapte runder, men sent (median rundt dag 40 i fasen), etter at kampen allerede har gått tapt.

**Runde 6:** Gjerdet slipper ikke inn noe etter at HQ-et er tatt, istandsetting tåler et par streifere, og kontorbygget, kaia, Gann og bussen gir hver sin effekt. Det gjorde fase 2 lettere, så verftet i fase 2 har `zombieMult` 1,45 (før 1,3).

**[Åpent]** Om en runde som er tvunget over av fristen bør få en bedre sjanse i fase 2.

## 10. Basen, ledere og politikk (fase 2–5)

Dette er retning, ikke spesifikasjon. Fase 1 skal ikke bygge noe av det, men må ikke stenge for det.

- **[Forslag]** Fra fase 2 har basen poster: sikkerhetssjef, byggeleder, våpensmed, kokk og forsker. En tom post betyr at du gjør jobben selv.
- **[Forslag]** Fra fase 3 har hver crew-leder et eget crew og egen moral. Basen har en stemning. Tøffe prioriteringer gir murring, og ubehandlet murring blir opprør.
- **[Forslag]** I fase 4 fordeles inntekt fra bydeler i prosent på grener: forsvar, bygg, mat og handel. Et nytt HQ kan få en guvernør, og da ser du bare netto inn og ut.
- **[Åpent]** Styreform, for eksempel demokrati, diktatur eller råd, velges et sted i fase 3–4, med reelle byttehandler.
- **[Låst]** Kjernecrewet ditt kan alltid sendes ut direkte, uansett fase.

---

## 11. Fase 1 – det vi bygger nå

**Omfang [Låst]:** Bare Buøy. Hundvåg kommer når vi er fornøyde med Buøy.

**Mål for fase 1 [Bygget]:** Sikre Buøy. Målet er nådd når alle Buøy-sektorer er trygge og alle portene er på nivå 3 (`goalGateLevel` i fasetabellen). Nivå 3 er det store løftet (`GATE_STEPS`: 6, 16 og 90 arbeid), så tre og skrap blir en ekte flaskehals: bygge eller sanke. Etter målet har du 10 dager før fasen avsluttes av seg selv.

### Endringer fra dagens prototype

1. **Rydde** erstatter klarering og finsjekk.
2. **Sektorer** får tre verdier (infisering, gjennomsøkt og kontroll), og verdiene forfaller når sektoren ikke er under kontroll.
3. **Sektortyper og profiler** vises tydelig på kartet, sammen med bosetting og kapasitet.
4. **Sanke** erstatter Lete og gir sektorens ressurs. Mer loot totalt. Butikker tømmes, mens natur og sjø gir jevn mat.
5. **Ressurser:** mat, vann, medisin, tre og skrap i fase 1. Dagens `materialer` deles i tre og skrap.
6. **Utstyrskort** erstatter dagens felles utstyrsnivå (`s.gear`): tre spor per person, makeshift og fra før, holdbarhet, nivå etter trusselnivå, og noen få unike kort per seed.
7. **Oppgaven Lage utstyr** lager makeshift-kort av materialer.
8. **Død:** utstyret faller til lager eller sektor. Spilleren kan dø uten at spillet er over.
9. **Nye oppgaver:** Vakt på sektor, Speide, Trene, Pleie og Lete etter overlevende.
10. **Ferdigheter** går fra 1–5 til 1–100 internt, vist som stolpe og nivå, med erfaring.
11. **Trusselnivå per sektor** og **encounters** med uttrekk, valgt ved neste planlegging.
12. **Første quest og første tokt** innenfor Buøy, for eksempel å hente noe på Rosenberg-gjerdet eller ute ved Sørspissen.
13. **Faseskifte:** etter at målet er nådd, velger spilleren selv når fasen avsluttes, innen 10 dager. Mutasjonsmatrisen og poengtrekking ved faseskifte bygges i motoren og fasetabellen, men har ingen effekt før fase 2 finnes.
14. **Tutorial:** de tre første dagene guider spilleren gjennom Rydde, Bygge og Vakt via sambandet.

### Spenning og økonomi [Forslag]

Fra gjennomgangen 30.10: fase 1 var spillbar, men uten fare. Disse reglene gir spenning uten å ta bort at crewet blir sterkere:

- **Ingen sjekk er sikker:** sjansen stopper på 90 % (`ODDS_MAX`), og hvert trusselnivå over 1 trekker 8 prosentpoeng fra i encounters (`THREAT_ODDS`).
- **Porten stenges ikke av noen få zombier:** med høyst 2 zombier i portens sektor kan porten befestes og voktes. Laget tar dem først, og vakt og befesting gir kontroll i portens sektor.
- **Varsel ved porten [Bygget]:** bare varsel, ingen regel. Spillet sier fra når en port er i ferd med å låse seg, over «Avslutt dag», som en pulserende ring rundt porten på kartet, i portkortet og i dagsrapporten etter natta (rapporten viser gult bare når det er nytt, rødt hver dag). Regnes av den rene funksjonen `gateAlerts` (`src/engine/portvarsel.ts`), som verken bruker rng eller endrer tilstanden, og følger portene og `mods(s)` i alle fem faser.
  - **Gult, porten står ubevoktet:** portens sektor har flere enn `GATE_STRAGGLERS` zombier, så porten kan verken befestes eller voktes. Varselet sier hvilken sektor som må ryddes, og at de som rydder der, tar imot det som kommer om natta (`SECTOR_GUARD`).
  - **Rødt, vokser fra dere:** hele crewet (alle som ikke er på tokt og ikke er hardt skadet) ville ryddet færre i sektoren enn det som forventes å komme inn i natt, og klarer ikke hele sektoren på én dag. Ryddingen er forhåndsvisningen (`previewTask`). Innsiget er sjansen ved porten ganger forventet gjennombrudd, etter det crewet tar imot med halv styrke, fra alle porter som slipper inn i sektoren (Rosenberg-gjerdet med sin andel av `spills`), pluss det som siver inn (`creepChance`) og det bråket fra ryddingen trekker til seg (`noiseAttract`). Natta og varselet bruker de samme hjelpefunksjonene (`nightChance`, `breachSpan`, `breachSize`, `nightDefense`, `creepOdds`), så formelen står ett sted.
  - Porter som ikke slipper inn noe lenger (`gateQuiet`), varsles ikke.
- **Ingen blir friskere på tom mage:** uten nok mat og vann til dagen virker verken hvile eller pleie.
- **Knappere økonomi:** sektorene har mindre å finne (`lootMult`), sanking gir mindre (`yieldMult`), det regner sjeldnere (`rainChance`), og maten på lageret blir dårlig litt hver dag (`stashRot`). Fyring (`heatPerCrew`) er av i fase 1 og slår inn fra fase 2.
- **Tokt har ekte risiko:** hver dag ute kan noen bli skadet (oftere jo farligere), og da mister gruppa en tredel av byttet i flukten. Beslutningen om å fortsette eller snu viser helsen til gruppa.
- **Dårlige valg:** omtrent en tredel av hendelsene er rent negative, og noen encounters har bare dårlige valg.
- **Vanskelige sjekker:** et valg i en hendelse eller et encounter kan ha sin egen grunnsjanse (`checkBase`, ellers 0,25), og å verve en fremmed bruker −0,25 (`STRANGER_BASE`), så bare den beste praten har en reell sjanse.
- **Tokt er turer til strategiske steder** som gir det du ikke får hjemme. Du kan vinne fase 1 uten dem, men de gjør overlevelsen lettere.
  - **Apoteket på Hundvåg** åpnes av hendelsen «Medisinskapet er tomt», som kommer ved første skade, eller senest dag 6. Første tur er trygg: ingen knipe og ingen skader. Senere tur gir mindre, fordi stedet er delvis tømt.
  - **Køen på Bybrua** åpnes av et rykte på radioen fra dag 8. Den gir drivstoff, metall og bildeler, viktig for transport i fase 2.
  - **Kranføreren** åpnes av SOS-hendelsen. Roger blir med dere hjem.
  - Ute kan gruppa finne overlevende som aldri ville kommet til porten.
- **Medisin er knapp:** dere starter uten medisin, og sektorene har lite. Apoteket er stedet med mye. Uten medisin helbreder hvile fortsatt av og til, så toktet er verdifullt, men ikke tvunget.
- **Comeback:** når to eller færre er igjen, kan en nabo banke på om natta (30 %).
- **Lage utstyr** lager aldri kort med et bestemt opphav (`craftable: false`).
- **Boten** velger hendelsesvalg ut fra forventet verdi, slik en spiller leser forhåndsvisningen.

### Lengre fase 1 (30.10) [Bygget]

Fra spilltesten: fase 1 skal ta rundt 50 dager, og det som var frustrerende, skal bort.

- **Portens sektor holder også vakt:** de som er ute i sektoren porten ligger i (Rydde, Sanke, Vakt der), tar imot det som kommer gjennom porten om natta, med halv kampkraft (`SECTOR_GUARD`). Før gikk zombiene rett forbi fem personer som nettopp hadde ryddet sektoren.
- **Mer mat i starten:** alle fase 1-sektorene har 2,5 ganger så mye mat og 1,5 ganger så mye vann å finne. Flere i crewet skal gjøre ting raskere, ikke gjøre maten til problemet. Den som går tom, sliter sent i fasen.
- **Kaia gir jevn mat:** sanking gir 6 mat (før 4), og Boligfeltet gir 2 (før 1). Det er den fornybare maten i en lang fase.
- **Helbredelse koster noe:** Pleie og nattevakt var garanterte, så medisinen ble aldri brukt. Se Pleie i kapittel 3.
- **Verftet i fase 2** har `zombieMult` 1,7 (før 1,45), fordi crewet nå kommer inn i fase 2 med mer på lageret.
- **[Bygget] Grossistlageret på Forus:** et tokt etter mat, låst til radioryktet «Lageret på Forus» kommer (fra dag 30, eller fra dag 18 når fem av Buøy-sektorene er trygge). Toktet går gjennom Bybrusperringen, tar 3 dager og har trussel 4, så skader underveis er sannsynlige. Fullført gir det 30 mat og 10 vann i tillegg til byttet underveis, og halvparten neste gang.
- **[Bygget] Flere hendelser sent i fasen:** 19 nye hendelser, de fleste med krav om dag 12–40 eller om crewets størrelse, så en lang runde ikke går tom. Omtrent en tredel er gode, en tredel vonde og en tredel sjansespill der sjekken avgjør et stort utslag.
- **[Bygget] Utenfor finnes bare crewet, andre overlevende og zombier.** En som er alene, kan verves med en svært vanskelig Prat-sjekk og blir en ekte nabo med ferdigheter og egenskap (bare når det finnes en ledig seng). En gruppe kan dere handle med, true eller la være, men den blir aldri med.

### Mål for balanse

**[Forslag]** Fra 30.10: fase 1 skal ta rundt 50 dager i snitt. En god runde kan ta 25, en dårlig 75, og etter målet kommer 10 dager til farming.
- Boten vinner 85–97 % med hver kombinasjon (siktet mot 88–95 %).
- Botens median er 38–50 dager til målet. Boten spiller jevnt, så spredningen hos ekte spillere blir større enn hos boten, og snittet havner nærmere 50.
- Mat skal ikke være den vanligste dødsårsaken.
- **[Åpent]** Flaks i hendelsene. Hendelser kommer aldri to ganger i samme runde. Boten ser i snitt 27 av dem i fase 1, og den siste kommer rundt dag 42, så en treg runde går de siste ukene uten hendelser. Skal flaks og ferdighet balansere over 50–75 dager, trengs flere hendelser, og et større sprik mellom de gode og de vonde. Første steg er bygget: se «Flere hendelser sent i fasen» over.

Balansetesten i `tests/balance.test.ts` oppdateres til de nye reglene.

---

## 12. Arbeidsstrømmer

Disse kan deles ut til egne agenter når dokumentet er godkjent.

**[Forslag]**
- Motoren låser datatypene først: kortformat, encounterformat, sektorverdier og ferdighetsskala.
- Motoren leverer med enkelt plassholderinnhold.
- Innholdsstrømmene fyller inn det ekte innholdet etterpå.
- Spilleren gir retning, for eksempel eksempelkort eller hvilke lokale kallenavn som skal brukes. Agentene researcher og lager resten.

| Strøm | Ansvar | Avhenger av |
|---|---|---|
| Motor fase 1 | Punkt 1–13 i kapittel 11, tester og balansesim | Dette dokumentet |
| Utstyrskort | Makeshift- og førkrigs-kort med Stavanger-tekster, ut fra spillerens eksempler | Kortformatet i motoren |
| Personer og navn | Naboer med lokale kallenavn fra Stavanger og Sandnes, egenskaper og replikker | Ferdighetsskalaen |
| Hendelser og quests | Nye kort, encounters og første tokt | Encounter-formatet |
| Kart | Sektortyper og ikoner på Buøy. Hundvåg senere | Kartpipelinen |
| UI og visuelt | Kortvisning, sektorverdier på kartet, utstyrsspor | Motorens tilstand |
| Tutorial | De tre første dagene | UI og motor |

---

## 13. Åpne spørsmål

- **Multiplayer:** samarbeid, rivaler eller begge deler. Motoren må forbli deterministisk så begge er mulige.
- **Styreform:** hvilke valg, når og med hvilke byttehandler.
- **Forskningstre:** størrelse, innhold, og om noe av det finnes i fase 1.
- **Score:** er det bare antall dager, eller også tap, funn og vanskelighetsgrad?
- **Eksempelkort:** spilleren lager et lite sett utstyrskort som setter tonen før innholdsstrømmen starter.
