"""Trekker ut kandidater til atlaset for ett område fra POI-dumpen (tools/fetch_atlas.sh).

Bruk:
  python tools/build_atlas.py <område> [<område> ...]   ett eller flere områder fra "areas" i atlasoppsettet
  python tools/build_atlas.py --all                      alle områdene
  python tools/build_atlas.py --list                     vis områdene og hvordan de er avgrenset
Valg: --dump data/osm-atlas.json  --config src/regions/stavanger/atlas/atlas.config.json  --out data/atlas-candidates

Områdene står i atlasoppsettet under "areas". Hvert område avgrenses med én eller flere av
  polys  : liste av ringer [[bredde, lengde], ...] (union)
  bbox   : [sør, vest, nord, øst]
  admin  : navnet på en administrativ grense i dumpen (bydel eller kommune)
  minus  : id-er til andre områder som trekkes fra (f.eks. sentrum fra Storhaug)
Flere avgrensninger snittes. Resultatet skrives til <out>/<område>.json og er råstoff for kurering,
ikke spilldata: les det, velg 6–8 sektorer etter docs/stedsnavn.md og skriv
src/regions/<region>/atlas/<område>.json for hånd.
Data © OpenStreetMap-bidragsytere, ODbL.
"""
import json, math, os, sys
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import polygonize, unary_union

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# --- kategorier etter regelheftet (docs/stedsnavn.md, kapittel 2) ----------------------------
# Rekkefølgen betyr noe: første treff vinner. Hver regel er (kategori, tagg, verdier eller None = alle).
SHOP = {
    'matbutikk': {'supermarket', 'convenience', 'grocery', 'greengrocer', 'butcher', 'bakery', 'seafood', 'deli', 'farm',
                  'frozen_food', 'health_food', 'general', 'kiosk', 'pastry', 'confectionery', 'farmers_market', 'cheese', 'beverages'},
    'byggvarehus': {'doityourself', 'trade', 'building_materials', 'paint', 'tiles', 'garden_centre', 'agrarian', 'industrial', 'machine_rental'},
    'jernvarehandel': {'hardware', 'tools', 'electrical'},
    'dyrebutikk': {'pet', 'pet_grooming'},
    'interiorbutikk': {'furniture', 'interior_decoration', 'houseware', 'household_linen', 'bed', 'kitchen', 'curtain', 'lighting',
                       'carpet', 'fabric', 'variety_store', 'second_hand', 'charity'},
    'klesbutikk': {'clothes', 'shoes', 'fashion', 'fashion_accessories', 'bag', 'boutique', 'tailor', 'wool', 'sewing', 'baby_goods'},
    'sportsbutikk': {'sports', 'outdoor', 'bicycle', 'ski', 'skate', 'scuba_diving'},
    'vapen_jakt': {'weapons', 'hunting', 'guns', 'fishing'},
    'bilforhandler': {'car', 'car_repair', 'car_parts', 'tyres', 'motorcycle', 'motorcycle_repair', 'truck', 'boat', 'motor', 'car_paint'},
    'apotek': {'chemist', 'medical_supply', 'medical'},
    'elektronikk': {'electronics', 'computer', 'mobile_phone', 'hifi', 'appliance'},
    'kjopesenter': {'mall', 'department_store'},
    'alkohol': {'alcohol', 'wine'},
}
AMENITY = {
    'bensinstasjon': {'fuel'},
    'apotek': {'pharmacy'},
    'dyreklinikk': {'veterinary'},
    'hq_kandidat': {'hospital', 'fire_station', 'police', 'prison', 'jrcc', 'lifeboat_station', 'coastal_radio_station'},
    'helse': {'doctors', 'clinic', 'dentist', 'nursing_home', 'social_facility', 'aged_care_centre'},
    'skole': {'school', 'college', 'university', 'kindergarten', 'childcare', 'music_school'},
    'offentlig': {'library', 'place_of_worship', 'townhall', 'community_centre', 'courthouse', 'public_building', 'post_office',
                  'theatre', 'cinema', 'concert_hall', 'arts_centre', 'conference_centre', 'events_venue', 'crematorium', 'grave_yard',
                  'bus_station'},
    'kai': {'ferry_terminal', 'dive_centre', 'lifeboat'},
    'servering': {'restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'nightclub', 'ice_cream', 'food_court'},
}
LEISURE = {
    'kai': {'marina', 'slipway'},
    'idrett': {'sports_centre', 'stadium', 'sports_hall', 'pitch', 'track', 'swimming_pool', 'ice_rink', 'fitness_centre', 'golf_course'},
    'natur': {'park', 'nature_reserve', 'beach_resort', 'garden', 'common'},
}
LANDUSE = {'industrial': 'industri', 'port': 'kai', 'farmland': 'jorder', 'forest': 'skog', 'retail': 'handelsomrade', 'military': 'hq_kandidat'}
# Støy som ikke hjelper kureringen
SKIP_AMENITY = {'parking', 'parking_entrance', 'parking_space', 'bench', 'charging_station', 'recycling', 'toilets', 'atm', 'shelter',
                'bicycle_parking', 'bicycle_rental', 'motorcycle_parking', 'vending_machine', 'public_bookcase', 'fountain', 'clock',
                'waste_basket', 'taxi', 'bureau_de_change', 'money_transfer', 'hunting_stand', 'post_box', 'telephone'}
SKIP_SHOP = {'hairdresser', 'beauty', 'massage', 'tattoo', 'optician', 'jewelry', 'watches', 'estate_agent', 'travel_agency', 'dry_cleaning',
             'laundry', 'tanning_beds', 'spa', 'funeral_directors', 'gold_buyer', 'copyshop', 'frame', 'picture_framing', 'engraving',
             'storage_rental', 'no', 'vacant'}
# Steder som peker mot en HQ-kandidat selv om taggen ikke gjør det
HQ_HINTS = {('industrial', 'shipyard'), ('historic', 'fort'), ('military', 'bunker'), ('historic', 'castle'), ('building', 'hospital')}


def classify(t):
    """Returnerer kategorien (regelheftets type) for en OSM-tagg-ordbok, eller None."""
    if (('industrial', t.get('industrial')) in HQ_HINTS or ('historic', t.get('historic')) in HQ_HINTS
            or ('military', t.get('military')) in HQ_HINTS):
        return 'hq_kandidat'
    if 'shop' in t:
        if t['shop'] in SKIP_SHOP:
            return None
        return next((k for k, v in SHOP.items() if t['shop'] in v), 'annen_butikk')
    if 'amenity' in t:
        if t['amenity'] in SKIP_AMENITY:
            return None
        return next((k for k, v in AMENITY.items() if t['amenity'] in v), 'annet')
    if 'leisure' in t:
        return next((k for k, v in LEISURE.items() if t['leisure'] in v), None)
    if 'landuse' in t:
        return LANDUSE.get(t['landuse'])
    if t.get('natural') == 'wood':
        return 'skog'
    if 'historic' in t or 'military' in t:
        return 'historisk'
    if t.get('man_made') in ('pier',):
        return 'kai'
    if 'man_made' in t:
        return 'landemerke'
    if 'office' in t:
        return 'kontor'
    if 'craft' in t:
        return 'verksted'
    if 'highway' in t or 'railway' in t:
        if t.get('bridge') and t.get('bridge') != 'no':
            return 'bru'
        if t.get('tunnel') and t.get('tunnel') != 'no':
            return 'tunnel'
        return 'hovedvei' if 'highway' in t else None
    if 'place' in t:
        return 'stedsnavn'
    return None


def coords(e):
    if 'lat' in e:
        return e['lat'], e['lon']
    c = e.get('center')
    return (c['lat'], c['lon']) if c else (None, None)


def admin_polygons(elements):
    """Administrative grenser (out geom) som shapely-polygoner, etter navn."""
    out = {}
    for e in elements:
        t = e.get('tags', {})
        if e['type'] != 'relation' or t.get('boundary') != 'administrative':
            continue
        lines = [LineString([(g['lon'], g['lat']) for g in m['geometry']]) for m in e.get('members', [])
                 if m.get('type') == 'way' and m.get('role') in ('outer', '') and len(m.get('geometry') or []) > 1]
        polys = list(polygonize(unary_union(lines)))
        if polys:
            out[t.get('name')] = unary_union(polys)
    return out


def area_shape(aid, areas, admins, seen=()):
    a = areas[aid]
    parts = []
    if 'polys' in a:
        parts.append(unary_union([Polygon([(lon, lat) for lat, lon in ring]) for ring in a['polys']]))
    if 'bbox' in a:
        s, w, n, e = a['bbox']
        parts.append(box(w, s, e, n))
    if 'admin' in a:
        if a['admin'] not in admins:
            sys.exit(f'{aid}: fant ingen administrativ grense «{a["admin"]}» i dumpen. Kjente: {sorted(k for k in admins if k)}')
        parts.append(admins[a['admin']])
    if not parts:
        sys.exit(f'{aid}: området mangler polys, bbox eller admin')
    g = parts[0]
    for p in parts[1:]:
        g = g.intersection(p)
    for other in a.get('minus', []):
        if other not in seen:
            g = g.difference(area_shape(other, areas, admins, seen + (aid,)))
    return g


def dist_m(a, b):
    kx = math.cos(math.radians(a[0])) * 111320
    return math.hypot((a[0] - b[0]) * 110540, (a[1] - b[1]) * kx)


def candidates(aid, areas, elements, admins):
    shape = area_shape(aid, areas, admins)
    groups = {}
    for e in elements:
        t = e.get('tags', {})
        if t.get('boundary') == 'administrative':
            continue
        lat, lon = coords(e)
        if lat is None or not shape.covers(Point(lon, lat)):
            continue
        cat = classify(t)
        if cat is None:
            continue
        name = t.get('name', '')
        if cat in ('hovedvei', 'kontor', 'stedsnavn', 'servering', 'annet') and not name:
            continue
        kind = next((f'{k}={t[k]}' for k in ('shop', 'amenity', 'leisure', 'landuse', 'natural', 'office', 'craft', 'historic',
                                             'military', 'man_made', 'place', 'highway', 'railway') if k in t), '')
        row = {'name': name, 'type': kind, 'lat': round(lat, 5), 'lon': round(lon, 5), 'osm': f'{e["type"]}/{e["id"]}'}
        for k in ('brand', 'operator', 'ref', 'industrial', 'bridge', 'tunnel'):
            if k in t:
                row[k] = t[k]
        lst = groups.setdefault(cat, [])
        # Slå sammen like navn innenfor 250 m (oppdelte veier, bruer i flere biter)
        if name and any(r['name'] == name and r['type'] == kind and dist_m((r['lat'], r['lon']), (lat, lon)) < 250 for r in lst):
            continue
        lst.append(row)
    for lst in groups.values():
        lst.sort(key=lambda r: (r['name'] == '', r['name'], -r['lat']))
    a = areas[aid]
    minx, miny, maxx, maxy = shape.bounds
    return {
        '_doc': 'Kandidater fra tools/build_atlas.py. Råstoff for kurering, ikke spilldata. Data © OpenStreetMap-bidragsytere, ODbL.',
        'id': aid, 'name': a.get('name', aid), 'ring': a.get('ring'), 'phase': a.get('phase'),
        'bbox': [round(miny, 4), round(minx, 4), round(maxy, 4), round(maxx, 4)],
        'counts': {k: len(v) for k, v in sorted(groups.items())},
        'groups': dict(sorted(groups.items())),
    }


def main(argv):
    opts = {'--dump': 'data/osm-atlas.json', '--config': 'src/regions/stavanger/atlas/atlas.config.json', '--out': 'data/atlas-candidates'}
    rest = []
    it = iter(argv)
    for a in it:
        if a in opts:
            opts[a] = next(it)
        else:
            rest.append(a)
    cfg = json.load(open(os.path.join(ROOT, opts['--config'])))
    areas = {k: v for k, v in cfg['areas'].items() if not k.startswith('_')}
    if not rest or rest == ['--list']:
        for k, v in areas.items():
            how = ', '.join(x for x in ('polys', 'bbox', 'admin', 'minus') if x in v)
            print(f'{k:20} ring {v.get("ring")}  fase {v.get("phase")}  {v.get("name")}  ({how})')
        return
    ids = list(areas) if rest == ['--all'] else rest
    for aid in ids:
        if aid not in areas:
            sys.exit(f'Ukjent område «{aid}». Kjør med --list.')
    elements = json.load(open(os.path.join(ROOT, opts['--dump'])))['elements']
    admins = admin_polygons(elements)
    os.makedirs(os.path.join(ROOT, opts['--out']), exist_ok=True)
    for aid in ids:
        res = candidates(aid, areas, elements, admins)
        path = os.path.join(opts['--out'], f'{aid}.json')
        with open(os.path.join(ROOT, path), 'w') as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
        print(f'{path}: ' + ', '.join(f'{k} {n}' for k, n in res['counts'].items()))


if __name__ == '__main__':
    main(sys.argv[1:])
