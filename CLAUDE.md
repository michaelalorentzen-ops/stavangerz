# Stavanger Z – retningslinjer

Turbasert zombie-overlevelse på et stilisert, ekte kart over Stavanger. Spillteksten er på norsk (bokmål) med tørr, lokal humor.

**Spillreglene står i [docs/spilldesign.md](docs/spilldesign.md).** Den er sannheten. Når koden og dokumentet er uenige, er det enten en feil i koden eller en endring som skal inn i dokumentet.

## Arkitektur

- **Motoren er ren og deterministisk.** All spillogikk ligger i `src/engine/` og bruker aldri DOM. All tilfeldighet går gjennom `rand(s)` med seed i `state.rng`, aldri `Math.random()`. Samme tilstand og samme ordre skal alltid gi samme resultat. Dette er grunnlaget for asynkron multiplayer, der en server kjører `resolveDay()`.
- **Alt som er spesielt for byen, ligger i regionpakken `src/regions/stavanger/`** (se [docs/region.md](docs/region.md)). Stedsnavn finnes bare i `places.ts`. Alle andre filer slår opp navnet via id (`SECTORS.obs.at`, `GATES.ros.name`, `AREA.name`, `LANDMARKS.bybrua`), og `tests/region.test.ts` passer på det. Nye stedsnavn følger [docs/stedsnavn.md](docs/stedsnavn.md): funksjon i navnet, det ekte stedet i beskrivelsen. Motoren kjenner bare id-er, aldri bestemte steder, med unntak av sektoren `hjem`.
- **Innhold ligger i `src/regions/stavanger/content/`.** Utstyrskort, encounters, hendelser, tokt, quests og mutasjoner er data der. Reglene som bruker dem ligger i motormodulene (`cards.ts`, `encounters.ts`, `tokt.ts`, `phases.ts`). Nytt innhold skal ikke kreve nye regler.
- **Valg om dagen lagres som ventende.** Encounters, tokt-beslutninger og valg av ny leder løses aldri inne i `resolveDay()`. Dagen legger dem i `state.pending`, `state.tokts` (med `awaiting`) eller `state.needLeader`, og spilleren velger før neste dag (`canEndDay`). `resolveDay()` er ett steg med ordre inn og resultat ut.
- **UI-koden endrer ikke spillregler.** `src/ui/` leser tilstanden og setter ordre (`crew.task`). Selve regnestykket skjer i motoren.
- **Kartet bygges på forhånd.** OpenStreetMap-data hentes med `tools/fetch_osm.sh` og bygges til `src/data/map.json` med `tools/build_map.py`. Alt regionspesifikt kommer fra regionens `map.config.json`. Nettleseren skal aldri spørre Overpass direkte: alle spillere må få samme kart, og tjenesten tåler ikke trafikken.
- **Ingen sanntid.** Zombier er tall per sektor, ikke figurer som beveger seg. Ikke innfør Phaser, game loops eller object pooling.
- **Ingen GPS eller posisjonsdata.** Byen er fast.
- `dist/` og `src/data/map.json` er generert. `dist/` sjekkes ikke inn.
- Før commit: `npm test` og `npm run typecheck` skal være grønne.

## Faser

Alle nye mekanikker skal vurderes mot alle fem fasene, også de som ikke er bygd ennå.

1. **Utbruddet:** klarer hjemsonen, let, bygg perimeter. Bygging er tillatt.
2. **Hovedkvarter:** transport, ta et HQ med skjulte verdier, roller i crewet.
3. **Ekspansjon:** naboområder, crew-ledere, rekruttering ved porten.
4. **Bydel:** bonuser for hele bydeler, risiko ved å vokse for fort.
5. **Fraksjoner:** andre overlevende, handel eller krig. Zombietrusselen avtar.

Vanskelighetsgrad og zombieevner hentes fra fasetabellen i `src/engine/phases.ts` via `mods(s)`, aldri fra tall spredt i koden. Nye vanskelighetsknotter legges inn der, for alle fem faser.

## Designprinsipper

- **Stats skal gi konsekvenser, ikke bare prosenter.** Dårlig Snoking betyr at zombier blir liggende igjen i kjellere og bryter ut senere.
- **HQ-verdier er skjulte.** Spilleren får bare rykter og speiderrapporter.
- **Humoren er lokal:** ekte steder, Stavanger-regn, måker og rivalisering med Sandnes. Hold den tørr, ikke slapstick.
- Kartdata krever at OpenStreetMap krediteres synlig i spillet.

## Balanse

Etter regelendringer: kjør `npm run sim -- 300` og `npm run sim -- 300 --combos` (boten i `tools/bot.ts` mot motoren, med standardcrewet og fire andre nabokombinasjoner). `tests/balance.test.ts` feiler hvis balansen glipper. Målene for fase 1 (kapittel 11 i spilldesignet): boten vinner 85–97 % med hver kombinasjon (siktet mot 88–96 %), median 20–40 dager til seier (siktet mot 28–36, så en god spiller bruker 20–30), crewet mister i snitt minst 0,2 personer per runde (siktet mot 0,3), median sultedager per runde 2 eller mindre, og under halvparten av de tapte rundene har langvarig sult. Juster tall i regionens `places.ts`, `phases.ts` og regelkonstantene øverst i motormodulene før du endrer regler.
