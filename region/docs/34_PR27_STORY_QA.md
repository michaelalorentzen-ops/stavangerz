# PR27: steder, adgang og hendelsesfakta

Avgrenset QA etter Grok-kommentar 6848402112. Ingen balansetuning eller endring av verdensdata, sonegrenser eller lagrede wonder-zoneId-er.

## Reelle feil og avgrensning

- S3: Den generelle fraksjonssperren avviste crew-anleggsarbeid selv der eksisterende wonder-tekst lover vennskapstilgang. Domkirken oppdages nå ved vennskap, men må fortsatt undersøkes/sikres og settes i drift i to separate crew-trinn. Vennskapsterskelen 40 følger den eksisterende `planeFound.when`-regelen. Ingen generell diplomati- eller krigspolicy endres.
- S3: Et oppdaget cruiseskip er et separat event-anlegg etter D13; det blir ikke kirkens eiendom fordi kirken holder samme L3. Motorens smale wonder-adgangsunntak lar crew arbeide der skipet ligger. Faktisk reise, fersk trygg-adkomstintel, virkelig zombiemengde, materialer og D27 gjelder fortsatt. Fraksjonsspeiding må rapportere zombieobservasjonen også; tilgang alene oppfinner ingen sikker etterretning. Dette krever motorhooken fra QA-core.
- S4: Begge kodeankrene var feil. Nærmeste centroid er dessuten utilstrekkelig for presis stedstilknytning. Nye funn bruker korrigerte landemerkepunkter og eksisterende Polygon/MultiPolygon-innehold, med hensyn til hull. Nærmeste centroid beholdes som fallback der punktet ligger utenfor verdenspolygonene. Eksisterende holdings beholder sone-ID og status.
- S5: Beleiringsutfall flyttet en endelig mengde zombier til nabosoner, mens teksten påsto at en større beregnet mengde hadde falt. Rapporten bruker nå faktisk reduksjon i angrepssonen og sier «drevet bort». Ingen nye zombiedødsfall eller balanseeffekter legges til. Manglende lovlig mottakersone rapporteres som null flytting.

At en bot aldri velger eller fullfører en mulig kjede er ikke alene en regelfeil. Her var fraksjonssperren og fraksjonsspeidingens manglende zombieintel konkrete funksjonelle blokkeringer. Videre botstrategi og langtidsbalanse vurderes separat.

## Geografisk kilde og faktisk hierarki

Kartverkets Stedsnavn-API ble lest 13.11.2026:

| Anlegg | Kilde | Punkt (lengde, bredde) | Eksisterende L1 → L2 → L3 |
| --- | --- | --- | --- |
| Utstein kloster | [SSR 608330, Severdighet](https://ws.geonorge.no/stedsnavn/v1/navn?sok=Utstein%20kloster&fuzzy=false) | 5.59043, 59.10315 | Rennesøy `z1-0021` → Beitet `z2-0065` → Bakklandet `z3-0238` |
| Arenaen / Viking stadion | [SSR 480714, Idrettsanlegg](https://ws.geonorge.no/stedsnavn/v1/navn?sok=Viking%20stadion&fuzzy=false) | 5.73107, 58.91453 | Hinna `z1-0013` → Gausel `z2-0166` → Boganes `z3-0178` |

Navnene Mosterøy og Jåttåvågen beskriver vanlig stedstilhørighet, men er ikke L3-ene som inneholder de verifiserte punktene i den eksisterende spillverdenen. QA-forslaget om å tvinge disse L3-navnene er derfor ikke brukt. Ingen grenser er flyttet for å få navnelikhet.

## Kontroll

Fra `region/`: `node --import tsx scripts/check-qa-stories.ts`, `node --import tsx scripts/check-v04-wonders.ts`, `./node_modules/.bin/tsc --noEmit`.

Målrettet QA tester faktiske `siegeDay`-valg med 75 tilgjengelige zombier og et lagret krav om større flokk, samt ingen lovlig mottakersone; begge bevarer totalregnskapet. Den tester polygoner/hull, verifiserte ankre, vennskapstilgang, to separate installasjonstrinn og cruiseskipets uavhengige adgang uten gratis sikkerhetskunnskap. Full actual-mission-flyt kontrolleres etter integrasjon med QA-core-hooken.
