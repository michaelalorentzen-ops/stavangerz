# Stavanger Z – Phase 1 Gameplay & World Design Revision

## 0. Oppdrag og prioritet

Vi har nå gjennomført en reell spilltest av Stavanger Z fase 1 fra dag 0 til dag 15, og har diskutert spillvisjonen grundig.

Spillet fungerer teknisk, men vi må utvikle spilleropplevelsen videre før vi går til fase 2.

Dette dokumentet er en styrende produkt- og spilldesignrevisjon. Det supplerer tidligere Game Design Decisions og overstyrer eldre beskrivelser der de er i konflikt.

**Hovedmål:**

Skape et turbasert geografisk survivalstrategispill hvor spilleren opplever å overleve en zombieapokalypse i et virkelig Stavanger, gradvis sikre territorier, utvikle en base og bygge et lite samfunn.

Prioriter meningsfulle beslutninger, realistisk sammenheng mellom systemer, lokal identitet og følelsen av progresjon.

Ikke bygg flere systemer bare fordi de er beskrevet her. Gjennomgå først hva som allerede finnes, og videreutvikle det kontrollert.

Ingen full omskriving av eksisterende spill eller simuleringsmotor.

---

## 1. Spillets identitet

Stavanger Z skal kombinere elementer fra:

- **Fallout Shelter:** Overlevende, behov, rekruttering, baseutvikling og følelsen av å bygge noe eget.
- **Civilization:** Ressurser, produksjonsmuligheter, teknologi, territoriell utvikling og strategiske valg.
- **Risk:** Territoriekontroll, ekspansjon, forsvar og risiko ved å spre styrkene for tynt.
- **Dead of Winter:** Uforutsigbare hendelser, vanskelige moralske beslutninger og konsekvenser.
- **Planet Zoo:** Infrastruktur og forsvarsverk som fungerer bedre når de er tilstrekkelig bemannet og vedlikeholdt.

Dette er inspirasjon, ikke instruks om å kopiere de eksisterende spillenes systemer.

**Spilleren skal føle:**

1. Usikkerhet og panikk ved utbruddet.
2. Tilknytning til de første overlevende.
3. Spenning når man sender folk ut.
4. Mestring når nabolag og områder gjenerobres.
5. Ansvar når andre mennesker blir avhengige av en.
6. Strategisk tilfredsstillelse når teknologi, utstyr og infrastruktur skaper nye muligheter.
7. At verden reagerer logisk på beslutningene.

Stavanger Z skal ikke føles som et regneark med zombier.

---

## 2. Ny geografisk retning – vedlagt kartbilde

Det vedlagte kartbildet er ny geografisk designreferanse.

### Hierarki

**L1 – Region**

Hele Hundvåg og Byøyene innenfor kartutsnittet er én L1-region.

**L2 – Distrikt**

Blå linjer viser foreslåtte L2-grupper.

Dette er større geografiske enheter som spilleren etter hvert skal kunne kontrollere, forsvare og administrere samlet.

**L3 – Operativ sone**

Røde linjer representerer foreslåtte L3-soner.

Dette er områdene spilleren rydder, undersøker, overtar, sikrer og utvikler i fase 1.

### Prinsipper for soneinndelingen

- Bruk veier, sjø, terreng og naturlige nabolag som inspirasjon.
- Prioriter logiske, visuelt pene polygoner fremfor GIS-perfeksjon.
- Sonene trenger ikke være like store.
- Tettere bebyggelse gir normalt mer arbeidsmengde, større befolkningsgrunnlag og potensielt flere zombier.
- En L3-sone skal tilhøre nøyaktig én L2.
- L2-distrikter skal ikke overlappe.
- Øyer uten landforbindelse må ikke behandles som direkte tilgjengelige nabosoner.
- Broer, tunneler og andre viktige passasjer skal modelleres som forbindelser.
- Kartet må kunne utvides senere uten at hele verdensmodellen bygges om.

De håndtegnede grensene er konseptuelle. Ikke spor dem slavisk eller behandle streker gjennom sjøen som eksakte koordinater.

### Spesielt viktig

Ikke lag unødvendige små soner bare fordi det finnes et veikryss.

Et veikryss kan være et strategisk punkt i forbindelsesgrafen uten å være et eget territorium.

Hver L3 bør ha en forståelig identitet, eksempelvis boligområde, kai, industriområde, handel, skog, jordbruk eller blandet bebyggelse.

Behold geografiens strategiske betydning. Naturlige barrierer og forbindelser skal ha faktisk påvirkning på risiko, reise og territoriekontroll.

**Før denne geografien implementeres fullt ut:**

Lag ett ryddig kartutkast med L1/L2/L3, tydelige ID-er, strategiske forbindelser og forslag til justeringer.

Ikke gjennomfør langvarig forskning på hver port eller eiendomsgrense.

Bevar eksisterende spilltilstander gjennom verdensversjonering eller en eksplisitt migrering dersom geometrien endres.

---

## 3. Fase 1 – Fra overlevende til et sikret distrikt

Fase 1 skal være en betydelig del av spillet, ikke en kort tutorial.

Den kan vare flere timer.

Spilleren starter med fire mennesker og begrenset utstyr.

Målet er å etablere et fungerende HQ, overta et sammenhengende L2-distrikt og gjøre yttergrensene tilstrekkelig sikre til at samfunnet kan utvikle seg videre.

### Dag 0 – Introduksjon

Vi trenger en kort, stemningsfull introduksjon.

Utbruddet har akkurat skjedd.

Spilleren og tre venner har klart å søke tilflukt i et hus eller en midlertidig trygg lokasjon.

Det er kaos utenfor. Informasjonen er mangelfull. Ingen vet hvor omfattende katastrofen er.

Spilleren finner fram et lite beredskapslager og en gammel bok:

**The Zombie Apocalypse Survival Handbook**

Boka gir praktiske råd for de første dagene:

- Hold lav profil.
- Finn ut hva som skjer rundt deg.
- Skaff beskyttelse, våpen og verktøy.
- Arbeid sammen.
- Unngå unødvendig støy.
- Sikre et sted å sove og oppbevare forsyninger.

Boka fungerer som en gradvis introduksjon til spillmekanikken.

Den skal gi anbefalinger, men spilleren må stå fritt til å gjøre noe annet.

En erfaren spiller skal kunne velge en risikabel snarvei.

Vi ønsker en tydelig følelse av at disse fire menneskene faktisk kjenner hverandre og har endt opp sammen av en grunn.

---

## 4. Arbeidsmodell og sonerydding

**Én tur er alltid én dag.**

Arbeid skal beregnes ut fra arbeidsmengde, tilgjengelig personell, ferdigheter, utstyr, reise, sikkerhet og andre relevante forhold.

Spilleren skal aldri måtte undersøke ett og ett hus manuelt.

### L3-sonens operative aktiviteter

En sone kan ha forskjellige grader av kunnskap, kontroll og ferdigstilt arbeid:

- Ukjent
- Rekognosert
- Utvendig ryddet
- Innvendig undersøkt, helt eller delvis
- Kontrollert
- Sikret

Disse skal ikke nødvendigvis være én lineær sekvens.

Man kan kontrollere en sone uten å ha undersøkt alle bygningene.

Man kan raide et POI uten å overta hele sonen.

Man kan også ekspandere raskt og akseptere høyere risiko.

### Arbeidsmengde

Bygninger representeres gjennom beregnede arbeidsenheter basert på bygningstype, størrelse eller anslått antall boenheter.

Eksempel: En vanlig husstand kan foreløpig kreve omtrent én effektiv arbeidstime å undersøke, uten modifikatorer.

Dette er kun et balanseutgangspunkt.

Tre personer kan utføre mer arbeid enn én, men effektiviteten påvirkes av om gruppen holder sammen eller sprer seg.

**Samlet søk:** Tryggere, men potensielt saktere.

**Spredt søk:** Raskere, men kan gi høyere risiko.

### Flerdagsoperasjoner

Dersom oppdraget ikke blir ferdig på én dag, bevares fremdriften.

Ved korte avstander returnerer personene normalt til basen.

Ved lengre operasjoner kan de slå leir eller fortsette under andre forutsetninger.

Ikke innfør unødvendig mikrostyring av søvn, vaktbytte eller individuelle hus.

Situasjonsbaserte hendelser kan forekomme, men skal ikke dominere hver eneste tur.

### Overgang til crew

I fase 2 bruker crew de samme underliggende reglene, men crew leader organiserer arbeidet automatisk.

Spilleren gir overordnede ordre og kan fortsatt zoome inn eller overstyre viktige prioriteringer.

---

## 5. Rekruttering og menneskene

Dette er en sentral del av spillopplevelsen.

**Hver person som tas inn i samfunnet, skal være et bevisst valg.**

Ingen automatisk rekruttering bare fordi en dag er passert.

Personer kan oppdages gjennom:

- Gjennomsøking av bygninger
- Utforskning
- Hendelser
- Radiosignaler
- Folk som oppsøker HQ
- Kontakt med andre grupper

### Mennesker er ikke automatisk nyttige

Spilleren kan finne eldre, barn, syke og skadde personer som ikke kan bidra med arbeidskapasitet.

De trenger fortsatt mat, vann, bolig, medisin og eventuelt omsorg.

Spilleren skal kunne avvise dem.

Det kan ha moralske, sosiale og relasjonelle konsekvenser.

Ikke gi alle slike personer en kunstig skjult bonus bare for å gjøre valget enklere.

Noen valg skal faktisk være kostbare.

### Karaktermodell

Alle overlevende kan ha navn, alder, behov, egenskaper og relasjoner.

Vanlige overlevende kan utvikle seg til crew leaders gjennom erfaring.

I tillegg ønsker vi et utvalg på kanskje 30–40 eller flere håndlagde spesialkarakterer med unike historier, ferdigheter, holdninger og personlige hendelser.

Antallet er et langsiktig innholdsmål, ikke noe som skal implementeres nå.

Ikke skill mennesker i permanent låste klasser der vanlige overlevende aldri kan bli ledere.

### Tilstrømming til HQ

Spilleren skal etter hvert kunne aktivere radiosignaler, bannere, signallys eller annen kommunikasjon.

Dette øker muligheten for at folk oppdager bosetningen.

Men det kan også tiltrekke uønsket oppmerksomhet.

Større befolkning skal gi mer arbeidskapasitet, men også høyere ressursforbruk og flere sosiale utfordringer.

---

## 6. Perimeter, vakthold og forsvar

Vi skal forsvare strategiske yttergrenser, ikke kreve én vakt i hver eneste L3.

En person kan holde oversikt over flere områder dersom avstand, utstyr, mobilitet og kompetanse tillater det.

Arbeidskapasitet brukt på vakthold kan ikke samtidig brukes fullt ut på andre oppgaver.

### Viktige prinsipper

- Naturlige barrierer reduserer normal inntrengningsrisiko.
- Åpne forbindelser mot infiserte områder øker risikoen.
- Zombieaktivitet, støy og lokale forhold påvirker belastningen.
- Barrierer reduserer behovet for aktiv patruljering.
- Bedre utstyr, trening og kjøretøy øker patruljekapasiteten.
- Etablerte forsvarslinjer kan svekkes ved press.
- Spilleren skal få forståelige varsler før alvorlige brudd når situasjonen tillater det.
- Et område kan tapes uten at hele spillet er tapt.

Ikke gjør vedlikehold til en serie repetitive klikk.

Vis heller nødvendig vedlikeholdskapasitet, materialforbruk og tilgjengelige ressurser.

På senere stadier kan ett crew ha ansvar for perimeter, logistikk og vedlikehold i et helt L2-distrikt.

### Risiko

Hendelser skal komme fra verdensmodellen, ikke fra vilkårlig spawning.

Zombier skal normalt flyttes fra eksisterende populasjoner.

Vann, broer, tunneler og avstengte forbindelser må påvirke mobiliteten.

Enkelte uvanlige hendelser, som en drivende båt med infiserte, kan skape trusler der normal landmigrasjon ikke er mulig.

---

## 7. Ressurser, loot og produksjon

Vi ønsker en økonomi inspirert av Civilization, men tilpasset en moderne zombieapokalypse i 2026.

Skill mellom:

**Core resources**

Mat, vann, medisin, ammunisjon, drivstoff og andre nødvendige forbruksvarer.

**Strategic resources**

Metall, trevirke, elektronikk, batterier, mekaniske deler og lignende.

**Items og utstyr**

Våpen, verktøy, klær, generatorer, 3D-printere, sykler, båter, kjøretøy, solcellepaneler osv.

**Produksjonskapasitet**

Verksteder, maskiner, kompetanse, strøm, landbruk, vannrensing og andre anlegg.

Vi kan ha mange forskjellige loot-gjenstander, men unngå hundrevis av ressursmålere som spilleren må administrere.

### Viktig designprinsipp

Ressurser skal kunne åpne nye strategier.

Et område med metall er ikke automatisk verdifullt uten arbeidskraft, kompetanse og utstyr til å bruke metallet.

En 3D-printer krever blant annet relevant kompetanse, strøm, materialer og fungerende utstyr.

En buss kan repareres, brukes til transport og senere bygges om dersom nødvendige ressurser og verkstedkapasitet finnes.

### Loot

Loot skal i hovedsak være endelig.

Verdien til et POI er ikke nødvendigvis borte når all loot er hentet.

Et verksted har fortsatt maskiner.

Et drivhus kan produsere mat.

Et sykehus kan ha medisinsk kapasitet.

Et industriområde kan åpne spesialisert produksjon.

Farligere områder skal ikke automatisk ha bedre loot.

Godt utstyr kan finnes tidlig, men får naturlige begrensninger gjennom ammunisjon, kompetanse, støy, transport, tilstand og vedlikehold.

### Innvendig søk

Grundig bygningssøk må kunne avdekke annet enn små mengder standardressurser.

Eksempelvis mennesker, informasjon, sjeldent utstyr, spesialgjenstander og skjulte farer.

Vi ønsker et meningsfullt valg mellom hurtig ekspansjon og grundigere undersøkelser.

---

## 8. HQ, bosetninger og territoriell utvikling

HQ skal gi en merkbar fordel, men ikke være en enkel knapp som automatisk gjør et område permanent trygt.

Bruk en gradvis utvikling:

**Tilfluktssted**

Tryggere søvn, oppbevaring og enkel behandling.

**Operasjonsbase**

Enklere verksted, kjøkken, organisert forsvar og forbedret logistikk.

**Permanent HQ**

Større kapasitet, infrastruktur, produksjonsmuligheter og grunnlag for å administrere et samfunn.

En base kan etableres før hele L2 er sikret.

Fase 2 åpnes først når spilleren har et fungerende permanent HQ og et sammenhengende L2-distrikt med tilstrekkelig kontroll og forsvarbar perimeter.

Ikke krev at alle bygninger er gjennomsøkt.

### Soneutvikling

L3-soner kan inneholde potensial for:

- Boliger
- Dyrkbar mark
- Skog
- Industri
- Handel
- Infrastruktur
- Forsvar

Spilleren kan velge å utvikle, omdisponere eller demontere deler av et område.

Å rive bygninger kan gi materialer, men reduserer samtidig eksisterende bolig- eller produksjonskapasitet.

Ikke simuler hver vindusrute eller individuelle bygningskomponenter.

Bruk samlede aktiviteter som «Klargjør boliger», «Etabler verksted» og «Gjenvinn materialer».

---

## 9. Stavanger skal føles som Stavanger

Dette er en viktig del av spillets identitet.

Vi ønsker håndkuraterte strategiske lokasjoner og lokale hendelser.

Aktuelle HQ-kandidater og strategiske steder inkluderer:

- Rosenberg verft
- Kuppelhallen
- Tidligere sykehuslokasjoner
- K8
- Stavanger Forum og DNB Arena
- Madla Amfi, Kvadrat og Kilden
- Skoler og større offentlige bygg
- Ullandhaugstårnet
- Vannforsynings- og behandlingsanlegg
- Havner og industriområder

Dette er kandidater. Faktiske funksjoner, plasseringer og egenskaper må kontrolleres før de presenteres som virkelige forhold.

Ikke alle slike steder skal være HQ.

Skill mellom HQ, utposter, strategiske anlegg og ressurslokasjoner.

### Lokal humor

Bruk tørr, subtil og situasjonsbasert humor.

Eksempler:

- Måker som lager bråk og tiltrekker seg zombier.
- Regn som påvirker sikt, arbeid eller lyd.
- Små referanser til Stavanger, lokal transport og kjente steder.
- En overivrig ZA-prepper som ikke hadde forutsett alt.

Humoren skal ikke overskygge alvorlige hendelser.

Den skal heller ikke brukes til å skjule dårlig gameplay.

### ZA-bokas personlighet

Boka kan være skrevet av en litt for selvsikker prepper.

Noen råd er gode. Andre viser seg å være ufullstendige.

Spilleren skal gradvis gå fra å følge boka til å utvikle sin egen strategi.

### Langsiktig arkitektur

Stavanger skal være den første håndkuraterte spillverdenen.

Spillreglene bør være generelle nok til at andre byer kan bygges på samme motor senere.

Men vi skal ikke bruke utviklingstid på å generere nye byer nå.

---

## 10. Kjente problemer fra gjennomspillingen dag 0–15

Disse funnene skal vurderes og korrigeres som del av revisjonen.

### A. Misvisende ordreforhåndsvisning

En sikringsordre kunne planlegges med lav risiko, men ble avbrutt fordi det fantes zombier i området.

Skillet mellom kampfare, risiko for avbrudd og gjennomføringskrav må bli tydeligere.

Behold usikkerhet, men ikke skjul kjente eller sannsynlige blokkeringer.

### B. Misvisende dagsrapporter

Omsorgstap ble fremstilt som en skadehendelse.

En rapport beskrev kontrolltap uten å tydeliggjøre at det gjaldt en annen sone enn den som nettopp var overtatt.

Rapportene må ha tydelig hendelsestype, årsak, konsekvens og referanse til riktig person eller sone.

### C. For enkel HQ-etablering

Permanent HQ ble etablert av én person på én dag.

Tidlig baseetablering er riktig, men permanent HQ må representere et større strategisk gjennombrudd.

### D. Bygningssøk mot lagerhenting

Grundig bygningssøk ga svært lite sammenlignet med kjente forsyningslagre.

Ikke løs dette bare gjennom større lootmengder.

Gi søk andre mulige verdier: mennesker, informasjon, spesielle gjenstander og sikkerhetskunnskap.

### E. Lite dramatisk dag 0

Starten introduserte mekanikker, men skapte lite følelse av kaos, personlige relasjoner og usikkerhet.

Forbedre introduksjonen uten å gjøre den lang eller låst.

### F. Bevar det som fungerer

Dag 13 ga en god situasjon der vakthold, bygging og omsorg konkurrerte om arbeidskapasiteten.

Dette er en referanse for ønsket gameplay.

Ikke fjern vanskelige prioriteringer for å gjøre spillet enklere.

---

## 11. Player Experience – første del av fase 1

Vi ønsker en progresjon som omtrent følger dette mønsteret, uten faste dagkrav:

**Åpning**

Utbrudd, intro, fire overlevende, ZA-boka og begrenset utstyr.

**Første nabolag**

Rydding av utvendige områder, undersøkelser av bygninger, første funn og første risiko.

**Første ekspansjon**

Valg av retning, arbeidsfordeling, speiding, utstyr og vaktbehov.

**Første menneskelige dilemma**

Spilleren møter andre overlevende og må vurdere hvem som skal få bli med.

**Første base**

Spilleren får økt sikkerhet og noen enkle fasiliteter.

**Videre ekspansjon**

Flere overlevende, parallelle arbeidsoppgaver, større POI-er, perimeter og begrenset produksjon.

**Slutten av fase 1**

Et permanent HQ, kontroll over L2 og et forsvar som gjør at spilleren kan begynne å organisere større operasjoner.

Progresjonen skal oppstå gjennom spillerens handlinger og verdens tilstand, ikke gjennom en fast kalenderstyrt historie.

---

## 12. Implementeringsstrategi

Ikke forsøk å implementere hele dette dokumentet i én omgang.

### Steg 1 – Gap-analyse

Les eksisterende kode og tidligere dokumentasjon.

Lag en kort oversikt over:

- Hva som allerede samsvarer med denne designretningen.
- Hva som fungerer, men trenger justering.
- Hva som mangler.
- Hva som bør utsettes.

Skill mellom spilldesignproblemer og tekniske feil.

### Steg 2 – Fase 1 gameplay-refinement

Prioriter ordreforhåndsvisning, dagsrapporter, HQ-progresjon, bygningssøk og en bedre introduksjon.

Behold eksisterende simuleringsmotor.

### Steg 3 – Kartrevisjon

Bruk vedlagt bilde til å foreslå oppdatert L1/L2/L3.

Vis kartforslaget før omfattende endring av verdensdata.

### Steg 4 – Spillbar gjennomgang

Gjennomfør en ny sammenhengende gjennomspilling.

Vurder spesielt:

- Om spilleren har reelle handlingsalternativer.
- Om arbeidstid og risiko skaper interessante prioriteringer.
- Om rekruttering påvirker den videre strategien.
- Om ekspansjon, forsvar og ressurser henger sammen.
- Om HQ føles som et meningsfullt mål.
- Om spilleren opplever lokal identitet og utvikling.

### Testing

Bruk målrettede kontroller for sentrale beregninger, determinisme, populasjonsregnskap og konkrete regresjoner.

Ikke bygg en omfattende testinfrastruktur for hver lille mekanikk.

Balanse vurderes etter flere faktiske gjennomspillinger.

### Begrensninger

- Ingen full omskriving.
- Ingen unødvendige nye avhengigheter.
- Ingen fase 2-implementasjon ennå.
- Ingen omfattende crafting-katalog nå.
- Ingen ekstra geografisk perfeksjonisme.
- Ingen produksjonspublisering uten tillatelse.
- Bevar eksisterende spilltilstander der det er praktisk mulig.

---

## 13. Hva jeg forventer fra Codex

Orkestrer arbeidet selvstendig og bruk delagenter når oppgavene er uavhengige.

Start med en kort gap-analyse og en konkret gjennomføringsrekkefølge.

Prioriter at den eksisterende fase 1 blir et vesentlig bedre spill, fremfor å øke antall funksjoner.

Etter hver betydelige leveranse skal du rapportere:

1. Hva som faktisk er forbedret i spilleropplevelsen.
2. Hvilke spillvalg som nå er mer interessante.
3. Hva som er uferdig eller bevisst utsatt.
4. Hva som er største gjenværende designrisiko.
5. Hva jeg konkret bør prøve i neste gjennomspilling.

**Suksesskriteriet er ikke at alle punktene er implementert.**

Suksesskriteriet er at spilleren har lyst til å avslutte én dag til, fordi neste beslutning faktisk betyr noe.