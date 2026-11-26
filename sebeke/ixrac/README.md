# Ixrac · Azerbaijan's export product space

[azadbilik.org/sebeke/ixrac](https://azadbilik.org/sebeke/ixrac/): the Atlas of Economic Complexity's product space (865 HS92 4-digit goods) with the products a country exports competitively (RCA ≥ 1) lit up, a 1995–2024 year slider, a switch between Azerbaijan, Georgia, Kazakhstan, Uzbekistan and Türkiye, a ranked list of "nearby opportunities", and the oil-and-gas share of exports over time. AZ, RU, EN.

| File | What |
|---|---|
| `index.html` | The page (canvas graph, plain JS, no library) |
| `data/ixrac.json` | What the page reads (2.2 MB), built by `scripts/build.mjs` |
| `scripts/build.mjs` | Reads the Growth Lab CSVs, writes `data/ixrac.json` |
| `og.png` | Share card |

## Sources (all CC0 1.0, Harvard Dataverse, The Growth Lab at Harvard University)

- International Trade Data (HS, 92), [doi:10.7910/DVN/T4CHWJ](https://doi.org/10.7910/DVN/T4CHWJ), V18: `hs92_country_product_year_4.csv` (export value, RCA, distance, COG per country-product-year), `hs92_product_year_4.csv` (world trade, PCI), `hs92_country_year.csv` (totals, ECI). Underlying data: UN Comtrade, cleaned by the Growth Lab.
- Product Space Networks, [doi:10.7910/DVN/FCDZBN](https://doi.org/10.7910/DVN/FCDZBN), V4: `umap_layout_hs92.csv` (positions, 8 clusters), `top_edges_hs92.csv` (2,158 links after de-duplication).
- Classifications Data, [doi:10.7910/DVN/3BAL1O](https://doi.org/10.7910/DVN/3BAL1O), V12: `product_hs92.csv` (names, natural-resource flag).

## Rebuilding

```bash
mkdir /tmp/ixr && cd /tmp/ixr && D=https://dataverse.harvard.edu/api/access/datafile
curl -sL -o cpy4.csv $D/13685110; curl -sL -o py4.csv $D/13685116; curl -sL -o cy.csv $D/13685109
curl -sL -o edges.csv $D/13438220; curl -sL -o layout.csv $D/13438222; curl -sL -o product_hs92.csv $D/13438093
RAW=/tmp/ixr node scripts/build.mjs      # from this folder
```

## Method

- Nothing is recomputed from raw trade: RCA, distance, COG and PCI are the Atlas's own values. The page selects and ranks them.
- Lit = RCA ≥ 1. Closeness shown = 1 − distance (Hausmann–Hidalgo density, as the Growth Lab defines "distance"; not independently verified here).
- Opportunities: products with RCA < 1, optionally without natural-resource goods and above a world-trade floor (default US$1 bn). "Balanced" = mean percentile of closeness, PCI and COG among candidates: our simple choice, not the Atlas's strategy measure. A model, not a forecast.
- Oil and gas = HS 2709 + 2710 + 2711 over total goods exports of the country-year table.
- Values: export value in US$ million (0.1), RCA ×100, distance/COG/PCI ×1000 as integers in the JSON.

## Caveats

- Early years for post-Soviet countries are patchy (Azerbaijan 1995 exports US$0.11 bn in the Atlas); read the 1990s as approximate. The latest year may be revised.
- RCA ≥ 1 can be met by products with tiny export values.
- Product names are the Growth Lab's English ones; clusters and sectors are translated.
- Goods only, no services.
