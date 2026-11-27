# Joins the sheets of a multi-sheet map that prints its coordinates on every sheet's frame into one image
# laid out in those coordinates (seconds east of Ferro / north), so tiles.py can place it with one
# 'grid' panel. Used for Golubyatnikov's geological map of Bibi-Heybat (Geological Committee, 1914; the
# field surveyed 1912; Library of Congress G7142.A6C5 s4 .G6): sheets A, B, C = parts I, II, III, north
# to south, each framed 67°28′10″–67°30′50″ east of Ferro, A 40°21′30″–20′20″, B 20′20″–19′10″,
# C 19′10″–18′10″ (C's map ends at 67°30′; the rest of that sheet is the legend).
#  - each sheet's frame corners were read off the scan (pixel ↔ labelled coordinate); a sheet is mapped
#    bilinearly between its four corners, which also takes out a scan's slight skew;
#  - the joined image keeps the sheets' own scale (1:4,200 at 300 dpi);
#  - what is not map (A's title over the sea, C's legend and index) is left out by 'exclude' in gcps.json.
# Writes data/raw/<key>.jpg (git-ignored) and the grid entry in data/gcps.json.
#   python scripts/sheets.py bibiheybat-1912        (numpy, scipy, Pillow)
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

HERE = Path(__file__).resolve().parents[1]
DATA, RAW = HERE / 'data', HERE / 'data' / 'raw'
Image.MAX_IMAGE_PIXELS = None
FERRO = 17 + 39 / 60 + 46 / 3600
S = lambda d, m, s=0: d * 3600 + m * 60 + s      # seconds

CFG = {
    'bibiheybat-1912': dict(
        lon=(S(67, 28, 10), S(67, 30, 50)), lat=(S(40, 18, 10), S(40, 21, 30)), kx=65.8, ky=86.0,
        # corners: (x, y) on the scan for (west, north), (east, north), (west, south), (east, south)
        sheets=[
            dict(file='bibiheybat-1912-a.tif', n=S(40, 21, 30), s=S(40, 20, 20), corners=[(829, 1195), (11370, 1194), (838, 7235), (11372, 7209)]),
            dict(file='bibiheybat-1912-b.tif', n=S(40, 20, 20), s=S(40, 19, 10), corners=[(862, 1149), (11387, 1152), (855, 7196), (11376, 7196)]),
            dict(file='bibiheybat-1912-c.tif', n=S(40, 19, 10), s=S(40, 18, 10), corners=[(863, 701), (11391, 700), (861, 5846), (11389, 5845)]),
        ],
    ),
}

key = sys.argv[1] if len(sys.argv) > 1 else 'bibiheybat-1912'
c = CFG[key]
(W0, E0), (S0, N0) = c['lon'], c['lat']
w, h = round((E0 - W0) * c['kx']), round((N0 - S0) * c['ky'])
out = np.full((h, w, 3), 255, np.uint8)
for sh in c['sheets']:
    im = np.asarray(Image.open(RAW / sh['file']).convert('RGB'))
    y0, y1 = round((N0 - sh['n']) * c['ky']), round((N0 - sh['s']) * c['ky'])
    ys, xs = np.mgrid[y0:y1, 0:w].astype(np.float32)
    u = xs / (w - 1); v = (ys - y0) / max(y1 - y0 - 1, 1)       # 0..1 across the sheet's frame
    (ax, ay), (bx, by), (cx, cy), (dx, dy) = sh['corners']
    sx = (1 - u) * (1 - v) * ax + u * (1 - v) * bx + (1 - u) * v * cx + u * v * dx
    sy = (1 - u) * (1 - v) * ay + u * (1 - v) * by + (1 - u) * v * cy + u * v * dy
    for ch in range(3):
        out[y0:y1, :, ch] = np.clip(map_coordinates(im[..., ch], [sy, sx], order=1, mode='nearest'), 0, 255)
    print(sh['file'], 'rows', y0, y1)
Image.fromarray(out).save(RAW / f'{key}.jpg', quality=94)
# the grid entry: pixel = c0 + c1 · (minutes east of Ferro past 67°) + c2 · (minutes north past 40°)
kx, ky = c['kx'] * 60, c['ky'] * 60
coef = [[-(W0 / 60 - 67 * 60) * kx, (N0 / 60 - 40 * 60) * ky], [kx, 0], [0, -ky]]
G = json.load(open(DATA / 'gcps.json'))
G.setdefault(key, {}).update({'file': f'{key}.jpg', 'grid': {'lonDeg': 67, 'latDeg': 40, 'ferro': FERRO, 'trimPx': 0,
                              'panels': [{'px': [0, 0, w, h], 'coef': coef, 'section': 'sheets A–C joined'}]}})
json.dump(G, open(DATA / 'gcps.json', 'w'), ensure_ascii=False, indent=1)
print(key, f'{w}×{h}')
