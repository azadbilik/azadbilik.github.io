# Kür–Araz hövzəsi · The Kura–Araz basin

[azadbilik.org/atlas/hovze](https://azadbilik.org/atlas/hovze/) (formerly /atlas/caylar, which forwards here): 312 named rivers and 108 lakes and reservoirs of the Kura–Araz basin from OpenStreetMap (© OpenStreetMap contributors, ODbL), each river with its names in Azerbaijani, Russian and English and its length.

`data/rivers.geojson` and `data/lakes.geojson` are built by `node scripts/build.mjs` from two Overpass downloads kept out of the repository (22 MB) in `data/raw/`:

```
rivers-geom.json  [out:json][timeout:300];area["ISO3166-1"="AZ"][admin_level=2]->.az;(relation["waterway"="river"](area.az);way["waterway"="river"]["name"](area.az););out geom;
water-geom.json   [out:json][timeout:240];area["ISO3166-1"="AZ"][admin_level=2]->.az;(way["natural"="water"]["water"~"^(reservoir|lake)$"]["name"](area.az);relation["natural"="water"]["water"~"^(reservoir|lake)$"]["name"](area.az););out geom;
```

Lengths are measured along the mapped line (the Kür 1,471 km against ~1,515 in references; the Araz 1,068 against ~1,072): whole rivers (OSM relations) full length, the rest by their named pieces in Azerbaijan. Lakes held in OSM as several outer ways (Mingəçevir, Sarısu, Şəmkir…) are joined into whole rings; their computed areas only sort the list and are not shown. Rivers are drawn in OSM's direction, which is downstream, so the map's moving dashes show the flow. Rivers named in OSM only in Russian, Persian, Georgian or Armenian get their Azerbaijani name where there is an established one (Samur, Qotur, Bərzənd), else a transliteration (`AZ_NAMES` in the build).

## The whole Kür–Araz basin

`node scripts/basin.mjs` (after `build.mjs`) adds every river that flows into the Kür or the Araz, at any remove, over its whole length (≥ 10 km; 230 rivers), and the lakes and reservoirs on them abroad (Göyçə/Sevan, Arpi, Tsalka…). It reads Geofabrik extracts of Azerbaijan, Armenia, Georgia, Iran and Turkey (© OpenStreetMap contributors, ODbL), cut to the basin and kept out of the repository in `data/raw/pbf/`:

```
for c in azerbaijan armenia georgia iran turkey; do
  osmium extract -b 40.2,36.6,50.6,43.8 -o $c-basin.pbf $c.osm.pbf
  osmium tags-filter -o $c-water.pbf $c-basin.pbf w/waterway=river r/waterway=river r/type=waterway nwr/natural=water nwr/landuse=reservoir
done
osmium merge -o basin-water.pbf *-water.pbf
osmium export -f geojsonseq -a type,id -o basin-water.geojsonseq basin-water.pbf
osmium tags-filter -R -o rel.pbf basin-water.pbf r/waterway=river r/type=waterway && osmium cat -f opl -o rel.opl rel.pbf
```

A river joins the network where its mouth meets another river (a shared node, else the nearest river within 3 km: one that ends in a reservoir), or by its `destination` tag (the Hrazdan, whose lower course ends in canals). Pieces of a river with the same Wikidata id are joined. Names: OSM's Azerbaijani name, else Wikidata's, else the local name if it is in Latin letters, else English; a few Iranian rivers named only in Arabic script are given their Azerbaijani names in `AZ_FIX`.

## The network, colours and the raindrop

`node scripts/network.mjs` (after `basin.mjs`) writes `data/network.json`. For every river it records:
- the river it flows into: the longer river that one of its ends touches, within 3 km;
- where it joins;
- its *system*: the tributary of the Kür or the Araz it belongs to, at any remove;
- the total length of everything upstream of its mouth.

On the map:
- **Colour** is the system. Every system gets its own colour, as in Robert Szucs's (Grasshopper Geography) basin maps, and the Kür and the Araz have their own.
- **Width** grows with everything upstream, so a river thickens as tributaries join it.
- **Glow:** a soft glow in the same colour sits under each line.

55 rivers end in a reservoir, a canal or a lake, or meet their river outside the data, so they find no river at either end. Each forms a system of its own.

**The raindrop** (after Sam Learner's *River Runner*): tap «Raindrop» and then a river, or open a river and «Follow a raindrop to the sea». The drop takes the shortest way along that river to its mouth, then down each river it joins, to the Caspian. The panel counts the kilometres and lights each river in the chain as the drop reaches it.

