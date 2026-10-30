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
4. **Hendelseskort:** sambandet, ofte med et valg.

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
- Det er en grense på antall turer per fase, **[Forslag]** 50 turer, og tallet er ikke låst. Når fasemålet er nådd, velger du selv når du går videre, og ved grensen må du over. Er målet ikke nådd ved grensen, er runden tapt **[Forslag]**. Spillet viser derfor «Frist for fasemålet» før målet er nådd, og «Fase 2 tvinges om» etterpå.
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
| Pleie | 1 | Helbreder raskere enn hvile. En lege- eller sykepleieroppgave |
| Tokt | 1 | Ekspedisjon over flere dager til et fjernt mål (se kapittel 8) |
| Forske | 2 | Undersøker zombieprøver i laben (se kapittel 6) |
| Veirydding | 2 | Gir kortere reisetid permanent på en rute |
| Kjøre / transport | 2 | Bruker kjøretøy og drivstoff eller strøm |
| Holde ro | 3 | Holder moralen og stemningen oppe i en base |
| Spionasje | 3 | Fanger opp murring og opprør, senere fraksjoner |
| Handle / diplomati | 5 | Byttehandel og avtaler med fraksjoner |

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

**Innsatsen vises [Forslag]:** Hvert valg viser før du velger hva det kan gi når det lykkes, og hva det kan koste når det går galt, for eksempel «+1 medisin» eller «opptil −2 mat · kan gi skade». Etterpå vises hva som faktisk endret seg. Det samme gjelder hendelser som måkene. Alt som teller for fasemålet skal vises, også portarbeid, nye i crewet, oppdrag, speidede sektorer, kontroll og gjennomsøkt.

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

---

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

**Mål for fase 1 [Forslag]:** Sikre Buøy. Målet er nådd når alle Buøy-sektorer er trygge og alle portene er på nivå 2 eller mer. Etter det velger du selv når fasen avsluttes, innen grensen på antall turer.

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
13. **Faseskifte:** etter at målet er nådd, velger spilleren selv når fasen avsluttes, innen en grense på antall turer (foreløpig 50, ikke låst). Mutasjonsmatrisen og poengtrekking ved faseskifte bygges i motoren og fasetabellen, men har ingen effekt før fase 2 finnes.
14. **Tutorial:** de tre første dagene guider spilleren gjennom Rydde, Bygge og Vakt via sambandet.

### Spenning og økonomi [Forslag]

Fra gjennomgangen 30.10: fase 1 var spillbar, men uten fare. Disse reglene gir spenning uten å ta bort at crewet blir sterkere:

- **Ingen sjekk er sikker:** sjansen stopper på 90 % (`ODDS_MAX`), og hvert trusselnivå over 1 trekker 8 prosentpoeng fra i encounters (`THREAT_ODDS`).
- **Porten stenges ikke av noen få zombier:** med høyst 2 zombier i portens sektor kan porten befestes og voktes. Laget tar dem først, og vakt og befesting gir kontroll i portens sektor.
- **Ingen blir friskere på tom mage:** uten nok mat og vann til dagen virker verken hvile eller pleie.
- **Knappere økonomi:** sektorene har mindre å finne (`lootMult`), sanking gir mindre (`yieldMult`), det regner sjeldnere (`rainChance`), og maten på lageret blir dårlig litt hver dag (`stashRot`). Fyring (`heatPerCrew`) er av i fase 1 og slår inn fra fase 2.
- **Tokt har ekte risiko:** hver dag ute kan noen bli skadet (oftere jo farligere), og da mister gruppa en tredel av byttet i flukten. Beslutningen om å fortsette eller snu viser helsen til gruppa.
- **Dårlige valg:** omtrent en tredel av hendelsene er rent negative, og noen encounters har bare dårlige valg.
- **Tokt gir det du ikke får hjemme:** materialer i bulk til en bestemt port når toktet fullføres (bilvrak foran Bybrusperringen, containere ved Rosenberg-gjerdet, +18 portarbeid), og sjansen for å finne overlevende ute (10–25 % per dag) som aldri ville kommet til porten. Senere: nøkler til fase 2 (transport, drivstoff), unike kort og ammo fra nøkkelsteder.
- **Comeback:** når to eller færre er igjen, kan en nabo banke på om natta (30 %).
- **Lage utstyr** lager aldri kort med et bestemt opphav (`craftable: false`).
- **Boten** velger hendelsesvalg ut fra forventet verdi, slik en spiller leser forhåndsvisningen.

### Mål for balanse

**[Forslag]**
- En god spiller når målet i fase 1 på 20–30 dager.
- Boten vinner minst 85 %.
- Mat skal ikke være den vanligste dødsårsaken.

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
