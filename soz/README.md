# Söz ehtiyatı · Poets' vocabulary

[azadbilik.org/soz](https://azadbilik.org/soz/): how many different words each poet uses in the first 10,000 words of their verse, after The Pudding's [“The Largest Vocabulary in Hip Hop”](https://pudding.cool/projects/vocabulary/). With a second view (different words against the share of Arabic and Persian words) and a small game.

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
3. **Sample.** Each poet's works in a fixed order (collection order, year, slug; then the work's order, year, slug; loose works last) and the **first N = 10,000 words** taken. 76 of the 402 poets with Azerbaijani verse have that many and are ranked; the others are listed with their word counts, unranked.
4. **Different words** are distinct word forms: `dərd`, `dərdim`, `dərdimdən` count as three. No lemmatising, so the numbers run well above English ones.
5. **Arabic and Persian words** (approximate): the share of the sample's words found in «Klassik Azərbaycan ədəbiyyatında işlənən ərəb və fars sözləri lüğəti» (2005), the dictionary behind the site's glossary, as written or on a stem left after common suffixes come off: a copy of the glossary's rules (`apps/api/src/glossary/lookup.ts`) without its set phrases and compounds. The dictionary is made for the classics, so it misses old spellings and counts some everyday loans; `loanTypes` is the same share over distinct words.
6. **Only theirs:** words of four letters or more found in the sample of only one ranked poet, most used first; words starting with the poet's own name (the pen name in a last couplet) are left out.
7. **Era** by birth year: classical before 1760, 19th century 1760–1869, 20th century 1870–1945, contemporary from 1946; the library's century when the year is unknown.

## Caveats

- Many samples were read from book scans by OCR (`scanned` in the data is the share of the sample from scanned sources: National Library, turuz.com, Halle, archive.org, kitabxana.net PDFs) and proofread; every slip left counts as a new word.
- Old spellings add forms: Qazi Bürhanəddin (`niçe`, `kıla`), Kişvəri and Mustafa Zərir keep Old Anatolian/Azerbaijani forms, and the dictionary misses them, so their loan share is low.
- Some of Abbasqulu ağa Bakıxanov's verse lost its diacritics (`gunəş`, `urək`, `coxaldıqca`), which inflates his count.
- Form matters: classical samples are mostly ghazals, modern ones often free verse. A gap of a few hundred words is not a firm ranking.

## Fields in `vocab.json`

`n` (sample size), `ranked`, `poets`, `built`, and per author: `slug` (kitabxana.az/authors/<slug>), `az`/`ru`/`en` names, `born`, `died`, `era`, `words` (all their verse words), `sample`, `distinct`; for ranked poets also `loan`, `loanTypes`, `once` (forms used once), `ownCount`, `own` (up to 8), `scanned`.

Data CC0; the texts stay on kitabxana.az.
