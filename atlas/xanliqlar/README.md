# Xanlıqlar · The khanates of Azerbaijan, c. 1800

[azadbilik.org/atlas/xanliqlar](https://azadbilik.org/atlas/xanliqlar/): the khanates and sultanates of the late 18th century, with their capitals and the year each passed to Russia. **The borders are approximate** and the page says so.

| File | What |
|---|---|
| `data/khanates.json` | The table: each polity's names (az, ru, en), capital, year Russia took it, the 1897 uezds it is drawn with (one uezd, one polity) or its OpenHistoricalMap outline, and a short note in three languages |
| `data/raw/ohm-khanates.geojson` | OpenHistoricalMap's outlines of the Erivan (relation 2958070) and Nakhchivan (2958068) khanates, CC0 |
| `data/khanates.geojson` | What the page reads, built by `node scripts/build.mjs` |

## How it is drawn

- North of the Araz, each khanate is the union of the 1897 uezds the Russian administration made from its lands (boundaries: RISTAT, Kessler and Markevich, [doi:10.34894/NQOASN](https://doi.org/10.34894/NQOASN), CC0). Which uezd came from which khanate is Azad Bilik's estimate; the notes say where it is wrong (the Baku uezd is larger than the khanate; part of Karabakh's Barda–Aghdam plain lies outside its uezds; Talysh's southern part stayed in Iran; Javad's uezd takes in Salyan, then Quba's).
- Erivan and Nakhchivan are OpenHistoricalMap's outlines, traced from a small map: schematic, and Erivan's reaches too far west. They are drawn under the uezd-made shapes where the two overlap.
- South of the Araz (Tabriz, Karadagh, Ardabil, Sarab, Khoy, Urmia, Maku, Maragha) and Derbent: capitals only, from Wikidata (Khoy and Maragha placed by hand).
- Proper outlines need tracing by hand from early-19th-century maps (the public-domain 1901–1902 Russian maps of the Caucasus would keep the layer CC0).

Licences: the table is CC0; the uezd geometry CC0 (cite RISTAT); OpenHistoricalMap CC0.
