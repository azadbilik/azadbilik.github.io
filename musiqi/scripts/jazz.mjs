// Azerbaijani jazz from Wikidata: the people listed in SEEDS (the names the page is about plus musicians Wikidata tags with genre
// jazz and a tie to Azerbaijan), their teacher/student links (P1066/P802), bands they belong to (P463) and the albums where they
// are the performer (P175, with a date). Writes caz/data/jazz.raw.json and caz/data/people.json (input of people-text.mjs).
//   node scripts/jazz.mjs
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
// Named in the brief, and tagged jazz on Wikidata with a tie to Azerbaijan (2026-11-26)
const SEEDS = { Q935982: 'Vaqif Mustafazadə', Q2072216: 'Rafiq Babayev', Q234304: 'Aziza Mustafazadə', Q745131: 'Salman Qəmbərov', Q2072597: 'Shahin Novrasli', Q2061803: 'İsfar Sarabski', Q463567: 'Amina Figarova',
  Q2399466: 'Tofiq Quliyev', Q4131531: 'Rauf Hacıyev', Q12844091: 'Pərviz Rüstəmbəyov', Q2072606: 'Rain Sultanov', Q23683775: 'Emil Afrasiyab', Q12838356: 'Camil Əmirov', Q4069332: 'Murad Arif', Q113950089: 'Elçin Şirinov',
  Q73184156: 'Riad Məmmədov', Q123174860: 'Kamran Kərimov', Q61122192: 'Rauf Babayev', Q4404946: 'Çingiz Sadıxov', Q16366963: 'Elza İbrahimova', Q447256: 'Arif Məlikov', Q2564419: 'Eldar Mansurov', Q119220671: 'Xəyyam Mustafazadə',
  Q16366466: 'Diana Hacıyeva', Q4060829: 'Sevda Ələkbərzadə', Q12629623: 'David Gazarov', Q107481566: 'Asif Meherremov', Q110105823: 'Şəhriyar İmanov', Q16366957: 'Elza Seyidcahan' };
const ids = Object.keys(SEEDS), V = ids.map((q) => 'wd:' + q).join(' ');
const people = new Map();
for (const b of await sparql(`SELECT ?p ?p_az ?p_ru ?p_en ?born ?died ?bp ?bp_az ?bp_en ?bp_ru ?wa ?wr ?we WHERE { VALUES ?p { ${V} } ${L('?p')} OPTIONAL{?p wdt:P569 ?born} OPTIONAL{?p wdt:P570 ?died} OPTIONAL{?p wdt:P19 ?bp . ${L('?bp')}}
  OPTIONAL{?wa schema:about ?p ; schema:isPartOf <https://az.wikipedia.org/>} OPTIONAL{?wr schema:about ?p ; schema:isPartOf <https://ru.wikipedia.org/>} OPTIONAL{?we schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/>} }`)) {
  const q = id(b.p.value), p = people.get(q) ?? { qid: q, ...nm(b, 'p'), born: year(b.born?.value), died: year(b.died?.value), wiki: {} };
  if (b.bp && !p.place) p.place = b.bp_az?.value ?? b.bp_en?.value ?? b.bp_ru?.value;
  for (const [k, l] of [['wa', 'az'], ['wr', 'ru'], ['we', 'en']]) if (b[k]) p.wiki[l] ??= decodeURIComponent(b[k].value.split('/wiki/')[1]);
  people.set(q, p);
}
// Teacher links with a seed at either end
const links = new Map(), extra = new Map();
for (const b of await sparql(`SELECT DISTINCT ?s ?t ?x ?x_az ?x_ru ?x_en ?xb ?xd ?ref WHERE { VALUES ?c { ${V} }
  { ?c p:P1066 ?st . ?st ps:P1066 ?t . BIND(?c AS ?s) BIND(?t AS ?x) } UNION { ?c p:P802 ?st . ?st ps:P802 ?s . BIND(?c AS ?t) BIND(?s AS ?x) }
  UNION { ?o p:P1066 ?st . ?st ps:P1066 ?c . BIND(?o AS ?s) BIND(?c AS ?t) BIND(?o AS ?x) } UNION { ?o p:P802 ?st . ?st ps:P802 ?c . BIND(?o AS ?t) BIND(?c AS ?s) BIND(?o AS ?x) }
  BIND(EXISTS { ?st prov:wasDerivedFrom ?r } AS ?ref) ${L('?x')} OPTIONAL{?x wdt:P569 ?xb} OPTIONAL{?x wdt:P570 ?xd} }`)) {
  const s = id(b.s.value), t = id(b.t.value), x = id(b.x.value);
  links.set(s + '>' + t, { t, s, src: 'wikidata', ref: b.ref?.value === 'true' });
  if (!people.has(x)) extra.set(x, { qid: x, ...nm(b, 'x'), born: year(b.xb?.value), died: year(b.xd?.value), offmap: true, wiki: {} });
}
// Bands (member of) shared by two or more seeds
const bands = new Map();
for (const b of await sparql(`SELECT ?p ?g ?g_az ?g_ru ?g_en ?gi WHERE { VALUES ?p { ${V} } ?p wdt:P463 ?g . ${L('?g')} OPTIONAL{?g wdt:P571 ?gi} }`)) {
  const g = id(b.g.value), e = bands.get(g) ?? { qid: g, ...nm(b, 'g'), founded: year(b.gi?.value), members: [] };
  e.members.push(id(b.p.value)); bands.set(g, e);
}
// Albums with a performer (P175) among the seeds
const albums = new Map();
for (const b of await sparql(`SELECT ?a ?a_az ?a_ru ?a_en ?d ?p WHERE { VALUES ?p { ${V} } ?a wdt:P175 ?p ; wdt:P577 ?d . ?a wdt:P31/wdt:P279* wd:Q482994 . ${L('?a')} }`)) {
  const a = id(b.a.value), e = albums.get(a) ?? { qid: a, ...nm(b, 'a'), year: year(b.d.value), performers: [] };
  e.performers.push(id(b.p.value)); albums.set(a, e);
}
const raw = { built: new Date().toISOString().slice(0, 10), people: [...people.values()], extra: [...extra.values()], links: [...links.values()], bands: [...bands.values()], albums: [...albums.values()] };
await writeFile(new URL('../caz/data/jazz.raw.json', import.meta.url), JSON.stringify(raw));
await writeFile(new URL('../caz/data/people.json', import.meta.url), JSON.stringify([...people.values(), ...extra.values()].map((p) => ({ qid: p.qid, az: p.az, ru: p.ru, en: p.en, wiki: p.wiki }))));
console.log(`people ${people.size}, off-list ${extra.size}, links ${links.size}, bands ${bands.size} (shared ${[...bands.values()].filter((g) => g.members.length > 1).length}), albums ${albums.size}`);
