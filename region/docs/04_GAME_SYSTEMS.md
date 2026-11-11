# Game Systems – mennesker, HQ, økonomi og samfunn

Produktprinsippene følger [låste beslutninger 02.11.2026](15_LOCKED_DESIGN_2026-11-02.md). Konkrete rater og oppskrifter er spilltesthypoteser.

## 1. Mennesker og crew

**Fase 1:** 3–5 navngitte overlevende (eksempel: fire fra eksisterende prototype) med helse, skader, erfaring, personlighet, egenskaper og utstyr. Spilleren gir dem konkrete handlinger.

**Fase 2+.** Både de første og senere overlevende kan kvalifisere seg som crew-ledere gjennom erfaring og egnethet. Crew og større arbeidsgrupper viser samlet kapasitet, utstyr, tilstand og forsyninger. Hvert medlem har en enkel identitet og profil med behov, kompetanse og relevante relasjoner.

Spilleren kan godkjenne eller avvise hver rekrutt individuelt. Ventende personer får synlige behov og følger av avgjørelsen. Omsorgstrengende personer kan være en varig nettokostnad.

## 2. XP, traits og trening

- **Faste traits/bakgrunn:** Tidligere yrke, temperament, verdier, særlige evner og mulige ulemper. Personene må føles ulike.
- **Trainable skills:** Combat, scouting, medical, mechanics, logistics, leadership (foreløpig forslag). Øves ved oppdrag, training eller fasiliteter.
- **Levels/perks:** Nivå kan gi små taktiske fordeler eller spesialisering, ikke 5× menneskelig HP. Evner kan låses opp ved milesteiner; presis modell er Å.
- **Skader/tap:** Skader, slitasje, hvile og eventuell permanent død må være meningsfulle. Å miste en veteran skal koste erfaring, ikke slette all teknologisk kunnskap.

## 3. Utstyr

Hold UI og økonomi enkel i første versjon:

| Slot | På hvem? | Eksempel | Virkning |
| --- | --- | --- | --- |
| Weapon | Person/crew-profil | Kniv, pistol, rifle | Kamp, lyd, ammo og rekkevidde |
| Protection | Person/crew-profil | Lett/tung beskyttelse | Skadereduksjon, mobilitet |
| Utility | Person/crew | Medkit, verktøy, ekstra sekk | Oppdrag, reparasjon, scavenging |
| Vehicle | Crew | Sykkel, bil, varebil, båt | Reisetid, fuel/batteri, kapasitet, rute |

Ingen egne slots for hjelm, bukser, hansker osv. i første scope. Etter fase 2 kan generisk crew-utrustning administreres med templates/tiers; lederen har særskilt personlige items.

Forskning og verksteder gir nye utstyrstyper, reparasjon, produksjon og mer effektiv bruk – ikke umiddelbart gratis gear til hele befolkningen.

## 4. Transport og reisetid

- Reise følger forbindelsesgrafen, transportmodus og veistatus; ikke bare luftlinje til POI.
- Gange, sykkel, drivstoffbil, elbil og båt har ulik fart, kapasitet, forbruk og sårbarhet. Ikke alle modes trengs i første slice.
- Clear road / repair road er egne investeringer som reduserer reisetid/risiko senere.
- Vær kan påvirke sjøtransport; utrygge ruter gir høyere risiko/støy.
- Motoren beregner ETA for ordre, og UI viser forskjell mellom trygg rute og rask risikabel rute.

## 5. Ressurser og behov

**MVP-kjerner:** mat, vann, medisin, materialer, ammo, fuel (noen kan slås sammen midlertidig). Strøm modelleres primært som produksjon/tilgjengelig kapasitet, ikke magisk lagervare. Moral/stabilitet er tilstand, ikke loot.

Per dag:

`netto = produksjon + scavenging + handel - konsum - bygging - vedlikehold - tap`

Krav:
- Mat og butikk-POI-er har finite beholdninger. Etter hvert må jordbruk, vann, energi og produksjon erstatte scavenging.
- Befolkning skaper både arbeidstilgang og konsum. En stor bosetning kan få negative nettoressurser selv om hæren er sterk.
- Kapasitet kommer fra kontrollert bebyggelse, infrastruktur og forsyning; befolkning kan ikke øke ubegrenset.
- Transport av ressurser krever tilgjengelige forbindelser og kapasitet når samfunnene blir store.
- Store avstander, lange forsyningslinjer og få chokepoints skaper realistiske sårbarheter.

Ikke lås balanseverdier i denne spesifikasjonen. De skal være data/config og justeres etter spilleflyt.

## 6. HQ og fasiliteter

Fase 1 utvikler tilfluktsstedet trinnvis til en operasjonsbase og et fungerende HQ. HQ kan gi fordeler før hele L2 er kontrollert. En operasjonsbase gir lokal støtte, mens et HQ også leder bosetting og drift. Strategiske anlegg og ressurssteder har egne funksjoner. Forslag til fasiliteter:

- Power: lys, elektrisk utstyr og lading.
- Water: rensing, lagring og distribusjon.
- Workshop: reparasjon og crafting.
- Training: crew-ferdigheter, nye ledere og koordinering.
- Medical: skader og rehabilitering.
- Security: vakter, perimeter og varsling.

Fasiliteter skal **låse opp funksjoner eller kapasitet**, ikke bare små prosentbonuser. Bygging bruker arbeidstid, materialer og noen ganger et fysisk egnet POI.

Rosenberg som HQ har sterke industrielle og sjørelaterte muligheter, men behov for forsyninger, mat og kontroll med transport. Kartet og økonomien skal avgjøre om det faktisk er best.

## 7. Diplomati og moralske avgjørelser

Spesielt fra fase 3, men tidlige beslutninger lager historikk:

- NPC-fraksjoner har behov, ressurser, verdier, militær evne, tillit og relasjoner.
- Handel, bistand, nekting av hjelp, straff, innslipp av flyktninger, behandling av syke og fordeling av mat kan endre relasjoner.
- Ingen enkel «good/evil»-måler. Konsekvenser vises gjennom legitimitet, disiplin, lojalitet, moral, omdømme og konkrete person-/fraksjonsreaksjoner.
- Noen valg er bevisst uten komfortabel løsning. Kortsiktig overlevelse kan skade langsiktig samfunn, men «snill» løsning er heller ikke alltid gratis.
- Alder eller skade skal ikke automatisk gjøre en person verdiløs; ferdigheter, erfaring, omsorgsarbeid, sykdomsrisiko og moral kan skape interessante tradeoffs.
- Karakterenes egne verdier kan skape konflikt med spillerens politikk. En tidlig crew leader kan nekte en ordre eller forlate samfunnet senere.

Hold første slice til én eller to eventkjeder som faktisk får ettervirkninger. Ikke produser 200 generiske hendelser før kjernen er morsom.

## 8. Faseovergang uten mikrostyringssjokk

Et fungerende HQ og et sammenhengende, forsvarbart L2-område åpner fase 2. Personer med relevant erfaring og egnethet kan lede aggregert crew. Spilleren kan fortsatt åpne deres detaljkort. L2-clear ordre blir progresjon over L3-celler. Ved fase 3 styres større grupper/forsyningsnett, men spilleren kan zoome inn og prioritere én viktig POI.

Det må aldri kreves at spilleren utstyrer hver av 500 innbyggere individuelt. Automatiseringsdoktriner, crew-templates og bygg-/patruljeprioritering skal erstatte mikrostyring.
