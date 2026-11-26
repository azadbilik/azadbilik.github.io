# Karvan yolu · By caravan, c. 1800

[azadbilik.org/atlas/yollar](https://azadbilik.org/atlas/yollar/): how many days a laden caravan, or a mounted courier, took between the capitals of the khanates (and Tiflis), and the land a caravan reached from each in 1, 2, 3 … 12 days. There's also a game: guess the days, then watch the caravan walk it.

**It is a model of the land, not a record of the roads**, after Stanford's [ORBIS](https://orbis.stanford.edu):

- **Ground:** terrain tiles (Mapzen / AWS Open Data «terrarium», zoom 8, about 470 m a pixel), downloaded to `data/raw/dem/` (git-ignored).
- **Speed on a slope:** Tobler's hiking function, 6·e^(−3.5·|slope+0.05|) km/h. It's symmetric here, so climbing and descending cost the same. It is scaled for each way of travelling:

  | Mode | Share of a walker's speed | Hours on the move a day |
  |---|---|---|
  | Laden caravan | 0.7 | 8 |
  | Mounted courier | 1.6 | 10 |

  On flat ground that comes to about 28 km a day for a caravan, close to what travellers reported.
- **Water:**
  - The Caspian (ground below −28 m east of 48.5°E) cannot be crossed.
  - Lakes Sevan, Urmia and Van (Natural Earth, public domain) cannot be crossed.
  - Crossing the Kura or the Araz costs about half a caravan day, anywhere along them (OpenStreetMap, from `../hovze`).
- **Places:** the capitals in `../xanliqlar/data/khanates.json` (Wikidata), and Tiflis.

`python scripts/model.py` (numpy, scipy, scikit-image, shapely, Pillow) runs Dijkstra (skimage MCP) from every capital. It writes:
- `data/table.json`: days between every pair, for both modes;
- `data/routes.geojson`: the caravan's fastest way for each pair;
- `data/reach.geojson`: the 1–12-day rings.

What the model leaves out: real roads, bridges and caravanserais, passes closed by snow, the season, rest days, and borders or tolls. Read the figures as "about so many days over this ground", not as a route anyone took.

Licences: the model's output is CC0; the terrain tiles are open data (Mapzen/AWS, with their sources' attributions); the rivers are © OpenStreetMap contributors, ODbL.
