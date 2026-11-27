# «Persia sive Sophorum Regnum», a Dutch map of the Safavid realm (Amsterdam, about 1640, Blaeu school;
# Library of Congress, World Digital Library 17568), warped onto the web map the way build.py warps
# Delisle's 1724 map: 20 towns read on the scan (data/raw/blaeu-gcps.json, pixel x, y, lat, lon), a
# smoothed thin-plate spline, the same lon/lat box as Delisle so the story can fade between them.
# The figures, the title and the empty cartouche are left out (they would be smeared across the map).
#   python scripts/blaeu.py      (numpy, scipy, Pillow); needs data/raw/blaeu-persia.jpg (git-ignored)
import json, math
from pathlib import Path
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates
from PIL import Image

HERE = Path(__file__).resolve().parents[1]
RAW = HERE / 'data' / 'raw'
g = json.load(open(RAW / 'blaeu-gcps.json'))
A = np.array(list(g.values()), float)
px, ll = A[:, :2], A[:, [3, 2]]
import os
SM_FWD = 400000                                  # for the left-out check, as stiff as the warp
SM_INV = float(os.environ.get('SM_INV', 1000))   # heavy: the towns disagree by hundreds of km, a near-exact
                                               # spline folds and swirls the sheet between them
inv = RBFInterpolator(ll, px, kernel='thin_plate_spline', smoothing=SM_INV)
err = {}
for i, k in enumerate(g):
    m = np.arange(len(A)) != i
    p = RBFInterpolator(px[m], ll[m], kernel='thin_plate_spline', smoothing=SM_FWD)(px[i:i + 1])[0]
    err[k] = math.hypot((p[0] - ll[i, 0]) * 111 * math.cos(math.radians(ll[i, 1])), (p[1] - ll[i, 1]) * 111)
print(f'placing the Blaeu map: {len(A)} towns, {np.sqrt(np.mean(np.square(list(err.values())))):.0f} km off when each is left out')
print('  worst:', ', '.join(f'{k} {v:.0f}' for k, v in sorted(err.items(), key=lambda t: -t[1])[:5]))

W, E, S, N = 37.0, 76.0, 22.0, 46.0          # Delisle's box (build.py)
WIDTH = 3000
merc = lambda la: math.log(math.tan(math.pi / 4 + math.radians(la) / 2))
HEIGHT = round(WIDTH * (merc(N) - merc(S)) / math.radians(E - W))
lons = np.linspace(W, E, WIDTH)
lats = np.degrees(2 * np.arctan(np.exp(np.linspace(merc(N), merc(S), HEIGHT))) - math.pi / 2)
LON, LAT = np.meshgrid(lons, lats)
P = inv(np.stack([LON.ravel(), LAT.ravel()], 1))
sx, sy = P[:, 0].reshape(LON.shape), P[:, 1].reshape(LON.shape)
Image.MAX_IMAGE_PIXELS = None
scan = np.asarray(Image.open(RAW / 'blaeu-persia.jpg').convert('RGB')).astype(np.float32)
h, w = scan.shape[:2]
FRAME = (290, 280, 8170, 6340)               # inside the neat line
DECOR = [(330, 3480, 2210, 6340), (6940, 4300, 8170, 6340)]   # figures + title (left), empty cartouche (right)
keep = (sx >= FRAME[0]) & (sx < FRAME[2]) & (sy >= FRAME[1]) & (sy < FRAME[3])
for x0, y0, x1, y1 in DECOR: keep &= ~((sx >= x0) & (sx < x1) & (sy >= y0) & (sy < y1))
out = np.zeros((HEIGHT, WIDTH, 4), np.uint8)
for c in range(3):
    out[..., c] = np.clip(map_coordinates(scan[..., c], [sy, sx], order=1, mode='nearest'), 0, 255)
out[..., 3] = np.where(keep, 255, 0)
Image.fromarray(out, 'RGBA').save(HERE / 'data' / 'blaeu-1640.webp', quality=70, method=6)
json.dump({'source': '«Persia sive Sophorum Regnum», Amsterdam c. 1640 (Blaeu school; Library of Congress, World Digital Library 17568; public domain), warped by Azad Bilik',
           'coordinates': [[W, N], [E, N], [E, S], [W, S]], 'looKm': {k: round(v) for k, v in err.items()}}, open(HERE / 'data' / 'blaeu-1640.json', 'w'), ensure_ascii=False, indent=1)
print('scan', f'{WIDTH}×{HEIGHT}', (HERE / 'data' / 'blaeu-1640.webp').stat().st_size // 1024, 'KB')
