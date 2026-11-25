# Çaylar · Rivers and lakes of Azerbaijan

[azadbilik.org/atlas/caylar](https://azadbilik.org/atlas/caylar/): 155 named rivers and 35 lakes and reservoirs of Azerbaijan from OpenStreetMap (© OpenStreetMap contributors, ODbL), each river with its names in Azerbaijani, Russian and English and its length.

`data/rivers.geojson` and `data/lakes.geojson` are built by `node scripts/build.mjs` from two Overpass downloads kept out of the repository (22 MB) in `data/raw/`:

```
rivers-geom.json  [out:json][timeout:300];area["ISO3166-1"="AZ"][admin_level=2]->.az;(relation["waterway"="river"](area.az);way["waterway"="river"]["name"](area.az););out geom;
water-geom.json   [out:json][timeout:240];area["ISO3166-1"="AZ"][admin_level=2]->.az;(way["natural"="water"]["water"~"^(reservoir|lake)$"]["name"](area.az);relation["natural"="water"]["water"~"^(reservoir|lake)$"]["name"](area.az););out geom;
```

Lengths are measured along the mapped line (the Kür 1,471 km against ~1,515 in references; the Araz 1,068 against ~1,072): whole rivers (OSM relations) full length, the rest by their named pieces in Azerbaijan. Lakes held in OSM as several outer ways (Mingəçevir, Sarısu, Şəmkir…) are joined into whole rings; their computed areas only sort the list and are not shown. Rivers are drawn in OSM's direction, which is downstream, so the map's moving dashes show the flow. Rivers named in OSM only in Russian, Persian, Georgian or Armenian get their Azerbaijani name where there is an established one (Samur, Qotur, Bərzənd), else a transliteration (`AZ_NAMES` in the build).
