"""Bygger kartdata for Stavanger Z fra en OpenStreetMap Overpass-dump.

Bruk: python build_map.py <overpass.json> <ut.json>
Koordinater: x = meter-ish øst, y = meter-ish sør, origo i (5.695E, 59.008N).
"""
import json, math, sys
from shapely.geometry import LineString, Polygon, Point, box, MultiPoint, shape
from shapely.ops import polygonize, unary_union, voronoi_diagram

SRC, OUT = sys.argv[1], sys.argv[2]
d = json.load(open(SRC))['elements']
W, N = 5.695, 59.008
KX = math.cos(math.radians(58.988))
def P(lon, lat): return ((lon - W) * KX * 1e5, (N - lat) * 1e5)
def geom_pts(e): return [P(g['lon'], g['lat']) for g in e['geometry']]

VIEW = box(950, 750, 3450, 3300)
CLIP = VIEW.buffer(150)

# --- land fra kystlinje -------------------------------------------------
coast = [LineString(geom_pts(e)) for e in d if e.get('tags', {}).get('natural') == 'coastline']
frame = box(-200, -600, 6000, 5200)
land = []
for poly in polygonize(unary_union(coast + [frame.exterior])):
    c = poly.representative_point()
    ln = min(coast, key=lambda l: l.distance(c))
    t = ln.project(c); a = ln.interpolate(max(t - 1, 0)); b = ln.interpolate(min(t + 1, ln.length)); p = ln.interpolate(t)
    if (c.x - p.x) * (b.y - a.y) + (c.y - p.y) * -(b.x - a.x) > 0:
        land.append(poly)
LAND = unary_union(land).intersection(CLIP)

def parts(g): return [p for p in getattr(g, 'geoms', [g]) if p.area > 0]
def biggest(g): return max(parts(g), key=lambda p: p.area)

def d_path(g, tol=1.5):
    g = g.simplify(tol)
    s = []
    for p in parts(g):
        if p.geom_type != 'Polygon': continue
        for r in [p.exterior, *p.interiors]:
            cs = list(r.coords)[:-1]
            if len(cs) < 3: continue
            s.append('M' + 'L'.join('%d %d' % (round(x), round(y)) for x, y in cs) + 'Z')
    return ''.join(s)

def line_path(pts):
    ls = LineString(pts).intersection(CLIP)
    out = []
    for l in getattr(ls, 'geoms', [ls]):
        if l.is_empty or l.geom_type != 'LineString': continue
        l = l.simplify(1.5)
        out.append('M' + 'L'.join('%d %d' % (round(x), round(y)) for x, y in l.coords))
    return ''.join(out)

# --- Buøy / Hundvåg ------------------------------------------------------
mass = [p for p in parts(LAND) if p.contains(Point(1850, 2060))][0]
buoy_cut = Polygon([(900, 1720), (1560, 1665), (1880, 1565), (2060, 1890), (2320, 1910), (2700, 1960), (2700, 2800), (900, 2800)])
BUOY = biggest(mass.intersection(buoy_cut))
HUNDVAG = mass.difference(BUOY)

ind = [Polygon(geom_pts(e)) for e in d if e.get('tags', {}).get('landuse') == 'industrial' and 'geometry' in e and len(e['geometry']) > 3]
ros_ind = [p.buffer(0) for p in ind if p.buffer(0).contains(Point(1500, 2300))]
ROS = biggest(BUOY.intersection(ros_ind[0].buffer(18)))
REST = BUOY.difference(ROS)

seeds = {
    'hjem':        (1900, 2080),
    'tommerodden': (1330, 1860),
    'obs':         (1640, 1880),
    'nordkrysset': (1800, 1690),
    'buoy_nord':   (2120, 1940),
    'skolen':      (2170, 2230),
    'sorspissen':  (2180, 2440),
}
vor = voronoi_diagram(MultiPoint([Point(*v) for v in seeds.values()]), envelope=box(800, 1400, 2800, 2800))
cells = {}
for k, v in seeds.items():
    cell = [c for c in vor.geoms if c.contains(Point(*v))][0]
    cells[k] = biggest(REST.intersection(cell).buffer(0))
cells['rosenberg'] = ROS

sectors = []
for k, g in cells.items():
    c = g.representative_point() if k != 'rosenberg' else Point(1430, 2300)
    sectors.append({'id': k, 'd': d_path(g, 1.0), 'cx': round(c.x), 'cy': round(c.y), 'area': round(g.area)})

# --- fremtidige soner ----------------------------------------------------
MAIN = None
def zone_at(x, y):
    for p in parts(LAND):
        if p.contains(Point(x, y)): return p
MAIN = zone_at(1500, 3300)
zones_def = [
    ('hundvag', 'Hundvåg', HUNDVAG, (1950, 1250)),
    ('engoy', 'Engøy', zone_at(2592, 2510), None),
    ('solyst', 'Sølyst', zone_at(2406, 3060), None),
    ('grasholmen', 'Grasholmen', zone_at(2652, 3199), None),
    ('bjornoy', 'Bjørnøy', zone_at(3184, 1100), None),
    ('roaldsoy', 'Roaldsøy', zone_at(3561, 1432), None),
    ('ormoy', 'Ormøy', zone_at(3426, 1960), None),
    ('steinsoy', 'Steinsøy', zone_at(3050, 2234), None),
    ('sentrum', 'Sentrum', MAIN.intersection(box(1700, 2900, 3600, 4200)), (2350, 3290)),
    ('bjergsted', 'Bjergsted', MAIN.intersection(box(0, 1500, 1700, 4200)), (1290, 2900)),
]
zones = []
for k, name, g, lab in zones_def:
    if g is None or g.is_empty: continue
    g = g.intersection(CLIP)
    c = Point(*lab) if lab else g.representative_point()
    zones.append({'id': k, 'name': name, 'd': d_path(g, 2), 'cx': round(c.x), 'cy': round(c.y)})

# --- lag: land, dybdekurver, bygg, veier ----------------------------------
water_lines = [d_path(LAND.buffer(dist).intersection(CLIP), 4) for dist in (14, 40, 90)]
blds = []
for e in d:
    t = e.get('tags', {})
    if 'building' in t and 'geometry' in e and len(e['geometry']) > 3:
        pts = geom_pts(e)
        if not CLIP.contains(Point(*pts[0])): continue
        p = Polygon(pts).buffer(0)
        if p.area < 25: continue
        blds.append(p.simplify(1.2))
bld_path = ''.join(d_path(b, 1.2) for b in blds)
roads = {'major': [], 'minor': []}
for e in d:
    t = e.get('tags', {})
    h = t.get('highway')
    if not h or 'geometry' not in e: continue
    cls = 'major' if h in ('motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link') else 'minor'
    roads[cls].append(line_path(geom_pts(e)))

out = {
    'view': [950, 750, 2500, 2550],
    'focus': [1080, 1480, 1560, 1160],
    'land': d_path(LAND, 1.2),
    'depth': water_lines,
    'buildings': bld_path,
    'roads': {k: ''.join(v) for k, v in roads.items()},
    'sectors': sectors,
    'zones': zones,
    'geo': {'W': W, 'N': N, 'KX': KX},
}
json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok', {k: len(json.dumps(v)) for k, v in out.items()})
