#!/usr/bin/env python3
"""Merge the transcribed 1886 «Свод» spreads into one table of settlements, and check the printed totals.

  data/raw/svod-1886/pNNN.jsonl   one file per spread, as transcribed (see data/raw/svod-1886/BRIEF.md)
  → data/villages-1886.csv        one row per settlement (village or town), people and faith normalised
  → data/checks-1886.txt          every society / участок / уезд total compared with the sum of its villages

  python3 scripts/merge.py
"""
import csv, json, re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
RAW = HERE / 'data' / 'raw' / 'svod-1886'

# The table's column headings (and footnote meanings) → one name per people / faith.
PEOPLE = {
    'татары': 'tatar', 'армяне': 'armenian', 'талышинцы': 'talysh', 'таты': 'tat', 'курды': 'kurd',
    'кюринцы': 'lezgin', 'русскіе': 'russian', 'евреи': 'jew', 'гапутлинцы': 'shahdag', 'джекцы': 'shahdag',
    'крызцы': 'shahdag', 'будугцы': 'shahdag', 'персіяне': 'persian', 'грузины': 'georgian', 'удины': 'udi',
    'нѣмцы': 'german', 'поляки': 'polish', 'цыгане': 'roma',
    'греки': 'greek', 'имеретины': 'georgian',   # Borchali (Tiflis gov.)
    'талышины и татары': 'tatar',   # the Baku towns' table counts them together; the towns' Talysh are few
}
FAITH = [  # first match wins; matched against the footnote meaning if any, else the heading
    ('incl. shia', 'muslim'), ('и шіит', 'muslim'), ('арм', 'armenian'), ('шіит', 'shia'), ('суннит', 'sunni'), ('армяно', 'armenian'), ('григор', 'armenian'), ('правосл', 'orthodox'),
    ('старообр', 'sectarian'), ('молокан', 'sectarian'), ('суббот', 'sectarian'), ('прыгун', 'sectarian'),
    ('пригун', 'sectarian'), ('духобор', 'sectarian'), ('баптист', 'sectarian'), ('сектант', 'sectarian'),
    ('іуде', 'jewish'), ('католик', 'catholic'), ('лютеран', 'protestant'), ('протест', 'protestant'),
    ('али-аллах', 'ahl-e haqq'),
]

ESTATE = [  # first match wins (footnote meaning first, then heading)
    ('собствен', 'owners'), ('казен', 'state'), ('каз.', 'state'), ('владѣл', 'private'), ('влад', 'private'),
    ('духов', 'clergy'), ('купц', 'town'), ('мѣщан', 'town'), ('городск', 'town'),
    ('бек', 'noble'), ('мелик', 'noble'), ('дворян', 'noble'), ('двор.', 'noble'), ('высш', 'noble'), ('хан', 'noble'), ('агалар', 'noble'),
]

def estate_of(key):
    head, fn = split(key)
    for name in ((fn, head) if fn else (head,)):
        n = name.lower()
        for k, v in ESTATE:
            if k in n: return v
    return 'other'

def split(key):
    m = re.match(r'(.*?)\s*\[\s*\d+\)\s*(.*?)\s*\]$', key)
    return (m.group(1), m.group(2)) if m else (key, '')

def people_of(key):
    head, fn = split(key)
    for name in (fn, head):
        n = name.lower().strip(' .')
        for k, v in PEOPLE.items():
            if n.startswith(k): return v
    return 'other'

def faith_of(key):
    head, fn = split(key)
    for name in ((fn, head) if fn else (head,)):
        n = name.lower()
        for k, v in FAITH:
            if k in n: return v
    return 'other'

def nums(v, n):
    v = (list(v) + [None] * n)[:n] if isinstance(v, list) else [None] * n
    return [int(x) if isinstance(x, (int, float)) else 0 for x in v]

objs = []
for f in sorted(RAW.glob('p*.jsonl'), key=lambda f: int(f.stem[1:])):
    for line in f.read_text().splitlines():
        if line.strip():
            o = json.loads(line)
            if 'header' not in o: objs.append({**o, 'spread': o.get('p') or int(f.stem[1:])})

# Tiflis governorate volume (Borchali): an unmarked «Прочія …» / estate cell continues the footnote mark
# printed nearest above it in the same column on the same page (checked against every society's totals).
# Carry that mark down before anything else; the Baku/Elisabethpol pages keep the society rule below.
CARRY_GOV = {'Тифлисская'}
last_mark = {}
for o in objs:
    if o.get('gov') not in CARRY_GOV or o.get('kind') not in ('village', 'society', 'other'): continue
    for grp in ('people', 'faith', 'estate'):
        cells = o.get(grp) or {}
        out = {}
        for key, v in cells.items():
            head, fn = split(key)
            slot = (o['spread'], grp, head)
            if fn: last_mark[slot] = key
            elif slot in last_mark and head.lower().startswith(('проч', 'врем', 'духов', 'сектант')):
                key = last_mark[slot]
            out[key] = [a + b for a, b in zip(out[key], v)] if key in out else v
        if cells: o[grp] = out

# A «Прочія …» cell is often footnoted only on its society's line ("3) Удины"); the villages under it
# print the bare heading. Such a village cell takes the society's meaning.
marks = defaultdict(set)
for o in objs:
    if o.get('kind') == 'society':
        for grp in ('people', 'faith'):
            for key in (o.get(grp) or {}):
                head, fn = split(key)
                if fn: marks[(o.get('uezd'), o.get('society'), grp, head)].add(key)
def explain(o, grp, key):
    head, fn = split(key)
    if fn or not head.lower().startswith(('проч', 'сектант')): return key
    m = marks.get((o.get('uezd'), o.get('society'), grp, head), set())
    return next(iter(m)) if len(m) == 1 else key

rows, totals = [], []
for o in objs:
        k = o.get('kind')
        if k in ('village', 'town'):
            ppl, fth = defaultdict(lambda: [0, 0, 0]), defaultdict(lambda: [0, 0])
            for key, v in (o.get('people') or {}).items():
                key = explain(o, 'people', key)
                a = nums(v, 3) if not (isinstance(v, list) and len(v) == 2) else [0] + nums(v, 2)   # towns' tables: [m, f]
                p = ppl[people_of(key)]
                for i in range(3): p[i] += a[i]
            for key, v in (o.get('faith') or {}).items():
                key = explain(o, 'faith', key)
                a = nums(v, 2); p = fth[faith_of(key)]
                for i in range(2): p[i] += a[i]
            est = defaultdict(lambda: [0, 0])
            for key, v in (o.get('estate') or {}).items():
                a = nums(v, 3) if isinstance(v, list) and len(v) == 3 else [0] + nums(v, 2)   # [hh, m, f] or [m, f]
                e = est[estate_of(key)]; e[0] += a[1]; e[1] += a[2]
            rows.append({**o, 'people_n': dict(ppl), 'faith_n': dict(fth), 'estate_n': dict(est)})
        elif k in ('society', 'uch', 'uezd'):
            totals.append(o)

# Rows split across spreads: a village whose society came on the previous spread
last = None
for r in rows:
    if r['kind'] == 'village' and not r.get('society') and last and last.get('uezd') == r.get('uezd'):
        r['society'] = last.get('society'); r['society_from_prev'] = True
    last = r

PEOPLE_COLS = ['tatar', 'armenian', 'talysh', 'tat', 'kurd', 'lezgin', 'russian', 'jew', 'shahdag', 'persian', 'georgian', 'greek', 'udi', 'german', 'polish', 'roma', 'other']
ESTATE_COLS = ['state', 'private', 'owners', 'noble', 'clergy', 'town', 'other']
FAITH_COLS = ['shia', 'sunni', 'muslim', 'armenian', 'orthodox', 'sectarian', 'jewish', 'catholic', 'protestant', 'ahl-e haqq', 'other']
out = HERE / 'data' / 'villages-1886.csv'
with open(out, 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['gov', 'uezd', 'uch', 'society', 'no', 'name', 'kind', 'seat', 'd_uezd', 'd_prist', 'hh', 'm', 'f', 'total']
               + [f'pp_{p}_{x}' for p in PEOPLE_COLS for x in ('hh', 'm', 'f')] + [f'fa_{p}_{x}' for p in FAITH_COLS for x in ('m', 'f')] + [f'es_{p}_{x}' for p in ESTATE_COLS for x in ('m', 'f')]
               + ['spread', 'note'])
    for r in rows:
        w.writerow([r.get('gov'), r.get('uezd'), r.get('uch'), r.get('society'), r.get('no'), r.get('name'), r['kind'],
                    int(bool(r.get('seat'))), r.get('d_uezd'), r.get('d_prist'), r.get('hh'), r.get('m'), r.get('f'), r.get('total')]
                   + [r['people_n'].get(p, [0, 0, 0])[i] or '' for p in PEOPLE_COLS for i in range(3)]
                   + [r['faith_n'].get(p, [0, 0])[i] or '' for p in FAITH_COLS for i in range(2)]
                   + [r['estate_n'].get(p, [0, 0])[i] or '' for p in ESTATE_COLS for i in range(2)]
                   + [r['spread'], r.get('note', '')])

# Checks: each printed total vs the villages under it
def s(rs, k): return sum(r.get(k) or 0 for r in rs)
vill = [r for r in rows if r['kind'] == 'village']
lines, bad = [], 0
for t in totals:
    if t['kind'] == 'society':
        if t.get('hh') is None: continue
        under = [r for r in vill if r.get('uezd') == t.get('uezd') and r.get('society') == t.get('society')]
    elif t['kind'] == 'uch':
        under = [r for r in vill if r.get('uezd') == t.get('uezd') and r.get('uch') == t.get('uch')]
    else:
        under = [r for r in vill if r.get('uezd') == t.get('uezd')]
    got = [s(under, k) for k in ('hh', 'm', 'f')]
    want = [t.get(k) for k in ('hh', 'm', 'f')]
    ok = got == want
    bad += not ok
    lines.append(f"{'ok ' if ok else 'BAD'} {t['kind']:7} {t.get('uezd')} / {t.get('uch')} / {t.get('society') or t.get('name')}: printed {want}, villages {got} ({len(under)})  p{t['spread']}")
(HERE / 'data' / 'checks-1886.txt').write_text('\n'.join(lines) + '\n')

by = defaultdict(lambda: [0, 0, 0])
for r in vill:
    b = by[(r.get('gov'), r.get('uezd'))]; b[0] += 1; b[1] += r.get('m') or 0; b[2] += r.get('f') or 0
for k, v in sorted(by.items(), key=lambda x: (x[0][0] or '', x[0][1] or '')): print(*k, v)
print(len(vill), 'villages,', sum(r['kind'] == 'town' for r in rows), 'town rows;', len(totals), 'totals,', bad, 'differ (data/checks-1886.txt)')
