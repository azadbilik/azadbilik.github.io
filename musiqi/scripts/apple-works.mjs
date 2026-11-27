// Recordings of the stage and symphonic works on /musiqi/bestekarlar/ in the Apple Music catalogue.
// Apple files classical recordings under the performers (orchestra, conductor, singers), so a search for the composer misses them;
// this searches for each work by its title (en, az, ru) next to the composer's surname.
//   node scripts/apple-works.mjs           search (~170 requests at 3.3 s, cached in data/.cache/itunes/) -> data/.cache/apple-works.json
//   node scripts/apple-works.mjs --build   from the cache only
// A track is kept when a distinctive word of the work's title stands in the track or album title AND the composer's surname stands in the
// track, album or artist name (single-word titles such as «Rast», «Sevil» need both, and so does everything else). Nothing of the audio is stored.
import { readFile, writeFile } from 'node:fs/promises';
import { toks, tokEq, nameFits, search, hits } from './apple-lib.mjs';
const R = (f) => new URL(f, import.meta.url);
const J = async (f) => JSON.parse(await readFile(R(f), 'utf8'));

const C = await J('../bestekarlar/data/composers.json');
const P = Object.fromEntries(C.people.map((p) => [p.qid, p]));
const clean = (s) => String(s ?? '').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['va', 'and', 'i', 'the', 'of', 'ug', 'bu', 'o', 'on', 'for', 'ugun', 'boyug', 'simfonig', 'simfonia', 'simfonik', 'balet', 'opera', 'baled', 'sanad', 'gandada', 'cantata', 'gandadasi', 'iki']);
const words = (s) => toks(clean(s)).filter((t) => t.length >= 3 && !STOP.has(t));
const surnames = (q) => { const p = P[q]; if (!p) return []; return [...new Set([p.az, p.en, p.ru].filter(Boolean).map((n) => toks(clean(n).split(',')[0]).pop()).filter((t) => t && t.length >= 4))]; };
const has = (hay, need) => need.some((t) => hay.some((h) => tokEq(h, t)));
const hasAll = (hay, need) => need.every((t) => hay.some((h) => tokEq(h, t)));
// words an album named for a work may carry besides the work's title and the composer
const GENERIC = new Set(toks('single ep suite suites ballet balet baleti opera operasi operasindan from selections excerpts highlights music musiqi aria arias complete symphony live remastered vol part act').map((x) => x));
// Kept when: every distinctive word of the work's title (up to three) stands in the track title, or the album is named for the work alone;
// and the composer is named in the track or album title, or is one of the credited artists (a namesake's own song is not the work)
// Titles the catalogue uses that Wikidata's labels do not (checked against the Apple Music results by hand)
const ALIAS = {
  Q8479451: ['One Thousand and One Nights'], // Min bir gecə
  Q4463778: ['The Path of Thunder', 'Тропою грома'], // İldırımlı yollarla
  Q6543240: ['Seven Beauties'], // Yeddi gözəl
  Q16371847: ['To the Memory of Nizami', 'Памяти Низами'], // Nizami simfoniyası (for strings, 1947)
  Q199352: ['Kyurdi Ovshari', 'Kurd Ovshari'], Q12849627: ['Shur'], Q20559131: ['Gyulistan Bayati Shiraz', 'Gulustan Bayati Shiraz'],
  Q12838653: ['Don Quixote', 'Don Quichotte'], Q2985139: ['Koroglu', 'Koroghlu', 'Кёроглу'],
};
const titlesOf = (w) => [w.az, w.en, w.ru, ...(ALIAS[w.qid] ?? [])].filter(Boolean).map((s) => words(s).slice(0, 3)).filter((x) => x.length);
const keep = (x, TT, sur, q) => {
  const tt = toks(x.trackName ?? ''), at = toks(x.collectionName ?? '');
  const albumIsWork = TT.some((need) => hasAll(at, need) && at.every((a) => GENERIC.has(a) || has([a], need) || has([a], sur) || /^\d+$/.test(a)));
  if (!TT.some((need) => hasAll(tt, need)) && !albumIsWork) return false;
  const p = P[q], one = toks(clean(p.az ?? p.en)).length < 2; // a one-word name (Niyazi) in a title is too weak: only an artist credit counts
  if (!one && has([...tt, ...at], surnames(q))) return true;
  const names = [p.az, p.en, p.ru].filter(Boolean).map((n) => clean(n).replace(/,.*$/, ''));
  return String(x.artistName ?? '').split(/\s*(?:&|,|\band\b)\s*/).some((a) => names.some((n) => nameFits(a, n)));
};

// Pass 2: each composer's surname alone (en, az, ru spellings; 200 results), the tracks then sorted to the work whose title they carry
const byComposer = new Map();
for (const q of new Set(C.works.flatMap((w) => w.composers))) {
  const p = P[q]; if (!p) continue;
  const terms = new Map();
  for (const [n, c] of [[p.en, 'us'], [p.az, 'az'], [p.ru && p.ru.split(',')[0].split(' ').pop(), 'ru']]) { if (!n) continue; const last = clean(n).split(',')[0].split(' ').pop(); if (last.length >= 4) terms.set(last + '|' + c, [last, c]); }
  const got = [];
  for (const [term, c] of terms.values()) { const r = await search(term, c, 'song', 200); got.push(...(r.results ?? [])); }
  byComposer.set(q, got);
}

const out = {}, taken = new Set();
for (const w of C.works) {
  const sur = w.composers.flatMap(surnames); if (!sur.length) continue;
  const p = P[w.composers[0]];
  const W = [...new Set([w.az, w.en, w.ru].flatMap(words))], TT = titlesOf(w); if (!W.length) continue;
  const terms = [];
  if (w.en) terms.push([`${clean(w.en)} ${clean(p.en ?? p.az).split(' ').pop()}`, 'us']);
  terms.push([`${clean(w.az)} ${clean(p.az).split(' ').pop()}`, 'az']);
  if (w.ru && p.ru) terms.push([`${clean(w.ru)} ${clean(p.ru).split(',')[0].split(' ').pop()}`, 'ru']);
  const seen = new Set(), tracks = [];
  for (const [term, c] of terms) {
    const r = await search(term, c, 'song', 50);
    for (const x of r.results ?? []) {
      if (!x.previewUrl || !x.trackViewUrl || seen.has(String(x.trackId))) continue;
      if (!w.composers.some((q) => keep(x, TT, sur, q))) continue;
      seen.add(String(x.trackId));
      tracks.push({ id: String(x.trackId), name: x.trackName, album: x.collectionName, albumId: String(x.collectionId), by: x.artistName, preview: x.previewUrl, url: x.trackViewUrl.replace(/[?&]uo=\d+$/, ''), art: x.artworkUrl100, date: (x.releaseDate ?? '').slice(0, 10), ms: x.trackTimeMillis, genre: x.primaryGenreName, albumUrl: x.collectionViewUrl?.replace(/[?&]uo=\d+$/, '') });
    }
  }
  for (const x of w.composers.flatMap((q) => byComposer.get(q) ?? [])) {
    if (!x.previewUrl || !x.trackViewUrl || seen.has(String(x.trackId))) continue;
    if (!w.composers.some((q) => keep(x, TT, sur, q))) continue;
    seen.add(String(x.trackId));
    tracks.push({ id: String(x.trackId), name: x.trackName, album: x.collectionName, albumId: String(x.collectionId), by: x.artistName, preview: x.previewUrl, url: x.trackViewUrl.replace(/[?&]uo=\d+$/, ''), art: x.artworkUrl100, date: (x.releaseDate ?? '').slice(0, 10), ms: x.trackTimeMillis, genre: x.primaryGenreName, albumUrl: x.collectionViewUrl?.replace(/[?&]uo=\d+$/, '') });
  }
  out[w.qid] = tracks.filter((x) => !taken.has(x.id)); tracks.forEach((x) => taken.add(x.id));
  console.log(w.year, w.az, out[w.qid].length, hits.n, 'requests');
}
await writeFile(R('../data/.cache/apple-works.json'), JSON.stringify(out, null, 1));
console.log('works with recordings', Object.values(out).filter((t) => t.length).length, '/', C.works.length, 'tracks', Object.values(out).flat().length);
