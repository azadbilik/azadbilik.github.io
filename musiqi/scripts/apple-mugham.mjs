// Mugham recordings in the Apple Music catalogue beyond the ten tracks per musician the player keeps:
//   1. the full track lists of the albums of mugham singers and players whose song lookup stopped at Apple's limit (Alim Qasımov, Malik Mansurov…);
//   2. a search for each dəstgah and zərbi mugham by name (az, us, ru storefronts), which also finds performers not in the catalogue.
//   node scripts/apple-mugham.mjs           (requests at 3.3 s, cached in data/.cache/itunes/) -> data/.cache/apple-mugham.json
//   node scripts/apple-mugham.mjs --build   from the cache only
// Which tracks belong to which dəstgah is decided in scripts/listen-build.mjs (mughamOf), not here. Only URLs are kept.
import { readFile, writeFile } from 'node:fs/promises';
import { search, lookup, hits } from './apple-lib.mjs';
const R = (f) => new URL(f, import.meta.url);
const J = async (f) => JSON.parse(await readFile(R(f), 'utf8'));

const CAT = await J('../data/catalog.json'), MATCH = await J('../data/.cache/apple-match.json'), APPLE = (await J('../data/apple.json')).people, MUG = await J('../data/mugham.json');
const clean = (u) => u?.replace(/[?&]uo=\d+$/, '');
const track = (x) => ({ id: String(x.trackId), name: x.trackName, album: x.collectionName, albumId: String(x.collectionId), by: x.artistName, artistId: String(x.artistId ?? ''), preview: x.previewUrl, url: clean(x.trackViewUrl), albumUrl: clean(x.collectionViewUrl), art: x.artworkUrl100, date: (x.releaseDate ?? '').slice(0, 10), ms: x.trackTimeMillis, genre: x.primaryGenreName });
const songs = (r) => (r.results ?? []).filter((x) => x.wrapperType === 'track' && x.kind === 'song' && x.previewUrl && x.trackViewUrl).map(track);

// 1. album track lists of the mugham musicians whose song lookup was cut off
const byArtist = {};
for (const a of CAT.artists) {
  if (!APPLE[a.q] || !a.g.some((g) => g === 'mugham' || g === 'instr')) continue;
  const m = MATCH[a.q]; if ((m?.songs ?? []).length < 100) continue;
  const got = new Map();
  for (const al of m.albums ?? []) { for (const x of songs(await lookup(al.id, m.cand[0].country ?? 'az', 'song', 200))) got.set(x.id, x); }
  byArtist[a.q] = [...got.values()];
  console.log(a.az, (m.albums ?? []).length, 'albums', got.size, 'tracks', hits.n, 'requests');
}

// 2. the dəstgahs and zərbi mughams by name
const names = new Set();
for (const d of MUG.dastgahs) { names.add(d.name.az); names.add(d.name.en); }
for (const p of MUG.pieces) if (p.dastgah && p.confidence === 'sourced' && p.kind !== 'dastgah') names.add(p.name);
const found = new Map();
for (const n of names) {
  for (const [term, c] of [[`${n} muğam`, 'az'], [`${n} mugham`, 'us'], [`${n} мугам`, 'ru']]) for (const x of songs(await search(term, c, 'song', 200))) found.set(x.id, x);
}
console.log(names.size, 'names searched,', found.size, 'tracks,', hits.n, 'requests');
await writeFile(R('../data/.cache/apple-mugham.json'), JSON.stringify({ byArtist, search: [...found.values()] }));
