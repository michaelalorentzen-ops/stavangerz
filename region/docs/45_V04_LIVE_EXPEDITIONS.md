# Fra rapportkort til levende ekspedisjoner

## Baseline og avgrensning

Arbeidet fortsetter på `feat/v04-living-expeditions`, draft PR #34, fra `42f30ac`. Arbeidstreet var rent. `main` var `5a2bebe`; eksisterende arbeid og dokumentene 27–29 og 42–44 ble beholdt. [QA34 runde 3](https://github.com/michaelalorentzen-ops/stavangerz/pull/34#issuecomment-6904278053) tester samme head. Rapportens forslag om seierstempo er ikke godkjent; D32 utsetter tallbalansering. Ingen merge eller deploy inngår.

Kodegjennomgangen fant at gammel avspilling var omtrent 2,75 sekunder med en simulert minuttklokke. Etter felt-/nattcheckpoint ble hele avspillingen hoppet over. Førsteganger var primært rapport-/bokinnhold. Ordreplanen krevde separate personvalg og skjulte reise/arbeid bak detaljer.

## Implementasjon

- **Nådde, offentlige faser:** en ren UI-projeksjon bruker bare den allerede nådde `RegionReplayStage`, rapporterte førstegangsminner og offentlig geografi. Ingen tilgang til sluttlagret verden, skjulte POI-er, private oppdragslinjer eller senere replayfaser.
- **Korte scener:** faktisk sted, illustrasjon, deltakere, første fortellerlinje, personens lagrede replikk og autoritativt resultat vises under avspillingen. Kartet ligger bak. Første kamp og skader prioriteres. Vanlige søk/kamper er kompakte; rapport/journal beholder detaljene.
- **Liten oppmerksomhetsramme:** inntil tre fremhevede scener per fase og fire per døgn inklusive eventuell ruteintroduksjon. Disse er tekniske presentasjonshypoteser, ikke låste produktregler. Ingen hus-/gjenstandsklikk. Pause og Skip styrer fremvisningen; ingen oppdiktet minuttklokke. Før avreise er eksplisitt en ordreintensjon, aldri en påstand om at oppdraget lyktes.
- **Checkpoint:** et påkrevd valg forblir lagret og uomgjengelig. Etter valget starter visningen ved rapporterte operasjonsresultater, ikke ved en oppdiktet tidligere daggrysituasjon. Ingen ny persistert startkopi eller savekonvolutt.
- **Samstemt kart:** gamle sonepaneler lukkes og planleggings-HUD med før-døgnet-tall skjules under avspillingen. Rapporterte kartstadier og forsyningstall kommer fra eksisterende replaykontrakt.
- **Mindre repetisjon:** «Velg ledige her» samler faktisk tilgjengelige personer fra samme avreisested etter et eksplisitt klikk, også ved hvile. Spiller kan justere utvalget. Reservert/fraværende mannskap overtas ikke. Dagsplan viser reise/arbeid og kjent risiko uten å åpne detaljer.
- **Videre innhold:** åtte endelige kontekstobservasjoner fordelt på seks miljøfamilier bruker tidligere rapporter, faktiske vitner, skade, lagerforhold, kontroll, forsvar og HQ. To direkte materialvalg og én valgfri HQ-gjennomgang bruker eksisterende konsekvens-/arbeids-/lastsystem. Gamle personhistorier beholdes. Ingen nye RNG-trekk, savefelt eller endringer av balansemaler.
- **QA-etterspill:** protestvalget viser motorens nyregistrerte konsekvens umiddelbart som melding. Første opptjente HQ-forsvar har eget faktisk generert, integrert motiv; vanlig perimeter bruker fortsatt sitt eget bilde.

## Arbeidsdeling

Orkestrator eier `region-game.tsx`, avspillingstiming, integrasjon, gjennomspilling og dokumentasjon. Egne arbeidstrær har disjunkte kildeområder: replay-projeksjon/kort; ordrekomponist/dagsplan; reaktivt historieinnhold; ett HQ-forsvarsmotiv/manifest/resolver. Ingen ny motor eller geografi.

## Verifikasjon

Løpende resultater og kampanjefunn føres inn før leveransen markeres ferdig. Nettleseren i cloud bruker SwiftShader; fysisk GPU og faktisk spillglede er ikke dermed bevist.

## Faktisk sammenhengende spillerreise

Frø 101, Lundsneset, Ingrid som hovedperson. Alle ordre og valg ble gitt gjennom grensesnittet med normal avspilling; ingen bot-planlegger, endrede lagre eller redigert simuleringstilstand. Samme kampanje ble gjenopptatt fra identiske UI-eksporter på dag 2 og 13 etter integrering av rettelser. Første døgn er dessuten kontrollert separat mot endelig produksjonsbygg på PC/mobil. Tabellen bruker **rapportdøgn**; minner lagrer motorens underliggende oppdragsdag, som er ett lavere.

| Rapportdøgn | Faktisk opplevelse |
| --- | --- |
| 1 | Fire personer speidet Hundvåg 2. Et reelt feltvalg, første observasjon/POI og Marius sitt første spor. |
| 2 | Felles forsyningssøk i Lundsneset: kikkert, første kamp, skade på Tor og redning av Amina. Første søk-/utstyrs-/kampminne og Ingrids spor. |
| 3–5 | Bekjempelse, Leilas spor, første overtakelse og etablering av HQ ved registrert kystgård. Hvile ga faktisk restitusjon. Behandling over 80 helse ga ingen behandling, slik eksisterende forhåndsvisning opplyser; senere behandling av Amina under terskelen virket. Ingen terskel ble endret. |
| 6–8 | Første perimeter, lokal gårdsobservasjon, en stille kveld, Ingrids første undersøkelse, moralsk valg om Marius, ferdig vakttårn og første opptjente HQ-forsvarsminne. Kystobservasjon og et eksisterende forsyningsvalg. |
| 9–11 | Videre bekjempelse/søk i Hundvåg 2, faktiske skader, nye overlevende og utstyr. Skog- og boligobservasjoner. En planlagt overtakelse ble avvist før innsending med konkret restfare og manglende søk. |
| 12–13 | Ny, valgfri HQ-gjennomgang med Marius fullført i ett arbeidsoppdrag. Faktiske håp-/tillitsvirkninger, forsyningssituasjon og en senere refleksjon om å ha et hjem å vende tilbake til. Ingrid og Leila sine eldre spor ble avsluttet med deres eksisterende forsyningsvalg. |
| 14–16 | Gjentatt risikofylt feltarbeid, synlig hvile, navngitt refleksjon rundt Tors faktiske skade, oppfølging av den nye sjansen til Marius og en eksisterende radiohistorie. To personer var faktisk utilgjengelige i to døgn. Returen ga et videre valg om et rapportert spor i allerede kjent sone. Boligobservasjonen reagerte på kontroll over området. |
| 17–18 | Et rent bekjempelsesdøgn med 14 registrerte drepte; rapporten sa at sonen så tom ut. Neste overtakelse ble faktisk stanset av flere zombier enn anslaget antydet. En senere observasjon skiller mellom reelle sperringer og resten av territoriet. |
| 19–20 | Marius sitt eldre spor kunne undersøkes videre etter lang pause. Valg om videre oppfølging peker mot et kjent HQ-sted. Fire andre søkte hjemme og fant nytt utstyr. Den siste nye observasjonen handler om at gården nå er et sted å bli. |

[Uendret sluttsave](evidence/live-expeditions/actual-save20.json), [offentlig rapporthistorikk](evidence/live-expeditions/actual-20-day-public-history.json) og [faktiske UI-kommandoer](evidence/live-expeditions/ui-commands.jsonl) dokumenterer reisen. De daglige rapportene er hentet fra den faktiske sluttilstanden, også når en tidlig testdriver observerte en gammel checkpoint-ramme akkurat da avspillingen lukket. Ingen mellomtilstander er rekonstruert. Sluttreload var identisk. Alle fem navngitte personer overlevde; kampanjen står fortsatt i fase 1 med ett kontrollert område.

## Konkrete funn og rettelser

- **Utdaterte paneler bak scenen:** sonepanelet kunne vise 0 % mens den rapporterte scenen viste gjennomført søk. Panel, gammel statuslinje, søkefelt og kommandomeny skjules nå under fremvisningen.
- **To scener om samme skade:** førstegangskampen og en egen skadebeskjed kunne skyve søket ut. Eksakte offentlige skadelinjer fra samme oppdrag/mission samles i kampkortet, med navn og skadebeløp bevart. Død eller annen mission samles ikke.
- **Lang tekst om funn:** den komplette første funnlisten gjengis med eksisterende ressursbilder og eksakte antall når alle fakta kan verifiseres. Offentlig søkeprogresjon beholdes. Ufullstendige eller ukjente eldre formater beholder originaltekst. Rekruttering bruker eget uillustrert ankomstkort og får aldri et utstyrsbilde.
- **Avvist overtakelse manglet tydelig sted i øyeblikket:** faktisk dag-18-varsel hadde prioritet 75 og ble kompakt med en generisk tittel. Slike tilbakeslag får nå en scene med faktisk sonenavn og uendret motorforklaring. Det reproduseres fra [uredigert dag 17](evidence/live-expeditions/actual-save17.json).
- **Hvile uten oppsummering:** den eksisterende motorberegningen publiserer nå bare faktisk helse-/utmattelsesbedring, som lavmælt rapportmetadata. Ingen verdier, kostnader eller RNG-trekk er endret. Fjernhvile følger samme private rapporttransport og publiseres én gang ved faktisk retur. Rapportmetadata endrer naturlig rapportavhengig kampanjehash, ikke mekanisk resultat.
- **Søkeforhåndsvisning mot faktisk gjenstående arbeid:** sluttbildet viste 24 % planlagt søk selv om 91 % allerede var gjort. Forhåndsvisningen er nå avgrenset til det som faktisk gjenstår (9 % i dette tilfellet). Arbeid, kostnad, funn og simulert fremgang er uendret.
- **Fem personer i oppdragsvelgeren:** dag-20-testen fant 64 px intern PC-scroll som firepersonstesten ikke avdekket. Fempersonslister bruker nå to kolonner på bred PC; åpne manuelle gearvalg passer fortsatt, med 44 px knapper og samme tekststørrelser. Gruppeknappen gjelder også hvile. Mobil kamp har 23 px tekst-/listescroll med synlig topp og bekreftelse; ingen horisontal scrolling.
- **Fasegrense for kartbevegelser:** synlige nattbevegelser hentes nå bare fra den allerede nådde nattefasen, sammen med nattlyden. Operasjonsscenene viser ingen bevegelse fra neste fase.
- **Mobile lange historier:** pause/Skip ligger utenfor den eventuelt rullbare teksten. Første søk passer uten intern scrolling. PC-kortene og testede eksisterende dialoger passer i skjermen.
- **Kartchip under scenen:** popup-resultater utelates når det nye scenekortet opptar ankeret. En faktisk offentlig scene gir tilbakemeldingen i stedet. Kartkontrollen verifiserer denne lagdelingen og at arkivlesing ikke spiller kartresultatet på nytt.

## Verifisert på PC og mobil

- [Produksjonsbygg](evidence/live-expeditions/build.log), TypeScript, diffkontroll og [funksjonsportens 30 kontroller](evidence/live-expeditions/functional-gate.log): determinisme, private rapporter, gamle saves, kampanje/checkpoint, gear, fasegate, hendelseskatalogens validerte valg, nye konteksthistorier, finite konsekvenser og restitusjon.
- [Faktisk første ekspedisjon](evidence/live-expeditions/replay-results.json), 1280×800 og 390×844: automatisk flere scener, pause over seks sekunder, tastaturfokus, sperrede HUD-snarveier, dekodede bilder, ressursikoner og søk uten intern scrolling. [PC-søk](evidence/live-expeditions/search-pc.png), [mobilsøk](evidence/live-expeditions/search-mobile.png).
- [Kartlagdeling](evidence/live-expeditions/map-results.json): offentlig speiderscene, lesbare/kollisjonsfrie kartchips når det er plass, ingen arkivavspilling.
- [Felt-/nattcheckpoint](evidence/live-expeditions/checkpoint-results.json): Skip utilgjengelig, Escape omgår ikke valg, identisk reload før/etter og én enkelt avregning. [Umiddelbart protestutfall](evidence/live-expeditions/protest-results.json): reelt valg gir korrekt avgang 4→2 og synlig melding på PC/mobil.
- [Fase-2-scenario](evidence/live-expeditions/phase-two-results.json): utgangspunktet er [faktisk dag-6-save](evidence/live-expeditions/actual-save6.json) med alle åtte førstegangene brukt. Bare scenariooppsettet får tre tilknyttede kontrollerte soner, proviant og en eksisterende grensebarriere. Produksjonens regler og terskler endres ikke. Faktisk faseovergang vises med eget minne og identisk motorutfall. Dette er ikke bevis på naturlig progresjon til fase 2.
- [Fempersonskontroll](evidence/live-expeditions/crew-layout-results.json): hvile, søk og kamp på PC/mobil, eksplisitt fempersonvalg, manuelt avvalg, åpent/endret gearvalg på PC, 44 px gearknapper, synlig bekreftelse og identisk simuleringstilstand. Ingen PC-scroll i de tre testede PC-flytene, også med åpent gearvalg.
- [Faktisk tilbakeslag](evidence/live-expeditions/setback-results.json): samme plan fra uredigert dag 17 gir stanset overtakelse, sonenavn og årsak under fremvisningen; identisk motorutfall etter Skip.
- Eksisterende HUD-reise: åtte PC- og seks mobildøgn med begge innganger til ordre, redigering/avbryt, gear, forsvarsforhåndsvisning, HQ, bok, rapportarkiv og reload. [Logg](evidence/live-expeditions/hud-journey.log).
- [Inspeksjon av faktisk dag 20](evidence/live-expeditions/save20-results.json): alle åtte førsteganger, opptjent forsvarsminne, journal, HQ, gamle lagrede historier og eksakt reload. Førstegangene gjentas ikke ved lasting. Det nye forsvarsmotivet finnes som en reell fil i manifestet.

Testdriveren måler scenen **etter** at pauseknappen faktisk er aktivert; under cloud-belastning kan en eldre ramme allerede ha gått videre før klikket. Pausekontrollen holder deretter samme scene i minst seks sekunder. Ingen endret simuleringstid er brukt for å få kontrollen grønn.

## Reproduserbart

Fra `region/`, med lokal produksjonsserver:

```sh
node scripts/check-v04.mjs
node --import tsx scripts/check-expedition-replay-ui.ts
node scripts/check-expedition-cues-ui.mjs
node --import tsx scripts/check-hud-checkpoints.ts
node --import tsx scripts/check-public-protest-ui.ts
node --import tsx scripts/check-expedition-phase-two-ui.ts
node --import tsx scripts/check-expedition-setback-ui.ts
node scripts/check-rest-group-ui.mjs
REGION_PLAYTEST_RESUME=docs/evidence/live-expeditions/actual-save20.json node --import tsx scripts/inspect-living-save-ui.ts
```

## Gjenstående og vurdering

- **Tempo/balanse:** det tok flere bekjempelsesdøgn å klargjøre nabosonen, og et gyldig overtakelsesforsøk ble stanset av reell motstand som hadde endret seg. Mange like kritiske feltspørsmål avbrøt videre arbeid. Dette er dokumentert som testfunn; terskler, zombiebevegelse, reisetid, ressursmengder og fasekrav er urørt etter D32.
- **Visuell videreføring:** de fire opprinnelige personene har sine etablerte motiver. Rekrutterte personer som Amina bruker fortsatt initial når et portrett mangler.
- **Innholdsdekning:** den naturlige reisen møtte fire miljøobservasjoner, seks nye kontekstobservasjoner, HQ-gjennomgangen og eldre person-/radiohistorier. De to direkte industri-/medisinvalgene og de øvrige miljøkontekstene er dekket av motor-/scenariokontroller; de ble ikke naturlig møtt i denne ruten. Fase-2-inngangen er scenariotestet. Videre innhold i senere faser gjenstår.
- **Opplevelse:** spilleren kan nå følge rapporterte ekspedisjonsøyeblikk under døgnet og bruke rapport/journal til fordypning. Orkestratorstyrt UI-spilling og bot-/integrasjonstester beviser fortsatt ikke at tempo eller spillglede er ferdig.
- **Maskinvare:** cloud bruker SwiftShader. Fysisk GPU er fortsatt ikke verifisert. Ingen ny grafikkmotor eller taktisk kampsimulering er bygget.

Ingen nytt vesentlig produktvalg var nødvendig. Lagringskonvolutt og permanente datamodeller er uendret; nytt innhold bruker eksisterende oppdagelser/konsekvenser, og replaytypene er lokale presentasjonstyper. Ingen merge/deploy.
