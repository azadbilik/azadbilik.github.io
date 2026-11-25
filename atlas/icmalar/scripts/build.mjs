// Builds data/units.geojson for the communities map: the districts of Georgia (geoBoundaries GEO
// ADM2, public domain), Dagestan (RUS ADM2, ODbL) and Armenia (ARM ADM2, CC BY 3.0 IGO), each
// with the Azerbaijanis counted there at each census (data/communities-*.csv), and data/regions.json:
// each country's totals and the literary map's authors born there.
//
//   node scripts/build.mjs [path to the literary map's authors.json]
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const csv = async (p) => {
  const text = await readFile(new URL(p, root), 'utf8').catch(() => '');
  const [head, ...rows] = text.trim().split('\n').filter(Boolean);
  if (!head) return [];
  const cols = head.split(',').map((c) => c.trim());
  return rows.map((r) => {
    const cells = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
};
const num = (v) => (v == null || v === '' ? null : Number(String(v).replace(/[^\d]/g, '')));

const names = await json('names.json');
const REGIONS = {
  geo: { file: 'raw/geo-adm2.geojson', rows: 'communities-geo.csv' },
  dag: { file: 'raw/dagestan-adm2.geojson', rows: 'communities-dag.csv' },
  arm: { file: 'raw/arm-adm2.geojson', rows: 'communities-arm.csv' },
};

// Area on the sphere, km²
const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const ringArea = (ring) => { let a = 0; for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2))); } return Math.abs(a * R * R / 2); };
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const area = (g) => polys(g).reduce((s, p) => s + ringArea(p[0]) - p.slice(1).reduce((h, r) => h + ringArea(r), 0), 0);
const inRing = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const inside = (pt, g) => polys(g).some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
const trim = (g) => JSON.parse(JSON.stringify(g, (_, v) => typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v));

// The literary map's authors, to find those born in each community's districts
const authorsPath = process.argv[2] ?? new URL('../../../../xerite/data/authors.json', import.meta.url);
const authors = JSON.parse(await readFile(authorsPath, 'utf8').catch(async () => JSON.stringify(await (await fetch('https://azadbilik.org/xerite/data/authors.json')).json())));

const features = [], sources = {}, poets = {};
for (const [region, { file, rows }] of Object.entries(REGIONS)) {
  const geo = await json(file);
  const table = await csv(rows);
  for (const f of geo.features) {
    const n = f.properties.shapeName;
    const id = f.properties.shapeID;
    const series = {}, src = {};
    for (const r of table.filter((r) => r.shapeName === n)) {
      const az = num(r.azerbaijanis), total = num(r.total);
      if (az == null) continue;
      series[r.year] = [az, total];
      if (r.source_url) src[r.year] = r.source_url;
    }
    sources[id] = src;
    const born = authors.filter((a) => a.birth && inside([a.birth.lng, a.birth.lat], f.geometry))
      .sort((a, b) => (b.works ?? 0) - (a.works ?? 0)).map((a) => ({ slug: a.slug, az: a.az, ru: a.ru, en: a.en, born: a.born }));
    if (born.length) poets[id] = born;
    const nm = names[region]?.[n];
    features.push({ type: 'Feature', geometry: trim(f.geometry), properties: {
      id, region, key: n, az: nm?.[0] ?? n, ru: nm?.[1] ?? n, en: n.replace(/^городской округ /, '').replace(/^urban okrug of /, ''),
      area: Math.round(area(f.geometry)), series,
    } });
  }
}

// Each country's totals per census
const totals = { geo: {}, dag: {}, arm: {} };
for (const r of await csv('communities-totals.csv')) {
  const k = { Georgia: 'geo', Dagestan: 'dag' }[r.region];
  if (k) totals[k][r.year] = { az: num(r.azerbaijanis), total: num(r.total), source: r.source_url };
}
for (const r of await csv('communities-arm-totals.csv')) totals.arm[r.year] = { az: num(r.azerbaijanis), total: num(r.total), source: r.source_url };

await writeFile(new URL('units.geojson', root), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
await writeFile(new URL('extras.json', root), JSON.stringify({ sources, poets, totals }) + '\n');
for (const region of Object.keys(REGIONS)) {
  const fs = features.filter((f) => f.properties.region === region);
  const years = [...new Set(fs.flatMap((f) => Object.keys(f.properties.series)))].sort();
  const born = fs.reduce((s, f) => s + (poets[f.properties.id]?.length ?? 0), 0);
  console.log(`${region}: ${fs.length} units · censuses ${years.join(' ') || '—'} · totals ${Object.keys(totals[region]).join(' ') || '—'} · ${born} authors born there`);
}
