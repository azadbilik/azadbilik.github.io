# Bakı necə böyüdü · How Baku grew

[azadbilik.org/atlas/baki](https://azadbilik.org/atlas/baki/): old plans of Baku laid over today's city. Drag the divider to compare a plan with today, or fade between the two.

| Year | Plan (Wikimedia Commons, public domain) | Placed | About |
|---|---|---|---|
| 1806 | [План города Баку с показанием округ лежащей ситуации](https://commons.wikimedia.org/wiki/File:Map_of_Baku_in_1806.jpg) | by two landmarks, the Maiden Tower and the Shirvanshahs' palace (scale and rotation only) | ~40 m |
| 1894 | [План города Баку](https://commons.wikimedia.org/wiki/File:Map_of_Baku_in_1894.jpg) | automatically, streets matched to today's | ~80 m |
| 1898–1900 | [План существующего и проектированного расположения губернского города Баку](https://commons.wikimedia.org/wiki/File:Map_of_Baku_in_1898.jpg), Col. von der Nonne | automatically | ~30 m |

The 1911 master plan on Commons is a photographed book page: skewed by the camera, and it doesn't separate built streets from planned ones. It was left out.

## How a plan is placed (`scripts/autoreg.py`)

Today's streets come from OpenStreetMap (`data/raw/baku.geojson`, git-ignored). Make it with:

```sh
osmium extract -b 49.79,40.34,49.92,40.41 azerbaijan-latest.osm.pbf -o baku.pbf
osmium tags-filter baku.pbf w/highway w/railway=rail -o baku-f.pbf
osmium export baku-f.pbf -o baku.geojson
```

1. Today's streets are drawn into the plan's pixels at every rotation and scale in a range (the 1898 plan prints its own scale: 100 sazhens to the inch, about 1.07 m a pixel at 200 dpi).
2. Each drawing is cross-correlated (FFT) with the plan's streets: the white gaps between coloured blocks in 1898, the ink of block edges in 1894. The best rotation, scale and shift win.
3. In 5×5 tiles, a small local shift sharpens the fit where it clearly lines the streets up better. That gives 25 anchors in `data/gcps.json`.
4. `scripts/warp.py` turns the anchors into a thin-plate spline (two landmarks give a similarity instead). It writes `data/plan-<year>.webp` and `data/plans.json` (the corners for the web map).

Results:
- 1898: rotation −0.25°, 1.080 m a pixel, almost exactly the printed scale.
- 1894: rotation 1°, 1.365 m a pixel.

Needs numpy, scipy and Pillow. The scans go in `data/raw/plan-<year>.jpg` (git-ignored, from the links above).

## Tiles (`scripts/tiles.py`)

`scripts/tiles.py` cuts each placed plan into web-map tiles at the scan's own resolution:
- 1898 and 1894 down to zoom 17 (about 0.9 m a pixel);
- 1806 down to zoom 16.

Before cutting, the scan is cleaned:
- its levels are stretched;
- the paper of the line-drawn 1894 plan is whitened;
- its lines are lightly sharpened.

The deepest zoom is resampled straight from the scan (bicubic, the scan pre-filtered once). Each zoom above is the average of four tiles from the one below. Output goes to `data/tiles/<year>/<z>/<x>/<y>.webp` (about 12 MB in all), with bounds and zooms in `data/plans.json`. The single warped images (`data/plan-<year>.webp`) stay as a fallback.

## The page

You look at a plan in one of four ways:
- **a lens** that follows the mouse (on a phone it stays in the middle and the map moves under it; shift and scroll resize it);
- **a swipe line** that can be dragged anywhere along its length;
- **a scratch-off;**
- **a fade.**

Eight *then and now* places fly to their plan and open the lens on them. The camera leaves room for the side panel, which folds away.

## Ganja and Tabriz

- **Ganja, 1873:** the projected layout of the governorate town (approved at Livadia in 1872), hand-drawn in ink and watercolour; Russian State Historical Archive, fond 1293, op. 166, d. 2, scanned by the [Presidential Library](https://www.prlib.ru/item/766261). Its viewer serves 256 px tiles of a 15247 × 15391 px scan (`content.prlib.ru/fcgi-bin/iipsrv.fcgi`, `JTL=<level>,<n>`); level 5 (7624 × 7696) was stitched in a browser into `data/raw/plan-ganja-1872.jpg` (prlib.ru isn't reachable from every network).
  - Placed by three landmarks that stand today: the Shah Abbas mosque (block 73, no. 13), the church square «A» (the Alexander Nevsky church, built there in 1887) and the Khan's garden. A similarity fits them within 4–7 m: 0.769 m a pixel, rotated 1.83°. `autoreg.py` writes it out as a grid of anchors (`auto.fixed`, no local shifts).
  - The street match (a white top-hat picks the plan's thin streets) was tried: on its own it slid the plan ~85 m, pulled by planned quarters never built as drawn, and its local shifts scattered ±40 m, so it isn't used.
  - Accuracy about 30 m away from the landmarks. Tiles to zoom 17.
  - The faint 1873 photograph on [Commons](https://commons.wikimedia.org/wiki/File:General_plan_of_Ganja,_1873.jpg), used before, is a different, lighter draft; it was placed ~600 m wrong (by a misread mosque position).
  - Today's streets come from `data/raw/ganja.geojson` (osmium, bbox 46.28,40.63,46.44,40.73).
- **Tabriz, 1880:** the map of the city printed in Tabriz for Crown Prince Mozaffar al-Din Mirza (20 July 1880; Bonhams 2015, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:A_printed_map_of_the_city_of_Tabriz,_commissioned_by_the_Crown_Prince,_Muzaffar_al-Din_Mirza,_Qajar_Persia,_produced_at_the_Printing_House_of_Karbala%27i_Asad_Aqa_in_Tabriz,_dated_20th_July_1880.jpg), public domain; `data/raw/plan-tabriz-1880.jpg`, 3780 × 2836).
  - North is up (its compass rose); the 59° turn of the earlier street match was wrong.
  - Placed by hand-read anchors: the Ark (the walled arsenal and barracks, «قورخانه», that enclosed it under the Qajars), the bazaar (the blue-washed block of caravanserais south of the river) and two bridges over the Mehranrud, snapped to OSM's river line. A similarity fits them within 33–57 m: 2.95 m a pixel, turned 4.25° (magnetic north). The two bridges are where the Istanbul and Baghmisheh gates stand today, which agrees, though it is not an independent check. `gcps.json` keeps the four anchors (`landmarks`) and writes the fit out as a grid.
  - Accuracy about 60 m near the centre, less towards the sheet's edges. Its folds are not painted out (the seam finder smeared them). Tiles to zoom 16.
- **Tabriz, 1827:** the Russian army plan of the walled city from the year Russian troops took it ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Sahibabad_Gardens_and_Old_City_of_Tabriz_(1827_plan).jpg), public domain; `data/raw/plan-tabriz-1827.jpg`, its upper 3134 px).
  - Placed by the citadel (the Ark, outside the south wall) and the Mehranrud traced at 11 points along its course through the walls, fitted to OSM's river: a similarity, 0.60 m a pixel, turned −13.5°; the river points lie 3–43 m from today's river.
  - Check: today's bazaar, not used in the fit, falls on the plan's block of caravanserai courtyards; the municipality palace (built in the 1930s where the south gate stood) on the south wall. Accuracy about 50 m. Tiles to zoom 17.


## Absheron, 1899

- **The map:** «Карта Апшеронского полуострова Бакинской губернии и уезда», 1:42,000, compiled and published in 1899 by Dmitriev, land surveyor of the Baku Office of State Properties, printed by A. Ilyin in St Petersburg ([Library of Congress](https://www.loc.gov/resource/g7142a.ct003076/), G7142.A6G46 1899 .D5). Land boundaries by the court survey; state, disputed and private oil lands with plot numbers; gas seeps; villages, gardens, cemeteries, salt lakes; the Transcaucasian railway and the Vladikavkaz line then being built. The master TIFF (16828 × 16088, 300 dpi, about 3.6 m a pixel) is `data/raw/absheron-1899.tif` (git-ignored).
- **Placed by its graticule (`scripts/grid.py`).** The map prints a line every minute of latitude and longitude, longitudes east of Ferro (67°29′–68°2′ for the main map, 49.82°–50.37° E; a separate strip on the left edge shows 67°9′–15′, north-west towards Sumgait). The sheet was cut into 24 panels and mounted on linen; the linen between them is found by its colour, and in each panel the minute lines are found as long straight dips in brightness and counted from the printed labels. Each panel gets its own affine fit; the lines sit within 1–6 px (≤ 20 m) of it.
- **Checked against today.** At the old city of Baku (the Maiden Tower corner), the Surakhany fire temple and the Bibi-Heybat mosque, the drawing sits about 160 m east and 125 m north of where its own graticule puts them: the 1899 survey's datum. That shift (`shiftPx` in `data/gcps.json`) is applied. Accuracy about 150 m.
- **Tiles:** zoom 10–15; the title cartouche and the legend, both over the sea, are left out. The thin strips where the sheet was cut into panels (paper lost in the cut, 50–150 m) are left transparent rather than painted over.

## Bibi-Heybat, 1912 (geology)

- **The map:** «Детальная геологическая карта Апшеронского полуострова. Биби-Эйбат», by D. V. Golubyatnikov for the Geological Committee (field surveyed 1912, published St Petersburg 1914, Trudy, new series, no. 106), 1:4,200 ([Library of Congress](https://www.loc.gov/resource/g7142am.gct00388/), G7142.A6C5 s4 .G6). Strata in colour, wells, oil plots by number, the numbered sea plots of the bay filled in later, piers. The geological map is sheets A, B, C (parts I–III, north to south); the item also has a relief map, a plan of the field, structure contours, well columns and sections (in the archive folder, not on the page). Scans in `data/raw/bibiheybat-1912-{a,b,c}.tif` (git-ignored).
- **Placed by its frames (`scripts/sheets.py`).** Every sheet prints its frame's coordinates, east of Ferro: 67°28′10″–67°30′50″, A 40°21′30″–20′20″, B 20′20″–19′10″, C 19′10″–18′10″. Each sheet's four frame corners were read off the scan and the sheet mapped bilinearly between them (taking out a scan's small skew); the three are joined into one image in those coordinates (`data/raw/bibiheybat-1912.jpg`, git-ignored), which `tiles.py` places as a single 'grid' panel. A's title over the sea and C's legend are left out.
- **Checked:** Cape Shikh's tip lands within 70 m of where the corrected 1899 map puts it, so no datum shift is applied (unlike 1899). Accuracy about 70 m.
- **Tiles:** zoom 13–18 (≈0.45 m a pixel at 18, close to the scan's 0.36 m), 21 MB.

## Bibi-Heybat, 1912 (the oil stratum)

- **The map:** «Пластовая карта Биби-Эйбата», Golubyatnikov, 1:8,400, from the same Library of Congress item: how deep the productive stratum lies, coloured from 100 sazhens (≈213 m, brown) to 270 (≈576 m, green). Its dome runs under the Bibi-Heybat bay.
- **Placed by the geological sheets' frame (`scripts/sheets.py`, key `bibiheybat-strata-1912`):** its frame carries no labels, but it is the frame of sheets A + B (67°28′10″–67°30′50″, 40°21′30″–40°19′10″) at exactly half their scale (32.8 / 42.9 px a second against 65.8 / 86.0), with the same spot height (47.6) and a red mark in its top-left corner. Same accuracy as the geology, about 70 m.
- **Tiles:** zoom 13–17, 6 MB. The page's year buttons now take per-language labels («1912 geol.», «1912 strata»).

## Bibi-Heybat, 1912 (relief)

- **The map:** «Гипсометрическая карта Биби-Эйбата», Golubyatnikov, 1:16,800, same Library of Congress item: heights in sazhens by colour, 0 = the Black Sea's level, −12.21 = the Caspian's, up to 88 sazhens (≈188 m).
- **Placed by its frame (`scripts/sheets.py`, key `bibiheybat-relief-1912`):** the top-left corner is labelled 67°28′10″ / 40°21′30″ and a corner tick 67°30′40″ / 40°18′10″ (16.3 / 21.2 px a second, a quarter of the geological sheets'). The legend inside the frame is left out. Cape Shikh's tip lands 34 m W, 14 m S of the geological map's. Tiles zoom 13–16, 1 MB.
