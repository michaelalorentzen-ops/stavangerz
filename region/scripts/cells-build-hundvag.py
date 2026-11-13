"""Build atomic Hundvåg cells from parcels, roads and coast, then propose L3/L2 groupings.

Review output only: writes to dist/hundvag-celler and never touches seed, saves or world drafts.
Requires scripts/cells-fetch-teig.py to have been run first.
"""
import heapq
import json
import math
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import linemerge, polygonize, transform, unary_union
from shapely.strtree import STRtree

OUTPUT = ROOT / 'dist/hundvag-celler'
HUNDVAG_IDS = ['cell-026', 'cell-036', 'cell-037', 'cell-038', 'cell-019', 'cell-039', 'cell-018', 'cell-008',
               'cell-009', 'cell-017', 'cell-025', 'cell-040', 'cell-041', 'cell-020', 'cell-042', 'cell-010',
               'cell-043', 'cell-011']
L3_COUNT = 18
L2_COUNT = 3
LARGE_PARCEL = 20000  # m²; only these may be split by paths, service roads and land-cover edges.
SMALL_AREA = 150      # m²; cells below this, or thinner than SMALL_WIDTH, join a neighbour.
SMALL_WIDTH = 6       # m
MAX_BUILDING_MERGE = 100000  # m²
GRID = .1             # m
MASS_AREA = 8000      # m² of land counted as one building when balancing zone size.
RING_GAP = 4          # m; barrier half-width when finding the two sides of the ring road.
RING_BRIDGE = 100     # m; longest gap in the mapped ring road that is treated as continuous.
MIN_SIDE_AREA = 50000 # m²; smaller land pieces cut off by the ring join the nearest real side.
SHAPE_WEIGHT = .12    # Penalty for long, thin merged shapes.
TINY_ZONE = .3        # Share of target mass below which a zone is absorbed in the final merges.
MAJOR = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link',
         'secondary_link', 'tertiary_link'}
STREET = MAJOR | {'unclassified', 'residential', 'living_street', 'pedestrian'}
MINOR = {'service', 'track', 'path', 'footway', 'cycleway', 'bridleway', 'steps'}
LAND_COVER = {'forest', 'residential', 'industrial', 'farmland', 'meadow', 'grass', 'recreation_ground',
              'allotments', 'commercial', 'retail', 'cemetery', 'orchard', 'wood', 'heath', 'scrub', 'wetland'}

to_utm = Transformer.from_crs(4326, 25832, always_xy=True).transform
to_wgs = Transformer.from_crs(25832, 4326, always_xy=True).transform


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


def load_osm():
    nodes, raw = {}, {}
    for source in sorted((ROOT / '.tools/imports').rglob('*.xml')):
        root = ET.parse(source).getroot()
        nodes.update({n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in root.findall('node')})
        raw.update({way.get('id'): way for way in root.findall('way')})
    ways = []
    for way in raw.values():
        points = [nodes.get(n.get('ref')) for n in way.findall('nd')]
        if len(points) >= 2 and None not in points:
            tags = {t.get('k'): t.get('v') for t in way.findall('tag')}
            ways.append((tags, [to_utm(*p) for p in points]))
    return ways


def load_inputs():
    world = json.loads((ROOT / 'dist/geografi-41-work.json').read_text(encoding='utf-8'))
    zones = {z['id']: z for z in world['zones']}
    current = {}
    for number, identifier in enumerate(HUNDVAG_IDS, 1):
        current[f'H{number:02d}'] = transform(to_utm, shape(zones[identifier]['geometry'])).buffer(0)
    domain = unary_union(list(current.values())).buffer(.2).buffer(-.2)
    data = json.loads((ROOT / '.tools/imports/matrikkel/hundvag-teig.json').read_text(encoding='utf-8'))
    parcels = []
    for parcel in data['parcels']:
        for rings in parcel['polygons']:
            parcels.extend(polygons_of(Polygon(rings[0], rings[1:]).buffer(0)))
    return current, domain, parcels, load_osm()


def classify_ways(ways, domain):
    layers = {name: [] for name in ('ring', 'major', 'street', 'minor', 'cover', 'buildings')}
    roundabouts = []
    for tags, points in ways:
        highway = tags.get('highway')
        closed = points[0] == points[-1] and len(points) >= 4
        if tags.get('building') and tags.get('building') != 'no' and closed:
            footprint = Polygon(points).buffer(0)
            if footprint.intersects(domain) and footprint.area > 8:
                layers['buildings'].append(footprint)
            continue
        line = LineString(points)
        if not line.intersects(domain):
            continue
        hidden = tags.get('tunnel') in ('yes', 'building_passage') or tags.get('covered') == 'yes'
        if highway and not hidden:
            if tags.get('name') == 'Hundvåg ring':
                layers['ring'].append(line)
            elif tags.get('junction') == 'roundabout':
                roundabouts.append(line)
            if highway in MAJOR:
                layers['major'].append(line)
            if highway in STREET:
                layers['street'].append(line)
            elif highway in MINOR:
                layers['minor'].append(line)
        elif tags.get('waterway') in ('stream', 'river', 'ditch', 'drain') and not hidden:
            layers['minor'].append(line)
        elif closed and (tags.get('landuse') in LAND_COVER or tags.get('natural') in LAND_COVER
                         or tags.get('leisure') in ('park', 'nature_reserve', 'pitch', 'golf_course')):
            layers['cover'].append(line)
    # The name is missing on roundabouts along the ring, which would leave gaps in the barrier.
    named = unary_union(layers['ring'])
    layers['ring'].extend(line for line in roundabouts if line.distance(named) < 1)
    return layers


def build_faces(domain, parcels, layers):
    clipped = [p.intersection(domain) for p in parcels if p.intersects(domain)]
    large = [p for p in clipped if p.area >= LARGE_PARCEL]
    lines = lines_of(domain.boundary)
    for parcel in clipped:
        for polygon in polygons_of(parcel):
            lines.extend(lines_of(polygon.boundary))
    lines.extend(part for line in layers['street'] for part in lines_of(line.intersection(domain)))
    if large:
        area = unary_union(large)
        for line in layers['minor'] + layers['cover']:
            lines.extend(lines_of(line.intersection(area)))
    snapped = shapely.set_precision(np.array(lines, dtype=object), GRID)
    network = unary_union([line for line in snapped if not line.is_empty])
    faces = [face for face in polygonize(network)
             if face.area > .05 and domain.covers(face.representative_point())]
    faces.sort(key=lambda p: (p.bounds, p.area))
    return faces


class Regions:
    """Merge graph. Edge values: shared length, then how much of it follows ring, major and street lines."""

    def __init__(self, faces, layers):
        self.area = {i: f.area for i, f in enumerate(faces)}
        self.length = {i: f.length for i, f in enumerate(faces)}
        self.buildings = dict.fromkeys(self.area, 0)
        self.members = {i: [i] for i in self.area}
        self.adjacent = defaultdict(dict)
        array = np.array(faces, dtype=object)
        left, right = STRtree(faces).query(array, predicate='touches')
        keep = left < right
        left, right = left[keep], right[keep]
        shared = shapely.intersection(shapely.boundary(array[left]), shapely.boundary(array[right]))
        guides = {name: unary_union(layers[name]) for name in ('ring', 'major', 'street')}
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
            for name in ('ring', 'major', 'street'):
                edge.append(float(lengths[shapely.dwithin(middle, guides[name], .8)].sum()))
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


def merge_buildings_and_slivers(regions, faces, buildings):
    tree = STRtree(faces)
    owner = {i: i for i in regions.area}

    def find(i):
        while owner[i] != i:
            owner[i] = owner[owner[i]]
            i = owner[i]
        return i

    unresolved = 0
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
            if a == b:
                continue
            if b in regions.adjacent[a] and regions.area[a] + regions.area[b] <= MAX_BUILDING_MERGE:
                regions.merge(a, b)
                owner[b] = a
            else:
                unresolved += 1
    for i in homes:
        regions.buildings[find(i)] += 1

    # Half-width road strips and slivers join the neighbour they share most non-road border with.
    def is_small(i):
        width = 2 * regions.area[i] / max(regions.length[i], 1)
        return regions.area[i] < SMALL_AREA or width < SMALL_WIDTH

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
    return unresolved


def connect_islands(regions, faces):
    loose = [i for i in sorted(regions.area) if not regions.adjacent[i]]
    keys = [i for i in sorted(regions.area) if regions.adjacent[i]]
    tree = STRtree([unary_union([faces[m] for m in regions.members[i]]) for i in keys])
    for i in loose:
        target = keys[int(tree.nearest(unary_union([faces[m] for m in regions.members[i]])))]
        regions.area[target] += regions.area.pop(i)
        regions.buildings[target] += regions.buildings.pop(i)
        regions.length[target] += regions.length.pop(i)
        regions.members[target] += regions.members.pop(i)
        regions.adjacent.pop(i, None)
    return len(loose)


def ring_sides(regions, faces, domain, ring):
    """Give each region the land area it lies in when the ring road is cut out of the island."""
    # Junctions and the Skeie tunnel leave gaps in the named road, so nearby loose ends are joined.
    merged = linemerge(ring)
    pieces = lines_of(merged)
    bridges = []
    for piece in pieces:
        for end in (Point(piece.coords[0]), Point(piece.coords[-1])):
            others = [q for q in pieces if q is not piece]
            nearest = min(others, key=end.distance)
            if 0 < end.distance(nearest) <= RING_BRIDGE:
                bridges.append(LineString(shapely.shortest_line(end, nearest).coords))
    barrier = unary_union([ring, *bridges])
    parts = polygons_of(domain.difference(barrier.buffer(RING_GAP)))
    sides = sorted((p for p in parts if p.area >= MIN_SIDE_AREA), key=lambda p: -p.area)
    tree = STRtree(sides)
    result = {}
    for i, members in regions.members.items():
        geometry = unary_union([faces[m] for m in members])
        overlap = [(sides[int(j)].intersection(geometry).area, int(j)) for j in tree.query(geometry, 'intersects')]
        result[i] = max(overlap)[1] if overlap else int(tree.nearest(geometry))
    return result, len(sides)


def agglomerate(regions, count, target, ring_weight, sides=None, absorb_tiny=False):
    """Greedy, deterministic merging: weak and long shared borders first, oversized results last."""

    def blocked(a, b):
        return sides is not None and sides[a] != sides[b]

    def cost(a, b):
        length, ring, major, street = regions.adjacent[a][b]
        strength = (ring * ring_weight + (major - min(major, ring)) * 4
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
            if blocked(first, second):
                continue
            heapq.heappush(heap, (cost(first, second), first, second, version[first], version[second]))


def assess(zones, layers, parcel_lines, buildings, domain):
    names = sorted(zones)
    tree = STRtree([zones[n] for n in names])
    counts = Counter()
    cut = 0
    for building in buildings:
        hits = sorted(((zones[names[int(i)]].intersection(building).area, names[int(i)])
                       for i in tree.query(building, 'intersects')), reverse=True)
        hits = [h for h in hits if h[0] > 0]
        if hits:
            counts[hits[0][1]] += 1
        if len(hits) > 1 and hits[1][0] > max(1, .03 * building.area):
            cut += 1
    borders = []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if zones[a].distance(zones[b]) < .5:
                borders.extend(lines_of(zones[a].boundary.intersection(zones[b].buffer(.3))))
    segments = []
    for line in borders:
        coords = list(shapely.segmentize(line, 10).coords)
        segments.extend(LineString(pair) for pair in zip(coords, coords[1:]) if pair[0] != pair[1])
    segments = np.array(segments, dtype=object)
    middle = shapely.line_interpolate_point(segments, .5, normalized=True)
    lengths = shapely.length(segments)
    inland = ~shapely.dwithin(middle, domain.boundary, 1)
    roads = unary_union(layers['street'] + layers['minor'])
    shapely.prepare(roads)
    shapely.prepare(parcel_lines)
    on_road = shapely.dwithin(middle, roads, 6)
    on_parcel = shapely.dwithin(middle, parcel_lines, 1.5)
    footprints = unary_union(buildings)
    shapely.prepare(footprints)
    in_building = shapely.intersects(middle, footprints)
    total = lengths[inland].sum()
    ring = unary_union(layers['ring'])
    # Land narrower than 80 m disappears in this opening, which measures how ribbon-like zones are.
    ribbon = sum(z.difference(z.buffer(-40).buffer(45)).area for z in zones.values()) / domain.area

    def share(mask):
        return round(float(100 * lengths[inland & mask].sum() / total), 1)

    return {
        'zones': len(names),
        'buildingsCutByBorder': cut,
        'borderKm': round(float(total) / 1000, 2),
        'borderOnRoadPct': share(on_road),
        'borderOnParcelPct': share(on_parcel),
        'borderOnRoadOrParcelPct': share(on_road | on_parcel),
        'borderOnNeitherPct': share(~(on_road | on_parcel)),
        'borderThroughBuildingM': round(float(lengths[inland & in_building].sum())),
        'ringInsideZonesM': round(sum(ring.intersection(z.buffer(-8)).length for z in zones.values())),
        'ribbonAreaPct': round(100 * ribbon, 1),
        'disconnectedZones': sum(zones[n].geom_type != 'Polygon' for n in names),
        'buildingsPerZone': {n: counts[n] for n in names},
    }


def without_pinholes(geometry):
    return unary_union([Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area > 1])
                        for p in polygons_of(geometry)])


def geojson(geometry):
    return mapping(shapely.set_precision(transform(to_wgs, geometry), 1e-7))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    current, domain, parcels, ways = load_inputs()
    layers = classify_ways(ways, domain)
    print('parcels', len(parcels), 'buildings', len(layers['buildings']), 'ring ways', len(layers['ring']),
          'domain km2', round(domain.area / 1e6, 3), flush=True)
    faces = build_faces(domain, parcels, layers)
    print('raw faces', len(faces), flush=True)
    regions = Regions(faces, layers)
    unresolved = merge_buildings_and_slivers(regions, faces, layers['buildings'])
    islands = connect_islands(regions, faces)
    print('cells', len(regions.area), 'unresolved building merges', unresolved, 'detached pieces', islands, flush=True)

    cell_members = sorted((list(v) for v in regions.members.values()), key=min)
    cell_names = [f'c{n:05d}' for n in range(1, len(cell_members) + 1)]
    cell_geometry = {name: without_pinholes(unary_union([faces[m] for m in members]))
                     for name, members in zip(cell_names, cell_members)}

    total_mass = sum(regions.mass(i) for i in regions.area)
    target = total_mass / L3_COUNT
    sides, side_count = ring_sides(regions, faces, domain, unary_union(layers['ring']))
    agglomerate(regions, L3_COUNT * 2, target, 4, sides=sides)
    agglomerate(regions, L3_COUNT, target, 4, sides=sides, absorb_tiny=True)
    ordered = sorted(regions.members.values(), key=lambda m: -sum(faces[i].area for i in m))
    l3 = {f'L3-{n:02d}': list(members) for n, members in enumerate(ordered, 1)}
    l3_of_face = {m: name for name, members in l3.items() for m in members}
    l3_geometry = {name: without_pinholes(unary_union([faces[m] for m in members])) for name, members in l3.items()}

    agglomerate(regions, L2_COUNT, total_mass / L2_COUNT, 6)
    l2_of_l3 = {}
    for n, members in enumerate(sorted(regions.members.values(), key=lambda m: -len(m)), 1):
        for m in members:
            l2_of_l3[l3_of_face[m]] = f'L2-{n:02d}'

    # Integrity: the cells partition the domain, each cell has one L3 and each L3 one L2.
    cell_l3 = {name: {l3_of_face[m] for m in members} for name, members in zip(cell_names, cell_members)}
    checks = {
        'domainAreaM2': round(domain.area),
        'cellAreaM2': round(sum(g.area for g in cell_geometry.values())),
        'uncoveredAreaM2': round(domain.difference(unary_union(list(cell_geometry.values()))).area, 1),
        'cellsInSeveralL3': sum(len(v) > 1 for v in cell_l3.values()),
        'invalidCells': sum(not g.is_valid for g in cell_geometry.values()),
        'invalidL3': sum(not g.is_valid for g in l3_geometry.values()),
        'l2Count': len(set(l2_of_l3.values())),
    }

    parcel_lines = unary_union([p.boundary for p in parcels if p.intersects(domain)]).intersection(domain.buffer(1))
    areas = sorted(g.area for g in cell_geometry.values())
    report = {
        'checks': checks,
        'inputs': {'parcels': len(parcels), 'buildings': len(layers['buildings']), 'rawFaces': len(faces),
                   'unresolvedBuildingMerges': unresolved, 'detachedPieces': islands, 'ringSides': side_count},
        'cells': {'count': len(areas), 'medianM2': round(areas[len(areas) // 2]),
                  'p90M2': round(areas[int(len(areas) * .9)]), 'maxM2': round(areas[-1]),
                  'over50000M2': sum(a > 50000 for a in areas)},
        'current': assess(current, layers, parcel_lines, layers['buildings'], domain),
        'proposal': assess(l3_geometry, layers, parcel_lines, layers['buildings'], domain),
    }
    (OUTPUT / 'rapport.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    source_ids = ['osm', 'matrikkel-teig']
    zones = [{'id': 'L1-01', 'name': 'Hundvåg', 'level': 1, 'playable': True,
              'geometry': geojson(unary_union(list(l3_geometry.values()))),
              'rationale': 'Automatisk forslag fra cellegruppering', 'sourceIds': source_ids}]
    for l2 in sorted(set(l2_of_l3.values())):
        geometry = unary_union([l3_geometry[k] for k, v in l2_of_l3.items() if v == l2])
        zones.append({'id': l2, 'name': l2, 'level': 2, 'parentId': 'L1-01', 'playable': True,
                      'geometry': geojson(geometry), 'rationale': 'Automatisk forslag fra cellegruppering',
                      'sourceIds': source_ids})
    for name in sorted(l3):
        zones.append({'id': name, 'name': name, 'level': 3, 'parentId': l2_of_l3[name], 'playable': True,
                      'geometry': geojson(l3_geometry[name]), 'rationale': 'Automatisk forslag fra cellegruppering',
                      'sourceIds': source_ids})
    (OUTPUT / 'hundvag-soner-forslag.json').write_text(json.dumps({
        'status': 'draft', 'note': 'Forslag til gjennomgang. Ikke koblet til spillet.',
        'sources': [
            {'id': 'osm', 'name': 'OpenStreetMap contributors', 'url': 'https://www.openstreetmap.org/copyright',
             'license': 'ODbL-1.0'},
            {'id': 'matrikkel-teig', 'name': 'Kartverket, Matrikkelen Eiendomskart Teig',
             'url': 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-eiendomskart-teig', 'license': 'CC-BY-4.0'},
        ], 'zones': zones}, ensure_ascii=False), encoding='utf-8')

    cell_zone = {name: l3_of_face[members[0]] for name, members in zip(cell_names, cell_members)}
    features = [{'type': 'Feature', 'geometry': geojson(cell_geometry[name]), 'properties': {
        'id': name, 'areaM2': round(cell_geometry[name].area), 'l3': cell_zone[name], 'l2': l2_of_l3[cell_zone[name]],
    }} for name in cell_names]
    (OUTPUT / 'hundvag-celler.geojson').write_text(json.dumps(
        {'type': 'FeatureCollection', 'features': features}, ensure_ascii=False), encoding='utf-8')

    (OUTPUT / 'render-input-work.json').write_text(json.dumps({
        'current': {k: mapping(v) for k, v in current.items()},
        'l3': {k: mapping(v) for k, v in l3_geometry.items()},
        'l2Of': l2_of_l3,
        'cells': [mapping(cell_geometry[name]) for name in cell_names],
        'cellL3': [cell_zone[name] for name in cell_names],
        'buildings': [mapping(b) for b in layers['buildings']],
        'streets': [mapping(s) for s in layers['street']],
        'ring': [mapping(s) for s in layers['ring']],
        'metrics': {key: report[key] for key in ('current', 'proposal')},
    }), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in ('current', 'proposal')}, indent=1))
    for key in ('current', 'proposal'):
        print(key, json.dumps(report[key], ensure_ascii=False))


if __name__ == '__main__':
    main()
