# Musiqi · Music

[azadbilik.org/musiqi](https://azadbilik.org/musiqi/): the first recordings, the musicians' map and four sub-pages (`silsile/`, `bestekarlar/`, `caz/`, `estrada/`). Shared: `ui.js`, `ui.css`, `listen.js`.

## Listening links (Apple Music, Spotify, YouTube)

| File | What |
|---|---|
| `listen.js` | The block in a person's card: Apple Music and Spotify links, up to 3 30-second previews, the Apple Music recordings list (az/ru/en) |
| `data/apple.json` | Per Wikidata id: Apple Music artist (id, URL, how it was matched), up to 3 previews (`previewUrl` + the track's Apple Music page), albums (name, year, URL) |
| `data/spotify.json` | Wikidata P1902 (artist) and P2205 (album) ids; plain link-outs, no Spotify API |
| `data/youtube.json` | Wikidata P2397 channels (`scripts/youtube.mjs`) |
| `scripts/apple-wd.mjs`, `scripts/apple.mjs` | Build: Wikidata labels and ids, then the iTunes Search/Lookup API (`data/.cache/` holds the raw answers, git-ignored) |

- Source: the public iTunes Search API (`itunes.apple.com/search`, `/lookup`; no key; at most ~18 requests a minute). Terms followed: every preview links back to the track on Apple Music and carries the «Apple Music» mark; previews are streamed from Apple's `previewUrl`, never downloaded, cached or mirrored; only URLs are stored. Links are labelled plainly «Apple Music» and «Spotify».
- Matching: Wikidata P2850 where present (12 people, authoritative); otherwise the Apple artist's name must fit one of the person's labels (az/ru/en/aliases, transliteration-tolerant, every word must match; storefronts az, us, ru). `DROP` in `scripts/apple.mjs` lists the namesakes and doubtful matches with reasons (a living namesake for a person long dead, a feature credit only, one artist page claimed by two people); `FORCE` and `ALSO` hold hand-checked ids. A person not on Wikidata P2850 with no album and fewer than three tracks is dropped.
- Previews: tracks of the artist's own page (one per album first); for composers, whose works Apple files under the performers, tracks whose album or title carries the composer's surname («Karayev: Piano Works»).
- Recordings lists: Apple's albums by release date. The year is the release of the edition in the Apple Music catalogue, often a reissue of an old recording, not the year it was recorded; the pages say so. On the jazz timeline the Apple Music row shows releases up to 2012.
- These are separate from the public-domain recordings the pages play (Commons); nothing from Apple is called free.
- Rebuild: `node scripts/apple-wd.mjs`, then `node scripts/apple.mjs` (resumable, about an hour from scratch; cached runs take seconds).
