# M3 – spillbar solo-prototype

31.10.2026. Første leveranse for eierens 10–15 dager med spilling.

- **Fungerer:** Fire forskjellige personer/utstyr; synlig risiko, rute og kostnad; speid → rydd → overta → sikre; forsyninger, hvile, behandling, perimeter og en liten base. Kamp bruker erfaring, helse, utmattelse, våpen, ammo og faktisk populasjon. End Day samler konsekvenser og forklaringer.
- **Lagring:** Automatisk lokalt, inkludert uavsluttede ordre og verdensøyeblikksbilde. Eksport/import og forrige lagringskopi. Uleselig lagring overskrives ikke automatisk. HTML-pakken krever ingen ekstern kart- eller spilltjeneste.
- **Manuelt spilt:** Nettleser, dag 0–5: speidet 02 med Ingrid, sikret startleiren med Tor, sanket med Leila, ryddet 02 med Ingrid/Marius, overtok og sikret området, valgte å dele forsyninger og etablerte et lite anneks. Kamp fjernet syv zombier; ammunisjon og dagsforbruk ble rapportert. Alle fire overlevde denne ruten. Rapporten bekreftet base og lot spillet fortsette.
- **Manuelt gjenopptatt:** Lukket og åpnet spillfanen på dag 3; riktig dag, personer, forsyninger og sonekontroll kom tilbake. Ny innlasting på dag 4 bevarte også en uavsluttet baseordre. Den selvstendige filen ble testet via en lokal statisk HTTP-server; direkte `file:`-åpning kunne ikke prøves av nettleserverktøyet.
- **Manuell eksport/import:** Lastet ned faktisk JSON-fil på dag 5 og lastet den inn igjen via spillets innlimingsfelt. Basen, fire personer, dag 5 og lageret (32 mat / 28 vann / 6 medisin / 6 materialer / 43 ammo) ble gjenopprettet. Verktøyets nedlastingsventer hang, men filen var korrekt lagret og kunne brukes.
- **Smale kontroller:** Determinisme/uendret inngangstilstand, regnskap for zombier/ressurser, dobbel personbruk/utdatert dag, skjult intel, baseflyt og konkret kampkonsekvens. Lagringsadapter kontrollert for rundtur, revisjonskonflikt, sikkerhetskopi og skadet input.
- **Bevisst utelatt:** Co-op/serverautoritet, utstyrsbytte/crafting, flerdagersoppdrag, makroordre, produksjonsøkonomi, research og overtakelse av Rosenberg. Ingen geografisk låsing.
- **Største risiko:** Balanse og interesse etter første base er ikke bevist. Scout-intel blir gammel, våpen bruker ammo og lageret tømmes; eierens spillevalg må avgjøre om dette gir gode beslutninger eller bare rutine.
- **Neste leveranse:** Juster forståelighet, risiko og dagsrytme etter eierens faktiske gjennomspilling, før M4.

Skjermbilder fra faktisk spill ligger i `docs/evidence/m3-base-established.png` og `m3-playable.png`. Bygg den delbare filen med `pnpm build:portable`.

## UI-oppdatering 01.11.2026

Eierens referanse er fulgt opp med ny kommandosenter-layout, genererte person-/stedbilder, eksisterende OSM-bygningsomriss, ikonmarkører og fremdriftslinje. Skjermbilde: `evidence/m3-ui-v2-desktop.png`. Kontrollert i nettleser på desktop og smal mobil uten horisontal overflyt: eksisterende dag 7, person-/sonevalg, oppdragsforhåndsvisning og dagsrapport. Den eksisterende gjennomspillingen ble ikke fremskrevet eller overskrevet. Bilder inngår også i den selvstendige HTML-filen. Publisering avventer fortsatt avklaring.
# POI og sonetypeikoner 01.11.2026

Kartet skiller nå soner (runde typeikoner) fra oppdagede forsyningssteder (firkantede, klikkbare POI-markører). Navn finnes i feltmappe og verktøytips. Manuelt kontrollert på eksisterende dag 7: kartklikk valgte riktig POI, kjente ressurser og et gyldig forsyningsoppdrag; tilbakeknappen gjenåpnet sonehandlingene; uspreidet transformatorstasjon fikk ingen POI-markør. Ingen ordre ble lagt til eller dager løst. Skjermbilde: `evidence/m3-poi-markers.png`.

# Før publisering – lesbarhet og forståelighet, 01.11.2026

- Økte spilltekster og kontrast, større ressurs-/kartikoner og bredere sidepaneler. Begge paneler har synlige rullefelt og rullepåminnelse. Kontrollert i 1366 × 768 og 1440 × 900; Tor og oppdragsknappen kan nås ved å rulle hvert panel.
- POI-tall er eksplisitt merket «Beholdning igjen på stedet». Valgt lag får et eget anslag for hjemtransport og bæreevne. Anslaget og faktisk uttak bruker samme rene beregning; eksisterende ressursprioritering og mengder er uendret. Tre smale kontroller sammenligner anslaget med faktisk debitering av POI-et; ukjente lagre gir ikke anslag.
- Kontroll vises uavhengig av siste observasjonsdag, observerte zombier og informasjonsalder. En sikret sone lover ikke at den fortsatt er tom.
- Første gjennomførte dag uten ordre krever en forklarende bekreftelse. Avbryt løser ingen dag. Forklaringen huskes som lokal UI-preferanse etter vellykket lagring, uten endring av lagringsformatet.
- Manuelt prøvd i separat testlagring: avbryt beholdt dag 0, bekreftelse løste dag 1 med fire mat/fire vann og faktisk zombiebevegelse; påfølgende hviledag og hviledag etter gjenåpning gikk direkte til rapport. Eierens eksisterende dag 7 ble bevart.
- Bevis: `evidence/m3-readability-1366.png`, `m3-readability-1440.png`, `m3-rest-confirmation.png`. Ingen publisering utført.

# Publisert 02.11.2026

Eieren godkjente Vercel-publisering som et nytt prosjekt. M3 er nå tilgjengelig på https://stavangerz2.vercel.app/ under Lorentzen Smart Labs, production / READY. Offentlig tilgang, identisk spillfil, oppstart, oppdragsvisning og gjenopptak er kontrollert. Se `14_VERCEL_DEPLOYMENT.md`. Neste leveranse er fortsatt justering etter eierens gjennomspilling; M4 er ikke startet.

