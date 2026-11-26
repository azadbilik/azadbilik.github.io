"""Embeds every visible work of the kitabxana.az library with a multilingual model.

Input : $EMBED_DIR/works.jsonl (made by scripts/export.sh)
Output: $EMBED_DIR/emb-<model>.npy (float16, one row per line of works.jsonl), cached outside git.

A short text is embedded whole (first 1,600 characters); a long one as the mean of three chunks
of 1,600 characters taken at 0%, 40% and 75% of the text.
"""
import json, os, re, sys, time
import numpy as np
from sentence_transformers import SentenceTransformer

D = os.environ.get('EMBED_DIR', os.path.expanduser('~/.local/share/azadbilik-embed'))
MODEL = os.environ.get('MODEL', 'BAAI/bge-m3')
PRE = 'passage: ' if 'e5' in MODEL else ''
CH = 1600
tag = MODEL.split('/')[-1]

def clean(s):
    s = re.sub(r'\[\^[^\]]*\]\S*|<[^>]+>|[#*_>`~|]+|!?\[([^\]]*)\]\([^)]*\)', lambda m: m.group(1) or ' ', s)
    return re.sub(r'[ \t]+', ' ', re.sub(r'\n{2,}', '\n', s)).strip()

def chunks(txt):
    txt = clean(txt)
    if len(txt) <= CH * 1.5: return [txt[:CH] or '.']
    return [txt[int(len(txt) * f):][:CH] for f in (0, .4, .75)]

rows = [json.loads(l) for l in open(f'{D}/works.jsonl')]
flat, owner = [], []
for i, r in enumerate(rows):
    for c in chunks(r['txt']): flat.append(PRE + c); owner.append(i)
print(len(rows), 'works', len(flat), 'chunks', flush=True)
order = np.argsort([len(x) for x in flat])      # similar lengths batch together
m = SentenceTransformer(MODEL, device='mps'); m.max_seq_length = 512; m.half()
out = np.zeros((len(flat), m.get_sentence_embedding_dimension()), np.float32)
t = time.time(); B = 2048
for s in range(0, len(flat), B):
    idx = order[s:s + B]
    out[idx] = m.encode([flat[j] for j in idx], batch_size=32, normalize_embeddings=True, convert_to_numpy=True)
    print(s + len(idx), '/', len(flat), f'{time.time() - t:.0f}s', flush=True)
emb = np.zeros((len(rows), out.shape[1]), np.float32)
np.add.at(emb, owner, out)
emb /= np.linalg.norm(emb, axis=1, keepdims=True)
np.save(f'{D}/emb-{tag}.npy', emb.astype(np.float16))
