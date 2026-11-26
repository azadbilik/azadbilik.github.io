# İnsanlar · People of historical Azerbaijan

[azadbilik.org/sebeke/insanlar](https://azadbilik.org/sebeke/insanlar/): people on Wikidata born on either side of the Araz, as (1) a migration map of arcs from birthplace to place of death by era (before 1828, 1828–1920, 1920–1991, 1991 on), (2) a network of places joined by those flows, drawn with cosmos.gl, coloured by occupation or era, in a geographic or a force layout, (3) a search that follows one person from birthplace through places lived in to place of death, and (4) a plain account of how lopsided the data is. AZ, RU, EN.

| File | What |
|---|---|
| `index.html` | The page (MapLibre map, cosmos.gl network, search; plain JS) |
| `data/insanlar.json` | What the page reads, built by `scripts/build.mjs` |
| `scripts/region.mjs` | The region as polygons, from the hub's own data (below) |
| `scripts/fetch.mjs` | Pulls Wikidata into `data/raw/` (git-ignored cache) |
| `scripts/build.mjs` | `data/raw/` → `data/insanlar.json` |
| `og.png` | Share card |

## Sources

- **People, places, occupations:** [Wikidata](https://www.wikidata.org/), CC0 1.0, through the Query Service (`query.wikidata.org/sparql`). Properties: P31 = Q5, P19 birth place, P20 death place, P569/P570 dates, P21 sex, P106 occupation, P551 residence, P937 work location, P1412 / P6886 languages, P172 ethnic group, P625 coordinates, P131 located in, sitelinks.
- **Boundaries used to decide "historical Azerbaijan":** the hub's own [population map](../../atlas/ehali/) (78 districts of today's Republic of Azerbaijan; 55 counties of the Iranian provinces East Azerbaijan, West Azerbaijan, Ardabil, Zanjan; geoBoundaries, CC BY-SA 3.0 / ODbL) and [1897 census map](../../atlas/1897/) (RISTAT, CC0), whose uezds and okrugs where at least 25% named Azerbaijani («татарский») their native language are included: Erivan, Etchmiadzin, Surmali, Sharur-Daralayaz, Novobayazet, Zangezur, Borchali, Zaqatala, Kaitag-Tabasaran and the Baku and Elisabethpol uezds. Derbent, a seat of Kyurin okrug where Azerbaijani is only 2%, is a 25 km disc around the city.
- **Base map:** OpenFreeMap tiles, © OpenStreetMap contributors. **Network:** [cosmos.gl](https://github.com/cosmosgl/graph) 3.6.0 (MIT) from jsDelivr.

## Rebuilding

```bash
cd sebeke/insanlar
node scripts/fetch.mjs     # about 45 min, polite: one query at a time, cached per tile / batch in data/raw/ (66 MB, git-ignored)
node scripts/build.mjs     # seconds
```

Delete `data/raw/` to refetch from scratch. Node 20+; no dependencies.

## What it holds (Wikidata pulled 2026-11-26)

- 33,739 humans fetched from the tiles and the ethnic-group query; 15,496 kept: 9,060 born in today's Republic of Azerbaijan, 1,617 in the Iranian provinces, 4,800 in the other 1897 uezds, 19 by ethnic group alone (P172 is rarely filled in). 8,611 have both a birth and a death place on the map.
- Dropped: 10,629 born outside the polygons (the tiles are rectangles), 7,203 living people with fewer than 3 Wikimedia sites, 411 with no dates and one site.
- 12% women, 86% men; 568 born before 1828, 9,286 born 1920–1990.
- `data/insanlar.json` is 2.2 MB (about 0.7 MB gzipped).

## Method

- **Selection.** Humans (Q5) with a sitelink to at least one Wikimedia site and a birth place that has its own coordinates inside a 1° tile (WDQS `wikibase:box`, tiles split on timeout). The coordinates are then tested against the polygons above (point in polygon), not against Wikidata's administrative chain. People whose ethnic group (P172) is Azerbaijanis, Iranian Azerbaijanis, or Azerbaijanis in Russia/Armenia/Ukraine are added wherever they were born.
- **Kept / left out.** Living people (no death date) born after 1906 are kept only with sitelinks on at least 3 Wikimedia sites; people with neither birth nor death date and a single sitelink are left out. Only what Wikidata already shows (name, birth year, place, occupation) is carried.
- **Era.** An arc belongs to an era by the person's death year; with no death year, birth year + 60. It dates the end of the journey, not the move.
- **Places.** A place without its own coordinates takes those of its first parent unit that has some (P131); flagged in the data (a place's 7th field is 1 when its coordinates are the parent's). Birth places without any coordinates drop the person from the map but not from search. Death and residence places are not tested against the region; they can be anywhere. About 2,400 people have a death place that has no coordinates at all; they have no arc. A death place is the exact item Wikidata names (a hospital or a Paris arrondissement stays separate from its city).
- **Occupation groups.** Eleven groups by keywords in the English labels of P106 values (`CATS` in `build.mjs`); the group a person's occupations count most in, ties by the order literature, music, art, stage, religion, science, military, politics, business, sport. Unmatched occupations fall in "other". Rough.
- **Arcs.** Quadratic curves bending to the left of travel, so A→B and B→A separate; width grows with the number of people. The map shows the strongest N arcs (a slider).
- **Network layout.** "Geography" places each place where it is, with distances beyond ~5° compressed logarithmically so Paris and Moscow fit; "force" starts from that and runs cosmos.gl's simulation.

## Caveats

- Wikidata over-represents the Soviet era, men, towns, writers, scholars and officials, and under-represents women, peasants, anyone before the 19th century, and people of the south (Iranian Azerbaijan is much thinner than the Republic). The page shows the decade and sex distribution.
- "Other 1897 uezds" (Erivan, Zangezur, Borchali, Derbent…) include many people who are not Azerbaijani by any measure (Wikidata gives ethnic group for few); the page has a filter by group, and the default shows all.
- No Wikidata claim here has been independently checked; most carry no reference.
- Wikidata changes daily; the build records its date in `data/insanlar.json` (`built`).
