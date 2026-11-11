"""Review draft from the owner's 5 November sketches. Never modifies seed or saves."""
import heapq
import json
import math
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely import set_precision
from shapely.ops import nearest_points, polygonize, split, unary_union
from shapely.strtree import STRtree
from geography_blocks import assign_blocks, source_blocks

OUTPUT = ROOT / 'dist'
DATA = ROOT / 'packages/world-data/data'
world = json.loads((OUTPUT / 'buoy-11-soner.json').read_text(encoding='utf-8'))
previous_file = OUTPUT / 'stavanger-z-world-41-draft.json'
previous_geography = json.loads(previous_file.read_text(encoding='utf-8')) if previous_file.exists() else world
original = json.loads((DATA / 'editor-seed.json').read_text(encoding='utf-8'))
old_zones = {z['id']: z for z in original['zones']}
nodes, raw = {}, {}
sources = sorted((ROOT / '.tools/imports').rglob('*.xml'))
sources.sort(key=lambda p: p.name.startswith('byoyene-south'))
for source in sources:
    root = ET.parse(source).getroot()
    nodes.update({n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in root.findall('node')})
    raw.update({way.get('id'): way for way in root.findall('way')})
ways = {}
for identifier, way in raw.items():
    points = [nodes.get(n.get('ref')) for n in way.findall('nd')]
    if len(points) < 2 or None in points:
        continue
    ways[identifier] = {
        'tags': {t.get('k'): t.get('v') for t in way.findall('tag')},
        'coordinates': points,
    }


def distance(a, b):
    return math.hypot((a[0] - b[0]) * .515, a[1] - b[1]) * 111000


def street_route(names, start, end, endpoints_on_any_road=False):
    """Follow continuous OSM ways, preferring named roads over local shortcuts."""
    graph = defaultdict(list)
    preferred_points = set()
    for way in ways.values():
        tags = way['tags']
        if not tags.get('highway') or (tags.get('tunnel') == 'yes' and tags.get('name') != 'Skeietunnelen'):
            continue
        if tags.get('highway') in ('motorway', 'trunk', 'construction', 'proposed'):
            continue
        points = way['coordinates']
        preferred = tags.get('name') in names if names is not None else tags.get('name') in ('Hundvåg ring', 'Skeietunnelen', 'Lunde bru')
        weight = 1 if preferred else 1.5 if tags.get('junction') == 'roundabout' else 12
        if preferred:
            preferred_points.update(points)
        for a, b in zip(points, points[1:]):
            graph[a].append((b, distance(a, b) * weight))
            graph[b].append((a, distance(a, b) * weight))
    if not graph:
        raise ValueError(f'No street data for {names}')
    endpoint_candidates = graph if endpoints_on_any_road else preferred_points or graph
    a = min(endpoint_candidates, key=lambda p: distance(start, p))
    b = min(endpoint_candidates, key=lambda p: distance(end, p))
    heap, costs, previous = [(0, a)], {a: 0}, {}
    while heap:
        cost, p = heapq.heappop(heap)
        if cost > costs[p]:
            continue
        if p == b:
            break
        for q, step in graph[p]:
            total = cost + step
            if total < costs.get(q, math.inf):
                costs[q], previous[q] = total, p
                heapq.heappush(heap, (total, q))
    if b not in costs:
        raise ValueError(f'Disconnected street trace for {names}')
    result = [b]
    while result[-1] != a:
        result.append(previous[result[-1]])
    return list(reversed(result))


def components(area):
    if area.is_empty:
        return []
    if area.geom_type == 'Polygon':
        return [area]
    return [part for g in area.geoms for part in components(g)]


def without_numeric_holes(area):
    """Drop only sub-square-centimeter overlay holes when combining shared borders."""
    def ring_points(ring):
        points = []
        for point in ring.coords:
            if not points or math.dist(point, points[-1]) > 1e-10:
                points.append(point)
        if math.dist(points[-1], points[0]) <= 1e-10:
            points.pop()
        return [*points, points[0]]

    cleaned = [Polygon(ring_points(p.exterior), [ring_points(ring) for ring in p.interiors
                                               if Polygon(ring).area > 1e-14])
               for p in components(area) if p.area > 1e-14]
    return unary_union(cleaned)


def extend_to_coast(area, points):
    points = list(points)
    for start in (True, False):
        index, neighbor = (0, 1) if start else (-1, -2)
        point = Point(points[index])
        shore = nearest_points(point, area.boundary)[1]
        # A short continuation through the actual boundary makes polygon overlay
        # independent of floating point equality at a projected shore point.
        if area.covers(point):
            p = shore.coords[0]
            q = points[index]
            dx, dy = p[0] - q[0], p[1] - q[1]
            if math.hypot(dx, dy) < 1e-10:
                dx = q[0] - points[neighbor][0]
                dy = q[1] - points[neighbor][1]
            length = math.hypot(dx * .515, dy)
            # Cross only the first shoreline. A 30 m extrapolation can jump
            # across a narrow bay, land on the opposite shore, and grow into
            # a long chord through an entirely different neighbourhood.
            factor = .02 / (111000 * length)
            p = (p[0] + dx * factor, p[1] + dy * factor)
            while area.covers(Point(p)):
                factor *= 2
                if factor * length > .02:
                    raise ValueError('Could not extend the street cut beyond land')
                p = (shore.x + dx * factor, shore.y + dy * factor)
            if start:
                points.insert(0, p)
            else:
                points.append(p)
    return LineString(points)


def split_by_road(area, points, expected=2):
    cutter = extend_to_coast(area, points)
    pieces = components(split(area, cutter))
    # Tiny traffic islands are part of an operational zone.
    while len(pieces) > expected:
        small = min(pieces, key=lambda p: p.area)
        if small.area * 6.34e9 > 1500:
            raise ValueError('Street cut produces an unexpected operational area')
        others = [p for p in pieces if p is not small]
        neighbor = max(others, key=lambda p: p.boundary.intersection(small.boundary).length)
        pieces = [p for p in others if p is not neighbor] + [neighbor.union(small)]
    if len(pieces) != expected:
        raise ValueError(f'Expected {expected} road-separated pieces, got {len(pieces)}')
    return pieces


# The complete Engøy coastline extends south of the old source clipping box.
coasts = [LineString(w['coordinates']) for w in ways.values()
          if w['tags'].get('natural') == 'coastline']
coast_faces = sorted(polygonize(unary_union(coasts)), key=lambda p: p.area)
shore_buildings = []
for way in ways.values():
    points = way['coordinates']
    if (way['tags'].get('building') not in (None, 'no', 'roof')
            and len(points) >= 4 and points[0] == points[-1]):
        building = Polygon(points)
        if building.is_valid:
            shore_buildings.append(building)


def island_at(point):
    island = next(p for p in coast_faces if p.covers(Point(point)))
    # Quayside shops and boathouses can straddle the OSM coastline. Keep
    # their complete footprint in one operational area, rather than cutting
    # a building at the waterline. This does not connect separate islands.
    additions = [b for b in shore_buildings if b.intersects(island)
                 and b.intersection(island).area > 1e-14]
    return without_numeric_holes(unary_union([island, *additions]))


def keep_buildings_whole(cells):
    """A short road-to-shore continuation must go around a complete building."""
    cells = list(cells)
    domain = unary_union(cells)
    for building in shore_buildings:
        if not building.intersects(domain):
            continue
        hits = [(i, cell.intersection(building).area) for i, cell in enumerate(cells)]
        hits = [(i, area) for i, area in hits if area > 1e-14]
        if len(hits) < 2:
            continue
        owner = max(hits, key=lambda pair: pair[1])[0]
        mask = building.intersection(domain)
        for i, _ in hits:
            cells[i] = cells[i].union(mask) if i == owner else cells[i].difference(mask)
    return [without_numeric_holes(cell) for cell in cells]


engoy = island_at((5.7453121, 58.9828601))
solyst = island_at((5.7416503, 58.9774179))
print('Southern islands', [(round(p.centroid.x, 5), round(p.centroid.y, 5),
                            round(p.area * 6.34e9)) for p in coast_faces
                           if 5.730 < p.centroid.x < 5.75 and 58.970 < p.centroid.y < 58.981
                           and p.area * 6.34e9 > 5000])
grasholmen_candidates = [p for p in coast_faces
                        if 5.730 < p.centroid.x < 5.75 and 58.970 < p.centroid.y < 58.976
                        and p.area * 6.34e9 > 5000 and not p.equals(solyst)]
grasholmen = min(grasholmen_candidates, key=lambda p: distance(p.centroid.coords[0], (5.740, 58.974)))

engoy_cut = street_route(['Bybrua', 'Engøy bru', 'Pyntesund bru'],
                        (5.7387, 58.9837), (5.7456, 58.9799))
engoy_cells = split_by_road(engoy, engoy_cut)
bjornoy = island_at(shape(old_zones['cell-021']['geometry']).representative_point())
bjorn_cells = keep_buildings_whole(split_by_road(bjornoy, ways['32460132']['coordinates']))
ormoy = island_at(shape(old_zones['cell-023']['geometry']).representative_point())
orm_cells = keep_buildings_whole(split_by_road(ormoy, ways['32482010']['coordinates']))

roaldsoy = island_at(shape(old_zones['cell-022']['geometry']).representative_point())
roald_cut = ways['32482017']['coordinates']
roald_cells = split_by_road(roaldsoy, roald_cut)
east_roaldsoy = max(roald_cells, key=lambda p: p.area)
west_roaldsoy = next(p for p in roald_cells if p is not east_roaldsoy)
nordvik = street_route(['Nordvikveien'], (5.76026, 58.9943896), (5.7658233, 58.9957451))
nordvik.append((5.770, 58.9958))
east_parts = split_by_road(east_roaldsoy, nordvik)
austreviga = street_route(['Roaldsøyveien', 'Austrevigå'],
                         (5.7637614, 58.9920571), (5.7671122, 58.9920255))
austreviga.append((5.771, 58.9921))
south_roaldsoy = min(east_parts, key=lambda p: p.centroid.y)
north_roaldsoy = next(p for p in east_parts if p is not south_roaldsoy)
roald_cells = keep_buildings_whole([west_roaldsoy, north_roaldsoy, *split_by_road(south_roaldsoy, austreviga)])
if len(roald_cells) != 4:
    raise ValueError(f'Roaldsøy needs four cells, got {len(roald_cells)}')

# Hundvåg's five inner cells follow the actual ring, using the hand-drawn
# divisions only inside/outside that boundary.
# The old districts contain clipped / hand-simplified outlines. They are
# ownership hints, never a coastline or an authoritative road boundary.
main_island = island_at((5.731, 58.990))
neck_route = street_route(['Hundvåg ring'], (5.7281196, 58.9932365),
                         (5.7321105, 58.9929348))
main_parts = split_by_road(main_island, neck_route)
buoy_area = next(p for p in main_parts if p.covers(Point(5.731, 58.990)))
hund_area = next(p for p in main_parts if p is not buoy_area)
ring_checkpoints = [
    (5.7234749, 59.0007168), (5.7215628, 58.9968925),
    (5.7386224, 58.9937196), (5.7493486, 58.9965254),
    (5.7367758, 59.0040814), (5.7234749, 59.0007168),
]
ring_lines = [LineString(street_route(None, a, b))
              for a, b in zip(ring_checkpoints, ring_checkpoints[1:])]
ring_faces = list(polygonize(unary_union(ring_lines)))
ring_inside = max(ring_faces, key=lambda p: p.area).intersection(hund_area)
if ring_inside.area * 6.34e9 < 500000:
    raise ValueError('Hundvåg ring has not formed the expected main loop')


def hund_geo(p):
    return (5.7215628 + (p[0] - 331) / 16762,
            58.9968925 - (p[1] - 560) / 32827)


# Shared corner coordinates are deliberately reused between conceptual cells.
sketch = {
    1: [(550,280),(530,220),(530,100),(740,-70),(1050,-70),(1050,370),(890,365),(740,310),(728,315),(737,296),(712,276),(705,285),(670,388),(630,354),(590,320)],
    2: [(430,200),(460,175),(550,220),(550,280),(590,320),(493,351),(395,294),(430,236)],
    3: [(278,185),(278,140),(360,140),(430,200),(430,236),(395,294),(347,250),(314,255)],
    4: [(100,330),(100,170),(230,160),(278,185),(314,255),(235,328),(186,370),(149,330)],
    5: [(235,328),(314,255),(347,250),(395,294),(493,351),(374,412),(252,360)],
    6: [(186,370),(235,328),(252,360),(374,412),(329,465),(264,457),(240,430),(215,429)],
    7: [(149,330),(186,370),(215,429),(240,430),(264,457),(329,465),(330,533),(336,560),(332,618),(273,679),(273,735),(240,810),(20,810),(20,400)],
    8: [(273,679),(332,618),(390,615),(430,656),(467,673),(504,677),(502,700),(400,699),(337,722),(273,735)],
    9: [(504,677),(585,639),(610,644),(660,666),(730,667),(779,718),(760,745),(713,747),(659,779),(600,780),(554,754),(552,730),(522,716),(502,700)],
    10: [(659,779),(713,747),(760,745),(779,718),(833,752),(833,779),(779,785),(765,819),(771,852),(745,885),(715,877),(700,817)],
    11: [(783,561),(833,560),(900,620),(940,780),(833,779),(833,752),(779,718),(730,667),(774,577)],
    12: [(716,488),(747,475),(785,479),(821,509),(833,560),(783,561),(760,525),(735,512)],
    13: [(670,388),(705,285),(712,276),(737,296),(728,315),(740,310),(890,365),(820,420),(785,479),(747,475),(716,488)],
    14: [(590,320),(630,354),(670,388),(716,488),(672,518),(659,549),(630,576),(617,553),(582,527),(555,520),(503,551),(490,520),(456,462),(500,376),(493,351)],
    15: [(374,412),(493,351),(500,376),(456,462),(490,520),(402,555),(336,560),(330,533),(329,465)],
    16: [(332,618),(336,560),(402,555),(490,520),(503,551),(497,590),(496,650),(504,677),(467,673),(430,656),(390,615)],
    17: [(503,551),(555,520),(582,527),(617,553),(630,576),(618,618),(585,639),(504,677),(496,650),(497,590)],
    18: [(716,488),(735,512),(760,525),(783,561),(774,577),(730,667),(660,666),(610,644),(585,639),(618,618),(630,576),(659,549),(672,518)],
}
concepts = {n: Polygon([hund_geo(p) for p in points]).buffer(0) for n, points in sketch.items()}


inner_numbers = [14, 15, 16, 17, 18]
outer_numbers = [n for n in sketch if n not in inner_numbers]
hund_blocks, hund_source_lines = source_blocks(hund_area, ways)
inner_blocks = [block for block in hund_blocks if ring_inside.covers(block.representative_point())]
outer_blocks = [block for block in hund_blocks if not ring_inside.covers(block.representative_point())]
main_divider = street_route(['Hundvågveien'], (5.7300703, 58.992679),
                           (5.7351893, 59.0039228), endpoints_on_any_road=True)
west_inner, east_inner = sorted(split_by_road(ring_inside, main_divider), key=lambda p: p.centroid.x)
west_blocks = [block for block in inner_blocks if west_inner.covers(block.representative_point())]
east_blocks = [block for block in inner_blocks if not west_inner.covers(block.representative_point())]
hund_cells = assign_blocks(west_blocks, {n: concepts[n] for n in [15, 16]})
hund_cells.update(assign_blocks(east_blocks, {n: concepts[n] for n in [14, 17, 18]}))
hund_cells.update(assign_blocks(outer_blocks, {n: concepts[n] for n in outer_numbers}))
new_border = unary_union([g.boundary for g in hund_cells.values()])
# About one centimeter absorbs numeric coastal overlay seams, while rejecting
# actual unsupported shortcuts between road vertices.
unjustified = new_border.difference(hund_source_lines.buffer(1e-7))
if unjustified.length * 111000 > .01:
    raise ValueError('A Hundvåg boundary has left its source road, land-use edge or coast')
print('Hundvåg source blocks', len(hund_blocks), 'unjustified border meters', unjustified.length * 111000)
if len(hund_cells) != 18 or any(g.is_empty for g in hund_cells.values()):
    raise ValueError('Expected 18 populated Hundvåg cells')

# Only draft identities are curated here. Existing published worlds and saved
# states keep their own immutable WorldDefinition snapshots.
buoy = [z for z in world['zones'] if z.get('parentId') == 'district-001']
buoy_blocks, buoy_source_lines = source_blocks(buoy_area, ways)
buoy_targets = {int(z['name'][:2]): shape(z['geometry']) for z in buoy}
buoy_shapes = assign_blocks(buoy_blocks, buoy_targets)
buoy = [{**z, 'geometry': mapping(buoy_shapes[int(z['name'][:2])]),
         'rationale': 'Brukerens nummererte skisse, kuratert som hele kildeavgrensede kartflater.'}
        for z in buoy]
buoy_border = unary_union([shape(z['geometry']).boundary for z in buoy])
if buoy_border.difference(buoy_source_lines.buffer(1e-7)).length * 111000 > .01:
    raise ValueError('A Buøy boundary has left its source reference')
old_cells = [z for z in original['zones'] if z['level'] == 3 and z.get('parentId') != 'district-001']
used_ids = {z['id'] for z in buoy}
next_id = 36
new_cells = []


def add_cells(group, entries, preferred_parent=None):
    global next_id
    matched = {}
    for i, (number, name, geometry) in enumerate(entries):
        prefix = f'{group} {number:02d} ·'
        previous = next((z for z in previous_geography['zones']
                         if z['level'] == 3 and z['name'].startswith(prefix)), None)
        if previous:
            matched[i] = previous['id']
            used_ids.add(previous['id'])
    candidates = [z for z in old_cells if z['id'] not in used_ids]
    pairs = sorted([(g.intersection(shape(z['geometry'])).area, i, z)
                    for i, (_, _, g) in enumerate(entries) for z in candidates],
                   key=lambda item: item[0], reverse=True)
    for area, i, z in pairs:
        if area > 0 and i not in matched and z['id'] not in used_ids:
            matched[i] = z['id']
            used_ids.add(z['id'])
    for i, (number, name, geometry) in enumerate(entries):
        identifier = matched.get(i)
        if not identifier:
            reserved = {z['id'] for z in previous_geography['zones']}
            while f'cell-{next_id:03d}' in used_ids or f'cell-{next_id:03d}' in old_zones or f'cell-{next_id:03d}' in reserved:
                next_id += 1
            identifier = f'cell-{next_id:03d}'
            next_id += 1
            used_ids.add(identifier)
        parent = preferred_parent
        if not parent:
            parent = max(['district-002', 'district-004', 'district-005'],
                         key=lambda p: geometry.intersection(shape(old_zones[p]['geometry'])).area)
        new_cells.append({
            'id': identifier, 'name': f'{group} {number:02d} · {name}',
            'level': 3, 'parentId': parent, 'playable': True,
            'geometry': mapping(geometry), 'primaryType': 'blandet',
            'rationale': 'Brukerskisse 05.11.2026. Foreløpig geografi og L2-tilhørighet til kartgjennomgang.',
            'sourceIds': ['osm', 'curation'],
        })


add_cells('Hundvåg', [(n, 'arbeidsområde', hund_cells[n]) for n in sorted(hund_cells)])
add_cells('Engøy', [(i + 1, 'vest' if i == 0 else 'øst', g)
                    for i, g in enumerate(sorted(engoy_cells, key=lambda g: g.centroid.x))], 'district-003')
add_cells('Sølyst', [(1, 'øya', solyst)], 'district-003')
add_cells('Grasholmen', [(1, 'øya', grasholmen)], 'district-003')
add_cells('Bjørnøy', [(i + 1, 'Skadesundveien', g)
                      for i, g in enumerate(sorted(bjorn_cells, key=lambda g: g.centroid.y, reverse=True))], 'district-006')
add_cells('Roaldsøy', [(i + 1, 'arbeidsområde', g)
                       for i, g in enumerate(sorted(roald_cells, key=lambda g: g.centroid.y, reverse=True))], 'district-006')
add_cells('Ormøy', [(i + 1, 'Ormøyveien', g)
                    for i, g in enumerate(sorted(orm_cells, key=lambda g: g.centroid.x))], 'district-006')
assert len(new_cells) + len(buoy) == 41

districts = []
for z in original['zones']:
    if z['level'] != 2:
        continue
    members = [shape(c['geometry']) for c in [*buoy, *new_cells] if c['parentId'] == z['id']]
    geometry = without_numeric_holes(unary_union(members))
    if z['id'] == 'district-006':
        # Steinsøy remains geographic context pending a later scope decision.
        geometry = geometry.union(island_at(shape(old_zones['cell-024']['geometry']).representative_point()))
    districts.append({**z, 'geometry': mapping(geometry), 'rationale': 'Foreløpig L2-gruppering. Eier vurderer etter L3-gjennomgang.'})
region = next(z for z in original['zones'] if z['level'] == 1)
region = {**region, 'geometry': mapping(without_numeric_holes(
    unary_union([shape(d['geometry']) for d in districts])))}
world['zones'] = [{**z, 'geometry': mapping(set_precision(without_numeric_holes(shape(z['geometry'])), 1e-10))}
                  for z in [region, *districts, *buoy, *new_cells]]
world['worldVersion'] = 'owner-geography-41-road-review-2026-11-06'
world['sources'].append({
    'id': 'osm-south-2026-11-05',
    'name': 'OpenStreetMap – Sølyst og Grasholmen',
    'url': 'https://api.openstreetmap.org/api/0.6/map?bbox=5.730,58.970,5.755,58.985',
    'license': 'ODbL-1.0', 'retrievedAt': '2026-11-05',
})
for cell in new_cells:
    if cell['name'].startswith(('Sølyst', 'Grasholmen')):
        cell['sourceIds'].append('osm-south-2026-11-05')

# Proposed connections follow continuous OSM surface ways, including actual bridge
# approaches. Coastal proximity alone never creates a connection.
cells = [*buoy, *new_cells]
cell_geometries = [shape(c['geometry']) for c in cells]
cell_tree = STRtree(cell_geometries)
centers = [g.representative_point() for g in cell_geometries]
extent = shape(region['geometry']).envelope.buffer(.003)
road_graph = defaultdict(list)
context = []
for identifier, way in ways.items():
    tags, points = way['tags'], way['coordinates']
    trace = LineString(points)
    if not trace.intersects(extent):
        continue
    highway = tags.get('highway')
    if highway and (tags.get('tunnel') != 'yes' or tags.get('name') == 'Skeietunnelen'):
        context.append({'kind': 'road', 'tag': highway, 'coordinates': points})
        if tags.get('tunnel') == 'yes':
            continue
        if highway in ('motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'proposed', 'raceway'):
            continue
        modes = {'walk', 'cycle', 'vehicle'}
        if highway in ('footway', 'path', 'steps', 'pedestrian', 'cycleway', 'bridleway'):
            modes.discard('vehicle')
        if tags.get('foot') == 'no':
            modes.discard('walk')
        if tags.get('bicycle') == 'no':
            modes.discard('cycle')
        if tags.get('motor_vehicle') == 'no' or tags.get('vehicle') == 'no':
            modes.discard('vehicle')
        if not modes:
            continue
        info = {
            'modes': modes, 'name': tags.get('name', 'Kartlagt lokalforbindelse'),
            'bridge': tags.get('bridge') not in (None, 'no'),
            'id': identifier,
        }
        for a, b in zip(points, points[1:]):
            length = distance(a, b)
            if not length:
                continue
            road_graph[a].append((b, length, info))
            road_graph[b].append((a, length, info))
    elif tags.get('natural') == 'coastline':
        context.append({'kind': 'coast', 'tag': 'coastline', 'coordinates': points})
    elif len(points) >= 4 and points[0] == points[-1]:
        if tags.get('building') and tags['building'] != 'roof':
            context.append({'kind': 'building', 'tag': tags['building'], 'coordinates': points})
        elif tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank':
            context.append({'kind': 'coast', 'tag': 'water', 'coordinates': points})
        elif tags.get('landuse') or tags.get('leisure'):
            context.append({'kind': 'land', 'tag': tags.get('landuse', tags.get('leisure')), 'coordinates': points})

labels, costs, previous = {}, {}, {}
queue = []
for p in road_graph:
    point = Point(p)
    candidates = cell_tree.query(point, predicate='intersects')
    if len(candidates) == 0:
        continue
    index = min(candidates, key=lambda i: point.distance(centers[i]))
    labels[p], costs[p] = int(index), 0
    heapq.heappush(queue, (0, p))
while queue:
    cost, p = heapq.heappop(queue)
    if cost > costs[p] or cost > 1500:
        continue
    for q, length, info in road_graph[p]:
        total = cost + length
        if total < costs.get(q, math.inf):
            labels[q], costs[q], previous[q] = labels[p], total, (p, info)
            heapq.heappush(queue, (total, q))


def path_to_land(point):
    path, infos = [point], []
    while point in previous:
        point, info = previous[point]
        path.append(point)
        infos.append(info)
    return path, infos


connections = {}
for p, edges in road_graph.items():
    if p not in labels:
        continue
    for q, length, info in edges:
        if q not in labels or labels[q] == labels[p]:
            continue
        a, b = labels[p], labels[q]
        pair = tuple(sorted((a, b)))
        left, left_info = path_to_land(p)
        right, right_info = path_to_land(q)
        infos = [*left_info, info, *right_info]
        modes = set.intersection(*(item['modes'] for item in infos))
        if not modes:
            continue
        coordinates = [*reversed(left), *right]
        length += costs[p] + costs[q]
        if length >= connections.get(pair, {}).get('length', math.inf):
            continue
        if length > 1500:
            continue
        connections[pair] = {
            'length': length, 'fromCellId': cells[a]['id'], 'toCellId': cells[b]['id'],
            'coordinates': coordinates, 'modes': sorted(modes),
            'kind': 'bridge' if any(item['bridge'] for item in infos) else 'road',
            'name': info['name'],
        }

world['edges'] = [{
    'id': f'edge-review-{i:03d}', 'name': connection['name'],
    'fromCellId': connection['fromCellId'], 'toCellId': connection['toCellId'],
    'geometry': {'type': 'LineString', 'coordinates': connection['coordinates']},
    'kind': connection['kind'], 'modes': connection['modes'], 'status': 'proposed',
    'sourceIds': ['osm', 'curation'],
    'rationale': 'Sammenhengende OSM-trasé på bakken. Foreslått tilgang. Retning, porter og reisetid gjenstår å kuratere.',
} for i, connection in enumerate(connections.values(), 1)]
print('Proposed transport connections', len(world['edges']))
other_blocks, _ = source_blocks(shape(region['geometry']).difference(hund_area), ways)
(OUTPUT / 'geografi-41-context-work.json').write_text(json.dumps({
    'name': 'Hundvåg og kjørbare byøyer – 41 soner',
    'features': context,
    'blocks': [mapping(block) for block in [*hund_blocks, *other_blocks]],
    'extent': [[extent.bounds[0], extent.bounds[1]], [extent.bounds[2], extent.bounds[3]]],
}, ensure_ascii=False), encoding='utf-8')
(OUTPUT / 'geografi-41-work.json').write_text(json.dumps(world, ensure_ascii=False), encoding='utf-8')
(OUTPUT / 'geografi-41-shapes-work.json').write_text(json.dumps({
    'ring': mapping(ring_inside),
    'cells': {z['id']: z['geometry'] for z in [*buoy, *new_cells]},
}), encoding='utf-8')
print('Wrote 41-cell review draft')
