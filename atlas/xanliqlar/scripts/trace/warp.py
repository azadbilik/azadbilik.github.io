# Warps Tomkeev's 1901 scan onto the web map: for every pixel of a Web Mercator raster over the
# khanates, finds its place on the scan (the inverse of cut.py's fit, from the same towns in
# data/raw/gcps.json) and samples it there. Writes data/tomkeev-1901.webp (transparent outside the
# scan) and data/tomkeev-1901.json (its four corners, for a MapLibre image source).
#   python scripts/trace/warp.py      (needs data/raw/tomkeev-1901.jpg: scripts/trace/fetch.sh)
import json, math
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

HERE = Path(__file__).resolve().parents[2]
RAW = HERE / 'data' / 'raw'
Image.MAX_IMAGE_PIXELS = None
W, E, S, N = 43.3, 50.6, 37.6, 42.4     # the khanates and a margin
WIDTH = 2600                             # output pixels across

g = json.load(open(RAW / 'gcps.json'))
A = np.array([v for k, v in g.items() if not k.startswith('_')], float)
px, py, lat, lon = A.T
def design(x, y):
    x = np.asarray(x, float) - 47; y = np.asarray(y, float) - 40
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)
CX = np.linalg.lstsq(design(lon, lat), px, rcond=None)[0]
CY = np.linalg.lstsq(design(lon, lat), py, rcond=None)[0]

merc = lambda la: math.log(math.tan(math.pi / 4 + math.radians(la) / 2))
y0, y1 = merc(N), merc(S)
HEIGHT = round(WIDTH * (y0 - y1) / math.radians(E - W))
xs = np.linspace(W, E, WIDTH)
ms = np.linspace(y0, y1, HEIGHT)
lats = np.degrees(2 * np.arctan(np.exp(ms)) - math.pi / 2)
LON, LAT = np.meshgrid(xs, lats)
d = design(LON.ravel(), LAT.ravel())
sx = (d @ CX).reshape(LON.shape); sy = (d @ CY).reshape(LON.shape)

scan = np.asarray(Image.open(RAW / 'tomkeev-1901.jpg').convert('RGB')).astype(np.float32)
h, w = scan.shape[:2]
out = np.zeros((HEIGHT, WIDTH, 4), np.uint8)
for c in range(3):
    out[..., c] = np.clip(map_coordinates(scan[..., c], [sy, sx], order=1, mode='nearest'), 0, 255)
inside = (sx >= 0) & (sx < w - 1) & (sy >= 0) & (sy < h - 1) & (sx < 4380)   # the scan's right edge is a black band
out[..., 3] = np.where(inside, 255, 0)
Image.fromarray(out, 'RGBA').save(HERE / 'data' / 'tomkeev-1901.webp', quality=72, method=6)
json.dump({'source': "V. I. Tomkeev, «Карта Кавказского края с обозначением границ 1801–1813 г.», Tiflis 1901 (public domain), warped by Azad Bilik",
           'coordinates': [[W, N], [E, N], [E, S], [W, S]]}, open(HERE / 'data' / 'tomkeev-1901.json', 'w'), indent=1)
print(f'{WIDTH}×{HEIGHT}', (HERE / 'data' / 'tomkeev-1901.webp').stat().st_size // 1024, 'KB')
