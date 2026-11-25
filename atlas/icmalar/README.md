# İcmalar · Azerbaijani communities beyond the Republic

[azadbilik.org/atlas/icmalar](https://azadbilik.org/atlas/icmalar/): the Azerbaijanis counted in each district of Georgia, Dagestan and Soviet Armenia at each census, 1926–2021, with each country's totals and the authors from the [literary map](https://azadbilik.org/xerite/) born in each place.

| File | What |
|---|---|
| `data/communities-geo.csv`, `communities-dag.csv`, `communities-arm.csv` | Azerbaijanis and total population by district and census, each with its source |
| `data/communities-totals.csv`, `communities-arm-totals.csv` | Country totals per census |
| `data/communities-geo-dag-notes.md`, `communities-arm-notes.md` | How historical districts map to today's shapes, and every gap |
| `data/names.json` | Districts' names in Azerbaijani (with the historical name where there is one) and Russian |
| `data/raw/` | geoBoundaries: GEO ADM2 (public domain), RUS ADM2 for Dagestan (ODbL), ARM ADM2 (CC BY 3.0 IGO) |
| `data/units.geojson`, `extras.json` | What the page reads, built by `node scripts/build.mjs` |

Gaps, all left empty rather than estimated: Soviet Armenia's districts are published for 1939 only (the country totals for every census); Dagestan's districts for 1959–1989 only for Derbent; Georgia's for 1959 not at all. 1926 counted "Turks" (тюрки), not quite the same category. Iran does not count ethnicity.
