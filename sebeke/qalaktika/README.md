# Ədəbiyyat qalaktikası · The literature galaxy

[azadbilik.org/sebeke/qalaktika](https://azadbilik.org/sebeke/qalaktika/): every work readers can see on kitabxana.az (published works of published authors) as one point, placed by how its text reads: neighbours read alike. Colour by century, author, genre or language; a time slider that lights up works written up to a year; search by author or title; click a point for its first lines, a link to the work, and its ten nearest works.

| File | What |
|---|---|
| `index.html` | The page (az, ru, en); points drawn with [cosmos.gl](https://github.com/cosmosgl/graph) 3.6.0 (MIT, from jsDelivr), fixed positions, no simulation |
| `data/galaxy.json` | What a point is, as columns: slug, title, author, year (+ whether it is an estimate), genre/form, original language, word count; the authors' names |
| `data/pos.bin` | Position of each work: two little-endian `uint16` (x, y) per work, in the order of `galaxy.json` |
| `data/knn.bin`, `data/sims.bin` | The 10 nearest works of each work (`uint16` indexes) and their cosine similarity (`uint8`, divided by 255) |
| `data/knnx.bin`, `data/simsx.bin` | The same, counting only works by other authors |
| `data/lines-<k>.json` | First lines of the works, 5,000 per file; the page fetches the one it needs when a card opens |
| `scripts/export.sh` | Reads the library database (read only) into `works.jsonl` outside the repository |
| `scripts/embed.py` | Embeds every work with BAAI/bge-m3 on the Mac's GPU (MPS) |
| `scripts/build.py` | UMAP, nearest neighbours, the files in `data/` |
| `scripts/compare-models.py` | The check used to choose the model (below) |
| `og.png` | Share card, a screenshot of the page |

## Rebuilding

```bash
KITABXANA_REPO=~/irs-az scripts/export.sh                 # needs psql and a local copy of the kitabxana database
uv venv --python 3.12 ~/.local/share/azadbilik-embed/venv
uv pip install --python ~/.local/share/azadbilik-embed/venv/bin/python torch sentence-transformers umap-learn numpy scikit-learn pynndescent
~/.local/share/azadbilik-embed/venv/bin/python scripts/embed.py      # about an hour on an M-series Mac
~/.local/share/azadbilik-embed/venv/bin/python scripts/build.py      # UMAP, a few minutes
```

The connection string comes from `DATABASE_URL`, or else from `$KITABXANA_REPO/apps/api/.env`, read at run time; it is never written anywhere. The embeddings (`emb-bge-m3.npy`, 50,000 × 1,024) stay in `~/.local/share/azadbilik-embed/` (`EMBED_DIR`), outside git.

## Method

1. **Works.** Every published work of a published author (the rule of `VISIBLE_WORK` in the library's `works.service.ts`): verse, prose, plays, essays, letters, memoirs, in Azerbaijani (Latin, Arabic and Cyrillic script), Persian, Russian, German and Arabic. A work with no text of its own (a translation-only work: a work whose original is not in the library) is embedded by its default published translation.
2. **Text.** Markdown marks are stripped. A text of up to 2,400 characters is embedded whole (its first 1,600 characters); a longer one as the mean of three chunks of 1,600 characters taken at 0%, 40% and 75% of the text, so a novel is judged by more than its first page. 1,600 characters is roughly 400–500 tokens, under the model's 512-token window set here.
3. **Embedding.** [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) (MIT; 568M parameters, 1,024 dimensions, multilingual), unit-normalised, in half precision.
4. **Map.** UMAP (`metric=cosine`, `random_state=42`) to two dimensions; coordinates fitted into a 16-bit square (the 0.05% farthest points are clipped to the edge).
5. **Nearest works.** The ten nearest by cosine similarity in the full 1,024-dimensional space, not in the 2-D map, so they are not distorted by the projection. Works with the same author are not excluded.
6. **Time.** A work's own year where the library has one (about 12% of works); otherwise its author's birth year + 30, marked `approx` on the card and in the data (`e = 1`). Works with neither (about 5%) show only when the slider is at «all». Centuries are by that year; a Persian poet of the 13th century and an Azerbaijani one of the 20th share nothing but the axis.
7. **Colours.** Century: before 1200, then one per century. Author: the twelve with most works, the rest grey. Genre: ghazal, masnavi, rubai, qasida, other verse (from the library's `form`; many verse works have none), prose, play, essay (with philosophy), letter, memoir. Language: the work's original language, which for a translation-only work is the original's, not the text shown.

## Model check

Two candidates, both on 300 Persian poems paired with their default Azerbaijani translation and 800 Azerbaijani poems of 20 poets (40 each), texts cut at 256 tokens (`scripts/compare-models.py`):

| Model | Persian poem → its Azerbaijani translation, top-1 of 300 | 5 nearest poems by the same poet, of 800 |
|---|---|---|
| BAAI/bge-m3 | 82.3% | 32.7% |
| intfloat/multilingual-e5-large | 82.7% | 34.5% |

A tie within the noise (chance is 0.3% and 5%). bge-m3 was kept: it takes longer texts, so the long works are read from three chunks of up to 512 tokens.

## What the map shows

- Two continents, **Persian verse** (16,000 works: Saib Tabrizi, Khaqani, Awhadi…) and **Azerbaijani**, with almost nothing between them: 99% of a work's ten nearest are in its own language.
- The Persian continent is arranged by century and by form (ghazals, masnavis and quatrains in their own regions); the Azerbaijani one has 20th-century verse (Soviet and modern) in the large lower-left mass, 19th-century and older verse and the prose (novels, plays, stories) on its upper and right edges.
- **Islands:** Qazi Burhan al-Din's 1,386 ghazals (14th century, Old Anatolian Turkic spelling, `güneş toğısar`) sit alone, far from the other Azerbaijani verse; so do Sam Mirza's Persian prose tazkira, Zeyn al-Abedin Maraghei's prose, Chingiz Abdullayev's Russian detective stories, and Süleyman Rəhimov's prose (a spelling of its own).
- Of a work's ten nearest, 34% are by the same author, 72% have the same genre/form, and 69% (of dated works) are of the same century.

## Caveats

- Similarity is of text as typed: Persian originals with an Azerbaijani translation sit near each other, but old spellings, OCR slips and the library's transliterations also pull works together (or apart).
- Poems by one poet cluster, partly through shared subject and form, partly through shared spelling. The map shows what the model reads as alike, not literary influence.
- Only the first and a few later pages of a long work are read.
- Approximate: all years from an author's birth year; the genre of verse without a `form`.
- Close in the 2-D map is not a promise: UMAP keeps only about 4% of a work's exact ten nearest within its own ten nearest on the page, and about 15% within the nearest fifty. The nearest-works list is computed in the full space and is the reliable one.
- Neighbour counts above come from the data in this folder at the date of the build.

## Size

Over the wire (gzip): `galaxy.json` 0.83 MB and `pos.bin` 0.20 MB to draw the map; `knn.bin` + `knnx.bin` + both `sims` ≈ 2.2 MB when a work is first selected; one `lines-<k>.json` ≈ 0.19 MB per card. cosmos.gl is 0.2 MB from jsDelivr.

Data CC0; the texts stay on kitabxana.az.
