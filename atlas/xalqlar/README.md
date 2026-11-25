# Xalqlar və dillər · Peoples and languages of Azerbaijan

[azadbilik.org/atlas/xalqlar](https://azadbilik.org/atlas/xalqlar/): every people the censuses count in the Republic of Azerbaijan, district by district (1979, 1999, 2009, 2019; republic totals from 1959), each with its language: family, UNESCO status and scripts from Wikidata.

| File | What |
|---|---|
| `data/peoples-az.csv` | Count of each people and the district's total, by district and census, each with its source |
| `data/peoples-az-totals.csv` | Republic totals per people and census |
| `data/peoples-az-notes.md` | Sources, category changes (Talysh mostly recorded as Azerbaijanis in Soviet censuses; Kryz, Budukh, Khinalug counted separately only from 2009; Ingiloys with Georgians until 2019), gaps |
| `data/peoples.json`, `families.json` | Names in three languages, each people's language and its family |
| `data/units.geojson`, `peoples.out.json` | What the page reads, built by `node scripts/build.mjs` (boundaries from the population map) |

A census with no figure for a district shows the last known one, faintly. The figures in Nagorno-Karabakh in 1999 and 2009 were not enumerated by Azerbaijan's statistics office; see the notes.
