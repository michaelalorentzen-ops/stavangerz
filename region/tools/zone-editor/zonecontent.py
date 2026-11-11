"""Zone content: measured land use per cell, OpenStreetMap places, and suggested content for each zone.

Cell stats are cached in areas/<id>/stats.json as
  key -> [residential floor m², homes, farmland m², forest m², open land m², industry m², retail m², greenhouse m²,
          shoreline m (sea or lake)]
so the editor can sum them live while zones are repainted.
"""
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import shapely
from shapely.geometry import Point, Polygon, shape
from shapely.strtree import STRtree

import zonelib as z
import zonear5
from zonefeatures import fetch_features

CATALOG_PATH = z.ROOT / 'packages/world-data/data/content-catalog.json'
OSM_FIELDS = ['floor', 'homes', 'farm', 'forest', 'open', 'industry', 'retail', 'greenhouse', 'coast']
STAT_FIELDS = OSM_FIELDS + zonear5.FIELDS
STATS_VERSION = 3
SHORE_REACH = 12  # m; parcel lines often stop a few metres short of the mapped shoreline.
# Land cover precedence: a park inside an industrial site counts as industry.
COVER = [
    ('industry', {'landuse': {'industrial', 'port', 'quarry', 'railway', 'landfill', 'military'}}),
    ('retail', {'landuse': {'retail', 'commercial'}}),
    ('greenhouse', {'landuse': {'greenhouse_horticulture'}}),
    ('farm', {'landuse': {'farmland', 'meadow', 'orchard', 'allotments', 'plant_nursery'}}),
    ('forest', {'landuse': {'forest'}, 'natural': {'wood', 'scrub'}}),
    ('open', {'landuse': {'grass', 'recreation_ground', 'village_green', 'flowerbed'},
              'leisure': {'park', 'pitch', 'golf_course', 'garden'}, 'natural': {'grassland', 'heath'}}),
]
EARLY_SEASON = .5  # share of a full harvest the first season, before tools and seed stock are sorted out


def catalog():
    return json.loads(CATALOG_PATH.read_text(encoding='utf-8'))


# ------------------------------------------------------------------ cell stats

def _cover_class(tags):
    for name, rules in COVER:
        if any(tags.get(k) in values for k, values in rules.items()):
            return name
    return None


def _osm_layers(area_id):
    osm = z.read_json(z.IMPORTS / area_id / 'osm.json')
    floors = catalog()['yields']['residentialFloors']
    covers = defaultdict(list)
    homes = []  # (polygon, floor area)
    greenhouses = []
    shore = []
    for element in osm['elements']:
        tags = element.get('tags', {})
        if element['type'] != 'way' or not element.get('geometry') or len(element['geometry']) < 2:
            continue
        points = element['geometry']
        if tags.get('natural') in ('coastline', 'water'):
            xs, ys = z._to_utm.transform([p['lon'] for p in points], [p['lat'] for p in points])
            shore.append(shapely.LineString(list(zip(xs, ys))))
            continue
        if len(points) < 4:
            continue
        if (points[0]['lat'], points[0]['lon']) != (points[-1]['lat'], points[-1]['lon']):
            continue
        building = tags.get('building')
        cover = None if building else _cover_class(tags)
        if not building and not cover:
            continue
        xs, ys = z._to_utm.transform([p['lon'] for p in points], [p['lat'] for p in points])
        polygon = shapely.make_valid(Polygon(list(zip(xs, ys))))
        if polygon.is_empty or polygon.area < 4:
            continue
        if building == 'greenhouse':
            greenhouses.append(polygon)
        elif building in floors and building != 'yes':
            try:
                levels = float(tags.get('building:levels', '').replace(',', '.'))
            except ValueError:
                levels = floors[building]
            homes.append((polygon, polygon.area * max(1., min(levels, 20.))))
        elif cover:
            covers[cover].append(polygon)
    return covers, homes, greenhouses, shore


def compute_cell_stats(area_id, keys=None, log=print):
    """Stats for the area's cells (or only `keys`). Returns {key: [..STAT_FIELDS]}."""
    cells = z.read_json(z.area_dir(area_id) / 'cells.geojson')['features']
    if keys is not None:
        cells = [f for f in cells if f['properties']['k'] in keys]
    if not cells:
        return {}
    log(f'Måler arealbruk i {len(cells)} celler')
    covers, homes, greenhouses, shore = _osm_layers(area_id)
    geometries = [shapely.union_all(z.polygons_of(z.to_utm(shapely.make_valid(shape(f['geometry']))))) for f in cells]
    out = {f['properties']['k']: [0.] * len(STAT_FIELDS) for f in cells}
    keys_list = [f['properties']['k'] for f in cells]
    tree = STRtree(geometries)
    # Buildings: by representative point, so a house is counted once.
    if homes:
        points = [p.representative_point() for p, _ in homes]
        building_index, cell_index = tree.query(points, predicate='within')
        for b, c in zip(building_index.tolist(), cell_index.tolist()):
            row = out[keys_list[c]]
            row[0] += homes[b][1]
            row[1] += 1
    if greenhouses:
        points = [p.representative_point() for p in greenhouses]
        building_index, cell_index = tree.query(points, predicate='within')
        for b, c in zip(building_index.tolist(), cell_index.tolist()):
            out[keys_list[c]][7] += greenhouses[b].area
    if shore:
        frame = shapely.box(*shapely.total_bounds(geometries)).buffer(50)
        reach = [part for part in z.polygons_of(shapely.union_all(shapely.buffer(shore, SHORE_REACH)).intersection(frame))]
        shore_tree = STRtree(reach)
        for i, cell in enumerate(geometries):
            hits = shore_tree.query(cell, 'intersects')
            if len(hits):
                near = shapely.union_all([reach[h] for h in hits.tolist()])
                out[keys_list[i]][8] += cell.boundary.intersection(near).length
    trees = {name: (STRtree(polys), polys) for name, polys in covers.items() if polys}
    for i, cell in enumerate(geometries):
        taken = None
        for name, _ in COVER:
            if name not in trees:
                continue
            ctree, polys = trees[name]
            hits = ctree.query(cell, 'intersects')
            if not len(hits):
                continue
            part = shapely.union_all([cell.intersection(polys[h]) for h in hits.tolist()])
            if taken is not None:
                part = part.difference(taken)
            area = part.area
            if area < 1:
                continue
            column = STAT_FIELDS.index(name)
            out[keys_list[i]][column] += area
            taken = part if taken is None else taken.union(part)
    land = zonear5.cell_areas(geometries, log)
    for i, key in enumerate(keys_list):
        out[key][len(OSM_FIELDS):] = land[i].tolist()
    return {k: [round(v) for v in row] for k, row in out.items()}


def ensure_stats(area_id, log=print):
    """Load the cached stats, measuring cells that are new since (after cuts or a rebuild)."""
    path = z.area_dir(area_id) / 'stats.json'
    stats = z.read_json(path, {})
    if stats.get('_version') != STATS_VERSION:
        stats = {'_version': STATS_VERSION}
    keys = {f['properties']['k'] for f in z.read_json(z.area_dir(area_id) / 'cells.geojson')['features']}
    missing = keys - set(stats)
    stale = set(stats) - keys - {'_version'}
    if missing:
        stats.update(compute_cell_stats(area_id, missing, log))
    for key in stale:
        stats.pop(key)
    if missing or stale or not path.exists():
        z.write_json(path, stats)
    return stats


# ------------------------------------------------------------------ OSM places

def _element_point(element):
    if 'center' in element:
        return element['center']['lon'], element['center']['lat']
    if 'lon' in element:
        return element['lon'], element['lat']
    return None


def _footprints(area_id):
    """Areas of OSM ways by id, from the area's main extract (buildings and land use)."""
    osm = z.read_json(z.IMPORTS / area_id / 'osm.json')
    result = {}
    for element in osm['elements']:
        points = element.get('geometry')
        if element['type'] == 'way' and points and len(points) >= 4:
            xs, ys = z._to_utm.transform([p['lon'] for p in points], [p['lat'] for p in points])
            result[element['id']] = abs(Polygon(list(zip(xs, ys))).area)
    return result


def place_features(project, log=print):
    """OSM places in the project's cells: [{id, tags, lon, lat, cell, m2}]. One entry per OSM object."""
    seen = {}
    for area in project['areas']:
        if area.get('status') != 'ready':
            continue
        cells = z.read_json(z.area_dir(area['id']) / 'cells.geojson')['features']
        geometries = [shapely.make_valid(shape(f['geometry'])) for f in cells]
        tree = STRtree(geometries)
        sizes = _footprints(area['id'])
        for element in fetch_features(area, log)['elements']:
            oid = f"osm:{element['type']}/{element['id']}"
            position = _element_point(element)
            if oid in seen or not position:
                continue
            hits = tree.query(Point(position), 'within')
            if not len(hits):
                continue
            seen[oid] = {'id': oid, 'tags': element.get('tags', {}), 'lon': round(position[0], 7),
                         'lat': round(position[1], 7), 'cell': cells[int(hits[0])]['properties']['k'],
                         'm2': round(sizes.get(element['id'], 0)) if element['type'] == 'way' else 0}
    return list(seen.values())


# ------------------------------------------------------------------ classification of places

def _name(tags):
    return (tags.get('name') or tags.get('official_name') or tags.get('operator') or '').split(';')[0].strip()


def classify_place(tags, m2):
    """(role, typeId, kind) for an OSM place, or None when it is not interesting enough to suggest."""
    amenity, shop, building = tags.get('amenity'), tags.get('shop'), tags.get('building')
    man_made, power, landuse = tags.get('man_made'), tags.get('power'), tags.get('landuse')
    name = _name(tags).lower()
    if (landuse == 'military' or tags.get('military')) and (
            tags.get('military') in ('range', 'danger_area') or 'skyte' in name or 'øvingsfelt' in name):
        return 'resource', 'shootingRange', 'military'
    if tags.get('aeroway') == 'aerodrome':
        return 'hq', 'airport', 'transport'
    if (landuse == 'military' or tags.get('military') in ('naval_base', 'airfield', 'base')) and _name(tags)             and tags.get('building') is None:
        return 'hq', 'military', 'military'
    if amenity == 'prison' and 'overgangsbolig' not in name:
        return 'hq', 'prison', 'police'
    if amenity == 'hospital':
        if 'universitetssjukehus' in name or 'universitetssykehus' in name:
            return ('hq', 'hospital', 'medical') if 'psykiatr' not in name and 'administrasjon' not in name else None
        return 'resource', 'clinic', 'medical'
    if shop in ('mall', 'department_store') and (m2 >= 4000 and building != 'office' or building == 'mall'):
        return 'hq', 'mall', 'supplies'
    if amenity in ('university', 'college') and _name(tags) and m2 >= 3000:
        return 'hq', 'school', 'school'
    if amenity == 'school' and m2 >= 6000:
        return 'hq', 'school', 'school'
    if building == 'cathedral':
        return 'hq', 'refuge', 'other'
    if tags.get('industrial') == 'shipyard' or (landuse == 'industrial' and 'verft' in name):
        return 'hq', 'shipyard', 'industrial'
    # Strategic facilities
    if power == 'substation' and ('transformator' in name or tags.get('substation') == 'transmission'):
        return 'facility', 'substation', 'power'
    if man_made in ('communications_tower',) or (tags.get('tower:type') == 'communication' and _name(tags)):
        return 'facility', 'commsTower', 'comms'
    if man_made == 'water_works':
        return 'facility', 'waterworks', 'water'
    if man_made == 'water_tower':
        return 'facility', 'waterTower', 'water'
    if man_made == 'wastewater_plant':
        return 'facility', 'wastewater', 'water'
    if (man_made == 'storage_tank' and tags.get('content') in ('fuel', 'oil', 'diesel', 'petrol')):
        return 'facility', 'fuelDepot', 'fuel'
    if amenity == 'ferry_terminal':
        return 'facility', 'ferry', 'port'
    if landuse == 'port' or tags.get('harbour') == 'yes' and _name(tags):
        return 'facility', 'harbour', 'port'
    if amenity == 'fire_station':
        return 'facility', 'fireStation', 'police'
    if amenity == 'police' and 'politi' in name:
        return 'facility', 'police', 'police'
    if landuse == 'landfill':
        return 'facility', 'landfill', 'industrial'
    # Resource sites, most of them emptied over time
    if amenity == 'pharmacy' or shop == 'chemist':
        return 'resource', 'pharmacy', 'medical'
    if amenity == 'clinic':
        return 'resource', 'clinic', 'medical'
    if shop in ('weapons', 'hunting'):
        return 'resource', 'gunShop', 'supplies'
    if shop in ('outdoor', 'sports', 'fishing'):
        return 'resource', 'outdoorShop', 'supplies'
    if tags.get('sport') in ('shooting', 'shooting_range') or tags.get('military') == 'range':
        return 'resource', 'shootingRange', 'sports'
    if shop in ('hardware', 'doityourself', 'trade'):
        return 'resource', 'hardware', 'supplies'
    if shop in ('electronics', 'computer', 'mobile_phone'):
        return 'resource', 'electronics', 'supplies'
    if shop in ('car_repair', 'car_parts'):
        return 'resource', 'carRepair', 'industrial'
    if amenity == 'fuel':
        return 'resource', 'fuelStation', 'fuel'
    if shop == 'supermarket' or shop == 'wholesale':
        return 'resource', 'supermarket', 'supplies'
    if tags.get('leisure') == 'marina' or shop == 'boat':
        return 'resource', 'marina', 'port'
    if amenity in ('school', 'college', 'university') and _name(tags):
        return 'resource', 'school', 'school'
    if power in ('plant', 'generator') and 'solar' in tags.get('generator:source', '') + tags.get('plant:source', '')             and (_name(tags) or power == 'plant'):
        return 'resource', 'solarRoof', 'power'
    if landuse == 'quarry':
        return 'resource', 'quarry', 'industrial'
    if landuse == 'greenhouse_horticulture':
        return 'resource', 'greenhouse', 'farm'
    if tags.get('craft') in ('boatbuilder', 'metal_construction', 'welder', 'blacksmith'):
        return 'resource', 'industry', 'industrial'
    return None


# ------------------------------------------------------------------ zone measures

def zone_measures(project, stats, cells, edges):
    """Per zone id (all levels): measured totals. Same sums as the editor makes live."""
    zones = {x['id']: x for x in project['zones']}
    assign = project['assignments']
    totals = defaultdict(lambda: defaultdict(float))

    def chain(zone_id):
        while zone_id in zones:
            yield zone_id
            zone_id = zones[zone_id].get('parentId')

    for key, cell in cells.items():
        zone_id = assign.get(key)
        if zone_id not in zones:
            continue
        row = stats.get(key, [0] * len(STAT_FIELDS))
        for zid in chain(zone_id):
            t = totals[zid]
            t['m2'] += cell['a']
            t['buildings'] += cell['n']
            for name, value in zip(STAT_FIELDS, row):
                t[name] += value
            t['coastM'] = t['coast']
    for t in totals.values():
        derive(t)
    for a, b, length in edges:
        za, zb = assign.get(a), assign.get(b)
        if za == zb or za not in zones or zb not in zones:
            continue
        pa, pb = set(chain(za)), set(chain(zb))
        for zid in pa ^ pb:
            totals[zid]['landEdgeM'] += length
    return totals


def derive(m):
    """Use AR5 for farmland and forest where it was read; OpenStreetMap otherwise. Adds pasture, bog, rock, built."""
    if sum(m.get(f, 0) for f in zonear5.FIELDS) > 0:
        m['farm'] = m['arFull'] + m['arSurface']
        m['forest'] = m['arForest']
        m['pasture'] = m['arPasture']
        m['bog'], m['rock'], m['built'] = m['arBog'], m['arRock'], m['arBuilt']
    else:
        m['pasture'] = m['bog'] = m['rock'] = m['built'] = 0
    return m


def capacity(measures, yields):
    """Concrete numbers from measures: people housed, food per year, water share of the boundary."""
    housing = measures['floor'] / yields['floorM2PerPerson']
    field = measures['farm'] / 1e4 * yields['fieldFoodPerHaYear']
    gardens = max(measures['open'], measures.get('built', 0) * yields['gardenShareOfBuilt'])
    open_land = (measures.get('pasture', 0) * yields['pastureFoodPerHaYear'] + gardens * yields['openLandFoodPerHaYear']) / 1e4
    greenhouse = measures['greenhouse'] * yields['greenhouseFoodPerM2Year']
    edge = measures['coastM'] + measures['landEdgeM']
    return {'housing': round(housing), 'fieldFood': round(field), 'openFood': round(open_land),
            'greenhouseFood': round(greenhouse), 'waterEdge': round(measures['coastM'] / edge, 2) if edge else 0}


def level(value, steps):
    return sum(value >= s for s in steps)


# ------------------------------------------------------------------ suggestions

def _zone_type(m, places):
    area = max(m['m2'], 1)
    kinds = [p['typeId'] for p in places]
    share = {k: m[k] / area for k in ('farm', 'forest', 'open', 'industry', 'retail')}
    homes_density = m['homes'] / (area / 1e4)
    scores = {
        'jordbruk': (m['farm'] + .6 * m.get('pasture', 0)) / area * 2.4 + m['greenhouse'] / area * 3,
        'natur': (m['forest'] + .6 * m.get('rock', 0) + .6 * m.get('bog', 0)) / area * 1.6
                 + (share['open'] * .6 if homes_density < 5 else 0),
        'industri': share['industry'] * 2.2,
        'sentrum': share['retail'] * 2.2 + .13 * sum(k in ('supermarket', 'mall', 'pharmacy', 'electronics', 'hardware', 'clinic', 'gunShop')
                                                      for k in kinds),
        'institusjon': .7 * sum(p['typeId'] in ('hospital', 'school', 'prison', 'military', 'airport')
                                for p in places if p['role'] == 'hq'),
        'kai': .45 * sum(k in ('harbour', 'ferry', 'marina') for k in kinds) + (.15 if m['coastM'] > 300 and share['industry'] > .2 else 0),
        # Built-up land (AR5) counts towards housing only where there are homes, and never beats a clear town centre.
        'bolig': max(min(homes_density / 12, 1.2), min(m.get('built', 0) / area * 1.8, .8) if homes_density >= 2 else 0) + .1,
        'infrastruktur': .6 * sum(k in ('substation', 'waterworks', 'wastewater', 'fuelDepot', 'landfill') for k in kinds),
    }
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    (best, s1), (second, s2) = ranked[0], ranked[1]
    if best == 'bolig' and s2 > .55 and second in ('sentrum', 'industri', 'kai'):
        return 'blandet'
    if best != 'bolig' and best in ('sentrum', 'industri') and scores['bolig'] > .9 * s1:
        return 'blandet'
    return best


def _potential(m, cap, places):
    kinds = [p['typeId'] for p in places]
    grow_ha = (m['farm'] + m.get('pasture', 0) * .5 + m['open'] * .6 + m['greenhouse'] * 3) / 1e4
    transport = sum(k in ('harbour', 'ferry', 'marina', 'fuelStation', 'airport') for k in kinds) + (1 if m['coastM'] > 400 else 0)
    defence = (3 if any(k in ('military', 'prison') for k in kinds)
               else level(cap['waterEdge'], (.25, .45, .65)))
    return {
        'bolig': level(cap['housing'], (40, 300, 1000)),
        'dyrking': level(grow_ha, (.5, 3, 10)),
        'skog': level(m['forest'] / 1e4, (1, 5, 20)),
        'industri': level(m['industry'] / 1e4 + .5 * sum(k in ('industry', 'carRepair', 'shipyard') for k in kinds), (.5, 3, 10)),
        'transport': min(3, transport),
        'forsvar': defence,
    }


def _finds_and_produces(m, places, sites, extras, kinds):
    """What can be found once and what can be produced, from places, land use and everyday things.

    Every home has a car in the drive, tools and a medicine cabinet; farms have tractors, diesel and hunting rifles;
    boathouses hold boats. Rare things (primers, antibiotics, 3D printers) come only from particular places.
    """
    finds, produces = set(), set()
    for p in places:
        definition = kinds.get(p['role'], {}).get(p['typeId'])
        if definition:
            finds.update(definition.get('finds', []))
            produces.update(definition.get('produces', []))
    if m['homes'] >= 20:
        finds.update(['food', 'medicine', 'building', 'fuel', 'parts', 'batteries'])
    elif m['homes'] >= 3:
        finds.update(['food', 'medicine', 'fuel'])
    if extras.get('barns', 0) >= 2 or m['farm'] >= 2e4:
        finds.update(['fuel', 'engine', 'generator', 'ammo', 'parts'])
    if extras.get('boathouses', 0) >= 3:
        finds.update(['boat', 'engine'])
    if extras.get('solar', 0) >= 1:
        finds.update(['solar', 'batteries'])
    if m['industry'] > 5000:
        finds.update(['metal', 'parts', 'building'])
    if m['farm'] >= 1e4 or m['greenhouse'] >= 500 or m.get('pasture', 0) >= 2e4:
        produces.add('farming')
    if m['coastM'] >= 150:
        produces.add('fishing')
    if m['forest'] >= 2e4:
        produces.add('timber')
    order = [r['id'] for r in catalog()['resources']]
    return sorted(finds, key=order.index), sorted(produces, key=order.index)


CHOKE_WORDS = ('bru', 'broen', 'brua', 'tunnel', 'tunell')
CHOKE_MIN = {'bridge': 60, 'tunnel': 150}  # m; shorter named structures are overpasses and underpasses


def chokepoints(project, locate, log=print):
    """Named road bridges and tunnels: [{kind, name, lengthM, ends: [[lon, lat], ...]}], one per structure.

    Carriageways and segments of the same name that lie close together form one structure. Its ends are the two
    segment end points farthest apart, moved to the nearest cell when they lie in water.
    """
    import shapely
    from shapely.geometry import LineString
    seen, segments = set(), defaultdict(list)
    for area in project['areas']:
        for element in z.read_json(z.IMPORTS / area['id'] / 'osm.json', {'elements': []})['elements']:
            tags = element.get('tags', {})
            if element['type'] != 'way' or element['id'] in seen or tags.get('highway') not in z.STREET | z.MAJOR:
                continue
            kind = 'bridge' if tags.get('bridge') not in (None, 'no') else                 'tunnel' if tags.get('tunnel') not in (None, 'no', 'building_passage') else None
            name = tags.get('bridge:name') or tags.get('tunnel:name') or tags.get('name') or ''
            if not kind or not any(w in name.lower() for w in CHOKE_WORDS) or 'kulvert' in name.lower():
                continue
            seen.add(element['id'])
            xs, ys = z._to_utm.transform([q['lon'] for q in element['geometry']], [q['lat'] for q in element['geometry']])
            segments[(kind, name)].append(LineString(list(zip(xs, ys))))
    result = []
    for (kind, name), lines in sorted(segments.items()):
        groups = []
        for line in lines:  # join segments within 80 m of a group
            near = [g for g in groups if any(line.distance(other) < 80 for other in g)]
            merged = [line] + [x for g in near for x in g]
            groups = [g for g in groups if g not in near] + [merged]
        for index, group in enumerate(groups):
            length = max(line.length for line in group) if len(group) > 1 else group[0].length
            length = max(length, shapely.union_all(group).length / max(1, round(len(group) / 2)))
            if length < CHOKE_MIN[kind]:
                continue
            points = [pt for line in group for pt in (line.coords[0], line.coords[-1])]
            a, b = max(((p1, p2) for p1 in points for p2 in points), key=lambda pair: math.dist(*pair))
            ends = []
            for x, y in (a, b):
                lon, lat = z._to_wgs.transform(x, y)
                ends.append([round(lon, 7), round(lat, 7)])
            label = name if len(groups) == 1 else f'{name} {index + 1}'
            result.append({'kind': kind, 'name': label, 'lengthM': round(math.dist(a, b)), 'ends': ends,
                           'id': f"choke:{kind}:{label}"})
    return result


def zone_extras(project, locate_many, log=print):
    """Per L3 zone: boathouses, barns and solar installations, which the cell stats do not count."""
    points, kinds = [], []
    for area in project['areas']:
        for element in z.read_json(z.IMPORTS / area['id'] / 'osm.json', {'elements': []})['elements']:
            tags = element.get('tags', {})
            kind = {'boathouse': 'boathouses', 'barn': 'barns', 'farm_auxiliary': 'barns'}.get(tags.get('building'))
            if kind and element.get('geometry'):
                g = element['geometry'][0]
                points.append((g['lon'], g['lat']))
                kinds.append(kind)
        path = z.IMPORTS / area['id'] / 'features.json'
        for element in (z.read_json(path)['elements'] if path.exists() else []):
            tags = element.get('tags', {})
            if tags.get('power') in ('generator', 'plant') and 'solar' in (tags.get('generator:source', '') + tags.get('plant:source', '')):
                position = _element_point(element)
                if position:
                    points.append(position)
                    kinds.append('solar')
    result = defaultdict(Counter)
    seen = set()
    assign = project['assignments']
    for (lon, lat), kind, key in zip(points, kinds, locate_many(points)):
        if key is None or (round(lon, 6), round(lat, 6), kind) in seen:
            continue  # overlapping area extracts contain the same objects
        seen.add((round(lon, 6), round(lat, 6), kind))
        if assign.get(key):
            result[assign[key]][kind] += 1
    return result


def _note(zone_type, m, cap, places, names):
    bits = []
    if cap['housing'] >= 40:
        bits.append(f"husrom til omtrent {cap['housing']:,} personer".replace(',', ' '))
    farm_ha = m['farm'] / 1e4
    if farm_ha >= .5:
        bits.append(f"{farm_ha:.1f} ha jord i drift".replace('.', ','))
    if m.get('pasture', 0) >= 1e4:
        bits.append(f"{m['pasture'] / 1e4:.1f} ha beite".replace('.', ','))
    if m['coastM'] >= 150:
        bits.append(f"{m['coastM'] / 1000:.1f} km kyst".replace('.', ','))
    if m['forest'] >= 1e4:
        bits.append(f"{m['forest'] / 1e4:.1f} ha skog".replace('.', ','))
    named = [p['name'] for p in places if p['role'] in ('hq', 'facility')][:3]
    if named:
        bits.append(', '.join(named))
    text = f"{names[zone_type]}: " + '; '.join(bits) if bits else names[zone_type]
    return text[0].upper() + text[1:] + '.'


def _measure_inputs(project, log=print):
    cells, edges, stats = {}, [], {}
    for area in project['areas']:
        if area.get('status') != 'ready':
            continue
        stats.update(ensure_stats(area['id'], log))
        for f in z.read_json(z.area_dir(area['id']) / 'cells.geojson')['features']:
            cells[f['properties']['k']] = f['properties']
        for f in z.read_json(z.area_dir(area['id']) / 'edges.geojson')['features']:
            p = f['properties']
            edges.append((p['a'], p['b'], p['l']))
    return cells, edges, stats


def refresh_measures(project, log=print):
    """Measures for every zone as the zones are drawn now (used by export)."""
    cells, edges, stats = _measure_inputs(project, log)
    totals = zone_measures(project, stats, cells, edges)
    for zone in project['zones']:
        if zone['id'] in totals:
            zone['measures'] = _rounded_measures(totals[zone['id']])


def suggest(project, log=print, overwrite=False):
    """Fill zone content and add places where nothing has been set by hand. Returns a summary."""
    cat = catalog()
    yields = cat['yields']
    sites = {s['id']: s for s in cat['siteTypes']}
    type_names = dict(cat['zoneTypes'])
    cells, edges, stats = _measure_inputs(project, log)
    totals = zone_measures(project, stats, cells, edges)
    zones = {x['id']: x for x in project['zones']}
    assign = project['assignments']

    # Places. Earlier suggestions nobody has touched are made again from scratch.
    project['pois'] = [p for p in project.get('pois', []) if not p.get('suggested')]
    pois = project['pois']
    by_source = {p['osmId']: p for p in pois if p.get('osmId')}
    suggested_places = defaultdict(list)
    added = 0
    raw = place_features(project, log)
    for feature in raw:
        kind = classify_place(feature['tags'], feature['m2'])
        if not kind:
            continue
        role, type_id, poi_kind = kind
        zone_id = assign.get(feature['cell'])
        if zone_id not in zones:
            continue
        name = _name(feature['tags'])
        record = {'role': role, 'typeId': type_id, 'name': name, 'feature': feature, 'kind': poi_kind}
        suggested_places[zone_id].append(record)
    # Several shops in one mall, or several pharmacies in one zone, become one place each type and zone.
    for zone_id, places in suggested_places.items():
        unique, names_seen = [], set()
        for p in places:
            key = (p['typeId'], p['name'].lower() or p['feature']['cell'])
            if key in names_seen:
                continue
            names_seen.add(key)
            unique.append(p)
        suggested_places[zone_id] = unique
    _curated(project, zones, assign, cells, suggested_places)
    _coast_farms(project, zones, totals, yields, cells, suggested_places)
    choke_locate = _cell_locator(project)
    for choke in chokepoints(project, choke_locate, log):
        keys = [choke_locate(*end) or _nearest_cell(choke_locate, end) for end in choke['ends']]
        zone_ids = [assign.get(k) for k in keys]
        home = next((i for i, zid in enumerate(zone_ids) if zid in zones), None)
        if home is None or zone_ids[0] == zone_ids[1]:
            continue  # outside the map, or inside one zone where it decides nothing
        lon, lat = choke['ends'][home]
        suggested_places[zone_ids[home]].append({
            'role': 'facility', 'typeId': choke['kind'], 'name': choke['name'], 'kind': 'transport',
            'extra': {'lengthM': choke['lengthM'], 'ends': choke['ends']},
            'feature': {'id': choke['id'], 'lon': lon, 'lat': lat, 'cell': keys[home]}})

    existing_points = [(p['lon'], p['lat'], p) for p in pois]
    labels = {**{t['id']: t['name'] for t in cat['hqTypes']}, **{t['id']: t['name'] for t in cat['facilityTypes']},
              **{t['id']: t['name'] for t in cat['siteTypes']}}
    rank = {'hq': 0, 'facility': 1, 'resource': 2}
    for zone_id, places in suggested_places.items():
        for p in sorted(places, key=lambda q: rank[q['role']]):
            feature = p['feature']
            source = feature['id']
            if source in by_source:
                continue
            near = next((q for lon, lat, q in existing_points if _same_place(q, lon, lat, p, feature)), None)
            if near:
                _set_type(near, p['role'], p['typeId'], fill_only=True)
                continue
            poi = {'id': _fresh_poi_id(pois), 'name': p['name'] or f"{labels[p['typeId']]} {zones[zone_id]['name']}",
                   'kind': p['kind'], 'role': p['role'], 'lon': feature['lon'], 'lat': feature['lat'],
                   'cell': feature['cell'], 'resources': [], 'sourceIds': ['osm'], 'osmId': source, 'suggested': True}
            _set_type(poi, p['role'], p['typeId'])
            poi.update(p.get('extra', {}))
            pois.append(poi)
            by_source[source] = poi
            existing_points.append((poi['lon'], poi['lat'], poi))
            added += 1

    # Zone content
    filled = 0
    poi_zone = defaultdict(list)
    locate = _cell_locator(project)
    kinds = {'hq': {t['id']: t for t in cat['hqTypes']}, 'outpost': {t['id']: t for t in cat['hqTypes']},
             'facility': {t['id']: t for t in cat['facilityTypes']}, 'resource': sites}
    extras = zone_extras(project, locate.many, log)
    for poi in pois:
        if poi.get('cell') not in assign:
            poi['cell'] = locate(poi['lon'], poi['lat']) or poi.get('cell')
        if poi.get('cell') in assign:
            poi_zone[assign[poi['cell']]].append(poi)
    for zone in project['zones']:
        m = totals.get(zone['id'])
        if m is None:
            continue
        cap = capacity(m, yields)
        zone['measures'] = _rounded_measures(m)
        if zone['level'] != 3:
            continue
        manual = any(zone.get(k) for k in ('type', 'potential', 'finds', 'produces', 'resources')) and not zone.get('suggested')
        if manual and not overwrite:
            continue
        places = [{'role': q.get('role'), 'typeId': q.get('hqType') or q.get('facilityType') or q.get('siteType'),
                   'name': q['name']} for q in poi_zone[zone['id']]]
        zone_type = _zone_type(m, places)
        finds, produces = _finds_and_produces(m, places, sites, extras.get(zone['id'], {}), kinds)
        zone.update(type=zone_type, potential=_potential(m, cap, places), finds=finds, produces=produces,
                    suggested=True)
        zone.pop('resources', None)
        if not zone.get('notes') or zone.get('notesSuggested'):
            zone['notes'] = _note(zone_type, m, cap, places, type_names)
            zone['notesSuggested'] = True
        filled += 1
    return {'zones': filled, 'places': added, 'osmPlaces': len(raw)}


def _nearest_cell(locate, end, reach=.01):
    """A bridge may end on a quay just outside the cells: search a small ring around the point."""
    lon, lat = end
    for r in (.0005, .001, .002, .004, .007, reach):
        for dx, dy in ((r, 0), (-r, 0), (0, r / 2), (0, -r / 2), (r, r / 2), (-r, -r / 2), (r, -r / 2), (-r, r / 2)):
            key = locate(lon + dx, lat + dy)
            if key:
                return key
    return None


def _cell_locator(project):
    keys, geometries = [], []
    for area in project['areas']:
        for f in z.read_json(z.area_dir(area['id']) / 'cells.geojson', {'features': []})['features']:
            keys.append(f['properties']['k'])
            geometries.append(shapely.make_valid(shape(f['geometry'])))
    tree = STRtree(geometries)

    def locate(lon, lat):
        hits = tree.query(Point(lon, lat), 'intersects')
        return keys[int(hits[0])] if len(hits) else None

    def many(points):
        found = [None] * len(points)
        if points:
            index, cell = tree.query([Point(p) for p in points], predicate='intersects')
            for i, c in zip(index.tolist(), cell.tolist()):
                found[i] = keys[c]
        return found
    locate.many = many
    return locate


def _rounded_measures(m):
    keys = ('m2', 'coastM', 'landEdgeM', 'buildings', *OSM_FIELDS, 'pasture', 'bog', 'rock', 'built')
    return {k: round(m.get(k, 0)) for k in keys if k != 'coast'}


def _same_place(poi, lon, lat, place, feature):
    dx, dy = abs(lon - feature['lon']), abs(lat - feature['lat'])
    name = (place['name'] or '').lower()
    if name and poi.get('kind') == place['kind'] and poi.get('role', '') in ('', place['role']) and (poi['name'].lower() in name or name in poi['name'].lower())             and dx < .008 and dy < .004:
        return True
    # A plain place from the old map (a shop, say) may become a resource site, but never swallows an HQ or facility.
    same_role = poi.get('role') == place['role'] or (not poi.get('role') and place['role'] == 'resource')
    return same_role and poi.get('kind') == place['kind'] and dx < .0012 and dy < .0006


def _set_type(poi, role, type_id, fill_only=False):
    field = {'hq': 'hqType', 'outpost': 'hqType', 'facility': 'facilityType', 'resource': 'siteType'}[role]
    if fill_only and (poi.get('hqType') or poi.get('facilityType') or poi.get('siteType')):
        return
    if fill_only and poi.get('role') and poi['role'] != role:
        return
    poi['role'] = poi.get('role') or role
    poi[field] = type_id


def _fresh_poi_id(pois):
    used = {p['id'] for p in pois}
    n = len(pois) + 1
    while f'poi-{n:03d}' in used:
        n += 1
    return f'poi-{n:03d}'


# Places the owner named that OSM does not tag well enough. Positions are OSM objects or named OSM places.
CURATED = [
    {'source': 'osm:way/31763779', 'name': 'Domkirken og Kongsgård', 'role': 'hq', 'typeId': 'refuge', 'kind': 'other'},
    {'source': 'osm:node/5761740690', 'name': 'Vålandstårnet', 'role': 'facility', 'typeId': 'commsTower', 'kind': 'comms',
     'osmPlace': True},
]


def _curated(project, zones, assign, cells, suggested_places):
    lookup = {}
    for area in project['areas']:
        osm_path = z.IMPORTS / area['id'] / 'osm.json'
        wanted = {c['source'] for c in CURATED if c.get('osmPlace')}
        if osm_path.exists() and wanted:
            for element in z.read_json(osm_path)['elements']:
                oid = f"osm:{element['type']}/{element['id']}"
                if oid in wanted and 'lon' in element:
                    lookup[oid] = (element['lon'], element['lat'])
    trees = []
    for area in project['areas']:
        features = z.read_json(z.area_dir(area['id']) / 'cells.geojson')['features']
        trees.append((STRtree([shapely.make_valid(shape(f['geometry'])) for f in features]), features))
    for entry in CURATED:
        # Replace a plain OSM suggestion of the same object (the cathedral) with the curated one.
        for places in suggested_places.values():
            places[:] = [p for p in places if p['feature']['id'] != entry['source']]
        position = lookup.get(entry['source']) or _feature_position(project, entry['source'])
        if position is None:
            continue
        for tree, features in trees:
            hits = tree.query(Point(position), 'within')
            if len(hits):
                key = features[int(hits[0])]['properties']['k']
                if assign.get(key) in zones:
                    feature = {'id': entry['source'], 'lon': round(position[0], 7), 'lat': round(position[1], 7), 'cell': key}
                    suggested_places[assign[key]].append({**entry, 'feature': feature})
                break


def _feature_position(project, source):
    kind, number = source.split(':')[1].split('/')
    for area in project['areas']:
        path = z.IMPORTS / area['id'] / 'features.json'
        if not path.exists():
            continue
        for element in z.read_json(path)['elements']:
            if element['type'] == kind and str(element['id']) == number:
                return _element_point(element)
    return None


def _coast_farms(project, zones, totals, yields, cells, suggested_places):
    """A zone with farmland, coast and few homes is a coastal farm: suggest it as an HQ at its largest farm building."""
    best = {}  # one coastal farm per L2 zone: the zone with most land to farm
    for zone in zones.values():
        m = totals.get(zone['id'])
        if zone['level'] != 3 or m is None:
            continue
        cultivable_ha = (m['farm'] + m.get('pasture', 0) * .5 + m['open'] * .5) / 1e4
        if cultivable_ha < 8 or m['coastM'] < 200 or m['homes'] > max(60, cultivable_ha * 6):
            continue
        if any(p['role'] == 'hq' for p in suggested_places[zone['id']]):
            continue
        if cultivable_ha > best.get(zone.get('parentId'), (0, None))[0]:
            best[zone.get('parentId')] = (cultivable_ha, zone)
    # At most two per L1 zone, the ones with most land to farm.
    per_l1 = defaultdict(list)
    for score, zone in best.values():
        l2 = zones.get(zone.get('parentId'))
        per_l1[l2.get('parentId') if l2 else None].append((score, zone))
    chosen = [zone for group in per_l1.values() for _, zone in sorted(group, key=lambda t: -t[0])[:2]]
    for zone in chosen:
        keys = [k for k, v in project['assignments'].items() if v == zone['id'] and k in cells]
        if not keys:
            continue
        yard = max(keys, key=lambda k: cells[k]['n'] * 1000 + cells[k]['a'] / 1e4)
        cell = cells[yard]
        suggested_places[zone['id']].append({
            'role': 'hq', 'typeId': 'coastFarm', 'name': f"{zone['name']} kystgård", 'kind': 'farm',
            'feature': {'id': f"zone:{zone['id']}:coastFarm", 'lon': cell['x'], 'lat': cell['y'], 'cell': yard}})
