# Game Design – produkt og progresjon

B betyr besluttet, H betyr hypotese, Å betyr åpent. De låste beslutningene av 02.11.2026 styrer videre produktarbeid. Se [beslutningsgrunnlaget](15_LOCKED_DESIGN_2026-11-02.md) og [fase 1-slicen](16_PHASE1_SLICE.md).

## 1. Premiss

Stavanger Z er et turbasert, kartbasert strategispill hvor en zombieapokalypse starter på dag 0. Ekte geografiske områder, veier og interessante steder former overlevelse og ekspansjon. Spillerens ansvar går fra noen få mennesker til et samfunn som kanskje kan gjenerobre hele regionen.

**Spillerfantasi:** Ta vanskelige beslutninger med begrenset informasjon; opplev at egen lokal geografi betyr noe; bygg gradvis kontroll over en farlig verden. Designet skal være semirealistisk innenfor zombiepremisset, ikke et action-RPG med stadig høyere helseverdier.

**Primærplattform (H):** Nettleser, PC-først. Co-op/PvE primært; PvP kan komme etter at kjerneløkken fungerer.

## 2. Tid, sesjoner og multiplayer

- (B) Én tur = én spilldag. Dette endres ikke mellom faser.
- (B) To spillere kan spille samtidig i samme verden fra forskjellige startsteder. Begge må bekrefte neste tur. Ingen obligatorisk tidsfrist i første versjon.
- (H) De gir ordre parallelt; ved Ready låses ordrene. Først når begge er Ready løser serveren dagen samtidig.
- (H) Solo spilles mot verdenssimulering og NPC-fraksjoner. Samme turn-motor brukes i solo og co-op.
- (Å) Nøyaktig modell for territorieeierskap mellom to allierte, felles sluttmål og hva som skjer ved disconnect.
- (Senere) PvP, uenighet, svik og alliansebrudd kan støttes ved separert kontroll og skjulte ordre, men er ikke MVP.

## 3. Fem faser

| Fase | Omfang | Hva spilleren styrer | Viktige låser |
| --- | --- | --- | --- |
| 1 – Survival | Dag 0 / nabolag | Omtrent fire navngitte overlevende, arbeidslag, ekspedisjoner og L3-soner | Fungerende HQ og sammenhengende L2-kontroll med forsvarbar perimeter |
| 2 – Establishment | Distrikter | Egnede crew-ledere og aggregert operativ kapasitet, L2-ordre, transport, vakter, HQ | Infrastruktur og flere sikre soner |
| 3 – Civilization | Flere byområder | Fraksjoner, handel, lover, diplomati, interne konflikter, L1-strategi | Varig samfunn og regional samhandling |
| 4 – Regional Control | Store deler av Rogaland | Forsyningsnett, produksjon, større soner, sikkerhetsdoktriner | Regional stabilitet |
| 5 – Reconstruction | Endgame | Forskning på kur eller stabil sameksistens gjennom kontroll/utryddelse | Seiersvilkår |

Fasene er progresjon i kommandomuligheter, ikke fem separate spillmotorer. Når et høyere nivå åpnes, kan spilleren fortsatt zoome inn og detaljstyre. Eksakt overgangskriterium er Å.

## 4. Kjerneløkke

1. **Undersøk:** Speid sone/POI, få usikker informasjon om zombier, ressurser og risiko.
2. **Prioriter:** Vurder nødvendigheter, veier, områder, strategiske POI-er og folk.
3. **Gi ordre:** Utforsk, rydd, sikre, scavenge, flytt, reparer, patruljer, tren eller bygg innen tilgjengelig kapasitet.
4. **Avslutt dag:** Simuler samtidig bevegelse, oppdrag, ressursforbruk, risiko og hendelser.
5. **Reager:** Håndter skader, nye trusler, moralske valg, forsyningsproblemer og muligheter.
6. **Utvid:** Fra noen L3-celler til L2- og L1-soner uten at tidlig erfaring blir irrelevant.

## 5. Strategiske pilarer

- **Geografi:** Kyst, innsjøer, broer, tunneler, industri og jordbruk er reelle fordeler og sårbarheter.
- **Logistikk:** Store samfunn krever mat, vann, utstyr, produksjon, beskyttelse og transport.
- **Personer.** Hver rekrutt krever samtykke og har en forståelig identitet, behov og kompetanse. Noen krever mer omsorg og ressurser enn de bidrar med. Crew kan presenteres samlet når befolkningen vokser, og både opprinnelige og senere overlevende kan kvalifisere seg som ledere.
- **Kunnskap:** Speiding og forskning reduserer usikkerhet og gir målrettede mottiltak mot mutasjoner.
- **Styresett:** Harde valg kan bevare ressurser, men påvirke tillit, lojalitet, diplomati og fremtidig stabilitet.

## 6. Sluttmål og replayability

- (B) **Cure victory:** Finn/utvikle en kur og få den til å fungere i praksis. Eksakt forskningskjede er Å.
- (B) **Stability victory:** Sikre nok av regionen til at et varig samfunn fungerer til tross for eller etter lokal utryddelse av zombier. Ikke bare «overlev X dager».
- (B) Highscore prioriterer antall spilldager til oppnådd seier. Skill kur og stabilitet i separate lister, og skill vanskelighetsgrad/singleplayer/co-op (H).
- (B) En ny gjennomspilling starter uten forskningsfordeler fra forrige run. Innenfor samme run kan du beholde kunnskap etter territorie-/infrastrukturtap.
- (H) Seedede variasjoner i utbrudd, zombietraits, ressursfunn, NPC-fraksjoner og hendelser gir nye strategiske problemer. Ikke fullstendig vilkårlige game-over-hendelser.

## 7. Hva spillet ikke er

- Ikke action-/skytespill.
- Ikke city-builder hvor hvert hus krever separat plassering.
- Ikke fantasy-RPG med enorme HP-/damage-skalaer.
- Ikke 500 individuelt administrerte borgere.
- Ikke åpen PvP-server med endeløse venteturer og raid i frakoblede sesjoner.

## 8. Første slice

M3 demonstrerte dagsturer, faste forsyningssteder og et midlertidig tilfluktssted. Neste slice prøver en friere åpning på Buøy/Hundvåg med ZA Survival Handbook, varig arbeidsfremdrift, separate søke- og kontrolltilstander, frivillig rekruttering og press på utsatte passasjer. Spilleren kan tidlig få nytte av en operasjonsbase og deretter bygge kapasitet mot et fungerende HQ. Første 15 dager brukes til å vurdere valg og læring. Det endelige tempoet og overgangstersklene er åpne. Se [fase 1-slicen](16_PHASE1_SLICE.md).
