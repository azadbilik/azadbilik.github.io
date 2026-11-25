// Builds the Soviet raions map's data/raions.geojson: each raion or city council of the Azerbaijan SSR
// at the 1979 and 1989 censuses, drawn as the whole districts of today that cover its land
// (data/raions.json says which; geometry from ../ehali/data/units.geojson, geoBoundaries ADM2), with
// its present population from Demoskop (data/raw/demoscope-1979-1989.json). Two raions merged since
// (Kasum-Ismailov + Shaumyan, Martuni + Hadrut, Mir-Bashir + Mardakert) are one shape. Every census row
// is used once and the units add up to the republic's total, or the build stops.
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const json = async (u) => JSON.parse(await readFile(u, 'utf8'));
const { units, gaps } = await json(here('../data/raions.json'));
const census = await json(here('../data/raw/demoscope-1979-1989.json'));
const today = await json(here('../../ehali/data/units.geojson'));

const AGGREGATES = /^(Азербайджанская ССР|Нахичеванская АССР|Нагорно-Карабахская автономная область|Горпоселения|Районы и города|Города и районы|г\. Баку$)/;
const YEARS = ['1979', '1989'];
const used = Object.fromEntries(YEARS.map((y) => [y, new Map()]));
const row = (y, name) => {
  const r = census.rows[y].find((x) => x.name === name);
  if (!r) throw new Error(`${y}: no census row «${name}»`);
  return r;
};
// a unit's labels: "name" adds the row, "=name" starts from an aggregate, "-name" takes a row off
function count(u, y, track = true) {
  let total = 0, urban = 0;
  for (const label of u[`c${y.slice(2)}`]) {
    const sign = label.startsWith('-') ? -1 : 1, name = label.replace(/^[=-]/, '');
    const r = row(y, name);
    total += sign * r.total; urban += sign * r.urban;
    if (track && !label.startsWith('=') && !label.startsWith('-')) {
      if (used[y].has(name)) throw new Error(`${y}: «${name}» used by ${used[y].get(name)} and ${u.id}`);
      used[y].set(name, u.id);
    }
  }
  return { total, urban };
}

const shapeFeatures = (key) => {
  const fs = today.features.filter((f) => f.properties.country === 'az' && f.properties.key === key);
  if (!fs.length) throw new Error(`no shape «${key}»`);
  return fs;
};
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;

// The edges of a group of shapes, less the seams between them: a segment drawn by two of the shapes is
// inside the group. Coordinates are compared rounded, as the shapes share their vertices.
function outline(parts) {
  const k = ([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`;
  const seen = new Map();
  for (const p of parts) for (const ring of p) for (let i = 0; i < ring.length - 1; i++) {
    const a = k(ring[i]), b = k(ring[i + 1]);
    const id = a < b ? `${a}|${b}` : `${b}|${a}`;
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const lines = [];
  for (const p of parts) for (const ring of p) {
    let cur = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = k(ring[i]), b = k(ring[i + 1]);
      const outer = seen.get(a < b ? `${a}|${b}` : `${b}|${a}`) === 1;
      if (outer) { if (!cur.length) cur.push(ring[i]); cur.push(ring[i + 1]); }
      else if (cur.length) { lines.push(cur); cur = []; }
    }
    if (cur.length) lines.push(cur);
  }
  return lines;
}

const byId = new Map(units.map((u) => [u.id, u]));
const shapesUsed = new Map();
const features = [], edges = [];
for (const u of units) {
  if (!u.shapes.length) continue; // drawn with its partner
  const members = [u, ...(u.with ? [byId.get(u.with)] : [])];
  if (u.with && byId.get(u.with).shapes.length) throw new Error(`${u.id} and ${u.with} both carry shapes`);
  const m = members.map((x) => {
    const c = Object.fromEntries(YEARS.map((y) => [y, count(x, y)]));
    return { id: x.id, az: x.az, ru: x.ru, en: x.en, kind: x.kind, note: x.note ?? null, pop: { 1979: c['1979'].total, 1989: c['1989'].total }, urban: { 1979: c['1979'].urban, 1989: c['1989'].urban } };
  }).sort((a, b) => b.pop['1989'] - a.pop['1989']);
  const shapeFs = u.shapes.flatMap((s) => {
    if (shapesUsed.has(s)) throw new Error(`shape ${s} given to ${shapesUsed.get(s)} and ${u.id}`);
    shapesUsed.set(s, u.id);
    return shapeFeatures(s);
  });
  const parts = shapeFs.flatMap((f) => polys(f.geometry));
  const area = Math.round(new Set(shapeFs).size && [...new Map(shapeFs.map((f) => [f.properties.key, f.properties.area])).values()].reduce((a, b) => a + b, 0));
  const sum = (k, y) => m.reduce((a, x) => a + x[k][y], 0);
  const join = (l) => m.map((x) => x[l]).join(' + ');
  const nameOf = (k) => { const f = shapeFs.find((x) => x.properties.key === k); return { az: f.properties.az, ru: f.properties.ru, en: f.properties.en }; };
  const props = {
    id: m[0].id, kind: u.kind, region: u.region ?? null, fit: members.some((x) => x.fit === 'approx') ? 'approx' : 'same',
    az: join('az'), ru: join('ru'), en: join('en'), members: m,
    pop: { 1979: sum('pop', '1979'), 1989: sum('pop', '1989') }, urban: { 1979: sum('urban', '1979'), 1989: sum('urban', '1989') },
    area, today: u.shapes.map(nameOf),
  };
  features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: parts }, properties: props });
  edges.push({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: outline(parts) }, properties: { id: props.id } });
}

// every census row used once, and the units add up to the republic
for (const y of YEARS) {
  const left = census.rows[y].filter((r) => !AGGREGATES.test(r.name) && !used[y].has(r.name));
  if (left.length) throw new Error(`${y}: rows not used: ${left.map((r) => r.name).join(', ')}`);
  const total = row(y, 'Азербайджанская ССР').total;
  const sum = features.reduce((a, f) => a + (f.properties.pop?.[y] ?? 0), 0);
  if (sum !== total) throw new Error(`${y}: units add up to ${sum}, the republic is ${total}`);
  const urban = features.reduce((a, f) => a + (f.properties.urban?.[y] ?? 0), 0), urbanTotal = row(y, 'Азербайджанская ССР').urban;
  if (urban !== urbanTotal) throw new Error(`${y}: urban people add up to ${urban}, the republic's are ${urbanTotal}`);
}
// today's districts whose land was shared among several Soviet raions in ways not established: grey
for (const g of gaps) {
  if (shapesUsed.has(g.shape)) throw new Error(`gap ${g.shape} is also given to ${shapesUsed.get(g.shape)}`);
  shapesUsed.set(g.shape, 'gap');
  const fs = shapeFeatures(g.shape), p = fs[0].properties;
  const parts = fs.flatMap((f) => polys(f.geometry));
  features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: parts }, properties: { id: `gap-${p.key.toLowerCase().replace(/\W+/g, '-')}`, kind: 'gap', az: p.az, ru: p.ru, en: p.en, note: g.note, area: p.area } });
  edges.push({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: outline(parts) }, properties: { id: features.at(-1).properties.id } });
}
const unusedShapes = [...new Set(today.features.filter((f) => f.properties.country === 'az').map((f) => f.properties.key))].filter((k) => !shapesUsed.has(k));
if (unusedShapes.length) throw new Error(`today's districts not drawn: ${unusedShapes.join(', ')}`);

// The table for azadbilik/data: one row per Soviet unit and census, as counted (merged pairs apart)
const q = (v) => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
const lines = [['soviet_unit', 'name_az', 'name_ru', 'name_en', 'kind', 'region', 'year', 'population', 'urban', 'census_rows', 'today_districts', 'fit', 'drawn_with', 'source_url'].join(',')];
for (const u of units) for (const y of YEARS) {
  const c = count({ ...u, id: `${u.id} (csv)` }, y, false);
  const shapes = u.shapes.length ? u.shapes : byId.get(u.with).shapes;
  lines.push([u.id, u.az, u.ru, u.en, u.kind, u.region ?? '', y, c.total, c.urban, u[`c${y.slice(2)}`].join(';'), shapes.join(';'), u.fit, u.with ?? '', census.source[y]].map(q).join(','));
}
await writeFile(here('../data/raions-1979-1989.csv'), lines.join('\n') + '\n');
await writeFile(here('../data/raions.geojson'), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
await writeFile(here('../data/edges.geojson'), JSON.stringify({ type: 'FeatureCollection', features: edges }) + '\n');
const approx = features.filter((f) => f.properties.fit === 'approx').length;
const drawn = features.filter((f) => f.properties.kind !== 'gap');
console.log(`${drawn.length} shapes for ${units.length} Soviet units (${approx} approximate), ${gaps.length} of today's districts in grey; 1979 ${drawn.reduce((a, f) => a + f.properties.pop['1979'], 0).toLocaleString('en')}, 1989 ${drawn.reduce((a, f) => a + f.properties.pop['1989'], 0).toLocaleString('en')}: both match the republic, urban too`);
