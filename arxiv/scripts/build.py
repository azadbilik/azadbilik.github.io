# Builds the archive's images and index from data/catalogue.json and the scans on disk.
#  - scans live outside the repo (SCANS, default ~/kitabxana-scans): kp/<slug>/pNNNN.jpg from НЭБ
#    «Книжные памятники», prlib/prlib-<id>-pNN.jpg from the Presidential Library, svod-1886/…;
#  - each item's pages become img/<id>/<n>.webp (long side 2000 px) and img/<id>/t.webp (a card);
#  - "pages": [1, 2] picks pages, "all" takes them all, "maps" keeps the coloured sheets of a folder
#    (drops its covers, forms and blank backs); "ia": true items are too big for the site and get only a
#    card (their pages go to the Internet Archive), from page "thumb" or the most colourful early page;
#  - writes data/items.json for index.html.
#   python3 scripts/build.py [id …]      (Pillow, numpy)
import json, os, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parents[1]
SCANS = Path(os.environ.get('SCANS', Path.home() / 'kitabxana-scans'))
Image.MAX_IMAGE_PIXELS = None
cat = json.load(open(HERE / 'data' / 'catalogue.json'))
only = set(sys.argv[1:])

def files(src):
    if src == 'prlib-plan': return [SCANS / 'rgia-1293-166-2-elisavetpol-1872-full.jpg']
    if src.startswith('prlib/prlib-'): return sorted((SCANS / src).glob('p*.jpg'))
    if src.startswith('prlib/'): return sorted((SCANS / 'prlib').glob(f'prlib-{src[6:]}-p*.jpg'))
    if src.startswith('kp/'): return sorted((SCANS / src).glob('p*.jpg'))
    return sorted((SCANS / src).glob('*.jpg'))

def colour(f):
    """how coloured a sheet is, and how much of it is black scanner background"""
    a = np.asarray(Image.open(f).convert('RGB').resize((200, 200)), np.float32)
    rg, yb = a[..., 0] - a[..., 1], (a[..., 0] + a[..., 1]) / 2 - a[..., 2]
    c = np.hypot(rg.std(), yb.std()) + .3 * np.hypot(rg.mean(), yb.mean())
    return c, (a.max(2) < 35).mean()

out = []
for it in cat['items']:
    fs = files(it['src'])
    if not fs: print('no scans for', it['id'], it['src']); continue
    d = HERE / 'img' / it['id']
    sel = it.get('pages', 'all')
    if it.get('ia'):
        t = it.get('thumb')
        pick = [fs[t - 1]] if t else [max(fs[:40], key=lambda f: colour(f)[0])]
    elif sel == 'all': pick = fs
    elif sel == 'maps': pick = [f for f in fs if (lambda c: c[0] > 22 and c[1] < .08)(colour(f))]
    else: pick = [fs[i - 1] for i in sel]
    rec = {k: v for k, v in it.items() if k not in ('src', 'pages', 'thumb')}
    rec['n'] = 0 if it.get('ia') else len(pick)
    rec['total'] = len(fs)
    if not only or it['id'] in only:
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob('*.webp'): old.unlink()
        for i, f in enumerate(pick, 1):
            im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
            if not it.get('ia'):
                big = im.copy(); big.thumbnail((2000, 2000), Image.LANCZOS)
                big.save(d / f'{i}.webp', quality=80, method=5)
            if i == 1:
                th = im.copy(); th.thumbnail((480, 640), Image.LANCZOS)
                th.save(d / 't.webp', quality=78, method=5)
                rec['ratio'] = round(th.width / th.height, 3)
        print(f"{it['id']}: {len(pick)} of {len(fs)} pages", '(card only)' if it.get('ia') else '')
    else:
        rec['ratio'] = (lambda w, h: round(w / h, 3))(*Image.open(d / 't.webp').size)
    out.append(rec)
json.dump({'collections': cat['collections'], 'holders': cat['holders'], 'items': out}, open(HERE / 'data' / 'items.json', 'w'), ensure_ascii=False, indent=1)
size = sum(f.stat().st_size for f in (HERE / 'img').rglob('*.webp'))
print(len(out), 'items,', size // 1024 // 1024, 'MB of images')
