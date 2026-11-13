# World Model – geografi, soner, POI-er og forbindelser

## 1. To lag

**World definition:** Det geografien muliggjør – polygoner, veier, vann, tunneler, bygninger, POI-er, jord/industri og startpotensial. Deler samme definisjon mellom runs.

**World state:** Det som endres per run/per dag – kontroll, zombieantall, intel, barrikader, bemanning, lager, produksjon, ødeleggelser og ruteadgang.

Ikke bland dem i samme redigerbare kartdata eller muter den globale world definition ved handlinger i ett run.

## 2. Nestet hierarki

| Nivå | Formål | Interaksjon |
| --- | --- | --- |
| L1 – Region/sone | Hundvåg/Byøyene, senere større strategiske regioner | Overordnet kapasitet, ekspansjon og forsyningsnett |
| L2 – Distrikt | Buøy, delområder av Hundvåg, samling av øyer | Crew-ordrer, kontroll, infrastruktur og forsvar |
| L3 – Taktisk sone | Omtrent 100 × 100 m som utgangspunkt, men variable polygoner | Speid, rydd, claim, lokal patrulje og POI-tilgang |

- (B) L3 har **variable grenser** basert på gater, naturlige barrierer, eiendommer, terreng og faktisk strategisk sammenheng. 100 m er målestokk, ikke regel.
- Hver L3 tilhører nøyaktig én L2, hver L2 nøyaktig én L1. Ingen overlapp mellom søskenområder. Vann/ikke-spillbart terreng kan være utenfor soner.
- L1/L2 viser aggregater fra undernivåene; de eier ikke separate zombiepopulasjoner.
- Ved progresjon låses høyere zoom-/kommandonivå opp; alle tidligere nivåer beholdes.
- Geometrien må validere topologi, hull og berøring. Naboskap kan ikke utledes blindt bare fra polygonkontakt; bruk eksplisitte forbindelser.

## 3. POI og HQ

- POI er egne objekter knyttet til en L3-sone, med type, navn, kapasitet, loot, risiko, eventuell repeterbar produksjon, oppdagelsesstatus og kontroll.
- Eierskap av POI er **ikke identisk** med kontroll av sonen. Et POI kan være farlig i en kontrollert sone, tømt for loot uten å være eid, eller tatt over uten at hele L2 er sikret.
- Scavenging uttømmer finite lagre. Bærekraftig mat/vann/strøm krever infrastruktur/arbeidskraft.
- HQ velges blant kvalifiserte steder (POI/sted) og sikres. Rosenberg verft er et ambisiøst, strategisk interessant potensielt HQ i Stavanger-testverdenen, ikke automatisk best i alle runs.

## 4. Territorietilstander

Unknown → Explored → Cleared → Claimed → Secured/Fortified. Dette er **delvis ortogonale** egenskaper i data: kjent intel, lokal zombiebelastning, kontroll, forsvar og bemanning.

Særlig:
- Cleared betyr ingen **kjente** lokale zombier, ikke permanent immunitet.
- Claimed innebærer et faktisk kontroll-/tilstedeværelseskrav.
- Secured krever beredskap (barrierer, vakter, vedlikehold, eventuell naturlig grense).
- Kontroll kan svekkes gjennom migrasjon, angrep og tapte forsyningslinjer. Hendelser bør gi varsler og rimelig responstid.

## 5. Forbindelsesgraf

En separat graf modellerer tilgjengelige passasjer mellom soner: vei, gangvei, bru, tunnel, båtforbindelse og eventuelt uframkommelig land.

Foreslåtte edge-felt: from_zone, to_zone, transport_modes, travel_cost, condition, capacity, blocked, fortified, weather_exposure, ownership/control, chokepoint_kind.

- Bruer og tunneler kan sperres, ryddes, repareres eller ødelegges på senere faser. Destruktive inngrep er dyre og får konsekvenser også for egne forsyninger.
- Vann er normalt fysisk barriere for vanlige zombier. Hendelser som drivende båt, en sjelden svømmevariant eller transport gjennom tunnel/bru kan bryte isolasjon – ingen spontan vannpassering uten regel.
- Båttransport krever kapasitet og påvirkes av vær. Kartdata må ikke antas å være en ferdig spillrute-graf.

## 6. L2-oppdrag med L3-rute

Et crew kan få ordre «Clear L2 Buøy». Motoren velger en sammenhengende rute gjennom tilgjengelige L3-soner, som hovedregel fra nærmeste sikre adkomst, og utfører arbeid dag for dag.

Spilleren kan angi:
- **Safe advance:** Rydd og sikre ruten framover.
- **Fast approach:** Forsøk raskeste rute gjennom ukjente/usikre veier med høyere risiko.
- **Priority POI:** Prioriter en bestemt lokasjon; rute/risiko endres, men ikke teleporter.
- **Rules of engagement:** Stopp, trekk tilbake eller fortsett ved høy motstand (senere).

L2-ordre er makroordre, ikke «rydde hele distriktet øyeblikkelig». Hvis crewet mister kapasitet, venter det på nye ordre eller følger forhåndsvalgt doktrine.

## 7. Soneøkonomi

Hver sone kan ha flere **potensialer**: boliger, dyrkbar jord, industri, vann, energi, helse, havn/transport. Potensial er ikke automatisk produksjon: krever kontroll, arbeidskraft, verktøy, forsyninger og ofte strøm/vann.

Tidlig: scavenging. Midt: stabil produksjon. Sent: spesialisering og forsyningslinjer. Store, lange linjer gir sårbarhet. Ikke bruk «+20 mat» fordi sonen er grønn uten å modellere drift.

## 8. Datakilder og kontroll

Mulige innganger er OSM (veier/POI/bygninger), andre lovlig tilgjengelige kart-/arealdata og manuell kuratering. Ingen ekstern datakilde definerer automatisk gode L1/L2/L3-spillsoner.

Krav før publisering: kartattribusjon, kartflisleverandørens vilkår, lisens for avledede geografiske data, datakvalitet og kostnadsmodell.

## 9. Validering av første verden

Test manuelt at Buøy/Hundvåg har meningsfulle landtilganger, havskiller, transportforbindelser, forsvarlige L3-polygoner og strategiske POI-er. Start heller med et kuratert, lite område enn algoritmisk genererte soner som føles tilfeldige.


## 10. Åpent utsnitt og utkaststatus – presisert etter M1

`frontiers` beskriver land ved kartutsnittets kant med `kind: unmodeled-land`, berørt L3 og stabil ekstern områdereferanse. Disse er ikke `Barrier`-objekter og gir ingen automatisk adgangssperre eller ubegrenset spawning. Simulering må koble relevante passasjer til et eksplisitt, endelig eksternt populasjonsregnskap. Manglende detaljgeometri utenfor utsnittet betyr ukjent territorium. Ulike randsegmenter kan peke på samme eksterne område; de skal ikke få hvert sitt gratis reservoar.

M1-definisjoner med status `draft` er redigerbare arbeidsdata. Publisert lagring avvises mot utkast. Når en versjon senere publiseres, beholdes den uendret for sine aktive spill. Stable ID-er brukes også under kuratering, men geometri kan korrigeres uten å lage et migreringssystem nå.
