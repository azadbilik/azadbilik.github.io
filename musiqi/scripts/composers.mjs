// Fetches Azerbaijani composers, their teacher/student links and their stage and orchestral
// works from Wikidata into bestekarlar/data/composers.json and works.json.
//   node scripts/composers.mjs
// Two composers the filter misses are added by id: Müslüm Maqomayev Sr. (Q2499809, born in Dagestan) and Niyazi (Q714526).
// Composer = occupation composer (Q36834) with citizenship Azerbaijan / Azerbaijan SSR / Azerbaijan
// Democratic Republic, or Azerbaijani ethnicity, or born in a place in today's Azerbaijan. Works = items whose composer (P86) is one of them.
import { readFile, writeFile } from 'node:fs/promises';
const UA = { 'User-Agent': 'azadbilik-musiqi/0.2 (https://github.com/azadbilik)', Accept: 'application/sparql-results+json' };
async function sparql(q) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) });
    if (r.ok) return (await r.json()).results.bindings;
    if (i === 3) throw new Error('Wikidata HTTP ' + r.status);
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
}
const id = (u) => u.split('/').pop();
const year = (d) => d ? Number(d.slice(0, d.startsWith('-') ? 5 : 4)) : null;
const lab = (v) => `OPTIONAL { ${v} rdfs:label ?${v.slice(1)}_az FILTER(lang(?${v.slice(1)}_az)="az") } OPTIONAL { ${v} rdfs:label ?${v.slice(1)}_ru FILTER(lang(?${v.slice(1)}_ru)="ru") } OPTIONAL { ${v} rdfs:label ?${v.slice(1)}_en FILTER(lang(?${v.slice(1)}_en)="en") }`;
// Some az labels were typed with Cyrillic look-alikes (ә, һ) in Latin words; put the Azerbaijani letters back
const fixAz = (s) => s && /[A-Za-zƏəÇçŞşĞğİıÖöÜü]/.test(s) ? s.replace(/ә/g, 'ə').replace(/Ә/g, 'Ə').replace(/һ/g, 'h').replace(/Һ/g, 'H') : s;
const names = (b, v) => ({ az: fixAz(b[v + '_az']?.value), ru: b[v + '_ru']?.value, en: b[v + '_en']?.value });
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));

// 1. Composers
const rows = await sparql(`SELECT DISTINCT ?p ?p_az ?p_ru ?p_en ?born ?died ?bp ?bp_az ?bp_ru ?bp_en ?wiki ?wikiRu ?wikiEn ?cit ?eth ?born_az WHERE {
  ?p wdt:P106 wd:Q36834 .
  BIND(EXISTS { ?p wdt:P27 ?c1 FILTER(?c1 IN (wd:Q227, wd:Q130229, wd:Q1092537)) } AS ?cit) BIND(EXISTS { ?p wdt:P172 wd:Q33350 } AS ?eth) BIND(EXISTS { ?p wdt:P19 ?b1 . ?b1 wdt:P17 wd:Q227 } AS ?born_az)
  { ?p wdt:P27 ?c FILTER(?c IN (wd:Q227, wd:Q130229, wd:Q1092537)) } UNION { ?p wdt:P172 wd:Q33350 } UNION { ?p wdt:P19 ?bpl . ?bpl wdt:P17 wd:Q227 } UNION { VALUES ?p { wd:Q2499809 wd:Q714526 } }
  ${lab('?p')} OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died }
  OPTIONAL { ?p wdt:P19 ?bp . ${lab('?bp')} }
  OPTIONAL { ?wiki schema:about ?p ; schema:isPartOf <https://az.wikipedia.org/> }
  OPTIONAL { ?wikiRu schema:about ?p ; schema:isPartOf <https://ru.wikipedia.org/> }
  OPTIONAL { ?wikiEn schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
}`);
// kitabxana.az authors, matched to composers by name below (the API carries no Wikidata ids)
const kxAuthors = [];
for (let pg = 1; ; pg++) {
  const r = await fetch(`https://kitabxana.az/api/authors?limit=100&page=${pg}`, { headers: UA });
  if (!r.ok) break;
  const j = await r.json(); kxAuthors.push(...j.data);
  if (pg >= j.meta.totalPages) break;
}
const kxByQid = new Map();
const people = new Map();
for (const b of rows) {
  const qid = id(b.p.value);
  const p = people.get(qid) ?? { qid, ...clean(names(b, 'p')), born: year(b.born?.value), died: year(b.died?.value) };
  if (!p.place && b.bp) p.place = clean({ id: id(b.bp.value), ...names(b, 'bp') });
  p.wiki ??= {};
  for (const [k, l] of [['wiki', 'az'], ['wikiRu', 'ru'], ['wikiEn', 'en']]) if (b[k] && !p.wiki[l]) p.wiki[l] = decodeURIComponent(b[k].value.split('/wiki/')[1]);
  p.via = [b.cit?.value === 'true' && 'citizen', b.eth?.value === 'true' && 'ethnic', b.born_az?.value === 'true' && 'born'].filter(Boolean);
  if (kxByQid.has(qid)) p.kitabxana = kxByQid.get(qid);
  people.set(qid, p);
}
// Composer ⇄ library author by name (az label, diacritics folded); a match is kept only when the years agree
const fold = (x) => (x ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').replace(/[^a-z0-9а-яё ]/g, '').trim();
for (const p of people.values()) {
  const hit = kxAuthors.find((a) => [a.nameAz, a.nameEn].some((n) => fold(n) && fold(n) === fold(p.az ?? p.en)) && (!a.bornYear || !p.born || a.bornYear === p.born));
  if (hit) p.kitabxana = hit.slug;
}
// People with no label in any of the three languages are skipped
for (const [q, p] of people) if (!(p.az || p.ru || p.en)) people.delete(q);

// 2. Teacher links (P1066 student of / P802 student) among composers or with anyone who is on Wikidata as a composer
const inList = [...people.keys()].map((q) => 'wd:' + q).join(' ');
const lk = await sparql(`SELECT DISTINCT ?s ?t ?t_az ?t_ru ?t_en ?tb ?td ?tcomp ?ref WHERE {
  VALUES ?c { ${inList} }
  { ?c p:P1066 ?st . ?st ps:P1066 ?t . BIND(?c AS ?s) } UNION { ?c p:P802 ?st . ?st ps:P802 ?s . BIND(?c AS ?t) }
  BIND(EXISTS { ?st prov:wasDerivedFrom ?rr } AS ?ref)
  FILTER(?s != ?t)
  OPTIONAL { ?t wdt:P106 wd:Q36834 . BIND(true AS ?tcomp) }
  ${lab('?t')} OPTIONAL { ?t wdt:P569 ?tb } OPTIONAL { ?t wdt:P570 ?td }
}`);
// ?t/?s may be outside the composer list: keep any link where either end is a composer on our list and the other is a musician (composer, pianist, conductor...) with a label
const links = new Map(), extra = new Map();
for (const b of lk) {
  const s = id(b.s.value), t = id(b.t.value);
  const k = s + '>' + t, prev = links.get(k);
  links.set(k, { t, s, ref: (prev?.ref ?? false) || b.ref?.value === 'true' });
  if (!people.has(t) && b.t_en || b.t_az || b.t_ru) if (!people.has(t)) extra.set(t, { qid: t, ...clean(names(b, 't')), born: year(b.tb?.value), died: year(b.td?.value), offlist: true, composer: !!b.tcomp });
}
// Students that are not on the list (s outside) need labels too
const sOut = [...new Set([...links.values()].map((l) => l.s))].filter((q) => !people.has(q) && !extra.has(q));
if (sOut.length) {
  const sr = await sparql(`SELECT ?s ?s_az ?s_ru ?s_en ?sb ?sd ?scomp WHERE { VALUES ?s { ${sOut.map((q) => 'wd:' + q).join(' ')} } ${lab('?s')} OPTIONAL { ?s wdt:P569 ?sb } OPTIONAL { ?s wdt:P570 ?sd } OPTIONAL { ?s wdt:P106 wd:Q36834 . BIND(true AS ?scomp) } }`);
  for (const b of sr) extra.set(id(b.s.value), { qid: id(b.s.value), ...clean(names(b, 's')), born: year(b.sb?.value), died: year(b.sd?.value), offlist: true, composer: !!b.scomp });
}
// Only links to people whose name we have
const linkList = [...links.values()].filter((l) => (people.has(l.t) || extra.has(l.t)) && (people.has(l.s) || extra.has(l.s)));
const usedExtra = new Set(linkList.flatMap((l) => [l.t, l.s]).filter((q) => !people.has(q)));
// An off-list person with no Azerbaijani link at all is kept only when linked to a listed composer (it is by construction)

// Article titles of the off-list people too
const exIds = [...usedExtra];
if (exIds.length) {
  const wr2 = await sparql(`SELECT ?p ?a WHERE { VALUES ?p { ${exIds.map((q) => 'wd:' + q).join(' ')} } ?a schema:about ?p ; schema:isPartOf ?site . FILTER(STRSTARTS(STR(?site), "https://az.wikipedia.org/") || STRSTARTS(STR(?site), "https://ru.wikipedia.org/") || STRSTARTS(STR(?site), "https://en.wikipedia.org/")) }`);
  for (const b of wr2) { const u = new URL(b.a.value), e = extra.get(id(b.p.value)); (e.wiki ??= {})[u.hostname.split('.')[0]] = decodeURIComponent(u.pathname.replace('/wiki/', '')); }
}

// 3. Works
const wr = await sparql(`SELECT DISTINCT ?w ?w_az ?w_ru ?w_en ?c ?cls ?cls_en ?genre ?genre_en ?prem ?pub ?inc ?base ?base_az ?base_ru ?base_en ?baseAuth ?baseAuth_az ?baseAuth_en ?lib ?lib_az ?lib_en ?wiki ?premRef ?compRef WHERE {
  VALUES ?c { ${inList} }
  ?w p:P86 ?cst . ?cst ps:P86 ?c . BIND(EXISTS { ?cst prov:wasDerivedFrom ?cr } AS ?compRef) ?w wdt:P31 ?cls .
  ${lab('?w')}
  OPTIONAL { ?cls rdfs:label ?cls_en FILTER(lang(?cls_en)="en") }
  OPTIONAL { ?w wdt:P136 ?genre . ?genre rdfs:label ?genre_en FILTER(lang(?genre_en)="en") }
  OPTIONAL { ?w p:P1191 ?pst . ?pst ps:P1191 ?prem . BIND(EXISTS { ?pst prov:wasDerivedFrom ?pr } AS ?premRef) } OPTIONAL { ?w wdt:P577 ?pub } OPTIONAL { ?w wdt:P571 ?inc }
  OPTIONAL { ?w wdt:P144 ?base . ${lab('?base')} OPTIONAL { ?base wdt:P50 ?baseAuth . ${lab('?baseAuth')} } }
  OPTIONAL { ?w wdt:P87 ?lib . ${lab('?lib')} }
  OPTIONAL { ?wiki schema:about ?w ; schema:isPartOf <https://en.wikipedia.org/> }
}`);
const works = new Map();
for (const b of wr) {
  const qid = id(b.w.value);
  const w = works.get(qid) ?? { qid, ...clean(names(b, 'w')), composers: [], classes: [], genres: [] };
  const c = id(b.c.value); if (!w.composers.includes(c)) w.composers.push(c);
  const cl = b.cls_en?.value ?? id(b.cls.value); if (!w.classes.includes(cl)) w.classes.push(cl);
  if (b.genre_en && !w.genres.includes(b.genre_en.value)) w.genres.push(b.genre_en.value);
  const d = b.prem?.value ?? b.pub?.value ?? b.inc?.value;
  if (b.prem) w.premiere = year(b.prem.value);
  if (b.prem && b.premRef?.value === 'true') w.premiereRef = true;
  if (b.compRef?.value === 'true') w.composerRef = true;
  if (b.prem) w.premiereDate = b.prem.value.slice(0, 10);
  const y = year(d); if (y && (!w.year || y < w.year)) w.year = y;
  if (b.base) { w.base ??= []; if (!w.base.some((x) => x.qid === id(b.base.value))) w.base.push(clean({ qid: id(b.base.value), ...names(b, 'base'), author: b.baseAuth ? id(b.baseAuth.value) : undefined, authorName: b.baseAuth ? clean(names(b, 'baseAuth')) : undefined })); }
  if (b.lib) { w.librettists ??= []; if (!w.librettists.some((x) => x.qid === id(b.lib.value))) w.librettists.push(clean({ qid: id(b.lib.value), ...names(b, 'lib') })); }
  if (b.wiki) w.wiki = decodeURIComponent(b.wiki.value.split('/wiki/')[1]);
  works.set(qid, w);
}
const built = new Date().toISOString().slice(0, 10);
await writeFile(new URL('../bestekarlar/data/composers.raw.json', import.meta.url), JSON.stringify({ built, people: [...people.values()], extra: [...usedExtra].map((q) => extra.get(q)), links: linkList, works: [...works.values()] }));
console.log(`composers ${people.size}, links ${linkList.length}, off-list people ${usedExtra.size}, works ${works.size}`);
