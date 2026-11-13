# v0.4 – funksjonell avslutning etter QA32

Utgangspunkt: main `dbd00a8`, QA32 testet `e98036c`. Kilde: [Stavanger Z QA på PR32](https://github.com/michaelalorentzen-ops/stavangerz/pull/32#issuecomment-6862284223). QA rapporterte UX 4,91 og ingen nye middels/høye feil. Dette dokumentet tildeler ingen ny poengsum. Eier ba om å fullføre QA-arbeidet før tallbalansering.

## Leveranse

- S2: synlig, kompakt hurtigtasthint på døgnknappen også ved 390 px. Hintet følger valgt tast.
- S3: lokale Kenney CC0-samples og forhåndsbygde lydarrangementer for handlinger, resultat og miljø. Lisens og kildehash følger filene. Vind/vann-kompositter er beskrevet som genererte lyder, ikke feltopptak. Mute, volum og faneskjul gjelder alle lydlag.
- S4/S5: fase- og seiersoversikt bruker motorens faktiske krav; avslutningen kan vise oppnådde milepæler og kapitler. Ingen oppdiktede premier, XP eller endrede terskler.
- S6: tre navngitte lagringsplasser, lagre/laste/slette/eksportere og eksplisitte bekreftelser. Aktivt kontrollpunkt og bibliotek skrives atomisk i eksisterende nøkkel. Gamle råsaves og gamle konvolutter leses. Fulle plasser og skrivefeil beholder data. Hardcore beholder siste kontrollpunkt, også etter sletting av en plass. Eksport er sikkerhetskopi; vilkårlig import tilbys ikke.
- S7: spillerutløst 12-sekunders kartmåling med faktisk MapLibre-render, RAF-bildetid, renderer, viewport og JSON. Skjult fane, endret skjerm, konteksttap eller avbrudd avslutter målingen. Målingen endrer ikke spill, kamera eller lagring.
- S8: egne hurtigtaster, konfliktkontroll, tilbakestilling og separate innstillingsfaner. Skjemaer og dialoger beholder vanlig tastaturbetjening; å holde døgnknappen inne skal aldri avslutte dagen.
- S9: alle 32 ressurs-/utstyrskategorier har lokal, malt kategoriillustrasjon. Antall, reservasjoner og effekter kommer fortsatt fra motoren.

## Faste grenser

D25–D28, verden og spillregler beholdes. Ingen tallbalansering er gjort. Seier har fortsatt fase-5-port: vaksineprosjekt, samlet region eller 30 sammenhengende stabile døgn. Grensetester beviser at kanoniske predikater virker. En separat naturlig gjennomspilling har i tillegg vunnet på dag 194: Fåhagen på Finnøy (`z3-0274`), seed 303, standard Survival, uendret motor og kanonisk botpolicy, via 30 stabile døgn. Den offisielle 75-løpsmålingen har fortsatt 0 seire ved 150 døgn; den kortere grensen og botens faseprogresjon er relevante for kommende balanse- og policyarbeid. Daglige premier og tempo vurderes i den runden, uten nye belønningstall i UI-koden.

Skyens Chromium rapporterer SwiftShader. Det er programvarerendering og kan ikke lukke kravet om fysisk GPU. Den nye måleren gjør en faktisk måling på spillerens maskin mulig under Innstillinger → Ytelse; nettleserrapportert GPU-navn alene er heller ikke fysisk maskinvarebevis.

## Verifikasjon

Produksjonsbygg og TypeScript består. Alle 19 etablerte funksjonelle motor-/regresjonskontroller består; motor og verdensdata er uendret. Savebibliotek- og fremgangsprøvene er også lagt i den samme porten (21 kontroller totalt). Lydproveniensprøven består separat.

Alle seks etablerte nettleserreiser består: naturlig HUD-spill (8 døgn PC + 6 mobil), kontekst/HQ/fysisk forsyning, ekte felt-/nattkontrollpunkter, WebGL/modeller/konteksttap/fallback, spillerklarhet/hurtigtaster og start. Start er kontrollert ved 1280×800, 1920×1080 og 390×844; de nye dialogene også ved 1280×800 og 390×844. Nytt: navngitt snapshot → nytt døgn → eksakt tilbakeføring, standard/egne taster med hold/repeat/fokusvern, alle sider i epilog/forskning/krønike, tastaturfokus i native/nestet lagringsdialog, utvidede fase-5-ruter og kartmåling med uendret spill og byte-identisk localStorage. Ingen PC-scroll i de kontrollerte dialogene.

Naturlig seier er reprodusert både som 150-døgns løp + fortsettelse og som uavbrutt 194-døgns løp, med eksakt identisk full sluttilstand. [Kjørbart bevis](../scripts/prove-campaign-victory.ts) og [resultat](../scripts/evidence/qa32-victory-proof.json) følger repoet. Faktisk sluttsave er åpnet i nettleser på PC og mobil. Kur og allianse har predikat-/grensetester, ikke hver sin naturlige seiersgjennomspilling.

[Evidensmappen](evidence/qa32/) inneholder resultat-JSON fra de etablerte reisene, kartmålingen og utvalgte skjermbilder. Lydens 14 originale CC0-filer og 13 lokale arrangementer har verifiserte hashes, nivåer og dekning; faktisk Chromium-hook er prøvd med alle lyder, trusted input, mute, skjult fane og opprydding.

Kartmålingens skyverdier gjelder SwiftShader; de er ingen FPS-garanti. En avsluttende isolert måling uten andre testnettlesere ga 2,55 kartbilder/s ved 1280 px og 4,84 ved 390 px under tvungen kontinuerlig kartrendering. Dette er målte programvarerenderingsverdier, ikke fysisk GPU eller normal idle-RAF. Både første måling og isolert måling er bevart i evidensmappen. Kravet om fysisk GPU står åpent. Tallbalanse, stille døgn, belønningsrytme og policykvalitet er eksplisitt neste arbeid. Ingen regel- eller belønningsverdier er endret for å få grønn test.
