"""Builds the galaxy's data from the cached embeddings.

  EMBED_DIR=~/.local/share/azadbilik-embed MODEL=bge-m3 python scripts/build.py [--nn 30] [--md 0.15] [--eval]

Reads  $EMBED_DIR/works.jsonl + emb-<MODEL>.npy
Writes data/galaxy.json (what a point is), data/pos.bin (uint16 x,y per work), data/knn.bin (10 nearest
works by cosine in the full embedding space, uint16 each), data/knnx.bin (the same, other authors only), data/sims*.bin and data/lines-<k>.json (first lines, 5000 works per file).
With --eval it only reports how well each UMAP setting keeps the full-space neighbourhoods (and writes nothing).
"""
import json, os, re, sys, argparse, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--nn', type=int, default=30); ap.add_argument('--md', type=float, default=0.15)
ap.add_argument('--eval', action='store_true')
args = ap.parse_args()
D = os.environ.get('EMBED_DIR', os.path.expanduser('~/.local/share/azadbilik-embed'))
MODEL = os.environ.get('MODEL', 'bge-m3')
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'data')
os.makedirs(OUT, exist_ok=True)
rows = [json.loads(l) for l in open(f'{D}/works.jsonl')]
E = np.load(f'{D}/emb-{MODEL}.npy').astype(np.float32)
assert len(rows) == len(E)
N = len(rows)

# nearest neighbours in the full space (exact, cosine = dot of unit vectors): any work, and works by other authors
K = 10
au = np.array([r['a'] for r in rows])
def nearest(other_authors):
    nn = np.zeros((N, K), np.int32); sim = np.zeros((N, K), np.float32)
    for s in range(0, N, 2000):
        S = E[s:s + 2000] @ E.T
        S[np.arange(S.shape[0]), np.arange(s, s + S.shape[0])] = -2
        if other_authors: S[au[s:s + 2000, None] == au[None, :]] = -2
        idx = np.argpartition(-S, K, axis=1)[:, :K]
        sv = np.take_along_axis(S, idx, 1); o = np.argsort(-sv, 1)
        nn[s:s + 2000] = np.take_along_axis(idx, o, 1); sim[s:s + 2000] = np.take_along_axis(sv, o, 1)
    return nn, sim
knn, ksim = nearest(False)
knnx, ksimx = nearest(True)

import umap
def project(nn, md):
    t = time.time()
    xy = umap.UMAP(n_neighbors=nn, min_dist=md, metric='cosine', random_state=42, low_memory=True).fit_transform(E)
    print(f'umap nn={nn} md={md}: {time.time() - t:.0f}s', flush=True)
    return xy

def keep(xy, n=3000):
    """Share of a work's 10 nearest (full space) that are among its 10 nearest in 2D"""
    rng = np.random.default_rng(0); pick = rng.choice(N, n, replace=False); tot = 0
    for i in pick:
        d = ((xy - xy[i]) ** 2).sum(1); d[i] = 9e9
        near = np.argpartition(d, K)[:K]; tot += len(set(near) & set(knn[i]))
    return tot / (n * K)

if args.eval:
    for nn, md in [(10, .1), (30, .15), (60, .2), (100, .3)]:
        xy = project(nn, md); print(f'  neighbourhood kept: {keep(xy):.3f}', flush=True)
        np.save(f'{D}/xy-{MODEL}-{nn}.npy', xy)
    sys.exit()

xy = project(args.nn, args.md)
print('neighbourhood kept', round(keep(xy), 3))
# robust fit into 0..65535 (clip the 0.05% farthest), then a little margin
lo = np.percentile(xy, 0.05, axis=0); hi = np.percentile(xy, 99.95, axis=0)
sc = (hi - lo).max()
q = np.clip((xy - lo) / sc, 0, 1)
q16 = np.round(q * 65535).astype(np.uint16)
open(f'{OUT}/pos.bin', 'wb').write(q16.tobytes())          # x0,y0,x1,y1 … little endian
open(f'{OUT}/knn.bin', 'wb').write(knn.astype(np.uint16).tobytes())
open(f'{OUT}/knnx.bin', 'wb').write(knnx.astype(np.uint16).tobytes())
open(f'{OUT}/simsx.bin', 'wb').write(np.clip(np.round(ksimx * 255), 0, 255).astype(np.uint8).tobytes())
open(f'{OUT}/sims.bin', 'wb').write(np.clip(np.round(ksim * 255), 0, 255).astype(np.uint8).tobytes())   # cosine of each neighbour, /255
print('aspect', (hi - lo) / sc)

# ---- the table
LANG = ['AZ_LATIN', 'FA', 'AZ_ARABIC', 'RU', 'DE', 'AR', 'EN', 'TR', 'AZ_CYRILLIC']
GEN = ['ghazal', 'masnavi', 'rubai', 'qasida', 'verse', 'prose', 'play', 'essay', 'letter', 'memoir']   # verse = other poems
def gen(r):
    if r['g'] == 'POEM': return {'GHAZAL': 0, 'MASNAVI': 1, 'RUBAI': 2, 'QASIDA': 3}.get(r['f'], 4)
    return {'PROSE': 5, 'PLAY': 6, 'ESSAY': 7, 'PHILOSOPHY': 7, 'LETTER': 8, 'MEMOIR': 9}[r['g']]
authors, aidx = [], {}
for r in rows:
    if r['a'] not in aidx:
        aidx[r['a']] = len(authors)
        authors.append({'s': r['a'], 'az': r['an'], 'ru': r['anr'], 'en': r['ane'], 'b': r['b']})
works = {'s': [], 't': [], 'a': [], 'y': [], 'g': [], 'l': [], 'w': [], 'e': []}
for r in rows:
    # the work's own year; else its author's birth year + 30 (flagged e=1: an estimate)
    y, e = (r['y'], 0) if r['y'] else ((r['b'] + 30, 1) if r['b'] else (0, 0))
    works['s'].append(r['slug']); works['t'].append(r['t']); works['a'].append(aidx[r['a']])
    works['y'].append(y); works['e'].append(e); works['g'].append(gen(r))
    works['l'].append(LANG.index(r['l'])); works['w'].append(r['wc'])
meta = {'built': time.strftime('%Y-%m-%d'), 'n': N, 'model': 'BAAI/bge-m3', 'nn': args.nn, 'md': args.md,
        'langs': LANG, 'genres': GEN, 'authors': authors, 'works': works}
with open(f'{OUT}/galaxy.json', 'w') as f: json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))

# ---- first lines, in shards (the page fetches a shard when a card opens)
def clean(s):
    s = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', s); s = re.sub(r'\[\^[^\]]*\]|<[^>]+>|[#*_>`~|]+', '', s)
    return s
def first(txt, n=120):
    out = ''
    for ln in clean(txt).split('\n'):
        ln = ln.strip()
        if not ln: continue
        out = (out + ' / ' + ln) if out else ln
        if len(out) >= 60: break
    return out if len(out) <= n else out[:n].rsplit(' ', 1)[0] + '…'
SH = 5000
for k in range(0, N, SH):
    json.dump([first(r['txt'][:600]) for r in rows[k:k + SH]], open(f'{OUT}/lines-{k // SH}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(f'{OUT}/{f}'))
