# Cuts each khanate out of the land, along the borders traced from Tomkeev's 1901 map.
#  1. The scan is placed on the earth by the towns in data/raw/gcps.json (pixel x, y → lat, lon; a
#     second-order polynomial, about 2.6 km off when each town is left out in turn).
#  2. The traced lines (data/raw/lines-px.json) become lon/lat; each end is carried to the nearest
#     other border, river or coast so the lines close.
#  3. The land is the 1897 uezds of the Erivan, Elisabethpol and Baku governorates, the Zaqatala okrug,
#     Borchalo and Kyura uezds (RISTAT, CC0): it gives the coast and the outer borders. The Kura (above its
#     meeting with the Araz at Javad; the map draws no border along it below) and the Araz (below Sharur;
#     above, Erivan's Surmali lies across it), both from the rivers map (OpenStreetMap), are borders too.
#  4. Each khanate traced in data/khanates.json ("trace": true) is the piece of land around its capital.
#     The polities drawn from 1897 uezds ("uezds") are those uezds less the traced khanates.
# Writes data/raw/areas.geojson (with each area's source) and data/raw/borders-1801-1813.geojson (the
# traced lines in lon/lat). Checks each traced khanate gets its own piece.
#   python scripts/trace/cut.py      (numpy, shapely, pyproj)
import json
from pathlib import Path
import numpy as np
from pyproj import Geod
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import nearest_points, unary_union

HERE = Path(__file__).resolve().parents[2]
RAW, ATLAS = HERE / 'data' / 'raw', HERE.parent
km2 = lambda g: abs(Geod(ellps='WGS84').geometry_area_perimeter(g)[0]) / 1e6

# 1. pixel → lon/lat
g = json.load(open(RAW / 'gcps.json'))
A = np.array([v for k, v in g.items() if not k.startswith('_')], float)
px, py, lat, lon = A.T
def design(x, y):
    x = (np.asarray(x, float) - 3200) / 1000; y = (np.asarray(y, float) - 2800) / 1000
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)
CL = np.linalg.lstsq(design(px, py), lon, rcond=None)[0]
CA = np.linalg.lstsq(design(px, py), lat, rcond=None)[0]
def lonlat(pts):
    p = np.asarray(pts, float); d = design(p[:, 0], p[:, 1]); return np.stack([d @ CL, d @ CA], 1)
loo = []
for i in range(len(A)):
    m = np.arange(len(A)) != i
    cl = np.linalg.lstsq(design(px[m], py[m]), lon[m], rcond=None)[0]; ca = np.linalg.lstsq(design(px[m], py[m]), lat[m], rcond=None)[0]
    d = design(px[i:i + 1], py[i:i + 1])[0]
    loo.append(np.hypot((d @ cl - lon[i]) * 85, (d @ ca - lat[i]) * 111))
print(f'placing the map: {len(A)} towns, {np.sqrt(np.mean(np.square(loo))):.1f} km off when each is left out')

# 3. the land and the rivers
uz = json.load(open(ATLAS / '1897' / 'data' / 'raw' / 'uyezds-1897.geojson'))['features']
PROV = ('Эриванская', 'Елисаветпольская', 'Бакинская'); EXTRA = ('Закатальский', 'Борчалинский', 'Кюринский')
land = unary_union([shape(f['geometry']).buffer(0) for f in uz if f['properties']['prov_RU'].startswith(PROV) or f['properties']['Name_RU'] in EXTRA])
JAVAD = 48.47   # the Kura is a border down to Javad
SHARUR = 44.75  # the Araz is one from Sharur down: above it Erivan holds Surmali on both banks
rivers = unary_union([
    shape(f['geometry']).intersection(box(40, 30, JAVAD, 45) if f['properties']['az'] == 'Kür' else box(SHARUR, 30, 52, 45))
    for f in json.load(open(ATLAS / 'hovze' / 'data' / 'rivers.geojson'))['features'] if f['properties']['az'] in ('Kür', 'Araz')])

# 2. the traced lines, closed onto their neighbours
lines = {k: LineString(lonlat(v)).simplify(0.001) for k, v in json.load(open(RAW / 'lines-px.json')).items()}
def closed(k, l):
    c = list(l.coords)
    others = unary_union([v for kk, v in lines.items() if kk != k] + [rivers, land.boundary])
    for i in (0, -1):
        q = nearest_points(Point(c[i]), others)[1].coords[0]
        if Point(c[i]).distance(Point(q)) < 0.12:      # up to ~10 km
            v = np.subtract(q, c[i]); n = np.linalg.norm(v) or 1
            q2 = tuple(np.add(q, v / n * 0.006))        # a little past, so the lines cross
            c = [q2] + c if i == 0 else c + [q2]
    return LineString(c)
lines = {k: closed(k, l) for k, l in lines.items()}

# 4. the pieces
pieces = land.difference(unary_union(list(lines.values()) + [rivers]).buffer(0.003))
pieces = list(getattr(pieces, 'geoms', [pieces]))
table = json.load(open(HERE / 'data' / 'khanates.json'))['khanates']
traced = [k for k in table if k.get('trace')]
got, seen = {}, {}
for k in traced:
    hit = [p for p in pieces if p.contains(Point(k['capital']))]
    if len(hit) != 1: raise SystemExit(f"{k['id']}: its capital is in {len(hit)} pieces")
    if id(hit[0]) in seen: raise SystemExit(f"{k['id']} and {seen[id(hit[0])]} share a piece: a border is open")
    seen[id(hit[0])] = k['id']; got[k['id']] = hit[0]
# grow each back over the 600 m strip the borders took
areas = {}
for k in traced:
    areas[k['id']] = (got[k['id']].buffer(0.0035).intersection(land).difference(unary_union(list(areas.values())))).buffer(0)
# a short spur where a line overshoots a waypoint can ring off a speck: fill holes under 50 km²
from shapely.geometry import Polygon, MultiPolygon
def filled(g):
    ps = [Polygon(p.exterior, [r for r in p.interiors if km2(Polygon(r)) > 50]) for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon']
    return MultiPolygon(ps) if len(ps) > 1 else ps[0]
areas = {k: filled(a) for k, a in areas.items()}
all_traced = unary_union(list(areas.values()))
src = {k['id']: 'tomkeev-1901' for k in traced}
for k in table:
    if k.get('uezds'):
        u = unary_union([shape(f['geometry']).buffer(0) for f in uz if f['properties']['Name_RU'] in k['uezds']])
        areas[k['id']] = u.difference(all_traced).buffer(0); src[k['id']] = '1897'
for k, a in areas.items():
    print(f'  {k:11s} {km2(a):7.0f} km²  ({src[k]})')
left = [p for p in pieces if id(p) not in seen and km2(p) > 300]
print('land the map leaves to no khanate drawn here:', ', '.join(f'{km2(p):.0f} km² at {p.representative_point().y:.2f}N {p.representative_point().x:.2f}E' for p in sorted(left, key=km2, reverse=True)))

r4 = lambda geom: json.loads(json.dumps(mapping(geom.simplify(0.0008)), default=float), parse_float=lambda s: round(float(s), 4))
json.dump({'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'id': k, 'from': src[k]}, 'geometry': r4(a)} for k, a in areas.items()]},
    open(RAW / 'areas.geojson', 'w'))
json.dump({'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'edge': k}, 'geometry': r4(l)} for k, l in lines.items()]},
    open(RAW / 'borders-1801-1813.geojson', 'w'))
