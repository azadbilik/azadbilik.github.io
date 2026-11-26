# Qanunlar · Network of Azerbaijan's legal acts

[azadbilik.org/sebeke/qanunlar](https://azadbilik.org/sebeke/qanunlar/): the State Register of Legal Acts (e-qanun.az) as a network. Acts are nodes, coloured by type and sized by how often they were amended; ties are the register's own "Related documents" (amends, implements, puts into effect / approves, repeals). A normative-core view (Constitution, codes, laws, presidential decrees, Cabinet decisions) with a switch for every act, a year range and an in-force / repealed filter, an act card (type, number, date, status, link to e-qanun.az, amended N times by year, last amendment, what it implements and is implemented by), rankings (most amended, most amended in one year, most implemented laws) and yearly counts of new acts and amendments. Drawn with cosmos.gl. AZ, RU, EN; act titles stay in Azerbaijani (official).

| File | What |
|---|---|
| `index.html` | The page (cosmos.gl network, search, rankings, charts; plain JS) |
| `data/qanunlar.json` | Nodes (columnar), ties, rankings, yearly series (~1 MB), built by `scripts/build.mjs` |
| `data/titles.json` | Titles and numbers of the linked acts (~9 MB, loaded lazily for search and cards) |
| `data/raw/` | The register dumps `acts.ndjson`, `rel.ndjson` (git-ignored) |
| `scripts/build.mjs` | `data/raw/` to the two JSON files |
| `og.png` | Share card |

## Source

Ministry of Justice of the Republic of Azerbaijan, State Register of Legal Acts ([e-qanun.az](https://e-qanun.az/)), through the public API `api.e-qanun.az`, fetched 2026-11-26. e-qanun.az publishes no `robots.txt` and no terms of use (checked at fetch time); the page stores no act texts and links every act to `https://e-qanun.az/framework/<id>`. Act titles are the register's.

- `acts.ndjson`: one act per line, 59,979 distinct ids (type, number, title, status, acceptance date).
- `rel.ndjson`: per act, the list of related acts with the relation label. Crawled act by act; presidential orders (sərəncam) were not crawled on their own side and appear through the other side.

## Rebuilding

```bash
# put acts.ndjson and rel.ndjson in data/raw/ (or RAW=/path), then, from this folder:
node scripts/build.mjs
```

The build is deterministic and safe to re-run as the relation crawl grows.

## Method

- Labels and direction (checked: 14,320 amend pairs and all "applies" / "approves" / "repeals" pairs are mirrored on both acts, "implements" 4,015 times). A label ending "-ir" on act A reads "A does this to the other act", "-ib" the reverse. So `Dəyişdirir`/`Dəyişdirilib` = amends, `İcra edir`/`İcra edilib` = implements, `Tətbiq edir`, `Təsdiq edir` (and their `-ib` forms) = puts into effect / approves (one kind in the page), `Ləğv edir`/`Ləğv edilib` = repeals. A tie is stored once, from the acting act to the act acted on; ties seen from both sides are merged. A handful of pairs carry the same "-ib" label on both sides (about 11); they stay as read.
- Nodes are the acts that appear in at least one tie. Types are grouped from the register's type name: Constitution, codes (Məcəllələr), laws (incl. constitutional laws), presidential decrees (fərman), orders (presidential and Cabinet sərəncam), Cabinet decisions, Parliament and court decisions, all else (ministries, agencies, election commission, local bodies).
- Amended N times = distinct acts that amended it. The year of an amendment is the year of the amending act's acceptance date. Status is the register's.
- The register's "amended" ties begin in 2008; nothing earlier appears.
- Ranking of "most implemented laws" covers Constitution, codes and laws. Old redactions of a code (marked "QÜVVƏDƏN DÜŞÜB") and the law "on approval" of a code are separate acts in the register and rank separately.
- The layout is a force simulation: position means closeness only.

## Caveats

- The relation crawl was not complete at build time; see `stats` in `data/qanunlar.json` (`relCrawled` of `actsInRegister`). Counts and timelines are approximate, especially for orders.
- The register's links are not a legal assessment; for the redaction in force use e-qanun.az.
