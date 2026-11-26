# Işıqlar · Where people live

[azadbilik.org/atlas/isiqlar](https://azadbilik.org/atlas/isiqlar/): the people of both Azerbaijans as hexagons of light on a night map. Each hexagon (H3, about 5 km²) rises and brightens with its density, in 3D or flat. There's also a game: the camera drops over a city with every name hidden, and you pick which one it is.

- **Data:** [Kontur Population](https://www.kontur.io/portfolio/population-dataset/), 2023-11-01. These are people per 400 m H3 hexagon, estimated from satellite imagery (GHSL, Facebook HRSL, Microsoft buildings) and censuses. Licence CC BY 4.0. Downloaded from HDX for [Azerbaijan](https://data.humdata.org/dataset/kontur-population-azerbaijan) and [Iran](https://data.humdata.org/dataset/kontur-population-iran-islamic-republic-of) into `data/raw/` (git-ignored).
- **What is kept:**
  - the whole Republic of Azerbaijan;
  - in Iran, only the four Azerbaijani provinces (East and West Azerbaijan, Ardabil, Zanjan), cut by the county outlines of the population map (`../ehali`).
- **How it's prepared:** hexagons are merged one level up (resolution 8 to 7). Cells under 25 people are left out. Each cell is tagged with the district or county its centre falls in.
- **How it's built:** `python scripts/build.py` (h3, shapely) writes `data/hex.geojson` and `data/names.json`.
- **Totals on the map:** 10.45 million (the Republic) and 9.15 million (the four provinces). These are model estimates; the official census figures are on the population map.
