# A travel model in the manner of Stanford's ORBIS: how long did it take to go from one khanate's
# capital to another, on foot with a caravan or on horseback? There are no roads in it, only the land:
#  - the ground: terrain tiles (data/raw/dem, Mapzen/AWS «terrarium», zoom 8, ~470 m a pixel);
#  - speed on a slope: Tobler's hiking function, 6·e^(−3.5·|slope+0.05|) km/h, scaled for each way of
#    travelling (a laden caravan 0.7 of a walker, 8 hours a day; a rider 1.6, 10 hours a day);
#  - water: the Caspian (the ground below −28 m east of 48.5°E), Sevan, Urmia and Van (Natural Earth)
#    cannot be crossed; the Kura and the Araz cost half a day to cross (a ford or ferry), anywhere.
# For every capital, the hours to every pixel (Dijkstra, skimage MCP); from that: the fastest way to
# every other capital and the land reached in 1, 2, 3 … days. Writes data/routes.geojson,
# data/reach.geojson and data/table.json. It is a model of the land, not a record of the roads.
#   python scripts/model.py      (numpy, scipy, scikit-image, shapely, Pillow)
import json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from skimage.graph import MCP_Geometric
from skimage.measure import find_contours
from scipy.ndimage import gaussian_filter
from shapely.geometry import shape, Polygon, MultiPolygon, mapping, LineString
from shapely.ops import unary_union

HERE = Path(__file__).resolve().parents[1]
RAW, ATLAS = HERE / 'data' / 'raw', HERE.parent
Z, X0, X1, Y0, Y1 = 8, 158, 165, 94, 101
W, H = (X1 - X0 + 1) * 256, (Y1 - Y0 + 1) * 256

# the ground
dem = np.zeros((H, W), np.float32)
for x in range(X0, X1 + 1):
    for y in range(Y0, Y1 + 1):
        a = np.asarray(Image.open(RAW / 'dem' / f'{Z}-{x}-{y}.png').convert('RGB')).astype(np.float32)
        dem[(y - Y0) * 256:(y - Y0 + 1) * 256, (x - X0) * 256:(x - X0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
def px2ll(px, py):
    n = 2 ** Z * 256
    lon = (X0 * 256 + px) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (Y0 * 256 + py) / n))))
    return lon, lat
def ll2px(lon, lat):
    n = 2 ** Z * 256
    x = (lon + 180) / 360 * n - X0 * 256
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n - Y0 * 256
    return x, y
lats = np.array([px2ll(0, r)[1] for r in range(H)])
mpp = (156543.03 * np.cos(np.radians(lats)) / 2 ** Z)[:, None] * np.ones((1, W))   # metres a pixel, by row

# water
water = np.zeros((H, W), bool)
lon_grid = np.array([px2ll(c, 0)[0] for c in range(W)])[None, :] * np.ones((H, 1))
water |= (dem < -28) & (lon_grid > 48.5)                                   # the Caspian
lakes = Image.new('1', (W, H), 0); dr = ImageDraw.Draw(lakes)
for f in json.load(open(RAW / 'ne_10m_lakes.geojson'))['features']:
    if f['properties'].get('name') not in ('Lake Sevan', 'Lake Urmia', 'Lake Van'): continue
    g = shape(f['geometry'])
    for p in getattr(g, 'geoms', [g]):
        dr.polygon([ll2px(*c) for c in p.exterior.coords], fill=1)
water |= np.asarray(lakes, bool)
rivers = Image.new('1', (W, H), 0); dr = ImageDraw.Draw(rivers)
for f in json.load(open(ATLAS / 'hovze' / 'data' / 'rivers.geojson'))['features']:
    if f['properties']['az'] not in ('Kür', 'Araz'): continue
    for l in shape(f['geometry']).geoms:
        dr.line([ll2px(*c) for c in l.coords], fill=1, width=2)
river = np.asarray(rivers, bool) & ~water

# hours to cross a pixel, per way of travelling
gy, gx = np.gradient(gaussian_filter(dem, 1))
slope = np.hypot(gx, gy) / mpp
walk = 6 * np.exp(-3.5 * np.abs(slope + .05))                              # km/h, Tobler (symmetric: |slope|)
MODES = {'caravan': {'k': .7, 'hours': 8}, 'rider': {'k': 1.6, 'hours': 10}}
def hours(mode):
    h = (mpp / 1000) / (walk * MODES[mode]['k'])
    h = np.where(river, h + 2.0, h)                                         # two river pixels: ~half a caravan day
    return np.where(water, np.inf, h)

table = json.load(open(ATLAS / 'xanliqlar' / 'data' / 'khanates.json'))
# the capitals south of the Araz have no capital name in the table: their towns
CAP = {"tabriz": ["Təbriz", "Тебриз", "Tabriz"], "karadagh": ["Əhər", "Ахар", "Ahar"], "ardabil": ["Ərdəbil", "Ардебиль", "Ardabil"], "sarab": ["Sərab", "Сараб", "Sarab"], "khoy": ["Xoy", "Хой", "Khoy"], "urmia": ["Urmiya", "Урмия", "Urmia"], "maku": ["Maku", "Маку", "Maku"], "maragha": ["Marağa", "Мараге", "Maragheh"], "derbent": ["Dərbənd", "Дербент", "Derbent"]}
places = [{'id': k['id'], 'names': k['names'], 'capitalName': k.get('capitalName') or CAP.get(k['id']) or k['names'], 'lonlat': k['capital']} for k in table['khanates'] + table['south']]
places.append({'id': 'tiflis', 'names': ['Tiflis', 'Тифлис', 'Tiflis'], 'capitalName': ['Tiflis', 'Тифлис', 'Tiflis'], 'lonlat': [44.80, 41.69]})
for p in places:
    x, y = ll2px(*p['lonlat']); p['px'] = (int(round(y)), int(round(x)))
    if water[p['px']]: raise SystemExit(f"{p['id']} is in the water")

routes, reach, tab = [], [], {m: {} for m in MODES}
for mode, cfg in MODES.items():
    cost = hours(mode)
    for p in places:
        mcp = MCP_Geometric(cost, fully_connected=True)
        cum, _ = mcp.find_costs([p['px']])
        days = cum / cfg['hours']
        tab[mode][p['id']] = {}
        for q in places:
            if q is p: continue
            d = days[q['px']]
            tab[mode][p['id']][q['id']] = round(float(d), 1)
            if mode == 'caravan' and p['id'] < q['id']:
                path = mcp.traceback(q['px'])
                ll = [px2ll(c, r) for r, c in path]
                line = LineString(ll).simplify(.004)
                km = sum(math.dist((a[0] * 85, a[1] * 111), (b[0] * 85, b[1] * 111)) for a, b in zip(line.coords, line.coords[1:]))
                routes.append({'type': 'Feature', 'geometry': mapping(line), 'properties': {'a': p['id'], 'b': q['id'], 'km': round(km)}})
        if mode == 'caravan':
            # the land reached within 1, 2, 3 … 12 days, as rings
            small = days[::2, ::2]
            for dd in range(1, 13):
                cs = [c for c in find_contours(np.where(np.isfinite(small), small, 1e9), dd) if len(c) > 8]
                polys = [Polygon([px2ll(c * 2, r * 2) for r, c in cc]).buffer(0) for cc in cs]
                inside = unary_union([g for g in polys if g.is_valid and g.contains(shape({'type': 'Point', 'coordinates': p['lonlat']}))] or polys)
                if inside.is_empty: continue
                reach.append({'type': 'Feature', 'geometry': mapping(inside.simplify(.01)), 'properties': {'from': p['id'], 'days': dd}})
    print(mode, 'done')

r4 = lambda o: json.loads(json.dumps(o), parse_float=lambda s: round(float(s), 4))
out = HERE / 'data'
json.dump(r4({'type': 'FeatureCollection', 'features': routes}), open(out / 'routes.geojson', 'w'))
json.dump(r4({'type': 'FeatureCollection', 'features': reach}), open(out / 'reach.geojson', 'w'))
json.dump({'modes': {m: {'speedOfWalker': c['k'], 'hoursADay': c['hours']} for m, c in MODES.items()},
           'places': [{k: p[k] for k in ('id', 'names', 'capitalName', 'lonlat')} for p in places], 'days': tab}, open(out / 'table.json', 'w'), ensure_ascii=False)
for f in ('routes.geojson', 'reach.geojson', 'table.json'): print(f, (out / f).stat().st_size // 1024, 'KB')
print('caravan days, Shusha → Shamakhi', tab['caravan']['karabakh']['shirvan'], '; Tabriz → Tiflis', tab['caravan']['tabriz']['tiflis'], '; Baku → Derbent', tab['caravan']['baku']['derbent'])
