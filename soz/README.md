# Söz ehtiyatı · Poets' vocabulary

[azadbilik.org/soz](https://azadbilik.org/soz/): how many different words each poet uses in the first 10,000 words of their verse, after The Pudding's [“The Largest Vocabulary in Hip Hop”](https://pudding.cool/projects/vocabulary/), in two separate tracks: verse in Azerbaijani and verse in Persian. The two are never plotted on one axis. With a second view (different words against the share of Arabic and Persian words), a third section (that share over the centuries, with the most Turkic and the most Persianate poets) and a small game.

| File | What |
|---|---|
| `index.html` | The page (az, ru, en) |
| `data/vocab.json` | What the page reads, built by `scripts/build.mjs` |
| `scripts/build.mjs` | Reads the kitabxana.az library database and the glossary's dictionary, writes `data/vocab.json` |
| `og.png` | Share card, a screenshot of the page |

## Rebuilding

```bash
KITABXANA_REPO=~/irs-az node scripts/build.mjs
```

It needs `psql` and a local copy of the kitabxana database. The connection string comes from `DATABASE_URL`, or else from `$KITABXANA_REPO/apps/api/.env`, read at run time; it is never written anywhere. The dictionary is `$KITABXANA_REPO/apps/api/src/glossary/efsl.json`.

## Method

1. **Texts.** Works readers can see on kitabxana.az (published works of published authors), verse only (`genre = POEM`), written in Azerbaijani in the Latin script (`originalLang = AZ_LATIN`), with a body of their own. Translations, prose and drama are left out. The classics are in editions transcribed into the modern alphabet.
2. **Words.** Markdown is stripped (footnotes, headings' marks, emphasis, links, tags); text is lower-cased by Azerbaijani rules (İ → i, I → ı); a word is a run of letters (ə, ğ, ı, ö, ü, ş, ç, â, î, û included) with any apostrophe inside it kept (`mə’na`). A hyphen splits words.
3. **Sample.** Each poet's works in a fixed order (collection order, year, slug; then the work's order, year, slug; loose works last) and the **first N = 10,000 words** taken. 77 of the 403 poets with Azerbaijani verse have that many and are ranked (Persian: 18 of 23); the others are listed with their word counts, unranked.
4. **Different words** are distinct word forms: `dərd`, `dərdim`, `dərdimdən` count as three. No lemmatising, so the numbers run well above English ones.
5. **Arabic and Persian words** (approximate): the share of the sample's words found in «Klassik Azərbaycan ədəbiyyatında işlənən ərəb və fars sözləri lüğəti» (2005), the dictionary behind the site's glossary, as written or on a stem left after common suffixes come off: a copy of the glossary's rules (`apps/api/src/glossary/lookup.ts`) without its set phrases and compounds. The dictionary is made for the classics, so it misses old spellings and counts some everyday loans; `loanTypes` is the same share over distinct words.
6. **Only theirs:** words of four letters or more found in the sample of only one ranked poet, most used first; words starting with the poet's own name (the pen name in a last couplet) are left out.
7. **Persian track:** the same method over `originalLang = FA` verse (mostly from Ganjoor). A word is a run of Arabic-script letters; letters typed two ways are made one (ي ى → ی, ك → ک, ة → ه, أ إ آ ٱ → ا, ؤ → و), short vowels (U+064B–U+065F, U+0670) and tatweel dropped, and a ZWNJ (U+200C) joins a word (`می‌رود` is one token). Persian words take far fewer suffixes than Azerbaijani ones, which is one more reason the two scales differ and are not compared. The loanword measure does not apply (it would be Arabic in Persian), so Persian has no `loan`; pen names are filtered with the poet's Persian name (`nameFa`).
8. **Era** by birth year: classical before 1760, 19th century 1760–1869, 20th century 1870–1945, contemporary from 1946; the library's century when the year is unknown.

9. **Over the centuries** (`tracks.az.time`, section «Əsrlər boyu»): every poet of the Azerbaijani track with at least 2,000 words of verse (133; 77 of them with the full 10,000), the same loan share as above over the sample they have, placed on their year of birth, or, when the library gives only a century, in the middle of it (`approx`; folk poetry is left out). Verse is not dated, so birth stands for the time of writing, a generation off at most. The black line pools the words of all poets born in a century (or half-century): total dictionary words over total words, so poets with more text weigh more; a period with fewer than three poets is drawn dashed. The earliest poet in the data was born in the 14th century, so there is no 13th century. The «most Turkic» and «most Persianate» lists take poets with 5,000+ words.

## Caveats

- Many samples were read from book scans by OCR (`scanned` in the data is the share of the sample from scanned sources: National Library, turuz.com, Halle, archive.org, kitabxana.net PDFs) and proofread; every slip left counts as a new word.
- Old spellings add forms: Qazi Bürhanəddin (`niçe`, `kıla`), Kişvəri and Mustafa Zərir keep Old Anatolian/Azerbaijani forms, and the dictionary misses them, so their loan share is low.
- Some of Abbasqulu ağa Bakıxanov's verse lost its diacritics (`gunəş`, `urək`, `coxaldıqca`), which inflates his count.
- Ganjoor's Persian texts do not always use a ZWNJ: `می گردد` with a space counts as two words, `می‌گردد` as one, so a poet's count depends a little on how their text was typed. The madda is dropped with the other alef forms (`آمده` → `امده`).
- Form matters: classical samples are mostly ghazals, modern ones often free verse. A gap of a few hundred words is not a firm ranking.

## Fields in `vocab.json`

`built`, `n` (sample size), and `tracks.az` / `tracks.fa`, each with `ranked`, `poets` and `authors`; per author: `slug` (kitabxana.az/authors/<slug>), `az`/`ru`/`en` names, `born`, `died`, `era`, `words` (all their verse words), `sample`, `distinct`; for ranked poets also `loan`, `loanTypes` (Azerbaijani only), `once` (forms used once), `ownCount`, `own` (up to 8), `scanned`.

`tracks.az.time[]`: `slug`, names, `born`, `died`, `era`, `year` (placement), `approx`, `n` (words read), `loan`, `ranked`.

Data CC0; the texts stay on kitabxana.az.
