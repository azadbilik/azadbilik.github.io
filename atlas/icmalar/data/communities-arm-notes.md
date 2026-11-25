# Azerbaijanis in Armenian SSR by raion: notes

Source: https://ethno-kavkaz.narod.ru/rnarmenia.html (1926 uezd/volost pages linked from it; the page's own sources: RGAE f.1562 op.336; 1926 census vol. 14; "Narody Rossii" 1994). All numbers were parsed by script from the page. Figures were not cross-checked: demoscope.ru did not answer (connection closed / no HTTP reply), and I did not try other routes around it.

## Path
The brief named `xeriteler/icmalar/data/`; that folder no longer exists (the geojson now sits in `atlas/icmalar/data/raw/`). Files were written to `atlas/icmalar/data/`.

## What the source has
- 1939: Azerbaijanis and total for 38 raions plus Yerevan and Leninakan. This is the only census with raion-level data on the site.
- 1926: only uezd totals and volosts (Soviet raions did not exist yet). Not mapped to shapes; cells left empty. Uezd values (Azerbaijanis/total): Erivan excl. city 19,071/114,039; Daralagyaz 5,941/30,074; Dilijan 8,181/78,665; Zangezur 4,433/68,918; Leninakan 147/166,793; Meghri 1,201/8,139; Nor-Bayazet 14,065/101,570; Pambak-Lori 10,616/133,148; Echmiadzin 8,247/114,505; Yerevan city 5,216/67,121. Uezd sums are 77,118 / 882,972 against the republic row 76,870 / 878,929 (source inconsistency, 248 and 4,043 apart).
- 1959, 1970, 1979, 1989: republic totals only, plus Yerevan (1959, 1979) and Leninakan (1959). No raion figures anywhere I could reach. All raion cells for these years are empty; Yerevan has rows for 1926, 1939, 1959, 1979. No Yerevan figure for 1970 or 1989 on the site.
- 1926 "тюрки" is used as Azerbaijanis.
- 1939 raion rows (incl. Yerevan, Leninakan) sum to 130,676 / 1,280,009 vs the republic row 130,896 / 1,282,338; the source omits about 220 Azerbaijanis. Unexplained.

## Renames and mapping (1939 name -> shape)
Verified against the English Wikipedia table "Administrative divisions of the Armenian SSR" (https://en.wikipedia.org/wiki/Administrative_divisions_of_the_Armenian_Soviet_Socialist_Republic) and Russian Wikipedia pages on the districts:
- Basarkechar -> Vardenis, 1969 (also ru.wikipedia Варденисский район: renamed 1969).
- Vedi -> Ararat, 1968 (Russian Wikipedia: renamed 15 May 1968; the English table says Vedi 1930-1968; the raion was abolished 1962, restored 1964).
- Zangibasar -> Masis: the English table gives Zangibasar 1937-1953, abolished 1953, restored 1969 as Masis. The brief's "renamed 1969?" is only partly right: the raion was abolished and re-created.
- Akhta -> Hrazdan, 1959.
- Nor-Bayazet -> Kamo 1959 (shape Gavar; Kamo became Gavar later, not checked).
- Mikoyan -> Yeghegnadzor (Mikoyan 1935-1957).
- Alaverdi -> Tumanian, 1969. Kirovakan raion -> Gugark (Kirovakan 1935-1962).
- Kalinin -> Tashir. Agin -> Ani. Alagez -> Aragats. Duzkend -> Akhuryan (1945). Kamarlu -> Artashat (1945). Oktemberyan -> Armavir (Hoktemberyan). Azizbekov -> Vayk. Kafan -> Kapan. Vagharshapat -> Etchmiadzin 1945 (shape still named Vagharshapat).
- Amasia: existed as Aghbaba 1930; abolished 1951, restored 1956, abolished 1962, restored 1963.

Doubtful (filled, but check):
- Krasnoselsk -> Karmir: the shape Karmir (lon 45.03-45.51, lat 40.42-40.74) contains Chambarak (about 45.35 E, 40.59 N), so I mapped it. The Chambarak rename date is not verified against a source; the English table does not list it.
- Kotayk, Hrazdan, etc.: the shapes look like late-Soviet / 1990s raion outlines, while 1939 raions had other borders (for example the 1939 Kotayk raion, Mikoyan raion with Daralagyaz, Basarkechar with parts of today's Gavar/Sevan area). A cell is therefore the 1939 raion's value, not exactly the shape's territory. Treat every 1939 cell as approximate in extent.

Left empty (no safe match):
- Gukasyan (12 Azerbaijanis): shape Ashotck is probably its successor, but no source checked. Ashotck gets no row.
- Karabakhlar (7,489 of 12,832): abolished 1951, attached to Vedi/Ararat; no shape.
- Shamshadin (42): probably the Berd area, shape Tavush? Not verified. Tavush gets no row.
- Leninakan city (161): no shape (Shirak shapes absent; Gyumri is not a shape here).
- Nairi (created 1972), Baghramyan (1983): did not exist in 1939.
- Other shapes (Gavar and Sevan etc.) appear only for 1939.

## Doubts
- 1939 Azerbaijani counts were taken as printed. Percentages were not used.
- The 1926 Pambak-Lori row in the source has a corrupt Russians cell; irrelevant to these columns.
- The 1989 republic figure 84,860 matches the Armenian Goskomstat figure of about 84.9k reported in press (not independently verified against the census volume). Other sources note a separate figure of 7.9k for Azerbaijanis living in Armenia at census date, apparently in the context of expulsions; unclear and not used.
