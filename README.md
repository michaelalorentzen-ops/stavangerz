# Stavanger Z

Et turbasert zombie-overlevelsesspill i nettleseren, på et ekte (men stilisert) kart over Stavanger. Litt Civ, mye lokal humor.

Du starter på Buøy en tirsdag morgen. Bybrua er stengt, Rosenberg er overkjørt, og det regner. Samle et crew blant naboene, klarer øya sektor for sektor, let etter utstyr og bygg sperringer før natta tar dere.

**Status:** prototype av fase 1 (Buøy).

## Spill det

Åpne `dist/index.html` i en nettleser. Fremdriften lagres i nettleseren.

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
src/
  template.html   markup og CSS
  engine.js       spillmotor (ren logikk, seedet tilfeldighet)
  events.js       hendelseskort
  ui.js           kart, panel og modaler
  map.json        ferdigbygget kart (generert)
tools/
  fetch_osm.sh    henter rådata fra OpenStreetMap til data/osm.json
  build_map.py    gjør rådata om til kart og soner (src/map.json)
  build.py        setter sammen alt til dist/
dist/             ferdig spill (generert)
```

## Bygg

```bash
python3 tools/build.py
```

Bygg kartet på nytt fra OpenStreetMap (krever Python 3 og shapely):

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
tools/fetch_osm.sh
.venv/bin/python tools/build_map.py data/osm.json src/map.json
python3 tools/build.py
```

## Kartdata

Kartdata © [OpenStreetMap](https://www.openstreetmap.org/copyright)-bidragsytere, tilgjengelig under Open Database License (ODbL).
