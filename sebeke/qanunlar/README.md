# Qanunlar · Network of Azerbaijan's legal acts

[azadbilik.org/sebeke/qanunlar](https://azadbilik.org/sebeke/qanunlar/): the State Register of Legal Acts (e-qanun.az) as a network. Acts are nodes, coloured by type and sized by how often they were amended; ties are the register's own "Related documents" (amends, implements, puts into effect / approves, repeals). A normative-core view (Constitution, codes, laws, presidential decrees, Cabinet decisions) with a switch for every act, a year range and an in-force / repealed filter, an act card (type, number, date, status, link to e-qanun.az, amended N times by year, last amendment, what it implements and is implemented by), rankings (most amended, most amended in one year, most implemented laws) and yearly counts of new acts and amendments. Drawn with the hub's shared graph view. AZ, RU, EN; act titles stay in Azerbaijani (official).

| File | What |
|---|---|
| `index.html` | The page (network, search, rankings, charts; plain JS) |
| `data/qanunlar.json` | Nodes (columnar), ties, rankings, yearly series (~1 MB), built by `scripts/build.mjs` |
| `data/titles.json` | Titles and numbers of the linked acts (~9 MB, loaded lazily for search and cards) |
| `data/pos.bin` | The network's positions, Int16 x, y per act (132 KB), by `scripts/layout.mjs` |
| `data/labels.json` | Short titles of the 3,000 most amended / implemented acts: the graph's labels until `titles.json` is in |
| `data/raw/` | The register dumps `acts.ndjson`, `rel.ndjson` (git-ignored) |
| `scripts/build.mjs` | `data/raw/` to the two JSON files |
| `scripts/layout.mjs` | ForceAtlas2 at build time (run by `build.mjs`): `pos.bin`, `labels.json` |
| `og.png` | Share card |

## Source

Ministry of Justice of the Republic of Azerbaijan, State Register of Legal Acts ([e-qanun.az](https://e-qanun.az/)), through the public API `api.e-qanun.az`, fetched 2026-11-26. e-qanun.az publishes no `robots.txt` and no terms of use (checked at fetch time); the page stores no act texts and links every act to `https://e-qanun.az/framework/<id>`. Act titles are the register's.

- `acts.ndjson`: one act per line, 59,979 distinct ids (type, number, title, status, acceptance date).
- `rel.ndjson`: per act, the list of related acts with the relation label. Crawled act by act; presidential orders (sərəncam) were not crawled on their own side and appear through the other side.

## Rebuilding

```bash
# put acts.ndjson and rel.ndjson in data/raw/ (or RAW=/path), then, from this folder:
node scripts/build.mjs     # then ~8 min of layout (scripts/layout.mjs)
```

The layout uses the hub's [scripts/graph-layout.mjs](../../scripts/graph-layout.mjs), which installs graphology 0.26.0 and graphology-layout-forceatlas2 0.10.1 into `scripts/.deps/` (git-ignored) on first use.

The build is deterministic and safe to re-run as the relation crawl grows.

## Rendering

The network is drawn by [shared/graph.js](../../shared/graph.js) (sigma.js 3 on WebGL over graphology) in its large-graph mode: the 33,015 acts and 52,242 ties are laid out at build time (`scripts/layout.mjs`, ForceAtlas2, ~8 min), the page reads the positions (`pos.bin`) and shows the settled picture at once. The ties are drawn on the GPU, faint; a hovered or clicked act's ties are drawn curved, with arrows, in their kind's colour on top. Labels go to the most amended acts first (short titles from `labels.json`, the full ones once `titles.json` is in), more as you zoom, never overlapping. A click opens the act card in a side panel (a bottom sheet on a phone); the graph's search box finds an act by title. Every filter (scope, status, kind, years) only hides and shows. The acts tied to no act of the main network (1,417 small groups, 3,996 acts) are packed, largest group first, in rows into a block beside it, behind a "Show small groups" switch that is off at first; searching an act in a hidden group switches it on and flies there. The main network is turned so its long side lies across; on a phone it is framed in the stage's own shape. Measured in headless Chromium on an M4 Pro laptop: pan and zoom at 60 fps (median 16.7 ms per frame) with all 33,015 acts on show; sweeping the pointer across acts costs nothing extra; resting on one fades the rest after 160 ms at the cost of one frame of about 60–110 ms (every node and tie is re-coloured).

## Method

- Labels and direction (checked: 14,320 amend pairs and all "applies" / "approves" / "repeals" pairs are mirrored on both acts, "implements" 4,015 times). A label ending "-ir" on act A reads "A does this to the other act", "-ib" the reverse. So `Dəyişdirir`/`Dəyişdirilib` = amends, `İcra edir`/`İcra edilib` = implements, `Tətbiq edir`, `Təsdiq edir` (and their `-ib` forms) = puts into effect / approves (one kind in the page), `Ləğv edir`/`Ləğv edilib` = repeals. A tie is stored once, from the acting act to the act acted on; ties seen from both sides are merged. A handful of pairs carry the same "-ib" label on both sides (about 11); they stay as read.
- Nodes are the acts that appear in at least one tie. Types are grouped from the register's type name: Constitution, codes (Məcəllələr), laws (incl. constitutional laws), presidential decrees (fərman), orders (presidential and Cabinet sərəncam), Cabinet decisions, Parliament and court decisions, all else (ministries, agencies, election commission, local bodies).
- Amended N times = distinct acts that amended it. The year of an amendment is the year of the amending act's acceptance date. Status is the register's.
- The register's "amended" ties begin in 2008; nothing earlier appears.
- Ranking of "most implemented laws" covers Constitution, codes and laws. Old redactions of a code (marked "QÜVVƏDƏN DÜŞÜB") and the law "on approval" of a code are separate acts in the register and rank separately.
- The layout is ForceAtlas2, computed at build time: position means closeness only. The normative core (Constitution, codes, laws, decrees, Cabinet decisions tied to each other) is laid out first, alone; every other act is then placed around it with the core held still, so the "all acts" switch adds to the picture without moving it. Filters only hide and show.

## Caveats

- The relation crawl was not complete at build time; see `stats` in `data/qanunlar.json` (`relCrawled` of `actsInRegister`). Counts and timelines are approximate, especially for orders.
- The register's links are not a legal assessment; for the redaction in force use e-qanun.az.
