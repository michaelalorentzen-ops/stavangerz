#!/usr/bin/env bash
# Henter rådata fra OpenStreetMap (Overpass) for en region.
# Bruk: tools/fetch_osm.sh [kartoppsett.json]   (standard: src/regions/stavanger/map.config.json)
# bbox og utfil leses fra "osm" i kartoppsettet. Data © OpenStreetMap-bidragsytere, ODbL.
set -euo pipefail
cd "$(dirname "$0")/.."
CFG="${1:-src/regions/stavanger/map.config.json}"
BBOX="$(python3 -c 'import json,sys; print(",".join(str(v) for v in json.load(open(sys.argv[1]))["osm"]["bbox"]))' "$CFG")"
OUTFILE="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["osm"]["out"])' "$CFG")"
mkdir -p "$(dirname "$OUTFILE")"
Q="[out:json][timeout:90];(way[\"natural\"=\"coastline\"]($BBOX);way[\"highway\"~\"motorway|trunk|primary|secondary|tertiary|residential|unclassified\"]($BBOX);way[\"landuse\"]($BBOX);way[\"leisure\"~\"park|pitch|nature_reserve\"]($BBOX);way[\"natural\"~\"wood|scrub|heath\"]($BBOX);nwr[\"name\"][\"amenity\"]($BBOX);nwr[\"name\"][\"shop\"]($BBOX);nwr[\"name\"][\"place\"]($BBOX);way[\"building\"]($BBOX);nwr[\"name\"][\"landuse\"=\"industrial\"]($BBOX););out geom;"
curl -sf --max-time 180 -A "stavanger-z/0.1 (hobbyprosjekt)" --data-urlencode "data=$Q" -o "$OUTFILE" https://overpass-api.de/api/interpreter
echo "Lagret $OUTFILE ($(du -h "$OUTFILE" | cut -f1))"
