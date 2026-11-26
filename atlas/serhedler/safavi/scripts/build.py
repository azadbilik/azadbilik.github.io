# The Safavid empire about 1700, for the story's opening step, and Delisle's 1724 «Carte de Perse»
# warped onto the web map to fade in behind it.
#
# Delisle outlined some provinces by hand (Kandahar, Kerman, Georgia, Erivan, Iraq-Ajam), not the
# empire as a whole, so the outline is put together from parts, each named in data/safavid-1700.geojson:
#  - traced from Delisle (pixels on the scan, placed by 21 towns in data/raw/delisle-gcps.json with a
#    smoothed thin-plate spline, the usual «rubber sheet» for old maps): the eastern frontier, Kandahar
#    province against Mughal Kabul and Multan and down to Makran;
#  - Khorasan's northern edge: the Kopet Dagh, Sarakhs and Merv (Delisle's lines there fell in the Karakum);
#  - the Ottoman frontier as the Treaty of Zuhab (1639) left it, which today's Iran–Iraq and Iran–Turkey
#    borders largely follow, with the eastern Georgian kingdoms (Kartli, Kakheti: Safavid vassals) and
#    Derbent inside; points in lon/lat below;
#  - the coasts: Natural Earth's land (public domain).
# Approximate by construction: the page says so.
#   python scripts/build.py      (numpy, scipy, shapely, Pillow)
import json, math
from pathlib import Path
import numpy as np
from scipy.interpolate import RBFInterpolator
from scipy.ndimage import map_coordinates
from shapely.geometry import Polygon, shape, mapping
from shapely.ops import unary_union
from PIL import Image

HERE = Path(__file__).resolve().parents[1]
RAW = HERE / 'data' / 'raw'
g = json.load(open(RAW / 'delisle-gcps.json'))
A = np.array(list(g.values()), float)
px, ll = A[:, :2], A[:, [3, 2]]                       # pixel x, y → lon, lat
fwd = RBFInterpolator(px, ll, kernel='thin_plate_spline', smoothing=40)
inv = RBFInterpolator(ll, px, kernel='thin_plate_spline', smoothing=.4)
# how far off a town is when it is left out
err = []
for i in range(len(A)):
    m = np.arange(len(A)) != i
    p = RBFInterpolator(px[m], ll[m], kernel='thin_plate_spline', smoothing=40)(px[i:i + 1])[0]
    err.append(math.hypot((p[0] - ll[i, 0]) * 111 * math.cos(math.radians(ll[i, 1])), (p[1] - ll[i, 1]) * 111))
print(f'placing Delisle: {len(A)} towns, {np.sqrt(np.mean(np.square(err))):.0f} km off when each is left out')

D = lambda pts: [tuple(x) for x in fwd(np.array(pts, float))]
# counter-clockwise from Derbent on the Caspian: the Caucasus westward, the Ottoman line south,
# the coasts east, the Mughal frontier north, Khorasan west, back over the Caspian
caucasus_ottoman = [(48.6, 42.25), (48.0, 41.95), (47.3, 41.75), (46.6, 41.95), (45.9, 42.25), (45.0, 42.5), (44.3, 42.55),
                    (43.7, 42.3), (43.55, 41.85), (43.3, 41.5), (43.55, 41.15), (43.7, 40.75), (43.6, 40.3), (44.2, 39.75),
                    (44.25, 39.35), (44.05, 38.95), (44.3, 38.35), (44.5, 37.75), (44.9, 37.15), (45.35, 36.6), (45.7, 35.9),
                    (45.7, 35.2), (45.6, 34.5), (46.0, 33.9), (46.6, 33.25), (47.3, 32.5), (47.7, 31.9), (47.85, 31.2),
                    (48.0, 30.7), (48.3, 30.0), (48.6, 29.0)]
sea_south = [(50.5, 27.0), (53.0, 25.8), (56.5, 25.6), (58.5, 24.8), (61.0, 24.6), (64.0, 24.4)]
mughal = D([(3705, 3375), (3690, 3120), (3810, 2820), (3825, 2580), (3870, 2400), (3690, 2070), (3570, 1920), (3120, 1914)])
# Khorasan's north: Delisle's lines here did not hold up once placed (they fell in the Karakum), so the
# documented edge: the Kopet Dagh from the Atrek, Sarakhs, and Merv held as an outpost
khorasan = [(63.3, 35.6), (63.0, 36.9), (62.6, 37.9), (61.6, 38.0), (60.9, 37.3), (60.2, 36.8), (59.2, 37.4), (58.2, 37.9), (57.0, 38.2), (55.8, 38.0)]
caspian = [(54.0, 37.35), (52.5, 38.3), (51.5, 40.0), (50.5, 41.5), (49.3, 42.4)]
ring = caucasus_ottoman + sea_south + mughal + khorasan + caspian
for name, pts in (('mughal', mughal), ('khorasan', khorasan)):
    print(name, ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts))
land = unary_union([shape(f['geometry']) for f in json.load(open(RAW / 'ne_50m_land.geojson'))['features'] if shape(f['geometry']).intersects(Polygon(ring))])
empire = Polygon(ring).buffer(0).intersection(land)
empire = max(getattr(empire, 'geoms', [empire]), key=lambda p: p.area) if empire.geom_type != 'Polygon' else empire
r4 = lambda o: json.loads(json.dumps(o), parse_float=lambda s: round(float(s), 3))
json.dump(r4({'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'geometry': mapping(empire.simplify(.02)), 'properties': {'id': 'safavid', 'az': 'Səfəvi dövləti', 'ru': 'Сефевидское государство', 'en': 'The Safavid empire', 'year': 1700}},
    {'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': mughal}, 'properties': {'segment': 'traced from Delisle 1724'}},
    {'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': khorasan}, 'properties': {'segment': 'Khorasan: the Kopet Dagh, Sarakhs and Merv'}},
    {'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': caucasus_ottoman}, 'properties': {'segment': 'Caucasus and the Zuhab (1639) line'}},
]}), open(HERE / 'data' / 'safavid-1700.geojson', 'w'))
print('area', round(empire.area * 111 * 111 * math.cos(math.radians(32))), 'km² (rough)')

# Delisle's map on the web map (Web Mercator), transparent outside the scan
W, E, S, N = 37.0, 76.0, 22.0, 46.0
WIDTH = 3000
merc = lambda la: math.log(math.tan(math.pi / 4 + math.radians(la) / 2))
HEIGHT = round(WIDTH * (merc(N) - merc(S)) / math.radians(E - W))
lons = np.linspace(W, E, WIDTH)
lats = np.degrees(2 * np.arctan(np.exp(np.linspace(merc(N), merc(S), HEIGHT))) - math.pi / 2)
LON, LAT = np.meshgrid(lons, lats)
P = inv(np.stack([LON.ravel(), LAT.ravel()], 1))
sx, sy = P[:, 0].reshape(LON.shape), P[:, 1].reshape(LON.shape)
Image.MAX_IMAGE_PIXELS = None
scan = np.asarray(Image.open(RAW / 'delisle-1724.jpg').convert('RGB')).astype(np.float32)
h, w = scan.shape[:2]
out = np.zeros((HEIGHT, WIDTH, 4), np.uint8)
for c in range(3):
    out[..., c] = np.clip(map_coordinates(scan[..., c], [sy, sx], order=1, mode='nearest'), 0, 255)
out[..., 3] = np.where((sx >= 40) & (sx < w - 40) & (sy >= 40) & (sy < h - 40), 255, 0)
Image.fromarray(out, 'RGBA').save(HERE / 'data' / 'delisle-1724.webp', quality=70, method=6)
json.dump({'source': "G. Delisle, «Carte de Perse», Paris 1724 (public domain), warped by Azad Bilik", 'coordinates': [[W, N], [E, N], [E, S], [W, S]]}, open(HERE / 'data' / 'delisle-1724.json', 'w'), indent=1)
print('scan', f'{WIDTH}×{HEIGHT}', (HERE / 'data' / 'delisle-1724.webp').stat().st_size // 1024, 'KB')

# The governorships (beglarbegiliks) north of the Araz, about 1700, as unions of the khanates traced
# from Tomkeev (../../xanliqlar): the khanates grew out of them, so their outlines are close but not
# the same. Talysh and Javad are left out (which governorship they answered to changed); Tabriz is a
# capital only, like the rest south of the Araz.
GROUPS = {
  'shirvan': (['shirvan', 'sheki', 'quba', 'baku'], ['Şirvan bəylərbəyiliyi', 'Ширванское беглербегство', 'Shirvan', 'Şamaxı'], '#B0563A'),
  'karabakh': (['karabakh', 'ganja', 'qazax'], ['Qarabağ (Gəncə) bəylərbəyiliyi', 'Карабахское (Гянджинское) беглербегство', 'Karabakh (Ganja)', 'Gəncə'], '#C9862B'),
  'chukhur-saad': (['erivan', 'nakhchivan'], ['Çuxursəəd bəylərbəyiliyi', 'Чухур-Саадское беглербегство', 'Chukhur-Saad', 'İrəvan'], '#4B5BA0'),
}
kh = {f['properties']['id']: shape(f['geometry']) for f in json.load(open(HERE.parent.parent / 'xanliqlar' / 'data' / 'khanates.geojson'))['features'] if f['properties'].get('kind') == 'area'}
fc = json.load(open(HERE / 'data' / 'safavid-1700.geojson'))
for gid, (members, names, colour) in GROUPS.items():
    u = unary_union([kh[m].buffer(.002) for m in members]).buffer(-.002)
    fc['features'].append({'type': 'Feature', 'geometry': r4(mapping(u.simplify(.005))), 'properties': {'id': gid, 'kind': 'province', 'az': names[0], 'ru': names[1], 'en': names[2], 'seat': names[3], 'color': colour, 'khanates': members}})
json.dump(fc, open(HERE / 'data' / 'safavid-1700.geojson', 'w'))
print('provinces', [f['properties']['id'] for f in fc['features'] if f['properties'].get('kind') == 'province'])
