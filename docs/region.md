# Regionpakker

Alt som er spesielt for en by, ligger i én mappe under `src/regions/`. Stavanger ligger i `src/regions/stavanger/`. Motoren i `src/engine/` kjenner bare id-er og regler, aldri navn.

## Hva pakken inneholder

| Fil | Innhold |
|---|---|
| `ids.ts` | Id-ene for sektorer, porter, soner og flagg, som TypeScript-typer. Id-ene står i lagrede spill, så de endres aldri etter at noen har spilt. |
| `places.ts` | Den eneste kilden for stedsnavn. Her ligger sektorer (`name`, `short`, `at`, verdier og funn), porter, soner (`ZONES`, `ZONE_INFO`), området fase 1 foregår i (`AREA`) og kjente steder som bare nevnes i tekst (`LANDMARKS`). |
| `people.ts` | Naboene som kan bli med i crewet. |
| `content/` | Utstyrskort, encounters, hendelser, tokt, quests og mutasjoner. Tekstene er lokale, men de slår alltid opp stedsnavn via id. |
| `map.config.json` | Alt kartbyggingen trenger: utsnitt mot OpenStreetMap, origo, hvilke landområder som blir fase 1-området, frøpunkter for sektorene, låste sektorer og soner. |

`src/regions/active.ts` (steder, id-er og folk) og `src/regions/content.ts` (innhold) velger hvilken region spillet bruker.

## Bytte navn på et sted

Endre navnet i `places.ts`. Alle tekster, logglinjer og UI-en henter navnet derfra. `at` er navnet med preposisjon slik det står i en setning («på Buøy nord», «i Nordkrysset», «hjemme»), og det er det tekstene bruker når de sier hvor noe skjer.

`tests/region.test.ts` feiler hvis et stedsnavn står direkte i en annen fil. Kommentarer er unntatt.

## Lage en ny region

1. **Velg området.** Fase 1 er et lite, avgrenset område (en øy, en bydel bak en elv) med 6–8 sektorer og 2–4 innganger som blir porter. Rundt det ligger soner som åpner seg i senere faser.
2. **Kopier `stavanger/`** til en ny mappe, for eksempel `src/regions/bergen/`.
3. **`ids.ts`:** skriv inn id-ene. Sektoren `hjem` må finnes i alle regioner. Det er der crewet bor, og der Hvile, Trene, Lage og Pleie skjer.
4. **`map.config.json`:** sett utsnittet (bbox), origo og frøpunktene for sektorene. Hvert felt har en `_doc` som forklarer det. Hent data én gang med `tools/fetch_osm.sh <config>`, og bygg kartet med `python tools/build_map.py <osm.json> src/data/map.json <config>`. Nettleseren skal aldri spørre Overpass.
5. **`places.ts`:** gi sektorene navn etter [regelheftet for stedsnavn](stedsnavn.md), type (`hjem`, `butikk`, `industri`, `bolig`, `natur`, `kai`, `offentlig`), trussel 1–5, verdier og et funn hver. Gi portene navn og sektor. Fyll ut `AREA`, `ZONES` og `LANDMARKS`.
6. **`people.ts` og `content/`:** skriv naboer og innhold med lokal humor. Kortenes `places` er sektortyper, ikke id-er, så de fleste encounters fungerer i alle byer. Hendelser og tokt som nevner bestemte steder, må skrives om.
7. **Bytt inn regionen** i `src/regions/active.ts` og `src/regions/content.ts`.
8. **Kjør `npm test`, `npm run typecheck` og `npm run sim -- 300 --combos`.** Balansemålene i `CLAUDE.md` gjelder for alle regioner. Juster verdiene i `places.ts` (zombier, kjellere, funn) før du endrer reglene.

### Kartlegging med AI

En AI-agent kan gjøre det meste av steg 1, 4 og 5. Gi den en bydel eller øy og be om:

- forslag til 6–8 sektorer med frøpunkter (lengde- og breddegrad), type og trussel, basert på OpenStreetMap-data (butikker, industri, skoler, kaier);
- 2–4 naturlige innganger (bruer, tunneler, hovedveier) som porter;
- én HQ-kandidat for fase 2 som låst sektor, og høyst ett nøkkelsted (se [stedsnavn.md](stedsnavn.md), kapittel 3);
- de nærmeste nabosonene for senere faser.

Sjekk forslaget mot kartet. Tilpass navn og tekster selv, for det er den lokale humoren som gjør spillet.
