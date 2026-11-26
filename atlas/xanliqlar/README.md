# Xanlıqlar · The khanates of Azerbaijan, c. 1800

[azadbilik.org/atlas/xanliqlar](https://azadbilik.org/atlas/xanliqlar/): the khanates and sultanates of the late 18th century, with their capitals and the year each passed to Russia.

## Source

The borders north of the Araz come from **«Карта Кавказского края с обозначением границ 1801–1813 г.»**, compiled in the Military-Historical Section of the Caucasus Military District staff by Lt-Col. V. I. Tomkeev, Tiflis 1901 ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:%D0%9A%D0%B0%D1%80%D1%82%D0%B0_%D0%9A%D0%B0%D0%B2%D0%BA%D0%B0%D0%B7%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%D0%BA%D1%80%D0%B0%D1%8F_(1801-1813)..jpg), public domain). It shows each khanate's border at the time Russia took it, at most a few years after 1800.

| File | What |
|---|---|
| `data/khanates.json` | The table: each polity's names (az, ru, en), capital, the year Russia took it, how it is drawn and a short note in three languages. How it is drawn: `"trace": true` means traced from the 1901 map; `uezds` means the 1897 uezds made from its lands; neither means its capital only |
| `data/raw/gcps.json` | 14 towns: their pixel on the scan and their place (lat, lon) |
| `data/raw/edges.json` | The hand-placed waypoints of each traced border |
| `data/raw/lines-px.json` | The borders as traced on the scan (pixels) |
| `data/raw/borders-1801-1813.geojson` | The same in lon/lat |
| `data/raw/areas.geojson` | Each polity's area, and where it comes from |
| `data/khanates.geojson` | What the page reads |

## How it is drawn

1. `scripts/trace/fetch.sh` downloads the scan (git-ignored).
2. `python scripts/trace/trace.py` follows each border printed on the map between the waypoints. It takes the least-cost path along the map's brown border lines and their ochre wash, so the line is the map's, not the hand's.
3. `python scripts/trace/cut.py` places the scan on the map by the 14 towns, with a second-order polynomial. Left out one at a time, a town misses by 2.6 km on average. The script then turns the lines into lon/lat and cuts each khanate out of the land around its capital.
   - **Land, coast and outer borders:** the 1897 uezds of the Erivan, Elisabethpol and Baku governorates, plus Zaqatala, Borchalo and Kyura. Source: RISTAT, Kessler and Markevich, [doi:10.34894/NQOASN](https://doi.org/10.34894/NQOASN), CC0.
   - **Rivers:** the Kura down to Javad and the Araz below Sharur are borders too. Both come from the rivers map (OpenStreetMap).
   - **Check:** the script stops if two capitals share a piece, since that means a border is open.
   - **Needs:** numpy, shapely, pyproj, Pillow and scikit-image.
4. `node scripts/build.mjs` writes `data/khanates.geojson`.
5. `python scripts/trace/warp.py` warps the scan itself onto the web map: `data/tomkeev-1901.webp` and its corners in `data/tomkeev-1901.json`. The khanates and borders pages fade it in under the traced khanates.

What the map shows, and so the layer:

- **Karabakh** takes the whole plain between the Kura and the Araz, down to where they meet at Javad.
- **Shirvan** takes the Mughan steppe and Salyan.
- **Javad** has no separate khanate on the map, so it is drawn as a capital only.
- **Erivan** holds Shuragel (Gyumri) and, south of the Araz, Surmali.
- **Shamshadil, Kazakh, Borchali and Pambak** are Georgian lands on the map.
- **Shaki's** northern border runs a little south of the main ridge.
- **Talysh** is drawn as its northern part, the part Russia held after 1813.
- **Ilisu (with the Jar-Balakan communities), Qazax and Borchali** are drawn as their 1897 uezds, less what the traced khanates take.
- **South of the Araz** (Tabriz, Karadagh, Ardabil, Sarab, Khoy, Urmia, Maku, Maragha) **and Derbent** are shown by their capitals only, from Wikidata. Khoy and Maragha were placed by hand.

Licences:
- the table and the traced lines: CC0;
- the source map: public domain;
- the uezd geometry: CC0 (cite RISTAT);
- the rivers: © OpenStreetMap contributors, ODbL.
