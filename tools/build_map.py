"""Bygger kartdata for en region fra en OpenStreetMap Overpass-dump.

Bruk: python tools/build_map.py <overpass.json> <ut.json> [kartoppsett.json]
Kartoppsettet (standard src/regions/stavanger/map.config.json) har alle regionspesifikke
verdier: origo, utsnitt, fase 1-området, låste sektorer, Voronoi-frø og soner.
Koordinater: x = meter-ish øst, y = meter-ish sør, origo gitt av 'origin' i oppsettet.
"""
import json, math, os, sys
from shapely.geometry import LineString, Polygon, Point, box, MultiPoint, shape
from shapely.ops import polygonize, unary_union, voronoi_diagram

SRC, OUT = sys.argv[1], sys.argv[2]
CFG_PATH = sys.argv[3] if len(sys.argv) > 3 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'regions', 'stavanger', 'map.config.json')
CFG = json.load(open(CFG_PATH))
d = json.load(open(SRC))['elements']
W, N = CFG['origin']['W'], CFG['origin']['N']
KX = math.cos(math.radians(CFG['origin']['kxLat']))
def P(lon, lat): return ((lon - W) * KX * 1e5, (N - lat) * 1e5)
def geom_pts(e): return [P(g['lon'], g['lat']) for g in e['geometry']]

VIEW_XYWH = CFG['view']['box']
VIEW = box(VIEW_XYWH[0], VIEW_XYWH[1], VIEW_XYWH[0] + VIEW_XYWH[2], VIEW_XYWH[1] + VIEW_XYWH[3])
CLIP = VIEW.buffer(CFG['view']['clipMargin'])

# --- land fra kystlinje -------------------------------------------------
coast = [LineString(geom_pts(e)) for e in d if e.get('tags', {}).get('natural') == 'coastline']
frame = box(*CFG['view']['frame'])
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

# --- fase 1-området: landmassen skåret av polygon, resten er en egen sone ---
AC = CFG['area']
mass = [p for p in parts(LAND) if p.contains(Point(*AC['landmassPoint']))][0]
AREA = biggest(mass.intersection(Polygon(AC['cut'])))
REMAINDER = mass.difference(AREA)

# --- låste sektorer: OSM-landuse-polygon utskåret av området ----------------
REST = AREA
locked = []
for L in CFG['lockedSectors']:
    polys = [Polygon(geom_pts(e)) for e in d if e.get('tags', {}).get('landuse') == L['landuse'] and 'geometry' in e and len(e['geometry']) > 3]
    hit = [p.buffer(0) for p in polys if p.buffer(0).contains(Point(*L['point']))]
    g = biggest(AREA.intersection(hit[0].buffer(L['buffer'])))
    locked.append((L, g))
    REST = REST.difference(g)

# --- Voronoi-sektorer i resten ----------------------------------------------
SC = CFG['sectors']
seeds = {k: tuple(v) for k, v in SC['seeds'].items()}
vor = voronoi_diagram(MultiPoint([Point(*v) for v in seeds.values()]), envelope=box(*SC['envelope']))
cells = {}
for k, v in seeds.items():
    cell = [c for c in vor.geoms if c.contains(Point(*v))][0]
    cells[k] = biggest(REST.intersection(cell).buffer(0))
labels = {}
for L, g in locked:
    cells[L['id']] = g
    if L.get('label'): labels[L['id']] = Point(*L['label'])

sectors = []
for k, g in cells.items():
    c = labels.get(k) or g.representative_point()
    sectors.append({'id': k, 'd': d_path(g, 1.0), 'cx': round(c.x), 'cy': round(c.y), 'area': round(g.area)})

# --- fremtidige soner ----------------------------------------------------
def zone_at(x, y):
    for p in parts(LAND):
        if p.contains(Point(x, y)): return p
ZC = CFG['zones']
MAIN = zone_at(*ZC['mainlandPoint'])
zones = []
for z in ZC['list']:
    if z.get('remainder'): g = REMAINDER
    elif 'landAt' in z: g = zone_at(*z['landAt'])
    else: g = MAIN.intersection(box(*z['mainlandBox']))
    if g is None or g.is_empty: continue
    g = g.intersection(CLIP)
    c = Point(*z['label']) if z.get('label') else g.representative_point()
    zones.append({'id': z['id'], 'd': d_path(g, 2), 'cx': round(c.x), 'cy': round(c.y)})

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
    'view': VIEW_XYWH,
    'focus': CFG['view']['focus'],
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
