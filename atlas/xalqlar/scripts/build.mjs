// Builds the peoples and languages map's data: data/units.geojson (the Republic's districts, from
// the population map's boundaries, each with every people counted there at each census) and
// data/peoples.out.json (each people's republic totals and its language: family, UNESCO status,
// speakers, scripts from Wikidata).
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const csv = async (p) => {
  const [head, ...rows] = (await readFile(new URL(p, root), 'utf8')).trim().split('\n');
  const cols = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((c, i) => [cols[i], c])));
};

const peoples = await json('peoples.json');
const families = await json('families.json');
const rows = await csv('peoples-az.csv');
const totalsRows = await csv('peoples-az-totals.csv');
const base = JSON.parse(await readFile(new URL('../../ehali/data/units.geojson', import.meta.url), 'utf8'));

const features = base.features.filter((f) => f.properties.country === 'az').map((f) => {
  const { key, az, ru, en, area, id } = f.properties;
  const census = {};
  for (const r of rows.filter((r) => r.shapeName === key && peoples[r.people] || r.shapeName === key && r.people === 'Azerbaijanis')) {
    census[r.year] ??= { total: Number(r.total) };
    census[r.year][r.people] = Number(r.count);
  }
  return { type: 'Feature', geometry: f.geometry, properties: { id, key, az, ru, en, area, census } };
});

// Languages from Wikidata: UNESCO status (P1999), scripts (P282)
const qids = [...new Set(Object.values(peoples).map((p) => p.lang).filter(Boolean))];
const q = `SELECT ?l ?status ?statusLabel ?scriptLabel ?wiki WHERE { VALUES ?l { ${qids.map((x) => 'wd:' + x).join(' ')} }
  OPTIONAL { ?l wdt:P1999 ?status } OPTIONAL { ?l wdt:P282 ?script }
  OPTIONAL { ?wiki schema:about ?l ; schema:isPartOf <https://az.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': 'azadbilik-atlas/0.1 (https://github.com/azadbilik)', Accept: 'application/sparql-results+json' } });
const langs = {};
for (const b of res.ok ? (await res.json()).results.bindings : []) {
  const id = b.l.value.split('/').pop();
  const L = (langs[id] ??= { scripts: [] });
  // UNESCO's scale: 1 safe … 6 extinct; the label starts with its number
  if (b.statusLabel) L.unesco = Number(b.statusLabel.value.match(/^\d/)?.[0]) || null;
  if (b.scriptLabel && !/^Q\d+$/.test(b.scriptLabel.value) && !L.scripts.includes(b.scriptLabel.value)) L.scripts.push(b.scriptLabel.value);
  if (b.wiki) L.wiki = b.wiki.value;
}
if (!res.ok) console.warn(`Wikidata: HTTP ${res.status}; languages without status`);

const out = {};
for (const [k, p] of Object.entries(peoples)) {
  const totals = Object.fromEntries(totalsRows.filter((r) => r.people === k).map((r) => [r.year, Number(r.count)]));
  out[k] = { ...p, family: { id: p.family, name: families[p.family] }, language: p.lang ? langs[p.lang] ?? {} : {}, totals };
}
out._republic = Object.fromEntries(totalsRows.filter((r) => r.people === 'Total').map((r) => [r.year, Number(r.count)]));
out._azerbaijanis = Object.fromEntries(totalsRows.filter((r) => r.people === 'Azerbaijanis').map((r) => [r.year, Number(r.count)]));

await writeFile(new URL('units.geojson', root), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
await writeFile(new URL('peoples.out.json', root), JSON.stringify(out) + '\n');
const years = [...new Set(features.flatMap((f) => Object.keys(f.properties.census)))].sort();
console.log(`${features.length} districts · censuses ${years.join(' ')} · ${Object.keys(peoples).length} peoples · ${Object.keys(langs).length} languages from Wikidata`);
for (const [k, p] of Object.entries(out)) if (!k.startsWith('_')) console.log(`  ${k.padEnd(28)} unesco ${p.language.unesco ?? '—'} · ${Object.keys(p.totals).join(' ')}`);
