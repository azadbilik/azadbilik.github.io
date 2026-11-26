# Follows the borders printed on Tomkeev's 1901 map between waypoints placed by hand.
# Each edge in data/raw/edges.json is a list of [x, y] pixels on the scan; between two waypoints the
# path takes the cheapest way along the map's brown border lines and their ochre wash (least-cost path),
# so the result follows the printed line, not the hand. Writes data/raw/lines-px.json.
#   python scripts/trace/trace.py        (needs data/raw/tomkeev-1901.jpg: scripts/trace/fetch.sh)
import json
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.graph import route_through_array

RAW = Path(__file__).resolve().parents[2] / 'data' / 'raw'
Image.MAX_IMAGE_PIXELS = None
im = np.asarray(Image.open(RAW / 'tomkeev-1901.jpg').convert('RGB')).astype(int)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
line = (R - B > 85) & (B < 75) & (R < 215) & (G < 185)   # the brown core of a border line
wash = (R - B > 70) & (B < 120) & (R < 235)              # the ochre wash beside it
cost = np.where(line, 1.0, np.where(wash, 4.0, 30.0))
ys, xs = np.nonzero(line)


def snap(x, y, r=12):
    """The nearest line pixel to a waypoint, within r pixels."""
    m = (abs(xs - x) <= r) & (abs(ys - y) <= r)
    if not m.any():
        return [x, y]
    i = np.argmin((xs[m] - x) ** 2 + (ys[m] - y) ** 2)
    return [int(xs[m][i]), int(ys[m][i])]


out = {}
for name, wps in json.load(open(RAW / 'edges.json')).items():
    wps = [snap(*w) for w in wps]
    path = []
    for (x0, y0), (x1, y1) in zip(wps, wps[1:]):
        pad = 40
        xa, ya = min(x0, x1) - pad, min(y0, y1) - pad
        xb, yb = max(x0, x1) + pad, max(y0, y1) + pad
        idx, _ = route_through_array(cost[ya:yb, xa:xb], (y0 - ya, x0 - xa), (y1 - ya, x1 - xa), fully_connected=True, geometric=True)
        seg = [[c + xa, r + ya] for r, c in idx]
        path += seg if not path else seg[1:]
    out[name] = path
json.dump(out, open(RAW / 'lines-px.json', 'w'))
print({k: len(v) for k, v in out.items()})
