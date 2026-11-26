# Caz · Jazz

[azadbilik.org/musiqi/caz](https://azadbilik.org/musiqi/caz/): Azerbaijani jazz, 29 hand-chosen musicians (Vagif and Aziza Mustafazadeh, Rafig Babayev, Salman Gambarov, Shahin Novrasli, Isfar Sarabski, Amina Figarova, Tofig Guliyev, Rauf Hajiyev...), a lifespan/album/festival timeline and a network of who taught, led or worked with whom. az/ru/en; `../ui.js`, `../ui.css`, d3 7.9.0.

| File | What |
|---|---|
| `data/jazz.json` | What the page reads (built) |
| `data/jazz.raw.json` | Wikidata: people, teacher links (P1066/P802, reference flag), bands (P463), albums (P175 + P577) |
| `data/people.json`, `data/jazz.candidates.json` | Input and output of `scripts/people-text.mjs` (teaching and playing-together sentences) |
| `data/jazz.text.spec.json` | The sentences kept after reading, with a kind: teacher, collab, influence, family |

## Method and limits

- The list is by hand (`SEEDS` in `scripts/jazz.mjs`): the names in the brief plus musicians Wikidata tags with genre jazz and a tie to Azerbaijan. Wikidata does not tag Tofig Guliyev or Rauf Hajiyev as jazz; added by hand.
- Wikidata covers jazz thinly: 8 teacher links, 14 dated albums (Aziza Mustafazadeh, Eldar Mansurov only), one festival (Baku International Jazz Festival, P571 = 2005). The Soviet estrada-jazz orchestras of the 1930s–60s have no dated Wikidata items and are not on the timeline.
- 12 more links are read from Wikipedia sentences; «worked together» links rest on one sentence each.
- Recordings: none played. The Commons category «Azerbaijani jazz» is empty; archive.org radio programmes (Vagif, Aziza) carry a public-domain mark set by third parties on commercial material, not accepted. Link-outs to protected recordings need official channels; none confirmed official was found.

Rebuild: `node scripts/jazz.mjs`, `node scripts/people-text.mjs caz/data/people.json caz/data/jazz.candidates.json both`, `node scripts/jazz-build.mjs`.

Data: Wikidata CC0; sentences are short quotations from Wikipedia (CC BY-SA).
