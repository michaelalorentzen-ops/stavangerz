# StavangerZ v0.4 – beslutningslogg

**Sist gjennomgått:** 12.11.2026. **Eier:** Mikki.  
**Kilde:** Samtale om v0.4 11.–12.11.2026 og verifisert v0.3-grunnlag i repoet.

Dette dokumentet skiller **LÅST** (produktbeslutning godkjent av eier) fra **ÅPEN** (krever senere avklaring) og **HYPOTESE** (kan prøves i implementasjon uten å gjøre den til bindende design). Full regeltekst finnes i [27_V04_MASTER_SPEC.md](27_V04_MASTER_SPEC.md).

## Låste designbeslutninger

| ID | Status | Beslutning | Begrunnelse / konsekvens |
| --- | --- | --- | --- |
| D01 | LÅST | Én tur er 07:00–07:00; operasjonsvindu 07–22, nattvindu 22–07; rask avspilling er standard. | Tydelig dagsforløp uten minuttbasert simulering. |
| D02 | LÅST | Skip hopper bare over animasjon, ikke obligatoriske beslutninger; hendelser kan pause og fortsette turen. | Valg må gi konsekvens uansett avspillingshastighet. |
| D03 | LÅST | Skille strategisk spiller, sårbar fysisk hovedperson og politisk leder; valg tas av personen på stedet eller gjennom faktisk samband. | Risiko ved personlig tokt, troverdig delegasjon. |
| D04 | LÅST | Crew har vedvarende fysisk plassering; områdebaserte vakthold kan dekke L2/L3 uten nøyaktig L3-punkt. | Logiske bevegelser og håndterbar visning på alle zoomnivåer. |
| D05 | LÅST | Kart viser L1/L2/L3 etter zoom; animer bare relevante synlige bevegelser, ikke flytt kamera automatisk. | Lesbarhet og ytelse. |
| D06 | LÅST | Svakt eierskapsfyll, tydelige grenser, flytende polygonklippet soneovertakelse og tap. | Territorieendring må oppleves, men geografi ikke skjules. |
| D07 | LÅST | 2.5D/enkle 3D-markører kan komme senere og vises ved relevant zoom; ingen 663 unike soneillustrasjoner. | Visuell verdi uten kostbar produksjonsplikt. |
| D08 | LÅST | Dagsrapport med hovedsak, ressurser/utholdenhet, risikoprioritet og gjenbrukbart, kontekstuelt bakgrunnsbilde ved behov. | Signal fremfor støy; detaljer beholdes tilgjengelig. |
| D09 | LÅST | Faste gjenkjennelige portretter med utstyrskort; ikke et system som dynamisk tegner alle klær på portrettet. | Identitet med overkommelig asset-omfang. |
| D10 | LÅST | Auto equip er PÅ ved oppdragsvalg; utstyr vises/kan redigeres; manuelle låser respekteres; reservasjon skjer i planleggingsrekkefølge. | Loot er interessant tidlig; senere slipper spilleren min/maxing. |
| D11 | LÅST | Utstyr følger folk fysisk, returneres først ved faktisk HQ-ankomst; forsyning i felt krever transport. | Lager og logistikk må være reelle systemer. |
| D12 | LÅST | Gradvis logistikkautomatisering gjennom HQ-rolle og mandat, ikke globale teleporterende gear-oppgraderinger. | Automatisering som progresjonsbelønning. |
| D13 | LÅST | Tre POI-nivåer: ordinær sone, vanlig POI, unikt scenario/landemerke; å eie sonen er ikke alltid det samme som å ha tatt POI i bruk. | Variasjon uten håndlagde oppdrag overalt. |
| D14 | LÅST | ZA-boka har fem fasekapitler, grunnleggende håndbok og en feltguide som fylles av funn/research; kapittel 2 låses til fase 2 osv. | Veiviser og læring fremfor obligatorisk questlogg. |
| D15 | LÅST | Åpen hovedhistorie og valgfrie, delvis personbundne historier; spor kan mistes permanent, men ikke være eneste vei til nødvendig progresjon. | Spillervalg og replayability. |
| D16 | LÅST | Faser åpnes ved samfunnets reelle kapasitet og kan nås gjennom alternative strategier; ikke via bokas sjekkliste/tidslås. | Fleksibel progresjon, ikke day-4-snarvei. |
| D17 | LÅST | Flere avslutninger avledes av samfunnet/valgene/forskningen, ikke bare et siste knappetrykk. | Verden reagerer på spillerens historie. |
| D18 | LÅST | L1-regioner i senfase kan ha regional leder, eget HQ, underordnede crew-ledere og faktisk lokal lager-/forsyningstilstand; hele riket eies av én organisasjon. | Skalerer styring uten å bygge separate NPC-riker. |
| D19 | LÅST | Styreformen setter ledermandat og autonomi; rutinene delegeres, store strategiske valg forblir hos spilleren eller gis bevisst mandat. | Meningsfull styringsform og mindre mikrostyring. |
| D20 | LÅST | Samme hoved-UI gjennom alle faser; kartet sentralt, kontekstpanel, fokus på kritiske avvik, handlingslinjen viser uavklarte saker. | Progressiv informasjonsmengde. |
| D21 | LÅST | Tre grader: Story, Survival (standard), Realistic. Hardcore er en separat toggle som kan kombineres med alle. | Spilleropplevelse uten ulike spillmotorer. |
| D22 | LÅST | Normal modus: samfunnet kan leve videre ved hovedpersonens død. Hardcore: hovedpersonens død gir game over og tidligere valg kan ikke lastes tilbake. | Meningsfull personlig risiko. |
| D23 | LÅST | Implementering er vertikal og orkestrert. Låste designbeslutninger eies av Mikki, og agenter stopper bare ved reelt blokkerende valg. | Unngår parallelle produktbeslutninger, kodekonflikter og spørsmålsoverlast. |

## Åpne produkt- og balansevalg

Ikke tolk manglende svar som stilltiende godkjenning. Orkestratoren velger når disse trenger svar, **ikke** alle på én gang.

| ID | Status | Spørsmål / alternativer | Når det blokkerer |
| --- | --- | --- | --- |
| O01 | ÅPEN | Er *hele* hjemmets L2 et absolutt krav for fase 2, eller kan et dokumentert forsvarbart kjerneområde oppfylle samme kapasitet? | Før implementering av fasegating. |
| O02 | ÅPEN | Eksakte krav for fase 2–5, minimumsvarighet og akseptable alternative kapasiteter. | Før endelige balanseverdier og faseskifte-UI. |
| O03 | ÅPEN | Arbeidstid, hvile, reisehastighet, nattskift, transportkapasitet og utmattelsesformler. | Før faktiske motorregler; prototypen kan bruke tydelig merket hypotese. |
| O04 | ÅPEN | Hvilke møte-/krisetypene skal kunne pause dagen; når kan radio kalle spilleren inn; standardmandat ved radiotap? | Før checkpoint-/eventkontrakt ferdigstilles. |
| O05 | ÅPEN | Utstyrsslots, auto-equip-score, låste/utlånte gjenstander, personlig gear kontra oppdragslager og logistikkbudets presise kostnad/risiko. | Før gear- og forsyningsimplementering. |
| O06 | ÅPEN | Hvilke konkrete steder får unike POI-scenarier og hvordan eksisterende seks wonders skal overføres fra automatisk «sonen er vår» til «anlegget er i drift». | Før POI-revisjon av eksisterende innhold. |
| O07 | ÅPEN | ZA-bokas endelige kapittelnavn, forfatter/fortelleramme, konkrete tekstsider og hvor mye som er forhåndsskrevet kontra spillerens feltnotater. | Før produksjon av endelig narrativt innhold. |
| O08 | ÅPEN | Antall slutter, tilstandsaksene som avgjør dem, og hvilke sluttscener som er kuraterte. | Før finale-/ending-innhold. |
| O09 | ÅPEN | Region-HQ-kostnad, hvilke L1 som kan få guvernør, depotplassering, ressursflyt, forsyningspolicy og etterfølgelse ved lederdød. | Før regional styring programmeres. |
| O10 | ÅPEN | Exakt policy/mandat for styreformene; hvilke operative handlinger regionale ledere kan starte selv. | Før delegert region-AI. |
| O11 | ÅPEN | Numeriske skiller mellom de tre vanskelighetsgradene, hjelpemekanismer på Story, og lagrings-/krasjregler for Hardcore. | Før lanseringsbalanse og settings. |
| O12 | ÅPEN | Endelig visuell stil, timing på animasjoner, antall faste pins/varsler og mobile breakpoints. | Før UI-polering; prototyper kan testes. |
| O13 | ÅPEN | Hvilke historielinjer kan forsvinne helt ved persondød, og hvilke viktige mekanikker krever alternative kilder? | Før sidehistorier knyttes til irreversibel dødelighet. |

## Arbeidshypoteser (ikke låste krav)

- **H01:** En normal arbeidsøkt på ca. åtte timer, med overtid og nattarbeid som sliter mer. Klokkevinduet 07–22 er større enn normal arbeidstid.
- **H02:** En regional leder får én overordnet prioritert policy og ett startbudsjett som kan justeres manuelt; automasjon bruker kun tilgjengelige lokale ressurser.
- **H03:** Report UI kan velge én dominerende hendelsesillustrasjon og bruke enklere bakgrunn ved rutinedager.
- **H04:** Karakterens manuelle gear-valg låser bare valgte slots, mens andre slots fortsatt foreslås av Auto equip.
- **H05:** En samlet fase-1-slice bygges før region-AI i fase 4–5, selv om designet for alle faser er spesifisert nå.

## Ny beslutning – fremgangsmåte

Når en utvikler oppdager et hull:

1. Sjekk master spec og tidligere beslutninger. En gammel fil gjelder ikke foran ny, låst v0.4-beslutning.
2. Formuler ett konkret spørsmål med **forslag**, berørte moduler og konsekvens ved A/B. Ikke send en løs idé uten vurdering.
3. Vurder om arbeidet kan fortsette med isolert teknisk hypotese. Slike hypoteser skal merkes og testes.
4. Orkestratoren samler bare **blokkerende** spørsmål, grupperer dem og ber Mikki låse valget.
5. Ved godkjent endring: oppdater denne loggen med ID, status, dato, begrunnelse, og speil regelen i master spec og aktuelle tester **før** underagenter implementerer den.

**Merk:** Balansegrenser og tekniske detaljer kan foreslås i PR uten å opphøyes til «låst» produktvalg. En byggende agent kan ikke selv omklassifisere ÅPEN til LÅST.
