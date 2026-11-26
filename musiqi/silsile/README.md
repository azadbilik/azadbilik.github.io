# Silsilə · Master–student lineages

[azadbilik.org/musiqi/silsile](https://azadbilik.org/musiqi/silsile/): who learned from whom among the khanendes, tar players and ashiks of the [music map](../), az/ru/en. Generations run left to right; a click lights a musician's masters, students and whole line; the same lines are listed below as trees.

| File | What |
|---|---|
| `data/lineage.json` | What the page reads (built) |
| `data/lineage.candidates.json` | Wikidata links, people, and 352 candidate sentences from the az/ru/en Wikipedia articles (`../scripts/lineage.mjs`) |
| `data/lineage.text.json` | The sentences kept after reading them by hand: `t` taught `s` |
| `data/lineage.quickstatements.txt` | 84 text-derived links Wikidata lacks, as `student P1066 teacher` with the article URL as source (S4656). For the maintainer to review and run; never run by the build |

## Method

1. **Wikidata:** student of (P1066) and student (P802) with a khanende, tar player or ashik at either end: 21 links, 14 kept (Armenian and Ottoman masters and unnamed items left out). Sparse: most of the map's 201 musicians have none.
2. **Text:** every sentence of the az/ru/en Wikipedia article of each musician with a teaching word (şagird, ustad, müəllim, dərs, ученик, учился, student, taught...) and the name of another musician from the list. 352 such sentences; read by hand, 75 links kept (plus 20 more from teachers not on the map, below) where the sentence says who taught whom. Matches by a shared first name or surname, and sentences about school-teaching, were dropped. Text links are drawn dashed and carry the sentence and article.
3. **Placement:** see Rendering below.

4. **Masters not on the map:** 13 teachers the sentences name who are not in `musicians.json` (Mir Möhsün Nəvvab, Məşədi İsi, Sarabski, Sadıqcan, Səid Rüstəmov, Aşıq Mikayıl Azaflı, Davud Səfiyarov; and without a Wikidata item that I could find: Mütəllim Mütəllimov, Qəmkeş Allahverdi, Xındı Məhəmməd, Vəli Qaraxanlı, Keştazlı Həşim, Dəli İsmayıl). They are the `extra` list of `lineage.text.json`, drawn hollow, and never added to the map's data. The 7 with Wikidata ids are in the QuickStatements file; the others have no id.

## Rendering

The hub's shared graph view, [`/shared/graph.js`](../../shared/graph.js) + `graph.css`: sigma.js 3.0.3 over graphology 0.26.0 (MIT), jsDelivr.

- **Tree (default):** ELK's layered algorithm (elkjs 0.11.1, EPL-2.0, loaded only for this view), direction RIGHT: each generation a column, crossings minimised (layer sweep), nodes placed by network simplex. Each connected lineage is laid out alone: the largest on top, the small chains below it in rows, largest first. Edges are ELK's splines with arrows from master to student; Wikidata links solid, darker and wider (ink, 1.45×), text-derived links dashed and lighter (muted). The whole drawing scales with the zoom; labels never go below 9.5 px, and one that would run into the next is cut short with … rather than dropped (`trimLabels`). The page opens framed on the largest lineage (`start: 'main'`); the fit button shows all of them. On a phone it opens on that lineage's first generations at a readable size, with a note that it pans (`panHint`).
- **Network:** the same links by ForceAtlas2 (graphology-layout-forceatlas2 0.10.1), seeded, a fixed number of iterations, so the same on every load.
- Hover or tap lights a musician's whole line (every master above, every student below), drawn in the musician's own colour at full strength (`litColor: 'node'`); a click pins it and opens the card (side panel; a bottom sheet on a phone). The Wikidata / text chips hide links without relayout. Node size: √ students; hollow: a master not on the map.

## Caveats

- Wikipedia's claims, not Wikidata's, and some rest on a single mention («müəllimləri sayırdı»; «böyük təsiri»). Identity of same-named people was checked only against the sentence; Məşədi Zeynal Haqverdiyev (taught by Mirzə Əli Əsgər Qarabaği) and the two Gülyaz Məmmədovas are the doubtful ones (the latter's links were dropped).
- Teachers are only those named in the 352 sentences read; a teacher no sentence names is missing, so the Hacı Hüsü and Qaryağdıoğlu lines are still thinner than they were. Hüseynqulu Sarabski is on Wikidata as an actor.
- Rebuild: `node scripts/lineage.mjs` (network; slow, caches article texts), then re-read the candidates and update `lineage.text.json` by hand, then `node scripts/lineage-build.mjs`.

Data: Wikidata CC0; quoted sentences are short quotations from Wikipedia (CC BY-SA).

Listening links (Apple Music previews, Spotify, YouTube) and their terms: see [`../README.md`](../README.md).
