# UI og UX – postapokalyptisk kommandosentral

## 1. Visuell retning

Referanse: `../assets/command-center-concept.png`. Den viser ønsket stemning, ikke korrekt geografi, datamodell eller tekst som skal kopieres slavisk.

**Stikkord:** Mørkt taktisk kart, nedtonet oliven/grønt for kontroll, rust-oransje for contested, begrenset rødt for reell fare, varm off-white tekst, tynne kartgrenser, litt slitt karttekstur. Presis typografi. Ikke generisk SaaS-dashboard, sci-fi-neon eller store flytende kort.

Brukerens eksisterende prototype har allerede mørkt kart, soner, crew-kort og End Day, men mange røde skravurer/labels dominerer og konkurrerer med handlinger. UI bør ha mindre samtidig informasjon og sterkere visuell prioritering.

## 2. Desktop hovedskjerm

**Kartet er sentrum (omtrent 60–70 % av tilgjengelig bredde):**

- Venstre kontekst: Dag/fase, kritiske ressurser, aktive ledere/crew.
- Sentrum: Interaktivt kart med status, fog-of-war, få viktige symboler og valgt objekt.
- Høyre kontekst: Valgt sone/POI/crew, risikovurdering, ETA, konteksthandlinger.
- Nederst: Turkontroll, Ready-status for begge spillere, siste dagsrapport og relevante milepæler.

Ikke vis alt på en gang. Panelet for valgt objekt er alltid viktigere enn et permanent detaljert debugkart.

## 3. Faseavhengig progresjon

| Fase | Primær kartvisning | Kommando | Sidepanel |
| --- | --- | --- | --- |
| 1 | L3, små lokale områder | Handling på individ/sone/POI | Navngitte overlevende, gear, umiddelbart behov |
| 2 | L2 med mulighet for L3 | Hele distrikter, prioriterte POI-er, crew-ruter | Crewstatus, ETA, perimeter, HQ |
| 3+ | L1 og strategiske oversikter | Forsyning, diplomati, produksjon, allianser | Samfunnstall og fraksjoner |

Høyere zoom-/kommandonivå åpnes ved faseprogresjon; lavere detaljnivå kan alltid åpnes. Det skal være mulig å gi én L2-clear ordre uten å klikke 50 L3-soner.

## 4. Kartlag og semantikk

- Unknown/fog: Det spilleren ikke vet er ukjent, ikke en eksakt «100 zombier»-etikett.
- Explored: Synlig med alder/sikkerhet på intel.
- Controlled: Diskré kontrollfarge.
- Contested/threatened: Varslende grense/ikon; rødt brukes sparsomt.
- Selected: Tydelig outline, ikke helskjerms skravering.
- POI: Ikon etter funksjon (mat, helse, industri, transport, energi).
- Chokepoint: Egen markør for bru/tunnel/ferge og status.
- Movement/noise: Kan vises som midlertidig «intel»-overlay.
- Barriers: Synlig helsestatus/press og varsling før kollaps.

Verdensstatus og spillerens kunnskap må vises ulikt. Grafikk må aldri lekke skjulte eksakte tall.

## 5. Tre viktigste skjermflyter

### A. Dag 0

Start → kart med liten trygg base/utgangspunkt → velg nærliggende ukjent L3 → scout eller clear → tildel person og gear → End Day → tydelig rapport med risiko, loot, skader og ny intel.

### B. L2-operasjon

Velg distrikt → «Clear district» → velg crew(s) → velg Safe advance / Fast approach → valgfritt prioritert POI → vis rute, ETA og risiko → lås ordre → dagsvis fremdrift. Vis hvor oppdraget stoppet hvis crewet møter motstand.

### C. Krise på perimeteren

Varsel om press på barriere → zoom til grensen → se estimert trussel, tilstand, vakter og ETA for forsterkning → velg reinforce/retreat/repair → resultat ved neste tur. Dette er mer interessant enn en uvarslet tilfeldig sone som blir rød.

## 6. Personer og beslutninger

- Få navngitte characters skal ha forståelige portretter, skader, særtrekk og status. Ikke bare tallrader.
- Utstyrsvalg skal være konsekvensbaserte: effekt, noise, ammo, risk, weight/transport. Ikke masse små slots.
- Moralske eventer vises som tydelige beslutninger med kjent kostnad, usikkert utfall og senere historie. Ikke oppgi den «riktige» beslutningen.
- Daglig rapport viser **hva endret seg og hvorfor**, ikke bare en vegg av tall.

## 7. Mobil

Design desktop først. Mobil er mulig i browser, men kart+sidepaneler krever egen kompakt modus: kart + bunnark, maks én kontekst om gangen. Ikke la mobilkrav styre desktop-arkitekturen før kjerneløkken er spillbar.

## 8. UX-regel

Per beslutning skal spilleren normalt forstå: **mål → tilgjengelig handling → tidsbruk/ressurser → risiko → konsekvens/rapport**. Hvis en skjerm mangler ett av leddene, forbedre UX før nye funksjoner.
# Visuell oppdatering 01.11.2026

Etter eierens nye referansebilde er M3-presentasjonen bygget om til et tettere kommandosenter: ressurser og fire personkort til venstre, kart i full høyde, feltmappe med områdeillustrasjon til høyre og faktisk basefremdrift/siste aktivitet nederst. «After Day Zero» brukes som visuell hovedtittel med Stavanger Z i undertittelen.

Kartet bruker eksisterende OSM-bygningsomriss og veier, teksturert land og dempede sonelag. Ingen nye sonegrenser eller spillregler. Portretter og illustrative stedbilder er dokumentert med genereringsprompter i `assets/ui/README.md`. De fire kjernehandlingene er direkte knapper; forsyning/perimeter/base er samlet i en meny. Risiko og kostnad vises før ordre, mens utdypende begrunnelse kan åpnes.

# Kartmarkører 01.11.2026

Etter eierens tilbakemelding vises soner med dempede, runde typeikoner (bolig, industri, handel, idrett, skole og gjennomfart). Sone-ID-er og navn beholdes i data, feltmappe og verktøytips; store soneetiketter fjernes fra kartet. Klassifiseringen er presentasjon og innfører ingen nye kamp-/ressursregler.

Oppdagede POI-er har egne firkantede markører på stedets koordinat. Klikk velger sted og forsyningsoppdrag med kjent beholdning, risiko og rute. Sonens kontrollhandlinger og POI-oppdrag har separate panelvisninger. Tømte steder dempes; uspreidede forsyninger vises ikke. Rosenberg vises fortsatt som kjent framtidig HQ-kandidat uten avslørte forsyninger. «Vis kontrollområdet» går tilbake til sonehandlingene. Ingen nye funn, polygoner eller lagringsendringer.

# Lesbarhet og beslutningsgrunnlag – 01.11.2026

Spilltekst i sidepanelene prioriteres i 12–15 px med tydelig kontrast, større ikoner og eksplisitt panelrulling på bærbar skjerm. POI-restlager og anslått hjemtransport er separate begreper. Kontrollstatus, observasjon, antall og alder er separate felt. Første dag uten ordre forklarer fortsatt forbruk, zombiebevegelse og mulig perimeterpress før spilleren bekrefter. Dette endrer ikke dagsreglene.

