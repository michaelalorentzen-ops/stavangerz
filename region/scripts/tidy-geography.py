"""One small gameplay-oriented cleanup of the existing draft. No new GIS research."""
import json, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'.tools/python'))
from shapely.geometry import shape, mapping, Point, LineString, Polygon, MultiPolygon
from shapely.ops import unary_union, split

def clean_geometry(g):
    if g.geom_type == 'Polygon':
        g = Polygon(g.exterior, [h for h in g.interiors if Polygon(h).area > 1e-15])
    elif g.geom_type == 'MultiPolygon':
        g = MultiPolygon([shape(clean_geometry(p)) for p in g.geoms if p.area > 1e-15])
    return json.loads(json.dumps(mapping(g)))

def tidy_world(world):
    if any(z['id'] == 'cell-014' for z in world['zones']): return world
    cells = {z['id']: z for z in world['zones'] if z['level'] == 3}
    cells['cell-003']['geometry'] = clean_geometry(unary_union([shape(cells['cell-003']['geometry']), shape(cells['cell-005']['geometry'])]))
    cells['cell-003']['rationale'] = 'Startområde med to ekspansjonsretninger og veikrysset ved Clipperveien. Tidligere småsone 05 er slått inn for en ryddigere inndeling.'
    del cells['cell-005']
    base = json.loads((ROOT/'packages/world-data/data/basemap.json').read_text(encoding='utf8'))
    road = next(f for f in base['features'] if f['properties'].get('osmId') == 'way/27473078')
    dividing_line = LineString([(5.7221,58.9912), *road['geometry']['coordinates'], (5.7272,58.9870)]).simplify(.00004)
    parts = list(split(shape(cells['cell-007']['geometry']), dividing_line).geoms)
    east = next(p for p in parts if p.covers(Point(5.730,58.9905)))
    west = unary_union([p for p in parts if p is not east])
    cells['cell-007'] = {**cells['cell-007'], 'name':'Bangarvågen / gjennomfart', 'geometry':clean_geometry(east), 'rationale':'Østlig adkomst mellom eid, hovedvei og verftet. Kaia i vest er eget oppdrag; grensen er ingen fysisk vegg.'}
    cells['cell-014'] = {**cells['cell-007'], 'id':'cell-014', 'name':'Tømmerodden / kaier', 'geometry':clean_geometry(west), 'rationale':'Sammenhengende vestlig kaiområde, skilt ut for oversiktlig rydding og prioritering.'}
    area = {id:shape(z['geometry']) for id,z in cells.items()}
    def cell_at(old_id, point):
        if old_id == 'cell-005': return 'cell-003'
        if old_id == 'cell-007': return 'cell-014' if area['cell-014'].covers(Point(point)) else 'cell-007'
        return old_id
    edges=[]; seen=set()
    for edge in world['edges']:
        line=edge['geometry']['coordinates']
        a=cell_at(edge['fromCellId'],line[0]);b=cell_at(edge['toCellId'],line[-1])
        pair=tuple(sorted([a,b]))
        if a == b or pair in seen: continue
        seen.add(pair)
        revised={**edge, 'fromCellId':a, 'toCellId':b, 'rationale':'Strategisk spillforbindelse langs hovedtrekkene i gatenettet. Krever ikke dokumentert fysisk port.'}
        if edge['id'] == 'edge-005-006':
            revised.update(id='edge-003-006-clipper',viaPoiIds=['poi-junction-005'])
        edges.append(revised)
    # A short connection along the mapped bay road crosses the new gameplay boundary.
    west_road=next(f for f in base['features'] if f['properties'].get('osmId')=='way/1074216169')['geometry']['coordinates']
    east_road=next(f for f in base['features'] if f['properties'].get('osmId')=='way/326899874')['geometry']['coordinates']
    trace=[west_road[1],west_road[0],*east_road[:2]]
    # Select points on opposite sides without inventing a gate or wall.
    trace=LineString([*west_road[::-1],*east_road]).simplify(.000002)
    coords=list(trace.coords)
    west_point=next(p for p in coords if area['cell-014'].covers(Point(p)))
    east_point=next(p for p in coords if area['cell-007'].covers(Point(p)))
    edges.append({'id':'edge-007-014','name':'Bangarvågsgata / kaiforbindelse','fromCellId':'cell-007','toCellId':'cell-014','kind':'road','modes':['walk','cycle'],'status':'active','geometry':{'type':'LineString','coordinates':[east_point,west_point]},'sourceIds':['osm','curation'],'rationale':'Åpen strategisk forbindelse mellom gjennomfart og kai. Sonegrensen er ingen barriere.'})
    pois=[{**p,'cellId':cell_at(p['cellId'],p['geometry']['coordinates'])} for p in world['pois']]
    pois.append({'id':'poi-junction-005','name':'Clipperveien / strategisk veikryss','cellId':'cell-003','kind':'junction','geometry':{'type':'Point','coordinates':[5.7329186,58.9852181]},'sourceIds':['osm','curation']})
    parents=[z for z in world['zones'] if z['level']<3]
    for z in parents:
        if z['level']==2:z['geometry']=clean_geometry(unary_union([area[id] for id,c in cells.items() if c['parentId']==z['id']]))
    for z in parents:
        if z['level']==1:z['geometry']=clean_geometry(unary_union([shape(c['geometry']) for c in parents if c.get('parentId')==z['id']]))
    return {**world,'worldVersion':'m2-working.1','zones':parents+list(cells.values()),'edges':edges,'pois':pois}

if __name__ == '__main__':
    path=ROOT/'packages/world-data/data/world-draft.json'
    world=json.loads(path.read_text(encoding='utf8'))
    if world['status']!='draft':raise RuntimeError('Only editable drafts can be tidied')
    archive=ROOT/'packages/world-data/data/archive/m1-review.json'
    archive.parent.mkdir(exist_ok=True)
    if not archive.exists():archive.write_text(json.dumps(world,ensure_ascii=False,indent=2),encoding='utf8')
    world=tidy_world(world)
    path.write_text(json.dumps(world,ensure_ascii=False,indent=2),encoding='utf8')
    locations=[{'id':z['id'],'lon':shape(z['geometry']).representative_point().x,'lat':shape(z['geometry']).representative_point().y} for z in world['zones']]
    (path.parent/'review-locations.json').write_text(json.dumps(locations),encoding='utf8')
    (path.parent/'zones.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','id':z['id'],'properties':{k:v for k,v in z.items() if k!='geometry'},'geometry':z['geometry']} for z in world['zones']]},ensure_ascii=False),encoding='utf8')
    print('Tidied: 05 merged into 03; junction preserved; 07 split into through-route and quay (14).')
