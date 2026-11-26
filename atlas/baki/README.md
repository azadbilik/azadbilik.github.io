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

Five *then and now* places fly to their plan and open the lens on them. The camera leaves room for the side panel, which folds away.

## Ganja and Tabriz

- **Ganja, 1873** ([Commons](https://commons.wikimedia.org/wiki/File:General_plan_of_Ganja,_1873.jpg), from the State Historical Archive of Azerbaijan):
  - It's a faint photograph of the plan, so the automatic match alone slid it about 130 m.
  - Its rotation and scale come from the street match: −2.75°, 2.12 m a pixel. That run also weighted the Ganjachay river.
  - Its position is pinned by the plan's open square at the Shah Abbas mosque.
  - Accuracy about 120 m.
  - Today's streets come from `data/raw/ganja.geojson` (osmium, bbox 46.28,40.63,46.44,40.73).
- **Tabriz** was tried with the 1880 map printed for Crown Prince Mozaffar al-Din and left out:
  - The match turned it 59°, and nothing but the core around the Ark could be confirmed.
  - The old city was rebuilt too much for street matching. It needs hand-read anchors: the Ark, the Blue Mosque, the bazaar, the bends of the Mehranrud.
  - The 1827 Russian army plans of the walled city would need the same.

