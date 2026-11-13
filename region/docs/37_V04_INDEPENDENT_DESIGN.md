# Førstekonsept: Stedet, menneskene og neste dag

Uavhengig konsept skrevet uten å lese dagens UI, skjermbilder, tidligere UX-vurderinger eller implementasjonsdokumenter. Dette gjelder presentasjon av eksisterende regler, ikke forslag til nye regler.

## Hovedgrep

Spillet bør oppleves som å lede fire mennesker gjennom et virkelig sted. Kartet er arbeidsflaten, men det viktigste er sammenhengen mellom et sted, menneskene som sendes dit, og hva det betyr for hjemmet neste dag.

Den primære beslutningen er: «Hva skal vi bruke folkene våre på, og hva lar vi være ubeskyttet eller ugjort?» UI-et bør gjøre denne avveiningen synlig mens ordren settes sammen, ikke kreve at spilleren husker tall fra flere paneler.

## Hva spilleren må forstå

**På tre sekunder, uten å lese et avsnitt:**

- Hvor er hjemmet vårt, og hvilket sammenhengende område eier vi?
- Hvilken dag er det, og er situasjonen hjemme rolig, truet eller ukjent ut fra informasjonen spillet faktisk har?
- Hvilke av de fire personene er hjemme, ute eller klare for planlagt avreise?
- Finnes det en konkret mangel eller hendelse som krever oppmerksomhet før neste dag?

Dette betyr ikke at alle verdier skal være synlige samtidig. En fast, liten dag-/hjemstatus og fire navngitte personmarkører gir orientering. Bare avvik og beslutningskritiske mangler får sterk visuell vekt.

**På ti sekunder, ved å se på kartet og dagens plan:**

- Hvor går grensen mellom vårt område og omgivelsene?
- Hva vet vi, og hva vet vi ikke, om stedene nær denne grensen?
- Hvilke få steder er relevante muligheter akkurat nå, og hvorfor?
- Hvem er på vei hvor, når kan de være tilbake, og hvem blir hjemme hvis planen gjennomføres?
- Hvilken ressurs kommer til å begrense den valgte planen eller eksisterende forbruket først, dersom dette kan beregnes fra kjente regler?

**Med ett klikk på et sted eller en person:**

- Sted: kjent tilstand, kilde/ferskhet når relevant, tilgjengelige eksisterende handlinger og oppdrag knyttet til stedet.
- Person: navn, eksisterende relevante egenskaper/tilstand, oppgave, bundet utstyr og tilgjengelighet.
- Oppdrag: deltakere, mål, reise/arbeid/retur, ressursbinding og hjemmekonsekvens.
- Varslet mangel: beholdning og det konkrete behovet som skaper mangelen.

«Ett klikk» betyr tilgang til forståelse og valg, ikke at en ordre må sendes uten gjennomgang.

## Valg av hovedflate

Jeg vurderte tre muligheter:

1. **Et kommandobord med mange statuskort.** Bra for sammenligning, men deler opp årsak og sted. Byen blir bakgrunn, og fire mennesker risikerer å se ut som produksjonsspor.
2. **En persondrevet leirvisning.** Gir nærhet og tydelig arbeidsfordeling. Svakere når sammenhengende territorium, avstander og flere geografiske nivåer er selve problemet.
3. **Et kart med en kontekstuell ordreflate.** Best samsvar med geografien. Faren er ikonstøy og skjult logistikk; derfor må en liten, vedvarende person-/planstripe følge kartet.

Jeg velger alternativ 3. Kartet får hovedplassen. Valgt sted åpner én arbeidsflate ved siden av eller over en del av kartet, avhengig av skjermbredde. Dette er et fokusert valgrom, ikke en permanent vegg av seksjoner. Personene og neste dags handling forblir synlige når det planlegges.

## Kartets visuelle språk

**Geografi og nivåer:** Vis ekte grenser og navn. L1/L2/L3 er datamodell, ikke nødvendigvis spillerens navigasjonsspråk. Bruk stedsnavn og en sti som «Stavanger › [område] › [lokalområde]». Zoom endrer detaljgrad; den skal ikke endre betydningen av eierskap eller skape nye grenser. På oversikt aggregeres POI-er og oppdrag. Ved nærmere zoom foldes faktiske steder ut. Hvis et overordnet område bare delvis er vårt, skal det se delvis kontrollert ut, ikke få en misvisende heldekkende eierfarge.

**Eierskap:** Vårt territorium får en rolig sammenhengende flate med en tydelig yttergrense. Hjemmet har et særpreget symbol som alltid er lett å finne. Grensen viser faktisk kontroll, ikke bare hvor vi har vært. Et besøkt eller ryddet sted må ikke se overtatt ut dersom det ikke er overtatt.

**Frontlinje:** Den faktiske kontaktgrensen leses som territoriets kant. Bare der kjent fare møter grensen får den sterkere oppmerksomhet. Ikke tegn en dramatisk «front» gjennom ukjent område som om spillet vet at fienden står der. Valg av et grenseområde viser naboskap og hvor en eksisterende overtakelsesregel tillater neste steg.

**Fare:** Skill fare fra eierskap og usikkerhet. Eierskap bæres av flate/grense; kjent fare av lokale faresymboler eller avgrenset tekstur; ukjent informasjon av nedtonet detalj og tydelig «ukjent». Farge alene er utilstrekkelig. Numerisk zombieantall vises bare når spilleren faktisk kjenner tallet. Et estimat merkes som estimat. Gammel etterretning merkes som sist kjent, med tidspunkt hvis systemet har det.

**Muligheter:** Vis hva som gjør stedet interessant når det er kjent: tilgjengelig handling, kjent ressurs eller relevant oppdragsmål. Ikke vis uoppdaget innhold som et sikkert premieikon. Et ukjent POI kan være synlig som et kjent sted i byen uten at innholdet dermed er kjent.

**Lag:** Standardkartet prioriterer kontroll, hjem og oppdrag. Et enkelt valg kan fremheve fare eller forsyninger når spilleren undersøker dette. Unngå at alle lag konkurrerer hele tiden. Valgt sted har alltid en tydelig kontur og beholder navn og sammenheng selv om kartlaget endres.

## Oppdrag er mennesker bundet over tid

Planlagte og aktive oppdrag bruker samme grafiske grammatikk, men tydelig forskjellig form: stiplet rute og «planlagt», heltrukket rute og «aktiv». Markører og tekst støtter forskjellen. Aktive reiseretninger og mål må kunne leses uten animasjon.

Et oppdrag forklares som en tidslinje på faktiske dager:

    Avreise → Reise → Arbeid → Retur → Hjemme igjen
       navn + bundet utstyr under hele fraværet

Fasene må samsvare med simuleringens oppløsning. Hvis flere faser skjer i samme dag, vis dette innenfor dagens felt. Ikke antyd at spilleren kan gripe inn mellom faser når én tur er én dag. Hvis returtid er usikker, vis usikkerheten; ikke gi et presist løfte.

Når spilleren velger en handling på et sted, åpnes en ordreflate som følger beslutningsrekkefølgen:

1. Hva forsøker vi å gjøre her, og hva bygger forventningen på?
2. Hvem sendes, og hvilket eksisterende utstyr bindes?
3. Hvilke dager er de borte, og hvilke kjente ressurser kreves?
4. Hvem er igjen hjemme etter at alle planlagte avganger er tatt med?
5. Legg ordren i planen med eksisterende bekreftelses-/avreisemekanikk.

Ikke finn opp en ny reservasjons- eller planfase hvis spillet sender folk straks. Samme visuelle gjennomgang kan ligge før den eksisterende sendeknappen. UI-et må uttrykke det som faktisk skjer: «Send nå» dersom ordren binder nå; «Planlegg» bare hvis spillet faktisk har denne tilstanden.

Det viktigste sammenligningsfeltet er rett ved bekreftelsen: **«Hjemme etter avreise: [navn]»**. Vis kjente konsekvenser av redusert bemanning uten å dikte opp en trygghetsprosent. En oppdragsliste med bare mål og varighet ville skjult spillets viktigste kostnad.

## Ressurser og mennesker

Ressurser presenteres som beholdning sammen med den nærmeste relevante konsekvensen: kjent forbruk, oppdragskostnad eller mangel. «12» er vanskelig å handle på; «12 tilgjengelig · planen krever 5» forklarer beslutningen dersom systemet faktisk har slike størrelser. Skill lagret, bundet og tilgjengelig når spillreglene gjør dette skillet. Ikke vis samme ressurs som disponibel på flere samtidige ordre.

Fremtidige beholdninger må merkes som prognoser og bare regnes fra kjent forbruk og sikre tilførsler. Ressurser i ukjente bygninger er aldri del av budsjettet. Ikke la antatt bytte skjule at dagens plan er underfinansiert.

De fire menneskene vises med navn og et lite portrett/særpreg, med oppgave og tilgjengelighet som primær status. Hjemmeværende personer er like synlige som utsendte. Velg en person for å se kartkoblingen til oppdraget; velg oppdraget for å fremheve deltakerne. Unngå permanent gjentakelse av alle egenskaper. Vis bare de eksisterende egenskapene som har betydning for det aktuelle valget, med resten tilgjengelig i persondetaljen.

## Neste dag og liv i spillet

«Neste dag» er det tydelige rytmepunktet. Før spilleren går videre, viser det eksisterende ordregrunnlaget en kort oppsummering: hvem drar, hvem blir borte, hvem er hjemme og hvilke konkrete mangler som allerede er kjent. Dette kan ligge inntil knappen uten en obligatorisk modal hver tur. Ikke lov et eksakt utfall av ukjente hendelser.

Etter turen formidles få betydningsfulle endringer knyttet direkte til stedet eller mennesket: et oppdrag kom hjem, et område skiftet kontroll, en kjent ressurs ble brukt opp. Klikk på hendelsen flytter fokus til årsaken. Rene tallendringer samles i en tilgjengelig dagslogg i stedet for å fylle kartet.

Liv kommer fra eksisterende tilstand, ikke konstant tekst: personer flytter seg mellom hjemme og ute; aktive oppdrag får behersket bevegelse; kartet viser spor av faktisk kontroll og utførte handlinger; korte resultatsetninger bruker personnavn. Samme varsel gjentas ikke hver dag uten endring. Ingen fiktive sanntidsbevegelser eller oppdiktede persondramaer som antyder nye regler.

Progresjon blir lesbar som en geografisk og operativ forandring: fra fire personer rundt ett hjem, til flere sammenhengende områder, til lokal produksjon og regional oversikt. Kontroll og uttømming må begge være synlige, slik at større territorium ikke automatisk leses som uendelige forsyninger. På høyere nivå oppsummeres eksisterende lokal produksjon og oppdrag per område; spilleren kan fortsatt gå ned til sted og person. Nye relevante valg får plass når de faktisk finnes, uten tomme fremtidspaneler fra første dag.

## Konkret informasjonsstruktur

    DAG 8   Hjem: [kjent relevant status]          [Neste dag]

    Stavanger › [valgt område]        [Kontroll | Fare | Forsyning]
    ┌────────────────────────────────────────────────────────┐
    │                                                        │
    │   KART: ekte grenser, rolig territorieflate              │
    │   HQ + navn ved fokus                                   │
    │   kontaktgrense / kjente farer / ukjente steder          │
    │   aktive ruter ━━━   planlagte ruter ┄┄┄                │
    │                                  ┌──────────────────┐  │
    │   valgt sted + naboer             │ VALGT STED       │  │
    │                                  │ Hva vet vi?      │  │
    │                                  │ Hva kan vi gjøre?│  │
    │                                  │ Folk / utstyr    │  │
    │                                  │ Reise–arbeid–retur│ │
    │                                  │ Hjemme etterpå   │  │
    │                                  │ [Bekreft ordre]  │  │
    │                                  └──────────────────┘  │
    └────────────────────────────────────────────────────────┘
    [Navn: hjemme] [Navn: ute → dag 10] [Navn: …] [Navn: …]
    Plan/aktive oppdrag: kompakt dagslinje · klikk for detaljer
    [Beslutningskritisk ressurs/mangel]       [Dagens endringer]

På en liten skjerm erstatter stedets arbeidsflate nederste del av kartet, med valgt sted fortsatt synlig over. Full personliste, omfattende ressursoversikt og historikk åpnes ved behov. Den eksakte plasseringen er sekundær; koblingen sted–person–tid–hjem er kravet.

## Prioritering

**P0 — forstå konsekvensen før en ordre:** korrekt eierskap og nivåhierarki; kjent/ukjent informasjon; fire personers faktiske tilgjengelighet; tidsbinding inklusive retur; tydelig hjemmestyrke etter avreise; forskjell på planlagt og aktivt; ærlig ressursbinding. Feil her gjør valgene misvisende.

**P1 — kunne finne et godt neste valg:** tydelig kontaktgrense, relevant stedinformasjon, kartkobling for oppdrag og personer, ressursbehov forklart mot beholdning, kort og forståelig dagsskifte.

**P2 — få verden til å leve og skalere:** portretter og korte navngitte resultater, behersket oppdragsbevegelse, geografiske spor av endringer, og aggregering som gjør senere regional ledelse lesbar.

Test konseptet ved å gi en ny spiller en konkret tilstand og be dem peke ut hvem som blir hjemme hvis et oppdrag sendes, når folkene kan være tilbake, hva som er ukjent ved målet, og hvilken grense som faktisk kan flyttes. Hvis disse svarene krever paneljakt eller regelgjetting, har presentasjonen ikke løst hovedoppgaven.
