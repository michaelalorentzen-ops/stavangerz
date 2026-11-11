"""Command line for the zone project. Run with no arguments for help.

  init-hundvag                 create the project with Hundvåg as first area
  add <id> <name> w s e n      add an area from a lon/lat rectangle
  build <id>                   rebuild an area from cached sources; zones follow the cells
  refetch <id>                 download fresh sources for an area, then rebuild it
  import-world <id> <file>     assign the area's cells to L3 zones from a WorldDefinition file
  import-pois <file>           copy places inside modelled areas from a WorldDefinition file
  suggest [--overwrite]        fill zone content and places from map data (zones set by hand are kept)
  regroup                      group L2 zones into L1 zones by Stavanger districts and municipalities
  export                       write a draft WorldDefinition to dist/
  status                       print areas and zone counts
"""
import shutil
import sys
from collections import Counter

import zonelib as z


def require_project():
    project = z.load_project()
    if project is None:
        sys.exit('Fant ikke prosjektet. Kjør init-hundvag først.')
    return project


def world_clip(zone_ids):
    world = z.read_json(z.ROOT / 'dist/geografi-41-work.json')
    geometry = z.unary_union([z.shape(zone['geometry']).buffer(0) for zone in world['zones'] if zone['id'] in zone_ids])
    return z.mapping(geometry)


def add_area(project, area_id, name, bbox, seeds=None, barrier=None, l3_count=None, parent='region-001', clip=None,
             propose=True):
    if any(a['id'] == area_id for a in project['areas']):
        sys.exit(f'Området {area_id} finnes allerede')
    area = {'id': area_id, 'name': name, 'bbox': bbox, 'status': 'building'}
    if seeds:
        area['seeds'] = seeds
    if barrier:
        area['barrierRoads'] = barrier
    if clip:
        area['clip'] = clip
    project['areas'].append(area)
    features, edges = z.build_area(project, area)
    if propose:
        z.propose_area(project, area, features, edges, parent, l3_count=l3_count)
    z.save_project(project)


def status(project):
    levels = Counter(zone['level'] for zone in project['zones'])
    print(f"Soner: L1 {levels[1]}, L2 {levels[2]}, L3 {levels[3]}. Tilordnede celler: {len(project['assignments'])}")
    for area in project['areas']:
        print(f"{area['id']}: {area['name']}, {area.get('status')}, {area.get('counts')}")


def main(args):
    command = args[0] if args else None
    if command == 'init-hundvag':
        if z.load_project() is not None and '--replace' not in args:
            sys.exit('Prosjektet finnes allerede. Bruk build for å bygge et område på nytt.')
        z.install_seed_cache('hundvag', z.ROOT / '.tools/imports/matrikkel/hundvag-teig.json')
        project = z.new_project()
        hundvag = ['cell-026', 'cell-036', 'cell-037', 'cell-038', 'cell-019', 'cell-039', 'cell-018', 'cell-008',
                   'cell-009', 'cell-017', 'cell-025', 'cell-040', 'cell-041', 'cell-020', 'cell-042', 'cell-010',
                   'cell-043', 'cell-011']
        add_area(project, 'hundvag', 'Hundvåg', [5.705, 58.984, 5.76, 59.015], clip=world_clip(hundvag),
                 barrier=['Hundvåg ring'], l3_count=18)
        add_area(project, 'buoy', 'Buøy', [5.705, 58.975, 5.76, 58.995], clip=world_clip(['district-001']),
                 propose=False)
        print(z.import_world_zones(project, 'buoy', z.ROOT / 'dist/geografi-41-work.json'))
        print('steder:', z.import_world_pois(project, z.ROOT / 'dist/geografi-41-work.json'))
        z.save_project(project)
        status(project)
    elif command == 'add':
        project = require_project()
        add_area(project, args[1], args[2], [float(v) for v in args[3:7]])
        status(project)
    elif command in ('build', 'refetch'):
        project = require_project()
        area = next(a for a in project['areas'] if a['id'] == args[1])
        if command == 'refetch':
            shutil.rmtree(z.IMPORTS / area['id'], ignore_errors=True)
        z.build_area(project, area)
        z.save_project(project)
        status(project)
    elif command == 'import-world':
        project = require_project()
        print(z.import_world_zones(project, args[1], args[2]))
        z.save_project(project)
    elif command == 'import-pois':
        project = require_project()
        print('steder:', z.import_world_pois(project, args[1]))
        z.save_project(project)
    elif command == 'suggest':
        import zonecontent
        project = require_project()
        print(zonecontent.suggest(project, overwrite='--overwrite' in args))
        z.save_project(project)
    elif command == 'regroup':
        import zoneregroup
        project = require_project()
        zoneregroup.regroup(project)
        z.save_project(project)
    elif command == 'export':
        print(z.export_world(require_project()))
    elif command == 'status':
        status(require_project())
    else:
        print(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
