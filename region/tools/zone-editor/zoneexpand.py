"""Build new areas clipped to municipality or district boundaries and merge them into the project.

  python zoneexpand.py <track>     tracks: A (Stavanger, Randaberg, Sola, Sandnes), B (Rennesøy, Finnøy)

Areas in one track are built in order, so each sees the cells of the one before. The tracks share no land.
Each finished area is merged into project.json as add_area_job in server.py does, under a lock file.
"""
import os
import sys
import time
import traceback

import zonelib as z
import shapely
from shapely.geometry import box, mapping

from zoneadmin import admin_shapes

TRACKS = {
    'A': [
        ('stavangerrest', 'Resten av Stavanger', ['tasta', 'hillevag', 'hundvag', 'madla', 'storhaug', 'eiganes', 'hinna'], None),
        ('randaberg', 'Randaberg', ['randaberg'], (5.55, 58.97, 5.683, 59.06)),
        ('sola', 'Sola og Tananger', ['sola'], (5.53, 58.83, 5.705, 58.982)),
        ('sandnes', 'Sandnes', ['sandnes'], (5.64, 58.76, 5.92, 58.95)),
    ],
    'B': [
        ('rennesoy', 'Rennesøy', ['rennesoy'], None),
        ('finnoy', 'Finnøy og Talgje', ['finnoy'], (5.75, 59.07, 6.03, 59.22)),
    ],
}
CLIP_GAP = .3  # m; areas in different tracks never touch exactly, so their zones cannot overlap after rounding
LOCK = z.PROJECT / '.expand.lock'


def log_to(path):
    def log(message):
        line = f"{time.strftime('%H:%M:%S')} {message}"
        print(line, flush=True)
        with open(path, 'a', encoding='utf-8') as handle:
            handle.write(line + '\n')
    return log


class ProjectLock:
    def __enter__(self):
        for _ in range(600):
            try:
                self.fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                return self
            except FileExistsError:
                time.sleep(1)
        raise RuntimeError('Prosjektet er låst for lenge')

    def __exit__(self, *exc):
        os.close(self.fd)
        LOCK.unlink()


def clip_for(keys, limit):
    shapes = admin_shapes()
    geometry = shapely.union_all([shapes[k] for k in keys])
    if limit:
        geometry = geometry.intersection(box(*limit))
    metric = z.to_utm(geometry).simplify(2).buffer(-CLIP_GAP)
    return z.to_wgs(metric)


def merge(snapshot, area, features):
    """Same merge as add_area_job: the owner may have edited the project while the area was built."""
    with ProjectLock():
        fresh = z.load_project()
        if any(a['id'] == area['id'] for a in fresh['areas']):
            raise RuntimeError(f"Området {area['id']} finnes allerede i prosjektet")
        known = {x['id'] for x in fresh['zones']}
        renamed = {}
        for zone in snapshot['zones']:
            if not zone.get('_new'):
                continue  # zones that existed before the build stay as the owner has them now
            if zone['id'] in known:
                new_id = z.new_zone_id(fresh, zone['level'])
                renamed[zone['id']] = new_id
                zone = {**zone, 'id': new_id}
            fresh['zones'].append(zone)
            known.add(zone['id'])
        for zone in fresh['zones']:
            zone.pop('_new', None)
            if zone.get('parentId') in renamed:
                zone['parentId'] = renamed[zone['parentId']]
        keys = {f['properties']['k'] for f in features}
        for key in keys:
            if key in snapshot['assignments']:
                value = snapshot['assignments'][key]
                fresh['assignments'][key] = renamed.get(value, value)
        fresh['areas'].append(area)
        z.save_project(fresh)


def build(track):
    log = log_to(z.PROJECT / f'expand-{track}.log')
    for area_id, name, keys, limit in TRACKS[track]:
        try:
            snapshot = z.load_project()
            if any(a['id'] == area_id for a in snapshot['areas']):
                log(f'{name}: finnes allerede, hopper over')
                continue
            clip = clip_for(keys, limit)
            area = {'id': area_id, 'name': name, 'bbox': [round(v, 5) for v in clip.bounds], 'clip': mapping(clip),
                    'status': 'building'}
            log(f'{name}: bygger {area["bbox"]}')
            started = time.time()
            snapshot['areas'].append(area)
            features, edges = z.build_area(snapshot, area, log)
            before = {x['id'] for x in snapshot['zones']}
            l1 = {'id': z.new_zone_id(snapshot, 1), 'name': name, 'level': 1, 'locked': False}
            snapshot['zones'].append(l1)
            z.propose_area(snapshot, area, features, edges, l1['id'])
            for zone in snapshot['zones']:
                if zone['id'] not in before:
                    zone['_new'] = True
            snapshot['areas'].remove(area)
            merge(snapshot, area, features)
            log(f'{name}: ferdig etter {(time.time() - started) / 60:.0f} min')
        except Exception as exc:  # One failed area must not stop the rest of the track.
            log(f'{name}: FEILET {exc}')
            traceback.print_exc()


if __name__ == '__main__':
    build(sys.argv[1])
