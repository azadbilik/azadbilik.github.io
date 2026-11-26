# Arxiv · Archive

Old posters, maps, manuscripts and books about Azerbaijan, at azadbilik.org/arxiv. Everything here is out of copyright, and every scan names the library or archive that holds it, its call number and a link back.

## Sources
- **НЭБ «Книжные памятники»** (kp.rusneb.ru, Russian State Library and National Library of Russia):
  - the 1920s Baku posters;
  - pre-1917 Baku advertising;
  - the Baku islands (1847) and Baku governorate maps;
  - «Дербенд-наме» (1816);
  - Shah Sultan Husayn's decree (1721).
  - The reader's own page list (`/api/v1/materials/<slug>/pages/`) gives each page at 1600 px.
- **Presidential Library** (prlib.ru), mostly holding files of the Russian State Historical Archive (RGIA):
  - the 1872 plan of Elisavetpol (RGIA 1293/166/2);
  - Kondratenko's ethnographic maps (1293/167/28);
  - maps of the Caucasus region, 1864–1869;
  - the Black City plan.
  - Its viewer serves IIPImage tiles. Whole pages come from `&WID=…&CVT=jpeg`, up to about 1700 px.
- Both sites answer only from some networks. Over-fast reading gets throttled, at about 250 pages in a row on RusNEB.

## Build
Scans live outside the repo, in `~/kitabxana-scans` (`SCANS=` to change). `data/catalogue.json` is edited by hand: titles in az/ru/en, date, place, language, holder, call number, source URL.

    python3 scripts/build.py [id …]     # Pillow + numpy

It writes `img/<id>/<n>.webp` (2000 px) and `t.webp`, and `data/items.json`. After adding items, rebuild the site search with `node scripts/search-index.mjs`.

## Large items
The large items are marked `"ia": true` and get only a card here: the Nizami «Khamsa» lithographs (Tehran 1845, 1848), the «Shahnameh» (Tabriz 1858), the «Tazkira» (1594), the 1886 «Свод» and the 1897/1926 census volumes. Their pages go to the Internet Archive, uploaded with the owner's OK for each batch, and the cards will then embed its reader.
