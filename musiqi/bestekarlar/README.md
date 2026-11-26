# Bəstəkarlar · Composers

[azadbilik.org/musiqi/bestekarlar](https://azadbilik.org/musiqi/bestekarlar/): Azerbaijani composers from Hajibeyov's «Leyli and Majnun» (1908): a premiere timeline of operas, ballets, musical comedies and symphonic works, a teacher–student network (Hajibeyov's line, Garayev's school), "from book to stage" links to [kitabxana.az](https://kitabxana.az), and the few freely licensed recordings. az/ru/en; shared `../ui.js`, `../ui.css`; d3 7.9.0 for the network.

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
