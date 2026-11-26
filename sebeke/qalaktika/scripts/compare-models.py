import json, random, sys, time, numpy as np, torch
from collections import defaultdict
from sentence_transformers import SentenceTransformer
random.seed(1)
import os; D=os.environ.get('EMBED_DIR', os.path.expanduser('~/.local/share/azadbilik-embed'))+'/'
pairs=[json.loads(l) for l in open(D+'pairs.jsonl')][:300]
by=defaultdict(list)
for l in open(D+'works.jsonl'):
    d=json.loads(l)
    if d['g']=='POEM' and d['l']=='AZ_LATIN' and d['wc']>=30 and d['txt']: by[d['a']].append(d)
auth=[a for a,v in by.items() if len(v)>=40]
random.shuffle(auth); auth=auth[:20]
items=[(a,x['txt'][:1200]) for a in auth for x in random.sample(by[a],40)]
print(len(items),'poems from',len(auth),'poets')
for name,pre in [(n,'passage: ' if 'e5' in n else '') for n in sys.argv[1:]]:
    m=SentenceTransformer(name,device='mps'); m.max_seq_length=256; m.half()
    t=time.time()
    enc=lambda xs: m.encode([pre+x for x in xs],batch_size=32,normalize_embeddings=True,convert_to_numpy=True)
    fa=enc([p['fa'] for p in pairs]); az=enc([p['az'] for p in pairs])
    s=fa@az.T; acc=(s.argmax(1)==np.arange(len(pairs))).mean()
    E=enc([x[1] for x in items]); lab=np.array([x[0] for x in items])
    S=E@E.T; np.fill_diagonal(S,-9); nn=np.argsort(-S,1)[:,:5]
    same=(lab[nn]==lab[:,None]).mean()
    print(name,'FA->AZ top1 %.3f'%acc,'| 5-NN same poet %.3f'%same,'| %.0fs'%(time.time()-t),flush=True)
