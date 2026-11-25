// Builds data/units.geojson for the population map: the Republic of Azerbaijan's districts and
// cities (geoBoundaries AZE ADM2, CC BY-SA 3.0) and the counties of Iran's four Azerbaijani
// provinces (geoBoundaries IRN ADM2, ODbL), each with its names, area and census populations
// (data/aze-census.csv, data/irn-census.csv: one row per unit and census, with its source).
//
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const csv = async (p) => {
  const text = await readFile(new URL(p, root), 'utf8').catch(() => '');
  const [head, ...rows] = text.trim().split('\n').filter(Boolean);
  if (!head) return [];
  const cols = head.split(',');
  // Quoted fields (a source URL with a comma) are kept whole
  return rows.map((r) => {
    const cells = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    return Object.fromEntries(cols.map((c, i) => [c.trim(), cells[i]?.trim()]));
  });
};

const names = await json('names.json');
const aze = await json('raw/aze-adm2.geojson');
const irn = await json('raw/irn-adm2.geojson');
const irnProvinceOf = Object.fromEntries(Object.entries(await json('raw/irn-az-counties.json')).flatMap(([p, cs]) => cs.map((c) => [c, p])));
const azeRows = await csv('aze-census.csv');
const totalRows = await csv('totals.csv');
const irnRows = await csv('irn-census.csv');

// Area on the sphere (km²), for density
const R = 6371.0088;
const rad = (d) => d * Math.PI / 180;
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)));
  }
  return Math.abs(a * R * R / 2);
};
const area = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
  .reduce((s, p) => s + ringArea(p[0]) - p.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
// Six decimals is ~10 cm: plenty for a district map, a third off the file
const trim = (g) => JSON.parse(JSON.stringify(g, (_, v) => typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v));

const series = (rows, name) => {
  const pop = {}, src = {};
  for (const r of rows.filter((r) => r.shapeName === name && r.population)) {
    pop[r.year] = Number(r.population.replace(/[^\d]/g, ''));
    if (r.source_url) src[r.year] = r.source_url;
  }
  return { pop, src };
};

// Towns whose district's figure already includes them (azstat's definition): shown on the map,
// left out of the totals so they are not counted twice
const IN_DISTRICT = new Set(['Shaki City', 'Yevlakh City', 'Lankaran City', 'Shusha City']);
const features = [];
const sources = {};
// A district drawn as several shapes (Lankaran: the district and its coastal strip) is one unit
const merged = new Map();
for (const f of aze.features) {
  const n = f.properties.shapeName;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  if (merged.has(n)) merged.get(n).geometry.coordinates.push(...polys);
  else merged.set(n, { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } });
}
for (const f of merged.values()) {
  const n = f.properties.shapeName;
  const { pop, src } = series(azeRows, n);
  const id = f.properties.shapeID;
  sources[id] = src;
  features.push({ type: 'Feature', geometry: trim(f.geometry), properties: {
    id, country: 'az', key: n, az: names[n]?.[0] ?? n, ru: names[n]?.[1] ?? n, en: n.replace(/ (District|City)$/, (m) => m === ' City' ? ' (city)' : ''),
    area: Math.round(area(f.geometry)), pop, ...(IN_DISTRICT.has(n) ? { inDistrict: true } : {}),
  } });
}
for (const f of irn.features) {
  const n = f.properties.shapeName;
  if (!irnProvinceOf[n]) continue;
  const { pop, src } = series(irnRows, n);
  const id = f.properties.shapeID;
  sources[id] = src;
  const province = irnRows.find((r) => r.shapeName === n)?.province || irnProvinceOf[n];
  features.push({ type: 'Feature', geometry: trim(f.geometry), properties: {
    id, country: 'ir', key: n, province, az: names[n]?.[0] ?? n, ru: names[n]?.[1] ?? n, en: n.replace(/ County$/, ''),
    area: Math.round(area(f.geometry)), pop,
  } });
}

await writeFile(new URL('units.geojson', root), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
await writeFile(new URL('sources.json', root), JSON.stringify(sources) + '\n');
// Each side's official census total, which the districts on the map do not always add up to
const totals = {};
for (const r of totalRows) (totals[r.country] ??= {})[r.year] = { population: Number(r.population), source: r.source_url };
await writeFile(new URL('totals.json', root), JSON.stringify(totals) + '\n');
const years = (c) => [...new Set(features.filter((f) => f.properties.country === c).flatMap((f) => Object.keys(f.properties.pop)))].sort();
console.log(`${features.length} units (${features.filter((f) => f.properties.country === 'az').length} az, ${features.filter((f) => f.properties.country === 'ir').length} ir)`);
console.log(`censuses: az ${years('az').join(' ') || '—'} · ir ${years('ir').join(' ') || '—'}`);
const missing = features.filter((f) => !names[f.properties.key]).map((f) => f.properties.key);
if (missing.length) console.warn(`no names for: ${missing.join(', ')}`);
