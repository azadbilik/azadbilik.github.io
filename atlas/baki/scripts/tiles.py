# Cuts each placed plan into web-map tiles at the scan's own resolution, so it stays sharp when zoomed in.
#  - the scan is cleaned first: levels stretched (the darkest and lightest 0.5% clipped), the paper of
#    the line-drawn plans whitened, lines sharpened lightly (unsharp mask);
#  - the deepest zoom (zmax in data/gcps.json, near the scan's metres per pixel) is sampled straight
#    from the scan through the same fit as warp.py; every zoom above is made by averaging four tiles of
#    the one below, so nothing shimmers;
#  - a plan with "restore" (a small, soft photo of a faded drawing) is cleaned harder: the wash evened
#    out, the JPEG grain removed (non-local means), the ink set on cream, no sharpening;
#  - "seams" (a sheet mounted on linen in sections): the seams found along their length and painted out;
#  - tiles outside the plan are written too (tiny, transparent), so the map never asks for a missing one.
# Writes data/tiles/<year>/<z>/<x>/<y>.webp and the bounds and zooms into data/plans.json.
#   python scripts/tiles.py [year]      (numpy, scipy, Pillow)
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageOps
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates, spline_filter, gaussian_filter, grey_closing

HERE = Path(__file__).resolve().parents[1]
DATA, RAW = HERE / 'data', HERE / 'data' / 'raw'
G = json.load(open(DATA / 'gcps.json'))
meta = json.load(open(DATA / 'plans.json'))
Image.MAX_IMAGE_PIXELS = None
ZMIN = 12

def tile_ll(z, x, y, n=256):
    """lon, lat of every pixel centre of tile z/x/y"""
    N = 2 ** z * 256
    px = (x * 256 + np.arange(n) + .5)
    py = (y * 256 + np.arange(n) + .5)
    lon = px / N * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * py / N))))
    return np.meshgrid(lon, lat)
def unseam(a, cols, rows, win=45, pad=3):
    """paints out the linen seams of a plan mounted in sections: each seam (greyish-brown, smoothed
    along its length) is fitted with a straight line and a width, and that band is filled by blending
    the two sides across it"""
    from scipy.ndimage import uniform_filter1d
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    m = (((R - B) > 15) & ((R - B) < 60) & (R < 200) & (R > 110) & (np.abs(R - G) < 25)).astype(np.float32)
    def fill(a, m, c0):   # a vertical seam near column c0 (transposed views for a horizontal one)
        h, w = m.shape; lo_c, hi_c = max(c0 - win, 1), min(c0 + win, w - 2)
        sm = uniform_filter1d(m[:, lo_c:hi_c], 301, axis=0)
        ys, cs, ws = [], [], []
        for y in range(0, h, 25):
            i = np.where(sm[y] > .3)[0]
            if len(i): ys.append(y); cs.append((i.min() + i.max()) / 2 + lo_c); ws.append(i.max() - i.min() + 1)
        if len(ys) < 10: return
        k, b = np.polyfit(ys, cs, 1)                        # the seam's line
        half = np.median(ws) / 2 + pad
        yy = np.arange(h); cc = k * yy + b
        L = np.clip(np.round(cc - half).astype(int), 2, w - 3); Rr = np.clip(np.round(cc + half).astype(int), 2, w - 3)
        for y in yy:
            l, r = L[y], Rr[y]
            if r - l < 2: continue
            left, right = a[y, l - 2:l + 1].mean(0), a[y, r:r + 3].mean(0)
            t = np.linspace(0, 1, r - l + 1)[:, None]
            a[y, l:r + 1] = left * (1 - t) + right * t
    for c in cols: fill(a, m, c)
    at, mt = a.transpose(1, 0, 2), m.T          # views: filling them fills a
    for r in rows: fill(at, mt, r)
    return a
PAPER, INK = np.array([250, 247, 240], np.float32), np.array([30, 26, 24], np.float32)
def ll_tile(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)

for year, plan in G.items():
    if len(sys.argv) > 1 and year not in sys.argv[1:]: continue
    if 'grid' in plan:   # a map placed by its printed graticule, panel by panel (scripts/grid.py)
        gr = plan['grid']; panels = gr['panels']; sh = np.array(gr.get('shiftPx', [0, 0]), float)
        def minutes(q): return np.c_[np.ones(len(q)), (q[:, 0] + gr['ferro'] - gr['lonDeg']) * 60, (q[:, 1] - gr['latDeg']) * 60]
        def inv(q, panels=panels, sh=sh):
            M = minutes(q); out = np.full((len(q), 2), -1e9)
            for p in panels:
                P = M @ np.array(p['coef']) + sh; t = gr.get('trimPx', 30); xa, ya, xb, yb = p['px'][0] + t, p['px'][1] + t, p['px'][2] - t, p['px'][3] - t   # off the linen
                inside = (P[:, 0] >= xa) & (P[:, 0] < xb) & (P[:, 1] >= ya) & (P[:, 1] < yb)
                out[inside] = P[inside]
            # the strips where the sheet was cut into panels stay transparent: that paper is gone
            return out
        def fwd(q, panels=panels, sh=sh):
            out = np.zeros((len(q), 2))
            for i, (x, y) in enumerate(q):
                p = min(panels, key=lambda p: max(p['px'][0] - x, x - p['px'][2], p['px'][1] - y, y - p['px'][3]))
                C = np.array(p['coef']); lonm, latm = np.linalg.solve(C[1:].T, np.array([x, y]) - sh - C[0])
                out[i] = [gr['lonDeg'] + lonm / 60 - gr['ferro'], gr['latDeg'] + latm / 60]
            return out
        pts = None
    else:
        pts = np.array([p[:4] for p in plan['points'].values()], float)
        px, ll = pts[:, :2], pts[:, [3, 2]]
    if pts is None: pass
    elif len(pts) >= 8:
        inv = RBFInterpolator(ll, px, kernel='thin_plate_spline', smoothing=1e-9)
        fwd = RBFInterpolator(px, ll, kernel='thin_plate_spline', smoothing=1.0)
    else:   # two landmarks: the similarity of warp.py
        z_ = lambda q: q[:, 0] - 1j * q[:, 1]
        w_ = lambda q: (q[:, 0] - ll[0, 0]) * math.cos(math.radians(ll[0, 1])) + 1j * (q[:, 1] - ll[0, 1])
        k = (w_(ll)[1] - w_(ll)[0]) / (z_(px)[1] - z_(px)[0])
        inv = lambda q: (lambda u: np.c_[u.real, -u.imag])((w_(q) - w_(ll)[0]) / k + z_(px)[0])
        fwd = lambda q: (lambda v: np.c_[ll[0, 0] + v.real / math.cos(math.radians(ll[0, 1])), ll[0, 1] + v.imag])(k * (z_(q) - z_(px)[0]))
    # the scan, cleaned
    im = Image.open(RAW / plan['file']).convert('RGB')
    restore = plan.get('restore')
    if plan.get('seams'):   # a sheet mounted on linen in sections
        im = Image.fromarray(np.clip(unseam(np.asarray(im, np.float32).copy(), plan['seams']['cols'], plan['seams']['rows']), 0, 255).astype(np.uint8))
    if restore:   # a small, soft photo of a faded drawing: the wash evened out (each pixel over the paper's
        # level across ~40 px, so shaded blocks stay), JPEG grain removed (non-local means), ink on cream
        from skimage.restoration import denoise_nl_means
        g = np.asarray(im, np.float32).mean(2)
        n = np.clip(g / gaussian_filter(grey_closing(g, size=(41, 41)), 25), 0, 1)
        n = denoise_nl_means(n, h=.02, patch_size=5, patch_distance=6, fast_mode=True)
        dark = np.clip((1 - n - .03) / .32, 0, 1) ** 1.5
        im = Image.fromarray(np.clip(PAPER * (1 - dark[..., None]) + INK * dark[..., None], 0, 255).astype(np.uint8))
    else: im = ImageOps.autocontrast(im, cutoff=.5)
    if plan.get('auto', {}).get('streets') == 'ink' and not restore:     # a line drawing: paper to white, ink to ink
        g = np.asarray(im.convert('L')).astype(np.float32)
        g = np.clip((g - 60) / (215 - 60), 0, 1) ** 1.4 * 255
        im = Image.fromarray(g.astype(np.uint8)).convert('RGB')
    if not restore: im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=2))
    a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    # cubic resampling needs the scan pre-filtered; do it once, not for every tile
    a = np.stack([spline_filter(a[..., c], order=3, output=np.float32) for c in range(3)], -1)
    x0, y0, x1, y1 = plan.get('crop', [0, 0, w, h])
    excl = plan.get('exclude', [])
    # the plan's footprint on the map, from its crop's edge
    edge = np.array([[x, y0] for x in np.linspace(x0, x1, 30)] + [[x1, y] for y in np.linspace(y0, y1, 30)] + [[x, y1] for x in np.linspace(x1, x0, 30)] + [[x0, y] for y in np.linspace(y1, y0, 30)])
    E = fwd(edge); W_, S_, E_, N_ = E[:, 0].min(), E[:, 1].min(), E[:, 0].max(), E[:, 1].max()
    zmax = plan.get('zmax', 17)
    out = DATA / 'tiles' / year
    count = 0
    # deepest zoom from the scan
    tx0, ty0 = ll_tile(W_, N_, zmax); tx1, ty1 = ll_tile(E_, S_, zmax)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            LON, LAT = tile_ll(zmax, tx, ty)
            P = inv(np.stack([LON.ravel(), LAT.ravel()], 1)); sx, sy = P[:, 0].reshape(LON.shape), P[:, 1].reshape(LON.shape)
            keep = (sx >= x0) & (sx < x1) & (sy >= y0) & (sy < y1)
            for ex0, ey0, ex1, ey1 in excl: keep &= ~((sx >= ex0) & (sx < ex1) & (sy >= ey0) & (sy < ey1))
            t = np.zeros((256, 256, 4), np.uint8)
            if keep.any():
                for c in range(3): t[..., c] = np.clip(map_coordinates(a[..., c], [sy, sx], order=3, mode='nearest', prefilter=False), 0, 255)
                t[..., 3] = np.where(keep, 255, 0)
            f = out / str(zmax) / str(tx); f.mkdir(parents=True, exist_ok=True)
            Image.fromarray(t, 'RGBA').save(f / f'{ty}.webp', quality=80, method=5)
            count += 1
    # the zooms above: four tiles averaged into one (alpha-weighted, so the plan's edge stays clean)
    zmin = plan.get('zmin', ZMIN)
    for z in range(zmax - 1, zmin - 1, -1):
        tx0, ty0 = ll_tile(W_, N_, z); tx1, ty1 = ll_tile(E_, S_, z)
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                big = np.zeros((512, 512, 4), np.float32)
                for dx in (0, 1):
                    for dy in (0, 1):
                        f = out / str(z + 1) / str(2 * tx + dx) / f'{2 * ty + dy}.webp'
                        if f.exists(): big[dy * 256:(dy + 1) * 256, dx * 256:(dx + 1) * 256] = np.asarray(Image.open(f).convert('RGBA'), np.float32)
                al = big[..., 3:4] / 255
                rgb = (big[..., :3] * al).reshape(256, 2, 256, 2, 3).sum((1, 3))
                aw = al.reshape(256, 2, 256, 2, 1).sum((1, 3))
                t = np.zeros((256, 256, 4), np.uint8)
                t[..., :3] = np.clip(rgb / np.maximum(aw, 1e-6), 0, 255)
                t[..., 3] = np.clip(aw[..., 0] / 4 * 255, 0, 255)
                d = out / str(z) / str(tx); d.mkdir(parents=True, exist_ok=True)
                Image.fromarray(t, 'RGBA').save(d / f'{ty}.webp', quality=80, method=5)
                count += 1
    size = sum(f.stat().st_size for f in out.rglob('*.webp'))
    import hashlib   # a version in the URL, so browsers and caches fetch rebuilt tiles instead of keeping old ones
    ver = hashlib.sha1(b''.join(f.read_bytes() for f in sorted((out / str(zmax)).rglob('*.webp')))).hexdigest()[:8]
    meta.setdefault(year, {}).update({'tiles': f'data/tiles/{year}/{{z}}/{{x}}/{{y}}.webp?v={ver}', 'bounds': [round(W_, 5), round(S_, 5), round(E_, 5), round(N_, 5)], 'minzoom': zmin, 'maxzoom': zmax})
    print(f'{year}: {count} tiles, z{zmin}–{zmax}, {size // 1024 // 1024} MB')
json.dump(meta, open(DATA / 'plans.json', 'w'), ensure_ascii=False, indent=1)
