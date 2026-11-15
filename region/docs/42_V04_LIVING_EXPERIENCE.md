# v0.4 – fra system til levende spillopplevelse

## Mandat og baseline, 15.11.2026

Eierens nye oppdrag låser geografi og utsetter tallbalanse, men prioriterer historier, karakter, utforsking og visuelle hendelser. D29–D35 i beslutningsloggen gjelder. Leveransen bygges på `main 5a2bebe` (PR33). Remote er kontrollert; main og origin/main var like. Root og eldre arbeidskopier var rene. Ingen aktive andre agentarbeider var i gang ved oppstart.

Åpne historiske draft PR-er #12, #14–16, #18–19, #21–27 representerer den gamle stablede kjeden. Funksjonene deres er videreført i main gjennom senere integrasjons-PR-er; de skal ikke merges på nytt eller tolkes som nyeste utviklingsstatus. Ny isolert gren: `feat/v04-living-expeditions`, med automatisk deployment slått av.

[QA33](https://github.com/michaelalorentzen-ops/stavangerz/pull/33#issuecomment-6863654417) er lest: alle motor-/nettleserreiser og naturlig seier består. Seks lave funn gjelder små lagringsknapper, uklar rewind-advarsel, skjult lagringsinngang, nettleser-confirm, hardkodet Chromium og overlapp mellom to mobilkort. Disse rettes i samme leveranse; balanse-/seierstempo og fysisk GPU er ikke grunnlag for å endre tall her.

## Konkrete hull

- Eksisterende 117 hendelser dekker mange systemer, men daglig speiding/søk/kamp/etablering mangler et personlig, førstegangsvis lag med kontekst.
- Lokale undersøkelser er allerede deterministiske, endelige og fysisk rapporterte, men består av ett ordinært skapfunn og én Tor-historie.
- Illustrasjonene dekker intro, fire personer, faser, avslutninger og inventar. Seks unike anlegg og varierte feltmiljøer mangler bilder.
- Rapport, ZA-bok, kart, personlig gear og lagringssystem finnes og gjenbrukes. Eldre UX-klager er ikke automatisk aktuelle feil.

## Innholdskart for fem faser

| Fase | Overlevelse | Fremgang | Utforsking og personhistorier | Presentasjon / sannhetsgrunnlag |
| --- | --- | --- | --- | --- |
| 1 – utbruddet | Velg hvem som speider, søker, kjemper og hviler; reisen binder faktiske personer. | Første kontroll, holdbart perimeter og HQ; D25 beholdes. | Seks lokale feltsituasjoner og valgfrie historier for Ingrid, Marius, Leila og eksisterende Tor. | Første registrerte vellykkede handling har et kort, illustrert rapportminne med faktiske personer, sted og utfall. |
| 2 – etablering | Produksjon, ly og leirarbeid konkurrerer med feltarbeid. | Virkelige HQ-moduler, forsvar og fasekrav synliggjøres. | Personhistorier kan følges videre eller avsluttes til fordel for forsyninger. | Leirens scene følger oppnådd fase; ingen ny bygning eller produksjon påstås av bildet. |
| 3 – organisering | Fysisk forsyning og folk i felt; radio er kun kunnskap, aldri last. | Eksisterende forskning, nett og samband. | Flere kilder til kjente spor; videre undersøkelser konkurrerer med vedlikehold og reiser. | Samme rapportkontrakt gjennom faktisk hjemkomst/radio. Eksisterende hendelser og feltvalg beholdes. |
| 4 – utvidelse | Lokale lagre, binding av navngitte ledere og reelle transportlinjer. | Regionale HQ-er og faktiske milepæler; D28 beholdes. | Kuraterte illustrasjoner av seks unike anlegg, kun etter oppdagelse. | Kartfeedback ved synlige operasjoner, eksisterende L1/L2/L3 og modeller. Ingen kartomstrukturering. |
| 5 – fremtiden | Samfunnets faktiske stabilitet, diplomati og forskning avgjør fremtiden. | Eksisterende tre seiersveier og full epilog/krønike. | Historier kan stå uløste eller være mistet ved persondød; ingen blir nødvendig hovedquest. | Oppnådde hendelser og kapitler, ikke konstruerte premier. Naturlig seier er tidligere bevist; tempo balanseres senere. |

Dette er et innholdskart, ikke en ny obligatorisk oppdragskjede. Første implementerte dybde prioriterer 15–25 døgn; sent spill gjenbruker eksisterende systeminnhold og får de samme autoritative presentasjonsreglene. Nye senfase-historieløp ut over dette skal beskrives som videre arbeid hvis de ikke er gjennomført.

## Felles kontrakt og filansvar

`ReportLine.experience?` er et valgfritt, JSON-serialiserbart øyeblikksbilde: type, dag, sone, faktiske personer, resultat, kort fortellertekst/karakterstemme og semantisk illustrasjon/håndboktema. Det endrer ikke døgnmotorens rekkefølge, RNG, skade, forsyninger eller kapasitetskrav. Private rapportlinjer følger allerede det fysiske laget; førstegangsmarkører konsumeres først ved publisert rapport. Eldre saves omtales som første *registrerte* opplevelse.

- `expedition_truth`: kontrakt, autoritative motorhooks, determinisme/kompatibilitet.
- `living_stories`: eksisterende discovery-register og innholdskatalog; endelige valg/last og levende avsendere.
- `living_art`: seks miljøer og seks unike anlegg, faktisk lokale filer og proveniens.
- `experience_cards`: rapportkort, paginert feltjournal og kjente anleggsbilder.
- `expedition_feedback`: korte kartmarkeringer på aktive, offentlige avspillingsfaser.
- `qa33_polish`: lagringsdialog/atomisk backup og gjenbrukbar bekreftelse.
- Orkestrator: integrasjon, bok/hjelp, start/HUD, innholdskart, sammenhengende spillerreise, dokumentasjon og draft PR.

## Bakoverkompatibilitet og innholdsgrenser

Tilleggene er valgfrie: `ReportLine.experience?`, `RegionState.experiences?` (maksimalt åtte publiserte førstegangsminner), samt `DiscoveryEntry.storyId?`, `illustration?` og et eventuelt allerede kjent oppfølgingssted. `region-2` og lagringskonvolutten beholdes. Nye flagg bruker et eget `experience:`-navnerom. Førstegangsfunn i eldre kampanjer merkes som første *registrerte* opplevelse, og pågående gamle Tor-/skapløp leses uendret.

De seks lokale tekstfunnene gir ingen nye ressurser eller statsendringer. De tre nye personløpene gir valg gjennom eksisterende `DISCOVERY_WORK`-maler (arbeid, materialkostnad, endelig last eller håp/tillit), ikke nye beløp eller en endret lootkurve. Nye valg kan selvsagt gi andre kampanjeforløp; «uendret tallbalanse» betyr ikke at nye spillervalg skal være uten konsekvenser. Det er ikke lagt inn RNG-trekk for fortellertekst eller skrudd på hendelsesfrekvensen.

## Verifisering og faktisk spillerreise

Implementering og integrasjon pågår. Sluttstatus skal registrere hvilke opplevelser som faktisk ble møtt fra dag 1, hva som bare er scenariotestet, PC/mobil, save/reload og hva som fortsatt mangler. Botresultater alene er ikke bevis på spillglede. Ingen merge eller deploy uten Mikkis godkjenning.
