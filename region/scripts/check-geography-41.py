"""Regression check: inspect every world boundary, including L1 / L2 and shore."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/python'))
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

world = json.loads((ROOT / 'dist/stavanger-z-world-41-road-draft.json').read_text(encoding='utf-8'))
context = json.loads((ROOT / 'dist/geografi-41-context-work.json').read_text(encoding='utf-8'))
buildings = [Polygon(f['coordinates']) for f in context['features'] if f['kind'] == 'building']
buildings = [b for b in buildings if b.is_valid and b.area > 1e-14]
tree = STRtree(buildings)
assert len([z for z in world['zones'] if z['level'] == 3]) == 41
for level in (1, 2, 3):
    boundary = unary_union([shape(z['geometry']).boundary for z in world['zones'] if z['level'] == level])
    # Ignore sub-millimetre overlay noise and contact along the building wall.
    crossings = [buildings[int(i)] for i in tree.query(boundary, predicate='intersects')
                 if boundary.intersection(buildings[int(i)].buffer(-1e-8)).length > 1e-8]
    assert not crossings, f'L{level}: {len(crossings)} mapped buildings are cut by a boundary'
    print(f'L{level}: no boundary cuts through mapped building interiors')
print(world['worldVersion'], '41 L3 zones;', len(buildings), 'mapped buildings checked')
