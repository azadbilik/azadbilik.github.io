// Tar and kamança players from Wikidata by instrument (P1303: tar Q546936, kamancheh Q290951) -> data/instrumentalists.json.
// data/musicians.json takes only the occupation «tar player» (Q12846426), and Wikidata has no occupation for kamança players at all,
// so Habil Əliyev, Şəfiqə Eyvazova and Ramiz Quliyev were missing. Kept: a tie to Azerbaijan (citizenship of Azerbaijan or the
// Azerbaijan SSR, the Azerbaijani language, Azerbaijani ethnicity). Left out: singers and composers who also play the tar
// (Rəşid Behbudov, Arif Məlikov, Hüseynqulu Sarabski…), unless their occupations name the instrument too.
//   node scripts/instrumentalists.mjs
import { writeFile } from 'node:fs/promises';

const INST = { Q546936: 'tar', Q290951: 'kamancha' };
const q = `SELECT ?p ?i ?az ?ru ?en ?born ?died ?bp ?bpAz ?bpRu ?bpEn ?wiki ?img (GROUP_CONCAT(DISTINCT ?oL; separator="|") AS ?occs) WHERE {
  VALUES ?i { ${Object.keys(INST).map((k) => 'wd:' + k).join(' ')} }
  ?p wdt:P1303 ?i ; wdt:P31 wd:Q5 .
  { ?p wdt:P27 ?cit FILTER(?cit IN (wd:Q227, wd:Q130229, wd:Q1092537)) } UNION { ?p wdt:P1412|wdt:P103|wdt:P6886 wd:Q9292 } UNION { ?p wdt:P172 wd:Q33350 }
  OPTIONAL { ?p rdfs:label ?az FILTER(lang(?az) = "az") } OPTIONAL { ?p rdfs:label ?ru FILTER(lang(?ru) = "ru") } OPTIONAL { ?p rdfs:label ?en FILTER(lang(?en) = "en") }
  OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died } OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?p wdt:P19 ?bp . OPTIONAL { ?bp rdfs:label ?bpAz FILTER(lang(?bpAz) = "az") } OPTIONAL { ?bp rdfs:label ?bpRu FILTER(lang(?bpRu) = "ru") } OPTIONAL { ?bp rdfs:label ?bpEn FILTER(lang(?bpEn) = "en") } }
  OPTIONAL { ?wiki schema:about ?p ; schema:isPartOf <https://az.wikipedia.org/> }
  OPTIONAL { ?p wdt:P106 ?o . ?o rdfs:label ?oL FILTER(lang(?oL) = "en") }
} GROUP BY ?p ?i ?az ?ru ?en ?born ?died ?bp ?bpAz ?bpRu ?bpEn ?wiki ?img`;
const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': 'azadbilik-musiqi/0.1 (https://github.com/azadbilik)', Accept: 'application/sparql-results+json' } });
if (!res.ok) throw new Error(`Wikidata: HTTP ${res.status}`);
const id = (u) => u.split('/').pop(), year = (d) => d ? Number(d.slice(0, 4)) : null;
const people = new Map();
for (const b of (await res.json()).results.bindings) {
  const qid = id(b.p.value);
  const p = people.get(qid) ?? { qid, az: b.az?.value, ru: b.ru?.value, en: b.en?.value, roles: [], born: year(b.born?.value), died: year(b.died?.value), occ: new Set() };
  const r = INST[id(b.i.value)]; if (!p.roles.includes(r)) p.roles.push(r);
  for (const o of (b.occs?.value ?? '').split('|').filter(Boolean)) p.occ.add(o);
  if (b.bp && !p.place) p.place = { id: id(b.bp.value), az: b.bpAz?.value, ru: b.bpRu?.value, en: b.bpEn?.value };
  if (b.img && !p.image) p.image = b.img.value.replace(/^http:/, 'https:') + '?width=240';
  if (b.wiki && !p.wiki) p.wiki = b.wiki.value;
  people.set(qid, p);
}
const OTHER = /^(singer|opera singer|khananda|composer|film score composer|singer-songwriter)$/, PLAYS = /tar player|kamancheh/;
const left = [], list = [];
for (const p of people.values()) {
  if (!(p.az || p.en)) continue;
  if ([...p.occ].some((o) => OTHER.test(o)) && ![...p.occ].some((o) => PLAYS.test(o))) { left.push(p.az ?? p.en); continue; }
  const { occ, ...rest } = p; list.push(rest);
}
list.sort((a, b) => (a.born ?? 9999) - (b.born ?? 9999));
await writeFile(new URL('../data/instrumentalists.json', import.meta.url), JSON.stringify(list, null, 1) + '\n');
console.log(`${list.length} players: ${list.filter((p) => p.roles.includes('tar')).length} tar, ${list.filter((p) => p.roles.includes('kamancha')).length} kamança; left out as singers/composers: ${left.join(', ')}`);
