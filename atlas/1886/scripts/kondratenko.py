# Fits a 2nd-order polynomial per Kondratenko sheet from gcp-<sheet>.json, drops LOO outliers (>3x median),
# warps the sheet to web-Mercator lon/lat, masks it to the governorate (1897 outline, buffered) minus the
# legend/title blocks, writes the webp + kondratenko.json + kondratenko-gcps.json (+ check PNGs in the temp dir).
# Control points: data/raw/kondratenko-gcp-<sheet>.json (village dots read on the sheet, matched to geocode-1886.csv).
#   python3 scripts/kondratenko.py      (numpy, scipy, Pillow, shapely; scans in ~/kitabxana-scans/prlib)
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
Image.MAX_IMAGE_PIXELS = None
K = Path(__file__).resolve().parents[1] / 'data' / 'raw'
import tempfile
SC = Path(tempfile.gettempdir())   # check images (not kept)
SCANS = Path.home() / 'kitabxana-scans/prlib'
ATLAS = Path(__file__).resolve().parents[2]
OUT = ATLAS / '1886/data'
UNITS = json.load(open(ATLAS / '1897/data/units.geojson'))
SHEETS = {
    'baku': dict(file='prlib-768136-p12.jpg', gov='Бакинская губерния',
                 exclude=[(0, 0, 945, 600), (1700, 0, 3125, 745), (0, 1485, 470, 2159), (1950, 1560, 2600, 2159), (0, 0, 3125, 30), (0, 2130, 3125, 2159)]),
    'elisavetpol': dict(file='prlib-768136-p14.jpg', gov='Елисаветпольская губерния',
                        exclude=[(0, 975, 680, 2155), (700, 1740, 1080, 2155), (2400, 0, 3115, 620), (2390, 620, 3115, 1560), (2170, 1570, 3115, 2155), (0, 0, 3115, 45), (0, 2115, 3115, 2155)]),
}
BUF = 0.07   # degrees around the 1897 governorate outline
MAXW = 2400
merc = lambda la: math.log(math.tan(math.pi / 4 + math.radians(la) / 2))

def design_px(p):
    x, y = (p[:, 0] - 1500) / 1000, (p[:, 1] - 1000) / 1000
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], 1)

def make_design_ll(lon0, lat0):
    def D(q):
        x, y = (q[:, 0] - lon0) * math.cos(math.radians(lat0)), q[:, 1] - lat0
        return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], 1)
    return D

def km(lon, lat, lon2, lat2):
    return math.hypot((lon - lon2) * 111.32 * math.cos(math.radians(lat2)), (lat - lat2) * 110.57)

def loo(pts):
    names = list(pts); a = np.array([pts[n][:4] for n in names], float)
    px, ll = a[:, :2], a[:, [3, 2]]; res = {}
    for i, n in enumerate(names):
        m = np.arange(len(a)) != i
        C = np.linalg.lstsq(design_px(px[m]), ll[m], rcond=None)[0]
        lon, lat = (design_px(px[i:i + 1]) @ C)[0]
        res[n] = km(lon, lat, ll[i, 0], ll[i, 1])
    return res

result, corners = {}, {}
for sheet, cfg in SHEETS.items():
    g = json.load(open(K / f'kondratenko-gcp-{sheet}.json'))
    pts = {n: v for n, v in g.items()}
    dropped = []
    while True:
        r = loo(pts); med = float(np.median(list(r.values())))
        bad = [n for n, d in r.items() if d > 3 * med]
        if not bad: break
        for n in bad: dropped.append({'name': n, 'looKm': round(r[n], 2), 'xy': pts[n][:2], 'latlon': pts[n][2:4]}); del pts[n]
    r = loo(pts); med = float(np.median(list(r.values())))
    a = np.array([v[:4] for v in pts.values()], float); px, ll = a[:, :2], a[:, [3, 2]]
    lon0, lat0 = ll[:, 0].mean(), ll[:, 1].mean(); DL = make_design_ll(lon0, lat0)
    Cinv = np.linalg.lstsq(DL(ll), px, rcond=None)[0]       # pixel <- lon/lat
    Cfwd = np.linalg.lstsq(design_px(px), ll, rcond=None)[0]  # lon/lat <- pixel
    fitres = [km(*(design_px(px[i:i+1]) @ Cfwd)[0], ll[i, 0], ll[i, 1]) for i in range(len(a))]
    print(sheet, 'points', len(pts), 'dropped', [(d['name'], d['looKm']) for d in dropped])
    print(f'  LOO median {med:.2f} km, max {max(r.values()):.2f} km, mean {np.mean(list(r.values())):.2f}; fit median {np.median(fitres):.2f}')
    result[sheet] = {'file': cfg['file'], 'fit': 'second-order polynomial, least squares (pixel <- lon/lat for warping, lon/lat <- pixel for residuals)',
                     'points': {n: [round(v[0], 1), round(v[1], 1), v[2], v[3]] for n, v in pts.items()},
                     'looKm': {n: round(d, 2) for n, d in sorted(r.items(), key=lambda t: -t[1])},
                     'dropped': dropped, 'looKmMedian': round(med, 2), 'looKmMax': round(max(r.values()), 2)}

    # mask polygon: 1897 governorate outline, buffered, into pixel space
    gov = unary_union([shape(f['geometry']) for f in UNITS['features'] if f['properties']['govKey'] == cfg['gov']])
    area = gov.buffer(BUF).simplify(0.005)
    W, S, E, N = area.bounds
    scan = Image.open(SCANS / cfg['file']).convert('RGB'); sw, sh = scan.size
    mask = Image.new('L', (sw, sh), 0); d = ImageDraw.Draw(mask)
    polys = area.geoms if area.geom_type == 'MultiPolygon' else [area]
    toPx = lambda xy: [tuple(p) for p in (DL(np.array(xy, float)) @ Cinv)]
    for p in polys:
        d.polygon(toPx(list(p.exterior.coords)), fill=255)
        for h in p.interiors: d.polygon(toPx(list(h.coords)), fill=0)
    for x0, y0, x1, y1 in cfg['exclude']: d.rectangle([x0, y0, x1, y1], fill=0)
    mask.resize((sw // 4, sh // 4)).save(SC / f'kond-mask-{sheet}.png')

    # warp
    WIDTH = MAXW
    HEIGHT = round(WIDTH * (merc(N) - merc(S)) / math.radians(E - W))
    lons = np.linspace(W, E, WIDTH)
    lats = np.degrees(2 * np.arctan(np.exp(np.linspace(merc(N), merc(S), HEIGHT))) - math.pi / 2)
    LON, LAT = np.meshgrid(lons, lats)
    P = DL(np.stack([LON.ravel(), LAT.ravel()], 1)) @ Cinv
    sx, sy = P[:, 0].reshape(LON.shape), P[:, 1].reshape(LON.shape)
    arr = np.asarray(scan).astype(np.float32)
    out = np.zeros((HEIGHT, WIDTH, 4), np.uint8)
    for c in range(3): out[..., c] = np.clip(map_coordinates(arr[..., c], [sy, sx], order=1, mode='constant', cval=255), 0, 255)
    m = map_coordinates(np.asarray(mask).astype(np.float32), [sy, sx], order=1, mode='constant', cval=0)
    out[..., 3] = np.clip(m, 0, 255).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    img.save(OUT / f'kondratenko-{sheet}.webp', quality=75, method=6)
    corners[sheet] = {'image': f'kondratenko-{sheet}.webp', 'coordinates': [[round(W, 5), round(N, 5)], [round(E, 5), round(N, 5)], [round(E, 5), round(S, 5)], [round(W, 5), round(S, 5)]],
                      'source': f'prlib.ru 768136, {cfg["file"]}', 'points': len(pts), 'looKmMedian': round(med, 2)}
    print('  image', WIDTH, 'x', HEIGHT, (OUT / f'kondratenko-{sheet}.webp').stat().st_size // 1024, 'KB', 'bbox', [round(W, 3), round(S, 3), round(E, 3), round(N, 3)])

    # check image: warped map over white + 1897 uezd outlines (red) + control points (blue = used, magenta = dropped)
    bg = Image.new('RGBA', img.size, (255, 255, 255, 255)); bg.alpha_composite(img)
    ck = bg.convert('RGB'); dd = ImageDraw.Draw(ck)
    def toImg(lon, lat): return ((lon - W) / (E - W) * WIDTH, (merc(N) - merc(lat)) / (merc(N) - merc(S)) * HEIGHT)
    for f in UNITS['features']:
        geom = shape(f['geometry'])
        for p in (geom.geoms if geom.geom_type == 'MultiPolygon' else [geom]):
            dd.line([toImg(*c) for c in p.exterior.coords], fill=(220, 0, 0), width=3)
    for n, v in pts.items():
        X, Y = toImg(v[3], v[2]); dd.ellipse([X - 6, Y - 6, X + 6, Y + 6], outline=(0, 90, 255), width=3)
    for dr in dropped:
        X, Y = toImg(dr['latlon'][1], dr['latlon'][0]); dd.ellipse([X - 7, Y - 7, X + 7, Y + 7], outline=(255, 0, 255), width=3)
    ck.save(SC / f'kond-check-{sheet}.png')

json.dump(result, open(OUT / 'raw/kondratenko-gcps.json', 'w'), ensure_ascii=False, indent=1)
json.dump(corners, open(OUT / 'kondratenko.json', 'w'), ensure_ascii=False, indent=1)
