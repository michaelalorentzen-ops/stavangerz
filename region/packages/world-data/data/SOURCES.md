# M1 geography sources

Retrieved 2026-10-31 from the official OpenStreetMap API. Attribution: © OpenStreetMap contributors. Geographic source data and derivatives: ODbL 1.0; see https://www.openstreetmap.org/copyright . No external tile server, paid map provider, geolocation, or live geodata fetch is used by the review app.

## Source snapshots

- `osm-backup.xml`: https://api.openstreetmap.org/api/0.6/map?bbox=5.720%2C58.990%2C5.740%2C59.005
  SHA-256: `0d03824c20dc0b601ac64e9f6a40bc47aa853e40abf1a463d6ee4a56130c255e`

- `osm-west.xml`: https://api.openstreetmap.org/api/0.6/map?bbox=5.710%2C58.980%2C5.730%2C58.995
  SHA-256: `80fa88680d3c06a7064b02c8f456af1d07203e29960f6eba762a0a2e000ed9e4`

- `osm-east.xml`: https://api.openstreetmap.org/api/0.6/map?bbox=5.730%2C58.980%2C5.750%2C58.995
  SHA-256: `6959cd0285563ed3de3c9d0af3f8991d3c5468cc87801e1ac47429f39303e6ba`

Original XML is kept locally in ignored `.tools/imports/`; derived minimal context is checked in as `basemap.json` (GeoJSON FeatureCollection). Only road/coast/building geometry and selected non-contact tags are retained. Feature `osmId` identifies the original way. Road traces are geographic context, not a verified right of access.

## POI provenance

- poi-001: OSM way/32456501, Buøy idrettsanlegg.
- poi-002: OSM way/32480580, Rosenberg industrial site; polygon representative point, not an asserted gate.
- poi-003: OSM way/295444551, Buøy transformatorstasjon.
- poi-004: OSM node/1795799207, Meny Hundvåg.
- poi-005: OSM node/1896814062, Rema 1000 Hundvåg.
- poi-006: OSM node/6336088347, Apotek 1 Hundvåg.
- poi-007: OSM way/33105939, Hundvåg skole.
- poi-008: OSM way/232686957, Austbø skole.
- poi-009: OSM way/709617061, Hundvåghallen.
- poi-010: OSM node/2031514518, toll/approach reference near the Buøy ramp. Game label is a proposed transport marker, not a surveyed tunnel portal.

## Authoring and limitations

`world-draft.json` separates proposals from geographic facts with status `draft`, source references and rationales. `zones.geojson` is the derived zone-layer export. `review-locations.json` contains interior label positions only, never identity or gameplay state.

Buøy cuts use OSM streets/industrial boundaries with explicit coast extensions. Hundvåg cuts are coarse corridor sketches and need local review, especially the western diagonal; they are not claimed to trace the ring road exactly. Northern/eastern clipping boundaries are an open scope edge, never a wall or source of infinite zombies. Small coastline fragments under 500 m² are omitted from playable cells; this does not assign population or resources. Nanoscopic overlay artifact holes below 1e-15 square degrees are removed on export. Larger geographic holes remain.

Only selected walking/cycling connections are modeled. Generic road context does not authorize movement, and graph directionality/access/mode rules need review before actual travel simulation. Bridge crossing uses the OSM pedestrian/cycle trace. Tunnels are source context only; no fabricated surface adjacency or playable tunnel exit is added. Ordinary zombie traversal across water is not defined.

## Reproduction

Application and validation use checked-in data, with no Python dependency. To reproduce the authoring process, retrieve the three source XMLs into `.tools/imports/`, install Shapely locally (`python -m pip install --target .tools/python shapely==2.2.0`), then run `python scripts/curate-world.py`. Upstream OSM changes may change output; the authoring script refuses to overwrite a different published definition; status=draft remains editable. Keep original snapshots for exact reproducibility. The script is a one-world curation aid, not an automatic zoning system.


## Hundvåg cell review draft

`dist/hundvag-celler/` is a review draft that is not connected to the game, seed or saves. It combines the local OSM snapshots with Kartverket's Matrikkelen Eiendomskart Teig (CC BY 4.0), retrieved 2026-11-05 from https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig into ignored `.tools/imports/matrikkel/`. Attribution: © Kartverket, Matrikkelen. To reproduce, install `pyproj` into `.tools/python`, then run `python scripts/cells-fetch-teig.py`, `python scripts/cells-build-hundvag.py` and `python scripts/cells-render-hundvag.py`. Parcel boundaries are geographic context and do not assert ownership or access.

## Zone editor

`world-zones/` is built by `tools/zone-editor/` from OpenStreetMap (Overpass, ODbL) and Kartverket's Matrikkelen Eiendomskart Teig (CC BY 4.0). Raw sources stay in ignored `.tools/imports/zones/`. See [the zone editor guide](../../../docs/20_ZONE_EDITOR.md). Exports are drafts. Parcel boundaries do not assert ownership or access.

## Focused review evidence (03/05/07)

OSM way/1051499023 (Clipperveien) shares a street node with Skipsbyggergata at 5.7329186,58.9852181. Its trace crosses proposed 05 into 06, remaining outside the Rosenberg polygon. This supports a perimeter approach, not an asserted HQ entrance. A proposed 03→05 junction connection and corrected 05→06 trace are now explicit in the graph.

The 07 split candidate follows service road Tømmerodden (way/27473078), with author-proposed end extensions. Gate references G1=node/12909093403, G2=node/12909093404, G3=node/12912004221; fence ways include 1394497114, 1279983029, 1394497115 and 408938457. These do not form proof of a continuous barrier on the proposed split. The overlay does not change canonical polygons or IDs.

Large static close-ups are produced with `python scripts/render-geography-review.py` and are suitable for reviewing without a localhost server. Route distances, when quoted, are estimates on the retained walking network excluding foot=no roads, tunnel context and private paths; they do not assert safe public access or game ETA. OSM coverage and missing links limit any negative reachability result.

## Arealressurskart AR5 (NIBIO)

Soneeditoren leser arealtypene i AR5 fra NIBIOs WMS (`https://wms.nibio.no/cgi-bin/ar5`, laget Arealtype). Hver celle får areal av fulldyrka jord, overflatedyrka jord, innmarksbeite, skog, myr, åpen fastmark og bebygd areal, og summene brukes til å regne ut mat og soneinnhold. Kartrutene mellomlagres i `.tools/imports/ar5/`. Kilde: © NIBIO, AR5. Tjenesten oppgir «Copyright Geovekst» og «Norge digital», så vilkårene må sjekkes før verden publiseres. AR5 regnes ellers som åpne data under CC BY 4.0.
