# Silsilə · Master–student lineages

[azadbilik.org/musiqi/silsile](https://azadbilik.org/musiqi/silsile/): who learned from whom among the khanendes, tar players and ashiks of the [music map](../), az/ru/en, d3 7.9.0 (jsDelivr). Columns are generations; a click lights a musician's masters, students and whole line; the same lines are listed below as trees.

| File | What |
|---|---|
| `data/lineage.json` | What the page reads (built) |
| `data/lineage.candidates.json` | Wikidata links, people, and 352 candidate sentences from the az/ru/en Wikipedia articles (`../scripts/lineage.mjs`) |
| `data/lineage.text.json` | The sentences kept after reading them by hand: `t` taught `s` |
| `data/lineage.quickstatements.txt` | 84 text-derived links Wikidata lacks, as `student P1066 teacher` with the article URL as source (S4656). For the maintainer to review and run; never run by the build |

## Method

1. **Wikidata:** student of (P1066) and student (P802) with a khanende, tar player or ashik at either end: 21 links, 14 kept (Armenian and Ottoman masters and unnamed items left out). Sparse: most of the map's 201 musicians have none.
2. **Text:** every sentence of the az/ru/en Wikipedia article of each musician with a teaching word (şagird, ustad, müəllim, dərs, ученик, учился, student, taught...) and the name of another musician from the list. 352 such sentences; read by hand, 75 links kept (plus 20 more from teachers not on the map, below) where the sentence says who taught whom. Matches by a shared first name or surname, and sentences about school-teaching, were dropped. Text links are drawn dashed and carry the sentence and article.
3. **Placement:** column = longest chain of masters; rows ordered by neighbours' mean row.

4. **Masters not on the map:** 13 teachers the sentences name who are not in `musicians.json` (Mir Möhsün Nəvvab, Məşədi İsi, Sarabski, Sadıqcan, Səid Rüstəmov, Aşıq Mikayıl Azaflı, Davud Səfiyarov; and without a Wikidata item that I could find: Mütəllim Mütəllimov, Qəmkeş Allahverdi, Xındı Məhəmməd, Vəli Qaraxanlı, Keştazlı Həşim, Dəli İsmayıl). They are the `extra` list of `lineage.text.json`, drawn hollow, and never added to the map's data. The 7 with Wikidata ids are in the QuickStatements file; the others have no id.

## Caveats

- Wikipedia's claims, not Wikidata's, and some rest on a single mention («müəllimləri sayırdı»; «böyük təsiri»). Identity of same-named people was checked only against the sentence; Məşədi Zeynal Haqverdiyev (taught by Mirzə Əli Əsgər Qarabaği) and the two Gülyaz Məmmədovas are the doubtful ones (the latter's links were dropped).
- Teachers are only those named in the 352 sentences read; a teacher no sentence names is missing, so the Hacı Hüsü and Qaryağdıoğlu lines are still thinner than they were. Hüseynqulu Sarabski is on Wikidata as an actor.
- Rebuild: `node scripts/lineage.mjs` (network; slow, caches article texts), then re-read the candidates and update `lineage.text.json` by hand, then `node scripts/lineage-build.mjs`.

Data: Wikidata CC0; quoted sentences are short quotations from Wikipedia (CC BY-SA).
