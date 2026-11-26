// Stage 1: fetch raw results from the Wikidata Query Service into data/raw/ (git-ignored cache).
//   node scripts/fetch.mjs            fetches whatever is not cached yet; delete data/raw to refetch
// Politeness: one request at a time, a pause between, a descriptive User-Agent, retries with backoff.
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { buildRegion } from './region.mjs';

const RAW = new URL('../data/raw/', import.meta.url);
mkdirSync(RAW, { recursive: true });
const UA = 'azadbilik-hub/1.0 (https://azadbilik.org; open data hub, CC0)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cacheFile = (name) => new URL(name + '.json', RAW);

async function sparql(name, query) {
  const f = cacheFile(name);
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch('https://query.wikidata.org/sparql', {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ query }),
        signal: AbortSignal.timeout(130000),
      });
      if (res.status === 429) { const w = Number(res.headers.get('retry-after') ?? 30); console.log('  429, waiting', w); await sleep((w + 5) * 1000); continue; }
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
      const j = await res.json();
      writeFileSync(f, JSON.stringify(j.results.bindings));
      await sleep(1500);
      return j.results.bindings;
    } catch (e) {
      console.log('  retry', name, attempt, String(e).slice(0, 160));
      await sleep(5000 * (attempt + 1));
    }
  }
  return null;
}
const qid = (u) => u.slice(u.lastIndexOf('/') + 1);

// ---- 1. people born in a place with coordinates inside a tile
const personCols = `?p ?pLabel ?bp ?born ?dp ?died ?sl ?sex`;
const tileQuery = (w, s, e, n) => `SELECT ${personCols} WHERE {
  SERVICE wikibase:box { ?bp wdt:P625 ?bpc . bd:serviceParam wikibase:cornerSouthWest "Point(${w} ${s})"^^geo:wktLiteral . bd:serviceParam wikibase:cornerNorthEast "Point(${e} ${n})"^^geo:wktLiteral }
  ?p wdt:P19 ?bp ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?sl . FILTER(?sl >= 1)
  OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died } OPTIONAL { ?p wdt:P20 ?dp } OPTIONAL { ?p wdt:P21 ?sex }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,az,ru" }
}`;
const r5 = (x) => Math.round(x * 1000) / 1000;
async function tile(w, s, e, n, depth = 0) {
  const name = `tile_${r5(w)}_${r5(s)}_${r5(e)}_${r5(n)}`;
  const rows = await sparql(name, tileQuery(w, s, e, n));
  if (rows) { console.log(name, rows.length); return; }
  if (depth > 3) throw new Error('tile keeps failing ' + name);
  const mx = (w + e) / 2, my = (s + n) / 2; // split in four
  for (const [a, b, c, d] of [[w, s, mx, my], [mx, s, e, my], [w, my, mx, n], [mx, my, e, n]]) await tile(a, b, c, d, depth + 1);
}
const region = buildRegion();
const [W, S, E, N] = region.bbox;
let tiles = 0;
for (let lon = Math.floor(W); lon < Math.ceil(E); lon++) {
  for (let lat = Math.floor(S); lat < Math.ceil(N); lat++) {
    if (!region.touches(lon, lat, lon + 1, lat + 1)) continue;
    tiles++; await tile(lon, lat, lon + 1, lat + 1);
  }
}
console.log('tiles', tiles);

// ---- 2. people of Azerbaijani ethnic group (P172), wherever born
const ETH = ['Q482942', 'Q2426677', 'Q101452272', 'Q2356912', 'Q2476065', 'Q4058280'];
await sparql('ethnic', `SELECT ${personCols} ?eg WHERE {
  VALUES ?eg { ${ETH.map((x) => 'wd:' + x).join(' ')} }
  ?p wdt:P172 ?eg ; wdt:P31 wd:Q5 ; wikibase:sitelinks ?sl . FILTER(?sl >= 1)
  OPTIONAL { ?p wdt:P19 ?bp } OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died } OPTIONAL { ?p wdt:P20 ?dp } OPTIONAL { ?p wdt:P21 ?sex }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,az,ru" }
}`);

// ---- 3. everything else for the people found: occupations, residences, languages, wiki links
const ids = new Set();
for (const f of (await import('node:fs')).readdirSync(RAW)) {
  if (!/^(tile_|ethnic)/.test(f)) continue;
  for (const r of JSON.parse(readFileSync(new URL(f, RAW), 'utf8'))) ids.add(qid(r.p.value));
}
const people = [...ids];
console.log('people', people.length);
const B = 200;
for (let i = 0; i < people.length; i += B) {
  const vals = people.slice(i, i + B).map((x) => 'wd:' + x).join(' ');
  const name = `detail_${String(i / B).padStart(4, '0')}`;
  await sparql(name, `SELECT ?p ?k ?v ?t WHERE { VALUES ?p { ${vals} } {
      ?p wdt:P106 ?v BIND("occ" AS ?k) } UNION { ?p wdt:P551 ?v BIND("res" AS ?k) } UNION { ?p wdt:P937 ?v BIND("work" AS ?k) }
    UNION { ?p wdt:P1412 ?v BIND("lang" AS ?k) } UNION { ?p wdt:P6886 ?v BIND("lang" AS ?k) } UNION { ?p wdt:P172 ?v BIND("eth" AS ?k) }
    UNION { ?p wdt:P1317 ?v BIND("act" AS ?k) } UNION { ?p wdt:P27 ?v BIND("cit" AS ?k) }
    UNION { ?a schema:about ?p ; schema:isPartOf ?site ; schema:name ?t . FILTER(?site IN (<https://en.wikipedia.org/>, <https://az.wikipedia.org/>, <https://ru.wikipedia.org/>)) BIND(REPLACE(STR(?site), "https://(..)\\\\..*", "$1") AS ?v) BIND("wp" AS ?k) } }`);
}

// ---- 4. labels (en/az/ru) and coordinates of every entity referenced
const ents = new Set(people);
for (const f of (await import('node:fs')).readdirSync(RAW)) {
  if (/^(tile_|ethnic)/.test(f)) for (const r of JSON.parse(readFileSync(new URL(f, RAW), 'utf8'))) for (const k of ['bp', 'dp']) if (r[k]) ents.add(qid(r[k].value));
  if (f.startsWith('detail_')) for (const r of JSON.parse(readFileSync(new URL(f, RAW), 'utf8'))) if (r.k.value !== 'wp') ents.add(qid(r.v.value));
}
const E_ = [...ents].filter((x) => /^Q\d+$/.test(x)); // blank-node ("unknown value") places would break a VALUES list
console.log('entities', E_.length);
const BE = 400;
for (let i = 0; i < E_.length; i += BE) {
  const vals = E_.slice(i, i + BE).map((x) => 'wd:' + x).join(' ');
  await sparql(`ent_${String(i / BE).padStart(4, '0')}`, `SELECT ?e ?lang ?l ?c ?par ?pc ?ctry WHERE { VALUES ?e { ${vals} }
    OPTIONAL { ?e rdfs:label ?l . BIND(LANG(?l) AS ?lang) FILTER(?lang IN ("en","az","ru")) }
    OPTIONAL { ?e wdt:P625 ?c } OPTIONAL { ?e wdt:P17 ?ctry }
    OPTIONAL { ?e wdt:P131 ?par . ?par wdt:P625 ?pc } }`);
}
// ---- 5. entities the batch queries did not return (a few hundred): ask again, in smaller batches
{
  const have = new Set();
  for (const f of readdirSync(RAW)) if (f.startsWith('ent_')) for (const r of JSON.parse(readFileSync(new URL(f, RAW), 'utf8'))) have.add(qid(r.e.value));
  const miss = E_.filter((x) => /^Q\d+$/.test(x) && !have.has(x));
  console.log('missing entities', miss.length);
  for (let i = 0; i < miss.length; i += 50) {
    const vals = miss.slice(i, i + 50).map((x) => 'wd:' + x).join(' ');
    await sparql(`entfix_${String(i / 50).padStart(4, '0')}`, `SELECT ?e ?lang ?l ?c ?par ?pc ?ctry WHERE { VALUES ?e { ${vals} }
      OPTIONAL { ?e rdfs:label ?l . BIND(LANG(?l) AS ?lang) FILTER(?lang IN ("en","az","ru")) }
      OPTIONAL { ?e wdt:P625 ?c } OPTIONAL { ?e wdt:P17 ?ctry }
      OPTIONAL { ?e wdt:P131 ?par . ?par wdt:P625 ?pc } }`);
  }
}
console.log('done');
