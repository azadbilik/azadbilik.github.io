// Soviet-era Azerbaijani estrada (pop, film and concert singers, ensembles, song composers) from Wikidata, for /musiqi/estrada/.
// The list is chosen by hand (SEEDS: the names the page is about); everything else comes from Wikidata.
//   node scripts/estrada.mjs
import { writeFile } from 'node:fs/promises';
const UA = { 'User-Agent': 'azadbilik-musiqi/0.2 (https://github.com/azadbilik)', Accept: 'application/sparql-results+json' };
async function sparql(q) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
    if (r.ok) return (await r.json()).results.bindings;
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
  throw new Error('Wikidata failed');
}
const id = (u) => u.split('/').pop();
const year = (d) => d ? Number(d.slice(0, d.startsWith('-') ? 5 : 4)) : null;
const L = (v) => `OPTIONAL { ${v} rdfs:label ?${v.slice(1)}_az FILTER(lang(?${v.slice(1)}_az)="az") } OPTIONAL { ${v} rdfs:label ?${v.slice(1)}_ru FILTER(lang(?${v.slice(1)}_ru)="ru") } OPTIONAL { ${v} rdfs:label ?${v.slice(1)}_en FILTER(lang(?${v.slice(1)}_en)="en") }`;
const nm = (b, v) => Object.fromEntries(['az', 'ru', 'en'].map((l) => [l, b[`${v}_${l}`]?.value]).filter(([, x]) => x));
const SEEDS = { Q714776: 'singer', Q1131312: 'singer', Q558799: 'singer', Q498137: 'singer', Q2507445: 'singer', Q112651: 'singer', Q12839912: 'singer', Q434919: 'singer', Q2035105: 'singer', Q12835981: 'singer', Q12839110: 'singer',
  Q4134373: 'ensemble', Q110104536: 'ensemble', Q2399466: 'composer', Q12844922: 'composer', Q2564419: 'composer', Q2072216: 'composer', Q447256: 'composer', Q4131531: 'composer' };
const V = Object.keys(SEEDS).map((q) => 'wd:' + q).join(' ');
const out = new Map();
for (const b of await sparql(`SELECT ?p ?p_az ?p_ru ?p_en ?born ?died ?bp ?bp_az ?bp_ru ?bp_en ?wa ?wr ?we ?aw ?aw_en ?genre ?genre_en WHERE { VALUES ?p { ${V} } ${L('?p')} OPTIONAL{?p wdt:P569 ?born} OPTIONAL{?p wdt:P570 ?died} OPTIONAL{?p wdt:P571 ?born}
  OPTIONAL{?p wdt:P19 ?bp . ${L('?bp')}} OPTIONAL{?p wdt:P136 ?genre . ?genre rdfs:label ?genre_en FILTER(lang(?genre_en)="en")} OPTIONAL{?p wdt:P166 ?aw . ?aw rdfs:label ?aw_en FILTER(lang(?aw_en)="en")}
  OPTIONAL{?wa schema:about ?p ; schema:isPartOf <https://az.wikipedia.org/>} OPTIONAL{?wr schema:about ?p ; schema:isPartOf <https://ru.wikipedia.org/>} OPTIONAL{?we schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/>} }`)) {
  const q = id(b.p.value), p = out.get(q) ?? { qid: q, kind: SEEDS[q], ...nm(b, 'p'), born: year(b.born?.value), died: year(b.died?.value), wiki: {}, genres: [], awards: [] };
  if (b.bp && !p.place) p.place = nm(b, 'bp');
  if (b.genre_en && !p.genres.includes(b.genre_en.value)) p.genres.push(b.genre_en.value);
  if (b.aw_en && !p.awards.includes(b.aw_en.value)) p.awards.push(b.aw_en.value);
  for (const [k, l] of [['wa', 'az'], ['wr', 'ru'], ['we', 'en']]) if (b[k]) p.wiki[l] ??= decodeURIComponent(b[k].value.split('/wiki/')[1]);
  out.set(q, p);
}
await writeFile(new URL('../estrada/data/estrada.raw.json', import.meta.url), JSON.stringify({ built: new Date().toISOString().slice(0, 10), people: [...out.values()] }));
console.log([...out.values()].map((p) => `${p.az ?? p.en} ${p.born}-${p.died} ${p.kind} g=${p.genres.length} a=${p.awards.length}`).join('\n'));
