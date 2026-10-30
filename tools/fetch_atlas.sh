#!/usr/bin/env bash
# Henter POI-data for atlaset (hele byen) fra OpenStreetMap med ÉN Overpass-spørring.
# Bruk: tools/fetch_atlas.sh [atlas.config.json]   (standard: src/regions/stavanger/atlas/atlas.config.json)
# bbox og utfil leses fra atlasoppsettet. Ingen bygningsgeometri: navngitte butikker,
# tjenester, kontorer, arealbruk, stedsnavn, hovedveier, bruer/tunneler og bydelsgrenser.
# Det meste hentes som senterpunkt («out center tags»), bare bydelsgrensene med geometri.
# Kjør én gang; resultatet (data/osm-atlas.json) sjekkes ikke inn. Data © OpenStreetMap-bidragsytere, ODbL.
set -euo pipefail
cd "$(dirname "$0")/.."
CFG="${1:-src/regions/stavanger/atlas/atlas.config.json}"
BBOX="$(python3 -c 'import json,sys; print(",".join(str(v) for v in json.load(open(sys.argv[1]))["bbox"]))' "$CFG")"
OUTFILE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["out"])' "$CFG")"
mkdir -p "$(dirname "$OUTFILE")"
Q="[out:json][timeout:180][bbox:$BBOX];
(
  nwr[\"name\"][\"shop\"];
  nwr[\"name\"][\"amenity\"];
  nwr[\"name\"][\"office\"];
  nwr[\"name\"][\"craft\"];
  nwr[\"name\"][\"leisure\"];
  nwr[\"name\"][\"historic\"];
  nwr[\"name\"][\"military\"];
  nwr[\"name\"][\"man_made\"~\"pier|tower|lighthouse|works\"];
  wr[\"landuse\"~\"^(industrial|farmland|forest|retail|military|port)$\"];
  wr[\"natural\"=\"wood\"];
  node[\"place\"];
  way[\"highway\"~\"^(motorway|trunk|primary|secondary)$\"];
  way[\"highway\"][\"bridge\"][\"name\"];
  way[\"highway\"][\"tunnel\"][\"name\"];
  way[\"railway\"=\"rail\"][\"bridge\"];
  way[\"railway\"=\"rail\"][\"tunnel\"];
)->.poi;
.poi out center tags qt;
rel[\"boundary\"=\"administrative\"][\"admin_level\"~\"^(7|8|9|10)$\"];
out geom qt;"
curl -sf --max-time 300 -A "stavanger-z/0.1 (hobbyprosjekt)" --data-urlencode "data=$Q" -o "$OUTFILE" https://overpass-api.de/api/interpreter
echo "Lagret $OUTFILE ($(du -h "$OUTFILE" | cut -f1))"
