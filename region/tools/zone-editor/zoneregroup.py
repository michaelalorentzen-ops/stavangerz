"""Group L2 zones into L1 zones that follow Stavanger's districts and the neighbouring municipalities.

Every L3 zone goes to the district holding most of its area. An L2 zone whose L3 zones fall in different districts
is split, and a part with a single L3 zone joins a neighbouring L2 zone in the same district. A district with
many L2 zones is divided into several L1 zones named after the largest place in each.
"""
import math
from collections import Counter, defaultdict

import zonelib as z
import shapely
import numpy as np  # noqa: F401  (contains_xy takes arrays)

from zoneadmin import NAMES, admin_shapes

DISTRICTS = ['hundvag', 'storhaug', 'eiganes', 'madla', 'tasta', 'hillevag', 'hinna',
             'randaberg', 'sola', 'sandnes', 'rennesoy', 'finnoy']
L3_PER_L1 = 55     # a district with more L3 zones than SPLIT_ABOVE is divided into L1 zones of about this size
SPLIT_ABOVE = 75
# Town centres that OSM tags as town/city, which the area build does not keep as places.
HOMES = {'sandnes': ('Sandnes', 'town', 5.7350, 58.8517)}
MIN_L3_PER_L2 = 3
MAX_L3_PER_L2 = 9
# Existing L1 ids that keep their identity: the game's region-001 is Hundvåg.
KEEP_L1 = {'hundvag': 'region-001'}


def cell_table(project):
    rows = []
    for area in project['areas']:
        for f in z.read_json(z.area_dir(area['id']) / 'cells.geojson', {'features': []})['features']:
            p = f['properties']
            rows.append((p['k'], p['x'], p['y'], p['a']))
    return rows


def district_of_cells(rows):
    shapes = admin_shapes()
    xs = np.array([r[1] for r in rows])
    ys = np.array([r[2] for r in rows])
    result = np.full(len(rows), None, dtype=object)
    for key in DISTRICTS:
        geometry = shapes[key]
        shapely.prepare(geometry)
        inside = shapely.contains_xy(geometry, xs, ys)
        result[inside & (result == None)] = key  # noqa: E711 (numpy comparison)
    return {rows[i][0]: result[i] for i in range(len(rows))}


def regroup(project, log=print):
    zones = {x['id']: x for x in project['zones']}
    rows = cell_table(project)
    area_of = {r[0]: r[3] for r in rows}
    centre = {r[0]: (r[1], r[2]) for r in rows}
    district_cell = district_of_cells(rows)
    assign = project['assignments']

    # L3 -> district by area
    weight = defaultdict(Counter)
    l3_xy = defaultdict(lambda: [0., 0., 0.])
    for key, zone_id in assign.items():
        if key not in area_of or zone_id not in zones:
            continue
        district = district_cell.get(key)
        if district:
            weight[zone_id][district] += area_of[key]
        acc = l3_xy[zone_id]
        acc[0] += centre[key][0] * area_of[key]
        acc[1] += centre[key][1] * area_of[key]
        acc[2] += area_of[key]
    l3_district = {zid: counts.most_common(1)[0][0] for zid, counts in weight.items()}
    l3_point = {zid: (a[0] / a[2], a[1] / a[2]) for zid, a in l3_xy.items() if a[2]}

    # L3 adjacency, for joining stray pieces
    neighbours = defaultdict(set)
    for area in project['areas']:
        for f in z.read_json(z.area_dir(area['id']) / 'edges.geojson', {'features': []})['features']:
            a, b = assign.get(f['properties']['a']), assign.get(f['properties']['b'])
            if a and b and a != b:
                neighbours[a].add(b)
                neighbours[b].add(a)

    # Split L2 zones that cross district lines
    l3_of = defaultdict(list)
    for zone in project['zones']:
        if zone['level'] == 3 and zone['id'] in l3_district:
            l3_of[zone.get('parentId')].append(zone)
    l2_district = {}
    for l2_id, children in list(l3_of.items()):
        parts = defaultdict(list)
        for child in children:
            parts[l3_district[child['id']]].append(child)
        ranked = sorted(parts.items(), key=lambda kv: -sum(weight[c['id']].total() for c in kv[1]))
        l2_district[l2_id] = ranked[0][0]
        for district, members in ranked[1:]:
            if len(members) == 1:
                continue  # placed below
            source = zones[l2_id]
            new = {'id': z.new_zone_id(project, 2), 'name': f"{source['name']} ({NAMES[district]})", 'level': 2,
                   'parentId': source.get('parentId'), 'locked': False}
            project['zones'].append(new)
            zones[new['id']] = new
            l2_district[new['id']] = district
            for child in members:
                child['parentId'] = new['id']
    # Single L3 zones in the wrong district join a neighbouring L2 zone there.
    for zone in project['zones']:
        if zone['level'] != 3 or zone['id'] not in l3_district:
            continue
        district = l3_district[zone['id']]
        if l2_district.get(zone.get('parentId')) == district:
            continue
        options = Counter(zones[n]['parentId'] for n in neighbours[zone['id']]
                          if n in zones and l2_district.get(zones[n].get('parentId')) == district)
        if options:
            zone['parentId'] = options.most_common(1)[0][0]
        else:
            new = {'id': z.new_zone_id(project, 2), 'name': zone['name'], 'level': 2, 'locked': False}
            project['zones'].append(new)
            zones[new['id']] = new
            l2_district[new['id']] = district
            zone['parentId'] = new['id']

    merge_small_l2(project, zones, l2_district, neighbours, l3_point)
    split_large_l2(project, zones, l2_district, l3_point)
    # Drop L2 zones left without children
    children_count = Counter(x.get('parentId') for x in project['zones'] if x['level'] == 3)
    project['zones'] = [x for x in project['zones'] if x['level'] != 2 or children_count[x['id']]]
    zones = {x['id']: x for x in project['zones']}

    # L2 centres
    l2_point = {}
    for l2 in (x for x in project['zones'] if x['level'] == 2):
        pts = [(l3_point[c['id']], weight[c['id']].total()) for c in project['zones']
               if c['level'] == 3 and c.get('parentId') == l2['id'] and c['id'] in l3_point]
        total = sum(w for _, w in pts) or 1
        l2_point[l2['id']] = (sum(p[0] * w for p, w in pts) / total, sum(p[1] * w for p, w in pts) / total)

    # L1 zones per district, several where a district has many L2 zones
    places = place_points(project)
    old_l1 = [x['id'] for x in project['zones'] if x['level'] == 1]
    by_district = defaultdict(list)
    for l2_id, district in l2_district.items():
        if l2_id in zones:
            by_district[district].append(l2_id)
    new_l1 = []
    for district in DISTRICTS:
        members = by_district.get(district)
        if not members:
            continue
        l3_count = sum(1 for x in project['zones'] if x['level'] == 3 and x.get('parentId') in members)
        groups = split_groups(members, l2_point, round(l3_count / L3_PER_L1) if l3_count > SPLIT_ABOVE else 1)
        # The group nearest the place the district is named after keeps the name (else the biggest group);
        # the others are named after their largest place.
        groups.sort(key=lambda g: -sum(1 for x in project['zones'] if x['level'] == 3 and x.get('parentId') in g))
        home = HOMES.get(district) or next((p for p in places if p[0] == NAMES[district].split(' og ')[0]), None)
        if home and len(groups) > 1:
            def distance(group):
                return min(math.hypot((l2_point[m][0] - home[2]) * .52, l2_point[m][1] - home[3]) for m in group)
            groups.sort(key=distance)
        used = {NAMES[district].split(' ')[0]}
        for index, group in enumerate(groups):
            if len(groups) == 1:
                name = NAMES[district]
            elif index == 0:
                name = NAMES[district].split(' og ')[0]
            elif district == 'hundvag' and index == 1:
                name = 'Byøyene'
            else:
                name = group_name(group, l2_point, places, NAMES[district], used)
            zone_id = KEEP_L1.get(district) if index == 0 and district in KEEP_L1 else None
            if zone_id and zone_id in zones:
                zones[zone_id]['name'] = name
            else:
                zone_id = next_id(project, 1)
                zone = {'id': zone_id, 'name': name, 'level': 1, 'locked': False}
                project['zones'].append(zone)
                zones[zone_id] = zone
            new_l1.append(zone_id)
            for l2_id in group:
                zones[l2_id]['parentId'] = zone_id
    keep = set(new_l1)
    project['zones'] = [x for x in project['zones'] if x['level'] != 1 or x['id'] in keep]
    rename_zones(project)
    zones = {x['id']: x for x in project['zones']}
    summary = Counter(zones[x['parentId']]['name'] for x in project['zones'] if x['level'] == 2)
    log(dict(summary))
    return summary


def merge_small_l2(project, zones, l2_district, neighbours, l3_point):
    """L2 zones with fewer than MIN_L3_PER_L2 children join the smallest touching (else nearest) L2 in the district."""
    def children(l2_id):
        return [x for x in project['zones'] if x['level'] == 3 and x.get('parentId') == l2_id]

    def centre(l2_id):
        pts = [l3_point[c['id']] for c in children(l2_id) if c['id'] in l3_point]
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else None

    stuck = set()
    changed = True
    while changed:
        changed = False
        sizes = Counter(x.get('parentId') for x in project['zones'] if x['level'] == 3)
        for l2_id in sorted((k for k in l2_district if sizes[k]), key=lambda k: sizes[k]):
            if sizes[l2_id] >= MIN_L3_PER_L2 or l2_id in stuck:
                continue
            district = l2_district[l2_id]
            kids = children(l2_id)
            touching = {zones[n]['parentId'] for c in kids for n in neighbours[c['id']]
                        if n in zones and zones[n].get('parentId') not in (l2_id, None)}
            fits = lambda k: sizes[k] + len(kids) <= MAX_L3_PER_L2
            options = [k for k in touching if l2_district.get(k) == district and sizes[k] and fits(k)]
            if not options:
                here = centre(l2_id)
                others = [k for k, d in l2_district.items() if d == district and k != l2_id and sizes[k] and fits(k)]
                if not here or not others:
                    stuck.add(l2_id)
                    continue
                options = [min(others, key=lambda k: math.dist(here, centre(k) or (999, 999)))]
            target = min(options, key=lambda k: sizes[k])
            for child in kids:
                child['parentId'] = target
            changed = True
            break


def split_large_l2(project, zones, l2_district, l3_point):
    """L2 zones with more than MAX_L3_PER_L2 children are halved geographically until they fit."""
    for l2 in [x for x in project['zones'] if x['level'] == 2]:
        kids = [x['id'] for x in project['zones'] if x['level'] == 3 and x.get('parentId') == l2['id'] and x['id'] in l3_point]
        if len(kids) <= MAX_L3_PER_L2:
            continue
        groups = split_groups(kids, l3_point, math.ceil(len(kids) / 7))
        for index, group in enumerate(groups[1:], 2):
            new = {'id': z.new_zone_id(project, 2), 'name': f"{l2['name']} ({index})", 'level': 2,
                   'parentId': l2.get('parentId'), 'locked': False}
            project['zones'].append(new)
            zones[new['id']] = new
            l2_district[new['id']] = l2_district.get(l2['id'])
            for kid in group:
                zones[kid]['parentId'] = new['id']


def next_id(project, level):
    used = {x['id'] for x in project['zones']}
    number = 1
    while f'z{level}-{number:04d}' in used:
        number += 1
    return f'z{level}-{number:04d}'


def split_groups(members, points, k):
    """k balanced geographic groups by repeatedly halving along the longer side."""
    if k <= 1 or len(members) <= 1:
        return [members]
    xs = [points[m][0] * math.cos(math.radians(59)) for m in members]
    ys = [points[m][1] for m in members]
    axis = 0 if max(xs) - min(xs) > max(ys) - min(ys) else 1
    ordered = sorted(members, key=lambda m: points[m][axis])
    first = k // 2
    cut = round(len(ordered) * first / k)
    return split_groups(ordered[:cut], points, first) + split_groups(ordered[cut:], points, k - first)


def place_points(project):
    result = []
    for area in project['areas']:
        for p in z.read_json(z.area_dir(area['id']) / 'places.json', []):
            if p['kind'] in ('suburb', 'village', 'town', 'quarter', 'neighbourhood', 'island', 'hamlet'):
                lon, lat = z._to_wgs.transform(p['x'], p['y'])
                result.append((p['name'], p['kind'], lon, lat))
    return result


def group_name(group, points, places, fallback, used):
    xs = [points[m][0] for m in group]
    ys = [points[m][1] for m in group]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    rank = {'town': 0, 'suburb': 1, 'village': 2, 'quarter': 3, 'island': 4, 'neighbourhood': 5, 'hamlet': 6}
    near = sorted(places, key=lambda p: (rank[p[1]], math.hypot((p[2] - cx) * .52, p[3] - cy)))
    radius = max(max(math.hypot((x - cx) * .52, y - cy) for x, y in zip(xs, ys)), .004)
    for name, kind, lon, lat in near:
        if math.hypot((lon - cx) * .52, lat - cy) <= radius and name not in used:
            used.add(name)
            return name
    name = f'{fallback} {len(used) + 1}'
    used.add(name)
    return name


if __name__ == '__main__':
    import sys
    project = z.load_project()
    regroup(project)
    if '--save' in sys.argv:
        z.save_project(project)


PLACE_RANK = ['town', 'village', 'suburb', 'quarter', 'neighbourhood', 'hamlet', 'island', 'locality', 'farm',
              'isolated_dwelling', 'islet']


# L2 zones are named after settled places only, not after a business or facility that OSM tags as a locality.
L2_RANK = ['town', 'village', 'suburb', 'island', 'quarter', 'neighbourhood', 'hamlet', 'locality']
L2_KINDS = set(L2_RANK)
NOT_A_PLACE = ('senter', 'senteret', 'sikkerhet', ' as', 'skole', 'stadion', 'hall', 'kirke', 'butikk', 'arboret')


STREET_ENDINGS = ('veien', 'vegen', 'vei', 'veg', 'gata', 'gate', 'stien', 'tunet', 'krossen', 'ringen', 'motorveien')


def street_like(name):
    return name.lower().split(' ')[-1].endswith(STREET_ENDINGS)


def generated(name):
    return name.startswith('Nytt område') or name.endswith('-området') or '(' in name or name.endswith(' ring')


def rename_zones(project, only=None):
    """Name generated zones (or the zone ids in `only`) after places inside them.

    L3: the most prominent place of any kind, else the main street, else the nearest place.
    L2: a settled place (village, suburb, island and so on), else the name of its L3 zone with most buildings.
    """
    from shapely.geometry import Point, shape
    from shapely.strtree import STRtree
    keys, geoms, street, area, built = [], [], {}, {}, {}
    for a in project['areas']:
        for f in z.read_json(z.area_dir(a['id']) / 'cells.geojson', {'features': []})['features']:
            k = f['properties']['k']
            keys.append(k)
            geoms.append(shapely.make_valid(shape(f['geometry'])))
            street[k], area[k], built[k] = f['properties'].get('st'), f['properties']['a'], f['properties']['n']
    tree = STRtree(geoms)
    assign = project['assignments']
    zones = {x['id']: x for x in project['zones']}

    def up(zone_id, level):
        zone = zones.get(zone_id)
        while zone and zone['level'] > level:
            zone = zones.get(zone.get('parentId'))
        return zone['id'] if zone and zone['level'] == level else None

    def settled(place):
        return place['kind'] in L2_KINDS and not any(w in place['name'].lower() for w in NOT_A_PLACE)

    places = defaultdict(list)  # zone id -> [(rank, name)]
    all_places = []
    for a in project['areas']:
        for p in z.read_json(z.area_dir(a['id']) / 'places.json', []):
            if p['kind'] not in PLACE_RANK:
                continue
            all_places.append((p['name'], p['x'], p['y']))
            lon, lat = z._to_wgs.transform(p['x'], p['y'])
            hits = tree.query(Point(lon, lat), 'intersects')
            if not len(hits):
                continue
            l3 = assign.get(keys[int(hits[0])])
            if l3:
                places[l3].append((PLACE_RANK.index(p['kind']), p['name']))
            l2 = up(l3, 2)
            if l2 and settled(p):
                places[l2].append((L2_RANK.index(p['kind']), p['name']))
    sums = defaultdict(lambda: [0., 0., 0.])
    buildings = Counter()
    for i, key in enumerate(keys):
        l3 = assign.get(key)
        if l3:
            c = geoms[i].representative_point()
            x, y = z._to_utm.transform(c.x, c.y)
            acc = sums[l3]
            acc[0] += x * area[key]; acc[1] += y * area[key]; acc[2] += area[key]
            buildings[l3] += built[key]
    centres = {k: (v[0] / v[2], v[1] / v[2]) for k, v in sums.items() if v[2]}
    streets = defaultdict(Counter)
    for key, l3 in assign.items():
        if street.get(key) and key in area:
            streets[l3][street[key]] += area[key]

    def chosen(zone):
        return zone['id'] in only if only is not None else generated(zone['name'])

    def unique(name, used):
        base, number = name, 2
        while name in used:
            name, number = f'{base} {number}', number + 1
        return name

    for level in (3, 2):
        used = {x['name'] for x in project['zones'] if x['level'] == level and not chosen(x)}
        for zone in sorted((x for x in project['zones'] if x['level'] == level and chosen(x)),
                           key=lambda x: -len(places[x['id']])):
            own = {n for _, n in places[zone['id']]}
            if zone['name'] in own and zone['name'] not in used:
                used.add(zone['name'])  # already named after a place inside it
                continue
            name = next((n for _, n in sorted(set(places[zone['id']])) if n not in used), None)
            if level == 3 and name is None:
                name = next((n for n, _ in streets[zone['id']].most_common() if n not in used), None)
            if level == 3 and name is None and zone['id'] in centres:
                here = centres[zone['id']]
                nearby = sorted((q for q in all_places if math.dist(here, (q[1], q[2])) < 3000),
                                key=lambda q: math.dist(here, (q[1], q[2])))
                name = next((q[0] for q in nearby if q[0] not in used), nearby[0][0] if nearby else None)
            if level == 2 and name is None:
                if not street_like(zone['name']) and not any(w in zone['name'].lower() for w in NOT_A_PLACE)                         and not generated(zone['name']):
                    used.add(zone['name'])  # a place name already; a street name would not be better
                    continue
                kids = [c for c in project['zones'] if c.get('parentId') == zone['id']]
                if kids:
                    name = max(kids, key=lambda c: buildings[c['id']])['name']
            zone['name'] = unique((name or zone['name']).replace('-området', ''), used)
            used.add(zone['name'])
