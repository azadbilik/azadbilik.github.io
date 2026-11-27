#!/usr/bin/env python3
"""Place the 1886 villages: match each name to a populated place inside (or near) its 1897 uezd.

  data/villages-1886.csv              from merge.py
  data/raw/places.tsv                 candidate places: source, id, lat, lon, names (| separated, any script)
  ../1897/data/units.geojson          the uezd frame
  → data/geocode-1886.csv             village → place, score, how it was decided

Names are compared as a rough phonetic skeleton common to pre-reform Russian, modern Russian and
Azerbaijani Latin spelling (Карадаглу ≈ Qaradağlı ≈ Карадаглы). A village is taken when its best place
scores high and clearly above the next; otherwise the society decides: among close candidates, the one
nearest the society's other placed villages wins.

  python3 scripts/geocode.py
"""
import csv, json, math, re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.prepared import prep

HERE = Path(__file__).resolve().parents[1]
UEZD = {'Джевадский': 'Джеватский', 'Гёкчайский': 'Геокчайский'}

CYR = dict(zip('абвгдежзийклмнопрстуфхцчшщъыьэюяіѣѳёґ',
               ['a', 'b', 'v', 'g', 'd', 'e', 'zh', 'z', 'i', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'x', 'ts', 'ch', 'sh', 'sh', '', 'i', '', 'e', 'u', 'a', 'i', 'e', 'f', 'o', 'g']))
LAT = {'ə': 'a', 'ı': 'i', 'ü': 'u', 'ö': 'o', 'ş': 'sh', 'ç': 'ch', 'ğ': 'g', 'q': 'k', 'c': 'j', 'j': 'zh', 'w': 'v',
       'y': 'i', 'h': 'x', 'ä': 'a', 'é': 'e', 'â': 'a', 'î': 'i', 'û': 'u', 'ʻ': '', "'": '', '’': ''}
QUAL = r'\b(верхн\w*|нижн\w*|больш\w*|мал\w*|стар\w*|нов\w*|ново|ашага|юхары|орта|кичик|беюк|uly|yuxarı|aşağı|orta|kiçik|böyük|yeni|köhnə|\d+\s*-?\s*\w{0,2})\b'

def skel(s):
    s = s.lower().replace('ё', 'е')
    s = re.sub(QUAL, ' ', s)
    s = ''.join(CYR.get(c, LAT.get(c, c)) for c in s)
    s = re.sub(r'[^a-z]', '', s)
    s = s.replace('kh', 'x').replace('gh', 'g').replace('dzh', 'j').replace('zh', 'j').replace('ts', 's')
    s = re.sub(r'[eao]', 'a', s); s = re.sub(r'[iu]', 'i', s)   # vowels only by height; Russian а/я/е ≈ Az a/ə/e
    s = re.sub(r'(.)\1+', r'\1', s)
    s = re.sub(r'(li|lar)$', 'l', s)                           # -lı/-lu/-ли/-лы, -лар/-ляр
    return s

GENERIC = r'[-\s]?(кенд\w*|оба|кишлаг\w*|кишлак\w*|юрт\w*|кала|dorf)$'

QUALS = {'low': r'ашаг|нижн|aşağı|asagi|ashagy|ашагы', 'up': r'юхар|верхн|yuxarı|yukhary|yuxari|юхары', 'big': r'больш|беюк|böyük|boyuk|beyuk', 'small': r'мал[оы]|кичик|kiçik|kichik'}
OPP = {'low': 'up', 'up': 'low', 'big': 'small', 'small': 'big'}
def quals(names): return {q for q, rx in QUALS.items() for n in names if re.search(rx, n.lower())}
def qual_adjust(vq, pnames):
    pq = quals(pnames)
    return sum(.04 if q in pq else -.08 if OPP[q] in pq else 0 for q in vq)

def names_1886(name):
    name = re.sub(r'\((Временн|съ отс|с отс|отс)[^)]*\)', '', name)
    name = re.sub(r',\s*(коч|отд|отс|съ|хут|зимов|селен)\.?.*$', '', name).strip()
    out = [name, re.sub(GENERIC, '', re.sub(r'\([^)]*\)', '', name).strip())]
    for m in re.findall(r'\(([^)]+)\)', name): out.append(m)
    out.append(re.sub(r'\([^)]*\)', '', name))
    out += [p for p in re.split(r'[,;]|\bили\b', re.sub(r'\([^)]*\)', '', name)) if p.strip()]
    return [n for n in {skel(x) for x in out} if len(n) >= 3]

def km(a, b):
    return math.hypot((a[0] - b[0]) * 111, (a[1] - b[1]) * 111 * math.cos(math.radians(a[0])))

units = {f['properties']['key']: f for f in json.load(open(HERE.parent / '1897' / 'data' / 'units.geojson'))['features']}
frame = {k: prep(shape(f['geometry']).buffer(0.08)) for k, f in units.items()}
core = {k: prep(shape(f['geometry'])) for k, f in units.items()}

places = []
for r in csv.reader(open(HERE / 'data' / 'raw' / 'places.tsv'), delimiter='\t'):
    src, pid, lat, lon, nm = r
    sk = {s: n for n in nm.split('|') if n for s in [skel(n)] if len(s) >= 3}
    places.append((src, pid, float(lat), float(lon), nm.split('|')[0], sk))
by_uezd = defaultdict(list)
for p in places:
    pt = Point(p[3], p[2])
    for k, fr in frame.items():
        if fr.contains(pt): by_uezd[k].append(p)

vill = [r for r in csv.DictReader(open(HERE / 'data' / 'villages-1886.csv')) if r['kind'] == 'village']
cands = []
for v in vill:
    u = UEZD.get(v['uezd'], v['uezd'])
    vs = names_1886(v['name'])
    vq = quals([v['name']])
    sc = []
    for p in by_uezd.get(u, []):
        best = max(((SequenceMatcher(None, a, b).ratio(), b) for a in vs for b in p[5]), default=(0, ''))
        if best[0] >= .7: sc.append((round(min(1, best[0]) + (.03 if core[u].contains(Point(p[3], p[2])) else 0) + (qual_adjust(vq, p[5].values()) if vq else 0), 3), p, p[5][best[1]]))
    sc.sort(key=lambda x: -x[0])
    sc = [(s, p + (m,)) for s, p, m in sc]
    merged = []
    for s, p in sc:   # the same village from two sources, or twice in one: one candidate
        if not any(km(p[2:4], q[2:4]) < 4 for _, q in merged): merged.append((s, p))
    sc = merged
    cands.append(sc[:6])

# pass 1: clear winners
res: list = [None] * len(vill)
for i, sc in enumerate(cands):
    if sc and sc[0][0] >= .88 and (len(sc) == 1 or sc[0][0] - sc[1][0] >= .06 or km(sc[0][1][2:4], sc[1][1][2:4]) < 3):
        res[i] = (sc[0], 'name')
# pass 2: the society decides among close candidates
for _ in range(2):
    soc = defaultdict(list)
    for i, v in enumerate(vill):
        if res[i]: soc[(v['uezd'], v['society'])].append(res[i][0][1][2:4])
    for i, (v, sc) in enumerate(zip(vill, cands)):
        if res[i] or not sc: continue
        pts = soc.get((v['uezd'], v['society']))
        if not pts: continue
        c = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        near = [(s, p) for s, p in sc if s >= .8 and km(p[2:4], c) < 15]
        if near:
            near.sort(key=lambda x: (-round(x[0], 1), km(x[1][2:4], c)))
            res[i] = (near[0], 'society')

# pass 3: a village placed far from the rest of its society is re-decided by the society, or let go
def med(xs): xs = sorted(xs); return xs[len(xs) // 2]
for i, (v, sc) in enumerate(zip(vill, cands)):
    if not res[i]: continue
    pts = [res[j][0][1][2:4] for j, w in enumerate(vill) if j != i and res[j] and (w['uezd'], w['society']) == (v['uezd'], v['society'])]
    if len(pts) < 2: continue
    c = (med(p[0] for p in pts), med(p[1] for p in pts))
    if km(res[i][0][1][2:4], c) <= 25: continue
    near = [(s, p) for s, p in sc if s >= .8 and km(p[2:4], c) < 15]
    res[i] = (max(near, key=lambda x: x[0]), 'society') if near else None
# pass 3b: one place, one village. Where several villages took the same place (within 1.5 km), the best
# match keeps it; the others try their next candidates near their society, or let go.
for _ in range(3):
    taken = sorted([i for i in range(len(vill)) if res[i]], key=lambda i: (-res[i][0][0], res[i][1] != 'name'))
    kept, moved = [], 0
    for i in taken:
        here = res[i][0][1][2:4]
        if any(km(here, res[j][0][1][2:4]) < .3 for j in kept):
            v = vill[i]
            pts = [res[j][0][1][2:4] for j in kept if (vill[j]['uezd'], vill[j]['society']) == (v['uezd'], v['society'])]
            c = (med(p[0] for p in pts), med(p[1] for p in pts)) if pts else None
            alt = [(s, p) for s, p in cands[i] if s >= .85 and not any(km(p[2:4], res[j][0][1][2:4]) < .3 for j in kept) and (c is None or km(p[2:4], c) < 15)]
            res[i] = (alt[0], 'society') if alt else None
            moved += 1
            if res[i]: kept.append(i)
        else:
            kept.append(i)
    if not moved: break

# pass 3b': placements checked by hand against Kondratenko's 1886 maps (data/raw/geocode-hand.csv: the place
# the map supports where two same-named places were close calls; 'why' says what was read)
hand = {(r['uezd'], r['society'], r['no'], r['name']): r for r in csv.DictReader(open(HERE / 'data' / 'raw' / 'geocode-hand.csv'))}
for i, v in enumerate(vill):
    h = hand.get((v['uezd'], v['society'], v['no'], v['name']))
    if not h: continue
    pick = [(s, p) for s, p in cands[i] if km(p[2:4], (float(h['lat']), float(h['lon']))) < .5]
    assert pick, f'hand placement not among candidates: {v["name"]}'
    res[i] = (pick[0], 'hand')
assert len(hand) == sum(1 for r in res if r and r[1] == 'hand'), 'a hand placement matched no village'

# pass 3c: villages no gazetteer knows, read on Kondratenko's 1886 maps (data/raw/kondratenko-placed.csv):
# the village's own dot ('map', within ~2 km), or its rural society's printed number ('map-society', approximate)
onmap = {}
kp = {(r['uezd'], r['society'], r['no'], r['name']): r for r in csv.DictReader(open(HERE / 'data' / 'raw' / 'kondratenko-placed.csv'))}
for i, v in enumerate(vill):
    k = kp.get((v['uezd'], v['society'], v['no'], v['name']))
    if res[i] or not k or k['kind'] not in ('village', 'society') or not k['lat']: continue
    onmap[i] = (float(k['lat']), float(k['lon']), 'map' if k['kind'] == 'village' else 'map-society', k['label_read'])

# pass 3d: nomad groups (and a few villages) no 1886 source places, shown at the village that carries
# their name today (data/raw/geocode-named.csv): many of the Shirvan nomads settled where they wintered
named = {}
for r in csv.DictReader(open(HERE / 'data' / 'raw' / 'geocode-named.csv')):
    named[(r['uezd'], r['society'], r['no'], r['name'])] = r
for i, v in enumerate(vill):
    r = named.get((v['uezd'], v['society'], v['no'], v['name']))
    if r and not res[i] and i not in onmap: onmap[i] = (float(r['lat']), float(r['lon']), 'named', r['place'])

# pass 4: what is still unplaced goes to its society's middle, marked approximate
approx = {}
for i, v in enumerate(vill):
    if res[i] or i in onmap: continue
    pts = [res[j][0][1][2:4] for j, w in enumerate(vill) if res[j] and (w['uezd'], w['society']) == (v['uezd'], v['society'])]
    pts += [onmap[j][:2] for j, w in enumerate(vill) if j in onmap and onmap[j][2] == 'map' and (w['uezd'], w['society']) == (v['uezd'], v['society'])]
    if pts: approx[i] = (med(p[0] for p in pts), med(p[1] for p in pts))

with open(HERE / 'data' / 'geocode-1886.csv', 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['uezd', 'society', 'no', 'name', 'lat', 'lon', 'place', 'source', 'source_id', 'score', 'how', 'matched', 'alternatives'])
    for i, (v, r, sc) in enumerate(zip(vill, res, cands)):
        alt = '; '.join(f'{p[4]} {s}' for s, p in sc[:3])
        if r:
            (s, p), how = r
            w.writerow([v['uezd'], v['society'], v['no'], v['name'], round(p[2], 5), round(p[3], 5), p[4], p[0], p[1], s, how, p[6], alt])
        elif i in onmap:
            la, lo, how, lab = onmap[i]
            w.writerow([v['uezd'], v['society'], v['no'], v['name'], round(la, 5), round(lo, 5), lab, 'kondratenko' if how != 'named' else 'today', '', '', how, '', alt])
        elif i in approx:
            w.writerow([v['uezd'], v['society'], v['no'], v['name'], round(approx[i][0], 5), round(approx[i][1], 5), '', '', '', '', 'approx', '', alt])
        else:
            w.writerow([v['uezd'], v['society'], v['no'], v['name'], '', '', '', '', '', '', '', '', alt])
n = sum(1 for r in res if r)
print(f'{len(approx)} more approximately, at their society; on Kondratenko\'s maps {sum(1 for x in onmap.values() if x[2] == "map")} by their dot, {sum(1 for x in onmap.values() if x[2] == "map-society")} at their society;', end=' ')
print(f'{sum(1 for x in onmap.values() if x[2] == "named")} at today\'s namesake;', end=' ')
print(f'{n} of {len(vill)} placed ({sum(1 for r in res if r and r[1] == "name")} by name, {sum(1 for r in res if r and r[1] == "society")} by society, {sum(1 for r in res if r and r[1] == "hand")} checked by hand)')
per = defaultdict(lambda: [0, 0])
for v, r in zip(vill, res): per[v['uezd']][0] += 1; per[v['uezd']][1] += bool(r)
for k, (a, b) in sorted(per.items()): print(f'  {k}: {b}/{a}')
