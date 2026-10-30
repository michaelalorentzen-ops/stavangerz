# Atlaset

Strukturerte data for hele Stavanger, som fase 3–5 skal bygges på. Ett område per fil: `<id>.json`. Skjemaet står i `atlas.ts`, og `tests/atlas.test.ts` sjekker alle filene. Atlaset er **ikke** koblet inn i spillet ennå. Det er grunnlaget, ikke spilldata.

`vestoyene.json` er ferdig kurert og er mønsteret for resten.

## Filene

| Fil | Innhold |
|---|---|
| `atlas.ts` | Typene (`AtlasArea`, sektorer, porter, nøkkelsted, HQ-kandidat, POI-er) og gyldige verdier. |
| `atlas.config.json` | Atlasets bbox, hvor dumpen lagres, og alle områdene med ring, fase og avgrensning (`polys`, `bbox`, `admin`, `minus`). Bare Vestøyene har nøyaktig avgrensning; de andre er grove. |
| `<id>.json` | Ett kurert område. |

## Slik kurerer du et område

1. **Hent dumpen én gang** (hopp over hvis `data/osm-atlas.json` finnes):
   `tools/fetch_atlas.sh`
   Én Overpass-spørring for hele byen, ca. 2,5 MB. Ikke kjør den igjen for hvert område.
2. **Stram inn avgrensningen** i `atlas.config.json` hvis den er grov. For øyer og bydeler bak en elv: tegn `polys` (ringer av `[bredde, lengde]`). For bydeler: `admin` med bydelsnavnet (Madla, Hillevåg, Storhaug, Hinna, Tasta, Hundvåg, «Eiganes og Våland»), eventuelt snittet med en `bbox` og med `minus` for naboområder.
3. **Trekk ut kandidater:**
   `python tools/build_atlas.py <id>` (eller `--all`, `--list`)
   Bruk Python med shapely (`tools/requirements.txt`). Resultatet havner i `data/atlas-candidates/<id>.json`, sortert etter regelheftets typer: matbutikk, byggvarehus, jernvarehandel, dyrebutikk, interiørbutikk, klesbutikk, sportsbutikk, våpen/jakt, bensinstasjon, bilforhandler, apotek, elektronikk, kjøpesenter, skole, offentlig, helse, hq_kandidat, kai, industri, jorder, skog, bru, tunnel, hovedvei, stedsnavn og mer.
4. **Se etter det dumpen ikke har.** Den har ingen bygninger. Til boligtyper (blokker, rekkehus, eneboliger, naust) i byøyene kan du bruke `data/osm.json` fra `tools/fetch_osm.sh`. Utenfor den bboxen: skriv det du vet, og merk det `[Sjekk]` i `notes`.
5. **Skriv `<id>.json`** for hånd etter reglene under. Ta med de POI-ene som var med på å bestemme sektorene, med `osm`-id, i `pois`.
6. **Kjør `npm test` og `npm run typecheck`.**

## Reglene

- **Regelheftet gjelder** ([docs/stedsnavn.md](../../../../docs/stedsnavn.md)): funksjonsnavn i `name` og `short` («Byggvarehuset», «Blokkene»), det ekte stedet i `real` og `realAt`, preposisjonen i `at` («på industriområdet», «i blokkene», «ved brufestet»). Like steder skilles med retning, mer enn to med et kjennetegn.
- **6–8 sektorer per område.** Nøkkelstedet og HQ-kandidaten kommer i tillegg, høyst ett av hver, begge med trussel 4–5.
- **`kind`** er en av spillets typer: `hjem`, `butikk`, `industri`, `bolig`, `natur`, `kai`, `offentlig`. Butikker får `shopType` (bensinstasjon og bilforhandler har `kind: "industri"`).
- **Trusselen er relativ til fasen.** `threat` og `baseThreat` er 1–5 *innenfor området*. Fasen ganger opp via `mods(s)` i `src/engine/phases.ts`. Bruk hele skalaen, så det finnes trygge og farlige steder i hvert område.
- **Avstand telles i områder** (`ring`): 0 Buøy; 1 Vestøyene, Hundvåg, Østøyene; 2 Sentrum, Storhaug, Våland, Eiganes/Bjergsted; 3 Madla, Hillevåg, Ullandhaug/Hinna, Forus/Lura.
- **`gives`** sier kort hva stedet gir («skrap, metall, litt drivstoff»), etter tabellene i regelheftet.
- **Porter** heter etter det de sperrer («Brua mot byen»). `between` er `[dette området, nabo-id]`, og nabo-id-en må finnes i `atlas.config.json`.
- **Id-er** er små bokstaver, a–z, 0–9 og `_`, og unike i hele atlaset.
- **Kilder:** OSM krediteres i `sources` («© OpenStreetMap-bidragsytere, ODbL»).
- **Stedsnavn hører hjemme her og i `places.ts`.** `tests/region.test.ts` regner atlasmappa som eier av stedsnavn.
