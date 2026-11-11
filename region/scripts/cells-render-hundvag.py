"""Render review maps for scripts/cells-build-hundvag.py output."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
import matplotlib

matplotlib.use('Agg')
import matplotlib.patheffects as effects
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection, PolyCollection
from shapely.geometry import shape

OUTPUT = ROOT / 'dist/hundvag-celler'
LAND, SEA, INK, MUTED, BUILDING = '#d6e0c8', '#d1e1e8', '#1f3440', '#4d626c', '#a8a595'
PALETTE = ['#7fb3a5', '#e0b080', '#a9a8d6', '#d99aa5', '#b5c97a', '#8fb6d9', '#d9c76a', '#c0a18c', '#9dcfc0']
data = json.loads((OUTPUT / 'render-input-work.json').read_text(encoding='utf-8'))


def outer_rings(geometry):
    polygons = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
    return [list(p.exterior.coords) for p in polygons]


def all_rings(geometry):
    polygons = [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)
    return [list(ring.coords) for p in polygons for ring in [p.exterior, *p.interiors]]


buildings = [list(shape(b).exterior.coords) for b in data['buildings']]
streets = [list(shape(s).coords) for s in data['streets']]
ring_lines = [list(shape(s).coords) for s in data['ring']]


def base(ax, extent):
    ax.set_facecolor(SEA)
    ax.add_collection(LineCollection(streets, colors='#9c9a8c', linewidths=.45, zorder=3))
    ax.add_collection(PolyCollection(buildings, facecolors=BUILDING, edgecolors='none', zorder=4))
    ax.set_xlim(extent[0], extent[2])
    ax.set_ylim(extent[1], extent[3])
    ax.set_aspect('equal')
    ax.set_xticks([])
    ax.set_yticks([])


def colours(names, zones):
    """Greedy map colouring so neighbouring zones differ."""
    assigned = {}
    for name in names:
        used = {assigned[o] for o in assigned if zones[o].distance(zones[name]) < 1}
        assigned[name] = next(c for c in PALETTE if c not in used)
    return assigned


def draw_zones(ax, zones, counts, title):
    names = sorted(zones)
    fill = colours(names, zones)
    for name in names:
        ax.add_collection(PolyCollection(outer_rings(zones[name]), facecolors=fill[name], edgecolors='none',
                                         alpha=.75, zorder=1))
    for name in names:
        for ring in all_rings(zones[name]):
            ax.plot(*zip(*ring), color=INK, linewidth=1.5, zorder=5)
        point = zones[name].representative_point()
        ax.text(point.x, point.y, f'{name}\n{counts[name]} bygg', ha='center', va='center', fontsize=9.5,
                fontweight='bold', color=INK, zorder=7,
                path_effects=[effects.withStroke(linewidth=2.5, foreground='white')])
    ax.set_title(title, loc='left', fontsize=13, color=INK, fontweight='bold')


current = {k: shape(v) for k, v in data['current'].items()}
proposal = {k: shape(v) for k, v in data['l3'].items()}
xs = [c[0] for g in current.values() for r in outer_rings(g) for c in r]
ys = [c[1] for g in current.values() for r in outer_rings(g) for c in r]
extent = (min(xs) - 80, min(ys) - 80, max(xs) + 80, max(ys) + 80)
metrics = data['metrics']

figure, axes = plt.subplots(1, 2, figsize=(22, 11.6), facecolor='#f8f7f3')
base(axes[0], extent)
draw_zones(axes[0], current, metrics['current']['buildingsPerZone'], 'I dag: dagens 18 soner')
base(axes[1], extent)
draw_zones(axes[1], proposal, metrics['proposal']['buildingsPerZone'], 'Forslag: 18 soner bygd av celler')
figure.tight_layout()
figure.savefig(OUTPUT / 'sammenligning.png', dpi=110)
plt.close(figure)

cells = [shape(c) for c in data['cells']]
figure, ax = plt.subplots(figsize=(15, 15), facecolor='#f8f7f3')
base(ax, extent)
fill = colours(sorted(proposal), proposal)
rings = [r for c, z in zip(cells, data['cellL3']) for r in outer_rings(c)]
faces = [fill[z] for c, z in zip(cells, data['cellL3']) for _ in outer_rings(c)]
ax.add_collection(PolyCollection(rings, facecolors=faces, edgecolors='white', linewidths=.35, alpha=.8, zorder=1))
for name in sorted(proposal):
    for ring in all_rings(proposal[name]):
        ax.plot(*zip(*ring), color=INK, linewidth=1.6, zorder=5)
ax.set_title(f'{len(cells)} celler gruppert i 18 L3-forslag', loc='left', fontsize=14, color=INK, fontweight='bold')
figure.tight_layout()
figure.savefig(OUTPUT / 'celler.png', dpi=120)
plt.close(figure)
print('rendered')
