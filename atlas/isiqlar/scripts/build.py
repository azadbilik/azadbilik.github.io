# Builds data/hex.geojson for «Işıqlar»: where people live in both Azerbaijans, as H3 hexagons.
# Source: Kontur Population (2023-11-01), people per 400 m H3 hexagon (resolution 8), CC BY 4.0:
# https://data.humdata.org/dataset/kontur-population-azerbaijan and …-iran-islamic-republic-of
# (data/raw/*.gpkg, git-ignored). Kept: the Republic of Azerbaijan, and in Iran the four Azerbaijani
# provinces (East and West Azerbaijan, Ardabil, Zanjan: the counties on the population map, ../ehali).
# Merged one level up (resolution 7, about 5 km²) so the page stays light.
#   python scripts/build.py      (h3, shapely)
import json, sqlite3
from pathlib import Path
import h3
from shapely.geometry import shape, Point
from shapely.ops import unary_union
from shapely.prepared import prep

HERE = Path(__file__).resolve().parents[1]
RAW = HERE / 'data' / 'raw'
units = json.load(open(HERE.parent / 'ehali' / 'data' / 'units.geojson'))['features']
iran = prep(unary_union([shape(f['geometry']).buffer(0) for f in units if f['properties']['country'] == 'ir']).buffer(.01))
cells = {}
for country, f in (('az', 'kontur_AZ.gpkg'), ('ir', 'kontur_IR.gpkg')):
    for h, pop in sqlite3.connect(RAW / f).execute('SELECT h3, population FROM population'):
        if country == 'ir':
            lat, lon = h3.cell_to_latlng(h)
            if not iran.contains(Point(lon, lat)): continue
        p = h3.cell_to_parent(h, 7)
        c = cells.setdefault((p, country), [0, country]); c[0] += pop
# the district or county each hexagon's centre falls in, for its card
from shapely.strtree import STRtree
ushapes = [shape(f['geometry']).buffer(0) for f in units]
tree = STRtree(ushapes)
names = [[f['properties']['az'], f['properties']['ru'], f['properties']['en']] for f in units]
def unit_of(h):
    lat, lon = h3.cell_to_latlng(h); pt = Point(lon, lat)
    for i in tree.query(pt):
        if ushapes[i].contains(pt): return int(i)
    return -1
feats = []
for (h, _), (pop, country) in cells.items():
    if pop < 25: continue   # near-empty cells (a few herders' huts) left out
    ring = [[round(lon, 3), round(lat, 3)] for lat, lon in h3.cell_to_boundary(h)]
    ring.append(ring[0])
    area = h3.cell_area(h, 'km^2')
    feats.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [ring]}, 'properties': {'p': round(pop), 'd': round(pop / area), 'c': country, 'u': unit_of(h)}})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(HERE / 'data' / 'hex.geojson', 'w'), separators=(',', ':'))
json.dump(names, open(HERE / 'data' / 'names.json', 'w'), ensure_ascii=False, separators=(',', ':'))
tot = {c: sum(f['properties']['p'] for f in feats if f['properties']['c'] == c) for c in ('az', 'ir')}
print(len(feats), 'hexagons;', {c: f'{v:,}' for c, v in tot.items()}, (HERE / 'data' / 'hex.geojson').stat().st_size // 1024, 'KB')
print('densest', sorted((f['properties']['d'] for f in feats), reverse=True)[:5])
