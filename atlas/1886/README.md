# 1886 · Villages in the family lists

[azadbilik.org/atlas/1886](https://azadbilik.org/atlas/1886/): every village and town of the Baku and Elisabethpol governorates in the 1886 family lists (посемейные списки), with its households, men and women, by people and by faith, on a map.

| File | What |
|---|---|
| `data/raw/svod-1886/pNNN.jsonl` | The tables as transcribed, one file per spread of the book (pp. 219–337 of the scan), one JSON object per printed row; `BRIEF.md` is how they were read |
| `data/villages-1886.csv` | One row per village and town: uezd, участок, rural society, number, name as printed, distances, households, men, women, and men/women by people (`pp_*`), faith (`fa_*`) and estate (`es_*`), normalised; built by `scripts/merge.py` |
| `data/checks-1886.txt` | Every printed society, участок and uezd total against the sum of its villages |
| `data/raw/places.tsv` | Candidate places: GeoNames (AZ, AM, GE), OpenStreetMap place nodes, Wikidata settlements, with all their names |
| `data/geocode-1886.csv` | Each village's place: coordinates, the place and name matched, score, how it was decided (`name`, `society`, `approx`), runners-up; built by `scripts/geocode.py` |
| `data/villages.geojson`, `data/summary.json` | What the page reads, built by `scripts/build.py` |

Rebuild: `python3 scripts/merge.py && python3 scripts/geocode.py && python3 scripts/build.py` (geocode needs `shapely`).

## Source

«Свод статистических данных о населении Закавказского края, извлечённых из посемейных списков 1886 г.», Tiflis, 1893 (Russian State Library, 01005403186; [НЭБ](https://viewer.rusneb.ru/ru/000199_000009_005403186)). Public domain. The whole book is mirrored on the Internet Archive as `azadbilik-svod-1886`.

The tables give, for every settlement: households (дымы), men and women, then the same by people (народности), faith (вероисповедание) and estate (сословие). Peoples and faiths are named as the book names them; «татары» are the Azerbaijanis. A «Прочія» column is explained in footnotes that change from page to page; a village cell takes its society's footnote when only the society line carries the mark.

## How it was read

The 116 spreads were transcribed with Claude reading the scans (each page at full resolution, uncertain digits re-read from enlarged crops). Every row was checked: men + women = total, the sum of peoples and of faiths against the row, every society against its villages, every участок and uezd against its societies. Where the book's own figures do not add up, the printed figure is kept and the row's `note` says what the sums imply; 758 of 811 printed totals match their villages exactly, the rest differ by the book's misprints, listed in `checks-1886.txt`. Estates (сословия) are grouped into seven: peasants on state land, on landowners' land, peasant owners, beys/meliks/nobility, clergy, townspeople, other (`es_*` in the CSV, a third view on the map).

## How the villages were placed

Names are compared as a rough phonetic skeleton shared by pre-reform Russian, modern Russian and Azerbaijani Latin (Карадаглу ≈ Qaradağlı ≈ Карадаглы), against every name of every candidate place inside the village's uezd (RISTAT's 1897 boundaries, `../1897/data/units.geojson`, buffered by ~8 km; a place inside the uezd proper scores a little higher). A clear best match is taken; between close or same-named candidates the rural society decides: the one nearest the society's other villages. A placed village far (> 25 km) from the rest of its society is re-decided or let go. Villages still unplaced but in a society with placed villages are shown at the society's middle and marked approximate (hollow on the map).

Result: 1,942 of 2,700 villages placed by name (72%), 471 approximately, 287 (about 211,000 people) not on the map — mostly whole societies whose villages were renamed, abandoned or were nomad camps (кочевья). Their people are still in the totals.

Placements were spot-checked, not checked one by one. Where a village shares its name with another nearby, the society rule usually picks right but not always; corrections are welcome.

## Licences

The book is public domain; the transcription and the CSVs are CC0. Place candidates: GeoNames (CC BY 4.0), OpenStreetMap (ODbL — the coordinates in `geocode-1886.csv` taken from OSM are under ODbL), Wikidata (CC0). Uezd boundaries: RISTAT (CC0, cite RISTAT).
