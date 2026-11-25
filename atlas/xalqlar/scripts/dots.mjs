// Builds the peoples map's dots: one dot for every 200 people of each people in each district at each
// census, placed around the district's settlements (GeoNames, CC BY 4.0: data/settlements-az.csv),
// weighted by their size and spread wider for a city. Peoples who live in a handful of known villages
// (VILLAGES) are put in those villages, not spread over their district. The same input always gives
// the same dots (seeded by district, people and census).
//   node scripts/dots.mjs   → data/dots-<year>.json: { peoples: [...], pts: [lon×1e4, lat×1e4, people index, …] }
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const PER = 200;
const csv = async (p) => {
  const [head, ...rows] = (await readFile(new URL(p, root), 'utf8')).trim().split(/\r?\n/);
  const cols = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((c, i) => [cols[i], c])));
};
const rows = await csv('peoples-az.csv');
const towns = (await csv('settlements-az.csv')).map((s) => ({ ...s, lat: +s.lat, lon: +s.lon, population: +s.population }));
const base = JSON.parse(await readFile(new URL('../../ehali/data/units.geojson', import.meta.url), 'utf8'));
const districts = base.features.filter((f) => f.properties.country === 'az');

// Peoples who live in a few villages (their language is named after one): GeoNames names
const VILLAGES = {
  Khinalug: { 'Quba District': ['Xınalıq'] },
  Budukh: { 'Quba District': ['Buduq'] },
  Kryz: { 'Quba District': ['Qrız', 'Cek', 'Alik', 'Hapıt', 'Yerfi'] },
  Udi: { 'Qabala District': ['Nic'], 'Oghuz District': ['Oğuz'] },
  'Jews (incl. Mountain Jews)': { 'Quba District': ['Qırmızı Qəsəbə'] },
};

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const inside = (x, y, g) => polys(g).some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
const bbox = (g) => { let b = [180, 90, -180, -90]; for (const p of polys(g)) for (const [x, y] of p[0]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; return b; };

// Settlements of each district; a district GeoNames knows no village in gets random points in it
const where = new Map();
for (const f of districts) {
  const b = bbox(f.geometry);
  const list = towns.filter((t) => t.lon >= b[0] && t.lon <= b[2] && t.lat >= b[1] && t.lat <= b[3] && inside(t.lon, t.lat, f.geometry));
  where.set(f.properties.key, { f, b, list, weights: cumulative(list.map(weight)) });
}
// A village counts as ~400 people unless GeoNames says more; cities by their population
function weight(t) { return Math.max(t.population, 400); }
function cumulative(ws) { let s = 0; return ws.map((w) => (s += w)); }

function rng(seed) { let a = 0; for (const c of seed) a = (a * 31 + c.charCodeAt(0)) | 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const KM_LAT = 1 / 111, kmLon = (lat) => 1 / (111 * Math.cos(lat * Math.PI / 180));
// Around a settlement: a village within ~1.2 km, a city over a disc that grows with its size
function around(t, r) {
  const radius = 0.4 + 0.8 * r() + 0.0045 * Math.sqrt(t.population) * Math.sqrt(r());
  const a = r() * 2 * Math.PI;
  return [t.lon + Math.cos(a) * radius * kmLon(t.lat), t.lat + Math.sin(a) * radius * KM_LAT];
}
function pick(d, r) {
  const x = r() * d.weights.at(-1);
  let lo = 0, hi = d.weights.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (d.weights[m] < x) lo = m + 1; else hi = m; }
  return d.list[lo];
}

const years = [...new Set(rows.map((r) => r.year))].sort();
for (const year of years) {
  const counts = rows.filter((r) => r.year === year && Number(r.count) > 0 && r.people !== 'Other');
  // Azerbaijanis first, so the minorities are drawn on top
  const peoples = ['Azerbaijanis', ...[...new Set(counts.map((r) => r.people))].filter((p) => p !== 'Azerbaijanis').sort()];
  const pts = [];
  let missing = 0;
  for (const p of peoples) for (const row of counts.filter((r) => r.people === p)) {
    const d = where.get(row.shapeName);
    if (!d) { missing++; continue; }
    const r = rng(`${year}|${p}|${row.shapeName}`);
    // Rounded at random, so many small groups of 50–150 add up right overall
    const exact = Number(row.count) / PER;
    const n = Math.floor(exact) + (r() < exact % 1 ? 1 : 0);
    const own = (VILLAGES[p]?.[row.shapeName] ?? []).map((name) => d.list.find((t) => t.name === name)).filter(Boolean);
    for (let i = 0; i < n; i++) {
      let pt;
      if (own.length) pt = around(own[Math.floor(r() * own.length)], r);
      else if (d.list.length) pt = around(pick(d, r), r);
      else { for (let k = 0; k < 50 && !pt; k++) { const x = d.b[0] + r() * (d.b[2] - d.b[0]), y = d.b[1] + r() * (d.b[3] - d.b[1]); if (inside(x, y, d.f.geometry)) pt = [x, y]; } }
      if (pt) pts.push(Math.round(pt[0] * 1e4), Math.round(pt[1] * 1e4), peoples.indexOf(p));
    }
  }
  await writeFile(new URL(`dots-${year}.json`, root), JSON.stringify({ per: PER, peoples, pts }) + '\n');
  console.log(`${year}: ${pts.length / 3} dots, ${peoples.length} peoples${missing ? `, ${missing} rows without a district` : ''}`);
}
const empty = [...where.values()].filter((d) => !d.list.length).map((d) => d.f.properties.key);
if (empty.length) console.log('districts without GeoNames settlements:', empty.join(', '));
