# Elm şəbəkəsi · Azerbaijan's science network

[azadbilik.org/sebeke/elm](https://azadbilik.org/sebeke/elm/): whom Azerbaijani research is written with, from [OpenAlex](https://openalex.org) (CC0). Four views under one year slider (1970–2026) and a switch between all works and works with at most 20 authors: partner countries over time; a network of institutions (Azerbaijani ones and their foreign partners); a network of researchers (cosmos.gl, with search); fields, with the share of works that have a foreign co-author. A last section shows where the works are published and lists the data's limits. Neutral and descriptive: no ranking, no score.

| File | What |
|---|---|
| `index.html` | The page (az, ru, en) |
| `data/elm.json` | Countries, institutions, edges, fields and venues by year (read by the page) |
| `data/authors.json`, `data/authors-*.bin` | Researcher network: names, and binary node/link arrays for cosmos.gl |
| `data/institution-years.csv` | Works per Azerbaijani institution per year, with and without a foreign co-author (for the hub's data) |
| `scripts/fetch.mjs` | Downloads the works from the OpenAlex API into `data/raw/` (git-ignored, ~55 MB gzipped) |
| `scripts/build.mjs` | Reads `data/raw/`, writes everything else in `data/` |
| `og.png` | Share card |

## Rebuilding

```bash
node scripts/fetch.mjs   # ~380 requests, resumes if stopped
node scripts/build.mjs   # ~30 s; prints the headline numbers
```

No API key and no e-mail address are sent. OpenAlex's free tier (without a key) gives about 1,000 requests a day and cannot use cursor paging, so the fetch cuts the query into slices below 10,000 results (one slice per year from 1990, per month for 2025–2026, one for everything before 1990) and pages through each.

## Sources and licences

- **OpenAlex** works, authorships, institutions, topics and sources: [CC0](https://docs.openalex.org/additional-resources/terms-of-use). Retrieved 2026-11-26.
- **Library code, loaded from jsDelivr with pinned versions:** [cosmos.gl](https://github.com/cosmosgl/graph) `@cosmos.gl/graph@3.6.0` (MIT; the UMD bundle, because jsDelivr's `+esm` build mixes luma.gl versions and fails), [D3](https://d3js.org) `d3@7.9.0` (ISC). Not used: `@cosmograph/*` (CC BY-NC / closed).
- Country names: the browser's `Intl.DisplayNames`.

## Method

1. **Works.** Every OpenAlex work with `institutions.country_code:AZ` (any author's institution is in Azerbaijan): 74,708 works, 1723–2027; 1,408 of them before 1991 (today's Azerbaijani institutions, mostly ANAS and its physics institutes; partners mostly Russia, i.e. the Soviet Union as OpenAlex codes it), 260 before 1970 (not in the per-year arrays).
2. **Counting.** A work counts once for the year, for each foreign country among its authors' institutions, for each Azerbaijani institution, and for its primary topic's field. “With a foreign co-author” means at least one author institution outside Azerbaijan.
3. **Large collaborations.** OpenAlex lists at most 100 authors per work, so a work with 100 listed authors has 100 or more. These (1,773 works, 2.4 %, mostly high-energy physics) are counted in the totals but left out of the institution graph (works with fewer than 100 authors only) and of the researcher network (at most 25 authors). The “≤ 20 authors” switch removes them from the country, field and tile figures too. In 570 of them the Azerbaijani author sits past the 100th place, so no Azerbaijani institution is listed: they count in the totals and the countries, not in the institution graph.
4. **Institutions.** Nodes are OpenAlex institution records. Azerbaijani: all with at least 25 works (115 of 155). Foreign: the 160 with the most joint works with those. Edges: works with fewer than 100 authors in which both appear; at least 2 joint works over the whole period, the 4,000 heaviest (3,225 pass). Node size and edge weight follow the slider; the layout is a d3-force run in the browser from the whole-period weights. Colour is the institution's most frequent field (or its domain). Foreign nodes have no field: they are rings.
5. **Researchers.** OpenAlex author records with an Azerbaijani affiliation on at least 2 works of at most 25 authors and at least one link to another such author: 12,302 authors, 41,059 links (a link is a shared work; its weight is the number of shared works). Foreign co-authors are not in the network. cosmos.gl computes the layout on the GPU in the browser. A researcher is “active” in the chosen years if their first work is not after the end and their last not before the start. Colour is the author's most frequent field.
6. **Fields.** The primary topic's field (26) and domain (4). The share of works with a foreign co-author is per field and year range.
7. **Venues.** `primary_location.source`: OpenAlex flags `is_core` (CWTS Core), `is_in_doaj`, and `listed_in` (a list of open lists: MEDLINE, ERIH PLUS, national white lists, ...). “On none of the lists” = none of the three. This is not a predatory-journal list; no openly licensed list of that kind is used.

## Limits (also on the page)

- Affiliations are parsed automatically; misreadings and several records for one institution exist. The Institute of Physics is two OpenAlex records (`I4210100222` “Institute of Physics”, `I4405283603` “Fizika İnstitutu Publik Hüquqi Şəxs”); they are merged into one node (editorial choice, `MERGE` in `scripts/build.mjs`), both ids kept in `elm.json` (`ids`), and the CSV counts them together under `I4210100222`. Other duplicates are not merged; the Ministry of Science and Education also appears as an institution of its own.
- Author disambiguation is imperfect: people with the same name are merged, one person can be several records (Latin/Cyrillic transliteration). The researcher network is a rough picture.
- The count rises from 5,925 (2023) to 9,061 (2024), 12,363 (2025) and 15,089 (2026, not over). The 15 venues with the most works in 2024–2026 hold 19 % of them and include Zenodo uploads, book series and conference proceedings; how much of the rise is real and how much OpenAlex's wider coverage cannot be told from this data. In 2020–2026 the countries Azerbaijan co-authors with most after Türkiye (Saudi Arabia, China, Pakistan, India) are partly an effect of such series and of mass-affiliation patterns; the page does not judge it.
- 1996 has a spike (256 works against 90 in neighbouring years); not investigated.
- Country = the institution's country, not the author's citizenship.
- Works published after the retrieval date appear as OpenAlex indexes them; rerun both scripts to refresh.
