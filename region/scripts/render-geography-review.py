"""Static, shareable M1 close-ups from the retained OSM source, not screen captures."""
import sys, json, math, heapq, textwrap
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
from shapely.geometry import shape, Point, LineString, box
from shapely.ops import split
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as effects
from matplotlib.patches import Polygon as PlotPolygon
from matplotlib.lines import Line2D

world = json.loads((ROOT/'packages/world-data/data/archive/m1-review.json').read_text(encoding='utf8'))
zones = {z['id']: z for z in world['zones'] if z['level'] == 3}
geoms = {id: shape(z['geometry']) for id,z in zones.items()}
nodes, node_tags, ways = {}, {}, {}
for path in sorted((ROOT/'.tools/imports').glob('*.xml')):
    root = ET.parse(path).getroot()
    for node in root.findall('node'):
        id = node.get('id'); nodes[id] = (float(node.get('lon')), float(node.get('lat')))
        node_tags[id] = {t.get('k'): t.get('v') for t in node.findall('tag')}
    for way in root.findall('way'): ways[way.get('id')] = way
roads = {id: ({t.get('k'): t.get('v') for t in way.findall('tag')}, [nodes[n.get('ref')] for n in way.findall('nd')]) for id,way in ways.items()}
output = ROOT/'docs/evidence'
output.mkdir(exist_ok=True)

def distance(a,b): return math.hypot((a[0]-b[0])*.515, a[1]-b[1])*111000
G = {}
for tags,ps in roads.values():
    if 'highway' not in tags or tags.get('foot') == 'no' or tags.get('access') == 'private' or tags.get('tunnel') == 'yes' or tags.get('highway') in ['trunk','trunk_link','motorway','motorway_link','construction']: continue
    for a,b in zip(ps,ps[1:]):
        G.setdefault(a,[]).append((b,distance(a,b))); G.setdefault(b,[]).append((a,distance(a,b)))

def route(a,b,avoid=None):
    start = min(G,key=lambda p: distance(p,a)); end = min(G,key=lambda p: distance(p,b))
    queue=[(0,start)]; costs={start:0}; parents={}
    while queue:
        cost,p=heapq.heappop(queue)
        if p == end: break
        if cost > costs[p]: continue
        for nxt,step in G[p]:
            if avoid is not None and LineString([p,nxt]).intersects(avoid): continue
            new=cost+step
            if new < costs.get(nxt,float('inf')):
                costs[nxt]=new; parents[nxt]=p; heapq.heappush(queue,(new,nxt))
    if end not in costs: return [], None
    path=[end]
    while path[-1] != start: path.append(parents[path[-1]])
    return path[::-1], costs[end]

start=(5.73704,58.98504); north=(5.731106,58.993700); corridor=(5.7306885,58.986896)
north_path,north_length=route(start,north)
west_path,west_length=route(start,corridor)
bypass,bypass_length=route(start,corridor,geoms['cell-005'])
print(json.dumps({'walking_network_estimates_m':{'start_to_meny':round(north_length) if north_length else None,'start_to_clipper_corridor':round(west_length) if west_length else None,'corridor_avoiding_05':round(bypass_length) if bypass_length else None},'note':'Network distances, not safe-access proof or game ETA. No private paths or foot=no roads.'}))

proposal=LineString([(5.7221,58.9912),*roads['27473078'][1],(5.7272,58.9870)])
proposal_parts=[g for g in split(geoms['cell-007'],proposal).geoms if g.area>1e-10]
print('07 proposal parts, approximate m2:',[round(g.area*111000**2*.515) for g in proposal_parts])

colors={'cell-003':'#b4d7cf','cell-005':'#f4ce80','cell-007':'#c6d8ad','cell-012':'#d9d1bc'}
def polygons(g): return list(g.geoms) if g.geom_type=='MultiPolygon' else [g]
def draw_line(ax,ps,**kwargs):
    if len(ps)>1: ax.plot(*zip(*ps),**kwargs)
def label(ax,text,xy,offset=(6,6),size=10,color='#202e32'):
    ax.annotate(text,xy,xytext=offset,textcoords='offset points',fontsize=size,color=color,
                path_effects=[effects.withStroke(linewidth=3,foreground='#ffffffdf')],clip_on=True,zorder=12)
def render(code,title,extent,notes,street_ids,show_routes=False,show_split=False):
    fig=plt.figure(figsize=(14,9.3),facecolor='#fafbf7')
    ax=fig.add_axes([.045,.13,.69,.77]); info=fig.add_axes([.76,.13,.22,.77]); info.axis('off')
    ax.set_facecolor('#dfedf1'); view=box(*extent)
    for id,g in geoms.items():
        if not g.intersects(view): continue
        for poly in polygons(g):
            ax.add_patch(PlotPolygon(poly.exterior.coords,facecolor=colors.get(id,'#e9ece2'),edgecolor='#56615c',linewidth=1.4,zorder=1))
            for hole in poly.interiors: ax.add_patch(PlotPolygon(hole.coords,facecolor='#dfedf1',edgecolor='#56615c',linewidth=.6,zorder=2))
    for id,(tags,ps) in roads.items():
        if len(ps)<2 or not LineString(ps).intersects(view):continue
        if 'building' in tags:
            draw_line(ax,ps,color='#aeb6ac',linewidth=.5,zorder=3)
        elif 'highway' in tags:
            if tags.get('tunnel')=='yes': draw_line(ax,ps,color='#988caa',linewidth=1,linestyle=':',alpha=.5,zorder=4)
            elif tags['highway'] in ['trunk','trunk_link','motorway','motorway_link']: draw_line(ax,ps,color='#838a8d',linewidth=1,zorder=4)
            else: draw_line(ax,ps,color='#8c9285',linewidth=1.7 if tags['highway'] in ['secondary','tertiary'] else .8,zorder=4)
        if tags.get('barrier') in ['fence','wall','retaining_wall']:
            draw_line(ax,ps,color='#8b5775',linewidth=1.4,linestyle='--',zorder=6)
    if show_split:
        for i,g in enumerate(proposal_parts):
            for poly in polygons(g):ax.add_patch(PlotPolygon(poly.exterior.coords,facecolor='#99b3d8' if i==0 else '#d0b78b',alpha=.28,edgecolor='none',zorder=5))
        draw_line(ax,list(geoms['cell-007'].intersection(proposal).coords),color='#b45c3e',linewidth=3,linestyle='--',zorder=8)
        for i,g in enumerate(proposal_parts):
            p=g.representative_point();label(ax,'07'+chr(65+i)+' · forslag',(p.x,p.y),(-5,0),12)
    if show_routes:
        for path,col in [(north_path,'#2a7087'),(west_path,'#b05b32')]:draw_line(ax,path,color=col,linewidth=3.5,alpha=.9,zorder=7)
        ax.plot(*start,marker='o',color='#263b36',ms=8,zorder=10);label(ax,'START 03',start,(10,-4),11)
    if code=='05':
        draw_line(ax,roads['1051499023'][1],color='#b05b32',linewidth=3,zorder=7)
        junction=roads['1051499023'][1][0]
        ax.plot(*junction,marker='o',color='#b05b32',ms=8,zorder=10)
        label(ax,'K · faktisk gatenode\nIngen port bekreftet',junction,(30,20),10)
        if bypass:draw_line(ax,bypass,color='#2a7087',linewidth=2,linestyle=':',zorder=7)
    for id,tags in node_tags.items():
        if tags.get('barrier') in ['gate','turnstile'] and view.covers(Point(nodes[id])):
            ax.plot(*nodes[id],marker='s',ms=5,color='#8b5775',markeredgecolor='white',markeredgewidth=.6,zorder=9)
    for id,short in [('12909093403','G1'),('12909093404','G2'),('12912004221','G3')]:
        if view.covers(Point(nodes[id])):label(ax,short,nodes[id],(7,-10),9,'#733651')
    for id in street_ids:
        tags,ps=roads[id]; inside=[p for p in ps if view.covers(Point(p))]
        if inside:
            offset = (45,-45) if code=='05' and id=='32728632' else (4,18) if code=='07' and id=='27473078' else (4,5)
            label(ax,tags.get('name','Uten gatenavn'),inside[len(inside)//2],offset,9)
    for id,g in geoms.items():
        p=g.intersection(view).representative_point() if g.intersects(view) else g.representative_point()
        if view.covers(p) and not (show_split and id=='cell-007') and not (show_routes and id=='cell-003'):
            label(ax,id[-2:]+(' · framtidig HQ' if id=='cell-012' else ''),(p.x,p.y),(0,0),12)
    for frontier in world.get('frontiers',[]):
        draw_line(ax,frontier['geometry']['coordinates'],color='#aa5d36',linewidth=3,linestyle=':',zorder=8)
    ax.set_xlim(extent[0],extent[2]);ax.set_ylim(extent[1],extent[3]);ax.set_aspect(1/.515)
    ax.tick_params(left=False,bottom=False,labelleft=False,labelbottom=False)
    # Scale derived in metres at local latitude, no game travel-time assumption.
    metres=100 if code=='05' else 200
    x=extent[0]+(extent[2]-extent[0])*.06;y=extent[1]+(extent[3]-extent[1])*.05
    ax.plot([x,x+metres/(111000*.515)],[y,y],color='#263b36',lw=3,zorder=15)
    label(ax,f'{metres} m',(x,y),(0,7),9)
    ax.text(.98,.97,'N ↑',transform=ax.transAxes,ha='right',va='top',fontsize=12,color='#263b36')
    info.text(0,1,'GEOGRAFISK VURDERING',fontsize=10,color='#526157',weight='bold',va='top')
    y=.92
    for heading,body in notes:
        info.text(0,y,heading,fontsize=12,weight='bold',va='top',color='#253b33');y-=.045
        wrapped=textwrap.fill(body,34)
        info.text(0,y,wrapped,fontsize=10,va='top',linespacing=1.5,color='#394b42');y-=.036*(wrapped.count('\n')+1)+.045
    handles=[Line2D([0],[0],color='#56615c',lw=1.5,label='Foreløpig sonegrense'),Line2D([0],[0],color='#8c9285',lw=2,label='OSM-vei'),Line2D([0],[0],color='#8b5775',ls='--',label='OSM-gjerde / mur'),Line2D([0],[0],marker='s',color='#8b5775',ls='',label='OSM-port / dreiekors')]
    if show_split:handles.append(Line2D([0],[0],color='#b45c3e',ls='--',label='Mulig deling – ingen vegg'))
    if show_routes:handles.extend([Line2D([0],[0],color='#2a7087',lw=3,label='Mot nord / forsyningsmål'),Line2D([0],[0],color='#b05b32',lw=3,label='Mot verftskorridoren')])
    fig.legend(handles=handles,loc='lower left',bbox_to_anchor=(.045,.055),frameon=False,ncol=3,fontsize=9)
    fig.text(.045,.95,title,fontsize=21,color='#253b33',weight='bold')
    fig.text(.045,.918,'Stavanger Z · M1-revisjon · Utkast, ingen grenser er låst',fontsize=11,color='#526157')
    fig.text(.045,.025,'Kilde: © OpenStreetMap contributors, ODbL · uttrekk 31.10.2026. Soner og ruteforslag: Stavanger Z. Porter/adgang ikke fysisk verifisert.',fontsize=8.5,color='#526157')
    fig.savefig(output/f'm1-detail-{code}.png',dpi=160,facecolor=fig.get_facecolor());plt.close(fig)

render('03','03 · To retninger fra startområdet',(5.7285,58.9821,5.741,58.9909),[
    ('Nord: forsyningsmål','Buøy ring leder mot Hundvåg. Matbutikk og apotek er kartlagte mål lenger nord. Ingen mengder loot eller trygg rute er garantert.'),
    ('Vest: verftskorridoren','Skipsbyggergata og Clipperveien gir en annen geografisk retning. Rosenberg er framtidig mål; port og adgang er fortsatt uavklart.'),
    ('Hva valget betyr','Forsyninger og rekognosering nordover, eller tidlig investering i adkomst mot HQ. Kampfare og kostnader er ennå ikke satt.')
],['42076807','32728744','605901581','1051499023','32456605'],show_routes=True)

render('05','05 · Et veikryss, ikke en bevist flaskehals',(5.7305,58.9840,5.7354,58.98655),[
    ('Behold ID 05 foreløpig','Clipperveien kobles til Skipsbyggergata i det markerte krysset K. Dette er en virkelig tilknytning til korridoren langs verftet.'),
    ('Begrunnelsen er betinget','Clipperveien går gjennom 05 til 06. I det filtrerte gangnettet fant vi ingen omvei rundt 05 til denne korridoren. Fysisk port eller adgang til HQ er ikke bekreftet.'),
    ('Grensen må vurderes','Omtrent 3 000 m² er et smalt utsnitt, ikke i seg selv forsvarsverdi. Behold området som adkomstforslag; ikke gi det magisk kontroll over alle ruter.')
],['32728632','1051499023','32728689'])

render('07','07 · Kaiområde og gjennomgående adkomst',(5.7166,58.9871,5.7335,58.9928),[
    ('Delingskandidat','Tømmerodden er en faktisk kai-/servicevei. Den røde linjen følger veien med korte forlengelser mot kyst og industrigrense.'),
    ('Hvorfor vurdere deling','Et vestlig kaiområde kan være eget oppdrag, mens den østlige delen fører mot eid og verftsadkomst. Da trenger ikke all kai ryddes for å arbeide med gjennomfart.'),
    ('Ikke en ny mur','G1–G3 er porter i OSM; gjerdestykker finnes, men ingen sammenhengende sperre langs hele delingslinjen er bekreftet. 07A/B er alternativer, ikke nye låste soner.')
],['27473078','326899874','277706344','1074216169','192602750'],show_split=True)

(output/'geography-detail-facts.json').write_text(json.dumps({'routeEstimatesMetres':{'startToMeny':north_length,'startToClipperCorridor':west_length,'corridorAvoiding05':bypass_length},'zone05AreaApproxM2':geoms['cell-005'].area*111000**2*.515,'zone07AreaApproxM2':geoms['cell-007'].area*111000**2*.515,'proposal07AreasApproxM2':[g.area*111000**2*.515 for g in proposal_parts]},indent=2),encoding='utf8')
