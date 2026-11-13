"""Write the game's world: L1–L3 zones, measures, land borders, bridges and tunnels, places and start areas.

  python zonegame.py            writes apps/game-client/public/world/region-v1.json

The game never sees cells. Geometry is simplified for drawing; the rules use the neighbour lists.
"""
import json
import math
import sys
import time
from collections import Counter, defaultdict

import zonelib as z
import shapely
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

import zonecontent as content

OUT = z.ROOT / 'apps/game-client/public/world/region-v1.json'
SIMPLIFY = 4.0     # m
DIGITS = 5         # about 1 m
# Start areas the owner has named, by L3 zone name; the rest are chosen per L1.
CURATED_STARTS = ['09 · Skoleområdet', 'Lundsneset', 'Vikevåg', 'Judaberg', 'Madla', 'Tananger', 'Sandnes', 'Storhaug']


def rounded(geometry):
    return shapely.set_precision(geometry, 10 ** -DIGITS)


def coords(geometry):
    data = mapping(geometry)

    def walk(value):
        if isinstance(value, (list, tuple)) and value and isinstance(value[0], (int, float)):
            return [round(value[0], DIGITS), round(value[1], DIGITS)]
        return [walk(v) for v in value]
    return {'type': data['type'], 'coordinates': walk(data['coordinates'])}


def build(log=print):
    project = z.load_project()
    content.refresh_measures(project, log)
    zones = {x['id']: x for x in project['zones']}
    assign = project['assignments']
    cells, edges = {}, []
    by_zone = defaultdict(list)
    for area in project['areas']:
        for f in z.read_json(z.area_dir(area['id']) / 'cells.geojson')['features']:
            k = f['properties']['k']
            cells[k] = f['properties']
            if assign.get(k) in zones:
                by_zone[assign[k]].append(shapely.make_valid(z.to_utm(shape(f['geometry']))))
        for f in z.read_json(z.area_dir(area['id']) / 'edges.geojson')['features']:
            p = f['properties']
            edges.append((p['a'], p['b'], p['l']))
    log(f'{len(by_zone)} L3-soner')
    metric = {}
    for zone_id, parts in by_zone.items():
        merged = unary_union(parts).buffer(.3).buffer(-.3)
        metric[zone_id] = merged

    def outline(geometry):
        simple = geometry.simplify(SIMPLIFY, preserve_topology=True)
        polys = [p for p in z.polygons_of(simple) if p.area > 40]
        return coords(rounded(z.to_wgs(unary_union(polys)))) if polys else None

    # Land borders between L3 zones
    border = Counter()
    for a, b, length in edges:
        za, zb = assign.get(a), assign.get(b)
        if za and zb and za != zb and za in zones and zb in zones:
            border[tuple(sorted((za, zb)))] += length
    neighbours = [{'a': a, 'b': b, 'borderM': round(m)} for (a, b), m in sorted(border.items()) if m >= 5]

    locate = content._cell_locator(project)
    pois, links = [], []
    for poi in project.get('pois', []):
        key = locate(poi['lon'], poi['lat']) or poi.get('cell')
        zone_id = assign.get(key)
        if zone_id not in zones:
            continue
        record = {'id': poi['id'], 'name': poi['name'], 'zoneId': zone_id, 'role': poi.get('role') or '',
                  'kind': poi.get('kind') or 'other', 'at': [round(poi['lon'], DIGITS), round(poi['lat'], DIGITS)]}
        for field in ('hqType', 'facilityType', 'siteType', 'lengthM'):
            if poi.get(field):
                record[field] = poi[field]
        pois.append(record)
        if poi.get('facilityType') in ('bridge', 'tunnel') and len(poi.get('ends') or []) == 2:
            ends = [assign.get(locate(*e) or content._nearest_cell(locate, e)) for e in poi['ends']]
            if all(e in zones for e in ends) and ends[0] != ends[1]:
                links.append({'id': f"link-{poi['id']}", 'name': poi['name'], 'kind': poi['facilityType'],
                              'a': ends[0], 'b': ends[1], 'lengthM': poi.get('lengthM', 0), 'poiId': poi['id']})

    records = []
    centres = {}
    for zone in project['zones']:
        record = {'id': zone['id'], 'name': zone['name'], 'level': zone['level']}
        if zone.get('parentId'):
            record['parentId'] = zone['parentId']
        if zone['level'] == 3:
            geometry = metric.get(zone['id'])
            if geometry is None or geometry.is_empty:
                continue
            record['geometry'] = outline(geometry)
            point = z.to_wgs(geometry.representative_point())
            record['at'] = [round(point.x, DIGITS), round(point.y, DIGITS)]
            centres[zone['id']] = geometry.representative_point()
            for field in ('type', 'potential', 'finds', 'produces', 'measures'):
                if zone.get(field):
                    record[field] = zone[field]
        elif zone.get('measures'):
            record['measures'] = zone['measures']
        records.append(record)
    # L2 and L1 outlines, for drawing district borders.
    kids = defaultdict(list)
    for zone in project['zones']:
        if zone['level'] == 3 and zone['id'] in metric:
            kids[zone.get('parentId')].append(metric[zone['id']])
    l2_geometry = {k: unary_union(v) for k, v in kids.items() if k}
    l1_parts = defaultdict(list)
    for l2, geometry in l2_geometry.items():
        if l2 in zones:
            l1_parts[zones[l2].get('parentId')].append(geometry)
    for record in records:
        source = l2_geometry.get(record['id']) if record['level'] == 2 else \
            unary_union(l1_parts[record['id']]) if record['level'] == 1 and l1_parts.get(record['id']) else None
        if source is not None:
            simple = source.buffer(1).buffer(-1).simplify(SIMPLIFY * 3, preserve_topology=True)
            record['geometry'] = coords(rounded(z.to_wgs(simple)))
            point = z.to_wgs(source.representative_point())
            record['at'] = [round(point.x, DIGITS), round(point.y, DIGITS)]
    starts = choose_starts(project, zones, records, pois, neighbours)
    world = {
        'schemaVersion': 1, 'worldId': 'stavanger-region', 'worldVersion': f"region-v1-{time.strftime('%Y%m%d')}",
        'sources': ['© OpenStreetMap-bidragsytere (ODbL)', '© Kartverket, Matrikkelen', '© NIBIO, AR5'],
        'zones': records, 'neighbours': neighbours, 'links': links, 'pois': pois, 'starts': starts,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(world, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    log(f"Skrev {OUT} ({OUT.stat().st_size / 1e6:.1f} MB): {len(records)} soner, {len(neighbours)} grenser, "
        f"{len(links)} bruer og tunneler, {len(pois)} steder, {len(starts)} startområder")
    return world


def choose_starts(project, zones, records, pois, neighbours):
    """One start per L1 zone where possible: a quiet zone with homes, next to an HQ candidate in its district."""
    by_id = {r['id']: r for r in records}
    rules = content.catalog()['takeover']
    degree = Counter()
    for n in neighbours:
        degree[n['a']] += 1
        degree[n['b']] += 1
    hq_l2 = defaultdict(list)
    for p in pois:
        if p['role'] == 'hq' and p['zoneId'] in by_id:
            hq_l2[by_id[p['zoneId']].get('parentId')].append(p)

    def hours(record):
        m = record['measures']
        residents = m['floor'] / rules['residentFloorM2']
        return m['floor'] / rules['searchFloorM2PerHour'] + residents * rules['zombieShare'] * rules['hoursPerZombie']

    def l1_of(record):
        l2 = by_id.get(record.get('parentId'))
        return l2.get('parentId') if l2 else None

    starts = []
    used_l1 = set()
    # A start must be possible to hold: not a huge zone with kilometres of land border.
    candidates = [r for r in records if r['level'] == 3 and r.get('measures') and degree[r['id']] >= 2
                  and r['measures']['m2'] < 45e4 and r['measures']['landEdgeM'] < 5000]
    for name in CURATED_STARTS:
        record = next((r for r in records if r['level'] == 3 and r.get('measures') and r['name'] == name), None)
        if record:  # named starts may share an L1 zone
            starts.append(record)
            used_l1.add(l1_of(record))
    for l1 in sorted({l1_of(r) for r in candidates} - used_l1, key=str):
        options = [r for r in candidates if l1_of(r) == l1 and r['measures']['homes'] >= 10 and 40 <= hours(r) <= 260]
        if not options:
            continue
        best = max(options, key=lambda r: (len(hq_l2[r.get('parentId')]) > 0, -abs(hours(r) - 120)))
        starts.append(best)
    result = []
    for record in starts:
        l2 = by_id.get(record.get('parentId'), {})
        l1 = by_id.get(l2.get('parentId'), {})
        hq = hq_l2.get(record.get('parentId'), [])
        result.append({'zoneId': record['id'], 'name': f"{record['name']}, {l1.get('name', '')}".strip(', '),
                       'district': l2.get('name', ''), 'region': l1.get('name', ''),
                       'hqNearby': [p['name'] for p in hq][:3]})
    return result


if __name__ == '__main__':
    build()
