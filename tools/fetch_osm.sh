#!/usr/bin/env bash
# Henter rådata fra OpenStreetMap (Overpass) for byøyene til data/osm.json.
# Data © OpenStreetMap-bidragsytere, ODbL.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data
BBOX='58.955,5.69,59.010,5.81'
Q="[out:json][timeout:90];(way[\"natural\"=\"coastline\"]($BBOX);way[\"highway\"~\"motorway|trunk|primary|secondary|tertiary|residential|unclassified\"]($BBOX);way[\"landuse\"]($BBOX);way[\"leisure\"~\"park|pitch|nature_reserve\"]($BBOX);way[\"natural\"~\"wood|scrub|heath\"]($BBOX);nwr[\"name\"][\"amenity\"]($BBOX);nwr[\"name\"][\"shop\"]($BBOX);nwr[\"name\"][\"place\"]($BBOX);way[\"building\"]($BBOX);nwr[\"name\"][\"landuse\"=\"industrial\"]($BBOX););out geom;"
curl -sf --max-time 180 -A "stavanger-z/0.1 (hobbyprosjekt)" --data-urlencode "data=$Q" -o data/osm.json https://overpass-api.de/api/interpreter
echo "Lagret data/osm.json ($(du -h data/osm.json | cut -f1))"
