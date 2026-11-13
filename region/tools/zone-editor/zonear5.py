"""Land cover from NIBIO's AR5 (arealressurskart), read from its public WMS as a coloured raster.

Each cell gets m² of: fully cultivated land, surface-cultivated land, infield pasture, forest, bog, open rock
and built-up land. AR5 maps all land in Norway, so it also covers the farmland OpenStreetMap leaves out.
Tiles are cached in .tools/imports/ar5/.
"""
import time
import urllib.request
from io import BytesIO

import zonelib as z  # first: it puts the vendored packages on the path
import numpy as np
import shapely
from PIL import Image, ImageDraw

WMS = 'https://wms.nibio.no/cgi-bin/ar5'
CACHE = z.IMPORTS.parent / 'ar5'
RES = 2.0      # m per pixel
TILE = 1000    # pixels per side
FIELDS = ['arFull', 'arSurface', 'arPasture', 'arForest', 'arBog', 'arRock', 'arBuilt']
# Legend colours of the Arealtype layer. Index = position in FIELDS; 7 = water/road/other.
PALETTE = np.array([
    (255, 209, 110),  # fulldyrka jord
    (255, 255, 76),   # overflatedyrka jord
    (255, 255, 173),  # innmarksbeite
    (158, 204, 115),  # skog
    (181, 236, 252),  # myr (hatching on white)
    (217, 217, 217),  # åpen fastmark
    (252, 219, 214),  # bebygd
    (179, 120, 76),   # samferdsel
    (145, 231, 255),  # ferskvann
    (204, 254, 254),  # hav
    (230, 255, 255),  # bre
    (255, 255, 255),  # blank: background of the bog hatching, or unmapped
], dtype=np.int32)
CLASS_OF = np.array([0, 1, 2, 3, 4, 5, 6, 7, 7, 7, 7, 8])  # 8 = blank
BLANK = 8


def tile_image(tx, ty, log=print):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f'{tx}_{ty}.png'
    if not path.exists():
        x0, y0 = tx * TILE * RES, ty * TILE * RES
        url = (f'{WMS}?service=WMS&version=1.1.1&request=GetMap&layers=Arealtype&styles=&srs=EPSG:25832'
               f'&bbox={x0},{y0},{x0 + TILE * RES},{y0 + TILE * RES}&width={TILE}&height={TILE}&format=image/png')
        for attempt in range(4):
            try:
                request = urllib.request.Request(url, headers={'User-Agent': z.USER_AGENT})
                with urllib.request.urlopen(request, timeout=120) as response:
                    data = response.read()
                Image.open(BytesIO(data)).verify()
                path.write_bytes(data)
                break
            except Exception as exc:  # The service is public and sometimes slow; retry, then give up on this tile.
                log(f'AR5-rute {tx},{ty}: {exc}')
                time.sleep(5 * (attempt + 1))
        else:
            return None
    return classify(np.asarray(Image.open(path).convert('RGB'), dtype=np.int32))


def classify(rgb):
    distance = ((rgb[:, :, None, :] - PALETTE[None, None, :, :]) ** 2).sum(axis=3)
    classes = CLASS_OF[distance.argmin(axis=2)]
    # Bog is drawn as thin blue lines on white: blank pixels near those lines are bog too.
    bog = classes == 4
    near = bog.copy()
    for shift in (1, 2, 3):
        near[shift:, :] |= bog[:-shift, :]
        near[:-shift, :] |= bog[shift:, :]
        near[:, shift:] |= bog[:, :-shift]
        near[:, :-shift] |= bog[:, shift:]
    classes[(classes == BLANK) & near] = 4
    return classes[::-1, :]  # row 0 = south, like the metric y axis


def cell_areas(geometries, log=print):
    """m² per AR5 class (FIELDS order) for each metric cell geometry."""
    result = np.zeros((len(geometries), len(FIELDS)), dtype=np.float64)
    tiles = {}
    for index, geometry in enumerate(geometries):
        if geometry is None or geometry.is_empty:
            continue
        x0, y0, x1, y1 = geometry.bounds
        size = TILE * RES
        for tx in range(int(x0 // size), int(x1 // size) + 1):
            for ty in range(int(y0 // size), int(y1 // size) + 1):
                tiles.setdefault((tx, ty), []).append(index)
    log(f'AR5: {len(tiles)} kartruter')
    for number, ((tx, ty), members) in enumerate(sorted(tiles.items()), 1):
        if number % 25 == 0:
            log(f'AR5: {number}/{len(tiles)} kartruter')
        classes = tile_image(tx, ty, log)
        if classes is None:
            continue
        labels = Image.new('I', (TILE, TILE), 0)
        draw = ImageDraw.Draw(labels)
        ox, oy = tx * TILE * RES, ty * TILE * RES
        # Larger cells first, so a cell lying inside a hole of another is drawn on top of it.
        for index in sorted(members, key=lambda i: -geometries[i].area):
            for polygon in z.polygons_of(geometries[index]):
                points = [((x - ox) / RES, (y - oy) / RES) for x, y in polygon.exterior.coords]
                if len(points) >= 3:
                    draw.polygon(points, fill=index + 1)
        label = np.asarray(labels, dtype=np.int64)  # row 0 = y of tile origin (south), matching classify()
        mask = label > 0
        counts = np.bincount(label[mask] * 9 + classes[mask], minlength=(len(geometries) + 1) * 9)
        counts = counts.reshape(-1, 9)[1:, :len(FIELDS)] * RES * RES
        result += counts
    return result
