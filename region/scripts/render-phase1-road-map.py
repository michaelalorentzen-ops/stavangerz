"""Render the road-aligned Phase 1 review map from five retained OSM extracts."""
import heapq
import json
import math
from collections import defaultdict
from pathlib import Path

import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, '.tools/python')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.geometry.polygon import orient
from shapely.ops import polygonize, split, unary_union

nodes, raw = {}, {}
for i in range(5):
    source = ET.parse(Path(f'.tools/imports/phase1-revision/revision-{i}.xml')).getroot()
    nodes.update({n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in source.findall('node')})
    raw.update({w.get('id'): w for w in source.findall('way')})
ways = {}
for id, way in raw.items():
    coords = [nodes[n.get('ref')] for n in way.findall('nd')]
    if len(coords) > 1:
        ways[id] = ({t.get('k'): t.get('v') for t in way.findall('tag')}, LineString(coords))

bounds = box(5.709, 58.981, 5.775, 59.014)
coasts = [g.intersection(bounds) for t, g in ways.values() if t.get('natural') == 'coastline']
parts = sorted(polygonize(unary_union([bounds.boundary, *coasts])), key=lambda p: -p.area)
# An OSM coastline is directed with land on the left. Use the two sides
# of each segment to identify land even when it reaches the map edge.
votes = defaultdict(int)
for tags, line in ways.values():
    if tags.get('natural') != 'coastline':
        continue
    for a, b in zip(line.coords, list(line.coords)[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        if not length:
            continue
        x, y = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        for sign in (1, -1):
            sample = Point(x - sign * dy / length * 1e-7, y + sign * dx / length * 1e-7)
            for i, polygon in enumerate(parts):
                if polygon.covers(sample):
                    votes[i] += sign
                    break
lands = [p for i, p in enumerate(parts) if votes[i] > 0]
def land_at(x, y):
    return next(p for p in lands if p.covers(Point(x, y)))

main = land_at(5.731, 58.998)
graph = defaultdict(list)
def distance(a,b):
    return math.hypot((a[0]-b[0])*.515,a[1]-b[1])
for tags, line in ways.values():
    kind = tags.get('highway')
    if not kind or tags.get('tunnel') in ('yes','building_passage') or tags.get('access') == 'private':
        continue
    if kind in ('motorway','motorway_link','trunk','trunk_link','construction','proposed'):
        continue
    cost = 1 if kind in ('secondary','tertiary','residential','unclassified') else 1.45
    for a,b in zip(line.coords,list(line.coords)[1:]):
        if not bounds.covers(Point(a)) or not bounds.covers(Point(b)):
            continue
        graph[a].append((b,distance(a,b)*cost))
        graph[b].append((a,distance(a,b)*cost))
def route(anchors):
    targets = [min(graph,key=lambda p:distance(p,a)) for a in anchors]
    result = [targets[0]]
    for start,end in zip(targets,targets[1:]):
        costs, parents, queue = {start:0}, {}, [(0,start)]
        while queue:
            cost,node = heapq.heappop(queue)
            if node == end: break
            if cost != costs[node]: continue
            for nxt,delta in graph[node]:
                total = cost+delta
                if total < costs.get(nxt,float('inf')):
                    costs[nxt],parents[nxt] = total,node
                    heapq.heappush(queue,(total,nxt))
        if end not in costs: raise ValueError((start,end))
        path = [end]
        while path[-1] != start: path.append(parents[path[-1]])
        result.extend(reversed(path[:-1]))
    return LineString(result)
def cut(start, anchors, end):
    street = route(anchors)
    return street, LineString([start,*street.coords,end])
def split_all(areas, line):
    return [piece for area in areas for piece in split(area,line).geoms if piece.area>1e-11]

eid=LineString([(5.726,58.9917),(5.7295,58.9923),(5.731,58.9923),(5.733,58.9919)])
sections=split_all([main],eid)
buoy=next(p for p in sections if p.covers(Point(5.737,58.985)))
hund=next(p for p in sections if p.covers(Point(5.731,58.998)))
# Waypoints select physical corridors. Endpoints beyond shore or the adjacent
# boundary are the proposed links between those mapped corridors.
north = cut((5.708,59.000),[(5.7158,58.9977),(5.7215,58.9989),(5.727,58.9979),(5.7331,58.9989),(5.742,58.9982),(5.746,58.9994)],(5.754,58.9997))
west = cut((5.716,58.991),[(5.7177,58.9928),(5.721,58.9941),(5.7215,58.9963),(5.7218,58.9989)],(5.722,59.003))
middle = cut((5.733,58.987),[(5.7333,58.991),(5.735,58.9934),(5.734,58.9954),(5.7332,58.9987)],(5.733,59.002))
east = cut((5.748,58.988),[(5.745,58.991),(5.7458,58.993),(5.7481,58.9948),(5.7494,58.9962)],(5.7524,59.001))
north_mid = cut((5.727,58.995),[(5.7296,58.997),(5.7319,59.0005),(5.7321,59.002),(5.732,59.0058)],(5.732,59.010))
north_east = cut((5.737,58.995),[(5.739,58.9974),(5.741,59.0006),(5.7423,59.0025),(5.744,59.0048)],(5.753,59.0051))
saltnes = cut((5.708,59.000),[(5.7167,59.0011),(5.7219,59.002),(5.726,59.0038),(5.7303,59.0036)],(5.738,59.003))
skeie = cut((5.710,59.0048),[(5.7174,59.0037),(5.7217,59.0039),(5.7244,59.0058),(5.727,59.0061)],(5.735,59.0075))
lunde = cut((5.727,59.0062),[(5.738,59.0062),(5.7412,59.0054),(5.745,59.0052)],(5.755,59.0061))
austbo = cut((5.730,58.994),[(5.7338,58.9945),(5.7376,58.9943),(5.7424,58.9934),(5.748,58.993)],(5.753,58.9925))
ulsnes = cut((5.712,58.995),[(5.7211,58.995),(5.7258,58.9945),(5.7297,58.9948),(5.732,58.9957)],(5.739,58.997))
klampen = cut((5.737,58.9908),[(5.7472,58.992),(5.7493,58.9937),(5.7523,58.9947)],(5.755,58.995))
lund_axis = cut((5.738,58.991),[(5.739,58.998),(5.740,59.001),(5.7415,59.0038),(5.7412,59.0054)],(5.741,59.015))
west_axis = cut((5.726,58.990),[(5.7269,58.993),(5.7275,58.9945),(5.7272,58.9964),(5.727,58.998)],(5.727,59.003))
troll_path = cut((5.707,58.9947),[(5.7145,58.995),(5.7177,58.995),(5.7209,58.995)],(5.725,58.995))
cuts=[north,west,middle,east,north_mid,north_east,saltnes,skeie,lunde,austbo,ulsnes,klampen,lund_axis,west_axis,troll_path]
base=split_all([hund],north[1])
south=next(p for p in base if p.covers(Point(5.732,58.9938)))
north_land=unary_union([p for p in base if p != south])
south_parts=split_all([south],west[1])
troll=next((p for p in south_parts if p.covers(Point(5.715,58.996))),None)
south_remaining=unary_union([p for p in south_parts if p!=troll])
south_parts=split_all(split_all(list(south_remaining.geoms) if south_remaining.geom_type=='MultiPolygon' else [south_remaining],middle[1]),east[1])
north_parts=split_all(split_all(list(north_land.geoms) if north_land.geom_type=='MultiPolygon' else [north_land],north_mid[1]),north_east[1])
def refine(areas, separators):
    for _, line in separators:
        revised = []
        for area in areas:
            pieces = split_all([area], line)
            revised.extend(pieces if len(pieces)>1 and min(p.area for p in pieces)>1.4e-6 else [area])
        areas = revised
    return areas
south_parts = refine(south_parts, [austbo, ulsnes, klampen,west_axis])
north_parts = refine(north_parts, [saltnes, skeie, lunde,lund_axis])
troll_parts=refine([troll],[troll_path])
rosenberg=Polygon(ways['32480580'][1]).intersection(buoy)
spine=cut((5.7306,58.994),[(5.7304,58.9908),(5.7317,58.9882),(5.7326,58.9851),(5.7358,58.984)],(5.738,58.981))
bangar=cut((5.716,58.9909),[(5.722,58.989),(5.7259,58.9889),(5.7295,58.988),(5.7318,58.9884)],(5.735,58.9884))
clipper=cut((5.717,58.9855),[(5.728,58.9855),(5.7308,58.9862),(5.7329,58.9852)],(5.737,58.9851))
beite=cut((5.725,58.9887),[(5.733,58.9885),(5.7353,58.9883),(5.737,58.9874)],(5.745,58.9884))
rune=cut((5.725,58.9855),[(5.733,58.9855),(5.7356,58.986),(5.7382,58.9872)],(5.745,58.9876))
pynt=cut((5.731,58.984),[(5.7341,58.9844),(5.7368,58.9845),(5.7383,58.9843)],(5.742,58.9844))
buoy_cuts=[spine,bangar,clipper,beite,rune,pynt]
non_industrial=buoy.difference(rosenberg)
land_pieces=list(non_industrial.geoms) if non_industrial.geom_type=='MultiPolygon' else [non_industrial]
buoy_parts=refine([p for p in land_pieces if p.area>1e-7],buoy_cuts)
for anchor, (_, separator) in [((5.72286,58.989),bangar),((5.73704,58.98504),rune)]:
    parent=next(p for p in buoy_parts if p.covers(Point(anchor)))
    pieces=split_all([parent],separator)
    main_pieces=[p for p in pieces if p.area>1.4e-6]
    assert len(main_pieces)==2
    for sliver in (p for p in pieces if p.area<=1.4e-6):
        neighbor=max(range(len(main_pieces)),key=lambda i:sliver.boundary.intersection(main_pieces[i].boundary).length)
        main_pieces[neighbor]=main_pieces[neighbor].union(sliver)
    buoy_parts.remove(parent)
    buoy_parts.extend(main_pieces)

palette={'01':'#e4ae77','02':'#75b6a2','03':'#beabdd','04':'#abc77d','05':'#d7c36e','06':'#95b8e4'}
def named_zones(parts, registry):
    zones = [(id, name, next(p for p in parts if p.covers(Point(anchor)))) for id, name, anchor in registry]
    assert len(zones) == len(parts) == len({p.wkb for _, _, p in zones})
    return zones

districts={
    '01':('Buøy',named_zones(buoy_parts,[
        ('001','Kommandørveien',(5.73252,58.98991)),
        ('002','Idrett / Beite',(5.73470,58.98703)),
        ('003','Tårnringen',(5.73704,58.98504)),
        ('004','Pyntesund',(5.73772,58.98383)),
        ('006','Skipsbyggergata',(5.73124,58.98683)),
        ('007','Bangarvågen',(5.72842,58.99032)),
        ('014','Tømmerodden',(5.72147,58.98781)),
        ('027','Pynteneset',(5.73557,58.98376)),
    ])+[('012','Rosenberg',rosenberg)]),
    '02':('Hundvåg sør',named_zones(south_parts,[
        ('008','Ulsnes',(5.72454,58.99508)),('010','Hundvågkrossen',(5.73080,58.99540)),
        ('011','Austbø',(5.74078,58.99638)),('009','Nedre Vågen',(5.73771,58.99273)),
        ('017','Klampen',(5.74430,58.98919)),('025','Bø / bruland',(5.75051,58.99328)),
    ])),
    '03':('Engøy', [('013','Engøy · nordre bruland',land_at(5.744,58.9825))]),
    '04':('Hundvåg nord',named_zones(north_parts,[
        ('018','Husabø',(5.72141,58.99876)),('019','Skeie',(5.72358,59.00442)),
        ('020','Lundsneset',(5.73615,59.00569)),('026','Lunde',(5.74666,59.00493)),
    ])),
    '05':('Trollskogen',named_zones(troll_parts,[
        ('015','Saltneset',(5.71391,58.99634)),('016','Trollskogen',(5.71409,58.99285)),
    ])),
    '06':('Byøyene',[('021','Bjørnøy',land_at(5.75662,58.99775)),('022','Roaldsøy',land_at(5.76375,58.99367)),('023','Ormøy',land_at(5.76154,58.98804)),('024','Steinsøy',land_at(5.75432,58.98564))]),
}
all_zones=[p for _,zones in districts.values() for _,_,p in zones]
assert all(p.is_valid and not p.is_empty for p in all_zones)
assert all(a.intersection(b).area<1e-11 for i,a in enumerate(all_zones) for b in all_zones[i+1:])
assert unary_union(all_zones).difference(unary_union(lands)).area<1e-11
if '--editor' in sys.argv:
    old=json.loads(Path('packages/world-data/data/world-draft.json').read_text(encoding='utf8'))
    def geometry(area):
        def clean(p):
            return orient(Polygon(p.exterior,[r for r in p.interiors if Polygon(r).area>1e-14]))
        if area.geom_type=='Polygon':
            return mapping(clean(area))
        from shapely.geometry import MultiPolygon
        return mapping(MultiPolygon([clean(p) for p in area.geoms if p.geom_type=='Polygon' and p.area>1e-14]))
    def zone(id,name,level,area,parent=None,playable=True):
        result=dict(id=id,name=name,level=level,playable=playable,geometry=geometry(area),rationale='Kuraterbart editorutkast',sourceIds=['osm','curation'])
        if parent: result['parentId']=parent
        if level==3:
            result['primaryType']={'002':'idrett','006':'industri','007':'blandet','012':'industri','014':'kai','016':'skog','020':'jordbruk','024':'blandet'}.get(id[-3:],'bolig')
        return result
    districts_geometry={did:unary_union([p for _,_,p in cells]) for did,(_,cells) in districts.items()}
    root_id='region-001'
    zones=[zone(root_id,'Hundvåg og Byøyene',1,unary_union(list(districts_geometry.values())))]
    cell_areas={}
    for did,(name,cells) in districts.items():
        district_id=f'district-0{did}'
        zones.append(zone(district_id,name,2,districts_geometry[did],root_id))
        for cid,name,area in cells:
            cell_id=f'cell-{cid}'
            cell_areas[cell_id]=area
            zones.append(zone(cell_id,name,3,area,district_id,cid not in ('012','013','024')))
    def cell_at(coords):
        return next((id for id,area in cell_areas.items() if area.covers(Point(coords))),None)
    pois=[]
    for poi in old['pois']:
        cell=cell_at(poi['geometry']['coordinates'])
        if cell: pois.append({**poi,'cellId':cell})
    by_cell={z['id']:z for z in zones}
    edges=[]
    for edge in old['edges']:
        line=edge['geometry']['coordinates']
        start,end=cell_at(line[0]),cell_at(line[-1])
        if start and end and start!=end:
            status=edge['status'] if by_cell[start]['playable'] and by_cell[end]['playable'] else 'future'
            edges.append({**edge,'fromCellId':start,'toCellId':end,'status':status,'viaPoiIds':[]})
    # Suggest one actual walkable road crossing per pair. Preserve curated links.
    known={frozenset((e['fromCellId'],e['toCellId'])) for e in edges}
    suggestions={}
    def suggest(start,end,line,name,kind,rank):
        pair=frozenset((start,end))
        if not start or not end or start==end or pair in known: return
        if rank>=suggestions.get(pair,(float('inf'),None))[0]: return
        suggestions[pair]=(rank,dict(id='editor-edge-'+ '-'.join(sorted(pair)),name=name,fromCellId=start,toCellId=end,
            kind=kind,modes=['walk'],status='proposed',geometry=dict(type='LineString',coordinates=line),sourceIds=['osm','curation']))
    for tags,line in ways.values():
        highway=tags.get('highway')
        if not highway or tags.get('tunnel')=='yes' or tags.get('foot')=='no' or tags.get('access') in ('no','private'): continue
        if highway in ('motorway','motorway_link','trunk','trunk_link','construction','proposed'): continue
        coords=list(line.coords)
        for a,b in zip(coords,coords[1:]):
            start,end=cell_at(a),cell_at(b)
            if not start or not end or start==end or not cell_areas[start].touches(cell_areas[end]): continue
            suggest(start,end,[a,b],tags.get('name','Gangforbindelse'),'footpath' if highway in ('footway','path','steps') else 'road',
                (0 if highway in ('secondary','tertiary','residential') else 1) + LineString([a,b]).length)
    for name,anchors in [
        ('Bjørnøybroen',[(5.7495,58.9962),(5.7511,58.9964),(5.7544,58.99677),(5.7561,58.997)]),
        ('Skadesund bru',[(5.7587,58.9959),(5.75942,58.99533),(5.76023,58.99474),(5.7608,58.9942)]),
        ('Ormøyveien',[(5.7665,58.9908),(5.76708,58.98992),(5.7666,58.9891)]),
    ]:
        path=list(route(anchors).coords)
        suggest(cell_at(path[0]),cell_at(path[-1]),path,name,'bridge',0)
    edges.extend(edge for _,edge in suggestions.values())
    seed={**old,'worldVersion':'editor-initial-draft','status':'draft','zones':zones,'pois':pois,'edges':edges,'frontiers':[]}
    context=[]
    for tags,line in ways.values():
        if not line.intersects(bounds): continue
        kind='road' if 'highway' in tags and tags.get('tunnel')!='yes' else 'building' if 'building' in tags and tags['building']!='roof' and line.is_ring else 'land' if line.is_ring and ('landuse' in tags or tags.get('natural') in ('wood','scrub')) else None
        if kind: context.append(dict(kind=kind,coordinates=list(line.coords),tag=tags.get('building') if kind=='building' else tags.get('highway') if kind=='road' else tags.get('landuse',tags.get('natural'))))
    output=Path('packages/world-data/data')
    for name,value in [('editor-seed.json',seed),('editor-context.json',context)]:
        (output/name).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    sys.exit(0)
def polygons(p):
    return [p] if p.geom_type=='Polygon' else [g for g in p.geoms if g.geom_type=='Polygon']
def fill(p,color,**kwargs):
    for g in polygons(p): ax.fill(*g.exterior.xy,color=color,**kwargs)
def stroke(g,**kwargs):
    if g.is_empty:return
    if g.geom_type in ('LineString','LinearRing'): ax.plot(*g.xy,**kwargs)
    elif hasattr(g,'geoms'):
        for part in g.geoms:stroke(part,**kwargs)
def label(p,txt,size=9,**kwargs):
    ax.text(*p,txt,ha='center',va='center',fontsize=size,color='#22282b',path_effects=[pe.withStroke(linewidth=3,foreground='#f4f3e9')],**kwargs)
fig=plt.figure(figsize=(15.4,13),facecolor='#f4f3e9')
ax=fig.add_axes([.025,.055,.735,.86],facecolor='#b6dbe8')
ax.set_aspect(1/.515)
ax.set(xlim=(5.709,5.775),ylim=(58.981,59.014))
ax.set_xticks([]);ax.set_yticks([])
for p in lands: fill(p,'#e6e9d8',zorder=1)
for tags,g in ways.values():
    if tags.get('landuse') not in ('forest','grass','meadow','farmland','industrial') and tags.get('natural') not in ('wood','scrub'):continue
    if not g.is_ring or not g.intersects(bounds):continue
    p=Polygon(g)
    if p.is_valid:fill(p,'#9eba83' if tags.get('landuse')!='industrial' else '#bab6ac',alpha=.35,zorder=2)
for did,(_,zones) in districts.items():
    for _,_,p in zones:fill(p,palette[did],alpha=.35,zorder=3)
    for _,_,p in zones:stroke(p.boundary,color='#75535d',lw=.9,zorder=5)
    stroke(unary_union([p for _,_,p in zones]).boundary,color='#225f83',lw=2.1,zorder=6)
for tags,g in ways.values():
    if 'highway' not in tags or not g.intersects(bounds) or tags.get('tunnel')=='yes':continue
    major=tags['highway'] in ('secondary','tertiary','primary','trunk')
    stroke(g,color='#765f4b' if major else '#6d7065',lw=.75 if major else .35,alpha=.85 if major else .52,zorder=4)
hund_borders=unary_union([p.boundary for p in south_parts+north_parts+troll_parts])
for road,cutline in cuts:
    extensions=cutline.difference(road).intersection(hund_borders)
    stroke(extensions,color='#845a75',lw=1.5,ls='--',zorder=7)
buoy_borders=unary_union([p.boundary for p in buoy_parts])
for road, cutline in buoy_cuts:
    stroke(cutline.difference(road).intersection(buoy_borders),color='#845a75',lw=1.5,ls='--',zorder=7)
connections=[
 ('P1','Buøy → Hundvåg','Hundvågveien over eidet',[(5.73045,58.9908),(5.73055,58.9921),(5.7317,58.9929)],(5.7280,58.9918)),
 ('P2','Buøy → Engøy','Pyntesund bru',[(5.7371,58.984),(5.7387,58.98366),(5.74178,58.98289),(5.7432,58.9825)],(5.7418,58.98395)),
 ('P3','Hundvåg → Bjørnøy','Bjørnøybroen',[(5.7495,58.9962),(5.7511,58.9964),(5.7544,58.99677),(5.7561,58.997)],(5.7526,58.99755)),
 ('P4','Bjørnøy → Roaldsøy','Skadesund bru',[(5.7587,58.9959),(5.75942,58.99533),(5.76023,58.99474),(5.7608,58.9942)],(5.7621,58.99525)),
 ('P5','Roaldsøy → Ormøy','Ormøyveien',[(5.7665,58.9908),(5.76708,58.98992),(5.7666,58.9891)],(5.7692,58.9901)),
 ('P6','Trollskogen → Hundvåg sør','Ulsnesveien',[(5.7162,58.9923),(5.7214,58.9929),(5.7244,58.9932)],(5.720,58.99175)),
 ('P7','Hundvåg sør → Hundvåg nord','Hundvåg ring',[(5.7231,58.995),(5.72155,58.9966),(5.7217,58.9988),(5.724,59.0008)],(5.7199,58.9992)),
 ('P8','Buøy øst → verftssiden','Skipsbyggergata / Clipperveien',[(5.7363,58.985),(5.7333,58.9848),(5.7329,58.9852),(5.7311,58.9859)],(5.7304,58.9843)),
]
for marker,_,_,anchors,position in connections:
    road=route(anchors)
    stroke(road,color='#3a342b',lw=5.8,zorder=9)
    stroke(road,color='#fbc54f',lw=3.5,zorder=10)
    ax.annotate(marker,xy=road.interpolate(.5,normalized=True).coords[0],xytext=position,ha='center',va='center',fontsize=9,fontweight='bold',zorder=15,
                bbox=dict(boxstyle='round,pad=.26',fc='#fbc54f',ec='#3a342b'),arrowprops=dict(arrowstyle='-',color='#3a342b'))
for did,(_,zones) in districts.items():
    for id,name,p in zones:
        if did=='01':
            short={'001':'Kommandørveien','002':'Idrett / Beite','003':'Tårnringen','004':'Pyntesund','006':'Skipsbyggergata','007':'Bangarvågen','012':'Rosenberg','014':'Tømmerodden'}
            name=short.get(id,name)
        positions={'001':(5.7338,58.98965),'007':(5.726,58.99025),'006':(5.7302,58.9869),'002':(5.7361,58.9879),'004':(5.7382,58.98335),'027':(5.7339,58.9828),'015':(5.715,58.9965),'016':(5.715,58.9935)}
        pt=positions.get(id,p.representative_point().coords[0])
        label(pt,f'{id}  {name}',8 if did=='01' else 9,zorder=12,fontweight='semibold')
label((5.767,59.006),'Langøy',9,zorder=12)
ax.text(5.711,59.012,'↑ N',fontsize=12,fontweight='bold',color='#203842')
ax.plot([5.711,5.711+500/(111000*.515)],[58.982,58.982],lw=2,color='#203842',zorder=12)
label((5.7154,58.98255),'ca. 500 m',8,zorder=12)
fig.text(.04,.95,'STAVANGER Z  /  FASE 1',fontsize=13,color='#355c6b',fontweight='bold')
fig.text(.04,.913,'Hundvåg og Byøyene',fontsize=30,color='#193746',fontweight='bold')
fig.text(.77,.913,'L1 · R01 Hundvåg og Byøyene',fontsize=11,color='#193746',fontweight='bold')
fig.text(.77,.885,'L2 · DISTRIKTER',fontsize=14,color='#193746',fontweight='bold')
for i,(did,(name,_)) in enumerate(districts.items()):
    fig.text(.77,.86-i*.025,f'D{did}  {name}',fontsize=11,color='#193746',bbox=dict(fc=palette[did],ec='none',alpha=.55,pad=2))
fig.text(.77,.686,'STRATEGISKE PASSASJER',fontsize=14,color='#193746',fontweight='bold')
for i,(marker,name,road,_,_) in enumerate(connections):
    fig.text(.77,.655-i*.040,f'{marker}  {name}',fontsize=11,color='#332e25',fontweight='bold')
    fig.text(.77,.638-i*.040,road,fontsize=10,color='#5c4c31')
fig.text(.77,.33,'SLIK LESES KARTET',fontsize=14,color='#193746',fontweight='bold')
fig.text(.77,.31,'Blå linje   ·   L2-distriktsgrense\nVinrød linje   ·   L3-grense\nGul linje   ·   valgt veiforbindelse\nStiplet   ·   foreslått grenseforlengelse\nGrått land   ·   kartbakgrunn',fontsize=10,color='#33454a',va='top',linespacing=1.55)
fig.text(.77,.195,'Vann skiller øyene. De gule rutene\nfølger kartlagte veier og bruer.\nUndersjøiske tunneler er utelatt\nfra forbindelsene i dette utkastet.',fontsize=10,color='#33454a',va='top',linespacing=1.45)
fig.text(.77,.09,'Geografisk kartgrunnlag\n© OpenStreetMap-bidragsytere · ODbL\nSoneinndeling · Stavanger Z-utkast',fontsize=9,color='#42565d',va='top')
fig.savefig('docs/evidence/phase1-road-map.png',dpi=145)


