"""Reproduce M1 draft from OSM XML retained in .tools/imports. Requires shapely.
Hand-selected road cuts are design proposals, not official cadastral boundaries.
"""
import sys,json,xml.etree.ElementTree as E
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'.tools/python'))
from shapely.geometry import Point,Polygon,LineString,box,mapping,shape
from shapely.ops import unary_union,polygonize,split
ROOT=Path(__file__).resolve().parents[1]
ns={};ws={};node_tags={}
for f in sorted((ROOT/'.tools/imports').glob('*.xml')):
 r=E.parse(f).getroot()
 for e in r.findall('node'):
  ns[e.get('id')]=(float(e.get('lon')),float(e.get('lat')))
  node_tags[e.get('id')]={x.get('k'):x.get('v') for x in e.findall('tag')}
 for e in r.findall('way'):ws[e.get('id')]=e
ways={i:({'osmId':'way/'+i,**{x.get('k'):x.get('v') for x in e.findall('tag')}},[ns[n.get('ref')] for n in e.findall('nd')]) for i,e in ws.items()}
bounds=box(5.715,58.982,5.744,58.9978)
coasts=[LineString(ps).intersection(bounds) for t,ps in ways.values() if t.get('natural')=='coastline']
parts=list(polygonize(unary_union([bounds.boundary,*coasts])))
land=next(p for p in parts if p.covers(Point(5.735,58.985)))
print('land',land.area,land.bounds,'parts',len(parts))

# The narrow land connection is the L2 boundary; water remains outside land zones.
isthmus=LineString([(5.726,58.9917),(5.7295,58.9923),(5.731,58.9923),(5.733,58.9919)])
l2parts=list(split(land,isthmus).geoms)
buoy=next(p for p in l2parts if p.covers(Point(5.735,58.985)))
hund=unary_union([p for p in l2parts if p!=buoy])
rosenberg=Polygon(ways['32480580'][1]).intersection(buoy)
rest=buoy.difference(rosenberg)
def road(i):return ways[str(i)][1]
def cut_regions(polys,line):
 result=[]
 for p in polys:
  result.extend(g for g in split(p,LineString(line)).geoms if g.area>1e-12)
 return result
buoy_cells=[rest]
# Road-following cuts, with short explicit extensions to coast/industrial boundary.
spine=[(5.7356,58.981),*road(233148292)[::-1],*road(32728717)[::-1],*road(605901582),*road(32728632)[::-1],*road(605901581),*road(903276583),*road(42364292),*road(33036720),(5.7304,58.9924)]
# Use a continuous south-to-north trace without duplicate/reversed road fragments.
spine=[(5.7356,58.981),*road(233148292)[::-1],*road(32728717)[::-1],*road(605901582),*road(32728632)[::-1],*road(605901581),*road(903276583),*road(42364292),*road(33036720),(5.7304,58.9924)]
buoy_cells=cut_regions(buoy_cells,spine)
for line in [
 [(5.728,58.9883),*road(33047991),(5.7331389,58.9885406),*road(33113774),(5.7378,58.9903)],
 [(5.731,58.9856),*road(32456605)[::-1],(5.74,58.9879)],
 [(5.7338,58.9843),*road(32728744),(5.74,58.9844)]
]:buoy_cells=cut_regions(buoy_cells,line)
# Coarse Hundvaag corridor proposals, not exact street-following boundaries.
hund_cells=[hund]
hund_cells=cut_regions(hund_cells,[(5.710,58.9958),(5.7289,58.9932),(5.732263,58.993059),(5.7355,58.9937),(5.7372,58.9941),(5.742,58.994),(5.745,58.994)])
hund_cells=cut_regions(hund_cells,[(5.7329,58.990),(5.7334,58.9945),(5.7335,58.9954),(5.7337,58.9978),(5.7337,59.0)])
buoy_cells=[p for p in buoy_cells if p.area*111000**2*.515>500]

print('cells',len(buoy_cells),len(hund_cells),'Buoy areas',[round(p.area*111000**2*.515) for p in buoy_cells])

# Stable registry: lookup by interior anchor, never assign IDs by polygon order.
registry=[
 ('cell-001','Hundvågveien / Kommandørveien',(5.73257,58.99044),'Buøy: smal adkomst nordover; kyst og Skipsbyggergata begrenser utvidelse.'),
 ('cell-002','Buøy idrett / Beite',(5.73536,58.98756),'Idrettsområde og boligfelt; Runeveien og Styrmannsveien foreslås som arbeidsgrenser.'),
 ('cell-003','Tårnringen / Fregattveien',(5.73704,58.98504),'Startkandidat i boligområdet; sjø mot øst og gatenett mot verftet.'),
 ('cell-004','Pyntesundveien',(5.73509,58.98339),'Sørvestlig kystlomme; forbindelse tilbake til hovedgaten må holdes åpen.'),
 ('cell-005','Clipperveien / verftsadkomst (05)',(5.73291,58.98505),'Foreløpig adkomstsone ved Skipsbyggergata/Clipperveien. Tilknytning til verftet er kartlagt, men fysisk stengbarhet og sonebredde må vurderes.'),
 ('cell-006','Skipsbyggergata / Ankerplassen',(5.73136,58.98766),'Korridor langs verftsgrensen med strategisk adkomst til framtidig HQ.'),
 ('cell-007','Bangarvågen / verftsadkomst',(5.72286,58.98900),'Kai og industriområde nord for Rosenberg; større sone med sammenhengende arealbruk.'),
 ('cell-008','Ulsnes / Hundvågkrossen',(5.7296,58.9931),'Sørvestlig Hundvåg: forsyningsmål og adkomst fra Buøy; kyst og ringvei er førende.'),
 ('cell-009','Nedre Vågen',(5.74003,58.99120),'På motsatt side av Galeivågen: nær i luftlinje, men landruten går rundt vågen.'),
 ('cell-010','Hundvågkrossen / kirkeområdet',(5.729,58.9966),'Nordlig utvidelsesfront; øvre og vestre kartkant er utsnitt, ikke en fysisk barriere.'),
 ('cell-011','Austbø / skoleområdet',(5.7388,58.9966),'Skoler og idrett som geografiske mål; nord- og østgrense er åpent kartutsnitt.'),
]
cells=[]
for id,name,anchor,why in registry:
 matches=[p for p in buoy_cells+hund_cells if p.covers(Point(anchor))]
 assert len(matches)==1,(id,anchor,len(matches))
 cells.append((id,name,matches[0],True,why))
cells.append(('cell-012','Rosenberg verft — framtidig HQ',rosenberg,False,'OSM-industrigrense; kandidat, ikke automatisk kontrollert eller tilgjengelig i M1.'))
assert len({g.wkb for _,_,g,_,_ in cells})==len(cells)
# Future bridge landing on Engøy: deliberately only a small map-fringe polygon.
engoy=next(p for p in parts if p.covers(Point(5.743,58.9825)))
engoy=engoy.intersection(box(5.7415,58.982,5.744,58.9833))
if engoy.geom_type=='MultiPolygon':engoy=max(engoy.geoms,key=lambda g:g.area)

cells.append(('cell-013','Engøy — framtidig bruland',engoy,False,'Randobjekt for Pyntesund bru. Resten av Engøy inngår ikke i M1.'))
def geo(g):
 # Remove only zero-width overlay holes (sub-mm^2), never meaningful water.
 if g.geom_type=='Polygon':g=Polygon(g.exterior,[r for r in g.interiors if Polygon(r).area>1e-15])
 elif g.geom_type=='MultiPolygon':
  from shapely.geometry import MultiPolygon
  g=MultiPolygon([Polygon(p.exterior,[r for r in p.interiors if Polygon(r).area>1e-15]) for p in g.geoms if p.area>1e-15])
 return json.loads(json.dumps(mapping(g)))
def zone(id,name,level,g,parent=None,playable=True,why=''):
 d={'id':id,'name':name,'level':level,'playable':playable,'geometry':geo(g),'rationale':why,'sourceIds':['osm','curation']}
 if parent:d['parentId']=parent
 return d
buoy_area=unary_union([g for _,_,g,_,_ in cells[:7]]+[rosenberg])
hund_area=unary_union([g for _,_,g,_,_ in cells[7:11]])
root_area=unary_union([buoy_area,hund_area,engoy])
zones=[zone('region-001','Buøy / Hundvåg — M1-utsnitt',1,root_area,why='Kun kuratert utsnitt. Nord/øst er ikke verdens yttergrense.'),zone('district-001','Buøy',2,buoy_area,'region-001'),zone('district-002','Hundvåg sør',2,hund_area,'region-001'),zone('district-003','Engøy — framtidig rand',2,engoy,'region-001',False)]
for id,name,g,playable,why in cells:
 parent='district-001' if id in [c[0] for c in cells[:7]] or id=='cell-012' else 'district-003' if id=='cell-013' else 'district-002'
 zones.append(zone(id,name,3,g,parent,playable,why))
# Keep useful geographic context only; exclude contact/personal metadata from source.
features=[]
for t,ps in ways.values():
 keep={k:v for k,v in t.items() if k in ['osmId','name','highway','natural','landuse','building','water','tunnel','bridge','access']}
 if len(ps)<2:continue
 g=LineString(ps)
 if not g.intersects(bounds):continue
 if t.get('natural')=='coastline':kind='coast'
 elif 'highway' in t:kind='road'
 elif 'building' in t:kind='building'
 else:continue
 keep['kind']=kind
 features.append({'type':'Feature','properties':keep,'geometry':geo(g)})
(ROOT/'packages/world-data/data/basemap.json').write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False),encoding='utf8')
# POIs: original OSM positions/area representative points, no invented capacities or loot.
poi_specs=[('poi-001','Buøy idrettsanlegg','way','32456501','sports',False),('poi-002','Rosenberg verft','way','32480580','industrial',True),('poi-003','Buøy transformatorstasjon','way','295444551','power',False),('poi-004','Meny Hundvåg','node','1795799207','supplies',False),('poi-005','Rema 1000 Hundvåg','node','1896814062','supplies',False),('poi-006','Apotek 1 Hundvåg','node','6336088347','medical',False),('poi-007','Hundvåg skole','way','33105939','school',False),('poi-008','Austbø skole','way','232686957','school',False),('poi-009','Hundvåghallen','way','709617061','sports',False),('poi-010','Buøy rampe — tunnelport','node','2031514518','transport',False)]
pois=[]
for id,name,typ,oid,kind,hq in poi_specs:
 pos=Point(ns[oid]) if typ=='node' else Polygon(ways[oid][1]).representative_point()
 parent=next((cid for cid,_,g,_,_ in cells if g.covers(pos)),None)
 if parent:
  pois.append({'id':id,'name':name,'cellId':parent,'kind':kind,'hqCandidate':hq,'geometry':geo(pos),'sourceIds':['osm']})
 else:print('POI outside',name,list(pos.coords))
# Source routes: Dijkstra on a finite road/footpath graph. Each selected connection
# is explicit; polygon contact alone never creates an edge.
import math,heapq
G={};nodecell={}
def distance(a,b):return math.hypot((a[0]-b[0])*.515,a[1]-b[1])*111000
for t,ps in ways.values():
 if 'highway' not in t or t.get('highway') in ['trunk','trunk_link','motorway','motorway_link'] or t.get('tunnel')=='yes':continue
 for a,b in zip(ps,ps[1:]):
  G.setdefault(a,[]).append((b,distance(a,b)));G.setdefault(b,[]).append((a,distance(a,b)))
for id,_,g,_,_ in cells:
 pts=[p for p in G if g.covers(Point(p))]
 if not pts:continue
 target=g.representative_point();nodecell[id]=min(pts,key=lambda p:distance(p,(target.x,target.y)))
def route(a,b):
 start=nodecell[a];end=nodecell[b];q=[(0,start)];dist={start:0};prev={}
 while q:
  d,p=heapq.heappop(q)
  if p==end:break
  if d>dist[p]:continue
  for nxt,cost in G[p]:
   nd=d+cost
   if nd<dist.get(nxt,float('inf')):dist[nxt]=nd;prev[nxt]=p;heapq.heappush(q,(nd,nxt))
 if end not in dist:raise ValueError(('no route',a,b))
 path=[end]
 while path[-1]!=start:path.append(prev[path[-1]])
 return path[::-1]
edge_specs=[
 ('edge-001','cell-003','cell-002','Buøy ring / Runeveien','road','active'),
 ('edge-002','cell-002','cell-001','Buøy ring / Styrmannsveien','road','active'),
 ('edge-003','cell-003','cell-004','Skipsbyggergata sør','road','active'),
 ('edge-004','cell-003','cell-005','Dalehaugen / Skipsbyggergata','road','active'),
 ('edge-005','cell-005','cell-006','Skipsbyggergata langs verftet','road','active'),
 ('edge-006','cell-006','cell-007','Ankerplassen / Bangarvågsgata','road','active'),
 ('edge-007','cell-007','cell-001','Bangarvågsgata nord','road','active'),
 ('edge-008','cell-001','cell-008','Hundvågveien — smalt eid','road','active'),
 ('edge-009','cell-008','cell-009','Hundvåg ring rundt Galeivågen','road','active'),
 ('edge-010','cell-008','cell-010','Hundvåg ring vest','road','active'),
 ('edge-011','cell-009','cell-011','Austbø-adkomst','road','active'),
 ('edge-012','cell-010','cell-011','Skole-/boligforbindelse','road','active'),
 ('edge-013','cell-006','cell-012','Verftsadkomst fra Skipsbyggergata','road','future'),
 ('edge-014','cell-003','cell-013','Pyntesund bru → Engøy','bridge','future')]
edges=[];seen_pairs=set()
for proposal,a,b,name,kind,status in edge_specs:
 ps=route(a,b)
 # Each emitted edge crosses exactly one modeled cell boundary. Intermediate
 # cells on a proposed route are explicit graph vertices, never skipped.
 for p,q in zip(ps,ps[1:]):
  ca=next((cid for cid,_,g,_,_ in cells if g.covers(Point(p))),None)
  cb=next((cid for cid,_,g,_,_ in cells if g.covers(Point(q))),None)
  if not ca or not cb or ca==cb:continue
  pair=tuple(sorted([ca,cb]))
  if pair in seen_pairs:continue
  seen_pairs.add(pair)
  future=any(not play for cid,_,_,play,_ in cells if cid in pair)
  edges.append({'id':'edge-'+pair[0].replace('cell-','')+'-'+pair[1].replace('cell-',''),'name':name,'fromCellId':ca,'toCellId':cb,'kind':kind,'modes':['walk','cycle'],'status':'future' if future else 'active','geometry':{'type':'LineString','coordinates':[p,q]},'sourceIds':['osm','curation'],'rationale':'Eksplisitt nabopassasje ved OSM-gate. Tilgang og porter må verifiseres før spilling.'})
 # A bridge intentionally crosses unzoned water and is never inferred by contact.
 if kind=='bridge':
  edges.append({'id':'edge-bridge-pyntesund','name':name,'fromCellId':a,'toCellId':b,'kind':'bridge','modes':['walk','cycle'],'status':'future','geometry':{'type':'LineString','coordinates':ps},'sourceIds':['osm','curation'],'rationale':'Gang-/sykkelrute via Pyntesund bru. Framtidig Engøy er ikke spillbart.'})
# Clipperveien is a mapped perimeter corridor, NOT evidence of an entrance into the yard.
clipper=road(1051499023)
edges.append({'id':'edge-003-005-clipper','name':'Krysset Skipsbyggergata / Clipperveien','fromCellId':'cell-003','toCellId':'cell-005','kind':'road','modes':['walk','cycle'],'status':'proposed','geometry':{'type':'LineString','coordinates':clipper[:2]},'sourceIds':['osm','curation'],'rationale':'Felles gatenode ved OSM way/1051499023. Ikke en bekreftet stengbar port. Krysset gir en lokal tilknytning uten tvungen omvei via sone 04.'})
# The actual Clipperveien trace confirms 05 -> 06, but stays outside the HQ polygon.
for edge in edges:
 if edge['id']=='edge-005-006':
  i=next(i for i,p in enumerate(clipper) if dict((cid,g) for cid,_,g,_,_ in cells)['cell-006'].covers(Point(p)))
  edge['name']='Clipperveien langs verftsgrensen'
  edge['geometry']={'type':'LineString','coordinates':clipper[:i+1]}
  edge['rationale']='Kildebelagt korridor fra 05 til 06. Dette er ikke dokumentasjon på direkte adgang til Rosenberg.'
# An extent boundary on land is explicitly unknown territory, not a barrier.
frontiers=[]
for cid,_,g,_,_ in cells:
 for side,line in [('north',LineString([(5.715,58.9978),(5.744,58.9978)])),('east',LineString([(5.744,58.982),(5.744,58.9978)])),('west',LineString([(5.715,58.982),(5.715,58.9978)])),('south',LineString([(5.715,58.982),(5.744,58.982)]))]:
  inter=g.boundary.intersection(line)
  segments=[inter] if inter.geom_type=='LineString' else [p for p in getattr(inter,'geoms',[]) if p.geom_type=='LineString']
  for idx,segment in enumerate(segments):
   if segment.length>1e-8:frontiers.append({'id':'frontier-'+cid+'-'+side+'-'+str(idx),'cellId':cid,'externalAreaId':'outside-engoy' if cid=='cell-013' else 'outside-hundvaag','kind':'unmodeled-land','geometry':geo(segment),'sourceIds':['osm','curation']})
# Underground roads are drawn as source context; no surface adjacency is inferred.
barriers=[{'id':'barrier-001','name':'Galeivågen — vannbarriere','kind':'water','geometry':{'type':'LineString','coordinates':[(5.734,58.9908),(5.7365,58.9902),(5.739,58.9896),(5.742,58.9881)]},'sourceIds':['osm','curation']},{'id':'barrier-002','name':'Bangarvågen — vannbarriere','kind':'water','geometry':{'type':'LineString','coordinates':[(5.721,58.991),(5.725,58.9914),(5.728,58.9917)]},'sourceIds':['osm','curation']},{'id':'barrier-003','name':'Pyntesundet — vannbarriere','kind':'water','geometry':{'type':'LineString','coordinates':[(5.736,58.9823),(5.739,58.9829),(5.741,58.9835)]},'sourceIds':['osm','curation']}]
world={'schemaVersion':1,'worldId':'stavanger-islands','worldVersion':'m1-draft.1','status':'draft','sources':[{'id':'osm','name':'OpenStreetMap contributors','url':'https://www.openstreetmap.org/copyright','license':'ODbL-1.0','retrievedAt':'2026-10-31','note':'Three official API 0.6 map extracts. Source feature IDs retained in basemap.json. See data/SOURCES.md.'},{'id':'curation','name':'Stavanger Z — M1-kuratering','url':'https://www.openstreetmap.org/#map=15/58.990/5.733','license':'Project draft; geographic derivatives subject to ODbL','retrievedAt':'2026-10-31','note':'Ugodkjente spillgrenser og rutevalg. Ikke eiendomsgrenser eller bekreftet fysisk adgang.'}],'zones':zones,'pois':pois,'edges':edges,'barriers':barriers,'frontiers':frontiers}
# Apply the approved gameplay cleanup after the original draft curation.
import runpy
world=runpy.run_path(str(ROOT/'scripts/tidy-geography.py'))['tidy_world'](world)
zones=world['zones'];edges=world['edges'];pois=world['pois']
target=ROOT/'packages/world-data/data/world-draft.json'
content=json.dumps(world,ensure_ascii=False,indent=2)
if target.exists() and json.loads(target.read_text(encoding='utf8')).get('status')!='draft' and target.read_text(encoding='utf8')!=content:
 raise RuntimeError('Published world is immutable. Create a new world version/file before revising active saved geography; M1 drafts remain editable.')
target.write_text(content,encoding='utf8')
print('written',len(zones),'zones',len(pois),'pois',len(edges),'edges')

locations=[]
for z in zones:
 p=shape(z['geometry']).representative_point()
 locations.append({'id':z['id'],'lon':p.x,'lat':p.y})
(ROOT/'packages/world-data/data/review-locations.json').write_text(json.dumps(locations),encoding='utf8')
(ROOT/'packages/world-data/data/zones.geojson').write_text(json.dumps({'type':'FeatureCollection','features':[{'type':'Feature','id':z['id'],'properties':{k:v for k,v in z.items() if k!='geometry'},'geometry':z['geometry']} for z in zones]},ensure_ascii=False),encoding='utf8')

# Independent GIS checks on serialized data; road connections must not cross sea.
from itertools import combinations
for z in zones:assert shape(z['geometry']).is_valid,z['id']
for a,b in combinations([z for z in zones if z['level']==3],2):
 assert shape(a['geometry']).intersection(shape(b['geometry'])).area<1e-15,(a['id'],b['id'])
for e in edges:
 if e['kind']!='bridge':assert root_area.buffer(1e-9).covers(shape(e['geometry'])),e['id']
print('PASS: GIS validity, disjoint L3 interiors, no road passage across sea')
