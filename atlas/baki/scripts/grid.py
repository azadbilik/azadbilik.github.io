# Places a map that prints its own graticule and was cut into panels for mounting on linen (the 1899
# Absheron map): each panel gets its own fit from the minute lines it shows.
#  - the sheet is split into bands: columns and rows of panels, separated by the linen gaps;
#  - in every band the long, thin grid lines are found as dips in the mean brightness across the band;
#  - lines are chained from a labelled first minute at a known step (px per minute); a gap a little
#    wider than a step is a seam (the chain still counts one minute), a missing line is skipped;
#  - each panel's line crossings (lon, lat in minutes -> pixel) are fitted with an affine transform;
#  - longitudes are printed east of Ferro: Greenwich = Ferro - 17°39'46".
# Writes data/raw/<key>-grid.json (the lines found) and the panels into data/gcps.json[<key>].
#   python scripts/grid.py absheron-1899        (numpy, Pillow)
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parents[1]
DATA, RAW = HERE / 'data', HERE / 'data' / 'raw'
Image.MAX_IMAGE_PIXELS = None
FERRO = 17 + 39 / 60 + 46 / 3600

CFG = {
    'absheron-1899': dict(
        file='absheron-1899.tif',
        # column sections: (first labelled line x, its minute of longitude east of Ferro, from 67°)
        cols=[(389, 9, 'west strip, 67°9′–15′'), (2934, 29, 'main map, 67°29′–68°2′')],
        rows=[(352, 40)],                  # the first latitude line (40°40′) and its minute (from 40°)
        lon_deg=67, lat_deg=40, sx=404, sy=523,     # px per minute of longitude / latitude
        frame=(385, 352, 16440, 15640),    # the neat line
    ),
}

def dips(prof, thr):
    bg = np.convolve(prof, np.ones(41) / 41, 'same'); d = bg - prof
    return [i for i in range(3, len(d) - 3) if d[i] > thr and d[i] == d[i - 3:i + 4].max()]

def chain(peaks, start, step, end):
    """[(k, pos)] lines k steps after `start`; a seam may widen one step by up to 160 px"""
    out, cur, k = [(0, start)], start, 0
    peaks = np.array(sorted(peaks))
    while cur + step < end:
        k += 1
        c = peaks[(peaks > cur + step - 45) & (peaks < cur + step + 160)]
        if len(c):
            p = int(c[np.argmin(np.abs(c - (cur + step)))]) if (np.abs(c - (cur + step)) < 45).any() else int(c.min())
            out.append((k, p)); cur = p
        else: cur += step     # a line not found: keep counting
    return out

def seams(lines, step):
    """positions between consecutive lines that are further apart than a step (the linen gaps)"""
    return [(a[1] + b[1]) / 2 for a, b in zip(lines, lines[1:]) if b[0] - a[0] == 1 and b[1] - a[1] > step + 18]

key = sys.argv[1] if len(sys.argv) > 1 else 'absheron-1899'
c = CFG[key]
g = np.asarray(Image.open(RAW / c['file']).convert('L'), np.float32)
H, W = g.shape
X0, Y0, X1, Y1 = c['frame']

# 1. the panel seams: the linen between panels is lighter and bluer than the paper
sm = np.asarray(Image.open(RAW / c['file']).convert('RGB').reduce(4), np.float32)
R, B = sm[..., 0], sm[..., 2]
lin = ((B > 70) & (B / (R + 1) > .42) & (R > 140)).astype(np.float32)
def runs(f):
    idx = np.where(f > .3)[0]; out = []
    for i in idx:
        if out and i - out[-1][1] <= 3: out[-1][1] = i
        else: out.append([i, i])
    return [int((a + b) * 2) for a, b in out]
xseams = sorted({X0, X1} | {s for s in runs(lin[Y0 // 4:Y1 // 4].mean(0)) if X0 + 200 < s < X1 - 200})
yseams = sorted({Y0, Y1} | {s for s in runs(lin[:, X0 // 4:X1 // 4].mean(1)) if Y0 + 200 < s < Y1 - 200})
print('column seams', xseams); print('row seams', yseams)

# 2. the labelled minutes: chained across the sheet from the first labelled line of each section
# (the second row of panels: the title cartouche hides the grid in the first row's east; lines within
# 60 px of a seam are the seam's own edge)
vt = [q for q in dips(g[yseams[1] + 30:yseams[2] - 30].mean(0), 6) if all(abs(q - x) > 60 for x in xseams)]
ht = dips(g[:, X0 + 20:xseams[1] - 20].mean(1), 6)
colsets = []
for i, (x, m, name) in enumerate(c['cols']):
    xe = c['cols'][i + 1][0] - 150 if i + 1 < len(c['cols']) else X1
    colsets.append((m, [(m + k, p) for k, p in chain(vt, x, c['sx'], xe)], name))
rows = [(c['rows'][0][1] - k, p) for k, p in chain(ht, c['rows'][0][0], c['sy'], Y1 + 40)]

def match(found, expect, lo, hi, step):
    """each expected (minute, pos) -> the nearest line found within the panel (a panel may sit up to a
    third of a step off its neighbours); then lines off the panel's own regular spacing are dropped"""
    out = []
    for m, p in expect:
        if not lo - step / 3 < p < hi + step / 3: continue
        c_ = [q for q in found if abs(q - p) < step / 3]
        if c_: out.append((m, min(c_, key=lambda q: abs(q - p))))
    while len(out) >= 3:
        A = np.array([[1, m] for m, _ in out], float); y = np.array([q for _, q in out], float)
        r = np.abs(A @ np.linalg.lstsq(A, y, rcond=None)[0] - y)
        if r.max() < 6: break
        out.pop(int(r.argmax()))
    return out

panels = []
for ci in range(len(xseams) - 1):
    xa, xb = xseams[ci], xseams[ci + 1]
    sec = max((s for s in colsets if s[1][0][1] < xb - 50), key=lambda s: s[1][0][1])
    for ri in range(len(yseams) - 1):
        ya, yb = yseams[ri], yseams[ri + 1]
        bv = [q + xa for q in dips(g[ya + 30:yb - 30, xa:xb].mean(0), 5)]
        bh = [q + ya for q in dips(g[ya:yb, xa + 30:xb - 30].mean(1), 5)]
        V = match(bv, sec[1], xa, xb, c['sx']); Hm = match(bh, rows, ya, yb, c['sy'])
        if len(V) < 2 or len(Hm) < 2: print('panel', ci, ri, 'too few lines', len(V), len(Hm)); continue
        pts = [(lo, la, x, y) for lo, x in V for la, y in Hm]
        A = np.array([[1, lo, la] for lo, la, _, _ in pts], float); P = np.array([[x, y] for *_, x, y in pts], float)
        coef = np.linalg.lstsq(A, P, rcond=None)[0]
        res = np.abs(A @ coef - P).max()
        panels.append({'px': [xa, ya, xb, yb], 'coef': coef.round(5).tolist(), 'lon': [V[0][0], V[-1][0]], 'lat': [Hm[-1][0], Hm[0][0]],
                       'lines': [len(V), len(Hm)], 'maxResPx': round(float(res), 1), 'section': sec[2]})
        print(f'panel x{xa}-{xb} y{ya}-{yb}: lon {V[0][0]}-{V[-1][0]} lat {Hm[-1][0]}-{Hm[0][0]}: {len(V)}x{len(Hm)} lines, max residual {res:.1f} px')

# 3. store: coef maps (1, lon minutes from lon_deg east of Ferro, lat minutes from lat_deg) -> pixel
G = json.load(open(DATA / 'gcps.json'))
G.setdefault(key, {}).update({'file': c['file'], 'grid': {'lonDeg': c['lon_deg'], 'latDeg': c['lat_deg'], 'ferro': FERRO, 'panels': panels}})
json.dump({'vertical': vt, 'horizontal': ht, 'columns': [[m, ls, n] for m, ls, n in colsets], 'rows': rows}, open(RAW / f'{key}-grid.json', 'w'))
json.dump(G, open(DATA / 'gcps.json', 'w'), ensure_ascii=False, indent=1)
print(len(panels), 'panels')
