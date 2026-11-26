# Silsilə · Master–student lineages

[azadbilik.org/musiqi/silsile](https://azadbilik.org/musiqi/silsile/): who learned from whom among the khanendes, tar players and ashiks of the [music map](../), az/ru/en, d3 7.9.0 (jsDelivr). Columns are generations; a click lights a musician's masters, students and whole line; the same lines are listed below as trees.

| File | What |
|---|---|
| `data/lineage.json` | What the page reads (built) |
| `data/lineage.candidates.json` | Wikidata links, people, and 352 candidate sentences from the az/ru/en Wikipedia articles (`../scripts/lineage.mjs`) |
| `data/lineage.text.json` | The sentences kept after reading them by hand: `t` taught `s` |
| `data/lineage.quickstatements.txt` | 72 text-derived links Wikidata lacks, as `student P1066 teacher` with the article URL as source (S4656). For the maintainer to review and run; never run by the build |

## Method

1. **Wikidata:** student of (P1066) and student (P802) with a khanende, tar player or ashik at either end: 21 links, 14 kept (Armenian and Ottoman masters and unnamed items left out). Sparse: most of the map's 201 musicians have none.
2. **Text:** every sentence of the az/ru/en Wikipedia article of each musician with a teaching word (şagird, ustad, müəllim, dərs, ученик, учился, student, taught...) and the name of another musician from the list. 352 such sentences; read by hand, 75 links kept where the sentence says who taught whom. Matches by a shared first name or surname, and sentences about school-teaching, were dropped. Text links are drawn dashed and carry the sentence and article.
3. **Placement:** column = longest chain of masters; rows ordered by neighbours' mean row.

## Caveats

- Wikipedia's claims, not Wikidata's, and some rest on a single mention («müəllimləri sayırdı»; «böyük təsiri»). Identity of same-named people was checked only against the sentence; Məşədi Zeynal Haqverdiyev (taught by Mirzə Əli Əsgər Qarabaği) and the two Gülyaz Məmmədovas are the doubtful ones (the latter's links were dropped).
- Only musicians on the music map (born in a placed town, tied to Azerbaijan) or linked to them on Wikidata are in; teachers outside it (Mir Möhsün Nəvvab, Məşədi İsi, Hüseynqulu Sarabski...) are missing, so the Hacı Hüsü and Qaryağdıoğlu lines look thinner than they were.
- Rebuild: `node scripts/lineage.mjs` (network; slow, caches article texts), then re-read the candidates and update `lineage.text.json` by hand, then `node scripts/lineage-build.mjs`.

Data: Wikidata CC0; quoted sentences are short quotations from Wikipedia (CC BY-SA).
