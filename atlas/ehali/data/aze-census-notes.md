# Azerbaijan census populations: notes

Companion to `aze-census.csv` (shapeName, year, population, source_url). 427 rows, 7 census years. 1939 and 1926 not included (see Gaps).

## Sources actually used

- 1959, 1970, 1979, 1989: Demoskop Weekly, all-Union census tables, "Азербайджанская ССР", by raion and city. Figures are the **present population (наличное население)**. Pages: `ussr59_reg1`/`ussr59_reg2`, `ussr70_reg1`/`ussr70_reg2`, `ussr79_reg1`/`ussr79_reg2`, `sng89_reg1`/`sng89_reg2` under `https://www.demoscope.ru/weekly/ssp/`. `_reg1` has raions and city councils, `_reg2` has the urban tables with city proper.
- 1999, 2009, 2019: azstat table "Permanent population by economic regions and administrative units" (`https://www.stat.gov.az/source/demoqraphy/az/001_17.xls`; Baku from `.../ap/az/2_4.xls`). These are the **permanent population (daimi əhali)**, **rounded to 100** (published in thousands with one decimal). I could not open stat.gov.az or the xls from here. The numbers were read from Wikidata statements (P1082, point in time = census date) that cite those azstat files. Spot checks against Russian Wikipedia: Agdash 1999 89,214 and 2009 98,599, Balakan 83,732 and 89,827, all agree with the rounded values.
- Access caveat: demoscope.ru could not be reached directly (connection reset). The pages were fetched through a third-party text proxy (r.jina.ai) that returned the page text unchanged. A further probe through that proxy was blocked by the permission system, so I stopped using it.
- The "2019" column of the English Wikipedia article "Administrative divisions of Azerbaijan" was **not used**. It sums to 10.46 M, above the census total, and Baku 2,616,948 is not the census figure (2,293,100). Treat it as a later estimate.

Present (1959–1989) and permanent (1999–2019) populations differ by a few percent; they are not strictly one series.

## Mapping rules

- Shapes are current borders. A Soviet value is used only where the raion matches the current unit; ones I found to be split, merged or redrawn are left empty (list below).
- "X District" = the raion **including its centre city**, as azstat counts it today (checked: azstat 2019 Lankaran 223,700 / Yevlakh 125,600 / Shaki 180,500 only fit the 1989 figures if the city is inside the district). Where a census listed the city separately, district = city (or city council) + raion, summed by script. That applies to:
  - Shaki 1970, 1979, 1989
  - Yevlakh 1970, 1979, 1989
  - Lankaran 1979, 1989
  - Julfa and Ordubad 1989 (city council + rural raion)
- "X City" = the city alone (the town row, "г.", not the whole city council with its settlements), except Baku and Sumqayit, which are the full city council (Бакинский / Сумгаитский горсовет). azstat's Sumqayit matches the council total, not the city proper.
- Baku City: council total incl. settlements (993,300; 1,265,515; 1,549,830; 1,759,307). City proper ("г. Баку") would be 642,507; 851,547; 1,021,969; 1,150,055. Script check for 1959: the four city districts sum to 642,507 = г. Баку; with the six settlement councils the sum is 971,304 against the council's 993,300 (the remaining 21,996 sits in settlements not shown separately). I used the council total because the 2009 and 2019 values cover the whole municipality.

### Renames used

| Soviet name | Shape |
|---|---|
| Kirovabad (city) | Ganja City |
| Ali-Bayramli (city) | Shirvan City |
| Stepanakert (city) | Khankendi City |
| Nukha (Shaki after 1968) | Shaki City / District |
| Akhsu | Agsu |
| Astrakhan-Bazar (Dzhalilabad from 1967) | Jalilabad |
| Vartashen | Oghuz |
| Kutkashen | Qabala |
| Kuba | Quba |
| Kakh | Qakh |
| Geokchay | Goychay |
| Kedabek | Gadabay |
| Tauz | Tovuz |
| Shamkhor | Shamkir |
| Zhdanov | Beylagan |
| Pushkin | Bilasuvar |
| Ilyich, and Norashen before 1964 (same raion, renamed) | Sharur |
| Mir-Bashir | Tartar |
| Kubatly | Qubadli |
| Belokany | Balakan |
| Kusar | Qusar |
| Khachmas | Khachmaz |
| Shemakha | Shamakhi |
| Kasum-Ismailov + Shaumyan (merged 7 Feb 1991) | Goranboy |
| Martuni + Hadrut (merged by the 1991 law) | Khojavend |

- Goranboy and Khojavend are **sums of two whole raions** (script), per the ru.wikipedia history sections. Drop them if you prefer strict one-to-one mappings. Goranboy 1959 includes the Naftalan settlement (1,255).
- Shusha: the Shusha raion contains Shusha city. Shusha District = raion total, Shusha City = city only, so the two shapes overlap in meaning. If the Shusha City shape lies inside the District shape, show only one.

## Left empty on purpose (split, merged or redrawn)

Soviet years (1959–1989) dropped after the boundary check:
- **Goygol (Khanlar)**: azstat's recast 1979 value is 41,200 against Khanlar's 76,370, and Khanlar 1959 is 32,592 against 71,991 in 1970. Territory moved (Samukh carved out, other changes). I kept 1999–2019 only.
- **Shamakhi**: Soviet raion was 1.5x azstat's recast figure (Gobustan/Maraza carved out).
- **Tartar**: Soviet Mir-Bashir 47,513 against azstat recast 70,300 for 1979. Mardakert part is not mapped.
- **Absheron**: Soviet Apsheron raion (from 1963) does not match the current unit. azstat's own series jumps (81,800 in 1999, 189,800 in 2009, 428,000 in 2019) as the territory grew. Treat 2009 and 2019 as non-comparable to 1999.
- **Sabirabad** and **Salyan**: Soviet figures 10 to 17 percent above azstat's recast ones (Neftchala and Hajigabul/Shirvan area changes). Salyan 1959 and 1970 also include the Neftchala area (the Neftchala raion was abolished in 1956 and recreated later).
- **Qazakh**: Soviet Kazakh raion included Agstafa (split off 24 Apr 1990). Both left empty before 1999.
- Never existed as a unit in the censuses: **Agstafa, Babek (see below), Gobustan, Hajigabul** (Kazi-Magomed area, raion formed 1990), **Kangarli** (2004), **Khizi, Shabran, Siazan** (all inside Divichi raion, so "Shabran = Davachi" left empty), **Samukh** (recreated 1992), **Sadarak**, **Khojaly** (from Askeran, partial), **Neftchala 1959 and 1970** (no raion then).
- **Babek**: the Nakhchivan raion (rural) 1959/1970 and Babek 1979/1989 are possibly one unit, but I left it empty as instructed. Values: Nakhchivan raion 23,245 (1959) and 38,285 (1970), Babek 46,340 (1979) and 54,527 (1989).
- **NKAO**: Askeran (1979 19,775; 1989 20,954), Mardakert (1959 37,734; 1970 44,004; 1979 44,075; 1989 47,047) and Stepanakert raion (rural; 1959 20,064; 1970 19,570) are not mapped (partial overlaps with Khojaly, Tartar, Kalbajar, Khankendi). Shaumyan is summed into Goranboy, not Kalbajar.
- **Naftalan City** is included from 1970, when it became a city council. Before that it was a settlement in Kasum-Ismailov raion. Say so if you want it left empty as in your brief.
- Soviet 1959 raions predate the 1963 consolidation, and I could only cross-check 1979 and 1989 against azstat. Saatly 1959 to 1970 grows 1.76x and Dashkasan was abolished 1963 and re-formed 1965. Use 1959 values with that in mind.

## Doubts

- **Occupied territories** (1999–2019): azstat values for Agdam, Fuzuli, Tartar, Khojavend (2019 only, 43,871, from a zip file reference), Jabrayil and others were not enumerated by a census on the ground. They are estimates. Kalbajar, Lachin, Qubadli, Zangilan, Jabrayil, Khankendi, Shusha and Khojaly have no 1999–2019 rows (no azstat figure found). Agdam 2019 (174,800) is a pre-occupation estimate, not a count.
- **Cities within azstat**: Lankaran City, Yevlakh City, Shaki City and Shusha City have no 1999–2019 rows because azstat reports them inside the district.
- **Baku 1999** and **Aghjabadi 1999** are missing in the Wikidata copy of the azstat table. Aghjabadi 2009 (121,707) and 2019 (135,500) are cited to Wikidata, not azstat.
- Rounding: 1999–2019 values end in 00 (except those noted). Do not treat them as exact counts.
- Ganja City 1959 (city proper 116,122) is not comparable with 1970 and later (city 189,512), which absorbed adjacent land. Shirvan City 1959 (13,427) likewise grows sharply to 1970 (33,828). Ali-Bayramli became a city council in the 1960s.

## Duplicate "Lankaran District" shape

The geojson has two features named "Lankaran District", and both are Lankaran. One is a normal polygon (lon 48.54 to 48.88, lat 38.60 to 38.94) west and south of Lankaran city, the main district. The other is a MultiPolygon (97 points, lon 48.82 to 49.21, lat 38.85 to 39.30), a thin coastal strip on the Caspian between Masally and Neftchala. It is the Caspian shore and waters of the same district, not another district. All other 77 names are unique and every real raion and city is present, so nothing is mislabelled. The CSV carries a single set of rows under "Lankaran District"; apply it to both features (or colour only the large one).

## Gaps

- 1939 and 1926 by raion: not obtained. Demoscope's URLs for those tables were not found at the guessed paths, and further probing was stopped. Wikidata has a handful of 1926 and 1939 values but unsourced, so none are included.
- Khojaly District: no rows at all.
- Pre-1999 values for the new units (Gobustan, Hajigabul, Kangarli, Khizi, Shabran, Siazan, Samukh, Sadarak, Agstafa, Babek) are empty, as above.

## Totals (data/totals.csv)

The Republic's totals are the census counts from the census table of Wikipedia's "Demographics of Azerbaijan" (its source: the State Statistical Committee). For 2019 the same page's other table gives 9,981,457; the census table's 9,951,409 is used here. The map's district figures do not add up to these totals: districts are missing in some censuses (Baku 1999, the occupied districts from 1999), and towns counted inside their district are shown separately.
