# Xalqlar və dillər · Peoples and languages of Azerbaijan

[azadbilik.org/atlas/xalqlar](https://azadbilik.org/atlas/xalqlar/): every people the censuses count in the Republic of Azerbaijan, district by district (1979, 1999, 2009, 2019; republic totals from 1959), each with its language: family, UNESCO status and scripts from Wikidata.

| File | What |
|---|---|
| `data/peoples-az.csv` | Count of each people and the district's total, by district and census, each with its source |
| `data/peoples-az-totals.csv` | Republic totals per people and census |
| `data/peoples-az-notes.md` | Sources, category changes (Talysh mostly recorded as Azerbaijanis in Soviet censuses; Kryz, Budukh, Khinalug counted separately only from 2009; Ingiloys with Georgians until 2019), gaps |
| `data/peoples.json`, `families.json` | Names in three languages, each people's language and its family |
| `data/units.geojson`, `peoples.out.json` | What the page reads, built by `node scripts/build.mjs` (boundaries from the population map) |
| `data/dots-<year>.json` | The map's dots, built by `node scripts/dots.mjs`: one per 200 people of each people in each district, placed around the district's settlements |
| `data/settlements-az.csv` | Populated places of Azerbaijan from [GeoNames](https://www.geonames.org) (CC BY 4.0), where the dots go |

The map is a dot map: every people at once, Azerbaijanis in muted grey so the minorities read; a click on a people in the list isolates it, a click on a district gives its makeup. Dots are placed at random among a district's settlements (weighted by size, wider for a city): the census says how many live in a district, not in which village. Peoples who live in a few known villages are put there: Khinalug (Xınalıq), Budukh (Buduq), Kryz (Qrız, Cek, Əlik, Hapıt, Yerfi), Udi (Nic, Oğuz) and the Jews of Qırmızı Qəsəbə (`VILLAGES` in `scripts/dots.mjs`). The figures in Nagorno-Karabakh in 1999 and 2009 were not enumerated by Azerbaijan's statistics office; see the notes.
