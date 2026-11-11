"""Municipality and district boundaries (OpenStreetMap), used to clip new areas and to group L2 zones into L1 zones."""
import json
import time
import urllib.parse
import urllib.request

import zonelib as z  # first: it puts the vendored packages on the path
import shapely
from shapely.geometry import LineString, mapping, shape
from shapely.ops import polygonize, unary_union

# OSM relation ids. Stavanger's districts are admin level 9; Rennesøy and Finnøy were municipalities until 2020.
ADMIN = {
    'randaberg': 405652, 'sola': 405653, 'sandnes': 10150660, 'stavanger': 10150658,
    'rennesoy': 405679, 'finnoy': 409899,
    'tasta': 1312722, 'hillevag': 1312723, 'hundvag': 1312724, 'madla': 1312725, 'storhaug': 1312726,
    'eiganes': 1312727, 'hinna': 1312728,
}
NAMES = {
    'randaberg': 'Randaberg', 'sola': 'Sola', 'sandnes': 'Sandnes', 'stavanger': 'Stavanger',
    'rennesoy': 'Rennesøy', 'finnoy': 'Finnøy', 'tasta': 'Tasta', 'hillevag': 'Hillevåg', 'hundvag': 'Hundvåg og Byøyene',
    'madla': 'Madla', 'storhaug': 'Storhaug', 'eiganes': 'Eiganes og Våland', 'hinna': 'Hinna',
}
CACHE = z.IMPORTS / 'admin.json'


def fetch_admin():
    if CACHE.exists():
        return z.read_json(CACHE)
    ids = ','.join(str(v) for v in ADMIN.values())
    query = f'[out:json][timeout:240];rel(id:{ids});out geom;'
    data = urllib.parse.urlencode({'data': query}).encode()
    error = None
    for attempt in range(6):
        endpoint = z.OVERPASS[attempt % len(z.OVERPASS)]
        try:
            request = urllib.request.Request(endpoint, data=data, headers={'User-Agent': z.USER_AGENT})
            with urllib.request.urlopen(request, timeout=300) as response:
                result = json.loads(response.read())
            break
        except Exception as exc:
            error = exc
            time.sleep(10)
    else:
        raise RuntimeError(f'Fikk ikke hentet grenser: {error}')
    shapes = {}
    by_id = {v: k for k, v in ADMIN.items()}
    for element in result['elements']:
        lines = [LineString([(p['lon'], p['lat']) for p in m['geometry']]) for m in element.get('members', [])
                 if m.get('type') == 'way' and m.get('geometry') and m.get('role') in ('outer', 'inner', '')]
        faces = list(polygonize(unary_union(lines)))
        outer = unary_union([f for f in faces])
        # Faces inside holes are dropped by keeping faces whose interior point is covered an odd number of times.
        shapes[by_id[element['id']]] = mapping(shapely.make_valid(outer))
    z.write_json(CACHE, shapes)
    return shapes


def admin_shapes():
    return {k: shapely.make_valid(shape(v)) for k, v in fetch_admin().items()}


if __name__ == '__main__':
    for key, geometry in admin_shapes().items():
        print(key, round(z.to_utm(geometry).area / 1e6, 1), 'km²', [round(v, 3) for v in geometry.bounds])
