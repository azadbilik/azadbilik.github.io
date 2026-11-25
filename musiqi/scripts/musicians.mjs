// Fetches the musicians for the music map from Wikidata: khanendes (mugham singers, Q2493398),
// tar players (Q12846426) and ashiks (Q7097633), with their birthplaces, years and names, into
// data/musicians.json. Kitabxana.az authors (the literary map's list) are linked by Wikidata id.
//   node scripts/musicians.mjs
import { readFile, writeFile } from 'node:fs/promises';

const OCC = { Q2493398: 'khanende', Q12846426: 'tar', Q7097633: 'ashik' };
const q = `SELECT ?p ?occ ?az ?ru ?en ?born ?died ?bp ?bpAz ?bpRu ?bpEn ?coord ?tied ?other WHERE {
  VALUES ?occ { ${Object.keys(OCC).map((k) => 'wd:' + k).join(' ')} }
  ?p wdt:P106 ?occ ; wdt:P19 ?bp . ?bp wdt:P625 ?coord .
  OPTIONAL { ?p rdfs:label ?az FILTER(lang(?az) = "az") } OPTIONAL { ?p rdfs:label ?ru FILTER(lang(?ru) = "ru") } OPTIONAL { ?p rdfs:label ?en FILTER(lang(?en) = "en") }
  OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died }
  # Ties to Azerbaijan: citizenship (Azerbaijan, the Azerbaijan SSR), Azerbaijani as a language, ethnicity
  OPTIONAL { ?p wdt:P27 ?cit FILTER(?cit IN (wd:Q227, wd:Q130229, wd:Q1092537)) }
  OPTIONAL { ?p wdt:P1412|wdt:P103|wdt:P6886 ?lng FILTER(?lng = wd:Q9292) }
  OPTIONAL { ?p wdt:P172 ?eth FILTER(?eth = wd:Q33350) }
  BIND(BOUND(?cit) || BOUND(?lng) || BOUND(?eth) AS ?tied)
  # …and marks of another tradition: Armenian or Georgian ethnicity, Turkish, Armenian, Georgian or Ottoman citizenship
  OPTIONAL { ?p wdt:P172 ?oeth FILTER(?oeth IN (wd:Q79797, wd:Q133032)) }
  OPTIONAL { ?p wdt:P27 ?ocit FILTER(?ocit IN (wd:Q43, wd:Q399, wd:Q230, wd:Q12560, wd:Q132856, wd:Q131337)) }
  BIND(BOUND(?oeth) || BOUND(?ocit) AS ?other)
  OPTIONAL { ?bp rdfs:label ?bpAz FILTER(lang(?bpAz) = "az") } OPTIONAL { ?bp rdfs:label ?bpRu FILTER(lang(?bpRu) = "ru") } OPTIONAL { ?bp rdfs:label ?bpEn FILTER(lang(?bpEn) = "en") }
}`;
const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': 'azadbilik-musiqi/0.1 (https://github.com/azadbilik)', Accept: 'application/sparql-results+json' } });
if (!res.ok) throw new Error(`Wikidata: HTTP ${res.status}`);
const rows = (await res.json()).results.bindings;
const kx = JSON.parse(await readFile(new URL('../../../xerite/data/authors.json', import.meta.url), 'utf8').catch(() => '[]'));
const kxByQid = new Map(kx.filter((a) => a.wikidata).map((a) => [a.wikidata, a.slug]));
const id = (u) => u.split('/').pop();
const year = (d) => d ? Number(d.slice(0, d.startsWith('-') ? 5 : 4)) : null;
const people = new Map();
for (const b of rows) {
  const qid = id(b.p.value);
  const p = people.get(qid) ?? { qid, az: b.az?.value, ru: b.ru?.value, en: b.en?.value, roles: [], born: year(b.born?.value), died: year(b.died?.value) };
  const role = OCC[id(b.occ.value)];
  if (!p.roles.includes(role)) p.roles.push(role);
  if (!p.place) {
    const [lng, lat] = b.coord.value.replace(/Point\(|\)/g, '').split(' ').map(Number);
    p.place = { id: id(b.bp.value), az: b.bpAz?.value, ru: b.bpRu?.value, en: b.bpEn?.value, lat: +lat.toFixed(4), lng: +lng.toFixed(4) };
  }
  if (kxByQid.has(qid)) p.kitabxana = kxByQid.get(qid);
  if (b.tied?.value === 'true' || p.kitabxana) p.tied = true;
  if (b.other?.value === 'true') p.other = true;
  people.set(qid, p);
}
// Azerbaijani musicians only: Turkish âşıks and Armenian ashughs share the word but not this map.
// Kept: a tie to Azerbaijan on Wikidata; or born in the region (the Caucasus, Iranian Azerbaijan,
// eastern Anatolia) with no mark of another tradition (19th-century singers carry only the
// Russian Empire's citizenship)
const inRegion = (pl) => pl.lat > 35.5 && pl.lat < 43.8 && pl.lng > 40.5 && pl.lng < 51.5;
// Armenian ashughs Wikidata gives no ethnicity: Naghash Hovnatan, Shirin, Sazayi, Sheram, Nirani
const ARMENIAN_ASHUGHS = new Set(['Q2038818', 'Q20510636', 'Q85983588', 'Q1985740', 'Q116789894']);
for (const p of people.values()) if (!p.tied && inRegion(p.place) && !p.other && !ARMENIAN_ASHUGHS.has(p.qid)) p.tied = true;
const left = [...people.values()].filter((p) => !p.tied);
console.log(`left out (no tie to Azerbaijan on Wikidata): ${left.length}, e.g. ${left.slice(0, 8).map((p) => p.az ?? p.en).join(', ')}`);
const list = [...people.values()].filter((p) => p.tied && (p.az || p.en)).map(({ tied, other, ...p }) => p).sort((a, b) => (a.born ?? 9999) - (b.born ?? 9999));
await writeFile(new URL('../data/musicians.json', import.meta.url), JSON.stringify(list, null, 1) + '\n');
const count = (r) => list.filter((p) => p.roles.includes(r)).length;
console.log(`${list.length} musicians: ${count('khanende')} khanendes, ${count('tar')} tar players, ${count('ashik')} ashiks; ${list.filter((p) => p.kitabxana).length} on kitabxana`);
const places = Object.entries(Object.groupBy(list, (p) => p.place.az ?? p.place.en)).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
console.log('top places:', places.map(([k, v]) => `${k} ${v.length}`).join(', '));
