# Dinlə · Listen

[azadbilik.org/musiqi/dinle](https://azadbilik.org/musiqi/dinle/): the music section as a player. Every musician of the music pages with something to play, by **period** (first recordings 1900–1920, Soviet era 1920–1991, independence), **genre** (mugham, tar and kamancha, ashiq, classical, estrada, pop, jazz) and **school** (a master and their students), plus the stage and symphonic works found on Apple Music. Artist pages with tracks, albums and Apple Music / Spotify / YouTube links; one player bar that plays a queue (an artist, a work, a whole period). az/ru/en; hash routes (`#/a/Q…`, `#/w/Q…`, `#/c/period/soviet`, `#/c/genre/jazz`, `#/c/school/Q…`, `#/works`, `#/search?q=`).

| File | What |
|---|---|
| `data/catalog.json` | What the page reads (built by `../scripts/listen-build.mjs`; long URL prefixes shortened to `~a/ ~i1/ ~m/ ~u/ ~c/`, expanded by `X()` in the page) |

## Sources

- **Apple Music** (`../data/apple.json`, `../data/.cache/apple-match.json`): up to 10 tracks per musician with a 30-second preview, streamed from Apple and linked to the track; albums with artwork, years being the edition's, not the recording's. Matching and its terms: [`../README.md`](../README.md).
- **Works** (`../scripts/apple-works.mjs` → `../data/.cache/apple-works.json`): Apple files classical recordings under the performers, so each work of [Bəstəkarlar](../bestekarlar/) is searched by title and by the composer's surname. A track is kept when every distinctive word of one of the work's titles (az, ru, en, or a catalogue title in `ALIAS`) stands in the track title, or the album is named for the work alone; and the composer is named in a title or credited as an artist (a one-word name such as Niyazi only as a credit). A track goes to the earliest work it fits. 13 of 60 works found, 51 tracks.
- **Free recordings**: the public-domain recordings of `../data/recordings.json`, `../bestekarlar/` and `../estrada/` (Commons), played in full and marked «azad».
- **Period**: the years from 18 to death (or now) against the three spans; «first recordings» only for someone born by 1890 or with a free recording of the time.
- **Genre**: the person's roles on the music map (khanende, tar, ashik) and sub-pages (composer, jazz, estrada); `GENRE_FIX` by hand.
- **School**: teacher links of [Silsilə](../silsile/), Bəstəkarlar and Caz; a master with at least two playable students (all generations below them), the twelve largest. Teachers from abroad (Shostakovich, Lyadov…) are not in the catalogue.

## Gaps

Most Soviet recordings (Melodiya) are not on Apple Music, or sit under an orchestra or an anthology. No reliable match for Bülbül, Cabbar Qaryağdıoğlu (their free gramophone recordings play here), Qaya, the State Estrada Orchestra, Müslüm Maqomayev Sr., Şəfiqə Axundova, Soltan Hacıbəyov.

Rebuild: `node scripts/apple-works.mjs` (about 10 minutes from scratch, seconds when cached), then `node scripts/listen-build.mjs`.
