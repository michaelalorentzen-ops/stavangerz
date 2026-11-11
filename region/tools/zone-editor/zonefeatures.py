"""Download the places and land use that zone content suggestions are based on (OpenStreetMap, ODbL)."""
import json
import time
import urllib.parse
import urllib.request

import zonelib as z

QUERY = '''[out:json][timeout:240];(
nwr["amenity"~"^(hospital|clinic|doctors|pharmacy|school|university|college|kindergarten|place_of_worship|fuel|police|fire_station|townhall|prison|ferry_terminal|waste_transfer_station|recycling|community_centre|marketplace)$"]({b});
nwr["shop"~"^(supermarket|convenience|mall|department_store|wholesale|hardware|doityourself|trade|electronics|mobile_phone|computer|weapons|hunting|outdoor|sports|car_repair|car_parts|chemist|medical_supply|farm|boat|fishing)$"]({b});
nwr["building"~"^(hospital|school|university|church|cathedral|chapel|greenhouse|farm|barn|warehouse|industrial|hangar|retail|supermarket|commercial|military)$"]({b});
nwr["landuse"~"^(military|industrial|port|retail|commercial|farmyard|greenhouse_horticulture|quarry|landfill)$"]({b});
nwr["military"]({b});
nwr["aeroway"~"^(aerodrome|hangar|helipad)$"]({b});
nwr["power"~"^(substation|plant|generator)$"]({b});
nwr["man_made"~"^(water_works|wastewater_plant|water_tower|reservoir_covered|mast|tower|communications_tower|works|pier|silo|storage_tank)$"]({b});
nwr["tower:type"="communication"]({b});
nwr["telecom"]({b});
nwr["leisure"~"^(marina|sports_centre|stadium)$"]({b});
nwr["sport"~"^(shooting|shooting_range)$"]({b});
nwr["harbour"]({b});
nwr["industrial"]({b});
nwr["craft"~"^(boatbuilder|metal_construction|welder|electrician|carpenter|blacksmith)$"]({b});
nwr["office"~"^(government|energy_supplier|telecommunication)$"]({b});
nwr["historic"~"^(fort|castle|manor)$"]({b});
);out center tags;'''


def fetch_features(area, log=print):
    cache = z.IMPORTS / area['id'] / 'features.json'
    if cache.exists():
        return z.read_json(cache)
    w, s, e, n = z.fetch_bbox(area)
    data = urllib.parse.urlencode({'data': QUERY.replace('{b}', f'{s},{w},{n},{e}')}).encode()
    error = None
    for endpoint in z.OVERPASS:
        for attempt in range(3):
            try:
                log(f'Henter steder og arealbruk fra OpenStreetMap (forsøk {attempt + 1})')
                request = urllib.request.Request(endpoint, data=data, headers={'User-Agent': z.USER_AGENT})
                with urllib.request.urlopen(request, timeout=300) as response:
                    result = json.loads(response.read())
                result['retrievedAt'] = time.strftime('%Y-%m-%d')
                z.write_json(cache, result)
                return result
            except Exception as exc:  # Public mirrors fail in several ways; every failure means try the next one.
                error = exc
                time.sleep(5 * (attempt + 1))
    raise RuntimeError(f'Fikk ikke hentet steder fra OpenStreetMap: {error}')


if __name__ == '__main__':
    project = z.load_project()
    for area in project['areas']:
        result = fetch_features(area)
        print(area['id'], len(result['elements']))
