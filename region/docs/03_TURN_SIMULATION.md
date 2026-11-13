# Turn Simulation – én dag, én autoritativ verden

Fra 02.11.2026 styrer [låste designbeslutninger](15_LOCKED_DESIGN_2026-11-02.md) arbeids- og forsvarsmodellen. M2- og M3-flyt dokumenterer tidligere milepæler. Prøveslicen bruker [fase 1-kontrakten](16_PHASE1_SLICE.md).

## 1. Krav

- (B) Dag er eneste grunnleggende tidsenhet. Reise, research, produksjon, skadebehandling, bygging og oppdrag kan kreve flere dager. Bruk tidsbrøker internt ved behov, men vis fremdrift i dager/turer.
- (H) Simuleringsmotoren er en ren TypeScript-modul som tar `state + locked_orders + day_seed` og returnerer `new_state + events + reports`. Den kjenner ikke React, kartmotor, database eller autentisering.
- (B) Multiplayer: Begge spillere må trykke Ready. Ordrene låses; én serverautoritativ prosess simulerer dagen én gang. Begge får samme nye verdensstatus, men ulikt syn basert på etterretning.
- (B) Konsekvent regnskap for zombiepopulasjon, ressurser og personell.

## 2. Turprotokoll

Session status: Planning → Ready/Locked per spiller → Resolving → Resolved → Planning neste dag.

1. Klient sender **intensjoner/ordre**, ikke resultat eller RNG.
2. Server validerer eierskap, rekkevidde, folk, utstyr, kapasitet og tilgjengelige ressurser.
3. Ready låser spillerens ordrer. Spilleren kan endre dem før Ready, men ikke etter uten felles avlåsing (Å).
4. Når alle aktive spillere er Ready, gjør serveren én transaksjonell claim på turn_id. Ingen dobbel løsning etter retry, refresh eller parallelle forespørsler.
5. Motoren løser simultane ordre med dokumentert regel for konflikter. Spillernes klikkrekkefølge skal ikke gi kampfordel.
6. Ny verdensstatus og turrapport lagres atomisk. Klientene mottar «day resolved» og leser relevant state/delta.
7. Ny tur åpnes.

Åpent: Hva skjer ved disconnect, om begge kan pause, og hvordan en eventbeslutning behandles når den oppstår under turbehandling. Anbefalt første versjon: events blir valg for påfølgende planleggingsfase, ikke blokkering inne i en halvtransaksjon.

## 3. Foreslått simuleringsrekkefølge

Dette er en *arbeidshypotese* som kan endres etter prototypen:

1. Valider og reserver planlagte ordre/ressursbruk.
2. Beregn reiser, ruteendringer, møte mellom crew, scouting og kamp (simultant).
3. Beregn zombiemigrasjon og press mot barrierer (med tydelig regel for om reaksjon skjer samme/neste dag).
4. Oppdater produksjon, konsum, bygging, reparasjon, trening og research.
5. Oppdater skader, moral, relasjoner, forsyningsbrudd og territoriekontroll.
6. Evaluer begrenset sett med hendelser, lag rapport og varsler.

Før implementering må vi låse om zombiemigrasjon skjer før/etter kamp og om nyproduserte ressurser kan brukes samme dag. Det skal ikke avhenge av tilfeldig rekkefølge i databaseforespørsler.

## 4. Zombiepopulasjon

Zombier er **grupper/kohorter**, ikke individuelle AI-objekter. Hver aktiv L3 kan ha antall per variant/mutasjonsprofil; L2/L1 summerer disse tallene. Fjernere områder kan simuleres aggregert og raffineres konsistent når spilleren nærmer seg.

For en region:

`Z(n+1) = Z(n) - kills - decay + new_infections + immigration - emigration`

- Begynn dag 0 med seeded regional populasjon basert på grovt pre-outbreak befolkningsgrunnlag, ikke på en påstått nøyaktig zombieopptelling.
- Flytt zombier mellom nabosoner ved **trekk og fratrekk** i samme tur.
- Import fra sør/øst eller havet må komme fra modellerte eksterne reservoarer eller eksplisitt loggførte migrasjonshendelser. Unngå ubegrenset skjult spawning hvis regional utryddelse er mulig seier.
- Zombier kan dø naturlig/forvitre, bli drept, bli nye gjennom infeksjon eller flytte. Tallene må ikke forsvinne når zoomnivået skifter.
- Hendelser som drivende båt kan tilføre et lite antall fra et modellert eksternt kildeområde. Ikke tilfeldig «spawn 500 zombies» uten forklaring.

## 5. Daglig bevegelse og trussel

La en **delmengde** av zombiene i en sone vandre; de fleste kan bli værende. Utreiseforsøk styres av:

- Lokal tetthet og variantens mobilitet.
- Støy, lys/aktivitet, menneskelige mål og nylige hendelser.
- Tilgjengelige kanter: vei, passasje, bru, tunnel, vann-/terrengbarrierer.
- Patruljer, vakter, barrikader og forsyninger til forsvar.
- Litt seedet tilfeldighet innen logiske grenser.

Forslag til konsept: For hver kant velges en begrenset strøm fra avsendersonen; totalsummen kan ikke overstige eksisterende zombier. Høy aktivitet ved et POI bygger press over flere dager. Trykk mot forsvar sliter på barrikader og kan gi varsler før brudd.

**Ikke** gi hvert L3-område uavhengig random zombie-spawn; det bryter med territorial strategi.

## 6. Informasjon og scouting

Spilleren vet ikke nødvendigvis eksakt zombieantall. Scout-rapport skal vise estimat/range, alder og sikkerhet (for eksempel «10–25 observert i går»). Nylig støy, vandring og mutasjoner kan gjøre rapporten utdatert.

Dette gjør reconnaissance, vakttårn, patruljer og etterretning nyttig. Motoren har eksakte tall; brukergrensesnittet viser bare observert/antatt informasjon.

## 7. Operasjoner og kamp

En ordre inneholder minst: type, mål, crew, rute-/risikodoktrine, prioritert POI, startdag, eventuell varighet. Tillatte ordre bestemmes av fase, utstyr og kontroll.

Resultat bestemmes av:

- Crewets antall, trening, erfaring og leder.
- Våpen, ammo, armor, verktøy, kjøretøy og forsyninger.
- Zombieantall, type, mutasjoner, posisjon og terreng.
- Intel, overraskelse, defensiv posisjon og støy.
- Seedet usikkerhet innen kommuniserbar risikoklasse.

**Balansere for semirealisme:** XP skal bedre koordinering, treffsikkerhet, utholdenhet og taktikk – ikke gjøre mennesker til skuddsikre helter. Store crew kan cleare langt raskere, men bruker mer logistikk og kan tiltrekke mer støy. Forholdet mellom 4 mennesker/dag 10 og 50/dag 200 skal oppstå fra flere samvirkende faktorer, ikke en hardkodet «fase 2 ×10».

En makroordre på L2 deles i L3-deloppdrag. Spilleren kan avbryte eller endre plan ved senere tur. Ingen automatisk trygg teleport til prioritert POI.

Før makroordre prøves, summerer arbeidsmodellen bygningsarbeid per L3 og lagrer søkefremdrift over flere døgn. Rekognosering, utvendig rydding, innvendig søk, overtakelse og sikring har separate virkninger. Raskt raid kan forsøkes med ufullstendig etterretning. Samlet eller spredt arbeid gir ulike avveininger mellom fremdrift og eksponering.

## 8. Barrierer og patruljer

Hver relevant grense/forbindelse kan ha beskyttelse, tilstand, holdbarhet, vedlikehold og garrison/patruljedekning.

Beregn aktivt forsvarsbehov langs utsatte passasjer på yttergrensen. Sammenhengende kontroll reduserer behovet for vakthold internt. Vakter og sperringer fordeler arbeidsbehov og risiko på tvers av flere soner.

- Naturlig grense = billigere forsvar, men kan påvirke egen logistikk.
- Barrikade = forsinker/reduserer inntrengning; kan svekkes og brytes.
- Vakter = oppdager og håndterer press, men binder opp mannskap og forsyninger.
- Patroller = dekker flere kanter, lavere permanent kontroll enn fast post.
- Bedre materialer/trening/research forbedrer holdetid og evne til å varsle, ikke absolutt immunitet.

Et border-breach skal normalt varsles gjennom eskalerende press når spilleren har etterretning/beredskap.

## 9. Mutasjoner og nye typer

- Hver run har seedet, delvis skjult mutasjonspotensial. Lokale utbrudd kan utvikles i ulik retning.
- Trait-eksempler: bedre hørsel, hopp/mobilitet, høyere aggresjon, svømme-/vannpassasje, mer koordinert adferd, tykkere vev. Hver fordel kan ha kostnad/ulempe.
- Enkle kombinasjoner kan skape nye arketyper. Start med 1–2 varianter, ikke et fullt genetisk system.
- Research avslører signaler og gir målrettede mottiltak (våpen/ammo, tactics, barrierer, beskyttelse) og mindre penalty. Unngå bare global +X% damage.
- Lokalt evolusjonstrykk, spredning og at svakere varianter forsvinner kan simuleres aggregert; biologisk detalj er ikke mål.
- Store nye trusler bør kunne oppdages/forutses i tide, selv om eksakt variant er ukjent.

## 10. Hendelser

Hendelser kan være positive eller negative og følge logiske betingelser: knapphet, støy, relasjoner, sykdom, storm, båtdrift, ressurser, migrasjon. Bruk seeded variasjon, men ikke rent «rubber banding» som straffer spilleren fordi han leder.

Vanskelige moralske valg må ha kortsiktig kostnad, mulig langsiktig effekt og varierende informasjon. Konsekvenser kan komme mange dager senere, inkludert i diplomati med NPC-fraksjoner. En hard beslutning er ikke alltid optimal; tillit og legitimitet har verdi.

## 11. Kjerneinvarianter

1. Samme state + ordre + seed → samme utfall.
2. Zombieantall i hele modellområdet stemmer med summen per variant/sone og eksplisitte kilder/tap.
3. Ingen crew, ammo, ressurser eller bygging kan brukes mer enn én gang i en tur.
4. Turen løses høyst én gang; en retry endrer ikke resultatet.
5. Zoom/aggregering kan ikke opprette eller miste zombiepopulasjon.


## 12. Implementert M2-flyt (H, regelversjon m2.2)

Motoren validerer og reserverer alle ressursuttak mot dagens startbeholdning, leser dagens støy, beregner samtidige bevegelsesforsøk fra startpopulasjonen, oppdaterer barrierepress/slitasje, utfører overføringer og leverer ny dag med populasjons-/ressursregnskap og strukturert rapport. Nyankomne zombier vandrer ikke videre samme dag. En barriere blokkerer hele dagen den brytes; varsling kommer i en tidligere dag. Leveranser kan først brukes i senere dags ordre. Samme tilstand, verdensgraf, ordre, seed, konfigurasjon og regelversjon gir samme resultat. `replayDays` kjører samme funksjon uten klokke, nettverk eller UI.

Én ordinær zombiekohort per lokasjon foreløpig. Resource transfer/consume er regnskapsprimitiver, ikke godkjente spillerhandlinger: eierskap, arbeidskapasitet, adgang og transport må valideres av neste applikasjonslag. Kamp, produksjon og faktiske konsumrater kommer i M3; deres innbyrdes rekkefølge er ennå ikke implementert. Serverens transaksjonelle maks-én-løsning er et separat ansvar og påstås ikke løst av den rene funksjonen.
