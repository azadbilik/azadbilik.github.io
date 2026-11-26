# Bəstəkarlar · Composers

[azadbilik.org/musiqi/bestekarlar](https://azadbilik.org/musiqi/bestekarlar/): Azerbaijani composers from Hajibeyov's «Leyli and Majnun» (1908): a premiere timeline of operas, ballets, musical comedies and symphonic works, a teacher–student network (Hajibeyov's line, Garayev's school), "from book to stage" links to [kitabxana.az](https://kitabxana.az), and the few freely licensed recordings. az/ru/en; shared `../ui.js`, `../ui.css`, `../listen.js`.

| File | What |
|---|---|
| `data/composers.json` | What the page reads (built) |
| `data/composers.raw.json` | Wikidata: composers, links with a reference flag, works with premiere (P1191), based-on (P144), librettist (P87) |
| `data/composers.candidates.json` | Sentences of az/ru/en Wikipedia with a teaching cue and another composer's name |
| `data/composers.text.spec.json` | The sentences kept after reading (index into the candidates; t taught s) |
| `data/kx-links.json` | Hand-matched libretti and source texts at kitabxana.az (checked to answer at build) |
| `data/recordings.json` | Playable recordings: public domain on Commons, licence and evidence per item |

## Method

1. Composers: Wikidata occupation composer with Azerbaijani citizenship, ethnicity or a birthplace in Azerbaijan (275), plus Müslüm Maqomayev Sr. (Q2499809) and Niyazi (Q714526) by id; five born there but of other traditions left out (see `OUT` in `scripts/composers-build.mjs`).
2. Works: P86 composer; opera, ballet, musical comedy and symphonic works only. Date = premiere, else the first date on the item (marked). Wikidata is incomplete (no Garayev «Vətən» date, most of Jovdat Hajiyev): the page is not a full catalogue. 9 premiere dates carry no reference on Wikidata and are flagged.
3. Teachers: Wikidata P1066/P802 (8 of 60 with a reference), plus 19 read by hand from Wikipedia sentences (shown with the sentence).
4. «First opera of the East» (Hajibeyov, 1908) and «first woman of the East to compose an opera» (Akhundova, 1972) are claims of English Wikipedia, not Wikidata.
5. Rights: only the 2 anthem recordings of Hajibeyov (d. 1948; one 1944 recording, one US Navy Band) play. Nothing else by the listed composers was found free (Commons, archive.org).

Rebuild: `node scripts/composers.mjs` (Wikidata, kitabxana.az authors), `node scripts/people-text.mjs <people.json> <out.json> teach` (the candidates were made from the composers with a stage work or a link), then `node scripts/composers-build.mjs`.

Data: Wikidata CC0; quoted sentences are short quotations from Wikipedia (CC BY-SA).

Listening links (Apple Music previews, Spotify, YouTube) and their terms: see [`../README.md`](../README.md).

## Rendering

The timeline is plain SVG (`MQ.timeline` in `../ui.js`). The teacher–student network is the hub's shared graph view, [`/shared/graph.js`](../../shared/graph.js) + `graph.css` (sigma.js 3.0.3 over graphology 0.26.0, MIT, jsDelivr), through `MQ.network` in `../ui.js`:

- **Tree (default):** ELK layered (elkjs 0.11.1, EPL-2.0), a generation per column, masters left of their students; each connected line laid out alone, the largest (Hajibeyov's and Garayev's) on top, the small chains below. It opens framed on the largest line; the fit button shows all. On a phone it opens on the line's first generations with a note that it pans.
- **Network:** the same links by ForceAtlas2, seeded, the same on every load.
- Wikidata links solid and dark, text-derived ones dashed and lighter; hover or tap lights a composer's whole line in their colour, a click pins it and opens the card (side panel, a bottom sheet on a phone) with the Apple Music / Spotify block (`../listen.js`). The «Hajibeyov's line» / «Garayev's school» chips focus the graph; the Wikidata / text chips hide links without relayout. Node colour: the composer's generation; hollow: a teacher outside the list; size: √ students.
