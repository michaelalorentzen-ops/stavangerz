# Stavanger Z

Et turbasert zombie-overlevelsesspill i nettleseren, på et ekte (men stilisert) kart over Stavanger. Litt Civ, mye lokal humor.

Du starter på Buøy en tirsdag morgen. Bybrua er stengt, Rosenberg er overkjørt, og det regner. Samle et crew blant naboene, klarer øya sektor for sektor, let etter utstyr og bygg sperringer før natta tar dere.

**Status:** prototype av fase 1 (Buøy).

## Spill det

```bash
npm install
npm run dev
```

Eller bygg en frittstående fil med `npm run build` og åpne `dist/index.html`. Fremdriften lagres i nettleseren.

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
    events.ts         hendelseskort
    rng.ts            seedet tilfeldighet
  ui/                 kart, panel og dialoger
  data/map.json       ferdigbygget kart (generert)
tests/                Vitest-tester for motoren, fasene, hendelsene og balansen
tools/
  bot.ts, sim.ts      enkel bot og balansesimulering
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
| `npm run sim -- 300` | spiller 300 runder med boten og viser balansen |
| `npm run build` | typesjekk og bygg til `dist/` |

Bygg kartet på nytt fra OpenStreetMap (krever Python 3 og shapely):

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
tools/fetch_osm.sh
.venv/bin/python tools/build_map.py data/osm.json src/data/map.json
```

## Kartdata

Kartdata © [OpenStreetMap](https://www.openstreetmap.org/copyright)-bidragsytere, tilgjengelig under Open Database License (ODbL).
