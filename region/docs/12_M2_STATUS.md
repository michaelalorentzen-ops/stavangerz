# M2 – headless døgnmotor

31.10.2026. M1 godkjent, enkelt ryddet; M2 ferdig som headless leveranse.

- Fungerer: ren deterministisk `resolveDay`, seedet naboflyt, støy, varslet barrierepress/brudd, endelige eksterne reservoarer, ressursreservasjon, daglig regnskap/rapport og replay.
- Geografi: 05 innlemmet i 03; krysset beholdt som strategisk POI på forbindelsen til 06. 07 er gjennomfart; vestlige kaier er 14. 03 og Rosenberg beholdes. Ingen flere geografiske undersøkelser.
- Avkobling: motoren bruker bare ID-er og eksplisitte forbindelser. En tynn CLI-adapter leser arbeidskartets graf uten å sende polygoner inn i motoren.
- Demonstrasjon: `pnpm demo:simulation` kjører 40 dager med samme seed i stille og støyende scenario. Rapportene lagres i `docs/evidence/m2-headless-demo.json`. Befolkning, lagre og kapasiteter er H-verdier for demonstrasjon, ikke kalibrert spillbalanse.
- Verifikasjon: `pnpm check:simulation`, `pnpm validate:world`, `pnpm typecheck`, produksjonsbygg. Smale kontroller av determinisme, bevaring, endelige lagre, dobbeltbruk og varsling før brudd; ingen ny testinfrastruktur.
- Bevisst utelatt: kamp, crew, faktisk økonomi/produksjon, brukergrensesnitt for turer, database, serverlås og multiplayer.
- Største risiko: matematiske invarianter viser konsistens, ikke at valgene er morsomme eller balansen god. Det må prøves i M3.
- Neste konkrete leveranse: fire overlevende på dag 0 med scout/clear/claim/secure og End Day, på vei mot HQ. Autoritativ lagring/lås og faktisk manuell gjennomspilling kommer med den spillbare flyten.
