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

D25–D28, verden og spillregler beholdes. Ingen tallbalansering er gjort. Seier har fortsatt fase-5-port: vaksineprosjekt, samlet region eller 30 sammenhengende stabile døgn. Grensetester beviser at kanoniske predikater virker; de beviser ikke en naturlig seier. Botens 0 seire på 150 døgn er fortsatt relevant for kommende balanse- og policyarbeid. Daglige premier og tempo vurderes i den runden, uten nye belønningstall i UI-koden.

Skyens Chromium rapporterer SwiftShader. Det er programvarerendering og kan ikke lukke kravet om fysisk GPU. Den nye måleren gjør en faktisk måling på spillerens maskin mulig under Innstillinger → Ytelse; nettleserrapportert GPU-navn alene er heller ikke fysisk maskinvarebevis.

## Verifikasjon

Pågår under integrering; endelig evidens og publisert commit registreres før levering.
