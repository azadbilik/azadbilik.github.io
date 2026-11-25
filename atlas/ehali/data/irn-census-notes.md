# Iranian Azerbaijan census populations: notes

Files: `irn-census.csv` (55 counties), `irn-census-provinces.csv`. Sums and cross-checks were done by script. No guessed or interpolated values.

## Sources actually used

| Year | Source | Reliability |
|---|---|---|
| 2016 | Statistical Centre of Iran (SCI) "Population and Households" xlsx, hosted by Iran Data Portal (IDP) | Official. County sums equal province totals. |
| 2011 | SCI settlement-level files hosted by IDP (`East-Azerbaijan.xls`, `West-Azerbaijan.xls`, `Ardabil.xls`, `Zanjan.xls`), county rows | Official. Equal to the English Wikipedia 2011 column and to citypopulation.de. |
| 2006 | English Wikipedia province pages (county table citing SCI 2006) | See caveat below. |
| 1996 | statoids.com/yir.html, list "counties at the time of the 1996 census" culled from SCI | Not on the preferred list. County sums equal the province totals on citypopulation.de exactly, and the national sum is 60,055,488, the official total. |
| 1976 | IDP `1976-census.pdf` (scan), tables 6, 7 and 21 | Official, read by eye from the scan. Every figure was checked as male + female and against the province total. |
| 1956 | IDP `1956-census-.pdf` (scan), tables 1 and 5 | Official, but table 5 is an estimate (see below). |
| 1966, 1986 | IDP scans | No county data in them (see below). |

- amar.org.ir could not be reached from this environment (connection fails), so SCI data came through IDP and the Wikipedia citations.
- IDP's 2006 province PDFs (`azerbaijan-sharghi.pdf` etc.) render blank, so they are unusable.
- IDP's 2011 and 2016 pages carry no county tables for 1996 or 1986.

## Corrections to the boundary file

- Miandoab is in West Azerbaijan, not East Azerbaijan (the centroid grouping was wrong). Everything else is in the right province.
- The boundary file's spelling maps to SCI names as follows: Ashnavieh = Oshnavieh, Naghadeh = Naqadeh, Urumia = Urmia, Shahindezh = Shahin Dezh, Showt = Shout, Khoramdareh = Khorramdarreh, Soltanieh = Soltaniyeh, Garmi = Germi, Kahlkhal = Khalkhal, Kosar = Kowsar, Ardebil = Ardabil county, `Chaldoran County` = Chaldoran, Nir = Nayer.
- The file's 55 counties are the 2016 counties (before the post-2016 splits Hurand, Leylan, Torkamanchay, Baruq, Chaharborj, Mirabad, Aslan Duz and Ungut). The 2016 figures match this area. Those eight later counties are not in the file and not in the CSV.

## Rule used for splits

- A county cell is empty when the county did not exist at that census.
- It is also empty when a later child county took 10% or more of the pre-split area's population, so the figure is not "roughly today's area".
- A parent whose child took less than 10% is kept. Example: Ardabil county 2006 includes Sareyn (18,231, 3.4%).
- Pre-split combined figures are listed below. They are not split.

### Counties formed after the first censuses

| County | Formed | Years left empty | Notes |
|---|---|---|---|
| Khoda Afarin (from Kaleybar) | 2010 | 2006 and earlier | Kaleybar 2006 = 87,259 includes it. 2011: Kaleybar 48,837 plus Khoda Afarin 34,977 = 83,814. Kaleybar is empty for 2006 and 1996. |
| Chaypareh (from Khoy) | 2007 | 2006 and earlier | Khoy 2006 = 365,573 includes it (child 11.8%). Khoy is empty for 2006 and 1996 (323,194 includes it). |
| Poldasht, Showt (from Maku) | 2007 | 2006 and earlier | Maku 2006 = 174,578 includes both (2011 values sum to 183,453). Maku is empty for 2006 and 1996 (202,939 also includes Chaldoran). |
| Sareyn (from Ardabil county) | 2009 | 2006 and earlier | Ardabil 2006 = 542,930 includes it and is kept (3.4%). |
| Soltaniyeh (from Abhar) | 2013 | 2011 and earlier | The 2016 figures are post-split. Abhar 2011 = 169,176 includes Soltaniyeh. 2016: Abhar 151,528 plus Soltaniyeh 29,480 = 181,008. Soltaniyeh is 16% of that, so Abhar is empty for 2006 and 2011. |
| Ajabshir, Azarshahr, Charuymaq, Osku, Varzaqan, Kowsar, Namin, Nir, Chaldoran, Oshnavieh, Ijrud, Khorramdarreh, Mahneshan, Tarom | 1996-2002 (per SCI via statoids; no exact dates found) | 1996 and earlier | Parents not documented in the sources; see the 1996 section. |
| Jolfa (from Marand), Malekan (from Bonab) | before 1996 | before 1996 | Only 1996 and later exist. |

## 1996

- Included (20): Bilehsavar, Bostanabad, Bukan, Heris, Jolfa, Khodabandeh, Mahabad, Malekan, Marand, Meshkinshahr, Miandoab, Mianeh, Parsabad, Piranshahr, Salmas, Sarab, Sardasht, Shabestar, Takab, Urumia.
- Test used: no documented post-1996 split from that county, and growth to 2006 consistent with its province. Takab (1.04 against about 0.87 expected) and Bilehsavar are the loosest passes.
- The parents of Azarshahr, Osku, Kowsar, Namin, Nir, Oshnavieh, Ijrud, Khorramdarreh, Mahneshan, Tarom are not stated in any source I could reach. I inferred them from the 1996 against 2006 totals. A few included counties (Shabestar, Sarab, Mianeh, Bostanabad, Heris) may have given up small areas.
- Left empty because they are parents of later splits. Raw 1996 figures:

| County | 1996 figure | Reason |
|---|---|---|
| Ahar | 198,028 | Includes Varzaqan. 2006 Ahar 147,781 + Varzaqan 46,833 = 194,614. |
| Tabriz | 1,486,509 | Rural part clearly larger than later (probably Osku and Azarshahr). |
| Maragheh | 277,216 | Ajabshir. |
| Bonab | 112,985 | Ajabshir (you named it). Growth is normal, so the loss may be small. |
| Hashtrud | 120,406 | Charuymaq. |
| Kaleybar | 92,260 | Khoda Afarin. |
| Ardebil | 563,477 | Namin, Nir, Sareyn. |
| Germi | 104,064 | Kowsar. |
| Khalkhal | 137,992 | Kowsar. |
| Maku | 202,939 | Chaldoran, Poldasht, Showt. |
| Khoy | 323,194 | Chaypareh. |
| Naqadeh | 162,228 | Oshnavieh. |
| Zanjan | 537,517 | Ijrud, Mahneshan, Tarom, Khorramdarreh. |
| Abhar | 200,305 | Khorramdarreh, Soltaniyeh. |
| Shahindezh | 104,598 | Falls to 89,356 in 2006 while West Azerbaijan grew 15%, so there was an unexplained boundary loss. Left empty. |

- Takestan (135,983) was part of Zanjan province at the 1996 census and left for Qazvin province on 1996-12-31. It is not a county of the map.

## Gaps

- **1986:** no county or province figures found. The IDP 1986 file is "Selected Tables", national totals and percentages only, with no ostan population counts. The cell is empty for all units.
- **1966:** the IDP file has only ostan, farmandari-kol and city tables, no shahrestans. The three province-level totals are in the province CSV.
- **1976 (4 county cells):** Urumia (Rezaiyeh) 369,435, Salmas (Shahpur) 87,912, Sardasht 54,315, Piranshahr (Khaneh) 59,696.
  - These are provisional. Area continuity is inferred from growth consistent with 1996 and 2006, not documented.
  - 1976 shahrestans were mostly much larger than today's counties.
  - Left empty (raw 1976 figure, reason):
    - Tabriz 1,074,173, includes Shabestar, Osku, Azarshahr, etc.
    - Ardabil 369,010.
    - Ahar 296,984.
    - Maragheh 309,729.
    - Marand 189,903, includes Jolfa.
    - Mianeh 199,232.
    - Hashtrud 174,876.
    - Moghan 174,053 (Parsabad, Bilehsavar).
    - Khalkhal 156,456.
    - Meshkinshahr 128,022.
    - Sarab 122,105.
    - Mahabad 196,812, includes Bukan.
    - Miandoab 231,153, includes Takab and Shahin Dezh.
    - Khoy 188,274.
    - Maku 124,916.
    - Naqadeh 92,362.
    - Zanjan 339,011.
    - Khodabandeh 122,917.
    - Abhar 117,072.
  - Mianeh was read as 199,232 (male 102,290 + female 96,942), which makes the East Azerbaijan total 3,194,543 check.
- **1956 (2 county cells):** Urumia (Rezaiyeh) 202,205 and Salmas (Shahpur) 47,163.
  - These are SCI "estimated 1956 population of shahrestans as reconstituted in 1959" (table 5), the census redistributed to 1959 boundaries, not a raw count.
  - The same table gives Khoy 113,448, Mahabad 162,511, Maku 85,129, Miandoab 49,682 and Naqadeh 58,885, all left out as non-comparable.
  - The 1956 East Azerbaijan shahrestans (Tabriz 627,110, Ardabil 231,491, etc.) are far larger than today's counties, so they are left out.
  - Zanjan shahrestan (386,201) was inside Gilan census province and is not a province total.
- **Zanjan province:** no 1966 or 1956 total. It was part of Gilan.

## 2006 caveat

- The Wikipedia county values sum to less than the official provincial totals:

| Province | Wikipedia county sum | Official total | Gap |
|---|---|---|---|
| East Azerbaijan | 3,527,267 | 3,603,456 | -2.1% |
| West Azerbaijan | 2,831,779 | 2,873,459 | -1.5% |
| Ardabil | 1,209,968 | 1,228,155 | -1.5% |
| Zanjan | 942,818 | 964,601 | -2.3% |

- Most likely the Wikipedia figures are household population, which excludes institutions. This is unconfirmed, because the SCI 2006 tables could not be fetched. Treat the 2006 county values as about 2% low.
- The 2011 and 2016 county sums equal the province totals exactly.
- The province CSV uses the official 2006 totals from citypopulation.de.

## Other doubts

- Osku jumps from 98,988 (2011) to 158,270 (2016). Cause not found; it is not a documented boundary change.
- Abhar 2016 drops (169,176 to 151,528) only because of the 2013 Soltaniyeh split.
- Kaleybar 2011 is post-split and 2016 is consistent.

## Province totals

- **Boundaries:** 1996, 2006, 2011 and 2016 totals are in the borders of the day, with Ardabil province (created 1993) separate. For 1996 and 2006 the citypopulation.de figures are SCI recomputed to present borders. Zanjan 1996 = 900,890 excludes Takestan. As enumerated in 1996, with Takestan, it was 1,036,873.
- **Pre-1993 East Azerbaijan:** it included Ardabil. The rows `East Azerbaijan (incl. Ardabil)` give a continuous series for 1956-2016. Values for 1996 and later are computed by script as East Azerbaijan plus Ardabil.
- **Zanjan 1976:** 579,000 is the Zanjan ostan of three shahrestans (Zanjan, Khodabandeh, Abhar). Takestan was not in it, so it is comparable with the present province but not exact.
- **West Azerbaijan 1956:** 721,136 is the census province total; the 1959-reconstituted shahrestans sum to 719,023.
- **1986:** no data.
