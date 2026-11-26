// Builds data/qanunlar.json and data/titles.json from the e-qanun.az register dumps in RAW (default data/raw or $RAW):
//   acts.ndjson  one act per line {id, citation, title, typeName, statusName, acceptDate "dd.mm.yyyy", ...}
//   rel.ndjson   one line per crawled act {id, rel: [[otherId, label], ...]}  (the site's "Əlaqəli sənədlər")
// Re-runnable: `node scripts/build.mjs` from this folder. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = process.env.RAW || path.join(HERE, '..', 'data', 'raw');
const OUT = path.join(HERE, '..', 'data');
const lines = (f) => fs.readFileSync(path.join(RAW, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---- acts (deduplicated by id)
const acts = new Map();
for (const a of lines('acts.ndjson')) acts.set(a.id, a);

// ---- categories by the register's type name
const CATS = ['const', 'code', 'law', 'decree', 'order', 'cabinet', 'court', 'agency'];
const catOf = (tn) => {
  const t = tn.toLocaleLowerCase('az');
  if (t === 'konstitusiya') return 'const';
  if (t === 'məcəllələr') return 'code';
  if (t === 'qanunlar' || t.includes('konstitusiya qanun')) return 'law';
  if (t.includes('prezidentinin fərmanları')) return 'decree';
  if (t.includes('sərəncamları')) return 'order';
  if (t.includes('nazirlər kabinetinin qərarları')) return 'cabinet';
  if (t.includes('milli məclisin qərar') || t.includes('konstitusiya məhkəməsi') || t.includes('ali məhkəm') || t.includes('məhkəmə-hüquq')) return 'court';
  return 'agency';
};

// ---- relation labels: direction = who acts. "-ir" labels read "this act <verb> the other"; "-ib" the reverse.
// kinds: 0 amends, 1 implements, 2 puts into effect / approves, 3 repeals
const LABELS = {
  'Dəyişdirir': [0, 1], 'Dəyişdirilib': [0, -1],
  'İcra edir': [1, 1], 'İcra edilib': [1, -1],
  'Tətbiq edir': [2, 1], 'Tətbiq edilib': [2, -1], 'Təsdiq edir': [2, 1], 'Təsdiq edilib': [2, -1],
  'Ləğv edir': [3, 1], 'Ləğv edilib': [3, -1],
};
const rels = new Map();
for (const r of lines('rel.ndjson')) rels.set(r.id, r);
const edgeSet = new Map(); const labelCount = {}; let dropped = 0;
for (const r of rels.values()) for (const [o, lab] of r.rel) {
  labelCount[lab] = (labelCount[lab] || 0) + 1;
  const m = LABELS[lab]; if (!m || !acts.has(o) || !acts.has(r.id)) { dropped++; continue; }
  const [src, dst] = m[1] > 0 ? [r.id, o] : [o, r.id];
  if (src === dst) continue;
  edgeSet.set(`${src}>${dst}>${m[0]}`, [src, dst, m[0]]);
}
const edges = [...edgeSet.values()];

// ---- nodes: acts that appear on either side of a known relation
const used = new Set(); for (const [s, d] of edges) { used.add(s); used.add(d); }
const ids = [...used].sort((a, b) => a - b); const ix = new Map(ids.map((id, i) => [id, i]));
const tnames = [...new Set(ids.map((id) => acts.get(id).typeName))].sort(); const tix = new Map(tnames.map((t, i) => [t, i]));
const year = (a) => +a.acceptDate.slice(6);
const ymd = (a) => +(a.acceptDate.slice(6) + a.acceptDate.slice(3, 5) + a.acceptDate.slice(0, 2));
const inForce = (a) => (a.statusName.startsWith('Ləğv') ? 0 : 1);
const nodes = {
  id: ids, tn: ids.map((id) => tix.get(acts.get(id).typeName)), date: ids.map((id) => ymd(acts.get(id))), st: ids.map((id) => inForce(acts.get(id))),
};
const E = edges.map(([s, d, k]) => [ix.get(s), ix.get(d), k]);

// ---- aggregates
const N = ids.length, cat = (i) => catOf(tnames[nodes.tn[i]]), yr = (i) => Math.floor(nodes.date[i] / 10000);
const amenders = Array.from({ length: N }, () => new Set()), implementers = Array.from({ length: N }, () => new Set());
const perYear = Array.from({ length: N }, () => ({}));
for (const [s, d, k] of E) {
  if (k === 0) { amenders[d].add(s); perYear[d][yr(s)] = (perYear[d][yr(s)] || 0) + 1; }
  if (k === 1) implementers[d].add(s);
}
const top = (score, n, filt = () => true) => [...Array(N).keys()].filter((i) => score(i) > 0 && filt(i)).sort((a, b) => score(b) - score(a) || nodes.date[b] - nodes.date[a]).slice(0, n);
const mostAmended = top((i) => amenders[i].size, 40).map((i) => [i, amenders[i].size]);
const bestYear = (i) => Object.entries(perYear[i]).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0] || [0, 0];
const inOneYear = top((i) => bestYear(i)[1], 25).map((i) => [i, bestYear(i)[1], +bestYear(i)[0]]);
const mostImplemented = top((i) => implementers[i].size, 30, (i) => ['const', 'code', 'law'].includes(cat(i))).map((i) => [i, implementers[i].size]);

// yearly series over the whole register (not only acts with relations): new acts by category; amendments by category of the amended act
const Y0 = 1990, Y1 = +[...acts.values()].reduce((m, a) => (year(a) > m ? year(a) : m), 0);
const newByYear = {}, amendByYear = {};
for (const c of CATS) { newByYear[c] = {}; amendByYear[c] = {}; }
for (const a of acts.values()) { const y = year(a); if (y < Y0) continue; const c = catOf(a.typeName); newByYear[c][y] = (newByYear[c][y] || 0) + 1; }
for (const [s, d, k] of E) if (k === 0) { const y = yr(s); if (y < Y0) continue; const c = cat(d); amendByYear[c][y] = (amendByYear[c][y] || 0) + 1; }
const series = (o) => CATS.map((c) => { const r = []; for (let y = Y0; y <= Y1; y++) r.push(o[c][y] || 0); return r; });

const byKind = [0, 1, 2, 3].map((k) => E.filter((e) => e[2] === k).length);
const stats = {
  actsInRegister: acts.size, relCrawled: rels.size, relCrawledWithLinks: [...rels.values()].filter((r) => r.rel.length).length,
  nodes: N, edges: E.length, byKind, labelCount, droppedLabels: dropped,
  inForceAll: [...acts.values()].filter((a) => inForce(a)).length,
};
const out = {
  built: new Date().toISOString().slice(0, 10), fetched: '2026-11-26', stats, cats: CATS,
  types: tnames.map((t) => [t, CATS.indexOf(catOf(t))]), nodes, edges: E.flat(), y0: Y0, y1: Y1,
  newByYear: series(newByYear), amendByYear: series(amendByYear),
  rank: { mostAmended, inOneYear, mostImplemented },
  // titles of the ranked acts travel with the main file so the lists render before titles.json arrives
  rankTitles: Object.fromEntries([...new Set([...mostAmended, ...inOneYear, ...mostImplemented].map((r) => r[0]))].map((i) => [i, [acts.get(ids[i]).citation, acts.get(ids[i]).title]])),
};
fs.writeFileSync(path.join(OUT, 'qanunlar.json'), JSON.stringify(out));
fs.writeFileSync(path.join(OUT, 'titles.json'), JSON.stringify({ cit: ids.map((id) => acts.get(id).citation), title: ids.map((id) => acts.get(id).title) }));
console.log(JSON.stringify(stats, null, 1));
console.log('nodes by category', Object.fromEntries(CATS.map((c) => [c, [...Array(N).keys()].filter((i) => cat(i) === c).length])));
console.log('most amended', mostAmended.slice(0, 5).map(([i, n]) => n + ' ' + acts.get(ids[i]).title.slice(0, 80)));
console.log('single year', inOneYear.slice(0, 5).map(([i, n, y]) => n + ' ' + y + ' ' + acts.get(ids[i]).title.slice(0, 80)));
console.log('implemented', mostImplemented.slice(0, 5).map(([i, n]) => n + ' ' + acts.get(ids[i]).title.slice(0, 80)));

// the networks' positions (ForceAtlas2 at build time, see layout.mjs)
await import('./layout.mjs');
