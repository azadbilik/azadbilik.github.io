# Əhali · Population of historical Azerbaijan

[azadbilik.org/xeriteler/ehali](https://azadbilik.org/xeriteler/ehali/): census populations of the Republic of Azerbaijan's districts and cities (1959–2019) and of the counties of Iran's four Azerbaijani provinces, East and West Azerbaijan, Ardabil and Zanjan (1956–2016), on today's borders.

| File | What |
|---|---|
| `data/aze-census.csv`, `data/aze-census-notes.md` | Republic of Azerbaijan: population by district and census, each value with its source; how Soviet raions map to today's districts, and the gaps |
| `data/irn-census.csv`, `data/irn-census-provinces.csv`, `data/irn-census-notes.md` | Iranian Azerbaijan: population by county and by province, with sources, splits and gaps |
| `data/totals.csv` | Each side's official census total |
| `data/names.json` | Units' names in Azerbaijani and Russian |
| `data/raw/` | geoBoundaries boundaries: AZE ADM2 (CC BY-SA 3.0), IRN ADM1/ADM2 (ODbL 1.0) |
| `data/units.geojson`, `sources.json`, `totals.json` | What the page reads, built by `node scripts/build.mjs` |

Only figures a census published are shown: a district or county that did not exist yet, or whose older unit was much larger, is left empty rather than estimated. The two countries counted in different years, so the page pairs their censuses by the nearest year.

Licences: `data/units.geojson` derives from geoBoundaries' boundaries and is shared under the same terms (CC BY-SA 3.0 for the Republic's districts, ODbL for Iran's counties). The census tables and notes are CC0.
