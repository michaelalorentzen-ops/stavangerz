# M1-revisjon: hvorfor velge én ekspansjonsrute?

Historisk vurdering: M1 er nå godkjent og geografivurderingen avsluttet. Siste føringer står i beslutningsloggen; videre arbeid følger M2/M3.


31.10.2026. M1 er godkjent som prototype. Ingen sonegrenser er låst. Nærbildene i `evidence/m1-detail-03.png`, `m1-detail-05.png` og `m1-detail-07.png` er selvstendige leveranser; vurderingen krever ikke lokal server eller tilgang til M-disken.

## 03 – behold startområdet

Det faktiske gatenettet gir to retninger: Buøy ring nordover mot kartlagte butikker/apotek på Hundvåg, eller Skipsbyggergata/Clipperveien mot verftskorridoren. Dette begrunner et valg mellom å oppsøke daglige forsyningsmål og å investere i adkomst til et framtidig HQ. Det er en geografisk mulighet, ikke en ferdig balansert risiko-/belønningsmodell. Ingen rute er definert som tryggere eller mer ressursrik uten senere regler og rekognosering.

I det filtrerte gangnettet fra det foreløpige startpunktet er ruten til Meny omtrent 1,3 km, og til nordre enden av Clipperveien omtrent 650 m. Dette er nettverksanslag fra OSM, ikke luftlinje, game ETA eller bevis for fri adgang. Nærbildet klipper av den videre nordruten før butikkene.

## 05 – behold adkomstfunksjonen foreløpig

Det opprinnelige navnet Dalehaugen var upresist. Det markerte krysset er Skipsbyggergata/Clipperveien; ID `cell-005` er beholdt og visningsnavnet presisert.

Clipperveien, OSM way/1051499023, deler gatenode med Skipsbyggergata ved 5.7329186,58.9852181. Den går fra 05 videre inn i 06 langs verftsgrensen. Den første spillgrafen manglet en lokal 03→05-tilknytning ved dette krysset og tvang en omvei via 04. Det nye grafutkastet har en foreslått forbindelse ved den faktiske gatenoden, og 05→06 er tegnet etter Clipperveien.

Ved å utelate private ruter, foot=no-veier og tunnelkontekst fant det beholdte gangnettet ingen omvei fra start til denne delen av Clipperveien uten å berøre 05. Det støtter en korridorfunksjon, men kan også skyldes manglende kartlenker. Det beviser ikke at mennesker eller zombier fysisk bare kan passere her.

**Anbefaling:** behold 05 som lokal adkomstsone nå, uten å gi den automatisk kontroll over alle nord-/verftsruter. Den smale polygonformen på rundt 3 000 m² er fortsatt et utkast. Ingen stengbar port er bekreftet ved krysset. Clipperveien ligger utenfor HQ-polygonet; ingen direkte 05→HQ-forbindelse er oppfunnet.

## 07 – vis to oppgaver i stedet for én stor clearing

Tømmerodden, OSM way/27473078, er en faktisk service-/kaivei gjennom området. Nærbildet viser et delingsalternativ langs denne veien, med korte foreslåtte forlengelser til kyst og industrigrense:

- **07A, øst:** Bangarvågsgata og adkomst videre mot eid og verftsgrensen, omtrent 111 000 m².
- **07B, vest:** Tømmerodden/kaiområdet, omtrent 144 000 m².

Dette kan skille et gjennomfarts-/adkomstoppdrag fra rydding av hele kaia. Spilleren trenger da ikke håndtere alt vestlig industriareal for å arbeide med gjennomfarten. Ingen verdi for loot, clearingtid eller forsvar er lagt til.

Portene G1–G3 er registrert i OSM, og flere gjerdestykker er synlige. De utgjør ikke en sammenhengende bekreftet sperre langs hele delingsforslaget. En sonegrense betyr heller ikke automatisk en vegg.

**Anbefaling:** bruk delingsalternativet som neste geografiske arbeidshypotese, begrunnet med forskjellige adkomst-/oppdragsfunksjoner. Behold det som separat overlegg foreløpig; kanonisk 07 er ikke delt og ingen nye sone-ID-er er tildelt. Presis side av veien og porttilknytning må avklares når delingen faktisk tas inn.

## Umodellert land er ikke en fysisk yttergrense

Definisjonen har nå eksplisitte `frontiers` for land ved utsnittets kant. De peker til samme eksterne områdereferanse der det er samme ukjente område. De ligger separat fra sjø-/terrengbarrierer. De oppretter ingen zombier.

M2 kan koble utvalgte passasjer til et endelig, regnskapsført eksternt reservoar. Flere randsegmenter må ikke doble dette reservoaret. Verken eksakt befolkning utenfor Hundvåg-utsnittet eller konkret zombieimport til det ekte kartet er fastsatt. Det er dette den syntetiske motoren først skal demonstrere.

## Utkast og publisering

M1-geometri kan korrigeres uten migrering. Kurateringsskript og kompatibilitetskontroll tillater endring av `draft`. `resolveSavedWorld` avviser utkast for publiserte spill. Uforanderlige verdensfiler og versjonsbinding beholdes for senere publiserte verdener med aktive spill.

## M2-start, separat fra kartet

`packages/simulation-core` bruker bare lokasjons-ID-er og forbindelser. Fire syntetiske soner og ett endelig eksternt reservoar demonstrerer en ren `resolveDay`, seedet migrasjon, støy og trykk/slitasje på en barriere. Overføringer beregnes fra dagens starttilstand; en ankommet gruppe flytter ikke videre samme dag. Varsel gis før senere brudd. Dette er H-regler for utprøving, ikke låst spillbalanse.

En kort kontroll med seed 435 over ti dager bevarer totalt 90 zombier. Modellområdet går fra 60 til 76, reservoaret fra 30 til 14. Varsel kommer på dag 2, brudd på dag 3, passering først neste dag. Den smale kontrollen dekker determinisme, uavhengighet av inputrekkefølge, uendret input, populasjonsregnskap og vannkant uten passasje.

M2 er påbegynt, ikke fullført: ingen kamp, økonomi, spillerordrevalidering, autoritativ serverlås eller kobling til Stavanger-polygonene. Ingen stor testinfrastruktur er opprettet.

## Status og neste leveranse

**Fungerer:** delbare nærbilder, presisert lokal adkomstgraf, eksplisitte åpne landgrenser, redigerbare utkast og en liten headless motor.

**Største risiko:** kartlagte veier/porter er ikke fysisk verifisert adgang. 05 må ikke få kunstig forsvarsverdi, og 07-deling må beholde reelle kryssinger.

**Neste konkrete leveranse:** arbeid videre med 07A/B og passasjene ved 05 ut fra denne vurderingen, mens M2 holdes på syntetiske data. Ingen geografilåsing eller M3-utvidelse er gjort.
