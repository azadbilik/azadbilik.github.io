// Builds the khanates map's data/khanates.geojson from data/khanates.json and the areas cut by
// scripts/trace/cut.py (data/raw/areas.geojson): the nine khanates traced from Tomkeev's 1901 map of
// the borders of 1801–1813 (public domain), and the Ilisu, Qazax and Borchali lands as their 1897 uezds
// (RISTAT, doi:10.34894/NQOASN, CC0) less those; capitals as points. Javad and the khanates south of the
// Araz are drawn by their capitals only.
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const json = async (u) => JSON.parse(await readFile(u, 'utf8'));
const { khanates, south } = await json(new URL('khanates.json', root));
const cut = new Map((await json(new URL('raw/areas.geojson', root))).features.map((f) => [f.properties.id, f]));
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;

const features = [];
for (const k of khanates) {
  if (!k.trace && !k.uezds) continue; // a capital only
  const f = cut.get(k.id);
  if (!f) throw new Error(`${k.id}: no area in data/raw/areas.geojson (python scripts/trace/cut.py)`);
  const from = f.properties.from;
  if ((from === 'tomkeev-1901') !== !!k.trace) throw new Error(`${k.id}: areas.geojson says ${from}, khanates.json disagrees`);
  features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: polys(f.geometry) },
    properties: { id: k.id, kind: 'area', from, az: k.names[0], ru: k.names[1], en: k.names[2], color: k.color, annexed: k.annexed, wikidata: k.wikidata, uezds: k.uezds ?? null, note: k.note, capitalName: k.capitalName } });
}
for (const k of [...khanates, ...south]) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: k.capital },
  properties: { id: k.id, kind: 'capital', south: !khanates.includes(k), az: k.names[0], ru: k.names[1], en: k.names[2], annexed: k.annexed ?? null, wikidata: k.wikidata, color: k.color ?? null, note: k.note ?? null, capitalName: k.capitalName ?? null } });

await writeFile(new URL('khanates.geojson', root), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
console.log(`${features.filter((f) => f.properties.kind === 'area').length} areas (${khanates.filter((k) => k.trace).length} traced from the 1901 map), ${khanates.length + south.length} capitals`);
