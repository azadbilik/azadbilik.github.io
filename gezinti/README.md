# Gəzinti · Walks

[azadbilik.org/gezinti](https://azadbilik.org/gezinti/): walking maps of Azerbaijan's historic places, one folder per city.

| City | Places | Walks | Outline |
|---|---|---|---|
| [İçərişəhər](icerisheher/) | 57 | 3 | the walls (OSM way 152190481) |
| [Şəki](seki/) | 29 | 3 | the khans' fortress (OSM way 272592234) |
| [Gəncə](gence/) | 29 | 3 | none (no walls survive); the 1873 plan as underlay |
| [Şamaxı](samaxi/) | 10 | 2 | none |
| [Naxçıvan](naxcivan/) | 16 | 2 | none |
| [Lahıc](lahic/) | 9 | 1 | none |

## A city

Each city has these hand-kept files in `<city>/data/`:

| File | What |
|---|---|
| `city.json` | `bbox` (s,w,n,e) to fetch streets and OSM positions in; `outlineWay`, the OSM way drawn as the walls (optional) |
| `places.json` | the places: `id`, Wikidata `qid`, `kind` (`fort`, `palace`, `mosque`, `bath`, `caravanserai`, `church`, `tomb`, `museum`, `house`, `other`); optional `at` [lng, lat] and `name` {az, ru, en} override Wikidata |
| `walks.json` | the walks: names and intro in az/ru/en, ordered `stops`, `color` (accent, second, third); `direct: true` joins stops in straight lines |
| `about.json` | our own 2–4 sentence texts in az/ru/en, written from the articles' leads; the card shows them instead of the Wikipedia opening |

The page `<city>/index.html` is the shared `shared/gezinti.js` and `shared/gezinti.css` plus a `window.CITY` block (title, subtitle, centre, zoom, optional old-plan underlay).

## Build

```sh
node gezinti/scripts/build.mjs <city>            # uses downloads cached in <city>/data/raw (git-ignored)
node gezinti/scripts/build.mjs <city> --refresh  # fetches Wikidata, Wikipedia, Commons and OpenStreetMap again
```

It writes `<city>/data/site.json`:
- **Name:** from Wikidata.
- **Position:** from the OSM feature tagged with the same Wikidata id, else Wikidata's point, else `at`. Check places that Wikidata puts on top of each other: whole complexes often share one point.
- **Text:** the opening of the Wikipedia article in each language (CC BY-SA, linked on the card).
- **Photo:** Wikidata P18, with author and licence from Commons.
- **Walks:** the shortest way along OSM streets and footways between stops. Where that is more than 2.5 times the straight line (OSM lacks a lane, so the route goes round the block), the stops are joined straight.

There are no dates of our own: Wikidata's inception years often disagree with the articles.

After adding a city, add its card to `index.html`, run `node scripts/search-index.mjs` and add it to `scripts/smoke.mjs`.
