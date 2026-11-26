// Master–student links among the musicians of the music map, into data/lineage.json.
//
// Two kinds of link, kept apart:
//   wikidata  student of (P1066) / student (P802) between musicians, as Wikidata states them
//   text      a sentence of the az / ru / en Wikipedia article of one musician that names another
//             next to a word of teaching («şagirdi», «ученик», «student of»); the sentence is kept
//             beside the link. The direction is read from the sentence's wording (see CUES) and the
//             list is checked by hand in data/lineage.curation.json (drop / flip / keep)
//
//   node scripts/lineage.mjs            fetch (Wikidata, Wikipedia) and write data/lineage.json
//   CACHE=<dir> node scripts/lineage.mjs   keep the fetched article texts in <dir> between runs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const UA = { 'User-Agent': 'azadbilik-musiqi/0.1 (https://github.com/azadbilik)', Accept: 'application/json' };
const cache = process.env.CACHE ?? join(tmpdir(), 'azadbilik-lineage');
await mkdir(cache, { recursive: true });
const read = async (p, d) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8').catch(() => JSON.stringify(d)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const idOf = (u) => u.split('/').pop();

async function sparql(q) {
  for (let k = 0; k < 4; k++) {
    const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: UA });
    if (r.ok) return (await r.json()).results.bindings;
    await sleep(2000 * (k + 1));
  }
  throw new Error('Wikidata failed');
}

const musicians = await read('../data/musicians.json', []);
const OCC = 'wd:Q2493398 wd:Q12846426 wd:Q7097633';

// 1. Wikidata: every student-of link with a khanende, tar player or ashik at either end
const rows = await sparql(`SELECT DISTINCT ?teacher ?student WHERE {
  VALUES ?occ { ${OCC} } ?x wdt:P106 ?occ .
  { ?x wdt:P1066 ?t . BIND(?t AS ?teacher) BIND(?x AS ?student) }
  UNION { ?x wdt:P802 ?s . BIND(?x AS ?teacher) BIND(?s AS ?student) }
  UNION { ?s2 wdt:P1066 ?x . BIND(?x AS ?teacher) BIND(?s2 AS ?student) }
  UNION { ?t2 wdt:P802 ?x . BIND(?t2 AS ?teacher) BIND(?x AS ?student) }
}`);
const wd = [...new Map(rows.map((b) => { const l = { teacher: idOf(b.teacher.value), student: idOf(b.student.value) }; return [`${l.teacher}>${l.student}`, l]; })).values()];

// 2. The people: the map's musicians plus the ends of those links, with names, years, occupations, sitelinks
const qids = [...new Set([...musicians.map((m) => m.qid), ...wd.flatMap((l) => [l.teacher, l.student])])].filter((q) => /^Q\d+$/.test(q));
const people = new Map(musicians.map((m) => [m.qid, { qid: m.qid, az: m.az, ru: m.ru, en: m.en, born: m.born, died: m.died, roles: m.roles, kitabxana: m.kitabxana, place: m.place?.az ?? m.place?.en }]));
for (let i = 0; i < qids.length; i += 80) {
  const part = qids.slice(i, i + 80);
  const r = await sparql(`SELECT ?p ?az ?ru ?en ?tr ?born ?died ?wiki ?alias ?occL WHERE { VALUES ?p { ${part.map((q) => 'wd:' + q).join(' ')} }
    OPTIONAL { ?p rdfs:label ?az FILTER(lang(?az)="az") } OPTIONAL { ?p rdfs:label ?ru FILTER(lang(?ru)="ru") } OPTIONAL { ?p rdfs:label ?en FILTER(lang(?en)="en") } OPTIONAL { ?p rdfs:label ?tr FILTER(lang(?tr)="tr") }
    OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died }
    OPTIONAL { ?p skos:altLabel ?alias FILTER(lang(?alias) IN ("az","ru","en","tr")) }
    OPTIONAL { ?p wdt:P106 ?occ . ?occ rdfs:label ?occL FILTER(lang(?occL)="en") } }`);
  for (const b of r) {
    const q = idOf(b.p.value), p = people.get(q) ?? { qid: q };
    for (const k of ['az', 'ru', 'en', 'tr']) if (b[k] && !p[k]) p[k] = b[k].value;
    if (b.born && p.born == null) p.born = Number(b.born.value.slice(0, 4));
    if (b.died && p.died == null) p.died = Number(b.died.value.slice(0, 4));
    if (b.alias) (p.aliases ??= new Set()).add(b.alias.value);
    if (b.occL) (p.occ ??= new Set()).add(b.occL.value);
    people.set(q, p);
  }
  await sleep(500);
}
// Wikipedia article titles (az, ru, en)
const WIKI = ['az', 'ru', 'en'];
for (let i = 0; i < qids.length; i += 80) {
  const part = qids.slice(i, i + 80);
  const r = await sparql(`SELECT ?p ?a WHERE { VALUES ?p { ${part.map((q) => 'wd:' + q).join(' ')} } ?a schema:about ?p ; schema:isPartOf ?site . FILTER(STRSTARTS(STR(?site), "https://az.wikipedia.org/") || STRSTARTS(STR(?site), "https://ru.wikipedia.org/") || STRSTARTS(STR(?site), "https://en.wikipedia.org/")) }`);
  for (const b of r) {
    const u = new URL(b.a.value), lang = u.hostname.split('.')[0], p = people.get(idOf(b.p.value));
    (p.wiki ??= {})[lang] = decodeURIComponent(u.pathname.replace('/wiki/', ''));
  }
  await sleep(500);
}

// 3. Article texts (cached), sentences with a teaching word and a name from the list
async function article(lang, title) {
  const f = join(cache, `${lang}-${title.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 80)}.txt`);
  if (existsSync(f)) return readFile(f, 'utf8');
  const u = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title.replace(/_/g, ' '))}`;
  let text = '';
  for (let k = 0; k < 3; k++) {
    const r = await fetch(u, { headers: UA });
    if (r.ok) { const j = await r.json(); text = Object.values(j.query?.pages ?? {})[0]?.extract ?? ''; break; }
    await sleep(1500);
  }
  await writeFile(f, text);
  await sleep(120);
  return text;
}
const CUES = {
  az: /şagird|ustad|müəllim|dərs (al|keç)|yanında|tələbə|öyrən|tərbiy|yetiş|oxu(yub|muş)|təhsil/i,
  ru: /учени|учил|учён|учёб|учител|наставник|урок|обуча|воспитан|школ[аеу]/i,
  en: /student|pupil|studied|taught|teacher|apprentic|mentor|lessons|disciple/i,
};
const norm = (s) => s.normalize('NFC').toLocaleLowerCase('az').replace(/[’'`ʻ‘]/g, '').replace(/\s+/g, ' ');
const HONOR = /^(aşıq|ashiq|ashug|ashik|ashig|asiq|ашуг|ашик|ашиг|xanəndə|ханенде|hacı|haji|хаджи|molla|мулла|mirzə|мирза|usta|уста|хаджи|şair)\s+/i;
// Names to look for in each language's text: the labels and aliases, with and without an honorific, and a distinctive last word
const names = new Map(); // lang → [{ qid, form, weak }]
for (const lang of WIKI) {
  const list = [];
  const lastCount = new Map();
  for (const p of people.values()) {
    const base = new Set([p[lang], ...(lang === 'az' ? [p.tr, ...(p.aliases ?? [])] : lang === 'ru' ? [...(p.aliases ?? [])] : [...(p.aliases ?? [])])].filter(Boolean));
    for (const n of base) {
      const forms = new Set([norm(n), norm(n.replace(HONOR, ''))]);
      for (const f of forms) if (f.length >= 5) list.push({ qid: p.qid, form: f, weak: false });
      const last = norm(n.replace(HONOR, '')).split(' ').pop();
      if (last.length >= 8 && norm(n).includes(' ')) { lastCount.set(last, (lastCount.get(last) ?? new Set()).add(p.qid)); }
    }
  }
  for (const [last, qs] of lastCount) if (qs.size === 1) list.push({ qid: [...qs][0], form: last, weak: true });
  names.set(lang, list.sort((a, b) => b.form.length - a.form.length));
}

const sentences = (t) => t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 25 && s.length < 700);
const found = [];
const work = [...people.values()].filter((p) => p.wiki);
let done = 0;
for (const p of work) {
  for (const lang of WIKI) {
    if (!p.wiki[lang]) continue;
    const text = await article(lang, p.wiki[lang]);
    for (const s of sentences(text)) {
      if (!CUES[lang].test(s)) continue;
      const low = norm(s), hits = new Map();
      for (const n of names.get(lang)) {
        if (n.qid === p.qid) continue;
        const at = low.indexOf(n.form);
        if (at < 0) continue;
        // A whole word, not the middle of another
        const pre = low[at - 1], post = low[at + n.form.length];
        if ((pre && /\p{L}/u.test(pre)) ) continue;
        if (!hits.has(n.qid) || (hits.get(n.qid).weak && !n.weak)) hits.set(n.qid, { at, weak: n.weak, form: n.form });
      }
      for (const [qid, h] of hits) found.push({ subject: p.qid, other: qid, lang, article: `https://${lang}.wikipedia.org/wiki/${p.wiki[lang]}`, sentence: s, weak: h.weak, at: h.at });
    }
  }
  if (++done % 25 === 0) console.log(`${done}/${work.length} articles read`);
}
await writeFile(new URL('../silsile/data/lineage.candidates.json', import.meta.url), JSON.stringify({ built: new Date().toISOString().slice(0, 10), wikidata: wd, people: [...people.values()].map(({ aliases, occ, ...p }) => ({ ...p, occ: occ ? [...occ] : undefined })), candidates: found }, null, 1) + '\n');
console.log(`${wd.length} Wikidata links; ${found.length} candidate sentences from ${work.length} people`);
