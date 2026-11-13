"""Local server for the zone editor. Listens on 127.0.0.1 only and stores everything in world-zones/."""
import gzip
import hashlib
import json
import mimetypes
import shutil
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import zonelib as z
import zonecontent

WEB = Path(__file__).parent / 'web'
PORT = 5178
HISTORY_INTERVAL = 300  # seconds
HISTORY_KEEP = 60
AREA_FILES = {'cells': 'cells.geojson', 'edges': 'edges.geojson', 'buildings': 'buildings.geojson', 'roads': 'roads.geojson'}
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('text/javascript', '.js')

lock = threading.RLock()
indexes = {}
job = {'running': False, 'log': [], 'error': None, 'area': None}
last_history = 0


def revision():
    path = z.project_path()
    return hashlib.sha1(path.read_bytes()).hexdigest()[:12] if path.exists() else ''


def index_for(area_id):
    if area_id not in indexes:
        indexes[area_id] = z.AreaIndex(area_id)
    return indexes[area_id]


def ready_indexes(project):
    return [index_for(a['id']) for a in project['areas'] if a.get('status') == 'ready']


def backup(force=False):
    global last_history
    if not force and time.time() - last_history < HISTORY_INTERVAL or not z.project_path().exists():
        return
    last_history = time.time()
    folder = z.PROJECT / 'history'
    folder.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(z.project_path(), folder / f"project-{time.strftime('%Y%m%d-%H%M%S')}.json")
    for old in sorted(folder.glob('project-*.json'))[:-HISTORY_KEEP]:
        old.unlink()


def public_project(project):
    """Areas keep their build recipe on disk; the editor only needs what it shows."""
    areas = [{k: v for k, v in area.items() if k != 'clip'} for area in project['areas']]
    return {**project, 'areas': areas}


def add_area_job(body):
    def log(message):
        job['log'].append(message)

    try:
        with lock:
            snapshot = z.load_project()
        ids = {a['id'] for a in snapshot['areas']}
        base = ''.join(c for c in body['name'].lower().replace('å', 'a').replace('ø', 'o').replace('æ', 'ae')
                       if c.isalnum()) or 'omrade'
        area_id, number = base, 2
        while area_id in ids:
            area_id, number = f'{base}{number}', number + 1
        area = {'id': area_id, 'name': body['name'], 'bbox': body['bbox'], 'status': 'building'}
        if body.get('onlyCenterLand'):
            w, s, e, n = body['bbox']
            area['seeds'] = [[(w + e) / 2, (s + n) / 2]]
        if body.get('barrierRoads'):
            area['barrierRoads'] = body['barrierRoads']
        job['area'] = area_id
        snapshot['areas'].append(area)
        features, edges = z.build_area(snapshot, area, log)
        parent = body.get('parentL1') or next(x['id'] for x in snapshot['zones'] if x['level'] == 1)
        log('Lager første forslag til soner')
        z.propose_area(snapshot, area, features, edges, parent, l3_count=body.get('l3Count'))
        with lock:
            fresh = z.load_project()
            known = {x['id'] for x in fresh['zones']}
            used = dict(fresh['assignments'])
            keys = {f['properties']['k'] for f in features}
            renamed = {}
            for zone in snapshot['zones']:
                if zone['id'] not in known:
                    fresh['zones'].append(zone)
                elif not any(x['id'] == zone['id'] and x['name'] == zone['name'] for x in fresh['zones']):
                    # The owner created a zone with this id while the build ran.
                    new_id = z.new_zone_id(fresh, zone['level'])
                    renamed[zone['id']] = new_id
                    fresh['zones'].append({**zone, 'id': new_id})
            for zone in fresh['zones']:
                if zone.get('parentId') in renamed and zone['id'] not in known:
                    zone['parentId'] = renamed[zone['parentId']]
            used.update({k: renamed.get(snapshot['assignments'][k], snapshot['assignments'][k])
                         for k in keys if k in snapshot['assignments']})
            fresh['assignments'] = used
            fresh['areas'].append(area)
            z.save_project(fresh)
        log('Ferdig')
    except Exception as exc:  # A failed build must reach the owner's screen, whatever went wrong.
        job['error'] = str(exc)
        traceback.print_exc()
    finally:
        job['running'] = False


def validate_export(path):
    command = ['node', '--import', 'tsx', str(Path(__file__).parent / 'validate-export.ts'), str(path)]
    try:
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', cwd=z.ROOT, timeout=600)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {'ran': False, 'message': str(exc)}
    try:
        return {'ran': True, **json.loads(result.stdout)}
    except json.JSONDecodeError:
        return {'ran': False, 'message': (result.stderr or result.stdout)[-1500:]}


class Server(ThreadingHTTPServer):
    # On Windows, address reuse lets two servers share a port and steal each other's requests.
    allow_reuse_address = False
    daemon_threads = True


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, format, *args):
        pass

    def send_bytes(self, data, content_type='application/json; charset=utf-8', status=200, cache=False):
        if 'gzip' in self.headers.get('Accept-Encoding', '') and len(data) > 2048:
            data = gzip.compress(data, 3)
            encoded = True
        else:
            encoded = False
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'max-age=86400' if cache else 'no-store')
        if encoded:
            self.send_header('Content-Encoding', 'gzip')
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, value, status=200):
        self.send_bytes(json.dumps(value, ensure_ascii=False).encode('utf-8'), status=status)

    def body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length) or b'{}')

    def do_GET(self):
        path = self.path.split('?')[0]
        try:
            if path == '/api/state':
                with lock:
                    self.send_json({'rev': revision(), 'project': public_project(z.load_project())})
            elif path == '/api/revision':
                self.send_json({'rev': revision()})
            elif path == '/api/job':
                self.send_json(job)
            elif path == '/api/catalog':
                self.send_bytes(zonecontent.CATALOG_PATH.read_bytes())
            elif path.startswith('/api/areas/') and path.endswith('/stats'):
                area_id = path.split('/')[3]
                if not area_id.replace('-', '').isalnum() or not (z.area_dir(area_id) / 'cells.geojson').exists():
                    return self.send_json({'error': 'Ukjent område'}, 404)
                with lock:
                    stats = zonecontent.ensure_stats(area_id)
                self.send_json({'fields': zonecontent.STAT_FIELDS, 'cells': {k: v for k, v in stats.items() if k != '_version'}})
            elif path.startswith('/api/areas/'):
                _, _, _, area_id, name = path.split('/')
                if name not in AREA_FILES or not area_id.replace('-', '').isalnum():
                    return self.send_json({'error': 'Ukjent fil'}, 404)
                file = z.area_dir(area_id) / AREA_FILES[name]
                if not file.exists():
                    return self.send_json({'error': 'Ukjent område'}, 404)
                self.send_bytes(file.read_bytes(), 'application/geo+json')
            else:
                self.serve_static(path)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            traceback.print_exc()
            self.send_json({'error': str(exc)}, 500)

    def serve_static(self, path):
        relative = 'index.html' if path == '/' else path.lstrip('/')
        file = (WEB / relative).resolve()
        if not file.is_relative_to(WEB.resolve()) or not file.is_file():
            return self.send_json({'error': 'Ikke funnet'}, 404)
        content_type = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        if content_type.startswith('text/'):
            content_type += '; charset=utf-8'
        self.send_bytes(file.read_bytes(), content_type, cache='vendor/' in relative)

    def do_POST(self):
        path = self.path.split('?')[0]
        try:
            body = self.body()
            handler = {
                '/api/project': self.save_project, '/api/route': self.route, '/api/cut': self.cut,
                '/api/cut/undo': self.cut_undo, '/api/areas': self.add_area, '/api/propose': self.propose,
                '/api/export': self.export, '/api/suggest': self.suggest, '/api/game-world': self.game_world,
            }.get(path)
            if handler is None:
                return self.send_json({'error': 'Ikke funnet'}, 404)
            handler(body)
        except ValueError as exc:
            self.send_json({'error': str(exc)}, 400)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:
            traceback.print_exc()
            self.send_json({'error': str(exc)}, 500)

    def save_project(self, body):
        with lock:
            if body.get('baseRev') != revision():
                return self.send_json({'error': 'conflict', 'rev': revision()}, 409)
            backup()
            project = z.load_project()
            project['zones'] = body['zones']
            project['assignments'] = body['assignments']
            if 'pois' in body:
                project['pois'] = body['pois']
            if 'settings' in body:
                project['settings'] = body['settings']
            z.save_project(project)
            self.send_json({'rev': revision()})

    def route(self, body):
        with lock:
            project = z.load_project()
            indexes_now = ready_indexes(project)
        line = z.route(indexes_now, body['points'])
        splits, pieces = z.preview_cut(indexes_now, line)
        # The exact metric line travels with the preview, so the cut splits precisely what was shown.
        self.send_json({'line': z.mapping(z.to_wgs(line)), 'exact': list(map(list, line.coords)),
                        'lengthM': round(line.length), 'splits': splits, 'pieces': pieces})

    def cut(self, body):
        line = z.LineString(body['exact'])
        with lock:
            project = z.load_project()
            results = []
            for index in ready_indexes(project):
                if any(z.split_one(index.geometry[int(i)], line) for i in index.tree.query(line, 'intersects')):
                    cut_id = f"cut-{time.strftime('%Y%m%d%H%M%S')}-{index.area_id}"
                    results.append(z.apply_cut(project, index, line, cut_id))
                    indexes.pop(index.area_id, None)
            if not results:
                raise ValueError('Linja deler ingen celle. Den må gå fra kant til kant.')
            z.save_project(project)
            self.send_json({'cuts': results, 'assignments': {
                f['properties']['k']: project['assignments'].get(f['properties']['k'])
                for result in results for f in result['added']}, 'rev': revision()})

    def cut_undo(self, body):
        with lock:
            project = z.load_project()
            results = []
            for cut in reversed(body['cuts']):
                results.append(z.undo_cut(project, cut['area'], cut['id']))
                indexes.pop(cut['area'], None)
            z.save_project(project)
            self.send_json({'cuts': results, 'assignments': {
                f['properties']['k']: project['assignments'].get(f['properties']['k'])
                for result in results for f in result['added']}, 'rev': revision()})

    def add_area(self, body):
        with lock:
            if job['running']:
                raise ValueError('Et område bygges allerede')
            job.update(running=True, log=[], error=None, area=None)
        threading.Thread(target=add_area_job, args=(body,), daemon=True).start()
        self.send_json({'started': True})

    def propose(self, body):
        with lock:
            project = z.load_project()
            parent = body['parent']
            children = [x for x in project['zones'] if x.get('parentId') == parent and x['level'] == 3]
            free = {x['id'] for x in children if not x.get('locked')}
            keys = {k for k, v in project['assignments'].items() if v in free}
            if not keys:
                raise ValueError('Ingen ulåste celler å foreslå soner for i dette området')
            area_ids = [a['id'] for a in project['areas'] if a.get('status') == 'ready']
            features, edges = [], []
            for area_id in area_ids:
                folder = z.area_dir(area_id)
                features += [f for f in z.read_json(folder / 'cells.geojson')['features'] if f['properties']['k'] in keys]
                edges += z.read_json(folder / 'edges.geojson')['features']
            project['zones'] = [x for x in project['zones'] if x['id'] not in free]
            for key in keys:
                project['assignments'].pop(key, None)
            created = z.propose_l3(project, features, edges, int(body['count']), parent, area_ids)
            z.save_project(project)
            self.send_json({'created': [x['id'] for x in created], 'rev': revision(),
                            'project': public_project(project)})

    def suggest(self, body):
        with lock:
            if body.get('baseRev') != revision():
                return self.send_json({'error': 'conflict', 'rev': revision()}, 409)
            backup(force=True)
            project = z.load_project()
            summary = zonecontent.suggest(project, overwrite=bool(body.get('overwrite')))
            z.save_project(project)
            self.send_json({'summary': summary, 'rev': revision(), 'project': public_project(project)})

    def game_world(self, body):
        import zonegame
        with lock:
            world = zonegame.build(log=lambda m: None)
        self.send_json({'path': str(zonegame.OUT), 'zones': len(world['zones']), 'starts': len(world['starts']),
                        'version': world['worldVersion']})

    def export(self, body):
        with lock:
            project = z.load_project()
        result = z.export_world(project)
        result['zones'] = {str(k): v for k, v in result['zones'].items()}
        world = z.read_json(result['path'])
        issues = z.check_world(world)
        result['check'] = {'valid': not issues, 'issueCount': len(issues), 'issues': issues[:40]}
        vertices = z.zone_vertices(world)
        result['validation'] = validate_export(result['path']) if vertices <= z.GAME_VALIDATOR_LIMIT else {
            'ran': False, 'skipped': True, 'vertices': vertices,
            'message': f'Spillets egen kontroll hoppes over for så store filer ({vertices:,} punkter). Den tar mange minutter.'.replace(',', ' ')}
        self.send_json(result)


def main():
    if not z.project_path().exists():
        sys.exit('Fant ikke world-zones/project.json. Kjør: python tools/zone-editor/zonetool.py init-hundvag')
    open_browser = '--no-browser' not in sys.argv
    port = PORT
    while True:
        try:
            server = Server(('127.0.0.1', port), Handler)
            break
        except OSError:
            port += 1
    url = f'http://127.0.0.1:{port}/'
    print(f'Soneeditor kjører på {url}  (Ctrl+C stopper)', flush=True)
    if open_browser:
        threading.Timer(.4, webbrowser.open, args=(url,)).start()
    server.serve_forever()


if __name__ == '__main__':
    main()
