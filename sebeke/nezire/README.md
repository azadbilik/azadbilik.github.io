# Nəzirə şəbəkəsi · The answer-poem network

[azadbilik.org/sebeke/nezire](https://azadbilik.org/sebeke/nezire/): who answered whose poem (nəzirə, təxmis, cavab) in the verse of the kitabxana.az library. Poets or poems as nodes (toggle), older poets to the left; click a node or a line to see both poems' lines and the evidence.

| File | What |
|---|---|
| `index.html` | The page (az, ru, en); the graph is `/shared/graph.js` |
| `data/nezire.json` | What the page reads, built by `scripts/build.mjs` |
| `scripts/build.mjs` | Reads the kitabxana.az library database and finds the links |
| `og.png` | Share card |

## Rendering

The graph is the hub's shared graph view, [`/shared/graph.js`](../../shared/graph.js) + `graph.css`: sigma.js 3.0.3 (WebGL nodes) over graphology 0.26.0, laid out by ForceAtlas2 (graphology-layout-forceatlas2 0.10.1), all MIT, from jsDelivr.

- Every tier (A, B, C) is in the graph; the checkboxes only hide edges (and poets left without one), so nothing moves. The links on show by default (A + B) are laid out first, the weak-only ones placed around them afterwards.
- Seeded and deterministic: each node starts at its poet's year on x (the centuries before 1700 squeezed into the first 30%, as before) and is pulled back there softly while ForceAtlas2 runs a fixed number of iterations, so older poets stay left and the picture is the same on every load. Then it is stretched (≤ 1.5×, poems 2.2×) to the stage's shape. About a quarter of a second for the larger (poems) view, so positions are not cached in the data.
- Node size: √ of how many poets answered it; colour: the century; dashed edge: poets of one time (direction unknown); arrow: from the answer to the poem answered.
- Hover lights a node and its neighbours, a click pins it and opens the card (the old detail panel, now a side panel / bottom sheet); Esc or empty space clears. Search, zoom and fit in the stage's toolbar; nodes can be dragged.

## Rebuilding

```bash
KITABXANA_REPO=~/irs-az node scripts/build.mjs [--eval=<file>]
```
Needs `psql` and a local copy of the kitabxana database (read only). The connection string comes from `DATABASE_URL` or `$KITABXANA_REPO/apps/api/.env`, read at run time, never written. `--eval` writes samples of each method for hand checking.

## Method

Texts: published verse of published authors, `originalLang = AZ_LATIN`, with a body (25,807 poems). Persian verse, prose and translations are left out. A poet's date: birth year, else death − 55, else median poem year − 25; the later poet answers, within 8 years the direction is unknown (dashed).

1. **Named (tier A).** A title or a short italic/bracketed note under it holding nəzirə, təxmis, təsdis, tərbi, beştətmə, bənzətmə, tətəbbö or cavab beside a capitalised poet name or pen name (last name token, or a unique token; an alias shared by several poets goes to the one with 3× more poems, else is dropped). The poem answered is looked for among that poet's poems by method 2 or 3.
2. **Quoted lines (tier A).** Lines of 3+ words, folded (lower case, ə→e, ş→s...), shared by poems of different poets: ≥ 3 shared lines, ≥ 20% of the quoter and ≥ 30% of either poem; the quoter is the later poet's poem (longer poem when undated); texts shared both ways over 60% (same poem under two names), debates (title with deyişmə/görüşü, or speaker-name lines), and short songs of one size with a refrain in common are dropped.
3. **Same radif and qafiyə.** Poems of two-line stanzas: the longest ending (letters, spaces ignored) shared by 70% of the matla and every second line, with the radif's length from the shared last words. A pair: shared ending ≥ 4 letters (≥ 80% of the shorter or ≥ 7), a radif of whole last word(s) in common and a qafiyə part ≥ 2 letters (endings that only share letters inside the last word, with no radif, are rhymes, not answers, and are not linked), median syllables per line within ±2. Rarity `c` = poems whose ending ends the same way. **B (strong):** ≥ 9 letters and c ≤ 4, or ≥ 7 letters, c ≤ 6 and ≥ 2 rhyme-word stems in common. **C (weak):** ≥ 6 letters, c ≤ 12, off by default.

## Hand check (by me, no second reader)

| Method | Links | Checked | Result |
|---|---|---|---|
| Named | 17 | all | rule first gave 20; 3 wrong (`NOT_THE_POET` in the script: Məhəmməd bəy Arif, Nəvvab Möhsün, Nəzminin); rest right |
| Quoted | 7 | all | first pass 17 links, ~7 right; after rules (direction by date, debates, song variants) 7/7, tuned on the same sample so not an independent precision |
| Same radif+qafiyə, strong (B) | 88 | 40 random | 35 clear, 4 weak (shared ending, common frame), 1 error (a heading line read as a stanza) |
| Same radif+qafiyə, weak (C) | 223 | 40 random | 6 clear, 33 weak, 1 coincidence |

A shared radif and qafiyə is the formal mark of a nəzirə, not proof of one (metre is not checked, only syllable counts); poems sharing an ending are all linked to each other though the real model may be one. Many links to Füzuli, Nəsimi and Zakir are probably chains through them.

## Fields in `nezire.json`

`built`, `stats`; `poets` (`slug`, `az`/`ru`/`en`, `born`, `died`, `date`); `poems` (`slug`, `t` title, `p` poet index, `m` first two lines); `links` (`a` answering poem, `b` poem answered, `tier`, `k`: `e` {head}, `q` {n, of, ev}, `f` {m letters shared, r radif letters, c poems ending so, sh rhyme stems shared, und}); `named` (poet-level: titled poem `a`, poet `to`, `head`, `rev`/`und`).

Sources: poem texts and metadata from the kitabxana.az library (texts stay there, each carries its own source note; the data holds only titles and first two lines). Data CC0. sigma.js, graphology, ForceAtlas2: MIT.
