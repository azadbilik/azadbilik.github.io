# İçərişəhər · The Old City of Baku

[azadbilik.org/gezinti/icerisheher](https://azadbilik.org/gezinti/icerisheher/): 57 monuments inside the walls and three walks. The page reads `data/site.json`; the optional underlay is the 1806 plan from [/atlas/baki](../../atlas/baki/).

| File | What | By |
|---|---|---|
| `data/places.json` | which places, their Wikidata id and kind (`fort`, `palace`, `mosque`, `bath`, `caravanserai`, `church`, `museum`, `house`); `at` overrides a position | hand |
| `data/about.json` | our own 3–4 sentence texts in az/ru/en, written from the articles' leads; the card shows them instead of the Wikipedia opening. All the walks' stops but Zəncirli ev (its article says nothing yet) | hand |
| `data/walks.json` | walks: names and intro in az/ru/en, ordered stops, colour; `direct` joins stops in straight lines | hand |
| `data/site.json` | everything the page needs | `node scripts/build.mjs` |

The build takes:
- the name from Wikidata;
- the position from the OpenStreetMap feature tagged with the same Wikidata id, else Wikidata's point, else `at`;
- the opening of the Wikipedia article in each language (CC BY-SA, linked on the card);
- the photo from Wikidata P18, with author and licence from Commons.

Walks are the shortest way along OSM streets and footways between consecutive stops.

There are no dates of our own: Wikidata's inception years often disagree with the articles.

Downloads are cached in `data/raw/` (git-ignored). Run `node scripts/build.mjs --refresh` to fetch them again.
