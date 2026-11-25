# 1897 · Native languages in the Caucasus, 1897

[azadbilik.org/atlas/1897](https://azadbilik.org/atlas/1897/): the 1897 census of the Russian Empire by native language in the 36 uezds and okrugs of the Baku, Elisabethpol and Erivan governorates, the Dagestan and Kars oblasts, and the Borchali uezd and Zaqatala okrug of the Tiflis governorate (its other, Georgian, uezds are left out), on their 1897 borders, with today's districts drawn over them to compare.

| File | What |
|---|---|
| `data/NOTES.md` | Sources, coverage, how the census's language names are grouped (copied to the open data repo with the CSV) |
| `data/census-1897.csv` | Every unit (governorate, uezd, town) × language as the census names it: men, women, both sexes, and the Demoscope page it comes from |
| `data/languages.json` | How the census's language names are grouped on the map, with names in Azerbaijani, Russian and English |
| `data/names.json` | Uezds' and governorates' names in three languages |
| `data/raw/demoscope-1897.json` | The Demoscope pages as read: each page's label and table rows |
| `data/raw/uyezds-1897.geojson` | RISTAT's 1897 district boundaries, clipped to the region |
| `data/units.geojson`, `data/census.out.json` | What the page reads, built by `node scripts/build.mjs` |

## Sources

- **Census:** «Первая всеобщая перепись населения Российской империи 1897 г.», Table XIII «Распределение населения по родному языку», vols 51–89, St Petersburg 1903–1905, as transcribed by [Demoscope Weekly](https://www.demoscope.ru/weekly/ssp/emp_lan_97_uezd.php) (one page per uezd and town; the CSV links each). Demoscope lists only languages spoken by more than about 100 people of one sex in a governorate; the rest are in its «Остальные» row, shown here as other languages. The census asked for native language, not nationality: Azerbaijani is recorded as «татарский» (Tatar), Lezgian as «кюринский», Lak with other Daghestanian languages as «кази-кумукский».
- **Boundaries:** Kessler, Gijs and Andrei Markevich, *Electronic Repository of Russian Historical Statistics, 18th–21st centuries*, [ristat.org](https://ristat.org/), Version I (2020): Russian Empire Historical GIS Maps (1897), cleaned by Rombert Stapel (IISH), [doi:10.34894/NQOASN](https://doi.org/10.34894/NQOASN). CC0, with the request to cite RISTAT as the source. Clipped to the six units and converted from GeoPackage; attributes unchanged.
- **Today's districts** (the dashed overlay) are the population map's boundaries, `../ehali/data/units.geojson` (geoBoundaries, CC BY-SA 3.0 / ODbL).

## Notes

- Uezds are drawn as RISTAT reconstructs them; the reconstruction has not been checked here against the 1897 maps.
- Georgian on the map includes Imeretian, Mingrelian and Svan; Russian includes Ukrainian («малорусский») and Belarusian. The CSV keeps every census name separately.
- Left out: the Tiflis governorate apart from Borchali and Zaqatala, and western Georgia (Kutais, Batum, Sukhum). `data/raw/` keeps every page and boundary as read; the build drops them. Terek, Kuban, Stavropol and the Black Sea governorate are not read.
- The census tables and the CSV are CC0. The boundaries are CC0 (cite RISTAT).
