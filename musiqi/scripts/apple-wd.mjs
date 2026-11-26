// Step 1 of apple.mjs: Wikidata ids of every person on the music pages -> data/.cache/wd-music.json
// per person: labels (az/ru/en/tr + aliases), P2850 Apple Music artist, P1902 Spotify artist; per album item: P2205 Spotify album (P175 performer)
//   node scripts/apple-wd.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const J = async (f) => JSON.parse(await readFile(new URL(f, import.meta.url), 'utf8'));
const qids = new Set([...(await J('../data/musicians.json')).map((p) => p.qid), ...(await J('../bestekarlar/data/composers.json')).people.map((p) => p.qid), ...(await J('../caz/data/jazz.json')).people.map((p) => p.qid), ...(await J('../estrada/data/estrada.raw.json')).people.map((p) => p.qid)].filter((x) => /^Q\d+$/.test(x)));
const sparql = async (q) => { const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'User-Agent': 'azadbilik-musiqi/0.3 (azadbilik.org)', 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: 'query=' + encodeURIComponent(q) }); if (!r.ok) throw new Error(r.status); return (await r.json()).results.bindings; };
const all = [...qids], out = {};
for (let i = 0; i < all.length; i += 80) {
  const V = all.slice(i, i + 80).map((x) => 'wd:' + x).join(' ');
  const rows = await sparql(`SELECT ?p ?apple ?spot ?album ?spotAlbum WHERE { VALUES ?p { ${V} } OPTIONAL { ?p wdt:P2850 ?apple } OPTIONAL { ?p wdt:P1902 ?spot } OPTIONAL { ?album wdt:P175 ?p; wdt:P2205 ?spotAlbum } }`);
  for (const b of rows) { const q = b.p.value.split('/').pop(), o = out[q] ??= { apple: [], spotify: [], spotAlbums: [] }; if (b.apple) o.apple.push(b.apple.value); if (b.spot) o.spotify.push(b.spot.value); if (b.spotAlbum) o.spotAlbums.push({ qid: b.album.value.split('/').pop(), id: b.spotAlbum.value }); }
  const lab = await sparql(`SELECT ?p ?l ?a WHERE { VALUES ?p { ${V} } OPTIONAL { ?p rdfs:label ?l FILTER(LANG(?l) IN ('az','ru','en','tr','fa')) } OPTIONAL { ?p skos:altLabel ?a FILTER(LANG(?a) IN ('az','ru','en','tr')) } }`);
  for (const b of lab) { const q = b.p.value.split('/').pop(), o = out[q] ??= { apple: [], spotify: [], spotAlbums: [] }; o.names ??= new Set(); if (b.l) o.names.add(b.l.value); if (b.a) o.names.add(b.a.value); }
  console.log(i);
}
for (const o of Object.values(out)) { for (const k of ['apple', 'spotify']) o[k] = [...new Set(o[k])]; o.spotAlbums = [...new Map(o.spotAlbums.map((a) => [a.qid + a.id, a])).values()]; o.names = [...(o.names ?? [])]; }
await mkdir(new URL('../data/.cache/', import.meta.url), { recursive: true });
await writeFile(new URL('../data/.cache/wd-music.json', import.meta.url), JSON.stringify(out));
const v = Object.values(out);
console.log(Object.keys(out).length, 'people; apple', v.filter((o) => o.apple.length).length, 'spotify', v.filter((o) => o.spotify.length).length, 'spotAlbums', v.reduce((n, o) => n + o.spotAlbums.length, 0));
