"""Fetch Matrikkelen Teig parcels (CC BY 4.0) for a bbox into .tools/imports/matrikkel."""
import json
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
from pyproj import Transformer

WFS = 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig'
CRS = 'urn:ogc:def:crs:EPSG::25832'
GML = '{http://www.opengis.net/gml/3.2}'
BBOX = (5.705, 58.984, 5.760, 59.015)
TILE = 500
OUTPUT = ROOT / '.tools/imports/matrikkel/hundvag-teig.json'


def request(xmin, ymin, xmax, ymax, axis_swapped):
    box = (ymin, xmin, ymax, xmax) if axis_swapped else (xmin, ymin, xmax, ymax)
    query = urllib.parse.urlencode({
        'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeNames': 'app:Teig',
        'srsName': CRS, 'bbox': ','.join(f'{v:.1f}' for v in box) + f',{CRS}',
    })
    with urllib.request.urlopen(f'{WFS}?{query}', timeout=120) as response:
        return ET.fromstring(response.read())


def rings(polygon):
    result = []
    for ring in polygon.iter():
        if ring.tag in (f'{GML}exterior', f'{GML}interior'):
            points = []
            for pos in ring.iter(f'{GML}posList'):
                values = [float(v) for v in pos.text.split()]
                pairs = list(zip(values[::2], values[1::2]))
                points.extend(pairs if not points else pairs[1:])
            result.append(points)
    return result


def parse(root, seen):
    for member in root.iter('{http://www.opengis.net/wfs/2.0}member'):
        feature = member[0]
        key = feature.get(f'{GML}id')
        if key in seen:
            continue
        polygons = [rings(p) for p in feature.iter(f'{GML}Polygon')]
        if not polygons:
            continue
        attributes = {child.tag.split('}')[1]: child.text.strip() for child in feature
                      if child.text and child.text.strip() and len(child) == 0}
        seen[key] = {'id': key, 'attributes': attributes, 'polygons': polygons}


to_utm = Transformer.from_crs(4326, 25832, always_xy=True)
xmin, ymin = to_utm.transform(BBOX[0], BBOX[1])
xmax, ymax = to_utm.transform(BBOX[2], BBOX[3])
seen = {}
swapped = None
x = xmin
while x < xmax:
    y = ymin
    while y < ymax:
        if swapped is None:
            for option in (False, True):
                root = request(x + 1000, y + 1000, x + 1500, y + 1500, option)
                if len(list(root.iter('{http://www.opengis.net/wfs/2.0}member'))):
                    swapped = option
                    break
            print('axis swapped:', swapped, flush=True)
        root = request(x, y, x + TILE, y + TILE, bool(swapped))
        parse(root, seen)
        y += TILE
        time.sleep(.1)
    print(f'x={x:.0f} parcels={len(seen)}', flush=True)
    x += TILE
OUTPUT.write_text(json.dumps({'crs': 'EPSG:25832', 'bbox': BBOX, 'source': WFS, 'license': 'CC-BY-4.0',
                              'retrievedAt': time.strftime('%Y-%m-%d'),
                              'parcels': list(seen.values())}), encoding='utf-8')
print('wrote', OUTPUT, len(seen))
