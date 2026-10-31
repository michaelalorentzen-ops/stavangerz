#!/usr/bin/env bash
# Henter rådata fra OpenStreetMap (Overpass) for en region.
# Bruk: tools/fetch_osm.sh [kartoppsett.json] [inner|outer|all]   (standard: src/regions/stavanger/map.config.json all)
# inner = det detaljerte utsnittet (osm.bbox): kystlinje, alle veier, arealbruk, steder og bygninger.
# outer = oversiktskartet over hele byen (osm.outer.bbox): bare kystlinje, hovedveier og bydelsgrenser, ingen bygninger.
# Hver del er én Overpass-spørring. Hent én gang og sjekk aldri inn. Data © OpenStreetMap-bidragsytere, ODbL.
set -euo pipefail
cd "$(dirname "$0")/.."
CFG="${1:-src/regions/stavanger/map.config.json}"
PART="${2:-all}"
cfg() { python3 -c "import json,sys; o=json.load(open(sys.argv[1]))['osm']; o=o.get('outer') if sys.argv[2]=='outer' else o; print(','.join(str(v) for v in o['bbox']) if sys.argv[3]=='bbox' else o['out']) if o else ''" "$CFG" "$1" "$2"; }
fetch() { # $1 = utfil, $2 = spørring
  mkdir -p "$(dirname "$1")"
  curl -sf --max-time 300 -A "stavanger-z/0.1 (hobbyprosjekt)" --data-urlencode "data=$2" -o "$1" https://overpass-api.de/api/interpreter
  echo "Lagret $1 ($(du -h "$1" | cut -f1))"
}
if [[ "$PART" == inner || "$PART" == all ]]; then
  BBOX="$(cfg inner bbox)"
  Q="[out:json][timeout:90];(way[\"natural\"=\"coastline\"]($BBOX);way[\"highway\"~\"motorway|trunk|primary|secondary|tertiary|residential|unclassified\"]($BBOX);way[\"landuse\"]($BBOX);way[\"leisure\"~\"park|pitch|nature_reserve\"]($BBOX);way[\"natural\"~\"wood|scrub|heath\"]($BBOX);nwr[\"name\"][\"amenity\"]($BBOX);nwr[\"name\"][\"shop\"]($BBOX);nwr[\"name\"][\"place\"]($BBOX);way[\"building\"]($BBOX);nwr[\"name\"][\"landuse\"=\"industrial\"]($BBOX););out geom;"
  fetch "$(cfg inner out)" "$Q"
fi
if [[ "$PART" == outer || "$PART" == all ]] && [[ -n "$(cfg outer out)" ]]; then
  BBOX="$(cfg outer bbox)"
  Q="[out:json][timeout:120][bbox:$BBOX];(way[\"natural\"=\"coastline\"];way[\"highway\"~\"^(motorway|trunk|primary|secondary)(_link)?$\"];);out geom qt;rel[\"boundary\"=\"administrative\"][\"admin_level\"=\"9\"];out geom qt;"
  fetch "$(cfg outer out)" "$Q"
fi
