"""Create editable land blocks from source lines, never from sketch chords."""
import heapq
import math
from collections import defaultdict

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import nearest_points, polygonize, unary_union
from shapely.strtree import STRtree


def line_parts(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type in ('LineString', 'LinearRing'):
        return [geometry]
    return [part for g in geometry.geoms for part in line_parts(g)] if hasattr(geometry, 'geoms') else []


def source_blocks(domain, ways):
    lines = line_parts(domain.boundary)
    coastal_endpoints = set()
    for way in ways.values():
        tags, coordinates = way['tags'], way['coordinates']
        highway = tags.get('highway')
        road = highway and highway not in ('construction', 'proposed', 'platform')
        if tags.get('tunnel') in ('yes', 'building_passage') and tags.get('name') != 'Skeietunnelen':
            road = False
        area = (coordinates[0] == coordinates[-1] and len(coordinates) >= 4
                and (tags.get('landuse') in ('forest', 'residential', 'industrial', 'farmland',
                                             'meadow', 'grass', 'recreation_ground', 'allotments')
                     or tags.get('leisure') in ('park', 'nature_reserve', 'pitch')))
        if not road and not area:
            continue
        trace = LineString(coordinates)
        if trace.intersects(domain):
            lines.extend(line_parts(trace.intersection(domain)))
            if road:
                coastal_endpoints.update((coordinates[0], coordinates[-1]))
    # Close the short gap between a coastal street/path endpoint and shore.
    # These are explicit curation lines, not asserted cadastral boundaries.
    for endpoint in sorted(coastal_endpoints):
        point = Point(endpoint)
        if not domain.contains(point):
            continue
        coast = nearest_points(point, domain.boundary)[1]
        length = math.hypot((coast.x - point.x) * .515, coast.y - point.y) * 111000
        if .5 < length <= 40:
            beyond = (coast.x + (coast.x - point.x) * .01,
                      coast.y + (coast.y - point.y) * .01)
            lines.append(LineString([endpoint, beyond]).intersection(domain))
    network = unary_union(lines)
    blocks = [face for face in polygonize(network)
              if face.area > 1e-14 and domain.covers(face.representative_point())]
    # Some OSM land-use edges cut through a building. Treat the surrounding
    # faces as a single editable block rather than carrying that split forward.
    tree = STRtree(blocks)
    parents = list(range(len(blocks)))

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for way in ways.values():
        coordinates = way['coordinates']
        if not way['tags'].get('building') or len(coordinates) < 4 or coordinates[0] != coordinates[-1]:
            continue
        building = Polygon(coordinates)
        if not building.is_valid or not building.intersects(domain):
            continue
        hits = [int(i) for i in tree.query(building, predicate='intersects')
                if blocks[i].intersection(building).area > 1e-14]
        for i in hits[1:]:
            parents[root(i)] = root(hits[0])
    groups = defaultdict(list)
    for i, block in enumerate(blocks):
        groups[root(i)].append(block)
    blocks = [unary_union(group) for group in groups.values()]
    blocks.sort(key=lambda p: (*p.bounds, p.area))
    return blocks, network


def assign_blocks(blocks, targets):
    """Grow one connected zone from each sketch seed over the source block graph."""
    numbers = sorted(targets)
    tree = STRtree(blocks)
    neighbors = defaultdict(set)
    for i, block in enumerate(blocks):
        for j in tree.query(block, predicate='intersects'):
            j = int(j)
            if j <= i:
                continue
            if block.boundary.intersection(blocks[j].boundary).length > 1e-10:
                neighbors[i].add(j)
                neighbors[j].add(i)
    overlap = {
        n: [block.intersection(targets[n]).area for block in blocks]
        for n in numbers
    }
    labels, costs, queue = {}, {}, []
    # Give zones with few candidate blocks their seed first.
    order = sorted(numbers, key=lambda n: sum(area > 1e-12 for area in overlap[n]))
    for number in order:
        candidates = [i for i in range(len(blocks))
                      if i not in labels and overlap[number][i] > 1e-12]
        if not candidates:
            raise ValueError(f'No source-bounded seed for zone {number}')
        seed = max(candidates, key=lambda i: overlap[number][i])
        labels[seed], costs[seed] = number, 0
        heapq.heappush(queue, (0, number, seed))

    def grow():
        while queue:
            cost, number, i = heapq.heappop(queue)
            if labels[i] != number or costs[i] != cost:
                continue
            for j in sorted(neighbors[i]):
                if j in labels:
                    continue
                fraction = min(1, overlap[number][j] / blocks[j].area)
                total = cost + 1 + (1 - fraction) * 1000
                labels[j], costs[j] = number, total
                heapq.heappush(queue, (total, number, j))

    grow()
    # Detached real coastal pieces retain a geographic assignment without
    # asserting any transport connection across water.
    for i, block in enumerate(blocks):
        if i in labels:
            continue
        number = max(numbers, key=lambda n: overlap[n][i])
        if overlap[number][i] == 0:
            number = min(numbers, key=lambda n: targets[n].distance(block))
        labels[i], costs[i] = number, 0
        heapq.heappush(queue, (0, number, i))
        grow()
    groups = {
        number: unary_union([block for i, block in enumerate(blocks) if labels[i] == number])
        for number in numbers
    }
    for number, geometry in groups.items():
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError(f'Invalid source-block zone {number}')
    return groups
