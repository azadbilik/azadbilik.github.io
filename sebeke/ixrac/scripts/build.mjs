// Builds data/ixrac.json from the Growth Lab's open data (CC0), downloaded into RAW (default /tmp/ixr or $RAW).
// See README.md for the download commands.
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = process.env.RAW || '/tmp/ixr';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'ixrac.json');
const COUNTRIES = [['AZE', 31], ['GEO', 268], ['KAZ', 398], ['UZB', 860], ['TUR', 792]];
const ids = new Map(COUNTRIES.map(([c, id]) => [String(id), c]));
const OIL = ['2709', '2710', '2711'];

const csv = (f) => {
  const [h, ...rows] = fs.readFileSync(path.join(RAW, f), 'utf8').trim().split(/\r?\n/);
  const cols = parseLine(h);
  return rows.map((l) => Object.fromEntries(parseLine(l).map((v, i) => [cols[i], v])));
};
function parseLine(l) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}

// Products: the Atlas's own Product Space layout (865 HS92 4-digit products) and its classification
const layout = csv('layout.csv');
const cls = csv('product_hs92.csv');
const byId = new Map(cls.map((p) => [p.product_id, p]));
const sections = Object.fromEntries(cls.filter((p) => p.product_level === '1').map((p) => [p.product_id, p.product_name_short]));
const l4 = new Map(cls.filter((p) => p.product_level === '4').map((p) => [p.product_hs92_code, p]));
const clusters = [...new Set(layout.map((r) => r.product_space_cluster_name))].sort();
const sectionKeys = Object.keys(sections);
const products = layout.map((r) => {
  const code = r.product_hs92_code.padStart(4, '0'), p = l4.get(code);
  if (!p) throw new Error('no classification for ' + code);
  return { code, name: p.product_name_short, full: p.product_name.replace(/:$/, ''), x: +(+r.product_space_x).toFixed(3), y: +(+r.product_space_y).toFixed(3),
    cl: clusters.indexOf(r.product_space_cluster_name), sec: sectionKeys.indexOf(p.product_id_hierarchy.split('.')[0]), nat: p.natural_resource === 'True' ? 1 : 0 };
});
const idx = new Map(products.map((p, i) => [p.code, i]));
const N = products.length;
const edgeSet = new Set();
for (const r of csv('edges.csv')) {
  const a = idx.get(r.product_hs92_code_source.padStart(4, '0')), b = idx.get(r.product_hs92_code_target.padStart(4, '0'));
  if (a == null || b == null || a === b) continue;
  edgeSet.add(a < b ? `${a},${b}` : `${b},${a}`);
}
const edges = [...edgeSet].map((s) => s.split(',').map(Number));

// World trade and PCI per product and year (product_year_4)
const years = []; const pci = {}, world = {};
for (const r of csv('py4.csv')) {
  const i = idx.get(r.product_hs92_code.padStart(4, '0')); if (i == null) continue;
  const y = +r.year; if (!years.includes(y)) years.push(y);
  (pci[y] ??= new Array(N).fill(null))[i] = r.pci === '' ? null : Math.round(+r.pci * 1000);
  (world[y] ??= new Array(N).fill(0))[i] = Math.round(+r.export_value / 1e6);
}
years.sort((a, b) => a - b);

// Countries: ECI and totals
const totals = {}, eci = {};
for (const r of csv('cy.csv')) {
  const c = ids.get(r.country_id); if (!c) continue;
  (totals[c] ??= {})[r.year] = +r.export_value;
  (eci[c] ??= {})[r.year] = r.eci === '' ? null : +r.eci;
}

// Country-product-year: stream the 450 MB file, keep the five countries
const data = Object.fromEntries(COUNTRIES.map(([c]) => [c, { rca: {}, exp: {}, dist: {}, cog: {}, oil: {} }]));
const rl = readline.createInterface({ input: fs.createReadStream(path.join(RAW, 'cpy4.csv')) });
let first = true;
for await (const line of rl) {
  if (first) { first = false; continue; }
  const c = ids.get(line.slice(0, line.indexOf(',')));
  if (!c) continue;
  const f = line.split(','); // country_id,iso3,product_id,code,year,export,import,share,rca,distance,cog,pci
  const code = f[3], y = f[4], d = data[c];
  if (OIL.includes(code)) d.oil[y] = (d.oil[y] ?? 0) + +f[5];
  const i = idx.get(code); if (i == null) continue;
  (d.rca[y] ??= new Array(N).fill(0))[i] = Math.round(+f[8] * 100);
  (d.exp[y] ??= new Array(N).fill(0))[i] = Math.round(+f[5] / 1e5) / 10;      // US$ million, 0.1 precision
  (d.dist[y] ??= new Array(N).fill(null))[i] = f[9] === '' ? null : Math.round(+f[9] * 1000);
  (d.cog[y] ??= new Array(N).fill(null))[i] = f[10] === '' ? null : Math.round(+f[10] * 1000);
}
const out = { source: 'Harvard Growth Lab, Atlas of Economic Complexity, HS92 4-digit; CC0 1.0', years, sections: Object.values(sections), clusters, products, edges, pci, world, countries: {} };
for (const [c] of COUNTRIES) {
  const d = data[c];
  out.countries[c] = { rca: d.rca, exp: d.exp, dist: d.dist, cog: d.cog,
    oil: Object.fromEntries(years.filter((y) => totals[c][y]).map((y) => [y, +(((d.oil[y] ?? 0) / totals[c][y]) * 100).toFixed(1)])),
    total: Object.fromEntries(years.map((y) => [y, Math.round(totals[c][y] / 1e6)])),
    eci: eci[c] };
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`${N} products, ${edges.length} edges, years ${years[0]}–${years.at(-1)}, ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`);
