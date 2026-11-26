# The Safavid empire, c. 1700

The opening steps of [the borders story](https://azadbilik.org/atlas/serhedler/hekaye/) use this outline of the Safavid empire around 1700 and its three governorships north of the Araz. The outline is **approximate**, and the page says so.

## Source map

Guillaume Delisle, «Carte de Perse», Paris 1724 ([Wikimedia Commons](https://commons.wikimedia.org/wiki/File:1724_De_L%27Isle_Map_of_Persia_(Iran,_Iraq,_Afghanistan)_-_Geographicus_-_Persia-delisle-1724.jpg), public domain).
- **Placing it:** 21 towns in `data/raw/delisle-gcps.json` (pixel x, y, lat, lon). The fit is a smoothed thin-plate spline, the usual "rubber sheet" for old maps. Left out one at a time, a town lands 84 km off on average, which is a 1724 map's own error.
- **The overlay:** `data/delisle-1724.webp`, the scan warped onto the web map, with its corners in `data/delisle-1724.json`. It fades in behind the opening step.

## What the outline is made of

Delisle hand-coloured some provinces (Kandahar, Kerman, Georgia, Erivan, Iraq-Ajam) but never the empire as a whole, so the outline in `data/safavid-1700.geojson` is put together in parts. The file names each part:

| Part | From |
|---|---|
| The eastern frontier: Kandahar province against Mughal Kabul and Multan, and down to Makran | Traced from Delisle's pink border of Kandahar province |
| Khorasan's north: the Kopet Dagh, Sarakhs, and Merv held as an outpost | Drawn from what is documented; Delisle's lines here fell in the Karakum once placed |
| The Ottoman side and the Caucasus | Drawn from what is documented: the Treaty of Zuhab line (1639), which today's Iran–Iraq and Iran–Turkey borders largely follow, with the eastern Georgian kingdoms (Kartli, Kakheti: Safavid vassals) and Derbent inside |
| The coasts | Natural Earth land, 1:50m, public domain |

**The governorships** (beglarbegiliks) north of the Araz are unions of the khanates traced from Tomkeev's 1901 map (`../../xanliqlar`). The khanates grew out of them, so the outlines are close but not the same:
- **Shirvan** (seat Shamakhi): Shirvan, Shaki, Quba, Baku.
- **Karabakh** (seat Ganja): Karabakh, Ganja, Qazax.
- **Chukhur-Saad** (seat Erivan): Erivan, Nakhchivan.

Talysh and Javad are left out, because which governorship they answered to changed. Azerbaijan (Tabriz) is shown by its capital only.

`python scripts/build.py` (numpy, scipy, shapely, Pillow) rebuilds everything. It needs `data/raw/delisle-1724.jpg` and `data/raw/ne_50m_land.geojson`, both git-ignored and downloadable from the links above.

Licences: the outline and the governorships are CC0; the source map is public domain; Natural Earth is public domain.
