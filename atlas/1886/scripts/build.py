#!/usr/bin/env python3
"""Build what the 1886 page reads, from the merged table and the placements.

  data/villages-1886.csv + data/geocode-1886.csv → data/villages.geojson (one point per placed village or town)
                                                 → data/summary.json (totals by uezd, people and faith; the unplaced)
  python3 scripts/build.py
"""
import csv, json, re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
UEZD = {'Джевадский': 'Джеватский', 'Гёкчайский': 'Геокчайский'}   # 1886 spelling → the 1897 frame's key
PEOPLE = ['tatar', 'armenian', 'talysh', 'tat', 'kurd', 'lezgin', 'russian', 'jew', 'shahdag', 'persian', 'georgian', 'udi', 'german', 'polish', 'roma', 'other']
FAITH = ['shia', 'sunni', 'muslim', 'armenian', 'orthodox', 'sectarian', 'jewish', 'catholic', 'protestant', 'ahl-e haqq', 'other']
TOWNS = {  # the towns of the two governorates, 1886
    'Елисаветополь': (40.6828, 46.3606), 'Нуха': (41.1919, 47.1706), 'Шуша': (39.7600, 46.7500), 'Баку': (40.3667, 49.8352),
    'Куба': (41.3611, 48.5134), 'Ленкорань': (38.7529, 48.8475), 'Шемаха': (40.6314, 48.6414), 'Гёкчай': (40.6500, 47.7400),
    'Сальяны': (39.5961, 48.9847),
}
TOWN_NAMES = {  # az, ru, en
    'Елисаветополь': ('Yelizavetpol (Gəncə)', 'Елисаветполь', 'Elisabethpol (Ganja)'), 'Нуха': ('Nuxa (Şəki)', 'Нуха', 'Nukha (Shaki)'),
    'Шуша': ('Şuşa', 'Шуша', 'Shusha'), 'Баку': ('Bakı', 'Баку', 'Baku'), 'Куба': ('Quba', 'Куба', 'Quba'),
    'Ленкорань': ('Lənkəran', 'Ленкорань', 'Lankaran'), 'Шемаха': ('Şamaxı', 'Шемаха', 'Shamakhi'),
    'Гёкчай': ('Göyçay', 'Гёкчай', 'Goychay'), 'Сальяны': ('Salyan', 'Сальяны', 'Salyan'),
}

def n(x): return int(x) if x not in ('', None) else 0

rows = list(csv.DictReader(open(HERE / 'data' / 'villages-1886.csv')))
geo = {(r['uezd'], r['society'], r['no'], r['name']): r for r in csv.DictReader(open(HERE / 'data' / 'geocode-1886.csv'))}

def counts(r):
    p = {k: n(r[f'pp_{k}_m']) + n(r[f'pp_{k}_f']) for k in PEOPLE}
    f = {k: n(r[f'fa_{k}_m']) + n(r[f'fa_{k}_f']) for k in FAITH}
    return {k: v for k, v in p.items() if v}, {k: v for k, v in f.items() if v}

feats, unplaced = [], defaultdict(lambda: [0, 0])
tot = {'people': defaultdict(int), 'faith': defaultdict(int), 'uezd': defaultdict(lambda: {'villages': 0, 'placed': 0, 'approx': 0, 'pop': 0, 'people': defaultdict(int), 'faith': defaultdict(int)})}
for r in rows:
    if r['kind'] != 'village': continue
    p, f = counts(r)
    pop = n(r['m']) + n(r['f'])
    u = UEZD.get(r['uezd'], r['uezd'])
    U = tot['uezd'][u]; U['villages'] += 1; U['pop'] += pop
    for k, v in p.items(): tot['people'][k] += v; U['people'][k] += v
    for k, v in f.items(): tot['faith'][k] += v; U['faith'][k] += v
    g = geo.get((r['uezd'], r['society'], r['no'], r['name']))
    if not g or not g['lat']:
        unplaced[u][0] += 1; unplaced[u][1] += pop
        continue
    approx = g['how'] == 'approx'
    U['placed'] += 1; U['approx'] += approx
    props = {'n': r['name'], 's': r['society'], 'u': u, 'no': n(r['no']) or None, 't': pop, 'h': n(r['hh']), 'p': p, 'f': f, 'sp': n(r['spread'])}
    if approx: props['a'] = 1
    elif g['place']: props['today'] = g['place']
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [float(g['lon']), float(g['lat'])]}, 'properties': props})

# Towns: people from the first table that has them, faith from the next
towns = {}
for r in rows:
    if r['kind'] != 'town': continue
    key = re.split(r'[,\s]', r['name'])[0]
    t = towns.setdefault(key, {'gov': r['gov'], 'p': {}, 'f': {}, 't': 0, 'sp': n(r['spread'])})
    p, f = counts(r)
    if p and not t['p']: t['p'] = p; t['t'] = n(r['m']) + n(r['f']) or n(r['total'])
    if f and not t['f']: t['f'] = f
for key, t in towns.items():
    if key not in TOWNS: print('no position for town', key); continue
    lat, lon = TOWNS[key]
    feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                  'properties': {'n': key, **{f'n_{l}': x for l, x in zip(('az', 'ru', 'en'), TOWN_NAMES[key])}, 'town': 1, 't': t['t'], 'p': t['p'], 'f': t['f'], 'sp': t['sp']}})
    for k, v in t['p'].items(): tot['people'][k] += v
    for k, v in t['f'].items(): tot['faith'][k] += v

for ft in feats:   # the largest people and faith, for colouring
    pr = ft['properties']
    if pr['p']: pr['tp'] = max(pr['p'], key=pr['p'].get)
    if pr['f']: pr['tf'] = max(pr['f'], key=pr['f'].get)
out = HERE / 'data' / 'villages.geojson'
out.write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, ensure_ascii=False, separators=(',', ':')))
summary = {'people': dict(sorted(tot['people'].items(), key=lambda x: -x[1])), 'faith': dict(sorted(tot['faith'].items(), key=lambda x: -x[1])),
           'uezd': {k: {**v, 'people': dict(v['people']), 'faith': dict(v['faith']), 'unplaced': unplaced[k][0], 'unplacedPop': unplaced[k][1]} for k, v in tot['uezd'].items()},
           'towns': {k: v['t'] for k, v in towns.items()}}
(HERE / 'data' / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1))
print(len(feats), 'points,', out.stat().st_size // 1024, 'KB;', sum(v[0] for v in unplaced.values()), 'villages unplaced,', sum(v[1] for v in unplaced.values()), 'people in them')
print('people:', summary['people']); print('faith:', summary['faith'])
