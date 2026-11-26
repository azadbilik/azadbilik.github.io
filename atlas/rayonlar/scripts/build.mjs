// Builds the Soviet raions map's layers: each raion or city council of the Azerbaijan SSR at the 1939
// census (data/raions-1939.json → data/raions-1939.geojson) and at the 1979 and 1989 censuses
// (data/raions.json → data/raions.geojson), drawn as the whole districts of today that cover its land
// (geometry from ../ehali/data/units.geojson, geoBoundaries ADM2), with its present population from
// Demoskop (data/raw/). Raions merged since are drawn together as one shape. For each census every row
// is used once and the units add up to the republic's total, urban people too, or the build stops.
// Also writes data/raions.csv, the table for azadbilik/data.
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const here = (p) => new URL(p, import.meta.url);
const json = async (u) => JSON.parse(await readFile(u, 'utf8'));
const today = await json(here('../../ehali/data/units.geojson'));
const c7989 = await json(here('../data/raw/demoscope-1979-1989.json'));
const c39 = await json(here('../data/raw/demoscope-1939.json'));
const c26 = await json(here('../data/raw/census-1926.json'));
const census = { source: { ...c7989.source, 1939: c39.source, 1926: c26.source }, rows: { ...c7989.rows, 1939: c39.rows, 1926: c26.rows } };
const REPUBLIC = { 1926: 'Азербайджанская ССР', 1939: 'Азербайджанская ССР', 1979: 'Азербайджанская ССР', 1989: 'Азербайджанская ССР' };

const AGGREGATES = /^(Азербайджанская ССР|Нахичеванская АССР|Нагорно-Карабахская (автономная область|авт\.обл)$|Горпоселения|Районы и города|Города и районы|г\. Баку$)/;
const used = Object.fromEntries(['1926', '1939', '1979', '1989'].map((y) => [y, new Map()]));
const row = (y, name) => {
  const r = census.rows[y].find((x) => x.name === name);
  if (!r) throw new Error(`${y}: no census row «${name}»`);
  return r;
};
// a unit's labels: "name" adds the row, "=name" starts from an aggregate, "-name" takes a row off,
// "name*" adds every row that begins so (the 1939 Baku city council's districts)
function count(u, y, track = true) {
  let total = 0, urban = 0;
  for (const label of u[`c${y.slice(2)}`]) {
    const sign = label.startsWith('-') ? -1 : 1, name = label.replace(/^[=-]/, '');
    const rs = name.endsWith('*') ? census.rows[y].filter((x) => x.name.startsWith(name.slice(0, -1))) : [row(y, name)];
    if (!rs.length) throw new Error(`${y}: no census rows «${name}»`);
    for (const r of rs) {
      total += sign * r.total; urban = urban == null || r.urban == null ? null : urban + sign * r.urban; // 1926 has no urban figures
      if (track && !label.startsWith('=') && !label.startsWith('-')) {
        if (used[y].has(r.name)) throw new Error(`${y}: «${r.name}» used by ${used[y].get(r.name)} and ${u.id}`);
        used[y].set(r.name, u.id);
      }
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

async function era(file, YEARS, out) {
  const { units, gaps } = await json(here(`../data/${file}`));
  const byId = new Map(units.map((u) => [u.id, u]));
  const last = YEARS.at(-1);
  const shapesUsed = new Map();
  const features = [], edges = [];
  for (const u of units) {
    if (!u.shapes.length) continue; // drawn with its partner
    const members = [u, ...(u.with ? [byId.get(u.with)] : [])];
    if (u.with && byId.get(u.with).shapes.length) throw new Error(`${u.id} and ${u.with} both carry shapes`);
    const m = members.map((x) => {
      const c = Object.fromEntries(YEARS.map((y) => [y, count(x, y)]));
      return { id: x.id, az: x.az, ru: x.ru, en: x.en, kind: x.kind, note: x.note ?? null, pop: Object.fromEntries(YEARS.map((y) => [y, c[y].total])), urban: Object.fromEntries(YEARS.map((y) => [y, c[y].urban])) };
    }).sort((a, b) => b.pop[last] - a.pop[last]);
    const shapeFs = u.shapes.flatMap((s) => {
      if (shapesUsed.has(s)) throw new Error(`shape ${s} given to ${shapesUsed.get(s)} and ${u.id}`);
      shapesUsed.set(s, u.id);
      return shapeFeatures(s);
    });
    const parts = shapeFs.flatMap((f) => polys(f.geometry));
    const area = Math.round(new Set(shapeFs).size && [...new Map(shapeFs.map((f) => [f.properties.key, f.properties.area])).values()].reduce((a, b) => a + b, 0));
    const sum = (k, y) => m.reduce((a, x) => (a == null || x[k][y] == null ? null : a + x[k][y]), 0);
    const join = (l) => m.map((x) => x[l]).join(' + ');
    const nameOf = (k) => { const f = shapeFs.find((x) => x.properties.key === k); return { az: f.properties.az, ru: f.properties.ru, en: f.properties.en }; };
    const props = {
      id: m[0].id, kind: u.kind, region: u.region ?? null, fit: members.some((x) => x.fit === 'approx') ? 'approx' : 'same',
      az: join('az'), ru: join('ru'), en: join('en'), members: m,
      pop: Object.fromEntries(YEARS.map((y) => [y, sum('pop', y)])), urban: Object.fromEntries(YEARS.map((y) => [y, sum('urban', y)])),
      area, today: u.shapes.map(nameOf),
    };
    features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: parts }, properties: props });
    edges.push({ type: 'Feature', geometry: { type: 'MultiLineString', coordinates: outline(parts) }, properties: { id: props.id } });
  }

  // every census row used once, and the units add up to the republic
  for (const y of YEARS) {
    const left = census.rows[y].filter((r) => !AGGREGATES.test(r.name) && !used[y].has(r.name));
    if (left.length) throw new Error(`${y}: rows not used: ${left.map((r) => r.name).join(', ')}`);
    const total = row(y, REPUBLIC[y]).total;
    const sum = features.reduce((a, f) => a + (f.properties.pop?.[y] ?? 0), 0);
    if (sum !== total) throw new Error(`${y}: units add up to ${sum}, the republic is ${total}`);
    const urban = features.reduce((a, f) => a + (f.properties.urban?.[y] ?? 0), 0), urbanTotal = row(y, REPUBLIC[y]).urban;
    if (urbanTotal != null && urban !== urbanTotal) throw new Error(`${y}: urban people add up to ${urban}, the republic's are ${urbanTotal}`);
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


  await writeFile(here(`../data/${out}.geojson`), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
  await writeFile(here(`../data/${out.replace('raions', 'edges')}.geojson`), JSON.stringify({ type: 'FeatureCollection', features: edges }) + '\n');
  const drawn = features.filter((f) => f.properties.kind !== 'gap');
  console.log(`${YEARS.join(', ')}: ${drawn.length} shapes for ${units.length} Soviet units (${drawn.filter((f) => f.properties.fit === 'approx').length} approximate), ${gaps.length} of today's districts in grey; ${YEARS.map((y) => `${y} ${drawn.reduce((a, f) => a + f.properties.pop[y], 0).toLocaleString('en')}`).join(', ')}: all match the republic, urban too`);
  // one row per Soviet unit and census, as counted (merged pairs apart)
  return units.flatMap((u) => YEARS.map((y) => {
    const c = count({ ...u, id: `${u.id} (csv)` }, y, false);
    const shapes = u.shapes.length ? u.shapes : byId.get(u.with).shapes;
    return [u.id, u.az, u.ru, u.en, u.kind, u.region ?? '', y, c.total, c.urban, u[`c${y.slice(2)}`].join(';'), shapes.join(';'), u.fit, u.with ?? '', census.rows[y].find((r) => r.name === u[`c${y.slice(2)}`][0])?.source ?? census.source[y]];
  }));
}

// The table for azadbilik/data
const q = (v) => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
const rows = [...await era('raions-1926.json', ['1926'], 'raions-1926'), ...await era('raions-1939.json', ['1939'], 'raions-1939'), ...await era('raions.json', ['1979', '1989'], 'raions')];
const header = ['soviet_unit', 'name_az', 'name_ru', 'name_en', 'kind', 'region', 'year', 'population', 'urban', 'census_rows', 'today_districts', 'fit', 'drawn_with', 'source_url'];
await writeFile(here('../data/raions.csv'), [header, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n');
