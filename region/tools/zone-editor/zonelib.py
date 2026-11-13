"""Cell geography for the zone editor: fetch sources, build cells, propose zones, cut and export.

The source of truth is project.json (zone hierarchy and cell -> L3 assignment). Zone outlines are always
derived from cells, so gaps, overlaps and children outside their parents cannot occur.
"""
import hashlib
import heapq
import json
import math
import os
import shutil
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.tools/python'))
import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, MultiLineString, Point, Polygon, box, mapping, shape
from shapely.ops import linemerge, polygonize, unary_union
from shapely.strtree import STRtree

PROJECT = Path(os.environ.get('ZONE_PROJECT', ROOT / 'world-zones'))
IMPORTS = ROOT / '.tools/imports/zones'
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
TEIG_WFS = 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig'
TEIG_CRS = 'urn:ogc:def:crs:EPSG::25832'
USER_AGENT = 'stavanger-z-zone-editor/1.0'
GML = '{http://www.opengis.net/gml/3.2}'
WFS_MEMBER = '{http://www.opengis.net/wfs/2.0}member'

FETCH_MARGIN = .015     # degrees around an area, so parcels and roads are whole at its edge.
LARGE_PARCEL = 20000    # m²; only these may be split by paths, service roads and land-cover edges.
SMALL_AREA = 150        # m²; cells below this, or thinner than SMALL_WIDTH, join a neighbour.
SMALL_WIDTH = 6         # m
MAX_BUILDING_MERGE = 100000  # m²
THIN_PARCEL = 15        # m; road-like parcels are clipped at the area edge instead of following it outward.
GRID = .1               # m
MASS_AREA = 8000        # m² of land counted as one building when balancing zone size.
BARRIER_WIDTH = 4       # m
BARRIER_BRIDGE = 100    # m; longest gap in a named barrier road that is treated as continuous.
MIN_SIDE_AREA = 50000   # m²
SHAPE_WEIGHT = .12
TINY_ZONE = .3
SEAM_GAP = .5           # m between areas, so their zones can never overlap after rounding.
SEAM_TOLERANCE = .9     # m
BLOCK_MASS = 18         # Buildings in the group of cells one click moves.
ROUTE_MAX_NODES = 120000
ROUTE_MIN_RES = 2.0     # m
SNAP_TO_EDGE = 40       # m

MAJOR = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link',
         'secondary_link', 'tertiary_link'}
STREET = MAJOR | {'unclassified', 'residential', 'living_street', 'pedestrian'}
MINOR = {'service', 'track', 'path', 'footway', 'cycleway', 'bridleway', 'steps'}
LAND_COVER = {'forest', 'residential', 'industrial', 'farmland', 'meadow', 'grass', 'recreation_ground', 'allotments',
              'commercial', 'retail', 'cemetery', 'orchard', 'wood', 'heath', 'scrub', 'wetland', 'grassland'}

_to_utm = Transformer.from_crs(4326, 25832, always_xy=True)
_to_wgs = Transformer.from_crs(25832, 4326, always_xy=True)


def to_utm(geometry):
    return shapely.transform(geometry, lambda a: np.column_stack(_to_utm.transform(a[:, 0], a[:, 1])))


def to_wgs(geometry):
    def convert(a):
        return np.round(np.column_stack(_to_wgs.transform(a[:, 0], a[:, 1])), 7)
    return shapely.transform(geometry, convert)


def polygons_of(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == 'Polygon':
        return [geometry]
    return [part for g in getattr(geometry, 'geoms', []) for part in polygons_of(g)]


def lines_of(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type in ('LineString', 'LinearRing'):
        return [LineString(geometry.coords)]
    return [part for g in getattr(geometry, 'geoms', []) for part in lines_of(g)]


def read_json(path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path, value, indent=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=indent, separators=None if indent else (',', ':')),
                         encoding='utf-8')
    os.replace(temporary, path)


def area_dir(area_id):
    return PROJECT / 'areas' / area_id


def project_path():
    return PROJECT / 'project.json'


def load_project():
    return read_json(project_path())


def new_project():
    return {
        'schemaVersion': 1,
        'settings': {'targetBuildings': 266, 'minBuildings': 100, 'maxBuildings': 450, 'l3PerL2': 6,
                     'baseWorld': 'dist/geografi-41-work.json'},
        'areas': [],
        'zones': [{'id': 'region-001', 'name': 'Hundvåg og Byøyene', 'level': 1, 'locked': False}],
        'assignments': {},
    }


def save_project(project):
    write_json(project_path(), project, indent=None)


def new_zone_id(project, level):
    used = {z['id'] for z in project['zones']}
    number = 1 + sum(z['level'] == level for z in project['zones'])
    while f'z{level}-{number:04d}' in used:
        number += 1
    return f'z{level}-{number:04d}'


# ---------------------------------------------------------------- sources

def fetch_bbox(area):
    w, s, e, n = area['bbox']
    return w - FETCH_MARGIN, s - FETCH_MARGIN / 2, e + FETCH_MARGIN, n + FETCH_MARGIN / 2


def fetch_osm(area, log):
    cache = IMPORTS / area['id'] / 'osm.json'
    if cache.exists():
        log('Bruker lagret OSM-uttrekk')
        return read_json(cache)
    w, s, e, n = fetch_bbox(area)
    b = f'{s},{w},{n},{e}'
    query = f'''[out:json][timeout:240];(
way["highway"]({b});way["building"]({b});rel["building"]({b});
way["natural"]({b});rel["natural"="water"]({b});way["waterway"]({b});
way["landuse"]({b});way["leisure"~"park|nature_reserve|pitch|golf_course"]({b});
node["place"]({b}););out geom;'''
    data = urllib.parse.urlencode({'data': query}).encode()
    error = None
    for endpoint in OVERPASS:
        for attempt in range(3):
            try:
                log(f'Henter veier, bygg og kyst fra OpenStreetMap (forsøk {attempt + 1})')
                request = urllib.request.Request(endpoint, data=data, headers={'User-Agent': USER_AGENT})
                with urllib.request.urlopen(request, timeout=300) as response:
                    result = json.loads(response.read())
                result['retrievedAt'] = time.strftime('%Y-%m-%d')
                write_json(cache, result)
                return result
            except Exception as exc:  # Public mirrors fail in several ways; every failure means try the next one.
                error = exc
                time.sleep(5 * (attempt + 1))
    raise RuntimeError(f'Fikk ikke hentet OpenStreetMap-data: {error}')


def teig_tile(x, y, size):
    query = urllib.parse.urlencode({
        'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeNames': 'app:Teig', 'srsName': TEIG_CRS,
        'bbox': f'{x:.1f},{y:.1f},{x + size:.1f},{y + size:.1f},{TEIG_CRS}',
    })
    request = urllib.request.Request(f'{TEIG_WFS}?{query}', headers={'User-Agent': USER_AGENT})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return ET.fromstring(response.read())
        except Exception:  # The service sometimes drops long requests; a retry normally succeeds.
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))


def gml_rings(polygon):
    rings = []
    for ring in polygon.iter():
        if ring.tag in (f'{GML}exterior', f'{GML}interior'):
            points = []
            for positions in ring.iter(f'{GML}posList'):
                values = [float(v) for v in positions.text.split()]
                pairs = list(zip(values[::2], values[1::2]))
                points.extend(pairs if not points else pairs[1:])
            rings.append(points)
    return rings


def fetch_teig(area, land, log):
    cache = IMPORTS / area['id'] / 'teig.json'
    if cache.exists():
        log('Bruker lagrede tomtegrenser')
        return read_json(cache)['parcels']
    size = 500
    xmin, ymin, xmax, ymax = land.bounds
    tiles = []
    x = xmin
    while x < xmax:
        y = ymin
        while y < ymax:
            tiles.append((x, y))
            y += size
        x += size
    prepared = land
    shapely.prepare(prepared)
    tiles = [t for t in tiles if prepared.intersects(box(t[0], t[1], t[0] + size, t[1] + size))]
    seen = {}
    for index, (x, y) in enumerate(tiles, 1):
        for member in teig_tile(x, y, size).iter(WFS_MEMBER):
            feature = member[0]
            key = feature.get(f'{GML}id')
            if key not in seen:
                polygons = [gml_rings(p) for p in feature.iter(f'{GML}Polygon')]
                if polygons:
                    seen[key] = {'id': key, 'polygons': polygons}
        if index % 10 == 0 or index == len(tiles):
            log(f'Henter tomtegrenser fra Kartverket: {index}/{len(tiles)} ruter, {len(seen)} tomter')
        time.sleep(.05)
    parcels = list(seen.values())
    write_json(cache, {'source': TEIG_WFS, 'license': 'CC-BY-4.0', 'crs': 'EPSG:25832',
                       'retrievedAt': time.strftime('%Y-%m-%d'), 'parcels': parcels})
    return parcels


def classify_osm(osm):
    """Split raw OSM elements into metric layers. Coordinates are lon/lat in `out geom`."""
    layers = {name: [] for name in ('major', 'street', 'minor', 'cover', 'buildings', 'coast', 'water')}
    named = []
    places = []

    def points_of(geometry):
        xs, ys = _to_utm.transform([p['lon'] for p in geometry], [p['lat'] for p in geometry])
        return list(zip(xs, ys))

    for element in osm['elements']:
        tags = element.get('tags', {})
        if element['type'] == 'node':
            if tags.get('name') and tags.get('place') in ('suburb', 'neighbourhood', 'quarter', 'locality', 'hamlet',
                                                          'village', 'farm', 'isolated_dwelling', 'island', 'islet'):
                places.append({'name': tags['name'], 'kind': tags['place'],
                               'point': _to_utm.transform(element['lon'], element['lat'])})
            continue
        if element['type'] == 'relation':
            outer = [m for m in element.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
            lines = [LineString(points_of(m['geometry'])) for m in outer if len(m['geometry']) >= 2]
            faces = list(polygonize(unary_union(lines))) if lines else []
            if tags.get('building'):
                layers['buildings'].extend(f for f in faces if f.area > 8)
            elif tags.get('natural') == 'water':
                inner = [m for m in element.get('members', []) if m.get('role') == 'inner' and m.get('geometry')]
                holes = [LineString(points_of(m['geometry'])) for m in inner if len(m['geometry']) >= 2]
                cut = unary_union(list(polygonize(unary_union(holes)))) if holes else None
                layers['water'].extend(f.difference(cut) if cut else f for f in faces)
            continue
        geometry = element.get('geometry')
        if not geometry or len(geometry) < 2:
            continue
        points = points_of(geometry)
        closed = points[0] == points[-1] and len(points) >= 4
        highway = tags.get('highway')
        natural = tags.get('natural')
        if tags.get('building') and tags['building'] != 'no' and closed:
            footprint = Polygon(points).buffer(0)
            if footprint.area > 8:
                layers['buildings'].append(footprint)
            continue
        if natural == 'coastline':
            layers['coast'].append(LineString(points))
            continue
        if natural == 'water' and closed:
            layers['water'].append(Polygon(points).buffer(0))
            continue
        hidden = tags.get('tunnel') in ('yes', 'building_passage') or tags.get('covered') == 'yes'
        line = LineString(points)
        if highway and highway not in ('construction', 'proposed', 'platform', 'raceway') and not hidden:
            if highway in MAJOR:
                layers['major'].append(line)
            if highway in STREET:
                layers['street'].append(line)
            elif highway in MINOR:
                layers['minor'].append(line)
            if tags.get('name'):
                named.append((tags['name'], tags.get('junction'), line, highway))
        elif highway and hidden and tags.get('name'):
            named.append((tags['name'], 'tunnel', line, highway))
        elif tags.get('waterway') in ('stream', 'river', 'ditch', 'drain') and not hidden:
            layers['minor'].append(line)
        elif closed and (tags.get('landuse') in LAND_COVER or natural in LAND_COVER
                         or tags.get('leisure') in ('park', 'nature_reserve', 'pitch', 'golf_course')):
            layers['cover'].append(line)
    return layers, named, places


def land_polygon(area, layers):
    """Land from OSM coastline. OSM coastlines keep land on their left, which classifies each face."""
    w, s, e, n = fetch_bbox(area)
    # Shrunk because the projected rectangle bulges slightly past the rectangle the coast was fetched for.
    frame = to_utm(box(w, s, e, n)).buffer(-100)
    coast = [part for line in layers['coast'] for part in lines_of(line.intersection(frame))]
    if not coast:
        land = frame
    else:
        # Noded with the whole coastline, since clipped ends do not land exactly on the frame.
        faces = [f for f in polygonize(unary_union([frame.boundary, *layers['coast']]))
                 if frame.covers(f.representative_point())]
        tree = STRtree(faces)
        votes = defaultdict(int)
        for line in coast:
            coords = list(line.coords)
            for a, b in list(zip(coords, coords[1:]))[::3]:
                dx, dy = b[0] - a[0], b[1] - a[1]
                length = math.hypot(dx, dy)
                if not length:
                    continue
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                left = Point(mx - dy / length * .5, my + dx / length * .5)
                right = Point(mx + dy / length * .5, my - dx / length * .5)
                for point, vote in ((left, 1), (right, -1)):
                    for i in tree.query(point, 'within'):
                        votes[int(i)] += vote
        land = unary_union([faces[i] for i, vote in votes.items() if vote > 0])
    water = [w_ for w_ in layers['water'] if w_.area > 2000]
    if water:
        land = land.difference(unary_union(water))
    return land.buffer(0)


# ---------------------------------------------------------------- cells

def parcels_metric(parcels):
    result = []
    for parcel in parcels:
        for rings in parcel['polygons']:
            result.extend(polygons_of(Polygon(rings[0], rings[1:]).buffer(0)))
    return result


def build_domain(area, land, parcels, existing, seeds):
    frame = to_utm(shape(area['clip']).buffer(0)) if area.get('clip') else to_utm(box(*area['bbox']))
    inside, outside = [], []
    shapely.prepare(frame)
    for parcel in parcels:
        (inside if frame.contains(parcel.representative_point()) else outside).append(parcel)
    whole = [p for p in inside if 2 * p.area / max(p.length, 1) >= THIN_PARCEL]
    spill = [p for p in outside if 2 * p.area / max(p.length, 1) >= THIN_PARCEL and p.intersects(frame)]
    domain = land.intersection(frame)
    if whole:
        domain = domain.union(unary_union(whole).intersection(land))
    if spill:
        domain = domain.difference(unary_union(spill))
    if existing is not None and not existing.is_empty:
        domain = domain.difference(existing.buffer(SEAM_GAP))
    if seeds:
        points = [Point(_to_utm.transform(*seed)) for seed in seeds]
        kept = [p for p in polygons_of(land) if any(p.contains(point) for point in points)]
        if not kept:
            raise ValueError('Fant ikke land ved valgt punkt')
        domain = domain.intersection(unary_union(kept))
    parts = [p for p in polygons_of(domain.buffer(.2).buffer(-.2)) if p.area > 30]
    return unary_union(parts)


def build_faces(domain, parcels, layers):
    clipped = [p.intersection(domain) for p in parcels if p.intersects(domain)]
    large = [p for p in clipped if p.area >= LARGE_PARCEL]
    lines = lines_of(domain.boundary)
    for parcel in clipped:
        for polygon in polygons_of(parcel):
            lines.extend(lines_of(polygon.boundary))
    shapely.prepare(domain)
    lines.extend(part for line in layers['street'] if domain.intersects(line)
                 for part in lines_of(line.intersection(domain)))
    if large:
        area = unary_union(large)
        shapely.prepare(area)
        for line in layers['minor'] + layers['cover']:
            if area.intersects(line):
                lines.extend(lines_of(line.intersection(area)))
    snapped = shapely.set_precision(np.array(lines, dtype=object), GRID)
    network = unary_union([line for line in snapped if not line.is_empty])
    shapely.prepare(domain)
    faces = [face for face in polygonize(network)
             if face.area > .05 and domain.covers(face.representative_point())]
    faces.sort(key=lambda p: (p.bounds, p.area))
    return faces


class Regions:
    """Merge graph. Edge values: shared length, then how much of it follows barrier, major and street lines."""

    def __init__(self, faces=(), guides=None):
        self.area = {i: f.area for i, f in enumerate(faces)}
        self.length = {i: f.length for i, f in enumerate(faces)}
        self.buildings = dict.fromkeys(self.area, 0)
        self.members = {i: [i] for i in self.area}
        self.adjacent = defaultdict(dict)
        if faces:
            for a, b, edge, _line in shared_edges(list(faces), guides):
                self.adjacent[a][b] = edge
                self.adjacent[b][a] = edge

    def merge(self, keep, gone):
        self.length[keep] -= 2 * self.adjacent[keep].get(gone, [0])[0]
        for other, edge in self.adjacent.pop(gone, {}).items():
            del self.adjacent[other][gone]
            if other == keep:
                continue
            existing = self.adjacent[keep].get(other)
            combined = [x + y for x, y in zip(existing, edge)] if existing else edge
            self.adjacent[keep][other] = combined
            self.adjacent[other][keep] = combined
        self.area[keep] += self.area.pop(gone)
        self.length[keep] += self.length.pop(gone)
        self.buildings[keep] += self.buildings.pop(gone)
        self.members[keep] += self.members.pop(gone)

    def mass(self, i):
        return self.buildings[i] + self.area[i] / MASS_AREA


def shared_edges(geometries, guides, others=None):
    """Yield (a, b, [length, barrier, major, street], line) for touching geometries."""
    array = np.array(geometries, dtype=object)
    target = np.array(others, dtype=object) if others is not None else array
    left, right = STRtree(list(target)).query(array, predicate='intersects')
    if others is None:
        keep = left < right
        left, right = left[keep], right[keep]
    if not len(left):
        return
    shared = shapely.intersection(shapely.boundary(array[left]), shapely.boundary(target[right]))
    guides = guides or {}
    for guide in guides.values():
        shapely.prepare(guide)
    for a, b, line in zip(left.tolist(), right.tolist(), shared):
        parts = [part for part in lines_of(line) if part.length > 0]
        if not parts:
            continue
        parts = np.array(parts, dtype=object)
        lengths = shapely.length(parts)
        middle = shapely.line_interpolate_point(parts, .5, normalized=True)
        edge = [float(lengths.sum())]
        for name in ('barrier', 'major', 'street'):
            guide = guides.get(name)
            edge.append(float(lengths[shapely.dwithin(middle, guide, .8)].sum()) if guide is not None else 0.)
        yield a, b, edge, MultiLineString(list(parts))


def merge_buildings_and_slivers(regions, faces, buildings):
    tree = STRtree(faces)
    owner = {i: i for i in regions.area}

    def find(i):
        while owner[i] != i:
            owner[i] = owner[owner[i]]
            i = owner[i]
        return i

    homes = []
    for building in buildings:
        hits = [(faces[int(i)].intersection(building).area, int(i)) for i in tree.query(building, 'intersects')]
        hits = sorted((h for h in hits if h[0] > 0), reverse=True)
        if not hits:
            continue
        homes.append(hits[0][1])
        for area, i in hits[1:]:
            if area <= max(1, .03 * building.area):
                continue
            a, b = find(hits[0][1]), find(i)
            if a != b and b in regions.adjacent[a] and regions.area[a] + regions.area[b] <= MAX_BUILDING_MERGE:
                regions.merge(a, b)
                owner[b] = a
    for i in homes:
        regions.buildings[find(i)] += 1

    # Half-width road strips and slivers join the neighbour they share most non-road border with.
    def is_small(i):
        return regions.area[i] < SMALL_AREA or 2 * regions.area[i] / max(regions.length[i], 1) < SMALL_WIDTH

    def attach_score(edge):
        return edge[0] - edge[3] + .05 * edge[0] - 10 * edge[1]

    queue = [(regions.area[i], i) for i in sorted(regions.area) if is_small(i)]
    heapq.heapify(queue)
    while queue:
        _, i = heapq.heappop(queue)
        if i not in regions.area or not regions.adjacent[i]:
            continue
        target = max(sorted(regions.adjacent[i]), key=lambda j: attach_score(regions.adjacent[i][j]))
        regions.merge(target, i)
        if is_small(target):
            heapq.heappush(queue, (regions.area[target], target))


def barrier_line(named, names):
    lines = [line for name, _junction, line, _highway in named if name in names]
    if not lines:
        return None
    ring = unary_union(lines)
    roundabouts = [line for _name, junction, line, _highway in named if junction == 'roundabout'
                   and line.distance(ring) < 1]
    return unary_union([ring, *roundabouts])


def barrier_sides(geometries, domain, barrier):
    """Index of the land area on each side of a barrier road, for each geometry."""
    pieces = lines_of(linemerge(barrier))
    bridges = []
    for piece in pieces:
        for end in (Point(piece.coords[0]), Point(piece.coords[-1])):
            others = [q for q in pieces if q is not piece]
            if not others:
                continue
            nearest = min(others, key=end.distance)
            if 0 < end.distance(nearest) <= BARRIER_BRIDGE:
                bridges.append(LineString(shapely.shortest_line(end, nearest).coords))
    parts = polygons_of(domain.difference(unary_union([barrier, *bridges]).buffer(BARRIER_WIDTH)))
    sides = sorted((p for p in parts if p.area >= MIN_SIDE_AREA), key=lambda p: -p.area)
    if len(sides) < 2:
        return None
    tree = STRtree(sides)
    result = []
    for geometry in geometries:
        overlap = [(sides[int(j)].intersection(geometry).area, int(j)) for j in tree.query(geometry, 'intersects')]
        result.append(max(overlap)[1] if overlap else int(tree.nearest(geometry)))
    return result


def cell_key(geometry):
    rounded = shapely.set_precision(geometry, .5)
    digest = hashlib.sha1(shapely.to_wkb(shapely.normalize(rounded))).hexdigest()
    return 'c' + digest[:11]


def cell_feature(key, geometry, area_id, block, buildings, coast, side, street):
    point = geometry.representative_point()
    lon, lat = _to_wgs.transform(point.x, point.y)
    return {'type': 'Feature', 'geometry': mapping(to_wgs(geometry)), 'properties': {
        'k': key, 'area': area_id, 'b': block, 'n': buildings, 'a': round(geometry.area), 'c': round(coast),
        's': side, 'st': street, 'x': round(lon, 6), 'y': round(lat, 6),
    }}


def edge_feature(a, b, values, line):
    first, second = sorted((a, b))
    return {'type': 'Feature', 'geometry': mapping(to_wgs(line)), 'properties': {
        'i': f'{first}|{second}', 'a': first, 'b': second, 'l': round(values[0], 1), 'r': round(values[1], 1),
        'm': round(values[2], 1), 't': round(values[3], 1),
    }}


def build_guides(layers, barrier):
    guides = {'major': unary_union(layers['major']) if layers['major'] else None,
              'street': unary_union(layers['street']) if layers['street'] else None}
    if barrier is not None:
        guides['barrier'] = barrier
    return {k: v for k, v in guides.items() if v is not None}


def existing_cells(project, skip=None):
    result = []
    for area in project['areas']:
        if area['id'] == skip:
            continue
        data = read_json(area_dir(area['id']) / 'cells.geojson')
        if data:
            result.append(data['features'])
    return [feature for features in result for feature in features]


def build_area(project, area, log=print):
    """(Re)build one area. Assignments follow cells by key, or by largest overlap when the geometry changed."""
    target_dir = area_dir(area['id'])
    previous = read_json(target_dir / 'cells.geojson', {'features': []})['features']
    osm = fetch_osm(area, log)
    layers, named, places = classify_osm(osm)
    log(f"OSM: {len(layers['buildings'])} bygg, {len(layers['street'])} gater")
    land = land_polygon(area, layers)
    parcels = parcels_metric(fetch_teig(area, land, log))
    # Only nearby cells matter, and rounded coordinates can make a cell slightly invalid, so they are repaired.
    w, s_, e, n = area['bbox']
    other_features = [f for f in existing_cells(project, skip=area['id'])
                      if w - .03 <= f['properties']['x'] <= e + .03 and s_ - .02 <= f['properties']['y'] <= n + .02]
    other_metric = [shapely.make_valid(to_utm(shape(f['geometry']))) for f in other_features]
    existing = unary_union(other_metric) if other_metric else None
    domain = build_domain(area, land, parcels, existing, area.get('seeds'))
    if domain.is_empty:
        raise ValueError('Området inneholder ikke nytt land')
    shapely.prepare(domain)
    buildings = [b for b in layers['buildings'] if domain.intersects(b)]
    log(f'Land: {domain.area / 1e6:.2f} km², {len(parcels)} tomter, {len(buildings)} bygg')

    barrier = barrier_line(named, set(area.get('barrierRoads', []))) if area.get('barrierRoads') else None
    guides = build_guides(layers, barrier)
    faces = build_faces(domain, parcels, layers)
    log(f'Bygger celler av {len(faces)} flater')
    regions = Regions(faces, guides)
    merge_buildings_and_slivers(regions, faces, buildings)
    loose = [i for i in sorted(regions.area) if not regions.adjacent[i]]
    geometries = sorted((unary_union([faces[m] for m in members]) for members in regions.members.values()),
                        key=lambda g: g.bounds)
    geometries = [Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area > 1]) if p.geom_type == 'Polygon'
                  else p for p in geometries]
    log(f'{len(geometries)} celler ({len(loose)} frittliggende)')

    # Apply saved cuts so they survive rebuilds.
    cuts = read_json(target_dir / 'cuts.json', [])
    for cut in cuts:
        geometries = split_geometries(geometries, LineString(cut['exact']), buildings)[0]

    keys = [cell_key(g) for g in geometries]
    tree_buildings = building_counts(geometries, buildings)
    blocks = neighbourhood_blocks(domain, layers, geometries, tree_buildings, guides)
    coast = shapely.length(shapely.intersection(shapely.boundary(np.array(geometries, dtype=object)), domain.boundary))
    sides = barrier_sides(geometries, domain, barrier) if barrier is not None else None
    streets = dominant_streets(geometries, named)
    features = [cell_feature(key, geometry, area['id'], f"{area['id']}:{blocks[i]}", tree_buildings[i], coast[i],
                             f"{area['id']}:{sides[i]}" if sides else None, streets[i])
                for i, (key, geometry) in enumerate(zip(keys, geometries))]

    edges = [edge_feature(keys[a], keys[b], values, line) for a, b, values, line in shared_edges(geometries, guides)]
    if other_metric:
        edges.extend(cross_area_edges(keys, geometries, other_features, other_metric))

    # Carry existing assignments over to changed cells.
    assignments = project['assignments']
    old_assigned = {f['properties']['k']: assignments.get(f['properties']['k']) for f in previous}
    if previous:
        old_geometry = [to_utm(shape(f['geometry'])) for f in previous]
        old_tree = STRtree(old_geometry)
        carried = {}
        for key, geometry in zip(keys, geometries):
            if key in old_assigned:
                carried[key] = old_assigned[key]
                continue
            overlap = [(old_geometry[int(j)].intersection(geometry).area, int(j))
                       for j in old_tree.query(geometry, 'intersects')]
            best = max(overlap) if overlap else (0, 0)
            if best[0] > .5 * geometry.area:
                carried[key] = old_assigned[previous[best[1]]['properties']['k']]
        for key in old_assigned:
            assignments.pop(key, None)
        assignments.update({k: v for k, v in carried.items() if v})

    write_json(target_dir / 'cells.geojson', {'type': 'FeatureCollection', 'features': features})
    write_json(target_dir / 'edges.geojson', {'type': 'FeatureCollection', 'features': edges})
    write_json(target_dir / 'buildings.geojson', {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'geometry': mapping(to_wgs(b)), 'properties': {}} for b in buildings]})
    road_features = []
    for name, lines in (('street', layers['street']), ('minor', layers['minor'])):
        road_features.extend({'type': 'Feature', 'geometry': mapping(to_wgs(line)), 'properties': {'c': name}}
                             for line in lines if domain.intersects(line))
    write_json(target_dir / 'roads.geojson', {'type': 'FeatureCollection', 'features': road_features})
    write_json(target_dir / 'places.json', [
        {'name': p['name'], 'kind': p['kind'], 'x': round(p['point'][0], 1), 'y': round(p['point'][1], 1)}
        for p in places if domain.covers(Point(p['point']))])
    guide_lines = [part for parcel in parcels if parcel.intersects(domain) for part in lines_of(parcel.boundary)]
    guide_lines += [line for line in layers['minor'] + layers['cover'] if domain.intersects(line)]
    (target_dir / 'guides.wkb').write_bytes(shapely.to_wkb(MultiLineString(guide_lines)) if guide_lines else b'')
    write_json(target_dir / 'cuts.json', cuts)

    area['status'] = 'ready'
    area['builtAt'] = time.strftime('%Y-%m-%d %H:%M')
    area['counts'] = {'cells': len(features), 'buildings': sum(tree_buildings), 'parcels': len(parcels),
                      'km2': round(domain.area / 1e6, 2), 'blocks': len(set(blocks))}
    area['sources'] = {'osm': osm.get('retrievedAt') or '', 'teig': 'Kartverket, Matrikkelen Eiendomskart Teig'}
    area['bounds'] = [round(v, 6) for v in to_wgs(domain).bounds]
    log(f"Klar: {len(features)} celler, {sum(tree_buildings)} bygg")
    return features, edges


def cross_area_edges(keys, geometries, other_features, other_metric):
    """Areas are separated by a hairline, so neighbours across a seam are matched with a small tolerance."""
    tree = STRtree(other_metric)
    result = []
    for key, geometry in zip(keys, geometries):
        for j in tree.query(geometry, 'dwithin', distance=SEAM_TOLERANCE):
            other = other_metric[int(j)]
            shared = geometry.boundary.intersection(other.buffer(SEAM_TOLERANCE))
            if shared.length > 1:
                other_key = other_features[int(j)]['properties']['k']
                result.append(edge_feature(key, other_key, [shared.length, 0., 0., 0.],
                                           MultiLineString(lines_of(shared))))
    return result


def street_blocks(domain, layers, geometries):
    lines = lines_of(domain.boundary)
    lines.extend(part for line in layers['street'] if domain.intersects(line)
                 for part in lines_of(line.intersection(domain)))
    faces = list(polygonize(unary_union(lines)))
    tree = STRtree(faces)
    result = []
    next_free = len(faces)
    for geometry in geometries:
        hits = tree.query(geometry.representative_point(), 'within')
        if len(hits):
            result.append(int(hits[0]))
        else:
            result.append(next_free)
            next_free += 1
    return result


def neighbourhood_blocks(domain, layers, geometries, counts, guides):
    """Click-sized groups of cells. Cul-de-sacs leave street faces too large, so they are subdivided."""
    faces = street_blocks(domain, layers, geometries)
    regions = Regions()
    for i, geometry in enumerate(geometries):
        regions.area[i] = geometry.area
        regions.length[i] = geometry.length
        regions.buildings[i] = counts[i]
        regions.members[i] = [i]
    for a, b, edge, _line in shared_edges(geometries, guides):
        regions.adjacent[a][b] = edge
        regions.adjacent[b][a] = edge
    total = sum(regions.mass(i) for i in regions.area)
    agglomerate(regions, max(1, round(total / BLOCK_MASS)), BLOCK_MASS, 4, sides=dict(enumerate(faces)))
    result = [0] * len(geometries)
    for number, members in enumerate(sorted(regions.members.values(), key=min)):
        for member in members:
            result[member] = number
    return result


def building_counts(geometries, buildings):
    counts = [0] * len(geometries)
    if not geometries:
        return counts
    tree = STRtree(geometries)
    for building in buildings:
        hits = [(geometries[int(i)].intersection(building).area, int(i)) for i in tree.query(building, 'intersects')]
        hits = [h for h in hits if h[0] > 0]
        if hits:
            counts[max(hits)[1]] += 1
    return counts


def dominant_streets(geometries, named):
    tree = STRtree(geometries)
    scores = defaultdict(Counter)
    for name, junction, line, highway in named:
        if junction == 'tunnel' or highway not in STREET:
            continue
        for i in tree.query(line, 'dwithin', distance=3):
            scores[int(i)][name] += 1
    return [scores[i].most_common(1)[0][0] if scores[i] else None for i in range(len(geometries))]


# ---------------------------------------------------------------- zone proposal

def agglomerate(regions, count, target, barrier_weight, sides=None, absorb_tiny=False):
    """Greedy, deterministic merging: weak and long shared borders first, oversized results last."""

    def blocked(a, b):
        return sides is not None and sides.get(a) != sides.get(b)

    def cost(a, b):
        length, barrier, major, street = regions.adjacent[a][b]
        strength = (barrier * barrier_weight + (major - min(major, barrier)) * 4
                    + (street - min(street, major)) * 1.3 + (length - street) * .3) / max(length, .1)
        fill = (regions.mass(a) + regions.mass(b)) / target
        boundary_a = sum(e[0] for e in regions.adjacent[a].values())
        boundary_b = sum(e[0] for e in regions.adjacent[b].values())
        contact = length / max(min(boundary_a, boundary_b), 1)
        inland = boundary_a + boundary_b - 2 * length
        shape_index = inland * inland / max(4 * math.pi * (regions.area[a] + regions.area[b]), 1)
        result = strength * (1 + fill * fill * 2) + fill ** 4 * 4 - contact * 1.2 + SHAPE_WEIGHT * shape_index
        if absorb_tiny:
            smallest = min(regions.mass(a), regions.mass(b)) / target
            if smallest < TINY_ZONE:
                result -= 100 * (TINY_ZONE - smallest)
        return result

    version = dict.fromkeys(regions.area, 0)
    heap = [(cost(a, b), a, b, 0, 0) for a in sorted(regions.adjacent) for b in regions.adjacent[a]
            if a < b and not blocked(a, b)]
    heapq.heapify(heap)
    while len(regions.area) > count and heap:
        _, a, b, version_a, version_b = heapq.heappop(heap)
        if a not in regions.area or b not in regions.area:
            continue
        if version[a] != version_a or version[b] != version_b or b not in regions.adjacent[a]:
            continue
        regions.merge(a, b)
        version[a] += 1
        for other in sorted(regions.adjacent[a]):
            first, second = sorted((a, other))
            if not blocked(first, second):
                heapq.heappush(heap, (cost(first, second), first, second, version[first], version[second]))


def regions_from(features, edges):
    regions = Regions()
    for feature in features:
        p = feature['properties']
        key = p['k']
        regions.area[key] = float(p['a'])
        regions.length[key] = 0.
        regions.buildings[key] = p['n']
        regions.members[key] = [key]
    for edge in edges:
        p = edge['properties']
        if p['a'] in regions.area and p['b'] in regions.area:
            values = [p['l'], p.get('r', 0), p.get('m', 0), p.get('t', 0)]
            regions.adjacent[p['a']][p['b']] = values
            regions.adjacent[p['b']][p['a']] = values
    return regions


def group_detached(regions):
    """Cells without land neighbours join the nearest region by representative point."""
    return [key for key in sorted(regions.area) if not regions.adjacent[key]]


def zone_name(members, cells, places_by_cell, used):
    weight = Counter()
    for key in members:
        cell = cells[key]
        if cell.get('st'):
            weight[cell['st']] += max(1, cell['n'])
    candidates = [name for key in members for name in places_by_cell.get(key, [])]
    base = candidates[0] if candidates else (weight.most_common(1)[0][0] if weight else 'Nytt område')
    name, number = base, 2
    while name in used:
        name, number = f'{base} {number}', number + 1
    used.add(name)
    return name


def places_by_cell(area_ids, features):
    geometries = [to_utm(shape(f['geometry'])) for f in features]
    if not geometries:
        return {}
    tree = STRtree(geometries)
    keys = [f['properties']['k'] for f in features]
    result = defaultdict(list)
    for area_id in area_ids:
        for place in read_json(area_dir(area_id) / 'places.json', []):
            hits = tree.query(Point(place['x'], place['y']), 'within')
            if len(hits):
                result[keys[int(hits[0])]].append(place['name'])
    return result


def attach_detached(regions, features):
    loose = group_detached(regions)
    if not loose:
        return
    by_key = {f['properties']['k']: f for f in features}
    connected = [k for k in sorted(regions.area) if regions.adjacent[k]]
    if not connected:
        return
    points = [Point(by_key[k]['properties']['x'], by_key[k]['properties']['y']) for k in connected]
    tree = STRtree(points)
    for key in loose:
        p = by_key[key]['properties']
        target = connected[int(tree.nearest(Point(p['x'], p['y'])))]
        regions.area[target] += regions.area.pop(key)
        regions.buildings[target] += regions.buildings.pop(key)
        regions.length.pop(key, None)
        regions.members[target] += regions.members.pop(key)
        regions.adjacent.pop(key, None)


def propose_l3(project, features, edges, count, parent_id, area_ids):
    """Group cells into `count` new L3 zones under parent_id and write the assignment."""
    regions = regions_from(features, edges)
    attach_detached(regions, features)
    total = sum(regions.mass(i) for i in regions.area)
    target = total / max(count, 1)
    sides = {f['properties']['k']: f['properties'].get('s') for f in features}
    if not any(sides.values()):
        sides = None
    agglomerate(regions, count * 2, target, 4, sides=sides)
    agglomerate(regions, count, target, 4, sides=sides, absorb_tiny=True)
    cells = {f['properties']['k']: f['properties'] for f in features}
    named = places_by_cell(area_ids, features)
    used = {z['name'] for z in project['zones']}
    created = []
    for members in sorted(regions.members.values(), key=lambda m: -sum(cells[k]['n'] for k in m)):
        zone = {'id': new_zone_id(project, 3), 'name': zone_name(members, cells, named, used), 'level': 3,
                'parentId': parent_id, 'locked': False}
        project['zones'].append(zone)
        created.append(zone)
        for key in members:
            project['assignments'][key] = zone['id']
    return created


def propose_area(project, area, features, edges, parent_l1, l3_count=None, l2_count=None):
    """First proposal for a new area: L3 zones grouped into L2 zones."""
    settings = project['settings']
    mass = sum(f['properties']['n'] + f['properties']['a'] / MASS_AREA for f in features)
    count = l3_count or max(1, round(mass / settings['targetBuildings']))
    l2s = l2_count or max(1, round(count / settings['l3PerL2']))
    placeholder = {'id': new_zone_id(project, 2), 'name': area['name'], 'level': 2, 'parentId': parent_l1, 'locked': False}
    project['zones'].append(placeholder)
    created = propose_l3(project, features, edges, count, placeholder['id'], [area['id']])
    if l2s > 1:
        group_l3_into_l2(project, created, features, edges, l2s, parent_l1, placeholder, area)
    return created


def group_l3_into_l2(project, l3_zones, features, edges, count, parent_l1, placeholder, area):
    cells = {f['properties']['k']: f['properties'] for f in features}
    assign = project['assignments']
    l3_ids = {z['id'] for z in l3_zones}
    regions = Regions()
    for zone_id in l3_ids:
        regions.area[zone_id] = 0.
        regions.length[zone_id] = 0.
        regions.buildings[zone_id] = 0
        regions.members[zone_id] = [zone_id]
    for key, p in cells.items():
        zone_id = assign.get(key)
        if zone_id in l3_ids:
            regions.area[zone_id] += p['a']
            regions.buildings[zone_id] += p['n']
    for edge in edges:
        p = edge['properties']
        a, b = assign.get(p['a']), assign.get(p['b'])
        if a in l3_ids and b in l3_ids and a != b:
            values = regions.adjacent[a].get(b, [0., 0., 0., 0.])
            combined = [x + y for x, y in zip(values, [p['l'], p.get('r', 0), p.get('m', 0), p.get('t', 0)])]
            regions.adjacent[a][b] = combined
            regions.adjacent[b][a] = combined
    total = sum(regions.mass(i) for i in regions.area)
    agglomerate(regions, count, total / count, 6)
    project['zones'].remove(placeholder)
    used = {z['name'] for z in project['zones']}
    for index, members in enumerate(sorted(regions.members.values(), key=lambda m: -len(m)), 1):
        base = max((z for z in l3_zones if z['id'] in members), key=lambda z: sum(
            1 for k, p in cells.items() if assign.get(k) == z['id']))['name']
        name, number = f'{base}-området', 2
        while name in used:
            name, number = f'{base}-området {number}', number + 1
        used.add(name)
        l2 = {'id': new_zone_id(project, 2), 'name': name, 'level': 2, 'parentId': parent_l1, 'locked': False}
        project['zones'].append(l2)
        for zone in l3_zones:
            if zone['id'] in members:
                zone['parentId'] = l2['id']


def import_world_zones(project, area_id, world_path, zone_ids=None):
    """Assign cells to L3 zones of an existing WorldDefinition by representative point."""
    world = read_json(world_path)
    features = read_json(area_dir(area_id) / 'cells.geojson')['features']
    zones = {z['id']: z for z in world['zones']}
    level3 = [z for z in world['zones'] if z['level'] == 3 and (not zone_ids or z['id'] in zone_ids)]
    shapes = [shape(z['geometry']).buffer(0) for z in level3]
    tree = STRtree(shapes)
    known = {z['id'] for z in project['zones']}
    assigned = Counter()
    for feature in features:
        p = feature['properties']
        hits = tree.query(Point(p['x'], p['y']), 'within')
        if len(hits):
            zone = level3[int(hits[0])]
            project['assignments'][p['k']] = zone['id']
            assigned[zone['id']] += 1
    for zone_id in assigned:
        chain = [zones[zone_id]]
        while chain[-1].get('parentId'):
            chain.append(zones[chain[-1]['parentId']])
        for zone in chain:
            if zone['id'] not in known:
                project['zones'].append({'id': zone['id'], 'name': zone['name'], 'level': zone['level'],
                                         'parentId': zone.get('parentId'), 'locked': False})
                known.add(zone['id'])
    return dict(assigned)


# ---------------------------------------------------------------- smart cut

def split_geometries(geometries, line, buildings):
    """Split every cell the line fully crosses. Returns new list and (removed, added) indices."""
    result, removed, added = [], [], []
    for geometry in geometries:
        pieces = split_one(geometry, line) if geometry.intersects(line) else None
        if pieces and len(pieces) > 1:
            removed.append(geometry)
            added.extend(pieces)
            result.extend(pieces)
        else:
            result.append(geometry)
    return result, removed, added


def split_one(geometry, line):
    inside = line.intersection(geometry)
    if inside.length < 1:
        return None
    # Noded with the line running past the border: clipped ends do not land exactly on it.
    network = unary_union([geometry.boundary, *lines_of(line.intersection(geometry.buffer(5)))])
    faces = [f for f in polygonize(network) if geometry.covers(f.representative_point())]
    if len(faces) < 2:
        return None
    faces.sort(key=lambda f: -f.area)
    kept = [f for f in faces if f.area >= SMALL_AREA]
    if not kept:
        return None
    for small in (f for f in faces if f.area < SMALL_AREA):
        best = max(range(len(kept)), key=lambda i: kept[i].boundary.intersection(small.boundary).length)
        kept[best] = kept[best].union(small)
    return kept if len(kept) > 1 else None


class AreaIndex:
    """Metric cells, buildings and guide lines for routing and cutting in one area."""

    def __init__(self, area_id):
        self.area_id = area_id
        folder = area_dir(area_id)
        self.features = read_json(folder / 'cells.geojson')['features']
        self.geometry = [to_utm(shape(f['geometry'])) for f in self.features]
        self.tree = STRtree(self.geometry)
        self.buildings = [to_utm(shape(f['geometry'])) for f in read_json(folder / 'buildings.geojson')['features']]
        self.building_tree = STRtree(self.buildings) if self.buildings else None
        roads = read_json(folder / 'roads.geojson')['features']
        self.roads = [to_utm(shape(f['geometry'])) for f in roads]
        self.road_tree = STRtree(self.roads) if self.roads else None
        data = (folder / 'guides.wkb').read_bytes() if (folder / 'guides.wkb').exists() else b''
        self.guides = lines_of(shapely.from_wkb(data)) if data else []
        self.guide_tree = STRtree(self.guides) if self.guides else None


def rasterize_lines(grid, trees, frame, x0, y0, res, value):
    for tree, lines in trees:
        if tree is None:
            continue
        for i in tree.query(frame, 'intersects'):
            clipped = shapely.clip_by_rect(lines[int(i)], *frame.bounds)
            for part in lines_of(clipped):
                coords = shapely.get_coordinates(shapely.segmentize(part, res / 2))
                cols = ((coords[:, 0] - x0) / res).astype(int)
                rows = ((coords[:, 1] - y0) / res).astype(int)
                valid = (rows >= 0) & (rows < grid.shape[0]) & (cols >= 0) & (cols < grid.shape[1])
                grid[rows[valid], cols[valid]] = np.minimum(grid[rows[valid], cols[valid]], value)


def route_leg(indexes, a, b):
    """Cheapest line from a to b: along roads and parcel lines, over open land, never through a building."""
    margin = max(80, .35 * math.hypot(b[0] - a[0], b[1] - a[1]))
    xmin, ymin = min(a[0], b[0]) - margin, min(a[1], b[1]) - margin
    xmax, ymax = max(a[0], b[0]) + margin, max(a[1], b[1]) + margin
    res = max(ROUTE_MIN_RES, math.sqrt((xmax - xmin) * (ymax - ymin) / ROUTE_MAX_NODES))
    cols, rows = int((xmax - xmin) / res) + 1, int((ymax - ymin) / res) + 1
    frame = box(xmin, ymin, xmax, ymax)
    grid = np.full((rows, cols), 1.2, dtype=np.float32)
    xs = xmin + (np.arange(cols) + .5) * res
    ys = ymin + (np.arange(rows) + .5) * res

    def window(geometry):
        x0, y0, x1, y1 = geometry.bounds
        c0, c1 = max(0, int((x0 - xmin) / res)), min(cols, int((x1 - xmin) / res) + 2)
        r0, r1 = max(0, int((y0 - ymin) / res)), min(rows, int((y1 - ymin) / res) + 2)
        if c0 >= c1 or r0 >= r1:
            return None
        gx, gy = np.meshgrid(xs[c0:c1], ys[r0:r1])
        return r0, r1, c0, c1, shapely.contains_xy(geometry, gx, gy)

    for index in indexes:
        for i in index.tree.query(frame, 'intersects'):
            feature = index.features[int(i)]['properties']
            if feature['n'] > 0 and feature['a'] < 5000:
                hit = window(index.geometry[int(i)])
                if hit:
                    r0, r1, c0, c1, mask = hit
                    grid[r0:r1, c0:c1][mask] = 3.5
    for index in indexes:
        rasterize_lines(grid, [(index.guide_tree, index.guides)], frame, xmin, ymin, res, .6)
        rasterize_lines(grid, [(index.road_tree, index.roads)], frame, xmin, ymin, res, .4)
    # An existing cell border is already a cut. Following it would leave the cell the owner wants to split whole.
    for index in indexes:
        for i in index.tree.query(frame, 'intersects'):
            clipped = shapely.clip_by_rect(index.geometry[int(i)].boundary, *frame.bounds)
            for part in lines_of(clipped):
                coords = shapely.get_coordinates(shapely.segmentize(part, res / 2))
                c = ((coords[:, 0] - xmin) / res).astype(int)
                r = ((coords[:, 1] - ymin) / res).astype(int)
                valid = (r >= 0) & (r < rows) & (c >= 0) & (c < cols)
                grid[r[valid], c[valid]] = 2.5
    blocked = np.zeros((rows, cols), dtype=bool)
    for index in indexes:
        if index.building_tree is None:
            continue
        for i in index.building_tree.query(frame, 'intersects'):
            hit = window(index.buildings[int(i)].buffer(1.5))
            if hit:
                r0, r1, c0, c1, mask = hit
                blocked[r0:r1, c0:c1] |= mask

    start = (int((a[1] - ymin) / res), int((a[0] - xmin) / res))
    goal = (int((b[1] - ymin) / res), int((b[0] - xmin) / res))
    blocked[start] = False
    blocked[goal] = False
    costs = grid.tolist()
    closed = blocked.tolist()
    best = {start: 0.}
    previous = {}
    heap = [(0., start)]
    steps = [(-1, -1, 1.414), (-1, 0, 1), (-1, 1, 1.414), (0, -1, 1), (0, 1, 1), (1, -1, 1.414), (1, 0, 1), (1, 1, 1.414)]
    while heap:
        cost, node = heapq.heappop(heap)
        if node == goal:
            break
        if cost > best[node]:
            continue
        r, c = node
        here = costs[r][c]
        for dr, dc, length in steps:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and not closed[nr][nc]:
                total = cost + length * (here + costs[nr][nc]) / 2
                if total < best.get((nr, nc), math.inf):
                    best[(nr, nc)] = total
                    previous[(nr, nc)] = node
                    heapq.heappush(heap, (total, (nr, nc)))
    if goal not in best:
        raise ValueError('Fant ingen vei rundt byggene her. Prøv et annet punkt.')
    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    path.reverse()
    points = [a] + [(xs[c], ys[r]) for r, c in path[1:-1]] + [b]
    line = LineString(points)
    simple = line.simplify(res * 1.2)
    return simple if not any(index.building_tree is not None and any(
        simple.intersects(index.buildings[int(i)]) for i in index.building_tree.query(simple, 'intersects'))
        for index in indexes) else line


def snap_to_cell_edge(indexes, point):
    target = Point(point)
    best, distance = None, SNAP_TO_EDGE
    for index in indexes:
        for i in index.tree.query(target, 'dwithin', distance=SNAP_TO_EDGE):
            boundary = index.geometry[int(i)].boundary
            current = boundary.distance(target)
            if current < distance:
                distance = current
                best = boundary.interpolate(boundary.project(target))
    return (best.x, best.y) if best is not None else point


def extend_ends(line):
    coords = list(line.coords)

    def extended(p, q):
        dx, dy = p[0] - q[0], p[1] - q[1]
        length = math.hypot(dx, dy) or 1
        return p[0] + dx / length * 1.5, p[1] + dy / length * 1.5

    return LineString([extended(coords[0], coords[1]), *coords, extended(coords[-1], coords[-2])])


def route(indexes, points):
    """Route through clicked lon/lat points. The first and last snap to the nearest cell edge."""
    metric = [_to_utm.transform(*p) for p in points]
    metric[0] = snap_to_cell_edge(indexes, metric[0])
    metric[-1] = snap_to_cell_edge(indexes, metric[-1])
    coords = []
    for a, b in zip(metric, metric[1:]):
        leg = list(route_leg(indexes, a, b).coords)
        coords.extend(leg if not coords else leg[1:])
    line = LineString(coords)
    return extend_ends(line)


def preview_cut(indexes, line):
    splits, pieces = 0, []
    for index in indexes:
        for i in index.tree.query(line, 'intersects'):
            parts = split_one(index.geometry[int(i)], line)
            if parts:
                splits += 1
                pieces.extend(round(p.area) for p in parts)
    return splits, pieces


def apply_cut(project, index, line, cut_id):
    """Split cells in one area, update its files and pass assignments on to the pieces."""
    folder = area_dir(index.area_id)
    assign = project['assignments']
    edges = read_json(folder / 'edges.geojson')['features']
    removed, added = [], []
    new_features = []
    for i, feature in enumerate(index.features):
        geometry = index.geometry[i]
        parts = split_one(geometry, line) if geometry.intersects(line) else None
        if not parts:
            new_features.append(feature)
            continue
        removed.append(feature)
        p = feature['properties']
        counts = building_counts(parts, index.buildings)
        for part, count in zip(parts, counts):
            key = cell_key(part)
            coast_part = part.boundary.intersection(geometry.boundary).length if p['c'] else 0
            piece = cell_feature(key, part, p['area'], p['b'], count, min(coast_part, p['c']), p['s'], p['st'])
            added.append(piece)
            new_features.append(piece)
            if assign.get(p['k']):
                assign[key] = assign[p['k']]
    if not removed:
        raise ValueError('Linja deler ingen celle. Den må gå fra kant til kant.')
    removed_keys = {f['properties']['k'] for f in removed}
    removed_edges = [e for e in edges if e['properties']['a'] in removed_keys or e['properties']['b'] in removed_keys]
    kept_edges = [e for e in edges if e['properties']['a'] not in removed_keys and e['properties']['b'] not in removed_keys]
    neighbours = {e['properties']['a'] for e in removed_edges} | {e['properties']['b'] for e in removed_edges}
    neighbour_features = [f for f in new_features if f['properties']['k'] in neighbours - removed_keys]
    for key in removed_keys:
        assign.pop(key, None)
    added_geometry = [to_utm(shape(f['geometry'])) for f in added]
    added_keys = [f['properties']['k'] for f in added]
    added_edges = [edge_feature(added_keys[a], added_keys[b], values, part_line)
                   for a, b, values, part_line in shared_edges(added_geometry, {})]
    if neighbour_features:
        metric = [to_utm(shape(f['geometry'])) for f in neighbour_features]
        names = [f['properties']['k'] for f in neighbour_features]
        added_edges.extend(edge_feature(added_keys[a], names[b], values, part_line)
                           for a, b, values, part_line in shared_edges(added_geometry, {}, others=metric))
    write_json(folder / 'cells.geojson', {'type': 'FeatureCollection', 'features': new_features})
    write_json(folder / 'edges.geojson', {'type': 'FeatureCollection', 'features': kept_edges + added_edges})
    cuts = read_json(folder / 'cuts.json', [])
    record = {'id': cut_id, 'exact': list(map(list, line.coords)), 'removed': removed, 'removedEdges': removed_edges,
              'addedKeys': added_keys, 'addedEdges': [e['properties']['i'] for e in added_edges],
              'removedAssign': {}}
    cuts.append(record)
    write_json(folder / 'cuts.json', cuts)
    return {'id': cut_id, 'area': index.area_id, 'removed': sorted(removed_keys), 'added': added,
            'edgesRemoved': [e['properties']['i'] for e in removed_edges], 'edgesAdded': added_edges}


def undo_cut(project, area_id, cut_id):
    folder = area_dir(area_id)
    cuts = read_json(folder / 'cuts.json', [])
    if not cuts or cuts[-1]['id'] != cut_id:
        raise ValueError('Kutt kan bare angres i motsatt rekkefølge')
    record = cuts.pop()
    added = set(record['addedKeys'])
    assign = project['assignments']
    features = read_json(folder / 'cells.geojson')['features']
    kept = [f for f in features if f['properties']['k'] not in added]
    # Each restored cell takes the zone most of its former pieces now have.
    pieces = {f['properties']['k']: f for f in features if f['properties']['k'] in added}
    piece_geometry = [(k, to_utm(shape(f['geometry']))) for k, f in pieces.items()]
    for original in record['removed']:
        geometry = to_utm(shape(original['geometry']))
        votes = Counter()
        for key, part in piece_geometry:
            if assign.get(key) and part.intersection(geometry).area > .5 * part.area:
                votes[assign[key]] += part.area
        if votes:
            assign[original['properties']['k']] = votes.most_common(1)[0][0]
    for key in added:
        assign.pop(key, None)
    kept.extend(record['removed'])
    edges = read_json(folder / 'edges.geojson')['features']
    removed_edge_ids = set(record['addedEdges'])
    kept_edges = [e for e in edges if e['properties']['i'] not in removed_edge_ids] + record['removedEdges']
    write_json(folder / 'cells.geojson', {'type': 'FeatureCollection', 'features': kept})
    write_json(folder / 'edges.geojson', {'type': 'FeatureCollection', 'features': kept_edges})
    write_json(folder / 'cuts.json', cuts)
    return {'area': area_id, 'removed': sorted(added), 'added': record['removed'],
            'edgesRemoved': record['addedEdges'], 'edgesAdded': record['removedEdges']}


# ---------------------------------------------------------------- export

def export_world(project, output=None):
    """Write a draft WorldDefinition: the base world with modelled zones replaced. Never touches published data."""
    import zonecontent  # imports this module, so it is loaded late
    zonecontent.refresh_measures(project)
    base_path = ROOT / project['settings']['baseWorld']
    world = read_json(base_path)
    features = [f for area in project['areas'] for f in
                read_json(area_dir(area['id']) / 'cells.geojson', {'features': []})['features']]
    assign = project['assignments']
    zones = {z['id']: z for z in project['zones']}
    geometry_by_l3 = defaultdict(list)
    missing = 0
    for feature in features:
        zone_id = assign.get(feature['properties']['k'])
        if zone_id in zones:
            geometry_by_l3[zone_id].append(shapely.make_valid(shape(feature['geometry'])))
        else:
            missing += 1

    def clean(geometries):
        merged = unary_union(geometries)
        return unary_union([Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area > 1e-9])
                            for p in polygons_of(merged)])

    l3 = {k: clean(v) for k, v in geometry_by_l3.items()}
    modelled = unary_union(list(l3.values())) if l3 else None
    prepared = modelled
    shapely.prepare(prepared)
    project_zone_ids = set(zones)
    old_l3 = [z for z in world['zones'] if z['level'] == 3]
    replaced = {z['id'] for z in old_l3 if z['id'] in project_zone_ids or (
        prepared.contains(shape(z['geometry']).representative_point()))}
    kept_l3 = [z for z in old_l3 if z['id'] not in replaced]

    def zone_record(zone, geometry):
        record = {'id': zone['id'], 'name': zone['name'], 'level': zone['level'], 'playable': True,
                  'geometry': mapping(geometry), 'rationale': zone.get('notes') or 'Bygd av celler i soneeditoren',
                  'sourceIds': ['osm', 'matrikkel-teig']}
        if zone.get('parentId'):
            record['parentId'] = zone['parentId']
        if zone.get('type'):
            record['primaryType'] = zone['type']
        if any(zone.get('potential', {}).values()):
            record['potential'] = {k: v for k, v in zone['potential'].items() if v}
        for field in ('resources', 'finds', 'produces', 'measures'):
            if zone.get(field):
                record[field] = zone[field]
        return record

    result = [zone_record(zones[k], v) for k, v in l3.items()]
    old_by_id = {z['id']: z for z in world['zones']}
    parents = defaultdict(list)
    for zone_id, geometry in l3.items():
        parents[zones[zone_id].get('parentId')].append(geometry)
    for zone in kept_l3:
        # Hand-drawn base zones may reach a little into land the editor now covers.
        geometry = shape(zone['geometry']).buffer(0)
        if geometry.intersects(modelled):
            geometry = clean([geometry.difference(modelled)])
            if geometry.is_empty or geometry.area < 1e-9:
                continue
            geometry = shapely.set_precision(geometry, 1e-7)
            zone = {**zone, 'geometry': mapping(geometry)}
        result.append(zone)
        parents[zone.get('parentId')].append(shape(zone['geometry']))
    l2_ids = [k for k in parents if k]
    grand = defaultdict(list)
    for l2_id in l2_ids:
        source = zones.get(l2_id) or old_by_id.get(l2_id)
        geometry = clean(parents[l2_id])
        result.append(zone_record(source, geometry))
        grand[source.get('parentId')].append(geometry)
    for l1_id, geometries in grand.items():
        source = zones.get(l1_id) or old_by_id.get(l1_id)
        result.append(zone_record(source, clean(geometries)))

    l3_final = [(z, shape(z['geometry'])) for z in result if z['level'] == 3]
    tree = STRtree([g for _, g in l3_final])

    def zone_at(position):
        point = Point(position)
        hits = tree.query(point, 'intersects')
        return l3_final[int(hits[0])][0]['id'] if len(hits) else None

    known = {z['id'] for z in result}
    dropped_pois, pois = [], []
    # Places in modelled areas come from the editor; base places elsewhere are kept as they are.
    source_pois = [p for p in world['pois'] if not prepared.contains(Point(p['geometry']['coordinates']))]
    source_pois += [poi_record(p) for p in project.get('pois', [])]
    for poi in source_pois:
        cell = zone_at(poi['geometry']['coordinates'])
        if cell:
            pois.append({**poi, 'cellId': cell})
        else:
            dropped_pois.append(poi['id'])
    poi_cell = {poi['id']: poi['cellId'] for poi in pois}
    edges, dropped_edges = [], []
    for edge in world['edges']:
        coords = [list(p) for p in edge['geometry']['coordinates']]
        start, end = zone_at(coords[0]), zone_at(coords[-1])
        if not start:
            start, coords[0] = nearest_inside(l3_final, coords[0])
        if not end:
            end, coords[-1] = nearest_inside(l3_final, coords[-1])
        if not start or not end or start == end:
            dropped_edges.append(edge['id'])
            continue
        record = {**edge, 'fromCellId': start, 'toCellId': end, 'geometry': {'type': 'LineString', 'coordinates': coords}}
        if 'viaPoiIds' in record:
            record['viaPoiIds'] = [p for p in record['viaPoiIds'] if poi_cell.get(p) in (start, end)]
        edges.append(record)
    # Named bridges and tunnels are strategic links: each becomes its own edge through its place.
    for poi in project.get('pois', []):
        if poi.get('facilityType') not in ('bridge', 'tunnel') or len(poi.get('ends') or []) != 2:
            continue
        coords = [list(p) for p in poi['ends']]
        ends = []
        for i in (0, 1):
            zone_id = zone_at(coords[i])
            if not zone_id:
                zone_id, coords[i] = nearest_inside(l3_final, coords[i], limit=.01)
            ends.append(zone_id)
        if ends[0] and ends[1] and ends[0] != ends[1] and poi['id'] in poi_cell:
            edges.append({'id': f"edge-{poi['id']}", 'name': poi['name'], 'fromCellId': ends[0], 'toCellId': ends[1],
                          'kind': poi['facilityType'], 'modes': ['walk', 'cycle', 'vehicle'], 'status': 'active',
                          'geometry': {'type': 'LineString', 'coordinates': coords}, 'sourceIds': ['osm'],
                          'viaPoiIds': [poi['id']], 'rationale': 'Bru eller tunnel fra OpenStreetMap'})
    road_edges = road_connections(project, l3_final, tree, {frozenset((e['fromCellId'], e['toCellId'])) for e in edges})
    edges.extend(road_edges)
    frontiers = [f for f in world.get('frontiers', []) if f['cellId'] in known]
    stamp = time.strftime('%Y%m%d-%H%M%S')
    exported = {**world, 'worldVersion': f'zone-editor-{stamp}', 'status': 'draft', 'zones': result,
                'pois': pois, 'edges': edges, 'frontiers': frontiers}
    sources = {s['id']: s for s in exported['sources']}
    sources.setdefault('matrikkel-teig', {
        'id': 'matrikkel-teig', 'name': 'Kartverket, Matrikkelen Eiendomskart Teig', 'url': TEIG_WFS,
        'license': 'CC-BY-4.0', 'retrievedAt': time.strftime('%Y-%m-%d'),
        'note': 'Tomtegrenser brukt som geografisk grunnlag. Sier ingenting om eierskap eller tilgang.'})
    exported['sources'] = list(sources.values())
    path = Path(output) if output else ROOT / f'dist/stavanger-z-world-soneeditor-{stamp}.json'
    write_json(path, exported)
    return {'path': str(path), 'zones': Counter(z['level'] for z in result), 'unassignedCells': missing,
            'droppedPois': dropped_pois, 'droppedEdges': dropped_edges, 'addedRoadEdges': len(road_edges),
            'edges': len(edges), 'replacedBaseZones': sorted(replaced)}


GAME_VALIDATOR_LIMIT = 150000  # zone vertices; above this the game's own O(n²) checks take many minutes.


def check_world(world):
    """Fast geometric checks of an export, mirroring the game's validator, for worlds too large for it."""
    issues = []
    zones = {z['id']: z for z in world['zones']}
    shapes = {}
    for zone in world['zones']:
        geometry = shape(zone['geometry'])
        if geometry.is_empty or not geometry.is_valid:
            issues.append(f"{zone['id']}: ugyldig geometri ({shapely.is_valid_reason(geometry)})")
        shapes[zone['id']] = to_utm(geometry.buffer(0))
        parent = zones.get(zone.get('parentId'))
        if zone['level'] != 1 and (not parent or parent['level'] != zone['level'] - 1):
            issues.append(f"{zone['id']}: mangler overordnet sone ett nivå opp")
    by_parent = defaultdict(list)
    for zone in world['zones']:
        by_parent[(zone['level'], zone.get('parentId'))].append(zone['id'])
        parent = zone.get('parentId')
        if parent in shapes:
            outside = shapes[zone['id']].difference(shapes[parent].buffer(.05)).area
            if outside > .5:
                issues.append(f"{zone['id']}: {outside:.0f} m² utenfor {parent}")
    for ids in by_parent.values():
        tree = STRtree([shapes[i] for i in ids])
        for a, b in zip(*tree.query([shapes[i] for i in ids], predicate='intersects')):
            if a < b:
                overlap = shapes[ids[a]].intersection(shapes[ids[b]]).area
                if overlap > .5:
                    issues.append(f"{ids[a]}: overlapper {ids[b]} med {overlap:.0f} m²")
    for poi in world['pois']:
        cell = shapes.get(poi['cellId'])
        if cell is None or not cell.buffer(.05).contains(to_utm(Point(poi['geometry']['coordinates']))):
            issues.append(f"{poi['id']}: ligger ikke i sonen sin")
    for edge in world['edges']:
        coords = edge['geometry']['coordinates']
        for end, zone_id in ((coords[0], edge['fromCellId']), (coords[-1], edge['toCellId'])):
            cell = shapes.get(zone_id)
            if cell is None or not cell.buffer(.05).contains(to_utm(Point(end))):
                issues.append(f"{edge['id']}: endepunkt utenfor {zone_id}")
    return issues


def zone_vertices(world):
    return sum(len(shapely.get_coordinates(shape(z['geometry']))) for z in world['zones'])


def poi_record(poi):
    record = {'id': poi['id'], 'name': poi['name'], 'cellId': '', 'kind': poi.get('kind') or 'other',
              'geometry': {'type': 'Point', 'coordinates': [poi['lon'], poi['lat']]},
              'hqCandidate': poi.get('role') == 'hq', 'sourceIds': poi.get('sourceIds') or ['curation']}
    for field in ('role', 'hqProfile', 'hqType', 'facilityType', 'siteType', 'resources', 'notes', 'lengthM'):
        if poi.get(field):
            record[field] = poi[field]
    return record


def import_world_pois(project, world_path):
    """Copy the base world's places inside modelled areas into the project, keeping their ids."""
    world = read_json(world_path)
    cells = [shape(f['geometry']) for area in project['areas']
             for f in read_json(area_dir(area['id']) / 'cells.geojson')['features']]
    keys = [f['properties']['k'] for area in project['areas']
            for f in read_json(area_dir(area['id']) / 'cells.geojson')['features']]
    tree = STRtree(cells)
    existing = {p['id'] for p in project.setdefault('pois', [])}
    added = 0
    for poi in world['pois']:
        lon, lat = poi['geometry']['coordinates']
        hits = tree.query(Point(lon, lat), 'within')
        if poi['id'] in existing or not len(hits):
            continue
        project['pois'].append({'id': poi['id'], 'name': poi['name'], 'kind': poi['kind'],
                                'role': 'hq' if poi.get('hqCandidate') else '', 'lon': lon, 'lat': lat,
                                'cell': keys[int(hits[0])], 'resources': [], 'sourceIds': poi['sourceIds']})
        added += 1
    return added


def nearest_inside(zones, position, limit=.0006):
    """A base connection may end just outside a redrawn zone. Move its end inside, if the zone is that close."""
    point = Point(position)
    best, distance = None, limit
    for zone, geometry in zones:
        current = geometry.distance(point)
        if current < distance:
            best, distance = (zone, geometry), current
    if best is None:
        return None, position
    inside = best[1].buffer(-.00001)
    if inside.is_empty:
        return None, position
    target = shapely.shortest_line(point, inside).coords[-1]
    return best[0]['id'], [round(target[0], 7), round(target[1], 7)]


def rounded_point(point):
    return Point(round(point.x, 7), round(point.y, 7))


def road_connections(project, zones, tree, existing):
    """One proposed connection for each pair of neighbouring L3 zones that a mapped road or path crosses."""
    def zone_of(point):
        hits = tree.query(point, 'within')
        return zones[int(hits[0])][0]['id'] if len(hits) else None

    found = {}
    for area in project['areas']:
        roads = read_json(area_dir(area['id']) / 'roads.geojson', {'features': []})['features']
        for rank, kind in ((0, 'street'), (1, 'minor')):
            for feature in roads:
                if feature['properties']['c'] != kind:
                    continue
                coords = shapely.get_coordinates(shapely.segmentize(shape(feature['geometry']), .0002))
                previous, previous_point = None, None
                for a, b in zip(coords, coords[1:]):
                    middle = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                    current = zone_of(middle)
                    if current and previous and current != previous:
                        pair = frozenset((previous, current))
                        # Coordinates are rounded in the file, and must still land inside their zones.
                        p, q = rounded_point(previous_point), rounded_point(middle)
                        if pair not in existing and pair not in found and zone_of(p) == previous and zone_of(q) == current:
                            found[pair] = (previous, current, p, q, kind)
                    if current:
                        previous, previous_point = current, middle
    result = []
    names = {zone['id']: zone['name'] for zone, _ in zones}
    for start, end, p, q, kind in found.values():
        result.append({
            'id': f'edge-sone-{start}-{end}', 'name': f'{names[start]} – {names[end]}', 'fromCellId': start, 'toCellId': end,
            'kind': 'road' if kind == 'street' else 'footpath',
            'modes': ['walk', 'cycle', 'vehicle'] if kind == 'street' else ['walk', 'cycle'], 'status': 'proposed',
            'geometry': {'type': 'LineString', 'coordinates': [[round(p.x, 7), round(p.y, 7)], [round(q.x, 7), round(q.y, 7)]]},
            'sourceIds': ['osm'], 'rationale': 'Kartlagt vei eller sti krysser sonegrensen. Tilgang må vurderes.',
        })
    return result


def install_seed_cache(area_id, teig_source):
    """Reuse a parcel download that already exists instead of fetching it again."""
    target = IMPORTS / area_id / 'teig.json'
    if Path(teig_source).exists() and not target.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(teig_source, target)
