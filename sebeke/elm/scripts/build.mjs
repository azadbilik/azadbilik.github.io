// Builds data/elm.json, data/authors.json + data/authors-*.bin and data/institution-years.csv
// from the raw OpenAlex pages in data/raw/ (run scripts/fetch.mjs first). Pass --stats to print findings only.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = join(root, 'data', 'raw'), out = join(root, 'data');
const Y0 = 1970, Y1 = 2026, NY = Y1 - Y0 + 1;
const BIG = 100;   // OpenAlex lists at most 100 authorships per work: a work with 100 listed has 100 or more authors ("large collaboration", CERN-type)
const SMALL = 20;  // the "small teams" variant: at most this many authorships
const AUTHOR_CAP = 25; // co-authorship links are drawn only from works with at most this many authorships
const ymap = y => (y < Y0 ? -1 : Math.min(y, Y1) - Y0);

// ---- load, dedupe
const works = new Map();
for (const f of readdirSync(raw).filter(f => f.endsWith('.json.gz')).sort())
  for (const w of JSON.parse(gunzipSync(readFileSync(join(raw, f))))) works.set(w.id, w);
// Editorial merge: OpenAlex holds the Institute of Physics twice; both ids are kept in the data (`ids`).
const MERGE = { 'https://openalex.org/I4405283603': 'https://openalex.org/I4210100222' };
const MERGED_NAME = 'Institute of Physics';
const mergedIds = new Set();
for (const w of works.values()) for (const a of w.authorships ?? []) for (const i of a.institutions ?? []) if (MERGE[i.id]) { mergedIds.add(i.id); i.id = MERGE[i.id]; i.display_name = MERGED_NAME; }
console.log('works', works.size, 'merged ids', [...mergedIds]);

const fieldIdx = new Map(), fields = []; // {name, domain}
const domains = ['Physical Sciences', 'Life Sciences', 'Social Sciences', 'Health Sciences'];
const countries = new Map(); // code -> {all:[], small:[]}
const arr = () => new Uint32Array(NY);
const tot = { all: arr(), intl: arr(), big: arr(), small: arr(), smallIntl: arr(), single: arr() };
let before1970 = 0, pre1991 = 0; const pre91Countries = new Map(); const pre91Inst = new Map();
const inst = new Map(); // id -> {name,type,country,works:arr,foreignWorks:arr, fields:Map, ...}
const getInst = i => { let r = inst.get(i.id); if (!r) inst.set(i.id, r = { id: i.id.slice(21), name: i.display_name, type: i.type, cc: i.country_code, ror: i.ror, w: arr(), fw: arr(), f: new Map() }); return r; };
const edges = new Map(); // "a|b" -> Uint16Array(NY)
const fieldStat = new Map(); // field -> {w, intl, az-only, partners Map, byYear...}
const src = new Map(); // source id -> {name, n, core, doaj, listed, perYear}
const srcYear = { core: arr(), doaj: arr(), listed: arr(), none: arr(), nosource: arr(), journal: arr() };
const authors = new Map(); // id -> {name, w, first, last, inst:Map, field:Map, links}
const alinks = new Map();
let noField = 0, outside = 0;

for (const w of works.values()) {
  const yi = ymap(w.publication_year), au = w.authorships ?? [], n = au.length;
  if (w.publication_year < Y0) { before1970++; }
  if (w.publication_year < 1991) {
    pre1991++;
    const seen = new Set();
    for (const a of au) for (const i of a.institutions ?? []) { if (i.country_code && i.country_code !== 'AZ') seen.add(i.country_code); if (i.country_code === 'AZ') pre91Inst.set(i.display_name, (pre91Inst.get(i.display_name) ?? 0) + 1); }
    for (const c of seen) pre91Countries.set(c, (pre91Countries.get(c) ?? 0) + 1);
  }
  if (yi < 0) continue;
  const azInst = new Map(), foreign = new Map(), cset = new Set();
  const azAuthors = [];
  for (const a of au) {
    let isAz = false;
    for (const i of a.institutions ?? []) {
      if (!i.id || !i.country_code) continue;
      cset.add(i.country_code);
      if (i.country_code === 'AZ') { azInst.set(i.id, i); isAz = true; } else foreign.set(i.id, i);
    }
    if (isAz) azAuthors.push(a);
  }
  // azInst can be empty: OpenAlex lists only the first 100 authors, and the Azerbaijani one can come after them. Such works still count.
  if (!azInst.size) outside++;
  const fc = [...cset].filter(c => c !== 'AZ');
  const intl = fc.length > 0, big = n >= BIG, small = n <= SMALL;
  tot.all[yi]++; if (intl) tot.intl[yi]++; if (big) tot.big[yi]++; if (small) { tot.small[yi]++; if (intl) tot.smallIntl[yi]++; }
  if (n <= 1) tot.single[yi]++;
  for (const c of fc) { let r = countries.get(c); if (!r) countries.set(c, r = { all: arr(), small: arr() }); r.all[yi]++; if (small) r.small[yi]++; }
  // field
  const pt = w.primary_topic, fname = pt?.field?.display_name;
  let fi = -1;
  if (fname) { fi = fieldIdx.get(fname); if (fi === undefined) { fi = fields.length; fieldIdx.set(fname, fi); fields.push({ name: fname, domain: pt.domain.display_name, w: arr(), intl: arr(), sm: arr(), smIntl: arr(), partners: new Map(), sub: new Map() }); }
    const f = fields[fi]; f.w[yi]++; if (intl) f.intl[yi]++; if (small) { f.sm[yi]++; if (intl) f.smIntl[yi]++; }
    for (const c of fc) f.partners.set(c, (f.partners.get(c) ?? 0) + 1);
    const sf = pt.subfield?.display_name; if (sf) f.sub.set(sf, (f.sub.get(sf) ?? 0) + 1);
  } else noField++;
  // institutions
  for (const i of azInst.values()) { const r = getInst(i); r.w[yi]++; if (intl) r.fw[yi]++; if (fi >= 0) r.f.set(fi, (r.f.get(fi) ?? 0) + 1); }
  if (n < BIG && azInst.size) {
    const az = [...azInst.keys()], fo = [...foreign.keys()];
    for (const i of foreign.values()) getInst(i);
    for (const a of az) {
      for (const b of fo) { const k = a + '|' + b; let e = edges.get(k); if (!e) edges.set(k, e = new Uint16Array(NY)); e[yi]++; }
      for (const b of az) if (a < b) { const k = a + '|' + b; let e = edges.get(k); if (!e) edges.set(k, e = new Uint16Array(NY)); e[yi]++; }
    }
  }
  // venues
  const s = w.primary_location?.source;
  if (!s) srcYear.nosource[yi]++;
  else {
    let r = src.get(s.id); if (!r) src.set(s.id, r = { name: s.display_name, type: s.type, host: s.host_organization_name, n: 0, core: !!s.is_core, doaj: !!s.is_in_doaj, listed: (s.listed_in ?? []).length, y: arr() });
    r.n++; r.y[yi]++;
    if (s.type === 'journal') srcYear.journal[yi]++;
    if (s.is_core) srcYear.core[yi]++; if (s.is_in_doaj) srcYear.doaj[yi]++; if ((s.listed_in ?? []).length) srcYear.listed[yi]++;
    if (!s.is_core && !s.is_in_doaj && !(s.listed_in ?? []).length) srcYear.none[yi]++;
  }
  // authors
  if (n <= AUTHOR_CAP) {
    const ids = [];
    for (const a of azAuthors) {
      const id = a.author?.id; if (!id) continue;
      let r = authors.get(id); if (!r) authors.set(id, r = { name: a.author.display_name, w: 0, first: 9999, last: 0, inst: new Map(), field: new Map(), orcid: a.author.orcid ? 1 : 0 });
      r.w++; r.first = Math.min(r.first, w.publication_year); r.last = Math.max(r.last, w.publication_year);
      for (const i of a.institutions ?? []) if (i.country_code === 'AZ') r.inst.set(i.id, (r.inst.get(i.id) ?? 0) + 1);
      if (fi >= 0) r.field.set(fi, (r.field.get(fi) ?? 0) + 1);
      ids.push(id);
    }
    const u = [...new Set(ids)];
    for (let x = 0; x < u.length; x++) for (let y = x + 1; y < u.length; y++) {
      const k = u[x] < u[y] ? u[x] + '|' + u[y] : u[y] + '|' + u[x];
      let e = alinks.get(k); if (!e) alinks.set(k, e = [0, 9999]); e[0]++; e[1] = Math.min(e[1], w.publication_year);
    }
  }
}
const sum = a => a.reduce((x, y) => x + y, 0);
console.log('before1970', before1970, 'pre1991', pre1991, 'noField', noField, 'inst', inst.size, 'edges', edges.size, 'authors', authors.size, 'alinks', alinks.size);

// ---- countries
const allC = [...countries.entries()].map(([c, r]) => [c, sum(r.all)]).sort((a, b) => b[1] - a[1]);
const topC = allC.slice(0, 45).map(x => x[0]);
const region = new Intl.DisplayNames(['en'], { type: 'region' }), regionAz = new Intl.DisplayNames(['az'], { type: 'region' }), regionRu = new Intl.DisplayNames(['ru'], { type: 'region' });
const nm = c => { try { return { en: region.of(c), az: regionAz.of(c), ru: regionRu.of(c) }; } catch { return { en: c, az: c, ru: c }; } };
const countryOut = topC.map(c => ({ code: c, name: nm(c), all: [...countries.get(c).all], small: [...countries.get(c).small] }));

// ---- institutions
const azInsts = [...inst.values()].filter(r => r.cc === 'AZ').map(r => ({ r, t: sum(r.w) })).sort((a, b) => b.t - a.t);
const MIN_AZ = 25;
const azKeep = azInsts.filter(x => x.t >= MIN_AZ).map(x => x.r);
const keepIds = new Set(azKeep.map(r => 'https://openalex.org/' + r.id));
// foreign nodes: those with most co-works with kept AZ institutions
const fw = new Map();
for (const [k, e] of edges) { const [a, b] = k.split('|'); const ia = inst.get(a), ib = inst.get(b); if (!ia || !ib) continue; if (ia.cc === 'AZ' && ib.cc !== 'AZ' && keepIds.has(a)) fw.set(b, (fw.get(b) ?? 0) + sum(e)); }
const foreignKeep = [...fw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 160).map(x => x[0]);
for (const f of foreignKeep) keepIds.add(f);
const nodeList = [...keepIds].map(id => inst.get(id)).filter(Boolean);
nodeList.sort((a, b) => (a.cc === 'AZ' ? 0 : 1) - (b.cc === 'AZ' ? 0 : 1) || sum(b.w) - sum(a.w));
const nodeIdx = new Map(nodeList.map((r, i) => ['https://openalex.org/' + r.id, i]));
const instOut = nodeList.map(r => {
  const top = [...r.f.entries()].sort((a, b) => b[1] - a[1]);
  return { id: r.id, ids: r.id === 'I4210100222' ? ['I4210100222', 'I4405283603'] : undefined, name: r.name, type: r.type, cc: r.cc, w: [...r.w], fw: [...r.fw], f: top.slice(0, 3).map(([i, n]) => [i, n]) };
});
// edges among kept nodes, weight >= 2, top 3500
let edgeList = [];
for (const [k, e] of edges) { const [a, b] = k.split('|'); if (!nodeIdx.has(a) || !nodeIdx.has(b)) continue; const t = sum(e); if (t < 2) continue; edgeList.push([nodeIdx.get(a), nodeIdx.get(b), t, e]); }
edgeList.sort((a, b) => b[2] - a[2]); edgeList = edgeList.slice(0, 4000);
const edgeOut = edgeList.map(([a, b, t, e]) => [a, b, [...e]]);

// ---- fields
const fieldOut = fields.map(f => ({ name: f.name, domain: domains.indexOf(f.domain), w: [...f.w], intl: [...f.intl], sm: [...f.sm], smIntl: [...f.smIntl],
  partners: [...f.partners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), sub: [...f.sub.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) }));
const fieldsSorted = fieldOut.map((f, i) => [i, sum(f.w)]).sort((a, b) => b[1] - a[1]);

// ---- venues
const topSrc = [...src.values()].sort((a, b) => b.n - a.n);
const lastYears = (a) => sum(a.slice(NY - 3));
const recentTop = [...src.values()].sort((a, b) => lastYears(b.y) - lastYears(a.y)).slice(0, 15).map(s => ({ name: s.name, host: s.host, n: lastYears(s.y), core: s.core, doaj: s.doaj, listed: s.listed }));
const rtTotal = lastYears(tot.all); const topShare = recentTop.reduce((a, s) => a + s.n, 0) / rtTotal;
const venues = { topShare, recentTotal: rtTotal, core: [...srcYear.core], doaj: [...srcYear.doaj], listed: [...srcYear.listed], none: [...srcYear.none], nosource: [...srcYear.nosource], journal: [...srcYear.journal], recentTop };

// ---- authors binary
const MINW = 2;
// authors with at least MINW works AND at least one link to another such author (isolated ones add nothing to a network)
const cand = new Set([...authors.entries()].filter(([, r]) => r.w >= MINW).map(([id]) => id)), linked = new Set();
for (const k of alinks.keys()) { const [a, b] = k.split('|'); if (cand.has(a) && cand.has(b)) { linked.add(a); linked.add(b); } }
const aList = [...authors.entries()].filter(([id]) => linked.has(id)).sort((a, b) => b[1].w - a[1].w);
const aIdx = new Map(aList.map(([id], i) => [id, i]));
const instIndexOf = new Map(nodeList.filter(r => r.cc === 'AZ').map((r, i) => ['https://openalex.org/' + r.id, i]));
const N = aList.length;
const aInst = new Uint16Array(N), aField = new Uint8Array(N), aW = new Uint16Array(N), aFirst = new Uint8Array(N), aLast = new Uint8Array(N);
aList.forEach(([, r], i) => {
  const bi = [...r.inst.entries()].sort((a, b) => b[1] - a[1])[0]; aInst[i] = bi ? (instIndexOf.get(bi[0]) ?? 65535) : 65535;
  const bf = [...r.field.entries()].sort((a, b) => b[1] - a[1])[0]; aField[i] = bf ? bf[0] : 255;
  aW[i] = Math.min(r.w, 65535); aFirst[i] = Math.max(0, r.first - 1950); aLast[i] = Math.max(0, r.last - 1950);
});
const L = [], LW = [], LY = [];
for (const [k, [n, y]] of alinks) { const [a, b] = k.split('|'); const i = aIdx.get(a), j = aIdx.get(b); if (i === undefined || j === undefined) continue; L.push(i, j); LW.push(Math.min(n, 255)); LY.push(Math.max(0, y - 1950)); }
console.log('author nodes', N, 'links', L.length / 2);
writeFileSync(join(out, 'authors-links.bin'), Buffer.from(new Uint32Array(L).buffer));
writeFileSync(join(out, 'authors-linkmeta.bin'), Buffer.from(Uint8Array.from(LW.flatMap((w, i) => [w, LY[i]]))));
const nodeBuf = Buffer.concat([aW, aInst, aFirst, aLast, aField].map(a => Buffer.from(a.buffer, a.byteOffset, a.byteLength)));
writeFileSync(join(out, 'authors-nodes.bin'), nodeBuf);
writeFileSync(join(out, 'authors.json'), JSON.stringify({ n: N, links: L.length / 2, minWorks: MINW, cap: AUTHOR_CAP, yearBase: 1950, names: aList.map(([, r]) => r.name), orcid: aList.map(([, r]) => r.orcid).join('') }));

// ---- elm.json
const gen = new Date().toISOString().slice(0, 10);
const json = {
  generated: gen, years: [Y0, Y1], big: BIG, small: SMALL, works: works.size, outside, before1970, pre1991,
  pre1991Partners: [...pre91Countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), pre1991Inst: [...pre91Inst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  domains, totals: { all: [...tot.all], intl: [...tot.intl], big: [...tot.big], small: [...tot.small], smallIntl: [...tot.smallIntl], single: [...tot.single] },
  countries: countryOut, countriesRest: allC.slice(45).length,
  institutions: instOut, edges: edgeOut, azCount: nodeList.filter(r => r.cc === 'AZ').length,
  fields: fieldOut, venues, authorsMeta: { n: N, links: L.length / 2 },
};
writeFileSync(join(out, 'elm.json'), JSON.stringify(json));
// CSV
const rows = ['institution_id,institution,type,year,works,works_with_foreign_coauthor'];
for (const r of azInsts) for (let y = 0; y < NY; y++) if (r.r.w[y]) rows.push([r.r.id, JSON.stringify(r.r.name), r.r.type, Y0 + y, r.r.w[y], r.r.fw[y]].join(','));
writeFileSync(join(out, 'institution-years.csv'), rows.join('\n') + '\n');
console.log('wrote', (JSON.stringify(json).length / 1e6).toFixed(2), 'MB elm.json; AZ institutions kept', json.azCount, 'of', azInsts.length);

// ---- stats
const yrs = (a, y0, y1) => sum(a.slice(y0 - Y0, y1 - Y0 + 1));
console.log('top AZ institutions', azInsts.slice(0, 20).map(x => x.r.name + ' ' + x.t).join(' | '));
for (const [a, b] of [[1990, 1999], [2000, 2009], [2010, 2019], [2020, 2026]]) {
  const t = yrs(tot.all, a, b);
  console.log(a, b, 'works', t, 'intl%', (100 * yrs(tot.intl, a, b) / t).toFixed(1), 'big%', (100 * yrs(tot.big, a, b) / t).toFixed(1), 'top partners', countryOut.map(c => [c.code, yrs(c.all, a, b)]).sort((x, y) => y[1] - x[1]).slice(0, 8).map(x => x.join(':')).join(' '));
}
console.log('per-year totals', [...tot.all].map((v, i) => (Y0 + i) + ':' + v).slice(20).join(' '));
console.log('fields', fieldsSorted.slice(0, 26).map(([i, n]) => { const f = fieldOut[i]; return f.name + ' ' + n + ' intl ' + (100 * sum(f.intl) / n).toFixed(0) + '%'; }).join('\n'));
console.log('venues', JSON.stringify(venues.recentTop.slice(0, 15)));
for (const y of [2000, 2010, 2020, 2023, 2024, 2025, 2026]) console.log(y, 'none-listed%', (100 * venues.none[y - Y0] / tot.all[y - Y0]).toFixed(1), 'core%', (100 * venues.core[y - Y0] / tot.all[y - Y0]).toFixed(1));

// the networks' positions (ForceAtlas2 at build time, see layout.mjs)
await import('./layout.mjs');
