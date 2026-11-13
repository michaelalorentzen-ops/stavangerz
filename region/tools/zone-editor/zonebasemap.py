"""
Builds the game's own basemap from the OpenStreetMap data already cached for the zone editor.
No tiles from anyone else at play time: everything the map draws ships with the game.

Writes to apps/game-client/public/world/basemap/:
  land.json       land: the union of all L3 zones, so the sea is simply the background
  landuse.json    residential, industry, farmland, forest, grass, wetland, sand and fresh water, simplified
  roads.json      roads by class, simplified; paths and service roads left out
  buildings-<area>.json   building footprints with a height, one file per import area, loaded when zoomed in
  index.json      what exists, with bounding boxes for the building files

  python tools/zone-editor/zonebasemap.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.tools/python'))
import shapely  # noqa: E402
from shapely.geometry import LineString, Polygon, mapping, shape  # noqa: E402
from shapely.ops import unary_union  # noqa: E402

IMPORTS = ROOT / '.tools/imports/zones'
OUT = ROOT / 'apps/game-client/public/world/basemap'
WORLD = ROOT / 'apps/game-client/public/world/region-v1.json'
# Degrees: about 1e-5 is a metre at this latitude.
# Building files are cut in a grid of about 2 by 2 km, loaded as the map shows them.
CELL = (0.035, 0.018)
SIMPLIFY = {'landuse': 6e-5, 'road': 3e-5, 'building': 1.2e-5, 'land': 4e-5}

ROAD_CLASS = {
    'motorway': 'major', 'trunk': 'major', 'primary': 'major', 'motorway_link': 'major', 'trunk_link': 'major', 'primary_link': 'major',
    'secondary': 'medium', 'tertiary': 'medium', 'secondary_link': 'medium', 'tertiary_link': 'medium',
    'residential': 'minor', 'unclassified': 'minor', 'living_street': 'minor', 'road': 'minor', 'track': 'track',
}
LANDUSE = {
    ('landuse', 'residential'): 'residential', ('landuse', 'industrial'): 'industry', ('landuse', 'commercial'): 'industry', ('landuse', 'retail'): 'industry',
    ('landuse', 'port'): 'industry', ('landuse', 'farmland'): 'farm', ('landuse', 'meadow'): 'farm', ('landuse', 'farmyard'): 'farm', ('landuse', 'orchard'): 'farm',
    ('landuse', 'greenhouse_horticulture'): 'farm', ('landuse', 'forest'): 'forest', ('natural', 'wood'): 'forest', ('landuse', 'grass'): 'grass',
    ('leisure', 'park'): 'grass', ('landuse', 'recreation_ground'): 'grass', ('leisure', 'pitch'): 'grass', ('landuse', 'cemetery'): 'grass',
    ('natural', 'heath'): 'heath', ('natural', 'scrub'): 'heath', ('natural', 'grassland'): 'heath', ('natural', 'wetland'): 'wetland',
    ('natural', 'beach'): 'sand', ('natural', 'sand'): 'sand', ('natural', 'bare_rock'): 'rock', ('natural', 'water'): 'water', ('landuse', 'reservoir'): 'water',
    ('landuse', 'quarry'): 'rock', ('aeroway', 'aerodrome'): 'industry',
}


def ring(geom):
    return [(p['lon'], p['lat']) for p in geom]


def poly_of(el):
    if el['type'] == 'way' and 'geometry' in el and len(el['geometry']) >= 4 and el['geometry'][0] == el['geometry'][-1]:
        p = Polygon(ring(el['geometry']))
        return p if p.is_valid else p.buffer(0)
    if el['type'] == 'relation':
        outers = [Polygon(ring(m['geometry'])) for m in el.get('members', []) if m.get('role') == 'outer' and m.get('geometry') and len(m['geometry']) >= 4 and m['geometry'][0] == m['geometry'][-1]]
        inners = [Polygon(ring(m['geometry'])) for m in el.get('members', []) if m.get('role') == 'inner' and m.get('geometry') and len(m['geometry']) >= 4 and m['geometry'][0] == m['geometry'][-1]]
        if not outers:
            return None
        p = unary_union([o.buffer(0) for o in outers])
        if inners:
            p = p.difference(unary_union([i.buffer(0) for i in inners]))
        return p
    return None


def rounded(geom, digits=5):
    return json.loads(json.dumps(mapping(shapely.set_precision(geom, 10 ** -digits))))


def feature(geom, props, digits=5):
    if geom is None or geom.is_empty:
        return None
    return {'type': 'Feature', 'properties': props, 'geometry': rounded(geom, digits)}


def height(tags):
    try:
        if 'height' in tags:
            return round(float(str(tags['height']).split()[0]), 1)
        if 'building:levels' in tags:
            return round(float(tags['building:levels']) * 3.1, 1)
    except ValueError:
        pass
    kind = tags.get('building', 'yes')
    return {'house': 6, 'detached': 6, 'garage': 3, 'shed': 2.5, 'apartments': 13, 'industrial': 9, 'warehouse': 9, 'church': 14, 'commercial': 10, 'retail': 8, 'school': 9}.get(kind, 6)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    seen = set()
    landuse, roads = [], []
    index = {'buildings': []}
    grid = {}
    for area in sorted(p for p in IMPORTS.iterdir() if (p / 'osm.json').exists()):
        data = json.loads((area / 'osm.json').read_text(encoding='utf-8'))
        buildings = []
        for el in data['elements']:
            key = (el['type'], el['id'])
            if key in seen:
                continue
            tags = el.get('tags', {})
            if 'building' in tags:
                seen.add(key)
                p = poly_of(el)
                if p is not None and not p.is_empty and p.area > 2e-10:
                    f = feature(p.simplify(SIMPLIFY['building'], preserve_topology=True), {'h': height(tags)}, 6)
                    if f:
                        buildings.append(f)
                continue
            if 'highway' in tags and el['type'] == 'way' and tags['highway'] in ROAD_CLASS and 'geometry' in el:
                seen.add(key)
                line = LineString(ring(el['geometry'])).simplify(SIMPLIFY['road'])
                f = feature(line, {'c': ROAD_CLASS[tags['highway']], **({'b': 1} if tags.get('bridge') == 'yes' else {}), **({'t': 1} if tags.get('tunnel') == 'yes' else {})})
                if f:
                    roads.append(f)
                continue
            kind = next((LANDUSE[(k, tags[k])] for k in ('landuse', 'natural', 'leisure', 'aeroway') if (k, tags.get(k)) in LANDUSE), None)
            if kind:
                seen.add(key)
                p = poly_of(el)
                if p is not None and not p.is_empty and p.area > 5e-9:
                    f = feature(p.simplify(SIMPLIFY['landuse'], preserve_topology=True), {'k': kind})
                    if f:
                        landuse.append(f)
        for f in buildings:
            c = shape(f['geometry']).representative_point()
            grid.setdefault((int(c.x // CELL[0]), int(c.y // CELL[1])), []).append(f)
        print(area.name, len(buildings), 'buildings')
    for old in OUT.glob('buildings-*.json'):
        old.unlink()
    for (gx, gy), feats in sorted(grid.items()):
        name = f'buildings-{gx}-{gy}.json'
        (OUT / name).write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, separators=(',', ':')), encoding='utf-8')
        index['buildings'].append({'file': name, 'bbox': [round(gx * CELL[0], 4), round(gy * CELL[1], 4), round((gx + 1) * CELL[0], 4), round((gy + 1) * CELL[1], 4)], 'count': len(feats)})
    world = json.loads(WORLD.read_text(encoding='utf-8'))
    land = unary_union([shape(z['geometry']).buffer(0) for z in world['zones'] if z['level'] == 3 and z.get('geometry')])
    land = land.buffer(2e-5).buffer(-2e-5).simplify(SIMPLIFY['land'], preserve_topology=True)
    for name, feats in [('land.json', [feature(land, {})]), ('landuse.json', landuse), ('roads.json', roads)]:
        (OUT / name).write_text(json.dumps({'type': 'FeatureCollection', 'features': [f for f in feats if f]}, separators=(',', ':')), encoding='utf-8')
    index['sources'] = ['© OpenStreetMap-bidragsytere (ODbL)']
    (OUT / 'index.json').write_text(json.dumps(index, indent=1), encoding='utf-8')
    total = sum(p.stat().st_size for p in OUT.iterdir())
    print(f"{len(index['buildings'])} building cells, largest {max(p.stat().st_size for p in OUT.glob('buildings-*.json')) / 1e6:.1f} MB, all files {total / 1e6:.1f} MB")


if __name__ == '__main__':
    main()
