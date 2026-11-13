# Technical Architecture – browser-first, spillmotor først

## 1. Anbefalt utgangspunkt

**Arbeidshypotese – ikke tvunget lås:** Next.js + React for grensesnitt, MapLibre GL JS eller Mapbox GL JS for kart, en ren TypeScript-simuleringsmodul, PostgreSQL/PostGIS (for eksempel Supabase), og en autoritativ backend som løser turene.

Ikke bruk Godot/Unity i MVP. Turn-based kartstrategi, paneler, dialoger og 2D-kart har ikke krav som legitimerer ekstra motor- og kartintegrasjonskostnad. Ny vurdering bare hvis designet endres vesentlig mot realtid, 3D eller fysikk.

## 2. Fire logiske moduler

1. **world-data:** import/kuratering av kartdata, L1/L2/L3-polygoner, POI-er, transportgraf og sonepotensial; versjonert.
2. **simulation-core:** ren, seedet funksjon for én dag, med regler og balanse-konfig. Ingen database, UI eller nettverkskall.
3. **game-server:** autentiserer, validerer og lagrer ordre; håndterer Ready/Lock/Resolve; løser én dag atomisk; gir filtrerte rapporter/intel.
4. **game-client:** map rendering, ordrebygging, crew-/HQ-paneler, end-day og resultater.

En enkelt monorepo er tilstrekkelig i starten. Ikke mikrotjenester. Skill logiske pakker slik at motoren kan kjøres headless.

## 3. Begrepsmodell (ikke ferdig SQL-schema)

**Statisk:**
- WorldVersion, RegionL1, DistrictL2, CellL3
- PoiDefinition, PoiType, TransportEdge, TerrainBarrier
- ZonePotential, StartingProfile, MutationDefinition, EquipmentDefinition

**Per spilløkt/run:**
- GameSession (world_version, day, seed, mode, state)
- GamePlayer, Faction, Relationship, Policy/DecisionHistory
- ZoneState, PoiState, TransportEdgeState, BorderDefense
- Leader, Crew, PopulationPool, Inventory, Vehicle, Facility, ResearchProgress
- ZombieCohort (location/aggregate, variant, count), ExternalPopulationReservoir
- TurnOrder, PlayerReady, TurnResult, EventInstance

Forenkle feltene i den første migreringen; ikke opprett alle tabeller før funksjonen finnes. Men unngå å putte hele universet i én ustrukturert JSON-kolonne uten stabile ID-er og versjon.

## 4. Autoritet og transaksjon

Klienten sender bare ønsker. Serveren verifiserer spillers fraksjon, tilgjengelige crew, ressurser og ordrevilkår.

**Én kilde til sannhet:** Én lagret authoritative state per turn. Beskytt med unik `(session_id, day)`-lås/resultat og/eller transaksjonell statusovergang. Parallelle Ready-kall skal ikke kunne skape to dager.

Oppdatering av state + turn log + day må være atomisk, eller ha en tydelig gjenopprettingsstrategi. Send resultat til klienter først etter commit.

Ikke bruk Supabase Realtime til å kringkaste hver zombie-celleendring individuelt. Del turresultat/delta eller en «new turn available»-hendelse og hent state. Supabase Broadcast er egnet for direkte sesjonshendelser.

## 5. Determinisme og lagringsstrategi

- Alle seedede trekk genereres av en kontrollert PRNG på serveren; ingen tilfeldig `Math.random()` i regler.
- Et turn-resultat kan reproduseres fra state, låste ordre, seed og versjonert simuleringskode/balansekonfig.
- Lagre jevnlige snapshots og kort event-/turn-logg. Full event sourcing er ikke nødvendig i MVP.
- GameState må ha versjon for senere datamigrering. Ikke endre spillregler midt i en pågående run uten plan.
- Bruk ID-er for sone/POI/edge i regler; ikke koble logikk til visningsnavn eller map-label.

## 6. Skala

Kostdriveren blir antall soner og oppdateringer per dag, ikke bare antall spillere.

- Start med kuratert Buøy/Hundvåg-verden. Ikke generer 100×100m for hele Rogaland dag 1.
- Hold L3-detalj i aktive områder. Kjør L2/L1-aggregater for fjerne, mindre relevante områder.
- Raffinering/aggregering må bevare zombieantall og state-invarianter.
- Bruk en eksplisitt forbindelsesgraf for ruter, vann, bruer og tunneler.
- Klienten skal bare hente/render geometri og dynamikk innen aktuelle zoom-/view-/intel-grenser.
- Vurder vector tiles når antall polygoner vokser. Ikke optimaliser prematurt med egen kartserver.
- Test motoren headless på syntetiske verdener før full GIS-integrasjon.

## 7. Kartdata og lisens

- Kartmotor er ikke kartleverandør. Avklar både renderer, kartfliser og geodata.
- OpenStreetMap-data er ODbL. Krediter OSM og vurder betingelser for avledede databaser.
- Ikke anta at offentlige OSM-flisservere kan brukes ubegrenset i et produksjonsspill.
- Geografiske data om bygninger, veier og POI-er kan være mangelfulle eller feil. Spillsoner må kurateres.
- Kilder: https://maplibre.org/maplibre-gl-js/docs/ , https://supabase.com/docs/guides/database/extensions/postgis , https://www.openstreetmap.org/copyright , https://operations.osmfoundation.org/policies/tiles/

## 8. Sikkerhet og multiplayer

- Begge klienter kan se kart, men ikke skjulte ordre, nøyaktige fiendetall eller andres uoppdagede intel.
- Serveren filtrerer data etter spillerens kunnskap og eierskap; skjulte data må ikke ligge i payload og bare være gjemt med CSS.
- Støtt reconnect til Planning/Resolved; avklart locked state må fortsatt være låst.
- RLS, tilgangskontroll og sesjonsspesifikke kanaler må inngå før co-op eksponeres.
- Skillet solo/co-op skal primært ligge i GameSession og turlås, ikke i to forskjellige motorer.

## 9. Minimal verifikasjon

Enhetlige kjerneinvarianter, én liten session-protokoll-test og én faktisk spilltest gjennom dag 0 → HQ. Ingen omfattende testfarm, 20 browsersnapshots eller performance-lab før det finnes spill.

Etter hver større regelsendring: kjør headless sim med fast seed og rapporter uventede endringer i død, ressursforbruk, zombieantall og gjennomspillingstid.
