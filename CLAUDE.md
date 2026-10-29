# Stavanger Z – retningslinjer

Turbasert zombie-overlevelse på et stilisert, ekte kart over Stavanger. Spillteksten er på norsk (bokmål) med tørr, lokal humor.

## Arkitektur

- **Motoren er ren og deterministisk.** All spillogikk ligger i `src/engine.js` og `src/events.js`. All tilfeldighet går gjennom `rand(s)` med seed i `state.rng`, aldri `Math.random()`. Samme tilstand og samme ordre skal alltid gi samme resultat. Dette er grunnlaget for asynkron multiplayer, der en server kjører `resolveDay()`.
- **UI-koden endrer ikke spillregler.** `src/ui.js` leser tilstanden og setter ordre (`crew.task`). Selve regnestykket skjer i motoren.
- **Kartet bygges på forhånd.** OpenStreetMap-data hentes med `tools/fetch_osm.sh` og bygges til `src/map.json` med `tools/build_map.py`. Nettleseren skal aldri spørre Overpass direkte: alle spillere må få samme kart, og tjenesten tåler ikke trafikken.
- **Ingen sanntid.** Zombier er tall per sektor, ikke figurer som beveger seg. Ikke innfør Phaser, game loops eller object pooling.
- **Ingen GPS eller posisjonsdata.** Byen er fast.
- `dist/` og `src/map.json` er generert. Kjør `python3 tools/build.py` etter endringer i `src/`.

## Faser

Alle nye mekanikker skal vurderes mot alle fem fasene, også de som ikke er bygd ennå.

1. **Utbruddet:** klarer hjemsonen, let, bygg perimeter. Bygging er tillatt.
2. **Hovedkvarter:** transport, ta et HQ med skjulte verdier, roller i crewet.
3. **Ekspansjon:** naboområder, crew-ledere, rekruttering ved porten.
4. **Bydel:** bonuser for hele bydeler, risiko ved å vokse for fort.
5. **Fraksjoner:** andre overlevende, handel eller krig. Zombietrusselen avtar.

Vanskelighetsgrad og zombieevner skal hentes fra én tabell per fase, ikke fra tall spredt i koden.

## Designprinsipper

- **Stats skal gi konsekvenser, ikke bare prosenter.** Dårlig Snoking betyr at zombier blir liggende igjen i kjellere og bryter ut senere.
- **HQ-verdier er skjulte.** Spilleren får bare rykter og speiderrapporter.
- **Humoren er lokal:** ekte steder, Stavanger-regn, måker og rivalisering med Sandnes. Hold den tørr, ikke slapstick.
- Kartdata krever at OpenStreetMap krediteres synlig i spillet.

## Balanse

Etter regelendringer: kjør `node tools/sim.js 300` (en enkel bot mot motoren). Mål for fase 1 er at nesten alle runder kan vinnes, på rundt 20–30 dager for en god spiller.
