"""Shareable maps for the 41-zone owner review."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as effects
from matplotlib.collections import LineCollection, PolyCollection
from shapely.geometry import LineString, Point, Polygon, box, shape

OUTPUT = ROOT / 'dist'
world = json.loads((OUTPUT / 'stavanger-z-world-41-road-draft.json').read_text(encoding='utf-8'))
extract = json.loads((OUTPUT / 'geografi-41-context-work.json').read_text(encoding='utf-8'))
cells = [z for z in world['zones'] if z['level'] == 3]
geometries = {z['id']: shape(z['geometry']) for z in cells}
region = shape(world['zones'][0]['geometry'])
buildings, roads = [], []
for feature in extract['features']:
    coordinates = feature['coordinates']
    if feature['kind'] == 'building':
        geometry = Polygon(coordinates)
        if not geometry.is_valid:
            continue
        hours = {'house': 1, 'detached': 1, 'terrace': 3, 'semidetached_house': 3,
                 'apartments': 6, 'dormitory': 6}.get(feature['tag'], 2)
        buildings.append((geometry, geometry.centroid, hours))
    elif feature['kind'] == 'road':
        roads.append((LineString(coordinates), feature['tag']))


def code(zone):
    name = zone['name']
    if zone['parentId'] == 'district-001':
        return 'B' + name[:2]
    for group, prefix in [('Hundvåg', 'H'), ('Engøy', 'E'), ('Bjørnøy', 'BJ'),
                          ('Roaldsøy', 'R'), ('Ormøy', 'O')]:
        if name.startswith(group + ' '):
            return prefix + name.split()[1]
    return 'S' if name.startswith('Sølyst') else 'G'


def draw_map(filename, selected, title, subtitle, details=False, size=(13, 15)):
    shapes = [geometries[z['id']] for z in selected]
    left = min(g.bounds[0] for g in shapes)
    bottom = min(g.bounds[1] for g in shapes)
    right = max(g.bounds[2] for g in shapes)
    top = max(g.bounds[3] for g in shapes)
    padding = .0012
    extent = box(left - padding, bottom - padding, right + padding, top + padding)

    def xy(points):
        return [((x - left) * 57165, (y - bottom) * 111000) for x, y in points]

    def paths(geometry, kind):
        if geometry.is_empty:
            return []
        if geometry.geom_type == kind:
            coordinates = geometry.exterior.coords if kind == 'Polygon' else geometry.coords
            return [xy(coordinates)]
        return [p for part in geometry.geoms for p in paths(part, kind)] if hasattr(geometry, 'geoms') else []

    fig, ax = plt.subplots(figsize=size, facecolor='#f8f7f3')
    fig.subplots_adjust(left=.025, right=.975, top=.90, bottom=.095)
    fig.text(.03, .958, title, fontsize=24, weight='bold', color='#1b3038')
    fig.text(.03, .929, subtitle, fontsize=11, color='#465d65')
    (x0, y0), (x1, y1) = xy([(extent.bounds[0], extent.bounds[1]), (extent.bounds[2], extent.bounds[3])])
    ax.set(xlim=(x0, x1), ylim=(y0, y1), aspect='equal', xticks=[], yticks=[], facecolor='#d0e1e7')
    ax.add_collection(PolyCollection(paths(region.intersection(extent), 'Polygon'),
                                    facecolor='#efeee5', edgecolor='#98adb0', linewidth=.55))
    for zone in selected:
        geometry = geometries[zone['id']]
        color = '#dbccdd' if zone['hq'] else '#d3dfc8'
        ax.add_collection(PolyCollection(paths(geometry, 'Polygon'),
                                        facecolor=color, edgecolor='none', zorder=2))
        ax.add_collection(LineCollection(paths(geometry.boundary, 'LineString'),
                                        colors='#4d6b67', linewidths=1.0, zorder=5))
    visible_buildings = [g for g, center, hours in buildings if g.intersects(extent)]
    for district in [z for z in world['zones'] if z['level'] == 2]:
        border = shape(district['geometry']).boundary.intersection(extent)
        ax.add_collection(LineCollection(paths(border, 'LineString'),
                                        colors='#245f84', linewidths=1.2, zorder=5))
    ax.add_collection(PolyCollection([p for g in visible_buildings for p in paths(g, 'Polygon')],
                                    facecolor='#a0988c', edgecolor='none', alpha=.78, zorder=3))
    for major in (False, True):
        lines = [p for g, tag in roads
                 if (tag in ('primary', 'secondary', 'tertiary')) == major and g.intersects(extent)
                 for p in paths(g, 'LineString')]
        ax.add_collection(LineCollection(lines, colors='#6f6455' if major else '#a3998b',
                                        linewidths=.7 if major else .35, zorder=4))
    for edge in world['edges']:
        if edge['kind'] != 'bridge':
            continue
        line = shape(edge['geometry'])
        if not line.intersects(extent):
            continue
        ax.add_collection(LineCollection(paths(line, 'LineString'), colors='#965c32',
                                        linewidths=1.8, zorder=6))
    for zone in selected:
        geometry = geometries[zone['id']]
        point = geometry.representative_point()
        # Split labels on the slim southeast Buøy strip to avoid collisions.
        if code(zone) == 'B07':
            point = Point(5.72845 + (1140 - 529) / 46603, 58.9908 - (590 - 220) / 90500)
        if code(zone) == 'B08':
            point = Point(5.72845 + (1010 - 529) / 46603, 58.9908 - (680 - 220) / 90500)
        if code(zone) == 'O01':
            point = Point(point.x - .00045, point.y + .0004)
        if code(zone) == 'O02':
            point = Point(point.x + .0003, point.y - .00035)
        if code(zone) == 'H08' and details:
            shifted = Point(point.x - .0004, point.y - .0005)
            if geometry.covers(shifted):
                point = shifted
        x, y = xy([(point.x, point.y)])[0]
        label = code(zone)
        if details:
            hits = [hours for _, center, hours in buildings if geometry.covers(center)]
            label += f'\n{len(hits)} bygg\n{sum(hits)} est. t'
        ax.text(x, y, label, ha='center', va='center', fontsize=10 if details else 9,
                weight='bold', color='#21353d', zorder=9,
                path_effects=[effects.withStroke(linewidth=3.2, foreground='#fcfaf3')])
    ax.annotate('', xy=(.955, .955), xytext=(.955, .90), xycoords='axes fraction',
                arrowprops={'arrowstyle': '-|>', 'color': '#294652'})
    ax.text(.955, .88, 'N', transform=ax.transAxes, ha='center', color='#294652')
    scale = 500 if len(selected) > 20 else 200
    ax.plot([x0 + 35, x0 + 35 + scale], [y0 + 30, y0 + 30], color='#294652')
    ax.text(x0 + 35 + scale / 2, y0 + 45, f'{scale} m', ha='center', fontsize=8, color='#294652')
    fig.text(.03, .065, 'B Buøy · H Hundvåg · E Engøy · S Sølyst · G Grasholmen · BJ Bjørnøy · R Roaldsøy · O Ormøy',
             fontsize=9, color='#465d65')
    fig.text(.03, .044, 'Brune linjer viser foreslåtte forbindelser langs kartlagte broer. L2-grupperingen er foreløpig.',
             fontsize=9, color='#465d65')
    fig.text(.03, .023, '© OpenStreetMap-bidragsytere (ODbL) · timer er grove estimater for arbeid i kartlagte bygninger.',
             fontsize=8, color='#465d65')
    fig.savefig(OUTPUT / filename, dpi=160)
    plt.close(fig)


hq_cells = {p['cellId'] for p in world['pois'] if p.get('hqCandidate')}
cells = [{**zone, 'hq': zone['id'] in hq_cells} for zone in cells]
draw_map('stavanger-z-41-soner-veigrenser.png', cells, 'Hundvåg og kjørbare byøyer · 41 soner',
         'L1 samlet · 11 Buøy + 18 Hundvåg + 12 øvrige øyer · L3-utkast 06.11.2026')
draw_map('hundvag-18-veigrenser.png', [z for z in cells if code(z).startswith('H')],
         'Hundvåg · dine 18 soner', 'Hundvåg ring er hovedskillet mellom de indre og ytre områdene.', True, (14, 12))
draw_map('byoyene-12-veigrenser.png', [z for z in cells if z['parentId'] in ('district-003', 'district-006')],
         'Byøyene · 12 soner', 'Engøy 2 · Sølyst 1 · Grasholmen 1 · Bjørnøy 2 · Roaldsøy 4 · Ormøy 2', True, (12, 15))
draw_map('buoy-11-veigrenser.png', [z for z in cells if z['parentId'] == 'district-001'],
         'Buøy · dine 11 soner', 'Samme nummerering som skissen. Veitilpassede grenser er til gjennomgang.', True, (12, 12))
print('Rendered overview and district close-ups')
