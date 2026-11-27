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

Names are compared as a rough phonetic skeleton shared by pre-reform Russian, modern Russian and Azerbaijani Latin (Карадаглу ≈ Qaradağlı ≈ Карадаглы), against every name of every candidate place inside the village's uezd (RISTAT's 1897 boundaries, `../1897/data/units.geojson`, buffered by ~8 km; a place inside the uezd proper scores a little higher). A clear best match is taken; between close or same-named candidates the rural society decides: the one nearest the society's other villages. A placed village far (> 25 km) from the rest of its society is re-decided or let go. «Ашага/нижний» and «юхари/верхний» (and «беюк/малое») must agree with the place's own Aşağı/Yuxarı/Böyük/Kiçik. One place takes one village: where several matched the same place (within 300 m), the best match keeps it and the others take their next candidate near their society, or go approximate. Villages still unplaced but in a society with placed villages are shown at the society's middle and marked approximate (hollow on the map).

Result: 1,815 of 2,700 villages placed by name or by their society (67%). Of the rest, 122 were found by their own dot on Kondratenko's maps (below; `how` = `map`, within ~2 km) and 136 at their rural society's printed number there (`map-society`); 577 are shown approximately at the middle of their society; 50 (about 29,000 people) are not on the map — 38 of them in the 22 societies Kondratenko lists as «не показаныя на картѣ». Their people are still in the totals.

Placements were spot-checked, not checked one by one. Where a village shares its name with another nearby, the society rule usually picks right but not always; corrections are welcome.

## Kondratenko's maps

The page can show, under the dots, E. Kondratenko's seven ethnographic maps of the Caucasus governorates (supplement to the Zapiski of the Caucasus Section of the Russian Geographical Society, vol. XVIII; drawn from the same 1886 family lists; Presidential Library, [item 768136](https://www.prlib.ru/item/768136); public domain). Rural societies are coloured by people in the map's own colours; legends and bar charts are left out (the full sheets are in the archive).

| Sheet | Scan | Control points | Left out one at a time: median / worst |
|---|---|---|---|
| Baku (north to the left) | p12 | 55 | 1.4 / 3.7 km |
| Elisabethpol | p14 | 59 | 2.1 / 5.3 km |
| Erivan | p18 | 71 | 1.7 / 4.8 km |
| Kars | p20 | 41 | 1.8 / 4.2 km |
| Tiflis (with the Zaqatala okrug) | p08 | 40 | 2.2 / 6.1 km |
| Kutais (with Sukhum and Batum) | p10 | 45 | 2.2 / 5.3 km |
| Dagestan | p16 | 41 | 1.8 / 5.2 km |

Control points are settlement dots read on each sheet: for Baku and Elisabethpol, villages already placed by name here; for the others, towns and villages found in GeoNames (AZ, AM, GE, RU, TR) by their old Russian names (`data/raw/kondratenko-gcp-<sheet>.json`). A second-order polynomial per sheet; points that miss by more than 3× the median are dropped. Baku and Elisabethpol are cut to their 1897 outlines; the others to an outline drawn along the map's own border (`data/raw/kondratenko-sheets.json`, with the blocks of legend and charts left out). `python3 scripts/kondratenko.py` writes `data/kondratenko-<sheet>.webp`, `data/kondratenko.json` (corners) and `data/raw/kondratenko-gcps.json` (the fit, each point's error, the points dropped).

## Licences

The book is public domain; the transcription and the CSVs are CC0. Place candidates: GeoNames (CC BY 4.0), OpenStreetMap (ODbL — the coordinates in `geocode-1886.csv` taken from OSM are under ODbL), Wikidata (CC0). Uezd boundaries: RISTAT (CC0, cite RISTAT).
