# Places each historical plan of Baku on today's map and warps it into a web-map image.
# data/gcps.json: for every plan, landmarks that still stand (their pixel on the scan and their
# lat, lon from OpenStreetMap). An affine fit (rotation, scale, shear: a surveyed city plan is true
# in itself) when there are few points, a thin-plate spline when there are many.
# Writes data/plan-<year>.webp and data/plans.json (corners, fit error, source).
#   python scripts/warp.py [year]      (numpy, scipy, Pillow; scans in data/raw/, see README)
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates

HERE = Path(__file__).resolve().parents[1]
DATA, RAW = HERE / 'data', HERE / 'data' / 'raw'
G = json.load(open(DATA / 'gcps.json'))
meta = json.load(open(DATA / 'plans.json')) if (DATA / 'plans.json').exists() else {}
merc = lambda la: math.log(math.tan(math.pi / 4 + math.radians(la) / 2))
Image.MAX_IMAGE_PIXELS = None

for year, plan in G.items():
    if len(sys.argv) > 1 and year not in sys.argv[1:]: continue
    pts = np.array([p[:4] for p in plan['points'].values()], float)   # x, y, lat, lon
    px, ll = pts[:, :2], pts[:, [3, 2]]
    if len(pts) >= 8:
        inv = RBFInterpolator(ll, px, kernel='thin_plate_spline', smoothing=1e-9)
        fwd = RBFInterpolator(px, ll, kernel='thin_plate_spline', smoothing=1.0)
        how = 'thin-plate spline'
    elif len(pts) == 2:
        # two landmarks: scale and rotation only (a similarity), solved in complex numbers
        z = lambda q: q[:, 0] - 1j * q[:, 1]
        w = lambda q: (q[:, 0] - ll[0, 0]) * math.cos(math.radians(ll[0, 1])) + 1j * (q[:, 1] - ll[0, 1])
        k = (w(ll)[1] - w(ll)[0]) / (z(px)[1] - z(px)[0])
        inv = lambda q: (lambda u: np.c_[u.real, -u.imag])((w(q) - w(ll)[0]) / k + z(px)[0])
        fwd = lambda q: (lambda v: np.c_[ll[0, 0] + v.real / math.cos(math.radians(ll[0, 1])), ll[0, 1] + v.imag])(k * (z(q) - z(px)[0]))
        how = 'similarity'
    else:
        A = np.c_[ll, np.ones(len(ll))]; Ainv = np.linalg.lstsq(A, px, rcond=None)[0]
        inv = lambda q: np.c_[q, np.ones(len(q))] @ Ainv
        B = np.c_[px, np.ones(len(px))]; Bf = np.linalg.lstsq(B, ll, rcond=None)[0]
        fwd = lambda q: np.c_[q, np.ones(len(q))] @ Bf
        how = 'affine'
    # how far each landmark lands from where it is
    res = fwd(px) - ll
    err = [math.hypot(dx * 111320 * math.cos(math.radians(40.37)), dy * 110540) for dx, dy in res]
    W, E, S, N = plan.get('bbox', [49.79, 49.93, 40.335, 40.41])   # this city's part of the map
    WIDTH = plan.get('width', 2600)
    HEIGHT = round(WIDTH * (merc(N) - merc(S)) / math.radians(E - W))
    lons = np.linspace(W, E, WIDTH)
    lats = np.degrees(2 * np.arctan(np.exp(np.linspace(merc(N), merc(S), HEIGHT))) - math.pi / 2)
    LON, LAT = np.meshgrid(lons, lats)
    P = inv(np.stack([LON.ravel(), LAT.ravel()], 1))
    sx, sy = P[:, 0].reshape(LON.shape), P[:, 1].reshape(LON.shape)
    scan = Image.open(RAW / plan['file']).convert('RGB')
    a = np.asarray(scan).astype(np.float32); h, w = a.shape[:2]
    out = np.zeros((HEIGHT, WIDTH, 4), np.uint8)
    for c in range(3): out[..., c] = np.clip(map_coordinates(a[..., c], [sy, sx], order=1, mode='nearest'), 0, 255)
    x0, y0, x1, y1 = plan.get('crop', [0, 0, w, h])   # the part of the sheet that is map (no legend, no title)
    keep = (sx >= x0) & (sx < x1) & (sy >= y0) & (sy < y1)
    for ex0, ey0, ex1, ey1 in plan.get('exclude', []):        # legends and title blocks printed on the sheet
        keep &= ~((sx >= ex0) & (sx < ex1) & (sy >= ey0) & (sy < ey1))
    out[..., 3] = np.where(keep, 255, 0)
    Image.fromarray(out, 'RGBA').save(DATA / f'plan-{year}.webp', quality=74, method=6)
    meta[year] = {'title': plan['title'], 'source': plan['source'], 'fit': how, 'points': len(pts), 'meanErrorM': round(float(np.mean(err)), 1),
                  'coordinates': [[W, N], [E, N], [E, S], [W, S]]}
    print(year, how, len(pts), 'points, mean', round(float(np.mean(err))), 'm, worst', round(max(err)), 'm', ' '.join(f'{k}:{e:.0f}' for k, e in zip(plan['points'], err)),
          (DATA / f'plan-{year}.webp').stat().st_size // 1024, 'KB')
json.dump(meta, open(DATA / 'plans.json', 'w'), ensure_ascii=False, indent=1)
