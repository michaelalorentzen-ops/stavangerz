# Stavanger Z

Et turbasert zombie-overlevelsesspill i nettleseren, på et ekte (men stilisert) kart over Stavanger. Litt Civ, mye lokal humor.

Du starter på Buøy en tirsdag morgen. Bybrua er stengt, Rosenberg er overkjørt, og det regner. Samle et crew blant naboene, klarer øya sektor for sektor, let etter utstyr og bygg sperringer før natta tar dere.

**Status:** fase 1 (Buøy) er spillbar. Fase 2–5 er planlagt. Spillreglene står i [docs/spilldesign.md](docs/spilldesign.md).

## Spill det

```bash
npm install
npm run dev
```

Eller bygg en frittstående fil med `npm run build` og åpne `dist/index.html`. Fremdriften lagres i nettleseren.

## Slik spiller du

Hver dag gir du crewet ordre, og så løses dagen. Ingenting skjer i sanntid.

1. **Lag deg selv og velg tre naboer.** Folk har seks ferdigheter (Muskler, Kondis, Snoking, Nerver, Mekk, Prat) og en egenskap. Ferdighetene øker med erfaring og trening.
2. **Gi ordre.** De viktigste:
   - **Rydde** slår ned zombiene i en sektor. Når den er tom, gjennomsøker Rydde sektoren, finner ressurser og utstyr og sjekker kjellerne. Glemte kjellere bryter ut senere.
   - **Sanke** henter sektorens faste utbytte, som fisk på Tømmerodden eller skrap på Sørspissen.
   - **Befeste** bygger portene, og **Holde vakt** passer på en port eller en sektor.
   - **Speide**, **Lete etter overlevende**, **Lage utstyr**, **Trene**, **Pleie** og **Tokt** finnes også.
3. **Hold øye med de tre verdiene.** Hver sektor har infisering, gjennomsøkt og kontroll. En sektor uten folk mister kontroll, og da glemmer dere hva dere har ryddet og zombiene siver inn igjen. En sektor er trygg når den er tom, 100 % gjennomsøkt og har minst 50 i kontroll.
4. **Utstyr** ligger som kort på lageret. Hver person har tre spor: våpen, beskyttelse og verktøy. Utstyr slites, og det som en død person bar, blir liggende der det skjedde.
5. **Encounters og hendelser** venter på et valg før neste dag kan starte. Det finnes alltid en vei ut, men den koster.
6. **Mat og vann** går med hver dag. Sektorlagrene tømmes og maten råtner, så Sanke blir viktigere etter hvert. Det regner ofte. Dette er Stavanger.

**Målet i fase 1:** alle sju sektorene på Buøy trygge samtidig, og alle tre portene på nivå 2 eller mer. Når målet er nådd, velger du selv når fasen avsluttes. Etter 50 dager er tiden ute.

## Faser

| Fase | Navn | Kjerne |
|---|---|---|
| 1 | Utbruddet | Klarer hjemsonen, finn ressurser og utstyr, sett opp perimeter |
| 2 | Hovedkvarter | Finn transport, ta et HQ (Rosenberg Verft) med skjulte verdier, sett roller i crewet |
| 3 | Ekspansjon | Ta naboområder, få crew-ledere, rekrutter folk som kommer til porten |
| 4 | Bydel | Hold hele bydeler for bonuser, balanser vekst mot forsvar |
| 5 | Fraksjoner | Andre overlevende (NPC eller spillere): handel eller krig |

Zombiene blir sterkere og mer uforutsigbare fra fase til fase.

## Struktur

```
index.html            sideoppsett (Vite)
src/
  main.ts             oppstart og kobling mellom UI og motor
  styles.css
  engine/             spillmotoren, ren TypeScript uten DOM
    types.ts          spilltilstand og ordre
    phases.ts         fasetabellen og zombieevner
    data.ts           sektorer, sperringer, naboer, egenskaper
    engine.ts         newGame, resolveDay, taskOptions …
    sectors.ts, crew.ts, skills.ts, cards.ts, encounters.ts, tokt.ts
                      reglene for sektorer, crew, ferdigheter, utstyr, encounters og tokt
    content/          innhold: utstyrskort, encounters, tokt og mutasjoner
    events.ts         hendelseskort
    rng.ts            seedet tilfeldighet
  ui/                 kart, panel og dialoger
  data/map.json       ferdigbygget kart (generert)
tests/                Vitest-tester for motoren, fasene, hendelsene og balansen
tools/
  bot.ts, sim.ts      bot og balansesimulering
  fetch_osm.sh        henter rådata fra OpenStreetMap til data/osm.json
  build_map.py        gjør rådata om til kart og soner
  artifact.mjs        lager dist/artifact.html for publisering som Claude-artifact
```

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | utviklingsserver |
| `npm test` | alle tester |
| `npm run typecheck` | typesjekk |
| `npm run sim -- 300` | spiller 300 runder med boten og viser seiersandel, dager, sultedager, dødsårsaker og timeout |
| `npm run sim -- 300 --neighbors kjell,mona,arild` | det samme med valgte naboer |
| `npm run sim -- 300 --combos` | det samme for fire faste kombinasjoner av naboer |
| `npm run build` | typesjekk og bygg til `dist/` |

Bygg kartet på nytt fra OpenStreetMap (krever Python 3 og shapely):

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
tools/fetch_osm.sh
.venv/bin/python tools/build_map.py data/osm.json src/data/map.json
```

## Kartdata

Kartdata © [OpenStreetMap](https://www.openstreetmap.org/copyright)-bidragsytere, tilgjengelig under Open Database License (ODbL).
