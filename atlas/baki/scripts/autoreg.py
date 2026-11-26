# Places a historical plan of Baku by matching its streets to today's, instead of by hand-read landmarks:
# today's streets (OpenStreetMap, data/raw/baku.geojson: osmium extract, see README) are drawn at each
# rotation and scale in a range, and each drawing is cross-correlated (FFT) with the plan's streets
# (the light gaps between its blocks); the best (rotation, scale, shift) wins. Then the match is
# sharpened piece by piece: in tiles across the plan, the local shift that best lines the streets up
# gives one anchor per tile, and those anchors (data/gcps.json) feed warp.py's rubber sheet.
#   python scripts/autoreg.py 1898      (numpy, scipy, Pillow)
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, binary_dilation

HERE = Path(__file__).resolve().parents[1]
DATA, RAW = HERE / 'data', HERE / 'data' / 'raw'
year = sys.argv[1]
G = json.load(open(DATA / 'gcps.json')); plan = G[year]
cfg = plan['auto']           # street colour rule, rough anchor, scale range
Image.MAX_IMAGE_PIXELS = None
F = cfg.get('down', 4)       # work at 1/F resolution
img = Image.open(RAW / plan['file']).convert('RGB')
a = np.asarray(img.resize((img.width // F, img.height // F), Image.BILINEAR)).astype(np.int16)
R, Gc, B = a[..., 0], a[..., 1], a[..., 2]
if cfg['streets'] == 'light':      # coloured blocks, streets left white
    street = (R > 215) & (Gc > 210) & (B > 195)
else:                              # line drawing: a street runs between two inked block edges
    ink = (R < 150)
    street = ink
x0, y0, x1, y1 = plan.get('crop', [0, 0, img.width, img.height])
street[: y0 // F] = 0; street[y1 // F:] = 0; street[:, : x0 // F] = 0; street[:, x1 // F:] = 0
target = gaussian_filter(street.astype(np.float32), cfg.get('blur', 1.2))
target -= target.mean()

lat0, lon0 = cfg['anchor'][2], cfg['anchor'][3]
def local(lon, lat): return ((lon - lon0) * 111320 * math.cos(math.radians(lat0)), (lat - lat0) * 110540)
lines = []
for f in json.load(open(RAW / 'baku.geojson'))['features']:
    p, g = f['properties'], f['geometry']
    if g['type'] != 'LineString' or p.get('highway') not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'pedestrian'): continue
    pts = [local(*c) for c in g['coordinates']]
    if all(math.hypot(*q) > cfg.get('radius', 2500) for q in pts): continue
    lines.append(pts)

H, W = street.shape
def render(theta, s):
    """today's streets drawn into plan pixels (at 1/F) for rotation theta (deg) and scale s (m per full-res px), anchor at the origin"""
    c, si = math.cos(math.radians(theta)), math.sin(math.radians(theta))
    im = Image.new('L', (W, H), 0); d = ImageDraw.Draw(im)
    ax, ay = cfg['anchor'][0] / F, cfg['anchor'][1] / F
    for pts in lines:
        xy = [(ax + (c * e + si * n) / s / F, ay - (-si * e + c * n) / s / F) for e, n in pts]
        d.line(xy, fill=255, width=2)
    m = np.asarray(im, np.float32) / 255
    return m - m.mean()
FT = np.fft.rfft2(target)
def best_shift(theta, s, lim):
    m = render(theta, s)
    cc = np.fft.irfft2(FT * np.conj(np.fft.rfft2(m)), s=target.shape)
    cc = np.roll(np.roll(cc, lim, 0), lim, 1)[: 2 * lim + 1, : 2 * lim + 1]   # shifts within ±lim px
    k = np.unravel_index(np.argmax(cc), cc.shape)
    return cc[k], (k[1] - lim) * F, (k[0] - lim) * F
best = None
for s in np.arange(*cfg['scale']):
    for theta in np.arange(*cfg['rotation']):
        sc, dx, dy = best_shift(theta, s, cfg.get('shift', 60))
        if not best or sc > best[0]: best = (sc, theta, s, dx, dy)
sc, theta, s, dx, dy = best
print(f'{year}: rotation {theta:.1f}°, {s:.3f} m/px, shift {dx}, {dy} px (score {sc:.0f})')
# refine around the best
for s2 in np.arange(s - .02, s + .021, .005):
    for t2 in np.arange(theta - 1, theta + 1.01, .25):
        sc2, dx2, dy2 = best_shift(t2, s2, cfg.get('shift', 60))
        if sc2 > sc: sc, theta, s, dx, dy = sc2, t2, s2, dx2, dy2
print(f'{year}: refined rotation {theta:.2f}°, {s:.4f} m/px, shift {dx}, {dy} px')

# the global fit as anchors: a grid of points, plan pixel ↔ lat/lon
c, si = math.cos(math.radians(theta)), math.sin(math.radians(theta))
ax, ay = cfg['anchor'][0] + dx, cfg['anchor'][1] + dy
def plan_to_ll(x, y):
    u, v = (x - ax) * s, -(y - ay) * s          # metres along the plan's axes
    e, n = c * u - si * v, si * u + c * v
    return lat0 + n / 110540, lon0 + e / (111320 * math.cos(math.radians(lat0)))
# local sharpening: today's streets drawn with the global fit, then in each tile the shift (±lim px at
# 1/F) that best lines them up with the plan's; a tile with too few streets keeps the global fit
m_all = render(theta, s)
m_all = np.roll(np.roll(m_all, dy // F, 0), dx // F, 1)
TILES, LIM = cfg.get('tiles', 5), cfg.get('local', 25)
pts = {}
for gx in np.linspace(x0 + 200, x1 - 200, TILES):
    for gy in np.linspace(y0 + 200, y1 - 200, TILES):
        cx, cy, hw = int(gx / F), int(gy / F), int((x1 - x0) / F / TILES / 1.4)
        ya, yb, xa, xb = max(cy - hw, 0), min(cy + hw, H), max(cx - hw, 0), min(cx + hw, W)
        t_ = target[ya:yb, xa:xb]; m_ = m_all[ya:yb, xa:xb]
        lx = ly = 0
        if (m_ > 0).mean() > .01 and t_.size:
            cc = np.fft.irfft2(np.fft.rfft2(t_ - t_.mean()) * np.conj(np.fft.rfft2(m_ - m_.mean())), s=t_.shape)
            cc = np.roll(np.roll(cc, LIM, 0), LIM, 1)[: 2 * LIM + 1, : 2 * LIM + 1]
            k = np.unravel_index(np.argmax(cc), cc.shape)
            inside = 2 <= k[0] <= 2 * LIM - 2 and 2 <= k[1] <= 2 * LIM - 2
            better = cc[k] > 1.15 * max(cc[LIM, LIM], 1e-9)       # clearly better than the global fit's own place
            if inside and better: ly, lx = (k[0] - LIM) * F, (k[1] - LIM) * F
        # the plan point (gx + lx, gy + ly) shows what the global fit put at (gx, gy)
        la, lo = plan_to_ll(gx, gy)
        pts[f'g{int(gx)}-{int(gy)}'] = [int(gx + lx), int(gy + ly), round(la, 6), round(lo, 6)]
        print(f'  tile {int(gx)},{int(gy)}: local shift {lx}, {ly} px')
plan['points'] = pts
plan['fit'] = {'rotation': round(theta, 2), 'mPerPx': round(s, 4), 'anchorShift': [int(dx), int(dy)]}
json.dump(G, open(DATA / 'gcps.json', 'w'), ensure_ascii=False, indent=1)
print('wrote', len(pts), 'anchors')
