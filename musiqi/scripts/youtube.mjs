// YouTube channels of the people on the bestekarlar, caz and estrada pages, into data/youtube.json ({ qid: { url, src } }).
// src 'wikidata' = the channel id on Wikidata (P2397). 'found' = a channel that answered and bore the artist's name, not confirmed as the artist's own: added by hand in EXTRA.
//   node scripts/youtube.mjs
import { readFile, writeFile } from 'node:fs/promises';
const J = async (f) => JSON.parse(await readFile(new URL(f, import.meta.url), 'utf8'));
const qids = new Set([...(await J('../bestekarlar/data/composers.json')).people.map((p) => p.qid), ...(await J('../caz/data/jazz.json')).people.map((p) => p.qid), ...(await J('../estrada/data/estrada.raw.json')).people.map((p) => p.qid)]);
const EXTRA = { Q2061803: 'https://www.youtube.com/@IsfarSarabski', Q463567: 'https://www.youtube.com/@AminaFigarova' };
const q = `SELECT ?p ?c WHERE { VALUES ?p { ${[...qids].filter((x) => /^Q\d+$/.test(x)).map((x) => 'wd:' + x).join(' ')} } ?p wdt:P2397 ?c }`;
const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'User-Agent': 'azadbilik-musiqi/0.2', 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, body: 'query=' + encodeURIComponent(q) });
const out = {};
for (const b of (await r.json()).results.bindings) out[b.p.value.split('/').pop()] = { url: 'https://www.youtube.com/channel/' + b.c.value, src: 'wikidata' };
for (const [k, url] of Object.entries(EXTRA)) if (!out[k]) out[k] = { url, src: 'found' };
await writeFile(new URL('../data/youtube.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, Object.entries(out).map(([k, v]) => k + ' ' + v.src).join('; '));
